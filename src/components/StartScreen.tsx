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
              climb, solve and choose correct answers to acheive the highest
              score and unlock the gates
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
