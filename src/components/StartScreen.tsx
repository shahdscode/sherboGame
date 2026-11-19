import React, { useEffect, useState } from 'react';
import {
  Play,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Flag,
  Gamepad2,
  RotateCcw,
  Award,
} from 'lucide-react';
import { PERFORMANCE_GRADES } from '../game/scoring';

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
  loadFailed,
}) => {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    if (ready) return;
    const id = window.setTimeout(() => setIsSlow(true), SLOW_LOAD_MS);
    return () => window.clearTimeout(id);
  }, [ready]);

  const showReload = !ready && (loadFailed || isSlow);

  return (
    <div className="overlay-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card start-modal-card">
        <div className="start-hero-banner">
          <div className="start-hero-sticker-wrap">
            <img
              src="/stickers/main-sticker.png"
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
          <div className="info-box info-box-rules">
            <div className="info-box-header">
              <Flag size={18} className="icon-gold" />
              <h3>Tower Rules</h3>
            </div>
            <p>
              Climb, solve and choose the correct answers to achieve the
              highest score and unlock the gates. Every level adds new
              platforms — moving, crumbling, icy and springs. Grab coins
              for +10 XP!
            </p>
          </div>

          <div className="info-box info-box-controls">
            <div className="info-box-header">
              <Gamepad2 size={18} className="icon-cyan" />
              <h3>Controls</h3>
            </div>
            <div className="controls-compact-list">
              <div className="control-row">
                <span className="key-group">
                  <kbd aria-label="Left">
                    <ArrowLeft size={13} />
                  </kbd>
                  <kbd aria-label="Right">
                    <ArrowRight size={13} />
                  </kbd>
                </span>
                <span className="control-move-hint">move right and left</span>
              </div>
              <div className="control-row control-row-jump">
                <span className="key-group">
                  <kbd aria-label="Up">
                    <ArrowUp size={13} />
                  </kbd>
                </span>
                <span className="control-jump-hint">(double tap for double jump)</span>
              </div>
            </div>
          </div>

          <div className="info-box info-box-grades">
            <div className="info-box-header">
              <Award size={18} className="icon-purple" />
              <h3>Letter Grades & Ranks</h3>
            </div>
            <div className="grades-list">
              {PERFORMANCE_GRADES.map((g) => (
                <div
                  key={g.grade}
                  className={`grade-item grade-${g.grade.toLowerCase().replace('+', '-plus')}`}
                >
                  <div className="grade-badge-wrap">
                    <span className="grade-badge">{g.grade}</span>
                  </div>
                  <div className="grade-details">
                    <span className="grade-rank-title">{g.title}</span>
                    <span className="grade-score-req">
                      {g.minXp > 0 ? `${g.minXp.toLocaleString()}+ XP` : '< 1,700 XP'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

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
            data-testid="start-climbing-btn"
          >
            <Play size={20} fill="currentColor" />
            <span>Start Climbing!</span>
          </button>
        )}
      </div>
    </div>
  );
};
