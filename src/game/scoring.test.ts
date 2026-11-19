import {
  ScoringEngine,
  calculateGateQuestionXp,
  calculateSpeedXp,
  calculateMistakeXpLoss,
  calculateMaxScore,
  calculateMaxStreakXp,
  getPerformanceGrade,
  sumQuestionXp,
  ACHIEVEMENTS,
} from './scoring.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log('Running comprehensive Scoring Engine tests...\n');

// 1. Question XP calculation tests
console.log('Testing calculateGateQuestionXp:');
assert(calculateGateQuestionXp(1) === 500, 'Attempt 1 (0 mistakes) must award 500 XP');
assert(calculateGateQuestionXp(2) === 450, 'Attempt 2 (1st mistake -50) must award 450 XP');
assert(calculateGateQuestionXp(3) === 300, 'Attempt 3 (2nd mistake -150) must award 300 XP');
assert(calculateGateQuestionXp(4) === 0, 'Attempt 4 (3rd mistake) must award 0 XP for checkpoint');
assert(calculateGateQuestionXp(5) === 0, 'Attempt 5 must award 0 XP for checkpoint');
assert(calculateGateQuestionXp(10) === 0, 'Attempt 10 must award 0 XP for checkpoint');
console.log('✓ Question XP values verified.');

// 2. Speed XP calculation tests
console.log('\nTesting calculateSpeedXp:');
assert(calculateSpeedXp(45) === 600, '45s must yield 600 XP');
assert(calculateSpeedXp(180) === 600, '180s (grace period) must yield 600 XP');
assert(calculateSpeedXp(240) === 450, '240s must yield 450 XP');
assert(calculateSpeedXp(300) === 300, '300s must yield 300 XP');
assert(calculateSpeedXp(360) === 150, '360s must yield 150 XP');
assert(calculateSpeedXp(420) === 0, '420s must yield 0 XP');
assert(calculateSpeedXp(500) === 0, '500s must yield 0 XP (no negative)');

// Mistake loss shown to the student
assert(calculateMistakeXpLoss(1) === 50, '1st mistake costs 50 XP');
assert(calculateMistakeXpLoss(2) === 150, '2nd mistake costs 150 XP');
assert(calculateMistakeXpLoss(3) === 300, '3rd mistake costs 300 XP');
assert(calculateMistakeXpLoss(4) === 0, '4th mistake costs nothing more');
console.log('✓ Speed XP formula verified.');

// 3. Performance Grades un-capped tests
console.log('\nTesting getPerformanceGrade:');
assert(getPerformanceGrade(4075).grade === 'S+', '4075 XP must be S+');
assert(getPerformanceGrade(3850).grade === 'S+', '3850 XP must be S+');
assert(getPerformanceGrade(3500).grade === 'S+', '3500 XP must be S+');
assert(getPerformanceGrade(3499).grade === 'S', '3499 XP must be S');
assert(getPerformanceGrade(3200).grade === 'S', '3200 XP must be S');
assert(getPerformanceGrade(3199).grade === 'A', '3199 XP must be A');
assert(getPerformanceGrade(2800).grade === 'A', '2800 XP must be A');
assert(getPerformanceGrade(2799).grade === 'B', '2799 XP must be B');
assert(getPerformanceGrade(2300).grade === 'B', '2300 XP must be B');
assert(getPerformanceGrade(2299).grade === 'C', '2299 XP must be C');
assert(getPerformanceGrade(1700).grade === 'C', '1700 XP must be C');
assert(getPerformanceGrade(1699).grade === 'D', '1699 XP must be D');
assert(getPerformanceGrade(500).grade === 'D', '500 XP must be D');
console.log('✓ Grade thresholds verified.');

