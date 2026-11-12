import React, { useRef, useCallback, useEffect } from 'react';
import { ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import { gameEvents, TouchInputState } from '../game/EventBus';
import { sfx } from '../game/sfx';

interface TouchControlsProps {
  disabled: boolean;
  onChange?: (input: TouchInputState) => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  disabled,
  onChange,
}) => {
  const stateRef = useRef<TouchInputState>({
    left: false,
    right: false,
    jump: false,
  });

  const btnLeftRef = useRef<HTMLButtonElement | null>(null);
  const btnRightRef = useRef<HTMLButtonElement | null>(null);
  const btnJumpRef = useRef<HTMLButtonElement | null>(null);

  const setButtonVisual = (button: keyof TouchInputState, active: boolean) => {
    let el: HTMLButtonElement | null = null;
    if (button === 'left') el = btnLeftRef.current;
    if (button === 'right') el = btnRightRef.current;
    if (button === 'jump') el = btnJumpRef.current;
    if (el) {
      if (active) {
        el.classList.add('touch-btn-active');
      } else {
        el.classList.remove('touch-btn-active');
      }
    }
  };

  const updateButton = useCallback(
    (button: keyof TouchInputState, pressed: boolean) => {
      if (disabled && pressed) return;
      if (stateRef.current[button] === pressed) return;

      const next: TouchInputState = {
        ...stateRef.current,
        [button]: pressed,
      };

      if (button === 'left' && pressed) {
        next.right = false;
        setButtonVisual('right', false);
      }
      if (button === 'right' && pressed) {
        next.left = false;
        setButtonVisual('left', false);
      }

      stateRef.current = next;
      setButtonVisual(button, pressed);

      // Instant 0ms dispatch directly to Phaser event bus
      gameEvents.emit('cmd:touch-input', next);
      if (onChange) onChange(next);
    },
    [disabled, onChange]
  );

  useEffect(() => {
    if (disabled) {
      const cleared = { left: false, right: false, jump: false };
      stateRef.current = cleared;
      setButtonVisual('left', false);
      setButtonVisual('right', false);
      setButtonVisual('jump', false);
      gameEvents.emit('cmd:touch-input', cleared);
      if (onChange) onChange(cleared);
    }
  }, [disabled, onChange]);

  const bindPressHandlers = (button: keyof TouchInputState) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      sfx.unlock();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      updateButton(button, true);
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      updateButton(button, false);
    },
    onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      updateButton(button, false);
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  return (
    <div
      className="touch-controls-bar"
      aria-label="On-screen movement controls"
    >
      <div className="touch-dpad">
        <button
          ref={btnLeftRef}
          type="button"
          className="touch-btn"
          disabled={disabled}
          aria-label="Move Left"
          data-testid="touch-left-btn"
          {...bindPressHandlers('left')}
        >
          <ArrowLeft size={22} />
          <span>Left</span>
        </button>

        <button
          ref={btnRightRef}
          type="button"
          className="touch-btn"
          disabled={disabled}
          aria-label="Move Right"
          data-testid="touch-right-btn"
          {...bindPressHandlers('right')}
        >
          <ArrowRight size={22} />
          <span>Right</span>
        </button>
      </div>

      <div className="touch-control-hint">
        Hold Left / Right to run • Tap Jump to climb
      </div>

      <div className="touch-action">
        <button
          ref={btnJumpRef}
          type="button"
          className="touch-btn touch-jump-btn"
          disabled={disabled}
          aria-label="Jump"
          data-testid="touch-jump-btn"
          {...bindPressHandlers('jump')}
        >
          <ArrowUp size={22} />
          <span>Jump</span>
        </button>
      </div>
    </div>
  );
};
