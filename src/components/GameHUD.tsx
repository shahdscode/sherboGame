import React, { useEffect, useState, useRef } from 'react';
import { Flag, Footprints, Zap, Compass, Timer, Volume2, VolumeX, Flame } from 'lucide-react';
import { CheckpointStateItem } from '../hooks/useTowerGame';
import { towerConfig, formatStopwatchTime } from '../data/towerConfig';
import { sfx } from '../game/sfx';
import { ScoreNotification } from '../game/scoring';

interface GameHUDProps {
  currentStep: number;
  completedCheckpointsCount: number;
  activeCheckpointNumber: number | null;
  checkpoints: CheckpointStateItem[];
  xpPoints: number;
  elapsedTime: number;
  currentStreak?: number;
  notifications?: ScoreNotification[];
  onDismissNotification?: (id: string) => void;
}

interface FloatingGain {
  id: string;
  amount: number;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  currentStep,
  completedCheckpointsCount,
  activeCheckpointNumber,
  checkpoints,
  xpPoints,
  elapsedTime,
  currentStreak = 0,
  notifications = [],
  onDismissNotification,
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

  // Auto-dismiss notifications after 3.2s
  useEffect(() => {
    if (!notifications.length || !onDismissNotification) return;
    const latest = notifications[notifications.length - 1];
    const timer = window.setTimeout(() => {
      onDismissNotification(latest.id);
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [notifications, onDismissNotification]);

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
    <>
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

      {/* Floating Milestone & Achievement Toast Deck */}
      {notifications.length > 0 && (
        <div className="hud-notification-deck" aria-live="polite" data-testid="hud-notification-deck">
          {notifications.slice(-2).map((notif) => (
            <div
              key={notif.id}
              className={`hud-notification-banner notif-${notif.type}`}
              onClick={() => onDismissNotification?.(notif.id)}
              title="Click to dismiss"
            >
              <div className="notif-icon">
                {notif.type === 'streak' ? '🔥' : notif.type === 'achievement' ? '🏆' : notif.type === 'summit' ? '👑' : '⚡'}
              </div>
              <div className="notif-body">
                <div className="notif-title">{notif.title}</div>
                {notif.subtitle && <div className="notif-subtitle">{notif.subtitle}</div>}
              </div>
              {notif.xpEarned > 0 && (
                <div className="notif-xp-pill">+{notif.xpEarned} XP</div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
};
