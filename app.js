const ACTIVE_MODE_KEY = 'cs_active_mode_v1';

const MODES = {
  general: {
    id: 'general',
    label: 'General',
    file: 'topics.txt',
    badgeDefault: 'CURRENT TOPIC',
    nextBtnText: 'Next Random Topic',
    keys: {
      CURRENT: 'cs_topics_current_v1',
      SEEN: 'cs_topics_seen_v1',
      CUSTOM_LIST: 'cs_topics_custom_list_v1',
      CUSTOM_NAME: 'cs_topics_custom_name_v1',
    },
  },
  cyber: {
    id: 'cyber',
    label: 'Cyber (CVEs)',
    file: 'cves.txt',
    badgeDefault: 'CURRENT CVE',
    nextBtnText: 'Next Random CVE',
    keys: {
      CURRENT: 'cs_cyber_current_v1',
      SEEN: 'cs_cyber_seen_v1',
      CUSTOM_LIST: 'cs_cyber_custom_list_v1',
      CUSTOM_NAME: 'cs_cyber_custom_name_v1',
    },
  },
};

let activeMode = localStorage.getItem(ACTIVE_MODE_KEY) === 'cyber' ? 'cyber' : 'general';
let allTopics = [];
let seenTopics = [];
let currentTopic = null;

// DOM Elements
const tabGeneral = document.getElementById('tabGeneral');
const tabCyber = document.getElementById('tabCyber');
const topicCard = document.getElementById('topicCard');
const topicBadge = document.getElementById('topicBadge');
const topicDisplay = document.getElementById('topicDisplay');
const topicSubtitle = document.getElementById('topicSubtitle');
const progressText = document.getElementById('progressText');
const remainingText = document.getElementById('remainingText');
const progressBarFill = document.getElementById('progressBarFill');
const nextBtn = document.getElementById('nextBtn');
const skipBtn = document.getElementById('skipBtn');

// Modal Elements
const menuBtn = document.getElementById('menuBtn');
const modalOverlay = document.getElementById('modalOverlay');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalModeLabel = document.getElementById('modalModeLabel');
const fileInput = document.getElementById('fileInput');
const clearCustomFileBtn = document.getElementById('clearCustomFileBtn');
const sourceStatus = document.getElementById('sourceStatus');
const seenCountModal = document.getElementById('seenCountModal');
const seenList = document.getElementById('seenList');
const resetProgressBtn = document.getElementById('resetProgressBtn');

function getModeConfig() {
  return MODES[activeMode] || MODES.general;
}

function parseTxtLines(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
  return Array.from(new Set(lines));
}

function loadStateFromStorage() {
  const { keys } = getModeConfig();
  try {
    const savedSeen = localStorage.getItem(keys.SEEN);
    seenTopics = savedSeen ? JSON.parse(savedSeen) : [];
    if (!Array.isArray(seenTopics)) seenTopics = [];
  } catch {
    seenTopics = [];
  }

  currentTopic = localStorage.getItem(keys.CURRENT) || null;
}

function saveStateToStorage() {
  const { keys } = getModeConfig();
  localStorage.setItem(keys.SEEN, JSON.stringify(seenTopics));
  if (currentTopic) {
    localStorage.setItem(keys.CURRENT, currentTopic);
  } else {
    localStorage.removeItem(keys.CURRENT);
  }
}

