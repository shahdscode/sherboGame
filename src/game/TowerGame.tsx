import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { TowerScene } from './TowerScene';
import { gameEvents } from './EventBus';

/**
 * Rendering resolution.
 *
 * The canvas is rendered above CSS size so art stays crisp, then shown at CSS size via
 * Phaser's `zoom`. Rendering at the full 3x of modern phones means ~3.5 million pixels per
 * frame, which overheats mid-range devices and makes the game stutter — and beyond 2x the
 * extra sharpness is not visible in motion. So the density is capped at 2x, and
 * `qualityScale` lowers it further at runtime if the device still can't keep up.
 */
const MAX_RENDER_DPR = 2;
const MIN_RENDER_DPR = 1;
let qualityScale = 1;

const getViewport = () => {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  const w = Math.max(320, Math.round(vv?.width ?? window.innerWidth));
  const h = Math.max(320, Math.round(vv?.height ?? window.innerHeight));
  const deviceDpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), MAX_RENDER_DPR);
  const dpr = Math.max(MIN_RENDER_DPR, deviceDpr * qualityScale);
  return { w, h, dpr };
};

let activeGame: Phaser.Game | null = null;

/**
 * Grabs the current game frame as an image (used by the "Save My Score" card).
 * Uses Phaser's snapshot API so the WebGL canvas does not need `preserveDrawingBuffer`,
 * which costs a full-screen buffer copy on every single frame.
 */
export function captureGameFrame(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const game = activeGame;
    if (!game || !game.renderer) {
      resolve(null);
      return;
    }
    let settled = false;
    const finish = (img: HTMLImageElement | null) => {
      if (settled) return;
      settled = true;
      resolve(img);
    };
    const timeoutId = window.setTimeout(() => finish(null), 2000);
    try {
      game.renderer.snapshot((snapshot) => {
        window.clearTimeout(timeoutId);
        finish(snapshot instanceof HTMLImageElement ? snapshot : null);
      });
    } catch {
      window.clearTimeout(timeoutId);
      finish(null);
    }
  });
}

export const TowerGame: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameInstanceRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let resizeTimer = 0;
    let qualityTimer = 0;
    let lastW = 0;
    let lastH = 0;
    let lastDpr = 0;

    const applySize = () => {
      const game = gameInstanceRef.current;
      if (!game) return;
      const { w, h, dpr } = getViewport();
      // Reallocating the WebGL buffers is expensive — skip no-op resize events
      if (w === lastW && h === lastH && dpr === lastDpr) return;
      lastW = w;
      lastH = h;
      lastDpr = dpr;
      game.scale.resize(Math.round(w * dpr), Math.round(h * dpr));
      game.scale.setZoom(1 / dpr);
      const scene = game.scene.getScene('TowerScene') as TowerScene | null;
      if (scene && typeof scene.onResize === 'function') {
        scene.onResize();
      }
    };

    // Mobile browsers fire a burst of resize events while the address bar slides in/out.
    // Wait until the viewport settles, then resize once.
    const handleResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(applySize, 140);
    };

    // Adaptive quality: if the device keeps dropping well below 60fps, lower the render
    // resolution one notch (never below 1x). A slightly softer picture beats a stuttering game.
    let slowChecks = 0;
    const checkPerformance = () => {
      const game = gameInstanceRef.current;
      if (!game || document.hidden || !gameEvents.sceneReady) {
        slowChecks = 0;
        return;
      }
      const fps = game.loop.actualFps;
      if (fps > 0 && fps < 42) {
        slowChecks += 1;
      } else {
        slowChecks = 0;
      }
      if (slowChecks >= 2) {
        slowChecks = 0;
        const { dpr } = getViewport();
        if (dpr > MIN_RENDER_DPR) {
          qualityScale = Math.max(0.5, qualityScale - 0.25);
          applySize();
        }
      }
    };

    const startGame = () => {
      if (cancelled || gameInstanceRef.current) return;
      container.innerHTML = '';

      const { w, h, dpr } = getViewport();
      lastW = w;
      lastH = h;
      lastDpr = dpr;

      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: container,
        width: Math.round(w * dpr),
        height: Math.round(h * dpr),
        backgroundColor: '#f8e7d6',
        scale: {
          mode: Phaser.Scale.NONE,
          zoom: 1 / dpr,
        },
        render: {
          antialias: true,
          pixelArt: false,
          roundPixels: false,
        },
        fps: {
          target: 60,
          smoothStep: true,
        },
        physics: {
          default: 'arcade',
          arcade: {
            gravity: { x: 0, y: 0 },
            debug: false,
          },
        },
        input: {
          activePointers: 3,
        },
        scene: [TowerScene],
      };

      gameInstanceRef.current = new Phaser.Game(config);
      activeGame = gameInstanceRef.current;
      qualityTimer = window.setInterval(checkPerformance, 2500);

      window.addEventListener('resize', handleResize);
      window.addEventListener('orientationchange', handleResize);
      window.visualViewport?.addEventListener('resize', handleResize);
    };

    // Wait for the Fredoka web font so in-game labels don't render in a fallback font
    const fontsReady: Promise<unknown> =
      typeof document !== 'undefined' && document.fonts
        ? Promise.race([
            document.fonts.load('700 16px "Fredoka"').then(() => document.fonts.ready),
            new Promise((r) => setTimeout(r, 1500)),
          ])
        : Promise.resolve();

    fontsReady.then(startGame, startGame);

    return () => {
      cancelled = true;
      window.clearTimeout(resizeTimer);
      window.clearInterval(qualityTimer);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);

      if (gameInstanceRef.current) {
        const scene = gameInstanceRef.current.scene.getScene(
          'TowerScene'
        ) as TowerScene | null;
        if (scene && typeof scene.cleanupListeners === 'function') {
          scene.cleanupListeners();
        }
        if (activeGame === gameInstanceRef.current) activeGame = null;
        gameInstanceRef.current.destroy(true);
        gameInstanceRef.current = null;
      }
      container.innerHTML = '';
    };
  }, []);

  return (
    <div
      ref={containerRef}
      id="phaser-tower-container"
      className="phaser-canvas-wrapper"
      aria-label="Knowledge Tower Game World"
    />
  );
};
