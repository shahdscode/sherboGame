/**
 * Centralized Scoring System for Sherbo's Knowledge Tower.
 *
 * Scoring Formula:
 * Final XP = Question XP + Streak XP + Summit XP + Speed XP + Achievement XP
 *
 * Components:
 * 1. Question XP (500 XP per gate, 2,500 XP for a 5-gate tower):
 *    - Attempt 1 (0 mistakes): 500 XP
 *    - Attempt 2 (1st mistake -50 XP): 450 XP
 *    - Attempt 3 (2nd mistake -150 XP): 300 XP
 *    - Attempt 4+ (3rd mistake -300 XP): 0 XP for the gate
 *    - Attempts count per gate, across the different questions shown at it.
 *    - Points awarded once per gate upon solving.
 *    - Wrong attempts never deduct previously earned XP.
 * 2. Streak XP (Max 400 XP):
 *    - Consecutive first-attempt correct answers.
 *    - Milestones: 2 -> +50 XP, 3 -> +100 XP, 4 -> +150 XP, 5 -> +250 XP (capped at 400 XP total).
 *    - Each milestone awarded at most once per game.
 *    - Reset to 0 on any incorrect attempt.
 * 3. Speed XP (Max 600 XP) — the stopwatch runs while climbing AND while a question is open:
 *    - 600 * max(0, 1 - max(0, seconds - 180) / 240)
 *    - <= 180s: 600 XP | 240s: 450 XP | 300s: 300 XP | 360s: 150 XP | >= 420s: 0 XP
 * 4. Summit XP:
 *    - Fixed +300 XP upon crossing the summit finish line.
 * 5. Coins: +10 XP for each coin collected while climbing.
 * 6. Achievements (at most 200 XP: UNTOUCHABLE and PHOENIX_COMEBACK exclude each other):
 *    - TREASURE_HUNTER: Collect every coin in the tower (+50 XP).
 *    - UNTOUCHABLE: Complete every gate with 0 mistakes (+150 XP).
 *    - PHOENIX_COMEBACK: After a mistake, solve next 2 consecutive gates on attempt 1 (+75 XP).
 */

import { countTowerCoins } from './towerLayout.ts';
import { MAX_LEVELS } from '../data/towerConfig.ts';

export type AchievementId = 'TREASURE_HUNTER' | 'UNTOUCHABLE' | 'PHOENIX_COMEBACK';

/** XP awarded for every coin collected while climbing. */
export const COIN_XP = 10;

/** Fixed XP for crossing the summit finish line. */
export const SUMMIT_XP = 300;

/** Streak bonus per run of consecutive first-try gates (each awarded once). */
export const STREAK_MILESTONES: Readonly<Record<number, number>> = {
  2: 50,
  3: 100,
  4: 150,
  5: 250,
};
/** Total streak XP never goes above this. */
export const MAX_STREAK_XP = 400;

export interface AchievementDef {
  id: AchievementId;
  title: string;
  description: string;
  xp: number;
  icon: string; // Emoji or Lucide icon indicator
}

export const ACHIEVEMENTS: Record<AchievementId, AchievementDef> = {
  TREASURE_HUNTER: {
    id: 'TREASURE_HUNTER',
    title: 'Treasure Hunter',
    description: 'Collected every single coin in the tower!',
    xp: 50,
    icon: '🪙',
  },
  UNTOUCHABLE: {
    id: 'UNTOUCHABLE',
    title: 'Untouchable',
    description: 'Conquered every gate without a single mistake!',
    xp: 150,
    icon: '🛡️',
  },
  PHOENIX_COMEBACK: {
    id: 'PHOENIX_COMEBACK',
    title: 'Phoenix Comeback',
    description: 'Rose from a mistake and solved 2 gates in a row on the 1st try!',
    xp: 75,
    icon: '🔥',
  },
};

export type PerformanceGrade = 'S+' | 'S' | 'A' | 'B' | 'C' | 'D';

export interface PerformanceGradeInfo {
  grade: PerformanceGrade;
  title: string;
  minXp: number;
  badgeTag: string;
  themeClass: string;
  description: string;
}

