let WORDS = [];

const DIFFICULTY_KEY = 'wordgrid:difficulty';
const INFINITE_BOARD_KEY = 'wordgrid:infinite:current';
const BOARD_SEED_LENGTH = 8;
const BOARD_SEED_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function dailyStorageKey(dateStr) {
  return `wordgrid:daily:${dateStr}`;
}

const CHEAT_CODE = '!opensesame';

async function loadWordlist() {
  try {
    let txt = null;

    try {
      const gzResp = await fetch('words.txt.gz', { cache: 'no-store' });
      if (gzResp?.ok) {
        const buf = await gzResp.arrayBuffer();
        if (typeof pako !== 'undefined' && pako.ungzip) {
          try {
            txt = pako.ungzip(new Uint8Array(buf), { to: 'string' });
            console.info('Loaded and decompressed words.txt.gz');
          } catch (e) {
            console.warn('Failed to decompress words.txt.gz in browser, falling back.', e);
            txt = null;
          }
        } else {
          console.warn('pako not available to decompress words.txt.gz; falling back to plain words.txt');
        }
      }
    } catch (e) {
      txt = null;
      console.warn('Failed to fetch words.txt.gz, falling back to plain words.txt', e);
    }

    if (txt === null) {
      const resp = await fetch('words.txt', { cache: 'no-store' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      txt = await resp.text();
      console.info('Loaded words.txt (plaintext)');
    }

    const arr = txt
      .split(/\r?\n/)
      .map((l) => l.trim().toLowerCase())
      .filter((l) => (l.length > 0) && !l.startsWith('#'));

    if (arr.length > 0) {
      WORDS = arr;
      console.info(`Loaded ${WORDS.length} words`);
      return;
    }
    throw new Error('No words found in fetched content');
  } catch (err) {
    console.error('Wordlist load error:', err);
    await showAlert('Could not load wordlist. Sorry!');
  }
}

// Category definitions
const CATEGORIES = [
  { id: "starts_vowel", label: "Starts with vowel", test: (w) => /^[aeiou]/i.test(w) },
  { id: "starts_consonant", label: "Starts with consonant", test: (w) => /^[a-z]/i.test(w) && !/^[aeiou]/i.test(w) },
  { id: "length_3", label: "3 letters", test: (w) => w.length === 3 },
  { id: "length_4", label: "4 letters", test: (w) => w.length === 4 },
  { id: "length_5", label: "5 letters", test: (w) => w.length === 5 },
  { id: "length_6", label: "6 letters", test: (w) => w.length === 6 },
  { id: "length_7", label: "7 letters", test: (w) => w.length === 7 },
  { id: "contains_ing", label: "Contains 'ing'", test: (w) => /ing/i.test(w) },
  { id: "ends_ed", label: "Ends 'ed'", test: (w) => /ed$/i.test(w) },
  { id: "double_letter", label: "Double letter", test: (w) => /([a-z])\1/i.test(w) },
  { id: "contains_a", label: "Contains 'a'", test: (w) => /a/i.test(w) },
  { id: "starts_with_re", label: "Starts 're'", test: (w) => /^re/i.test(w) },
  { id: "ends_with_y", label: "Ends with 'y'", test: (w) => /y$/i.test(w) },
  { id: "many_vowels", label: "3+ vowels", test: (w) => (w.match(/[aeiou]/gi) || []).length >= 3 },
  { id: "contains_st", label: "Contains 'st'", test: (w) => /st/i.test(w) },

  // More granular prefixes
  { id: "starts_th", label: "Starts 'th'", test: (w) => /^th/i.test(w) },
  { id: "starts_sh", label: "Starts 'sh'", test: (w) => /^sh/i.test(w) },
  { id: "starts_ch", label: "Starts 'ch'", test: (w) => /^ch/i.test(w) },
  { id: "starts_wh", label: "Starts 'wh'", test: (w) => /^wh/i.test(w) },
  { id: "starts_un", label: "Starts 'un'", test: (w) => /^un/i.test(w) },
  { id: "starts_pre", label: "Starts 'pre'", test: (w) => /^pre/i.test(w) },

  // Suffixes and endings
  { id: "ends_ion", label: "Ends with 'ion'", test: (w) => /ion$/i.test(w) },
  { id: "ends_able", label: "Ends with 'able'", test: (w) => /able$/i.test(w) },
  { id: "ends_er", label: "Ends with 'er'", test: (w) => /er$/i.test(w) },
  { id: "ends_or", label: "Ends with 'or'", test: (w) => /or$/i.test(w) },
  { id: "ends_ly", label: "Ends with 'ly'", test: (w) => /ly$/i.test(w) },

  // Letter presence (rare letters)
  { id: "has_q", label: "Contains 'q'", test: (w) => /q/i.test(w) },
  { id: "has_z", label: "Contains 'z'", test: (w) => /z/i.test(w) },
  { id: "has_x", label: "Contains 'x'", test: (w) => /x/i.test(w) },
  { id: "has_j", label: "Contains 'j'", test: (w) => /j/i.test(w) },
  { id: "has_k", label: "Contains 'k'", test: (w) => /k/i.test(w) },

  // Phonetic / pattern based
  { id: "double_vowel", label: "Double vowel (ea, oo, etc.)", test: (w) => /(aa|ee|ii|oo|uu|ea|ie|ou|oa|ui|ae)/i.test(w) },
  { id: "consonant_heavy", label: "Fewer than 2 vowels", test: (w) => (w.match(/[aeiou]/gi) || []).length < 2 },
  { id: "palindrome", label: "Palindrome", test: (w) => { const s = w.toLowerCase().replace(/[^a-z]/g, ''); return s.length > 1 && s === s.split('').reverse().join(''); } },

  // Contains specific short substrings
  { id: "contains_th", label: "Contains 'th'", test: (w) => /th/i.test(w) },
  { id: "contains_ch", label: "Contains 'ch'", test: (w) => /ch/i.test(w) },
  { id: "contains_er", label: "Contains 'er'", test: (w) => /er/i.test(w) },
  { id: "contains_ou", label: "Contains 'ou'", test: (w) => /ou/i.test(w) },

  // Rare/interesting shapes
  { id: "many_unique", label: "4+ unique letters", test: (w) => (new Set(w.replace(/[^a-z]/gi, '').split(''))).size >= 4 },
  { id: "long_word", label: "8+ letters", test: (w) => w.length >= 8 },
  { id: "short_word", label: "1-2 letters", test: (w) => w.length <= 2 },
];

// Game state
let board = {
  rows: [],
  cols: [],
  answers: [],
  best: [],
  revealed: [],
  // per-cell points awarded when that cell was guessed (null/number)
  scores: [],
};

let guessesUsed = 0; // no max, increments on every guess attempt
// record of every guess attempt (timestamped). Each entry: {time, r, c, raw, normalized, valid, reason, acceptedWord, points}
let guesses = [];
let score = 0;
let maxScore = 0;
// Difficulty: 'normal' | 'hard' | 'expert'
let difficulty = 'normal';
// Mode/state: 'infinite' or 'daily'
// Always start in daily mode (do not persist or read last-selected mode)
let currentMode = 'daily';
let currentBoardId = null; // for daily: YYYY-MM-DD, for infinite: hash
let countdownTimer = null;
let cheatMode = false; // flag to allow score manipulation for testing

// DOM refs
const dom = {
  // grid
  grid: document.getElementById("grid"),

  // info rows
  boardHash: document.getElementById("boardHash"),
  shareBoardBtn: document.getElementById("shareBoardBtn"),
  guessesInfo: document.getElementById("guessesInfo"),
  scoreInfo: document.getElementById("scoreInfo"),
  difficultyValue: document.getElementById("difficultyValue"),
  countdown: document.getElementById("countdown"),
  countdownRow: document.getElementById("countdownRow"),

  // reroll
  rerollBtn: document.getElementById("rerollBtn"),

  // dock
  settingsBtn: document.getElementById("settingsBtn"),
  settingsModal: document.getElementById("settingsModal"),
  settingsClose: document.getElementById("settingsClose"),
  resetBoardBtn: document.getElementById("resetBoardBtn"),

  // modes
  modeDaily: document.getElementById("modeDaily"),
  modeInfinite: document.getElementById("modeInfinite"),

  // message modal refs
  messageModal: document.getElementById("messageModal"),
  messageText: document.getElementById("messageText"),
  messageControls: document.getElementById("messageControls"),

  // modal
  cellModal: document.getElementById("cellModal"),
  modalHeaderText: document.getElementById("modalHeaderText"),
  modalInput: document.getElementById("modalInput"),
  modalGuessBtn: document.getElementById("modalGuessBtn"),
  modalClose: document.getElementById("modalClose"),
  modalCancelBtn: document.getElementById("modalCancelBtn"),
};

// Helpers
// Random helpers: supports optional seeded RNG for deterministic daily boards
function sample(arr, rng) {
  if (!arr || arr.length === 0) return undefined;
  if (rng) return arr[Math.floor(rng() * arr.length)];
  return arr[Math.floor(Math.random() * arr.length)];
}
function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng ? Math.floor(rng() * (i + 1)) : Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// shallow-clone a 3x3 grid so we don't share references
function cloneGrid(grid) {
  if (!Array.isArray(grid)) return Array.from({ length: 3 }, () => new Array(3).fill(null));
  return grid.map((row = []) => row.slice());
}

// escape strings before injecting into HTML
function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getWordFontSize(word) {
  const len = String(word ?? '').replace(/[^a-z0-9]/gi, '').length;
  if (len <= 6) return 18;
  if (len <= 8) return 16;
  if (len <= 10) return 14;
  if (len <= 12) return 12;
  if (len <= 14) return 11;
  return 10;
}

function normalizeBoardSeed(seed) {
  return String(seed ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, BOARD_SEED_LENGTH);
}

function isValidBoardSeed(seed) {
  return /^[a-z0-9]{8}$/.test(seed);
}

function generateBoardSeed() {
  const bytes = new Uint8Array(BOARD_SEED_LENGTH);
  const chars = [];
  if (crypto?.getRandomValues) {
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      chars.push(BOARD_SEED_ALPHABET[byte % BOARD_SEED_ALPHABET.length]);
    }
  } else {
    for (let i = 0; i < BOARD_SEED_LENGTH; i++) {
      chars.push(BOARD_SEED_ALPHABET[Math.floor(Math.random() * BOARD_SEED_ALPHABET.length)]);
    }
  }
  return chars.join('');
}

function getSeedFromLocationHash() {
  return normalizeBoardSeed(globalThis.location.hash.replace(/^#/, ''));
}

function syncLocationHash(seed) {
  const nextHash = seed ? `#${seed}` : '';
  if (globalThis.location.hash === nextHash) return;
  globalThis.history.replaceState(null, '', `${globalThis.location.pathname}${globalThis.location.search}${nextHash}`);
}

// simple string -> 32-bit integer hash (deterministic)
function strToSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.codePointAt(i), 16777619) >>> 0;
  }
  return h >>> 0;
}

