import {
  ScoringEngine,
  calculateGateQuestionXp,
  calculateSpeedXp,
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
assert(calculateGateQuestionXp(1) === 500, 'Attempt 1 must award 500 XP');
assert(calculateGateQuestionXp(2) === 400, 'Attempt 2 must award 400 XP');
assert(calculateGateQuestionXp(3) === 300, 'Attempt 3 must award 300 XP');
assert(calculateGateQuestionXp(4) === 250, 'Attempt 4 must award 250 XP');
assert(calculateGateQuestionXp(5) === 250, 'Attempt 5 must award 250 XP');
assert(calculateGateQuestionXp(10) === 250, 'Attempt 10 must award 250 XP floor');
console.log('✓ Question XP values verified.');

// 2. Speed XP calculation tests
console.log('\nTesting calculateSpeedXp:');
assert(calculateSpeedXp(45) === 600, '45s must yield 600 XP');
assert(calculateSpeedXp(60) === 600, '60s must yield 600 XP');
assert(calculateSpeedXp(90) === 525, '90s must yield 525 XP');
assert(calculateSpeedXp(120) === 450, '120s must yield 450 XP');
assert(calculateSpeedXp(180) === 300, '180s must yield 300 XP');
assert(calculateSpeedXp(240) === 150, '240s must yield 150 XP');
assert(calculateSpeedXp(300) === 0, '300s must yield 0 XP');
assert(calculateSpeedXp(360) === 0, '360s must yield 0 XP (no negative)');
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
  eng1.recordCorrectAnswer(g, 4.0); // all < 5s
}
eng1.recordSummitCompletion(50, 5);
const st1 = eng1.getState();
assert(sumQuestionXp(st1.gateQuestionXp) === 2500, 'Question XP must be 2,500');
assert(st1.streakXp === 400, 'Streak XP must be 400 (capped at 400)');
assert(st1.summitXp === 300, 'Summit XP must be 300');
assert(st1.speedXp === 600, 'Speed XP must be 600');
assert(st1.unlockedAchievements.includes('UNTOUCHABLE'), 'Must unlock UNTOUCHABLE');
assert(st1.unlockedAchievements.includes('LIGHTNING_FAST'), 'Must unlock LIGHTNING_FAST');
assert(!st1.unlockedAchievements.includes('PHOENIX_COMEBACK'), 'Must NOT unlock PHOENIX_COMEBACK');
// Base = 2500 + 400 + 300 + 600 = 3800
// Achievements = 150 (Untouchable) + 50 (Lightning Fast) = 200
assert(st1.totalXp === 4000, `Total XP must be 4000, got ${st1.totalXp}`);
console.log('✓ TEST 1 passed.');

// 5. TEST 2: STRONG RUN (4 first try, 1 on second try, 120s)
console.log('\nTesting TEST 2 - STRONG RUN (120s):');
const eng2 = new ScoringEngine();
eng2.recordCorrectAnswer(1, 6.0); // 500
eng2.recordIncorrectAttempt(2);   // mistake
eng2.recordCorrectAnswer(2, 6.0); // 400
eng2.recordCorrectAnswer(3, 6.0); // 500, post mistake #1
eng2.recordCorrectAnswer(4, 6.0); // 500, post mistake #2 -> unlocks PHOENIX_COMEBACK
eng2.recordCorrectAnswer(5, 6.0); // 500
eng2.recordSummitCompletion(120, 5);
const st2 = eng2.getState();
assert(sumQuestionXp(st2.gateQuestionXp) === 2400, 'Question XP must be 2400');
assert(st2.speedXp === 450, 'Speed XP must be 450');
assert(st2.summitXp === 300, 'Summit XP must be 300');
assert(st2.unlockedAchievements.includes('PHOENIX_COMEBACK'), 'Phoenix Comeback must be unlocked');
assert(!st2.unlockedAchievements.includes('UNTOUCHABLE'), 'Untouchable must NOT be unlocked');
console.log('✓ TEST 2 passed.');

// 6. TEST 3: COMEBACK
console.log('\nTesting TEST 3 - COMEBACK:');
const eng3 = new ScoringEngine();
eng3.recordIncorrectAttempt(1);
eng3.recordCorrectAnswer(1, 10.0);
eng3.recordCorrectAnswer(2, 10.0);
eng3.recordCorrectAnswer(3, 10.0);
const st3 = eng3.getState();
assert(st3.unlockedAchievements.includes('PHOENIX_COMEBACK'), 'Phoenix Comeback must unlock');
assert(st3.achievementXp === 75, 'Achievement XP must be 75');
console.log('✓ TEST 3 passed.');

// 7. TEST 4: SLOW RUN (360s)
console.log('\nTesting TEST 4 - SLOW RUN (360s):');
const eng4 = new ScoringEngine();
for (let g = 1; g <= 5; g++) {
  eng4.recordCorrectAnswer(g, 72.0);
}
eng4.recordSummitCompletion(360, 5);
const st4 = eng4.getState();
assert(st4.speedXp === 0, 'Speed XP must be 0');
assert(st4.summitXp === 300, 'Summit XP must still be awarded');
assert(sumQuestionXp(st4.gateQuestionXp) === 2500, 'Question XP must be 2500');
console.log('✓ TEST 4 passed.');

// 8. TEST 5: DUPLICATE EVENT IDEMPOTENCY
console.log('\nTesting TEST 5 - DUPLICATE EVENT IDEMPOTENCY:');
const eng5 = new ScoringEngine();
const gate1First = eng5.recordCorrectAnswer(1, 4.0);
assert(gate1First.questionXpEarned === 500, 'First solve must earn 500');
const gate1Dupe = eng5.recordCorrectAnswer(1, 4.0);
assert(gate1Dupe.questionXpEarned === 0, 'Duplicate solve must earn 0');
const sum1 = eng5.recordSummitCompletion(50, 1);
assert(sum1.summitXpEarned === 300, 'Summit completion must earn 300');
const sum2 = eng5.recordSummitCompletion(50, 1);
assert(sum2.summitXpEarned === 0, 'Duplicate summit completion must earn 0');
console.log('✓ TEST 5 passed.');

// 9. Negative deductions test:
console.log('\nTesting No-Negative-Deduction rule:');
const eng6 = new ScoringEngine();
eng6.recordCorrectAnswer(1, 10.0); // +500
const scoreAfterGate1 = eng6.getState().totalXp;
assert(scoreAfterGate1 === 500, 'Initial score is 500');
// Now 5 wrong attempts at gate 2:
for (let i = 0; i < 5; i++) {
  eng6.recordIncorrectAttempt(2);
}
assert(eng6.getState().totalXp === scoreAfterGate1, 'Total XP must NEVER decrease from mistakes');
// Eventually solves gate 2 on 6th attempt:
const solveGate2 = eng6.recordCorrectAnswer(2, 10.0);
assert(solveGate2.questionXpEarned === 250, 'Minimum floor of 250 XP guaranteed');
assert(eng6.getState().totalXp === 750, 'Total XP after floor is 750');
console.log('✓ No-Negative-Deductions and Floor verified.');

console.log('\nALL TESTS PASSED SUCCESSFULLY! 🎉');
