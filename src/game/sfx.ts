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
 * Background music — looping /sounds/bgm.m4a.
 *
 * In mobile view (phones / touch screens), phone speakers compress dynamic range
 * and easily drown out game sound effects. Therefore:
 * 1. Mobile normal volume is set gentle (0.05) so jumps, coins, springs, and
 *    landings are punchy, crisp, and clearly audible over the song.
 * 2. Mobile ducked volume drops down near-silent (0.005) while answering questions
 *    so answer options and explanations are distraction-free.
 * 3. While answer voice lines (e.g. HAHA.mp3, mistake voice clips) actively speak,
 *    background music is temporarily cut to 0 on mobile so 100% of the speaker's
 *    power and clarity is dedicated to the voice line.
 * ------------------------------------------------------------------------ */
export const BGM_PATH = '/sounds/bgm.m4a';
export const BGM_DESKTOP_NORMAL_VOLUME = 0.12;
export const BGM_DESKTOP_DUCKED_VOLUME = 0.025;
export const BGM_MOBILE_NORMAL_VOLUME = 0.05;
export const BGM_MOBILE_DUCKED_VOLUME = 0.005;

let bgmAudio: HTMLAudioElement | null = null;
let bgmBuffer: AudioBuffer | null = null;
let bgmLoadPromise: Promise<AudioBuffer | null> | null = null;
let bgmSource: AudioBufferSourceNode | null = null;
let bgmGain: GainNode | null = null;
let bgmStarted = false;
let musicDucked = false;
let bgmVoiceSilenced = false;

export function isMobileAudioView(): boolean {
  if (typeof window === 'undefined') return false;
  const isCoarse =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;
  const isNarrow = window.innerWidth <= 820;
  const isUserAgentMobile =
    typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  return Boolean(isCoarse || isNarrow || isUserAgentMobile);
}

export function getTargetMusicVolume(): number {
  const isMobile = isMobileAudioView();
  if (isMobile) {
    return musicDucked ? BGM_MOBILE_DUCKED_VOLUME : BGM_MOBILE_NORMAL_VOLUME;
  }
  return musicDucked ? BGM_DESKTOP_DUCKED_VOLUME : BGM_DESKTOP_NORMAL_VOLUME;
}

function loadBgmBuffer(ac: AudioContext): Promise<AudioBuffer | null> {
  if (bgmBuffer) return Promise.resolve(bgmBuffer);
  if (bgmLoadPromise) return bgmLoadPromise;
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
    return Promise.resolve(null);
  }
  const url = `${BGM_PATH}?v=${AUDIO_CACHE_BUSTER}`;
  bgmLoadPromise = window
    .fetch(url)
    .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error('BGM fetch failed'))))
    .then((arr) => ac.decodeAudioData(arr))
    .then((decoded) => {
      bgmBuffer = decoded;
      return decoded;
    })
    .catch(() => {
      bgmLoadPromise = null;
      return null;
    });
  return bgmLoadPromise;
}

function stopBgmSource(): void {
  if (bgmSource) {
    try {
      bgmSource.stop();
      bgmSource.disconnect();
    } catch {
      /* ignore */
    }
    bgmSource = null;
  }
  if (bgmAudio) {
    bgmAudio.pause();
  }
}

function applyMusicVolume(): void {
  const target = muted || bgmVoiceSilenced ? 0 : getTargetMusicVolume();
  if (bgmGain && ctx) {
    try {
      bgmGain.gain.cancelScheduledValues(ctx.currentTime);
      bgmGain.gain.setTargetAtTime(target, ctx.currentTime, 0.05);
    } catch {
      bgmGain.gain.value = target;
    }
  }
  if (bgmAudio) {
    bgmAudio.muted = muted || bgmVoiceSilenced;
    bgmAudio.volume = target;
  }
}