// mulberry32 PRNG
function mulberry32(a) {
  return function () {
    a = Math.trunc(a);
    a = Math.trunc(a + 0x6d2b79f5);
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Rarity heuristic
const LETTER_WEIGHT = (() => {
  const freq = {
    a: 8.17,
    b: 1.49,
    c: 2.78,
    d: 4.25,
    e: 12.7,
    f: 2.23,
    g: 2.02,
    h: 6.09,
    i: 6.97,
    j: 0.15,
    k: 0.77,
    l: 4.03,
    m: 2.41,
    n: 6.75,
    o: 7.51,
    p: 1.93,
    q: 0.1,
    r: 5.99,
    s: 6.33,
    t: 9.06,
    u: 2.76,
    v: 0.98,
    w: 2.36,
    x: 0.15,
    y: 1.97,
    z: 0.07,
  };
  const weights = {};
  Object.keys(freq).forEach((letter) => {
    weights[letter] = 1 + (1 / (freq[letter] + 0.01)) * 8;
  });
  return weights;
})();

function wordRarityScore(word) {
  const w = word.toLowerCase();
  let s = 0;
  const seen = new Set();
  for (const ch of w) {
    if (/[a-z]/.test(ch)) {
      s += LETTER_WEIGHT[ch] || 1;
      seen.add(ch);
    }
  }
  s += Math.max(0, word.length - 3) * 1.5;
  s += seen.size * 0.8;
  return Math.round(s * 10);
}

function normalizeWordValue(word) {
  return String(word || '').toLowerCase().replace(/[^a-z]/g, '');
}

function isPerfectAnswer(answer, bestWord) {
  return Boolean(answer && bestWord && normalizeWordValue(answer) === normalizeWordValue(bestWord));
}

function launchPerfectFirework(cell) {
  const FireworksCtor = globalThis.Fireworks?.default || globalThis.Fireworks;
  if (!FireworksCtor || !cell) return;

  const existingLayer = cell.querySelector('.perfect-firework-layer');
  if (existingLayer) existingLayer.remove();

  const layer = document.createElement('div');
  layer.className = 'perfect-firework-layer';
  cell.appendChild(layer);

  try {
    const fireworks = new FireworksCtor(layer, {
      autoresize: true,
      opacity: 0.9,
      acceleration: 1.05,
      friction: 0.94,
      gravity: 1.4,
      particles: 20,
      traceLength: 2,
      traceSpeed: 10,
      explosion: 5,
      intensity: 18,
      flickering: 20,
      lineStyle: 'round',
      hue: { min: 35, max: 60 },
      delay: { min: 0, max: 0 },
      rocketsPoint: { min: 50, max: 50 },
      lineWidth: {
        explosion: { min: 1, max: 2 },
        trace: { min: 1, max: 1 },
      },
      brightness: { min: 85, max: 100 },
      decay: { min: 0.018, max: 0.028 },
      mouse: { click: false, move: false, max: 1 },
      sound: { enabled: false },
    });

    fireworks.start();
    fireworks.launch(1);

    globalThis.setTimeout(() => {
      try {
        fireworks.stop(true);
      } catch (err) {
        console.warn('Could not stop perfect firework', err);
      }
      layer.remove();
    }, 900);
  } catch (err) {
    console.warn('Could not launch perfect firework', err);
    layer.remove();
  }
}

function pickRankedCandidate(candidates, rng) {
  const ranked = candidates
    .map((w) => ({ w, score: wordRarityScore(w) }))
    .sort((a, b) => b.score - a.score);

  if (ranked.length > 3) {
    const idx = rng ? Math.floor(rng() * 3) : Math.floor(Math.random() * 3);
    return ranked[idx].w;
  }

  return ranked[0].w;
}

function initializeBoardState(rows, cols, answers) {
  const solutions = cloneGrid(answers);
  board.rows = rows;
  board.cols = cols;
  board.best = solutions;
  board.answers = Array.from({ length: 3 }, () => new Array(3).fill(null));
  board.revealed = Array.from({ length: 3 }, () => new Array(3).fill(false));
  board.scores = Array.from({ length: 3 }, () => new Array(3).fill(null));
  board.eliminated = Array.from({ length: 3 }, () => new Array(3).fill(false));
}

// Board builder
function buildBoard(rng) {
  for (let attempt = 0; attempt < 400; attempt++) {
    const cats = shuffle([...CATEGORIES], rng);
    const rows = cats.slice(0, 3);
    const cols = cats.slice(3, 6);

    const answers = Array.from({ length: 3 }, () => new Array(3).fill(null));
    const used = new Set();
    let possible = true;

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const test = (w) => rows[r].test(w) && cols[c].test(w);
        const candidates = WORDS.filter((w) => test(w) && !used.has(w));
        if (candidates.length === 0) {
          possible = false;
          break;
        }
        const pick = pickRankedCandidate(candidates, rng);
        answers[r][c] = pick;
        used.add(pick);
      }
      if (!possible) break;
    }

    if (possible) {
      initializeBoardState(rows, cols, answers);
      computeBoardHashAndUpdateUI();
      return true;
    }
  }
  return false;
}

