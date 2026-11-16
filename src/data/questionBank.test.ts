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
} from './questionBank.ts';

console.log('Running Question Bank unit tests...');

// 1. Verify defaultQuestionBank loaded from src/data/questions.json
assert(Array.isArray(defaultQuestionBank), 'defaultQuestionBank should be an array');
assert(defaultQuestionBank.length >= 5, 'defaultQuestionBank should have at least 5 questions');

for (let cp = 1; cp <= 5; cp++) {
  const count = defaultQuestionBank.filter((q) => q.checkpointNumber === cp).length;
  assert(count >= 1, `Checkpoint ${cp} must have at least 1 question in bank (found ${count})`);
}
console.log('✓ Default question bank loaded successfully with all 5 checkpoints.');

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

console.log('ALL QUESTION BANK TESTS PASSED! 🎉');
