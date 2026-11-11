import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { TowerScene } from './TowerScene';
import { towerConfig } from '../data/towerConfig';

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

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: container,
      width: towerConfig.towerWidth,
      height: 620,
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

    return () => {
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