async function computeBoardHashAndUpdateUI() {
  if (currentMode === 'daily') {
    // board id for daily mode should be the local date
    dom.boardHash.textContent = currentBoardId || getTodayDateStr();
  } else {
    dom.boardHash.textContent = currentBoardId || '--------';
  }
  computeMaxScore();
  updateSidebar();
}

// compute the maximum attainable score for the current board
function computeMaxScore() {
  let total = 0;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const bestWord = board.best?.[r] ? board.best[r][c] : null;
      if (bestWord) total += wordRarityScore(bestWord);
    }
  }
  maxScore = total;
}

// Daily mode helpers
function getTodayDateStr(d) {
  const now = d ? new Date(d) : new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startCountdown() {
  stopCountdown();
  if (!dom.countdownRow) return;
  dom.countdownRow.style.display = 'flex';
  function update() {
    const now = new Date();
    // Calculate midnight in local time (next day at 00:00:00)
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    let diff = next.getTime() - now.getTime();
    if (diff < 0) diff = 0;
    dom.countdown.textContent = formatMs(diff);
  }
  update();
  countdownTimer = setInterval(update, 1000);
}

function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
  if (dom.countdownRow) dom.countdownRow.style.display = 'none';
}

function formatMs(ms) {
  const total = Math.floor(ms / 1000);
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function saveDailyState(dateStr) {
  try {
    const payload = {
      board: {
        rows: board.rows.map((r) => r.id),
        cols: board.cols.map((c) => c.id),
        answers: board.answers,
        best: board.best,
      },
      revealed: board.revealed,
      scores: board.scores,
      eliminated: board.eliminated,
      guessesUsed,
      guesses,
      score,
      maxScore,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(dailyStorageKey(dateStr), JSON.stringify(payload));
  } catch (e) {
    console.warn('Could not save daily state', e);
  }
}

function loadDailyState(dateStr) {
  try {
    const raw = localStorage.getItem(dailyStorageKey(dateStr));
    if (!raw) return null;
    const payload = JSON.parse(raw);
    return payload;
  } catch (e) {
    console.warn('Could not load daily state', e);
    return null;
  }
}

function deleteDailyState(dateStr) {
  try {
    localStorage.removeItem(dailyStorageKey(dateStr));
  } catch (e) {
    console.warn('Could not delete daily state', e);
  }
}

// Infinite board storage functions
function saveInfiniteState() {
  try {
    const payload = {
      board: {
        rows: board.rows.map((r) => r.id),
        cols: board.cols.map((c) => c.id),
        answers: board.answers,
        best: board.best,
      },
      revealed: board.revealed,
      scores: board.scores,
      eliminated: board.eliminated,
      guessesUsed,
      guesses,
      score,
      maxScore,
      boardId: currentBoardId,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(INFINITE_BOARD_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('Could not save infinite state', e);
  }
}

function getCurrentBoardShareUrl() {
  const seed = normalizeBoardSeed(currentBoardId);
  const baseUrl = globalThis.location.href.split('#')[0];
  return seed ? `${baseUrl}#${seed}` : baseUrl;
}

function buildInfiniteBoardFromSeed(seed) {
  const normalizedSeed = normalizeBoardSeed(seed);
  if (!isValidBoardSeed(normalizedSeed)) return false;
  const rng = mulberry32(strToSeed(normalizedSeed));
  const ok = buildBoard(rng);
  if (!ok) return false;
  currentBoardId = normalizedSeed;
  syncLocationHash(normalizedSeed);
  return true;
}

async function applyInfiniteSeed(seed, options = {}) {
  const normalizedSeed = normalizeBoardSeed(seed);
  if (!isValidBoardSeed(normalizedSeed)) return false;

  const { restoreSaved = true, persist = true } = options;
  const saved = restoreSaved ? loadInfiniteState() : null;

  const ok = buildInfiniteBoardFromSeed(normalizedSeed);
  if (!ok) return false;

  guessesUsed = 0;
  guesses = [];
  score = 0;

  if (saved?.boardId === normalizedSeed) {
    try {
      restoreInfiniteBoard(saved);
    } catch (e) {
      console.warn('Could not restore saved infinite board for seed, using fresh board', e);
    }
  }

  computeBoardHashAndUpdateUI();
  renderGrid();
  updateStatus();
  if (persist) saveInfiniteState();
  return true;
}

function startRandomInfiniteBoard() {
  for (let attempts = 0; attempts < 100; attempts++) {
    const seed = generateBoardSeed();
    if (buildInfiniteBoardFromSeed(seed)) {
      guessesUsed = 0;
      guesses = [];
      score = 0;
      computeBoardHashAndUpdateUI();
      renderGrid();
      updateStatus();
      saveInfiniteState();
      return true;
    }
  }
  return false;
}

function loadInfiniteState() {
  try {
    const raw = localStorage.getItem(INFINITE_BOARD_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    return payload;
  } catch (e) {
    console.warn('Could not load infinite state', e);
    return null;
  }
}

function deleteInfiniteState() {
  try {
    localStorage.removeItem(INFINITE_BOARD_KEY);
  } catch (e) {
    console.warn('Could not delete infinite state', e);
  }
}

// Helper to save state for current mode
function saveCurrentState() {
  if (currentMode === 'daily') {
    saveDailyState(currentBoardId || getTodayDateStr());
  } else if (currentMode === 'infinite') {
    saveInfiniteState();
  }
}

// Build the deterministic daily board for a given local date string (YYYY-MM-DD)
function generateDailyBoardForDate(dateStr) {
  const seed = strToSeed(dateStr);
  const rng = mulberry32(seed);
  const ok = buildBoard(rng);
  if (!ok) {
    showAlert('Could not generate daily board for this date.');
    return false;
  }
  currentBoardId = dateStr;
  computeBoardHashAndUpdateUI();
  // if we have saved progress for today, load it
  const saved = loadDailyState(dateStr);
  if (saved) {
    // map row/col ids back to category objects if possible
    const rows = saved.board.rows.map((id) => CATEGORIES.find((c) => c.id === id) || { id });
    const cols = saved.board.cols.map((id) => CATEGORIES.find((c) => c.id === id) || { id });
    board.rows = rows;
    board.cols = cols;
    board.best = saved.board.best ? cloneGrid(saved.board.best) : board.best;
    board.answers = saved.board.answers ? cloneGrid(saved.board.answers) : board.answers;
    board.revealed = saved.revealed || Array.from({ length: 3 }, () => new Array(3).fill(false));
    // restore per-cell scores if present, otherwise initialize empty grid
    board.scores = saved.scores || Array.from({ length: 3 }, () => new Array(3).fill(null));
    board.eliminated = saved.eliminated || Array.from({ length: 3 }, () => new Array(3).fill(false));
    guessesUsed = saved.guessesUsed || 0;
    guesses = saved.guesses || [];
    score = saved.score || 0;
    maxScore = saved.maxScore || maxScore;
  }
  return true;
}

// Rendering
function renderGrid() {
  dom.grid.innerHTML = "";

  // top-left: logo square
  const logo = document.createElement("div");
  logo.className = "logo-square";
  logo.innerHTML = `<img width="80%" height="auto" src="logo.png" alt="WordGrid Logo" />`;
  dom.grid.appendChild(logo);

  // top column headers
  for (let c = 0; c < 3; c++) {
    const ch = document.createElement("div");
    ch.className = "col-header";
    const col = board.cols[c];
    ch.innerHTML = `<strong>${col.label}</strong>`;
    dom.grid.appendChild(ch);
  }

  // rows
  for (let r = 0; r < 3; r++) {
    // row header (square, not rotated)
    const rh = document.createElement("div");
    rh.className = "row-header";
    const row = board.rows[r];
    rh.innerHTML = `<strong>${row.label}</strong>`;
    // Row headers are non-interactive now.
    dom.grid.appendChild(rh);

    // cells
    for (let c = 0; c < 3; c++) {
      const cell = document.createElement("div");
      cell.className = "cell hidden";
      cell.dataset.r = r;
      cell.dataset.c = c;
      const rowLabel = board.rows[r]?.label ? board.rows[r].label : '';
      const colLabel = board.cols[c]?.label ? board.cols[c].label : '';
      if (board.revealed[r][c]) {
        cell.classList.remove("hidden");
        cell.classList.add("revealed");
        // eliminated cells (expert mode) show a disabled/ban marker and no score
        const isElim = board.eliminated?.[r]?.[c];
        if (isElim) {
          cell.classList.add('eliminated');
          cell.innerHTML = `<div class="word"><i class="fa-solid fa-ban eliminated-icon" aria-hidden="true"></i></div>`;
          cell.tabIndex = -1;
          cell.setAttribute('aria-disabled', 'true');
          cell.setAttribute('aria-label', `${rowLabel} + ${colLabel} — eliminated.`);
        } else {
          const bestWord = board.best?.[r]?.[c] || null;
          const isPerfect = isPerfectAnswer(board.answers[r][c], bestWord);
          // show the guessed word and the points awarded for that cell (if any)
          const cellScore = (board.scores?.[r]?.[c] == null) ? null : board.scores[r][c];
          const scoreHtml = cellScore == null ? `<div class="cell-score"></div>` : `<div class="cell-score">+${cellScore}</div>`;
          if (isPerfect) {
            cell.classList.add('perfect');
            cell.innerHTML = `
              <div class="perfect-label">Perfect</div>
              <div class="word perfect-word" style="font-size:${getWordFontSize(board.answers[r][c])}px">${board.answers[r][c]}</div>
              ${scoreHtml}
            `;
            cell.setAttribute('aria-label', `${rowLabel} + ${colLabel} — perfect match: ${board.answers[r][c]}. Revealed.`);
          } else {
            cell.innerHTML = `<div class="word" style="font-size:${getWordFontSize(board.answers[r][c])}px">${board.answers[r][c]}</div>${scoreHtml}`;
            cell.setAttribute('aria-label', `${rowLabel} + ${colLabel} — ${board.answers[r][c]}. Revealed.`);
          }
          // Make revealed cells explicitly unfocusable and non-interactive for accessibility
          cell.tabIndex = -1;
          cell.setAttribute('aria-disabled', 'true');
        }
      } else {
        cell.innerHTML = `<div class="word">?</div>`;
        // Make unrevealed cells keyboard accessible and interactive
        cell.tabIndex = 0;
        cell.setAttribute('role', 'button');
        cell.setAttribute('aria-label', `${rowLabel} + ${colLabel} - hidden. Press Enter or Space to guess.`);
        // Click handler for pointer users
        cell.addEventListener("click", () => openCellModal(r, c));
        // Keyboard activation for Enter and Space
        cell.addEventListener("keydown", (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openCellModal(r, c);
          }
        });
      }
      dom.grid.appendChild(cell);
    }
  }
  updateSidebar();
  updateStatus();
}

// Modal logic
let modalTarget = null;

function openCellModal(r, c) {
  modalTarget = { r, c };
  const row = board.rows[r].label;
  const col = board.cols[c].label;
  dom.modalHeaderText.textContent = `${row} + ${col}`;
  dom.modalInput.value = "";
  dom.cellModal.classList.remove("hidden");
  dom.cellModal.setAttribute("aria-hidden", "false");
  dom.modalInput.focus();
}

function closeModal() {
  modalTarget = null;
  dom.cellModal.classList.add("hidden");
  dom.cellModal.setAttribute("aria-hidden", "true");
}

// Settings modal handlers
function openSettingsModal() {
  if (!dom.settingsModal) return;
  dom.settingsModal.classList.remove('hidden');
  dom.settingsModal.setAttribute('aria-hidden', 'false');
  // ensure UI reflects current selection
  applyDifficultyToUI();
  // focus the close button for keyboard users
  if (dom.settingsClose) dom.settingsClose.focus();
}

function closeSettingsModal() {
  if (!dom.settingsModal) return;
  dom.settingsModal.classList.add('hidden');
  dom.settingsModal.setAttribute('aria-hidden', 'true');
}

function applyDifficultyToUI() {
  if (dom.difficultyValue) dom.difficultyValue.textContent = difficulty.charAt(0).toUpperCase() + difficulty.slice(1) + ' Mode';
  // update option buttons
  const opts = document.querySelectorAll('.difficulty-option');
  opts.forEach((el) => {
    const m = el.dataset.mode;
    const sel = (m === difficulty);
    el.classList.toggle('selected', sel);
    el.setAttribute('aria-checked', sel ? 'true' : 'false');
  });
}

function setDifficulty(mode, save = true) {
  if (!mode) return;
  if (!['normal', 'hard', 'expert'].includes(mode)) return;
  difficulty = mode;
  if (save) localStorage.setItem(DIFFICULTY_KEY, difficulty);
  applyDifficultyToUI();
}

// wire difficulty option clicks with confirm that changing difficulty clears the board
async function clearBoard() {
  // clear revealed flags, scores, eliminated flags, guesses and score
  board.revealed = Array.from({ length: 3 }, () => new Array(3).fill(false));
  board.scores = Array.from({ length: 3 }, () => new Array(3).fill(null));
  board.eliminated = Array.from({ length: 3 }, () => new Array(3).fill(false));
  guessesUsed = 0;
  guesses = [];
  score = 0;
  // persist state
  saveCurrentState();
  renderGrid();
  updateStatus();
}

document.addEventListener('click', async (ev) => {
  const btn = ev.target.closest?.('.difficulty-option');
  if (!btn) return;
  const m = btn.dataset.mode;
  if (!m) return;
  if (m === difficulty) {
    // already selected; just close settings UI
    applyDifficultyToUI();
    return;
  }
  const ok = await showConfirm('Changing the difficulty will reset the board. Do you want to continue?');
  if (!ok) {
    // re-sync UI to current difficulty
    applyDifficultyToUI();
    return;
  }
  // user confirmed: apply difficulty, persist, and clear the board (do not reroll)
  setDifficulty(m, true);
  await clearBoard();
  // If we're currently in infinite mode, also clear any saved daily progress
  // so changing difficulty resets the persisted daily board as well.
  if (currentMode === 'infinite') {
    try {
      const dateStr = currentBoardId || getTodayDateStr();
      deleteDailyState(dateStr);
    } catch (e) {
      console.warn('Error clearing saved daily board after difficulty change', e);
    }
  }
});

// Custom message / confirm dialogs
function showAlert(message) {
  return new Promise((resolve) => {
    const mm = dom.messageModal;
    const txt = dom.messageText;
    const controls = dom.messageControls;
    txt.textContent = message;
    controls.innerHTML = '<button id="msgOk">OK</button>';
    mm.classList.remove('hidden');
    mm.setAttribute('aria-hidden', 'false');
    const btn = document.getElementById('msgOk');
    btn.focus();
    btn.addEventListener('click', () => {
      mm.classList.add('hidden');
      mm.setAttribute('aria-hidden', 'true');
      resolve();
    }, { once: true });
  });
}

function showConfirm(message) {
  return new Promise((resolve) => {
    const mm = dom.messageModal;
    const txt = dom.messageText;
    const controls = dom.messageControls;
    txt.textContent = message;
    controls.innerHTML = '<button id="msgOk">OK</button><button id="msgCancel" class="secondary">Cancel</button>';
    mm.classList.remove('hidden');
    mm.setAttribute('aria-hidden', 'false');
    const ok = document.getElementById('msgOk');
    const cancel = document.getElementById('msgCancel');
    ok.focus();
    ok.addEventListener('click', () => {
      mm.classList.add('hidden');
      mm.setAttribute('aria-hidden', 'true');
      resolve(true);
    }, { once: true });
    cancel.addEventListener('click', () => {
      mm.classList.add('hidden');
      mm.setAttribute('aria-hidden', 'true');
      resolve(false);
    }, { once: true });
  });
}

// Prompt with a single-line input and OK/Cancel. Returns string or null.
function showInputPrompt(promptText, defaultValue = '') {
  return new Promise((resolve) => {
    const mm = dom.messageModal;
    const txt = dom.messageText;
    const controls = dom.messageControls;
    txt.innerHTML = `<div style="margin-bottom:8px;">${promptText}</div><input id="msgInput" value="${String(defaultValue).replaceAll('"', '&quot;')}" />`;
    controls.innerHTML = '<button id="msgOk">OK</button><button id="msgCancel" class="secondary">Cancel</button>';
    mm.classList.remove('hidden');
    mm.setAttribute('aria-hidden', 'false');
    const ok = document.getElementById('msgOk');
    const cancel = document.getElementById('msgCancel');
    const input = document.getElementById('msgInput');
    input.focus();
    input.select();
    ok.addEventListener('click', () => {
      const v = input.value.trim();
      mm.classList.add('hidden');
      mm.setAttribute('aria-hidden', 'true');
      resolve(v || null);
    }, { once: true });
    cancel.addEventListener('click', () => {
      mm.classList.add('hidden');
      mm.setAttribute('aria-hidden', 'true');
      resolve(null);
    }, { once: true });
  });
}

// submit a guess for the modal's target cell
async function submitGuessForModal() {
  if (!modalTarget) return;
  const valRaw = dom.modalInput.value.trim();
  if (!valRaw) return;

  // check if this guess activates cheat mode
  if (valRaw.toLowerCase() === CHEAT_CODE) {
    cheatMode = true;
    closeModal();
    return;
  }

  // check if cheat mode is active and the guess is a command
  if (cheatMode) {
    if (valRaw.toLowerCase() === '!reveal') {
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const bestWord = board.best?.[r]?.[c] || board.answers[r][c];
          if (bestWord) {
            board.answers[r][c] = bestWord;
            board.scores[r][c] = wordRarityScore(bestWord);
          }
          if (board.eliminated?.[r]) {
            board.eliminated[r][c] = false;
          }
          board.revealed[r][c] = true;
        }
      }
      renderGrid();
      closeModal();
      updateStatus();
      saveCurrentState();
      return;
    }

    const cheatMatch = valRaw.match(/^!(\d+)$/);
    if (cheatMatch) {
      const forcedScore = Number.parseInt(cheatMatch[1], 10);
      if (!Number.isNaN(forcedScore) && forcedScore >= 0) {
        const r = modalTarget.r, c = modalTarget.c;
        board.revealed[r][c] = true;
        if (!board.scores) board.scores = Array.from({ length: 3 }, () => new Array(3).fill(null));
        board.scores[r][c] = forcedScore;
        board.answers[r][c] = forcedScore.toString();
        score += forcedScore;
        renderGrid();
        closeModal();
        updateStatus();
        saveCurrentState();
        checkBoardComplete();
        return;
      }
    }
  }

  // every attempt counts as one guess used
  guessesUsed++;
  const r = modalTarget.r,
    c = modalTarget.c;
  const normalize = (s) => String(s).toLowerCase().replace(/[^a-z]/g, "");
  const guessNorm = normalize(valRaw);

  // record this attempt (we'll augment with result below)
  const attempt = {
    time: new Date().toISOString(),
    r,
    c,
    raw: valRaw,
    normalized: guessNorm,
  };
  // the guessed text may or may not exist in the WORDS list
  const matchedWord = WORDS.find((w) => normalize(w) === guessNorm);

  // determine duplicates across the board (excluding current cell)
  const used = new Set(board.answers.flat().filter(Boolean).map((w) => normalize(w)));
  if (board.answers[r][c]) used.delete(normalize(board.answers[r][c]));
  const isDuplicate = used.has(guessNorm);

  // category checks: ensure the guessed word satisfies both the row and column headers
  const rowTestResult = board.rows?.[r]?.test ? board.rows[r].test : (() => true);
  const colTestResult = board.cols?.[c]?.test ? board.cols[c].test : (() => true);
  const meetsCategory = matchedWord ? (rowTestResult(matchedWord) && colTestResult(matchedWord)) : false;

  const HARD_PENALTY = 50; // points deducted on hard mode for invalid attempts

  // Behavior by difficulty
  if (difficulty === 'normal') {
    // Strict: reject non-wordlist and duplicates
    if (!matchedWord) {
      attempt.valid = false;
      attempt.reason = 'not_in_wordlist';
      guesses.push(attempt);
      saveCurrentState();
      updateStatus();
      await showAlert("That word is not in the word list.");
      return;
    }
    // Also reject words that exist but do not satisfy the row/column categories
    if (!meetsCategory) {
      attempt.valid = false;
      attempt.reason = 'category_mismatch';
      guesses.push(attempt);
      saveCurrentState();
      updateStatus();
      await showAlert("That word doesn't satisfy the row and column conditions.");
      return;
    }
    if (isDuplicate) {
      attempt.valid = false;
      attempt.reason = 'duplicate';
      guesses.push(attempt);
      saveCurrentState();
      updateStatus();
      await showAlert(`That word is already used in another cell.`);
      return;
    }
  }

  // If we get here, either the guess is valid per normal rules, or difficulty allows handling
  // Expert mode: incorrect or duplicate -> eliminate the cell (no score)
  if (difficulty === 'expert' && (!matchedWord || isDuplicate)) {
    attempt.valid = false;
    attempt.reason = (matchedWord) ? 'duplicate' : 'not_in_wordlist';
    guesses.push(attempt);
    // mark cell eliminated and revealed with no score
    if (!board.eliminated) board.eliminated = Array.from({ length: 3 }, () => new Array(3).fill(false));
    board.revealed[r][c] = true;
    board.eliminated[r][c] = true;
    if (!board.scores) board.scores = Array.from({ length: 3 }, () => new Array(3).fill(null));
    board.scores[r][c] = 0;
    renderGrid();
    closeModal();
    saveCurrentState();
    updateStatus();
    await showAlert('Cell eliminated due to incorrect or duplicate guess.');
    return;
  }

  // Expert: also eliminate if the word exists but does not meet the category tests
  if (difficulty === 'expert' && matchedWord && !meetsCategory) {
    attempt.valid = false;
    attempt.reason = 'category_mismatch';
    guesses.push(attempt);
    if (!board.eliminated) board.eliminated = Array.from({ length: 3 }, () => new Array(3).fill(false));
    board.revealed[r][c] = true;
    board.eliminated[r][c] = true;
    if (!board.scores) board.scores = Array.from({ length: 3 }, () => new Array(3).fill(null));
    board.scores[r][c] = 0;
    renderGrid();
    closeModal();
    saveCurrentState();
    updateStatus();
    await showAlert('Cell eliminated: word does not meet the row/column conditions.');
    return;
  }

  // Hard mode: incorrect words are rejected (same message as normal) but still apply a penalty.
  if (difficulty === 'hard' && !matchedWord) {
    attempt.valid = false;
    attempt.reason = 'not_in_wordlist';
    guesses.push(attempt);
    // apply penalty even though the guess is rejected
    score -= HARD_PENALTY;
    saveCurrentState();
    updateStatus();
    await showAlert("That word is not in the word list. Penalty of -" + HARD_PENALTY + " points applied.");
    return;
  }

  // Hard mode: words that exist but don't satisfy the category are rejected and penalized
  if (difficulty === 'hard' && matchedWord && !meetsCategory) {
    attempt.valid = false;
    attempt.reason = 'category_mismatch';
    guesses.push(attempt);
    score -= HARD_PENALTY;
    saveCurrentState();
    updateStatus();
    await showAlert("That word doesn't satisfy the row and column conditions. Penalty of -" + HARD_PENALTY + " points applied.");
    return;
  }

  // Hard mode: duplicate guesses are rejected (same alert as normal) but still apply a penalty.
  if (difficulty === 'hard' && isDuplicate) {
    attempt.valid = false;
    attempt.reason = 'duplicate';
    guesses.push(attempt);
    // apply penalty even though the guess is rejected
    score -= HARD_PENALTY;
    saveCurrentState();
    updateStatus();
    await showAlert(`That word is already used in another cell. Penalty of -` + HARD_PENALTY + ` points applied.`);
    return;
  }

  // Otherwise it's a valid accepted guess (matchedWord exists and not duplicate, or allowed case)
  const acceptedWord = matchedWord || valRaw;
  board.answers[r][c] = acceptedWord;
  board.revealed[r][c] = true;

  // scoring: rarity-based, then scaled by candidate scarcity (only meaningful for real words)
  const rarity = wordRarityScore(acceptedWord);
  const rowTest = board.rows[r].test;
  const colTest = board.cols[c].test;
  const candidateCount = WORDS.filter((w) => rowTest(w) && colTest(w)).length || 1;
  const candidateFactor = Math.max(1, 6 / candidateCount);
  let points = Math.max(10, Math.round(rarity));
  points = Math.round(points * candidateFactor);
  attempt.valid = true;
  attempt.acceptedWord = acceptedWord;
  attempt.points = points;
  guesses.push(attempt);
  if (!board.scores) board.scores = Array.from({ length: 3 }, () => new Array(3).fill(null));
  board.scores[r][c] = points;
  score += points;
  renderGrid();
  if (isPerfectAnswer(acceptedWord, board.best?.[r]?.[c])) {
    requestAnimationFrame(() => {
      const perfectCell = dom.grid.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
      launchPerfectFirework(perfectCell);
    });
  }
  closeModal();
  updateStatus();
  saveCurrentState();
  checkBoardComplete();
}

// Game flow helpers
function updateStatus() {
  // show score and guesses in the sidebar
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  dom.scoreInfo.textContent = `${score} / ${maxScore} (${pct}%)`;
  dom.guessesInfo.textContent = `${guessesUsed} guesses`;
}

function updateSidebar() {
  // ensure sidebar values reflect current state
  dom.guessesInfo.textContent = `${guessesUsed} guesses`;
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  dom.scoreInfo.textContent = `${score} / ${maxScore} (${pct}%)`;
  if (dom.difficultyValue) dom.difficultyValue.textContent = difficulty.charAt(0).toUpperCase() + difficulty.slice(1) + ' Mode';
}

function buildAnalysisLines() {
  const getLabel = (items, index, fallbackPrefix) => items?.[index]?.label ? items[index].label : `${fallbackPrefix} ${index + 1}`;
  const formatPoints = (value) => value == null ? '' : ` (+${value})`;

  return Array.from({ length: 3 }, (_, r) => r).flatMap((r) => {
    const rowLabel = getLabel(board.rows, r, 'Row');

    return Array.from({ length: 3 }, (_, c) => c).map((c) => {
      const colLabel = getLabel(board.cols, c, 'Col');
      const eliminated = Boolean(board.eliminated?.[r]?.[c]);
      const userWord = board.answers?.[r]?.[c] ?? null;
      const bestWord = board.best?.[r]?.[c] ?? null;
      const userScore = eliminated ? null : board.scores?.[r]?.[c] ?? null;
      const bestScore = bestWord ? wordRarityScore(bestWord) : null;
      const matched = userWord && bestWord && String(userWord).toLowerCase() === String(bestWord).toLowerCase();
      const userText = eliminated ? 'Skipped' : (userWord || '—');
      const bestText = bestWord || '—';

      return `${rowLabel} + ${colLabel}: you ${userText}${eliminated ? '' : formatPoints(userScore)} | best ${bestText}${formatPoints(bestScore)}${matched ? ' — matched best' : ''}`;
    });
  });
}

// richer data for the interactive analysis view
function getAnalysisCellLabel(items, index, fallbackPrefix) {
  return items?.[index]?.label ? items[index].label : `${fallbackPrefix} ${index + 1}`;
}

function buildAnalysisEntry(r, c) {
  const rowLabel = getAnalysisCellLabel(board.rows, r, 'Row');
  const colLabel = getAnalysisCellLabel(board.cols, c, 'Col');
  const eliminated = !!(board.eliminated?.[r]?.[c]);
  const userWord = board.answers?.[r]?.[c] ?? null;
  const bestWord = board.best?.[r]?.[c] ?? null;
  const userScore = (!eliminated && board.scores?.[r]?.[c] != null) ? board.scores[r][c] : null;
  const bestScore = bestWord ? wordRarityScore(bestWord) : null;
  const matched = userWord && bestWord && String(userWord).toLowerCase() === String(bestWord).toLowerCase();
  const gap = (bestScore == null ? 0 : bestScore) - (userScore == null ? 0 : userScore);

  return {
    r,
    c,
    rowLabel,
    colLabel,
    eliminated,
    userWord,
    bestWord,
    userScore,
    bestScore,
    matched,
    gap,
  };
}

function buildAnalysisSummaryEntry(entries) {
  const totalBestScore = entries.reduce((sum, e) => sum + (e.bestScore == null ? 0 : e.bestScore), 0);
  const matchedCount = entries.filter((e) => e.matched).length;
  const eliminatedCount = entries.filter((e) => e.eliminated).length;
  const percentOfMax = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const stats = [
    { label: 'Score', value: `${score} / ${maxScore} (${percentOfMax}%)` },
    { label: 'Matched cells', value: `${matchedCount} / 9` },
    { label: 'Best cell points', value: `${totalBestScore}` },
    { label: 'Guesses used', value: `${guessesUsed}` },
  ];

  if (eliminatedCount > 0) {
    stats.splice(2, 0, { label: 'Skipped', value: `${eliminatedCount}` });
  }

  return {
    type: 'summary',
    stats,
  };
}

function buildAnalysisEntries() {
  const entries = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      entries.push(buildAnalysisEntry(r, c));
    }
  }

  entries.push(buildAnalysisSummaryEntry(entries));
  return entries;
}

