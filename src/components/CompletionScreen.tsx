import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Trophy,
  RotateCcw,
  CheckCircle,
  Target,
  Zap,
  Sparkles,
  Download,
} from 'lucide-react';
import { towerConfig } from '../data/towerConfig';
import { captureGameFrame } from '../game/TowerGame';

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
  const [isExporting, setIsExporting] = useState(false);

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

  const handleSaveScore = async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      // 1. Grab the current game frame (works without preserveDrawingBuffer)
      const frame = await captureGameFrame();

      const outW = frame ? frame.naturalWidth || frame.width : 1200;
      const outH = frame ? frame.naturalHeight || frame.height : 900;

      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = outW;
      exportCanvas.height = outH;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) return;

      // Draw background / game scene
      if (frame) {
        ctx.drawImage(frame, 0, 0, outW, outH);
      } else {
        ctx.fillStyle = '#0a1226';
        ctx.fillRect(0, 0, outW, outH);
      }

      // 2. Render Score Card Overlay in the export (high-res vector graphics)
      const scale = Math.min(outW / 900, outH / 700);
      const cardW = Math.round(380 * scale);
      const cardH = Math.round(440 * scale);
      const cardX = outW - cardW - Math.round(28 * scale);
      const cardY = Math.round(28 * scale);
      const r = 20 * scale;

      // Card shadow
      ctx.fillStyle = 'rgba(27, 42, 83, 0.45)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY + 8 * scale, cardW, cardH, r);
      ctx.fill();

      // Card background
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, r);
      ctx.fill();

      // Card border
      ctx.lineWidth = 3 * scale;
      ctx.strokeStyle = '#1b2a53';
      ctx.stroke();

      // Card Title: Sherbo's Tower
      ctx.fillStyle = '#1b2a53';
      ctx.font = `bold ${Math.round(26 * scale)}px "Fredoka", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText("Sherbo's Tower", cardX + cardW / 2, cardY + 44 * scale);

      // Subtitle
      ctx.fillStyle = '#576582';
      ctx.font = `600 ${Math.round(13 * scale)}px "Fredoka", sans-serif`;
      ctx.fillText(
        'Amazing climb! Here is your final score',
        cardX + cardW / 2,
        cardY + 68 * scale
      );

      // Score Banner
      const bannerX = cardX + 16 * scale;
      const bannerY = cardY + 85 * scale;
      const bannerW = cardW - 32 * scale;
      const bannerH = 58 * scale;
      ctx.fillStyle = '#fef3e7';
      ctx.beginPath();
      ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 12 * scale);
      ctx.fill();
      ctx.lineWidth = 2 * scale;
      ctx.strokeStyle = '#ee7b3c';
      ctx.stroke();

      ctx.fillStyle = '#b85720';
      ctx.font = `bold ${Math.round(11 * scale)}px "Fredoka", sans-serif`;
      ctx.fillText('FINAL SCORE', bannerX + bannerW / 2, bannerY + 20 * scale);

      ctx.fillStyle = '#ee7b3c';
      ctx.font = `bold ${Math.round(24 * scale)}px "Fredoka", sans-serif`;
      ctx.fillText(
        `${xpPoints} / 1500 XP (${Math.round((xpPoints / 1500) * 100)}%)`,
        bannerX + bannerW / 2,
        bannerY + 46 * scale
      );

      // 4 Stats Boxes (2x2 grid)
      const stats = [
        { label: 'Steps Climbed', val: `${towerConfig.totalSteps} / ${towerConfig.totalSteps}`, col: '#3f9f9b' },
        { label: 'Gates Unlocked', val: `${completedCheckpointsCount} / ${towerConfig.numberOfCheckpoints}`, col: '#10b981' },
        { label: 'Stone Tries', val: `${totalAttempts}`, col: '#ee7b3c' },
        { label: '1st-Try Combos', val: `${firstTryCount} / ${towerConfig.numberOfCheckpoints}`, col: '#7e57d8' },
      ];

      const gridStartX = cardX + 16 * scale;
      const gridStartY = cardY + 155 * scale;
      const boxW = (cardW - 40 * scale) / 2;
      const boxH = 58 * scale;
      const gap = 8 * scale;

      stats.forEach((st, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const bx = gridStartX + col * (boxW + gap);
        const by = gridStartY + row * (boxH + gap);

        ctx.fillStyle = '#fdf8f2';
        ctx.beginPath();
        ctx.roundRect(bx, by, boxW, boxH, 10 * scale);
        ctx.fill();
        ctx.lineWidth = 1.5 * scale;
        ctx.strokeStyle = 'rgba(27, 42, 83, 0.16)';
        ctx.stroke();

        ctx.fillStyle = '#1b2a53';
        ctx.font = `bold ${Math.round(17 * scale)}px "Fredoka", sans-serif`;
        ctx.fillText(st.val, bx + boxW / 2, by + 26 * scale);

        ctx.fillStyle = '#576582';
        ctx.font = `600 ${Math.round(11 * scale)}px "Fredoka", sans-serif`;
        ctx.fillText(st.label, bx + boxW / 2, by + 46 * scale);
      });

      // Trophy Badge Icon circle at top
      ctx.fillStyle = '#1b2a53';
      ctx.font = `bold ${Math.round(13 * scale)}px "Fredoka", sans-serif`;
      ctx.fillText('🏆 SUMMIT MASTER', cardX + cardW / 2, cardY + 302 * scale);

      // Watermark / Brand footer
      ctx.fillStyle = '#8a99b5';
      ctx.font = `600 ${Math.round(11 * scale)}px "Fredoka", sans-serif`;
      ctx.fillText(
        "Sherbeni Academy • Knowledge Tower",
        cardX + cardW / 2,
        cardY + 326 * scale
      );

      const fileName = `sherbos-tower-score-${xpPoints}xp.png`;
      const blob: Blob | null = await new Promise((resolve) =>
        exportCanvas.toBlob((b) => resolve(b), 'image/png')
      );
      if (!blob) return;

      // On phones use the native share sheet (save to photos / send on WhatsApp).
      // A plain download link silently does nothing inside in-app browsers such as
      // Facebook / Messenger, which is where most students open the game from.
      const isTouchDevice =
        !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      if (isTouchDevice && typeof navigator.share === 'function') {
        try {
          const file = new File([blob], fileName, { type: 'image/png' });
          if (!navigator.canShare || navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: "Sherbo's Tower",
              text: `I scored ${xpPoints} / ${towerConfig.rewards.maxTotalScore} XP on Sherbo's Tower!`,
            });
            return;
          }
        } catch (shareErr) {
          // The student closed the share sheet — that's not an error
          if ((shareErr as DOMException)?.name === 'AbortError') return;
        }
      }

      // Desktop (or share unavailable): download the image
      const objectUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.download = fileName;
      downloadLink.href = objectUrl;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
    } catch (err) {
      console.error('Failed to export score card image:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      className="completion-side-wrapper"
      role="dialog"
      aria-modal="true"
      data-testid="completion-screen"
    >
      <div className="modal-card completion-side-card">
        <div className="trophy-showcase">
          <div className="completion-hero-row">
            <div className="trophy-circle">
              <Trophy size={36} className="trophy-icon" />
            </div>
          </div>
        </div>

        <h1 className="completion-title">Sherbo's Tower</h1>
        <p className="completion-subtitle">
          Amazing climb! here is your final score
        </p>

        <div className="stats-summary-grid">
          <div className="stat-box" data-testid="stat-steps-completed">
            <Sparkles size={18} className="icon-cyan" />
            <div className="stat-box-val">
              {towerConfig.totalSteps} / {towerConfig.totalSteps}
            </div>
            <div className="stat-box-label">Steps Climbed</div>
          </div>

          <div className="stat-box" data-testid="stat-checkpoints-passed">
            <CheckCircle size={18} className="icon-emerald" />
            <div className="stat-box-val">
              {completedCheckpointsCount} / {towerConfig.numberOfCheckpoints}
            </div>
            <div className="stat-box-label">Gates Unlocked</div>
          </div>

          <div className="stat-box" data-testid="stat-total-attempts">
            <Target size={18} className="icon-gold" />
            <div className="stat-box-val">{totalAttempts}</div>
            <div className="stat-box-label">Stone Tries</div>
          </div>

          <div className="stat-box" data-testid="stat-first-try">
            <Trophy size={18} className="icon-purple" />
            <div className="stat-box-val">
              {firstTryCount} / {towerConfig.numberOfCheckpoints}
            </div>
            <div className="stat-box-label">1st-Try Combos</div>
          </div>
        </div>

        <div className="xp-reward-banner" data-testid="stat-total-xp">
          <Zap size={22} className="icon-amber" />
          <div>
            <div className="xp-banner-title">Final Score</div>
            <div className="xp-banner-score">
              {xpPoints} / 1500 XP ({Math.round((xpPoints / 1500) * 100)}%)
            </div>
          </div>
        </div>

        <div className="completion-actions-row">
          <button
            type="button"
            className="primary-cta-btn save-score-btn"
            onClick={handleSaveScore}
            disabled={isExporting}
            data-testid="save-score-btn"
          >
            <Download size={18} />
            <span>{isExporting ? 'Saving Image...' : 'Save My Score'}</span>
          </button>

          <button
            type="button"
            className="secondary-cta-btn play-again-btn"
            onClick={onPlayAgain}
            data-testid="play-again-btn"
          >
            <RotateCcw size={18} />
            <span>Climb Again</span>
          </button>
        </div>
      </div>
    </div>
  );
};
