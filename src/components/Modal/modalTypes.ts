import type { Board } from 'common/game/board';
import type { Cell } from 'common/game/puzzle';

export type GuessModalState = { cell: Cell; value: string; board: Board };
export type MessageModalState = { title: string; message: string };
export type ConfirmModalState = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
};