function showBoardAnalysis() {
  return new Promise((resolve) => {
    const mm = dom.messageModal;
    const txt = dom.messageText;
    const controls = dom.messageControls;
    const entries = buildAnalysisEntries();
    let page = 0;

    txt.innerHTML = `
      <div id="analysisClose" class="analysis-close" role="button" tabindex="0" aria-label="Close analysis">
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </div>
      <div class="analysis-title">Board analysis</div>
      <div class="analysis-panel">
        <div class="analysis-card" id="analysisCard"></div>
      </div>
    `;
    controls.innerHTML = `
      <div class="analysis-controls">
        <div class="analysis-nav">
          <button id="analysisPrev" class="secondary">Prev</button>
          <div class="analysis-nav-status" id="analysisNavStatus"></div>
          <button id="analysisNext">Next</button>
        </div>
      </div>
    `;
    mm.classList.remove('hidden');
    mm.setAttribute('aria-hidden', 'false');
    const prevBtn = document.getElementById('analysisPrev');
    const nextBtn = document.getElementById('analysisNext');
    const closeBtn = document.getElementById('analysisClose');
    const card = document.getElementById('analysisCard');
    const status = document.getElementById('analysisNavStatus');
    const nav = controls.querySelector('.analysis-nav');

    const describeStatus = (entry) => {
      if (entry.type === 'summary') return { text: 'Overview', cls: 'good' };
      if (entry.eliminated) return { text: 'Skipped', cls: 'warn' };
      if (entry.matched) return { text: 'Perfect match', cls: 'good' };
      if (entry.bestScore != null) {
        const ratio = (entry.userScore == null ? 0 : entry.userScore) / (entry.bestScore || 1);
        if (ratio >= 0.9) return { text: 'Close', cls: 'almost' };
        if (ratio >= 0.6) return { text: 'Solid', cls: 'ok' };
        if (ratio >= 0.3) return { text: 'Partial', cls: 'warn' };
        return { text: 'Missed', cls: 'miss' };
      }
      return { text: 'No match', cls: 'miss' };
    };

    const renderSummaryPage = (entry, statusText, statusCls) => {
      const statsHtml = (entry.stats || []).map((s) => `<div class="analysis-summary-row"><span>${escapeHtml(s.label)}</span><span>${escapeHtml(s.value)}</span></div>`).join('');
      return `
          <div class="analysis-crumb">${page + 1} / ${entries.length}</div>
          <div class="analysis-section">
            <div class="analysis-tags">Overall</div>
            <div class="analysis-status ${statusCls}">${statusText}</div>
          </div>
          <div class="analysis-summary">${statsHtml}</div>
        `;
    };

    const renderDetailPage = (entry, statusText, statusCls) => {
      let gapText;
      if (entry.bestScore == null) {
        gapText = 'N/A';
      } else {
        const gap = entry.bestScore - (entry.userScore ?? 0);
        gapText = gap === 0 ? 'No gap' : `${gap} away`;
      }
      const userLabel = entry.eliminated ? 'Skipped' : (entry.userWord || '—');
      let userScoreText;
      if (entry.eliminated) {
        userScoreText = '';
      } else if (entry.userScore == null) {
        userScoreText = 'No score';
      } else {
        userScoreText = `+${entry.userScore}`;
      }
      const bestScoreText = entry.bestScore == null ? 'N/A' : `+${entry.bestScore}`;

      return `
          <div class="analysis-crumb">${page + 1} / ${entries.length}</div>
          <div class="analysis-section">
            <div class="analysis-tags">${escapeHtml(entry.rowLabel)} · ${escapeHtml(entry.colLabel)}</div>
            <div class="analysis-status ${statusCls}">${statusText}</div>
          </div>
          <div class="analysis-grid">
            <div class="analysis-block user">
              <div class="label">You</div>
              <div class="word">${escapeHtml(userLabel)}</div>
              <div class="score">${escapeHtml(userScoreText)}</div>
            </div>
            <div class="analysis-block best">
              <div class="label">Best</div>
              <div class="word">${escapeHtml(entry.bestWord || '—')}</div>
              <div class="score">${escapeHtml(bestScoreText)}</div>
            </div>
          </div>
          <div class="analysis-gap">${escapeHtml(gapText)}</div>
        `;
    };

    const updateNavigationState = (entry) => {
      const isSummary = entry.type === 'summary';
      if (status) status.textContent = `${page + 1} / ${entries.length}`;
      if (nav) nav.style.display = isSummary ? 'none' : 'flex';
      prevBtn.disabled = page === 0;
      nextBtn.disabled = page === entries.length - 1;
      nextBtn.style.display = isSummary ? 'none' : '';
      prevBtn.style.display = isSummary ? 'none' : '';
      if (status) status.style.display = isSummary ? 'none' : '';
    };

    const renderPage = (direction) => {
      if (!card) return;
      const entry = entries[page];
      const { text: statusText, cls: statusCls } = describeStatus(entry);

      card.innerHTML = entry.type === 'summary'
        ? renderSummaryPage(entry, statusText, statusCls)
        : renderDetailPage(entry, statusText, statusCls);

      // animation hint based on direction
      card.classList.remove('slide-in-left', 'slide-in-right');
      void card.offsetWidth;
      if (direction === 'next') card.classList.add('slide-in-right');
      if (direction === 'prev') card.classList.add('slide-in-left');

      updateNavigationState(entry);
    };

    const goPrev = () => {
      if (page === 0) return;
      page -= 1;
      renderPage('prev');
    };
    const goNext = () => {
      if (page >= entries.length - 1) return;
      page += 1;
      renderPage('next');
    };

    prevBtn.addEventListener('click', goPrev);
    nextBtn.addEventListener('click', goNext);
    closeBtn.addEventListener('click', () => {
      mm.classList.add('hidden');
      mm.setAttribute('aria-hidden', 'true');
      resolve();
    }, { once: true });
    closeBtn.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        closeBtn.click();
      }
    });

    closeBtn.focus();
    renderPage('init');
  });
}

