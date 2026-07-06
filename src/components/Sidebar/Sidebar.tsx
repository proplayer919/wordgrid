import React from 'react';
import {
  IconArrowLeft,
  IconBrain,
  IconBug,
  IconClock,
  IconHash,
  IconHistory,
  IconInfoCircle,
  IconQuestionMark,
  IconRotate,
  IconShare,
  IconStarFilled,
} from '@tabler/icons-react';
import { Board } from '../../lib/board';
import { formatSecondsAsCountdown } from '../../lib/utils';
import type { GameMode } from '../../lib/constants';
import './Sidebar.css';

interface SidebarProps {
  board: Board | null;
  mode: GameMode;
  analysisMode: boolean;
  secondsRemaining: number;
  dailyCountdown: string;
  setMode: (mode: GameMode) => void;
  enterNormalMode: () => void;
  enterAnalysisMode: () => void;
  copyShareLink: () => Promise<void>;
  rerollInfiniteBoard: () => void;
  openResetConfirmModal: () => void;
  openDebugModal: () => void;
  openInfoModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  board,
  mode,
  analysisMode,
  secondsRemaining,
  dailyCountdown,
  setMode,
  enterNormalMode,
  enterAnalysisMode,
  copyShareLink,
  rerollInfiniteBoard,
  openResetConfirmModal,
  openDebugModal,
  openInfoModal,
}) => {
  const guessCount = board ? board.guessedWords.length : 0;
  const guessText = guessCount === 1 ? 'guess' : 'guesses';
  const totalScore = board ? board.totalScore : 0;
  const maxScore = board ? board.maxScore : 0;
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  const isUnlimited = board?.timeConfig.unlimited;

  return (
    <aside className="sidebar">
      <div className="board-info">
        {analysisMode ? (
          <>
            <div className="analysis-back" onClick={enterNormalMode}>
              <span className="info-icon" aria-hidden="true">
                <IconArrowLeft width={20} />
              </span>
              <span className="info-value">Leave analysis</span>
            </div>

            <div className="info-row">
              <span className="info-icon" aria-hidden="true">
                <IconBrain width={20} />
              </span>
              <span className="info-value">Analysis Mode</span>
            </div>

            {mode !== 'daily' && !isUnlimited && (
              <div className="info-row">
                <span className="info-icon" aria-hidden="true">
                  <IconClock width={20} />
                </span>
                <span className="info-value">{formatSecondsAsCountdown(secondsRemaining)}</span>
              </div>
            )}

            <div className="info-row">
              <span className="info-icon" aria-hidden="true">
                <IconQuestionMark width={20} />
              </span>
              <span className="info-value">{`${guessCount} ${guessText}`}</span>
            </div>

            <div className="info-row">
              <span className="info-icon" aria-hidden="true">
                <IconStarFilled width={20} />
              </span>
              <span className="info-value">{`${totalScore} / ${maxScore} (${percentage}%)`}</span>
            </div>
          </>
        ) : (
          <>
            <div className="info-row">
              <span className="info-icon" aria-hidden="true">
                <IconHash width={20} />
              </span>
              <span className="info-value">{board ? board.seedString : '------'}</span>
            </div>

            <div className="info-row mode-row">
              <div className="mode-toggle" role="tablist" aria-label="Game mode">
                <button
                  className={`mode-btn ${mode === 'daily' ? 'active' : ''}`}
                  role="tab"
                  aria-selected={mode === 'daily'}
                  onClick={() => setMode('daily')}
                >
                  Daily
                </button>
                <button
                  className={`mode-btn ${mode === 'infinite' ? 'active' : ''}`}
                  role="tab"
                  aria-selected={mode === 'infinite'}
                  onClick={() => setMode('infinite')}
                >
                  Infinite
                </button>
              </div>
            </div>

            {(mode === 'daily' || !isUnlimited) && (
              <div className="info-row">
                <span className="info-icon" aria-hidden="true">
                  <IconClock width={20} />
                </span>
                <span className="info-value">
                  {mode === 'daily' ? dailyCountdown : formatSecondsAsCountdown(secondsRemaining)}
                </span>
              </div>
            )}

            <div className="info-row">
              <span className="info-icon" aria-hidden="true">
                <IconQuestionMark width={20} />
              </span>
              <span className="info-value">{`${guessCount} ${guessText}`}</span>
            </div>

            <div className="info-row">
              <span className="info-icon" aria-hidden="true">
                <IconStarFilled width={20} />
              </span>
              <span className="info-value">{`${totalScore} / ${maxScore} (${percentage}%)`}</span>
            </div>

            <div className="dock">
              {mode === 'infinite' && (
                <>
                  <button
                    type="button"
                    className="dock-action"
                    title="Share infinite puzzle"
                    aria-label="Share infinite puzzle"
                    onClick={() => {
                      void copyShareLink();
                    }}
                  >
                    <IconShare width={15} />
                    <span className="sr-only">Share</span>
                  </button>
                  <button
                    type="button"
                    className="dock-action"
                    title="Reroll puzzle"
                    aria-label="Reroll puzzle"
                    onClick={rerollInfiniteBoard}
                  >
                    <IconRotate width={15} />
                    <span className="sr-only">Reroll</span>
                  </button>
                </>
              )}
              <button
                type="button"
                className="dock-action"
                title="Reset board"
                aria-label="Reset board"
                onClick={openResetConfirmModal}
              >
                <IconHistory width={15} />
                <span className="sr-only">Reset Board</span>
              </button>
              <button
                type="button"
                className="dock-action"
                title="Analysis mode"
                aria-label="Analysis mode"
                onClick={enterAnalysisMode}
              >
                <IconBrain width={15} />
                <span className="sr-only">Analysis Mode</span>
              </button>
              <button
                type="button"
                className="dock-action"
                title="Debug stats"
                aria-label="Debug stats"
                onClick={openDebugModal}
              >
                <IconBug width={15} />
                <span className="sr-only">Debug Stats</span>
              </button>
              <button
                type="button"
                className="dock-action"
                title="Info"
                aria-label="Info"
                onClick={openInfoModal}
              >
                <IconInfoCircle width={15} />
                <span className="sr-only">Info</span>
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
