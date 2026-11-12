/**
 * Robust synthesized sound effects using the Web Audio API.
 * Tuned for mobile phone speakers (audible harmonics) with bulletproof iOS/Android gesture unlocking.
 */

type Wave = OscillatorType;

let ctx: AudioContext | null = null;
let muted =
  typeof localStorage !== 'undefined' && localStorage.getItem('kt-muted') === '1';
const muteListeners = new Set<(m: boolean) => void>();

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  return ctx;
}

/**
 * Bulletproof iOS / Android Web Audio unlocker.
 * Plays an immediate 1-sample silent buffer during a user gesture to satisfy
 * mobile Safari/Chrome audio hardware restrictions.
 */
function unlockAudioContext(ac: AudioContext): void {
  if (ac.state === 'suspended') {
    void ac.resume();
  }
  try {
    const buffer = ac.createBuffer(1, 1, 22050);
    const source = ac.createBufferSource();
    source.buffer = buffer;
    source.connect(ac.destination);
    source.start(0);
  } catch {
    /* ignore */
  }
}

// Auto-bind one-time interaction listeners to window on mobile devices
if (typeof window !== 'undefined') {
  const onFirstInteraction = () => {
    const ac = audio();
    if (ac) {
      unlockAudioContext(ac);
    }
  };

  ['touchstart', 'touchend', 'pointerdown', 'click', 'keydown'].forEach((evt) => {
    window.addEventListener(evt, onFirstInteraction, { passive: true });
  });
}

function tone(
  freq: number,
  duration: number,
  type: Wave = 'sine',
  volume = 0.2,
  slideTo?: number,
  delay = 0
): void {
  if (muted) return;
  const ac = audio();
  if (!ac) return;

  if (ac.state === 'suspended') {
    void ac.resume();
  }

  const start = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo && slideTo > 0) {
    try {
      osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
    } catch {
      osc.frequency.linearRampToValueAtTime(slideTo, start + duration);
    }
  }

  // Use linear ramps for bulletproof mobile WebKit compatibility
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.012);
  gain.gain.linearRampToValueAtTime(0, start + duration);

  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

let activeAudioElement: HTMLAudioElement | null = null;

function playAudioFile(relativePath: string, volume = 0.85): void {
  if (muted || typeof window === 'undefined') return;
  try {
    if (activeAudioElement) {
      activeAudioElement.pause();
      activeAudioElement.currentTime = 0;
      activeAudioElement = null;
    }
    const audioEl = new Audio(relativePath);
    audioEl.volume = volume;
    activeAudioElement = audioEl;
    const playPromise = audioEl.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        /* Autoplay / user gesture policy handled gracefully */
      });
    }
  } catch {
    /* ignore */
  }
}

export const sfx = {
  /** Call from any touch / click gesture to immediately unlock audio on iOS and Android. */
  unlock(): void {
    const ac = audio();
    if (ac) {
      unlockAudioContext(ac);
    }
  },
  /** Upbeat jump chirp — tuned for mobile phone speakers */
  jump(): void {
    tone(340, 0.15, 'triangle', 0.22, 680);
  },
  /**
   * Bouncy landing sound — uses triangle wave (260Hz -> 140Hz) so its 2nd/3rd harmonics
   * resonate clearly on mobile phone speakers (which physically cut off sub-200Hz sine waves).
   */
  land(): void {
    tone(260, 0.11, 'triangle', 0.26, 140);
  },
  click(): void {
    tone(720, 0.06, 'triangle', 0.18);
  },
  checkpoint(): void {
    tone(523, 0.12, 'triangle', 0.2);
    tone(784, 0.18, 'triangle', 0.2, undefined, 0.1);
  },
  correct(): void {
    // Sound effect removed per user request
  },
  /**
   * Mistake voice lines:
   * - 1st mistake: random pick from ["ehheeeee.mp3", "msh hashaga3ak.mp3"]
   * - 2nd mistake: "matgawdshhhh.mp3"
   * - 3rd mistake: random pick from ["enta ghaby.mp3", "wana bahes enk aabet.mp3"]
   */
  wrong(mistakeNumber: number = 1): void {
    if (mistakeNumber <= 1) {
      const sounds1 = ['/sounds/ehheeeee.mp3', '/sounds/msh hashaga3ak.mp3'];
      const picked = sounds1[Math.floor(Math.random() * sounds1.length)];
      playAudioFile(picked, 0.95);
    } else if (mistakeNumber === 2) {
      playAudioFile('/sounds/matgawdshhhh.mp3', 0.95);
    } else {
      const sounds3 = [
        '/sounds/enta ghaby.mp3',
        '/sounds/wana bahes enk aabet.mp3',
      ];
      const picked = sounds3[Math.floor(Math.random() * sounds3.length)];
      playAudioFile(picked, 0.95);
    }
  },
  unlockGate(): void {
    tone(300, 0.25, 'triangle', 0.22, 900);
    tone(900, 0.2, 'triangle', 0.18, 1400, 0.18);
  },
  victory(): void {
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    notes.forEach((f, i) => tone(f, 0.22, 'triangle', 0.22, undefined, i * 0.11));
  },
  isMuted(): boolean {
    return muted;
  },
  setMuted(value: boolean): void {
    muted = value;
    try {
      localStorage.setItem('kt-muted', value ? '1' : '0');
    } catch {
      /* ignore */
    }
    muteListeners.forEach((fn) => fn(value));
  },
  onMuteChange(fn: (m: boolean) => void): () => void {
    muteListeners.add(fn);
    return () => muteListeners.delete(fn);
  },
};
