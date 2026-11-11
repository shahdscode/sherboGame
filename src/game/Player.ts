import Phaser from 'phaser';
import { TowerConfigRuntime } from '../data/towerConfig';
import { TouchInputState, CharacterPose } from './EventBus';

const POSE_TEXTURE_MAP: Record<CharacterPose, string> = {
  climbing: 'char-idle-0',
  question: 'char-question',
  retry: 'char-retry',
  goodjob: 'char-goodjob',
};

export class Player {
  private scene: Phaser.Scene;
  private config: TowerConfigRuntime;
  public sprite!: Phaser.Physics.Arcade.Sprite;
  public visualSprite!: Phaser.GameObjects.Sprite;
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
  private currentPose: CharacterPose = 'climbing';
  private baseScale: number = 0.58; // 180px * 0.58 ≈ 104px character height
  private jumpBufferTimer: number = 0;
  private coyoteTimer: number = 0;
  private wasAirborne: boolean = false;

  public static preloadAssets(scene: Phaser.Scene): void {
    // 1. Extracted character sheet animation frames
    for (let i = 0; i < 8; i++) {
      scene.load.image(`char-idle-${i}`, `/stickers/character/idle_${i}.png`);
      scene.load.image(`char-run-right-${i}`, `/stickers/character/run_right_${i}.png`);
      scene.load.image(`char-run-left-${i}`, `/stickers/character/run_left_${i}.png`);
      scene.load.image(`char-jump-${i}`, `/stickers/character/jump_${i}.png`);
      scene.load.image(`char-land-${i}`, `/stickers/character/land_${i}.png`);
    }
    for (let i = 0; i < 5; i++) {
      scene.load.image(`char-fall-${i}`, `/stickers/character/fall_${i}.png`);
    }

    // 2. Checkpoint & feedback stickers (containing speech bubbles)
    scene.load.image('char-climbing', '/stickers/character/idle_0.png');
    scene.load.image('char-question', '/stickers/question.png');
    scene.load.image('char-retry', '/stickers/retry.png');
    scene.load.image('char-goodjob', '/stickers/goodjob.png');
  }

