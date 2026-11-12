import Phaser from 'phaser';
import { TowerConfigRuntime } from '../data/towerConfig';

/** Target vertical world span visible on screen (~5.5 steps, zoomed-in arcade feel). */
const VISIBLE_WORLD_HEIGHT = 620;
/**
 * Minimum horizontal world span on portrait phones. Platforms zig-zag up to ~240px either
 * side of the tower centre, so the view must be wide enough that the NEXT platform is
 * always on screen (with 390 students had to jump blind towards off-screen platforms).
 */
const MIN_VISIBLE_WORLD_WIDTH = 600;

export class CameraManager {
  private scene: Phaser.Scene;
  private config: TowerConfigRuntime;
  public camera: Phaser.Cameras.Scene2D.Camera;

  constructor(scene: Phaser.Scene, config: TowerConfigRuntime) {
    this.scene = scene;
    this.config = config;
    this.camera = this.scene.cameras.main;
  }

  public setup(target: Phaser.GameObjects.GameObject): void {
    this.camera.setBackgroundColor('#f8e7d6');
    this.camera.roundPixels = false;
    this.updateZoom();
    this.camera.startFollow(target, false, 0.12, 0.14, 0, 55);
  }

  public updateZoom(): void {
    const { towerWidth, worldHeight } = this.config;
    const zoomByHeight = this.camera.height / VISIBLE_WORLD_HEIGHT;
    const zoomByWidth = this.camera.width / MIN_VISIBLE_WORLD_WIDTH;
    const zoom = Math.max(0.5, Math.min(zoomByHeight, zoomByWidth));
    this.camera.setZoom(zoom);

    // If the viewport is wider than the 720px tower (e.g. desktop landscape),
    // pad horizontal camera bounds symmetrically so the tower stays dead-center.
    const visibleWorldW = this.camera.width / zoom;
    const extraX = Math.max(0, (visibleWorldW - towerWidth) / 2);
    this.camera.setBounds(
      -extraX,
      0,
      towerWidth + extraX * 2,
      worldHeight
    );
  }

  public resetToBottom(): void {
    this.updateZoom();
    const visibleH = this.camera.height / this.camera.zoom;
    this.camera.centerOn(
      this.config.towerWidth / 2,
      this.config.groundY - visibleH * 0.3
    );
  }
}
