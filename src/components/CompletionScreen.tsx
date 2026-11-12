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
import { captureGameFrame, getSummitViewRatios } from '../game/TowerGame';

interface CompletionScreenProps {
  completedCheckpointsCount: number;
  totalAttempts: number;
  firstTryCount: number;
  xpPoints: number;
  onPlayAgain: () => void;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = window.setTimeout(() => resolve(null), 2000);
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  fill: string,
  stroke?: string
) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
  ctx.restore();
}

function drawStatIcon(
  ctx: CanvasRenderingContext2D,
  type: 'steps' | 'gates' | 'tries' | 'combos',
  cx: number,
  cy: number,
  color: string
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (type === 'steps') {
    // Rising 3-step stairs icon with sparkle
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy + 12);
    ctx.lineTo(cx - 6, cy + 12);
    ctx.lineTo(cx - 6, cy + 2);
    ctx.lineTo(cx + 5, cy + 2);
    ctx.lineTo(cx + 5, cy - 8);
    ctx.lineTo(cx + 16, cy - 8);
    ctx.stroke();
    // Little star at top-left
    drawStar(ctx, cx - 10, cy - 9, 6, 2.5, color);
  } else if (type === 'gates') {
    // Checkmark circle
    ctx.beginPath();
    ctx.arc(cx, cy, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy + 1);
    ctx.lineTo(cx - 2, cy + 6);
    ctx.lineTo(cx + 8, cy - 5);
    ctx.stroke();
  } else if (type === 'tries') {
    // Bullseye target
    ctx.beginPath();
    ctx.arc(cx, cy, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Trophy cup
    ctx.beginPath();
    ctx.moveTo(cx - 11, cy - 12);
    ctx.lineTo(cx + 11, cy - 12);
    ctx.lineTo(cx + 9, cy - 1);
    ctx.arc(cx, cy - 1, 9, 0, Math.PI, false);
    ctx.closePath();
    ctx.stroke();
    // Stem + base
    ctx.beginPath();
    ctx.moveTo(cx, cy + 8);
    ctx.lineTo(cx, cy + 14);
    ctx.moveTo(cx - 8, cy + 14);
    ctx.lineTo(cx + 8, cy + 14);
    ctx.stroke();
  }

  ctx.restore();
}

