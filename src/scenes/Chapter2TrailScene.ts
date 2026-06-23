import Phaser from 'phaser';
import { getAbility } from '../data/abilities';
import { playableContentAudit } from '../data/playtime';
import { loadSave, writeSave } from '../systems/saveSystem';
import { createGameKeys, type GameKeys } from '../systems/input';
import { apprenticeMovementTuning, readMovementInput, stepMovementVelocity } from '../systems/movementEngine';
import { parseTerminalCommand } from '../systems/terminalCommandEngine';
import { addActorSprite, setActorPose, type ActorPose } from './actors';
import { addAbilityCastBurst } from './abilityVisuals';
import { installAudioUnlock } from './audioUnlock';
import { addCombatHitMark, type CombatHitMarkKind } from './combatHitMarks';
import { addGeneratedTelegraphSigil, type TelegraphSigilKind } from './combatTelegraphs';
import { publishTextPanelAudit } from './layoutAudit';
import { PauseMenuOverlay, TerminalOverlay } from './overlays';
import { guardedSetVelocity, publishBoundaryFeedback, publishControlScheme, publishFrameHealth, publishPlayerBounds, publishSwordSwing } from './runtimeDebug';
import { SceneKeys, TextureKeys } from './sceneKeys';
import { addSeamVfx } from './seamVfx';
import { clampSpriteToArenaBounds, fadeInFromBlack, walkSpriteIntoGate, type ArenaClampResult } from './transition';
import { addArenaDepthCues, addBoundaryBump, addForegroundDepthOverlay, addHealthBar, addHitSparks, addImpactPause, addPanel, addRoomDepthBorders, addStepDust, addSwordSwing, makePixelText, playCast, playHit, playSlash, updateForegroundParallaxDepth, updateGroundedActorVisual } from './ui';

interface TrailEnemy {
  id: string;
  sprite: Phaser.Physics.Arcade.Sprite;
  shadow: Phaser.GameObjects.Image;
  hp: number;
  maxHp: number;
  warrior: WarriorKind;
  movementStyle: WarriorProfile['movementStyle'];
  velocity: Phaser.Math.Vector2;
  attackReadyAt: number;
  poseLockedUntil: number;
  tint: number;
  lastHp: number;
}

type WarriorKind = 'loop-wisp' | 'boolean-ronin' | 'array-archer' | 'stack-wraith' | 'return-guard';

interface TrailEnemySpawn {
  id: string;
  x: number;
  y: number;
  hp: number;
  tint: number;
  warrior: WarriorKind;
}

interface TrailSegment {
  id: string;
  name: string;
  vow: string;
  gateGlyph: string;
  goal: string;
  enemies: TrailEnemySpawn[];
}

interface WarriorProfile {
  cropIdle: Phaser.Geom.Rectangle;
  cropAttack: Phaser.Geom.Rectangle;
  width: number;
  height: number;
  bodyWidth: number;
  bodyHeight: number;
  speed: number;
  attackRange: number;
  attackDamage: number;
  attackShape: 'chain' | 'slash' | 'arrow' | 'wraith' | 'guard';
  movementStyle: 'orbit' | 'duelist' | 'kite' | 'ambush' | 'shield';
  preferredRange: number;
  cooldownMs: number;
  label: string;
}

type TrailAttackMarker = Phaser.GameObjects.Image | Phaser.GameObjects.Shape;

interface TrailAttackMarkerSpec {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  depth: number;
  kind: TelegraphSigilKind;
  damageRadius: number;
}

const warriorProfiles: Record<WarriorKind, WarriorProfile> = {
  'loop-wisp': {
    cropIdle: new Phaser.Geom.Rectangle(18, 48, 320, 342),
    cropAttack: new Phaser.Geom.Rectangle(0, 442, 360, 340),
    width: 188,
    height: 202,
    bodyWidth: 82,
    bodyHeight: 66,
    speed: 108,
    attackRange: 176,
    attackDamage: 10,
    attackShape: 'chain',
    movementStyle: 'orbit',
    preferredRange: 160,
    cooldownMs: 1000,
    label: 'loop.wisp',
  },
  'boolean-ronin': {
    cropIdle: new Phaser.Geom.Rectangle(404, 62, 304, 344),
    cropAttack: new Phaser.Geom.Rectangle(374, 450, 354, 342),
    width: 176,
    height: 206,
    bodyWidth: 82,
    bodyHeight: 70,
    speed: 126,
    attackRange: 156,
    attackDamage: 12,
    attackShape: 'slash',
    movementStyle: 'duelist',
    preferredRange: 132,
    cooldownMs: 1080,
    label: 'if.ronin',
  },
  'array-archer': {
    cropIdle: new Phaser.Geom.Rectangle(746, 58, 350, 342),
    cropAttack: new Phaser.Geom.Rectangle(740, 452, 366, 340),
    width: 210,
    height: 198,
    bodyWidth: 88,
    bodyHeight: 68,
    speed: 98,
    attackRange: 292,
    attackDamage: 11,
    attackShape: 'arrow',
    movementStyle: 'kite',
    preferredRange: 250,
    cooldownMs: 940,
    label: 'array.archer',
  },
  'stack-wraith': {
    cropIdle: new Phaser.Geom.Rectangle(1118, 4, 336, 420),
    cropAttack: new Phaser.Geom.Rectangle(1094, 422, 390, 392),
    width: 206,
    height: 274,
    bodyWidth: 84,
    bodyHeight: 78,
    speed: 88,
    attackRange: 238,
    attackDamage: 14,
    attackShape: 'wraith',
    movementStyle: 'ambush',
    preferredRange: 196,
    cooldownMs: 1280,
    label: 'stack.wraith',
  },
  'return-guard': {
    cropIdle: new Phaser.Geom.Rectangle(1430, 22, 332, 400),
    cropAttack: new Phaser.Geom.Rectangle(1372, 436, 398, 356),
    width: 198,
    height: 254,
    bodyWidth: 90,
    bodyHeight: 76,
    speed: 94,
    attackRange: 176,
    attackDamage: 14,
    attackShape: 'guard',
    movementStyle: 'shield',
    preferredRange: 148,
    cooldownMs: 1120,
    label: 'return.guard',
  },
};

const chapterTwoMinionHp = 1200;
const chapterTwoPlayerMaxHp = 70;

