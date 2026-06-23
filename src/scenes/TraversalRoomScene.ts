import Phaser from 'phaser';
import { installAudioUnlock } from './audioUnlock';
import { addActorSprite, setActorPose } from './actors';
import { SceneKeys, TextureKeys } from './sceneKeys';
import { addPanel, makePixelText, addHealthBar, addRoomDepthBorders, addArenaDepthCues, playBoom, playHit, playCast } from './ui';
import { createGameKeys, type GameKeys } from '../systems/input';
import { loadSave, writeSave } from '../systems/saveSystem';
import { PauseMenuOverlay } from './overlays';
import { publishControlScheme, publishFrameHealth } from './runtimeDebug';
import { apprenticeMovementTuning, readMovementInput, stepMovementVelocity } from '../systems/movementEngine';
import { clampSpriteToArenaBounds, fadeInFromBlack, fadeToScene } from './transition';
import { isTestMode } from '../systems/testMode';
import { addRoomHint } from './roomHint';
import { addBrightnessLift, addVisibleExitBeacon, showKeikoHelper } from './roomIntro';

interface Hazard {
  shape: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Ellipse;
  pattern: 'sweep-h' | 'sweep-v' | 'pulse' | 'orbit';
  originX: number;
  originY: number;
  speed: number;
  phase: number;
  damage: number;
  radius: number;
}

