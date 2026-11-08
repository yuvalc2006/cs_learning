const STORAGE_KEYS = {
  CURRENT: 'cs_topics_current_v1',
  SEEN: 'cs_topics_seen_v1',
  CUSTOM_LIST: 'cs_topics_custom_list_v1',
  CUSTOM_NAME: 'cs_topics_custom_name_v1',
};

let allTopics = [];
let seenTopics = [];
let currentTopic = null;

// DOM Elements
const topicCard = document.getElementById('topicCard');
const topicBadge = document.getElementById('topicBadge');
const topicDisplay = document.getElementById('topicDisplay');
const progressText = document.getElementById('progressText');
const remainingText = document.getElementById('remainingText');
const progressBarFill = document.getElementById('progressBarFill');
const nextBtn = document.getElementById('nextBtn');
const skipBtn = document.getElementById('skipBtn');

// Modal Elements
const menuBtn = document.getElementById('menuBtn');
const modalOverlay = document.getElementById('modalOverlay');
const closeModalBtn = document.getElementById('closeModalBtn');
const fileInput = document.getElementById('fileInput');
const clearCustomFileBtn = document.getElementById('clearCustomFileBtn');
const sourceStatus = document.getElementById('sourceStatus');
const seenCountModal = document.getElementById('seenCountModal');
const seenList = document.getElementById('seenList');
const resetProgressBtn = document.getElementById('resetProgressBtn');

function parseTxtLines(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
  return Array.from(new Set(lines));
}

function loadStateFromStorage() {
  try {
    const savedSeen = localStorage.getItem(STORAGE_KEYS.SEEN);
    seenTopics = savedSeen ? JSON.parse(savedSeen) : [];
    if (!Array.isArray(seenTopics)) seenTopics = [];
  } catch {
    seenTopics = [];
  }

  currentTopic = localStorage.getItem(STORAGE_KEYS.CURRENT) || null;
}

function saveStateToStorage() {
  localStorage.setItem(STORAGE_KEYS.SEEN, JSON.stringify(seenTopics));
  if (currentTopic) {
    localStorage.setItem(STORAGE_KEYS.CURRENT, currentTopic);
  } else {
    localStorage.removeItem(STORAGE_KEYS.CURRENT);
  }
}

async function loadTopics() {
  const customRaw = localStorage.getItem(STORAGE_KEYS.CUSTOM_LIST);
  const customName = localStorage.getItem(STORAGE_KEYS.CUSTOM_NAME);

  if (customRaw) {
    try {
      const parsed = JSON.parse(customRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        allTopics = parsed;
        sourceStatus.innerHTML = `Using uploaded file: <code>${escapeHtml(customName || 'custom.txt')}</code> (${allTopics.length} topics)`;
        clearCustomFileBtn.classList.remove('hidden');
        return;
      }
    } catch {
      // Fallback to topics.txt
    }
  }

  clearCustomFileBtn.classList.add('hidden');
  const response = await fetch('./topics.txt', { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`Could not load topics.txt (${response.status})`);
  }
  const text = await response.text();
  allTopics = parseTxtLines(text);
  sourceStatus.innerHTML = `Loaded from <code>topics.txt</code> (${allTopics.length} topics)`;
}

function getUnseenTopics(excludeTopic = null) {
  const seenSet = new Set(seenTopics);
  return allTopics.filter((t) => !seenSet.has(t) && t !== excludeTopic);
}

function animateCard() {
  topicCard.classList.add('pop');
  setTimeout(() => {
    topicCard.classList.remove('pop');
  }, 160);
}

function updateUI() {
  const total = allTopics.length;
  const validSeen = seenTopics.filter((t) => allTopics.includes(t));
  const seenCount = validSeen.length;
  const remainingCount = Math.max(0, total - seenCount);
  const percent = total > 0 ? Math.round((seenCount / total) * 100) : 0;

  progressText.textContent = `${seenCount} / ${total} explored`;
  remainingText.textContent = `${remainingCount} left`;
  progressBarFill.style.width = `${percent}%`;

  if (total === 0) {
    topicBadge.textContent = 'NO TOPICS LOADED';
    topicDisplay.textContent = 'Tap the gear icon to load your .txt file.';
    nextBtn.disabled = true;
    skipBtn.disabled = true;
    return;
  }

  if (currentTopic) {
    topicBadge.textContent = 'CURRENT TOPIC';
    topicDisplay.textContent = currentTopic;
  }

  if (remainingCount === 0) {
    nextBtn.textContent = 'All Done! Tap to Start Over';
    nextBtn.disabled = false;
    skipBtn.disabled = true;
  } else {
    nextBtn.textContent = 'Next Random Topic';
    nextBtn.disabled = false;
    skipBtn.disabled = remainingCount === 0 || !currentTopic;
  }

  renderSeenListModal();
}

