import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { TowerScene } from './TowerScene';
import { towerConfig } from '../data/towerConfig';

const computeGameDimensions = () => {
  const baseWidth = towerConfig.towerWidth; // 720
  if (typeof window === 'undefined') {
    return { width: baseWidth, height: 960 };
  }
  const winW = window.innerWidth || document.documentElement.clientWidth || 720;
  const winH = window.innerHeight || document.documentElement.clientHeight || 960;
  const aspect = winH / winW;

  // In portrait orientation (phones/tablets), match the screen's aspect ratio so the tower
  // fills the full viewport height with zero wasted letterboxing.
  // In landscape/desktop, clamp to a comfortable tower viewport height.
  let targetHeight = Math.round(baseWidth * aspect);
  targetHeight = Math.max(680, Math.min(targetHeight, 1600));

  return { width: baseWidth, height: targetHeight };
};

export const TowerGame: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameInstanceRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (gameInstanceRef.current) {
      return;
    }
    container.innerHTML = '';

    const initialSize = computeGameDimensions();

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: container,
      width: initialSize.width,
      height: initialSize.height,
      backgroundColor: '#0f172a',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scene: [TowerScene],
    };

    const game = new Phaser.Game(config);
    gameInstanceRef.current = game;

    const handleResize = () => {
      if (!gameInstanceRef.current) return;
      const { width, height } = computeGameDimensions();
      gameInstanceRef.current.scale.resize(width, height);
      const scene = gameInstanceRef.current.scene.getScene(
        'TowerScene'
      ) as TowerScene | null;
      if (scene && typeof scene.onResize === 'function') {
        scene.onResize();
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);

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
      if (container) {
        container.innerHTML = '';
      }
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
