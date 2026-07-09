import { useEffect, useState, type RefObject } from 'react';
import { Board, TIME_CONFIGS } from '../../common/board';
import { Puzzle, type Cell, type DebugStats } from '../../common/puzzle';
import type { GameMode } from '../../common/constants';
import { createSeedFromString, formatDateAsCountdown, parseSeedString } from '../../common/utils';
import { scoreWord } from '../../common/score';
import { loadDailyBoard, loadInfiniteBoard, saveDailyBoard, saveInfiniteBoard } from '../lib/store';
import { WORDS } from '../../common/data';

import { BoardGrid } from '../components/BoardGrid/BoardGrid';
import { Sidebar } from '../components/Sidebar/Sidebar';

type GuessModalState = { cell: Cell; value: string };
type MessageModalState = { title: string; message: string };
type ConfirmModalState = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
};

interface GameProps {
  mode: GameMode;
  setMode: (mode: GameMode) => void;
  guessModal: GuessModalState | null;
  setGuessModal: React.Dispatch<React.SetStateAction<GuessModalState | null>>;
  setMessageModal: React.Dispatch<React.SetStateAction<MessageModalState | null>>;
  setConfirmModal: React.Dispatch<React.SetStateAction<ConfirmModalState | null>>;
  setDebugModal: React.Dispatch<React.SetStateAction<boolean>>;
  setDebugStats: React.Dispatch<React.SetStateAction<DebugStats | null>>;
  setInfoModal: React.Dispatch<React.SetStateAction<boolean>>;
  gameSubmitRef: RefObject<(() => void) | null>;
  gameHintRef: RefObject<(() => void) | null>;
}

function getInfiniteSeedFromUrl(): number | null {
  if (globalThis.window === undefined) return null;
  const seedString = new URL(globalThis.window.location.href).searchParams.get('seed');
  return seedString ? parseSeedString(seedString.toLowerCase()) : null;
}

function buildShareLink(seedString: string): string {
  const url = new URL(globalThis.window.location.href);
  url.searchParams.set('mode', 'infinite');
  url.searchParams.set('seed', seedString);
  return url.toString();
}

function getTimeUntilNextDailyLevel(): string {
  const nextMidnight = new Date();
  nextMidnight.setHours(24, 0, 0, 0);
  return formatDateAsCountdown(nextMidnight);
}

