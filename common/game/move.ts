export interface Move {
  playerUuid: string;
  row: number;
  col: number;
  word: string;
  score?: number;
  timestamp: Date;
}

export type MoveResult = 'UsedElsewhere' | 'InvalidWord' | 'ConditionNotMet' | 'Success' | 'SuccessEndGame';
