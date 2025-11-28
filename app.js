const WORDS_URL = "words.txt";

// Word list
let WORDS = [];

// Attempt to load words from URL.
async function loadWordlist() {
  try {
    const resp = await fetch(WORDS_URL, { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    // Parse newline-seperated entries
    const txt = await resp.text();
    const arr = txt
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (arr.length > 0) {
      WORDS = arr;
      console.info(`Loaded ${WORDS.length} words from text at ${WORDS_URL}`);
      return;
    }
    throw new Error("No words found in fetched content");
  } catch (err) {
    await showAlert("Could not load wordlist. Sorry!");
  }
}

// ---------- Category definitions ----------
const CATEGORIES = [
  {
    id: "starts_vowel",
    label: "Starts with vowel",
    desc: "Begins with a vowel (a,e,i,o,u)",
    test: (w) => /^[aeiou]/i.test(w),
    examples: ["about", "apple"],
  },
  {
    id: "starts_consonant",
    label: "Starts with consonant",
    desc: "Begins with a consonant",
    test: (w) => /^[a-z]/i.test(w) && !/^[aeiou]/i.test(w),
    examples: ["back", "dog"],
  },
  {
    id: "length_4",
    label: "4 letters",
    desc: "Exactly 4 letters",
    test: (w) => w.length === 4,
    examples: ["have", "time"],
  },
  {
    id: "length_5",
    label: "5 letters",
    desc: "Exactly 5 letters",
    test: (w) => w.length === 5,
    examples: ["about", "think"],
  },
  {
    id: "contains_ing",
    label: "Contains 'ing'",
    desc: "Contains 'ing'",
    test: (w) => /ing/i.test(w),
    examples: ["going", "thinking"],
  },
  {
    id: "ends_ed",
    label: "Ends 'ed'",
    desc: "Ends with 'ed'",
    test: (w) => /ed$/i.test(w),
    examples: ["asked", "played"],
  },
  {
    id: "double_letter",
    label: "Double letter",
    desc: "Has a doubled letter",
    test: (w) => /(.)\1/.test(w),
    examples: ["still", "happy"],
  },
  {
    id: "contains_a",
    label: "Contains 'a'",
    desc: "Contains letter 'a'",
    test: (w) => /a/i.test(w),
    examples: ["area", "family"],
  },
  {
    id: "starts_with_re",
    label: "Starts 're'",
    desc: "Starts with 're'",
    test: (w) => /^re/i.test(w),
    examples: ["return", "remember"],
  },
  {
    id: "ends_with_y",
    label: "Ends with 'y'",
    desc: "Ends with 'y'",
    test: (w) => /y$/i.test(w),
    examples: ["happy", "family"],
  },
  {
    id: "many_vowels",
    label: "3+ vowels",
    desc: "Contains 3 or more vowels",
    test: (w) => (w.match(/[aeiou]/gi) || []).length >= 3,
    examples: ["education", "beautiful"],
  },
  {
    id: "contains_st",
    label: "Contains 'st'",
    desc: "Contains 'st'",
    test: (w) => /st/i.test(w),
    examples: ["best", "listen"],
  },
];

// ---------- Game state ----------
let board = {
  rows: [],
  cols: [],
  answers: [],
  revealed: [],
};

let guessesUsed = 0; // no max, increments on every guess attempt
let score = 0;
let maxScore = 0;
// Mode/state: 'infinite' or 'daily'
// Always start in daily mode (do not persist or read last-selected mode)
let currentMode = 'daily';
let currentBoardId = null; // for daily: YYYY-MM-DD, for infinite: hash
let countdownTimer = null;

// DOM refs
const dom = {
  grid: document.getElementById("grid"),
  boardHash: document.getElementById("boardHash"),
  guessesInfo: document.getElementById("guessesInfo"),
  scoreInfo: document.getElementById("scoreInfo"),
  rerollBtn: document.getElementById("rerollBtn"),
  modeDaily: document.getElementById("modeDaily"),
  modeInfinite: document.getElementById("modeInfinite"),
  countdown: document.getElementById("countdown"),
  countdownRow: document.getElementById("countdownRow"),
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

// ---------- Board builder ----------
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
    // board id for daily mode should be the UTC date
    dom.boardHash.textContent = currentBoardId || getTodayUTCDateStr();
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
  const assumedGuessesUsed = 0; // assume ideal minimal guesses to maximize multipliers
  const assumedMultiplier = 1 + Math.max(0, (10 - assumedGuessesUsed) / 10);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const rowTest = board.rows[r].test;
      const colTest = board.cols[c].test;
      const candidates = WORDS.filter((w) => rowTest(w) && colTest(w));
      const candidateCount = Math.max(1, candidates.length);
      const maxRarity = candidates.length
        ? Math.max(...candidates.map((w) => wordRarityScore(w)))
        : wordRarityScore(board.answers[r][c] || "");
      const base = Math.max(10, Math.round(maxRarity * assumedMultiplier));
      const candidateFactor = Math.max(1, 6 / candidateCount);
      total += Math.round(base * candidateFactor);
    }
  }
  maxScore = total;
}

// ---------- Daily mode helpers ----------
function getTodayUTCDateStr(d) {
  const now = d ? new Date(d) : new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0, 10);
}