async function loadTopics() {
  const mode = getModeConfig();
  const customRaw = localStorage.getItem(mode.keys.CUSTOM_LIST);
  const customName = localStorage.getItem(mode.keys.CUSTOM_NAME);

  if (customRaw) {
    try {
      const parsed = JSON.parse(customRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        allTopics = parsed;
        sourceStatus.innerHTML = `Using uploaded file: <code>${escapeHtml(customName || 'custom.txt')}</code> (${allTopics.length} items)`;
        clearCustomFileBtn.classList.remove('hidden');
        return;
      }
    } catch {
      // Fallback to default file
    }
  }

  clearCustomFileBtn.classList.add('hidden');
  const response = await fetch(`./${mode.file}`, { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`Could not load ${mode.file} (${response.status})`);
  }
  const text = await response.text();
  allTopics = parseTxtLines(text);
  sourceStatus.innerHTML = `Loaded from <code>${escapeHtml(mode.file)}</code> (${allTopics.length} items)`;
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

function formatCardContent(rawItem) {
  const mode = getModeConfig();
  if (!rawItem) {
    return {
      badge: mode.badgeDefault,
      title: 'Loading...',
      subtitle: '',
    };
  }

  // Format lines like "CVE-2014-0160 — Heartbleed (OpenSSL TLS Heartbeat Buffer Over-Read)"
  if (rawItem.includes(' — ')) {
    const [cveId, rest] = rawItem.split(' — ', 2);
    const parenMatch = rest.match(/^([^(]+)\((.+)\)$/);
    if (parenMatch) {
      return {
        badge: cveId.trim(),
        title: parenMatch[1].trim(),
        subtitle: parenMatch[2].trim(),
      };
    }
    return {
      badge: cveId.trim(),
      title: rest.trim(),
      subtitle: '',
    };
  }

  return {
    badge: mode.badgeDefault,
    title: rawItem,
    subtitle: '',
  };
}

function updateModeTabsUI() {
  const isCyber = activeMode === 'cyber';
  document.body.classList.toggle('mode-cyber', isCyber);

  tabGeneral.classList.toggle('active', !isCyber);
  tabGeneral.setAttribute('aria-selected', String(!isCyber));

  tabCyber.classList.toggle('active', isCyber);
  tabCyber.setAttribute('aria-selected', String(isCyber));

  modalModeLabel.textContent = getModeConfig().label;
}

function updateUI() {
  updateModeTabsUI();

  const mode = getModeConfig();
  const total = allTopics.length;
  const validSeen = seenTopics.filter((t) => allTopics.includes(t));
  const seenCount = validSeen.length;
  const remainingCount = Math.max(0, total - seenCount);
  const percent = total > 0 ? Math.round((seenCount / total) * 100) : 0;

  progressText.textContent = `${seenCount} / ${total} explored`;
  remainingText.textContent = `${remainingCount} left`;
  progressBarFill.style.width = `${percent}%`;

  if (total === 0) {
    topicBadge.textContent = 'NO ITEMS LOADED';
    topicDisplay.textContent = `Tap the gear icon to load ${mode.file}.`;
    topicSubtitle.classList.add('hidden');
    nextBtn.disabled = true;
    skipBtn.disabled = true;
    return;
  }

  if (currentTopic) {
    const formatted = formatCardContent(currentTopic);
    topicBadge.textContent = formatted.badge;
    topicDisplay.textContent = formatted.title;
    if (formatted.subtitle) {
      topicSubtitle.textContent = formatted.subtitle;
      topicSubtitle.classList.remove('hidden');
    } else {
      topicSubtitle.textContent = '';
      topicSubtitle.classList.add('hidden');
    }
  }

  if (remainingCount === 0) {
    nextBtn.textContent = 'All Done! Tap to Start Over';
    nextBtn.disabled = false;
    skipBtn.disabled = true;
  } else {
    nextBtn.textContent = mode.nextBtnText;
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

  if (unseen.length === 0 && putCurrentBack && previousTopic) {
    unseen = [previousTopic];
  }

  if (unseen.length === 0) {
    if (confirm(`You have gone through all ${getModeConfig().label} items! Start a new round?`)) {
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
    emptyLi.textContent = 'No items seen in this mode yet.';
    seenList.appendChild(emptyLi);
    return;
  }

  [...seenTopics].reverse().forEach((topic) => {
    const li = document.createElement('li');
    li.className = 'seen-item';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'seen-item-title';
    titleSpan.textContent = topic === currentTopic ? `${topic} (current)` : topic;
    titleSpan.title = 'Tap to set as current item';
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

async function switchMode(newMode) {
  if (newMode === activeMode || !MODES[newMode]) return;
  activeMode = newMode;
  localStorage.setItem(ACTIVE_MODE_KEY, activeMode);
  await init();
}

// Event Listeners
tabGeneral.addEventListener('click', () => switchMode('general'));
tabCyber.addEventListener('click', () => switchMode('cyber'));

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
  if (confirm(`Reset all seen items in ${getModeConfig().label} and draw a new first item?`)) {
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

  const mode = getModeConfig();
  const reader = new FileReader();
  reader.onload = () => {
    const parsed = parseTxtLines(String(reader.result || ''));
    if (parsed.length === 0) {
      alert('The selected file did not contain any valid lines.');
      return;
    }
    localStorage.setItem(mode.keys.CUSTOM_LIST, JSON.stringify(parsed));
    localStorage.setItem(mode.keys.CUSTOM_NAME, file.name);
    allTopics = parsed;
    sourceStatus.innerHTML = `Using uploaded file: <code>${escapeHtml(file.name)}</code> (${allTopics.length} items)`;
    clearCustomFileBtn.classList.remove('hidden');

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
  const mode = getModeConfig();
  localStorage.removeItem(mode.keys.CUSTOM_LIST);
  localStorage.removeItem(mode.keys.CUSTOM_NAME);
  await init();
});

async function init() {
  updateModeTabsUI();
  loadStateFromStorage();
  try {
    await loadTopics();
  } catch (err) {
    console.warn('Could not fetch list automatically:', err);
    allTopics = [];
  }

  if (allTopics.length > 0) {
    if (!currentTopic || !allTopics.includes(currentTopic)) {
      drawRandomTopic();
      return;
    }
    if (!seenTopics.includes(currentTopic)) {
      seenTopics.push(currentTopic);
      saveStateToStorage();
    }
  }

  updateUI();
}

init();
