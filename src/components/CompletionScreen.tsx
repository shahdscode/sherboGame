import React, { useEffect, useState, useRef, useMemo } from "react";
import confetti from "canvas-confetti";
import {
  Trophy,
  RotateCcw,
  Timer,
  Zap,
  Sparkles,
  Download,
  Award,
} from "lucide-react";
import { towerConfig, formatStopwatchTime } from "../data/towerConfig";
import { getPerformanceGrade, ScoringState } from "../game/scoring";
import { captureGameFrame, getSummitViewRatios } from "../game/TowerGame";
import { GifEncoder } from "../game/gifEncoder";
import { sfx } from "../game/sfx";

export interface CompletionScreenProps {
  scoringState?: ScoringState;
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
    img.crossOrigin = "anonymous";
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
  type: "best" | "grade" | "time" | "combos",
  cx: number,
  cy: number,
  color: string
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (type === "best") {
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
  } else if (type === "grade") {
    // Medal / Rosette with ribbon tails
    ctx.beginPath();
    ctx.arc(cx, cy - 3, 11, 0, Math.PI * 2);
    ctx.stroke();
    // Star inside medal
    drawStar(ctx, cx, cy - 3, 6, 2.8, color);
    // Ribbon tails
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy + 7);
    ctx.lineTo(cx - 8, cy + 16);
    ctx.lineTo(cx - 3, cy + 13);
    ctx.lineTo(cx - 1, cy + 16);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 5, cy + 7);
    ctx.lineTo(cx + 8, cy + 16);
    ctx.lineTo(cx + 3, cy + 13);
    ctx.lineTo(cx + 1, cy + 16);
    ctx.stroke();
  } else if (type === "time") {
    // Stopwatch icon
    ctx.beginPath();
    ctx.arc(cx, cy + 2, 11, 0, Math.PI * 2);
    ctx.stroke();
    // Top stem + crown button
    ctx.beginPath();
    ctx.moveTo(cx, cy - 9);
    ctx.lineTo(cx, cy - 13);
    ctx.moveTo(cx - 4, cy - 13);
    ctx.lineTo(cx + 4, cy - 13);
    ctx.stroke();
    // Clock hands pointing to ~1:25
    ctx.beginPath();
    ctx.moveTo(cx, cy + 2);
    ctx.lineTo(cx, cy - 4);
    ctx.moveTo(cx, cy + 2);
    ctx.lineTo(cx + 5, cy + 2);
    ctx.stroke();
    // Little tick marks at 12, 3, 6, 9
    ctx.beginPath();
    ctx.arc(cx, cy + 2, 1.8, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === "combos") {
    // Lightning bolt for combos
    ctx.beginPath();
    ctx.moveTo(cx + 2, cy - 15);
    ctx.lineTo(cx - 6, cy - 1);
    ctx.lineTo(cx + 1, cy - 1);
    ctx.lineTo(cx - 2, cy + 15);
    ctx.lineTo(cx + 7, cy + 1);
    ctx.lineTo(cx, cy + 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

export type PerformanceTier = "legendary" | "gold" | "silver" | "comeback";

export interface PerformanceTierConfig {
  tier: PerformanceTier;
  letterGrade: "S+" | "S" | "A" | "B" | "C" | "D";
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

  if (gradeInfo.grade === "S+") {
    return {
      tier: "legendary",
      letterGrade: "S+",
      title: "👑 TOWER LEGEND",
      badgeTag: "RANK S+ • TOWER LEGEND",
      heroHeadline: "Legendary Summit!",
      subtitle: "Flawless mastery! You conquered the tower with peak perfection!",
      quote: "Flawless mastery! Every rune gate cracked with supreme focus. You are a true tower legend!",
      stickerSrc: "/stickers/victory.webp",
      stickerAlt: "Sherbo Legendary Victory",
      themeClass: "theme-legendary",
      badgeBg: "#fef3c7",
      badgeBorder: "#facc15",
      badgeTextColor: "#78350f",
      accentColor: "#7e22ce",
      secondaryAccent: "#eab308",
      scoreBannerBg: "#fdf4ff",
      stars: 3,
      confettiColors: ["#a855f7", "#fbbf24", "#f43f5e", "#38bdf8", "#ffffff"],
      replayButtonText: "Climb Again",
    };
  }

  if (gradeInfo.grade === "S") {
    return {
      tier: "gold",
      letterGrade: "S",
      title: "🥇 MASTER CLIMBER",
      badgeTag: "RANK S • MASTER CLIMBER",
      heroHeadline: "Master Climber!",
      subtitle: "Outstanding performance! Blazing speed and sharp focus conquered the tower!",
      quote: "Brilliant climbing! Razor-sharp thinking and incredible precision. You're in the elite league!",
      stickerSrc: "/stickers/celebrate-confetti-dance.webp",
      stickerAlt: "Sherbo Gold Celebration",
      themeClass: "theme-gold",
      badgeBg: "#fff7ed",
      badgeBorder: "#f59e0b",
      badgeTextColor: "#b45309",
      accentColor: "#ea580c",
      secondaryAccent: "#f59e0b",
      scoreBannerBg: "#fffbeb",
      stars: 3,
      confettiColors: ["#fbbf24", "#f59e0b", "#d97706", "#fef08a"],
      replayButtonText: "Climb Again",
    };
  }

  if (gradeInfo.grade === "A") {
    return {
      tier: "gold",
      letterGrade: "A",
      title: "🌟 ELITE EXPLORER",
      badgeTag: "RANK A • ELITE EXPLORER",
      heroHeadline: "Elite Explorer!",
      subtitle: "Remarkable skill! You navigated the gates and dominated the climb!",
      quote: "Solid climbing! You pushed through tough challenges and reached the crown. Well done!",
      stickerSrc: "/stickers/celebrate-cheer.webp",
      stickerAlt: "Sherbo Silver Cheer",
      themeClass: "theme-gold",
      badgeBg: "#fff7ed",
      badgeBorder: "#f59e0b",
      badgeTextColor: "#b45309",
      accentColor: "#ea580c",
      secondaryAccent: "#f59e0b",
      scoreBannerBg: "#fffbeb",
      stars: 3,
      confettiColors: ["#fbbf24", "#f59e0b", "#d97706", "#fef08a"],
      replayButtonText: "Climb Again",
    };
  }

  if (gradeInfo.grade === "B") {
    return {
      tier: "silver",
      letterGrade: "B",
      title: "🥈 SKILLED ADVENTURER",
      badgeTag: "RANK B • SKILLED ADVENTURER",
      heroHeadline: "Silver Milestone!",
      subtitle: "Resilient climb! You tackled the gates and conquered the tower!",
      quote: "Solid climbing! You pushed through tough challenges and reached the crown. Well done!",
      stickerSrc: "/stickers/celebrate-cheer.webp",
      stickerAlt: "Sherbo Silver Cheer",
      themeClass: "theme-silver",
      badgeBg: "#f0f9ff",
      badgeBorder: "#0284c7",
      badgeTextColor: "#0369a1",
      accentColor: "#0284c7",
      secondaryAccent: "#38bdf8",
      scoreBannerBg: "#f0f9ff",
      stars: 2,
      confettiColors: ["#38bdf8", "#94a3b8", "#e2e8f0", "#ffffff"],
      replayButtonText: "Climb Again",
    };
  }

  if (gradeInfo.grade === "C") {
    return {
      tier: "comeback",
      letterGrade: "C",
      title: "🧗 RISING CLIMBER",
      badgeTag: "RANK C • RISING CLIMBER",
      heroHeadline: "Rising Climber!",
      subtitle: "You conquered the tower steps! Ready to reach the top ranks?",
      quote: "Great effort! You kept going and reached the summit. Keep practicing to reach higher ranks!",
      stickerSrc: "/stickers/celebrate-happy.webp",
      stickerAlt: "Sherbo Comeback Cheer",
      themeClass: "theme-comeback",
      badgeBg: "#fff1f2",
      badgeBorder: "#e11d48",
      badgeTextColor: "#9f1239",
      accentColor: "#e11d48",
      secondaryAccent: "#fb7185",
      scoreBannerBg: "#fff1f2",
      stars: 1,
      confettiColors: ["#f43f5e", "#fb7185", "#fda4af", "#ffffff"],
      replayButtonText: "Climb Again",
    };
  }

  // D
  return {
    tier: "comeback",
    letterGrade: "D",
    title: "🔥 APPRENTICE CLIMBER",
    badgeTag: "RANK D • APPRENTICE",
    heroHeadline: "Summit Reached!",
    subtitle: "You made it to the top! Every master started with a climb!",
    quote: "Every master started with a climb! You never gave up and reached the top. One more run and you'll crush it!",
    stickerSrc: "/stickers/celebrate-happy.webp",
    stickerAlt: "Sherbo Comeback Cheer",
    themeClass: "theme-comeback",
    badgeBg: "#fff1f2",
    badgeBorder: "#e11d48",
    badgeTextColor: "#9f1239",
    accentColor: "#e11d48",
    secondaryAccent: "#fb7185",
    scoreBannerBg: "#fff1f2",
    stars: 1,
    confettiColors: ["#f43f5e", "#fb7185", "#fda4af", "#ffffff"],
    replayButtonText: "Climb Again",
  };
}

/**
 * Draws the 9:16 mobile frame score card onto a canvas context.
 * Standard base resolution is 1080 x 1920, scaled smoothly if canvas width differs.
 */
function drawMobileScoreCard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: HTMLImageElement | null,
  stickerImg: HTMLImageElement | null,
  summitRatioY: number,
  playerRatioX: number,
  tierConfig: PerformanceTierConfig,
  xpPoints: number,
  elapsedTime: number,
  speedBonus: number,
  firstTryCount: number,
  bestScore: number,
  starCount: number
) {
  const baseW = 1080;
  const baseH = 1920;
  const scale = width / baseW;

  ctx.save();
  ctx.scale(scale, scale);

  // 1. Rich deep-space arcade background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, baseH);
  bgGrad.addColorStop(0, "#182850");
  bgGrad.addColorStop(0.5, "#0f1a36");
  bgGrad.addColorStop(1, "#091022");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, baseW, baseH);

  // Warm radial spotlight behind the summit & card
  const spotGrad = ctx.createRadialGradient(
    baseW / 2,
    720,
    80,
    baseW / 2,
    720,
    820
  );
  spotGrad.addColorStop(0, "rgba(238, 123, 60, 0.28)");
  spotGrad.addColorStop(0.55, "rgba(63, 159, 155, 0.12)");
  spotGrad.addColorStop(1, "rgba(9, 16, 34, 0)");
  ctx.fillStyle = spotGrad;
  ctx.fillRect(0, 0, baseW, baseH);

  // Celebratory background confetti & starlight dots
  const confettiPalette = tierConfig.confettiColors;
  for (let i = 0; i < 48; i++) {
    const seed = (i * 9301 + 49297) % 233280;
    const rx = ((seed / 233280) * 1020) + 30;
    const ry = (((seed * 7) % 233280) / 233280) * 1860 + 30;
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
  ctx.roundRect(22, 22, baseW - 44, baseH - 44, 38);
  ctx.stroke();
  ctx.restore();

  // 2. Top Showcase: Framed Live Summit Scene Window (Taller & Zoomed In!)
  const winX = 48;
  const winY = 46;
  const winW = baseW - 96; // 984
  const winH = 910;
  const winR = 28;

  // Window 3D shadow
  ctx.fillStyle = "#070c1a";
  ctx.beginPath();
  ctx.roundRect(winX, winY + 12, winW, winH, winR);
  ctx.fill();

  // Clip and draw the live summit scene centered and zoomed in on character & summit
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(winX, winY, winW, winH, winR);
  ctx.clip();

  if (frame) {
    const fw = frame.naturalWidth || frame.width;
    const fh = frame.naturalHeight || frame.height;
    const targetAspect = winW / winH; // 984 / 910 ≈ 1.08

    // Zoom factor: 2.15x for a prominent, cinematic view of the character & summit
    const zoom = 2.15;
    let srcW = fw / zoom;
    let srcH = srcW / targetAspect;
    if (srcH > fh) {
      srcH = fh;
      srcW = fh * targetAspect;
    }

    const finishLinePxY = summitRatioY * fh;
    const desiredFinishRatioInWin = 0.68;
    const rawSrcY = finishLinePxY - srcH * desiredFinishRatioInWin;
    const srcY = Math.max(0, Math.min(fh - srcH, rawSrcY));

    const playerPxX = playerRatioX * fw;
    const rawSrcX = playerPxX - srcW * 0.46;
    const srcX = Math.max(0, Math.min(fw - srcW, rawSrcX));

    ctx.drawImage(frame, srcX, srcY, srcW, srcH, winX, winY, winW, winH);
  } else {
    ctx.fillStyle = "#0e172f";
    ctx.fillRect(winX, winY, winW, winH);
  }

  // Subtle top & bottom gradient vignette inside the game window for depth
  const winGrad = ctx.createLinearGradient(0, winY, 0, winY + winH);
  winGrad.addColorStop(0, "rgba(13, 23, 48, 0.40)");
  winGrad.addColorStop(0.18, "rgba(13, 23, 48, 0)");
  winGrad.addColorStop(0.82, "rgba(13, 23, 48, 0)");
  winGrad.addColorStop(1, "rgba(13, 23, 48, 0.55)");
  ctx.fillStyle = winGrad;
  ctx.fillRect(winX, winY, winW, winH);
  ctx.restore();

  // Window double arcade border
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#1b2a53";
  ctx.beginPath();
  ctx.roundRect(winX, winY, winW, winH, winR);
  ctx.stroke();

  ctx.lineWidth = 2.5;
  ctx.strokeStyle = tierConfig.secondaryAccent;
  ctx.beginPath();
  ctx.roundRect(winX - 2, winY - 2, winW + 4, winH + 4, winR + 2);
  ctx.stroke();

  // Top floating badge pill on the Summit Window
  const topBadgeW = 390;
  const topBadgeH = 42;
  const topBadgeX = baseW / 2 - topBadgeW / 2;
  const topBadgeY = winY + 16;

  ctx.fillStyle = "rgba(27, 42, 83, 0.94)";
  ctx.beginPath();
  ctx.roundRect(topBadgeX, topBadgeY, topBadgeW, topBadgeH, 999);
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = tierConfig.secondaryAccent;
  ctx.stroke();

  ctx.fillStyle = tierConfig.secondaryAccent;
  ctx.font = "700 16px 'Fredoka', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`★  ${tierConfig.title} • STEP ${towerConfig.totalSteps}  ★`, baseW / 2, topBadgeY + 27);

  // 3. Bottom Showcase: Tactile 3D Arcade Score Card
  const cardX = 48;
  const cardY = 982;
  const cardW = baseW - 96; // 984
  const cardH = 890;
  const cardR = 32;

  // Card 3D solid bottom lip + drop shadow
  ctx.fillStyle = "rgba(5, 10, 22, 0.55)";
  ctx.beginPath();
  ctx.roundRect(cardX, cardY + 18, cardW, cardH, cardR);
  ctx.fill();

  ctx.fillStyle = "#1b2a53";
  ctx.beginPath();
  ctx.roundRect(cardX, cardY + 10, cardW, cardH, cardR);
  ctx.fill();

  // Card body
  ctx.fillStyle = "#f8e7d6";
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, cardR);
  ctx.fill();

  ctx.lineWidth = 4;
  ctx.strokeStyle = tierConfig.accentColor;
  ctx.stroke();

  // Inner subtle top highlight
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(cardX + 4, cardY + 4, cardW - 8, cardH - 8, cardR - 3);
  ctx.stroke();
  ctx.restore();

  // Header Row: Celebratory Sherbo Sticker + Stars + Title + Subtitle
  const textStartX = cardX + 288;

  if (stickerImg) {
    const haloX = cardX + 152;
    const haloY = cardY + 86;
    const haloGrad = ctx.createRadialGradient(haloX, haloY, 12, haloX, haloY, 105);
    haloGrad.addColorStop(0, "rgba(238, 123, 60, 0.32)");
    haloGrad.addColorStop(1, "rgba(238, 123, 60, 0)");
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(haloX, haloY, 105, 0, Math.PI * 2);
    ctx.fill();

    const stickerSize = 196;
    ctx.save();
    ctx.shadowColor = "rgba(27, 42, 83, 0.28)";
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
      earned ? "#fbbf24" : "#e2d5c4",
      earned ? "#b45309" : "#94a3b8"
    );
  }

  // Title: Hero Headline
  ctx.fillStyle = "#1b2a53";
  ctx.font = "700 46px 'Fredoka', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(tierConfig.heroHeadline, textStartX, cardY + 98);

  // Subtitle
  ctx.fillStyle = "#576582";
  ctx.font = "600 20px 'Fredoka', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(tierConfig.subtitle, textStartX, cardY + 134);

  // 4. Hero Final Score Banner
  const bannerX = cardX + 36;
  const bannerY = cardY + 176;
  const bannerW = cardW - 72; // 912
  const bannerH = 176;
  const bannerR = 24;

  ctx.fillStyle = tierConfig.accentColor;
  ctx.beginPath();
  ctx.roundRect(bannerX, bannerY + 7, bannerW, bannerH, bannerR);
  ctx.fill();

  ctx.fillStyle = tierConfig.scoreBannerBg;
  ctx.beginPath();
  ctx.roundRect(bannerX, bannerY, bannerW, bannerH, bannerR);
  ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = tierConfig.accentColor;
  ctx.stroke();

  ctx.fillStyle = tierConfig.accentColor;
  ctx.font = "700 18px 'Fredoka', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("⚡ FINAL SCORE", bannerX + 32, bannerY + 38);

  const timePillW = 180;
  const timePillH = 34;
  const timePillX = bannerX + bannerW - timePillW - 28;
  const timePillY = bannerY + 18;
  ctx.fillStyle = "#fff4ea";
  ctx.beginPath();
  ctx.roundRect(timePillX, timePillY, timePillW, timePillH, 999);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#ee7b3c";
  ctx.stroke();

  ctx.fillStyle = "#ee7b3c";
  ctx.font = "700 18px 'Fredoka', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`⏱️ ${formatStopwatchTime(elapsedTime)}`, timePillX + timePillW / 2, timePillY + 23);

  ctx.fillStyle = tierConfig.accentColor;
  ctx.font = "700 60px 'Fredoka', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(
    `${xpPoints.toLocaleString()} XP`,
    bannerX + 32,
    bannerY + 104
  );

  ctx.fillStyle = "#576582";
  ctx.font = "600 20px 'Fredoka', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(
    `Includes +${speedBonus.toLocaleString()} XP Speed Bonus • ${firstTryCount} / ${towerConfig.numberOfCheckpoints} Combos`,
    bannerX + 32,
    bannerY + 146
  );

  // 5. Four Tactile 3D Arcade Power-Block Stat Tiles (2x2 Grid)
  const stats: Array<{
    type: "best" | "grade" | "time" | "combos";
    label: string;
    val: string;
    border: string;
    lip: string;
    badgeBg: string;
  }> = [
    {
      type: "best",
      label: "Best Score",
      val: `${bestScore.toLocaleString()} XP`,
      border: "#ee7b3c",
      lip: "#b85720",
      badgeBg: "#fff4ea",
    },
    {
      type: "grade",
      label: "Letter Grade",
      val: `${tierConfig.letterGrade}`,
      border: "#7e57d8",
      lip: "#5733a8",
      badgeBg: "#f3effd",
    },
    {
      type: "time",
      label: "Total Time",
      val: `${formatStopwatchTime(elapsedTime)}`,
      border: "#3f9f9b",
      lip: "#286d6a",
      badgeBg: "#e6f7f5",
    },
    {
      type: "combos",
      label: "1st-Try Combos",
      val: `${firstTryCount} / ${towerConfig.numberOfCheckpoints}`,
      border: "#10b981",
      lip: "#047857",
      badgeBg: "#ecfdf5",
    },
  ];

  const gridStartX = cardX + 36;
  const gridStartY = cardY + 380;
  const gapX = 24;
  const gapY = 22;
  const boxW = (cardW - 72 - gapX) / 2; // 444
  const boxH = 168;
  const boxR = 24;

  stats.forEach((st, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const bx = gridStartX + col * (boxW + gapX);
    const by = gridStartY + row * (boxH + gapY);

    ctx.fillStyle = st.lip;
    ctx.beginPath();
    ctx.roundRect(bx, by + 7, boxW, boxH, boxR);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(bx, by, boxW, boxH, boxR);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = st.border;
    ctx.stroke();

    const iconBoxSize = 88;
    const iconBoxX = bx + 22;
    const iconBoxY = by + (boxH - iconBoxSize) / 2;
    ctx.fillStyle = st.badgeBg;
    ctx.beginPath();
    ctx.roundRect(iconBoxX, iconBoxY, iconBoxSize, iconBoxSize, 20);
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

    const textX = iconBoxX + iconBoxSize + 22;
    ctx.fillStyle = "#1b2a53";
    ctx.font = "700 40px 'Fredoka', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(st.val, textX, by + 72);

    ctx.fillStyle = "#576582";
    ctx.font = "600 22px 'Fredoka', sans-serif";
    ctx.fillText(st.label, textX, by + 114);
  });

  // 6. Branded Arcade Footer Pill
  const footerW = 560;
  const footerH = 48;
  const footerX = cardX + (cardW - footerW) / 2;
  const footerY = cardY + cardH - 72;

  ctx.fillStyle = "#1b2a53";
  ctx.beginPath();
  ctx.roundRect(footerX, footerY, footerW, footerH, 999);
  ctx.fill();

  ctx.fillStyle = "#f8e7d6";
  ctx.font = "700 18px 'Fredoka', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(
    "🏆  SHERBENI ACADEMY  •  SHERBO'S TOWER",
    baseW / 2,
    footerY + 30
  );

  ctx.restore();
}

