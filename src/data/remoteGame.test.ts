function assert(condition: boolean, msg?: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg || 'unknown condition'}`);
  }
}

import { getPlayToken, toCheckpointQuestions } from './remoteGame.ts';

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

const fraction = { kind: 'math' as const, value: '<math xmlns="http://www.w3.org/1998/Math/MathML"><mfrac><mn>1</mn><mn>2</mn></mfrac></math>' };
const [rich] = toCheckpointQuestions([{ questions: [{
  ...question('rich'),
  content: [{ kind: 'text', value: 'أوجد قيمة ' }, fraction],
  choices: [
    { label: 'A', text: '1/4' },
    { label: 'B', text: '1/2', content: [fraction] },
  ],
}] }]);
assert(rich.promptContent?.[1].value === fraction.value, 'Inline formulas reach the prompt');
assert(rich.optionContents?.[0] === undefined, 'Plain choices retain the fallback');
assert(rich.optionContents?.[rich.correctAnswer]?.[0].value === fraction.value, 'Formula matches correct option');

// Play token from the link fragment the student app builds (`?game=<id>#token=<jwt>`)
const withHash = (hash: string) => {
  (globalThis as unknown as { window: unknown }).window = { location: { hash } };
  return getPlayToken();
};
assert(withHash('#token=abc.def.ghi') === 'abc.def.ghi', 'Play token must be read from #token=');
assert(withHash('') === null, 'No fragment means no play token');
assert(withHash('#token=') === null, 'An empty token is no token');
delete (globalThis as unknown as { window?: unknown }).window;

console.log('ALL REMOTE GAME TESTS PASSED! 🎉');
