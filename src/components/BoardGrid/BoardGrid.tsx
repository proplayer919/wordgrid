import React from 'react';
import logo from '../../assets/logo.png';
import { Board, type Cell } from '../../lib/board';
import { textSizeForWord } from '../../lib/utils';
import './BoardGrid.css';

interface BoardGridProps {
  board: Board | null;
  hiddenCells: Set<Cell>;
  onCellClick: (row: number, col: number) => void;
}

export const BoardGrid: React.FC<BoardGridProps> = ({ board, hiddenCells, onCellClick }) => {
  if (!board) return null;

  return (
    <div className="boardArea">
      <div className="grid-wrap">
        <div className="grid">
          <div className="logo-square">
            <img src={logo} alt="WordGrid Logo" />
          </div>

          {board.columns.map(col => (
            <div key={col.id} className="col-header">
              <strong>{col.label}</strong>
            </div>
          ))}

          {board.rows.map((row, rowIndex) => (
            <div key={row.id} className="row">
              <div className="row-header">
                <strong>{row.label}</strong>
              </div>

              {board.grid[rowIndex].map((cell: Cell) => {
                const isPerfectCell = Boolean(cell.word && cell.word === cell.bestWord);
                const currentWord = cell.word || '';
                const isCellHidden = hiddenCells.has(cell);

                return (
                  <div
                    key={`${cell.row}-${cell.col}`}
                    className={`cell ${currentWord && !isCellHidden ? 'revealed' : 'hidden'} ${isPerfectCell && !isCellHidden ? 'perfect' : ''} ${isCellHidden ? 'hidden-cell' : ''}`}
                    data-row={cell.row}
                    data-col={cell.col}
                    onClick={() => {
                      if (!currentWord && !isCellHidden) {
                        onCellClick(cell.row, cell.col);
                      }
                    }}
                  >
                    {isCellHidden ? (
                      <span className="word">-</span>
                    ) : (
                      <>
                        {currentWord ? (
                          <>
                            {isPerfectCell && <span className="perfect-label">Perfect</span>}
                            <span
                              className="word"
                              style={{ fontSize: textSizeForWord(currentWord) }}
                            >
                              {currentWord}
                            </span>
                            <span className="cell-score">+{cell.score}</span>
                          </>
                        ) : (
                          <span className="word">?</span>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
