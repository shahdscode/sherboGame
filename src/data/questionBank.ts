import { towerConfig, type CheckpointQuestion } from './towerConfig.ts';
import defaultQuestionsData from './questions.json' with { type: 'json' };

/**
 * Normalizes a raw question object into a strictly typed CheckpointQuestion.
 * Handles forgiving conversions such as string checkpoint numbers and letter correct answers ('A', 'B', 'C', 'D').
 */
export function normalizeQuestion(
  raw: any,
  fallbackCheckpoint: number = 1,
  fallbackIndex: number = 0
): CheckpointQuestion {
  if (!raw || typeof raw !== 'object') {
    return createFallbackQuestion(fallbackCheckpoint, fallbackIndex);
  }

  // Parse checkpoint number
  let checkpointNumber = Number(raw.checkpointNumber);
  if (!Number.isFinite(checkpointNumber) || checkpointNumber < 1) {
    checkpointNumber = fallbackCheckpoint;
  }

  // Parse ID
  const id =
    typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.trim()
      : `cp${checkpointNumber}-q${fallbackIndex + 1}`;

  // Parse title & prompt
  const title =
    typeof raw.title === 'string' && raw.title.trim()
      ? raw.title.trim()
      : `Gate ${checkpointNumber} Challenge`;
  const prompt =
    typeof raw.prompt === 'string' && raw.prompt.trim()
      ? raw.prompt.trim()
      : 'Choose the correct answer to unlock the gate!';

  // Parse options
  let options: string[] = [];
  if (Array.isArray(raw.options)) {
    options = raw.options.map((opt: any) => String(opt ?? ''));
  }
  if (options.length < 2) {
    options = ['Option A', 'Option B', 'Option C', 'Option D'];
  }

  // Parse correct answer (supports 0-based index or letters 'A'|'B'|'C'|'D' or 1-based index string)
  let correctAnswer = 0;
  if (typeof raw.correctAnswer === 'number' && Number.isFinite(raw.correctAnswer)) {
    correctAnswer = Math.max(0, Math.min(options.length - 1, Math.floor(raw.correctAnswer)));
  } else if (typeof raw.correctAnswer === 'string') {
    const trimmed = raw.correctAnswer.trim().toUpperCase();
    if (trimmed === 'A') correctAnswer = 0;
    else if (trimmed === 'B') correctAnswer = 1;
    else if (trimmed === 'C') correctAnswer = 2;
    else if (trimmed === 'D') correctAnswer = 3;
    else {
      const parsed = parseInt(trimmed, 10);
      if (Number.isFinite(parsed)) {
        // If 1-based provided (1..4) where length is 4, map to 0-based if > options.length - 1
        correctAnswer = parsed >= options.length ? parsed - 1 : parsed;
        correctAnswer = Math.max(0, Math.min(options.length - 1, correctAnswer));
      }
    }
  }

  // Optional sequence stones
  let sequence: string[] | undefined;
  if (Array.isArray(raw.sequence) && raw.sequence.length > 0) {
    sequence = raw.sequence.map((s: any) => String(s ?? ''));
  }

  const hint =
    typeof raw.hint === 'string' && raw.hint.trim()
      ? raw.hint.trim()
      : 'Look closely at the pattern between the steps!';

  const explanation =
    typeof raw.explanation === 'string' && raw.explanation.trim()
      ? raw.explanation.trim()
      : `Option ${String.fromCharCode(65 + correctAnswer)} is correct!`;

  const image =
    typeof raw.image === 'string' && /^https?:///i.test(raw.image.trim())
      ? raw.image.trim()
      : undefined;

  return {
    id,
    checkpointNumber,
    title,
    prompt,
    sequence,
    options,
    correctAnswer,
    hint,
    explanation,
    image,
  };
}

/**
 * Creates a safe fallback question if a checkpoint pool is completely empty.
 */
function createFallbackQuestion(
  checkpointNumber: number,
  index: number = 0
): CheckpointQuestion {
  return {
    id: `fallback-cp${checkpointNumber}-${index + 1}`,
    checkpointNumber,
    title: `Checkpoint ${checkpointNumber} Gate`,
    prompt: `Solve the gate challenge for Checkpoint ${checkpointNumber}:`,
    options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
    correctAnswer: 0,
    hint: 'Select the first option to proceed.',
    explanation: 'Correct! The checkpoint gate is now open.',
  };
}

/**
 * Parses and normalizes questions from any JSON structure:
 * - Array: [ { ... }, { ... } ]
 * - Wrapped: { "questions": [ ... ] }
 * - Object keyed by checkpoint: { "1": [ ... ], "2": [ ... ] }
 */
