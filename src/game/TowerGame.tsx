import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { TowerScene } from './TowerScene';

/**
 * The canvas is rendered at the device's real pixel density (e.g. 3x on iPhones)
 * and then shown at CSS size via Phaser's `zoom`. This keeps every platform,
 * text label and sprite crisp instead of upscaling a small canvas (which looked pixelated).
 */
const getViewport = () => {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  const w = Math.max(320, Math.round(vv?.width ?? window.innerWidth));
  const h = Math.max(320, Math.round(vv?.height ?? window.innerHeight));
  const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);
  return { w, h, dpr };
};

export const TowerGame: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameInstanceRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let rafId = 0;

    const handleResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const game = gameInstanceRef.current;
        if (!game) return;
        const { w, h, dpr } = getViewport();
        game.scale.resize(Math.round(w * dpr), Math.round(h * dpr));
        game.scale.setZoom(1 / dpr);
        const scene = game.scene.getScene('TowerScene') as TowerScene | null;
        if (scene && typeof scene.onResize === 'function') {
          scene.onResize();
        }
      });
    };

    const startGame = () => {
      if (cancelled || gameInstanceRef.current) return;
      container.innerHTML = '';

      const { w, h, dpr } = getViewport();

      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: container,
        width: Math.round(w * dpr),
        height: Math.round(h * dpr),
        backgroundColor: '#070b18',
        scale: {
          mode: Phaser.Scale.NONE,
          zoom: 1 / dpr,
        },
        render: {
          antialias: true,
          pixelArt: false,
          roundPixels: false,
          powerPreference: 'high-performance',
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
      cancelAnimationFrame(rafId);
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
