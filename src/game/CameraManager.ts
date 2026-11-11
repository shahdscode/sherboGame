import Phaser from 'phaser';
import { TowerConfigRuntime } from '../data/towerConfig';

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
    const { towerWidth, worldHeight } = this.config;
    this.camera.setBounds(0, 0, towerWidth, worldHeight);
    this.updateZoom();
    // Follow target smoothly on both X and Y so platforms and character stay centered
    this.camera.startFollow(target, true, 0.12, 0.14, 0, 40);
  }

  public updateZoom(): void {
    // Zoom in so the visible vertical range is always ~620-660px (approx 5 platforms),
    // matching the zoomed-in laptop experience on any mobile phone.
    // Platforms high above stay hidden until the player climbs up to reach them.
    const desiredVisibleHeight = 640;
    const computedZoom = Math.max(1.18, this.camera.height / desiredVisibleHeight);
    this.camera.setZoom(computedZoom);
  }

  public resetToBottom(): void {
    this.updateZoom();
    const visibleH = this.camera.height / this.camera.zoom;
    this.camera.centerOn(
      this.config.towerWidth / 2,
      this.config.groundY - visibleH * 0.35
    );
  }
}
