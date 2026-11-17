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
  // Already running: nothing to unlock. (This runs on every touch, so keep it free.)
  if (ac.state === 'running') return;
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

/* --------------------------------------------------------------------------
 * Background music — generated live with the Web Audio API (no audio files to
 * download, nothing to license). A soft, looping arpeggio over four warm chords.
 * Each tower section nudges the tempo up and adds a sparkle layer.
 * ------------------------------------------------------------------------ */
const MUSIC_VOLUME = 0.5;
// C maj7 – A min7 – F maj7 – G6 (frequencies in Hz)
const MUSIC_CHORDS: number[][] = [
  [261.63, 329.63, 392.0, 493.88],
  [220.0, 261.63, 329.63, 392.0],
  [174.61, 220.0, 261.63, 329.63],
  [196.0, 246.94, 293.66, 329.63],
];
const MUSIC_PATTERN = [0, 2, 1, 3, 2, 1, 3, 2]; // chord-tone order across one bar of 8th notes

let musicGain: GainNode | null = null;
let musicTimer: number | null = null;
let musicNextTime = 0;
let musicStep = 0;
let musicLevel = 1;
let musicDucked = false;

function musicTargetVolume(): number {
  if (muted) return 0;
  return MUSIC_VOLUME * (musicDucked ? 0.35 : 1);
}

function applyMusicVolume(): void {
  if (!musicGain || !ctx) return;
  try {
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setTargetAtTime(musicTargetVolume(), ctx.currentTime, 0.25);
  } catch {
    /* ignore */
  }
}

function musicNote(freq: number, start: number, duration: number, type: Wave, volume: number): void {
  if (!ctx || !musicGain) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.02);
  gain.gain.linearRampToValueAtTime(0, start + duration);
  osc.connect(gain).connect(musicGain);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

function scheduleMusic(): void {
  const ac = ctx;
  if (!ac || !musicGain) return;
  // Nothing is scheduled while the tab is hidden or the sound is muted
  if (document.hidden || muted || ac.state !== 'running') {
    musicNextTime = 0;
    return;
  }
  if (musicNextTime < ac.currentTime) musicNextTime = ac.currentTime + 0.06;

  const bpm = 84 + musicLevel * 5; // 89 bpm at the base … 114 bpm near the summit
  const stepDur = 60 / bpm / 2; // 8th notes

  while (musicNextTime < ac.currentTime + 0.4) {
    const bar = Math.floor(musicStep / 8);
    const inBar = musicStep % 8;
    const chord = MUSIC_CHORDS[bar % MUSIC_CHORDS.length];
    const t = musicNextTime;

    // Arpeggio (the tune)
    musicNote(chord[MUSIC_PATTERN[inBar]] * 2, t, stepDur * 1.7, 'triangle', 0.075);

    // Soft pad + bass at the start of every bar
    if (inBar === 0) {
      const barDur = stepDur * 8;
      musicNote(chord[0], t, barDur * 0.98, 'sine', 0.06);
      musicNote(chord[2], t, barDur * 0.98, 'sine', 0.04);
      musicNote(chord[0] / 2, t, barDur * 0.5, 'triangle', 0.09);
    }
    if (inBar === 4) {
      musicNote(chord[0] / 2, t, stepDur * 3.5, 'triangle', 0.07);
    }
    // Sparkle layer from section 3 upwards
    if (musicLevel >= 3 && (inBar === 2 || inBar === 6)) {
      musicNote(chord[3] * 4, t, stepDur * 1.2, 'sine', 0.028);
    }
    // Light off-beat pulse for the last two sections
    if (musicLevel >= 5 && inBar % 2 === 1) {
      musicNote(chord[1] * 2, t, stepDur * 0.5, 'triangle', 0.03);
    }

    musicNextTime += stepDur;
    musicStep += 1;
  }
}

let activeAudioElement: HTMLAudioElement | null = null;
const audioCache = new Map<string, HTMLAudioElement>();
const AUDIO_CACHE_BUSTER = Date.now();

function getAudioElement(relativePath: string): HTMLAudioElement {
  let el = audioCache.get(relativePath);
  if (!el) {
    const separator = relativePath.includes('?') ? '&' : '?';
    const busterUrl = `${relativePath}${separator}v=${AUDIO_CACHE_BUSTER}`;
    el = new Audio(busterUrl);
    el.preload = 'auto';
    audioCache.set(relativePath, el);
  }
  return el;
}

/** Download voice lines ahead of time so they play instantly on slow connections. */
function preloadAudioFiles(paths: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    paths.forEach((p) => getAudioElement(p).load());
  } catch {
    /* ignore */
  }
}

