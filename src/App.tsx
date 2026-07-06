import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { Board, type DebugStats, type Cell, TIME_CONFIGS } from './lib/board';
import type { GameMode } from './lib/constants';
import { createSeedFromString, formatDateAsCountdown, parseSeedString } from './lib/utils';
import { scoreWord } from './lib/score';
import { loadDailyBoard, loadInfiniteBoard, saveDailyBoard, saveInfiniteBoard } from './lib/store';
import { WORDS } from './lib/data';

import { BoardGrid } from './components/BoardGrid/BoardGrid';
import { Sidebar } from './components/Sidebar/Sidebar';
import { ModalsContainer } from './components/Modal/ModalsContainer';
import './App.css';

type GuessModalState = { cell: Cell; value: string };
type MessageModalState = { title: string; message: string };
type ConfirmModalState = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
};

function getInitialMode(): GameMode {
  if (globalThis.window === undefined) return 'daily';
  const searchParams = new URL(globalThis.window.location.href).searchParams;
  return searchParams.get('mode') === 'infinite' || searchParams.has('seed') ? 'infinite' : 'daily';
}

function getInfiniteSeedFromUrl(): number | null {
  if (globalThis.window === undefined) return null;
  const seedString = new URL(globalThis.window.location.href).searchParams.get('seed');
  return seedString ? parseSeedString(seedString.toLowerCase()) : null;
}

function updateBoardUrl(mode: GameMode, seedString?: string): void {
  if (globalThis.window === undefined) return;
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
  const nextMidnight = new Date();
  nextMidnight.setHours(24, 0, 0, 0);
  return formatDateAsCountdown(nextMidnight);
}

