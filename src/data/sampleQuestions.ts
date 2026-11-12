import { CheckpointQuestion } from './towerConfig';

/**
 * Configurable Checkpoint Questions.
 * Replace this array with questions for any subject (Mathematics, Science, Programming, History, etc.)
 * without modifying the Phaser game engine or React UI components.
 * There are 5 checkpoints (Steps 5, 10, 15, 20, 25); Step 30 is the Finish Line.
 */
export const checkpointQuestions: CheckpointQuestion[] = [
  {
    id: 'checkpoint-1',
    checkpointNumber: 1,
    title: 'Multiplier Lock',
    prompt:
      'Crack the gate code! What multiplier (r) powers each stone to the next?',
    sequence: ['3', '6', '12', '24', '48'],
    options: ['r = 2', 'r = 3', 'r = 4', 'r = 6'],
    correctAnswer: 0,
    hint: 'Divide any stone by the stone right before it (6 ÷ 3 or 12 ÷ 6).',
    explanation:
      'Every step doubles the stone before it (3 × 2 = 6, 6 × 2 = 12) — multiplier r = 2!',
  },
  {
    id: 'checkpoint-2',
    checkpointNumber: 2,
    title: 'Missing Power Stone',
    prompt:
      'Power up the next platform! Which number belongs on the [ ? ] stone?',
    sequence: ['5', '15', '45', '135', '?'],
    options: ['270', '395', '405', '675'],
    correctAnswer: 2,
    hint: 'Each stone triples (× 3). Multiply 135 by 3 to power the next stone!',
    explanation:
      'The pattern triples every step (r = 3), so 135 × 3 = 405 unlocks the gate!',
  },
  {
    id: 'checkpoint-3',
    checkpointNumber: 3,
    title: 'Shrinking Spell',
    prompt:
      'Each stone halves in power! What value unlocks the 6th stone [ ? ]?',
    sequence: ['160', '80', '40', '20', '10', '?'],
    options: ['10', '5', '2.5', '0'],
    correctAnswer: 1,
    hint: 'Every jump divides by 2 (× ½). Cut 10 in half one more time!',
    explanation:
      'Halving at each step gives 20 → 10 on the 5th stone, and 10 ÷ 2 = 5 on the 6th!',
  },
  {
    id: 'checkpoint-4',
    checkpointNumber: 4,
    title: 'Master Rune Formula',
    prompt:
      'Forge the nth-stone spell (aₙ) when the 1st stone is a₁ = 4 and multiplier is r = 3:',
    sequence: ['a₁ = 4', '× 3', '12', '× 3', '36', 'aₙ = ?'],
    options: [
      'aₙ = 4 + 3(n - 1)',
      'aₙ = 3 · 4^(n - 1)',
      'aₙ = 4 · 3^(n - 1)',
      'aₙ = (4 · 3)^(n - 1)',
    ],
    correctAnswer: 2,
    hint: 'Use the geometric rune rule: aₙ = (first stone a₁) · r^(n - 1).',
    explanation:
      'Starting at a₁ = 4 and multiplying by r = 3 each step gives aₙ = 4 · 3^(n - 1)!',
  },
  {
    id: 'checkpoint-5',
    checkpointNumber: 5,
    title: 'Flip-Sign Boss Gate',
    prompt:
      'Watch the signs flip! What number lands on the 5th stone [ ? ]?',
    sequence: ['2', '-6', '18', '-54', '?'],
    options: ['-162', '108', '162', '-108'],
    correctAnswer: 2,
    hint: 'Multiply by -3 each time! Remember: a negative times a negative turns positive.',
    explanation:
      'The multiplier is r = -3, so (-54) × (-3) = +162 smashes the final gate!',
  },
];
