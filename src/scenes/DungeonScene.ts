import Phaser from 'phaser';
import { getAbility } from '../data/abilities';
import { addActorSprite, setActorPose, type ActorPose } from './actors';
import { addAbilityCastBurst } from './abilityVisuals';
import { installAudioUnlock } from './audioUnlock';
import { addBossImpactVfx } from './bossImpactVfx';
import { addCombatHitMark, type CombatHitMarkKind } from './combatHitMarks';
import { addGeneratedTelegraphSigil } from './combatTelegraphs';
import { publishTextPanelAudit } from './layoutAudit';
import { TextureKeys, SceneKeys } from './sceneKeys';
import { addPanel, makePixelText } from './ui';
import { createGameKeys, type GameKeys } from '../systems/input';
import { loadSave, writeSave } from '../systems/saveSystem';
import { chapterOneDungeonRooms, playableContentAudit } from '../data/playtime';
import { PauseMenuOverlay, TerminalOverlay } from './overlays';
import { guardedSetVelocity, publishBoundaryFeedback, publishControlScheme, publishFrameHealth, publishPlayerBounds, publishSwordSwing } from './runtimeDebug';
import { parseTerminalCommand } from '../systems/terminalCommandEngine';
import { apprenticeMovementTuning, readMovementInput, stepMovementVelocity } from '../systems/movementEngine';
import { addArenaDepthCues, addBoundaryBump, addGroundCrack, addHealthBar, addHitSparks, addImpactPause, addRoomDepthBorders, addStepDust, addSwordSwing, addVoidBurst, playBoom, playCast, playHit, playSlash, updateForegroundParallaxDepth, updateGroundedActorVisual } from './ui';
import { addSeamVfx } from './seamVfx';
import { clampSpriteToArenaBounds, fadeInFromBlack, fadeToScene, walkSpriteIntoGate, type ArenaClampResult } from './transition';
import { isTestMode } from '../systems/testMode';

interface Sentinel {
  sprite: Phaser.Physics.Arcade.Sprite;
  shadow: Phaser.GameObjects.Image;
  hp: number;
  velocity: Phaser.Math.Vector2;
  attackReadyAt: number;
  attackLockedUntil: number;
  attackStyle: 'pounce' | 'lane';
}

interface SentinelSpawn {
  x: number;
  y: number;
  hp: number;
  attackStyle: Sentinel['attackStyle'];
}

interface EnemyRuntimeState {
  id: string;
  displayName?: string;
  speciesId?: string;
  scene: string;
  x: number;
  y: number;
  hp: number;
  pose?: string;
  frameIndex?: number;
  frameCount?: number;
  renderVariant?: string;
  motionProfile?: string;
  bodyAlive: boolean;
  visualScale?: number;
  visualStride?: number;
  visualGrounded?: boolean;
  usesImagegenCombatSheet?: boolean;
  cleanIdentity?: boolean;
  distanceToPlayer?: number;
  noOverlap?: boolean;
}

interface DungeonRoomBackdrop {
  textureKey: string;
  cropIndex?: number;
  auditCropIndex?: number;
}

const dungeonRoomBackdrops: Record<string, DungeonRoomBackdrop> = {
  'archive-gauntlet-01':   { textureKey: TextureKeys.DungeonRoomArchiveShard },
  'archive-gauntlet-02':   { textureKey: TextureKeys.DungeonRoomSentinelPassage },
  'archive-gauntlet-03':   { textureKey: TextureKeys.DungeonRoomCacheShrine },
  'archive-gauntlet-04':   { textureKey: TextureKeys.DungeonRoomBooleanGate },
  'archive-gauntlet-05':   { textureKey: TextureKeys.TraversalDataAsh },
  'archive-gauntlet-06':   { textureKey: TextureKeys.SageEncounterShrine },
  'archive-gauntlet-07':   { textureKey: TextureKeys.TrapBitmaskBridge, auditCropIndex: 0 },
  'archive-gauntlet-08':   { textureKey: TextureKeys.StealthArchiveReliquary, auditCropIndex: 2 },
  'archive-gauntlet-09':   { textureKey: TextureKeys.NullGateAntechamber },
  'archive-gauntlet-10':   { textureKey: TextureKeys.DungeonRoomOniThreshold },
  'archive-shard-walk':    { textureKey: TextureKeys.DungeonRoomArchiveShard },
  'sentinel-passage':      { textureKey: TextureKeys.DungeonRoomSentinelPassage },
  'cache-shrine':          { textureKey: TextureKeys.DungeonRoomCacheShrine },
  'boolean-gate-approach': { textureKey: TextureKeys.DungeonRoomBooleanGate },
  'data-ash-vestibule':    { textureKey: TextureKeys.TraversalDataAsh },
  'compiler-shrine-guard': { textureKey: TextureKeys.SageEncounterShrine },
  'bitmask-bridge-watch':  { textureKey: TextureKeys.TrapBitmaskBridge, auditCropIndex: 0 },
  'reliquary-patrol':      { textureKey: TextureKeys.StealthArchiveReliquary, auditCropIndex: 2 },
  'null-gate-guard':       { textureKey: TextureKeys.NullGateAntechamber },
};

const playerFacingDungeonArea = 'Sealed Archive Gauntlet';

const chapterOneMinionHp = 1200;

const dungeonRoomSpawns: SentinelSpawn[][] = [
  [
    { x: 694, y: 410, hp: chapterOneMinionHp, attackStyle: 'pounce' },
    { x: 842, y: 492, hp: chapterOneMinionHp, attackStyle: 'lane' },
    { x: 550, y: 370, hp: chapterOneMinionHp, attackStyle: 'pounce' },
  ],
  [
    { x: 580, y: 374, hp: chapterOneMinionHp + 20, attackStyle: 'lane' },
    { x: 824, y: 494, hp: chapterOneMinionHp + 20, attackStyle: 'pounce' },
    { x: 700, y: 340, hp: chapterOneMinionHp, attackStyle: 'lane' },
    { x: 940, y: 408, hp: chapterOneMinionHp, attackStyle: 'pounce' },
  ],
  [
    { x: 500, y: 430, hp: chapterOneMinionHp + 40, attackStyle: 'lane' },
    { x: 664, y: 344, hp: chapterOneMinionHp + 40, attackStyle: 'pounce' },
    { x: 846, y: 494, hp: chapterOneMinionHp + 40, attackStyle: 'lane' },
    { x: 982, y: 386, hp: chapterOneMinionHp + 20, attackStyle: 'pounce' },
    { x: 400, y: 380, hp: chapterOneMinionHp + 20, attackStyle: 'lane' },
  ],
  [
    { x: 520, y: 390, hp: chapterOneMinionHp + 40, attackStyle: 'pounce' },
    { x: 690, y: 350, hp: chapterOneMinionHp + 60, attackStyle: 'lane' },
    { x: 850, y: 456, hp: chapterOneMinionHp + 40, attackStyle: 'pounce' },
    { x: 980, y: 370, hp: chapterOneMinionHp + 20, attackStyle: 'lane' },
  ],
  [
    { x: 500, y: 360, hp: chapterOneMinionHp + 60, attackStyle: 'lane' },
    { x: 640, y: 430, hp: chapterOneMinionHp + 60, attackStyle: 'pounce' },
    { x: 812, y: 350, hp: chapterOneMinionHp + 80, attackStyle: 'lane' },
    { x: 958, y: 466, hp: chapterOneMinionHp + 40, attackStyle: 'pounce' },
  ],
  [
    { x: 540, y: 410, hp: chapterOneMinionHp + 80, attackStyle: 'pounce' },
    { x: 700, y: 350, hp: chapterOneMinionHp + 100, attackStyle: 'lane' },
    { x: 860, y: 438, hp: chapterOneMinionHp + 80, attackStyle: 'lane' },
    { x: 1000, y: 380, hp: chapterOneMinionHp + 60, attackStyle: 'pounce' },
  ],
  [
    { x: 456, y: 380, hp: chapterOneMinionHp + 80, attackStyle: 'lane' },
    { x: 600, y: 456, hp: chapterOneMinionHp + 90, attackStyle: 'pounce' },
    { x: 740, y: 352, hp: chapterOneMinionHp + 100, attackStyle: 'lane' },
    { x: 890, y: 430, hp: chapterOneMinionHp + 100, attackStyle: 'pounce' },
    { x: 1016, y: 360, hp: chapterOneMinionHp + 90, attackStyle: 'lane' },
  ],
  [
    { x: 516, y: 438, hp: chapterOneMinionHp + 100, attackStyle: 'pounce' },
    { x: 682, y: 360, hp: chapterOneMinionHp + 120, attackStyle: 'lane' },
    { x: 834, y: 462, hp: chapterOneMinionHp + 120, attackStyle: 'pounce' },
    { x: 982, y: 384, hp: chapterOneMinionHp + 100, attackStyle: 'lane' },
    { x: 438, y: 358, hp: chapterOneMinionHp + 100, attackStyle: 'lane' },
    { x: 1080, y: 458, hp: chapterOneMinionHp + 100, attackStyle: 'pounce' },
  ],
  [
    { x: 560, y: 380, hp: chapterOneMinionHp + 120, attackStyle: 'lane' },
    { x: 720, y: 468, hp: chapterOneMinionHp + 120, attackStyle: 'pounce' },
    { x: 900, y: 386, hp: chapterOneMinionHp + 140, attackStyle: 'lane' },
    { x: 1040, y: 462, hp: chapterOneMinionHp + 120, attackStyle: 'pounce' },
    { x: 468, y: 452, hp: chapterOneMinionHp + 100, attackStyle: 'lane' },
  ],
  [
    { x: 500, y: 404, hp: chapterOneMinionHp + 140, attackStyle: 'pounce' },
    { x: 660, y: 344, hp: chapterOneMinionHp + 140, attackStyle: 'lane' },
    { x: 830, y: 462, hp: chapterOneMinionHp + 160, attackStyle: 'pounce' },
    { x: 990, y: 386, hp: chapterOneMinionHp + 140, attackStyle: 'lane' },
    { x: 1090, y: 470, hp: chapterOneMinionHp + 120, attackStyle: 'pounce' },
  ],
];

