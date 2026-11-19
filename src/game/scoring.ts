/**
 * Centralized Scoring System for Sherbo's Knowledge Tower.
 *
 * Scoring Formula:
 * Final XP = Question XP + Streak XP + Summit XP + Speed XP + Achievement XP
 *
 * Components:
 * 1. Question XP (Max 2,500 XP across 5 gates):
 *    - Attempt 1 (0 mistakes): 500 XP
 *    - Attempt 2 (1st mistake -50 XP): 450 XP
 *    - Attempt 3 (2nd mistake -150 XP): 300 XP
 *    - Attempt 4+ (3rd+ mistake): 0 XP for the checkpoint
 *    - Points awarded once per gate upon solving.
 *    - Wrong attempts never deduct previously earned XP.
 * 2. Streak XP (Max 400 XP):
 *    - Consecutive first-attempt correct answers.
 *    - Milestones: 2 -> +50 XP, 3 -> +100 XP, 4 -> +150 XP, 5 -> +250 XP (capped at 400 XP total).
 *    - Each milestone awarded at most once per game.
 *    - Reset to 0 on any incorrect attempt.
 * 3. Speed XP (Max 600 XP) — based on CLIMBING time only (the clock pauses while a question is open):
 *    - 600 * max(0, 1 - max(0, climbSeconds - 90) / 240)
 *    - <= 90s: 600 XP | 120s: 525 XP | 150s: 450 XP | 210s: 300 XP | 270s: 150 XP | >= 330s: 0 XP
 * 4. Summit XP:
 *    - Fixed +300 XP upon crossing the summit finish line.
 * 5. Achievements (Max 275 XP):
 *    - TREASURE_HUNTER: Collect every coin in the tower (+50 XP).
 * 6. Coins: +10 XP for each coin collected while climbing.
 *    - UNTOUCHABLE: Complete all 5 gates with 0 mistakes (+150 XP).
 *    - PHOENIX_COMEBACK: After a mistake, solve next 2 consecutive gates on attempt 1 (+75 XP).
 */

export type AchievementId = 'TREASURE_HUNTER' | 'UNTOUCHABLE' | 'PHOENIX_COMEBACK';

/** XP awarded for every coin collected while climbing. */
export const COIN_XP = 10;

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
    description: 'Conquered all 5 gates without a single mistake!',
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

/** Gate XP plus summit and maximum speed bonus; the grade thresholds are set for 5 gates. */
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
 * Speed XP Formula (climbing time only):
 * 600 * max(0, 1 - max(0, elapsedSeconds - 90) / 240)
 */
export function calculateSpeedXp(elapsedSeconds: number): number {
  const overtime = Math.max(0, elapsedSeconds - 90);
  const factor = Math.max(0, 1 - overtime / 240);
  return Math.round(600 * factor);
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
   * - Calculates Question XP based on total attempts on this gate (1 -> 500, 2 -> 400, 3 -> 300, 4+ -> 250).
   * - Points awarded only once per gate (idempotent).
   * - If solved on 1st attempt:
   *     - Increment current streak.
   *     - Check streak milestones: 2 (+50), 3 (+100), 4 (+150), 5 (+250 capped at 400 total).
   *     - Check LIGHTNING_FAST achievement if solveDurationSeconds < 5.0.
   *     - If hasMadeMistake, increment consecutiveFirstTriesSinceMistake and check PHOENIX_COMEBACK (reaches 2).
   * - If solved on 2nd+ attempt:
   *     - Consecutive streak is already 0.
   *     - consecutiveFirstTriesSinceMistake resets to 0.
   */
  public recordCorrectAnswer(
    gateNumber: number,
    solveDurationSeconds: number
  ): {
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

      // Check milestones
      const streakMilestones: Record<number, number> = {
        2: 50,
        3: 100,
        4: 150,
        5: 250,
      };

      const milestoneBonus = streakMilestones[this.state.currentStreak];
      if (
        milestoneBonus &&
        !this.state.streakMilestonesAwarded.includes(this.state.currentStreak)
      ) {
        // Ensure total streak reward cannot exceed 400 XP
        const remainingStreakCapacity = Math.max(0, 400 - this.state.streakXp);
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

  /**
   * Handle summit finish line crossing.
   * - Award Summit XP: +300 XP (only once).
   * - Calculate Speed XP: 600 * max(0, 1 - max(0, elapsedSeconds - 60) / 240).
   * - Check UNTOUCHABLE achievement: complete all 5 gates with 0 mistakes (+150 XP).
   */
  /** A coin was picked up while climbing: +10 XP each. */
  public recordCoin(): number {
    this.state.coinsCollected += 1;
    this.state.coinXp += COIN_XP;
    this.recalculateTotalXp();
    return COIN_XP;
  }

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
    this.state.summitXp = 300;

    this.pushNotification({
      type: 'summit',
      title: '👑 Summit Conquered!',
      subtitle: 'Summit Completion Bonus (+300 XP)',
      xpEarned: 300,
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
      summitXpEarned: 300,
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
