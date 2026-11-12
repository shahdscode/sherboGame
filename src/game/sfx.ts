/**
 * Tiny synthesized sound effects using the Web Audio API.
 * No audio files needed — everything is generated on the fly.
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
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  return ctx;
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
    audio();
  },
  jump(): void {
    tone(380, 0.16, 'square', 0.035, 760);
  },
  land(): void {
    if (muted) return;
    const ac = audio();
    if (!ac) return;

    const start = ac.currentTime;

    // Cute squishy cartoon / arcade bounce landing:
    // 1. Soft bouncy "bloop" body (sine wave pitch-drop)
    const osc1 = ac.createOscillator();
    const gain1 = ac.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(360, start);
    osc1.frequency.exponentialRampToValueAtTime(170, start + 0.08);

    gain1.gain.setValueAtTime(0.0001, start);
    gain1.gain.exponentialRampToValueAtTime(0.12, start + 0.01);
    gain1.gain.exponentialRampToValueAtTime(0.0001, start + 0.08);

    osc1.connect(gain1).connect(ac.destination);
    osc1.start(start);
    osc1.stop(start + 0.09);

    // 2. Playful springy chirp harmonic (tiny cute pop/bounce)
    const start2 = start + 0.02;
    const osc2 = ac.createOscillator();
    const gain2 = ac.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(540, start2);
    osc2.frequency.exponentialRampToValueAtTime(270, start2 + 0.06);

    gain2.gain.setValueAtTime(0.0001, start2);
    gain2.gain.exponentialRampToValueAtTime(0.06, start2 + 0.008);
    gain2.gain.exponentialRampToValueAtTime(0.0001, start2 + 0.06);

    osc2.connect(gain2).connect(ac.destination);
    osc2.start(start2);
    osc2.stop(start2 + 0.07);
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