export const PERFORMANCE_GRADES: PerformanceGradeInfo[] = [
  {
    grade: 'S+',
    title: 'Tower Legend',
    minXp: 3500,
    badgeTag: 'RANK S+ • TOWER LEGEND',
    themeClass: 'theme-legendary',
    description: 'Flawless run with 1st-try combos, maximum speed bonus, and peak perfection.',
  },
  {
    grade: 'S',
    title: 'Master Climber',
    minXp: 3200,
    badgeTag: 'RANK S • MASTER CLIMBER',
    themeClass: 'theme-gold',
    description: 'Outstanding precision and blazing speed with high combo streaks.',
  },
  {
    grade: 'A',
    title: 'Elite Explorer',
    minXp: 2800,
    badgeTag: 'RANK A • ELITE EXPLORER',
    themeClass: 'theme-gold',
    description: 'Remarkable skill, consistent correct answers, and fast gate clears.',
  },
  {
    grade: 'B',
    title: 'Skilled Adventurer',
    minXp: 2300,
    badgeTag: 'RANK B • SKILLED ADVENTURER',
    themeClass: 'theme-silver',
    description: 'Resilient climbing, tackling gate challenges with a steady pace.',
  },
  {
    grade: 'C',
    title: 'Rising Climber',
    minXp: 1700,
    badgeTag: 'RANK C • RISING CLIMBER',
    themeClass: 'theme-silver',
    description: 'Conquered the tower checkpoints and successfully reached the summit.',
  },
  {
    grade: 'D',
    title: 'Apprentice',
    minXp: 0,
    badgeTag: 'RANK D • APPRENTICE',
    themeClass: 'theme-comeback',
    description: 'Reached the finish line! Keep climbing to sharpen speed and combos.',
  },
];

/**
 * Gate XP plus summit and maximum speed bonus (streak, coins and achievements
 * are extra); the grade thresholds are set for 5 gates.
 */
const possibleXp = (gateCount: number) => gateCount * 500 + 300 + 600;

/**
 * Grade for a run. Thresholds scale with the number of gates, so a shorter
 * tower (fewer levels) can still reach every grade.
 */
export function getPerformanceGrade(
  totalXp: number,
  gateCount: number = 5
): PerformanceGradeInfo {
  const scale = possibleXp(gateCount) / possibleXp(5);
  for (const info of PERFORMANCE_GRADES) {
    if (totalXp >= Math.round(info.minXp * scale)) {
      return info;
    }
  }
  return PERFORMANCE_GRADES[PERFORMANCE_GRADES.length - 1];
}

/**
 * Calculates Question XP for a single gate based on attempt count.
 */
export function calculateGateQuestionXp(attempts: number): number {
  if (attempts <= 1) return 500;
  if (attempts === 2) return 450; // 1st mistake: -50 XP
  if (attempts === 3) return 300; // 2nd mistake: -150 XP
  return 0; // 3rd+ mistake: 0 XP for the checkpoint
}

/**
 * XP lost by one more mistake at a gate: 50, then 150, then 300, then 0
 * (`mistakes` counts the new one).
 */
export function calculateMistakeXpLoss(mistakes: number): number {
  if (mistakes <= 0) return 0;
  return calculateGateQuestionXp(mistakes) - calculateGateQuestionXp(mistakes + 1);
}

/** Full speed XP up to this many seconds; question time counts too. */
export const SPEED_GRACE_SECONDS = 180;
/** Seconds after the grace period over which speed XP falls to 0. */
export const SPEED_DECAY_SECONDS = 240;
export const MAX_SPEED_XP = 600;

/**
 * Speed XP Formula (whole run: climbing and answering):
 * 600 * max(0, 1 - max(0, elapsedSeconds - 180) / 240)
 */
export function calculateSpeedXp(elapsedSeconds: number): number {
  const overtime = Math.max(0, elapsedSeconds - SPEED_GRACE_SECONDS);
  const factor = Math.max(0, 1 - overtime / SPEED_DECAY_SECONDS);
  return Math.round(MAX_SPEED_XP * factor);
}

/** Most streak XP a run through `gateCount` gates can earn. */
export function calculateMaxStreakXp(gateCount: number): number {
  let total = 0;
  for (let streak = 1; streak <= gateCount; streak++) {
    total += STREAK_MILESTONES[streak] ?? 0;
  }
  return Math.min(MAX_STREAK_XP, total);
}

export interface MaxScoreBreakdown {
  gates: number;
  questionXp: number;
  streakXp: number;
  summitXp: number;
  speedXp: number;
  coins: number;
  coinXp: number;
  achievementXp: number;
  total: number;
}

/**
 * The highest score a tower with `levelCount` levels allows: every gate on the
 * first try, finished within the speed grace period, every coin collected.
 * UNTOUCHABLE and TREASURE_HUNTER both count; PHOENIX_COMEBACK needs a mistake,
 * so it can never join a perfect run.
 *
 * The admin copies these numbers to suggest a pass score (see
 * `MAX_SCORE_BY_LEVELS` in scoring.test.ts); update both when scoring changes.
 */