// 4. TEST 1: PERFECT RUN
console.log('\nTesting TEST 1 - PERFECT RUN (50s, 0 mistakes):');
const eng1 = new ScoringEngine();
for (let g = 1; g <= 5; g++) {
  eng1.recordCorrectAnswer(g);
}
for (let c = 0; c < 30; c++) eng1.recordCoin();
eng1.recordSummitCompletion(50, 5, 30);
const st1 = eng1.getState();
assert(sumQuestionXp(st1.gateQuestionXp) === 2500, 'Question XP must be 2,500');
assert(st1.streakXp === 400, 'Streak XP must be 400 (capped at 400)');
assert(st1.summitXp === 300, 'Summit XP must be 300');
assert(st1.speedXp === 600, 'Speed XP must be 600');
assert(st1.unlockedAchievements.includes('UNTOUCHABLE'), 'Must unlock UNTOUCHABLE');
assert(st1.unlockedAchievements.includes('TREASURE_HUNTER'), 'Must unlock TREASURE_HUNTER');
assert(st1.coinXp === 300, 'Coin XP must be 300 (30 coins x 10)');
assert(!st1.unlockedAchievements.includes('PHOENIX_COMEBACK'), 'Must NOT unlock PHOENIX_COMEBACK');
// Base = 2500 + 400 + 300 + 600 = 3800
// Coins = 300, Achievements = 150 (Untouchable) + 50 (Treasure Hunter) = 200
assert(st1.totalXp === 4300, `Total XP must be 4300, got ${st1.totalXp}`);
console.log('✓ TEST 1 passed.');

// 5. TEST 2: STRONG RUN (4 first try, 1 on second try, 120s)
console.log('\nTesting TEST 2 - STRONG RUN (150s):');
const eng2 = new ScoringEngine();
eng2.recordCorrectAnswer(1); // 500
eng2.recordIncorrectAttempt(2);   // 1st mistake (-50)
eng2.recordCorrectAnswer(2); // 450
eng2.recordCorrectAnswer(3); // 500, post mistake #1
eng2.recordCorrectAnswer(4); // 500, post mistake #2 -> unlocks PHOENIX_COMEBACK
eng2.recordCorrectAnswer(5); // 500
eng2.recordSummitCompletion(240, 5);
const st2 = eng2.getState();
assert(sumQuestionXp(st2.gateQuestionXp) === 2450, 'Question XP must be 2450');
assert(st2.speedXp === 450, 'Speed XP must be 450');
assert(st2.summitXp === 300, 'Summit XP must be 300');
assert(st2.unlockedAchievements.includes('PHOENIX_COMEBACK'), 'Phoenix Comeback must be unlocked');
assert(!st2.unlockedAchievements.includes('UNTOUCHABLE'), 'Untouchable must NOT be unlocked');
console.log('✓ TEST 2 passed.');

// 6. TEST 3: COMEBACK
console.log('\nTesting TEST 3 - COMEBACK:');
const eng3 = new ScoringEngine();
eng3.recordIncorrectAttempt(1);
eng3.recordCorrectAnswer(1);
eng3.recordCorrectAnswer(2);
eng3.recordCorrectAnswer(3);
const st3 = eng3.getState();
assert(st3.unlockedAchievements.includes('PHOENIX_COMEBACK'), 'Phoenix Comeback must unlock');
assert(st3.achievementXp === 75, 'Achievement XP must be 75');
console.log('✓ TEST 3 passed.');

// 7. TEST 4: SLOW RUN (450s)
console.log('\nTesting TEST 4 - SLOW RUN (450s):');
const eng4 = new ScoringEngine();
for (let g = 1; g <= 5; g++) {
  eng4.recordCorrectAnswer(g);
}
eng4.recordSummitCompletion(450, 5);
const st4 = eng4.getState();
assert(st4.speedXp === 0, 'Speed XP must be 0');
assert(st4.summitXp === 300, 'Summit XP must still be awarded');
assert(sumQuestionXp(st4.gateQuestionXp) === 2500, 'Question XP must be 2500');
console.log('✓ TEST 4 passed.');

// 8. TEST 5: DUPLICATE EVENT IDEMPOTENCY
console.log('\nTesting TEST 5 - DUPLICATE EVENT IDEMPOTENCY:');
const eng5 = new ScoringEngine();
const gate1First = eng5.recordCorrectAnswer(1);
assert(gate1First.questionXpEarned === 500, 'First solve must earn 500');
const gate1Dupe = eng5.recordCorrectAnswer(1);
assert(gate1Dupe.questionXpEarned === 0, 'Duplicate solve must earn 0');
const sum1 = eng5.recordSummitCompletion(50, 1);
assert(sum1.summitXpEarned === 300, 'Summit completion must earn 300');
const sum2 = eng5.recordSummitCompletion(50, 1);
assert(sum2.summitXpEarned === 0, 'Duplicate summit completion must earn 0');
console.log('✓ TEST 5 passed.');

