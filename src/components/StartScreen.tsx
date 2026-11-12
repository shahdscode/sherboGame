import React, { useEffect, useState } from 'react';
import {
  Play,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Flag,
  Gamepad2,
  Loader2,
  RotateCcw,
} from 'lucide-react';

interface StartScreenProps {
  onStart: () => void;
  /** True once the game world has finished loading and can accept "start". */
  ready: boolean;
  /** Asset download progress, 0..1 */
  progress: number;
  /** An asset failed to download (bad connection) */
  loadFailed: boolean;
}

/** After this long without finishing, offer a reload instead of an endless spinner. */
const SLOW_LOAD_MS = 25000;

export const StartScreen: React.FC<StartScreenProps> = ({
  onStart,
  ready,
  progress,
  loadFailed,
}) => {
  const [isTouch] = useState<boolean>(
    () =>
      typeof window !== 'undefined' &&
      !!window.matchMedia &&
      window.matchMedia('(pointer: coarse)').matches
  );
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    if (ready) return;
    const id = window.setTimeout(() => setIsSlow(true), SLOW_LOAD_MS);
    return () => window.clearTimeout(id);
  }, [ready]);

  const percent = Math.max(0, Math.min(100, Math.round(progress * 100)));
  const showReload = !ready && (loadFailed || isSlow);

  return (
    <div className="overlay-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card start-modal-card">
        <div className="start-hero-banner">
          <div className="start-hero-sticker-wrap">
            <img
              src="/stickers/climbing-figure.webp"
              alt="Sherbo Climber"
              className="start-hero-sticker"
              width={512}
              height={512}
            />
          </div>
          <div className="start-hero-text">
            <h1 className="game-title">Sherbo's Tower</h1>
          </div>
        </div>

        <div className="info-grid">
          <div className="info-box">
            <div className="info-box-header">
              <Flag size={18} className="icon-gold" />
              <h3>Tower Rules</h3>
            </div>
            <p>
              Climb, solve and choose the correct answers to achieve the
              highest score and unlock the gates.
            </p>
          </div>

          <div className="info-box">
            <div className="info-box-header">
              <Gamepad2 size={18} className="icon-cyan" />
              <h3>Controls</h3>
            </div>
            {isTouch ? (
              <div className="controls-list">
                <div className="control-row">
                  <span className="key-group">
                    <kbd>
                      <ArrowLeft size={13} />
                    </kbd>
                    <kbd>
                      <ArrowRight size={13} />
                    </kbd>
                  </span>
                  <span>Hold Left / Right to run</span>
                </div>
                <div className="control-row">
                  <span className="key-group">
                    <kbd>
                      <ArrowUp size={13} />
                    </kbd>
                  </span>
                  <span>Tap Jump to climb</span>
                </div>
              </div>
            ) : (
              <div className="controls-list">
                <div className="control-row">
                  <span className="key-group">
                    <kbd>
                      <ArrowLeft size={13} />
                    </kbd>
                    <kbd>
                      <ArrowRight size={13} />
                    </kbd>
                  </span>
                  <span>Run Left / Right</span>
                </div>
                <div className="control-row">
                  <span className="key-group">
                    <kbd>Space</kbd>
                    <kbd>
                      <ArrowUp size={13} />
                    </kbd>
                  </span>
                  <span>Jump Up</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {!ready && (
          <div
            className="start-loading"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            data-testid="start-loading"
          >
            <div className="start-loading-track">
              <div
                className="start-loading-fill"
                style={{ width: `${Math.max(6, percent)}%` }}
              />
            </div>
            <span className="start-loading-label">
              {loadFailed
                ? 'Connection problem while loading the tower.'
                : isSlow
                  ? 'Still loading… your connection looks slow.'
                  : `Loading the tower… ${percent}%`}
            </span>
          </div>
        )}

        {showReload ? (
          <button
            type="button"
            className="primary-cta-btn start-climbing-btn"
            onClick={() => window.location.reload()}
            data-testid="start-reload-btn"
          >
            <RotateCcw size={20} />
            <span>Reload</span>
          </button>
        ) : (
          <button
            type="button"
            className="primary-cta-btn start-climbing-btn"
            onClick={onStart}
            disabled={!ready}
            data-testid="start-climbing-btn"
          >
            {ready ? (
              <Play size={20} fill="currentColor" />
            ) : (
              <Loader2 size={20} className="spin-icon" />
            )}
            <span>{ready ? 'Start Climbing!' : 'Loading…'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
