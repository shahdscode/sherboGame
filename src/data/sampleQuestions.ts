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
    title: 'Finding the Common Ratio',
    prompt:
      'In the geometric sequence 3, 6, 12, 24, 48, ... what is the common ratio (r) between consecutive terms?',
    options: ['r = 2', 'r = 3', 'r = 4', 'r = 6'],
    correctAnswer: 0,
    hint: 'Divide any term in the sequence by the term immediately before it (for example, 6 ÷ 3 or 12 ÷ 6).',
    explanation:
      'Each term is multiplied by 2 to get the next term (6 ÷ 3 = 2, 12 ÷ 6 = 2), so the common ratio r is 2.',
  },
  {
    id: 'checkpoint-2',
    checkpointNumber: 2,
    title: 'Predicting the Next Term',
    prompt:
      'What is the next term in the geometric sequence 5, 15, 45, 135, ... ?',
    options: ['270', '395', '405', '675'],
    correctAnswer: 2,
    hint: 'First find the common ratio by dividing 15 by 5, then multiply 135 by that ratio.',
    explanation:
      'The common ratio is 3 (15 ÷ 5 = 3). Multiplying the fourth term 135 by 3 gives 405.',
  },
  {
    id: 'checkpoint-3',
    checkpointNumber: 3,
    title: 'Decreasing Geometric Sequences',
    prompt:
      'A geometric sequence starts with 160, 80, 40, 20, ... What is the 6th term of this sequence?',
    options: ['10', '5', '2.5', '0'],
    correctAnswer: 1,
    hint: 'Notice that each step halves the previous number (r = 0.5). Find the 5th term after 20 first, then halve it once more.',
    explanation:
      'With common ratio r = 1/2, the 5th term is 20 × 1/2 = 10, and the 6th term is 10 × 1/2 = 5.',
  },
  {
    id: 'checkpoint-4',
    checkpointNumber: 4,
    title: 'Explicit Formula of a Geometric Sequence',
    prompt:
      'Which explicit formula gives the n-th term (aₙ) of a geometric sequence with first term a₁ = 4 and common ratio r = 3?',
    options: [
      'aₙ = 4 + 3(n - 1)',
      'aₙ = 3 · 4^(n - 1)',
      'aₙ = 4 · 3^(n - 1)',
      'aₙ = (4 · 3)^(n - 1)',
    ],
    correctAnswer: 2,
    hint: 'Recall the general geometric sequence formula: aₙ = a₁ · r^(n - 1), where a₁ is the starting value.',
    explanation:
      'Using the general formula aₙ = a₁ · r^(n - 1) with a₁ = 4 and r = 3 yields aₙ = 4 · 3^(n - 1).',
  },
  {
    id: 'checkpoint-5',
    checkpointNumber: 5,
    title: 'Alternating Signs in Sequences',
    prompt:
      'Look at the sequence 2, -6, 18, -54, ... What is the 5th term in this sequence?',
    options: ['-162', '108', '162', '-108'],
    correctAnswer: 2,
    hint: 'What negative number do you multiply 2 by to get -6? Multiply -54 by that same negative number.',
    explanation:
      'The common ratio is r = -3. Multiplying the 4th term (-54) by -3 results in positive 162.',
  },
];