function checkBoardComplete() {
  const all = board.revealed.flat().every(Boolean);
  if (all) {
    updateStatus();
    setTimeout(async () => {
      await showAlert(`Board complete! Final score: ${score}`);
      // persist final result and clear infinite state when complete
      if (currentMode === 'daily') {
        saveDailyState(currentBoardId || getTodayDateStr());
      } else if (currentMode === 'infinite') {
        // Clear saved infinite state since board is completed
        deleteInfiniteState();
      }
      const wantsAnalysis = await showConfirm('See an analysis comparing your answers to the best board?');
      if (wantsAnalysis) {
        await showBoardAnalysis();
      }
    }, 80);
  }
}

// new board / reroll
function newBoard() {
  if (currentMode === 'infinite') {
    const ok = startRandomInfiniteBoard();
    if (!ok) {
      showAlert("Couldn't build a board with the current wordlist and categories.");
    }
    return;
  }
  const ok = buildBoard();
  if (!ok) {
    showAlert("Couldn't build a board with the current wordlist and categories.");
    return;
  }
  guessesUsed = 0;
  guesses = [];
  score = 0;
  renderGrid();
  updateStatus();
}

// reveal all
function revealAll() {
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const bestWord = board.best?.[r]?.[c] || board.answers[r][c];
      if (bestWord) {
        board.answers[r][c] = bestWord;
        board.scores[r][c] = wordRarityScore(bestWord);
      }
      if (board.eliminated?.[r]) {
        board.eliminated[r][c] = false;
      }
      board.revealed[r][c] = true;
    }
  }
  renderGrid();
  updateStatus();
}

