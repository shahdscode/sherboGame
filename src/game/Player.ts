import Phaser from 'phaser';
import { TowerConfigRuntime } from '../data/towerConfig';
import { TouchInputState, CharacterPose } from './EventBus';
import { sfx } from './sfx';

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
  // Character frames are 240x360 (2x HD); 360 * 0.29 ≈ 104px world height
  private baseScale: number = 0.29;
  private jumpBufferTimer: number = 0;
  private coyoteTimer: number = 0;
  private landLockTimer: number = 0;
  private wasAirborne: boolean = false;
  private facing: 'left' | 'right' = 'right';

  public static preloadAssets(scene: Phaser.Scene): void {
    // 1. Extracted 2x HD character sheet animation frames
    for (let i = 0; i < 8; i++) {
      scene.load.image(`char-idle-${i}`, `/stickers/character/idle_${i}.png`);
      scene.load.image(
        `char-run-right-${i}`,
        `/stickers/character/run_right_${i}.png`
      );
      scene.load.image(
        `char-run-left-${i}`,
        `/stickers/character/run_left_${i}.png`
      );
      scene.load.image(
        `char-jump-right-${i}`,
        `/stickers/character/jump_right_${i}.png`
      );
      scene.load.image(
        `char-jump-left-${i}`,
        `/stickers/character/jump_left_${i}.png`
      );
      scene.load.image(`char-jump-${i}`, `/stickers/character/jump_${i}.png`);
      scene.load.image(`char-land-${i}`, `/stickers/character/land_${i}.png`);
    }
    for (let i = 0; i < 5; i++) {
      scene.load.image(`char-fall-${i}`, `/stickers/character/fall_${i}.png`);
    }

    // 2. High-DPI (1024x1024) checkpoint & feedback stickers
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
    const animDefs: Array<{
      key: string;
      frames: Array<{ key: string }>;
      rate: number;
      repeat: number;
    }> = [
      {
        key: 'anim-idle',
        frames: Array.from({ length: 8 }, (_, i) => ({ key: `char-idle-${i}` })),
        rate: 9,
        repeat: -1,
      },
      {
        key: 'anim-run-right',
        frames: Array.from({ length: 8 }, (_, i) => ({
          key: `char-run-right-${i}`,
        })),
        rate: 15,
        repeat: -1,
      },
      {
        key: 'anim-run-left',
        frames: Array.from({ length: 8 }, (_, i) => ({
          key: `char-run-left-${i}`,
        })),
        rate: 15,
        repeat: -1,
      },
      {
        key: 'anim-jump-right',
        // Frames 0..6 are airborne; frame 7 is ground landing squat
        frames: Array.from({ length: 7 }, (_, i) => ({
          key: `char-jump-right-${i}`,
        })),
        rate: 14,
        repeat: 0,
      },
      {
        key: 'anim-jump-left',
        // Frames 0..6 are airborne; frame 7 is ground landing squat
        frames: Array.from({ length: 7 }, (_, i) => ({
          key: `char-jump-left-${i}`,
        })),
        rate: 14,
        repeat: 0,
      },
      {
        key: 'anim-jump',
        frames: Array.from({ length: 7 }, (_, i) => ({ key: `char-jump-${i}` })),
        rate: 14,
        repeat: 0,
      },
      {
        key: 'anim-fall',
        // Smooth airborne falling oscillation using airborne frames 0..3
        frames: [
          { key: 'char-fall-0' },
          { key: 'char-fall-1' },
          { key: 'char-fall-2' },
          { key: 'char-fall-3' },
          { key: 'char-fall-2' },
          { key: 'char-fall-1' },
        ],
        rate: 12,
        repeat: -1,
      },
      {
        key: 'anim-land',
        // Impact crouch (fall-4) into 8-frame recovery to upright standing
        frames: [
          { key: 'char-fall-4' },
          ...Array.from({ length: 8 }, (_, i) => ({ key: `char-land-${i}` })),
        ],
        rate: 18,
        repeat: 0,
      },
    ];

    for (const def of animDefs) {
      if (!this.scene.anims.exists(def.key)) {
        this.scene.anims.create({
          key: def.key,
          frames: def.frames,
          frameRate: def.rate,
          repeat: def.repeat,
        });
      }
    }
  }

  private createSprite(): void {
    const startX = this.config.towerWidth / 2;
    const startY = this.config.groundY - 10 - this.config.player.height / 2;

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

    this.visualSprite = this.scene.add.sprite(startX, startY, 'char-idle-0');
    this.visualSprite.setScale(this.baseScale);
    this.visualSprite.setOrigin(0.5, 0.96);
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

  private spawnDustPuff(count: number = 5): void {
    const footY = this.sprite.y + this.config.player.height / 2 - 2;
    const footX = this.sprite.x;
    for (let i = 0; i < count; i++) {
      const dir = i % 2 === 0 ? -1 : 1;
      const spreadX = dir * Phaser.Math.Between(8, 28);
      const puff = this.scene.add
        .circle(
          footX + Phaser.Math.Between(-8, 8),
          footY,
          Phaser.Math.Between(4, 7),
          0x1b2a53, // Dark Deep Navy smoke for clear visibility against light background
          0.78
        )
        .setDepth(21);

      this.scene.tweens.add({
        targets: puff,
        x: puff.x + spreadX,
        y: footY - Phaser.Math.Between(4, 16),
        scale: 0.2,
        alpha: 0,
        duration: 280,
        ease: 'Quad.easeOut',
        onComplete: () => puff.destroy(),
      });
    }
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
      this.visualSprite.stop();
      const texKey = POSE_TEXTURE_MAP[pose] || 'char-question';
      if (this.scene.textures.exists(texKey)) {
        this.visualSprite.setTexture(texKey);
      }
      // 1024x1024 stickers scaled to 0.12 ≈ 122px in-world height
      this.visualSprite.setScale(0.12);
      this.visualSprite.setOrigin(0.5, 0.84);
      this.visualSprite.setFlipX(false);
      this.scene.tweens.add({
        targets: this.visualSprite,
        scaleX: 0.135,
        scaleY: 0.135,
        duration: 160,
        yoyo: true,
      });
    } else {
      this.visualSprite.setScale(this.baseScale);
      this.visualSprite.setOrigin(0.5, 0.96);
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
    this.landLockTimer = 0;
    this.facing = 'right';
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

    if (this.landLockTimer > 0) {
      this.landLockTimer = Math.max(0, this.landLockTimer - delta);
    }

    const moveLeft =
      canControl &&
      (Boolean(this.cursors?.left?.isDown) ||
        Boolean(this.wasd?.A?.isDown) ||
        this.touchInput.left);

    const moveRight =
      canControl &&
      (Boolean(this.cursors?.right?.isDown) ||
        Boolean(this.wasd?.D?.isDown) ||
        this.touchInput.right);

    const jumpPressed =
      canControl &&
      (Boolean(this.cursors?.up?.isDown) ||
        Boolean(this.cursors?.space?.isDown) ||
        Boolean(this.wasd?.W?.isDown) ||
        Boolean(this.wasd?.SPACE?.isDown) ||
        this.touchInput.jump);

    const onFloor = body.blocked.down || body.touching.down;

    if (jumpPressed) {
      this.jumpBufferTimer = 180;
    } else if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer -= delta;
    }

    if (!canControl) {
      this.jumpBufferTimer = 0;
    }

    if (onFloor) {
      this.coyoteTimer = 120;
    } else if (this.coyoteTimer > 0) {
      this.coyoteTimer -= delta;
    }

    if (moveLeft && !moveRight) {
      this.facing = 'left';
      this.sprite.setVelocityX(-this.config.player.moveSpeed);
    } else if (moveRight && !moveLeft) {
      this.facing = 'right';
      this.sprite.setVelocityX(this.config.player.moveSpeed);
    } else {
      this.sprite.setVelocityX(0);
    }

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

    // Jump execution
    if (this.jumpBufferTimer > 0 && (onFloor || this.coyoteTimer > 0)) {
      this.sprite.setVelocityY(this.config.player.jumpVelocity);
      this.jumpBufferTimer = 0;
      this.coyoteTimer = 0;
      this.landLockTimer = 0;
      this.spawnDustPuff(6);
      sfx.jump();
      if (this.currentPose === 'climbing') {
        const jumpAnim =
          this.facing === 'left' ? 'anim-jump-left' : 'anim-jump-right';
        this.visualSprite.play(jumpAnim, false);
      }
    }

    // Landing detection
    if (onFloor && this.wasAirborne) {
      this.spawnDustPuff(4);
      sfx.land();
      this.landLockTimer = 130;
      if (this.currentPose === 'climbing') {
        this.visualSprite.play('anim-land', false);
      }
    }
    this.wasAirborne = !onFloor;

    if (this.currentPose === 'climbing') {
      if (onFloor) {
        if (Math.abs(body.velocity.x) > 15) {
          // Allow brief landing impact squash before blending into run cycle
          const currentKey = this.visualSprite.anims.currentAnim?.key;
          if (
            currentKey !== 'anim-land' ||
            this.landLockTimer <= 0 ||
            !this.visualSprite.anims.isPlaying
          ) {
            if (body.velocity.x > 0) {
              this.visualSprite.play('anim-run-right', true);
            } else {
              this.visualSprite.play('anim-run-left', true);
            }
          }
        } else {
          const currentAnim = this.visualSprite.anims.currentAnim;
          if (
            !currentAnim ||
            currentAnim.key !== 'anim-land' ||
            !this.visualSprite.anims.isPlaying
          ) {
            this.visualSprite.play('anim-idle', true);
          }
        }
      } else {
        if (body.velocity.y <= 20) {
          const jumpAnim =
            body.velocity.x < -15 ||
            (body.velocity.x <= 15 && this.facing === 'left')
              ? 'anim-jump-left'
              : 'anim-jump-right';
          const currentKey = this.visualSprite.anims.currentAnim?.key;
          if (
            currentKey !== 'anim-jump-left' &&
            currentKey !== 'anim-jump-right'
          ) {
            this.visualSprite.play(jumpAnim, false);
          } else if (currentKey !== jumpAnim) {
            const frameIdx = Math.max(
              0,
              (this.visualSprite.anims.currentFrame?.index ?? 1) - 1
            );
            this.visualSprite.play(
              { key: jumpAnim, startFrame: frameIdx },
              false
            );
          }
        } else {
          this.visualSprite.play('anim-fall', true);
        }
      }
    }

    this.syncVisualPosition();
  }
}
