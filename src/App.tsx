import { useEffect, useRef, useState, type FormEvent } from 'react'
import logo from './assets/logo.png'
import './App.css'

import { IconBug, IconBulb, IconClock, IconHash, IconHistory, IconQuestionMark, IconRotate, IconShare, IconStarFilled, IconX } from '@tabler/icons-react'
import { Board, getBoardGenDebugStats, clearBoardGenDebugStats, getValidWordsForConditions, type DebugStats, type Cell, getBestWordForCell } from './lib/board';
import type { GameMode } from './lib/constants';
import { createSeedFromString, parseSeedString, textSizeForWord } from './lib/utils';
import { scoreWord } from './lib/score';
import { loadDailyBoard, loadInfiniteBoard, saveDailyBoard, saveInfiniteBoard } from './lib/store';
import { WORDS } from './lib/data';

type GuessModalState = {
  cell: Cell;
  value: string;
};

type MessageModalState = {
  title: string;
  message: string;
};

type ConfirmModalState = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
};

function getInitialMode(): GameMode {
  if (globalThis.window === undefined) {
    return 'daily';
  }

  const searchParams = new URL(globalThis.window.location.href).searchParams;
  return searchParams.get('mode') === 'infinite' || searchParams.has('seed') ? 'infinite' : 'daily';
}

function getInfiniteSeedFromUrl(): number | null {
  if (globalThis.window === undefined) {
    return null;
  }

  const seedString = new URL(globalThis.window.location.href).searchParams.get('seed');
  if (!seedString) {
    return null;
  }

  return parseSeedString(seedString.toLowerCase());
}

function updateBoardUrl(mode: GameMode, seedString?: string): void {
  if (globalThis.window === undefined) {
    return;
  }

  const url = new URL(globalThis.window.location.href);
  url.searchParams.set('mode', mode);

  if (mode === 'infinite' && seedString) {
    url.searchParams.set('seed', seedString);
  } else {
    url.searchParams.delete('seed');
  }

  globalThis.window.history.replaceState({}, '', url.toString());
}

function buildShareLink(seedString: string): string {
  const url = new URL(globalThis.window.location.href);
  url.searchParams.set('mode', 'infinite');
  url.searchParams.set('seed', seedString);
  return url.toString();
}

function getTimeUntilNextDailyLevel(): string {
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);

  const remainingMs = Math.max(0, nextMidnight.getTime() - now.getTime());
  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');

  return `${hours}:${minutes}:${seconds}`;
}