// Event wiring
dom.rerollBtn.addEventListener("click", async () => {
  if (currentMode === 'daily') {
    await showAlert('Reroll is disabled in Daily mode.');
    return;
  }
  const ok = await showConfirm("Reroll the board?");
  if (ok) newBoard();
});

dom.modalGuessBtn.addEventListener("click", submitGuessForModal);
dom.modalClose.addEventListener("click", closeModal);
dom.modalCancelBtn.addEventListener("click", closeModal);
dom.cellModal.addEventListener("click", (ev) => {
  if (ev.target === dom.cellModal) closeModal();
});

if (dom.settingsBtn) dom.settingsBtn.addEventListener('click', openSettingsModal);
if (dom.settingsClose) dom.settingsClose.addEventListener('click', closeSettingsModal);
if (dom.settingsModal) dom.settingsModal.addEventListener('click', (ev) => { if (ev.target === dom.settingsModal) closeSettingsModal(); });

if (dom.resetBoardBtn) dom.resetBoardBtn.addEventListener('click', async () => {
  const ok = await showConfirm('Reset the board? This will clear all progress (guesses and scores) but keep the current board. Continue?');
  if (ok) await clearBoard();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal();
    closeSettingsModal();
  }
  // If Enter is pressed while the modal is open, prefer the input-specific handler
  // so we can prevent duplicate/dropped events. If the input is focused, skip here.
  if (e.key === "Enter" && !dom.cellModal.classList.contains("hidden")) {
    if (document.activeElement === dom.modalInput) return;
    submitGuessForModal();
  }
});