export function calculateMaxScore(levelCount: number): MaxScoreBreakdown {
  const gates = Math.max(1, Math.min(MAX_LEVELS, Math.floor(levelCount)));
  const coins = countTowerCoins(gates);
  const questionXp = gates * calculateGateQuestionXp(1);
  const streakXp = calculateMaxStreakXp(gates);
  const coinXp = coins * COIN_XP;
  const achievementXp =
    ACHIEVEMENTS.UNTOUCHABLE.xp + (coins > 0 ? ACHIEVEMENTS.TREASURE_HUNTER.xp : 0);
  return {
    gates,
    questionXp,
    streakXp,
    summitXp: SUMMIT_XP,
    speedXp: MAX_SPEED_XP,
    coins,
    coinXp,
    achievementXp,
    total: questionXp + streakXp + SUMMIT_XP + MAX_SPEED_XP + coinXp + achievementXp,
  };
}

export interface ScoreNotification {
  id: string;
  type: 'xp' | 'streak' | 'achievement' | 'summit';
  title: string;
  subtitle?: string;
  xpEarned: number;
  timestamp: number;
}

export interface ScoringState {
  // Gate specific tracking (gate numbers 1..5)
  gateAttempts: Record<number, number>; // attempts spent on each gate
  gateSolved: Record<number, boolean>;
  gateQuestionXp: Record<number, number>;

  // Streak tracking
  currentStreak: number;
  bestStreak: number;
  streakMilestonesAwarded: number[]; // e.g. [2, 3]
  streakXp: number; // Max 400

  // Summit tracking
  summitCompleted: boolean;
  summitXp: number; // 300 when completed

  // Speed tracking
  speedXp: number; // 0..600

  // Coins collected while climbing
  coinsCollected: number;
  coinXp: number;

  // Mistakes tracking
  totalMistakes: number;
  totalAttempts: number;

  // Phoenix Comeback tracker:
  // hasMadeMistake: true once any wrong answer occurs
  // consecutiveFirstTriesSinceMistake: counter
  hasMadeMistake: boolean;
  consecutiveFirstTriesSinceMistake: number;

  // Unlocked achievements
  unlockedAchievements: AchievementId[];
  achievementXp: number;

  // Live total XP
  totalXp: number;

  // Active notifications for UI banners
  recentNotifications: ScoreNotification[];
}

export function createInitialScoringState(): ScoringState {
  return {
    gateAttempts: {},
    gateSolved: {},
    gateQuestionXp: {},
    currentStreak: 0,
    bestStreak: 0,
    streakMilestonesAwarded: [],
    streakXp: 0,
    summitCompleted: false,
    summitXp: 0,
    speedXp: 0,
    coinsCollected: 0,
    coinXp: 0,
    totalMistakes: 0,
    totalAttempts: 0,
    hasMadeMistake: false,
    consecutiveFirstTriesSinceMistake: 0,
    unlockedAchievements: [],
    achievementXp: 0,
    totalXp: 0,
    recentNotifications: [],
  };
}

/**
 * Pure calculation to compute total question XP from solved gates.
 */
export function sumQuestionXp(gateQuestionXp: Record<number, number>): number {
  return Object.values(gateQuestionXp).reduce((acc, val) => acc + val, 0);
}

/**
 * Pure scoring manager that encapsulates game state transitions.
 */
export class ScoringEngine {
  private state: ScoringState;
  private onNotification?: (notification: ScoreNotification) => void;

  constructor(initialState?: ScoringState, onNotification?: (notification: ScoreNotification) => void) {
    this.state = initialState ? { ...initialState } : createInitialScoringState();
    this.onNotification = onNotification;
  }

  public getState(): ScoringState {
    return { ...this.state };
  }

  private recalculateTotalXp() {
    const questionTotal = sumQuestionXp(this.state.gateQuestionXp);
    this.state.totalXp =
      questionTotal +
      this.state.streakXp +
      this.state.summitXp +
      this.state.speedXp +
      this.state.coinXp +
      this.state.achievementXp;
  }

  private pushNotification(notification: Omit<ScoreNotification, 'id' | 'timestamp'>) {
    const full: ScoreNotification = {
      ...notification,
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
    };
    this.state.recentNotifications = [...this.state.recentNotifications.slice(-4), full];
    if (this.onNotification) {
      this.onNotification(full);
    }
  }