function App() {
  const [board, setBoard] = useState<Board | null>(null);
  const [mode, setMode] = useState<GameMode>(getInitialMode);
  const [guessModal, setGuessModal] = useState<GuessModalState | null>(null);
  const [messageModal, setMessageModal] = useState<MessageModalState | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);
  const [debugModal, setDebugModal] = useState(false);
  const [debugStats, setDebugStats] = useState<DebugStats | null>(null);
  const [dailyCountdown, setDailyCountdown] = useState(() => getTimeUntilNextDailyLevel());
  const guessInputRef = useRef<HTMLInputElement | null>(null);
  const wasGuessModalOpen = useRef(false);

  useEffect(() => {
    setGuessModal(null);
    setMessageModal(null);
    setConfirmModal(null);
    loadBoard(mode);
  }, [mode]);

  useEffect(() => {
    const isOpen = guessModal !== null;
    if (isOpen && !wasGuessModalOpen.current) {
      guessInputRef.current?.focus();
      guessInputRef.current?.select();
    }
    wasGuessModalOpen.current = isOpen;
  }, [guessModal]);

  useEffect(() => {
    if (mode !== 'daily') {
      return;
    }

    const updateCountdown = () => {
      setDailyCountdown(getTimeUntilNextDailyLevel());
    };

    updateCountdown();
    const intervalId = globalThis.setInterval(updateCountdown, 1000);
    return () => globalThis.clearInterval(intervalId);
  }, [mode]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (messageModal) {
          closeMessageModal();
        }

        if (guessModal) {
          closeGuessModal();
        }

        if (confirmModal) {
          closeConfirmModal();
        }

        if (debugModal) {
          closeDebugModal();
        }

        if (messageModal || guessModal || confirmModal || debugModal) {
          event.preventDefault();
        }
        return;
      }

      if (event.key === 'Enter' && messageModal) {
        closeMessageModal();
        event.preventDefault();
        return;
      }

      if (event.key === 'Enter' && confirmModal) {
        confirmModal.onConfirm();
        event.preventDefault();
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [confirmModal, guessModal, messageModal, debugModal]);

  const persistBoard = (nextBoard: Board, persistEmptyInfinite = false) => {
    setBoard(nextBoard);

    if (nextBoard.boardGameMode === 'daily') {
      saveDailyBoard(nextBoard);
      updateBoardUrl('daily');
      return;
    }

    if (nextBoard.guessedWords.length > 0 || persistEmptyInfinite) {
      saveInfiniteBoard(nextBoard);
      updateBoardUrl('infinite', nextBoard.seedString);
      return;
    }

    updateBoardUrl('infinite');
  };

  const loadBoard = (gameMode: GameMode) => {
    if (gameMode === 'daily') {
      const savedBoard = loadDailyBoard();
      if (savedBoard) {
        setBoard(savedBoard);
        updateBoardUrl('daily');
        return;
      }
    }

    if (gameMode === 'infinite') {
      const savedBoard = loadInfiniteBoard();
      const sharedSeed = getInfiniteSeedFromUrl();

      if (savedBoard) {
        setBoard(savedBoard);
        updateBoardUrl('infinite', savedBoard.seedString);
        return;
      }

      if (sharedSeed) {
        const sharedBoard = new Board(sharedSeed, 'infinite');
        setBoard(sharedBoard);
        updateBoardUrl('infinite', sharedBoard.seedString);
        return;
      }
    }

    const seed = gameMode === 'daily'
      ? createSeedFromString(new Date().toDateString())
      : createSeedFromString(`${Date.now()}-${Math.random()}`);
    const newBoard = new Board(seed, gameMode);
    setBoard(newBoard);

    if (gameMode === 'daily') {
      saveDailyBoard(newBoard);
      updateBoardUrl('daily');
      return;
    }

    updateBoardUrl('infinite');
  };

  const rerollInfiniteBoard = () => {
    if (!board) return;

    if (board.guessedWords.length > 0) {
      openConfirmModal({
        title: 'Reroll puzzle?',
        message: 'This will clear your current guesses and generate a new infinite puzzle.',
        confirmLabel: 'Reroll',
        onConfirm: () => {
          const nextBoard = new Board(createSeedFromString(`${Date.now()}-${Math.random()}`), 'infinite');
          persistBoard(nextBoard);
          closeConfirmModal();
        },
      });
      return;
    }

    const nextBoard = new Board(createSeedFromString(`${Date.now()}-${Math.random()}`), 'infinite');
    persistBoard(nextBoard);
  };

  const resetCurrentBoard = () => {
    if (!board) return;

    const resetBoard = new Board(board.seed, board.boardGameMode);
    persistBoard(resetBoard, true);
    closeConfirmModal();
  };

  const copyShareLink = async () => {
    if (!board) return;

    const shareLink = buildShareLink(board.seedString);

    try {
      await navigator.clipboard.writeText(shareLink);
      openMessageModal('Link copied', 'The link for this infinite puzzle is now on your clipboard.');
    } catch {
      openMessageModal('Copy failed', shareLink);
    }
  };

  const openGuessModal = (row: number, col: number) => {
    if (!board) return;

    setMessageModal(null);
    setGuessModal({ cell: board.grid[row][col], value: '' });
  };

  const closeGuessModal = () => {
    setGuessModal(null);
  };

  const getHintForGuessModal = () => {
    if (!board || !guessModal) return;

    const { cell } = guessModal;

    if (cell.bestWord) {
      const hintIndex = Math.floor(Math.random() * 4);
      switch (hintIndex) {
        case 0:
          openMessageModal('Hint', `The first letter of the word is: "${cell.bestWord[0]}"`);
          break;
        case 1:
          openMessageModal('Hint', `There are ${getValidWordsForConditions(cell.rowCondition, cell.colCondition).length} possible words for this cell.`);
          break;
        case 2:
          openMessageModal('Hint', `The word has ${cell.bestWord.length} letters.`);
          break;
        case 3:
          openMessageModal('Hint', `The word has ${cell.bestWord.match(/[aeiou]/gi)?.length || 0} vowels and ${cell.bestWord.length - (cell.bestWord.match(/[aeiou]/gi)?.length || 0)} consonants.`);
      }
    }
  };

  const openMessageModal = (title: string, message: string) => {
    setMessageModal({ title, message });
  };

  const closeMessageModal = () => {
    setMessageModal(null);
  };

  const openResetConfirmModal = () => {
    setGuessModal(null);
    setMessageModal(null);
    openConfirmModal({
      title: 'Reset board?',
      message: 'This clears your current guesses and restores the puzzle to its initial state.',
      confirmLabel: 'Reset Board',
      onConfirm: () => {
        resetCurrentBoard();
      },
    });
  };

  const openConfirmModal = (modal: ConfirmModalState) => {
    setGuessModal(null);
    setMessageModal(null);
    setConfirmModal(modal);
  };

  const closeConfirmModal = () => {
    setConfirmModal(null);
  };

  const openDebugModal = () => {
    setDebugStats(getBoardGenDebugStats());
    setDebugModal(true);
  };

  const closeDebugModal = () => {
    setDebugModal(false);
  };

  const handleClearDebugStats = () => {
    clearBoardGenDebugStats();
    setDebugStats(null);
  };

  const guessWord = (row: number, col: number, word: string) => {
    if (!board) {
      return { success: false, message: 'No board is currently loaded' };
    }

    const normalizedWord = word.trim().toLowerCase();
    if (!normalizedWord) {
      return { success: false, message: 'Please enter a word' };
    }

    board.guessedWords.push(normalizedWord);

    const cell = board.grid[row][col];

    if (normalizedWord === "!exact") {
      openMessageModal('Exact word', `The exact word for this cell is: "${cell.bestWord}"`);
      return { success: true, message: 'Exact word revealed' };
    }

    if (board.usedWords.has(normalizedWord)) {
      return { success: false, message: 'This word has already been used somewhere else' };
    }

    if (!WORDS.includes(normalizedWord)) {
      return { success: false, message: 'This is not a valid word' };
    }

    if (cell.rowCondition.test(normalizedWord) && cell.colCondition.test(normalizedWord)) {
      cell.word = normalizedWord;
      cell.score = scoreWord(normalizedWord, getValidWordsForConditions(cell.rowCondition, cell.colCondition));
      board.grid[row][col] = cell;
      board.usedWords.add(normalizedWord);
      board.totalScore += cell.score || 0;

      persistBoard(Object.assign(Object.create(Object.getPrototypeOf(board)), board));

      return {
        success: true,
        message: `"${normalizedWord}" was placed at row ${row + 1}, column ${col + 1}.`,
      };
    } else {
      return {
        success: false,
        message: "This doesn't meet the conditions for the cell",
      };
    }
  };

  const handleGuessSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!guessModal) return;

    const result = guessWord(guessModal.cell.row, guessModal.cell.col, guessModal.value);

    if (result.success) {
      closeGuessModal();
    } else {
      openMessageModal('Invalid Guess', result.message);
    }
  };

  return (
    <>
      <div className="app">
        <main>
          <div className="boardArea">
            <div className="grid-wrap">
              <div className="grid">
                {board && (
                  <>
                    <div className="logo-square">
                      <img width="80%" height="auto" src={logo} alt="WordGrid Logo"></img>
                    </div>
                    {board.columns.map((col) => (
                      <div key={col.id} className="col-header">
                        <strong>{col.label}</strong>
                      </div>
                    ))}
                    {board.rows.map((row, rowIndex) => (
                      <div key={row.id} className="row">
                        <div className="row-header">
                          <strong>{row.label}</strong>
                        </div>
                        {board.grid[rowIndex].map((cell) => {
                          const isPerfectCell = Boolean(cell.word && cell.word === cell.bestWord);
                          let cellContent = <span className="word">?</span>;

                          cell.word = cell.word || "";

                          if (cell.word) {
                            cellContent = isPerfectCell ? (
                              <>
                                <span className="perfect-label">Perfect</span>
                                <span className="word" style={{ fontSize: textSizeForWord(cell.word) }}>
                                  {cell.word}
                                </span>
                                <span className="cell-score">+{cell.score}</span>
                                <span className="perfect-firework-layer" aria-hidden="true" />
                              </>
                            ) : (
                              <>
                                <span className="word" style={{ fontSize: textSizeForWord(cell.word) }}>
                                  {cell.word}
                                </span>
                                <span className="cell-score">+{cell.score}</span>
                              </>
                            );
                          }

                          return (
                            <div
                              key={`${cell.row}-${cell.col}`}
                              className={`cell ${cell.word ? 'revealed' : 'hidden'} ${isPerfectCell ? 'perfect' : ''}`}
                              data-row={cell.row}
                              data-col={cell.col}
                              onClick={() => {
                                if (!cell.word) {
                                  openGuessModal(cell.row, cell.col);
                                }
                              }}
                            >
                              {cellContent}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>

          <aside className="sidebar">
            <div className="board-info">
              <div className="info-row">
                <span className="icon" aria-hidden="true">
                  <IconHash width={20} />
                </span>
                <span className="value">{board ? board.seedString : '------'}</span>
              </div>

              <div className="info-row mode-row">
                <div className="mode-toggle" role="tablist" aria-label="Game mode">
                  <button className={`mode-btn ${mode === 'daily' ? 'active' : ''}`} role="tab" aria-selected="true" onClick={() => setMode('daily')}>
                    Daily
                  </button>
                  <button className={`mode-btn ${mode === 'infinite' ? 'active' : ''}`} role="tab" aria-selected="false" onClick={() => setMode('infinite')}>
                    Infinite
                  </button>
                </div>
              </div>

              {mode === 'daily' && (
                <div className="info-row">
                  <span className="icon" aria-hidden="true">
                    <IconClock width={20} />
                  </span>
                  <span className="value">{dailyCountdown}</span>
                </div>
              )}

              <div className="info-row">
                <span className="icon" aria-hidden="true">
                  <IconQuestionMark width={20} />
                </span>
                <span className="value">{(() => {
                  const guesses = board ? board.guessedWords.length : 0;
                  const guessText = guesses === 1 ? 'guess' : 'guesses';
                  return `${guesses} ${guessText}`;
                })()}</span>
              </div>

              <div className="info-row">
                <span className="icon" aria-hidden="true">
                  <IconStarFilled width={20} />
                </span>
                <span className="value">{board ? board.totalScore : 0} / {board ? board.maxScore : 0} ({board ? Math.round((board.totalScore / board.maxScore) * 100) : 0}%)</span>
              </div>

              {mode === 'infinite' && (
                <button className="reroll" title="Reroll board" onClick={rerollInfiniteBoard}>
                  <IconRotate width={15} />
                  Reroll
                </button>
              )}

              <div className="dock">
                {mode === 'infinite' && (
                  <button type="button" className="dock-action" title="Share infinite puzzle" aria-label="Share infinite puzzle" onClick={() => { void copyShareLink(); }}>
                    <IconShare width={15} />
                    <span className="sr-only">Share</span>
                  </button>
                )}
                <button type="button" className="dock-action" title="Reset board" aria-label="Reset board" onClick={openResetConfirmModal}>
                  <IconHistory width={15} />
                  <span className="sr-only">Reset Board</span>
                </button>
                <button type="button" className="dock-action" title="Debug stats" aria-label="Debug stats" onClick={openDebugModal}>
                  <IconBug width={15} />
                  <span className="sr-only">Debug Stats</span>
                </button>
              </div>
            </div>
          </aside>
        </main>
      </div>

      {guessModal && (
        <div className="modal" aria-hidden="false" onClick={closeGuessModal}>
          <div className="modal-content" aria-modal="true" role="dialog" aria-labelledby="guessModalTitle" onClick={(event) => event.stopPropagation()}>
            <div className="modal-actions">
              <button className="modal-action" aria-label="Get a hint" type="button" onClick={getHintForGuessModal}>
                <IconBulb width={20} />
              </button>
              <button className="modal-action" aria-label="Close guess modal" type="button" onClick={closeGuessModal}>
                <IconX width={20} />
              </button>
            </div>
            <div className="modal-header">
              <div id="guessModalTitle">Enter your guess</div>
            </div>
            <div className="modal-body">
              <p className="modal-copy">{guessModal.cell.rowCondition.label} & {guessModal.cell.colCondition.label}</p>
              <form onSubmit={handleGuessSubmit}>
                <label htmlFor="guessInput">Word</label>
                <input
                  ref={guessInputRef}
                  id="guessInput"
                  autoComplete="off"
                  value={guessModal.value}
                  onChange={(event) => {
                    setGuessModal((current) => current ? { ...current, value: event.target.value } : current);
                  }}
                />
                {guessModal.value && WORDS.includes(guessModal.value.toLowerCase()) && (
                  <span className="modal-sub">Score: {scoreWord(guessModal.value, getValidWordsForConditions(guessModal.cell.rowCondition, guessModal.cell.colCondition))} / {scoreWord(getBestWordForCell(guessModal.cell), getValidWordsForConditions(guessModal.cell.rowCondition, guessModal.cell.colCondition))}</span>
                )}
                <div className="modal-controls">
                  <button type="submit">Guess</button>
                  <button type="button" className="secondary" onClick={closeGuessModal}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {messageModal && (
        <div className="modal" aria-hidden="false" onClick={closeMessageModal}>
          <div className="modal-content" aria-modal="true" role="dialog" aria-labelledby="messageModalTitle" onClick={(event) => event.stopPropagation()}>
            <div className="modal-actions">
              <button className="modal-action" aria-label="Close message modal" type="button" onClick={closeMessageModal}>
                <IconX width={20} />
              </button>
            </div>
            <div className="modal-header">
              <div id="messageModalTitle">{messageModal.title}</div>
            </div>
            <div className="modal-body">
              <p className="modal-copy">{messageModal.message}</p>
              <div className="modal-controls">
                <button type="button" onClick={closeMessageModal}>OK</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmModal && (
        <div className="modal" aria-hidden="false" onClick={closeConfirmModal}>
          <div className="modal-content" aria-modal="true" role="dialog" aria-labelledby="confirmModalTitle" onClick={(event) => event.stopPropagation()}>
            <div className="modal-actions">
              <button className="modal-action" aria-label="Close confirmation modal" type="button" onClick={closeConfirmModal}>
                <IconX width={20} />
              </button>
            </div>
            <div className="modal-header">
              <div id="confirmModalTitle">{confirmModal.title}</div>
            </div>
            <div className="modal-body">
              <p className="modal-copy">{confirmModal.message}</p>
              <div className="modal-controls">
                <button type="button" onClick={() => { confirmModal.onConfirm(); }}>{confirmModal.confirmLabel}</button>
                <button type="button" className="secondary" onClick={closeConfirmModal}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {debugModal && (
        <div className="modal" aria-hidden="false" onClick={closeDebugModal}>
          <div className="modal-content modal-content--debug" aria-modal="true" role="dialog" aria-labelledby="debugModalTitle" onClick={(event) => event.stopPropagation()}>
            <div className="modal-actions">
              <button className="modal-action" aria-label="Close debug modal" type="button" onClick={closeDebugModal}>
                <IconX width={20} />
              </button>
            </div>
            <div className="modal-header">
              <div id="debugModalTitle">Debug Stats</div>
            </div>
            <div className="modal-body">
              {debugStats ? (
                <>
                  <dl className="debug-list">
                    <div><dt>last</dt><dd>{debugStats.last.toFixed(2)} ms</dd></div>
                    <div><dt>min</dt><dd>{debugStats.min.toFixed(2)} ms</dd></div>
                    <div><dt>max</dt><dd>{debugStats.max.toFixed(2)} ms</dd></div>
                    <div><dt>avg</dt><dd>{debugStats.mean.toFixed(2)} ms</dd></div>
                    <div><dt>median</dt><dd>{debugStats.median.toFixed(2)} ms</dd></div>
                    <div><dt>p95</dt><dd>{debugStats.p95.toFixed(2)} ms</dd></div>
                    <div><dt>p99</dt><dd>{debugStats.p99.toFixed(2)} ms</dd></div>
                    <div><dt>n</dt><dd>{debugStats.count}</dd></div>
                  </dl>
                  <div className="modal-controls">
                    <button type="button" className="secondary" onClick={handleClearDebugStats}>Clear</button>
                  </div>
                </>
              ) : (
                <p className="modal-copy">No data yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default App
