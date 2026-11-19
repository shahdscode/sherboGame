import { buildTowerGeometry, towerConfig } from './towerConfig.ts';
import { toCheckpointQuestions } from './remoteGame.ts';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`FAILED: ${message}`);
}

console.log('Testing tower geometry for 1..5 levels:');
const full = buildTowerGeometry(5);
assert(full.totalSteps === towerConfig.totalSteps, '5 levels keep the default 75 steps');
assert(full.groundY === towerConfig.groundY, '5 levels keep the default groundY');
assert(full.worldHeight === towerConfig.worldHeight, '5 levels keep the default world height');

const three = buildTowerGeometry(3);
assert(three.numberOfCheckpoints === 3, '3 levels give 3 gates');
assert(three.checkpointSteps.join() === '5,13,24', 'gates keep their step numbers');
assert(three.sectionSteps.join() === '4,7,10,13', 'one section per gate plus the summit climb');
assert(three.totalSteps === 4 + 7 + 10 + 13 + 3 + 1, 'sections + gates + summit');
assert(three.groundY === 380 + three.totalSteps * 108, 'ground follows the step count');

assert(buildTowerGeometry(0).numberOfCheckpoints === 1, 'clamped to at least 1 level');
assert(buildTowerGeometry(9).numberOfCheckpoints === 5, 'clamped to at most 5 levels');
console.log('✓ Geometry verified.');

console.log('Testing play response mapping:');
const questions = toCheckpointQuestions([
  {
    questions: [
      { id: 'a', text: '1 + 1?', image: null, choices: [{ label: 'A', text: '2' }, { label: 'B', text: '3' }], correctAnswer: 0 },
      { id: 'b', text: '2 + 2?', image: null, choices: [{ label: 'A', text: '3' }, { label: 'B', text: '4' }], correctAnswer: 1 },
    ],
  },
  {
    questions: [
      { id: 'c', text: '3 x 3?', image: null, choices: [{ label: 'A', text: '9' }, { label: 'B', text: '6' }], correctAnswer: 0 },
    ],
  },
]);
assert(questions.length === 3, 'every pool question is kept');
assert(questions.filter((q) => q.checkpointNumber === 1).length === 2, 'level 1 pool has 2 questions');
assert(questions[1].correctAnswer === 1 && questions[1].options[1] === '4', 'correct answer index kept');
assert(questions[2].checkpointNumber === 2 && questions[2].prompt === '3 x 3?', 'level 2 question mapped');
assert(questions[0].image === undefined, 'no image without an upload');
console.log('✓ Mapping verified.');
console.log('ALL TOWER GEOMETRY TESTS PASSED! 🎉');