const trailSegments: TrailSegment[] = [
  {
    id: 'gate-loop',
    name: 'Gate Loop',
    vow: 'while(keiko.missing)',
    gateGlyph: 'gate.loop',
    goal: 'Circle the chain wisp, then punish the ronin dash.',
    enemies: [
      { id: 'loop-wisp-a', x: 610, y: 392, hp: chapterTwoMinionHp, tint: 0x90d2b7, warrior: 'loop-wisp' },
      { id: 'echo-ronin', x: 766, y: 492, hp: chapterTwoMinionHp + 20, tint: 0xf0c36b, warrior: 'boolean-ronin' },
      { id: 'bracket-archer', x: 930, y: 406, hp: chapterTwoMinionHp, tint: 0x8f7dff, warrior: 'array-archer' },
    ],
  },
  {
    id: 'boolean-switchback',
    name: 'Boolean Switchback',
    vow: 'if(grief) catch()',
    gateGlyph: 'if.open',
    goal: 'Bait the branch ronin while the archer keeps distance.',
    enemies: [
      { id: 'false-branch-a', x: 560, y: 358, hp: chapterTwoMinionHp + 20, tint: 0x8f7dff, warrior: 'boolean-ronin' },
      { id: 'true-branch-b', x: 700, y: 494, hp: chapterTwoMinionHp + 40, tint: 0x90d2b7, warrior: 'boolean-ronin' },
      { id: 'gate-archer-c', x: 882, y: 426, hp: chapterTwoMinionHp + 40, tint: 0xf0c36b, warrior: 'array-archer' },
    ],
  },
  {
    id: 'array-shrine',
    name: 'Array Shrine',
    vow: 'array.names.restore',
    gateGlyph: 'array[3]',
    goal: 'Pressure the archers before the split lanes stack up.',
    enemies: [
      { id: 'array-echo-left', x: 524, y: 432, hp: chapterTwoMinionHp + 40, tint: 0x90d2b7, warrior: 'array-archer' },
      { id: 'array-echo-mid', x: 688, y: 356, hp: chapterTwoMinionHp + 60, tint: 0xb85dff, warrior: 'array-archer' },
      { id: 'array-echo-right', x: 824, y: 496, hp: chapterTwoMinionHp + 60, tint: 0x8f7dff, warrior: 'boolean-ronin' },
      { id: 'array-echo-gate', x: 964, y: 374, hp: chapterTwoMinionHp + 40, tint: 0xf0c36b, warrior: 'loop-wisp' },
    ],
  },
  {
    id: 'runtime-ravine',
    name: 'Runtime Ravine',
    vow: 'stack.push(courage)',
    gateGlyph: 'stack++',
    goal: 'Interrupt the wraith ambushes and keep moving.',
    enemies: [
      { id: 'stack-wisp-a', x: 520, y: 354, hp: chapterTwoMinionHp + 80, tint: 0xf0c36b, warrior: 'stack-wraith' },
      { id: 'stack-wisp-b', x: 650, y: 486, hp: chapterTwoMinionHp + 60, tint: 0x90d2b7, warrior: 'loop-wisp' },
      { id: 'stack-sentinel-c', x: 820, y: 414, hp: chapterTwoMinionHp + 100, tint: 0xb85dff, warrior: 'stack-wraith' },
      { id: 'stack-wisp-d', x: 980, y: 500, hp: chapterTwoMinionHp + 80, tint: 0x8f7dff, warrior: 'array-archer' },
    ],
  },
  {
    id: 'return-threshold',
    name: 'Return Threshold',
    vow: 'return.vow',
    gateGlyph: 'return()',
    goal: 'Crack the shield guard and survive the return volley.',
    enemies: [
      { id: 'return-echo-a', x: 496, y: 406, hp: chapterTwoMinionHp + 100, tint: 0xb85dff, warrior: 'return-guard' },
      { id: 'return-echo-b', x: 630, y: 336, hp: chapterTwoMinionHp + 120, tint: 0x90d2b7, warrior: 'stack-wraith' },
      { id: 'return-echo-c', x: 756, y: 502, hp: chapterTwoMinionHp + 140, tint: 0xf0c36b, warrior: 'return-guard' },
      { id: 'return-echo-d', x: 910, y: 392, hp: chapterTwoMinionHp + 100, tint: 0x8f7dff, warrior: 'array-archer' },
      { id: 'return-echo-e', x: 1010, y: 496, hp: chapterTwoMinionHp + 80, tint: 0xb85dff, warrior: 'loop-wisp' },
    ],
  },
  {
    id: 'recursive-bridge',
    name: 'Recursive Bridge',
    vow: 'recurse.until.clear',
    gateGlyph: 'recurse()',
    goal: 'Break the repeat chain while orbiters force constant movement.',
    enemies: [
      { id: 'recursive-wisp-a', x: 518, y: 366, hp: chapterTwoMinionHp + 80, tint: 0x90d2b7, warrior: 'loop-wisp' },
      { id: 'recursive-ronin-b', x: 670, y: 482, hp: chapterTwoMinionHp + 120, tint: 0xf0c36b, warrior: 'boolean-ronin' },
      { id: 'recursive-guard-c', x: 838, y: 408, hp: chapterTwoMinionHp + 140, tint: 0xb85dff, warrior: 'return-guard' },
      { id: 'recursive-archer-d', x: 1002, y: 492, hp: chapterTwoMinionHp + 100, tint: 0x8f7dff, warrior: 'array-archer' },
    ],
  },
  {
    id: 'stack-overpass',
    name: 'Stack Overpass',
    vow: 'stack.depth.hold',
    gateGlyph: 'stack.lock',
    goal: 'Hold the center while wraiths and archers stack pressure.',
    enemies: [
      { id: 'overpass-wraith-a', x: 500, y: 410, hp: chapterTwoMinionHp + 140, tint: 0xb85dff, warrior: 'stack-wraith' },
      { id: 'overpass-archer-b', x: 664, y: 342, hp: chapterTwoMinionHp + 100, tint: 0x8f7dff, warrior: 'array-archer' },
      { id: 'overpass-wraith-c', x: 832, y: 488, hp: chapterTwoMinionHp + 160, tint: 0xf0c36b, warrior: 'stack-wraith' },
      { id: 'overpass-wisp-d', x: 980, y: 384, hp: chapterTwoMinionHp + 100, tint: 0x90d2b7, warrior: 'loop-wisp' },
      { id: 'overpass-guard-e', x: 1080, y: 500, hp: chapterTwoMinionHp + 140, tint: 0xb85dff, warrior: 'return-guard' },
    ],
  },
  {
    id: 'branch-lock',
    name: 'Branch Lock',
    vow: 'if(loop) break',
    gateGlyph: 'if.break',
    goal: 'The ronin twins lock branches while guards body-block the gate.',
    enemies: [
      { id: 'branch-ronin-a', x: 510, y: 356, hp: chapterTwoMinionHp + 120, tint: 0x8f7dff, warrior: 'boolean-ronin' },
      { id: 'branch-ronin-b', x: 650, y: 496, hp: chapterTwoMinionHp + 120, tint: 0x90d2b7, warrior: 'boolean-ronin' },
      { id: 'branch-guard-c', x: 796, y: 420, hp: chapterTwoMinionHp + 160, tint: 0xf0c36b, warrior: 'return-guard' },
      { id: 'branch-archer-d', x: 948, y: 344, hp: chapterTwoMinionHp + 120, tint: 0xb85dff, warrior: 'array-archer' },
      { id: 'branch-wisp-e', x: 1052, y: 484, hp: chapterTwoMinionHp + 100, tint: 0x90d2b7, warrior: 'loop-wisp' },
    ],
  },
  {
    id: 'loop-citadel',
    name: 'Loop Citadel',
    vow: 'loop.citadel.shatter',
    gateGlyph: 'loop.10',
    goal: 'Cut through a full citadel wave without letting the archers kite forever.',
    enemies: [
      { id: 'citadel-wisp-a', x: 468, y: 386, hp: chapterTwoMinionHp + 120, tint: 0x90d2b7, warrior: 'loop-wisp' },
      { id: 'citadel-archer-b', x: 604, y: 482, hp: chapterTwoMinionHp + 140, tint: 0x8f7dff, warrior: 'array-archer' },
      { id: 'citadel-ronin-c', x: 742, y: 350, hp: chapterTwoMinionHp + 150, tint: 0xf0c36b, warrior: 'boolean-ronin' },
      { id: 'citadel-wraith-d', x: 890, y: 454, hp: chapterTwoMinionHp + 170, tint: 0xb85dff, warrior: 'stack-wraith' },
      { id: 'citadel-guard-e', x: 1038, y: 370, hp: chapterTwoMinionHp + 160, tint: 0xf0c36b, warrior: 'return-guard' },
    ],
  },
  {
    id: 'return-keep',
    name: 'Return Keep',
    vow: 'return.final.break',
    gateGlyph: 'return.keep',
    goal: 'Survive the last minion wall before the Return Oni.',
    enemies: [
      { id: 'keep-guard-a', x: 486, y: 404, hp: chapterTwoMinionHp + 180, tint: 0xf0c36b, warrior: 'return-guard' },
      { id: 'keep-wraith-b', x: 630, y: 342, hp: chapterTwoMinionHp + 180, tint: 0xb85dff, warrior: 'stack-wraith' },
      { id: 'keep-archer-c', x: 780, y: 498, hp: chapterTwoMinionHp + 150, tint: 0x8f7dff, warrior: 'array-archer' },
      { id: 'keep-ronin-d', x: 928, y: 382, hp: chapterTwoMinionHp + 160, tint: 0x90d2b7, warrior: 'boolean-ronin' },
      { id: 'keep-wisp-e', x: 1064, y: 482, hp: chapterTwoMinionHp + 140, tint: 0x90d2b7, warrior: 'loop-wisp' },
    ],
  },
];