// Ensure pressing Enter inside the modal input submits the guess reliably
if (dom.modalInput) {
  dom.modalInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      submitGuessForModal();
    }
  });
}

globalThis.addEventListener('hashchange', async () => {
  if (currentMode !== 'infinite') return;
  const hashSeed = getSeedFromLocationHash();
  if (!isValidBoardSeed(hashSeed) || hashSeed === currentBoardId) return;
  await applyInfiniteSeed(hashSeed, { restoreSaved: true, persist: true });
});

if (dom.shareBoardBtn) dom.shareBoardBtn.addEventListener('click', copyCurrentBoardLink);

function updateModeTabs(mode) {
  if (!dom.modeDaily || !dom.modeInfinite) return;
  dom.modeDaily.classList.toggle('active', mode === 'daily');
  dom.modeInfinite.classList.toggle('active', mode === 'infinite');
  dom.modeDaily.setAttribute('aria-selected', mode === 'daily' ? 'true' : 'false');
  dom.modeInfinite.setAttribute('aria-selected', mode === 'infinite' ? 'true' : 'false');
  if (dom.shareBoardBtn) dom.shareBoardBtn.hidden = mode !== 'infinite';
}

function refreshModeView() {
  renderGrid();
  updateStatus();
}

function resetDailyBoard(today) {
  currentBoardId = today;
  startCountdown();
  generateDailyBoardForDate(today);
  const saved = loadDailyState(today);
  if (!saved) {
    guessesUsed = 0;
    score = 0;
    computeMaxScore();
    saveDailyState(today);
  }
}

