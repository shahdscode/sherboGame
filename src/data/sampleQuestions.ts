import type { CheckpointQuestion } from './towerConfig.ts';
import { defaultQuestionBank, selectSessionQuestions } from './questionBank.ts';

/**
 * Checkpoint questions loaded from the question bank (src/data/questions.json).
 * You can edit src/data/questions.json or public/questions.json directly to add or edit questions!
 */
export const checkpointQuestions: CheckpointQuestion[] =
  defaultQuestionBank.length > 0
    ? selectSessionQuestions(defaultQuestionBank)
    : [];
