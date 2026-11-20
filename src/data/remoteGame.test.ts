function assert(condition: boolean, msg?: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg || 'unknown condition'}`);
  }
}

import { toCheckpointQuestions } from './remoteGame.ts';

console.log('Running remote game unit tests...');

const question = (id: string, hint?: string | null) => ({
  id,
  text: '3 x 4?',
  image: null,
  choices: [
    { label: 'A', text: '11' },
    { label: 'B', text: '12' },
  ],
  correctAnswer: 1,
  ...(hint === undefined ? {} : { hint }),
});

const [withClue, nullClue, savedBeforeClues] = toCheckpointQuestions([
  { questions: [question('q1', 'Add 4 three times'), question('q2', null), question('q3')] },
]);

assert(withClue.hint === 'Add 4 three times', 'The clue from the API must be used');
assert(nullClue.hint === '', 'A null clue must hide the clue button');
assert(savedBeforeClues.hint === '', 'A question saved before clues must have no clue');
assert(withClue.correctAnswer === 1 && withClue.checkpointNumber === 1, 'Other fields still map');

const orderedQuestions = toCheckpointQuestions([
  { questions: [question('first'), question('second')] },
  { questions: [question('third')] },
]);
assert(
  orderedQuestions.map((item) => item.id).join(',') === 'first,second,third',
  'Remote questions must retain backend level and question order'
);
assert(
  orderedQuestions[0].options.join(',') === '11,12',
  'Remote answer choices must retain backend order'
);

console.log('ALL REMOTE GAME TESTS PASSED! 🎉');
