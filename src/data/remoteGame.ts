import type { CheckpointQuestion } from './towerConfig.ts';
import { normalizeQuestion } from './questionBank.ts';

/**
 * A game built in the Sherbeni admin is opened as `/?game=<id>`. Its levels
 * and question pools come from the backend's public play endpoint.
 */

interface PlayChoice {
  label: string;
  text: string;
}

interface PlayQuestion {
  id: string;
  text: string;
  image: string | null;
  choices: PlayChoice[];
  correctAnswer: number;
  /** Optional clue set in the admin; null or missing means no clue. */
  hint?: string | null;
}

interface PlayResponse {
  data?: {
    id: string;
    titleEn?: string | null;
    titleAr?: string | null;
    /** Score the student needs to continue the video; null when none is set. */
    passScore?: number | null;
    levels: { questions: PlayQuestion[] }[];
  };
}

export interface RemoteGame {
  levelCount: number;
  questions: CheckpointQuestion[];
  passScore: number | null;
}

const apiBaseUrl = String(import.meta.env?.VITE_API_URL ?? '').replace(/\/+$/, '');

/** Uploads are served from the API's origin, outside `/api/v1`. */
const uploadUrl = (path: string | null) => {
  if (!path || !apiBaseUrl) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  const origin = new URL(apiBaseUrl).origin;
  return `${origin}/${path.replace(/^\/+/, '')}`;
};

export function getRequestedGameId(): string | null {
  if (typeof window === 'undefined') return null;
  const id = new URLSearchParams(window.location.search).get('game')?.trim();
  return id || null;
}

export function toCheckpointQuestions(
  levels: { questions: PlayQuestion[] }[]
): CheckpointQuestion[] {
  return levels.flatMap((level, levelIndex) =>
    level.questions.map((question, questionIndex) =>
      normalizeQuestion(
        {
          id: question.id,
          checkpointNumber: levelIndex + 1,
          prompt: question.text,
          image: uploadUrl(question.image),
          options: question.choices.map((choice) => choice.text),
          correctAnswer: question.correctAnswer,
          hint: question.hint,
        },
        levelIndex + 1,
        questionIndex
      )
    )
  );
}

/**
 * Play token the student app puts in the link (`#token=...`). It is in the fragment so
 * it never reaches a server log, and it stays on reload so the Reload button still works.
 */
export function getPlayToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token')?.trim();
  return token || null;
}

export async function fetchRemoteGame(gameId: string, playToken: string | null): Promise<RemoteGame> {
  if (!apiBaseUrl) throw new Error('VITE_API_URL is not set');
  // Only send the header when there is a token: it makes the request CORS-preflighted,
  // and an API that predates X-Game-Token would refuse the preflight.
  const res = await fetch(`${apiBaseUrl}/video-games/${encodeURIComponent(gameId)}/play`, {
    headers: playToken ? { 'X-Game-Token': playToken } : undefined,
  });
  if (!res.ok) throw new Error(`Game request failed (${res.status})`);
  const body = (await res.json()) as PlayResponse;
  const levels = body.data?.levels ?? [];
  if (!levels.length || levels.some((level) => !level.questions?.length)) {
    throw new Error('Game has no questions');
  }
  const passScore = body.data?.passScore;
  return {
    levelCount: levels.length,
    questions: toCheckpointQuestions(levels),
    passScore: typeof passScore === 'number' && passScore > 0 ? passScore : null,
  };
}
