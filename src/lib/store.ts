import { Board } from '../../common/board';
import { createDateString } from '../../common/utils';

export function saveDailyBoard(board: Board): void {
  const saveString = board.getSaveString();
  localStorage.setItem('dailyBoard-' + createDateString(new Date()), saveString);
}

export function loadDailyBoard(): Board | null {
  const saveString = localStorage.getItem('dailyBoard-' + createDateString(new Date()));
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