export class Chapter2TrailScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerShadow!: Phaser.GameObjects.Image;
  private playerBar!: ReturnType<typeof addHealthBar>;
  private keys!: GameKeys;
  private enemies: TrailEnemy[] = [];
  private statusText!: Phaser.GameObjects.Text;
  private hudTitle!: Phaser.GameObjects.Text;
  private trailCueIcon?: Phaser.GameObjects.Image;
  private trailCueFrameWidth = 0;
  private trailCueFrameHeight = 0;
  private trailCueState: 'echoes' | 'seam' | 'return' = 'echoes';
  private trailHudUsesImagegenPanel = false;
  private trailHudPrimitivePanelPieces = 0;
  private stageBackdrop?: Phaser.GameObjects.Image;
  private terminal!: TerminalOverlay;
  private pauseMenu!: PauseMenuOverlay;
  private foregroundOverlay?: Phaser.GameObjects.Image;
  private canStrike = true;
  private playerHp = chapterTwoPlayerMaxHp;
  private currentVelocity = new Phaser.Math.Vector2(0, 0);
  private lastMoveDirection = new Phaser.Math.Vector2(1, 0);
  private moveHeldMs = 0;
  private lastStepDustAt = 0;
  private lastBoundaryFeedbackAt = 0;
  private poseLockedUntil = 0;
  private lockedPlayerPose: ActorPose = 'idle';
  private transitioning = false;
  private interludeCount = 0;
  private portalGlow?: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse;
  private generatedPortalPieces = 0;
  private primitivePortalPieces = 0;
  private trailAtmosphereUsesImagegen = false;
  private trailPrimitiveBackdropShadePieces = 0;
  private trailSegmentIndex = 0;
  private initialSegmentIndex = 0;
  private lastSwordDamage = { targets: 0, beforeTotalHp: 0, afterTotalHp: 0, damage: 0, at: 0 };
  private lastTerminalDamage = { abilityId: '', targets: 0, beforeTotalHp: 0, afterTotalHp: 0, damage: 0, at: 0 };
  private readonly walkableBounds = new Phaser.Geom.Rectangle(176, 220, 930, 390);
  private readonly portalPoint = new Phaser.Math.Vector2(930, 292);

  constructor() {
    super(SceneKeys.Chapter2Trail);
  }

  init(data?: { segmentIndex?: number }): void {
    this.initialSegmentIndex = Phaser.Math.Clamp(Number(data?.segmentIndex ?? 0), 0, trailSegments.length - 1);
  }

  create(): void {
    (window as unknown as { __CODEJITSU_SCENE?: string }).__CODEJITSU_SCENE = 'chapter2-trail';
    publishControlScheme('chapter2-trail');
    installAudioUnlock(this);
    writeSave({ ...loadSave(), currentCheckpoint: 'chapter2-trail' });
    this.keys = createGameKeys(this);
    this.cameras.main.setBackgroundColor('#09070d');
    this.drawTrail();
    addRoomDepthBorders(this, this.walkableBounds, { sceneId: 'chapter2-trail', frontDepth: 860, accentColor: 0x90d2b7 });
    addArenaDepthCues(this, this.walkableBounds, { sceneId: 'chapter2-trail', accentColor: 0x90d2b7, foregroundDepth: 862 });
    this.foregroundOverlay = addForegroundDepthOverlay(this, 865, 0.2);
    this.foregroundOverlay?.setData('chapter2BoundedOverlay', true);
    this.foregroundOverlay?.setData('foregroundBaseScaleX', this.foregroundOverlay.scaleX);
    this.foregroundOverlay?.setData('foregroundBaseScaleY', this.foregroundOverlay.scaleY);
    fadeInFromBlack(this);

    this.player = addActorSprite(this, 'hero', 300, 506, TextureKeys.Hero, 1.42).setCollideWorldBounds(true).setDrag(1500);
    this.player.body?.setSize(28, 24).setOffset(18, 62);
    this.playerShadow = this.add.image(this.player.x, this.player.y + 29, TextureKeys.Shadow).setDisplaySize(82, 34).setAlpha(0.43).setDepth(this.player.y - 8);
    this.playerBar = addHealthBar(this, 34, 52, 260, 20, 'Apprentice');
    this.createHud();
    this.spawnTrailSegment(this.initialSegmentIndex);
    this.terminal = new TerminalOverlay(this, (command) => this.handleTerminal(command));
    this.pauseMenu = new PauseMenuOverlay(this, () => this.scene.start(SceneKeys.Title));
    this.bindInput();
  }

  update(time: number, delta: number): void {
    publishFrameHealth('chapter2-trail', delta);
    if (this.pauseMenu.isOpen || this.terminal.isOpen || this.transitioning) {
      this.safeSetVelocity(this.player, 0, 0);
      this.enemies.forEach((enemy) => this.safeSetVelocity(enemy.sprite, 0, 0));
      return;
    }
    this.handleMovement(delta);
    this.handleBoundaryFeedback(clampSpriteToArenaBounds(this.player, this.walkableBounds));
    publishPlayerBounds('chapter2-trail', this.player, this.walkableBounds, 0.48);
    this.updateActorShadow(this.playerShadow, this.player, 29);
    this.enemies.forEach((enemy) => this.updateEnemy(enemy, time, delta));
    this.separateCombatants();
    this.separateEnemies();
    this.player.setDepth(this.player.y);
    this.playerBar.setValue(this.playerHp, chapterTwoPlayerMaxHp);
    this.updateObjectiveText();
    this.publishTrailHudLayout();
    this.publishRuntimeEnemies();
  }

  private drawTrail(): void {
    const segment = trailSegments[this.initialSegmentIndex] ?? trailSegments[0];
    this.stageBackdrop = this.add.image(640, 360, this.textureForSegment(segment))
      .setDisplaySize(1280, 720)
      .setAlpha(0.98)
      .setDepth(-40);
    this.addTrailAtmosphereOverlay();
    const usesGeneratedPortal = this.textures.exists(TextureKeys.GatePortal);
    this.generatedPortalPieces = 0;
    this.primitivePortalPieces = 0;
    if (usesGeneratedPortal) {
      this.portalGlow = this.add.image(this.portalPoint.x, this.portalPoint.y + 54, TextureKeys.GatePortal)
        .setDisplaySize(136, 112)
        .setAlpha(0.48)
        .setDepth(this.portalPoint.y - 12)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.portalGlow.setData('usesImagegenGate', true);
      this.generatedPortalPieces += 1;
      const seamPieces = [
        addSeamVfx(this, 'chapter2-trail', 'seal', this.portalPoint.x, this.portalPoint.y + 58, {
          width: 204,
          height: 92,
          depth: this.portalPoint.y - 10,
          alpha: 0.24,
          tint: 0x90d2b7,
        }),
        addSeamVfx(this, 'chapter2-trail', 'motes', this.portalPoint.x - 42, this.portalPoint.y + 34, {
          width: 72,
          height: 64,
          depth: this.portalPoint.y - 8,
          alpha: 0.28,
          tint: 0xf0c36b,
        }),
        addSeamVfx(this, 'chapter2-trail', 'wisp', this.portalPoint.x + 48, this.portalPoint.y + 40, {
          width: 76,
          height: 66,
          depth: this.portalPoint.y - 7,
          alpha: 0.26,
          tint: 0x8f7dff,
        }),
      ];
      this.generatedPortalPieces += seamPieces.filter(Boolean).length;
      seamPieces.filter(Boolean).forEach((piece, index) => {
        this.tweens.add({
          targets: piece,
          alpha: { from: piece?.alpha ?? 0.42, to: 0.18 },
          scaleX: (piece?.scaleX ?? 1) * (index === 0 ? 1.08 : 1.14),
          scaleY: (piece?.scaleY ?? 1) * (index === 0 ? 1.04 : 1.12),
          duration: 980 + index * 90,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.InOut',
        });
      });
    } else {
      this.primitivePortalPieces = 1;
      this.portalGlow = this.add.ellipse(this.portalPoint.x, this.portalPoint.y + 64, 124, 32, 0xb85dff, 0.08).setDepth(this.portalPoint.y - 12);
    }
    const portalBaseScaleX = this.portalGlow.scaleX;
    const portalBaseScaleY = this.portalGlow.scaleY;
    this.tweens.add({
      targets: this.portalGlow,
      alpha: { from: usesGeneratedPortal ? 0.42 : 0.08, to: usesGeneratedPortal ? 0.6 : 0.2 },
      scaleX: { from: portalBaseScaleX * 0.94, to: portalBaseScaleX * 1.035 },
      scaleY: { from: portalBaseScaleY * 0.9, to: portalBaseScaleY * 0.98 },
      duration: 840,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  private addTrailAtmosphereOverlay(): void {
    if (this.textures.exists(TextureKeys.Chapter2TrailAtmosphereOverlay)) {
      const source = this.textures.get(TextureKeys.Chapter2TrailAtmosphereOverlay).getSourceImage() as { width?: number; height?: number };
      const scale = Math.max(1280 / Number(source.width ?? 1280), 720 / Number(source.height ?? 720));
      this.add.image(640, 360, TextureKeys.Chapter2TrailAtmosphereOverlay)
        .setScale(scale)
        .setAlpha(0.3)
        .setDepth(-30)
        .setData('usesImagegenTrailAtmosphere', true);
      this.trailAtmosphereUsesImagegen = true;
      this.trailPrimitiveBackdropShadePieces = 0;
      return;
    }

    this.add.rectangle(640, 360, 1280, 720, 0x09070d, 0.1).setDepth(-30);
    this.trailAtmosphereUsesImagegen = false;
    this.trailPrimitiveBackdropShadePieces = 1;
  }

  private createHud(): void {
    this.trailHudUsesImagegenPanel = this.textures.exists(TextureKeys.Chapter2TrailHudPanel);
    this.trailHudPrimitivePanelPieces = this.trailHudUsesImagegenPanel ? 0 : 1;
    if (this.trailHudUsesImagegenPanel) {
      this.add.image(284, 644, TextureKeys.Chapter2TrailHudPanel)
        .setDisplaySize(548, 110)
        .setDepth(1000)
        .setAlpha(0.92)
        .setData('usesImagegenPanel', true);
    } else {
      addPanel(this, 34, 604, 500, 82, 0.7).setDepth(1000);
    }
    this.trailCueIcon = this.createTrailCueIcon();
    this.hudTitle = makePixelText(this, 156, 622, '', 13, '#90d2b7')
      .setDepth(1001)
      .setAlpha(0.96)
      .setWordWrapWidth(330);
    this.statusText = makePixelText(this, 156, 649, '', 12, '#f6ead3')
      .setDepth(1001)
      .setAlpha(0.94)
      .setWordWrapWidth(350)
      .setLineSpacing(2);
    this.setTrailCueState('echoes');
    this.publishTrailHudLayout();
  }

  private createTrailCueIcon(): Phaser.GameObjects.Image | undefined {
    if (!this.textures.exists(TextureKeys.Chapter2TrailStatusCue)) return undefined;
    const source = this.textures.get(TextureKeys.Chapter2TrailStatusCue).getSourceImage() as { width?: number; height?: number };
    this.trailCueFrameWidth = Math.floor(Number(source.width ?? 2172) / 3);
    this.trailCueFrameHeight = Number(source.height ?? 724);
    const icon = this.add.image(100, 644, TextureKeys.Chapter2TrailStatusCue, this.ensureTrailCueFrame(0))
      .setDisplaySize(82, 82)
      .setDepth(1001)
      .setAlpha(0.96)
      .setData('usesImagegenTrailCue', true)
      .setData('trailCueFrameIndex', 0);
    this.tweens.add({
      targets: icon,
      alpha: { from: 0.84, to: 1 },
      scaleX: icon.scaleX * 1.035,
      scaleY: icon.scaleY * 1.035,
      duration: 780,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    return icon;
  }

  private ensureTrailCueFrame(frameIndex: number): string {
    const texture = this.textures.get(TextureKeys.Chapter2TrailStatusCue) as Phaser.Textures.Texture & {
      has?: (name: string) => boolean;
    };
    const safeFrame = Phaser.Math.Clamp(frameIndex, 0, 2);
    const frameKey = `chapter2-trail-cue-${safeFrame}`;
    if (!texture.has?.(frameKey)) {
      texture.add(frameKey, 0, safeFrame * this.trailCueFrameWidth, 0, this.trailCueFrameWidth, this.trailCueFrameHeight);
    }
    return frameKey;
  }

  private ensureStageInterludeCueFrame(frameIndex: number): string {
    const source = this.textures.get(TextureKeys.Chapter2StageInterludeCue).getSourceImage() as { width?: number; height?: number };
    const frameWidth = Math.floor(Number(source.width ?? 1774) / 2);
    const frameHeight = Number(source.height ?? 887);
    const texture = this.textures.get(TextureKeys.Chapter2StageInterludeCue) as Phaser.Textures.Texture & {
      has?: (name: string) => boolean;
    };
    const safeFrame = Phaser.Math.Clamp(frameIndex, 0, 1);
    const frameKey = `chapter2-stage-interlude-cue-${safeFrame}`;
    if (!texture.has?.(frameKey)) {
      texture.add(frameKey, 0, safeFrame * frameWidth, 0, frameWidth, frameHeight);
    }
    return frameKey;
  }

  private setTrailCueState(state: 'echoes' | 'seam' | 'return'): void {
    this.trailCueState = state;
    const frameIndex = state === 'echoes' ? 0 : state === 'seam' ? 1 : 2;
    this.trailCueIcon
      ?.setTexture(TextureKeys.Chapter2TrailStatusCue, this.ensureTrailCueFrame(frameIndex))
      .setDisplaySize(state === 'echoes' ? 82 : 88, state === 'echoes' ? 82 : 88)
      .setData('trailCueFrameIndex', frameIndex);
    const segment = this.currentSegment();
    const remaining = this.enemies.filter((enemy) => enemy.hp > 0).length;
    const title = state === 'return'
      ? 'Return gate open'
      : state === 'seam'
        ? 'Seam restored'
        : `${segment.name} ${this.trailSegmentIndex + 1}/${trailSegments.length}`;
    const status = state === 'return'
      ? 'Enter the gate to face the Return Oni.'
      : state === 'seam'
        ? 'Move to the gate and press Enter.'
        : `${segment.goal} ${remaining} echo${remaining === 1 ? '' : 'es'} remain.`;
    this.hudTitle?.setText(title);
    this.statusText?.setText(status);
    this.publishTrailHudLayout();
  }

  private publishTrailHudLayout(): void {
    if (!this.hudTitle || !this.statusText) return;
    publishTextPanelAudit('chapter2-trail-hud', new Phaser.Geom.Rectangle(34, 604, 548, 110), [
      { id: 'title', object: this.hudTitle },
      { id: 'status', object: this.statusText },
    ], 12);
    const audit = (window as Window & {
      __CODEJITSU_LAYOUT_AUDITS?: Record<string, { noOverflow: boolean; noOverlap: boolean }>;
    }).__CODEJITSU_LAYOUT_AUDITS?.['chapter2-trail-hud'];
    (window as Window & {
      __CODEJITSU_CHAPTER2_TRAIL_HUD_VISUAL?: {
        usesImagegenPanel: boolean;
        primitivePanelPieces: number;
        textureKey: string;
        panelWidth: number;
        panelHeight: number;
        compactCopy: boolean;
        noOverlap: boolean;
        fitsPanel: boolean;
        usesImagegenTrailCue: boolean;
        primitiveCuePieces: number;
        trailCueFrameIndex: number;
        textOverlayCount: number;
        objectiveCopy: string;
        at: number;
      };
    }).__CODEJITSU_CHAPTER2_TRAIL_HUD_VISUAL = {
      usesImagegenPanel: this.trailHudUsesImagegenPanel,
      primitivePanelPieces: this.trailHudPrimitivePanelPieces,
      textureKey: this.trailHudUsesImagegenPanel ? TextureKeys.Chapter2TrailHudPanel : 'fallback-panel',
      panelWidth: 548,
      panelHeight: 110,
      compactCopy: true,
      noOverlap: audit?.noOverlap === true,
      fitsPanel: audit?.noOverflow === true,
      usesImagegenTrailCue: Boolean(this.trailCueIcon?.getData('usesImagegenTrailCue')),
      primitiveCuePieces: this.trailCueIcon?.getData('usesImagegenTrailCue') ? 0 : 1,
      trailCueFrameIndex: Number(this.trailCueIcon?.getData('trailCueFrameIndex') ?? -1),
      textOverlayCount: [this.hudTitle.text, this.statusText.text].filter((text) => text.trim().length > 0).length,
      objectiveCopy: `${this.hudTitle.text} ${this.statusText.text}`.trim(),
      at: Math.round(performance.now()),
    };
  }

  private currentSegment(): TrailSegment {
    return trailSegments[this.trailSegmentIndex] ?? trailSegments[0];
  }

  private spawnTrailSegment(index: number): void {
    this.trailSegmentIndex = Phaser.Math.Clamp(index, 0, trailSegments.length - 1);
    this.enemies.forEach((enemy) => {
      if (enemy.sprite.active) enemy.sprite.destroy();
      if (enemy.shadow.active) enemy.shadow.destroy();
    });
    this.enemies = [];
    const segment = this.currentSegment();
    this.setStageBackdrop(segment);
    segment.enemies.forEach((enemy) => this.createEnemy(enemy));
    this.setTrailCueState('echoes');
    this.publishRuntimeEnemies();
  }

  private textureForSegment(segment: TrailSegment): string {
    const textureById: Record<string, string> = {
      'gate-loop': TextureKeys.Chapter2StageGateLoop,
      'boolean-switchback': TextureKeys.Chapter2StageBooleanSwitchback,
      'array-shrine': TextureKeys.Chapter2StageArrayShrine,
      'runtime-ravine': TextureKeys.Chapter2StageRuntimeRavine,
      'return-threshold': TextureKeys.Chapter2StageReturnThreshold,
      'recursive-bridge': TextureKeys.Chapter2StageGateLoop,
      'stack-overpass': TextureKeys.Chapter2StageRuntimeRavine,
      'branch-lock': TextureKeys.Chapter2StageBooleanSwitchback,
      'loop-citadel': TextureKeys.Chapter2StageArrayShrine,
      'return-keep': TextureKeys.Chapter2StageReturnThreshold,
    };
    const textureKey = textureById[segment.id] ?? TextureKeys.Chapter2OutdoorTrail;
    if (this.textures.exists(textureKey)) return textureKey;
    return this.textures.exists(TextureKeys.Chapter2OutdoorTrail) ? TextureKeys.Chapter2OutdoorTrail : TextureKeys.ArenaKeyArt;
  }

  private setStageBackdrop(segment: TrailSegment): void {
    const textureKey = this.textureForSegment(segment);
    if (!this.stageBackdrop) {
      this.stageBackdrop = this.add.image(640, 360, textureKey).setDisplaySize(1280, 720).setDepth(-40);
      return;
    }
    if (this.stageBackdrop.texture.key === textureKey) return;
    this.stageBackdrop.setTexture(textureKey).setDisplaySize(1280, 720).setAlpha(0.92);
    this.tweens.add({
      targets: this.stageBackdrop,
      alpha: { from: 0.72, to: 0.98 },
      duration: 260,
      ease: 'Sine.Out',
    });
  }

  private createEnemy(spawn: TrailEnemySpawn): void {
    const profile = warriorProfiles[spawn.warrior];
    const warriorTexture = this.warriorTextureKey();
    const sprite = warriorTexture
      ? this.physics.add.sprite(spawn.x, spawn.y, warriorTexture)
      : addActorSprite(this, 'sentinel', spawn.x, spawn.y, TextureKeys.NullOni, 0.92);
    sprite.setOrigin(0.5, 0.78).setCollideWorldBounds(true).setDrag(1200).setTint(spawn.tint);
    if (warriorTexture) {
      this.applyWarriorPose(sprite, spawn.warrior, 'idle');
    }
    this.configureWarriorBody(sprite, profile);
    const shadow = this.add.image(spawn.x, spawn.y + 29, TextureKeys.Shadow).setDisplaySize(profile.width * 0.78, 34).setAlpha(0.4).setDepth(spawn.y - 8);
    this.enemies.push({
      id: spawn.id,
      sprite,
      shadow,
      hp: spawn.hp,
      maxHp: spawn.hp,
      warrior: spawn.warrior,
      movementStyle: profile.movementStyle,
      velocity: new Phaser.Math.Vector2(0, 0),
      attackReadyAt: this.time.now + Phaser.Math.Between(520, 900),
      poseLockedUntil: 0,
      tint: spawn.tint,
      lastHp: spawn.hp,
    });
  }

  private bindInput(): void {
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (this.terminal.handleKey(event)) return;
      if (this.pauseMenu.handleKey(event)) return;
      if (event.key === 'Escape') {
        this.pauseMenu.toggle();
        return;
      }
      if (this.pauseMenu.isOpen || this.transitioning) return;
      if (event.key.toLowerCase() === 'x') this.strike();
      if (event.key.toLowerCase() === 't') this.terminal.open(event.timeStamp);
      if (event.key === 'Enter') this.tryEnterPortal();
    });
  }

  private updateEnemy(enemy: TrailEnemy, time: number, delta: number): void {
    if (enemy.hp <= 0) return;
    const dx = this.player.x - enemy.sprite.x;
    const dy = this.player.y - enemy.sprite.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const profile = warriorProfiles[enemy.warrior];
    if (time >= enemy.attackReadyAt && distance < profile.attackRange) {
      this.enemyAttack(enemy);
      return;
    }
    const desired = this.desiredEnemyVelocity(enemy, profile, dx, dy, distance, time);
    enemy.velocity.lerp(desired, Math.min(1, delta / 150));
    this.safeSetVelocity(enemy.sprite, enemy.velocity.x, enemy.velocity.y);
    clampSpriteToArenaBounds(enemy.sprite, this.walkableBounds);
    enemy.sprite.setDepth(enemy.sprite.y);
    enemy.sprite.setFlipX(enemy.sprite.x > this.player.x);
    if (time < enemy.poseLockedUntil) return;
    this.setEnemyPose(enemy, enemy.velocity.lengthSq() > 90 ? 'walk' : 'idle');
    this.updateActorShadow(enemy.shadow, enemy.sprite, 27);
  }

  private desiredEnemyVelocity(
    enemy: TrailEnemy,
    profile: WarriorProfile,
    dx: number,
    dy: number,
    distance: number,
    time: number,
  ): Phaser.Math.Vector2 {
    const toward = new Phaser.Math.Vector2(dx / distance, (dy / distance) * 0.72);
    const perpendicular = new Phaser.Math.Vector2(-toward.y, toward.x);
    if (profile.movementStyle === 'kite') {
      const rangeDelta = distance - profile.preferredRange;
      const direction = rangeDelta > 42 ? 1 : rangeDelta < -28 ? -1 : 0;
      return toward.scale(profile.speed * direction).add(perpendicular.scale(Math.sin(time / 420 + enemy.sprite.x) * 18));
    }
    if (profile.movementStyle === 'orbit') {
      const rangeDelta = distance - profile.preferredRange;
      return toward.scale(Phaser.Math.Clamp(rangeDelta, -58, 58) * 0.88)
        .add(perpendicular.scale(profile.speed * 0.74));
    }
    if (profile.movementStyle === 'ambush') {
      const pulse = Math.sin(time / 520 + enemy.sprite.y * 0.02) > 0.2 ? 1 : 0.36;
      return toward.scale((distance > profile.preferredRange ? profile.speed : -24) * pulse);
    }
    if (profile.movementStyle === 'shield') {
      const portalDx = this.portalPoint.x - enemy.sprite.x;
      const portalDy = (this.portalPoint.y + 54 - enemy.sprite.y) * 0.72;
      const portalDistance = Math.max(1, Math.hypot(portalDx, portalDy));
      const holdPortal = distance > profile.preferredRange + 44 && portalDistance > 150;
      if (holdPortal) {
        return new Phaser.Math.Vector2(portalDx / portalDistance, portalDy / portalDistance).scale(profile.speed * 0.45);
      }
      return toward.scale(distance > profile.preferredRange ? profile.speed * 0.82 : -18);
    }
    return toward.scale(distance > profile.preferredRange ? profile.speed : -38);
  }

  private enemyAttack(enemy: TrailEnemy): void {
    const profile = warriorProfiles[enemy.warrior];
    enemy.attackReadyAt = this.time.now + profile.cooldownMs;
    enemy.poseLockedUntil = this.time.now + 520;
    enemy.velocity.set(0, 0);
    this.safeSetVelocity(enemy.sprite, 0, 0);
    this.setEnemyPose(enemy, 'attack');
    const marker = this.addWarriorAttackMarker(enemy, profile);
    const markerScaleX = marker.scaleX;
    const markerScaleY = marker.scaleY;
    this.tweens.add({
      targets: marker,
      alpha: 0.46,
      scaleX: markerScaleX * 1.08,
      scaleY: markerScaleY * 1.08,
      duration: 360,
      yoyo: true,
      onComplete: () => {
        const damageRadius = Number(marker.getData('damageRadius') ?? (profile.attackShape === 'arrow' ? 92 : 78));
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, marker.x, marker.y) < damageRadius) {
          this.damagePlayer(profile.attackDamage, enemy.sprite.x, enemy.sprite.y);
        }
        marker.destroy();
        if (enemy.hp > 0) this.setEnemyPose(enemy, 'idle');
      },
    });
  }

  private strike(): void {
    if (!this.canStrike) return;
    this.canStrike = false;
    const beforeTotalHp = this.totalLivingEnemyHp();
    let targets = 0;
    this.poseLockedUntil = this.time.now + 260;
    this.lockedPlayerPose = 'swing';
    setActorPose(this.player, 'swing');
    playSlash(this);
    const direction = this.lastMoveDirection.x < -0.1 ? -1 : 1;
    this.player.setFlipX(direction < 0);
    const sword = addSwordSwing(this, this.player.x, this.player.y, direction as 1 | -1, this.player.y + 24, 1);
    publishSwordSwing('chapter2-trail', this.player.x, this.player.y, sword.hitX, sword.hitY, 1, 'trail-enemies', sword);
    this.enemies.forEach((enemy) => {
      if (enemy.hp <= 0) return;
      const distance = Phaser.Math.Distance.Between(sword.hitX, sword.hitY, enemy.sprite.x, enemy.sprite.y);
      if (distance > 172) return;
      enemy.lastHp = enemy.hp;
      enemy.hp = Math.max(0, enemy.hp - 18);
      targets += 1;
      enemy.poseLockedUntil = this.time.now + 260;
      this.setEnemyPose(enemy, enemy.hp <= 0 ? 'defeat' : 'hurt');
      enemy.sprite.setTintFill(enemy.hp <= 0 ? 0x2b1830 : 0xf6ead3);
      playHit(this);
      addHitSparks(this, enemy.sprite.x, enemy.sprite.y - 34, enemy.sprite.y + 16);
      addImpactPause(this, 60, 0.18);
      this.time.delayedCall(130, () => enemy.sprite.setTint(enemy.tint));
      if (enemy.hp <= 0) {
        enemy.sprite.setAlpha(0.5);
        enemy.shadow.setAlpha(0.12);
      }
    });
    this.lastSwordDamage = {
      targets,
      beforeTotalHp,
      afterTotalHp: this.totalLivingEnemyHp(),
      damage: targets > 0 ? 18 : 0,
      at: Math.round(performance.now()),
    };
    if (this.enemies.every((enemy) => enemy.hp <= 0)) this.publishRuntimeEnemies();
    this.time.delayedCall(230, () => {
      this.canStrike = true;
      if (this.playerHp > 0) setActorPose(this.player, 'idle');
    });
  }

  private handleTerminal(command: string): void {
    const parsed = parseTerminalCommand(command);
    if (!parsed.command) {
      this.setTrailCueState(this.trailCueState);
      return;
    }
    const ability = getAbility(parsed.command.abilityId);
    playCast(this);
    this.setTrailCueState(this.trailCueState);
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
      scene: 'chapter2-trail',
      abilityId: ability.id,
      usesGeneratedIcon: Boolean(icon),
      usesGeneratedEffect: Boolean(icon?.getData('usesGeneratedEffect')),
      effectFrameCount: Number(icon?.getData('effectFrameCount') ?? 0),
      at: Math.round(performance.now()),
    };
    const visualRadius = ability.id === 'loop-strike' ? 340 : ability.id === 'try-catch' ? 278 : 240;
    const damage = ability.id === 'try-catch' ? 22 : ability.id === 'loop-strike' ? 52 : ability.hitbox.damage;
    const beforeTotalHp = this.totalLivingEnemyHp();
    const pulse = this.add.ellipse(this.player.x, this.player.y, visualRadius, ability.id === 'try-catch' ? 142 : 118, ability.id === 'try-catch' ? 0x8f7dff : 0x90d2b7, 0.22)
      .setStrokeStyle(4, 0xf0c36b, 0.42)
      .setDepth(this.player.y + 20);
    this.tweens.add({ targets: pulse, alpha: 0, scale: 1.35, duration: 360, onComplete: () => pulse.destroy() });
    if (ability.id === 'try-catch') {
      this.playerHp = Math.min(chapterTwoPlayerMaxHp, this.playerHp + 8);
      this.playerBar.setValue(this.playerHp, chapterTwoPlayerMaxHp);
    }
    let damaged = 0;
    this.enemies.filter((enemy) => enemy.hp > 0).forEach((enemy, index) => {
      enemy.lastHp = enemy.hp;
      enemy.hp = Math.max(0, enemy.hp - damage);
      damaged += 1;
      enemy.attackReadyAt = this.time.now + (ability.id === 'try-catch' ? 1350 : 1050);
      enemy.poseLockedUntil = this.time.now + 760;
      enemy.velocity.set(0, 0);
      this.safeSetVelocity(enemy.sprite, 0, 0);
      this.setEnemyPose(enemy, enemy.hp <= 0 ? 'defeat' : 'stagger');
      enemy.sprite.setTintFill(ability.id === 'try-catch' ? 0x8f7dff : 0xf6ead3);
      addHitSparks(this, enemy.sprite.x, enemy.sprite.y - 28, enemy.sprite.y + 14);
      this.addVowThread(this.player.x, this.player.y - 30, enemy.sprite.x, enemy.sprite.y - 40, index, ability.id === 'try-catch' ? 0x8f7dff : 0x90d2b7);
      this.addCombatHitFeedback(enemy.sprite.x, enemy.sprite.y - 66, ability.id === 'try-catch' ? 'counter' : 'vow', ability.id);
      this.time.delayedCall(120, () => enemy.sprite.setTint(enemy.tint));
      if (enemy.hp <= 0) {
        enemy.sprite.setAlpha(0.5);
        enemy.shadow.setAlpha(0.12);
      }
    });
    if (this.enemies.every((enemy) => enemy.hp <= 0)) this.publishRuntimeEnemies();
    this.lastTerminalDamage = {
      abilityId: ability.id,
      targets: damaged,
      beforeTotalHp,
      afterTotalHp: this.totalLivingEnemyHp(),
      damage,
      at: Math.round(performance.now()),
    };
    (window as Window & {
      __CODEJITSU_LAST_ABILITY_DAMAGE?: {
        scene: string;
        abilityId: string;
        targets: number;
        damage: number;
        at: number;
      };
    }).__CODEJITSU_LAST_ABILITY_DAMAGE = {
      scene: 'chapter2-trail',
      abilityId: ability.id,
      targets: damaged,
      damage,
      at: Math.round(performance.now()),
    };
  }

  private totalLivingEnemyHp(): number {
    return this.enemies.reduce((total, enemy) => total + Math.max(0, enemy.hp), 0);
  }

  private abilityCombatText(abilityId: string): string {
    if (abilityId === 'try-catch') return 'counter pulse heals your guard and damages every visible null warrior.';
    if (abilityId === 'loop-strike') return 'repeating dash vow cuts every echo on this stage and staggers the loop.';
    if (abilityId === 'array-split') return 'split vow hits separate lanes at once.';
    if (abilityId === 'debug-break') return 'freeze vow slows the curse and chips enemies.';
    if (abilityId === 'window-kill') return 'finisher vow tears a false return open.';
    return 'the vow threads through every active enemy on this stage.';
  }

  private addVowThread(fromX: number, fromY: number, toX: number, toY: number, index: number, color: number): void {
    const line = this.add.graphics().setDepth(Math.max(fromY, toY) + 120).setAlpha(0);
    line.lineStyle(3, color, 0.78);
    line.beginPath();
    line.moveTo(fromX, fromY);
    const controlX = (fromX + toX) / 2;
    const controlY = Math.min(fromY, toY) - 64 - index * 8;
    for (let step = 1; step <= 8; step += 1) {
      const t = step / 8;
      const x = ((1 - t) * (1 - t) * fromX) + (2 * (1 - t) * t * controlX) + (t * t * toX);
      const y = ((1 - t) * (1 - t) * fromY) + (2 * (1 - t) * t * controlY) + (t * t * toY);
      line.lineTo(x, y);
    }
    line.strokePath();
    this.tweens.add({
      targets: line,
      alpha: { from: 0, to: 0.95 },
      duration: 100,
      yoyo: true,
      hold: 100,
      onComplete: () => line.destroy(),
    });
  }

  private addCombatHitFeedback(x: number, y: number, kind: CombatHitMarkKind, abilityId: string): void {
    addCombatHitMark(this, kind, x, y, {
      sceneId: 'chapter2-trail',
      abilityId,
      width: kind === 'counter' ? 150 : 158,
      height: kind === 'counter' ? 114 : 98,
      depth: y + 156,
      tint: kind === 'counter' ? 0xbda3ff : 0x90d2b7,
      lifespanMs: 600,
    });
  }

  private addWarriorAttackMarker(enemy: TrailEnemy, profile: WarriorProfile): TrailAttackMarker {
    const spec = this.warriorAttackMarkerSpec(enemy, profile);
    const generated = this.addImagegenWarriorAttackMarker(enemy, profile, spec);
    if (generated) {
      generated.setData('damageRadius', spec.damageRadius);
      generated.setData('trailAttackMarker', true);
      addGeneratedTelegraphSigil(this, 'chapter2-trail', spec.kind, spec.x, spec.y, {
        width: spec.kind === 'lane' ? spec.width * 0.56 : spec.width * 0.74,
        height: spec.kind === 'lane' ? spec.height * 0.96 : spec.height * 0.74,
        rotation: spec.rotation,
        depth: spec.depth + 6,
        alpha: 0.44,
        tint: enemy.tint,
        lifespanMs: 980,
      });
      this.publishTrailAttackMarkerRuntime(enemy, profile, spec, true, 0, {
        usesImagegenMarker: true,
        markerTextureKey: TextureKeys.Chapter2TrailAttackMarkers,
        markerFrameIndex: this.attackMarkerFrameIndex(profile.attackShape),
      });
      return generated;
    }
    const sigil = addGeneratedTelegraphSigil(this, 'chapter2-trail', spec.kind, spec.x, spec.y, {
      width: spec.width,
      height: spec.height,
      rotation: spec.rotation,
      depth: spec.depth,
      alpha: 0.74,
      tint: enemy.tint,
    });
    if (sigil) {
      sigil.setData('damageRadius', spec.damageRadius);
      sigil.setData('trailAttackMarker', true);
      this.publishTrailAttackMarkerRuntime(enemy, profile, spec, true, 0, {
        usesImagegenMarker: false,
        markerTextureKey: 'generated-sigil-only',
        markerFrameIndex: -1,
      });
      return sigil;
    }
    const fallback = this.addPrimitiveWarriorAttackMarker(enemy, profile, spec);
    fallback.setData('damageRadius', spec.damageRadius);
    fallback.setData('trailAttackMarker', true);
    this.addWarriorTelegraphSigil(fallback, spec.kind, enemy.tint);
    this.publishTrailAttackMarkerRuntime(enemy, profile, spec, false, 1, {
      usesImagegenMarker: false,
      markerTextureKey: 'fallback-shape',
      markerFrameIndex: -1,
    });
    return fallback;
  }

  private addImagegenWarriorAttackMarker(
    enemy: TrailEnemy,
    profile: WarriorProfile,
    spec: TrailAttackMarkerSpec,
  ): Phaser.GameObjects.Image | undefined {
    if (!this.textures.exists(TextureKeys.Chapter2TrailAttackMarkers)) return undefined;
    const frameIndex = this.attackMarkerFrameIndex(profile.attackShape);
    const frameKey = this.ensureTrailAttackMarkerFrame(frameIndex);
    return this.add.image(spec.x, spec.y, TextureKeys.Chapter2TrailAttackMarkers, frameKey)
      .setDisplaySize(spec.width, spec.height)
      .setRotation(spec.rotation)
      .setDepth(spec.depth)
      .setAlpha(0.08)
      .setTint(enemy.tint)
      .setData('usesImagegenTrailAttackMarker', true)
      .setData('trailAttackMarkerFrameIndex', frameIndex);
  }

  private attackMarkerFrameIndex(shape: WarriorProfile['attackShape']): number {
    if (shape === 'slash') return 1;
    if (shape === 'arrow') return 2;
    if (shape === 'wraith') return 3;
    if (shape === 'guard') return 4;
    return 0;
  }

  private ensureTrailAttackMarkerFrame(frameIndex: number): string {
    const source = this.textures.get(TextureKeys.Chapter2TrailAttackMarkers).getSourceImage() as { width?: number; height?: number };
    const frameWidth = Math.floor(Number(source.width ?? 2172) / 5);
    const frameHeight = Number(source.height ?? 724);
    const texture = this.textures.get(TextureKeys.Chapter2TrailAttackMarkers) as Phaser.Textures.Texture & {
      has?: (name: string) => boolean;
    };
    const safeFrame = Phaser.Math.Clamp(frameIndex, 0, 4);
    const frameKey = `chapter2-trail-attack-marker-${safeFrame}`;
    if (!texture.has?.(frameKey)) {
      texture.add(frameKey, 0, safeFrame * frameWidth, 0, frameWidth, frameHeight);
    }
    return frameKey;
  }

  private warriorAttackMarkerSpec(enemy: TrailEnemy, profile: WarriorProfile): TrailAttackMarkerSpec {
    const x = profile.attackShape === 'arrow'
      ? Phaser.Math.Linear(enemy.sprite.x, this.player.x, 0.68)
      : this.player.x;
    const y = profile.attackShape === 'guard'
      ? enemy.sprite.y + 6
      : this.player.y + 4;
    const base = {
      x,
      y,
      depth: y + 10,
      damageRadius: profile.attackShape === 'arrow' ? 92 : 78,
    };
    if (profile.attackShape === 'slash') {
      return {
        ...base,
        width: 190,
        height: 108,
        rotation: (enemy.sprite.x > this.player.x ? -0.22 : 0.22) + Math.PI / 2,
        kind: 'lane',
      };
    }
    if (profile.attackShape === 'arrow') {
      return {
        ...base,
        width: 234,
        height: 100,
        rotation: Phaser.Math.Angle.Between(enemy.sprite.x, enemy.sprite.y, this.player.x, this.player.y) + Math.PI / 2,
        kind: 'lane',
      };
    }
    if (profile.attackShape === 'wraith') {
      return {
        ...base,
        width: 168,
        height: 116,
        rotation: Phaser.Math.FloatBetween(-0.05, 0.05),
        kind: 'burst',
      };
    }
    if (profile.attackShape === 'guard') {
      return {
        ...base,
        width: 154,
        height: 124,
        rotation: Phaser.Math.FloatBetween(-0.05, 0.05),
        kind: 'cage',
      };
    }
    return {
      ...base,
      width: 146,
      height: 106,
      rotation: Phaser.Math.FloatBetween(-0.05, 0.05),
      kind: 'pursuit',
    };
  }

  private addPrimitiveWarriorAttackMarker(
    enemy: TrailEnemy,
    profile: WarriorProfile,
    spec: TrailAttackMarkerSpec,
  ): Phaser.GameObjects.Shape {
    if (profile.attackShape === 'slash') {
      const marker = this.add.rectangle(spec.x, spec.y, 128, 34, enemy.tint, 0.2)
        .setRotation(spec.rotation - Math.PI / 2)
        .setStrokeStyle(3, 0xf6ead3, 0.34)
        .setDepth(spec.depth);
      return marker;
    }
    if (profile.attackShape === 'arrow') {
      const marker = this.add.rectangle(spec.x, spec.y, 168, 22, enemy.tint, 0.2)
        .setRotation(spec.rotation - Math.PI / 2)
        .setStrokeStyle(3, 0xf6ead3, 0.3)
        .setDepth(spec.depth);
      return marker;
    }
    if (profile.attackShape === 'wraith') {
      const marker = this.add.ellipse(spec.x, spec.y - 4, 132, 78, enemy.tint, 0.18)
        .setStrokeStyle(4, 0xbda3ff, 0.36)
        .setDepth(spec.depth);
      return marker;
    }
    if (profile.attackShape === 'guard') {
      const marker = this.add.ellipse(spec.x, spec.y, 118, 62, enemy.tint, 0.2)
        .setStrokeStyle(4, 0xf0c36b, 0.38)
        .setDepth(spec.depth);
      return marker;
    }
    const marker = this.add.ellipse(spec.x, spec.y, 116, 54, enemy.tint, 0.18)
      .setStrokeStyle(3, 0xf6ead3, 0.34)
      .setDepth(spec.depth);
    return marker;
  }

  private addWarriorTelegraphSigil(
    marker: Phaser.GameObjects.Shape,
    kind: TelegraphSigilKind,
    tint: number,
  ): void {
    addGeneratedTelegraphSigil(this, 'chapter2-trail', kind, marker.x, marker.y, {
      width: kind === 'lane' ? 104 : kind === 'cage' ? 108 : 100,
      height: kind === 'lane' ? 138 : kind === 'cage' ? 108 : 100,
      rotation: kind === 'lane' ? marker.rotation + Math.PI / 2 : Phaser.Math.FloatBetween(-0.05, 0.05),
      depth: marker.depth + 6,
      alpha: 0.62,
      tint,
      lifespanMs: 980,
    });
  }

  private publishTrailAttackMarkerRuntime(
    enemy: TrailEnemy,
    profile: WarriorProfile,
    spec: TrailAttackMarkerSpec,
    usesGeneratedSigil: boolean,
    primitiveMarkerPieces: number,
    markerArt: {
      usesImagegenMarker: boolean;
      markerTextureKey: string;
      markerFrameIndex: number;
    },
  ): void {
    (window as Window & {
      __CODEJITSU_CHAPTER2_ATTACK_MARKER?: {
        scene: string;
        warrior: WarriorKind;
        attackShape: WarriorProfile['attackShape'];
        sigilKind: TelegraphSigilKind;
        usesGeneratedSigil: boolean;
        primitiveMarkerPieces: number;
        generatedArtOnly: boolean;
        usesImagegenMarker: boolean;
        markerTextureKey: string;
        markerFrameIndex: number;
        width: number;
        height: number;
        at: number;
      };
    }).__CODEJITSU_CHAPTER2_ATTACK_MARKER = {
      scene: 'chapter2-trail',
      warrior: enemy.warrior,
      attackShape: profile.attackShape,
      sigilKind: spec.kind,
      usesGeneratedSigil,
      primitiveMarkerPieces,
      generatedArtOnly: markerArt.usesImagegenMarker && primitiveMarkerPieces === 0,
      usesImagegenMarker: markerArt.usesImagegenMarker,
      markerTextureKey: markerArt.markerTextureKey,
      markerFrameIndex: markerArt.markerFrameIndex,
      width: Math.round(spec.width),
      height: Math.round(spec.height),
      at: Math.round(performance.now()),
    };
  }

  private setEnemyPose(enemy: TrailEnemy, pose: 'idle' | 'walk' | 'attack' | 'hurt' | 'stagger' | 'defeat'): void {
    if (this.warriorTextureKey()) {
      this.applyWarriorPose(enemy.sprite, enemy.warrior, pose);
      return;
    }
    setActorPose(enemy.sprite, pose === 'walk' ? 'walk' : pose === 'attack' ? 'attack' : pose === 'defeat' ? 'defeat' : pose === 'idle' ? 'idle' : 'hurt');
  }

  private warriorTextureKey(): string | undefined {
    if (this.textures.exists(TextureKeys.Chapter2MinionVariants)) return TextureKeys.Chapter2MinionVariants;
    if (this.textures.exists(TextureKeys.Chapter2NullWarriors)) return TextureKeys.Chapter2NullWarriors;
    return undefined;
  }

  private applyWarriorPose(sprite: Phaser.Physics.Arcade.Sprite, warrior: WarriorKind, pose: string): void {
    const profile = warriorProfiles[warrior];
    const frameCount = pose === 'attack' ? 2 : pose === 'defeat' ? 2 : 3;
    const frameIndex = Math.floor((this.time.now / (pose === 'attack' ? 120 : 160)) % frameCount);
    const crop = pose === 'attack' || (pose === 'walk' && frameIndex === 1) ? profile.cropAttack : profile.cropIdle;
    const poseScale = pose === 'attack' ? 1.1 : pose === 'hurt' || pose === 'stagger' ? 1.06 : pose === 'walk' ? 1.04 : 1;
    const framePulse = pose === 'walk' ? [1, 1.045, 1.015][frameIndex] : pose === 'idle' ? [1, 1.015, 0.995][frameIndex] : 1;
    const scale = poseScale * framePulse;
    sprite
      .setTexture(this.warriorTextureKey() ?? TextureKeys.Chapter2NullWarriors)
      .setCrop(crop.x, crop.y, crop.width, crop.height)
      .setDisplaySize(profile.width * scale, profile.height * scale)
      .setOrigin(0.5, 0.82);
    this.configureWarriorBody(sprite, profile);
    sprite.setData('actorKind', warrior);
    sprite.setData('actorPose', pose);
    sprite.setData('actorFrameCount', frameCount);
    sprite.setData('actorFrameIndex', frameIndex);
    sprite.setData('actorRenderVariant', `imagegen-${warrior}`);
    sprite.setData('motionProfile', warriorProfiles[warrior].attackShape);
    sprite.setData('movementStyle', warriorProfiles[warrior].movementStyle);
    sprite.setData('actorVisualGrounded', true);
    sprite.setData('visualScale', Math.round(scale * 100) / 100);
  }

  private configureWarriorBody(sprite: Phaser.Physics.Arcade.Sprite, profile: WarriorProfile): void {
    const bodySourceWidth = profile.bodyWidth / Math.max(0.001, Math.abs(sprite.scaleX));
    const bodySourceHeight = profile.bodyHeight / Math.max(0.001, Math.abs(sprite.scaleY));
    sprite.body?.setSize(bodySourceWidth, bodySourceHeight, true);
  }

  private handleMovement(delta: number): void {
    const input = readMovementInput(this.keys);
    const wantsMove = input.x * input.x + input.y * input.y > 0;
    this.moveHeldMs = wantsMove ? Math.min(this.moveHeldMs + delta, 1400) : 0;
    const movement = stepMovementVelocity(this.currentVelocity, input, delta, apprenticeMovementTuning, this.moveHeldMs);
    if (movement.moving) this.lastMoveDirection.copy(movement.direction);
    this.safeSetVelocity(this.player, movement.velocity.x, movement.velocity.y);
    if (this.time.now < this.poseLockedUntil) setActorPose(this.player, this.lockedPlayerPose);
    else setActorPose(this.player, movement.moving ? (movement.runFactor > 1.08 ? 'run' : 'walk') : 'idle');
    updateGroundedActorVisual(this, this.player, this.playerShadow, 29, movement, { width: 82, height: 34, alpha: 0.43 });
    updateForegroundParallaxDepth(this, 'chapter2-trail', this.foregroundOverlay, movement, 0.32);
    if (movement.strideIntensity > 0.34 && this.time.now - this.lastStepDustAt > movement.strideIntervalMs) {
      this.lastStepDustAt = this.time.now;
      addStepDust(this, this.player.x, this.player.y, this.player.y - 6, this.lastMoveDirection.x || 1);
    }
    if (this.lastMoveDirection.x < -0.1) this.player.setFlipX(true);
    if (this.lastMoveDirection.x > 0.1) this.player.setFlipX(false);
  }

  private damagePlayer(damage: number, sourceX: number, sourceY: number): void {
    this.playerHp = Math.max(0, this.playerHp - damage);
    this.poseLockedUntil = this.time.now + 180;
    this.lockedPlayerPose = 'hurt';
    setActorPose(this.player, 'hurt');
    this.player.setTintFill(0xd64f45);
    const angle = Phaser.Math.Angle.Between(sourceX, sourceY, this.player.x, this.player.y);
    this.currentVelocity.set(Math.cos(angle) * 190, Math.sin(angle) * 140);
    this.safeSetVelocity(this.player, this.currentVelocity.x, this.currentVelocity.y);
    this.time.delayedCall(140, () => this.player.clearTint());
    if (this.playerHp <= 0) {
      const segment = this.currentSegment();
      this.scene.start(SceneKeys.Result, {
        outcome: 'lose',
        chapter: 2,
        deathReason: `${warriorProfiles[this.nearestLivingEnemyWarrior()].label} caught you on ${segment.name}.`,
        retryScene: SceneKeys.Chapter2Trail,
        retryData: { segmentIndex: this.trailSegmentIndex },
      });
    }
  }

  private nearestLivingEnemyWarrior(): WarriorKind {
    const enemy = this.enemies
      .filter((candidate) => candidate.hp > 0)
      .sort((a, b) =>
        Phaser.Math.Distance.Between(this.player.x, this.player.y, a.sprite.x, a.sprite.y) -
        Phaser.Math.Distance.Between(this.player.x, this.player.y, b.sprite.x, b.sprite.y),
      )[0];
    return enemy?.warrior ?? 'loop-wisp';
  }

  private separateCombatants(): void {
    this.enemies.filter((enemy) => enemy.hp > 0).forEach((enemy) => {
      const dx = this.player.x - enemy.sprite.x;
      const dy = (this.player.y - enemy.sprite.y) * 1.24;
      const distance = Math.max(1, Math.hypot(dx, dy));
      if (distance > 128) return;
      const push = (128 - distance) * 0.42;
      this.player.x += (dx / distance) * push;
      this.player.y += (dy / distance) * push * 0.7;
      enemy.sprite.x -= (dx / distance) * push * 0.4;
      enemy.sprite.y -= (dy / distance) * push * 0.3;
      clampSpriteToArenaBounds(this.player, this.walkableBounds);
      clampSpriteToArenaBounds(enemy.sprite, this.walkableBounds);
    });
  }

  private separateEnemies(): void {
    const living = this.enemies.filter((enemy) => enemy.hp > 0);
    for (let a = 0; a < living.length; a += 1) {
      for (let b = a + 1; b < living.length; b += 1) {
        const left = living[a];
        const right = living[b];
        const dx = right.sprite.x - left.sprite.x;
        const dy = (right.sprite.y - left.sprite.y) * 1.18;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const minDistance = 128;
        if (distance >= minDistance) continue;
        const push = (minDistance - distance) * 0.28;
        const pushX = (dx / distance) * push;
        const pushY = (dy / distance) * push * 0.72;
        left.sprite.x -= pushX;
        left.sprite.y -= pushY;
        right.sprite.x += pushX;
        right.sprite.y += pushY;
        clampSpriteToArenaBounds(left.sprite, this.walkableBounds);
        clampSpriteToArenaBounds(right.sprite, this.walkableBounds);
      }
    }
  }

  private updateObjectiveText(): void {
    const remaining = this.enemies.filter((enemy) => enemy.hp > 0).length;
    if (remaining > 0) {
      this.setTrailCueState('echoes');
      return;
    }
    if (this.trailSegmentIndex < trailSegments.length - 1) {
      this.setTrailCueState('seam');
      return;
    }
    this.setTrailCueState('return');
  }

  private tryEnterPortal(): void {
    if (this.enemies.some((enemy) => enemy.hp > 0)) {
      this.setTrailCueState('echoes');
      return;
    }
    const nearPortal = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.portalPoint.x, this.portalPoint.y + 50) < 180;
    if (!nearPortal) {
      this.setTrailCueState(this.trailSegmentIndex < trailSegments.length - 1 ? 'seam' : 'return');
      return;
    }
    if (this.trailSegmentIndex < trailSegments.length - 1) {
      this.advanceTrailSegment();
      return;
    }
    this.transitioning = true;
    setActorPose(this.player, 'walk');
    this.showTrailInterlude(this.currentSegment(), undefined, 'boss-gate');
    walkSpriteIntoGate(this, this.player, new Phaser.Math.Vector2(this.portalPoint.x, this.portalPoint.y + 48), SceneKeys.Boss, {
      duration: 620,
      fadeDuration: 420,
      data: { bossId: 'return-oni' },
      onStep: () => {
        this.player.setDepth(this.player.y);
        this.updateActorShadow(this.playerShadow, this.player, 29);
      },
    });
  }

  private advanceTrailSegment(): void {
    const nextIndex = this.trailSegmentIndex + 1;
    const currentSegment = this.currentSegment();
    const nextSegment = trailSegments[nextIndex];
    if (!nextSegment) return;
    this.transitioning = true;
    setActorPose(this.player, 'walk');
    this.showTrailInterlude(currentSegment, nextSegment, 'stage-advance');
    this.cameras.main.flash(360, 9, 7, 13);
    this.time.delayedCall(520, () => {
      this.player.setPosition(300, 506);
      this.currentVelocity.set(0, 0);
      this.safeSetVelocity(this.player, 0, 0);
      this.spawnTrailSegment(nextIndex);
      this.setTrailCueState('echoes');
      this.transitioning = false;
      setActorPose(this.player, 'idle');
    });
  }

  private showTrailInterlude(fromSegment: TrailSegment, toSegment: TrailSegment | undefined, kind: 'stage-advance' | 'boss-gate'): void {
    this.interludeCount += 1;
    const usesImagegenAsset = this.textures.exists(TextureKeys.Chapter2VowInterlude);
    const objects: Phaser.GameObjects.GameObject[] = [];
    if (usesImagegenAsset) {
      const source = this.textures.get(TextureKeys.Chapter2VowInterlude).getSourceImage() as { width?: number; height?: number };
      const sourceWidth = Number(source.width ?? 1280);
      const sourceHeight = Number(source.height ?? 720);
      const scale = Math.max(1280 / sourceWidth, 720 / sourceHeight);
      const overlay = this.add.image(640, 360, TextureKeys.Chapter2VowInterlude)
        .setDisplaySize(Math.ceil(sourceWidth * scale), Math.ceil(sourceHeight * scale))
        .setDepth(920)
        .setAlpha(0);
      this.tweens.add({
        targets: overlay,
        alpha: { from: 0, to: 0.88 },
        scaleX: overlay.scaleX * 1.012,
        scaleY: overlay.scaleY * 1.012,
        duration: 180,
        yoyo: true,
        hold: kind === 'boss-gate' ? 160 : 280,
        ease: 'Sine.InOut',
        onComplete: () => overlay.destroy(),
      });
      objects.push(overlay);
    }

    const atmosphere = this.addStageInterludeAtmosphere();
    const usesImagegenPanel = this.textures.exists(TextureKeys.ResultPanel);
    const usesImagegenInterludeCue = this.textures.exists(TextureKeys.Chapter2StageInterludeCue);
    const panel = usesImagegenPanel
      ? this.add.image(640, 320, TextureKeys.ResultPanel)
        .setDisplaySize(760, 430)
        .setDepth(922)
        .setAlpha(0)
        .setData('usesImagegenPanel', true)
      : addPanel(this, 260, 105, 760, 430, 0.82).setDepth(922).setAlpha(0);
    const interludeFrameIndex = kind === 'boss-gate' ? 1 : 0;
    const interludeCue = usesImagegenInterludeCue
      ? this.add.image(640, 320, TextureKeys.Chapter2StageInterludeCue, this.ensureStageInterludeCueFrame(interludeFrameIndex))
        .setDisplaySize(kind === 'boss-gate' ? 390 : 330, kind === 'boss-gate' ? 390 : 330)
        .setDepth(923)
        .setAlpha(0)
        .setData('usesImagegenInterludeCue', true)
        .setData('interludeCueFrameIndex', interludeFrameIndex)
      : addSeamVfx(this, 'chapter2-trail', kind === 'boss-gate' ? 'seal' : 'burst', 640, 320, {
        width: 330,
        height: 170,
        depth: 923,
        alpha: 0,
        tint: kind === 'boss-gate' ? 0xb85dff : 0x90d2b7,
      });
    objects.push(atmosphere.object, panel);
    if (interludeCue) objects.push(interludeCue);

    const rings = Array.from({ length: 4 }, (_, index) => {
      const ring = addSeamVfx(this, 'chapter2-trail', index % 2 === 0 ? 'seal' : 'burst', 640, 360, {
        width: 260 + index * 76,
        height: 96 + index * 22,
        depth: 922,
        alpha: 0,
        tint: index % 2 === 0 ? 0x90d2b7 : 0xf0c36b,
      }) ?? this.add.ellipse(640, 360, 260 + index * 76, 58 + index * 16)
        .setStrokeStyle(3, index % 2 === 0 ? 0x90d2b7 : 0xf0c36b, 0.3)
        .setDepth(922)
        .setAlpha(0);
      objects.push(ring);
      this.tweens.add({
        targets: ring,
        alpha: { from: 0, to: 0.46 },
        scaleX: 1.18,
        scaleY: 1.22,
        delay: 60 + index * 55,
        duration: 520,
        ease: 'Quad.Out',
      });
      return ring;
    });
    const particles = Array.from({ length: 16 }, (_, index) => {
      const x = 640 + Phaser.Math.Between(-360, 360);
      const y = 360 + Phaser.Math.Between(-120, 128);
      const particle = addSeamVfx(this, 'chapter2-trail', index % 3 === 0 ? 'spark' : 'wisp', x, y, {
        width: Phaser.Math.Between(32, 46),
        height: Phaser.Math.Between(36, 58),
        depth: 924,
        alpha: 0,
        tint: index % 2 === 0 ? 0xf0c36b : 0x90d2b7,
        rotation: Phaser.Math.FloatBetween(-0.18, 0.18),
      }) ?? this.add.rectangle(x, y, Phaser.Math.Between(3, 6), Phaser.Math.Between(12, 28), index % 2 === 0 ? 0xf0c36b : 0x90d2b7, 0)
        .setDepth(924)
        .setRotation(Phaser.Math.FloatBetween(-0.18, 0.18));
      objects.push(particle);
      this.tweens.add({
        targets: particle,
        y: y - Phaser.Math.Between(24, 80),
        alpha: { from: 0, to: 0.5 },
        delay: index * 18,
        duration: 680,
        ease: 'Sine.Out',
      });
      return particle;
    });

    this.tweens.add({
      targets: [atmosphere.object, panel, interludeCue].filter(Boolean),
      alpha: { from: 0, to: 1 },
      y: '-=8',
      duration: 190,
      ease: 'Quad.Out',
    });
    this.time.delayedCall(kind === 'boss-gate' ? 720 : 900, () => {
      objects.forEach((object) => {
        this.tweens.add({
          targets: object,
          alpha: 0,
          duration: 180,
          ease: 'Quad.In',
          onComplete: () => object.destroy(),
        });
      });
    });

    publishTextPanelAudit('chapter2-stage-interlude', new Phaser.Geom.Rectangle(260, 105, 760, 430), [
      ...(interludeCue ? [{ id: 'generated-cue', object: interludeCue }] : []),
    ], 18);

    (window as Window & {
      __CODEJITSU_CHAPTER2_STAGE_INTERLUDE?: {
        count: number;
        kind: 'stage-advance' | 'boss-gate';
        fromStageId: string;
        fromStageName: string;
        toStageId?: string;
        toStageName?: string;
        stageIndex: number;
        totalStages: number;
        gateGlyph: string;
        usesImagegenAsset: boolean;
        animated: boolean;
        ringCount: number;
        particleCount: number;
        usesImagegenPanel: boolean;
        primitivePanelPieces: number;
        panelKey: string;
        usesImagegenInterludeCue: boolean;
        primitiveInterludeCuePieces: number;
        usesImagegenInterludeAtmosphere: boolean;
        primitiveBackdropShadePieces: number;
        atmosphereTextureKey: string;
        interludeCueFrameIndex: number;
        textOverlayCount: number;
        at: number;
      };
    }).__CODEJITSU_CHAPTER2_STAGE_INTERLUDE = {
      count: this.interludeCount,
      kind,
      fromStageId: fromSegment.id,
      fromStageName: fromSegment.name,
      toStageId: toSegment?.id,
      toStageName: toSegment?.name,
      stageIndex: this.trailSegmentIndex,
      totalStages: trailSegments.length,
      gateGlyph: fromSegment.gateGlyph,
      usesImagegenAsset,
      animated: true,
      ringCount: rings.length,
      particleCount: particles.length,
      usesImagegenPanel,
      primitivePanelPieces: usesImagegenPanel ? 0 : 1,
      panelKey: usesImagegenPanel ? TextureKeys.ResultPanel : 'fallback-panel',
      usesImagegenInterludeCue,
      primitiveInterludeCuePieces: usesImagegenInterludeCue ? 0 : 1,
      usesImagegenInterludeAtmosphere: atmosphere.usesImagegenInterludeAtmosphere,
      primitiveBackdropShadePieces: atmosphere.primitiveBackdropShadePieces,
      atmosphereTextureKey: atmosphere.atmosphereTextureKey,
      interludeCueFrameIndex: interludeFrameIndex,
      textOverlayCount: 0,
      at: Math.round(performance.now()),
    };
  }

  private addStageInterludeAtmosphere(): {
    object: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
    usesImagegenInterludeAtmosphere: boolean;
    primitiveBackdropShadePieces: number;
    atmosphereTextureKey: string;
  } {
    if (this.textures.exists(TextureKeys.Chapter2StageInterludeAtmosphere)) {
      const source = this.textures.get(TextureKeys.Chapter2StageInterludeAtmosphere).getSourceImage() as { width?: number; height?: number };
      const scale = Math.max(1280 / Number(source.width ?? 1280), 720 / Number(source.height ?? 720));
      const object = this.add.image(640, 360, TextureKeys.Chapter2StageInterludeAtmosphere)
        .setScale(scale)
        .setDepth(921)
        .setAlpha(0)
        .setData('usesImagegenInterludeAtmosphere', true);
      return {
        object,
        usesImagegenInterludeAtmosphere: true,
        primitiveBackdropShadePieces: 0,
        atmosphereTextureKey: TextureKeys.Chapter2StageInterludeAtmosphere,
      };
    }

    const object = this.add.rectangle(640, 360, 1280, 720, 0x09070d, 0.18).setDepth(921).setAlpha(0);
    return {
      object,
      usesImagegenInterludeAtmosphere: false,
      primitiveBackdropShadePieces: 1,
      atmosphereTextureKey: 'fallback-rectangle',
    };
  }

  private handleBoundaryFeedback(result: ArenaClampResult): void {
    if (!result.clamped) return;
    publishBoundaryFeedback('chapter2-trail', result);
    if (this.time.now - this.lastBoundaryFeedbackAt < 220) return;
    this.lastBoundaryFeedbackAt = this.time.now;
    addBoundaryBump(this, result.point.x, result.point.y, result.side, this.player.y + 16);
  }

  private safeSetVelocity(sprite: Phaser.Physics.Arcade.Sprite, x: number, y: number): void {
    guardedSetVelocity('chapter2-trail', sprite, x, y);
  }

  private updateActorShadow(shadow: Phaser.GameObjects.Image, actor: Phaser.GameObjects.Sprite, offsetY: number): void {
    shadow.setPosition(actor.x, actor.y + offsetY);
    shadow.setDepth(actor.y - 8);
  }

  private publishRuntimeEnemies(): void {
    const warriorTexture = this.warriorTextureKey() ?? '';
    const portalBounds = this.portalGlow?.getBounds();
    const foregroundAlpha = Number(this.foregroundOverlay?.alpha ?? 0);
    (window as Window & {
      __CODEJITSU_CHAPTER2_TRAIL?: {
        remaining: number;
        portalOpen: boolean;
        usesGeneratedPortal: boolean;
        usesGeneratedPortalOnly: boolean;
        generatedPortalPieces: number;
        primitivePortalPieces: number;
        portalBounds: { x: number; y: number; width: number; height: number; alpha: number; bounded: boolean };
        foregroundOverlay: { width: number; height: number; alpha: number; quiet: boolean };
        outdoorScene: boolean;
        usesImagegenWarriors: boolean;
        usesRemadeMinionVariants: boolean;
        activeWarriorTextureKey: string;
        enemyArchetypeCount: number;
        movementStyleCount: number;
        stageIndex: number;
        totalStages: number;
        stageName: string;
        stageId: string;
        stageVow: string;
        stageVisualVariant: string;
        stageBackdropKey: string;
        usesImagegenAtmosphereOverlay: boolean;
        primitiveBackdropShadePieces: number;
        atmosphereTextureKey: string;
        allStagesCleared: boolean;
        chapterTwoPlaytime: ReturnType<typeof playableContentAudit>;
        lastSwordDamage: { targets: number; beforeTotalHp: number; afterTotalHp: number; damage: number; at: number };
        lastTerminalDamage: { abilityId: string; targets: number; beforeTotalHp: number; afterTotalHp: number; damage: number; at: number };
        enemies: Array<{
          id: string;
          hp: number;
          maxHp: number;
          x: number;
          y: number;
          warrior: WarriorKind;
          movementStyle: WarriorProfile['movementStyle'];
          pose?: string;
          frameCount?: number;
          frameIndex?: number;
          renderVariant?: string;
          motionProfile?: string;
          displayWidth: number;
          displayHeight: number;
          bodyAlive: boolean;
          bodyWidth: number;
          bodyHeight: number;
          visualScale: number;
          readableOnMap: boolean;
          damageable: boolean;
          hpChangedSinceSpawn: boolean;
          noOverlap: boolean;
          distanceToPlayer: number;
        }>;
        textOverlayCount: number;
        primitiveRouteOverlayCount: number;
      };
    }).__CODEJITSU_CHAPTER2_TRAIL = {
      remaining: this.enemies.filter((enemy) => enemy.hp > 0).length,
      portalOpen: this.enemies.every((enemy) => enemy.hp <= 0),
      usesGeneratedPortal: this.generatedPortalPieces > 0 && this.textures.exists(TextureKeys.GatePortal),
      usesGeneratedPortalOnly: true,
      generatedPortalPieces: this.generatedPortalPieces,
      primitivePortalPieces: this.primitivePortalPieces,
      portalBounds: {
        x: Math.round(Number(portalBounds?.x ?? 0)),
        y: Math.round(Number(portalBounds?.y ?? 0)),
        width: Math.round(Number(portalBounds?.width ?? 0)),
        height: Math.round(Number(portalBounds?.height ?? 0)),
        alpha: Math.round(Number(this.portalGlow?.alpha ?? 0) * 100) / 100,
        bounded: Number(portalBounds?.width ?? 9999) <= 170 && Number(portalBounds?.height ?? 9999) <= 140,
      },
      foregroundOverlay: {
        width: Math.round(Number(this.foregroundOverlay?.displayWidth ?? 0)),
        height: Math.round(Number(this.foregroundOverlay?.displayHeight ?? 0)),
        alpha: Math.round(foregroundAlpha * 100) / 100,
        quiet: foregroundAlpha <= 0.24,
      },
      outdoorScene: this.textures.exists(TextureKeys.Chapter2OutdoorTrail),
      usesImagegenWarriors: Boolean(warriorTexture),
      usesRemadeMinionVariants: warriorTexture === TextureKeys.Chapter2MinionVariants,
      activeWarriorTextureKey: warriorTexture,
      enemyArchetypeCount: new Set(this.enemies.map((enemy) => enemy.warrior)).size,
      movementStyleCount: new Set(this.enemies.map((enemy) => enemy.movementStyle)).size,
      stageVisualVariant: this.currentSegment().id,
      stageIndex: this.trailSegmentIndex,
      totalStages: trailSegments.length,
      stageName: this.currentSegment().name,
      stageId: this.currentSegment().id,
      stageVow: this.currentSegment().vow,
      stageBackdropKey: this.stageBackdrop?.texture.key ?? '',
      usesImagegenAtmosphereOverlay: this.trailAtmosphereUsesImagegen,
      primitiveBackdropShadePieces: this.trailPrimitiveBackdropShadePieces,
      atmosphereTextureKey: this.trailAtmosphereUsesImagegen ? TextureKeys.Chapter2TrailAtmosphereOverlay : 'fallback-rectangle',
      allStagesCleared: this.trailSegmentIndex >= trailSegments.length - 1 && this.enemies.every((enemy) => enemy.hp <= 0),
      chapterTwoPlaytime: playableContentAudit(),
      lastSwordDamage: this.lastSwordDamage,
      lastTerminalDamage: this.lastTerminalDamage,
      textOverlayCount: [this.hudTitle?.text, this.statusText?.text].filter((text) => String(text ?? '').trim().length > 0).length,
      primitiveRouteOverlayCount: 0,
      enemies: this.enemies.map((enemy) => {
        const nearestOtherDistance = Math.min(
          ...this.enemies
            .filter((other) => other !== enemy && other.hp > 0)
            .map((other) => Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, other.sprite.x, other.sprite.y)),
          999,
        );
        const distanceToPlayer = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.sprite.x, enemy.sprite.y);
        const body = enemy.sprite.body;
        return {
          id: enemy.id,
          hp: enemy.hp,
          maxHp: enemy.maxHp,
          x: Math.round(enemy.sprite.x * 10) / 10,
          y: Math.round(enemy.sprite.y * 10) / 10,
          warrior: enemy.warrior,
          movementStyle: enemy.movementStyle,
          pose: enemy.sprite.getData('actorPose') as string | undefined,
          frameCount: enemy.sprite.getData('actorFrameCount') as number | undefined,
          frameIndex: enemy.sprite.getData('actorFrameIndex') as number | undefined,
          renderVariant: enemy.sprite.getData('actorRenderVariant') as string | undefined,
          motionProfile: enemy.sprite.getData('motionProfile') as string | undefined,
          displayWidth: Math.round(enemy.sprite.displayWidth),
          displayHeight: Math.round(enemy.sprite.displayHeight),
          bodyAlive: Boolean(body && enemy.sprite.active),
          bodyWidth: Math.round(Number(body?.width ?? 0)),
          bodyHeight: Math.round(Number(body?.height ?? 0)),
          visualScale: Number(enemy.sprite.getData('visualScale') ?? 1),
          readableOnMap: enemy.sprite.displayWidth >= 145 && enemy.sprite.displayHeight >= 150,
          damageable: Boolean(body && enemy.sprite.active && enemy.hp > 0),
          hpChangedSinceSpawn: enemy.hp < enemy.maxHp || enemy.lastHp !== enemy.hp,
          noOverlap: nearestOtherDistance >= 104,
          distanceToPlayer: Math.round(distanceToPlayer),
        };
      }),
    };
  }
}
