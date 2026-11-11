import Phaser from 'phaser';
import { TowerConfigRuntime } from '../data/towerConfig';

export class CameraManager {
  private scene: Phaser.Scene;
  private config: TowerConfigRuntime;
  private camera: Phaser.Cameras.Scene2D.Camera;

  constructor(scene: Phaser.Scene, config: TowerConfigRuntime) {
    this.scene = scene;
    this.config = config;
    this.camera = this.scene.cameras.main;
  }

  public setup(target: Phaser.GameObjects.GameObject): void {
    const { towerWidth, worldHeight } = this.config;
    this.camera.setBounds(0, 0, towerWidth, worldHeight);
    // Keep zoom at 1 so the entire 720px tower width is visible edge-to-edge
    this.camera.setZoom(1);
    // Follow the player smoothly on Y; lock X to 0 lerp so camera stays centered on tower
    this.camera.startFollow(target, true, 0, 0.12, 0, 60);
  }

  public resetToBottom(): void {
    this.camera.centerOn(
      this.config.towerWidth / 2,
      this.config.groundY - (this.camera.height * 0.28)
    );
  }
}
