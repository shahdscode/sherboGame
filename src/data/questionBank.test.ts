function assert(condition: boolean, msg?: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg || 'unknown condition'}`);
  }
}

import {
  defaultQuestionBank,
  selectSessionQuestions,
  parseQuestionBank,
  normalizeQuestion,
  getCheckpointPool,
  initCheckpointRotation,
  advanceCheckpointRotation,
} from './questionBank.ts';

console.log('Running Question Bank unit tests...');

// 1. Verify defaultQuestionBank loaded from src/data/questions.json (all 15 PDF questions)
assert(Array.isArray(defaultQuestionBank), 'defaultQuestionBank should be an array');
assert(defaultQuestionBank.length === 15, `defaultQuestionBank must have exactly 15 questions (found ${defaultQuestionBank.length})`);

for (let cp = 1; cp <= 5; cp++) {
  const pool = getCheckpointPool(defaultQuestionBank, cp);
  assert(pool.length === 3, `Checkpoint ${cp} must have exactly 3 questions (found ${pool.length})`);
  assert(pool.every((q) => q.checkpointNumber === cp), `Checkpoint ${cp} pool must only contain checkpoint ${cp} questions`);
}

// Verify exact model answers from Model Answer PDF: 1:a(0), 2:b(1), 3:c(2), 4:d(3), 5:b(1), 6:c(2), 7:a(0), 8:b(1), 9:c(2), 10:b(1), 11:c(2), 12:a(0), 13:a(0), 14:b(1), 15:d(3)
const expectedAnswers = [0, 1, 2, 3, 1, 2, 0, 1, 2, 1, 2, 0, 0, 1, 3];
defaultQuestionBank.forEach((q, idx) => {
  assert(
    q.correctAnswer === expectedAnswers[idx],
    `Question ${idx + 1} (${q.id}) expected correctAnswer ${expectedAnswers[idx]}, got ${q.correctAnswer}`
  );
});
console.log('✓ All 15 PDF questions and Model Answers verified across 5 checkpoints (3 per checkpoint).');

// 2. Test selectSessionQuestions
const session = selectSessionQuestions(defaultQuestionBank);
assert(session.length === 5, 'Session should have exactly 5 questions (1 per checkpoint)');
session.forEach((q, idx) => {
  assert(q.checkpointNumber === idx + 1, `Question ${idx} must be for checkpoint ${idx + 1}`);
  assert(Array.isArray(q.options) && q.options.length >= 2, 'Must have at least 2 options');
  assert(q.correctAnswer >= 0 && q.correctAnswer < q.options.length, 'Correct answer index within bounds');
});
console.log('✓ Session selection successfully picked 1 question per checkpoint.');

// 3. Test parseQuestionBank with various JSON shapes
// 3a. Direct Array
const rawArray = [
  { checkpointNumber: 1, prompt: 'Q1', options: ['A', 'B'], correctAnswer: 0 },
  { checkpointNumber: 2, prompt: 'Q2', options: ['X', 'Y'], correctAnswer: 1 },
];
const parsedArray = parseQuestionBank(rawArray);
assert(parsedArray.length === 2, 'Should parse 2 array items');
assert(parsedArray[0].checkpointNumber === 1);
assert(parsedArray[1].correctAnswer === 1);

// 3b. Wrapped { questions: [...] }
const rawWrapped = {
  questions: [
    { checkpointNumber: 1, prompt: 'Wrapped Q1', options: ['A', 'B', 'C', 'D'], correctAnswer: 'B' },
  ],
};
const parsedWrapped = parseQuestionBank(rawWrapped);
assert(parsedWrapped.length === 1);
assert(parsedWrapped[0].correctAnswer === 1, 'Letter B should map to index 1');

// 3c. Grouped by checkpoint object { "1": [...], "2": [...] }
const rawGrouped = {
  "1": [{ prompt: 'Grouped CP1', options: ['A', 'B'], correctAnswer: 'A' }],
  "2": [{ prompt: 'Grouped CP2', options: ['A', 'B'], correctAnswer: 'B' }],
};
const parsedGrouped = parseQuestionBank(rawGrouped);
assert(parsedGrouped.length === 2);
assert(parsedGrouped[0].checkpointNumber === 1);
assert(parsedGrouped[0].correctAnswer === 0);
assert(parsedGrouped[1].checkpointNumber === 2);
assert(parsedGrouped[1].correctAnswer === 1);
console.log('✓ JSON shape compatibility verified (array, wrapped, and grouped).');

// 4. Test normalizeQuestion forgiving inputs
const qLetters = normalizeQuestion({
  checkpointNumber: "3",
  title: "Letter Test",
  prompt: "Which is correct?",
  options: ["Alpha", "Beta", "Gamma", "Delta"],
  correctAnswer: "C",
});
assert(qLetters.checkpointNumber === 3, 'String checkpointNumber should be converted to number');
assert(qLetters.correctAnswer === 2, 'Letter C should map to index 2');

const q1Based = normalizeQuestion({
  checkpointNumber: 1,
  options: ["First", "Second", "Third", "Fourth"],
  correctAnswer: "4", // 1-based "4" should map to index 3
});
assert(q1Based.correctAnswer === 3, '1-based string 4 should clamp to index 3');

// 5. Test empty checkpoint pool fallback
const emptyBank = [
  { id: 'only-cp1', checkpointNumber: 1, title: 'T', prompt: 'P', options: ['A', 'B'], correctAnswer: 0, hint: '', explanation: '' }
];
const sessionWithFallbacks = selectSessionQuestions(emptyBank);
assert(sessionWithFallbacks.length === 5, 'Should still produce 5 questions using fallbacks');
assert(sessionWithFallbacks[0].id === 'only-cp1');
assert(sessionWithFallbacks[1].checkpointNumber === 2);
assert(sessionWithFallbacks[4].checkpointNumber === 5);
console.log('✓ Forgiving parser and fallback logic verified.');

// 6. Test 3-question rotation, reshuffling, indefinite repetition, and no consecutive repeats
for (let cp = 1; cp <= 5; cp++) {
  const pool = getCheckpointPool(defaultQuestionBank, cp);
  let rot = initCheckpointRotation(pool);
  let previousId: string | undefined;

  // Simulate 12 consecutive wrong attempts (4 full cycles of 3 questions)
  for (let cycle = 0; cycle < 4; cycle++) {
    const seenInCycle = new Set<string>();
    for (let step = 0; step < 3; step++) {
      const current = rot.queue[rot.currentIndex];
      assert(current.checkpointNumber === cp, `Must stay in checkpoint ${cp}`);
      assert(current.id !== previousId, `Must never show same question twice consecutively (${current.id})`);
      seenInCycle.add(current.id);
      previousId = current.id;
      rot = advanceCheckpointRotation(rot, pool);
    }
    assert(seenInCycle.size === 3, `All 3 questions must be shown once before repeating in cycle ${cycle}`);
  }
}
console.log('✓ 3-question rotation, reshuffling, indefinite retry, and no-consecutive-repeat verified.');

console.log('ALL QUESTION BANK TESTS PASSED! 🎉');