  /**
   * Handle an incorrect answer attempt at a gate.
   * - Increments gate attempts and total attempts.
   * - Increments total mistakes.
   * - Resets current streak to 0.
   * - Updates Phoenix Comeback tracking: sets hasMadeMistake = true, resets consecutiveFirstTriesSinceMistake to 0.
   * - Does NOT deduct previously earned XP.
   */
  public recordIncorrectAttempt(gateNumber: number): { potentialXp: number; attemptNumber: number } {
    if (this.state.gateSolved[gateNumber]) {
      return { potentialXp: this.state.gateQuestionXp[gateNumber] ?? 0, attemptNumber: this.state.gateAttempts[gateNumber] || 1 };
    }

    const currentAttempts = (this.state.gateAttempts[gateNumber] || 0) + 1;
    this.state.gateAttempts[gateNumber] = currentAttempts;
    this.state.totalAttempts += 1;
    this.state.totalMistakes += 1;

    // Reset current streak
    this.state.currentStreak = 0;

    // Phoenix Comeback tracker update
    this.state.hasMadeMistake = true;
    this.state.consecutiveFirstTriesSinceMistake = 0;

    // Next potential XP if they solve it on the next try
    const nextPotentialXp = calculateGateQuestionXp(currentAttempts + 1);

    return {
      potentialXp: nextPotentialXp,
      attemptNumber: currentAttempts,
    };
  }

  /**
   * Handle a correct answer at a gate.
   * - Calculates Question XP based on total attempts on this gate (1 -> 500, 2 -> 450, 3 -> 300, 4+ -> 0).
   * - Points awarded only once per gate (idempotent).
   * - If solved on 1st attempt:
   *     - Increment current streak.
   *     - Check streak milestones: 2 (+50), 3 (+100), 4 (+150), 5 (+250 capped at 400 total).
   *     - If hasMadeMistake, increment consecutiveFirstTriesSinceMistake and check PHOENIX_COMEBACK (reaches 2).
   * - If solved on 2nd+ attempt:
   *     - Consecutive streak is already 0.
   *     - consecutiveFirstTriesSinceMistake resets to 0.
   */
  public recordCorrectAnswer(gateNumber: number): {
    questionXpEarned: number;
    streakXpEarned: number;
    achievementsUnlocked: AchievementDef[];
    isFirstTry: boolean;
  } {
    // Idempotent: If gate is already solved, return 0 new awards
    if (this.state.gateSolved[gateNumber]) {
      return {
        questionXpEarned: 0,
        streakXpEarned: 0,
        achievementsUnlocked: [],
        isFirstTry: false,
      };
    }

    const currentGateAttempts = (this.state.gateAttempts[gateNumber] || 0) + 1;
    this.state.gateAttempts[gateNumber] = currentGateAttempts;
    this.state.totalAttempts += 1;
    this.state.gateSolved[gateNumber] = true;

    const isFirstTry = currentGateAttempts === 1;
    const questionXp = calculateGateQuestionXp(currentGateAttempts);
    this.state.gateQuestionXp[gateNumber] = questionXp;

    this.pushNotification({
      type: 'xp',
      title: isFirstTry ? `Gate ${gateNumber} Cracked!` : `Gate ${gateNumber} Solved!`,
      subtitle: isFirstTry
        ? 'First Try Precision (+500 XP)'
        : questionXp === 0
          ? 'Completed after 3+ mistakes (0 XP for gate)'
          : `Attempt ${currentGateAttempts} (+${questionXp} XP)`,
      xpEarned: questionXp,
    });

    let streakXpAdded = 0;
    const unlockedList: AchievementDef[] = [];

    if (isFirstTry) {
      // 1. Streak progression
      this.state.currentStreak += 1;
      if (this.state.currentStreak > this.state.bestStreak) {
        this.state.bestStreak = this.state.currentStreak;
      }

      const milestoneBonus = STREAK_MILESTONES[this.state.currentStreak];
      if (
        milestoneBonus &&
        !this.state.streakMilestonesAwarded.includes(this.state.currentStreak)
      ) {
        // Ensure total streak reward cannot exceed the cap
        const remainingStreakCapacity = Math.max(0, MAX_STREAK_XP - this.state.streakXp);
        const actualBonus = Math.min(remainingStreakCapacity, milestoneBonus);

        if (actualBonus > 0) {
          this.state.streakXp += actualBonus;
          streakXpAdded = actualBonus;
          this.state.streakMilestonesAwarded.push(this.state.currentStreak);

          this.pushNotification({
            type: 'streak',
            title: `🔥 ${this.state.currentStreak}x First-Try Streak!`,
            subtitle: `Streak Milestone Bonus (+${actualBonus} XP)`,
            xpEarned: actualBonus,
          });
        }
      }

      // 3. Check PHOENIX_COMEBACK
      // "After making a mistake, solve the next TWO gates correctly on their first attempts."
      if (this.state.hasMadeMistake) {
        this.state.consecutiveFirstTriesSinceMistake += 1;
        if (
          this.state.consecutiveFirstTriesSinceMistake >= 2 &&
          !this.state.unlockedAchievements.includes('PHOENIX_COMEBACK')
        ) {
          this.unlockAchievement('PHOENIX_COMEBACK', unlockedList);
        }
      }
    } else {
      // Solved after mistakes
      this.state.consecutiveFirstTriesSinceMistake = 0;
    }

    this.recalculateTotalXp();

    return {
      questionXpEarned: questionXp,
      streakXpEarned: streakXpAdded,
      achievementsUnlocked: unlockedList,
      isFirstTry,
    };
  }