export const CompletionScreen: React.FC<CompletionScreenProps> = ({
  completedCheckpointsCount: _completedCheckpointsCount,
  totalAttempts: _totalAttempts,
  firstTryCount,
  xpPoints,
  elapsedTime,
  speedBonus,
  onPlayAgain,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingGif, setIsExportingGif] = useState(false);
  const tierConfig = useMemo(
    () => getPerformanceTier(xpPoints, firstTryCount, elapsedTime),
    [xpPoints, firstTryCount, elapsedTime]
  );
  const starCount = tierConfig.stars;

  const [bestScore, setBestScore] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("sherbo_tower_best_score");
      const parsed = saved ? parseInt(saved, 10) : 0;
      return Math.max(parsed, xpPoints);
    } catch {
      return xpPoints;
    }
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sherbo_tower_best_score");
      const prev = saved ? parseInt(saved, 10) : 0;
      if (xpPoints > prev) {
        localStorage.setItem("sherbo_tower_best_score", xpPoints.toString());
        setBestScore(xpPoints);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [xpPoints]);

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
    if (hasCelebratedRef.current) return;
    hasCelebratedRef.current = true;

    try {
      if (tierConfig.tier === "legendary") {
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
            tierConfig.tier === "gold"
              ? 100
              : tierConfig.tier === "silver"
                ? 75
                : 55,
          spread: 75,
          origin: { y: 0.55 },
          colors: tierConfig.confettiColors,
        });
      }
    } catch {
      // Ignore confetti errors
    }

    const duration = 1200;
    const start = performance.now();
    let lastTick = 0;
    let rafId: number;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
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

        const tBadge = window.setTimeout(() => {
          setAnimPhase(2);
          sfx.badgeStamp();
        }, 180);
        animTimeoutsRef.current.push(tBadge);

        const tStats = window.setTimeout(() => {
          setAnimPhase(3);
        }, 600);
        animTimeoutsRef.current.push(tStats);

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

  // Save as static Picture (captures static hero pose, not moving character)
  const handleSaveScore = async () => {
    if (isExporting || isExportingGif) return;
    setIsExporting(true);

    try {
      // true = freeze character in crisp static victory pose
      const [frame, stickerImg] = await Promise.all([
        captureGameFrame(true),
        loadImage(tierConfig.stickerSrc),
      ]);
      const { summitRatioY, playerRatioX } = getSummitViewRatios();

      const outW = 1080;
      const outH = 1920;

      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = outW;
      exportCanvas.height = outH;
      const ctx = exportCanvas.getContext("2d");
      if (!ctx) return;

      drawMobileScoreCard(
        ctx,
        outW,
        outH,
        frame,
        stickerImg,
        summitRatioY,
        playerRatioX,
        tierConfig,
        xpPoints,
        elapsedTime,
        speedBonus,
        firstTryCount,
        bestScore,
        starCount
      );

      const fileName = `sherbos-tower-score-${xpPoints}xp.png`;
      const blob: Blob | null = await new Promise((resolve) =>
        exportCanvas.toBlob((b) => resolve(b), "image/png")
      );
      if (!blob) return;

      const isTouchDevice =
        !!window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
      if (isTouchDevice && typeof navigator.share === "function") {
        try {
          const file = new File([blob], fileName, { type: "image/png" });
          if (!navigator.canShare || navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: "Sherbo's Tower",
              text: `I scored ${xpPoints.toLocaleString()} XP in ${formatStopwatchTime(elapsedTime)} on Sherbo's Tower!`,
            });
            return;
          }
        } catch (shareErr) {
          if ((shareErr as DOMException)?.name === "AbortError") return;
        }
      }

      const objectUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement("a");
      downloadLink.download = fileName;
      downloadLink.href = objectUrl;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
    } catch (err) {
      console.error("Failed to export score card image:", err);
    } finally {
      setIsExporting(false);
    }
  };

  // Save as animated GIF (captures character dancing!)
  const handleSaveGif = async () => {
    if (isExporting || isExportingGif) return;
    setIsExportingGif(true);

    try {
      const stickerImg = await loadImage(tierConfig.stickerSrc);
      const { summitRatioY, playerRatioX } = getSummitViewRatios();

      const gifW = 540;
      const gifH = 960;
      const gifEncoder = new GifEncoder(gifW, gifH);

      const offscreenCanvas = document.createElement("canvas");
      offscreenCanvas.width = gifW;
      offscreenCanvas.height = gifH;
      const offCtx = offscreenCanvas.getContext("2d");
      if (!offCtx) return;

      const numFrames = 10;
      for (let i = 0; i < numFrames; i++) {
        // false = character keeps actively dancing!
        const frame = await captureGameFrame(false);
        drawMobileScoreCard(
          offCtx,
          gifW,
          gifH,
          frame,
          stickerImg,
          summitRatioY,
          playerRatioX,
          tierConfig,
          xpPoints,
          elapsedTime,
          speedBonus,
          firstTryCount,
          bestScore,
          starCount
        );
        const imgData = offCtx.getImageData(0, 0, gifW, gifH);
        gifEncoder.addFrame(imgData, 100);
        await new Promise((r) => setTimeout(r, 90));
      }

      const gifBytes = gifEncoder.render();
      const blob = new Blob([gifBytes], { type: "image/gif" });
      const fileName = `sherbos-tower-score-${xpPoints}xp.gif`;

      const isTouchDevice =
        !!window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
      if (isTouchDevice && typeof navigator.share === "function") {
        try {
          const file = new File([blob], fileName, { type: "image/gif" });
          if (!navigator.canShare || navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: "Sherbo's Tower Victory",
              text: `I scored ${xpPoints.toLocaleString()} XP in ${formatStopwatchTime(elapsedTime)} on Sherbo's Tower!`,
            });
            return;
          }
        } catch (shareErr) {
          if ((shareErr as DOMException)?.name === "AbortError") return;
        }
      }

      const objectUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement("a");
      downloadLink.download = fileName;
      downloadLink.href = objectUrl;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
    } catch (err) {
      console.error("Failed to export animated score GIF:", err);
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
              <div
                className="completion-stars-row"
                aria-label={`${starCount} out of 3 stars`}
              >
                {[0, 1, 2].map((idx) => (
                  <span
                    key={idx}
                    className={
                      idx < starCount
                        ? "completion-star star-earned"
                        : "completion-star star-empty"
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
          <div className={`xp-banner-score ${animPhase < 2 ? "counter-active" : ""}`}>
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
          <div className="save-buttons-group">
            <button
              type="button"
              className="primary-cta-btn save-score-btn"
              onClick={handleSaveScore}
              disabled={isExporting || isExportingGif}
              data-testid="save-score-btn"
            >
              <Download size={18} />
              <span>{isExporting ? "Saving..." : "Save Picture"}</span>
            </button>

            <button
              type="button"
              className="primary-cta-btn save-gif-btn"
              onClick={handleSaveGif}
              disabled={isExporting || isExportingGif}
              data-testid="save-gif-btn"
            >
              <Sparkles size={18} />
              <span>{isExportingGif ? "Creating..." : "Save GIF"}</span>
            </button>
          </div>

          <button
            type="button"
            className="secondary-cta-btn play-again-btn"
            onClick={onPlayAgain}
            disabled={isExporting || isExportingGif}
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