export function parseQuestionBank(data: any): CheckpointQuestion[] {
  if (!data) return [];

  // Case 1: Simple array
  if (Array.isArray(data)) {
    return data
      .map((item, idx) => normalizeQuestion(item, 1, idx))
      .filter(Boolean);
  }

  // Case 2: Object with "questions" array
  if (typeof data === 'object' && Array.isArray(data.questions)) {
    return data.questions
      .map((item: any, idx: number) => normalizeQuestion(item, 1, idx))
      .filter(Boolean);
  }

  // Case 3: Object keyed by checkpoint number or name
  if (typeof data === 'object') {
    const questions: CheckpointQuestion[] = [];
    Object.keys(data).forEach((key) => {
      const match = key.match(/\d+/);
      const cpNum = match ? parseInt(match[0], 10) : 1;
      const val = data[key];
      if (Array.isArray(val)) {
        val.forEach((q, idx) => {
          questions.push(normalizeQuestion(q, cpNum, idx));
        });
      } else if (typeof val === 'object' && val !== null) {
        questions.push(normalizeQuestion(val, cpNum, 0));
      }
    });
    return questions;
  }

  return [];
}

/**
 * Default question bank parsed from src/data/questions.json.
 */
export const defaultQuestionBank: CheckpointQuestion[] = parseQuestionBank(defaultQuestionsData);

/**
 * Returns all questions belonging to a specific checkpoint.
 */
export function getCheckpointPool(
  bank: CheckpointQuestion[] = defaultQuestionBank,
  checkpointNumber: number
): CheckpointQuestion[] {
  const pool = bank.filter((q) => q.checkpointNumber === checkpointNumber);
  return pool.length > 0 ? pool : [createFallbackQuestion(checkpointNumber)];
}

/**
 * Fisher-Yates shuffle returning a new shuffled array.
 */
export function shuffleArray<T>(items: T[], rng: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Creates a shuffled cycle of a checkpoint's questions, avoiding `avoidFirstId`
 * as the first item whenever multiple questions exist.
 */
export function createCheckpointCycle(
  pool: CheckpointQuestion[],
  avoidFirstId?: string,
  rng: () => number = Math.random
): CheckpointQuestion[] {
  if (pool.length <= 1) return [...pool];
  const shuffled = shuffleArray(pool, rng);
  if (avoidFirstId && shuffled[0].id === avoidFirstId) {
    const swapIdx = 1 + Math.floor(rng() * (shuffled.length - 1));
    [shuffled[0], shuffled[swapIdx]] = [shuffled[swapIdx], shuffled[0]];
  }
  return shuffled;
}

export interface CheckpointRotationState {
  queue: CheckpointQuestion[];
  currentIndex: number;
  lastShownId?: string;
}

/**
 * Initializes a randomized 3-question rotation for a checkpoint.
 */
export function initCheckpointRotation(
  pool: CheckpointQuestion[],
  rng: () => number = Math.random
): CheckpointRotationState {
  const queue = createCheckpointCycle(pool, undefined, rng);
  return {
    queue,
    currentIndex: 0,
    lastShownId: queue[0]?.id,
  };
}

/**
 * Advances to the next question in the checkpoint rotation.
 * Once all questions in the cycle are attempted, reshuffles the pool
 * while avoiding showing the same question twice consecutively.
 */
export function advanceCheckpointRotation(
  state: CheckpointRotationState,
  pool: CheckpointQuestion[],
  rng: () => number = Math.random
): CheckpointRotationState {
  const nextIdx = state.currentIndex + 1;
  if (nextIdx < state.queue.length) {
    return {
      queue: state.queue,
      currentIndex: nextIdx,
      lastShownId: state.queue[nextIdx].id,
    };
  }
  const newQueue = createCheckpointCycle(pool, state.lastShownId, rng);
  return {
    queue: newQueue,
    currentIndex: 0,
    lastShownId: newQueue[0]?.id,
  };
}

/**
 * Selects 1 question per checkpoint (1 through the tower's number of levels) from the question bank.
 * If multiple questions exist for a checkpoint, one is randomly selected to give variety on every run.
 */
export function selectSessionQuestions(
  bank: CheckpointQuestion[] = defaultQuestionBank,
  totalCheckpoints: number = towerConfig.numberOfCheckpoints
): CheckpointQuestion[] {
  const selected: CheckpointQuestion[] = [];

  for (let cp = 1; cp <= totalCheckpoints; cp++) {
    const pool = bank.filter((q) => q.checkpointNumber === cp);
    if (pool.length === 0) {
      selected.push(createFallbackQuestion(cp));
    } else if (pool.length === 1) {
      selected.push(pool[0]);
    } else {
      const randomIndex = Math.floor(Math.random() * pool.length);
      selected.push(pool[randomIndex]);
    }
  }

  return selected;
}

/**
 * Attempts to asynchronously fetch the latest questions.json from public folder in browser runtime.
 * Returns null if running in test / non-browser or if fetch fails.
 */
export async function fetchQuestionsFromPublic(): Promise<CheckpointQuestion[] | null> {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
    return null;
  }

  try {
    const res = await window.fetch(`/questions.json?t=${Date.now()}`);
    if (!res.ok) return null;
    const json = await res.json();
    const bank = parseQuestionBank(json);
    return bank.length > 0 ? bank : null;
  } catch {
    return null;
  }
}