function ensureBgmPlaying(): void {
  if (typeof window === 'undefined' || !bgmStarted || muted) return;
  if (typeof document !== 'undefined' && document.hidden) return;

  const ac = audio();
  if (ac) {
    if (!bgmGain) {
      bgmGain = ac.createGain();
      bgmGain.gain.value = 0;
      bgmGain.connect(ac.destination);
    }
    if (bgmBuffer) {
      if (!bgmSource) {
        try {
          const src = ac.createBufferSource();
          src.buffer = bgmBuffer;
          src.loop = true;
          src.connect(bgmGain);
          src.start(0);
          bgmSource = src;
        } catch {
          /* ignore */
        }
      }
      applyMusicVolume();
      return;
    }

    void loadBgmBuffer(ac).then((buf) => {
      if (buf && bgmStarted && !muted && !(typeof document !== 'undefined' && document.hidden)) {
        ensureBgmPlaying();
      }
    });
    return;
  }

  // Non-WebAudio fallback (only if AudioContext is unavailable)
  if (!bgmAudio) {
    bgmAudio = getAudioElement(BGM_PATH);
    bgmAudio.loop = true;
    bgmAudio.preload = 'auto';
  }
  applyMusicVolume();
  if (bgmAudio.paused) {
    void bgmAudio.play().catch(() => {});
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('resize', applyMusicVolume, { passive: true });
  window.addEventListener('orientationchange', applyMusicVolume, { passive: true });
  if (typeof window.matchMedia === 'function') {
    try {
      const mql = window.matchMedia('(pointer: coarse)');
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', applyMusicVolume);
      } else if (typeof (mql as unknown as { addListener?: (fn: () => void) => void }).addListener === 'function') {
        (mql as unknown as { addListener: (fn: () => void) => void }).addListener(applyMusicVolume);
      }
    } catch {
      /* ignore */
    }
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!bgmStarted) return;
    if (document.hidden) {
      stopBgmSource();
    } else if (!muted) {
      ensureBgmPlaying();
    }
  });
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

function playAudioFile(relativePath: string, volume = 1.0): void {
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

    // While an answer voice clip is speaking, drop background music to 0 via GainNode
    // (works on iOS Safari where HTMLAudioElement.volume is read-only)
    if (!muted && (musicDucked || isMobileAudioView())) {
      bgmVoiceSilenced = true;
      applyMusicVolume();
      let restored = false;
      const restoreBgm = () => {
        if (restored) return;
        restored = true;
        bgmVoiceSilenced = false;
        applyMusicVolume();
        audioEl.removeEventListener('ended', restoreBgm);
        audioEl.removeEventListener('pause', restoreBgm);
      };
      audioEl.addEventListener('ended', restoreBgm, { once: true });
      audioEl.addEventListener('pause', restoreBgm, { once: true });
      setTimeout(restoreBgm, 4000);
    }

    const playPromise = audioEl.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        /* Autoplay / user gesture policy handled gracefully */
        applyMusicVolume();
      });
    }
  } catch {
    applyMusicVolume();
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
  startMusic(_level: number = 1): void {
    bgmStarted = true;
    musicDucked = false;
    bgmVoiceSilenced = false;
    ensureBgmPlaying();
  },
  stopMusic(): void {
    bgmStarted = false;
    bgmVoiceSilenced = false;
    stopBgmSource();
    if (bgmAudio) {
      bgmAudio.currentTime = 0;
    }
  },
  /** Kept for section-change compatibility. */
  setMusicLevel(_level: number): void {
    /* background track plays continuously */
  },
  /** Lower the music while a question is open so answer SFX stand out clearly. */
  duckMusic(ducked: boolean): void {
    musicDucked = ducked;
    applyMusicVolume();
  },
  checkpoint(): void {
    tone(523, 0.12, 'triangle', 0.2);
    tone(784, 0.18, 'triangle', 0.2, undefined, 0.1);
  },
  correct(): void {
    playAudioFile('/sounds/HAHA.mp3', 1.0);
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
    playAudioFile(picked, 1.0);
  },
  /** Warm the cache for voice lines and background music (call from a user gesture). */
  preloadVoices(): void {
    preloadAudioFiles([...MISTAKE_SOUNDS, '/sounds/HAHA.mp3']);
    const ac = audio();
    if (ac) {
      void loadBgmBuffer(ac);
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
    if (!value && bgmStarted) {
      ensureBgmPlaying();
    }
    muteListeners.forEach((fn) => fn(value));
  },
  onMuteChange(fn: (m: boolean) => void): () => void {
    muteListeners.add(fn);
    return () => muteListeners.delete(fn);
  },
  getMusicVolume(): number {
    if (muted || bgmVoiceSilenced) return 0;
    return getTargetMusicVolume();
  },
  isMusicDucked(): boolean {
    return musicDucked;
  },
};
