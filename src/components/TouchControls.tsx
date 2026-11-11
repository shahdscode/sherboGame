import React, { useRef, useState, useCallback, useEffect } from 'react';
import { ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import { TouchInputState } from '../game/EventBus';

interface TouchControlsProps {
  disabled: boolean;
  onChange: (input: TouchInputState) => void;
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

  const [visualState, setVisualState] = useState<TouchInputState>({
    left: false,
    right: false,
    jump: false,
  });

  const updateButton = useCallback(
    (button: keyof TouchInputState, pressed: boolean) => {
      if (disabled && pressed) return;
      if (stateRef.current[button] === pressed) return;

      const next: TouchInputState = {
        ...stateRef.current,
        [button]: pressed,
      };
      // If pressing left, release right and vice versa
      if (button === 'left' && pressed) next.right = false;
      if (button === 'right' && pressed) next.left = false;

      stateRef.current = next;
      setVisualState(next);
      onChange(next);
    },
    [disabled, onChange]
  );

  // Clear active inputs if game becomes paused/disabled
  useEffect(() => {
    if (disabled) {
      const cleared = { left: false, right: false, jump: false };
      stateRef.current = cleared;
      setVisualState(cleared);
      onChange(cleared);
    }
  }, [disabled, onChange]);

  const bindPressHandlers = (button: keyof TouchInputState) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      updateButton(button, true);
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      updateButton(button, false);
    },
    onPointerLeave: (e: React.PointerEvent) => {
      e.preventDefault();
      updateButton(button, false);
    },
    onPointerCancel: (e: React.PointerEvent) => {
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
          type="button"
          className={`touch-btn ${visualState.left ? 'touch-btn-active' : ''}`}
          disabled={disabled}
          aria-label="Move Left"
          data-testid="touch-left-btn"
          {...bindPressHandlers('left')}
        >
          <ArrowLeft size={24} />
          <span>Left</span>
        </button>

        <button
          type="button"
          className={`touch-btn ${visualState.right ? 'touch-btn-active' : ''}`}
          disabled={disabled}
          aria-label="Move Right"
          data-testid="touch-right-btn"
          {...bindPressHandlers('right')}
        >
          <ArrowRight size={24} />
          <span>Right</span>
        </button>
      </div>

      <div className="touch-control-hint">
        Hold Left / Right to run • Tap Jump to climb
      </div>

      <div className="touch-action">
        <button
          type="button"
          className={`touch-btn touch-jump-btn ${
            visualState.jump ? 'touch-btn-active' : ''
          }`}
          disabled={disabled}
          aria-label="Jump"
          data-testid="touch-jump-btn"
          {...bindPressHandlers('jump')}
        >
          <ArrowUp size={24} />
          <span>Jump</span>
        </button>
      </div>
    </div>
  );
};
