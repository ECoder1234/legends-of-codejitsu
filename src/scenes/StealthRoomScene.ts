import Phaser from 'phaser';
import { installAudioUnlock } from './audioUnlock';
import { addActorSprite, setActorPose } from './actors';
import { SceneKeys, TextureKeys } from './sceneKeys';
import { addPanel, makePixelText, addHealthBar, addRoomDepthBorders, addArenaDepthCues, playBoom, playHit } from './ui';
import { createGameKeys, type GameKeys } from '../systems/input';
import { loadSave, writeSave } from '../systems/saveSystem';
import { PauseMenuOverlay } from './overlays';
import { publishControlScheme, publishFrameHealth } from './runtimeDebug';
import { apprenticeMovementTuning, readMovementInput, stepMovementVelocity } from '../systems/movementEngine';
import { clampSpriteToArenaBounds, fadeInFromBlack, fadeToScene } from './transition';
import { addRoomHint } from './roomHint';
import { addBrightnessLift, addVisibleExitBeacon, showKeikoHelper } from './roomIntro';

interface Watcher {
  sprite: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image;
  cone: Phaser.GameObjects.Graphics;
  originX: number;
  originY: number;
  patrolAngle: number;
  sweepSpeed: number;
  sweepRange: number;
  detectionRadius: number;
  alerted: boolean;
}

interface ShadowZone {
  shape: Phaser.GameObjects.Rectangle;
  x: number;
  y: number;
  width: number;
  height: number;
}

