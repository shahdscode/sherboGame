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
/**
 * Never zoom in so far on wide screens that less than ~3.7 steps of the tower are visible.
 * 400 still lets a 16:9 screen (720 / (16/9) = 405) fill edge-to-edge.
 */
const MIN_VISIBLE_WORLD_HEIGHT = 400;
/**
 * On wide screens the view shows this much of the outer wall on each side of the tower,
 * which zooms out a little (≈ 525 world units visible vertically on a 16:10 laptop instead
 * of 450) while still filling the screen edge to edge.
 */
const WIDE_SIDE_MARGIN = 60;
/**
 * How far the tower's outer walls are drawn beyond the play area on each side. Must cover
 * the widest view (ultra-wide 21:9 at MIN_VISIBLE_WORLD_HEIGHT shows ~115 per side).
 */
export const OUTER_WALL_EXTENT = 140;

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
    let zoom = Math.max(0.5, Math.min(zoomByHeight, zoomByWidth));

    // Laptops / desktops: the height-based zoom leaves empty sky either side of the tower.
    // Zoom in until the tower (plus a strip of outer wall) spans the full screen width —
    // but never so far that fewer than MIN_VISIBLE_WORLD_HEIGHT units are visible vertically.
    const zoomToFillWidth = this.camera.width / (towerWidth + WIDE_SIDE_MARGIN * 2);
    if (zoomToFillWidth > zoom) {
      const maxZoomByHeight = this.camera.height / MIN_VISIBLE_WORLD_HEIGHT;
      zoom = Math.max(zoom, Math.min(zoomToFillWidth, maxZoomByHeight));
    }
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
