import Phaser from 'phaser';
import { TowerConfigRuntime, getSectionIndexForStep } from '../data/towerConfig';
import { TouchInputState, CharacterPose } from './EventBus';
import { sfx } from './sfx';

/** Single sprite sheet holding every character animation frame (see scripts/pack-sprites.py). */
const CHAR_ATLAS_KEY = 'char-atlas';
/** Second sprite sheet holding flip, victory, and celebration animations (see scripts/pack-actions.py). */
const CHAR_ACTIONS_KEY = 'char-actions';

/** Row order of the animations inside the sprite sheet (8 frames per row). */
const CHAR_ATLAS_ROWS = [
  'idle',
  'run-right',
  'run-left',
  'jump-right',
  'jump-left',
  'jump',
  'land',
  'fall',
] as const;

/** Row order of the actions inside the actions sprite sheet (12 frames per row). */
const CHAR_ACTIONS_ROWS = [
  'flip',
  'victory',
  'celebrate-clap',
  'celebrate-confetti',
  'celebrate-happy',
  'celebrate-cheer',
  'celebrate-clap-cheer',
  'celebrate-confetti-dance',
] as const;

function charFrame(
  anim: (typeof CHAR_ATLAS_ROWS)[number],
  index: number
): { key: string; frame: number } {
  return { key: CHAR_ATLAS_KEY, frame: CHAR_ATLAS_ROWS.indexOf(anim) * 8 + index };
}

function actionFrame(
  anim: (typeof CHAR_ACTIONS_ROWS)[number],
  index: number
): { key: string; frame: number } {
  return { key: CHAR_ACTIONS_KEY, frame: CHAR_ACTIONS_ROWS.indexOf(anim) * 12 + index };
}

export const CELEBRATION_ANIMS = [
  'anim-celebrate-clap',
  'anim-celebrate-confetti',
  'anim-celebrate-happy',
  'anim-celebrate-cheer',
  'anim-celebrate-clap-cheer',
  'anim-celebrate-confetti-dance',
] as const;