  /** A coin was picked up while climbing: +10 XP each. */
  public recordCoin(): number {
    this.state.coinsCollected += 1;
    this.state.coinXp += COIN_XP;
    this.recalculateTotalXp();
    return COIN_XP;
  }

  /**
   * Handle summit finish line crossing (only once, and only after every gate is solved).
   * - Award Summit XP: +300 XP.
   * - Calculate Speed XP with `calculateSpeedXp`.
   * - Check UNTOUCHABLE (every gate with 0 mistakes, +150 XP) and TREASURE_HUNTER (+50 XP).
   */
  public recordSummitCompletion(
    elapsedSeconds: number,
    totalGatesRequired: number = 5,
    totalCoinsInTower: number = 0
  ): {
    summitXpEarned: number;
    speedXpEarned: number;
    achievementsUnlocked: AchievementDef[];
  } {
    // Idempotent: If summit already completed, return 0
    if (this.state.summitCompleted) {
      return {
        summitXpEarned: 0,
        speedXpEarned: 0,
        achievementsUnlocked: [],
      };
    }

    const solvedCount = Object.values(this.state.gateSolved).filter(Boolean).length;
    if (solvedCount < totalGatesRequired) {
      // Incomplete run
      return {
        summitXpEarned: 0,
        speedXpEarned: 0,
        achievementsUnlocked: [],
      };
    }

    this.state.summitCompleted = true;
    this.state.summitXp = SUMMIT_XP;

    this.pushNotification({
      type: 'summit',
      title: '👑 Summit Conquered!',
      subtitle: `Summit Completion Bonus (+${SUMMIT_XP} XP)`,
      xpEarned: SUMMIT_XP,
    });

    // Speed XP calculation
    const speedXp = calculateSpeedXp(elapsedSeconds);
    this.state.speedXp = speedXp;

    if (speedXp > 0) {
      this.pushNotification({
        type: 'xp',
        title: '⚡ Speed Bonus!',
        subtitle: `Completed in ${Math.round(elapsedSeconds)}s (+${speedXp} XP)`,
        xpEarned: speedXp,
      });
    }

    // Check UNTOUCHABLE achievement
    const unlockedList: AchievementDef[] = [];
    if (
      this.state.totalMistakes === 0 &&
      !this.state.unlockedAchievements.includes('UNTOUCHABLE')
    ) {
      this.unlockAchievement('UNTOUCHABLE', unlockedList);
    }

    // Check TREASURE_HUNTER achievement (every coin in the tower collected)
    if (totalCoinsInTower > 0 && this.state.coinsCollected >= totalCoinsInTower) {
      this.unlockAchievement('TREASURE_HUNTER', unlockedList);
    }

    this.recalculateTotalXp();

    return {
      summitXpEarned: SUMMIT_XP,
      speedXpEarned: speedXp,
      achievementsUnlocked: unlockedList,
    };
  }

  private unlockAchievement(id: AchievementId, list: AchievementDef[]) {
    if (this.state.unlockedAchievements.includes(id)) return;
    const def = ACHIEVEMENTS[id];
    this.state.unlockedAchievements.push(id);
    this.state.achievementXp += def.xp;
    list.push(def);

    this.pushNotification({
      type: 'achievement',
      title: `🏆 Achievement Unlocked: ${def.title}!`,
      subtitle: `${def.description} (+${def.xp} XP)`,
      xpEarned: def.xp,
    });
  }

  public reset() {
    this.state = createInitialScoringState();
  }
}