function startCountdown() {
  stopCountdown();
  if (!dom.countdownRow) return;
  dom.countdownRow.style.display = 'flex';
  function update() {
    const now = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
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
      guessesUsed,
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

// Build the deterministic daily board for a given UTC date string (YYYY-MM-DD)
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
      guessesUsed = saved.guessesUsed || 0;
      score = saved.score || 0;
      maxScore = saved.maxScore || maxScore;
    } catch (e) {
      console.warn('Malformed saved daily state, ignoring.');
    }
  }
  return true;
}

// ---------- Rendering ----------
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
    ch.addEventListener("click", () =>
      showAlert(`${col.label}\n\nExamples: ${col.examples.join(", ")}`),
    );
    dom.grid.appendChild(ch);
  }

  // rows
  for (let r = 0; r < 3; r++) {
    // row header (square, not rotated)
    const rh = document.createElement("div");
    rh.className = "row-header";
    const row = board.rows[r];
    rh.innerHTML = `<strong>${row.label}</strong>`;
    rh.addEventListener("click", () =>
      showAlert(`${row.label}\n\nExamples: ${row.examples.join(", ")}`),
    );
    dom.grid.appendChild(rh);

    // cells
    for (let c = 0; c < 3; c++) {
      const cell = document.createElement("div");
      cell.className = "cell hidden";
      cell.dataset.r = r;
      cell.dataset.c = c;
      if (board.revealed[r][c]) {
        cell.classList.remove("hidden");
        cell.classList.add("revealed");
        // show only the guessed word; remove the small meta text under the word
        cell.innerHTML = `<div class="word">${board.answers[r][c]}</div>`;
      } else {
        cell.innerHTML = `<div class="word">?</div>`;
      }
      cell.addEventListener("click", () => openCellModal(r, c));
      dom.grid.appendChild(cell);
    }
  }
  updateSidebar();
  updateStatus();
}

// ---------- Modal logic ----------
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

// suggestions words for the cell and prefix
// suggestions removed: no suggestion UI or helper functions

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

  // the guessed text must exist in the WORDS list
  const matchedWord = WORDS.find((w) => normalize(w) === guessNorm);
  if (!matchedWord) {
    score = Math.max(0, score - 3);
    updateStatus();
    await showAlert("That word is not in the word list.");
    return;
  }
  const acceptedWord = matchedWord;

  // prevent duplicates across the board (except replacing current cell)
  const used = new Set(board.answers.flat().filter(Boolean).map((w) => normalize(w)));
  if (board.answers[r][c]) used.delete(normalize(board.answers[r][c]));
  if (used.has(guessNorm)) {
    // still counts as a guess but reject duplicate placement
    score = Math.max(0, score - 3);
    updateStatus();
    await showAlert(`That word is already used in another cell.`);
    return;
  }

  // Accept the guess regardless of whether it fits the cell tests (but it must be in WORDS)
  board.answers[r][c] = acceptedWord;
  board.revealed[r][c] = true;

  // scoring: rarity-based, then scaled by candidate scarcity
  const rarity = wordRarityScore(acceptedWord);
  const multiplier = 1 + Math.max(0, (10 - guessesUsed) / 10);
  // how many words actually fit the row/col conditions for this cell
  const rowTest = board.rows[r].test;
  const colTest = board.cols[c].test;
  const candidateCount = WORDS.filter((w) => rowTest(w) && colTest(w)).length || 1;
  const candidateFactor = Math.max(1, 6 / candidateCount);
  let points = Math.max(10, Math.round(rarity * multiplier));
  points = Math.round(points * candidateFactor);
  score += points;
  renderGrid();
  closeModal();
  updateStatus();
  // persist daily progress
  if (currentMode === 'daily') {
    saveDailyState(currentBoardId || getTodayUTCDateStr());
  }
  checkBoardComplete();
}

// ---------- Game flow helpers ----------
function updateStatus() {
  // show score and guesses in the sidebar
  dom.scoreInfo.textContent = `${score} / ${maxScore}`;
  dom.guessesInfo.textContent = `${guessesUsed} guesses`;
}

function updateSidebar() {
  // ensure sidebar values reflect current state
  dom.guessesInfo.textContent = `${guessesUsed} guesses`;
  dom.scoreInfo.textContent = `${score} / ${maxScore}`;
}

function checkBoardComplete() {
  const all = board.revealed.flat().every(Boolean);
  if (all) {
    // completion bonus: bigger if fewer guesses used
    const bonusMultiplier = 1 + Math.max(0, (12 - guessesUsed) / 12); // ranges ~2 -> 1
    const bonus = Math.round(500 * bonusMultiplier);
    score += bonus;
    updateStatus();
    setTimeout(() => showAlert(`Board complete! Bonus ${bonus} points awarded. Final score: ${score}`), 80);
    // persist final daily result
    if (currentMode === 'daily') saveDailyState(currentBoardId || getTodayUTCDateStr());
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

// ---------- Event wiring ----------
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
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
  if (e.key === "Enter" && !dom.cellModal.classList.contains("hidden"))
    submitGuessForModal();
});

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
    const today = getTodayUTCDateStr();
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

// ---------- Init ----------
(async function init() {
  await loadWordlist();
  // initialize according to saved mode
  setMode(currentMode || 'infinite');
})();
