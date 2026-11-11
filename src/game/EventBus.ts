export interface TouchInputState {
  left: boolean;
  right: boolean;
  jump: boolean;
}

export type CharacterPose = 'climbing' | 'question' | 'retry' | 'goodjob';

export interface StepUpdatePayload {
  currentStep: number;
  highestStep: number;
}

export interface CheckpointReachedPayload {
  checkpointNumber: number;
  stepNumber: number;
}

export interface SectionUnlockedPayload {
  checkpointNumber: number;
  unlockedUpToStep: number;
}

export interface TowerEventMap {
  // React -> Phaser commands
  'cmd:start-game': void;
  'cmd:unlock-section': { checkpointNumber: number };
  'cmd:complete-summit': void;
  'cmd:restart-game': void;
  'cmd:touch-input': TouchInputState;
  'cmd:set-character-pose': { pose: CharacterPose };
  // Debug/test helper command for automated testing or quick verification if needed
  'cmd:teleport-to-step': { stepNumber: number };

  // Phaser -> React events
  'evt:scene-ready': void;
  'evt:step-updated': StepUpdatePayload;
  'evt:checkpoint-reached': CheckpointReachedPayload;
  'evt:section-unlocked': SectionUnlockedPayload;
  'evt:summit-celebrated': void;
}

type Listener<T> = (payload: T) => void;

class TowerEventBus {
  private listeners: Map<keyof TowerEventMap, Set<Listener<any>>> = new Map();

  public on<K extends keyof TowerEventMap>(
    event: K,
    listener: Listener<TowerEventMap[K]>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    set.add(listener);

    return () => {
      set.delete(listener);
    };
  }

  public emit<K extends keyof TowerEventMap>(
    event: K,
    payload: TowerEventMap[K]
  ): void {
    const set = this.listeners.get(event);
    if (!set) return;
    set.forEach((listener) => {
      try {
        listener(payload);
      } catch (err) {
        console.error(`Error in TowerEventBus listener for ${String(event)}:`, err);
      }
    });
  }

  public clearAll(): void {
    this.listeners.clear();
  }
}

export const gameEvents = new TowerEventBus();
