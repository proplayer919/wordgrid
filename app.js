// Word list
let WORDS = [];

// Local storage keys
const DIFFICULTY_KEY = 'wordgrid:difficulty';

// Attempt to load words from URL. Try a gzipped version first, then fall back to plaintext.
async function loadWordlist() {
  try {
    let txt = null;

    // Try to fetch a gzipped wordlist first (words.txt.gz). This is a small binary
    // transfer and will be decompressed in the browser using pako.
    try {
      const gzResp = await fetch('words.txt.gz', { cache: 'no-store' });
      if (gzResp && gzResp.ok) {
        // get binary data and ungzip
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
          txt = null;
        }
      }
    } catch (e) {
      // network error or not present — fall through to plaintext fetch
      txt = null;
    }

    // If gz fetch/decompress failed, fall back to plain text file
    if (txt === null) {
      const resp = await fetch('words.txt', { cache: 'no-store' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      txt = await resp.text();
      console.info('Loaded words.txt (plaintext)');
    }

    // Parse newline-separated entries
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
  { id: "double_vowel", label: "Double vowel (ea, oo, etc.)", test: (w) => /(aa|ee|ii|oo|uu|ea|ie|ou|oa)/i.test(w) },
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

// DOM refs
const dom = {
  // grid
  grid: document.getElementById("grid"),

  // info rows
  boardHash: document.getElementById("boardHash"),
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

// simple string -> 32-bit integer hash (deterministic)
function strToSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
  }
  return h >>> 0;
}

// mulberry32 PRNG
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// SHA-256 hex
async function sha256hex(str) {
  const enc = new TextEncoder();
  const buf = enc.encode(str);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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

// Board builder
function buildBoard(rng) {
  const triesMax = 400;
  for (let attempt = 0; attempt < triesMax; attempt++) {
    const cats = shuffle([...CATEGORIES], rng);
    const rows = cats.slice(0, 3);
    const cols = cats.slice(3, 6);

    const answers = Array.from({ length: 3 }, () => Array(3).fill(null));
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
        const ranked = candidates
          .map((w) => ({ w, score: wordRarityScore(w) }))
          .sort((a, b) => b.score - a.score);
        let pick;
        if (ranked.length > 3) {
          const idx = rng ? Math.floor(rng() * 3) : Math.floor(Math.random() * 3);
          pick = ranked[idx].w;
        } else {
          pick = ranked[0].w;
        }
        answers[r][c] = pick;
        used.add(pick);
      }
      if (!possible) break;
    }

    if (possible) {
      board.rows = rows;
      board.cols = cols;
      board.answers = answers;
      board.revealed = Array.from({ length: 3 }, () => Array(3).fill(false));
      board.scores = Array.from({ length: 3 }, () => Array(3).fill(null));
      board.eliminated = Array.from({ length: 3 }, () => Array(3).fill(false));
      computeBoardHashAndUpdateUI();
      return true;
    }
  }
  return false;
}

async function computeBoardHashAndUpdateUI() {
  const flat = board.answers.flat().join("|");
  const h = await sha256hex(flat);
  if (currentMode === 'daily') {
    // board id for daily mode should be the local date
    dom.boardHash.textContent = currentBoardId || getTodayDateStr();
  } else {
    dom.boardHash.textContent = h.slice(0, 6);
    currentBoardId = h.slice(0, 6);
  }
  computeMaxScore();
  updateSidebar();
}

// compute the maximum attainable score for the current board
function computeMaxScore() {
  let total = 0;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const rowTest = board.rows[r].test;
      const colTest = board.cols[c].test;
      const candidates = WORDS.filter((w) => rowTest(w) && colTest(w));
      const candidateCount = Math.max(1, candidates.length);
      const maxRarity = candidates.length
        ? Math.max(...candidates.map((w) => wordRarityScore(w)))
        : wordRarityScore(board.answers[r][c] || "");
      const base = Math.max(10, Math.round(maxRarity));
      const candidateFactor = Math.max(1, 6 / candidateCount);
      total += Math.round(base * candidateFactor);
    }
  }
  maxScore = total + 500; // + completion bonus
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

