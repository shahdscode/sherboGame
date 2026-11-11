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
    // Zoom in so the tower, platforms, and character look larger and centered
    this.camera.setZoom(1.22);
    // Follow both horizontally and vertically with smooth lerp so the action stays centered
    this.camera.startFollow(target, true, 0.12, 0.12, 0, 50);
  }

  public resetToBottom(): void {
    this.camera.centerOn(this.config.towerWidth / 2, this.config.groundY - 120);
  }
}