export const CompletionScreen: React.FC<CompletionScreenProps> = ({
  completedCheckpointsCount,
  totalAttempts,
  firstTryCount,
  xpPoints,
  onPlayAgain,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const maxScore = towerConfig.rewards.maxTotalScore;
  const scorePct = Math.max(0, Math.min(100, Math.round((xpPoints / maxScore) * 100)));
  const starCount = scorePct >= 85 ? 3 : scorePct >= 60 ? 2 : 1;

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
      const [frame, stickerImg] = await Promise.all([
        captureGameFrame(),
        loadImage('/stickers/goodjob.webp'),
      ]);
      const { summitRatioY, playerRatioX } = getSummitViewRatios();

      // Studio-grade 4:5 vertical social poster (sharp on WhatsApp, Instagram, Photos)
      const outW = 1080;
      const outH = 1350;

      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = outW;
      exportCanvas.height = outH;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) return;

      // 1. Rich deep-space arcade background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, outH);
      bgGrad.addColorStop(0, '#182850');
      bgGrad.addColorStop(0.5, '#0f1a36');
      bgGrad.addColorStop(1, '#091022');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, outW, outH);

      // Warm radial spotlight behind the summit & card
      const spotGrad = ctx.createRadialGradient(
        outW / 2,
        520,
        60,
        outW / 2,
        520,
        640
      );
      spotGrad.addColorStop(0, 'rgba(238, 123, 60, 0.28)');
      spotGrad.addColorStop(0.55, 'rgba(63, 159, 155, 0.10)');
      spotGrad.addColorStop(1, 'rgba(9, 16, 34, 0)');
      ctx.fillStyle = spotGrad;
      ctx.fillRect(0, 0, outW, outH);

      // Celebratory background confetti & starlight dots
      const confettiPalette = ['#ee7b3c', '#fde047', '#3f9f9b', '#d8356c', '#7e57d8'];
      for (let i = 0; i < 38; i++) {
        const seed = (i * 9301 + 49297) % 233280;
        const rx = ((seed / 233280) * 1020) + 30;
        const ry = (((seed * 7) % 233280) / 233280) * 1290 + 30;
        const col = confettiPalette[i % confettiPalette.length];
        ctx.save();
        ctx.translate(rx, ry);
        ctx.rotate((i * 0.45) % Math.PI);
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.28 + (i % 3) * 0.14;
        if (i % 3 === 0) {
          ctx.beginPath();
          ctx.arc(0, 0, 4 + (i % 4), 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-7, -3.5, 14, 7);
        }
        ctx.restore();
      }

      // Outer decorative arcade frame
      ctx.save();
      ctx.strokeStyle = 'rgba(238, 123, 60, 0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(22, 22, outW - 44, outH - 44, 38);
      ctx.stroke();
      ctx.restore();

      // 2. Top Showcase: Framed Live Summit Scene Window
      const winX = 48;
      const winY = 46;
      const winW = outW - 96; // 984
      const winH = 492;
      const winR = 28;

      // Window 3D shadow
      ctx.fillStyle = '#070c1a';
      ctx.beginPath();
      ctx.roundRect(winX, winY + 10, winW, winH, winR);
      ctx.fill();

      // Clip and draw the live summit scene centered on the Finish Line & Character
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(winX, winY, winW, winH, winR);
      ctx.clip();

      if (frame) {
        const fw = frame.naturalWidth || frame.width;
        const fh = frame.naturalHeight || frame.height;
        const targetAspect = winW / winH; // 2.0

        // Choose a crop region from the snapshot that preserves aspect ratio (zero distortion)
        // and places the Step 30 Finish Line at ~78% down the window so the character, trophy,
        // stained-glass window, and finish line are always framed cleanly.
        let srcW = fw;
        let srcH = fw / targetAspect;
        if (srcH > fh) {
          srcH = fh;
          srcW = fh * targetAspect;
        }

        const finishLinePxY = summitRatioY * fh;
        const desiredFinishRatioInWin = 0.78;
        const rawSrcY = finishLinePxY - srcH * desiredFinishRatioInWin;
        const srcY = Math.max(0, Math.min(fh - srcH, rawSrcY));

        const playerPxX = playerRatioX * fw;
        const rawSrcX = playerPxX - srcW * 0.42;
        const srcX = Math.max(0, Math.min(fw - srcW, rawSrcX));

        ctx.drawImage(frame, srcX, srcY, srcW, srcH, winX, winY, winW, winH);
      } else {
        ctx.fillStyle = '#0e172f';
        ctx.fillRect(winX, winY, winW, winH);
      }

      // Subtle top & bottom gradient vignette inside the game window for depth
      const winGrad = ctx.createLinearGradient(0, winY, 0, winY + winH);
      winGrad.addColorStop(0, 'rgba(13, 23, 48, 0.42)');
      winGrad.addColorStop(0.22, 'rgba(13, 23, 48, 0)');
      winGrad.addColorStop(0.82, 'rgba(13, 23, 48, 0)');
      winGrad.addColorStop(1, 'rgba(13, 23, 48, 0.55)');
      ctx.fillStyle = winGrad;
      ctx.fillRect(winX, winY, winW, winH);
      ctx.restore();

      // Window double arcade border
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#1b2a53';
      ctx.beginPath();
      ctx.roundRect(winX, winY, winW, winH, winR);
      ctx.stroke();

      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ee7b3c';
      ctx.beginPath();
      ctx.roundRect(winX - 2, winY - 2, winW + 4, winH + 4, winR + 2);
      ctx.stroke();

      // Top floating badge pill on the Summit Window
      const topBadgeW = 350;
      const topBadgeH = 40;
      const topBadgeX = outW / 2 - topBadgeW / 2;
      const topBadgeY = winY + 16;

      ctx.fillStyle = 'rgba(27, 42, 83, 0.92)';
      ctx.beginPath();
      ctx.roundRect(topBadgeX, topBadgeY, topBadgeW, topBadgeH, 999);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#fde047';
      ctx.stroke();

      ctx.fillStyle = '#fde047';
      ctx.font = '700 16px "Fredoka", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★  SUMMIT REACHED • STEP 30  ★', outW / 2, topBadgeY + 26);

      // 3. Bottom Showcase: Tactile 3D Arcade Score Card
      const cardX = 48;
      const cardY = 514;
      const cardW = outW - 96; // 984
      const cardH = 774;
      const cardR = 32;

      // Card 3D solid navy bottom lip + drop shadow
      ctx.fillStyle = 'rgba(5, 10, 22, 0.55)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY + 18, cardW, cardH, cardR);
      ctx.fill();

      ctx.fillStyle = '#1b2a53';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY + 10, cardW, cardH, cardR);
      ctx.fill();

      // Warm cream arcade card body (#f8e7d6) matching Start & Question cards
      ctx.fillStyle = '#f8e7d6';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, cardR);
      ctx.fill();

      ctx.lineWidth = 4;
      ctx.strokeStyle = '#1b2a53';
      ctx.stroke();

      // Inner subtle top highlight
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(cardX + 4, cardY + 4, cardW - 8, cardH - 8, cardR - 3);
      ctx.stroke();
      ctx.restore();

      // Header Row: Celebratory Sherbo Sticker + Title + Subtitle
      const headerCenterX = stickerImg ? cardX + 555 : cardX + cardW / 2;

      if (stickerImg) {
        // Soft glow halo behind Sherbo sticker
        const haloX = cardX + 152;
        const haloY = cardY + 86;
        const haloGrad = ctx.createRadialGradient(haloX, haloY, 12, haloX, haloY, 105);
        haloGrad.addColorStop(0, 'rgba(238, 123, 60, 0.32)');
        haloGrad.addColorStop(1, 'rgba(238, 123, 60, 0)');
        ctx.fillStyle = haloGrad;
        ctx.beginPath();
        ctx.arc(haloX, haloY, 105, 0, Math.PI * 2);
        ctx.fill();

        // Draw sticker popping slightly above the card border!
        const stickerSize = 196;
        ctx.save();
        ctx.shadowColor = 'rgba(27, 42, 83, 0.28)';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 8;
        ctx.drawImage(
          stickerImg,
          haloX - stickerSize / 2,
          cardY - 26,
          stickerSize,
          stickerSize
        );
        ctx.restore();
      }

      // Star rating row above title
      const starSpacing = 36;
      for (let s = 0; s < 3; s++) {
        const sx = headerCenterX + (s - 1) * starSpacing;
        const sy = cardY + 46;
        const earned = s < starCount;
        drawStar(
          ctx,
          sx,
          sy,
          15,
          6.8,
          earned ? '#fbbf24' : '#e2d5c4',
          earned ? '#b45309' : '#94a3b8'
        );
      }

      // Title: Sherbo's Tower
      ctx.fillStyle = '#1b2a53';
      ctx.font = '700 52px "Fredoka", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText("Sherbo's Tower", headerCenterX, cardY + 108);

      // Subtitle: Amazing climb! Here is your final score
      ctx.fillStyle = '#576582';
      ctx.font = '600 24px "Fredoka", sans-serif';
      ctx.fillText(
        'Amazing climb! Here is your final score',
        headerCenterX,
        cardY + 144
      );

      // 4. Hero Final Score Banner (White 3D Arcade Box with XP Bar)
      const bannerX = cardX + 36;
      const bannerY = cardY + 178;
      const bannerW = cardW - 72; // 912
      const bannerH = 166;
      const bannerR = 24;

      // 3D orange-brown bottom lip
      ctx.fillStyle = '#b85720';
      ctx.beginPath();
      ctx.roundRect(bannerX, bannerY + 7, bannerW, bannerH, bannerR);
      ctx.fill();

      // Crisp white banner body
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(bannerX, bannerY, bannerW, bannerH, bannerR);
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#ee7b3c';
      ctx.stroke();

      // Top label pill inside score banner
      ctx.fillStyle = '#b85720';
      ctx.font = '700 18px "Fredoka", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('⚡ FINAL SCORE', bannerX + 32, bannerY + 40);

      // Percentage pill on top-right of banner
      const pctPillW = 148;
      const pctPillH = 34;
      const pctPillX = bannerX + bannerW - pctPillW - 28;
      const pctPillY = bannerY + 18;
      ctx.fillStyle = '#fff4ea';
      ctx.beginPath();
      ctx.roundRect(pctPillX, pctPillY, pctPillW, pctPillH, 999);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ee7b3c';
      ctx.stroke();

      ctx.fillStyle = '#ee7b3c';
      ctx.font = '700 18px "Fredoka", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${scorePct}% SCORE`, pctPillX + pctPillW / 2, pctPillY + 23);

      // Huge XP Score Value
      ctx.fillStyle = '#ee7b3c';
      ctx.font = '700 54px "Fredoka", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(
        `${xpPoints} / ${maxScore} XP`,
        bannerX + 32,
        bannerY + 104
      );

      // XP Progress Track
      const trackX = bannerX + 32;
      const trackY = bannerY + 124;
      const trackW = bannerW - 64;
      const trackH = 20;

      ctx.fillStyle = '#f3decb';
      ctx.beginPath();
      ctx.roundRect(trackX, trackY, trackW, trackH, 999);
      ctx.fill();

      const fillW = Math.max(24, Math.round((scorePct / 100) * trackW));
      const barGrad = ctx.createLinearGradient(trackX, 0, trackX + fillW, 0);
      barGrad.addColorStop(0, '#f59e0b');
      barGrad.addColorStop(1, '#ee7b3c');
      ctx.fillStyle = barGrad;
      ctx.beginPath();
      ctx.roundRect(trackX, trackY, fillW, trackH, 999);
      ctx.fill();

      // 5. Four Tactile 3D Arcade Power-Block Stat Tiles (2x2 Grid)
      const stats: Array<{
        type: 'steps' | 'gates' | 'tries' | 'combos';
        label: string;
        val: string;
        border: string;
        lip: string;
        badgeBg: string;
      }> = [
        {
          type: 'steps',
          label: 'Steps Climbed',
          val: `${towerConfig.totalSteps} / ${towerConfig.totalSteps}`,
          border: '#3f9f9b',
          lip: '#286d6a',
          badgeBg: '#e6f7f5',
        },
        {
          type: 'gates',
          label: 'Gates Unlocked',
          val: `${completedCheckpointsCount} / ${towerConfig.numberOfCheckpoints}`,
          border: '#10b981',
          lip: '#047857',
          badgeBg: '#ecfdf5',
        },
        {
          type: 'tries',
          label: 'Stone Tries',
          val: `${totalAttempts}`,
          border: '#ee7b3c',
          lip: '#b85720',
          badgeBg: '#fff4ea',
        },
        {
          type: 'combos',
          label: '1st-Try Combos',
          val: `${firstTryCount} / ${towerConfig.numberOfCheckpoints}`,
          border: '#7e57d8',
          lip: '#5733a8',
          badgeBg: '#f3effd',
        },
      ];

      const gridStartX = cardX + 36;
      const gridStartY = cardY + 368;
      const gapX = 24;
      const gapY = 24;
      const boxW = (cardW - 72 - gapX) / 2; // 444
      const boxH = 132;
      const boxR = 22;

      stats.forEach((st, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const bx = gridStartX + col * (boxW + gapX);
        const by = gridStartY + row * (boxH + gapY);

        // 3D colored bottom lip
        ctx.fillStyle = st.lip;
        ctx.beginPath();
        ctx.roundRect(bx, by + 7, boxW, boxH, boxR);
        ctx.fill();

        // White tile body
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(bx, by, boxW, boxH, boxR);
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = st.border;
        ctx.stroke();

        // Left colored icon badge
        const iconBoxSize = 76;
        const iconBoxX = bx + 22;
        const iconBoxY = by + (boxH - iconBoxSize) / 2;
        ctx.fillStyle = st.badgeBg;
        ctx.beginPath();
        ctx.roundRect(iconBoxX, iconBoxY, iconBoxSize, iconBoxSize, 18);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = st.border;
        ctx.stroke();

        drawStatIcon(
          ctx,
          st.type,
          iconBoxX + iconBoxSize / 2,
          iconBoxY + iconBoxSize / 2,
          st.border
        );

        // Stat Value & Label on the right
        const textX = iconBoxX + iconBoxSize + 22;
        ctx.fillStyle = '#1b2a53';
        ctx.font = '700 38px "Fredoka", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(st.val, textX, by + 62);

        ctx.fillStyle = '#576582';
        ctx.font = '600 21px "Fredoka", sans-serif';
        ctx.fillText(st.label, textX, by + 98);
      });

      // 6. Branded Arcade Footer Pill
      const footerW = 540;
      const footerH = 46;
      const footerX = cardX + (cardW - footerW) / 2;
      const footerY = cardY + cardH - 68;

      ctx.fillStyle = '#1b2a53';
      ctx.beginPath();
      ctx.roundRect(footerX, footerY, footerW, footerH, 999);
      ctx.fill();

      ctx.fillStyle = '#f8e7d6';
      ctx.font = '700 18px "Fredoka", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        "🏆  SHERBENI ACADEMY  •  SHERBO'S TOWER",
        cardX + cardW / 2,
        footerY + 29
      );

      const fileName = `sherbos-tower-score-${xpPoints}xp.png`;
      const blob: Blob | null = await new Promise((resolve) =>
        exportCanvas.toBlob((b) => resolve(b), 'image/png')
      );
      if (!blob) return;

      // On phones use the native share sheet (save to photos / send on WhatsApp).
      const isTouchDevice =
        !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      if (isTouchDevice && typeof navigator.share === 'function') {
        try {
          const file = new File([blob], fileName, { type: 'image/png' });
          if (!navigator.canShare || navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: "Sherbo's Tower",
              text: `I scored ${xpPoints} / ${maxScore} XP on Sherbo's Tower!`,
            });
            return;
          }
        } catch (shareErr) {
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
        <div className="completion-hero-banner">
          <div className="completion-sticker-wrap">
            <img
              src="/stickers/goodjob.webp"
              alt="Sherbo Celebrating"
              className="completion-hero-sticker"
              width={256}
              height={256}
            />
          </div>
          <div className="completion-hero-copy">
            <div className="completion-stars-row" aria-label={`${starCount} out of 3 stars`}>
              {[0, 1, 2].map((idx) => (
                <span
                  key={idx}
                  className={
                    idx < starCount
                      ? 'completion-star star-earned'
                      : 'completion-star star-empty'
                  }
                >
                  ★
                </span>
              ))}
            </div>
            <h1 className="completion-title">Sherbo's Tower</h1>
            <p className="completion-subtitle">
              Amazing climb! Here is your final score
            </p>
          </div>
        </div>

        <div className="xp-reward-banner" data-testid="stat-total-xp">
          <div className="xp-banner-top">
            <div className="xp-banner-title-group">
              <Zap size={20} className="icon-amber" />
              <span className="xp-banner-title">Final Score</span>
            </div>
            <span className="xp-banner-pct-pill">{scorePct}%</span>
          </div>
          <div className="xp-banner-score">
            {xpPoints} / {maxScore} XP ({scorePct}%)
          </div>
          <div className="xp-progress-track">
            <div
              className="xp-progress-fill"
              style={{ width: `${Math.max(8, scorePct)}%` }}
            />
          </div>
        </div>

        <div className="stats-summary-grid">
          <div
            className="stat-box stat-box-teal"
            data-testid="stat-steps-completed"
          >
            <Sparkles size={18} className="icon-cyan" />
            <div className="stat-box-val">
              {towerConfig.totalSteps} / {towerConfig.totalSteps}
            </div>
            <div className="stat-box-label">Steps Climbed</div>
          </div>

          <div
            className="stat-box stat-box-emerald"
            data-testid="stat-checkpoints-passed"
          >
            <CheckCircle size={18} className="icon-emerald" />
            <div className="stat-box-val">
              {completedCheckpointsCount} / {towerConfig.numberOfCheckpoints}
            </div>
            <div className="stat-box-label">Gates Unlocked</div>
          </div>

          <div
            className="stat-box stat-box-orange"
            data-testid="stat-total-attempts"
          >
            <Target size={18} className="icon-gold" />
            <div className="stat-box-val">{totalAttempts}</div>
            <div className="stat-box-label">Stone Tries</div>
          </div>

          <div
            className="stat-box stat-box-violet"
            data-testid="stat-first-try"
          >
            <Trophy size={18} className="icon-purple" />
            <div className="stat-box-val">
              {firstTryCount} / {towerConfig.numberOfCheckpoints}
            </div>
            <div className="stat-box-label">1st-Try Combos</div>
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
