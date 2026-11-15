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
  Flame,
  Shield,
  Layers,
} from 'lucide-react';
import { towerConfig, formatStopwatchTime } from '../data/towerConfig';
import { captureGameFrame, getSummitViewRatios } from '../game/TowerGame';
import { sfx } from '../game/sfx';
import {
  ScoringState,
  getPerformanceGrade,
  ACHIEVEMENTS,
  AchievementId,
  sumQuestionXp,
} from '../game/scoring';
import { GifEncoder } from '../game/gifEncoder';

export interface CompletionScreenProps {
  completedCheckpointsCount: number;
  totalAttempts: number;
  firstTryCount: number;
  xpPoints: number;
  elapsedTime: number;
  speedBonus: number;
  scoringState?: ScoringState;
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
  letterGrade: 'S+' | 'S' | 'A' | 'B' | 'C' | 'D';
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
  _firstTryCount: number = 0,
  _elapsedTime: number = 0
): PerformanceTierConfig {
  const gradeInfo = getPerformanceGrade(xpPoints);

  // S+: 3500+ XP — Tower Legend
  if (gradeInfo.grade === 'S+') {
    return {
      tier: 'legendary',
      letterGrade: 'S+',
      title: '👑 TOWER LEGEND',
      badgeTag: 'RANK S+ • TOWER LEGEND',
      heroHeadline: 'Tower Legend!',
      subtitle: 'Flawless mastery! You conquered the tower with peak perfection!',
      quote: 'Flawless mastery! Every rune gate cracked with supreme focus. You are a true tower legend!',
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

  // S: 3200–3499 XP — Master Climber
  if (gradeInfo.grade === 'S') {
    return {
      tier: 'gold',
      letterGrade: 'S',
      title: '🥇 MASTER CLIMBER',
      badgeTag: 'RANK S • MASTER CLIMBER',
      heroHeadline: 'Master Climber!',
      subtitle: 'Outstanding performance! Blazing speed and sharp focus conquered the tower!',
      quote: "Brilliant climbing! Razor-sharp thinking and incredible precision. You're in the elite league!",
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

  // A: 2800–3199 XP — Elite Explorer
  if (gradeInfo.grade === 'A') {
    return {
      tier: 'gold',
      letterGrade: 'A',
      title: '🌟 ELITE EXPLORER',
      badgeTag: 'RANK A • ELITE EXPLORER',
      heroHeadline: 'Elite Explorer!',
      subtitle: 'Remarkable skill! You navigated the gates and dominated the climb!',
      quote: 'Solid climbing! You pushed through tough challenges and reached the crown. Well done!',
      stickerSrc: '/stickers/celebrate-cheer.webp',
      stickerAlt: 'Sherbo Elite Explorer',
      themeClass: 'theme-gold',
      badgeBg: '#f0fdf4',
      badgeBorder: '#22c55e',
      badgeTextColor: '#15803d',
      accentColor: '#16a34a',
      secondaryAccent: '#4ade80',
      scoreBannerBg: '#f0fdf4',
      stars: 3,
      confettiColors: ['#22c55e', '#4ade80', '#fbbf24', '#ffffff'],
      replayButtonText: 'Climb Again',
    };
  }

  // B: 2300–2799 XP — Skilled Adventurer
  if (gradeInfo.grade === 'B') {
    return {
      tier: 'silver',
      letterGrade: 'B',
      title: '🥈 SKILLED ADVENTURER',
      badgeTag: 'RANK B • SKILLED ADVENTURER',
      heroHeadline: 'Skilled Adventurer!',
      subtitle: 'Resilient climb! You conquered the challenges and scaled the tower!',
      quote: 'Great spirit and perseverance! You overcame the hurdles and conquered the summit!',
      stickerSrc: '/stickers/celebrate-clap.webp',
      stickerAlt: 'Sherbo Skilled Adventurer',
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

  // C: 1700–2299 XP — Rising Climber
  if (gradeInfo.grade === 'C') {
    return {
      tier: 'silver',
      letterGrade: 'C',
      title: '🥉 RISING CLIMBER',
      badgeTag: 'RANK C • RISING CLIMBER',
      heroHeadline: 'Rising Climber!',
      subtitle: 'Solid persistence! You solved the gates and touched the summit crown!',
      quote: 'Determined climbing! Each attempt brings you closer to tower mastery.',
      stickerSrc: '/stickers/celebrate-happy.webp',
      stickerAlt: 'Sherbo Rising Climber',
      themeClass: 'theme-silver',
      badgeBg: '#faf5ff',
      badgeBorder: '#9333ea',
      badgeTextColor: '#6b21a8',
      accentColor: '#9333ea',
      secondaryAccent: '#c084fc',
      scoreBannerBg: '#faf5ff',
      stars: 2,
      confettiColors: ['#c084fc', '#9333ea', '#38bdf8', '#ffffff'],
      replayButtonText: 'Climb Again',
    };
  }

  // D: Below 1700 XP — Apprentice
  return {
    tier: 'comeback',
    letterGrade: 'D',
    title: '🧗 APPRENTICE',
    badgeTag: 'RANK D • APPRENTICE',
    heroHeadline: 'Apprentice Climber!',
    subtitle: 'Every master climber began with a climb! Ready to claim the crown?',
    quote: "Every master started with a climb! You never gave up and reached the top. One more run and you'll crush it!",
    stickerSrc: '/stickers/retry.webp',
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
  totalAttempts,
  firstTryCount,
  xpPoints,
  elapsedTime,
  speedBonus,
  scoringState,
  onPlayAgain,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingGif, setIsExportingGif] = useState(false);
  const tierConfig = useMemo(
    () => getPerformanceTier(xpPoints, firstTryCount, elapsedTime),
    [xpPoints, firstTryCount, elapsedTime]
  );
  const starCount = tierConfig.stars;

  // Extracted Centralized Scoring Components
  const questionXp = scoringState
    ? sumQuestionXp(scoringState.gateQuestionXp)
    : Math.max(0, xpPoints - speedBonus - 300);
  const streakXp = scoringState?.streakXp ?? 0;
  const summitXp = scoringState?.summitXp ?? (completedCheckpointsCount >= 5 ? 300 : 0);
  const speedXp = scoringState?.speedXp ?? speedBonus;
  const achievementXp = scoringState?.achievementXp ?? 0;
  const totalMistakes = scoringState?.totalMistakes ?? Math.max(0, totalAttempts - 5);
  const finalAttempts = scoringState?.totalAttempts ?? totalAttempts;
  const unlockedAchievements: AchievementId[] = scoringState?.unlockedAchievements ?? [];

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

  const downloadOrShareBlob = async (
    blob: Blob,
    fileName: string,
    title: string,
    text: string
  ) => {
    const isTouchDevice =
      !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (isTouchDevice && typeof navigator.share === 'function') {
      try {
        const file = new File([blob], fileName, { type: blob.type });
        if (!navigator.canShare || navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title,
            text,
          });
          return;
        }
      } catch (shareErr) {
        if ((shareErr as DOMException)?.name === 'AbortError') return;
      }
    }

    // Desktop or share unavailable: trigger clean browser file download
    const objectUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.download = fileName;
    downloadLink.href = objectUrl;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
  };

  const renderPhoneVictoryPoster = (
    ctx: CanvasRenderingContext2D,
    targetW: number,
    targetH: number,
    frame: HTMLCanvasElement | HTMLImageElement | null,
    stickerImg: HTMLImageElement | null,
    tier: PerformanceTierConfig,
    scoring: {
      xpPoints: number;
      questionXp: number;
      streakXp: number;
      summitXp: number;
      speedXp: number;
      achievementXp: number;
      bestScore: number;
      elapsedTime: number;
      finalAttempts: number;
      totalMistakes: number;
      unlockedAchievements: AchievementId[];
    },
    summitRatioY: number,
    playerRatioX: number,
    animPhase: number = 0
  ) => {
    // 9:16 True Phone Dimensions (1080 x 1920)
    const baseW = 1080;
    const baseH = 1920;
    const scale = targetW / baseW;

    ctx.save();
    ctx.scale(scale, scale);

    // 1. Rich deep-space arcade background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, baseH);
    bgGrad.addColorStop(0, '#182850');
    bgGrad.addColorStop(0.5, '#0f1a36');
    bgGrad.addColorStop(1, '#091022');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, baseW, baseH);

    // Warm radial spotlight behind the summit & card
    const spotGrad = ctx.createRadialGradient(
      baseW / 2,
      720,
      60,
      baseW / 2,
      720,
      820
    );
    spotGrad.addColorStop(0, 'rgba(238, 123, 60, 0.28)');
    spotGrad.addColorStop(0.55, 'rgba(63, 159, 155, 0.12)');
    spotGrad.addColorStop(1, 'rgba(9, 16, 34, 0)');
    ctx.fillStyle = spotGrad;
    ctx.fillRect(0, 0, baseW, baseH);

    // Celebratory background confetti & starlight dots (animated with animPhase)
    const confettiPalette = tier.confettiColors;
    for (let i = 0; i < 46; i++) {
      const seed = (i * 9301 + 49297) % 233280;
      const rx = ((seed / 233280) * 1000) + 40;
      const baseRy = (((seed * 7) % 233280) / 233280) * 1840 + 40;
      const ry = (baseRy + animPhase * 1920) % 1920;
      const rot = (i * 0.45 + animPhase * Math.PI * 2) % Math.PI;
      const col = confettiPalette[i % confettiPalette.length];

      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(rot);
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.28 + (i % 3) * 0.15;
      if (i % 3 === 0) {
        ctx.beginPath();
        ctx.arc(0, 0, 5 + (i % 4), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-8, -4, 16, 8);
      }
      ctx.restore();
    }

    // Outer decorative arcade frame
    ctx.save();
    ctx.strokeStyle = tier.accentColor;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(22, 22, baseW - 44, baseH - 44, 40);
    ctx.stroke();
    ctx.restore();

    // 2. Top Showcase: Framed Live Summit Scene Window
    const winX = 48;
    const winY = 52;
    const winW = baseW - 96; // 984
    const winH = 460;
    const winR = 26;

    // Window 3D shadow
    ctx.fillStyle = '#070c1a';
    ctx.beginPath();
    ctx.roundRect(winX, winY + 10, winW, winH, winR);
    ctx.fill();

    // Clip and draw the live summit scene centered on Finish Line & Character
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(winX, winY, winW, winH, winR);
    ctx.clip();

    if (frame) {
      const fw =
        'naturalWidth' in frame && frame.naturalWidth
          ? frame.naturalWidth
          : frame.width;
      const fh =
        'naturalHeight' in frame && frame.naturalHeight
          ? frame.naturalHeight
          : frame.height;
      const targetAspect = winW / winH; // ~2.14

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

    // Subtle top & bottom gradient vignette inside game window
    const winGrad = ctx.createLinearGradient(0, winY, 0, winY + winH);
    winGrad.addColorStop(0, 'rgba(13, 23, 48, 0.42)');
    winGrad.addColorStop(0.2, 'rgba(13, 23, 48, 0)');
    winGrad.addColorStop(0.8, 'rgba(13, 23, 48, 0)');
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
    ctx.strokeStyle = tier.secondaryAccent;
    ctx.beginPath();
    ctx.roundRect(winX - 2, winY - 2, winW + 4, winH + 4, winR + 2);
    ctx.stroke();

    // Top floating badge pill on the Summit Window
    const topBadgeW = 400;
    const topBadgeH = 38;
    const topBadgeX = baseW / 2 - topBadgeW / 2;
    const topBadgeY = winY + 16;

    ctx.fillStyle = 'rgba(27, 42, 83, 0.94)';
    ctx.beginPath();
    ctx.roundRect(topBadgeX, topBadgeY, topBadgeW, topBadgeH, 999);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = tier.secondaryAccent;
    ctx.stroke();

    ctx.fillStyle = tier.secondaryAccent;
    ctx.font = '700 16px "Fredoka", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`★  ${tier.title} • STEP ${towerConfig.totalSteps}  ★`, baseW / 2, topBadgeY + 25);

    // 3. Bottom Victory Card (Phone size: 1332px tall, spacious and uncompressed)
    const cardX = 48;
    const cardY = 538;
    const cardW = baseW - 96; // 984
    const cardH = 1332;
    const cardR = 32;

    // 3D lip & shadow
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
    ctx.strokeStyle = tier.accentColor;
    ctx.stroke();

    // Header Row: Sherbo Celebration Sticker + Stars + Badge Pill + Title + Subtitle
    const textStartX = cardX + 264;
    const stickerBob = animPhase > 0 ? Math.sin(animPhase * Math.PI * 2) * 6 : 0;

    if (stickerImg) {
      const haloX = cardX + 130;
      const haloY = cardY + 84 + stickerBob;
      const haloGrad = ctx.createRadialGradient(haloX, haloY, 12, haloX, haloY, 100);
      haloGrad.addColorStop(0, 'rgba(238, 123, 60, 0.35)');
      haloGrad.addColorStop(1, 'rgba(238, 123, 60, 0)');
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(haloX, haloY, 100, 0, Math.PI * 2);
      ctx.fill();

      const stickerSize = 184;
      ctx.save();
      ctx.shadowColor = 'rgba(27, 42, 83, 0.28)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 8;
      ctx.drawImage(
        stickerImg,
        haloX - stickerSize / 2,
        cardY - 20 + stickerBob,
        stickerSize,
        stickerSize
      );
      ctx.restore();
    }

    // Top Stars
    const starSpacing = 28;
    for (let s = 0; s < 3; s++) {
      const sx = textStartX + s * starSpacing + 14;
      const sy = cardY + 32;
      const earned = s < tier.stars;
      const starR = earned && animPhase > 0 ? 13 + 2 * Math.sin((animPhase + s * 0.3) * Math.PI * 2) : 13;
      drawStar(
        ctx,
        sx,
        sy,
        starR,
        starR * 0.44,
        earned ? '#fbbf24' : '#e2d5c4',
        earned ? '#b45309' : '#94a3b8'
      );
    }

    // Badge Tag Pill
    const badgeW = 340;
    const badgeH = 32;
    const badgeX = textStartX;
    const badgeY = cardY + 54;
    ctx.fillStyle = tier.badgeBg;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 999);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = tier.badgeBorder;
    ctx.stroke();

    ctx.fillStyle = tier.badgeTextColor;
    ctx.font = '700 15px "Fredoka", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(tier.badgeTag, badgeX + badgeW / 2, badgeY + 21);

    // Title: Hero Headline
    ctx.fillStyle = '#1b2a53';
    ctx.font = '700 42px "Fredoka", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(tier.heroHeadline, textStartX, cardY + 124);

    // Subtitle
    ctx.fillStyle = '#576582';
    ctx.font = '600 19px "Fredoka", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(tier.subtitle, textStartX, cardY + 158);

    // 4. Hero Final Score Banner
    const bannerX = cardX + 32;
    const bannerY = cardY + 180;
    const bannerW = cardW - 64; // 920
    const bannerH = 156;
    const bannerR = 22;

    // 3D colored bottom lip
    ctx.fillStyle = tier.accentColor;
    ctx.beginPath();
    ctx.roundRect(bannerX, bannerY + 7, bannerW, bannerH, bannerR);
    ctx.fill();

    // Banner body
    ctx.fillStyle = tier.scoreBannerBg;
    ctx.beginPath();
    ctx.roundRect(bannerX, bannerY, bannerW, bannerH, bannerR);
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = tier.accentColor;
    ctx.stroke();

    // Title inside score banner
    ctx.fillStyle = tier.accentColor;
    ctx.font = '700 18px "Fredoka", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('⚡ FINAL SCORE', bannerX + 28, bannerY + 36);

    // Clear time pill
    const timePillW = 180;
    const timePillH = 34;
    const timePillX = bannerX + bannerW - timePillW - 24;
    const timePillY = bannerY + 16;
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
    ctx.fillText(`⏱️ ${formatStopwatchTime(scoring.elapsedTime)}`, timePillX + timePillW / 2, timePillY + 23);

    // Giant XP score
    ctx.fillStyle = tier.accentColor;
    ctx.font = '700 56px "Fredoka", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${scoring.xpPoints.toLocaleString()} XP`, bannerX + 28, bannerY + 98);

    // Formula summary
    ctx.fillStyle = '#576582';
    ctx.font = '600 18px "Fredoka", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      `Questions (${scoring.questionXp}) + Streak (${scoring.streakXp}) + Summit (${scoring.summitXp}) + Speed (${scoring.speedXp}) + Ach (${scoring.achievementXp})`,
      bannerX + 28,
      bannerY + 134
    );

    // 5. 5-Way Scoring Formula Breakdown Card
    const bdX = cardX + 32;
    const bdY = bannerY + bannerH + 18; // ~914
    const bdW = cardW - 64; // 920
    const bdH = 138;
    const bdR = 20;

    // 3D lip
    ctx.fillStyle = '#5733a8';
    ctx.beginPath();
    ctx.roundRect(bdX, bdY + 6, bdW, bdH, bdR);
    ctx.fill();

    // Body
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(bdX, bdY, bdW, bdH, bdR);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#7e57d8';
    ctx.stroke();

    // Header row
    ctx.fillStyle = '#5733a8';
    ctx.font = '700 17px "Fredoka", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('✨  XP FORMULA BREAKDOWN', bdX + 22, bdY + 30);

    ctx.fillStyle = '#1b2a53';
    ctx.font = '700 17px "Fredoka", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`Total: ${scoring.xpPoints.toLocaleString()} XP`, bdX + bdW - 22, bdY + 30);

    // 5 Columns
    const bdCols = [
      { label: 'Questions', val: `+${scoring.questionXp}`, max: '/ 2,500' },
      { label: 'Streak', val: `+${scoring.streakXp}`, max: '/ 400' },
      { label: 'Summit', val: `+${scoring.summitXp}`, max: '/ 300' },
      { label: 'Speed', val: `+${scoring.speedXp}`, max: '/ 600' },
      { label: 'Achievements', val: `+${scoring.achievementXp}`, max: '/ 275' },
    ];

    const colGap = 10;
    const colW = (bdW - 32 - colGap * 4) / 5;
    const colH = 76;
    const colY = bdY + 46;

    bdCols.forEach((col, idx) => {
      const cx = bdX + 16 + idx * (colW + colGap);
      ctx.fillStyle = '#fbf9ff';
      ctx.beginPath();
      ctx.roundRect(cx, colY, colW, colH, 12);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#e9dffb';
      ctx.stroke();

      ctx.fillStyle = '#6d5b97';
      ctx.font = '700 13px "Fredoka", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(col.label, cx + colW / 2, colY + 22);

      ctx.fillStyle = '#1b2a53';
      ctx.font = '700 20px "Fredoka", sans-serif';
      ctx.fillText(col.val, cx + colW / 2, colY + 47);

      ctx.fillStyle = '#8c7ba8';
      ctx.font = '600 12px "Fredoka", sans-serif';
      ctx.fillText(col.max, cx + colW / 2, colY + 66);
    });

    // 6. Performance Statistics Summary Grid (4 Tiles: 2x2)
    const statsStartY = bdY + bdH + 18;
    const statBoxGap = 18;
    const statBoxW = (cardW - 64 - statBoxGap) / 2;
    const statBoxH = 114;
    const statBoxR = 20;

    const statItems: Array<{
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
        val: `${scoring.bestScore.toLocaleString()} XP`,
        border: '#ee7b3c',
        lip: '#b85720',
        badgeBg: '#fff4ea',
      },
      {
        type: 'grade',
        label: 'Performance Grade',
        val: `${tier.letterGrade} • ${tier.title.replace(/[^a-zA-Z+ ]/g, '').trim()}`,
        border: '#7e57d8',
        lip: '#5733a8',
        badgeBg: '#f3effd',
      },
      {
        type: 'time',
        label: 'Total Time',
        val: `${formatStopwatchTime(scoring.elapsedTime)}`,
        border: '#3f9f9b',
        lip: '#286d6a',
        badgeBg: '#e6f7f5',
      },
      {
        type: 'combos',
        label: 'Attempts / Mistakes',
        val: `${scoring.finalAttempts} Att • ${scoring.totalMistakes} Err`,
        border: '#10b981',
        lip: '#047857',
        badgeBg: '#ecfdf5',
      },
    ];

    statItems.forEach((st, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const bx = cardX + 32 + col * (statBoxW + statBoxGap);
      const by = statsStartY + row * (statBoxH + 14);

      // 3D lip
      ctx.fillStyle = st.lip;
      ctx.beginPath();
      ctx.roundRect(bx, by + 6, statBoxW, statBoxH, statBoxR);
      ctx.fill();

      // Body
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(bx, by, statBoxW, statBoxH, statBoxR);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = st.border;
      ctx.stroke();

      // Icon badge
      const iconBoxSize = 64;
      const iconBoxX = bx + 18;
      const iconBoxY = by + (statBoxH - iconBoxSize) / 2;
      ctx.fillStyle = st.badgeBg;
      ctx.beginPath();
      ctx.roundRect(iconBoxX, iconBoxY, iconBoxSize, iconBoxSize, 16);
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

      // Text
      const textX = iconBoxX + iconBoxSize + 18;
      ctx.fillStyle = '#1b2a53';
      ctx.font = '700 28px "Fredoka", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(st.val, textX, by + 52);

      ctx.fillStyle = '#576582';
      ctx.font = '600 18px "Fredoka", sans-serif';
      ctx.fillText(st.label, textX, by + 86);
    });

    // 7. Special Achievements Deck
    const achDeckY = statsStartY + statBoxH * 2 + 14 + 18;
    const achDeckH = 134;
    const achDeckW = cardW - 64;
    const achDeckR = 20;

    // 3D lip
    ctx.fillStyle = '#286d6a';
    ctx.beginPath();
    ctx.roundRect(bdX, achDeckY + 6, achDeckW, achDeckH, achDeckR);
    ctx.fill();

    // Body
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(bdX, achDeckY, achDeckW, achDeckH, achDeckR);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#3f9f9b';
    ctx.stroke();

    // Header
    ctx.fillStyle = '#286d6a';
    ctx.font = '700 17px "Fredoka", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🏆  SPECIAL ACHIEVEMENTS', bdX + 22, achDeckY + 28);

    ctx.fillStyle = '#576582';
    ctx.font = '700 16px "Fredoka", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(
      `${scoring.unlockedAchievements.length} / 3 Unlocked (+${scoring.achievementXp} XP)`,
      bdX + achDeckW - 22,
      achDeckY + 28
    );

    // 3 Achievement Tiles
    const allAchList = Object.values(ACHIEVEMENTS);
    const achTileGap = 12;
    const achTileW = (achDeckW - 32 - achTileGap * 2) / 3;
    const achTileH = 74;
    const achTileY = achDeckY + 44;

    allAchList.forEach((ach, idx) => {
      const ax = bdX + 16 + idx * (achTileW + achTileGap);
      const isUnlocked = scoring.unlockedAchievements.includes(ach.id);

      ctx.fillStyle = isUnlocked ? '#ecfdf5' : '#f8fafc';
      ctx.beginPath();
      ctx.roundRect(ax, achTileY, achTileW, achTileH, 12);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = isUnlocked ? '#10b981' : '#cbd5e1';
      ctx.stroke();

      // Icon + Title
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ach.icon, ax + 28, achTileY + 45);

      ctx.fillStyle = isUnlocked ? '#064e3b' : '#64748b';
      ctx.font = '700 16px "Fredoka", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(ach.title, ax + 52, achTileY + 33);

      ctx.fillStyle = isUnlocked ? '#059669' : '#94a3b8';
      ctx.font = '700 15px "Fredoka", sans-serif';
      ctx.fillText(isUnlocked ? `Unlocked (+${ach.xp} XP)` : `Locked (+${ach.xp} XP)`, ax + 52, achTileY + 58);
    });

    // 8. Branded Arcade Footer
    const footerW = 560;
    const footerH = 46;
    const footerX = cardX + (cardW - footerW) / 2;
    const footerY = cardY + cardH - 64;

    ctx.fillStyle = '#1b2a53';
    ctx.beginPath();
    ctx.roundRect(footerX, footerY, footerW, footerH, 999);
    ctx.fill();

    ctx.fillStyle = '#f8e7d6';
    ctx.font = '700 18px "Fredoka", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("🏆  SHERBENI ACADEMY  •  SHERBO'S TOWER", baseW / 2, footerY + 29);

    ctx.restore();
  };

  const handleSaveScore = async () => {
    if (isExporting || isExportingGif) return;
    setIsExporting(true);

    try {
      const [frame, stickerImg] = await Promise.all([
        captureGameFrame(),
        loadImage(tierConfig.stickerSrc),
      ]);
      const { summitRatioY, playerRatioX } = getSummitViewRatios();

      // True 9:16 vertical phone poster (1080 x 1920)
      const outW = 1080;
      const outH = 1920;

      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = outW;
      exportCanvas.height = outH;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) return;

      const scoringData = {
        xpPoints,
        questionXp,
        streakXp,
        summitXp,
        speedXp,
        achievementXp,
        bestScore,
        elapsedTime,
        finalAttempts,
        totalMistakes,
        unlockedAchievements,
      };

      renderPhoneVictoryPoster(
        ctx,
        outW,
        outH,
        frame,
        stickerImg,
        tierConfig,
        scoringData,
        summitRatioY,
        playerRatioX,
        0
      );

      const fileName = `sherbos-tower-score-${xpPoints}xp.png`;
      const blob: Blob | null = await new Promise((resolve) =>
        exportCanvas.toBlob((b) => resolve(b), 'image/png')
      );
      if (!blob) return;

      await downloadOrShareBlob(
        blob,
        fileName,
        "Sherbo's Tower Score Card",
        `I conquered Sherbo's Tower with ${xpPoints.toLocaleString()} XP in ${formatStopwatchTime(elapsedTime)}!`
      );
    } catch (err) {
      console.error('Failed to export score card image:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveGif = async () => {
    if (isExporting || isExportingGif) return;
    setIsExportingGif(true);

    try {
      const [frame, stickerImg] = await Promise.all([
        captureGameFrame(),
        loadImage(tierConfig.stickerSrc),
      ]);
      const { summitRatioY, playerRatioX } = getSummitViewRatios();

      // 9:16 phone size GIF (540 x 960)
      const gifW = 540;
      const gifH = 960;
      const totalFrames = 8;
      const frameDelayMs = 120; // 8 * 120ms = ~0.96s loop

      const gifCanvas = document.createElement('canvas');
      gifCanvas.width = gifW;
      gifCanvas.height = gifH;
      const ctx = gifCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const encoder = new GifEncoder(gifW, gifH);

      const scoringData = {
        xpPoints,
        questionXp,
        streakXp,
        summitXp,
        speedXp,
        achievementXp,
        bestScore,
        elapsedTime,
        finalAttempts,
        totalMistakes,
        unlockedAchievements,
      };

      for (let i = 0; i < totalFrames; i++) {
        const animPhase = i / totalFrames;
        ctx.clearRect(0, 0, gifW, gifH);
        renderPhoneVictoryPoster(
          ctx,
          gifW,
          gifH,
          frame,
          stickerImg,
          tierConfig,
          scoringData,
          summitRatioY,
          playerRatioX,
          animPhase
        );
        const imgData = ctx.getImageData(0, 0, gifW, gifH);
        encoder.addFrame(imgData, frameDelayMs);
      }

      const gifBytes = encoder.render();
      const blob = new Blob([gifBytes], { type: 'image/gif' });
      const fileName = `sherbos-tower-score-${xpPoints}xp.gif`;

      await downloadOrShareBlob(
        blob,
        fileName,
        "Sherbo's Tower Animated Victory",
        `Check out my animated victory on Sherbo's Tower: ${xpPoints.toLocaleString()} XP!`
      );
    } catch (err) {
      console.error('Failed to export animated score GIF:', err);
    } finally {
      setIsExportingGif(false);
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
              <span
                className="completion-badge-tag"
                style={{
                  background: tierConfig.badgeBg,
                  borderColor: tierConfig.badgeBorder,
                  color: tierConfig.badgeTextColor,
                }}
              >
                {tierConfig.badgeTag}
              </span>
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
            Final XP = Questions ({questionXp}) + Streak ({streakXp}) + Summit ({summitXp}) + Speed ({speedXp}) + Achievements ({achievementXp})
          </div>
        </div>

        {/* 5-Way Scoring Formula Breakdown */}
        <div className="scoring-breakdown-card" data-testid="scoring-breakdown">
          <div className="scoring-breakdown-header">
            <span className="scoring-breakdown-title">
              <Sparkles size={16} /> XP Formula Breakdown
            </span>
            <span className="stat-label" style={{ color: '#5733a8' }}>
              Base: 3,800 + Bonus: 275
            </span>
          </div>

          <div className="scoring-breakdown-grid">
            <div className="scoring-breakdown-item" data-testid="breakdown-question-xp">
              <span className="breakdown-item-label">Questions</span>
              <span className="breakdown-item-val">+{questionXp}</span>
              <span className="breakdown-item-max">/ 2,500</span>
            </div>

            <div className="scoring-breakdown-item" data-testid="breakdown-streak-xp">
              <span className="breakdown-item-label">Streak</span>
              <span className="breakdown-item-val">+{streakXp}</span>
              <span className="breakdown-item-max">/ 400</span>
            </div>

            <div className="scoring-breakdown-item" data-testid="breakdown-summit-xp">
              <span className="breakdown-item-label">Summit</span>
              <span className="breakdown-item-val">+{summitXp}</span>
              <span className="breakdown-item-max">/ 300</span>
            </div>

            <div className="scoring-breakdown-item" data-testid="breakdown-speed-xp">
              <span className="breakdown-item-label">Speed</span>
              <span className="breakdown-item-val">+{speedXp}</span>
              <span className="breakdown-item-max">/ 600</span>
            </div>

            <div className="scoring-breakdown-item" data-testid="breakdown-achievement-xp">
              <span className="breakdown-item-label">Achievements</span>
              <span className="breakdown-item-val">+{achievementXp}</span>
              <span className="breakdown-item-max">/ 275</span>
            </div>
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
            <div className="stat-box-label">{tierConfig.title.replace(/[^a-zA-Z+ ]/g, '').trim()}</div>
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
            data-testid="stat-attempts-mistakes"
          >
            <Zap size={18} className="icon-amber" />
            <div className="stat-box-val">
              {finalAttempts} <span style={{ fontSize: '0.85rem', color: '#576582' }}>/</span> {totalMistakes}
            </div>
            <div className="stat-box-label">Attempts / Mistakes</div>
          </div>
        </div>

        {/* Special Achievements Deck */}
        <div className="achievements-section-card" data-testid="achievements-deck">
          <div className="achievements-section-header">
            <span className="achievements-section-title">
              <Award size={16} /> Special Achievements
            </span>
            <span className="stat-label" style={{ color: '#286d6a' }}>
              {unlockedAchievements.length} / 3 Unlocked (+{achievementXp} XP)
            </span>
          </div>

          <div className="achievements-deck-grid">
            {Object.values(ACHIEVEMENTS).map((ach) => {
              const isUnlocked = unlockedAchievements.includes(ach.id);
              return (
                <div
                  key={ach.id}
                  className={`achievement-tile ${isUnlocked ? 'unlocked' : 'locked'}`}
                  data-testid={`achievement-badge-${ach.id.toLowerCase()}`}
                  title={`${ach.title}: ${ach.description}`}
                >
                  <div className="achievement-tile-icon">{ach.icon}</div>
                  <div className="achievement-tile-name">{ach.title}</div>
                  <div className="achievement-tile-xp">
                    {isUnlocked ? `+${ach.xp} XP` : `${ach.xp} XP`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="completion-actions-row">
          <button
            type="button"
            className="primary-cta-btn save-score-btn"
            onClick={handleSaveScore}
            disabled={isExporting || isExportingGif}
            data-testid="save-score-btn"
          >
            <Download size={18} />
            <span>{isExporting ? 'Saving Phone Card...' : 'Save Phone Card (PNG)'}</span>
          </button>

          <button
            type="button"
            className="primary-cta-btn save-gif-btn"
            onClick={handleSaveGif}
            disabled={isExporting || isExportingGif}
            data-testid="save-gif-btn"
          >
            <Sparkles size={18} />
            <span>{isExportingGif ? 'Creating GIF...' : 'Save Animated (GIF)'}</span>
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