export function Game({
  mode,
  setMode,
  guessModal,
  setGuessModal,
  setMessageModal,
  setConfirmModal,
  setDebugModal,
  setDebugStats,
  setInfoModal,
  gameSubmitRef,
  gameHintRef,
}: Readonly<GameProps>) {
  const [board, setBoard] = useState<Board | null>(null);
  const [analysisMode, setAnalysisMode] = useState(false);
  const [dailyCountdown, setDailyCountdown] = useState(() => getTimeUntilNextDailyLevel());
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [seedHidden, setSeedHidden] = useState(false);

  useEffect(() => {
    loadBoard(mode);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'daily') return;
    const updateCountdown = () => setDailyCountdown(getTimeUntilNextDailyLevel());
    updateCountdown();
    const intervalId = globalThis.setInterval(updateCountdown, 1000);
    return () => globalThis.clearInterval(intervalId);
  }, [mode]);

  useEffect(() => {
    if (mode === 'daily') return;
    setSecondsRemaining(board?.getSecondsRemaining() || 0);

    const timer = setInterval(() => {
      const remaining = board?.getSecondsRemaining() || 0;
      setSecondsRemaining(remaining);
      if (remaining <= 0 || board?.endedAt || analysisMode) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [board, mode, analysisMode]);

  // Bind execution handlers back up to parent wrapper UI triggers
  useEffect(() => {
    gameSubmitRef.current = () => {
      if (!guessModal) return;
      const result = guessWord(guessModal.cell.row, guessModal.cell.col, guessModal.value);
      if (result.success) setGuessModal(null);
      else setMessageModal({ title: 'Invalid Guess', message: result.message });
    };

    gameHintRef.current = () => {
      if (!board || !guessModal?.cell.bestWord) return;
      const { cell } = guessModal;
      const hintIndex = Math.floor(Math.random() * 4);
      switch (hintIndex) {
        case 0:
          setMessageModal({
            title: 'Hint',
            message: `The first letter of the best word is '${cell.bestWord[0]}'`,
          });
          break;
        case 1:
          setMessageModal({
            title: 'Hint',
            message: `There are ${Puzzle.getValidWordsForConditions(cell.rowCondition, cell.colCondition).length} possible words for this cell`,
          });
          break;
        case 2:
          setMessageModal({
            title: 'Hint',
            message: `The best word has ${cell.bestWord.length} letters`,
          });
          break;
        case 3: {
          const vowels = cell.bestWord.match(/[aeiou]/gi)?.length || 0;
          setMessageModal({
            title: 'Hint',
            message: `The best word has ${vowels} vowels and ${cell.bestWord.length - vowels} consonants`,
          });
          break;
        }
      }
    };

    return () => {
      gameSubmitRef.current = null;
      gameHintRef.current = null;
    };
  }, [guessModal, board]);

  const persistBoard = (nextBoard: Board, persistEmptyInfinite = false) => {
    setBoard(nextBoard);
    if (nextBoard.boardGameMode === 'daily') {
      saveDailyBoard(nextBoard);
      return;
    }
    if (nextBoard.guessedWords.length > 0 || persistEmptyInfinite) {
      saveInfiniteBoard(nextBoard);
    }
  };

  const loadBoard = (gameMode: GameMode) => {
    if (gameMode === 'daily') {
      const savedBoard = loadDailyBoard();
      if (savedBoard) {
        setBoard(savedBoard);
        return;
      }
    } else {
      const savedBoard = loadInfiniteBoard();
      const sharedSeed = getInfiniteSeedFromUrl();

      if (sharedSeed && savedBoard?.seed === sharedSeed) {
        setBoard(savedBoard);
        return;
      }
      if (sharedSeed) {
        const sharedBoard = new Board(sharedSeed, 'infinite', TIME_CONFIGS.unlimited);
        setBoard(sharedBoard);
        return;
      }
      if (savedBoard) {
        setBoard(savedBoard);
        return;
      }
    }

    const seed =
      gameMode === 'daily'
        ? createSeedFromString(new Date().toDateString())
        : createSeedFromString(`${Date.now()}-${Math.random()}`);
    const newBoard = new Board(seed, gameMode, TIME_CONFIGS.unlimited);
    setBoard(newBoard);
    if (gameMode === 'daily') saveDailyBoard(newBoard);
  };

  const rerollInfiniteBoard = () => {
    if (!board) return;
    if (board.guessedWords.length > 0) {
      setGuessModal(null);
      setMessageModal(null);
      setConfirmModal({
        title: 'Reroll puzzle?',
        message: 'This will clear your current guesses and generate a new infinite puzzle.',
        confirmLabel: 'Reroll',
        onConfirm: () => {
          const nextBoard = new Board(
            createSeedFromString(`${Date.now()}-${Math.random()}`),
            'infinite',
            TIME_CONFIGS.unlimited
          );
          persistBoard(nextBoard);
          setConfirmModal(null);
        },
      });
      return;
    }
    persistBoard(
      new Board(
        createSeedFromString(`${Date.now()}-${Math.random()}`),
        'infinite',
        TIME_CONFIGS.unlimited
      )
    );
  };

  const resetCurrentBoard = () => {
    if (!board) return;
    persistBoard(new Board(board.seed, board.boardGameMode, board.timeConfig), true);
    setConfirmModal(null);
  };

  const copyShareLink = async () => {
    if (!board) return;
    const shareLink = buildShareLink(board.seedString);
    try {
      await navigator.clipboard.writeText(shareLink);
      setMessageModal({
        title: 'Link copied',
        message: 'The link for this infinite puzzle is now on your clipboard.',
      });
    } catch {
      setMessageModal({ title: 'Copy failed', message: shareLink });
    }
  };

  const openGuessModal = (row: number, col: number) => {
    if (!board) return;
    if (board.boardGameMode === 'infinite' && !board.timeConfig.unlimited && !board.startedAt) {
      board.startedAt = new Date();
    }
    setMessageModal(null);
    setGuessModal({ cell: board.puzzle.grid[row][col], value: '' });
  };

  const openResetConfirmModal = () => {
    setGuessModal(null);
    setMessageModal(null);
    setConfirmModal({
      title: 'Reset board?',
      message: 'This clears your current guesses and restores the puzzle to its initial state.',
      confirmLabel: 'Reset Board',
      onConfirm: resetCurrentBoard,
    });
  };

  const guessWord = (row: number, col: number, word: string) => {
    if (!board) return { success: false, message: 'No board is currently loaded' };
    const normalizedWord = word.trim().toLowerCase();
    if (!normalizedWord) return { success: false, message: 'Please enter a word' };

    board.guessedWords.push(normalizedWord);
    const cell = board.puzzle.grid[row][col];

    if (normalizedWord === '!exact') {
      setMessageModal({
        title: 'Exact word',
        message: `The exact word for this cell is: "${cell.bestWord}"`,
      });
      return { success: true, message: 'Exact word revealed' };
    }
    if (board.usedWords.has(normalizedWord))
      return { success: false, message: 'This word has already been used somewhere else' };
    if (!WORDS.includes(normalizedWord))
      return { success: false, message: 'This is not a valid word' };

    if (cell.rowCondition.test(normalizedWord) && cell.colCondition.test(normalizedWord)) {
      cell.word = normalizedWord;
      cell.score = scoreWord(
        normalizedWord,
        Puzzle.getValidWordsForConditions(cell.rowCondition, cell.colCondition)
      );
      board.puzzle.grid[row][col] = cell;
      board.usedWords.add(normalizedWord);
      board.totalScore += cell.score || 0;

      if (board.puzzle.grid.flat().every(c => c.word)) {
        board.endedAt = new Date();
        setGuessModal(null);
        setMessageModal(null);
        setConfirmModal({
          title: 'Analysis Mode',
          message:
            'You have completed the puzzle! Would you like to enter analysis mode to see the best possible words for each cell?',
          confirmLabel: 'Enter Analysis Mode',
          onConfirm: () => {
            setAnalysisMode(true);
            setConfirmModal(null);
          },
        });
      }
      persistBoard(Object.assign(Object.create(Object.getPrototypeOf(board)), board));
      return { success: true, message: `"${normalizedWord}" was placed.` };
    }
    return { success: false, message: 'This doesn\'t meet the conditions for the cell' };
  };

  return (
    <main>
      <BoardGrid
        board={board}
        hiddenCells={analysisMode ? new Set(board?.puzzle.grid.flat()) : new Set()}
        onCellClick={openGuessModal}
      />
      <Sidebar
        board={board}
        mode={mode}
        seedHidden={seedHidden}
        analysisMode={analysisMode}
        secondsRemaining={secondsRemaining}
        dailyCountdown={dailyCountdown}
        puzzleFinished={!!board?.endedAt}
        setMode={setMode}
        setSeedHidden={setSeedHidden}
        enterNormalMode={() => setAnalysisMode(false)}
        enterAnalysisMode={() => setAnalysisMode(true)}
        copyShareLink={copyShareLink}
        rerollInfiniteBoard={rerollInfiniteBoard}
        openResetConfirmModal={openResetConfirmModal}
        openDebugModal={() => {
          setDebugStats(Puzzle.getBoardGenDebugStats());
          setDebugModal(true);
        }}
        openInfoModal={() => setInfoModal(true)}
      />
    </main>
  );
}