function playAudioFile(relativePath: string, volume = 0.85): void {
  if (muted || typeof window === 'undefined') return;
  try {
    if (activeAudioElement) {
      activeAudioElement.pause();
      activeAudioElement.currentTime = 0;
      activeAudioElement = null;
    }
    const audioEl = getAudioElement(relativePath);
    audioEl.currentTime = 0;
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

const MISTAKE_SOUNDS = [
  '/sounds/ehheeeee.mp3',
  '/sounds/enta ghaby.mp3',
  '/sounds/matgawdshhhh.mp3',
  '/sounds/msh hashaga3ak.mp3',
  '/sounds/wana bahes enk aabet.mp3',
];

let lastMistakeSound: string | null = null;

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
  /** Icy Tower style double-jump ascending dual chirp */
  doubleJump(): void {
    tone(460, 0.12, 'triangle', 0.24, 820);
    tone(680, 0.15, 'sine', 0.18, 1080, 0.04);
  },
  /** Snappy tactile wall kick bounce sound */
  wallBounce(): void {
    tone(400, 0.08, 'triangle', 0.22, 660);
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
  /** Bright two-note "ding" for picking up a coin */
  coin(): void {
    tone(988, 0.07, 'triangle', 0.2);
    tone(1319, 0.16, 'triangle', 0.2, undefined, 0.06);
  },
  /** Rising "boing" for spring platforms */
  spring(): void {
    tone(220, 0.22, 'triangle', 0.26, 880);
    tone(440, 0.18, 'sine', 0.16, 1320, 0.03);
  },
  /** Low rumble: a crumbling platform starts to give way */
  crumble(): void {
    tone(210, 0.16, 'sawtooth', 0.1, 150);
    tone(180, 0.16, 'sawtooth', 0.09, 130, 0.12);
  },
  crumbleFall(): void {
    tone(300, 0.3, 'triangle', 0.2, 110);
  },
  /** Start (or restart) the looping background music. Must follow a user gesture. */
  startMusic(level: number = 1): void {
    const ac = audio();
    if (!ac) return;
    musicLevel = Math.max(1, Math.min(6, level));
    musicDucked = false;
    if (!musicGain) {
      musicGain = ac.createGain();
      musicGain.gain.value = 0;
      musicGain.connect(ac.destination);
    }
    musicStep = 0;
    musicNextTime = 0;
    applyMusicVolume();
    if (musicTimer === null && typeof window !== 'undefined') {
      musicTimer = window.setInterval(scheduleMusic, 120);
    }
  },
  stopMusic(): void {
    if (musicTimer !== null) {
      window.clearInterval(musicTimer);
      musicTimer = null;
    }
    if (musicGain && ctx) {
      try {
        musicGain.gain.cancelScheduledValues(ctx.currentTime);
        musicGain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
      } catch {
        /* ignore */
      }
    }
  },
  /** Higher tower sections play slightly faster with extra layers. */
  setMusicLevel(level: number): void {
    musicLevel = Math.max(1, Math.min(6, level));
  },
  /** Lower the music while a question is open so the student can think. */
  duckMusic(ducked: boolean): void {
    musicDucked = ducked;
    applyMusicVolume();
  },
  checkpoint(): void {
    tone(523, 0.12, 'triangle', 0.2);
    tone(784, 0.18, 'triangle', 0.2, undefined, 0.1);
  },
  correct(): void {
    playAudioFile('/sounds/HAHA.mp3', 0.95);
  },
  /**
   * Mistake voice lines:
   * Picks randomly from all audio files in public/sounds/ for any mistake,
   * avoiding playing the same file twice in a row.
   */
  wrong(_mistakeNumber: number = 1): void {
    const candidates =
      MISTAKE_SOUNDS.length > 1 && lastMistakeSound
        ? MISTAKE_SOUNDS.filter((s) => s !== lastMistakeSound)
        : MISTAKE_SOUNDS;
    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    lastMistakeSound = picked;
    playAudioFile(picked, 0.95);
  },
  /** Warm the cache for voice lines (call from a user gesture). */
  preloadVoices(): void {
    preloadAudioFiles([...MISTAKE_SOUNDS, '/sounds/HAHA.mp3']);
  },
  unlockGate(): void {
    tone(300, 0.25, 'triangle', 0.22, 900);
    tone(900, 0.2, 'triangle', 0.18, 1400, 0.18);
  },
  victory(): void {
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    notes.forEach((f, i) => tone(f, 0.22, 'triangle', 0.22, undefined, i * 0.11));
  },
  badgeStamp(): void {
    tone(587.33, 0.08, 'triangle', 0.22, 880);
    tone(880, 0.22, 'triangle', 0.26, 1174.66, 0.06);
    tone(1174.66, 0.35, 'triangle', 0.28, undefined, 0.16);
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
    applyMusicVolume();
    muteListeners.forEach((fn) => fn(value));
  },
  onMuteChange(fn: (m: boolean) => void): () => void {
    muteListeners.add(fn);
    return () => muteListeners.delete(fn);
  },
};
