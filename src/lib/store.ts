import { Board } from 'common/game/board';

export function saveDailyBoard(board: Board): void {
  const saveString = board.getSaveString();
  localStorage.setItem('dailyBoard-' + board.getDateString(), saveString);
}

export function loadDailyBoard(): Board | null {
  const saveString = localStorage.getItem('dailyBoard-' + Board.getDateStringFromDate(new Date()));
  if (saveString) {
    return Board.loadFromSaveString(saveString);
  }
  return null;
}

export function saveInfiniteBoard(board: Board): void {
  const saveString = board.getSaveString();
  localStorage.setItem('infiniteBoard-' + board.seed, saveString);
  localStorage.setItem('infiniteBoardSeed', board.seed.toString());
}

export function loadInfiniteBoard(): Board | null {
  const seedString = localStorage.getItem('infiniteBoardSeed');
  if (!seedString) {
    return null;
  }

  const saveString = localStorage.getItem('infiniteBoard-' + seedString);
  if (saveString) {
    return Board.loadFromSaveString(saveString);
  }
  return null;
}