  constructor(scene: Phaser.Scene, config: TowerConfigRuntime) {
    this.scene = scene;
    this.config = config;
    this.createPhysicsPlaceholderTexture();
    this.createAnimations();
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

  private createAnimations(): void {
    const animDefs = [
      { key: 'anim-idle', prefix: 'char-idle-', count: 8, rate: 8, repeat: -1 },
      { key: 'anim-run-right', prefix: 'char-run-right-', count: 8, rate: 14, repeat: -1 },
      { key: 'anim-run-left', prefix: 'char-run-left-', count: 8, rate: 14, repeat: -1 },
      { key: 'anim-jump', prefix: 'char-jump-', count: 8, rate: 12, repeat: 0 },
      { key: 'anim-fall', prefix: 'char-fall-', count: 5, rate: 10, repeat: -1 },
      { key: 'anim-land', prefix: 'char-land-', count: 8, rate: 16, repeat: 0 },
    ];

    for (const def of animDefs) {
      if (!this.scene.anims.exists(def.key)) {
        const frames = Array.from({ length: def.count }, (_, i) => ({
          key: `${def.prefix}${i}`,
        }));
        this.scene.anims.create({
          key: def.key,
          frames,
          frameRate: def.rate,
          repeat: def.repeat,
        });
      }
    }
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
    body.setCollideWorldBounds(true);

    // Visible animated sprite
    this.visualSprite = this.scene.add.sprite(
      startX,
      startY,
      'char-idle-0'
    );
    this.visualSprite.setScale(this.baseScale);
    this.visualSprite.setOrigin(0.5, 0.88);
    this.visualSprite.setDepth(22);
    this.visualSprite.play('anim-idle');
    this.syncVisualPosition();
  }

  private syncVisualPosition(): void {
    if (!this.visualSprite || !this.sprite) return;
    const bodyBottomY = this.sprite.y + this.config.player.height / 2;
    this.visualSprite.x = this.sprite.x;
    this.visualSprite.y = bodyBottomY;
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

    if (pose !== 'climbing') {
      // Pause animation and show checkpoint sticker
      this.visualSprite.stop();
      const texKey = POSE_TEXTURE_MAP[pose] || 'char-question';
      if (this.scene.textures.exists(texKey)) {
        this.visualSprite.setTexture(texKey);
      }
      this.visualSprite.setScale(0.24);
      this.visualSprite.setOrigin(0.5, 0.84);
      this.visualSprite.setFlipX(false);
      this.scene.tweens.add({
        targets: this.visualSprite,
        scaleX: 0.27,
        scaleY: 0.27,
        duration: 160,
        yoyo: true,
      });
    } else {
      this.visualSprite.setScale(this.baseScale);
      this.visualSprite.setOrigin(0.5, 0.88);
      this.visualSprite.play('anim-idle', true);
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
    this.jumpBufferTimer = 0;
    this.coyoteTimer = 0;
    this.setPose('climbing');
    this.touchInput = { left: false, right: false, jump: false };
    this.syncVisualPosition();
  }

  public freeze(): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (!body) return;
    this.sprite.setVelocity(0, 0);
    this.sprite.setAcceleration(0, 0);
    this.jumpBufferTimer = 0;
    this.syncVisualPosition();
  }

  public update(delta: number, canControl: boolean): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (!body || !body.enable) {
      this.syncVisualPosition();
      return;
    }

    if (!canControl) {
      this.sprite.setVelocityX(0);
      if (this.currentPose === 'climbing') {
        this.visualSprite.play('anim-idle', true);
      }
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

    // Jump Buffering — ensures fast taps register even 180ms before touching the platform
    if (jumpPressed) {
      this.jumpBufferTimer = 180;
    } else if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer -= delta;
    }

    // Coyote Time — 120ms grace window after leaving platform edge
    if (onFloor) {
      this.coyoteTimer = 120;
    } else if (this.coyoteTimer > 0) {
      this.coyoteTimer -= delta;
    }

    // Instant zero-lag arcade horizontal movement
    if (moveLeft && !moveRight) {
      this.sprite.setVelocityX(-this.config.player.moveSpeed);
    } else if (moveRight && !moveLeft) {
      this.sprite.setVelocityX(this.config.player.moveSpeed);
    } else {
      this.sprite.setVelocityX(0);
    }

    // Enforce tower inner boundaries
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

    // Jump Execution
    if (this.jumpBufferTimer > 0 && (onFloor || this.coyoteTimer > 0)) {
      this.sprite.setVelocityY(this.config.player.jumpVelocity);
      this.jumpBufferTimer = 0;
      this.coyoteTimer = 0;
      if (this.currentPose === 'climbing') {
        this.visualSprite.play('anim-jump', true);
      }
    }

    // Landing detection
    if (onFloor && this.wasAirborne) {
      if (this.currentPose === 'climbing') {
        this.visualSprite.play('anim-land', true);
      }
    }
    this.wasAirborne = !onFloor;

    // Sprite Animation Controller
    if (this.currentPose === 'climbing') {
      if (onFloor) {
        if (Math.abs(body.velocity.x) > 15) {
          if (body.velocity.x > 0) {
            this.visualSprite.play('anim-run-right', true);
          } else {
            this.visualSprite.play('anim-run-left', true);
          }
        } else {
          // If not currently playing landing animation, play idle
          const currentAnim = this.visualSprite.anims.currentAnim;
          if (!currentAnim || currentAnim.key !== 'anim-land' || !this.visualSprite.anims.isPlaying) {
            this.visualSprite.play('anim-idle', true);
          }
        }
      } else {
        if (body.velocity.y < -30) {
          this.visualSprite.play('anim-jump', true);
        } else if (body.velocity.y > 30) {
          this.visualSprite.play('anim-fall', true);
        }
      }
    }

    this.syncVisualPosition();
  }
}