function drawRandomTopic({ putCurrentBack = false } = {}) {
  if (allTopics.length === 0) return;

  const previousTopic = currentTopic;

  if (putCurrentBack && previousTopic) {
    seenTopics = seenTopics.filter((t) => t !== previousTopic);
  }

  let unseen = getUnseenTopics(putCurrentBack ? previousTopic : null);

  // If putting back and it was the only unseen topic left, allow picking it again
  if (unseen.length === 0 && putCurrentBack && previousTopic) {
    unseen = [previousTopic];
  }

  // If all topics have been seen, offer to reset and draw fresh
  if (unseen.length === 0) {
    if (confirm('You have gone through all topics! Start a new round?')) {
      seenTopics = [];
      unseen = [...allTopics];
    } else {
      return;
    }
  }

  const randomIndex = Math.floor(Math.random() * unseen.length);
  const picked = unseen[randomIndex];

  currentTopic = picked;
  if (!seenTopics.includes(picked)) {
    seenTopics.push(picked);
  }

  saveStateToStorage();
  animateCard();
  updateUI();
}

function renderSeenListModal() {
  seenCountModal.textContent = seenTopics.length;
  seenList.innerHTML = '';

  if (seenTopics.length === 0) {
    const emptyLi = document.createElement('li');
    emptyLi.className = 'section-desc';
    emptyLi.textContent = 'No topics seen yet.';
    seenList.appendChild(emptyLi);
    return;
  }

  // Show most recent first
  [...seenTopics].reverse().forEach((topic) => {
    const li = document.createElement('li');
    li.className = 'seen-item';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'seen-item-title';
    titleSpan.textContent = topic === currentTopic ? `${topic} (current)` : topic;
    titleSpan.title = 'Tap to set as current topic';
    titleSpan.addEventListener('click', () => {
      currentTopic = topic;
      saveStateToStorage();
      updateUI();
      modalOverlay.classList.add('hidden');
    });

    const unmarkBtn = document.createElement('button');
    unmarkBtn.className = 'seen-item-unmark';
    unmarkBtn.textContent = 'Put back';
    unmarkBtn.addEventListener('click', () => {
      seenTopics = seenTopics.filter((t) => t !== topic);
      if (currentTopic === topic) {
        currentTopic = seenTopics.length > 0 ? seenTopics[seenTopics.length - 1] : null;
      }
      saveStateToStorage();
      if (!currentTopic && allTopics.length > 0) {
        drawRandomTopic();
      } else {
        updateUI();
      }
    });

    li.appendChild(titleSpan);
    li.appendChild(unmarkBtn);
    seenList.appendChild(li);
  });
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (char) => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return map[char];
  });
}

// Event Listeners
nextBtn.addEventListener('click', () => {
  drawRandomTopic({ putCurrentBack: false });
});

skipBtn.addEventListener('click', () => {
  drawRandomTopic({ putCurrentBack: true });
});

menuBtn.addEventListener('click', () => {
  renderSeenListModal();
  modalOverlay.classList.remove('hidden');
});

closeModalBtn.addEventListener('click', () => {
  modalOverlay.classList.add('hidden');
});

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) {
    modalOverlay.classList.add('hidden');
  }
});

resetProgressBtn.addEventListener('click', () => {
  if (confirm('Reset all seen topics and draw a new first topic?')) {
    seenTopics = [];
    currentTopic = null;
    saveStateToStorage();
    drawRandomTopic();
    modalOverlay.classList.add('hidden');
  }
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const parsed = parseTxtLines(String(reader.result || ''));
    if (parsed.length === 0) {
      alert('The selected file did not contain any valid lines.');
      return;
    }
    localStorage.setItem(STORAGE_KEYS.CUSTOM_LIST, JSON.stringify(parsed));
    localStorage.setItem(STORAGE_KEYS.CUSTOM_NAME, file.name);
    allTopics = parsed;
    sourceStatus.innerHTML = `Using uploaded file: <code>${escapeHtml(file.name)}</code> (${allTopics.length} topics)`;
    clearCustomFileBtn.classList.remove('hidden');

    // If current topic is not in the new list, draw a new one
    if (!currentTopic || !allTopics.includes(currentTopic)) {
      drawRandomTopic();
    } else {
      updateUI();
    }
  };
  reader.readAsText(file);
  fileInput.value = '';
});

clearCustomFileBtn.addEventListener('click', async () => {
  localStorage.removeItem(STORAGE_KEYS.CUSTOM_LIST);
  localStorage.removeItem(STORAGE_KEYS.CUSTOM_NAME);
  await init();
});

async function init() {
  loadStateFromStorage();
  try {
    await loadTopics();
  } catch (err) {
    console.warn('Could not fetch topics.txt automatically:', err);
    allTopics = [];
  }

  if (allTopics.length > 0) {
    // Ensure currentTopic is remembered across reloads; only draw if no topic has been saved yet
    if (!currentTopic) {
      drawRandomTopic();
      return;
    }
    // Make sure currentTopic is recorded in seenTopics
    if (!seenTopics.includes(currentTopic) && allTopics.includes(currentTopic)) {
      seenTopics.push(currentTopic);
      saveStateToStorage();
    }
  }

  updateUI();
}

init();