function restoreInfiniteBoard(saved) {
  const rows = saved.board.rows.map((id) => CATEGORIES.find((c) => c.id === id));
  const cols = saved.board.cols.map((id) => CATEGORIES.find((c) => c.id === id));
  if (rows.some((r) => !r) || cols.some((c) => !c)) {
    const missingRows = saved.board.rows.filter((id) => !CATEGORIES.some((c) => c.id === id));
    const missingCols = saved.board.cols.filter((id) => !CATEGORIES.some((c) => c.id === id));
    throw new Error(`Missing categories - rows: [${missingRows.join(', ')}], cols: [${missingCols.join(', ')}]`);
  }
  board.rows = rows;
  board.cols = cols;
  board.best = saved.board.best ? cloneGrid(saved.board.best) : Array.from({ length: 3 }, () => new Array(3).fill(null));
  board.answers = saved.board.answers ? cloneGrid(saved.board.answers) : Array.from({ length: 3 }, () => new Array(3).fill(null));
  board.revealed = saved.revealed || Array.from({ length: 3 }, () => new Array(3).fill(false));
  board.scores = saved.scores || Array.from({ length: 3 }, () => new Array(3).fill(null));
  board.eliminated = saved.eliminated || Array.from({ length: 3 }, () => new Array(3).fill(false));
  guessesUsed = saved.guessesUsed || 0;
  guesses = saved.guesses || [];
  score = saved.score || 0;
  maxScore = saved.maxScore || 0;
  currentBoardId = saved.boardId;
  computeBoardHashAndUpdateUI();
}

async function copyCurrentBoardLink() {
  const seed = normalizeBoardSeed(currentBoardId);
  if (!isValidBoardSeed(seed)) {
    await showAlert('No shareable seed is available for this board yet.');
    return;
  }

  const url = getCurrentBoardShareUrl();
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      await showAlert('Share link copied.');
      return;
    }
    await showAlert(`Copy this link: ${url}`);
  } catch (e) {
    console.warn('Could not copy share link', e);
    await showAlert(`Could not copy automatically. Link: ${url}`);
  }
}

async function setInfiniteMode() {
  stopCountdown();
  const hashSeed = getSeedFromLocationHash();
  if (isValidBoardSeed(hashSeed)) {
    await applyInfiniteSeed(hashSeed, { restoreSaved: true, persist: true });
    return;
  }
  const saved = loadInfiniteState();
  if (saved?.board) {
    try {
      restoreInfiniteBoard(saved);
      return;
    } catch (e) {
      console.warn('Could not restore saved infinite board, generating new one', e);
    }
  }
  startRandomInfiniteBoard();
}

async function setMode(mode) {
  if (mode !== 'daily' && mode !== 'infinite') return;
  currentMode = mode;
  updateModeTabs(mode);
  if (dom.rerollBtn) dom.rerollBtn.disabled = mode === 'daily';
  if (mode === 'daily') {
    resetDailyBoard(getTodayDateStr());
  } else {
    await setInfiniteMode();
  }
  refreshModeView();
}

if (dom.modeDaily) dom.modeDaily.addEventListener('click', () => {
  setMode('daily');
});
if (dom.modeInfinite) dom.modeInfinite.addEventListener('click', () => setMode('infinite'));

// Init
(async function init() {
  await loadWordlist();
  // load persisted difficulty selection
  try {
    const stored = localStorage.getItem(DIFFICULTY_KEY);
    if (stored && ['normal', 'hard', 'expert'].includes(stored)) {
      setDifficulty(stored, false);
    } else {
      setDifficulty(difficulty, false);
    }
  } catch (e) {
    // If accessing localStorage fails (e.g. disabled or blocked), log and fall back to default
    console.warn('Failed to load difficulty from storage, using default.', e);
    setDifficulty(difficulty, false);
  }
  // initialize according to saved mode
  const hashSeed = getSeedFromLocationHash();
  if (isValidBoardSeed(hashSeed)) {
    currentMode = 'infinite';
  }
  await setMode(currentMode || 'infinite');
})();