// 9. Negative deductions, 3rd mistake zero-XP rule, and independent checkpoint counters:
console.log('\nTesting 3rd-Mistake Zero-XP rule and independent checkpoint counters:');
const eng6 = new ScoringEngine();
eng6.recordCorrectAnswer(1); // +500
const scoreAfterGate1 = eng6.getState().totalXp;
assert(scoreAfterGate1 === 500, 'Initial score is 500');

// Gate 2: 1st mistake (-50 -> 450 potential), 2nd mistake (-150 -> 300 potential), 3rd+ mistakes (0 potential)
const g2m1 = eng6.recordIncorrectAttempt(2);
assert(g2m1.potentialXp === 450, 'After 1st mistake, potential XP must be 450');
const g2m2 = eng6.recordIncorrectAttempt(2);
assert(g2m2.potentialXp === 300, 'After 2nd mistake, potential XP must be 300');
const g2m3 = eng6.recordIncorrectAttempt(2);
assert(g2m3.potentialXp === 0, 'After 3rd mistake, potential XP must be 0');
const g2m4 = eng6.recordIncorrectAttempt(2);
assert(g2m4.potentialXp === 0, 'After 4th mistake, potential XP remains 0');
assert(eng6.getState().totalXp === scoreAfterGate1, 'Total XP must NEVER decrease from mistakes');

// Eventually solves gate 2 on 5th attempt -> receives 0 XP for gate 2, but gate 2 is marked solved!
const solveGate2 = eng6.recordCorrectAnswer(2);
assert(solveGate2.questionXpEarned === 0, 'Correct answer after 3rd mistake must award 0 XP for checkpoint');
assert(eng6.getState().gateSolved[2] === true, 'Gate 2 must still be marked solved to allow progression');
assert(eng6.getState().totalXp === 500, 'Total XP remains 500');

// Gate 3 starts with a fresh 0-mistake counter and awards full 500 XP on 1st try!
const solveGate3 = eng6.recordCorrectAnswer(3);
assert(solveGate3.questionXpEarned === 500, 'New checkpoint must reset mistake counter and award 500 XP');
assert(eng6.getState().totalXp === 1000, 'Total XP after gate 3 is 1000');
console.log('✓ 3rd-Mistake Zero-XP rule, no negative deductions, and independent counters verified.');

// MAX SCORE PER LEVEL COUNT
// The admin (sherbeni-academy-admin, src/features/videos/utils/towerScore.ts)
// and the backend (video-game.constants.ts) keep a copy of this table to
// suggest and validate pass scores. If this test fails, update those copies too.
console.log('\nTesting max score per level count:');
const MAX_SCORE_BY_LEVELS = [1660, 2260, 2930, 3680, 4420];
for (let levels = 1; levels <= 5; levels++) {
  const max = calculateMaxScore(levels);
  assert(
    max.total === MAX_SCORE_BY_LEVELS[levels - 1],
    `${levels} level(s): max score is ${max.total}, table says ${MAX_SCORE_BY_LEVELS[levels - 1]}`
  );

  // A perfect, fast run that grabs every coin really reaches that number
  const perfect = new ScoringEngine();
  for (let coin = 0; coin < max.coins; coin++) perfect.recordCoin();
  for (let gate = 1; gate <= levels; gate++) perfect.recordCorrectAnswer(gate);
  perfect.recordSummitCompletion(60, levels, max.coins);
  assert(
    perfect.getState().totalXp === max.total,
    `${levels} level(s): a perfect run scores ${perfect.getState().totalXp}, max is ${max.total}`
  );
}
assert(calculateMaxStreakXp(1) === 0, 'One gate cannot build a streak');
assert(calculateMaxStreakXp(5) === 400, 'Streak XP is capped at 400');
console.log('✓ Max score table matches a perfect run for 1 to 5 levels.');

console.log('\nALL TESTS PASSED SUCCESSFULLY! 🎉');