function dailyStorageKey(dateStr) {
  return `wordgrid:daily:${dateStr}`;
}

function saveDailyState(dateStr) {
  try {
    const payload = {
      board: {
        rows: board.rows.map((r) => r.id),
        cols: board.cols.map((c) => c.id),
        answers: board.answers,
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
    try {
      const rows = saved.board.rows.map((id) => CATEGORIES.find((c) => c.id === id) || { id });
      const cols = saved.board.cols.map((id) => CATEGORIES.find((c) => c.id === id) || { id });
      board.rows = rows;
      board.cols = cols;
      board.answers = saved.board.answers;
      board.revealed = saved.revealed;
      // restore per-cell scores if present, otherwise initialize empty grid
      board.scores = saved.scores || Array.from({ length: 3 }, () => Array(3).fill(null));
      board.eliminated = saved.eliminated || Array.from({ length: 3 }, () => Array(3).fill(false));
      guessesUsed = saved.guessesUsed || 0;
      guesses = saved.guesses || [];
      score = saved.score || 0;
      maxScore = saved.maxScore || maxScore;
    } catch (e) {
      console.warn('Malformed saved daily state, ignoring.');
    }
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
    // Headers are no longer interactive — clicking should not open alerts.
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
      const rowLabel = board.rows[r] && board.rows[r].label ? board.rows[r].label : '';
      const colLabel = board.cols[c] && board.cols[c].label ? board.cols[c].label : '';
      if (board.revealed[r][c]) {
        cell.classList.remove("hidden");
        cell.classList.add("revealed");
        // eliminated cells (expert mode) show a disabled/ban marker and no score
        const isElim = board.eliminated && board.eliminated[r] && board.eliminated[r][c];
        if (isElim) {
          cell.classList.add('eliminated');
          cell.innerHTML = `<div class="word"><i class="fa-solid fa-ban eliminated-icon" aria-hidden="true"></i></div>`;
          cell.tabIndex = -1;
          cell.setAttribute('aria-disabled', 'true');
          cell.setAttribute('aria-label', `${rowLabel} + ${colLabel} — eliminated.`);
        } else {
          // show the guessed word and the points awarded for that cell (if any)
          const cellScore = (board.scores && board.scores[r] && board.scores[r][c] != null) ? board.scores[r][c] : null;
          const scoreHtml = cellScore != null ? `<div class="cell-score">+${cellScore}</div>` : `<div class="cell-score"></div>`;
          cell.innerHTML = `<div class="word">${board.answers[r][c]}</div>${scoreHtml}`;
          // Make revealed cells explicitly unfocusable and non-interactive for accessibility
          cell.tabIndex = -1;
          cell.setAttribute('aria-disabled', 'true');
          cell.setAttribute('aria-label', `${rowLabel} + ${colLabel} — ${board.answers[r][c]}. Revealed.`);
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
let modalTarget = null; // {r,c}

function openCellModal(r, c) {
  modalTarget = { r, c };
  const row = board.rows[r].label;
  const col = board.cols[c].label;
  dom.modalHeaderText.textContent = `${row} + ${col}`;
  dom.modalInput.value = "";
  dom.cellModal.classList.remove("hidden");
  dom.cellModal.setAttribute("aria-hidden", "false");
  dom.modalInput.focus();
  // suggestions removed; input is simple free-text
}

function closeModal() {
  modalTarget = null;
  dom.cellModal.classList.add("hidden");
  dom.cellModal.setAttribute("aria-hidden", "true");
}

// Settings modal handlers (empty dialog for now)
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
  board.revealed = Array.from({ length: 3 }, () => Array(3).fill(false));
  board.scores = Array.from({ length: 3 }, () => Array(3).fill(null));
  board.eliminated = Array.from({ length: 3 }, () => Array(3).fill(false));
  guessesUsed = 0;
  guesses = [];
  score = 0;
  // persist if daily
  if (currentMode === 'daily') saveDailyState(currentBoardId || getTodayDateStr());
  renderGrid();
  updateStatus();
}

document.addEventListener('click', async (ev) => {
  const btn = ev.target.closest && ev.target.closest('.difficulty-option');
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

// Custom message / confirm dialogs (replace alert/confirm)
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

// submit a guess for the modal's target cell
async function submitGuessForModal() {
  if (!modalTarget) return;
  const valRaw = dom.modalInput.value.trim();
  if (!valRaw) return;
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
  const rowTestResult = board.rows[r] && board.rows[r].test ? board.rows[r].test : (() => true);
  const colTestResult = board.cols[c] && board.cols[c].test ? board.cols[c].test : (() => true);
  const meetsCategory = matchedWord ? (rowTestResult(matchedWord) && colTestResult(matchedWord)) : false;

  const HARD_PENALTY = 50; // points deducted on hard mode for invalid attempts

  // Behavior by difficulty
  if (difficulty === 'normal') {
    // Strict: reject non-wordlist and duplicates
    if (!matchedWord) {
      attempt.valid = false;
      attempt.reason = 'not_in_wordlist';
      guesses.push(attempt);
      if (currentMode === 'daily') saveDailyState(currentBoardId || getTodayDateStr());
      updateStatus();
      await showAlert("That word is not in the word list.");
      return;
    }
    // Also reject words that exist but do not satisfy the row/column categories
    if (!meetsCategory) {
      attempt.valid = false;
      attempt.reason = 'category_mismatch';
      guesses.push(attempt);
      if (currentMode === 'daily') saveDailyState(currentBoardId || getTodayDateStr());
      updateStatus();
      await showAlert("That word doesn't satisfy the row and column conditions.");
      return;
    }
    if (isDuplicate) {
      attempt.valid = false;
      attempt.reason = 'duplicate';
      guesses.push(attempt);
      if (currentMode === 'daily') saveDailyState(currentBoardId || getTodayDateStr());
      updateStatus();
      await showAlert(`That word is already used in another cell.`);
      return;
    }
  }

  // If we get here, either the guess is valid per normal rules, or difficulty allows handling
  // Expert mode: incorrect or duplicate -> eliminate the cell (no score)
  if (difficulty === 'expert' && (!matchedWord || isDuplicate)) {
    attempt.valid = false;
    attempt.reason = (!matchedWord) ? 'not_in_wordlist' : 'duplicate';
    guesses.push(attempt);
    // mark cell eliminated and revealed with no score
    if (!board.eliminated) board.eliminated = Array.from({ length: 3 }, () => Array(3).fill(false));
    board.revealed[r][c] = true;
    board.eliminated[r][c] = true;
    if (!board.scores) board.scores = Array.from({ length: 3 }, () => Array(3).fill(null));
    board.scores[r][c] = 0;
    renderGrid();
    closeModal();
    if (currentMode === 'daily') saveDailyState(currentBoardId || getTodayDateStr());
    updateStatus();
    await showAlert('Cell eliminated due to incorrect or duplicate guess.');
    return;
  }

  // Expert: also eliminate if the word exists but does not meet the category tests
  if (difficulty === 'expert' && matchedWord && !meetsCategory) {
    attempt.valid = false;
    attempt.reason = 'category_mismatch';
    guesses.push(attempt);
    if (!board.eliminated) board.eliminated = Array.from({ length: 3 }, () => Array(3).fill(false));
    board.revealed[r][c] = true;
    board.eliminated[r][c] = true;
    if (!board.scores) board.scores = Array.from({ length: 3 }, () => Array(3).fill(null));
    board.scores[r][c] = 0;
    renderGrid();
    closeModal();
    if (currentMode === 'daily') saveDailyState(currentBoardId || getTodayDateStr());
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
    if (currentMode === 'daily') saveDailyState(currentBoardId || getTodayDateStr());
    updateStatus();
    await showAlert("That word is not in the word list.");
    return;
  }

  // Hard mode: words that exist but don't satisfy the category are rejected and penalized
  if (difficulty === 'hard' && matchedWord && !meetsCategory) {
    attempt.valid = false;
    attempt.reason = 'category_mismatch';
    guesses.push(attempt);
    score -= HARD_PENALTY;
    if (currentMode === 'daily') saveDailyState(currentBoardId || getTodayDateStr());
    updateStatus();
    await showAlert("That word doesn't satisfy the row and column conditions.");
    return;
  }

  // Hard mode: duplicate guesses are rejected (same alert as normal) but still apply a penalty.
  if (difficulty === 'hard' && isDuplicate) {
    attempt.valid = false;
    attempt.reason = 'duplicate';
    guesses.push(attempt);
    // apply penalty even though the guess is rejected
    score -= HARD_PENALTY;
    if (currentMode === 'daily') saveDailyState(currentBoardId || getTodayDateStr());
    updateStatus();
    await showAlert(`That word is already used in another cell.`);
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
  if (!board.scores) board.scores = Array.from({ length: 3 }, () => Array(3).fill(null));
  board.scores[r][c] = points;
  score += points;
  renderGrid();
  closeModal();
  updateStatus();
  if (currentMode === 'daily') {
    saveDailyState(currentBoardId || getTodayDateStr());
  }
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

function checkBoardComplete() {
  const all = board.revealed.flat().every(Boolean);
  if (all) {
    // completion bonus
    const bonus = Math.round(500);
    score += bonus;
    updateStatus();
    setTimeout(() => showAlert(`Board complete! Bonus ${bonus} points awarded. Final score: ${score}`), 80);
    // persist final daily result
    if (currentMode === 'daily') saveDailyState(currentBoardId || getTodayDateStr());
  }
}

// new board / reroll
function newBoard() {
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
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) board.revealed[r][c] = true;
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

// no suggestions: keep input simple
dom.modalGuessBtn.addEventListener("click", submitGuessForModal);
dom.modalClose.addEventListener("click", closeModal);
dom.modalCancelBtn.addEventListener("click", closeModal);
dom.cellModal.addEventListener("click", (ev) => {
  if (ev.target === dom.cellModal) closeModal();
});
// Settings button wiring
if (dom.settingsBtn) dom.settingsBtn.addEventListener('click', openSettingsModal);
if (dom.settingsClose) dom.settingsClose.addEventListener('click', closeSettingsModal);
if (dom.settingsModal) dom.settingsModal.addEventListener('click', (ev) => { if (ev.target === dom.settingsModal) closeSettingsModal(); });
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

function setMode(mode) {
  if (mode !== 'daily' && mode !== 'infinite') return;
  currentMode = mode;
  if (dom.modeDaily && dom.modeInfinite) {
    dom.modeDaily.classList.toggle('active', mode === 'daily');
    dom.modeInfinite.classList.toggle('active', mode === 'infinite');
    dom.modeDaily.setAttribute('aria-selected', mode === 'daily' ? 'true' : 'false');
    dom.modeInfinite.setAttribute('aria-selected', mode === 'infinite' ? 'true' : 'false');
  }
  // disable reroll for daily
  if (dom.rerollBtn) dom.rerollBtn.disabled = mode === 'daily';
  if (mode === 'daily') {
    const today = getTodayDateStr();
    currentBoardId = today;
    startCountdown();
    generateDailyBoardForDate(today);
    // load saved progress if present
    const saved = loadDailyState(today);
    if (saved) {
      // already applied inside generate; re-render
      renderGrid();
      updateStatus();
    } else {
      // ensure status reflects fresh board
      guessesUsed = 0;
      score = 0;
      computeMaxScore();
      renderGrid();
      updateStatus();
      saveDailyState(today);
    }
  } else {
    // infinite
    stopCountdown();
    newBoard();
    renderGrid();
    updateStatus();
  }
}

if (dom.modeDaily) dom.modeDaily.addEventListener('click', () => setMode('daily'));
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
    // ignore
  }
  // initialize according to saved mode
  setMode(currentMode || 'infinite');
})();