interface Platform {
  shape: Phaser.GameObjects.Rectangle;
  safe: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export class TraversalRoomScene extends Phaser.Scene {
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
  private hazards: Hazard[] = [];
  private platforms: Platform[] = [];
  private checkpoints: Phaser.GameObjects.Ellipse[] = [];
  private lastCheckpointIndex = -1;
  private spawnPoint = new Phaser.Math.Vector2(160, 500);
  private goalZone!: Phaser.GameObjects.Rectangle;
  private goalReached = false;
  private invulnerableUntil = 0;
  private statusText!: Phaser.GameObjects.Text;
  private transitioning = false;
  private readonly walkableBounds = new Phaser.Geom.Rectangle(100, 140, 1080, 460);

  constructor() {
    super(SceneKeys.TraversalRoom);
  }

  init(): void {
    this.transitioning = false;
    this.goalReached = false;
    this.invulnerableUntil = 0;
    this.currentVelocity.set(0, 0);
    this.lastMoveDirection.set(1, 0);
    this.moveHeldMs = 0;
    this.hazards = [];
    this.platforms = [];
    this.checkpoints = [];
    this.lastCheckpointIndex = -1;
  }

  create(): void {
    (window as unknown as { __CODEJITSU_SCENE?: string }).__CODEJITSU_SCENE = 'traversal';
    publishControlScheme('traversal');
    installAudioUnlock(this);
    writeSave({ ...loadSave(), currentCheckpoint: 'dungeon' });
    this.keys = createGameKeys(this);
    this.maxHp = loadSave().playerUpgrades.maxHp;
    this.playerHp = this.maxHp;
    this.cameras.main.setBackgroundColor('#0c0410');
    if (this.textures.exists(TextureKeys.TraversalDataAsh)) {
      this.add.image(640, 360, TextureKeys.TraversalDataAsh).setDisplaySize(1280, 720).setDepth(0);
    } else {
      this.add.rectangle(640, 360, 1280, 720, 0x0c0410).setDepth(0);
    }
    addRoomDepthBorders(this, this.walkableBounds, { sceneId: 'traversal', frontDepth: 850, accentColor: 0xff8a65 });
    addArenaDepthCues(this, this.walkableBounds, { sceneId: 'traversal', accentColor: 0xff8a65, foregroundDepth: 852 });
    addBrightnessLift(this, 3, 0.12);
    fadeInFromBlack(this);
    this.buildTraversalCourse();
    this.player = addActorSprite(this, 'hero', this.spawnPoint.x, this.spawnPoint.y, TextureKeys.Hero, 1.28);
    this.player.setCollideWorldBounds(true).setDrag(1500);
    this.player.body?.setSize(28, 24).setOffset(18, 62);
    this.playerShadow = this.add.image(this.player.x, this.player.y + 29, TextureKeys.Shadow).setDisplaySize(82, 34).setAlpha(0.43).setDepth(this.player.y - 8);
    this.playerBar = addHealthBar(this, 36, 20, 260, 20, 'Apprentice');
    addPanel(this, 30, 660, 400, 40, 0.65).setDepth(900);
    this.statusText = makePixelText(this, 44, 668, 'Dodge the ash streams. Reach the gate.', 13, '#ff8a65').setDepth(901);
    this.pauseMenu = new PauseMenuOverlay(this, () => this.scene.start(SceneKeys.Title));
    addRoomHint(this, {
      title: 'TRAVERSAL — data ash crossing',
      steps: [
        'WASD or Arrows to move. Stand on dim platforms \u2014 they break ash hits.',
        'Cyan rings are checkpoints. Step on each one to save your respawn.',
        'Reach the gold EXIT marker on the right.',
      ],
    });
    showKeikoHelper(this, {
      title: 'Data Ash Crossing \u2014 Traversal',
      lines: [
        'This bridge bleeds data ash. Dim stone platforms shield you from the ash streams.',
        'Orange sweeps and orbiting purple shards will hit you in the open.',
        'Walk over each cyan checkpoint ring to save your respawn point.',
        'Walk into the bright gold EXIT beacon on the right when you reach it.',
      ],
    });
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (this.pauseMenu.handleKey(event)) return;
      if (event.key === 'Escape') { this.pauseMenu.toggle(); return; }
    });
  }

  update(time: number, delta: number): void {
    publishFrameHealth('traversal', delta);
    if (this.transitioning || this.pauseMenu.isOpen) return;
    this.handleMovement(delta);
    clampSpriteToArenaBounds(this.player, this.walkableBounds, 1.0);
    this.playerShadow.setPosition(this.player.x, this.player.y + 29).setDepth(this.player.y - 8);
    this.player.setDepth(this.player.y);
    this.updateHazards(time, delta);
    this.checkHazardCollisions();
    this.checkCheckpoints();
    this.checkGoal();
    this.playerBar.setValue(this.playerHp, this.maxHp);
  }

  private buildTraversalCourse(): void {
    // Safe platforms
    const safeZones = [
      { x: 160, y: 480, w: 120, h: 100 },
      { x: 400, y: 360, w: 80, h: 80 },
      { x: 640, y: 300, w: 100, h: 80 },
      { x: 880, y: 400, w: 80, h: 80 },
      { x: 1100, y: 300, w: 120, h: 100 },
    ];
    safeZones.forEach((zone) => {
      const shape = this.add.rectangle(zone.x, zone.y, zone.w, zone.h, 0x1a1228, 0.4)
        .setStrokeStyle(1, 0xff8a65, 0.3).setDepth(10);
      this.platforms.push({ shape, safe: true, x: zone.x, y: zone.y, width: zone.w, height: zone.h });
    });

    // Horizontal sweeping hazards
    this.addHazard(300, 300, 'sweep-h', 1.2, 8, 60);
    this.addHazard(500, 450, 'sweep-h', -0.9, 7, 50);
    this.addHazard(750, 250, 'sweep-h', 1.5, 9, 70);

    // Vertical sweeping hazards
    this.addHazard(550, 350, 'sweep-v', 1.0, 6, 50);
    this.addHazard(900, 300, 'sweep-v', -1.3, 8, 60);

    // Pulsing hazards
    this.addHazard(700, 400, 'pulse', 0.8, 10, 80);
    this.addHazard(350, 200, 'pulse', 1.1, 7, 60);

    // Orbiting hazard
    this.addHazard(640, 380, 'orbit', 0.6, 5, 40);

    // Checkpoints
    [new Phaser.Math.Vector2(400, 360), new Phaser.Math.Vector2(640, 300), new Phaser.Math.Vector2(880, 400)].forEach((pos) => {
      const cp = this.add.ellipse(pos.x, pos.y + 30, 40, 20, 0x4fc3f7, 0.3).setStrokeStyle(2, 0x4fc3f7, 0.5).setDepth(15);
      this.checkpoints.push(cp);
    });

    // Goal
    this.goalZone = addVisibleExitBeacon(this, { x: 1130, y: 300, label: 'EXIT', color: 0xf0c36b }).rect;
  }

  private addHazard(x: number, y: number, pattern: Hazard['pattern'], speed: number, damage: number, radius: number): void {
    const color = pattern === 'pulse' ? 0xd64f45 : pattern === 'orbit' ? 0xb85dff : 0xff8a65;
    const shape = pattern === 'pulse'
      ? this.add.ellipse(x, y, radius * 2, radius, color, 0.2).setStrokeStyle(2, color, 0.5).setDepth(20)
      : this.add.rectangle(x, y, pattern === 'sweep-h' ? 40 : 30, pattern === 'sweep-v' ? 40 : 30, color, 0.5).setStrokeStyle(2, color, 0.7).setDepth(20);
    this.hazards.push({ shape, pattern, originX: x, originY: y, speed, phase: Math.random() * Math.PI * 2, damage, radius });
  }

  private updateHazards(time: number, _delta: number): void {
    const t = time / 1000;
    this.hazards.forEach((hazard) => {
      const p = hazard.phase;
      switch (hazard.pattern) {
        case 'sweep-h':
          hazard.shape.x = hazard.originX + Math.sin(t * hazard.speed + p) * 160;
          break;
        case 'sweep-v':
          hazard.shape.y = hazard.originY + Math.sin(t * hazard.speed + p) * 120;
          break;
        case 'pulse': {
          const scale = 0.6 + Math.abs(Math.sin(t * hazard.speed + p)) * 0.8;
          hazard.shape.setScale(scale);
          (hazard.shape as Phaser.GameObjects.Ellipse).setAlpha(0.15 + Math.abs(Math.sin(t * hazard.speed + p)) * 0.35);
          break;
        }
        case 'orbit': {
          hazard.shape.x = hazard.originX + Math.cos(t * hazard.speed + p) * 140;
          hazard.shape.y = hazard.originY + Math.sin(t * hazard.speed + p) * 80;
          break;
        }
      }
    });
  }

  private checkHazardCollisions(): void {
    if (this.time.now < this.invulnerableUntil) return;
    // Check if player is on a safe platform
    const onSafe = this.platforms.some((p) =>
      Math.abs(this.player.x - p.x) < p.width / 2 && Math.abs(this.player.y - p.y) < p.height / 2
    );
    if (onSafe) return;

    this.hazards.forEach((hazard) => {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, hazard.shape.x, hazard.shape.y);
      const hitRadius = hazard.pattern === 'pulse' ? hazard.radius * (hazard.shape.scaleX ?? 1) : 35;
      if (dist < hitRadius) {
        this.damagePlayer(hazard.damage, hazard.shape.x, hazard.shape.y);
      }
    });
  }

  private damagePlayer(damage: number, sourceX: number, sourceY: number): void {
    this.playerHp = Math.max(0, this.playerHp - damage);
    this.invulnerableUntil = this.time.now + 800;
    setActorPose(this.player, 'hurt');
    playHit(this);
    this.player.setTintFill(0xd64f45);
    this.time.delayedCall(120, () => this.player.clearTint());
    this.time.delayedCall(220, () => setActorPose(this.player, 'idle'));
    const angle = Phaser.Math.Angle.Between(sourceX, sourceY, this.player.x, this.player.y);
    this.currentVelocity.set(Math.cos(angle) * 200, Math.sin(angle) * 140);
    this.player.setVelocity(this.currentVelocity.x, this.currentVelocity.y);
    if (this.playerHp <= 0) {
      this.respawnAtCheckpoint();
    }
  }

  private respawnAtCheckpoint(): void {
    this.playerHp = Math.floor(this.maxHp * 0.6);
    const cpIndex = Math.max(0, this.lastCheckpointIndex);
    const cp = this.checkpoints[cpIndex];
    const respawnPos = cp ? new Phaser.Math.Vector2(cp.x, cp.y - 30) : this.spawnPoint;
    this.player.setPosition(respawnPos.x, respawnPos.y);
    this.currentVelocity.set(0, 0);
    this.player.setVelocity(0, 0);
    this.cameras.main.flash(300, 13, 4, 16);
    this.statusText.setText('Respawned at checkpoint.');
  }

  private checkCheckpoints(): void {
    this.checkpoints.forEach((cp, index) => {
      if (index <= this.lastCheckpointIndex) return;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, cp.x, cp.y);
      if (dist < 50) {
        this.lastCheckpointIndex = index;
        cp.setFillStyle(0x4fc3f7, 0.6);
        cp.setStrokeStyle(2, 0xf0c36b, 0.8);
        this.statusText.setText(`Checkpoint ${index + 1} reached.`);
        playCast(this);
      }
    });
  }

  private checkGoal(): void {
    if (this.goalReached) return;
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.goalZone.x, this.goalZone.y);
    if (dist < 90) {
      this.goalReached = true;
      this.transitioning = true;
      this.statusText.setText('Crossing cleared.');
      playBoom(this, 0.5);
      this.cameras.main.flash(400, 240, 195, 101);
      this.time.delayedCall(1000, () => {
        fadeToScene(this, SceneKeys.Dungeon, 360, { startRoom: 4 });
      });
    }
  }

  private handleMovement(delta: number): void {
    const input = readMovementInput(this.keys);
    const wantsMove = input.x * input.x + input.y * input.y > 0;
    this.moveHeldMs = wantsMove ? Math.min(this.moveHeldMs + delta, 1400) : 0;
    const movement = stepMovementVelocity(this.currentVelocity, input, delta, apprenticeMovementTuning, this.moveHeldMs);
    if (movement.moving) this.lastMoveDirection.copy(movement.direction);
    this.player.setVelocity(movement.velocity.x, movement.velocity.y);
    setActorPose(this.player, movement.moving ? 'walk' : 'idle');
    if (this.lastMoveDirection.x < -0.1) this.player.setFlipX(true);
    if (this.lastMoveDirection.x > 0.1) this.player.setFlipX(false);
  }


}
