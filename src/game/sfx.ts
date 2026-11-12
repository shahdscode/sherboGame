/**
 * Game sound effects using Web Audio API.
 * Synthesized arcade effects + cute character vocal "he' he'" landing voice.
 */

type Wave = OscillatorType;

let ctx: AudioContext | null = null;
let muted =
  typeof localStorage !== 'undefined' && localStorage.getItem('kt-muted') === '1';
const muteListeners = new Set<(m: boolean) => void>();

let landBuffer: AudioBuffer | null = null;
let rawVoiceArrayBuffer: ArrayBuffer | null = null;
let isPreloadingVoice = false;

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

// Pre-fetch the cute character "he' he'" landing voice
async function preloadLandVoice(): Promise<void> {
  if (landBuffer || isPreloadingVoice || typeof window === 'undefined') return;
  isPreloadingVoice = true;
  try {
    const res = await fetch('/audio/land_voice.wav');
    if (!res.ok) return;
    const arrayBuf = await res.arrayBuffer();
    rawVoiceArrayBuffer = arrayBuf;
    const ac = audio();
    if (ac) {
      landBuffer = await ac.decodeAudioData(arrayBuf.slice(0));
    }
  } catch {
    /* ignore network/fetch errors in test environments */
  } finally {
    isPreloadingVoice = false;
  }
}

// Start preloading voice asset in browser environment immediately
if (typeof window !== 'undefined') {
  void preloadLandVoice();
}

/** Formant vocal synthesis fallback if audio buffer hasn't decoded yet */
function playVocalHeHe(ac: AudioContext): void {
  const start = ac.currentTime;
  playVowelSyllable(ac, start, 320, 0.08);
  playVowelSyllable(ac, start + 0.11, 360, 0.09);
}

function playVowelSyllable(
  ac: AudioContext,
  time: number,
  pitch: number,
  dur: number
): void {
  const osc = ac.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(pitch, time);
  osc.frequency.exponentialRampToValueAtTime(pitch * 0.92, time + dur);

  // Formants for vowel "eh" (open throat F1 + front tongue F2)
  const f1 = ac.createBiquadFilter();
  f1.type = 'bandpass';
  f1.frequency.value = 540;
  f1.Q.value = 3.5;

  const f2 = ac.createBiquadFilter();
  f2.type = 'bandpass';
  f2.frequency.value = 1850;
  f2.Q.value = 4.0;

  const amp = ac.createGain();
  amp.gain.setValueAtTime(0.0001, time);
  amp.gain.exponentialRampToValueAtTime(0.18, time + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + dur);

  osc.connect(f1);
  osc.connect(f2);
  f1.connect(amp);
  f2.connect(amp);
  amp.connect(ac.destination);

  osc.start(time);
  osc.stop(time + dur + 0.02);
}

function tone(
  freq: number,
  duration: number,
  type: Wave = 'sine',
  volume = 0.12,
  slideTo?: number,
  delay = 0
): void {
  if (muted) return;
  const ac = audio();
  if (!ac) return;

  const start = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) {
    osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
  }

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export const sfx = {
  /** Call from a user gesture (tap/click) to unlock audio on iOS. */
  unlock(): void {
    const ac = audio();
    if (ac && rawVoiceArrayBuffer && !landBuffer) {
      ac.decodeAudioData(rawVoiceArrayBuffer.slice(0)).then((buf) => {
        landBuffer = buf;
      }).catch(() => {});
    }
  },
  jump(): void {
    tone(380, 0.16, 'square', 0.035, 760);
  },
  /** Cute character person voice sound ("he' he'") upon landing */
  land(): void {
    if (muted) return;
    const ac = audio();
    if (!ac) return;

    if (landBuffer) {
      const source = ac.createBufferSource();
      const gain = ac.createGain();
      source.buffer = landBuffer;
      gain.gain.value = 0.65;
      source.connect(gain).connect(ac.destination);
      source.start();
      return;
    }

    // If preloaded buffer is still decoding, trigger decode and play vocal formant fallback
    if (rawVoiceArrayBuffer && !landBuffer) {
      ac.decodeAudioData(rawVoiceArrayBuffer.slice(0)).then((buf) => {
        landBuffer = buf;
      }).catch(() => {});
    } else {
      void preloadLandVoice();
    }

    playVocalHeHe(ac);
  },
  click(): void {
    tone(720, 0.05, 'triangle', 0.07);
  },
  checkpoint(): void {
    tone(523, 0.12, 'triangle', 0.09);
    tone(784, 0.18, 'triangle', 0.09, undefined, 0.1);
  },
  correct(): void {
    [523, 659, 784, 1047].forEach((f, i) =>
      tone(f, 0.18, 'triangle', 0.1, undefined, i * 0.075)
    );
  },
  wrong(): void {
    tone(240, 0.16, 'sawtooth', 0.05, 160);
    tone(170, 0.24, 'sawtooth', 0.05, 110, 0.12);
  },
  unlockGate(): void {
    tone(300, 0.25, 'sine', 0.08, 900);
    tone(900, 0.2, 'triangle', 0.06, 1400, 0.18);
  },
  victory(): void {
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    notes.forEach((f, i) => tone(f, 0.22, 'triangle', 0.1, undefined, i * 0.11));
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
