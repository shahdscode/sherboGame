export interface GameCompletionPayload {
  type: 'GAME_COMPLETED';
  event: 'sherbo_tower_completed';
  completed: true;
  success: true;
  gameId: 'sherbo-tower';
  score: number;
  grade: string;
  gradeName: string;
  elapsedTimeSeconds: number;
  totalAttempts: number;
  firstTryCount: number;
  timestamp: number;
}

export interface CompletionDataInput {
  score: number;
  grade: string;
  gradeName?: string;
  elapsedTimeSeconds: number;
  totalAttempts: number;
  firstTryCount: number;
}

/**
 * Notifies the hosting educational platform that the student has completed the game
 * and reached the finish line.
 *
 * Supports all standard LMS / platform integration methods:
 * 1. window.parent.postMessage (iframe embeds)
 * 2. window.top.postMessage (nested iframes)
 * 3. window.opener.postMessage (popups / new tabs)
 * 4. window.dispatchEvent(CustomEvent) (same-page integration)
 * 5. Window callback functions (window.onSherboGameComplete, window.parent.onSherboGameComplete)
 * 6. Storage flags (localStorage.setItem('sherbo_game_completed', 'true'))
 */
export function notifyPlatformGameCompleted(data: CompletionDataInput): GameCompletionPayload {
  const payload: GameCompletionPayload = {
    type: 'GAME_COMPLETED',
    event: 'sherbo_tower_completed',
    completed: true,
    success: true,
    gameId: 'sherbo-tower',
    score: data.score,
    grade: data.grade,
    gradeName: data.gradeName || '',
    elapsedTimeSeconds: data.elapsedTimeSeconds,
    totalAttempts: data.totalAttempts,
    firstTryCount: data.firstTryCount,
    timestamp: Date.now(),
  };

  if (typeof window === 'undefined') {
    return payload;
  }

  // 1. PostMessage to parent window (standard LMS / educational platform iframe embed)
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(payload, '*');
    }
  } catch {
    // Ignore cross-origin access errors
  }

  // 2. PostMessage to top window (if inside nested iframes)
  try {
    if (window.top && window.top !== window && window.top !== window.parent) {
      window.top.postMessage(payload, '*');
    }
  } catch {
    // Ignore cross-origin access errors
  }

  // 3. PostMessage to opener (if opened in a separate window or tab)
  try {
    if (window.opener && window.opener !== window) {
      window.opener.postMessage(payload, '*');
    }
  } catch {
    // Ignore cross-origin access errors
  }

  // 4. Custom DOM event on both window and document (for same-page React/Vue/vanilla integrations)
  try {
    const customEvent = new CustomEvent('sherboGameCompleted', {
      bubbles: true,
      composed: true,
      detail: payload,
    });
    // Dispatch ONCE on document: the event bubbles up to window, so listeners on either
    // receive it exactly one time (dispatching on both made window listeners fire twice).
    document.dispatchEvent(customEvent);
  } catch {
    // Ignore environments where CustomEvent might be restricted
  }

  // 5. Global callback function on window or window.parent (common in LMS platforms)
  try {
    const win = window as any;
    if (typeof win.onSherboGameComplete === 'function') {
      win.onSherboGameComplete(payload);
    }
    if (typeof win.onGameComplete === 'function') {
      win.onGameComplete(payload);
    }
    if (win.parent && typeof win.parent.onSherboGameComplete === 'function') {
      win.parent.onSherboGameComplete(payload);
    }
  } catch {
    // Ignore cross-origin access errors
  }

  // 6. Browser storage and window flag (for same-domain platforms)
  try {
    localStorage.setItem('sherbo_game_completed', 'true');
    sessionStorage.setItem('sherbo_game_completed', 'true');
    (window as any).__SHERBO_GAME_COMPLETED__ = true;
  } catch {
    // Ignore private browsing / restricted storage
  }

  console.log('[SherboPlatform] Finish line reached. Sent completion signal to platform:', payload);

  return payload;
}

/**
 * Listens for status check messages from the parent website and replies with the current completion status.
 */
export function setupPlatformMessageListener(getIsCompleted: () => boolean): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleMessage = (event: MessageEvent) => {
    if (
      event.data &&
      (event.data.type === 'CHECK_GAME_STATUS' || event.data.type === 'GET_GAME_STATUS')
    ) {
      const isDone = getIsCompleted();
      const response = {
        type: 'GAME_STATUS_RESPONSE',
        completed: isDone,
        gameId: 'sherbo-tower',
      };
      try {
        if (event.source && typeof (event.source as any).postMessage === 'function') {
          (event.source as any).postMessage(response, '*');
        } else if (window.parent && window.parent !== window) {
          window.parent.postMessage(response, '*');
        }
      } catch {}
    }
  };

  window.addEventListener('message', handleMessage);
  return () => {
    window.removeEventListener('message', handleMessage);
  };
}
