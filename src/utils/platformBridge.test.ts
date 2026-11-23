function assert(condition: boolean, msg?: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg || 'unknown condition'}`);
  }
}

import {
  notifyPlatformGameCompleted,
  requestPlatformVideoContinue,
  setupPlatformMessageListener,
} from './platformBridge.ts';

console.log('Running Platform Bridge unit tests...');

// Mock browser environment for node testing
const messagesSent: any[] = [];
const customEventsDispatched: any[] = [];
let callbackInvokedWith: any = null;
const storageMock: Record<string, string> = {};

(globalThis as any).window = {
  parent: {
    postMessage: (data: any, _origin: string) => {
      messagesSent.push({ target: 'parent', data });
    },
  },
  opener: {
    postMessage: (data: any, _origin: string) => {
      messagesSent.push({ target: 'opener', data });
    },
  },
  dispatchEvent: (event: any) => {
    customEventsDispatched.push({ target: 'window', event });
    return true;
  },
  onSherboGameComplete: (payload: any) => {
    callbackInvokedWith = payload;
  },
  addEventListener: () => {},
  removeEventListener: () => {},
};

(globalThis as any).document = {
  dispatchEvent: (event: any) => {
    customEventsDispatched.push({ target: 'document', event });
    return true;
  },
};

(globalThis as any).localStorage = {
  setItem: (k: string, v: string) => {
    storageMock[k] = v;
  },
  getItem: (k: string) => storageMock[k] ?? null,
};

(globalThis as any).sessionStorage = {
  setItem: (k: string, v: string) => {
    storageMock[`sess_${k}`] = v;
  },
  getItem: (k: string) => storageMock[`sess_${k}`] ?? null,
};

// Test notification
const result = notifyPlatformGameCompleted({
  score: 3850,
  grade: 'S+',
  gradeName: 'Ascendant',
  elapsedTimeSeconds: 48,
  totalAttempts: 5,
  firstTryCount: 5,
});

assert(result.completed === true, 'Result payload must have completed === true');
assert(result.type === 'GAME_COMPLETED', 'Payload type must be GAME_COMPLETED');
assert(result.score === 3850, 'Score must be 3850');
assert(result.grade === 'S+', 'Grade must be S+');

// Check postMessage
assert(messagesSent.length >= 2, 'Should send postMessage to parent and opener');
const parentMsg = messagesSent.find((m) => m.target === 'parent')?.data;
assert(parentMsg && parentMsg.completed === true, 'Parent message must have completed: true');

const continueResult = requestPlatformVideoContinue();
assert(continueResult.type === 'SHERBO_CONTINUE_VIDEO', 'Continue payload must use the bridge type');
assert(
  messagesSent.some(
    (message) =>
      message.target === 'parent' && message.data?.type === 'SHERBO_CONTINUE_VIDEO',
  ),
  'Continue request must be sent to the parent player',
);

// Check CustomEvent
assert(customEventsDispatched.length >= 1, 'CustomEvent should be dispatched');

// Check callback
assert(callbackInvokedWith && callbackInvokedWith.completed === true, 'Window callback should be called with payload');

// Check storage flags
assert(storageMock['sherbo_game_completed'] === 'true', 'localStorage flag should be set to true');
assert(storageMock['sess_sherbo_game_completed'] === 'true', 'sessionStorage flag should be set to true');

console.log('✓ Platform Bridge successfully notified parent window, custom events, callbacks, and storage.');
console.log('ALL PLATFORM BRIDGE TESTS PASSED! 🎉');
