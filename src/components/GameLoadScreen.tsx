import React from 'react';

interface GameLoadScreenProps {
  failed: boolean;
}

/** Shown while a game built in the admin loads, or when it can't be played. */
export const GameLoadScreen: React.FC<GameLoadScreenProps> = ({ failed }) => (
  <div className="fullscreen-game-shell">
    <div className="overlay-backdrop" role={failed ? 'alert' : 'status'}>
      <div className="modal-card start-modal-card game-load-card">
        <h1 className="game-title">Sherbo&apos;s Tower</h1>
        {failed ? (
          <>
            <p>This game is not available right now.</p>
            <p dir="rtl">اللعبة غير متاحة حاليًا.</p>
            <button
              type="button"
              className="primary-cta-btn"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
          </>
        ) : (
          <p>Loading the game…</p>
        )}
      </div>
    </div>
  </div>
);
