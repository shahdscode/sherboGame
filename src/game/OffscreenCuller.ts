import Phaser from 'phaser';

/**
 * Skips drawing tower decorations that are far above or below the camera.
 *
 * The tower is ~8,600 world units tall but only ~500 are on screen, yet Phaser submits every
 * game object to the renderer every frame (it does no automatic off-screen culling). On slow
 * phones that per-object CPU work is the main frame cost. This hooks the camera manager's
 * render filter and drops objects whose vertical extent is outside the view (plus a margin).
 *
 * It never touches `visible`, so game logic that shows/hides objects keeps working. Only
 * objects present when `snapshot()` runs are culled, and their vertical extent is measured
 * once — everything created later (the player, effects, celebrations) always renders.
 */
const MARGIN = 320; // covers bobbing coins, crumbling platforms falling away, gate tweens

export class OffscreenCuller {
  private extents = new Map<Phaser.GameObjects.GameObject, [number, number]>();
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Records the vertical extent of every top-level object currently in the scene.
   * @param movable objects that move vertically later and therefore must never be culled
   */
  public snapshot(movable: Phaser.GameObjects.GameObject[] = []): void {
    this.extents.clear();
    const skip = new Set(movable);
    for (const obj of this.scene.children.list) {
      if (skip.has(obj)) continue;
      const anyObj = obj as any;
      // Graphics have no bounds (and the few big ones span the whole tower anyway);
      // anything not scrolling with the camera must always draw.
      if (typeof anyObj.getBounds !== 'function') continue;
      if (anyObj.scrollFactorY !== undefined && anyObj.scrollFactorY !== 1) continue;
      try {
        const b = anyObj.getBounds() as Phaser.Geom.Rectangle;
        if (!Number.isFinite(b.top) || !Number.isFinite(b.bottom)) continue;
        this.extents.set(obj, [b.top, b.bottom]);
      } catch {
        // Unmeasurable object: leave it out of culling
      }
    }

    const cameras = this.scene.cameras;
    const extents = this.extents;
    cameras.getVisibleChildren = (children, camera) => {
      const view = camera.worldView;
      const top = view.y - MARGIN;
      const bottom = view.bottom + MARGIN;
      return children.filter((child) => {
        const e = extents.get(child);
        if (e && (e[1] < top || e[0] > bottom)) return false;
        return child.willRender(camera);
      });
    };
  }
}
