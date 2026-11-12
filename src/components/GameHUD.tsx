import React, { useEffect, useState } from 'react';
import { Flag, Footprints, Zap, Compass, Volume2, VolumeX } from 'lucide-react';
import { CheckpointStateItem } from '../hooks/useTowerGame';
import { towerConfig } from '../data/towerConfig';
import { sfx } from '../game/sfx';

interface GameHUDProps {
  currentStep: number;
  completedCheckpointsCount: number;
  activeCheckpointNumber: number | null;
  checkpoints: CheckpointStateItem[];
  xpPoints: number;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  currentStep,
  completedCheckpointsCount,
  activeCheckpointNumber,
  checkpoints,
  xpPoints,
}) => {
  const [muted, setMutedState] = useState<boolean>(() => sfx.isMuted());

  useEffect(() => {
    return sfx.onMuteChange((m) => setMutedState(m));
  }, []);

  const toggleSound = () => {
    const next = !muted;
    sfx.setMuted(next);
    if (!next) {
      sfx.unlock();
      sfx.click();
    }
  };

  const nextActiveCheckpoint = checkpoints.find((c) => c.status === 'active');

  const currentTargetLabel =
    activeCheckpointNumber !== null
      ? `CP ${activeCheckpointNumber}`
      : nextActiveCheckpoint
        ? `CP ${nextActiveCheckpoint.checkpointNumber}`
        : 'Finish Line';

  return (
    <header
      className="floating-top-hud"
      aria-label="Tower Progress HUD"
      data-testid="floating-top-hud"
    >
      <div className="hud-stat-pill" data-testid="hud-step-counter">
        <Footprints size={16} className="icon-cyan" />
        <div>
          <span className="stat-label">Tower Step</span>
          <span className="stat-value">
            {currentStep} / {towerConfig.totalSteps}
          </span>
        </div>
      </div>

      <div className="hud-stat-pill" data-testid="hud-checkpoint-counter">
        <Flag size={16} className="icon-gold" />
        <div>
          <span className="stat-label">Gates</span>
          <span className="stat-value">
            {completedCheckpointsCount} / {towerConfig.numberOfCheckpoints}
          </span>
        </div>
      </div>

      <div className="hud-stat-pill" data-testid="hud-current-target">
        <Compass size={16} className="icon-emerald" />
        <div>
          <span className="stat-label">Target</span>
          <span className="stat-value">{currentTargetLabel}</span>
        </div>
      </div>

      <div className="hud-stat-pill xp-pill" data-testid="hud-xp">
        <Zap size={16} className="icon-amber" />
        <div>
          <span className="stat-label">Score</span>
          <span className="stat-value">{xpPoints} / 1500 XP</span>
        </div>
      </div>

      <button
        type="button"
        className="hud-sound-btn"
        onClick={toggleSound}
        aria-label={muted ? 'Unmute game sound' : 'Mute game sound'}
        title={muted ? 'Unmute Sound' : 'Mute Sound'}
        data-testid="hud-sound-toggle"
      >
        {muted ? (
          <VolumeX size={18} className="icon-muted" />
        ) : (
          <Volume2 size={18} className="icon-cyan" />
        )}
      </button>
    </header>
  );
};