export class DungeonScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private keys!: GameKeys;
  private sentinels: Sentinel[] = [];
  private canStrike = true;
  private objectiveGroup!: Phaser.GameObjects.Group;
  private objectiveComplete = false;
  private statusText!: Phaser.GameObjects.Text;
  private objectiveText!: Phaser.GameObjects.Text;
  private hudPanel?: Phaser.GameObjects.GameObject;
  private sealStatusIcon?: Phaser.GameObjects.Image;
  private sealStatusFrameWidth = 0;
  private sealStatusFrameHeight = 0;
  private terminal!: TerminalOverlay;
  private pauseMenu!: PauseMenuOverlay;
  private playerShadow!: Phaser.GameObjects.Image;
  private playerBar!: ReturnType<typeof addHealthBar>;
  private foregroundOverlay?: Phaser.GameObjects.Image;
  private playerHp = 100;
  private maxHp = 100;
  private invulnerableUntil = 0;
  private poseLockedUntil = 0;
  private lockedPlayerPose: ActorPose = 'idle';
  private currentVelocity = new Phaser.Math.Vector2(0, 0);
  private lastMoveDirection = new Phaser.Math.Vector2(1, 0);
  private moveHeldMs = 0;
  private lastStepDustAt = 0;
  private lastBoundaryFeedbackAt = 0;
  private strikeChain = 0;
  private lastStrikeAt = 0;
  private transitioning = false;
  private dungeonRoomIndex = 0;
  private readonly dungeonRooms = chapterOneDungeonRooms;
  private arenaBackdrop?: Phaser.GameObjects.Image;
  private arenaShade?: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  private readonly hudPanelBounds = new Phaser.Geom.Rectangle(34, 574, 474, 124);
  private readonly walkableBounds = new Phaser.Geom.Rectangle(176, 236, 912, 356);
  private readonly gatePoint = new Phaser.Math.Vector2(640, 246);
  private gateMarker?: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse;
  private dungeonAtmosphereUsesImagegen = false;
  private dungeonPrimitiveBackdropShadePieces = 0;
  private dungeonExitBeaconFrameWidth = 0;
  private dungeonExitBeaconFrameHeight = 0;
  private dungeonSentinelWarningFrameWidth = 0;
  private dungeonSentinelWarningFrameHeight = 0;
  private lastSentinelWarningOverlayCount = 0;
  private lastSentinelImpactOverlayCount = 0;
  private lastDebugPublishAt = 0;

  constructor() {
    super(SceneKeys.Dungeon);
  }

  init(data?: { startRoom?: number; retryFromDeath?: boolean }): void {
    // Always reset state on (re)entry — fixes "stuck after respawn" bug
    this.transitioning = false;
    this.objectiveComplete = false;
    this.poseLockedUntil = 0;
    this.lockedPlayerPose = 'idle';
    this.currentVelocity.set(0, 0);
    this.lastMoveDirection.set(1, 0);
    this.moveHeldMs = 0;
    this.invulnerableUntil = 0;
    this.strikeChain = 0;
    this.lastStrikeAt = 0;
    this.canStrike = true;
    this.sentinels = [];
    if (data?.startRoom !== undefined) {
      this.dungeonRoomIndex = Phaser.Math.Clamp(data.startRoom, 0, this.dungeonRooms.length - 1);
    } else {
      this.dungeonRoomIndex = 0;
    }
  }

  create(): void {
    (window as unknown as { __CODEJITSU_SCENE?: string }).__CODEJITSU_SCENE = 'dungeon';
    publishControlScheme('dungeon');
    installAudioUnlock(this);
    (window as unknown as { __CODEJITSU_DUNGEON_GATE_OPEN?: boolean }).__CODEJITSU_DUNGEON_GATE_OPEN = false;
    writeSave({ ...loadSave(), currentCheckpoint: 'dungeon' });
    this.keys = createGameKeys(this);
    this.maxHp = loadSave().playerUpgrades.maxHp;
    this.playerHp = this.maxHp;
    this.cameras.main.setBackgroundColor('#0c0710');
    this.drawArena();
    addRoomDepthBorders(this, this.walkableBounds, { sceneId: 'dungeon', frontDepth: 850, accentColor: 0x8f7dff });
    addArenaDepthCues(this, this.walkableBounds, { sceneId: 'dungeon', accentColor: 0x8f7dff, foregroundDepth: 852 });
    this.foregroundOverlay = undefined;
    fadeInFromBlack(this);
    this.player = this.createActor('hero', 320, 420, TextureKeys.Hero, 1.28);
    this.playerShadow = this.add.image(this.player.x, this.player.y + 29, TextureKeys.Shadow).setDisplaySize(82, 34).setAlpha(0.43).setDepth(this.player.y - 8);
    this.player.body?.setSize(28, 24).setOffset(18, 62);
    this.createHud();
    this.spawnDungeonRoom(this.initialDungeonRoomIndex());
    this.publishChapterOnePlaytimeRuntime();
    this.terminal = new TerminalOverlay(this, (command) => this.handleTerminal(command));
    this.pauseMenu = new PauseMenuOverlay(
      this,
      () => this.scene.start(SceneKeys.Title),
    );

    // Dev console helper — call __CODEJITSU_DEV.skipRoom() in the browser console to skip the current room
    (window as Window & {
      __CODEJITSU_DEV?: {
        skipRoom: () => void;
        gotoRoom: (index: number) => void;
        gotoHub: () => void;
      };
    }).__CODEJITSU_DEV = {
      skipRoom: () => {
        if (this.transitioning) { console.warn('[CODEJITSU DEV] Cannot skip — scene is transitioning.'); return; }
        console.info(`[CODEJITSU DEV] Skipping room ${this.dungeonRoomIndex + 1}.`);
        this.sentinels.forEach((sentinel) => {
          sentinel.hp = 0;
          if (sentinel.sprite.active) {
            this.safeSetVelocity(sentinel.sprite, 0, 0);
            setActorPose(sentinel.sprite, 'defeat');
            this.tweens.add({
              targets: [sentinel.sprite, sentinel.shadow],
              alpha: 0, scale: 0.2, duration: 200,
              onComplete: () => {
                if (sentinel.sprite.active) sentinel.sprite.destroy();
                if (sentinel.shadow.active) sentinel.shadow.destroy();
              },
            });
          }
        });
        if (!this.objectiveComplete) this.completeDungeonObjective();
        this.time.delayedCall(260, () => {
          this.transitionFromRoom(this.dungeonRoomIndex);
        });
      },
      gotoRoom: (index: number) => {
        if (this.transitioning) { console.warn('[CODEJITSU DEV] Cannot jump — scene is transitioning.'); return; }
        const clamped = Math.max(0, Math.min(index, this.dungeonRooms.length - 1));
        console.info(`[CODEJITSU DEV] Jumping to room ${clamped + 1}.`);
        this.spawnDungeonRoom(clamped);
      },
      gotoHub: () => {
        console.info('[CODEJITSU DEV] Returning to title.');
        fadeToScene(this, SceneKeys.Title);
      },
    };

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (this.terminal.handleKey(event)) return;
      if (this.pauseMenu.handleKey(event)) return;
      if (event.key === 'Escape') {
        this.pauseMenu.toggle();
        return;
      }
      if (this.pauseMenu.isOpen) return;
      if (this.transitioning) return;
      if (event.key.toLowerCase() === 'x') this.strike();
      if (event.key.toLowerCase() === 'z') this.useAbilityKey();
      if (event.key.toLowerCase() === 't') this.terminal.open(event.timeStamp);
      if (event.key === 'Enter') this.tryEnterGate();
    });
  }

  private tryEnterGate(): void {
    const defeated = this.sentinels.every((sentinel) => sentinel.hp <= 0);
    const gateFloorY = this.gatePoint.y + 58;
    const nearGate =
      Math.abs(this.player.x - this.gatePoint.x) < 138 &&
      Math.abs(this.player.y - gateFloorY) < 92;
    if (!defeated && !isTestMode()) {
      this.updateDungeonHudCopy();
      return;
    }
    if (!nearGate) return;
    this.transitionFromRoom(this.dungeonRoomIndex);
  }

  /**
   * Combat-only copy flow: ten minion rooms advance in sequence, then the Chapter 1 boss.
   */
  private transitionFromRoom(roomIndex: number): void {
    if (this.transitioning) return;
    if (roomIndex < this.dungeonRooms.length - 1) { this.advanceDungeonRoom(); return; }
    this.transitionToBossGate();
  }

  private initialDungeonRoomIndex(): number {
    // Honor whatever init() already set (e.g. retry from death keeps current room)
    if (this.dungeonRoomIndex > 0 && this.dungeonRoomIndex < this.dungeonRooms.length) {
      return this.dungeonRoomIndex;
    }
    if (!this.usesDirectRoomTestStart()) return 0;
    const requested = Number(new URLSearchParams(window.location.search).get('room') ?? 0);
    if (!Number.isFinite(requested)) return 0;
    return Phaser.Math.Clamp(Math.floor(requested), 0, this.dungeonRooms.length - 1);
  }

  private usesDirectRoomTestStart(): boolean {
    return isTestMode() && new URLSearchParams(window.location.search).has('room');
  }

  update(time: number, delta: number): void {
    publishFrameHealth('dungeon', delta);
    if (this.transitioning || this.pauseMenu.isOpen || this.terminal.isOpen) {
      this.safeSetVelocity(this.player, 0, 0);
      this.sentinels
        .filter((sentinel) => sentinel.hp > 0)
        .forEach((sentinel) => this.safeSetVelocity(sentinel.sprite, 0, 0));
      return;
    }
    this.handleMovement(delta);
    this.handleBoundaryFeedback(clampSpriteToArenaBounds(this.player, this.walkableBounds));
    this.updateActorShadow(this.playerShadow, this.player, 29);
    this.sentinels.forEach((sentinel, index) => this.updateSentinel(sentinel, index, time, delta));
    this.separateDungeonCombatants();
    this.player.setDepth(this.player.y);
    this.playerBar.setValue(this.playerHp, this.maxHp);
    // Throttle debug/audit publish calls — they write large objects to window and do not need 60fps resolution
    if (time - this.lastDebugPublishAt > 150) {
      this.lastDebugPublishAt = time;
      this.publishDungeonHudLayout();
      publishPlayerBounds('dungeon', this.player, this.walkableBounds, 0.48);
      this.publishEnemyRuntime();
    }
  }

  private drawArena(): void {
    const initialBackdrop = this.roomBackdropFor(0);
    if (initialBackdrop && this.textures.exists(initialBackdrop.textureKey)) {
      this.arenaBackdrop = this.add.image(640, 360, initialBackdrop.textureKey)
        .setDisplaySize(1280, 720)
        .setAlpha(0.96)
        .setDepth(0);
      this.arenaShade = this.addDungeonAtmosphereOverlay();
      this.applyRoomBackdrop(0);
    }
    if (!this.arenaBackdrop) {
      for (let row = 0; row < 9; row += 1) {
        for (let col = 0; col < 12; col += 1) {
          this.add.image(140 + col * 82 + row * 42, 230 + row * 30, TextureKeys.FloorTile).setAlpha(0.8);
        }
      }
    }
    this.createDungeonGateMarker();
  }

  private addDungeonAtmosphereOverlay(): Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle {
    if (this.textures.exists(TextureKeys.DungeonAtmosphereOverlay)) {
      const source = this.textures.get(TextureKeys.DungeonAtmosphereOverlay).getSourceImage() as { width?: number; height?: number };
      const scale = Math.max(1280 / Number(source.width ?? 1280), 720 / Number(source.height ?? 720));
      this.dungeonAtmosphereUsesImagegen = true;
      this.dungeonPrimitiveBackdropShadePieces = 0;
      return this.add.image(640, 360, TextureKeys.DungeonAtmosphereOverlay)
        .setScale(scale)
        .setAlpha(0.62)
        .setDepth(1)
        .setData('usesImagegenDungeonAtmosphere', true);
    }

    this.dungeonAtmosphereUsesImagegen = false;
    this.dungeonPrimitiveBackdropShadePieces = 1;
    return this.add.rectangle(640, 360, 1280, 720, 0x09070d, 0.18).setDepth(1);
  }

  private roomBackdropFor(roomIndex: number): DungeonRoomBackdrop | undefined {
    const room = this.dungeonRooms[roomIndex];
    if (!room) return this.textures.exists(TextureKeys.DungeonGate) ? { textureKey: TextureKeys.DungeonGate } : undefined;
    const configured = dungeonRoomBackdrops[room.id];
    if (configured && this.textures.exists(configured.textureKey)) return configured;
    return this.textures.exists(TextureKeys.DungeonGate) ? { textureKey: TextureKeys.DungeonGate } : undefined;
  }

  private applyRoomBackdrop(roomIndex: number): void {
    const backdrop = this.roomBackdropFor(roomIndex);
    if (!backdrop || !this.arenaBackdrop || !this.textures.exists(backdrop.textureKey)) {
      this.publishDungeonRoomVisual(roomIndex, false, TextureKeys.FloorTile);
      return;
    }
    const texture = this.textures.get(backdrop.textureKey);
    const source = texture.getSourceImage() as { width?: number; height?: number };
    const sourceWidth = Number(source.width ?? 1672);
    const sourceHeight = Number(source.height ?? 941);
    if (backdrop.cropIndex !== undefined) {
      this.arenaBackdrop
        .setTexture(backdrop.textureKey, this.ensureRoomBackdropFrame(backdrop.textureKey, backdrop.cropIndex, sourceWidth, sourceHeight))
        .setCrop()
        .setDisplaySize(1280, 720);
    } else {
      this.arenaBackdrop
        .setTexture(backdrop.textureKey)
        .setCrop()
        .setDisplaySize(1280, 720);
    }
    this.arenaBackdrop.setData('generatedRoomBackdrop', true);
    this.arenaBackdrop.setData('roomBackdropKey', backdrop.textureKey);
    this.arenaBackdrop.setData('roomBackdropCropIndex', backdrop.auditCropIndex ?? backdrop.cropIndex ?? -1);
    this.publishDungeonRoomVisual(roomIndex, true, backdrop.textureKey, backdrop.auditCropIndex ?? backdrop.cropIndex);
  }

  private ensureRoomBackdropFrame(textureKey: string, cropIndex: number, sourceWidth: number, sourceHeight: number): string {
    const texture = this.textures.get(textureKey) as Phaser.Textures.Texture & {
      has?: (name: string) => boolean;
    };
    const safeCrop = Phaser.Math.Clamp(cropIndex, 0, 3);
    const cellWidth = Math.floor(sourceWidth / 2);
    const cellHeight = Math.floor(sourceHeight / 2);
    const frameKey = `${textureKey}-room-${safeCrop}`;
    if (!texture.has?.(frameKey)) {
      texture.add(frameKey, 0, (safeCrop % 2) * cellWidth, Math.floor(safeCrop / 2) * cellHeight, cellWidth, cellHeight);
    }
    return frameKey;
  }

  private createActor(kind: 'hero' | 'sentinel', x: number, y: number, fallbackTexture: string, scale: number): Phaser.Physics.Arcade.Sprite {
    const sprite = addActorSprite(this, kind, x, y, fallbackTexture, scale);
    sprite.setCollideWorldBounds(true);
    sprite.setDrag(1500);
    return sprite;
  }

  private createSentinel(x: number, y: number, hp = chapterOneMinionHp, attackStyle?: Sentinel['attackStyle']): void {
    const sprite = this.createActor('sentinel', x, y, TextureKeys.NullOni, 0.88);
    sprite.body?.setSize(46, 42).setOffset(50, 140);
    const shadow = this.add.image(x, y + 29, TextureKeys.Shadow).setDisplaySize(86, 32).setAlpha(0.4).setDepth(y - 8);
    this.sentinels.push({
      sprite,
      shadow,
      hp,
      velocity: new Phaser.Math.Vector2(0, 0),
      attackReadyAt: this.time.now + (this.usesDirectRoomTestStart() ? 30_000 : Phaser.Math.Between(700, 1300) + this.sentinels.length * 220),
      attackLockedUntil: 0,
      attackStyle: attackStyle ?? (this.sentinels.length % 2 === 0 ? 'pounce' : 'lane'),
    });
  }

  private spawnDungeonRoom(roomIndex: number): void {
    this.dungeonRoomIndex = roomIndex;
    this.objectiveComplete = false;
    this.applyRoomBackdrop(roomIndex);
    (window as unknown as { __CODEJITSU_DUNGEON_GATE_OPEN?: boolean }).__CODEJITSU_DUNGEON_GATE_OPEN = false;
    this.sentinels.forEach((sentinel) => {
      if (sentinel.sprite.active) sentinel.sprite.destroy();
      if (sentinel.shadow.active) sentinel.shadow.destroy();
    });
    this.sentinels = [];
    (dungeonRoomSpawns[roomIndex] ?? dungeonRoomSpawns[0]).forEach((spawn) => {
      this.createSentinel(spawn.x, spawn.y, spawn.hp, spawn.attackStyle);
    });
    this.setGateMarkerOpen(false, roomIndex >= 2 ? 0xf0c36b : 0x8f7dff);
    this.publishDungeonGateVisual(false);
    this.updateDungeonHudCopy();
    this.publishRouteProgress();
  }

  private createDungeonGateMarker(): void {
    const beaconTexture = TextureKeys.DungeonExitBeacon;
    const usesGeneratedBeacon = this.textures.exists(beaconTexture);
    if (usesGeneratedBeacon) {
      this.gateMarker = this.add.image(this.gatePoint.x, this.dungeonGateVisualY(), beaconTexture, this.ensureDungeonExitBeaconFrame(0))
        .setDisplaySize(158, 96)
        .setAlpha(0)
        .setVisible(false)
        .setDepth(61)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.gateMarker.setData('usesImagegenGate', true);
      this.gateMarker.setData('usesImagegenExitBeacon', true);
      this.gateMarker.setData('gateTextureKey', beaconTexture);
      this.gateMarker.setData('dynamicPortalVisible', false);
    } else {
      this.gateMarker = this.add.ellipse(this.gatePoint.x, this.dungeonGateVisualY(), 156, 70, 0x8f7dff, 0).setDepth(58).setVisible(false);
    }
    this.publishDungeonGateVisual(false);
  }

  private dungeonGateVisualY(): number {
    return this.gatePoint.y + 38;
  }

  private ensureDungeonExitBeaconFrame(frameIndex: number): string {
    const texture = this.textures.get(TextureKeys.DungeonExitBeacon);
    const source = texture.getSourceImage() as { width?: number; height?: number };
    this.dungeonExitBeaconFrameWidth ||= Math.floor(Number(source.width ?? 2172) / 3);
    this.dungeonExitBeaconFrameHeight ||= Number(source.height ?? 724);
    const safeFrame = Phaser.Math.Clamp(Math.floor(frameIndex), 0, 2);
    const frameName = `dungeon-exit-beacon-${safeFrame}`;
    if (!texture.has(frameName)) {
      texture.add(frameName, 0, safeFrame * this.dungeonExitBeaconFrameWidth, 0, this.dungeonExitBeaconFrameWidth, this.dungeonExitBeaconFrameHeight);
    }
    return frameName;
  }

  private setGateMarkerOpen(open: boolean, tint = 0x8f7dff): void {
    if (!this.gateMarker) return;
    this.tweens.killTweensOf(this.gateMarker);
    this.gateMarker.setVisible(open);
    if (!open) {
      this.gateMarker.setAlpha(0);
      return;
    }
    if (this.gateMarker instanceof Phaser.GameObjects.Image) {
      if (this.gateMarker.getData('usesImagegenExitBeacon') === true) {
        this.gateMarker
          .setTexture(TextureKeys.DungeonExitBeacon, this.ensureDungeonExitBeaconFrame(open ? 2 : 0))
          .setDisplaySize(open ? 172 : 150, open ? 104 : 90)
          .setAlpha(open ? 0.74 : 0.22)
          .clearTint()
          .setBlendMode(Phaser.BlendModes.ADD)
          .setData('dungeonExitBeaconFrameIndex', open ? 2 : 0);
        return;
      }
      this.gateMarker
        .setDisplaySize(open ? 132 : 118, open ? 104 : 92)
        .setAlpha(open ? 0.48 : 0.24)
        .setTint(open ? 0xf0c36b : tint)
        .setBlendMode(Phaser.BlendModes.ADD);
      return;
    }
    this.gateMarker.setFillStyle(open ? 0xf0c36b : tint, open ? 0.28 : 0.16);
  }

  private publishDungeonGateVisual(gateOpen: boolean): void {
    const usesGeneratedGate = Boolean(this.gateMarker?.getData('usesImagegenGate'));
    (window as Window & {
      __CODEJITSU_DUNGEON_GATE_VISUAL?: {
        scene: string;
        usesImagegenGate: boolean;
        primitiveGatePieces: number;
        labelVisible: boolean;
        gateVisible: boolean;
        gateOpen: boolean;
        singleGatePresentation: boolean;
        usesImagegenExitBeacon: boolean;
        dynamicPortalVisible: boolean;
        exitBeaconOnly: boolean;
        textureKey: string;
        at: number;
      };
    }).__CODEJITSU_DUNGEON_GATE_VISUAL = {
      scene: 'dungeon',
      usesImagegenGate: usesGeneratedGate,
      primitiveGatePieces: usesGeneratedGate ? 0 : 1,
      labelVisible: false,
      gateVisible: Boolean(this.gateMarker?.visible),
      gateOpen,
      singleGatePresentation: usesGeneratedGate,
      usesImagegenExitBeacon: this.gateMarker?.getData('usesImagegenExitBeacon') === true,
      dynamicPortalVisible: this.gateMarker?.getData('dynamicPortalVisible') === true,
      exitBeaconOnly: this.gateMarker?.getData('usesImagegenExitBeacon') === true,
      textureKey: usesGeneratedGate ? String(this.gateMarker?.getData('gateTextureKey') ?? TextureKeys.GatePortal) : 'fallback-ellipse',
      at: Math.round(performance.now()),
    };
  }

  private publishDungeonRoomVisual(roomIndex: number, usesGeneratedRoomBackdrop: boolean, textureKey: string, cropIndex?: number): void {
    const room = this.dungeonRooms[roomIndex] ?? this.dungeonRooms[0];
    (window as Window & {
      __CODEJITSU_DUNGEON_ROOM_VISUAL?: {
        scene: string;
        roomId: string;
        currentArea: string;
        internalRoomLabel: string;
        roomIndex: number;
        totalRooms: number;
        textureKey: string;
        cropIndex: number;
        usesGeneratedRoomBackdrop: boolean;
        usesImagegenAtmosphereOverlay: boolean;
        primitiveBackdropShadePieces: number;
        atmosphereTextureKey: string;
        gateMarkerHiddenWhenLocked: boolean;
        repeatedGateMarkerVisible: boolean;
        roomTitleVisible: boolean;
        roomNameHidden: boolean;
        mapProgressCopyVisible: boolean;
        at: number;
      };
    }).__CODEJITSU_DUNGEON_ROOM_VISUAL = {
      scene: 'dungeon',
      roomId: room.id,
      currentArea: playerFacingDungeonArea,
      internalRoomLabel: room.label,
      roomIndex,
      totalRooms: this.dungeonRooms.length,
      textureKey,
      cropIndex: cropIndex ?? -1,
      usesGeneratedRoomBackdrop,
      usesImagegenAtmosphereOverlay: this.dungeonAtmosphereUsesImagegen,
      primitiveBackdropShadePieces: this.dungeonPrimitiveBackdropShadePieces,
      atmosphereTextureKey: this.dungeonAtmosphereUsesImagegen ? TextureKeys.DungeonAtmosphereOverlay : 'fallback-rectangle',
      gateMarkerHiddenWhenLocked: !this.objectiveComplete && this.gateMarker?.visible !== true,
      repeatedGateMarkerVisible: !this.objectiveComplete && this.gateMarker?.visible === true,
      roomTitleVisible: false,
      roomNameHidden: true,
      mapProgressCopyVisible: false,
      at: Math.round(performance.now()),
    };
  }

  private createHud(): void {
    this.playerBar = addHealthBar(this, 36, 52, 260, 20, 'Apprentice');
    this.hudPanel = this.createDungeonHudPanel();
    this.sealStatusIcon = this.createSealStatusIcon();
    this.objectiveText = makePixelText(this, 190, 614, '', 15, '#f6ead3')
      .setDepth(1001)
      .setWordWrapWidth(330);
    this.statusText = makePixelText(this, 190, 646, '', 13, '#ded1df')
      .setDepth(1001)
      .setWordWrapWidth(330);
    this.objectiveGroup = this.add.group([this.hudPanel, this.sealStatusIcon, this.objectiveText, this.statusText].filter(Boolean) as Phaser.GameObjects.GameObject[]);
    this.updateDungeonHudCopy();
    this.publishDungeonHudVisual();
    this.publishDungeonHudLayout();
  }

  private createSealStatusIcon(): Phaser.GameObjects.Image | undefined {
    if (!this.textures.exists(TextureKeys.DungeonSealStatus)) return undefined;
    const source = this.textures.get(TextureKeys.DungeonSealStatus).getSourceImage() as { width?: number; height?: number };
    this.sealStatusFrameWidth = Math.floor(Number(source.width ?? 1984) / 4);
    this.sealStatusFrameHeight = Number(source.height ?? 793);
    const icon = this.add.image(118, 648, TextureKeys.DungeonSealStatus, this.ensureSealStatusFrame(0))
      .setDisplaySize(76, 62)
      .setDepth(1001)
      .setAlpha(0.96)
      .setData('usesImagegenSealStatus', true);
    return icon;
  }

  private ensureSealStatusFrame(frameIndex: number): string {
    const texture = this.textures.get(TextureKeys.DungeonSealStatus) as Phaser.Textures.Texture & {
      has?: (name: string) => boolean;
      add?: (name: string, sourceIndex: number, x: number, y: number, width: number, height: number) => Phaser.Textures.Frame;
    };
    const safeFrame = Phaser.Math.Clamp(frameIndex, 0, 3);
    const frameKey = `dungeon-seal-status-${safeFrame}`;
    if (!texture.has?.(frameKey)) {
      texture.add?.(frameKey, 0, safeFrame * this.sealStatusFrameWidth, 0, this.sealStatusFrameWidth, this.sealStatusFrameHeight);
    }
    return frameKey;
  }

  private updateSealStatusIcon(living: number): void {
    if (!this.sealStatusIcon || !this.textures.exists(TextureKeys.DungeonSealStatus)) return;
    const frameIndex = living <= 0 ? 3 : living === 1 ? 0 : living === 2 ? 1 : 2;
    this.sealStatusIcon
      .setTexture(TextureKeys.DungeonSealStatus, this.ensureSealStatusFrame(frameIndex))
      .setDisplaySize(living >= 3 ? 88 : 76, 62)
      .setAlpha(living <= 0 ? 1 : 0.96)
      .setData('sealStatusFrameIndex', frameIndex);
  }

  private createDungeonHudPanel(): Phaser.GameObjects.GameObject {
    if (this.textures.exists(TextureKeys.DungeonHudPanel)) {
      return this.add.image(271, 636, TextureKeys.DungeonHudPanel)
        .setDisplaySize(474, 126)
        .setDepth(1000)
        .setAlpha(0.94)
        .setData('usesImagegenHudPanel', true);
    }
    return addPanel(this, this.hudPanelBounds.x, this.hudPanelBounds.y, this.hudPanelBounds.width, this.hudPanelBounds.height, 0.74)
      .setDepth(1000);
  }

  private updateDungeonHudCopy(): void {
    if (!this.objectiveText || !this.statusText) return;
    const living = this.sentinels.filter((sentinel) => sentinel.hp > 0).length;
    this.updateSealStatusIcon(living);
    this.objectiveText.setText(living > 0
      ? `Room ${this.dungeonRoomIndex + 1}/${this.dungeonRooms.length}: ${living} sentinels left`
      : `Room ${this.dungeonRoomIndex + 1}/${this.dungeonRooms.length}: path open`);
    this.statusText.setText(living > 0
      ? 'sentinels left - X or T'
      : 'gate open - walk in');
    if (living > 0) {
      this.publishDungeonHudVisual();
      this.publishDungeonHudLayout();
      return;
    }
    this.publishDungeonHudVisual();
    this.publishDungeonHudLayout();
  }

  private shortDungeonRoomLabel(label: string): string {
    const compactLabels: Record<string, string> = {
      'Archive Shard Walk': 'Shard Walk',
      'Sentinel Passage': 'Sentinel Pass',
      'Broken Boolean Gate': 'Boolean Gate',
      'Data Ash Crossing': 'Data Ash',
      'Bitmask Bridge': 'Bitmask Bridge',
      'Cache Shrine': 'Cache Shrine',
      'Archive Reliquary': 'Reliquary',
      'Checksum Mausoleum': 'Checksum',
      'Null Gate Antechamber': 'Null Gate',
      'Oni Threshold': 'Oni Threshold',
    };
    return compactLabels[label] ?? label;
  }

  private publishDungeonHudLayout(): void {
    if (!this.objectiveText || !this.statusText) return;
    publishTextPanelAudit('dungeon-hud', this.hudPanelBounds, [
      { id: 'objective', object: this.objectiveText },
      { id: 'status', object: this.statusText },
    ], 12);
  }

  private publishDungeonHudVisual(): void {
    const panel = this.hudPanel as (Phaser.GameObjects.GameObject & { getData?: (key: string) => unknown }) | undefined;
    const usesGeneratedPanel = Boolean(panel?.getData?.('usesImagegenHudPanel'));
    const hudWindow = (window as Window & {
      __CODEJITSU_DUNGEON_HUD_VISUAL?: {
        scene: string;
        usesImagegenPanel: boolean;
        primitivePanelPieces: number;
        compactCopy: boolean;
        wordCount: number;
        objectiveCopy: string;
        statusCopy: string;
        gateCopyVisible: boolean;
        usesImagegenSealStatus: boolean;
        primitiveSealStatusPieces: number;
        sealStatusFrameIndex: number;
        sealStatusTextureKey: string;
        noMapCopyVisible: boolean;
        textOverlayCount: number;
        panelWidth: number;
        panelHeight: number;
        at: number;
      };
    });
    const copy = `${this.objectiveText.text} ${this.statusText.text}`;
    const usesSealStatusIcon = Boolean(this.sealStatusIcon?.getData('usesImagegenSealStatus'));
    hudWindow.__CODEJITSU_DUNGEON_HUD_VISUAL = {
      scene: 'dungeon',
      usesImagegenPanel: usesGeneratedPanel,
      primitivePanelPieces: usesGeneratedPanel ? 0 : 1,
      compactCopy: true,
      wordCount: copy.split(/\s+/).filter(Boolean).length,
      objectiveCopy: this.objectiveText.text,
      statusCopy: this.statusText.text,
      gateCopyVisible: this.objectiveComplete && /gate|open/i.test(copy),
      usesImagegenSealStatus: usesSealStatusIcon,
      primitiveSealStatusPieces: usesSealStatusIcon ? 0 : 1,
      sealStatusFrameIndex: Number(this.sealStatusIcon?.getData('sealStatusFrameIndex') ?? -1),
      sealStatusTextureKey: this.sealStatusIcon ? TextureKeys.DungeonSealStatus : 'missing',
      noMapCopyVisible: !/map|chapter|objective/i.test(copy),
      textOverlayCount: [this.objectiveText.text, this.statusText.text].filter((text) => text.trim().length > 0).length,
      panelWidth: this.hudPanelBounds.width,
      panelHeight: this.hudPanelBounds.height,
      at: Math.round(performance.now()),
    };
  }

  private updateSentinel(sentinel: Sentinel, index: number, time: number, delta: number): void {
    if (sentinel.hp <= 0 || !sentinel.sprite.body) return;
    if (time < sentinel.attackLockedUntil) {
      this.safeSetVelocity(sentinel.sprite, sentinel.velocity.x, sentinel.velocity.y);
      clampSpriteToArenaBounds(sentinel.sprite, this.walkableBounds);
      this.updateSentinelGrounding(sentinel);
      sentinel.sprite.setDepth(sentinel.sprite.y);
      return;
    }

    const dx = this.player.x - sentinel.sprite.x;
    const dy = this.player.y - sentinel.sprite.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    if (time >= sentinel.attackReadyAt && distance < (sentinel.attackStyle === 'lane' ? 250 : 176)) {
      this.startSentinelAttack(sentinel, index);
      return;
    }

    const desired = new Phaser.Math.Vector2(0, 0);
    const angle = Math.atan2(dy, dx);
    if (distance > 156) {
      desired.set(Math.cos(angle) * 88, Math.sin(angle) * 64);
    } else if (distance < 104) {
      desired.set(-Math.cos(angle) * 70, -Math.sin(angle) * 50);
    } else {
      const strafe = index % 2 === 0 ? 1 : -1;
      desired.set(Math.cos(angle + Math.PI / 2) * 54 * strafe, Math.sin(angle + Math.PI / 2) * 38 * strafe);
    }

    sentinel.velocity.lerp(desired, Math.min(1, delta / 120));
    this.safeSetVelocity(sentinel.sprite, sentinel.velocity.x, sentinel.velocity.y);
    clampSpriteToArenaBounds(sentinel.sprite, this.walkableBounds);
    setActorPose(sentinel.sprite, sentinel.velocity.lengthSq() > 80 ? 'walk' : 'idle');
    this.updateSentinelGrounding(sentinel);
    sentinel.sprite.setFlipX(sentinel.sprite.x > this.player.x);
    sentinel.sprite.setDepth(sentinel.sprite.y);
  }

  private separateDungeonCombatants(): void {
    this.sentinels
      .filter((sentinel) => sentinel.hp > 0 && sentinel.sprite.body)
      .forEach((sentinel) => {
        const minDistance = 116;
        const dx = this.player.x - sentinel.sprite.x;
        const dy = (this.player.y - sentinel.sprite.y) * 1.28;
        const distance = Math.max(1, Math.hypot(dx, dy));
        if (distance >= minDistance) return;
        const push = (minDistance - distance) * 0.54;
        const pushX = (dx / distance) * push;
        const pushY = (dy / distance) * push * 0.72;
        this.player.x += pushX;
        this.player.y += pushY;
        sentinel.sprite.x -= pushX * 0.46;
        sentinel.sprite.y -= pushY * 0.46;
        this.currentVelocity.x *= 0.62;
        this.currentVelocity.y *= 0.62;
        sentinel.velocity.x *= 0.5;
        sentinel.velocity.y *= 0.5;
        this.safeSetVelocity(this.player, this.currentVelocity.x, this.currentVelocity.y);
        this.safeSetVelocity(sentinel.sprite, sentinel.velocity.x, sentinel.velocity.y);
        this.handleBoundaryFeedback(clampSpriteToArenaBounds(this.player, this.walkableBounds));
        clampSpriteToArenaBounds(sentinel.sprite, this.walkableBounds);
      });

    for (let a = 0; a < this.sentinels.length; a += 1) {
      for (let b = a + 1; b < this.sentinels.length; b += 1) {
        const first = this.sentinels[a];
        const second = this.sentinels[b];
        if (!first || !second || first.hp <= 0 || second.hp <= 0) continue;
        const minDistance = 92;
        const dx = first.sprite.x - second.sprite.x;
        const dy = (first.sprite.y - second.sprite.y) * 1.2;
        const distance = Math.max(1, Math.hypot(dx, dy));
        if (distance >= minDistance) continue;
        const push = (minDistance - distance) * 0.34;
        const pushX = (dx / distance) * push;
        const pushY = (dy / distance) * push * 0.72;
        first.sprite.x += pushX;
        first.sprite.y += pushY;
        second.sprite.x -= pushX;
        second.sprite.y -= pushY;
        clampSpriteToArenaBounds(first.sprite, this.walkableBounds);
        clampSpriteToArenaBounds(second.sprite, this.walkableBounds);
      }
    }
  }

  private startSentinelAttack(sentinel: Sentinel, index: number): void {
    sentinel.attackLockedUntil = this.time.now + 760;
    sentinel.attackReadyAt = this.time.now + 1200 + index * 180;
    sentinel.velocity.set(0, 0);
    this.safeSetVelocity(sentinel.sprite, 0, 0);
    setActorPose(sentinel.sprite, 'attack');
    sentinel.sprite.setFlipX(sentinel.sprite.x > this.player.x);

    if (sentinel.attackStyle === 'lane') {
      this.startSentinelLaneJab(sentinel);
      return;
    }
    this.startSentinelPounce(sentinel);
  }

  private startSentinelPounce(sentinel: Sentinel): void {
    const target = new Phaser.Math.Vector2(this.player.x, this.player.y);
    const warning = addGeneratedTelegraphSigil(this, 'dungeon', 'ring', target.x, target.y + 2, {
      width: 172,
      height: 100,
      depth: target.y - 1,
      alpha: 0.7,
      tint: 0x8f7dff,
      lifespanMs: 520,
    }) ?? this.add.ellipse(target.x, target.y + 2, 116, 58, 0x8f7dff, 0.18)
      .setStrokeStyle(3, 0xf6ead3, 0.34)
      .setDepth(target.y - 1);
    this.tweens.add({
      targets: warning,
      alpha: 0.48,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 360,
      yoyo: true,
      ease: 'Sine.InOut',
      onComplete: () => {
        const angle = Phaser.Math.Angle.Between(sentinel.sprite.x, sentinel.sprite.y, target.x, target.y);
        sentinel.velocity.set(Math.cos(angle) * 420, Math.sin(angle) * 305);
        this.safeSetVelocity(sentinel.sprite, sentinel.velocity.x, sentinel.velocity.y);
        playBoom(this, 0.5);
        this.resolveSentinelHit(target.x, target.y, 68, 12);
        addSeamVfx(this, 'dungeon', 'burst', target.x, target.y + 2, {
          width: 132,
          height: 118,
          depth: target.y + 14,
          alpha: 0.72,
          tint: 0x8f7dff,
          lifespanMs: 360,
        });
        addGroundCrack(this, target.x, target.y + 10, 0x8f7dff, target.y + 12);
        warning.destroy();
        this.time.delayedCall(180, () => {
          sentinel.velocity.set(0, 0);
          this.safeSetVelocity(sentinel.sprite, 0, 0);
          if (sentinel.hp > 0) setActorPose(sentinel.sprite, 'idle');
        });
      },
    });
  }

  private startSentinelLaneJab(sentinel: Sentinel): void {
    const axis = Math.abs(this.player.x - sentinel.sprite.x) > Math.abs(this.player.y - sentinel.sprite.y) * 1.5 ? 'horizontal' : 'vertical';
    const x = axis === 'vertical' ? this.player.x : sentinel.sprite.x + (this.player.x > sentinel.sprite.x ? 108 : -108);
    const y = axis === 'horizontal' ? this.player.y : sentinel.sprite.y + (this.player.y > sentinel.sprite.y ? 72 : -72);
    const warningX = axis === 'horizontal' ? (sentinel.sprite.x + x) / 2 : x;
    const warningY = axis === 'horizontal' ? y : (sentinel.sprite.y + y) / 2;
    const warningDepth = Math.max(this.player.y, sentinel.sprite.y) + 2;
    const generatedLane = this.addDungeonSentinelWarningOverlay(axis, warningX, warningY, warningDepth, 'warning');
    const warning = generatedLane
      ? (axis === 'horizontal'
        ? this.add.rectangle(warningX, warningY, 230, 46, 0x09070d, 0.018)
        : this.add.rectangle(warningX, warningY, 58, 176, 0x09070d, 0.018))
      : addGeneratedTelegraphSigil(this, 'dungeon', 'lane', warningX, warningY, {
        width: axis === 'horizontal' ? 276 : 224,
        height: axis === 'horizontal' ? 112 : 104,
        depth: warningDepth,
        rotation: axis === 'horizontal' ? Math.PI / 2 : 0,
        alpha: 0.72,
        tint: 0xf0c36b,
        lifespanMs: 600,
      }) ?? (axis === 'horizontal'
        ? this.add.rectangle(warningX, warningY, 230, 46, 0xf0c36b, 0.18)
        : this.add.rectangle(warningX, warningY, 58, 176, 0xf0c36b, 0.18));
    warning.setDepth(warningDepth);
    if (generatedLane) {
      warning.setAlpha(0);
      warning.setData('collisionOnlyGeneratedDungeonWarning', true);
    }
    if (!generatedLane && warning instanceof Phaser.GameObjects.Rectangle) {
      warning.setStrokeStyle(3, 0xf6ead3, 0.3);
    }
    this.publishDungeonSentinelWarningRuntime(axis, Boolean(generatedLane), false, warning);
    this.tweens.add({
      targets: generatedLane ?? warning,
      alpha: generatedLane ? 0.72 : 0.54,
      scale: 1.05,
      duration: 420,
      yoyo: true,
      ease: 'Sine.InOut',
      onComplete: () => {
        const generatedImpact = this.addDungeonSentinelWarningOverlay(axis, warning.x, warning.y, warning.depth + 2, 'impact');
        const slash = generatedImpact ?? addSeamVfx(this, 'dungeon', 'slash', warning.x, warning.y, {
          width: axis === 'horizontal' ? 260 : 196,
          height: axis === 'horizontal' ? 112 : 96,
          depth: warning.depth + 2,
          rotation: axis === 'horizontal' ? 0 : Math.PI / 2,
          alpha: 0.82,
          tint: 0xf0c36b,
          lifespanMs: 260,
        }) ?? (axis === 'horizontal'
          ? this.add.rectangle(warning.x, warning.y, 260, 8, 0xf6ead3, 0.62)
          : this.add.rectangle(warning.x, warning.y, 8, 196, 0xf6ead3, 0.62));
        slash.setDepth(warning.depth + 2);
        this.publishDungeonSentinelWarningRuntime(axis, Boolean(generatedLane), Boolean(generatedImpact), warning);
        addVoidBurst(this, warning.x, warning.y, 0xf0c36b, warning.depth + 3);
        this.resolveSentinelLaneHit(axis, warning.x, warning.y, 14);
        playBoom(this, 0.48);
        this.tweens.add({
          targets: slash,
          alpha: 0,
          scaleX: axis === 'horizontal' ? 1.12 : 1,
          scaleY: axis === 'vertical' ? 1.12 : 1,
          duration: 220,
          onComplete: () => {
            if (slash.active) slash.destroy();
          },
        });
        warning.destroy();
        generatedLane?.destroy();
        this.time.delayedCall(160, () => {
          if (sentinel.hp > 0) setActorPose(sentinel.sprite, 'idle');
        });
      },
    });
  }

  private addDungeonSentinelWarningOverlay(
    axis: 'horizontal' | 'vertical',
    x: number,
    y: number,
    depth: number,
    phase: 'warning' | 'impact',
  ): Phaser.GameObjects.Image | undefined {
    if (!this.textures.exists(TextureKeys.DungeonSentinelWarning)) return undefined;
    const frameIndex = phase === 'impact' ? 2 : axis === 'horizontal' ? 0 : 1;
    const frame = this.ensureDungeonSentinelWarningFrame(frameIndex);
    const image = this.add.image(x, y, TextureKeys.DungeonSentinelWarning, frame)
      .setDepth(depth + (phase === 'impact' ? 2 : 1))
      .setAlpha(phase === 'impact' ? 0.86 : 0.68)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setData('usesImagegenDungeonSentinelWarning', true)
      .setData('dungeonSentinelWarningFrameIndex', frameIndex);
    if (phase === 'impact') {
      image.setDisplaySize(178, 150);
      this.lastSentinelImpactOverlayCount += 1;
      return image;
    }
    if (axis === 'horizontal') {
      image.setDisplaySize(292, 118);
    } else {
      image.setDisplaySize(112, 236);
    }
    this.lastSentinelWarningOverlayCount += 1;
    return image;
  }

  private ensureDungeonSentinelWarningFrame(frameIndex: number): string {
    const texture = this.textures.get(TextureKeys.DungeonSentinelWarning);
    const source = texture.getSourceImage() as { width?: number; height?: number };
    this.dungeonSentinelWarningFrameWidth ||= Math.floor(Number(source.width ?? 2048) / 3);
    this.dungeonSentinelWarningFrameHeight ||= Number(source.height ?? 768);
    const safeFrame = Phaser.Math.Clamp(Math.floor(frameIndex), 0, 2);
    const frameName = `dungeon-sentinel-warning-${safeFrame}`;
    if (!texture.has(frameName)) {
      texture.add(frameName, 0, safeFrame * this.dungeonSentinelWarningFrameWidth, 0, this.dungeonSentinelWarningFrameWidth, this.dungeonSentinelWarningFrameHeight);
    }
    return frameName;
  }

  private publishDungeonSentinelWarningRuntime(
    axis: 'horizontal' | 'vertical',
    usesWarningOverlay: boolean,
    usesImpactOverlay: boolean,
    collisionObject: Phaser.GameObjects.GameObject,
  ): void {
    (window as Window & {
      __CODEJITSU_DUNGEON_SENTINEL_WARNING?: {
        scene: string;
        axis: 'horizontal' | 'vertical';
        usesImagegenWarningOverlay: boolean;
        usesImagegenImpactOverlay: boolean;
        warningOverlayCount: number;
        impactOverlayCount: number;
        primitiveWarningAlpha: number;
        collisionOnly: boolean;
        generatedArtOnly: boolean;
        textureKey: string;
        at: number;
      };
    }).__CODEJITSU_DUNGEON_SENTINEL_WARNING = {
      scene: 'dungeon',
      axis,
      usesImagegenWarningOverlay: usesWarningOverlay,
      usesImagegenImpactOverlay: usesImpactOverlay,
      warningOverlayCount: this.lastSentinelWarningOverlayCount,
      impactOverlayCount: this.lastSentinelImpactOverlayCount,
      primitiveWarningAlpha: Math.round((Number((collisionObject as Phaser.GameObjects.GameObject & { alpha?: number }).alpha ?? 1)) * 1000) / 1000,
      collisionOnly: Boolean(collisionObject.getData('collisionOnlyGeneratedDungeonWarning')),
      generatedArtOnly: usesWarningOverlay && Number((collisionObject as Phaser.GameObjects.GameObject & { alpha?: number }).alpha ?? 1) === 0,
      textureKey: this.textures.exists(TextureKeys.DungeonSentinelWarning) ? TextureKeys.DungeonSentinelWarning : 'missing',
      at: Math.round(performance.now()),
    };
  }

  private resolveSentinelHit(x: number, y: number, radius: number, damage: number): void {
    if (this.time.now < this.invulnerableUntil) return;
    if (Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y) > radius) return;
    this.damagePlayer(damage, x, y);
  }

  private resolveSentinelLaneHit(axis: 'horizontal' | 'vertical', x: number, y: number, damage: number): void {
    if (this.time.now < this.invulnerableUntil) return;
    const hit = axis === 'horizontal'
      ? Math.abs(this.player.y - y) < 42 && Math.abs(this.player.x - x) < 140
      : Math.abs(this.player.x - x) < 46 && Math.abs(this.player.y - y) < 108;
    if (hit) this.damagePlayer(damage, x, y);
  }

  private damagePlayer(damage: number, sourceX: number, sourceY: number): void {
    this.playerHp = Math.max(0, this.playerHp - damage);
    this.invulnerableUntil = this.time.now + 800;
    this.poseLockedUntil = this.time.now + 180;
    this.lockedPlayerPose = 'hurt';
    setActorPose(this.player, 'hurt');
    playHit(this);
    this.player.setTintFill(0xd64f45);
    const angle = Phaser.Math.Angle.Between(sourceX, sourceY, this.player.x, this.player.y);
    const push = new Phaser.Math.Vector2(Math.cos(angle) * 160, Math.sin(angle) * 110);
    this.currentVelocity.copy(push);
    this.safeSetVelocity(this.player, push.x, push.y);
    this.time.delayedCall(120, () => this.player.clearTint());
    this.time.delayedCall(220, () => {
      if (this.playerHp > 0) setActorPose(this.player, 'idle');
    });
    if (this.playerHp <= 0) {
      this.transitioning = true;
      const currentRoom = this.dungeonRoomIndex;
      this.time.delayedCall(260, () => this.scene.start(SceneKeys.Result, {
        outcome: 'lose',
        chapter: 1,
        deathReason: 'The archive mask broke your guard.',
        retryScene: SceneKeys.Dungeon,
        retryData: { startRoom: currentRoom },
      }));
    }
  }

  private transitionToBossGate(): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.updateSealStatusIcon(0);
    this.updateDungeonHudCopy();
    this.publishDungeonHudVisual();
    this.player.setFlipX(false);
    this.poseLockedUntil = this.time.now + 920;
    this.lockedPlayerPose = 'walk';
    setActorPose(this.player, 'walk');
    walkSpriteIntoGate(this, this.player, new Phaser.Math.Vector2(this.gatePoint.x, this.gatePoint.y + 4), SceneKeys.Boss, {
      duration: 680,
      fadeDuration: 430,
      onStep: () => {
        this.player.setDepth(this.player.y);
        this.updateActorShadow(this.playerShadow, this.player, 29);
      },
    });
  }

  private handleMovement(delta: number): void {
    const input = readMovementInput(this.keys);
    const wantsMove = input.x * input.x + input.y * input.y > 0;
    this.moveHeldMs = wantsMove ? Math.min(this.moveHeldMs + delta, 1400) : 0;
    const movement = stepMovementVelocity(this.currentVelocity, input, delta, apprenticeMovementTuning, this.moveHeldMs);
    if (movement.moving) {
      this.lastMoveDirection.copy(movement.direction);
    }
    this.safeSetVelocity(this.player, movement.velocity.x, movement.velocity.y);
    if (this.time.now < this.poseLockedUntil) {
      setActorPose(this.player, this.lockedPlayerPose);
    } else {
      setActorPose(this.player, movement.moving ? (movement.runFactor > 1.08 ? 'run' : 'walk') : 'idle');
    }
    updateGroundedActorVisual(this, this.player, this.playerShadow, 29, movement, { width: 82, height: 34, alpha: 0.43 });
    updateForegroundParallaxDepth(this, 'dungeon', this.foregroundOverlay, movement, 0.34);
    const dustDelay = movement.strideIntervalMs;
    if (movement.strideIntensity > 0.34 && movement.velocity.x * movement.velocity.x + movement.velocity.y * movement.velocity.y > 8200 && this.time.now - this.lastStepDustAt > dustDelay) {
      this.lastStepDustAt = this.time.now;
      addStepDust(this, this.player.x, this.player.y, this.player.y - 6, this.lastMoveDirection.x || 1);
    }
    if (this.lastMoveDirection.x < -0.1) this.player.setFlipX(true);
    if (this.lastMoveDirection.x > 0.1) this.player.setFlipX(false);
  }

  private strike(): void {
    if (!this.canStrike) return;
    this.canStrike = false;
    this.strikeChain = this.time.now - this.lastStrikeAt > 620 ? 0 : (this.strikeChain + 1) % 3;
    this.lastStrikeAt = this.time.now;
    const variant = this.strikeChain;
    this.poseLockedUntil = this.time.now + (variant === 2 ? 340 : 270);
    this.lockedPlayerPose = 'swing';
    setActorPose(this.player, 'swing');
    playSlash(this);
    const target = this.nearestSwingTarget();
    const direction = target
      ? (target.sentinel.sprite.x < this.player.x ? -1 : 1)
      : (this.lastMoveDirection.x < -0.1 ? -1 : 1);
    this.player.setFlipX(direction < 0);
    this.lastMoveDirection.set(direction, 0);
    this.player.x += direction * (variant === 2 ? 20 : 12);
    this.currentVelocity.set(direction * (variant === 2 ? 130 : 95), this.currentVelocity.y * 0.25);
    this.safeSetVelocity(this.player, this.currentVelocity.x, this.currentVelocity.y);
    this.handleBoundaryFeedback(clampSpriteToArenaBounds(this.player, this.walkableBounds));
    const sword = addSwordSwing(this, this.player.x, this.player.y, direction as 1 | -1, this.player.y + 20, variant);
    publishSwordSwing('dungeon', this.player.x, this.player.y, sword.hitX, sword.hitY, variant, target?.id ?? '', sword);
    let hitAny = false;
    this.sentinels.forEach((sentinel) => {
      if (sentinel.hp <= 0) return;
      const swordDistance = Phaser.Math.Distance.Between(sword.hitX, sword.hitY, sentinel.sprite.x, sentinel.sprite.y);
      const bodyDistance = Phaser.Math.Distance.Between(this.player.x, this.player.y, sentinel.sprite.x, sentinel.sprite.y);
      if (Math.min(swordDistance, bodyDistance) < (variant === 2 ? 158 : 134)) {
        hitAny = true;
        sentinel.hp -= variant === 2 ? 24 : 18;
        playHit(this);
        addHitSparks(this, sentinel.sprite.x, sentinel.sprite.y - 30, sentinel.sprite.y + 16);
        sentinel.sprite.x += direction * (variant === 2 ? 34 : 22);
        this.cameras.main.shake(variant === 2 ? 105 : 70, variant === 2 ? 0.006 : 0.0035);
        setActorPose(sentinel.sprite, 'hurt');
        sentinel.sprite.setTintFill(0xf6ead3);
        this.time.delayedCall(90, () => sentinel.sprite.clearTint());
        if (sentinel.hp <= 0) {
          setActorPose(sentinel.sprite, 'defeat');
          this.safeSetVelocity(sentinel.sprite, 0, 0);
          this.tweens.add({
            targets: [sentinel.sprite, sentinel.shadow],
            alpha: 0,
            scale: 0.2,
            duration: 260,
            onComplete: () => {
              sentinel.sprite.destroy();
              sentinel.shadow.destroy();
            },
          });
        }
      }
    });
    if (hitAny) this.updateDungeonHudCopy();
    if (hitAny) addImpactPause(this, variant === 2 ? 95 : 65, variant === 2 ? 0.12 : 0.18);
    if (this.sentinels.every((sentinel) => sentinel.hp <= 0)) this.completeDungeonObjective();
    this.time.delayedCall(variant === 2 ? 300 : 220, () => {
      this.canStrike = true;
      setActorPose(this.player, 'idle');
    });
  }

  private nearestSwingTarget(): { id: string; sentinel: Sentinel; distance: number } | undefined {
    return this.sentinels
      .map((sentinel, index) => ({
        id: `sentinel-${index + 1}`,
        sentinel,
        distance: Phaser.Math.Distance.Between(this.player.x, this.player.y, sentinel.sprite.x, sentinel.sprite.y),
      }))
      .filter((candidate) => candidate.sentinel.hp > 0 && candidate.distance < 230)
      .sort((a, b) => a.distance - b.distance)[0];
  }

  private handleBoundaryFeedback(result: ArenaClampResult): void {
    if (!result.clamped) return;
    publishBoundaryFeedback('dungeon', result);
    if (this.time.now - this.lastBoundaryFeedbackAt < 220) return;
    this.lastBoundaryFeedbackAt = this.time.now;
    addBoundaryBump(this, result.point.x, result.point.y, result.side, this.player.y + 18);
  }

  private useAbilityKey(): void {
    const save = loadSave();
    if (!save.abilityKeyUnlocked) return;
    const ability = getAbility(save.boundAbilityId);
    playCast(this);
    addAbilityCastBurst(this, this.player.x, this.player.y, ability.id, this.player.y + 120);
    const visualRadius = ability.id === 'try-catch' ? 278 : Math.max(ability.hitbox.width, ability.hitbox.height, 220);
    const pulse = addBossImpactVfx(this, ability.id === 'try-catch' ? 'palm' : 'ring', this.player.x, this.player.y + 4, {
      width: visualRadius,
      height: ability.id === 'try-catch' ? 154 : 128,
      depth: this.player.y + 26,
      alpha: 0.72,
      tint: ability.id === 'try-catch' ? 0x8f7dff : 0xf0c36b,
      sceneId: 'dungeon',
    }) ?? this.add.ellipse(this.player.x, this.player.y, visualRadius, ability.id === 'try-catch' ? 142 : 118, ability.id === 'try-catch' ? 0x8f7dff : 0xf0c36b, 0.2)
      .setStrokeStyle(4, ability.id === 'try-catch' ? 0xbda3ff : 0xf0c36b, 0.42)
      .setDepth(this.player.y + 26);
    this.tweens.add({ targets: pulse, alpha: 0, scale: 1.38, duration: 340, onComplete: () => pulse.destroy() });
    const livingTargets = this.sentinels.filter((sentinel) => sentinel.hp > 0);
    livingTargets.forEach((sentinel) => {
      const vowDamage = ability.id === 'try-catch' ? 20 : Math.max(14, ability.hitbox.damage);
      sentinel.hp = Math.max(0, sentinel.hp - vowDamage);
      setActorPose(sentinel.sprite, sentinel.hp <= 0 ? 'defeat' : 'stagger');
      sentinel.sprite.setTintFill(0x8f7dff);
      addHitSparks(this, sentinel.sprite.x, sentinel.sprite.y - 30, sentinel.sprite.y + 16);
      playHit(this);
      this.time.delayedCall(120, () => sentinel.sprite.clearTint());
      if (sentinel.hp <= 0) {
        this.safeSetVelocity(sentinel.sprite, 0, 0);
        this.tweens.add({
          targets: [sentinel.sprite, sentinel.shadow],
          alpha: 0, scale: 0.2, duration: 260,
          onComplete: () => { sentinel.sprite.destroy(); sentinel.shadow.destroy(); },
        });
      }
    });
    if (livingTargets.length > 0) this.updateDungeonHudCopy();
    if (livingTargets.length > 0) addImpactPause(this, 70, 0.16);
    if (this.sentinels.every((sentinel) => sentinel.hp <= 0)) this.completeDungeonObjective();
  }

  private handleTerminal(command: string): void {
    const parsed = parseTerminalCommand(command);
    if (parsed.command) {
      const ability = getAbility(parsed.command.abilityId);
      playCast(this);
      const icon = addAbilityCastBurst(this, this.player.x, this.player.y, ability.id, this.player.y + 120);
      (window as Window & {
        __CODEJITSU_LAST_ABILITY_CAST_ART?: {
          scene: string;
          abilityId: string;
          usesGeneratedIcon: boolean;
          usesGeneratedEffect: boolean;
          effectFrameCount: number;
          at: number;
        };
      }).__CODEJITSU_LAST_ABILITY_CAST_ART = {
        scene: 'dungeon',
        abilityId: ability.id,
        usesGeneratedIcon: Boolean(icon),
        usesGeneratedEffect: Boolean(icon?.getData('usesGeneratedEffect')),
        effectFrameCount: Number(icon?.getData('effectFrameCount') ?? 0),
        at: Math.round(performance.now()),
      };
      const visualRadius = ability.id === 'try-catch' ? 278 : Math.max(ability.hitbox.width, ability.hitbox.height, 220);
      const pulse = addBossImpactVfx(this, ability.id === 'try-catch' ? 'palm' : 'ring', this.player.x, this.player.y + 4, {
        width: visualRadius,
        height: ability.id === 'try-catch' ? 154 : 128,
        depth: this.player.y + 26,
        alpha: 0.72,
        tint: ability.id === 'try-catch' ? 0x8f7dff : 0xf0c36b,
        sceneId: 'dungeon',
      }) ?? this.add.ellipse(this.player.x, this.player.y, visualRadius, ability.id === 'try-catch' ? 142 : 118, ability.id === 'try-catch' ? 0x8f7dff : 0xf0c36b, 0.2)
        .setStrokeStyle(4, ability.id === 'try-catch' ? 0xbda3ff : 0xf0c36b, 0.42)
        .setDepth(this.player.y + 26);
      this.tweens.add({ targets: pulse, alpha: 0, scale: 1.38, duration: 340, onComplete: () => pulse.destroy() });
      const livingTargets = this.sentinels.filter((sentinel) => sentinel.hp > 0);
      let damaged = 0;
      livingTargets.forEach((sentinel, index) => {
        damaged += 1;
        const vowDamage = ability.id === 'try-catch' ? 20 : Math.max(14, ability.hitbox.damage);
        sentinel.hp = Math.max(0, sentinel.hp - vowDamage);
        setActorPose(sentinel.sprite, sentinel.hp <= 0 ? 'defeat' : 'stagger');
        sentinel.sprite.setTintFill(ability.id === 'try-catch' ? 0x8f7dff : 0xf6ead3);
        addHitSparks(this, sentinel.sprite.x, sentinel.sprite.y - 30, sentinel.sprite.y + 16);
        this.addVowThread(this.player.x, this.player.y - 28, sentinel.sprite.x, sentinel.sprite.y - 36, index, ability.id === 'try-catch' ? 0x8f7dff : 0xf0c36b);
        this.addCombatHitFeedback(sentinel.sprite.x, sentinel.sprite.y - 60, ability.id === 'try-catch' ? 'counter' : 'vow', ability.id);
        playHit(this);
        this.time.delayedCall(120, () => sentinel.sprite.clearTint());
        if (sentinel.hp <= 0) {
          this.safeSetVelocity(sentinel.sprite, 0, 0);
          this.tweens.add({
            targets: [sentinel.sprite, sentinel.shadow],
            alpha: 0,
            scale: 0.2,
            duration: 260,
            onComplete: () => {
              sentinel.sprite.destroy();
              sentinel.shadow.destroy();
            },
          });
        }
      });
      if (damaged > 0) this.updateDungeonHudCopy();
      if (damaged > 0) addImpactPause(this, 70, 0.16);
      if (this.sentinels.every((sentinel) => sentinel.hp <= 0)) this.completeDungeonObjective();
      (window as Window & {
        __CODEJITSU_LAST_ABILITY_DAMAGE?: {
          scene: string;
          abilityId: string;
          targets: number;
          damage: number;
          at: number;
        };
      }).__CODEJITSU_LAST_ABILITY_DAMAGE = {
        scene: 'dungeon',
        abilityId: ability.id,
        targets: damaged,
        damage: ability.id === 'try-catch' ? 20 : Math.max(14, ability.hitbox.damage),
        at: Math.round(performance.now()),
      };
    }
    this.updateDungeonHudCopy();
  }

  private addVowThread(fromX: number, fromY: number, toX: number, toY: number, index: number, color: number): void {
    if (this.textures.exists(TextureKeys.SeamVfx)) {
      const controlX = (fromX + toX) / 2;
      const controlY = Math.min(fromY, toY) - 48 - index * 10;
      const angle = Phaser.Math.Angle.Between(fromX, fromY, toX, toY);
      [0.28, 0.55, 0.82].forEach((t, sparkIndex) => {
        const x = ((1 - t) * (1 - t) * fromX) + (2 * (1 - t) * t * controlX) + (t * t * toX);
        const y = ((1 - t) * (1 - t) * fromY) + (2 * (1 - t) * t * controlY) + (t * t * toY);
        const effect = addSeamVfx(this, 'dungeon', sparkIndex === 1 ? 'trail' : 'spark', x, y, {
          width: sparkIndex === 1 ? 138 : 78,
          height: sparkIndex === 1 ? 74 : 58,
          depth: Math.max(fromY, toY) + 94 + sparkIndex,
          rotation: angle,
          alpha: sparkIndex === 1 ? 0.76 : 0.68,
          tint: color,
          lifespanMs: 260 + sparkIndex * 70,
        });
        if (effect) {
          this.tweens.add({
            targets: effect,
            x: effect.x + Math.cos(angle) * 18,
            y: effect.y + Math.sin(angle) * 10 - 8,
            alpha: 0,
            duration: 260 + sparkIndex * 70,
            ease: 'Quad.Out',
            onComplete: () => {
              if (effect.active) effect.destroy();
            },
          });
        }
      });
      return;
    }
    const line = this.add.graphics().setDepth(Math.max(fromY, toY) + 94).setAlpha(0);
    line.lineStyle(3, color, 0.74);
    line.beginPath();
    line.moveTo(fromX, fromY);
    const controlX = (fromX + toX) / 2;
    const controlY = Math.min(fromY, toY) - 48 - index * 10;
    for (let step = 1; step <= 8; step += 1) {
      const t = step / 8;
      const x = ((1 - t) * (1 - t) * fromX) + (2 * (1 - t) * t * controlX) + (t * t * toX);
      const y = ((1 - t) * (1 - t) * fromY) + (2 * (1 - t) * t * controlY) + (t * t * toY);
      line.lineTo(x, y);
    }
    line.strokePath();
    this.tweens.add({
      targets: line,
      alpha: { from: 0, to: 0.92 },
      duration: 90,
      yoyo: true,
      hold: 90,
      onComplete: () => line.destroy(),
    });
  }

  private addCombatHitFeedback(x: number, y: number, kind: CombatHitMarkKind, abilityId: string): void {
    addCombatHitMark(this, kind, x, y, {
      sceneId: 'dungeon',
      abilityId,
      width: kind === 'counter' ? 148 : 156,
      height: kind === 'counter' ? 112 : 96,
      depth: y + 142,
      tint: kind === 'counter' ? 0xbda3ff : 0xf0c36b,
      lifespanMs: 580,
    });
  }

  private completeDungeonObjective(): void {
    if (this.objectiveComplete) return;
    this.objectiveComplete = true;
    this.playerHp = Math.min(this.maxHp, this.playerHp + 8);
    (window as unknown as { __CODEJITSU_DUNGEON_GATE_OPEN?: boolean }).__CODEJITSU_DUNGEON_GATE_OPEN = true;
    this.updateDungeonHudCopy();
    this.publishDungeonHudVisual();
    this.setGateMarkerOpen(true, 0xf0c36b);
    this.tweens.add({
      targets: this.objectiveGroup.getChildren(),
      alpha: 0,
      y: '+=14',
      duration: 260,
      ease: 'Quad.In',
    });
    const gatePulseScaleX = (this.gateMarker?.scaleX ?? 1) * 1.07;
    const gatePulseScaleY = (this.gateMarker?.scaleY ?? 1) * 1.07;
    this.tweens.add({
      targets: this.gateMarker,
      alpha: { from: 0.62, to: 0.9 },
      scaleX: gatePulseScaleX,
      scaleY: gatePulseScaleY,
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    this.publishDungeonGateVisual(true);
    this.publishRouteProgress();
  }

  private advanceDungeonRoom(): void {
    this.setGateMarkerOpen(false);
    this.publishDungeonGateVisual(false);
    this.objectiveGroup.getChildren().forEach((child) => {
      const object = child as Phaser.GameObjects.GameObject & { setAlpha?: (value: number) => unknown; y?: number };
      object.setAlpha?.(1);
      if (typeof object.y === 'number') object.y -= 14;
    });
    this.player.setPosition(268, 486);
    this.currentVelocity.set(0, 0);
    this.safeSetVelocity(this.player, 0, 0);
    this.cameras.main.flash(420, 9, 7, 13);
    this.playDungeonSeamTransition();
    this.spawnDungeonRoom(this.dungeonRoomIndex + 1);
  }

  private playDungeonSeamTransition(): void {
    const pieces: Phaser.GameObjects.GameObject[] = [];
    const usesImagegenSeamTransition = this.textures.exists(TextureKeys.DungeonSeamTransition);
    if (usesImagegenSeamTransition) {
      const seam = this.add.image(640, 344, TextureKeys.DungeonSeamTransition)
        .setDisplaySize(1180, 300)
        .setDepth(1002)
        .setAlpha(0.86)
        .setBlendMode(Phaser.BlendModes.ADD);
      const echo = this.add.image(640, 344, TextureKeys.DungeonSeamTransition)
        .setDisplaySize(1280, 340)
        .setDepth(1001)
        .setAlpha(0.28)
        .setBlendMode(Phaser.BlendModes.ADD);
      pieces.push(seam, echo);
      this.tweens.add({
        targets: [seam, echo],
        alpha: 0,
        scaleX: '+=0.08',
        scaleY: '-=0.08',
        duration: 680,
        ease: 'Sine.Out',
        onComplete: () => pieces.forEach((piece) => piece.destroy()),
      });
    } else {
      const fallbackSeam = addSeamVfx(this, 'dungeon', 'burst', 640, 344, {
        width: 920,
        height: 260,
        depth: 1002,
        alpha: 0.74,
        lifespanMs: 680,
      });
      if (fallbackSeam) pieces.push(fallbackSeam);
    }
    (window as Window & {
      __CODEJITSU_DUNGEON_ROOM_TRANSITION_VISUAL?: {
        scene: string;
        usesImagegenSeamTransition: boolean;
        primitiveOverlayPieces: number;
        textOverlayCount: number;
        generatedTransitionPieces: number;
        textureKey: string;
        at: number;
      };
    }).__CODEJITSU_DUNGEON_ROOM_TRANSITION_VISUAL = {
      scene: 'dungeon',
      usesImagegenSeamTransition,
      primitiveOverlayPieces: 0,
      textOverlayCount: 0,
      generatedTransitionPieces: pieces.length,
      textureKey: usesImagegenSeamTransition ? TextureKeys.DungeonSeamTransition : TextureKeys.SeamVfx,
      at: Math.round(performance.now()),
    };
  }

  private safeSetVelocity(sprite: Phaser.Physics.Arcade.Sprite, x: number, y: number): void {
    guardedSetVelocity('dungeon', sprite, x, y);
  }

  private updateActorShadow(shadow: Phaser.GameObjects.Image, actor: Phaser.GameObjects.Sprite, offsetY: number): void {
    shadow.setPosition(actor.x, actor.y + offsetY);
    shadow.setDepth(actor.y - 8);
  }

  private updateSentinelGrounding(sentinel: Sentinel): void {
    updateGroundedActorVisual(
      this,
      sentinel.sprite,
      sentinel.shadow,
      24,
      {
        moving: sentinel.velocity.lengthSq() > 80,
        velocity: { x: sentinel.velocity.x, y: sentinel.velocity.y },
        runFactor: 1,
        strideIntensity: Phaser.Math.Clamp(sentinel.velocity.length() / 94, 0, 0.72),
        strideIntervalMs: 142,
        bodyLean: Phaser.Math.Clamp(sentinel.velocity.x / 520, -0.11, 0.11),
        shadowLead: { x: sentinel.velocity.x * 0.012, y: sentinel.velocity.y * 0.006 },
      },
      { width: 70, height: 28, alpha: 0.38 },
    );
  }

  private publishRouteProgress(): void {
    (window as Window & {
      __CODEJITSU_CHAPTER1_ROUTE_PROGRESS?: {
        currentArea: string;
        internalRoomLabel: string;
        roomIndex: number;
        totalRooms: number;
        routeStage: 'approach' | 'dungeon';
        approachSceneActive: boolean;
        gateOpen: boolean;
        mapProgressCopyVisible: boolean;
        at: number;
      };
    }).__CODEJITSU_CHAPTER1_ROUTE_PROGRESS = {
      currentArea: playerFacingDungeonArea,
      internalRoomLabel: this.dungeonRooms[this.dungeonRoomIndex]?.label ?? this.dungeonRooms[0].label,
      roomIndex: this.dungeonRoomIndex,
      totalRooms: this.dungeonRooms.length,
      routeStage: 'dungeon',
      approachSceneActive: false,
      gateOpen: this.objectiveComplete,
      mapProgressCopyVisible: false,
      at: Math.round(performance.now()),
    };
  }

  private publishChapterOnePlaytimeRuntime(): void {
    const audit = playableContentAudit();
    const spawnPointKeys = dungeonRoomSpawns.flatMap((room, roomIndex) =>
      room.map((spawn) => `${roomIndex}:${Math.round(spawn.x)}:${Math.round(spawn.y)}`),
    );
    const duplicateSpawnCount = spawnPointKeys.length - new Set(spawnPointKeys).size;
    const roomIds = this.dungeonRooms.map((room) => room.id);
    const auditRoomIds = audit.segments
      .filter((segment) => segment.chapter === 1 && segment.type === 'combat-room')
      .map((segment) => segment.id.replace(/^chapter1-/, ''));
    (window as Window & {
      __CODEJITSU_CHAPTER1_PLAYTIME_RUNTIME?: {
        scene: string;
        minimumPlayableSeconds: number;
        chapterOnePlayableSeconds: number;
        chapterOnePlayableMinutes: number;
        chapterOneMeetsMinimum: boolean;
        dialogueExcluded: boolean;
        actualRoomCount: number;
        auditRoomCount: number;
        roomIdsMatchAudit: boolean;
        actualEnemyCount: number;
        auditEnemyCount: number;
        duplicateSpawnCount: number;
        duplicateFreeSpawns: boolean;
        playerFacingArea: string;
        internalLabelsHidden: boolean;
        mapProgressCopyVisible: boolean;
        at: number;
      };
    }).__CODEJITSU_CHAPTER1_PLAYTIME_RUNTIME = {
      scene: 'dungeon',
      minimumPlayableSeconds: audit.minimumPlayableSeconds,
      chapterOnePlayableSeconds: audit.chapterOnePlayableSeconds,
      chapterOnePlayableMinutes: audit.chapterOnePlayableMinutes,
      chapterOneMeetsMinimum: audit.chapterOneMeetsMinimum,
      dialogueExcluded: audit.dialogueExcluded,
      actualRoomCount: this.dungeonRooms.length,
      auditRoomCount: audit.chapterOneCombatRoomCount,
      roomIdsMatchAudit: roomIds.join(',') === auditRoomIds.join(','),
      actualEnemyCount: dungeonRoomSpawns.reduce((total, room) => total + room.length, 0),
      auditEnemyCount: audit.chapterOneEnemyCount,
      duplicateSpawnCount,
      duplicateFreeSpawns: duplicateSpawnCount === 0,
      playerFacingArea: playerFacingDungeonArea,
      internalLabelsHidden: true,
      mapProgressCopyVisible: false,
      at: Math.round(performance.now()),
    };
  }

  private publishEnemyRuntime(): void {
    const payload: EnemyRuntimeState[] = this.sentinels.map((sentinel, index) => ({
      id: `sentinel-${index + 1}`,
      displayName: 'Binary Sentinel',
      speciesId: 'binary-sentinel',
      scene: 'dungeon',
      x: Math.round(sentinel.sprite.x * 10) / 10,
      y: Math.round(sentinel.sprite.y * 10) / 10,
      hp: sentinel.hp,
      pose: sentinel.sprite.getData('actorPose') as string | undefined,
      frameIndex: sentinel.sprite.getData('actorFrameIndex') as number | undefined,
      frameCount: sentinel.sprite.getData('actorFrameCount') as number | undefined,
      renderVariant: sentinel.sprite.getData('actorRenderVariant') as string | undefined,
      motionProfile: sentinel.sprite.getData('actorMotionProfile') as string | undefined,
      bodyAlive: Boolean(sentinel.sprite.body),
      visualScale: sentinel.sprite.getData('actorVisualScale') as number | undefined,
      visualStride: sentinel.sprite.getData('actorVisualStride') as number | undefined,
      visualGrounded: sentinel.sprite.getData('actorVisualGrounded') as boolean | undefined,
      usesImagegenCombatSheet: this.textures.exists(TextureKeys.BinarySentinelCombat),
      cleanIdentity: !/straw|sential|sentinal/i.test(
        [
          `sentinel-${index + 1}`,
          'Binary Sentinel',
          'binary-sentinel',
          sentinel.sprite.getData('actorRenderVariant') as string | undefined,
        ].filter(Boolean).join(' '),
      ),
      distanceToPlayer: Math.round(Phaser.Math.Distance.Between(this.player.x, this.player.y, sentinel.sprite.x, sentinel.sprite.y) * 10) / 10,
      noOverlap: Phaser.Math.Distance.Between(this.player.x, this.player.y, sentinel.sprite.x, sentinel.sprite.y) >= 92,
    }));
    (window as Window & { __CODEJITSU_ENEMY_BOUNDS?: EnemyRuntimeState[] }).__CODEJITSU_ENEMY_BOUNDS = payload;
  }

}
