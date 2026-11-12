import React from 'react';
import {
  Play,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Flag,
  Sparkles,
  Gamepad2,
  Zap,
} from 'lucide-react';
import { towerConfig } from '../data/towerConfig';

interface StartScreenProps {
  onStart: () => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({ onStart }) => {
  return (
    <div className="overlay-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card start-modal-card">
        <div className="start-hero-banner">
          <div className="start-hero-sticker-wrap">
            <img
              src="/stickers/climbing figure.png"
              alt="Sherbo Climber"
              className="start-hero-sticker"
            />
          </div>
          <div className="start-hero-text">
            <div className="badge-pill">
              <Sparkles size={14} />
              <span>SHERBO ARCADE TOWER</span>
            </div>
            <h1 className="game-title">Knowledge Tower</h1>
            <p className="game-subtitle">
              Leap across {towerConfig.totalSteps} stones, crack{' '}
              {towerConfig.numberOfCheckpoints} Rune Gates, and claim the Summit
              Crown!
            </p>
          </div>
        </div>

        <div className="start-feature-chips">
          <span className="feature-chip chip-cyan">
            <Flag size={14} /> {towerConfig.totalSteps} Tower Steps
          </span>
          <span className="feature-chip chip-gold">
            <Sparkles size={14} /> {towerConfig.numberOfCheckpoints} Rune Gates
          </span>
          <span className="feature-chip chip-emerald">
            <Zap size={14} /> +{towerConfig.rewards.firstTryBonusXp} XP 1st-Try
            Bonus
          </span>
        </div>

        <div className="info-grid">
          <div className="info-box">
            <div className="info-box-header">
              <Flag size={18} className="icon-gold" />
              <h3>Quest Rules</h3>
            </div>
            <p>
              Every <strong>{towerConfig.stepsPerCheckpoint} steps</strong>, a
              magic Rune Gate blocks the tower. Tap the right{' '}
              <strong>Power Stone</strong> to shatter the barrier and keep
              climbing!
            </p>
          </div>

          <div className="info-box">
            <div className="info-box-header">
              <Gamepad2 size={18} className="icon-cyan" />
              <h3>Controls</h3>
            </div>
            <div className="controls-list">
              <div className="control-row">
                <span className="key-group">
                  <kbd>
                    <ArrowLeft size={13} />
                  </kbd>
                  <kbd>A</kbd>
                  <kbd>
                    <ArrowRight size={13} />
                  </kbd>
                  <kbd>D</kbd>
                </span>
                <span>Run Left / Right</span>
              </div>
              <div className="control-row">
                <span className="key-group">
                  <kbd>Space</kbd>
                  <kbd>
                    <ArrowUp size={13} />
                  </kbd>
                  <kbd>W</kbd>
                </span>
                <span>Jump Up</span>
              </div>
              <div className="control-row">
                <span className="mobile-tag">Phone / Tablet</span>
                <span>On-screen arcade buttons</span>
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="primary-cta-btn start-climbing-btn"
          onClick={onStart}
          data-testid="start-climbing-btn"
        >
          <Play size={20} fill="currentColor" />
          <span>Start Climbing!</span>
        </button>
      </div>
    </div>
  );
};