function App() {
  const [board, setBoard] = useState<Board | null>(null);
  const [mode, setMode] = useState<GameMode>(getInitialMode);
  const [analysisMode, setAnalysisMode] = useState(false);
  const [guessModal, setGuessModal] = useState<GuessModalState | null>(null);
  const [messageModal, setMessageModal] = useState<MessageModalState | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);
  const [debugModal, setDebugModal] = useState(false);
  const [debugStats, setDebugStats] = useState<DebugStats | null>(null);
  const [infoModal, setInfoModal] = useState(false);
  const [dailyCountdown, setDailyCountdown] = useState(() => getTimeUntilNextDailyLevel());
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [seedHidden, setSeedHidden] = useState(false);

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (messageModal) closeMessageModal();
        if (guessModal) closeGuessModal();
        if (confirmModal) closeConfirmModal();
        if (debugModal) closeDebugModal();
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
    } else {
      const savedBoard = loadInfiniteBoard();
      const sharedSeed = getInfiniteSeedFromUrl();
      if (savedBoard) {
        setBoard(savedBoard);
        updateBoardUrl('infinite', savedBoard.seedString);
        return;
      }
      if (sharedSeed) {
        const sharedBoard = new Board(sharedSeed, 'infinite', TIME_CONFIGS.unlimited);
        setBoard(sharedBoard);
        updateBoardUrl('infinite', sharedBoard.seedString);
        return;
      }
    }

    const seed =
      gameMode === 'daily'
        ? createSeedFromString(new Date().toDateString())
        : createSeedFromString(`${Date.now()}-${Math.random()}`);
    const newBoard = new Board(seed, gameMode, TIME_CONFIGS.unlimited);
    setBoard(newBoard);
    updateBoardUrl(gameMode, gameMode === 'infinite' ? newBoard.seedString : undefined);
    if (gameMode === 'daily') saveDailyBoard(newBoard);
  };

  const rerollInfiniteBoard = () => {
    if (!board) return;
    if (board.guessedWords.length > 0) {
      openConfirmModal({
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
          closeConfirmModal();
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
    closeConfirmModal();
  };

  const copyShareLink = async () => {
    if (!board) return;
    const shareLink = buildShareLink(board.seedString);
    try {
      await navigator.clipboard.writeText(shareLink);
      openMessageModal(
        'Link copied',
        'The link for this infinite puzzle is now on your clipboard.'
      );
    } catch {
      openMessageModal('Copy failed', shareLink);
    }
  };

  const openGuessModal = (row: number, col: number) => {
    if (!board) return;
    if (board.boardGameMode === 'infinite' && !board.timeConfig.unlimited && !board.startedAt) {
      board.startedAt = new Date();
    }
    setMessageModal(null);
    setGuessModal({ cell: board.grid[row][col], value: '' });
  };

  const closeGuessModal = () => setGuessModal(null);

  const getHintForGuessModal = () => {
    if (!board || !guessModal?.cell.bestWord) return;
    const { cell } = guessModal;
    const hintIndex = Math.floor(Math.random() * 4);
    switch (hintIndex) {
      case 0:
        openMessageModal('Hint', `The first letter of the best word is '${cell.bestWord[0]}'`);
        break;
      case 1:
        openMessageModal(
          'Hint',
          `There are ${Board.getValidWordsForConditions(cell.rowCondition, cell.colCondition).length} possible words for this cell`
        );
        break;
      case 2:
        openMessageModal('Hint', `The best word has ${cell.bestWord.length} letters`);
        break;
      case 3: {
        const vowels = cell.bestWord.match(/[aeiou]/gi)?.length || 0;
        openMessageModal(
          'Hint',
          `The best word has ${vowels} vowels and ${cell.bestWord.length - vowels} consonants`
        );
        break;
      }
    }
  };

  const openMessageModal = (title: string, message: string) => setMessageModal({ title, message });
  const closeMessageModal = () => setMessageModal(null);
  const closeConfirmModal = () => setConfirmModal(null);
  const openConfirmModal = (modal: ConfirmModalState) => {
    setGuessModal(null);
    setMessageModal(null);
    setConfirmModal(modal);
  };

  const openResetConfirmModal = () => {
    openConfirmModal({
      title: 'Reset board?',
      message: 'This clears your current guesses and restores the puzzle to its initial state.',
      confirmLabel: 'Reset Board',
      onConfirm: resetCurrentBoard,
    });
  };

  const openDebugModal = () => {
    setDebugStats(Board.getBoardGenDebugStats());
    setDebugModal(true);
  };
  const closeDebugModal = () => setDebugModal(false);
  const openInfoModal = () => setInfoModal(true);
  const closeInfoModal = () => setInfoModal(false);

  const guessWord = (row: number, col: number, word: string) => {
    if (!board) return { success: false, message: 'No board is currently loaded' };
    const normalizedWord = word.trim().toLowerCase();
    if (!normalizedWord) return { success: false, message: 'Please enter a word' };

    board.guessedWords.push(normalizedWord);
    const cell = board.grid[row][col];

    if (normalizedWord === '!exact') {
      openMessageModal('Exact word', `The exact word for this cell is: "${cell.bestWord}"`);
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
        Board.getValidWordsForConditions(cell.rowCondition, cell.colCondition)
      );
      board.grid[row][col] = cell;
      board.usedWords.add(normalizedWord);
      board.totalScore += cell.score || 0;

      if (board.grid.flat().every(c => c.word)) {
        board.endedAt = new Date();
        openConfirmModal({
          title: 'Analysis Mode',
          message:
            'You have completed the puzzle! Would you like to enter analysis mode to see the best possible words for each cell?',
          confirmLabel: 'Enter Analysis Mode',
          onConfirm: () => {
            setAnalysisMode(true);
            closeConfirmModal();
          },
        });
      }
      persistBoard(Object.assign(Object.create(Object.getPrototypeOf(board)), board));
      return { success: true, message: `"${normalizedWord}" was placed.` };
    }
    return { success: false, message: "This doesn't meet the conditions for the cell" };
  };

  const handleGuessSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!guessModal) return;
    const result = guessWord(guessModal.cell.row, guessModal.cell.col, guessModal.value);
    if (result.success) closeGuessModal();
    else openMessageModal('Invalid Guess', result.message);
  };

  return (
    <>
      <div className="app">
        <main>
          <BoardGrid board={board} hiddenCells={analysisMode ? new Set(board?.grid.flat()) : new Set()} onCellClick={openGuessModal} />
          <Sidebar
            board={board}
            mode={mode}
            seedHidden={seedHidden}
            analysisMode={analysisMode}
            secondsRemaining={secondsRemaining}
            dailyCountdown={dailyCountdown}
            setMode={setMode}
            setSeedHidden={(value) => {
              setSeedHidden(value);

              if (value && board?.boardGameMode === 'infinite') {
                updateBoardUrl('infinite');
              } else if (!value && board?.boardGameMode === 'infinite') {
                updateBoardUrl('infinite', board.seedString);
              }
            }}
            enterNormalMode={() => setAnalysisMode(false)}
            enterAnalysisMode={() => setAnalysisMode(true)}
            copyShareLink={copyShareLink}
            rerollInfiniteBoard={rerollInfiniteBoard}
            openResetConfirmModal={openResetConfirmModal}
            openDebugModal={openDebugModal}
            openInfoModal={openInfoModal}
          />
        </main>
      </div>

      <ModalsContainer
        guessModal={guessModal}
        messageModal={messageModal}
        confirmModal={confirmModal}
        debugModal={debugModal}
        debugStats={debugStats}
        infoModal={infoModal}
        guessInputRef={guessInputRef}
        setGuessModal={setGuessModal}
        closeGuessModal={closeGuessModal}
        getHintForGuessModal={getHintForGuessModal}
        handleGuessSubmit={handleGuessSubmit}
        closeMessageModal={closeMessageModal}
        closeConfirmModal={closeConfirmModal}
        closeDebugModal={closeDebugModal}
        handleClearDebugStats={() => {
          Board.clearBoardGenDebugStats();
          setDebugStats(null);
        }}
        closeInfoModal={closeInfoModal}
      />
    </>
  );
}

export default App;
