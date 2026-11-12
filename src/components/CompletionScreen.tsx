import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Trophy,
  Award,
  RotateCcw,
  CheckCircle,
  Target,
  Zap,
  Sparkles,
} from 'lucide-react';
import { towerConfig } from '../data/towerConfig';

interface CompletionScreenProps {
  completedCheckpointsCount: number;
  totalAttempts: number;
  firstTryCount: number;
  xpPoints: number;
  onPlayAgain: () => void;
}

export const CompletionScreen: React.FC<CompletionScreenProps> = ({
  completedCheckpointsCount,
  totalAttempts,
  firstTryCount,
  xpPoints,
  onPlayAgain,
}) => {
  useEffect(() => {
    try {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.58 },
      });
    } catch {
      // Ignore confetti errors in headless test environments
    }
  }, []);

  return (
    <div
      className="overlay-backdrop completion-backdrop"
      role="dialog"
      aria-modal="true"
      data-testid="completion-screen"
    >
      <div className="modal-card completion-modal-card">
        <div className="trophy-showcase">
          <div className="completion-hero-row">
            <img
              src="/stickers/goodjob.png"
              alt="Sherbo Victory"
              className="completion-sticker"
            />
            <div className="trophy-circle">
              <Trophy size={42} className="trophy-icon" />
            </div>
          </div>
          <div className="completion-badge-ribbon">
            <Award size={15} />
            <span>SUMMIT MASTER CROWN UNLOCKED</span>
          </div>
        </div>

        <h1 className="completion-title">Summit Conquered!</h1>
        <p className="completion-subtitle">
          Amazing climb! You scaled all {towerConfig.totalSteps} steps and
          shattered every Rune Gate in the Knowledge Tower!
        </p>

        <div className="stats-summary-grid">
          <div className="stat-box" data-testid="stat-steps-completed">
            <Sparkles size={20} className="icon-cyan" />
            <div className="stat-box-val">
              {towerConfig.totalSteps} / {towerConfig.totalSteps}
            </div>
            <div className="stat-box-label">Steps Climbed</div>
          </div>

          <div className="stat-box" data-testid="stat-checkpoints-passed">
            <CheckCircle size={20} className="icon-emerald" />
            <div className="stat-box-val">
              {completedCheckpointsCount} / {towerConfig.numberOfCheckpoints}
            </div>
            <div className="stat-box-label">Gates Unlocked</div>
          </div>

          <div className="stat-box" data-testid="stat-total-attempts">
            <Target size={20} className="icon-gold" />
            <div className="stat-box-val">{totalAttempts}</div>
            <div className="stat-box-label">Stone Tries</div>
          </div>

          <div className="stat-box" data-testid="stat-first-try">
            <Award size={20} className="icon-purple" />
            <div className="stat-box-val">
              {firstTryCount} / {towerConfig.numberOfCheckpoints}
            </div>
            <div className="stat-box-label">1st-Try Combos</div>
          </div>
        </div>

        <div className="xp-reward-banner" data-testid="stat-total-xp">
          <Zap size={24} className="icon-amber" />
          <div>
            <div className="xp-banner-title">Total Arcade Score</div>
            <div className="xp-banner-score">{xpPoints} XP</div>
          </div>
        </div>

        <button
          type="button"
          className="primary-cta-btn play-again-btn"
          onClick={onPlayAgain}
          data-testid="play-again-btn"
        >
          <RotateCcw size={19} />
          <span>Climb Again</span>
        </button>
      </div>
    </div>
  );
};
