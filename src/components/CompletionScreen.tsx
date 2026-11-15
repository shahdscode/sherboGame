import React, { useEffect, useState, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  Trophy,
  RotateCcw,
  CheckCircle,
  Timer,
  Zap,
  Sparkles,
  Download,
  Award,
} from 'lucide-react';
import { towerConfig, formatStopwatchTime } from '../data/towerConfig';
import { captureGameFrame, getSummitViewRatios } from '../game/TowerGame';
import { sfx } from '../game/sfx';

interface CompletionScreenProps {
  completedCheckpointsCount: number;
  totalAttempts: number;
  firstTryCount: number;
  xpPoints: number;
  elapsedTime: number;
  speedBonus: number;
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
  type: 'best' | 'grade' | 'time' | 'combos',
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

  if (type === 'best') {
    // Trophy cup for Best Score
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
    // Handles
    ctx.beginPath();
    ctx.arc(cx - 9, cy - 6, 4, Math.PI * 0.5, Math.PI * 1.5, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 9, cy - 6, 4, Math.PI * 1.5, Math.PI * 0.5, false);
    ctx.stroke();
  } else if (type === 'grade') {
    // Medal / Rosette with ribbon tails
    ctx.beginPath();
    ctx.arc(cx, cy - 3, 11, 0, Math.PI * 2);
    ctx.stroke();
    // Star inside medal
    drawStar(ctx, cx, cy - 3, 6, 2.8, color);
    // Ribbon tails
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy + 7);
    ctx.lineTo(cx - 9, cy + 16);
    ctx.lineTo(cx - 3, cy + 14);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 5, cy + 7);
    ctx.lineTo(cx + 9, cy + 16);
    ctx.lineTo(cx + 3, cy + 14);
    ctx.stroke();
  } else if (type === 'time') {
    // Stopwatch icon
    ctx.beginPath();
    ctx.arc(cx, cy + 2, 14, 0, Math.PI * 2);
    ctx.stroke();
    // Top stem & button
    ctx.beginPath();
    ctx.moveTo(cx, cy - 12);
    ctx.lineTo(cx, cy - 16);
    ctx.moveTo(cx - 5, cy - 16);
    ctx.lineTo(cx + 5, cy - 16);
    // Clock hands pointing to ~1:20
    ctx.moveTo(cx, cy + 2);
    ctx.lineTo(cx, cy - 6);
    ctx.moveTo(cx, cy + 2);
    ctx.lineTo(cx + 6, cy + 2);
    ctx.stroke();
  } else {
    // Combos: Lightning spark
    ctx.beginPath();
    ctx.moveTo(cx + 1, cy - 14);
    ctx.lineTo(cx - 7, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx - 2, cy + 14);
    ctx.lineTo(cx + 7, cy - 1);
    ctx.lineTo(cx, cy - 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

export type PerformanceTier = 'legendary' | 'gold' | 'silver' | 'comeback';

export interface PerformanceTierConfig {
  tier: PerformanceTier;
  letterGrade: 'S+' | 'S' | 'A' | 'B';
  title: string;
  badgeTag: string;
  heroHeadline: string;
  subtitle: string;
  quote: string;
  stickerSrc: string;
  stickerAlt: string;
  themeClass: string;
  badgeBg: string;
  badgeBorder: string;
  badgeTextColor: string;
  accentColor: string;
  secondaryAccent: string;
  scoreBannerBg: string;
  stars: number;
  confettiColors: string[];
  replayButtonText: string;
}

export function getPerformanceTier(
  xpPoints: number,
  firstTryCount: number,
  elapsedTime: number
): PerformanceTierConfig {
  // 1. Perfect run: 5/5 first-try combos (zero mistakes)
  if (firstTryCount >= 5 && xpPoints >= 3200) {
    return {
      tier: 'legendary',
      letterGrade: 'S+',
      title: '👑 LEGENDARY SUMMIT',
      badgeTag: 'RANK S+ • PERFECT RUN',
      heroHeadline: 'Legendary Summit!',
      subtitle: 'Flawless run! Every rune gate cracked on the 1st try!',
      quote: 'Flawless mastery! 5 out of 5 combos without a single slip. You are a true tower legend!',
      stickerSrc: '/stickers/victory.webp',
      stickerAlt: 'Sherbo Legendary Victory',
      themeClass: 'theme-legendary',
      badgeBg: '#fef3c7',
      badgeBorder: '#facc15',
      badgeTextColor: '#78350f',
      accentColor: '#7e22ce',
      secondaryAccent: '#eab308',
      scoreBannerBg: '#fdf4ff',
      stars: 3,
      confettiColors: ['#a855f7', '#fbbf24', '#f43f5e', '#38bdf8', '#ffffff'],
      replayButtonText: 'Climb Again',
    };
  }

  // 2. Good performance: 4+ combos or fast high-score run
  if (firstTryCount >= 4 || (xpPoints >= 2800 && elapsedTime <= 160)) {
    return {
      tier: 'gold',
      letterGrade: 'S',
      title: '🥇 GOLD SUMMIT',
      badgeTag: 'RANK S • GOLD ACHIEVEMENT',
      heroHeadline: 'Golden Victory!',
      subtitle: 'Blazing speed and sharp focus conquered the tower!',
      quote: "Brilliant climbing! Incredible speed and razor-sharp thinking. You're in the elite league!",
      stickerSrc: '/stickers/celebrate-confetti-dance.webp',
      stickerAlt: 'Sherbo Gold Celebration',
      themeClass: 'theme-gold',
      badgeBg: '#fff7ed',
      badgeBorder: '#f59e0b',
      badgeTextColor: '#b45309',
      accentColor: '#ea580c',
      secondaryAccent: '#f59e0b',
      scoreBannerBg: '#fffbeb',
      stars: 3,
      confettiColors: ['#fbbf24', '#f59e0b', '#d97706', '#fef08a'],
      replayButtonText: 'Climb Again',
    };
  }

  // 3. Average performance: 2-3 combos or solid score
  if (firstTryCount >= 2 || xpPoints >= 1900) {
    return {
      tier: 'silver',
      letterGrade: 'A',
      title: '🥈 SILVER SUMMIT',
      badgeTag: 'RANK A • SILVER ACHIEVEMENT',
      heroHeadline: 'Silver Milestone!',
      subtitle: 'Resilient climb! You tackled the gates and conquered the tower!',
      quote: 'Solid climbing! You pushed through tough challenges and reached the crown. Well done!',
      stickerSrc: '/stickers/celebrate-cheer.webp',
      stickerAlt: 'Sherbo Silver Cheer',
      themeClass: 'theme-silver',
      badgeBg: '#f0f9ff',
      badgeBorder: '#0284c7',
      badgeTextColor: '#0369a1',
      accentColor: '#0284c7',
      secondaryAccent: '#38bdf8',
      scoreBannerBg: '#f0f9ff',
      stars: 2,
      confettiColors: ['#38bdf8', '#94a3b8', '#e2e8f0', '#ffffff'],
      replayButtonText: 'Climb Again',
    };
  }

  // 4. Needs improvement: Comeback challenger
  return {
    tier: 'comeback',
    letterGrade: 'B',
    title: '🔥 COMEBACK CHALLENGER',
    badgeTag: 'RANK B • RISING STAR',
    heroHeadline: 'Summit Reached!',
    subtitle: 'You conquered all 30 steps! Ready to claim the crown?',
    quote: "Every master started with a climb! You never gave up and reached the top. One more run and you'll crush it!",
    stickerSrc: '/stickers/celebrate-happy.webp',
    stickerAlt: 'Sherbo Comeback Cheer',
    themeClass: 'theme-comeback',
    badgeBg: '#fff1f2',
    badgeBorder: '#e11d48',
    badgeTextColor: '#9f1239',
    accentColor: '#e11d48',
    secondaryAccent: '#f97316',
    scoreBannerBg: '#fff1f2',
    stars: 1,
    confettiColors: ['#f43f5e', '#fb7185', '#fda4af', '#fef3c7'],
    replayButtonText: 'Climb Again',
  };
}

export const CompletionScreen: React.FC<CompletionScreenProps> = ({
  completedCheckpointsCount,
  totalAttempts: _totalAttempts,
  firstTryCount,
  xpPoints,
  elapsedTime,
  speedBonus,
  onPlayAgain,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const tierConfig = useMemo(
    () => getPerformanceTier(xpPoints, firstTryCount, elapsedTime),
    [xpPoints, firstTryCount, elapsedTime]
  );
  const starCount = tierConfig.stars;

  const [bestScore, setBestScore] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('sherbo_tower_best_score');
      const parsed = saved ? parseInt(saved, 10) : 0;
      return Math.max(parsed, xpPoints);
    } catch {
      return xpPoints;
    }
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sherbo_tower_best_score');
      const prev = saved ? parseInt(saved, 10) : 0;
      if (xpPoints > prev) {
        localStorage.setItem('sherbo_tower_best_score', xpPoints.toString());
        setBestScore(xpPoints);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [xpPoints]);

  // Staged celebration choreography:
  // 0: Initial mount + Confetti explosion
  // 1: XP counter roll-up (0 -> xpPoints)
  // 2: Achievement badge stamp animation
  // 3: Performance statistics cascade in
  // 4: Action buttons revealed
  const [displayXp, setDisplayXp] = useState(0);
  const [animPhase, setAnimPhase] = useState<number>(0);
  const animTimeoutsRef = useRef<number[]>([]);
  const hasCelebratedRef = useRef(false);

  const skipAnimation = () => {
    setDisplayXp(xpPoints);
    setAnimPhase(4);
    animTimeoutsRef.current.forEach((t) => window.clearTimeout(t));
    animTimeoutsRef.current = [];
  };

  useEffect(() => {
    // Ensure the celebration sequence & confetti only run once on summit card mount
    if (hasCelebratedRef.current) return;
    hasCelebratedRef.current = true;

    // 3. Single celebratory confetti burst
    try {
      if (tierConfig.tier === 'legendary') {
        confetti({
          particleCount: 120,
          spread: 95,
          origin: { y: 0.52 },
          colors: tierConfig.confettiColors,
        });
        const t1 = window.setTimeout(() => {
          confetti({
            particleCount: 70,
            spread: 110,
            origin: { x: 0.22, y: 0.58 },
            colors: tierConfig.confettiColors,
          });
          confetti({
            particleCount: 70,
            spread: 110,
            origin: { x: 0.78, y: 0.58 },
            colors: tierConfig.confettiColors,
          });
        }, 300);
        animTimeoutsRef.current.push(t1);
      } else {
        confetti({
          particleCount:
            tierConfig.tier === 'gold'
              ? 100
              : tierConfig.tier === 'silver'
                ? 75
                : 55,
          spread: 75,
          origin: { y: 0.55 },
          colors: tierConfig.confettiColors,
        });
      }
    } catch {
      // Ignore confetti errors in headless test environments
    }

    // 4. Giant XP score counts upward once!
    const duration = 1200;
    const start = performance.now();
    let lastTick = 0;
    let rafId: number;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      // easeOutExpo
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.round(ease * xpPoints);
      setDisplayXp(current);

      if (now - lastTick > 65 && progress < 0.94) {
        lastTick = now;
        sfx.click();
      }

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setDisplayXp(xpPoints);
        setAnimPhase(1);

        // 5. Achievement badge appears with special animation & chime!
        const tBadge = window.setTimeout(() => {
          setAnimPhase(2);
          sfx.badgeStamp();
        }, 180);
        animTimeoutsRef.current.push(tBadge);

        // 6. Performance statistics reveal themselves in cascade!
        const tStats = window.setTimeout(() => {
          setAnimPhase(3);
        }, 600);
        animTimeoutsRef.current.push(tStats);

        // 7. Action buttons revealed!
        const tActions = window.setTimeout(() => {
          setAnimPhase(4);
        }, 980);
        animTimeoutsRef.current.push(tActions);
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      animTimeoutsRef.current.forEach((t) => window.clearTimeout(t));
      animTimeoutsRef.current = [];
      try {
        confetti.reset();
      } catch {
        // Ignore reset errors
      }
    };
  }, [xpPoints, tierConfig]);

  const handleSaveScore = async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const [frame, stickerImg] = await Promise.all([
        captureGameFrame(),
        loadImage(tierConfig.stickerSrc),
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
      const confettiPalette = tierConfig.confettiColors;
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
      ctx.strokeStyle = tierConfig.accentColor;
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
      ctx.strokeStyle = tierConfig.secondaryAccent;
      ctx.beginPath();
      ctx.roundRect(winX - 2, winY - 2, winW + 4, winH + 4, winR + 2);
      ctx.stroke();

      // Top floating badge pill on the Summit Window
      const topBadgeW = 380;
      const topBadgeH = 40;
      const topBadgeX = outW / 2 - topBadgeW / 2;
      const topBadgeY = winY + 16;

      ctx.fillStyle = 'rgba(27, 42, 83, 0.94)';
      ctx.beginPath();
      ctx.roundRect(topBadgeX, topBadgeY, topBadgeW, topBadgeH, 999);
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = tierConfig.secondaryAccent;
      ctx.stroke();

      ctx.fillStyle = tierConfig.secondaryAccent;
      ctx.font = '700 16px "Fredoka", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`★  ${tierConfig.title} • STEP ${towerConfig.totalSteps}  ★`, outW / 2, topBadgeY + 26);

      // 3. Bottom Showcase: Tactile 3D Arcade Score Card
      const cardX = 48;
      const cardY = 514;
      const cardW = outW - 96; // 984
      const cardH = 774;
      const cardR = 32;

      // Card 3D solid bottom lip + drop shadow
      ctx.fillStyle = 'rgba(5, 10, 22, 0.55)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY + 18, cardW, cardH, cardR);
      ctx.fill();

      ctx.fillStyle = '#1b2a53';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY + 10, cardW, cardH, cardR);
      ctx.fill();

      // Card body
      ctx.fillStyle = '#f8e7d6';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, cardR);
      ctx.fill();

      ctx.lineWidth = 4;
      ctx.strokeStyle = tierConfig.accentColor;
      ctx.stroke();

      // Inner subtle top highlight
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(cardX + 4, cardY + 4, cardW - 8, cardH - 8, cardR - 3);
      ctx.stroke();
      ctx.restore();

      // Header Row: Celebratory Sherbo Sticker + Stars & Rank Badge + Title + Speech Bubble Quote
      const textStartX = cardX + 288;
      const textMaxW = cardW - 324; // 660px

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

      // Top Row: 3 Stars on left
      const starSpacing = 28;
      for (let s = 0; s < 3; s++) {
        const sx = textStartX + s * starSpacing + 14;
        const sy = cardY + 38;
        const earned = s < starCount;
        drawStar(
          ctx,
          sx,
          sy,
          13,
          5.8,
          earned ? '#fbbf24' : '#e2d5c4',
          earned ? '#b45309' : '#94a3b8'
        );
      }

      // Title: Hero Headline
      ctx.fillStyle = '#1b2a53';
      ctx.font = '700 46px "Fredoka", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(tierConfig.heroHeadline, textStartX, cardY + 96);

      // Subtitle
      ctx.fillStyle = '#576582';
      ctx.font = '600 20px "Fredoka", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(tierConfig.subtitle, textStartX, cardY + 132);

      // 4. Hero Final Score Banner (White 3D Arcade Box with XP & Speed Breakdown)
      const bannerX = cardX + 36;
      const bannerY = cardY + 178;
      const bannerW = cardW - 72; // 912
      const bannerH = 166;
      const bannerR = 24;

      // 3D colored bottom lip
      ctx.fillStyle = tierConfig.accentColor;
      ctx.beginPath();
      ctx.roundRect(bannerX, bannerY + 7, bannerW, bannerH, bannerR);
      ctx.fill();

      // Banner body
      ctx.fillStyle = tierConfig.scoreBannerBg;
      ctx.beginPath();
      ctx.roundRect(bannerX, bannerY, bannerW, bannerH, bannerR);
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = tierConfig.accentColor;
      ctx.stroke();

      // Top label pill inside score banner
      ctx.fillStyle = tierConfig.accentColor;
      ctx.font = '700 18px "Fredoka", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('⚡ FINAL SCORE', bannerX + 32, bannerY + 38);

      // Stopwatch Clear Time pill on top-right of banner
      const timePillW = 180;
      const timePillH = 34;
      const timePillX = bannerX + bannerW - timePillW - 28;
      const timePillY = bannerY + 18;
      ctx.fillStyle = '#fff4ea';
      ctx.beginPath();
      ctx.roundRect(timePillX, timePillY, timePillW, timePillH, 999);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ee7b3c';
      ctx.stroke();

      ctx.fillStyle = '#ee7b3c';
      ctx.font = '700 18px "Fredoka", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`⏱️ ${formatStopwatchTime(elapsedTime)}`, timePillX + timePillW / 2, timePillY + 23);

      // Huge XP Score Value
      ctx.fillStyle = tierConfig.accentColor;
      ctx.font = '700 58px "Fredoka", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(
        `${xpPoints.toLocaleString()} XP`,
        bannerX + 32,
        bannerY + 102
      );

      // Breakdown note
      ctx.fillStyle = '#576582';
      ctx.font = '600 20px "Fredoka", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(
        `Includes +${speedBonus.toLocaleString()} XP Speed Bonus • ${firstTryCount} / ${towerConfig.numberOfCheckpoints} Combos`,
        bannerX + 32,
        bannerY + 140
      );

      // 5. Four Tactile 3D Arcade Power-Block Stat Tiles (2x2 Grid)
      const stats: Array<{
        type: 'best' | 'grade' | 'time' | 'combos';
        label: string;
        val: string;
        border: string;
        lip: string;
        badgeBg: string;
      }> = [
        {
          type: 'best',
          label: 'Best Score',
          val: `${bestScore.toLocaleString()} XP`,
          border: '#ee7b3c',
          lip: '#b85720',
          badgeBg: '#fff4ea',
        },
        {
          type: 'grade',
          label: 'Letter Grade',
          val: `${tierConfig.letterGrade}`,
          border: '#7e57d8',
          lip: '#5733a8',
          badgeBg: '#f3effd',
        },
        {
          type: 'time',
          label: 'Total Time',
          val: `${formatStopwatchTime(elapsedTime)}`,
          border: '#3f9f9b',
          lip: '#286d6a',
          badgeBg: '#e6f7f5',
        },
        {
          type: 'combos',
          label: '1st-Try Combos',
          val: `${firstTryCount} / ${towerConfig.numberOfCheckpoints}`,
          border: '#10b981',
          lip: '#047857',
          badgeBg: '#ecfdf5',
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
              text: `I scored ${xpPoints.toLocaleString()} XP in ${formatStopwatchTime(elapsedTime)} on Sherbo's Tower!`,
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
      className={`completion-side-wrapper ${tierConfig.themeClass}`}
      role="dialog"
      aria-modal="true"
      data-testid="completion-screen"
      onClick={skipAnimation}
    >
      <div
        className={`modal-card completion-side-card ${tierConfig.themeClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="completion-hero-banner">
          <div className="completion-sticker-wrap">
            <img
              src={tierConfig.stickerSrc}
              alt={tierConfig.stickerAlt}
              className="completion-hero-sticker"
              width={256}
              height={256}
            />
          </div>
          <div className="completion-hero-copy">
            <div className="completion-top-row">
              <div
                className="completion-stars-row"
                aria-label={`${starCount} out of 3 stars`}
              >
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
            </div>

            <h1 className="completion-title">{tierConfig.heroHeadline}</h1>
            <p className="completion-subtitle">{tierConfig.subtitle}</p>
          </div>
        </div>

        <div className="xp-reward-banner" data-testid="stat-total-xp">
          <div className="xp-banner-top">
            <div className="xp-banner-title-group">
              <Zap size={20} className="icon-amber" />
              <span className="xp-banner-title">Final Score</span>
            </div>
            <span className="xp-banner-pct-pill">
              ⏱️ {formatStopwatchTime(elapsedTime)}
            </span>
          </div>
          <div className={`xp-banner-score ${animPhase < 2 ? 'counter-active' : ''}`}>
            {displayXp.toLocaleString()} XP
          </div>
          <div className="xp-banner-subtext">
            Includes +{speedBonus.toLocaleString()} XP Speed Bonus • {firstTryCount} / {towerConfig.numberOfCheckpoints} Combos
          </div>
        </div>

        <div className="stats-summary-grid">
          <div
            className="stat-box stat-box-teal"
            data-testid="stat-best-score"
          >
            <Trophy size={18} className="icon-gold" />
            <div className="stat-box-val">
              {bestScore.toLocaleString()} XP
            </div>
            <div className="stat-box-label">Best Score</div>
          </div>

          <div
            className="stat-box stat-box-emerald"
            data-testid="stat-letter-grade"
          >
            <Award size={18} className="icon-purple" />
            <div className="stat-box-val stat-box-grade">
              {tierConfig.letterGrade}
            </div>
            <div className="stat-box-label">Letter Grade</div>
          </div>

          <div
            className="stat-box stat-box-orange"
            data-testid="stat-clear-time"
          >
            <Timer size={18} className="icon-cyan" />
            <div className="stat-box-val">{formatStopwatchTime(elapsedTime)}</div>
            <div className="stat-box-label">Total Time</div>
          </div>

          <div
            className="stat-box stat-box-violet"
            data-testid="stat-first-try"
          >
            <Zap size={18} className="icon-amber" />
            <div className="stat-box-val">
              {firstTryCount} / {towerConfig.numberOfCheckpoints}
            </div>
            <div className="stat-box-label">1st Try Combos</div>
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