const POSE_TEXTURE_MAP: Record<CharacterPose, string> = {
  climbing: CHAR_ATLAS_KEY,
  question: 'char-question',
  retry: 'char-retry',
  goodjob: 'char-goodjob',
  victory: 'char-victory',
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
  private runPuffTimer: number = 0;
  private canDoubleJump: boolean = true;
  private isDoubleJumping: boolean = false;
  private prevJumpPressed: boolean = false;
  private wallBounceTimer: number = 0;

  public static preloadAssets(scene: Phaser.Scene): void {
    // 1. Extracted 2x HD character sheet animation frames
    // 1. All 64 character frames packed into ONE WebP sprite sheet (8 columns x 8 rows).
    //    One request (~0.5 MB) instead of 61 separate PNGs (~6.5 MB).
    scene.load.spritesheet(CHAR_ATLAS_KEY, '/stickers/character-atlas.webp', {
      frameWidth: 240,
      frameHeight: 360,
      spacing: 4,
    });

    // 2. Flip, victory, and celebration animations (12 columns x 8 rows WebP)
    scene.load.spritesheet(CHAR_ACTIONS_KEY, '/stickers/actions-atlas.webp', {
      frameWidth: 240,
      frameHeight: 360,
      spacing: 4,
    });

    // 3. Checkpoint & feedback stickers (512x512 WebP)
    scene.load.image('char-question', '/stickers/question.webp');
    scene.load.image('char-retry', '/stickers/retry.webp');
    scene.load.image('char-goodjob', '/stickers/goodjob.webp');
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
      frames: Array<{ key: string; frame: number }>;
      rate: number;
      repeat: number;
    }> = [
      {
        key: 'anim-idle',
        frames: Array.from({ length: 8 }, (_, i) => (charFrame('idle', i))),
        rate: 9,
        repeat: -1,
      },
      {
        key: 'anim-run-right',
        frames: Array.from({ length: 8 }, (_, i) => (charFrame('run-right', i))),
        rate: 15,
        repeat: -1,
      },
      {
        key: 'anim-run-left',
        frames: Array.from({ length: 8 }, (_, i) => (charFrame('run-left', i))),
        rate: 15,
        repeat: -1,
      },
      {
        key: 'anim-jump-right',
        // Frames 0..6 are airborne; frame 7 is ground landing squat
        frames: Array.from({ length: 7 }, (_, i) => (charFrame('jump-right', i))),
        rate: 14,
        repeat: 0,
      },
      {
        key: 'anim-jump-left',
        // Frames 0..6 are airborne; frame 7 is ground landing squat
        frames: Array.from({ length: 7 }, (_, i) => (charFrame('jump-left', i))),
        rate: 14,
        repeat: 0,
      },
      {
        key: 'anim-jump',
        frames: Array.from({ length: 7 }, (_, i) => (charFrame('jump', i))),
        rate: 14,
        repeat: 0,
      },
      {
        key: 'anim-fall',
        // Smooth airborne falling oscillation using airborne frames 0..3
        frames: [
          charFrame('fall', 0),
          charFrame('fall', 1),
          charFrame('fall', 2),
          charFrame('fall', 3),
          charFrame('fall', 2),
          charFrame('fall', 1),
        ],
        rate: 12,
        repeat: -1,
      },
      {
        key: 'anim-land',
        // Impact crouch (fall-4) into 8-frame recovery to upright standing
        frames: [
          charFrame('fall', 4),
          ...Array.from({ length: 8 }, (_, i) => (charFrame('land', i))),
        ],
        rate: 18,
        repeat: 0,
      },
      {
        key: 'anim-flip',
        frames: Array.from({ length: 12 }, (_, i) => actionFrame('flip', i)),
        rate: 16,
        repeat: 0,
      },
      {
        key: 'anim-victory',
        frames: Array.from({ length: 12 }, (_, i) => actionFrame('victory', i)),
        rate: 13,
        repeat: -1,
      },
      {
        key: 'anim-celebrate-clap',
        frames: Array.from({ length: 12 }, (_, i) => actionFrame('celebrate-clap', i)),
        rate: 13,
        repeat: -1,
      },
      {
        key: 'anim-celebrate-confetti',
        frames: Array.from({ length: 12 }, (_, i) => actionFrame('celebrate-confetti', i)),
        rate: 13,
        repeat: -1,
      },
      {
        key: 'anim-celebrate-happy',
        frames: Array.from({ length: 12 }, (_, i) => actionFrame('celebrate-happy', i)),
        rate: 13,
        repeat: -1,
      },
      {
        key: 'anim-celebrate-cheer',
        frames: Array.from({ length: 12 }, (_, i) => actionFrame('celebrate-cheer', i)),
        rate: 13,
        repeat: -1,
      },
      {
        key: 'anim-celebrate-clap-cheer',
        frames: Array.from({ length: 12 }, (_, i) => actionFrame('celebrate-clap-cheer', i)),
        rate: 13,
        repeat: -1,
      },
      {
        key: 'anim-celebrate-confetti-dance',
        frames: Array.from({ length: 12 }, (_, i) => actionFrame('celebrate-confetti-dance', i)),
        rate: 13,
        repeat: -1,
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

    this.visualSprite = this.scene.add.sprite(startX, startY, CHAR_ATLAS_KEY, 0);
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

  /**
   * Returns a dynamic smoke color palette tailored to the current tower level/altitude.
   *
   * As the climber ascends, the background behind changes dramatically:
   *  - Level 1 (Dawn Base, y > 3080): Light warm cream (#f8e7d6) -> Deep navy & charcoal with flame orange.
   *  - Level 2 (Golden Hour, 2540 < y <= 3080): Amber orange glow (#f5cca5 -> #b84b2c) -> Deep plum & sunburst gold.
   *  - Level 3 (Sunset Twilight, 2000 < y <= 2540): Dark crimson sunset (#b84b2c -> #7f1d2e) -> Luminous warm cream & coral gold.
   *  - Level 4 (Twilight Indigo, 1460 < y <= 2000): Deep purple-indigo (#7f1d2e -> #1b2a53) -> Ethereal radiant cyan, mint & lavender.
   *  - Level 5 (Night Sky, 920 < y <= 1460): Deep midnight navy (#1b2a53 -> #0f1a36) -> Moonlit ivory, radiant gold & celestial sky blue.
   *  - Level 6 (Summit Crown, y <= 920): Starry deep space (#0a1226 -> #121e3d) -> Pure celestial white, cosmic cyan & starlight gold.
   */
  private getSmokePaletteForAltitude(y: number): {
    colors: number[];
    alpha: number;
    scaleMultiplier: number;
  } {
    const approxStep = Math.max(
      1,
      Math.min(
        this.config.totalSteps,
        Math.round((this.config.groundY - y) / this.config.platformSpacingY)
      )
    );
    const section = getSectionIndexForStep(approxStep, this.config);

    if (section === 1) {
      // Level 1: Steps before Gate 1 (Dawn Warm Cream)
      return {
        colors: [0x1b2a53, 0x2c3e6b, 0xee7b3c, 0x334155],
        alpha: 0.85,
        scaleMultiplier: 1.0,
      };
    } else if (section === 2) {
      // Level 2: Section 2 (Golden Hour Amber)
      return {
        colors: [0x2e122b, 0x581c2b, 0xfde047, 0xf59e0b, 0xffedd5],
        alpha: 0.88,
        scaleMultiplier: 1.05,
      };
    } else if (section === 3) {
      // Level 3: Section 3 (Sunset Twilight Crimson)
      return {
        colors: [0xfff4eb, 0xfde047, 0xffa285, 0xffffff, 0xf87171],
        alpha: 0.9,
        scaleMultiplier: 1.1,
      };
    } else if (section === 4) {
      // Level 4: Section 4 (Evening Indigo / Twilight Purple)
      return {
        colors: [0x5eead4, 0xa7f3d0, 0xe9d5ff, 0xffffff, 0x38bdf8],
        alpha: 0.92,
        scaleMultiplier: 1.15,
      };
    } else if (section === 5) {
      // Level 5: Section 5 (Deep Night Sky / Midnight Blue)
      return {
        colors: [0xfffbeb, 0xfef08a, 0x93c5fd, 0xffffff, 0x67e8f9],
        alpha: 0.92,
        scaleMultiplier: 1.2,
      };
    } else {
      // Level 6: Section 6 (Summit Crown / Starry Deep Space)
      return {
        colors: [0xffffff, 0x67e8f9, 0xfde047, 0xfbcfe8, 0x38bdf8],
        alpha: 0.95,
        scaleMultiplier: 1.25,
      };
    }
  }

  private spawnDustPuff(count: number = 5, isRun: boolean = false): void {
    if (!this.sprite || !this.scene) return;
    const footY = this.sprite.y + this.config.player.height / 2 - 2;
    const footX = this.sprite.x;
    const palette = this.getSmokePaletteForAltitude(footY);

    for (let i = 0; i < count; i++) {
      const color =
        palette.colors[Phaser.Math.Between(0, palette.colors.length - 1)];

      const dir = isRun
        ? (this.facing === 'left' ? 1 : -1)
        : (i % 2 === 0 ? -1 : 1);

      const spreadDist = isRun
        ? Phaser.Math.Between(6, 18)
        : Phaser.Math.Between(8, 28);
      const spreadX = dir * spreadDist;

      const baseR = isRun
        ? Phaser.Math.FloatBetween(2.8, 4.6)
        : Phaser.Math.FloatBetween(4.2, 7.5);
      const r = baseR * palette.scaleMultiplier;

      const puff = this.scene.add
        .circle(
          footX + Phaser.Math.Between(-6, 6),
          footY + Phaser.Math.Between(-2, 2),
          r,
          color,
          palette.alpha
        )
        .setDepth(21);

      puff.setScale(0.5);

      const duration = isRun
        ? Phaser.Math.Between(220, 280)
        : Phaser.Math.Between(340, 420);

      this.scene.tweens.add({
        targets: puff,
        x: puff.x + spreadX,
        y: footY - (isRun ? Phaser.Math.Between(2, 8) : Phaser.Math.Between(6, 18)),
        scale: isRun ? 0.9 : 1.2,
        duration: duration * 0.38,
        ease: 'Quad.easeOut',
        onComplete: () => {
          if (!puff.active) return;
          this.scene.tweens.add({
            targets: puff,
            x: puff.x + spreadX * 0.35,
            y: puff.y - (isRun ? 3 : 8),
            scale: 0.15,
            alpha: 0,
            duration: duration * 0.62,
            ease: 'Cubic.easeIn',
            onComplete: () => puff.destroy(),
          });
        },
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

    if (pose === 'climbing') {
      this.visualSprite.setScale(this.baseScale);
      this.visualSprite.setOrigin(0.5, 0.96);
      this.visualSprite.setFlipX(false);
      this.visualSprite.play('anim-idle', true);
    } else if (pose === 'victory') {
      this.visualSprite.setScale(this.baseScale);
      this.visualSprite.setOrigin(0.5, 0.96);
      this.visualSprite.setFlipX(false);
      this.visualSprite.play('anim-victory', true);
    } else if (pose === 'goodjob') {
      // Pick one of the celebration dance animations at random!
      const randomCelebration = Phaser.Utils.Array.GetRandom(
        CELEBRATION_ANIMS as unknown as string[]
      );
      this.visualSprite.setScale(this.baseScale);
      this.visualSprite.setOrigin(0.5, 0.96);
      this.visualSprite.setFlipX(false);
      this.visualSprite.play(randomCelebration, true);
    } else {
      this.visualSprite.stop();
      const texKey = POSE_TEXTURE_MAP[pose] || 'char-question';
      if (this.scene.textures.exists(texKey)) {
        this.visualSprite.setTexture(texKey);
      }
      // 512x512 stickers scaled to 0.24 ≈ 122px in-world height
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
    this.canDoubleJump = true;
    this.isDoubleJumping = false;
    this.prevJumpPressed = false;
    this.wallBounceTimer = 0;
    if (this.visualSprite) {
      this.scene.tweens.killTweensOf(this.visualSprite);
      this.visualSprite.angle = 0;
      this.visualSprite.setFlipX(false);
    }
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
    this.canDoubleJump = true;
    this.isDoubleJumping = false;
    this.wallBounceTimer = 0;
    if (this.visualSprite) {
      this.scene.tweens.killTweensOf(this.visualSprite);
      this.visualSprite.angle = 0;
      this.visualSprite.setFlipX(false);
    }
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
    if (this.wallBounceTimer > 0) {
      this.wallBounceTimer = Math.max(0, this.wallBounceTimer - delta);
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

    const jumpJustPressed = jumpPressed && !this.prevJumpPressed;
    this.prevJumpPressed = jumpPressed;

    const onFloor = body.blocked.down || body.touching.down;

    if (jumpJustPressed) {
      this.jumpBufferTimer = 180;
    } else if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer -= delta;
    }

    if (!canControl) {
      this.jumpBufferTimer = 0;
    }

    if (onFloor) {
      this.coyoteTimer = 120;
      this.canDoubleJump = true;
      this.isDoubleJumping = false;
    } else if (this.coyoteTimer > 0) {
      this.coyoteTimer -= delta;
    }

    if (moveLeft && !moveRight) {
      this.facing = 'left';
      this.sprite.setVelocityX(-this.config.player.moveSpeed);
    } else if (moveRight && !moveLeft) {
      this.facing = 'right';
      this.sprite.setVelocityX(this.config.player.moveSpeed);
    } else if (this.wallBounceTimer <= 0) {
      this.sprite.setVelocityX(0);
    }

    const minX = this.config.wallThickness + this.config.player.width / 2;
    const maxX =
      this.config.towerWidth -
      this.config.wallThickness -
      this.config.player.width / 2;

    if (this.sprite.x <= minX) {
      this.sprite.x = minX;
      // Icy Tower wall bounce mechanic
      if (
        !onFloor &&
        this.wallBounceTimer <= 0 &&
        (body.velocity.x < -15 || moveLeft)
      ) {
        this.wallBounceTimer = 200;
        this.sprite.setVelocityX(this.config.player.moveSpeed * 0.95);
        this.facing = 'right';
        this.canDoubleJump = true; // Wall bounce refreshes double jump for continuous climbing!
        sfx.wallBounce();
        this.spawnDustPuff(5);
        if (body.velocity.y > -220) {
          this.sprite.setVelocityY(Math.min(body.velocity.y, -280));
        }
      } else if (body.velocity.x < 0) {
        this.sprite.setVelocityX(0);
      }
    } else if (this.sprite.x >= maxX) {
      this.sprite.x = maxX;
      // Icy Tower wall bounce mechanic
      if (
        !onFloor &&
        this.wallBounceTimer <= 0 &&
        (body.velocity.x > 15 || moveRight)
      ) {
        this.wallBounceTimer = 200;
        this.sprite.setVelocityX(-this.config.player.moveSpeed * 0.95);
        this.facing = 'left';
        this.canDoubleJump = true; // Wall bounce refreshes double jump!
        sfx.wallBounce();
        this.spawnDustPuff(5);
        if (body.velocity.y > -220) {
          this.sprite.setVelocityY(Math.min(body.velocity.y, -280));
        }
      } else if (body.velocity.x > 0) {
        this.sprite.setVelocityX(0);
      }
    }

    // 1. Ground Jump execution (with Icy Tower running momentum scaling)
    if (this.jumpBufferTimer > 0 && (onFloor || this.coyoteTimer > 0)) {
      const hSpeed = Math.abs(body.velocity.x);
      const speedPct = Math.min(1, hSpeed / this.config.player.moveSpeed);
      // Icy Tower logic: running faster yields a higher jump!
      const momentumBonus = 1 + speedPct * 0.18;
      this.sprite.setVelocityY(this.config.player.jumpVelocity * momentumBonus);

      this.jumpBufferTimer = 0;
      this.coyoteTimer = 0;
      this.landLockTimer = 0;
      this.canDoubleJump = true;
      this.isDoubleJumping = false;
      this.spawnDustPuff(6);
      sfx.jump();
      if (this.currentPose === 'climbing') {
        const jumpAnim =
          this.facing === 'left' ? 'anim-jump-left' : 'anim-jump-right';
        this.visualSprite.play(jumpAnim, false);
      }
    }
    // 2. Mid-air Double Jump execution (Icy Tower style somersault spin + momentum boost)
    else if (
      jumpJustPressed &&
      !onFloor &&
      this.coyoteTimer <= 0 &&
      this.canDoubleJump
    ) {
      this.canDoubleJump = false;
      this.isDoubleJumping = true;
      this.jumpBufferTimer = 0;

      // Icy Tower momentum logic: calculate double jump launch velocity
      const hSpeed = Math.abs(body.velocity.x);
      const speedPct = Math.min(1, hSpeed / this.config.player.moveSpeed);
      const doubleJumpMultiplier = 1.08 + speedPct * 0.22;
      this.sprite.setVelocityY(
        this.config.player.jumpVelocity * doubleJumpMultiplier
      );

      // Preserve or boost horizontal velocity if directing jump
      if (moveLeft && !moveRight) {
        this.facing = 'left';
        this.sprite.setVelocityX(-this.config.player.moveSpeed * 1.05);
      } else if (moveRight && !moveLeft) {
        this.facing = 'right';
        this.sprite.setVelocityX(this.config.player.moveSpeed * 1.05);
      }

      // SFX and particle burst
      sfx.doubleJump();
      this.spawnDustPuff(8);

      // Iconic Icy Tower Somersault Flip Animation!
      if (this.currentPose === 'climbing') {
        this.scene.tweens.killTweensOf(this.visualSprite);
        this.visualSprite.angle = 0;
        this.visualSprite.setFlipX(this.facing === 'left');
        this.visualSprite.play('anim-flip', true);

        // When flip completes, allow regular airborne transitions to resume
        this.visualSprite.once(
          Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + '-anim-flip',
          () => {
            if (this.isDoubleJumping) {
              this.isDoubleJumping = false;
            }
          }
        );
      }
    }

    // Landing detection
    if (onFloor && this.wasAirborne) {
      this.spawnDustPuff(4);
      sfx.land();
      this.landLockTimer = 130;
      this.canDoubleJump = true;
      this.isDoubleJumping = false;
      if (this.visualSprite) {
        this.scene.tweens.killTweensOf(this.visualSprite);
        this.visualSprite.angle = 0;
        this.visualSprite.setFlipX(false);
      }
      if (this.currentPose === 'climbing') {
        this.visualSprite.play('anim-land', false);
      }
    }
    this.wasAirborne = !onFloor;

    if (this.currentPose === 'climbing') {
      if (onFloor) {
        this.visualSprite.setFlipX(false);
        if (Math.abs(body.velocity.x) > 15) {
          // If moving horizontally, immediately break out of land squat into running
          if (body.velocity.x > 0) {
            this.visualSprite.play('anim-run-right', true);
          } else {
            this.visualSprite.play('anim-run-left', true);
          }

          // Subtle running smoke puff under feet
          if (Math.abs(body.velocity.x) > 40) {
            this.runPuffTimer += delta;
            if (this.runPuffTimer >= 160) {
              this.runPuffTimer = 0;
              this.spawnDustPuff(2, true);
            }
          }
        } else {
          this.runPuffTimer = 110;
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
        const isFlipping =
          this.isDoubleJumping ||
          (this.visualSprite.anims.currentAnim?.key === 'anim-flip' &&
            this.visualSprite.anims.isPlaying);

        if (!isFlipping) {
          this.visualSprite.setFlipX(false);
          if (body.velocity.y <= 20) {
            const jumpAnim =
              this.facing === 'left' ? 'anim-jump-left' : 'anim-jump-right';
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
    }

    this.syncVisualPosition();
  }
}
