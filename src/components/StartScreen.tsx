import React from 'react';
import {
  Play,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Flag,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { towerConfig } from '../data/towerConfig';

interface StartScreenProps {
  onStart: () => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({ onStart }) => {
  return (
    <div className="overlay-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card start-modal-card">
        <div className="badge-pill">
          <Sparkles size={15} />
          <span>INTERACTIVE EDUCATIONAL ARCADE</span>
        </div>

        <h1 className="game-title">Knowledge Tower</h1>
        <p className="game-subtitle">
          Climb the tower. Solve challenges. Reach the summit.
        </p>

        <div className="info-grid">
          <div className="info-box">
            <div className="info-box-header">
              <Flag size={18} className="icon-gold" />
              <h3>How the Tower Works</h3>
            </div>
            <p>
              Ascend <strong>{towerConfig.totalSteps} steps</strong> to the
              summit! Every{' '}
              <strong>{towerConfig.stepsPerCheckpoint} steps</strong>, you will
              reach a mandatory checkpoint gate where you must answer a
              challenge question to unlock the next section.
            </p>
          </div>

          <div className="info-box">
            <div className="info-box-header">
              <ShieldCheck size={18} className="icon-cyan" />
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
                <span>Move Left / Right</span>
              </div>
              <div className="control-row">
                <span className="key-group">
                  <kbd>Space</kbd>
                  <kbd>
                    <ArrowUp size={13} />
                  </kbd>
                  <kbd>W</kbd>
                </span>
                <span>Jump to Next Platform</span>
              </div>
              <div className="control-row">
                <span className="mobile-tag">Mobile / Tablet</span>
                <span>Use on-screen hold &amp; jump buttons</span>
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
          <span>Start Climbing</span>
        </button>
      </div>
    </div>
  );
};
