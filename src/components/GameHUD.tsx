import React, { useEffect, useState, useRef } from 'react';
import { Flag, Zap, Timer, Volume2, VolumeX, Flame } from 'lucide-react';
import { CheckpointStateItem } from '../hooks/useTowerGame';
import { towerConfig, formatStopwatchTime } from '../data/towerConfig';
import { sfx } from '../game/sfx';

interface GameHUDProps {
  currentStep?: number;
  completedCheckpointsCount: number;
  activeCheckpointNumber?: number | null;
  checkpoints?: CheckpointStateItem[];
  xpPoints: number;
  elapsedTime: number;
  currentStreak?: number;
}

interface FloatingGain {
  id: string;
  amount: number;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  completedCheckpointsCount,
  xpPoints,
  elapsedTime,
  currentStreak = 0,
}) => {
  const [muted, setMutedState] = useState<boolean>(() => sfx.isMuted());
  const [floatingGains, setFloatingGains] = useState<FloatingGain[]>([]);
  const prevXpRef = useRef<number>(xpPoints);

  useEffect(() => {
    return sfx.onMuteChange((m) => setMutedState(m));
  }, []);

  // Track XP increases for floating +XP animations
  useEffect(() => {
    if (xpPoints > prevXpRef.current) {
      const diff = xpPoints - prevXpRef.current;
      const newGain: FloatingGain = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        amount: diff,
      };
      setFloatingGains((prev) => [...prev, newGain]);

      const timer = window.setTimeout(() => {
        setFloatingGains((prev) => prev.filter((g) => g.id !== newGain.id));
      }, 1600);

      return () => window.clearTimeout(timer);
    }
    prevXpRef.current = xpPoints;
  }, [xpPoints]);

  const toggleSound = () => {
    const next = !muted;
    sfx.setMuted(next);
    if (!next) {
      sfx.unlock();
      sfx.click();
    }
  };

  return (
    <>
      <header
        className="floating-top-hud"
        aria-label="Tower Progress HUD"
        data-testid="floating-top-hud"
      >
        <div className="hud-stat-pill" data-testid="hud-checkpoint-counter">
          <Flag size={16} className="icon-gold" />
          <div>
            <span className="stat-label">Gates</span>
            <span className="stat-value">
              {completedCheckpointsCount} / {towerConfig.numberOfCheckpoints}
            </span>
          </div>
        </div>

        <div className="hud-stat-pill timer-pill" data-testid="hud-stopwatch">
          <Timer size={16} className="icon-gold" />
          <div>
            <span className="stat-label">Time</span>
            <span className="stat-value">{formatStopwatchTime(elapsedTime)}</span>
          </div>
        </div>

        {currentStreak >= 2 && (
          <div className="hud-stat-pill streak-pill" data-testid="hud-streak">
            <Flame size={16} className="icon-flame" />
            <div>
              <span className="stat-label">Streak</span>
              <span className="stat-value">{currentStreak}x 🔥</span>
            </div>
          </div>
        )}

        <div className="hud-stat-pill xp-pill" data-testid="hud-xp" style={{ position: 'relative' }}>
          <Zap size={16} className="icon-amber" />
          <div>
            <span className="stat-label">Score</span>
            <span className="stat-value">{xpPoints.toLocaleString()} XP</span>
          </div>
          {floatingGains.map((gain) => (
            <div key={gain.id} className="floating-xp-gain" data-testid="floating-xp-gain">
              +{gain.amount} XP
            </div>
          ))}
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
    </>
  );
};