export class StealthRoomScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerShadow!: Phaser.GameObjects.Image;
  private keys!: GameKeys;
  private pauseMenu!: PauseMenuOverlay;
  private currentVelocity = new Phaser.Math.Vector2(0, 0);
  private lastMoveDirection = new Phaser.Math.Vector2(1, 0);
  private moveHeldMs = 0;
  private playerHp = 100;
  private maxHp = 100;
  private playerBar!: ReturnType<typeof addHealthBar>;
  private watchers: Watcher[] = [];
  private shadows: ShadowZone[] = [];
  private statusText!: Phaser.GameObjects.Text;
  private detectionMeter = 0;
  private transitioning = false;
  private goalReached = false;
  private invulnerableUntil = 0;
  private readonly walkableBounds = new Phaser.Geom.Rectangle(100, 160, 1080, 440);
  private goalZone!: Phaser.GameObjects.Rectangle;
  private detectionBar!: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image;
  private detectionBarBg!: Phaser.GameObjects.Rectangle;

  constructor() {
    super(SceneKeys.StealthRoom);
  }

  init(): void {
    this.transitioning = false;
    this.goalReached = false;
    this.invulnerableUntil = 0;
    this.detectionMeter = 0;
    this.currentVelocity.set(0, 0);
    this.lastMoveDirection.set(1, 0);
    this.moveHeldMs = 0;
    this.watchers = [];
    this.shadows = [];
  }

  create(): void {
    (window as unknown as { __CODEJITSU_SCENE?: string }).__CODEJITSU_SCENE = 'stealth';
    publishControlScheme('stealth');
    installAudioUnlock(this);
    writeSave({ ...loadSave(), currentCheckpoint: 'dungeon' });
    this.keys = createGameKeys(this);
    this.maxHp = loadSave().playerUpgrades.maxHp;
    this.playerHp = this.maxHp;
    this.cameras.main.setBackgroundColor('#060412');
    if (this.textures.exists(TextureKeys.StealthArchiveReliquary)) {
      this.add.image(640, 360, TextureKeys.StealthArchiveReliquary).setDisplaySize(1280, 720).setDepth(0);
    } else {
      this.add.rectangle(640, 360, 1280, 720, 0x060412).setDepth(0);
    }
    addRoomDepthBorders(this, this.walkableBounds, { sceneId: 'stealth', frontDepth: 850, accentColor: 0x66bb6a });
    addArenaDepthCues(this, this.walkableBounds, { sceneId: 'stealth', accentColor: 0x66bb6a, foregroundDepth: 852 });
    addBrightnessLift(this, 3, 0.16);
    fadeInFromBlack(this);
    this.buildStealthCourse();
    this.player = addActorSprite(this, 'hero', 160, 500, TextureKeys.Hero, 1.28);
    this.player.setCollideWorldBounds(true).setDrag(1500);
    this.player.body?.setSize(28, 24).setOffset(18, 62);
    this.playerShadow = this.add.image(this.player.x, this.player.y + 29, TextureKeys.Shadow).setDisplaySize(82, 34).setAlpha(0.43).setDepth(this.player.y - 8);
    this.playerBar = addHealthBar(this, 36, 20, 260, 20, 'Apprentice');
    // Detection bar
    addPanel(this, 36, 50, 264, 18, 0.5).setDepth(900);
    this.detectionBarBg = this.add.rectangle(168, 59, 256, 10, 0x1a0d1e, 0.6).setDepth(901);
    this.detectionBar = this.textures.exists(TextureKeys.StealthDetectionFill)
      ? this.add.image(40, 59, TextureKeys.StealthDetectionFill).setOrigin(0, 0.5).setCrop(0, 0, 0, 16).setDisplaySize(0, 16).setDepth(902)
      : this.add.rectangle(40, 59, 0, 10, 0xd64f45, 0.8).setOrigin(0, 0.5).setDepth(902);
    makePixelText(this, 44, 48, 'Detection', 10, '#d64f45').setDepth(903);
    addPanel(this, 30, 660, 500, 36, 0.65).setDepth(900);
    this.statusText = makePixelText(this, 44, 666, 'Stay in shadows. Avoid the watcher cones.', 12, '#66bb6a').setDepth(901);
    this.goalZone = addVisibleExitBeacon(this, { x: 1130, y: 280, label: 'EXIT', color: 0xf0c36b }).rect;
    this.pauseMenu = new PauseMenuOverlay(this, () => this.scene.start(SceneKeys.Title));
    addRoomHint(this, {
      title: 'STEALTH — archive reliquary',
      steps: [
        'Avoid the orange watcher cones.',
        'Stay inside the dark green shadow patches to break line of sight.',
        'If detection fills, a void blast hits — keep it low.',
        'Reach the gold EXIT.',
      ],
    });    showKeikoHelper(this, {
      title: 'Archive Reliquary \u2014 Stealth Room',
      lines: [
        'Watcher masks sweep this hall. Their orange cones mean line of sight.',
        'Cyan-edged dark patches are shadow zones \u2014 stand inside one to break the watcher\u2019s gaze.',
        'The red bar above your health is detection. If it fills, a void blast hits you.',
        'Slip between cones and reach the gold EXIT on the right.',
      ],
    });    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (this.pauseMenu.handleKey(event)) return;
      if (event.key === 'Escape') { this.pauseMenu.toggle(); return; }
    });
  }

  update(time: number, delta: number): void {
    publishFrameHealth('stealth', delta);
    if (this.transitioning || this.pauseMenu.isOpen) return;
    this.handleMovement(delta);
    clampSpriteToArenaBounds(this.player, this.walkableBounds, 1.0);
    this.playerShadow.setPosition(this.player.x, this.player.y + 29).setDepth(this.player.y - 8);
    this.player.setDepth(this.player.y);
    this.updateWatchers(time);
    this.updateDetection(delta);
    this.checkGoal();
    this.playerBar.setValue(this.playerHp, this.maxHp);
    const detectionWidth = Math.min(256, (this.detectionMeter / 100) * 256);
    if (this.detectionBar instanceof Phaser.GameObjects.Image) {
      this.detectionBar.setCrop(0, 0, detectionWidth, 16).setDisplaySize(detectionWidth, 16);
    } else {
      this.detectionBar.setSize(detectionWidth, 10);
      this.detectionBar.setFillStyle(this.detectionMeter > 70 ? 0xd64f45 : this.detectionMeter > 40 ? 0xff8a65 : 0x66bb6a, 0.8);
    }
  }

  private buildStealthCourse(): void {
    // Shadow zones (safe hiding spots)
    const shadowConfigs = [
      { x: 260, y: 400, w: 100, h: 80 },
      { x: 420, y: 280, w: 80, h: 100 },
      { x: 600, y: 450, w: 120, h: 70 },
      { x: 780, y: 300, w: 90, h: 90 },
      { x: 950, y: 420, w: 100, h: 80 },
    ];
    shadowConfigs.forEach((cfg) => {
      const shape = this.add.rectangle(cfg.x, cfg.y, cfg.w, cfg.h, 0x0a0816, 0.7)
        .setStrokeStyle(1, 0x66bb6a, 0.2).setDepth(5);
      this.shadows.push({ shape, x: cfg.x, y: cfg.y, width: cfg.w, height: cfg.h });
    });

    // Watchers with sweep cones
    const watcherConfigs = [
      { x: 350, y: 220, sweepSpeed: 0.8, sweepRange: 1.2, radius: 140 },
      { x: 550, y: 340, sweepSpeed: -0.6, sweepRange: 1.5, radius: 160 },
      { x: 750, y: 200, sweepSpeed: 0.9, sweepRange: 1.0, radius: 130 },
      { x: 900, y: 350, sweepSpeed: -0.7, sweepRange: 1.3, radius: 150 },
      { x: 1050, y: 400, sweepSpeed: 1.0, sweepRange: 0.9, radius: 120 },
    ];
    watcherConfigs.forEach((cfg) => {
      const sprite = this.textures.exists(TextureKeys.StealthWatcherMask)
        ? this.add.image(cfg.x, cfg.y, TextureKeys.StealthWatcherMask, 0)
          .setOrigin(0.5, 0.5)
          .setDisplaySize(36, 36)
          .setDepth(100)
        : this.add.rectangle(cfg.x, cfg.y, 24, 24, 0xd64f45, 0.7).setStrokeStyle(2, 0xf0c36b, 0.6).setDepth(100);
      const cone = this.add.graphics().setDepth(50);
      this.watchers.push({
        sprite, cone,
        originX: cfg.x, originY: cfg.y,
        patrolAngle: 0,
        sweepSpeed: cfg.sweepSpeed,
        sweepRange: cfg.sweepRange,
        detectionRadius: cfg.radius,
        alerted: false,
      });
    });
  }

  private updateWatchers(time: number): void {
    const t = time / 1000;
    this.watchers.forEach((watcher) => {
      watcher.patrolAngle = Math.sin(t * watcher.sweepSpeed) * watcher.sweepRange;
      watcher.cone.clear();
      const cx = watcher.originX;
      const cy = watcher.originY;
      const angle = watcher.patrolAngle + Math.PI / 2;
      const spread = 0.4;
      const r = watcher.detectionRadius;
      const color = watcher.alerted ? 0xd64f45 : 0xffcc80;
      const alpha = watcher.alerted ? 0.25 : 0.12;
      watcher.cone.fillStyle(color, alpha);
      watcher.cone.beginPath();
      watcher.cone.moveTo(cx, cy);
      const steps = 12;
      for (let i = 0; i <= steps; i++) {
        const a = angle - spread + (2 * spread * i / steps);
        watcher.cone.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      watcher.cone.closePath();
      watcher.cone.fillPath();
      // Check if player is in cone
      const dx = this.player.x - cx;
      const dy = this.player.y - cy;
      const dist = Math.hypot(dx, dy);
      const playerAngle = Math.atan2(dy, dx);
      const angleDiff = Math.abs(Phaser.Math.Angle.Wrap(playerAngle - angle));
      watcher.alerted = dist < r && angleDiff < spread && !this.isPlayerInShadow();
      if (watcher.sprite instanceof Phaser.GameObjects.Image) {
        watcher.sprite.setFrame(watcher.alerted ? 1 : 0);
      } else {
        watcher.sprite.setFillStyle(watcher.alerted ? 0xd64f45 : 0xffcc80, 0.75);
      }
    });
  }

  private isPlayerInShadow(): boolean {
    return this.shadows.some((s) =>
      Math.abs(this.player.x - s.x) < s.width / 2 &&
      Math.abs(this.player.y - s.y) < s.height / 2
    );
  }

  private updateDetection(delta: number): void {
    const detected = this.watchers.some((w) => w.alerted);
    const inShadow = this.isPlayerInShadow();
    if (detected) {
      this.detectionMeter = Math.min(100, this.detectionMeter + delta * 0.04);
    } else if (inShadow) {
      this.detectionMeter = Math.max(0, this.detectionMeter - delta * 0.025);
    } else {
      this.detectionMeter = Math.max(0, this.detectionMeter - delta * 0.008);
    }
    if (this.detectionMeter >= 100) {
      this.onFullDetection();
    }
    if (detected && !inShadow) {
      this.statusText.setText('Detected! Find shadow cover!');
    } else if (inShadow) {
      this.statusText.setText('Hidden in shadow.');
    } else {
      this.statusText.setText('Move carefully. Avoid watcher cones.');
    }
  }

  private onFullDetection(): void {
    if (this.time.now < this.invulnerableUntil) return;
    this.detectionMeter = 50;
    this.playerHp = Math.max(0, this.playerHp - 25);
    this.invulnerableUntil = this.time.now + 1500;
    playHit(this);
    playBoom(this, 0.5);
    this.cameras.main.shake(150, 0.008);
    this.player.setTintFill(0xd64f45);
    this.time.delayedCall(200, () => this.player.clearTint());
    this.statusText.setText('Alert! Void blast incoming!');
    if (this.playerHp <= 0) {
      this.playerHp = Math.floor(this.maxHp * 0.5);
      this.player.setPosition(160, 500);
      this.detectionMeter = 0;
      this.cameras.main.flash(300, 13, 4, 16);
    }
  }

  private checkGoal(): void {
    if (this.goalReached) return;
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.goalZone.x, this.goalZone.y);
    if (dist < 85) {
      this.goalReached = true;
      this.transitioning = true;
      playBoom(this, 0.5);
      this.cameras.main.flash(400, 102, 187, 106);
      this.time.delayedCall(800, () => {
        fadeToScene(this, SceneKeys.PuzzleRoom, 360, { puzzleId: 'checksum-mausoleum' });
      });
    }
  }

  private handleMovement(delta: number): void {
    const input = readMovementInput(this.keys);
    const wantsMove = input.x * input.x + input.y * input.y > 0;
    this.moveHeldMs = wantsMove ? Math.min(this.moveHeldMs + delta, 1400) : 0;
    // Slower movement in stealth
    const tuning = { ...apprenticeMovementTuning, speed: apprenticeMovementTuning.speed * 0.7 };
    const movement = stepMovementVelocity(this.currentVelocity, input, delta, tuning, this.moveHeldMs);
    if (movement.moving) this.lastMoveDirection.copy(movement.direction);
    this.player.setVelocity(movement.velocity.x, movement.velocity.y);
    setActorPose(this.player, movement.moving ? 'walk' : 'idle');
    if (this.lastMoveDirection.x < -0.1) this.player.setFlipX(true);
    if (this.lastMoveDirection.x > 0.1) this.player.setFlipX(false);
  }
}
