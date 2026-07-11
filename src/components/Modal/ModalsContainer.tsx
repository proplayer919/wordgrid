import React, { type RefObject, type SubmitEvent } from 'react';
import { IconBulb, IconGitCommit, IconCalendarDue, IconX } from '@tabler/icons-react';
import { scoreWord } from '../../../common/score';
import { WORDS } from '../../../common/data';
import { BUILD_TIMESTAMP, COMMIT, COMMIT_NUMBER_THIS_MONTH } from '../../version';
import './Modal.css';
import { Puzzle, type DebugStats, type Cell } from '../../../common/puzzle';

interface ModalsContainerProps {
  guessModal: { cell: Cell; value: string } | null;
  messageModal: { title: string; message: string } | null;
  confirmModal: {
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null;
  debugModal: boolean;
  debugStats: DebugStats | null;
  infoModal: boolean;
  guessInputRef: RefObject<HTMLInputElement | null>;
  setGuessModal: React.Dispatch<React.SetStateAction<{ cell: Cell; value: string } | null>>;
  closeGuessModal: () => void;
  getHintForGuessModal: () => void;
  handleGuessSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  closeMessageModal: () => void;
  closeConfirmModal: () => void;
  closeDebugModal: () => void;
  handleClearDebugStats: () => void;
  closeInfoModal: () => void;
}

export const ModalsContainer: React.FC<ModalsContainerProps> = ({
  guessModal,
  messageModal,
  confirmModal,
  debugModal,
  debugStats,
  infoModal,
  guessInputRef,
  setGuessModal,
  closeGuessModal,
  getHintForGuessModal,
  handleGuessSubmit,
  closeMessageModal,
  closeConfirmModal,
  closeDebugModal,
  handleClearDebugStats,
  closeInfoModal,
}) => {
  return (
    <>
      {/* Guess Modal */}
      {guessModal && (
        <div className="modal" onClick={closeGuessModal}>
          <div
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guessModalTitle"
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-actions">
              <button
                className="modal-action"
                aria-label="Get a hint"
                type="button"
                onClick={getHintForGuessModal}
              >
                <IconBulb width={20} />
              </button>
              <button
                className="modal-action"
                aria-label="Close guess modal"
                type="button"
                onClick={closeGuessModal}
              >
                <IconX width={20} />
              </button>
            </div>
            <div className="modal-header">
              <div id="guessModalTitle">Enter your guess</div>
            </div>
            <div className="modal-body">
              <p className="modal-copy">
                {guessModal.cell.rowCondition.label} & {guessModal.cell.colCondition.label}
              </p>
              <form onSubmit={handleGuessSubmit}>
                <label htmlFor="guessInput">Word</label>
                <input
                  ref={guessInputRef}
                  id="guessInput"
                  className={
                    guessModal.value &&
                    (!WORDS.includes(guessModal.value.toLowerCase().trim()) ||
                      !Puzzle.getValidWordsForCell(guessModal.cell).includes(
                        guessModal.value.toLowerCase().trim()
                      )) &&
                    !guessModal.value.startsWith('!')
                      ? 'invalid'
                      : ''
                  }
                  autoComplete="off"
                  value={guessModal.value}
                  onChange={e =>
                    setGuessModal(curr => (curr ? { ...curr, value: e.target.value } : curr))
                  }
                />
                {guessModal.value && WORDS.includes(guessModal.value.toLowerCase().trim()) && (
                  <span className="modal-sub">
                    Score:{' '}
                    {scoreWord(
                      guessModal.value,
                      Puzzle.getValidWordsForConditions(
                        guessModal.cell.rowCondition,
                        guessModal.cell.colCondition
                      )
                    )}{' '}
                    /{' '}
                    {scoreWord(
                      Puzzle.getBestWordForCell(guessModal.cell),
                      Puzzle.getValidWordsForConditions(
                        guessModal.cell.rowCondition,
                        guessModal.cell.colCondition
                      )
                    )}
                  </span>
                )}
                <div className="modal-controls">
                  <button
                    type="submit"
                    disabled={
                      !!guessModal.value ||
                      (!WORDS.includes(guessModal.value.toLowerCase().trim()) ||
                        !Puzzle.getValidWordsForCell(guessModal.cell).includes(
                          guessModal.value.toLowerCase().trim()
                        )) &&
                      !guessModal.value.startsWith('!')
                    }
                  >
                    Guess
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Message Modal */}
      {messageModal && (
        <div className="modal" onClick={closeMessageModal}>
          <div
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="messageModalTitle"
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-actions">
              <button
                className="modal-action"
                aria-label="Close message modal"
                type="button"
                onClick={closeMessageModal}
              >
                <IconX width={20} />
              </button>
            </div>
            <div className="modal-header">
              <div id="messageModalTitle">{messageModal.title}</div>
            </div>
            <div className="modal-body">
              <p className="modal-copy">{messageModal.message}</p>
              <div className="modal-controls">
                <button type="button" onClick={closeMessageModal}>
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal && (
        <div className="modal" onClick={closeConfirmModal}>
          <div
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmModalTitle"
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-actions">
              <button
                className="modal-action"
                aria-label="Close confirmation modal"
                type="button"
                onClick={closeConfirmModal}
              >
                <IconX width={20} />
              </button>
            </div>
            <div className="modal-header">
              <div id="confirmModalTitle">{confirmModal.title}</div>
            </div>
            <div className="modal-body">
              <p className="modal-copy">{confirmModal.message}</p>
              <div className="modal-controls">
                <button type="button" onClick={confirmModal.onConfirm}>
                  {confirmModal.confirmLabel}
                </button>
                <button type="button" className="secondary" onClick={closeConfirmModal}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Debug Modal */}
      {debugModal && (
        <div className="modal" onClick={closeDebugModal}>
          <div
            className="modal-content modal-content--debug"
            role="dialog"
            aria-modal="true"
            aria-labelledby="debugModalTitle"
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-actions">
              <button
                className="modal-action"
                aria-label="Close debug modal"
                type="button"
                onClick={closeDebugModal}
              >
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
                    {Object.entries(debugStats)
                      .filter(
                        ([k]) =>
                          k !== 'last' && typeof debugStats[k as keyof DebugStats] === 'number'
                      )
                      .map(([key, val]) => (
                        <div key={key}>
                          <dt>{key}</dt>
                          <dd>{key === 'count' ? val : (val as number).toFixed(2) + ' ms'}</dd>
                        </div>
                      ))}
                    <div>
                      <dt>last</dt>
                      <dd>{debugStats.last.toFixed(2)} ms</dd>
                    </div>
                  </dl>
                  <div className="modal-controls">
                    <button type="button" className="secondary" onClick={handleClearDebugStats}>
                      Clear
                    </button>
                  </div>
                </>
              ) : (
                <p className="modal-copy">No data yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Info Modal */}
      {infoModal && (
        <div className="modal" onClick={closeInfoModal}>
          <div
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="infoModalTitle"
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-actions">
              <button
                className="modal-action"
                aria-label="Close info modal"
                type="button"
                onClick={closeInfoModal}
              >
                <IconX width={20} />
              </button>
            </div>
            <div className="modal-header">
              <div id="infoModalTitle">WordGrid Info</div>
            </div>
            <div className="modal-body">
              <p className="modal-copy">
                <IconCalendarDue size={14} style={{ verticalAlign: 'middle' }} /> Version: {' '}
                <span className="mono">
                  {(() => {
                    if (BUILD_TIMESTAMP === '$TIMESTAMP') return 'dev-build';
                    const date = new Date(BUILD_TIMESTAMP);
                    return `${date.getUTCFullYear()}.${(date.getUTCMonth() + 1).toString().padStart(2, '0')}.${COMMIT_NUMBER_THIS_MONTH}`;
                  })()}
                </span><br></br>
                <IconGitCommit size={14} style={{ verticalAlign: 'middle' }} /> Commit: {' '}
                <span
                  className="mono clickable"
                  onClick={() => {
                    window.open(
                      COMMIT === '$COMMIT_HASH'
                        ? 'https://github.com/wordgrid-game/wordgrid'
                        : `https://github.com/wordgrid-game/wordgrid/commit/${COMMIT}`,
                      '_blank'
                    );
                  }}
                >
                  {COMMIT === '$COMMIT_HASH' ? 'dev-build' : COMMIT.substring(0, 7)}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
