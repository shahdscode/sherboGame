import Phaser from 'phaser';
import { TowerConfigRuntime } from '../data/towerConfig';
import { TouchInputState, CharacterPose } from './EventBus';

const POSE_TEXTURE_MAP: Record<CharacterPose, string> = {
  climbing: 'char-climbing',
  question: 'char-question',
  retry: 'char-retry',
  goodjob: 'char-goodjob',
};

export class Player {
  private scene: Phaser.Scene;
  private config: TowerConfigRuntime;
  public sprite!: Phaser.Physics.Arcade.Sprite;
  private visualSprite!: Phaser.GameObjects.Image;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    SPACE: Phaser.Input.Keyboard.Key;
  };
  private touchInput: TouchInputState = {
    left: false,
    right: false,
    jump: false,
  };
  private walkAnimTimer: number = 0;
  private wasAirborne: boolean = false;
  private currentPose: CharacterPose = 'climbing';
  private baseScale: number = 0.21; // 512px * 0.21 ≈ 108px character height

  public static preloadAssets(scene: Phaser.Scene): void {
    scene.load.image('char-climbing', '/stickers/climbing figure.png');
    scene.load.image('char-question', '/stickers/question.png');
    scene.load.image('char-retry', '/stickers/retry.png');
    scene.load.image('char-goodjob', '/stickers/goodjob.png');
  }

  constructor(scene: Phaser.Scene, config: TowerConfigRuntime) {
    this.scene = scene;
    this.config = config;
    this.createPhysicsPlaceholderTexture();
    this.createSprite();
    this.setupKeyboard();
  }

  private createPhysicsPlaceholderTexture(): void {
    if (this.scene.textures.exists('player-hitbox')) return;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 0);
    g.fillRect(0, 0, this.config.player.width, this.config.player.height);
    g.generateTexture(
      'player-hitbox',
      this.config.player.width,
      this.config.player.height
    );
    g.destroy();
  }

  private createSprite(): void {
    const startX = this.config.towerWidth / 2;
    const startY = this.config.groundY - 10 - this.config.player.height / 2;

    // Invisible physics collider sprite
    this.sprite = this.scene.physics.add.sprite(
      startX,
      startY,
      'player-hitbox'
    );
    this.sprite.setAlpha(0);
    this.sprite.setDepth(20);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(this.config.player.width, this.config.player.height);
    body.setGravityY(this.config.player.gravityY);
    body.setMaxVelocity(this.config.player.moveSpeed, 950);
    body.setDragX(this.config.player.drag);
    body.setCollideWorldBounds(true);

    // Visible sticker character sprite rendered on top of the physics body
    this.visualSprite = this.scene.add.image(
      startX,
      startY,
      POSE_TEXTURE_MAP.climbing
    );
    this.visualSprite.setScale(this.baseScale);
    this.visualSprite.setDepth(22);
    this.syncVisualPosition();
  }

  private syncVisualPosition(): void {
    if (!this.visualSprite || !this.sprite) return;
    // Align feet of the 512x512 sticker (bottom of shoes at ~473/512) with the bottom of the physics body
    const bodyBottomY = this.sprite.y + this.config.player.height / 2;
    this.visualSprite.x = this.sprite.x;
    this.visualSprite.y = bodyBottomY - 41;
  }

  private setupKeyboard(): void {
    if (!this.scene.input.keyboard) return;
    this.cursors = this.scene.input.keyboard.createCursorKeys();
    this.wasd = {
      W: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      SPACE: this.scene.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.SPACE
      ),
    };
  }

  public setPose(pose: CharacterPose): void {
    this.currentPose = pose;
    if (!this.visualSprite) return;
    const texKey = POSE_TEXTURE_MAP[pose] || POSE_TEXTURE_MAP.climbing;
    if (this.scene.textures.exists(texKey)) {
      this.visualSprite.setTexture(texKey);
    }
    // Do not horizontally flip textures that contain Arabic speech bubbles!
    if (pose !== 'climbing') {
      this.visualSprite.setFlipX(false);
      this.visualSprite.setAngle(0);
      this.scene.tweens.add({
        targets: this.visualSprite,
        scaleX: this.baseScale * 1.12,
        scaleY: this.baseScale * 1.12,
        duration: 160,
        yoyo: true,
      });
    } else {
      this.visualSprite.setScale(this.baseScale);
    }
  }

  public getPose(): CharacterPose {
    return this.currentPose;
  }

  public setTouchInput(input: TouchInputState): void {
    this.touchInput = { ...input };
  }

  public resetPosition(): void {
    const startX = this.config.towerWidth / 2;
    const startY = this.config.groundY - 10 - this.config.player.height / 2;
    this.sprite.setPosition(startX, startY);
    this.sprite.setVelocity(0, 0);
    this.sprite.setAcceleration(0, 0);
    this.setPose('climbing');
    this.visualSprite.setScale(this.baseScale);
    this.visualSprite.setAngle(0);
    this.touchInput = { left: false, right: false, jump: false };
    this.syncVisualPosition();
  }

  public freeze(): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (!body) return;
    this.sprite.setVelocity(0, 0);
    this.sprite.setAcceleration(0, 0);
    this.visualSprite.setAngle(0);
    this.syncVisualPosition();
  }

  public update(delta: number, canControl: boolean): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (!body || !body.enable) {
      this.syncVisualPosition();
      return;
    }

    if (!canControl) {
      this.sprite.setAccelerationX(0);
      this.sprite.setVelocityX(0);
      this.syncVisualPosition();
      return;
    }

    const moveLeft =
      Boolean(this.cursors?.left?.isDown) ||
      Boolean(this.wasd?.A?.isDown) ||
      this.touchInput.left;

    const moveRight =
      Boolean(this.cursors?.right?.isDown) ||
      Boolean(this.wasd?.D?.isDown) ||
      this.touchInput.right;

    const jumpPressed =
      Boolean(this.cursors?.up?.isDown) ||
      Boolean(this.cursors?.space?.isDown) ||
      Boolean(this.wasd?.W?.isDown) ||
      Boolean(this.wasd?.SPACE?.isDown) ||
      this.touchInput.jump;

    const onFloor = body.blocked.down || body.touching.down;

    // Horizontal movement — snappy arcade responsiveness
    if (moveLeft && !moveRight) {
      if (body.velocity.x > 0) this.sprite.setVelocityX(0);
      this.sprite.setAccelerationX(-this.config.player.acceleration);
    } else if (moveRight && !moveLeft) {
      if (body.velocity.x < 0) this.sprite.setVelocityX(0);
      this.sprite.setAccelerationX(this.config.player.acceleration);
    } else {
      this.sprite.setAccelerationX(0);
    }

    // Enforce tower inner boundaries strictly
    const minX = this.config.wallThickness + this.config.player.width / 2;
    const maxX =
      this.config.towerWidth -
      this.config.wallThickness -
      this.config.player.width / 2;
    if (this.sprite.x < minX) {
      this.sprite.x = minX;
      if (body.velocity.x < 0) this.sprite.setVelocityX(0);
    } else if (this.sprite.x > maxX) {
      this.sprite.x = maxX;
      if (body.velocity.x > 0) this.sprite.setVelocityX(0);
    }

    // Jumping
    if (jumpPressed && onFloor) {
      this.sprite.setVelocityY(this.config.player.jumpVelocity);
      this.scene.tweens.add({
        targets: this.visualSprite,
        scaleX: this.baseScale * 0.9,
        scaleY: this.baseScale * 1.12,
        duration: 120,
        yoyo: true,
      });
    }

    // Landing squash feedback
    if (onFloor && this.wasAirborne) {
      this.scene.tweens.add({
        targets: this.visualSprite,
        scaleX: this.baseScale * 1.1,
        scaleY: this.baseScale * 0.9,
        duration: 95,
        yoyo: true,
      });
    }
    this.wasAirborne = !onFloor;

    // Playful climbing/walking bob animation on the climbing figure sticker
    if (!onFloor) {
      this.visualSprite.setAngle(body.velocity.x * 0.025);
    } else if (Math.abs(body.velocity.x) > 20) {
      this.walkAnimTimer += delta * 0.018;
      this.visualSprite.setAngle(Math.sin(this.walkAnimTimer) * 6);
    } else {
      this.visualSprite.setAngle(0);
      this.walkAnimTimer = 0;
    }

    this.syncVisualPosition();
  }
}
