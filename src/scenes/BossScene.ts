import Phaser from 'phaser';
import { firstBoss, getBossDefinition } from '../data/bosses';
import { terminalCommands } from '../data/terminalCommands';
import type { BossAttackDefinition, BossDefinition } from '../types/game';
import { createAbilityState, castAbility, pushSyntaxToken, recordComboHit, gainEnergy, type AbilityRuntimeState } from '../systems/abilityEngine';
import { applyBossDamage, chooseBossAttack, createBossState, isBossStaggered, resetBossStagger, type BossRuntimeState } from '../systems/bossEngine';
import { createBossAiProfile, shouldQueueBossCombo, type BossAiProfile } from '../systems/bossAi';
import { createGameKeys, type GameKeys } from '../systems/input';
import { clearChapter, loadSave, unlockAbility, writeSave } from '../systems/saveSystem';
import { parseTerminalCommand, tokensForCommand } from '../systems/terminalCommandEngine';
import { apprenticeMovementTuning, readMovementInput, stepMovementVelocity } from '../systems/movementEngine';
import { isTestMode } from '../systems/testMode';
import { addActorSprite, setActorPose, type ActorKind, type ActorPose } from './actors';
import { addAbilityCastBurst } from './abilityVisuals';
import { installAudioUnlock } from './audioUnlock';
import { addBossImpactVfx } from './bossImpactVfx';
import { addCombatHitMark } from './combatHitMarks';
import { addGeneratedTelegraphSigil, type TelegraphSigilKind } from './combatTelegraphs';
import { clearTextPanelAudits } from './layoutAudit';
import { PauseMenuOverlay, TerminalOverlay } from './overlays';
import { guardedSetVelocity, publishBoundaryFeedback, publishControlScheme, publishFrameHealth, publishPlayerBounds, publishSwordSwing } from './runtimeDebug';
import { SceneKeys, TextureKeys } from './sceneKeys';
import { addSeamVfx } from './seamVfx';
import { clampPointToArenaBounds, clampSpriteToArenaBounds, fadeInFromBlack, fadeToScene, type ArenaClampResult } from './transition';
import { addArenaDepthCues, addBoundaryBump, addMovementAfterimage, addForegroundDepthOverlay, addGroundCrack, addHealthBar, addHitSparks, addImpactPause, addPanel, addRoomDepthBorders, addStepDust, addSwordSwing, addVoidBurst, makePixelText, playBoom, playCast, playHit, playSlash, updateForegroundParallaxDepth, updateGroundedActorVisual } from './ui';

type BossCueState = 'neutral' | 'danger' | 'vow' | 'guard';
type PlayerCueState = 'sealed' | 'charged' | 'answered';

export class BossScene extends Phaser.Scene {
  private activeBoss: BossDefinition = firstBoss;
  private bossActorKind: ActorKind = 'oni';
  private bossArenaTexture: string = TextureKeys.NullOniArena;
  private player!: Phaser.Physics.Arcade.Sprite;
  private boss!: Phaser.Physics.Arcade.Sprite;
  private keys!: GameKeys;
  private playerHp = 100;
  private maxHp = 100;
  private abilityState: AbilityRuntimeState = createAbilityState();
  private bossState: BossRuntimeState = createBossState(this.activeBoss);
  private canStrike = true;
  private invulnerable = false;
  private guardUntil = 0;
  private playerDamageGraceUntil = 0;
  private attackCounter = 0;
  private frozenUntil = 0;
  private terminalCastUsed = false;
  private playerBar!: ReturnType<typeof addHealthBar>;
  private bossBar!: ReturnType<typeof addHealthBar>;
  private syntaxText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private playerCueIcon?: Phaser.GameObjects.Image;
  private playerCueFrameWidth = 0;
  private playerCueFrameHeight = 0;
  private playerCueState: PlayerCueState = 'sealed';
  private statusText!: Phaser.GameObjects.Text;
  private bossCueIcon?: Phaser.GameObjects.Image;
  private bossCueFrameWidth = 0;
  private bossCueFrameHeight = 0;
  private bossCueState: BossCueState = 'neutral';
  private bossTitleText?: Phaser.GameObjects.Text;
  private currentAttackBannerBounds?: Phaser.Geom.Rectangle;
  private bossHudPanel?: Phaser.GameObjects.GameObject;
  private bossStatusPanel?: Phaser.GameObjects.GameObject;
  private readonly bossHudPanelBounds = new Phaser.Geom.Rectangle(34, 604, 148, 96);
  private readonly bossStatusPanelBounds = new Phaser.Geom.Rectangle(1098, 604, 148, 96);
  private terminal!: TerminalOverlay;
  private pauseMenu!: PauseMenuOverlay;
  private finisherHint?: Phaser.GameObjects.Image;
  private finisherCueFrameWidth = 0;
  private finisherCueFrameHeight = 0;
  private finisherCueFrameIndex = 0;
  private playerShadow!: Phaser.GameObjects.Image;
  private bossShadow!: Phaser.GameObjects.Image;
  private bossOrbitAura?: Phaser.GameObjects.Image;
  private bossOrbitAuraFrameWidth = 0;
  private bossOrbitAuraFrameHeight = 0;
  private retryFromDeath = false;
  private foregroundOverlay?: Phaser.GameObjects.Image;
  private playerPoseLockedUntil = 0;
  private bossPoseLockedUntil = 0;
  private lockedPlayerPose: ActorPose = 'idle';
  private lockedBossPose: ActorPose = 'idle';
  private currentVelocity = new Phaser.Math.Vector2(0, 0);
  private lastMoveDirection = new Phaser.Math.Vector2(1, 0);
  private moveHeldMs = 0;
  private bossVelocity = new Phaser.Math.Vector2(0, 0);
  private lastStepDustAt = 0;
  private lastBoundaryFeedbackAt = 0;
  private strikeChain = 0;
  private lastStrikeAt = 0;
  private landedStrikeCount = 0;
  private lastCounterPulseAt = 0;
  private currentAiProfile: BossAiProfile = createBossAiProfile({
    hpPercent: 1,
    phaseIndex: 0,
    distanceToPlayer: 999,
    terminalCastUsed: false,
    queuedComboCount: 0,
    isStaggered: false,
  });
  private lastPublishedStance = '';
  private readonly walkableBounds = new Phaser.Geom.Rectangle(158, 166, 966, 444);
  private phaseBreakPlayed = false;
  private queuedBossCombo: BossAttackDefinition[] = [];
  private lastComboName = '';
  private comboChainIndex = 0;
  private comboTotalSteps = 0;
  private terminalGateBlockCount = 0;
  private lastBossRuntimePosition = new Phaser.Math.Vector2(0, 0);
  private bossMotionSamples = 0;
  private bossMaxFrameStep = 0;
  private bossLastFrameStep = 0;
  private bossGeneratedAfterimages = 0;
  private bossPrimitiveAfterimages = 0;
  private bossMotionSmearFrameWidth = 0;
  private bossMotionSmearFrameHeight = 0;
  private bossMotionSmearFrameCount = 0;
  private lastBossMotionSmearAt = 0;
  private bossShadowstepFrameWidth = 0;
  private bossShadowstepFrameHeight = 0;
  private bossTrailFrameWidth = 0;
  private bossTrailFrameHeight = 0;
  private bossTrailFrameCount = 0;
  private bossSmoothRepositionCount = 0;
  private bossScriptedMotionUntil = 0;
  private bossShadowstepMaskUntil = 0;
  private lastBossWarningLaneOverlayCount = 0;
  private bossAtmosphereUsesImagegen = false;
  private bossPrimitiveBackdropShadePieces = 0;
  private lastDebugPublishAt = 0;

  constructor() {
    super(SceneKeys.Boss);
  }

  init(data?: { bossId?: string; retryFromDeath?: boolean }): void {
    this.activeBoss = getBossDefinition(data?.bossId ?? 'null-oni');
    this.retryFromDeath = data?.retryFromDeath === true;
    const isReturnOni = this.activeBoss.id === 'return-oni';
    this.bossActorKind = isReturnOni ? 'returnOni' : 'oni';
    this.bossArenaTexture = isReturnOni ? TextureKeys.Chapter2RevengeArena : TextureKeys.NullOniArena;
    this.bossState = createBossState(this.activeBoss);
  }

  create(): void {
    (window as unknown as { __CODEJITSU_SCENE?: string }).__CODEJITSU_SCENE = 'boss';
    this.clearRetryRuntimeState();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.resetSceneRuntimeState());
    publishControlScheme('boss');
    (window as unknown as { __CODEJITSU_BOSS_ATTACK?: string }).__CODEJITSU_BOSS_ATTACK = '';
    installAudioUnlock(this);
    writeSave({ ...loadSave(), currentCheckpoint: this.activeBoss.chapter === 2 ? 'chapter2-boss' : 'boss' });
    this.keys = createGameKeys(this);
    this.maxHp = loadSave().playerUpgrades.maxHp;
    this.playerHp = this.maxHp;
    this.abilityState = createAbilityState(loadSave().playerUpgrades.maxEnergy);
    this.bossState = createBossState(this.activeBoss);
    this.invulnerable = false;
    this.guardUntil = 0;
    this.terminalCastUsed = false;
    this.queuedBossCombo = [];
    this.lastComboName = '';
    this.comboChainIndex = 0;
    this.comboTotalSteps = 0;
    this.terminalGateBlockCount = 0;
    (window as unknown as { __CODEJITSU_BOSS_ATTACK_HISTORY?: unknown[] }).__CODEJITSU_BOSS_ATTACK_HISTORY = [];
    this.cameras.main.setBackgroundColor('#0d0711');
    this.drawArena();
    addRoomDepthBorders(this, this.walkableBounds, { sceneId: 'boss', topDepth: 58, frontDepth: 850, accentColor: 0xb85dff });
    addArenaDepthCues(this, this.walkableBounds, { sceneId: 'boss', accentColor: 0xb85dff, foregroundDepth: 852 });
    this.foregroundOverlay = addForegroundDepthOverlay(this, 855, 0.76);
    fadeInFromBlack(this);
    this.player = addActorSprite(this, 'hero', 355, 480, TextureKeys.Hero, 1.3).setCollideWorldBounds(true).setDrag(1600);
    this.playerShadow = this.add.image(this.player.x, this.player.y + 30, TextureKeys.Shadow).setDisplaySize(86, 36).setAlpha(0.43).setDepth(this.player.y - 8);
    this.player.body?.setSize(28, 24).setOffset(18, 62);
    this.boss = addActorSprite(this, this.bossActorKind, 850, 370, TextureKeys.NullOni, this.activeBoss.id === 'return-oni' ? 1.08 : 1.38).setCollideWorldBounds(true).setDrag(900);
    this.bossShadow = this.add.image(this.boss.x, this.boss.y + 52, TextureKeys.Shadow).setDisplaySize(168, 58).setAlpha(0.48).setDepth(this.boss.y - 8);
    this.createBossOrbitAura();
    this.boss.body?.setSize(54, 42).setOffset(28, 82);
    this.lastBossRuntimePosition.set(this.boss.x, this.boss.y);
    this.bossMotionSamples = 0;
    this.bossMaxFrameStep = 0;
    this.bossLastFrameStep = 0;
    this.bossGeneratedAfterimages = 0;
    this.bossPrimitiveAfterimages = 0;
    this.lastBossMotionSmearAt = 0;
    this.bossSmoothRepositionCount = 0;
    this.bossScriptedMotionUntil = 0;
    this.bossShadowstepMaskUntil = 0;
    this.cacheBossShadowstepFrames();
    if (this.retryFromDeath) {
      this.time.delayedCall(360, () => this.playRespawnSeal());
    }
    this.createHud();
    this.terminal = new TerminalOverlay(this, (command) => this.castTerminalCommand(command));
    this.pauseMenu = new PauseMenuOverlay(
      this,
      () => this.scene.start(SceneKeys.Title),
    );
    this.bindCombatInput();
    this.scheduleBossAttack();
  }

  private clearRetryRuntimeState(): void {
    const runtime = window as Window & {
      __CODEJITSU_DEATH_SCREEN?: unknown;
      __CODEJITSU_RESULT_SCENE?: unknown;
      __CODEJITSU_TERMINAL_OPEN?: boolean;
      __CODEJITSU_PAUSED?: boolean;
      __CODEJITSU_PAUSE_MENU?: string;
      __CODEJITSU_TIME_SCALE?: number;
      __CODEJITSU_TERMINAL_INPUT?: string;
      __CODEJITSU_TERMINAL_PREVIEW?: string;
      __CODEJITSU_BOSS_WARNING_VISUAL?: unknown;
      __CODEJITSU_BOSS_TELEGRAPH?: unknown;
      __CODEJITSU_BOSS_ATTACK_BANNER_VISUAL?: unknown;
      __CODEJITSU_TRANSITION?: unknown;
      __CODEJITSU_TRANSITION_HISTORY?: unknown[];
      __CODEJITSU_RESPAWN_STATE?: unknown;
    };
    if (this.retryFromDeath) {
      runtime.__CODEJITSU_DEATH_SCREEN = undefined;
      runtime.__CODEJITSU_RESULT_SCENE = undefined;
      runtime.__CODEJITSU_BOSS_WARNING_VISUAL = undefined;
      runtime.__CODEJITSU_BOSS_TELEGRAPH = undefined;
      runtime.__CODEJITSU_BOSS_ATTACK_BANNER_VISUAL = undefined;
      runtime.__CODEJITSU_TRANSITION = undefined;
      runtime.__CODEJITSU_TRANSITION_HISTORY = [];
      clearTextPanelAudits(['result-lose', 'result-win']);
    } else {
      runtime.__CODEJITSU_RESPAWN_STATE = undefined;
    }
    runtime.__CODEJITSU_TERMINAL_OPEN = false;
    runtime.__CODEJITSU_PAUSED = false;
    runtime.__CODEJITSU_PAUSE_MENU = 'closed';
    runtime.__CODEJITSU_TIME_SCALE = 1;
    runtime.__CODEJITSU_TERMINAL_INPUT = '';
    runtime.__CODEJITSU_TERMINAL_PREVIEW = '';
  }

  private resetSceneRuntimeState(): void {
    this.time.timeScale = 1;
    if (this.physics.world) this.physics.world.timeScale = 1;
    const runtime = window as Window & {
      __CODEJITSU_TERMINAL_OPEN?: boolean;
      __CODEJITSU_PAUSED?: boolean;
      __CODEJITSU_PAUSE_MENU?: string;
      __CODEJITSU_TIME_SCALE?: number;
    };
    runtime.__CODEJITSU_TERMINAL_OPEN = false;
    runtime.__CODEJITSU_PAUSED = false;
    runtime.__CODEJITSU_PAUSE_MENU = 'closed';
    runtime.__CODEJITSU_TIME_SCALE = 1;
  }

  private cacheBossShadowstepFrames(): void {
    this.bossShadowstepFrameWidth = 0;
    this.bossShadowstepFrameHeight = 0;
    this.bossMotionSmearFrameWidth = 0;
    this.bossMotionSmearFrameHeight = 0;
    this.bossMotionSmearFrameCount = 0;
    if (this.textures.exists(TextureKeys.BossMotionSmear)) {
      const smearSource = this.textures.get(TextureKeys.BossMotionSmear).getSourceImage() as { width?: number; height?: number };
      this.bossMotionSmearFrameCount = 6;
      this.bossMotionSmearFrameWidth = Math.floor(Number(smearSource.width ?? 0) / this.bossMotionSmearFrameCount);
      this.bossMotionSmearFrameHeight = Number(smearSource.height ?? 0);
    }
    if (this.textures.exists(TextureKeys.NullOniShadowstep)) {
      const source = this.textures.get(TextureKeys.NullOniShadowstep).getSourceImage() as { width?: number; height?: number };
      this.bossShadowstepFrameWidth = Math.floor(Number(source.width ?? 0) / 4);
      this.bossShadowstepFrameHeight = Number(source.height ?? 0);
    }
    this.bossTrailFrameWidth = 0;
    this.bossTrailFrameHeight = 0;
    this.bossTrailFrameCount = 0;
    if (!this.textures.exists(TextureKeys.BossShadowstepTrail)) return;
    const trailSource = this.textures.get(TextureKeys.BossShadowstepTrail).getSourceImage() as { width?: number; height?: number };
    this.bossTrailFrameCount = 4;
    this.bossTrailFrameWidth = Math.floor(Number(trailSource.width ?? 0) / this.bossTrailFrameCount);
    this.bossTrailFrameHeight = Number(trailSource.height ?? 0);
  }

  private ensureBossTrailFrame(frameIndex: number): string | undefined {
    if (!this.textures.exists(TextureKeys.BossShadowstepTrail) || this.bossTrailFrameWidth <= 0 || this.bossTrailFrameHeight <= 0) {
      return undefined;
    }
    const safeFrame = Phaser.Math.Clamp(Math.floor(frameIndex), 0, this.bossTrailFrameCount - 1);
    const texture = this.textures.get(TextureKeys.BossShadowstepTrail) as Phaser.Textures.Texture & {
      has?: (name: string) => boolean;
    };
    const frameKey = `boss-shadowstep-trail-${safeFrame}`;
    if (!texture.has?.(frameKey)) {
      texture.add(frameKey, 0, safeFrame * this.bossTrailFrameWidth, 0, this.bossTrailFrameWidth, this.bossTrailFrameHeight);
    }
    return frameKey;
  }

  private addBossShadowstepTrail(fromX: number, fromY: number, toX: number, toY: number, tint = 0x8f7dff): void {
    const frameKeys = [0, 1, 2, 3].map((frame) => this.ensureBossTrailFrame(frame));
    if (frameKeys.some((frameKey) => !frameKey)) {
      this.addBossShadowAfterimage(12, tint);
      return;
    }
    const angle = Phaser.Math.Angle.Between(fromX, fromY, toX, toY);
    const distance = Phaser.Math.Distance.Between(fromX, fromY, toX, toY);
    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;
    const depth = Math.max(fromY, toY, this.boss.y) + 18;
    const pieces: Phaser.GameObjects.Image[] = [
      this.add.image(fromX, fromY - 18, TextureKeys.BossShadowstepTrail, frameKeys[0])
        .setDisplaySize(142, 98)
        .setDepth(depth - 2)
        .setAlpha(0.58),
      this.add.image(midX, midY - 24, TextureKeys.BossShadowstepTrail, frameKeys[1])
        .setDisplaySize(Phaser.Math.Clamp(distance + 150, 230, 430), 132)
        .setDepth(depth)
        .setRotation(angle)
        .setAlpha(0.7),
      this.add.image(toX, toY - 30, TextureKeys.BossShadowstepTrail, frameKeys[2])
        .setDisplaySize(154, 118)
        .setDepth(depth + 1)
        .setAlpha(0.66),
      this.add.image(toX, toY - 38, TextureKeys.BossShadowstepTrail, frameKeys[3])
        .setDisplaySize(170, 126)
        .setDepth(depth + 2)
        .setAlpha(0.52),
    ].map((piece) => piece
      .setTint(tint)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setData('usesImagegenShadowstepTrail', true));

    this.bossGeneratedAfterimages += pieces.length;
    this.bossSmoothRepositionCount += 1;
    this.bossShadowstepMaskUntil = Math.max(this.bossShadowstepMaskUntil, this.time.now + 420);
    this.tweens.add({
      targets: pieces,
      alpha: 0,
      scaleX: '*=0.88',
      scaleY: '*=0.88',
      y: '+=8',
      duration: 300,
      ease: 'Quad.Out',
      onComplete: () => pieces.forEach((piece) => piece.destroy()),
    });
  }

  private dashBossTo(
    x: number,
    y: number,
    durationMs: number,
    tint: number,
    onComplete?: () => void,
  ): void {
    const point = clampPointToArenaBounds(x, y, this.walkableBounds);
    const fromX = this.boss.x;
    const fromY = this.boss.y;
    const distance = Phaser.Math.Distance.Between(fromX, fromY, point.x, point.y);
    const readableMinimum = distance > 180 ? 230 : distance > 90 ? 180 : durationMs;
    const duration = Math.max(durationMs, readableMinimum, Math.ceil(distance / 1.18));
    let previousX = fromX;
    let previousY = fromY;
    this.bossScriptedMotionUntil = Math.max(this.bossScriptedMotionUntil, this.time.now + duration + 90);
    this.addBossShadowstepTrail(fromX, fromY, point.x, point.y, tint);
    this.boss.setFlipX(point.x < fromX);
    this.bossVelocity.set((point.x - fromX) / Math.max(0.001, duration / 1000), (point.y - fromY) / Math.max(0.001, duration / 1000));
    this.tweens.add({
      targets: this.boss,
      x: point.x,
      y: point.y,
      duration,
      ease: 'Cubic.InOut',
      onUpdate: () => {
        const frameSeconds = Math.max(1 / 120, Math.min(1 / 30, (this.game.loop.delta || 16.67) / 1000));
        this.bossVelocity.set((this.boss.x - previousX) / frameSeconds, (this.boss.y - previousY) / frameSeconds);
        previousX = this.boss.x;
        previousY = this.boss.y;
      },
      onComplete: () => {
        this.bossVelocity.set(0, 0);
        this.addBossShadowAfterimage(12, tint);
        onComplete?.();
      },
    });
  }

  private addBossShadowAfterimage(depthOffset = 12, tint = 0x8f7dff): void {
    if (this.textures.exists(TextureKeys.BossMotionSmear) && this.bossMotionSmearFrameWidth > 0 && this.bossMotionSmearFrameHeight > 0) {
      const speed = Math.max(1, this.bossVelocity.length());
      const frameIndex = Math.floor(this.time.now / 58) % this.bossMotionSmearFrameCount;
      const direction = this.boss.flipX ? -1 : 1;
      const ghost = this.add.image(
        this.boss.x - this.bossVelocity.x * 0.034 - direction * 18,
        this.boss.y - this.bossVelocity.y * 0.02 - 12,
        TextureKeys.BossMotionSmear,
      )
        .setOrigin(0.5)
        .setCrop(frameIndex * this.bossMotionSmearFrameWidth, 0, this.bossMotionSmearFrameWidth, this.bossMotionSmearFrameHeight)
        .setDisplaySize(this.activeBoss.id === 'return-oni' ? 184 : 210, this.activeBoss.id === 'return-oni' ? 124 : 142)
        .setFlipX(this.boss.flipX)
        .setRotation(Phaser.Math.Clamp(this.bossVelocity.x / 1500, -0.11, 0.11))
        .setAlpha(Phaser.Math.Clamp(0.42 + speed / 1050, 0.44, 0.68))
        .setTint(tint)
        .setDepth(this.boss.y - depthOffset)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setData('usesImagegenMotionSmear', true)
        .setData('motionSmearFrameIndex', frameIndex);
      this.bossGeneratedAfterimages += 1;
      this.tweens.add({
        targets: ghost,
        alpha: 0,
        scaleX: ghost.scaleX * 0.74,
        scaleY: ghost.scaleY * 0.82,
        y: ghost.y + 10,
        duration: 260,
        ease: 'Quad.Out',
        onComplete: () => ghost.destroy(),
      });
      return;
    }
    if (this.textures.exists(TextureKeys.NullOniShadowstep) && this.bossShadowstepFrameWidth > 0 && this.bossShadowstepFrameHeight > 0) {
      const speed = Math.max(1, this.bossVelocity.length());
      const frameIndex = Math.floor(this.time.now / 74) % 4;
      const ghost = this.add.image(this.boss.x - this.bossVelocity.x * 0.028, this.boss.y - this.bossVelocity.y * 0.018, TextureKeys.NullOniShadowstep)
        .setOrigin(0.5)
        .setCrop(frameIndex * this.bossShadowstepFrameWidth, 0, this.bossShadowstepFrameWidth, this.bossShadowstepFrameHeight)
        .setDisplaySize(this.activeBoss.id === 'return-oni' ? 154 : 168, this.activeBoss.id === 'return-oni' ? 124 : 132)
        .setFlipX(this.boss.flipX)
        .setRotation(Phaser.Math.Clamp(this.bossVelocity.x / 1800, -0.08, 0.08))
        .setAlpha(Phaser.Math.Clamp(0.34 + speed / 900, 0.36, 0.62))
        .setTint(tint)
        .setDepth(this.boss.y - depthOffset)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setData('usesImagegenShadowstep', true)
        .setData('shadowstepFrameIndex', frameIndex);
      this.bossGeneratedAfterimages += 1;
      this.tweens.add({
        targets: ghost,
        alpha: 0,
        scaleX: ghost.scaleX * 0.82,
        scaleY: ghost.scaleY * 0.82,
        y: ghost.y + 6,
        duration: 240,
        ease: 'Quad.Out',
        onComplete: () => ghost.destroy(),
      });
      return;
    }
    this.bossPrimitiveAfterimages += 1;
    addMovementAfterimage(this, this.boss, depthOffset, tint);
  }

  private placeBossForAttack(x: number, y: number): void {
    const point = clampPointToArenaBounds(x, y, this.walkableBounds);
    const distance = Phaser.Math.Distance.Between(this.boss.x, this.boss.y, point.x, point.y);
    if (distance > 44) {
      this.addBossShadowstepTrail(this.boss.x, this.boss.y, point.x, point.y, 0x8f7dff);
      this.boss.setAlpha(0.42);
      this.tweens.add({
        targets: this.boss,
        alpha: 1,
        duration: 150,
        ease: 'Quad.Out',
      });
    }
    this.boss.setPosition(point.x, point.y);
    this.bossVelocity.set(0, 0);
    this.safeSetVelocity(this.boss, 0, 0);
    this.lastBossRuntimePosition.set(point.x, point.y);
    this.bossLastFrameStep = 0;
  }

  private settleBossAfterAttack(x: number, y: number): void {
    this.placeBossForAttack(x, y);
    this.addBossShadowAfterimage(12, 0x8f7dff);
  }

  private playRespawnSeal(): void {
    const usesImagegenSeal = this.textures.exists(TextureKeys.RespawnSeal);
    let sealFrameCount = 0;
    if (usesImagegenSeal) {
      const texture = this.textures.get(TextureKeys.RespawnSeal);
      const source = texture.getSourceImage() as { width?: number; height?: number };
      const frameWidth = Math.floor(Number(source.width ?? 2172) / 4);
      const frameHeight = Number(source.height ?? 724);
      sealFrameCount = 4;
      const seal = this.add.image(this.player.x, this.player.y + 30, TextureKeys.RespawnSeal)
        .setOrigin(0.5)
        .setCrop(frameWidth, 0, frameWidth, frameHeight)
        .setDisplaySize(270, 126)
        .setDepth(this.player.y + 1)
        .setAlpha(0.96)
        .setBlendMode(Phaser.BlendModes.ADD);
      seal.setData('respawnFrameIndex', 1);
      [2, 3].forEach((frame, index) => {
        this.time.delayedCall((index + 1) * 115, () => {
          seal.setCrop(frame * frameWidth, 0, frameWidth, frameHeight);
          seal.setData('respawnFrameIndex', frame);
        });
      });
      this.tweens.add({
        targets: seal,
        scaleX: seal.scaleX * 1.22,
        scaleY: seal.scaleY * 1.22,
        alpha: 0,
        delay: 120,
        duration: 760,
        ease: 'Quad.Out',
        onComplete: () => seal.destroy(),
      });
    }
    this.publishRespawnRuntime(usesImagegenSeal, sealFrameCount);
  }

  private publishRespawnRuntime(usesImagegenSeal: boolean, sealFrameCount: number): void {
    const transitionState = (window as Window & { __CODEJITSU_TRANSITION?: Record<string, unknown> }).__CODEJITSU_TRANSITION;
    const staleTransitionCleared = !transitionState ||
      (transitionState.idle === 'BossScene' && transitionState.walkingGate === undefined && transitionState.gateClosed === undefined && transitionState.gateClosing === undefined);
    (window as Window & {
      __CODEJITSU_RESPAWN_STATE?: {
        scene: 'boss';
        source: 'death-retry';
        bossId: string;
        playerHp: number;
        maxHp: number;
        bossHp: number;
        abilityEnergy: number;
        terminalOpen: boolean;
        paused: boolean;
        timeScale: number;
        staleDeathCleared: boolean;
        staleResultCleared: boolean;
        staleResultLayoutCleared: boolean;
        staleBossWarningCleared: boolean;
        staleBossTelegraphCleared: boolean;
        staleBossBannerCleared: boolean;
        staleTransitionCleared: boolean;
        terminalBufferCleared: boolean;
        delayedUntilFadeClear: boolean;
        usesImagegenSeal: boolean;
        sealFrameCount: number;
        controlsReady: boolean;
        at: number;
      };
    }).__CODEJITSU_RESPAWN_STATE = {
      scene: 'boss',
      source: 'death-retry',
      bossId: this.activeBoss.id,
      playerHp: this.playerHp,
      maxHp: this.maxHp,
      bossHp: this.bossState.hp,
      abilityEnergy: Math.round(this.abilityState.energy),
      terminalOpen: false,
      paused: false,
      timeScale: 1,
      staleDeathCleared: (window as Window & { __CODEJITSU_DEATH_SCREEN?: unknown }).__CODEJITSU_DEATH_SCREEN === undefined,
      staleResultCleared: (window as Window & { __CODEJITSU_RESULT_SCENE?: unknown }).__CODEJITSU_RESULT_SCENE === undefined,
      staleResultLayoutCleared: !Boolean((window as Window & { __CODEJITSU_LAYOUT_AUDITS?: Record<string, unknown> }).__CODEJITSU_LAYOUT_AUDITS?.['result-lose'] ?? (window as Window & { __CODEJITSU_LAYOUT_AUDITS?: Record<string, unknown> }).__CODEJITSU_LAYOUT_AUDITS?.['result-win']),
      staleBossWarningCleared: (window as Window & { __CODEJITSU_BOSS_WARNING_VISUAL?: unknown }).__CODEJITSU_BOSS_WARNING_VISUAL === undefined,
      staleBossTelegraphCleared: (window as Window & { __CODEJITSU_BOSS_TELEGRAPH?: unknown }).__CODEJITSU_BOSS_TELEGRAPH === undefined,
      staleBossBannerCleared: (window as Window & { __CODEJITSU_BOSS_ATTACK_BANNER_VISUAL?: unknown }).__CODEJITSU_BOSS_ATTACK_BANNER_VISUAL === undefined,
      staleTransitionCleared,
      terminalBufferCleared: (window as Window & { __CODEJITSU_TERMINAL_INPUT?: string; __CODEJITSU_TERMINAL_PREVIEW?: string }).__CODEJITSU_TERMINAL_INPUT === '' &&
        (window as Window & { __CODEJITSU_TERMINAL_PREVIEW?: string }).__CODEJITSU_TERMINAL_PREVIEW === '',
      delayedUntilFadeClear: true,
      usesImagegenSeal,
      sealFrameCount,
      controlsReady: Boolean(this.keys && this.player.body && this.boss.body),
      at: Math.round(performance.now()),
    };
  }

  update(time: number, delta: number): void {
    publishFrameHealth('boss', delta);
    if (this.pauseMenu.isOpen || this.terminal.isOpen) {
      this.safeSetVelocity(this.player, 0, 0);
      this.safeSetVelocity(this.boss, 0, 0);
      return;
    }
    this.handleMovement(delta);
    this.handleBoundaryFeedback(clampSpriteToArenaBounds(this.player, this.walkableBounds));
    this.moveBoss(time);
    clampSpriteToArenaBounds(this.boss, this.walkableBounds);
    this.separateCombatants();
    this.updateActorShadow(this.playerShadow, this.player, 30);
    this.updateBossGrounding();
    this.updateBossMovementSmear(time);
    this.player.setDepth(this.player.y);
    this.boss.setDepth(this.boss.y);
    this.playerBar.setValue(this.playerHp, this.maxHp);
    this.bossBar.setValue(this.bossState.hp, this.activeBoss.maxHp);
    this.updatePlayerCueState();
    // Throttle debug/audit publish calls — writing large objects to window every frame is unnecessary
    if (time - this.lastDebugPublishAt > 150) {
      this.lastDebugPublishAt = time;
      this.publishBossActorRuntime();
      this.publishBossStanceRuntime();
      this.publishTerminalGateRuntime();
      this.publishBossHudLayout();
      publishPlayerBounds('boss', this.player, this.walkableBounds, 0.48);
    }
  }

  private drawArena(): void {
    const hasGeneratedArena = this.textures.exists(this.bossArenaTexture);
    if (hasGeneratedArena) {
      this.add.image(640, 360, this.bossArenaTexture).setDisplaySize(1280, 720).setAlpha(0.94);
      this.addBossArenaAtmosphere();
    } else {
      for (let row = 0; row < 10; row += 1) {
        for (let col = 0; col < 13; col += 1) {
          this.add.image(80 + col * 82 + row * 42, 190 + row * 30, TextureKeys.FloorTile).setAlpha(0.82);
        }
      }
    }
    this.bossTitleText = makePixelText(this, 640, 78, `${this.activeBoss.displayName}: ${this.activeBoss.subtitle}`, 22, '#f0c36b', 'center')
      .setOrigin(0.5)
      .setStroke('#09070d', 7)
      .setDepth(900)
      .setAlpha(0)
      .setVisible(false);
    this.publishBossBackdropRuntime(hasGeneratedArena);
  }

  private addBossArenaAtmosphere(): void {
    if (this.textures.exists(TextureKeys.BossArenaAtmosphere)) {
      const source = this.textures.get(TextureKeys.BossArenaAtmosphere).getSourceImage() as { width?: number; height?: number };
      const scale = Math.max(1280 / Number(source.width ?? 1280), 720 / Number(source.height ?? 720));
      this.add.image(640, 360, TextureKeys.BossArenaAtmosphere)
        .setScale(scale)
        .setAlpha(0.68)
        .setDepth(1)
        .setData('usesImagegenBossAtmosphere', true);
      this.bossAtmosphereUsesImagegen = true;
      this.bossPrimitiveBackdropShadePieces = 0;
      return;
    }

    this.add.rectangle(640, 360, 1280, 720, 0x09070d, 0.26).setDepth(1);
    this.bossAtmosphereUsesImagegen = false;
    this.bossPrimitiveBackdropShadePieces = 1;
  }

  private publishBossBackdropRuntime(usesGeneratedArena: boolean): void {
    const source = usesGeneratedArena
      ? this.textures.get(this.bossArenaTexture).getSourceImage() as { width?: number; height?: number }
      : undefined;
    (window as Window & {
      __CODEJITSU_BOSS_BACKDROP?: {
        scene: string;
        bossId: string;
        textureKey: string;
        usesGeneratedArena: boolean;
        usesImagegenAtmosphereOverlay: boolean;
        primitiveBackdropShadePieces: number;
        atmosphereTextureKey: string;
        bossTitleVisible: boolean;
        sourceWidth: number;
        sourceHeight: number;
        at: number;
      };
    }).__CODEJITSU_BOSS_BACKDROP = {
      scene: 'boss',
      bossId: this.activeBoss.id,
      textureKey: usesGeneratedArena ? this.bossArenaTexture : 'fallback-floor-grid',
      usesGeneratedArena,
      usesImagegenAtmosphereOverlay: this.bossAtmosphereUsesImagegen,
      primitiveBackdropShadePieces: this.bossPrimitiveBackdropShadePieces,
      atmosphereTextureKey: this.bossAtmosphereUsesImagegen ? TextureKeys.BossArenaAtmosphere : 'fallback-rectangle',
      bossTitleVisible: Boolean(this.bossTitleText?.visible && this.bossTitleText.alpha > 0.05),
      sourceWidth: Number(source?.width ?? 1280),
      sourceHeight: Number(source?.height ?? 720),
      at: Math.round(performance.now()),
    };
  }

  private createHud(): void {
    const command = this.requiredCommandText();
    const finisherCopy = this.finisherPromptCopy(command);
    this.playerBar = addHealthBar(this, 34, 56, 268, 22, 'Apprentice');
    this.bossBar = addHealthBar(this, 854, 56, 360, 24, this.activeBoss.displayName);
    this.bossHudPanel = this.createBossHudPanel(this.bossHudPanelBounds);
    this.bossStatusPanel = this.createBossHudPanel(this.bossStatusPanelBounds);
    this.bossCueIcon = this.createBossCueIcon();
    this.playerCueIcon = this.createPlayerCueIcon();
    this.syntaxText = makePixelText(this, 148, 626, '', 1, '#f0c36b')
      .setDepth(1001)
      .setAlpha(0)
      .setWordWrapWidth(1);
    this.comboText = makePixelText(this, 148, 660, '', 1, '#f6ead3')
      .setDepth(1001)
      .setAlpha(0)
      .setWordWrapWidth(1);
    this.statusText = makePixelText(this, 1138, 626, '', 1, '#cdbdcb')
      .setDepth(1001)
      .setAlpha(0)
      .setWordWrapWidth(1)
      .setLineSpacing(1);
    this.finisherHint = this.createFinisherCueIcon();
    this.publishFinisherHintRuntime(finisherCopy);
    this.setBossCueState('neutral');
    this.updatePlayerCueState();
    this.publishBossHudLayout();
  }

  private createFinisherCueIcon(): Phaser.GameObjects.Image | undefined {
    if (!this.textures.exists(TextureKeys.BossFinisherCue)) return undefined;
    const source = this.textures.get(TextureKeys.BossFinisherCue).getSourceImage() as { width?: number; height?: number };
    this.finisherCueFrameWidth = Math.floor(Number(source.width ?? 1774) / 2);
    this.finisherCueFrameHeight = Number(source.height ?? 887);
    return this.add.image(640, 552, TextureKeys.BossFinisherCue, this.ensureFinisherCueFrame(0))
      .setDisplaySize(146, 78)
      .setDepth(1002)
      .setAlpha(0)
      .setData('usesImagegenFinisherCue', true)
      .setData('finisherCueFrameIndex', 0);
  }

  private ensureFinisherCueFrame(frameIndex: number): string {
    const texture = this.textures.get(TextureKeys.BossFinisherCue) as Phaser.Textures.Texture & {
      has?: (name: string) => boolean;
    };
    const safeFrame = Phaser.Math.Clamp(frameIndex, 0, 1);
    const frameKey = `boss-finisher-cue-${safeFrame}`;
    if (!texture.has?.(frameKey)) {
      texture.add(frameKey, 0, safeFrame * this.finisherCueFrameWidth, 0, this.finisherCueFrameWidth, this.finisherCueFrameHeight);
    }
    return frameKey;
  }

  private createPlayerCueIcon(): Phaser.GameObjects.Image | undefined {
    if (!this.textures.exists(TextureKeys.BossPlayerCue)) return undefined;
    const source = this.textures.get(TextureKeys.BossPlayerCue).getSourceImage() as { width?: number; height?: number };
    this.playerCueFrameWidth = Math.floor(Number(source.width ?? 2172) / 3);
    this.playerCueFrameHeight = Number(source.height ?? 724);
    const icon = this.add.image(104, 650, TextureKeys.BossPlayerCue, this.ensurePlayerCueFrame(0))
      .setDisplaySize(82, 82)
      .setDepth(1001)
      .setAlpha(0.96)
      .setData('usesImagegenPlayerCue', true)
      .setData('playerCueFrameIndex', 0);
    this.tweens.add({
      targets: icon,
      alpha: { from: 0.84, to: 1 },
      scaleX: icon.scaleX * 1.035,
      scaleY: icon.scaleY * 1.035,
      duration: 820,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    return icon;
  }

  private ensurePlayerCueFrame(frameIndex: number): string {
    const texture = this.textures.get(TextureKeys.BossPlayerCue) as Phaser.Textures.Texture & {
      has?: (name: string) => boolean;
    };
    const safeFrame = Phaser.Math.Clamp(frameIndex, 0, 2);
    const frameKey = `boss-player-cue-${safeFrame}`;
    if (!texture.has?.(frameKey)) {
      texture.add(frameKey, 0, safeFrame * this.playerCueFrameWidth, 0, this.playerCueFrameWidth, this.playerCueFrameHeight);
    }
    return frameKey;
  }

  private setPlayerCueState(state: PlayerCueState): void {
    this.playerCueState = state;
    const frameIndex = state === 'sealed' ? 0 : state === 'charged' ? 1 : 2;
    this.playerCueIcon
      ?.setTexture(TextureKeys.BossPlayerCue, this.ensurePlayerCueFrame(frameIndex))
      .setDisplaySize(state === 'sealed' ? 82 : 88, state === 'sealed' ? 82 : 88)
      .setData('playerCueFrameIndex', frameIndex);
    this.syntaxText?.setText('');
    this.comboText?.setText('');
  }

  private updatePlayerCueState(): void {
    if (this.terminalCastUsed) {
      this.setPlayerCueState('answered');
      return;
    }
    if (this.abilityState.comboCount >= 2 || this.abilityState.energy >= 100) {
      this.setPlayerCueState('charged');
      return;
    }
    this.setPlayerCueState('sealed');
  }

  private createBossCueIcon(): Phaser.GameObjects.Image | undefined {
    if (!this.textures.exists(TextureKeys.BossCombatCue)) return undefined;
    const source = this.textures.get(TextureKeys.BossCombatCue).getSourceImage() as { width?: number; height?: number };
    this.bossCueFrameWidth = Math.floor(Number(source.width ?? 2172) / 4);
    this.bossCueFrameHeight = Number(source.height ?? 724);
    const icon = this.add.image(1172, 650, TextureKeys.BossCombatCue, this.ensureBossCueFrame(0))
      .setDisplaySize(82, 82)
      .setDepth(1001)
      .setAlpha(0.96)
      .setData('usesImagegenBossCue', true)
      .setData('bossCueFrameIndex', 0);
    this.tweens.add({
      targets: icon,
      alpha: { from: 0.84, to: 1 },
      scaleX: icon.scaleX * 1.035,
      scaleY: icon.scaleY * 1.035,
      duration: 760,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    return icon;
  }

  private ensureBossCueFrame(frameIndex: number): string {
    const texture = this.textures.get(TextureKeys.BossCombatCue) as Phaser.Textures.Texture & {
      has?: (name: string) => boolean;
    };
    const safeFrame = Phaser.Math.Clamp(frameIndex, 0, 3);
    const frameKey = `boss-combat-cue-${safeFrame}`;
    if (!texture.has?.(frameKey)) {
      texture.add(frameKey, 0, safeFrame * this.bossCueFrameWidth, 0, this.bossCueFrameWidth, this.bossCueFrameHeight);
    }
    return frameKey;
  }

  private setBossCueState(state: BossCueState): void {
    this.bossCueState = state;
    const frameIndex = state === 'neutral' ? 0 : state === 'danger' ? 1 : state === 'vow' ? 2 : 3;
    this.bossCueIcon
      ?.setTexture(TextureKeys.BossCombatCue, this.ensureBossCueFrame(frameIndex))
      .setDisplaySize(state === 'neutral' ? 82 : 88, state === 'neutral' ? 82 : 88)
      .setData('bossCueFrameIndex', frameIndex);
    this.statusText?.setText('');
  }

  private createBossHudPanel(bounds: Phaser.Geom.Rectangle): Phaser.GameObjects.GameObject {
    if (this.textures.exists(TextureKeys.BossHudPanel)) {
      return this.add.image(bounds.centerX, bounds.centerY, TextureKeys.BossHudPanel)
        .setDisplaySize(bounds.width, bounds.height)
        .setDepth(1000)
        .setAlpha(0.94)
        .setData('usesImagegenHudPanel', true);
    }
    return addPanel(this, bounds.x, bounds.y, bounds.width, bounds.height, 0.72)
      .setDepth(1000);
  }

  private requiredCommandText(): string {
    return terminalCommands.find((command) => command.abilityId === this.activeBoss.unlockReward)?.command ?? 'try.catch';
  }

  private finisherPromptCopy(command = this.requiredCommandText()): string {
    return `Mask cracked: open T and vow ${command}`;
  }

  private bindCombatInput(): void {
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (this.terminal.handleKey(event)) return;
      if (this.pauseMenu.handleKey(event)) return;
      if (event.key === 'Escape') {
        this.pauseMenu.toggle();
        return;
      }
      if (this.pauseMenu.isOpen) return;
      if (event.key.toLowerCase() === 'x') this.strike();
      if (event.key.toLowerCase() === 't') this.terminal.open(event.timeStamp);
    });
    if (isTestMode()) {
      this.input.keyboard?.on('keydown-L', () => this.damageBoss(this.activeBoss.maxHp));
    }
  }

  private handleMovement(delta: number): void {
    const speed = this.invulnerable ? 390 : 218;
    const input = readMovementInput(this.keys);
    const wantsMove = input.x * input.x + input.y * input.y > 0;
    this.moveHeldMs = wantsMove ? Math.min(this.moveHeldMs + delta, 1400) : 0;
    const movement = stepMovementVelocity(this.currentVelocity, input, delta, {
      ...apprenticeMovementTuning,
      speed: this.invulnerable ? speed : apprenticeMovementTuning.speed,
    }, this.moveHeldMs);
    if (movement.moving) {
      this.lastMoveDirection.copy(movement.direction);
    }
    this.safeSetVelocity(this.player, movement.velocity.x, movement.velocity.y);
    if (this.time.now < this.playerPoseLockedUntil) {
      setActorPose(this.player, this.lockedPlayerPose);
    } else {
      setActorPose(this.player, movement.moving ? (movement.runFactor > 1.08 ? 'run' : 'walk') : 'idle');
    }
    updateGroundedActorVisual(this, this.player, this.playerShadow, 30, movement, { width: 86, height: 36, alpha: 0.43 });
    updateForegroundParallaxDepth(this, 'boss', this.foregroundOverlay, movement, 0.36);
    const dustDelay = movement.strideIntervalMs;
    if (movement.strideIntensity > 0.34 && movement.velocity.x * movement.velocity.x + movement.velocity.y * movement.velocity.y > 8200 && this.time.now - this.lastStepDustAt > dustDelay) {
      this.lastStepDustAt = this.time.now;
      addStepDust(this, this.player.x, this.player.y, this.player.y - 6, this.lastMoveDirection.x || 1);
    }
    if (this.lastMoveDirection.x < -0.1) this.player.setFlipX(true);
    if (this.lastMoveDirection.x > 0.1) this.player.setFlipX(false);
  }

  private moveBoss(time: number): void {
    this.currentAiProfile = this.createCurrentAiProfile();
    if (this.bossState.defeated || time < this.frozenUntil || time < this.bossScriptedMotionUntil || isBossStaggered(this.activeBoss, this.bossState)) {
      this.safeSetVelocity(this.boss, 0, 0);
      if (time >= this.bossScriptedMotionUntil) this.bossVelocity.set(0, 0);
      if (this.time.now < this.bossPoseLockedUntil) {
        setActorPose(this.boss, this.lockedBossPose);
      } else {
        setActorPose(this.boss, isBossStaggered(this.activeBoss, this.bossState) ? 'stagger' : 'idle');
      }
      return;
    }
    const phase = this.activeBoss.phases[this.bossState.phaseIndex] ?? this.activeBoss.phases[0];
    const distance = Math.max(1, Phaser.Math.Distance.Between(this.boss.x, this.boss.y, this.player.x, this.player.y));
    const angle = Phaser.Math.Angle.Between(this.boss.x, this.boss.y, this.player.x, this.player.y);
    const desiredDistance = this.currentAiProfile.desiredDistance;
    const tooClose = distance < desiredDistance * 0.92;
    const tooFar = distance > desiredDistance * 1.16;
    const spacing = tooFar ? 1 : tooClose ? -0.76 : 0.16;
    const orbitDirection = this.player.x < this.walkableBounds.centerX ? 1 : -1;
    const toward = new Phaser.Math.Vector2(Math.cos(angle) * spacing, Math.sin(angle) * spacing * 0.78);
    const orbitBoost = tooClose ? Math.max(0.64, this.currentAiProfile.orbitStrength + 0.24) : this.currentAiProfile.orbitStrength;
    const orbit = new Phaser.Math.Vector2(
      Math.cos(angle + Math.PI / 2) * orbitBoost * orbitDirection,
      Math.sin(angle + Math.PI / 2) * orbitBoost * 0.78 * orbitDirection,
    );
    const desired = toward.add(orbit);
    if (desired.lengthSq() < 0.001) desired.set(Math.cos(angle + Math.PI / 2) * orbitDirection, Math.sin(angle + Math.PI / 2) * 0.78 * orbitDirection);
    const speedScale = tooClose ? 0.86 : tooFar ? 1 : 0.72;
    const targetSpeed = Math.max(72, phase.speed * this.currentAiProfile.moveSpeedMultiplier * speedScale);
    desired.normalize().scale(targetSpeed);
    const damping = this.currentAiProfile.stance === 'cornered' ? 0.14 : tooClose ? 0.18 : 0.12;
    this.bossVelocity.lerp(desired, damping);
    this.safeSetVelocity(this.boss, this.bossVelocity.x, this.bossVelocity.y);
    this.boss.setFlipX(this.boss.x > this.player.x);
    if (this.time.now < this.bossPoseLockedUntil) setActorPose(this.boss, this.lockedBossPose);
    else setActorPose(this.boss, this.bossVelocity.lengthSq() > 640 ? 'walk' : 'idle');
  }

  private createCurrentAiProfile(): BossAiProfile {
    return createBossAiProfile({
      hpPercent: this.bossState.hp / this.activeBoss.maxHp,
      phaseIndex: this.bossState.phaseIndex,
      distanceToPlayer: Phaser.Math.Distance.Between(this.boss.x, this.boss.y, this.player.x, this.player.y),
      terminalCastUsed: this.terminalCastUsed,
      queuedComboCount: this.queuedBossCombo.length,
      isStaggered: isBossStaggered(this.activeBoss, this.bossState),
    });
  }

  private strike(): void {
    if (!this.canStrike || this.bossState.defeated) return;
    this.canStrike = false;
    this.strikeChain = this.time.now - this.lastStrikeAt > 640 ? 0 : (this.strikeChain + 1) % 3;
    this.lastStrikeAt = this.time.now;
    const variant = this.strikeChain;
    this.playerPoseLockedUntil = this.time.now + (variant === 2 ? 360 : 280);
    this.lockedPlayerPose = 'swing';
    setActorPose(this.player, 'swing');
    playSlash(this);
    const targetId = this.activeBoss.id;
    const slashDirection = this.boss.x < this.player.x ? -1 : 1;
    this.player.setFlipX(slashDirection < 0);
    this.lastMoveDirection.set(slashDirection, 0);
    this.player.x += slashDirection * (variant === 2 ? 22 : 13);
    this.currentVelocity.set(slashDirection * (variant === 2 ? 145 : 100), this.currentVelocity.y * 0.22);
    this.safeSetVelocity(this.player, this.currentVelocity.x, this.currentVelocity.y);
    this.handleBoundaryFeedback(clampSpriteToArenaBounds(this.player, this.walkableBounds));
    const sword = addSwordSwing(this, this.player.x, this.player.y, slashDirection as 1 | -1, this.player.y + 24, variant);
    publishSwordSwing('boss', this.player.x, this.player.y, sword.hitX, sword.hitY, variant, targetId, sword);
    const slashX = sword.hitX;

    const swordDistance = Phaser.Math.Distance.Between(slashX, sword.hitY, this.boss.x, this.boss.y);
    const bodyDistance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.boss.x, this.boss.y);
    if (Math.min(swordDistance, bodyDistance) < (variant === 2 ? 178 : 152)) {
      const damage = variant === 2 ? 32 : 22;
      const hitStopMs = variant === 2 ? 112 : 78;
      const hitStopScale = variant === 2 ? 0.09 : 0.15;
      const shakeMs = variant === 2 ? 145 : 100;
      const shakeIntensity = variant === 2 ? 0.0085 : 0.0052;
      const knockback = variant === 2 ? 34 : 21;
      this.damageBoss(damage);
      playHit(this);
      addHitSparks(this, this.boss.x, this.boss.y - 44, this.boss.y + 20);
      addImpactPause(this, hitStopMs, hitStopScale);
      this.cameras.main.shake(shakeMs, shakeIntensity);
      this.boss.x += slashDirection * knockback;
      this.boss.y -= variant === 2 ? 4 : 0;
      this.abilityState = gainEnergy(recordComboHit(this.abilityState), variant === 2 ? 12 : 8, 100);
      this.landedStrikeCount += 1;
      this.publishBossHitFeedback(variant, damage, sword.hitX, sword.hitY, {
        hitStopMs,
        hitStopScale,
        shakeMs,
        shakeIntensity,
        knockback,
        recoilDirection: slashDirection,
      });
      this.addBossSwordClash(variant, sword.hitX, sword.hitY, slashDirection);
      this.maybeBossCounterPulse();
      this.flashBoss(variant, slashDirection);
    }

    this.time.delayedCall(variant === 2 ? 320 : 230, () => {
      this.canStrike = true;
      setActorPose(this.player, 'idle');
    });
  }

  private maybeBossCounterPulse(): void {
    if (this.landedStrikeCount % 2 !== 0 || this.time.now - this.lastCounterPulseAt < 1500) return;
    if (this.bossState.defeated || this.time.now < this.frozenUntil || isBossStaggered(this.activeBoss, this.bossState)) return;
    this.lastCounterPulseAt = this.time.now;
    this.setBossCueState('danger');
    this.bossPoseLockedUntil = this.time.now + 520;
    this.lockedBossPose = 'attack';
    setActorPose(this.boss, 'attack');
    const pulse = addBossImpactVfx(this, 'palm', this.boss.x, this.boss.y - 4, {
      width: 188,
      height: 138,
      depth: this.boss.y + 8,
      alpha: 0.68,
      tint: 0xb85dff,
    }) ?? this.add.circle(this.boss.x, this.boss.y, 52, 0xb85dff, 0.16)
      .setStrokeStyle(4, 0xf6ead3, 0.38)
      .setDepth(this.boss.y + 8);
    const counterMark = addCombatHitMark(this, 'hurt', this.boss.x, this.boss.y - 44, {
      sceneId: 'boss',
      abilityId: 'boss-counter',
      width: 150,
      height: 96,
      depth: this.boss.y + 14,
      tint: 0xb85dff,
      lifespanMs: 760,
      driftY: -10,
    });
    this.tweens.add({
      targets: counterMark ? [pulse, counterMark] : [pulse],
      alpha: 0.58,
      scale: 1.24,
      duration: 280,
      yoyo: true,
      ease: 'Sine.InOut',
      onComplete: () => {
        if (this.bossState.defeated) {
          pulse.destroy();
          if (counterMark?.active) counterMark.destroy();
          return;
        }
        playBoom(this, 0.62);
        addVoidBurst(this, this.boss.x, this.boss.y - 16, 0xb85dff, this.boss.y + 20);
        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.boss.x, this.boss.y);
        if (!this.isPlayerProtected() && distance < 190) {
          this.damagePlayer(5);
          const angle = Phaser.Math.Angle.Between(this.boss.x, this.boss.y, this.player.x, this.player.y);
          const push = new Phaser.Math.Vector2(Math.cos(angle) * 260, Math.sin(angle) * 180);
          this.currentVelocity.copy(push);
          this.safeSetVelocity(this.player, push.x, push.y);
        }
        this.cameras.main.shake(100, 0.004);
        pulse.destroy();
        if (counterMark?.active) counterMark.destroy();
        if (!this.bossState.defeated) setActorPose(this.boss, 'idle');
      },
    });
  }

  private castTerminalCommand(input: string): void {
    const parsed = parseTerminalCommand(input);
    if (!parsed.command) {
      this.setBossCueState('vow');
      return;
    }
    let commandState = this.abilityState;
    tokensForCommand(parsed.command.command).forEach((token) => {
      commandState = pushSyntaxToken(commandState, token, 2);
    });
    this.abilityState = commandState;
    this.cast();
  }

  private cast(): void {
    const [nextState, result] = castAbility(this.abilityState, loadSave().unlockedAbilities, this.time.now);
    this.abilityState = nextState;
    if (!result.ok || !result.ability) {
      this.setBossCueState('vow');
      return;
    }

    const ability = result.ability;
    this.terminalCastUsed = this.terminalCastUsed || ability.id === this.activeBoss.unlockReward;
    playCast(this);
    this.setBossCueState('guard');
    const icon = addAbilityCastBurst(this, this.player.x, this.player.y, ability.id, this.player.y + 120);
    const hit = addBossImpactVfx(this, ability.effectType === 'counter' ? 'palm' : 'ring', this.player.x, this.player.y + 4, {
      width: Math.max(190, ability.hitbox.width),
      height: Math.max(126, ability.hitbox.height * 0.62),
      depth: this.player.y + 30,
      alpha: 0.7,
      tint: 0x8f7dff,
    }) ?? this.add.ellipse(this.player.x, this.player.y, ability.hitbox.width, ability.hitbox.height, 0x8f7dff, 0.22)
      .setDepth(this.player.y + 30);
    this.tweens.add({
      targets: hit,
      alpha: 0,
      scale: 1.4,
      duration: ability.hitbox.durationMs,
      onComplete: () => hit.destroy(),
    });
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
      scene: 'boss',
      abilityId: ability.id,
      usesGeneratedIcon: Boolean(icon),
      usesGeneratedEffect: Boolean(icon?.getData('usesGeneratedEffect')),
      effectFrameCount: Number(icon?.getData('effectFrameCount') ?? 0),
      at: Math.round(performance.now()),
    };

    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.boss.x, this.boss.y);
    const commandReach = 9999;
    let damageApplied = 0;
    if (distance < commandReach) {
      const bonus = isBossStaggered(this.activeBoss, this.bossState) && ability.effectType === 'execute' ? 40 : 0;
      damageApplied = ability.id === 'try-catch' ? Math.max(24, ability.hitbox.damage) + bonus : ability.hitbox.damage + bonus;
      this.damageBoss(damageApplied);
      this.flashBoss();
      this.addBossVowImpact(ability.id, damageApplied);
    }
    (window as Window & {
      __CODEJITSU_LAST_ABILITY_DAMAGE?: {
        scene: string;
        abilityId: string;
        targets: number;
        damage: number;
        reach: number;
        distance: number;
        at: number;
      };
    }).__CODEJITSU_LAST_ABILITY_DAMAGE = {
      scene: 'boss',
      abilityId: ability.id,
      targets: damageApplied > 0 ? 1 : 0,
      damage: damageApplied,
      reach: commandReach,
      distance: Math.round(distance * 10) / 10,
      at: Math.round(performance.now()),
    };

    if (ability.effectType === 'freeze' || ability.effectType === 'counter') {
      const freezeMs = ability.effectType === 'counter' ? 1450 : 900;
      this.frozenUntil = this.time.now + freezeMs;
      this.bossPoseLockedUntil = this.time.now + freezeMs;
      this.lockedBossPose = 'stagger';
      setActorPose(this.boss, 'stagger');
      this.boss.setTint(0x8f7dff);
      this.time.delayedCall(freezeMs, () => this.boss.clearTint());
    }
    if (ability.effectType === 'counter') {
      this.activateTryCatchGuard(6200);
    }
  }

  private activateTryCatchGuard(durationMs: number): void {
    const healed = Math.min(20, this.maxHp - this.playerHp);
    this.playerHp = Math.min(this.maxHp, this.playerHp + 20);
    this.invulnerable = true;
    this.guardUntil = Math.max(this.guardUntil, this.time.now + durationMs);
    this.player.setTint(0x8f7dff);
    const guardSigil = addGeneratedTelegraphSigil(this, 'boss', 'palm', this.player.x, this.player.y + 26, {
      width: 178,
      height: 112,
      depth: this.player.y + 36,
      alpha: 0.72,
      tint: 0x8f7dff,
      lifespanMs: 920,
    });
    this.setBossCueState('guard');
    this.publishTryCatchGuardRuntime(durationMs, healed, Boolean(guardSigil));
    this.time.delayedCall(durationMs, () => {
      if (this.time.now < this.guardUntil - 16) return;
      this.invulnerable = false;
      this.player.clearTint();
      this.publishTryCatchGuardRuntime(0, 0, Boolean(guardSigil));
    });
  }

  private publishTryCatchGuardRuntime(durationMs: number, healed: number, usesGeneratedSigil: boolean): void {
    (window as Window & {
      __CODEJITSU_TRY_CATCH_GUARD?: {
        scene: string;
        active: boolean;
        durationMs: number;
        guardUntil: number;
        playerHp: number;
        healed: number;
        usesGeneratedSigil: boolean;
        bossFrozen: boolean;
        at: number;
      };
    }).__CODEJITSU_TRY_CATCH_GUARD = {
      scene: 'boss',
      active: this.invulnerable,
      durationMs,
      guardUntil: Math.round(this.guardUntil),
      playerHp: this.playerHp,
      healed,
      usesGeneratedSigil,
      bossFrozen: this.time.now < this.frozenUntil,
      at: Math.round(performance.now()),
    };
  }

  private addBossVowImpact(abilityId: string, damage: number): void {
    const thread = this.add.graphics().setDepth(Math.max(this.player.y, this.boss.y) + 96).setAlpha(0);
    thread.lineStyle(4, 0x8f7dff, 0.78);
    thread.beginPath();
    thread.moveTo(this.player.x, this.player.y - 34);
    const fromX = this.player.x;
    const fromY = this.player.y - 34;
    const toX = this.boss.x;
    const toY = this.boss.y - 54;
    const controlX = (fromX + toX) / 2;
    const controlY = Math.min(fromY, toY) - 96;
    for (let step = 1; step <= 10; step += 1) {
      const t = step / 10;
      const x = ((1 - t) * (1 - t) * fromX) + (2 * (1 - t) * t * controlX) + (t * t * toX);
      const y = ((1 - t) * (1 - t) * fromY) + (2 * (1 - t) * t * controlY) + (t * t * toY);
      thread.lineTo(x, y);
    }
    thread.strokePath();
    const mark = addCombatHitMark(this, abilityId === 'try-catch' ? 'counter' : 'vow', this.boss.x, this.boss.y - 84, {
      sceneId: 'boss',
      abilityId,
      width: abilityId === 'try-catch' ? 168 : 178,
      height: abilityId === 'try-catch' ? 126 : 108,
      depth: this.boss.y + 122,
      tint: abilityId === 'try-catch' ? 0xbda3ff : 0xf0c36b,
      lifespanMs: 700,
    });
    this.tweens.add({
      targets: thread,
      alpha: { from: 0, to: 0.94 },
      duration: 110,
      yoyo: true,
      hold: 120,
      onComplete: () => thread.destroy(),
    });
    if (mark) mark.setData('bossVowDamage', damage);
  }

  private damageBoss(damage: number): void {
    const previousPhase = this.bossState.phaseIndex;
    this.bossState = applyBossDamage(this.activeBoss, this.bossState, damage);
    if (this.bossState.defeated) {
      this.winFight();
      return;
    }
    if (!this.phaseBreakPlayed && this.bossState.phaseIndex > previousPhase) {
      this.attackCounter = 0;
      this.playPhaseBreak();
    }
    if (isBossStaggered(this.activeBoss, this.bossState)) {
      const command = this.requiredCommandText();
      const finisherCopy = this.finisherPromptCopy(command);
      this.setBossCueState('vow');
      this.showFinisherPrompt(finisherCopy);
      this.publishFinisherHintRuntime(finisherCopy);
      this.bossPoseLockedUntil = this.time.now + 1500;
      this.lockedBossPose = 'stagger';
      setActorPose(this.boss, 'stagger');
      this.boss.setTint(0xf0c36b);
      this.time.delayedCall(1500, () => {
        this.bossState = resetBossStagger(this.bossState);
        this.boss.clearTint();
      });
    }
  }

  private flashBoss(variant = 0, direction: 1 | -1 = 1): void {
    const recoilMs = variant === 2 ? 230 : 170;
    this.bossPoseLockedUntil = this.time.now + recoilMs;
    this.lockedBossPose = 'hurt';
    setActorPose(this.boss, 'hurt');
    this.boss.setTintFill(0xf6ead3);
    const startRotation = this.boss.rotation;
    this.boss.setRotation(startRotation - direction * (variant === 2 ? 0.08 : 0.045));
    this.tweens.add({
      targets: this.boss,
      rotation: startRotation,
      scaleX: this.boss.scaleX * (variant === 2 ? 1.04 : 1.025),
      scaleY: this.boss.scaleY * (variant === 2 ? 0.96 : 0.98),
      duration: Math.floor(recoilMs * 0.5),
      yoyo: true,
      ease: 'Quad.Out',
    });
    this.time.delayedCall(Math.min(120, recoilMs), () => {
      this.boss.clearTint();
      if (!this.bossState.defeated) setActorPose(this.boss, 'idle');
    });
  }

  private addBossSwordClash(variant: number, hitX: number, hitY: number, direction: 1 | -1): void {
    const color = variant === 2 ? 0xf0c36b : 0xf6ead3;
    const impact = addBossImpactVfx(this, variant === 2 ? 'crescent' : 'slash-line', hitX, hitY - 6, {
      width: variant === 2 ? 190 : 150,
      height: variant === 2 ? 146 : 92,
      depth: this.boss.y + 42,
      rotation: direction > 0 ? -0.45 : 0.45,
      alpha: 0.84,
      tint: color,
    }) ?? this.add.circle(hitX, hitY, variant === 2 ? 42 : 32, color, 0.16)
      .setStrokeStyle(variant === 2 ? 7 : 5, 0xf6ead3, 0.64)
      .setDepth(this.boss.y + 42);
    const bladeMark = addBossImpactVfx(this, 'slash-line', hitX - direction * 18, hitY - 14, {
      width: variant === 2 ? 172 : 132,
      height: variant === 2 ? 72 : 54,
      depth: this.boss.y + 44,
      rotation: direction > 0 ? -0.45 : 0.45,
      alpha: 0.74,
      tint: 0xf0c36b,
    }) ?? this.add.rectangle(hitX - direction * 12, hitY - 10, variant === 2 ? 118 : 88, variant === 2 ? 10 : 7, 0xf0c36b, 0.74)
      .setRotation(direction > 0 ? -0.45 : 0.45)
      .setDepth(this.boss.y + 44);
    this.tweens.add({
      targets: [impact, bladeMark],
      alpha: 0,
      scale: 1.42,
      y: '-=18',
      duration: variant === 2 ? 360 : 280,
      ease: 'Quad.Out',
      onComplete: () => {
        impact.destroy();
        bladeMark.destroy();
      },
    });
  }

  private publishBossHitFeedback(variant: number, damage: number, hitX: number, hitY: number, impact: {
    hitStopMs: number;
    hitStopScale: number;
    shakeMs: number;
    shakeIntensity: number;
    knockback: number;
    recoilDirection: 1 | -1;
  }): void {
    (window as Window & {
      __CODEJITSU_BOSS_HIT_FEEDBACK?: {
        weapon: string;
        inputKey: string;
        target: string;
        variant: number;
        damage: number;
        hitX: number;
        hitY: number;
        comboCount: number;
        energy: number;
        bossReactionPose: string;
        hitStopMs: number;
        hitStopScale: number;
        cameraShakeMs: number;
        cameraShakeIntensity: number;
        knockback: number;
        recoilDirection: 1 | -1;
        clashVisual: string;
        impactClass: string;
        at: number;
      };
    }).__CODEJITSU_BOSS_HIT_FEEDBACK = {
      weapon: 'sword',
      inputKey: 'x',
      target: this.activeBoss.id,
      variant,
      damage,
      hitX: Math.round(hitX * 10) / 10,
      hitY: Math.round(hitY * 10) / 10,
      comboCount: this.abilityState.comboCount,
      energy: Math.round(this.abilityState.energy),
      bossReactionPose: 'hurt',
      hitStopMs: impact.hitStopMs,
      hitStopScale: impact.hitStopScale,
      cameraShakeMs: impact.shakeMs,
      cameraShakeIntensity: impact.shakeIntensity,
      knockback: impact.knockback,
      recoilDirection: impact.recoilDirection,
      clashVisual: 'sword-break-clash',
      impactClass: variant === 2 ? 'heavy-finisher' : 'clean-sword-hit',
      at: Math.round(performance.now()),
    };
  }

  private playPhaseBreak(): void {
    this.phaseBreakPlayed = true;
    this.frozenUntil = this.time.now + 1050;
    this.bossPoseLockedUntil = this.time.now + 1050;
    this.lockedBossPose = 'attack';
    this.setBossCueState('danger');
    setActorPose(this.boss, 'attack');
    this.safeSetVelocity(this.boss, 0, 0);
    this.boss.setTint(0xb85dff);
    this.cameras.main.shake(420, 0.011);
    playBoom(this, 1.18);

    const usesImagegenRupture = this.textures.exists(TextureKeys.BossPhaseRupture);
    const phaseOmen = usesImagegenRupture
      ? this.add.image(640, 190, TextureKeys.BossPhaseRupture)
        .setDisplaySize(520, 174)
        .setDepth(1200)
        .setAlpha(0)
        .setTint(0xe5c7ff)
        .setData('usesImagegenPhaseRupture', true)
      : addBossImpactVfx(this, 'ring', 640, 190, {
        width: 280,
        height: 130,
        depth: 1200,
        alpha: 0,
        tint: 0xb85dff,
      });
    const omenScaleX = phaseOmen?.scaleX ?? 1;
    const omenScaleY = phaseOmen?.scaleY ?? 1;
    this.tweens.add({
      targets: [phaseOmen].filter(Boolean),
      alpha: 1,
      y: '-=12',
      scaleX: usesImagegenRupture ? omenScaleX * 1.05 : omenScaleX,
      scaleY: usesImagegenRupture ? omenScaleY * 1.05 : omenScaleY,
      duration: 180,
      yoyo: true,
      hold: 520,
      ease: 'Quad.Out',
      onComplete: () => {
        phaseOmen?.destroy();
      },
    });
    (window as Window & {
      __CODEJITSU_BOSS_PHASE_BREAK_VISUAL?: {
        usesImagegenPhaseRupture: boolean;
        primitivePhasePieces: number;
        textLineCount: number;
        textureKey: string;
        at: number;
      };
    }).__CODEJITSU_BOSS_PHASE_BREAK_VISUAL = {
      usesImagegenPhaseRupture: usesImagegenRupture,
      primitivePhasePieces: usesImagegenRupture ? 0 : 1,
      textLineCount: 0,
      textureKey: usesImagegenRupture ? TextureKeys.BossPhaseRupture : 'fallback-impact-vfx',
      at: Math.round(performance.now()),
    };

    const shockwave = addBossImpactVfx(this, 'ring', this.boss.x, this.boss.y + 4, {
      width: 216,
      height: 144,
      depth: this.boss.y - 2,
      alpha: 0.72,
      tint: 0xb85dff,
    }) ?? addGeneratedTelegraphSigil(this, 'boss', 'ring', this.boss.x, this.boss.y - 2, {
      width: 216,
      height: 144,
      depth: this.boss.y - 2,
      alpha: 0.58,
      tint: 0xb85dff,
    });
    const cracks = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((index) => {
      const angle = (Math.PI * 2 * index) / 10;
      const length = 164;
      const crack = addBossImpactVfx(this, 'slash-line', this.boss.x + Math.cos(angle) * 110, this.boss.y + Math.sin(angle) * 52, {
        width: length,
        height: 48,
        depth: this.boss.y - 1 + index,
        rotation: angle,
        alpha: 0.5,
        tint: 0x8f7dff,
      }) ?? addSeamVfx(this, 'boss', 'slash', this.boss.x + Math.cos(angle) * 110, this.boss.y + Math.sin(angle) * 52, {
        width: 124,
        height: 72,
        depth: this.boss.y - 1 + index,
        rotation: angle,
        alpha: 0.5,
        tint: 0x8f7dff,
      });
      return crack ? [crack] : [];
    });
    for (let index = 0; index < 12; index += 1) {
      const angle = (Math.PI * 2 * index) / 12;
      const glyph = addSeamVfx(
        this,
        'boss',
        index % 2 === 0 ? 'motes' : 'spark',
        this.boss.x + Math.cos(angle) * 96,
        this.boss.y + Math.sin(angle) * 54,
        {
          width: index % 2 === 0 ? 86 : 62,
          height: index % 2 === 0 ? 70 : 54,
          depth: this.boss.y + 20,
          alpha: 0.66,
          tint: 0xb85dff,
          lifespanMs: 760,
        },
      );
      if (!glyph) continue;
      this.tweens.add({
        targets: glyph,
        x: this.boss.x + Math.cos(angle) * 220,
        y: this.boss.y + Math.sin(angle) * 122,
        alpha: 0,
        duration: 760,
        ease: 'Quad.Out',
        onComplete: () => glyph.destroy(),
      });
    }
    if (shockwave) {
      this.tweens.add({
        targets: shockwave,
        scaleX: shockwave.scaleX * 1.9,
        scaleY: shockwave.scaleY * 1.9,
        alpha: 0,
        duration: 620,
        ease: 'Quad.Out',
        onComplete: () => shockwave.destroy(),
      });
    }
    if (cracks.length > 0) {
      this.tweens.add({
        targets: cracks,
        alpha: 0,
        duration: 720,
        onComplete: () => cracks.forEach((crack) => crack.destroy()),
      });
    }
    this.time.delayedCall(1050, () => {
      this.boss.clearTint();
      setActorPose(this.boss, 'idle');
    });
  }

  private scheduleBossAttack(): void {
    this.currentAiProfile = this.createCurrentAiProfile();
    this.time.delayedCall(this.currentAiProfile.attackDelayMs, () => this.runBossAttack());
  }

  private runBossAttack(): void {
    if (this.bossState.defeated) return;
    if (this.time.now < this.frozenUntil || this.pauseMenu.isOpen || this.terminal.isOpen) {
      this.scheduleBossAttack();
      return;
    }
    this.currentAiProfile = this.createCurrentAiProfile();
    const queuedAttack = this.queuedBossCombo.shift();
    const attack = queuedAttack ?? chooseBossAttack(this.activeBoss, this.bossState, this.attackCounter);
    if (!queuedAttack) {
      this.comboTotalSteps = 0;
      this.lastComboName = '';
      this.attackCounter += 1;
      this.queuePhaseCombo(attack);
    }
    if (!attack) {
      this.scheduleBossAttack();
      return;
    }

    this.setBossCueState(queuedAttack ? 'danger' : 'neutral');
    this.showStancePressure();
    this.publishBossAttackRuntime(attack, Boolean(queuedAttack));
    this.showAttackBanner(attack);
    if (queuedAttack) this.showComboCallout(attack);
    this.bossPoseLockedUntil = this.time.now + attack.windupMs + attack.activeMs;
    this.bossScriptedMotionUntil = Math.max(this.bossScriptedMotionUntil, this.time.now + attack.windupMs + attack.activeMs + 120);
    this.lockedBossPose = 'attack';
    setActorPose(this.boss, 'attack');
    if (attack.behavior === 'void-cleave') {
      this.frozenUntil = Math.max(this.frozenUntil, this.time.now + attack.windupMs + attack.activeMs + 80);
      this.safeSetVelocity(this.boss, 0, 0);
      this.bossVelocity.set(0, 0);
    }
    this.playBossWarning(attack);
  }

  private queuePhaseCombo(attack: BossAttackDefinition | undefined): void {
    if (!attack) return;
    const shouldCombo = shouldQueueBossCombo(this.currentAiProfile, this.attackCounter);
    if (!shouldCombo) return;
    const followUps = this.comboFollowUpsFor(attack);
    if (followUps.length === 0) return;
    this.queuedBossCombo = followUps;
    this.comboChainIndex = 0;
    this.comboTotalSteps = followUps.length + 1;
    this.lastComboName = this.comboNameFor(attack, followUps[0]);
    this.flashComboPreview(this.lastComboName);
  }

  private showStancePressure(): void {
    if (this.lastPublishedStance === this.currentAiProfile.stance) return;
    this.lastPublishedStance = this.currentAiProfile.stance;
    const motes = addSeamVfx(this, 'boss', 'motes', this.boss.x, this.boss.y - 42, {
      width: 118,
      height: 118,
      depth: this.boss.y + 11,
      alpha: 0.42,
      tint: this.currentAiProfile.warningColor,
      lifespanMs: 660,
    });
    const pulse = addBossImpactVfx(this, 'ring', this.boss.x, this.boss.y + 18, {
      width: 148,
      height: 70,
      depth: this.boss.y + 10,
      alpha: 0.46,
      tint: this.currentAiProfile.warningColor,
    }) ?? addSeamVfx(this, 'boss', 'seal', this.boss.x, this.boss.y + 18, {
      width: 122,
      height: 72,
      depth: this.boss.y + 10,
      alpha: 0.42,
      tint: this.currentAiProfile.warningColor,
    });
    if (motes) {
      this.tweens.add({
        targets: motes,
        alpha: { from: 0.28, to: 0.7 },
        y: motes.y - 10,
        duration: 180,
        yoyo: true,
        hold: 280,
        ease: 'Quad.Out',
        onComplete: () => {
          if (motes.active) motes.destroy();
        },
      });
    }
    if (pulse) {
      this.tweens.add({
        targets: pulse,
        alpha: 0,
        scaleX: 1.42,
        scaleY: 1.24,
        duration: 620,
        ease: 'Quad.Out',
        onComplete: () => pulse.destroy(),
      });
    }
  }

  private comboFollowUpsFor(attack: BossAttackDefinition): BossAttackDefinition[] {
    const idsByBehavior: Partial<Record<NonNullable<BossAttackDefinition['behavior']>, string[]>> = {
      'tracking-palm': ['false-return'],
      'mirror-step': this.bossState.phaseIndex >= 1 ? ['null-rift', 'null-crosscut-plus'] : ['void-cleave'],
      'void-cleave': ['null-pursuit'],
      'null-crosscut': this.bossState.phaseIndex >= 1 ? ['mask-crash-plus'] : ['mask-crash'],
      'null-pursuit': this.bossState.phaseIndex >= 1 ? ['binary-cage-plus', 'false-return-plus'] : ['broken-bracket-cage'],
      'binary-cage': this.bossState.phaseIndex >= 1 ? ['null-pursuit-plus'] : ['void-palm'],
      'mask-ring': this.bossState.phaseIndex >= 1 ? ['binary-sweep', 'false-return-plus'] : ['false-return'],
      'lane-sweep': ['false-return-plus'],
      'rift-chain': ['null-crosscut-plus', 'mask-crash-plus'],
    };
    return (idsByBehavior[attack.behavior ?? 'tracking-palm'] ?? [])
      .map((id) => this.findBossAttack(id))
      .filter((candidate): candidate is BossAttackDefinition => Boolean(candidate && candidate.id !== attack.id));
  }

  private comboNameFor(opening: BossAttackDefinition, followUp: BossAttackDefinition): string {
    if (opening.behavior === 'tracking-palm' && followUp.behavior === 'mirror-step') return 'Palm Return';
    if (opening.behavior === 'void-cleave' && followUp.behavior === 'null-pursuit') return 'Cleave Hunt';
    if (opening.behavior === 'lane-sweep' && followUp.behavior === 'mirror-step') return 'Sweep Return';
    if (opening.behavior === 'rift-chain' && followUp.behavior === 'null-crosscut') return 'Rift Cross';
    if (opening.behavior === 'null-pursuit' && followUp.behavior === 'binary-cage') return 'Hunt Cage';
    if (opening.behavior === 'binary-cage' && followUp.behavior === 'null-pursuit') return 'Cage Hunt';
    if (opening.behavior === 'null-crosscut' && followUp.behavior === 'mask-ring') return 'Cut Crash';
    return this.activeBoss.id === 'return-oni' ? 'Return Chain' : 'Null Chain';
  }

  private findBossAttack(id: string): BossAttackDefinition | undefined {
    return this.activeBoss.phases.flatMap((phase) => phase.attacks).find((candidate) => candidate.id === id);
  }

  private publishBossAttackRuntime(attack: BossAttackDefinition, queued: boolean): void {
    if (queued) this.comboChainIndex += 1;
    else this.comboChainIndex = 0;
    const runtime = window as Window & {
      __CODEJITSU_BOSS_ATTACK?: string;
      __CODEJITSU_BOSS_COMBO?: string;
      __CODEJITSU_BOSS_TELEGRAPH?: {
        attack: string;
        name: string;
        subtitle: string;
        detail: string;
        castLine: string;
        phaseRole: string;
        movementTell: string;
        counterWindowMs: number;
        arenaEffect: string;
        bossMotion: string;
        counterStyle: string;
        comboRole: string;
        threatLevel: number;
        tokens: string[];
        movementHint: string;
        punishHint: string;
        hasAftershock: boolean;
        dangerLayers: string[];
        counterRhythm: string;
        commandHint: string;
        phaseShift: string;
        visual: string;
        comboName: string;
        comboStep: number;
        comboTotalSteps: number;
        queuedFollowUps: string[];
        usesImagegenBanner: boolean;
        usesImagegenThreatPips: boolean;
        primitiveBannerPieces: number;
        primitiveThreatPips: number;
        at: number;
      };
      __CODEJITSU_BOSS_STANCE?: {
        stance: string;
        pressureText: string;
        moveSpeedMultiplier: number;
        orbitStrength: number;
        desiredDistance: number;
        attackDelayMs: number;
        comboEvery: number;
        at: number;
      };
      __CODEJITSU_BOSS_ATTACK_HISTORY?: Array<{
        attack: string;
        name: string;
        combo: string;
        queued: boolean;
        phase: number;
        chainIndex: number;
        stance?: string;
        pressureText?: string;
        threatLevel?: number;
        tokens?: string[];
        movementHint?: string;
        punishHint?: string;
        castLine?: string;
        phaseRole?: string;
        movementTell?: string;
        counterWindowMs?: number;
        arenaEffect?: string;
        bossMotion?: string;
        counterStyle?: string;
        comboRole?: string;
        hasAftershock?: boolean;
        dangerLayers?: string[];
        counterRhythm?: string;
        commandHint?: string;
        phaseShift?: string;
        comboStep?: number;
        comboTotalSteps?: number;
        queuedFollowUps?: string[];
        at: number;
      }>;
    };
    const combo = queued ? this.lastComboName : '';
    const queuedFollowUps = this.queuedBossCombo.map((candidate) => candidate.id);
    const comboStep = queued ? this.comboChainIndex + 1 : (this.comboTotalSteps > 0 ? 1 : 0);
    const comboTotalSteps = queued || this.comboTotalSteps > 0 ? Math.max(this.comboTotalSteps, comboStep) : 0;
    runtime.__CODEJITSU_BOSS_ATTACK = attack.id;
    runtime.__CODEJITSU_BOSS_COMBO = combo;
    runtime.__CODEJITSU_BOSS_TELEGRAPH = {
      attack: attack.id,
      name: attack.name,
      subtitle: this.attackSubtitle(attack),
      detail: this.attackDetailLine(attack),
      castLine: attack.castLine ?? `${attack.id}.cast`,
      phaseRole: attack.phaseRole ?? 'boss pattern',
      movementTell: attack.movementTell ?? attack.tellText ?? '',
      counterWindowMs: attack.counterWindowMs ?? attack.recoverMs,
      arenaEffect: attack.arenaEffect ?? attack.shape,
      bossMotion: attack.bossMotion ?? 'readable windup into recovery',
      counterStyle: attack.counterStyle ?? 'step the tell, punish the recovery',
      comboRole: attack.comboRole ?? 'opener',
      threatLevel: attack.threatLevel ?? 1,
      tokens: attack.techniqueTokens ?? [],
      movementHint: attack.movementHint ?? '',
      punishHint: attack.punishHint ?? '',
      hasAftershock: Boolean(attack.aftershock),
      dangerLayers: attack.dangerLayers ?? [],
      counterRhythm: attack.counterRhythm ?? '',
      commandHint: attack.commandHint ?? '',
      phaseShift: attack.phaseShift ?? '',
      visual: 'ability-card-with-threat-pips',
      comboName: queued ? this.lastComboName : (this.comboTotalSteps > 0 ? this.lastComboName : ''),
      comboStep,
      comboTotalSteps,
      queuedFollowUps,
      usesImagegenBanner: this.textures.exists(TextureKeys.BossAttackBanner),
      usesImagegenAttackCue: this.textures.exists(TextureKeys.BossAttackCue),
      usesImagegenThreatPips: this.textures.exists(TextureKeys.BossThreatPip),
      primitiveBannerPieces: this.textures.exists(TextureKeys.BossAttackBanner) ? 0 : 1,
      primitiveAttackCuePieces: this.textures.exists(TextureKeys.BossAttackCue) ? 0 : 1,
      primitiveThreatPips: this.textures.exists(TextureKeys.BossThreatPip) ? 0 : 5,
      visibleTextLabels: 0,
      at: Math.round(performance.now()),
    };
    const entry = {
      attack: attack.id,
      name: attack.name,
      combo,
      queued,
      phase: this.bossState.phaseIndex + 1,
      chainIndex: this.comboChainIndex,
      stance: this.currentAiProfile.stance,
      pressureText: this.currentAiProfile.pressureText,
      threatLevel: attack.threatLevel,
      tokens: attack.techniqueTokens ?? [],
      movementHint: attack.movementHint,
      punishHint: attack.punishHint,
      castLine: attack.castLine,
      phaseRole: attack.phaseRole,
      movementTell: attack.movementTell,
      counterWindowMs: attack.counterWindowMs,
      arenaEffect: attack.arenaEffect,
      bossMotion: attack.bossMotion,
      counterStyle: attack.counterStyle,
      comboRole: attack.comboRole,
      hasAftershock: Boolean(attack.aftershock),
      dangerLayers: attack.dangerLayers ?? [],
      counterRhythm: attack.counterRhythm,
      commandHint: attack.commandHint,
      phaseShift: attack.phaseShift,
      comboStep,
      comboTotalSteps,
      queuedFollowUps,
      at: Math.round(performance.now()),
    };
    runtime.__CODEJITSU_BOSS_STANCE = this.currentBossStancePayload();
    runtime.__CODEJITSU_BOSS_ATTACK_HISTORY = [...(runtime.__CODEJITSU_BOSS_ATTACK_HISTORY ?? []), entry].slice(-24);
  }

  private publishBossStanceRuntime(): void {
    (window as Window & {
      __CODEJITSU_BOSS_STANCE?: ReturnType<BossScene['currentBossStancePayload']>;
    }).__CODEJITSU_BOSS_STANCE = this.currentBossStancePayload();
  }

  private currentBossStancePayload(): {
    stance: string;
    pressureText: string;
    moveSpeedMultiplier: number;
    orbitStrength: number;
    desiredDistance: number;
    attackDelayMs: number;
    comboEvery: number;
    at: number;
  } {
    return {
      stance: this.currentAiProfile.stance,
      pressureText: this.currentAiProfile.pressureText,
      moveSpeedMultiplier: this.currentAiProfile.moveSpeedMultiplier,
      orbitStrength: this.currentAiProfile.orbitStrength,
      desiredDistance: this.currentAiProfile.desiredDistance,
      attackDelayMs: this.currentAiProfile.attackDelayMs,
      comboEvery: this.currentAiProfile.comboEvery,
      at: Math.round(performance.now()),
    };
  }

  private flashComboPreview(_comboName: string): void {
    const preview = this.createBossComboCadenceCue(0, 640, 166, 184, 62, 1298, 0xf0c36b);
    this.publishComboCalloutVisual({
      usesImagegenDivider: this.textures.exists(TextureKeys.BossThreatPip),
      dividerPieces: 0,
      usesImagegenCadenceCue: Boolean(preview?.getData('usesImagegenComboCadence')),
      cadenceFrameIndex: Number(preview?.getData('comboCadenceFrameIndex') ?? -1),
      textLineCount: 0,
      variant: 'preview',
    });
    this.tweens.add({
      targets: [preview].filter(Boolean),
      alpha: 0.82,
      y: '-=8',
      duration: 150,
      yoyo: true,
      hold: 380,
      ease: 'Quad.Out',
      onComplete: () => preview?.destroy(),
    });
  }

  private showComboCallout(attack: BossAttackDefinition): void {
    const cadenceCue = this.createBossComboCadenceCue(1, 640, 166, 232, 76, 1305, attack.warningColor);
    const usesImagegenDivider = this.textures.exists(TextureKeys.BossThreatPip);
    const dividerPieces = usesImagegenDivider
      ? Array.from({ length: 11 }, (_, index) =>
        this.add.image(520 + index * 24, 186, TextureKeys.BossThreatPip)
          .setDisplaySize(18, 9)
          .setDepth(1304)
          .setAlpha(0)
          .setTint(index % 2 === 0 ? attack.warningColor : 0xf6ead3)
          .setAngle(index % 2 === 0 ? -90 : 90)
          .setData('usesImagegenComboDivider', true),
      )
      : [this.add.rectangle(640, 186, 260, 3, attack.warningColor, 0.55)
        .setDepth(1304)
        .setAlpha(0)];
    this.publishComboCalloutVisual({
      usesImagegenDivider,
      dividerPieces: dividerPieces.length,
      usesImagegenCadenceCue: Boolean(cadenceCue?.getData('usesImagegenComboCadence')),
      cadenceFrameIndex: Number(cadenceCue?.getData('comboCadenceFrameIndex') ?? -1),
      textLineCount: 0,
      variant: 'chain',
    });
    this.tweens.add({
      targets: [cadenceCue, ...dividerPieces].filter(Boolean),
      alpha: 1,
      y: '-=6',
      duration: 120,
      yoyo: true,
      hold: Math.max(320, attack.windupMs - 160),
      ease: 'Quad.Out',
      onComplete: () => {
        cadenceCue?.destroy();
        dividerPieces.forEach((piece) => piece.destroy());
      },
    });
  }

  private createBossComboCadenceCue(
    frameIndex: 0 | 1,
    x: number,
    y: number,
    width: number,
    height: number,
    depth: number,
    tint: number,
  ): Phaser.GameObjects.Image | undefined {
    if (!this.textures.exists(TextureKeys.BossComboCadence)) return undefined;
    const source = this.textures.get(TextureKeys.BossComboCadence).getSourceImage() as { width?: number; height?: number };
    const frameWidth = Math.floor(Number(source.width ?? 2172) / 2);
    const frameHeight = Number(source.height ?? 724);
    const texture = this.textures.get(TextureKeys.BossComboCadence) as Phaser.Textures.Texture & {
      has?: (name: string) => boolean;
    };
    const frameKey = `boss-combo-cadence-${frameIndex}`;
    if (!texture.has?.(frameKey)) {
      texture.add(frameKey, 0, frameIndex * frameWidth, 0, frameWidth, frameHeight);
    }
    return this.add.image(x, y, TextureKeys.BossComboCadence, frameKey)
      .setDisplaySize(width, height)
      .setDepth(depth)
      .setAlpha(0)
      .setTint(tint)
      .setData('usesImagegenComboCadence', true)
      .setData('comboCadenceFrameIndex', frameIndex);
  }

  private publishComboCalloutVisual(options: {
    usesImagegenDivider: boolean;
    dividerPieces: number;
    usesImagegenCadenceCue: boolean;
    cadenceFrameIndex: number;
    textLineCount: number;
    variant: 'preview' | 'chain';
  }): void {
    (window as Window & {
      __CODEJITSU_COMBO_CALLOUT_VISUAL?: {
        usesImagegenDivider: boolean;
        usesImagegenCadenceCue: boolean;
        primitiveDividerPieces: number;
        primitiveCadenceCuePieces: number;
        dividerPieces: number;
        cadenceFrameIndex: number;
        textLineCount: number;
        textureKey: string;
        cadenceTextureKey: string;
        variant: string;
        at: number;
      };
    }).__CODEJITSU_COMBO_CALLOUT_VISUAL = {
      usesImagegenDivider: options.usesImagegenDivider,
      usesImagegenCadenceCue: options.usesImagegenCadenceCue,
      primitiveDividerPieces: options.usesImagegenDivider ? 0 : options.dividerPieces,
      primitiveCadenceCuePieces: options.usesImagegenCadenceCue ? 0 : 1,
      dividerPieces: options.dividerPieces,
      cadenceFrameIndex: options.cadenceFrameIndex,
      textLineCount: options.textLineCount,
      textureKey: options.usesImagegenDivider ? TextureKeys.BossThreatPip : 'fallback-rectangle',
      cadenceTextureKey: options.usesImagegenCadenceCue ? TextureKeys.BossComboCadence : 'none',
      variant: options.variant,
      at: Math.round(performance.now()),
    };
  }

  private showAttackBanner(attack: BossAttackDefinition): void {
    const x = 640;
    const y = 154;
    this.currentAttackBannerBounds = new Phaser.Geom.Rectangle(x - 200, y - 54, 400, 94);
    const usesImagegenBanner = this.textures.exists(TextureKeys.BossAttackBanner);
    const usesImagegenAttackCue = this.textures.exists(TextureKeys.BossAttackCue);
    const banner = usesImagegenBanner
      ? this.add.image(x, y, TextureKeys.BossAttackBanner)
        .setDisplaySize(400, 108)
        .setDepth(1300)
        .setAlpha(0)
        .setTint(attack.warningColor)
        .setData('usesImagegenBanner', true)
      : this.add.graphics().setDepth(1300).setAlpha(0);
    if (!usesImagegenBanner && banner instanceof Phaser.GameObjects.Graphics) {
      banner.fillStyle(0x140d18, 0.88);
      banner.fillRoundedRect(x - 176, y - 34, 352, 72, 8);
      banner.lineStyle(2, attack.warningColor, 0.86);
      banner.strokeRoundedRect(x - 176, y - 34, 352, 72, 8);
      banner.lineStyle(1, 0xf6ead3, 0.24);
      banner.beginPath();
      banner.moveTo(x - 132, y + 1);
      banner.lineTo(x + 132, y + 1);
      banner.strokePath();
    }

    const attackCue = this.createBossAttackCue(attack, x, y);
    const usesImagegenThreatPips = this.textures.exists(TextureKeys.BossThreatPip);
    const threatPips = Array.from({ length: 5 }, (_, index) => {
      const active = index < (attack.threatLevel ?? 1);
      if (usesImagegenThreatPips) {
        return this.add.image(x - 44 + index * 22, y + 31, TextureKeys.BossThreatPip)
          .setDisplaySize(14, 18)
          .setDepth(1301)
          .setAlpha(0)
          .setTint(active ? attack.warningColor : 0x4a394f)
          .setData('usesImagegenThreatPip', true);
      }
      return this.add.rectangle(
        x - 44 + index * 22,
        y + 30,
        14,
        4,
        active ? attack.warningColor : 0x4a394f,
        active ? 0.82 : 0.34,
      )
        .setDepth(1301)
        .setAlpha(0)
        .setStrokeStyle(1, 0xf6ead3, active ? 0.22 : 0.08);
    });

    this.tweens.add({
      targets: [banner, attackCue, ...threatPips].filter(Boolean),
      alpha: 1,
      y: '-=8',
      duration: 140,
      ease: 'Quad.Out',
      onComplete: () => {
        this.tweens.add({
          targets: [banner, attackCue, ...threatPips].filter(Boolean),
          alpha: 0,
          delay: Math.max(360, attack.windupMs - 120),
          duration: 180,
          ease: 'Quad.In',
          onComplete: () => {
            this.currentAttackBannerBounds = undefined;
            banner.destroy();
            attackCue?.destroy();
            threatPips.forEach((pip) => pip.destroy());
          },
        });
      },
    });
    (window as Window & {
      __CODEJITSU_BOSS_ATTACK_BANNER_VISUAL?: {
        usesImagegenBanner: boolean;
        usesImagegenAttackCue: boolean;
        usesImagegenThreatPips: boolean;
        primitiveBannerPieces: number;
        primitiveAttackCuePieces: number;
        primitiveThreatPips: number;
        attackCueFrameIndex: number;
        textLineCount: number;
        textureKey: string;
        threatPipKey: string;
        threatLevel: number;
        at: number;
      };
    }).__CODEJITSU_BOSS_ATTACK_BANNER_VISUAL = {
      usesImagegenBanner,
      usesImagegenAttackCue,
      usesImagegenThreatPips,
      primitiveBannerPieces: usesImagegenBanner ? 0 : 1,
      primitiveAttackCuePieces: usesImagegenAttackCue ? 0 : 1,
      primitiveThreatPips: usesImagegenThreatPips ? 0 : threatPips.length,
      attackCueFrameIndex: Number(attackCue?.getData('attackCueFrameIndex') ?? -1),
      textLineCount: 0,
      textureKey: usesImagegenBanner ? TextureKeys.BossAttackBanner : 'fallback-graphics',
      threatPipKey: usesImagegenThreatPips ? TextureKeys.BossThreatPip : 'fallback-rectangle',
      threatLevel: attack.threatLevel ?? 1,
      at: Math.round(performance.now()),
    };
  }

  private createBossAttackCue(attack: BossAttackDefinition, x: number, y: number): Phaser.GameObjects.Image | undefined {
    if (!this.textures.exists(TextureKeys.BossAttackCue)) return undefined;
    const source = this.textures.get(TextureKeys.BossAttackCue).getSourceImage() as { width?: number; height?: number };
    const frameWidth = Math.floor(Number(source.width ?? 2172) / 5);
    const frameHeight = Number(source.height ?? 724);
    const frameIndex = this.attackCueFrameIndex(attack);
    const texture = this.textures.get(TextureKeys.BossAttackCue) as Phaser.Textures.Texture & {
      has?: (name: string) => boolean;
    };
    const frameKey = `boss-attack-cue-${frameIndex}`;
    if (!texture.has?.(frameKey)) {
      texture.add(frameKey, 0, frameIndex * frameWidth, 0, frameWidth, frameHeight);
    }
    return this.add.image(x, y - 4, TextureKeys.BossAttackCue, frameKey)
      .setDisplaySize(272, 92)
      .setDepth(1301)
      .setAlpha(0)
      .setTint(attack.warningColor)
      .setData('usesImagegenAttackCue', true)
      .setData('attackCueFrameIndex', frameIndex);
  }

  private attackCueFrameIndex(attack: BossAttackDefinition): number {
    if ((attack.threatLevel ?? 1) >= 5 || attack.comboRole === 'phase-breaker') return 4;
    if (attack.comboRole === 'finisher') return 3;
    if (attack.comboRole === 'trap' || attack.shape === 'ring') return 2;
    if (attack.comboRole === 'follow-up') return 1;
    return 0;
  }

  private describeBossAttack(attack: BossAttackDefinition): string {
    const tell = compactHudText(this.attackSubtitle(attack), 42);
    const counter = compactHudText(attack.counterStyle ?? 'Punish recovery.', 46);
    return `${attack.name}: ${tell}\n${counter} (${attack.counterWindowMs ?? attack.recoverMs}ms)`;
  }

  private showFinisherPrompt(text: string): void {
    if (!this.finisherHint) return;
    this.finisherCueFrameIndex = 1;
    this.finisherHint
      .setTexture(TextureKeys.BossFinisherCue, this.ensureFinisherCueFrame(1))
      .setDisplaySize(164, 86)
      .setAlpha(0.9)
      .setData('finisherCueFrameIndex', 1);
    this.tweens.killTweensOf(this.finisherHint);
    this.tweens.add({
      targets: this.finisherHint,
      alpha: { from: 0.72, to: 1 },
      scaleX: this.finisherHint.scaleX * 1.05,
      scaleY: this.finisherHint.scaleY * 1.05,
      duration: 520,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.InOut',
      onComplete: () => {
        this.finisherHint?.setAlpha(0.82);
        this.publishFinisherHintRuntime(text);
      },
    });
  }

  private publishBossHudLayout(): void {
    if (!this.statusText) return;
    const textBounds = this.statusText.getBounds();
    const syntaxBounds = this.syntaxText?.getBounds();
    const comboBounds = this.comboText?.getBounds();
    const titleBounds = this.bossTitleText?.getBounds();
    const attackBanner = this.currentAttackBannerBounds;
    const playerPanel = this.bossHudPanelBounds;
    const panel = this.bossStatusPanelBounds;
    const topOverlayNoOverlap = !titleBounds || !attackBanner ||
      !Phaser.Geom.Intersects.RectangleToRectangle(titleBounds, attackBanner);
    const statusEmpty = this.statusText.text.trim().length === 0;
    const syntaxEmpty = (this.syntaxText?.text ?? '').trim().length === 0;
    const comboEmpty = (this.comboText?.text ?? '').trim().length === 0;
    const statusFits = statusEmpty || (textBounds.x >= panel.x + 112 &&
      textBounds.right <= panel.right - 76 &&
      textBounds.y >= panel.y + 10 &&
      textBounds.bottom <= panel.bottom - 10);
    const playerHudFits = (syntaxEmpty && comboEmpty) || (Boolean(syntaxBounds && comboBounds) &&
      syntaxBounds.x >= playerPanel.x + 112 &&
      syntaxBounds.right <= playerPanel.right - 76 &&
      syntaxBounds.y >= playerPanel.y + 10 &&
      syntaxBounds.bottom <= playerPanel.bottom - 10 &&
      comboBounds.x >= playerPanel.x + 112 &&
      comboBounds.right <= playerPanel.right - 76 &&
      comboBounds.y >= playerPanel.y + 10 &&
      comboBounds.bottom <= playerPanel.bottom - 10);
    const bossPanel = this.bossStatusPanel as (Phaser.GameObjects.GameObject & { getData?: (key: string) => unknown }) | undefined;
    const hudPanel = this.bossHudPanel as (Phaser.GameObjects.GameObject & { getData?: (key: string) => unknown }) | undefined;
    const usesGeneratedPanel = Boolean(bossPanel?.getData?.('usesImagegenHudPanel')) && Boolean(hudPanel?.getData?.('usesImagegenHudPanel'));
    const wordCount = [
      this.syntaxText?.text ?? '',
      this.comboText?.text ?? '',
      this.statusText.text,
    ].join(' ').split(/\s+/).filter(Boolean).length;
    (window as unknown as {
      __CODEJITSU_BOSS_HUD_LAYOUT?: {
        usesImagegenPanel: boolean;
        primitivePanelPieces: number;
        usesImagegenPlayerCue: boolean;
        primitivePlayerCuePieces: number;
        playerCueFrameIndex: number;
        playerCueState: string;
        usesImagegenBossCue: boolean;
        primitiveCuePieces: number;
        bossCueFrameIndex: number;
        bossCueState: string;
        textOverlayCount: number;
        objectiveCopy: string;
        compactCopy: boolean;
        wordCount: number;
        panel: { x: number; y: number; width: number; height: number; bottom: number };
        playerPanel: { x: number; y: number; width: number; height: number; bottom: number };
        status: { x: number; y: number; width: number; height: number; bottom: number };
        syntax?: { x: number; y: number; width: number; height: number; bottom: number };
        combo?: { x: number; y: number; width: number; height: number; bottom: number };
        title?: { x: number; y: number; width: number; height: number; bottom: number };
        attackBanner?: { x: number; y: number; width: number; height: number; bottom: number };
        titleVisible: boolean;
        topOverlayNoOverlap: boolean;
        noOverflow: boolean;
        playerHudNoOverflow: boolean;
        lines: number;
        at: number;
      };
    }).__CODEJITSU_BOSS_HUD_LAYOUT = {
      usesImagegenPanel: usesGeneratedPanel,
      primitivePanelPieces: usesGeneratedPanel ? 0 : 2,
      usesImagegenPlayerCue: Boolean(this.playerCueIcon?.getData('usesImagegenPlayerCue')),
      primitivePlayerCuePieces: this.playerCueIcon?.getData('usesImagegenPlayerCue') ? 0 : 1,
      playerCueFrameIndex: Number(this.playerCueIcon?.getData('playerCueFrameIndex') ?? -1),
      playerCueState: this.playerCueState,
      usesImagegenBossCue: Boolean(this.bossCueIcon?.getData('usesImagegenBossCue')),
      primitiveCuePieces: this.bossCueIcon?.getData('usesImagegenBossCue') ? 0 : 1,
      bossCueFrameIndex: Number(this.bossCueIcon?.getData('bossCueFrameIndex') ?? -1),
      bossCueState: this.bossCueState,
      textOverlayCount: [this.syntaxText.text, this.comboText.text, this.statusText.text].filter((text) => text.trim().length > 0).length,
      objectiveCopy: `${this.syntaxText.text} ${this.comboText.text} ${this.statusText.text}`.trim(),
      compactCopy: wordCount <= 12,
      wordCount,
      panel: {
        x: panel.x,
        y: panel.y,
        width: panel.width,
        height: panel.height,
        bottom: panel.bottom,
      },
      playerPanel: {
        x: playerPanel.x,
        y: playerPanel.y,
        width: playerPanel.width,
        height: playerPanel.height,
        bottom: playerPanel.bottom,
      },
      status: {
        x: Math.round(textBounds.x * 10) / 10,
        y: Math.round(textBounds.y * 10) / 10,
        width: Math.round(textBounds.width * 10) / 10,
        height: Math.round(textBounds.height * 10) / 10,
        bottom: Math.round(textBounds.bottom * 10) / 10,
      },
      syntax: syntaxBounds ? {
        x: Math.round(syntaxBounds.x * 10) / 10,
        y: Math.round(syntaxBounds.y * 10) / 10,
        width: Math.round(syntaxBounds.width * 10) / 10,
        height: Math.round(syntaxBounds.height * 10) / 10,
        bottom: Math.round(syntaxBounds.bottom * 10) / 10,
      } : undefined,
      combo: comboBounds ? {
        x: Math.round(comboBounds.x * 10) / 10,
        y: Math.round(comboBounds.y * 10) / 10,
        width: Math.round(comboBounds.width * 10) / 10,
        height: Math.round(comboBounds.height * 10) / 10,
        bottom: Math.round(comboBounds.bottom * 10) / 10,
      } : undefined,
      title: titleBounds ? {
        x: Math.round(titleBounds.x * 10) / 10,
        y: Math.round(titleBounds.y * 10) / 10,
        width: Math.round(titleBounds.width * 10) / 10,
        height: Math.round(titleBounds.height * 10) / 10,
        bottom: Math.round(titleBounds.bottom * 10) / 10,
      } : undefined,
      attackBanner: attackBanner ? {
        x: Math.round(attackBanner.x * 10) / 10,
        y: Math.round(attackBanner.y * 10) / 10,
        width: Math.round(attackBanner.width * 10) / 10,
        height: Math.round(attackBanner.height * 10) / 10,
        bottom: Math.round(attackBanner.bottom * 10) / 10,
      } : undefined,
      titleVisible: Boolean(this.bossTitleText?.visible && this.bossTitleText.alpha > 0.05),
      topOverlayNoOverlap,
      noOverflow: statusFits && playerHudFits,
      playerHudNoOverflow: playerHudFits,
      lines: this.statusText.text.split('\n').length,
      at: Math.round(performance.now()),
    };
  }

  private publishFinisherHintRuntime(text: string): void {
    const command = this.requiredCommandText();
    (window as Window & {
      __CODEJITSU_BOSS_FINISHER_HINT?: {
        text: string;
        command: string;
        explicit: boolean;
        usesImagegenFinisherCue: boolean;
        primitiveCuePieces: number;
        finisherCueFrameIndex: number;
        visibleText: boolean;
        at: number;
      };
    }).__CODEJITSU_BOSS_FINISHER_HINT = {
      text,
      command,
      explicit: Boolean(this.finisherHint?.getData('usesImagegenFinisherCue')),
      usesImagegenFinisherCue: Boolean(this.finisherHint?.getData('usesImagegenFinisherCue')),
      primitiveCuePieces: this.finisherHint?.getData('usesImagegenFinisherCue') ? 0 : 1,
      finisherCueFrameIndex: Number(this.finisherHint?.getData('finisherCueFrameIndex') ?? this.finisherCueFrameIndex),
      visibleText: false,
      at: Math.round(performance.now()),
    };
  }

  private attackDetailLine(attack: BossAttackDefinition): string {
    const tokens = (attack.techniqueTokens ?? [attack.shape]).join(' . ');
    const cast = attack.castLine ?? tokens;
    const read = attack.punishHint ?? attack.movementHint ?? attack.counterRhythm ?? attack.arenaEffect ?? 'read the sigil, then answer';
    return compactHudText(`${cast}: ${read}`, 86);
  }

  private attackSubtitle(attack: BossAttackDefinition): string {
    if (attack.behavior === 'tracking-palm') return 'tracks your last footing';
    if (attack.behavior === 'mirror-step') return 'false body, real strike';
    if (attack.behavior === 'binary-cage') return 'crossing lanes, diagonal escape';
    if (attack.behavior === 'void-cleave') return 'dash line, punish recovery';
    if (attack.behavior === 'null-crosscut') return 'two cuts, move on the empty diagonal';
    if (attack.behavior === 'null-pursuit') return 'predicted footprints, chained dash cuts';
    if (attack.behavior === 'mask-ring') return 'rim hits, center survives';
    if (attack.behavior === 'lane-sweep') return 'read the clean lane';
    if (attack.behavior === 'rift-chain') return 'keep moving through pulses';
    return 'watch the tell';
  }

  private playBossWarning(attack: BossAttackDefinition): void {
    const targets = this.createAttackWarnings(attack);
    const generatedWarningCount = this.addGeneratedTelegraphsForAttack(attack, targets);
    const visibleHitboxAlpha = this.applyGeneratedWarningVisibility(targets, generatedWarningCount);
    this.playBossCastMotion(attack, targets);
    if (attack.behavior === 'rift-chain' || attack.behavior === 'null-pursuit') {
      targets.forEach((target, index) => {
        const delay = index * (attack.behavior === 'null-pursuit' ? 135 : 170);
        this.tweens.add({
          targets: target,
          alpha: generatedWarningCount > 0 ? visibleHitboxAlpha : attack.behavior === 'null-pursuit' ? 0.62 : 0.54,
          scale: attack.behavior === 'null-pursuit' ? 1.18 : 1.12,
          delay,
          duration: attack.windupMs,
          yoyo: true,
          ease: 'Sine.InOut',
          onComplete: () => {
            playBoom(this, 0.58 + index * 0.08);
            this.resolveBossAttack(attack, [target]);
            target.destroy();
            if (index === targets.length - 1) {
              setActorPose(this.boss, 'idle');
              this.time.delayedCall(attack.recoverMs, () => this.scheduleBossAttack());
            }
          },
        });
      });
      return;
    }

    this.tweens.add({
      targets,
      alpha: generatedWarningCount > 0 ? visibleHitboxAlpha : 0.48,
      scale: attack.shape === 'lane' ? 1 : 1.08,
      duration: attack.windupMs,
      yoyo: true,
      onComplete: () => {
        playBoom(this, attack.shape === 'ring' ? 0.9 : 0.72);
        this.resolveBossAttack(attack, targets);
        targets.forEach((target) => target.destroy());
        setActorPose(this.boss, 'idle');
        this.time.delayedCall(attack.recoverMs, () => this.scheduleBossAttack());
      },
    });
  }

  private addGeneratedTelegraphsForAttack(attack: BossAttackDefinition, warnings: Phaser.GameObjects.Shape[]): number {
    const realWarnings = warnings.filter((warning) => !warning.getData('decorative'));
    const generatedLaneOverlays = this.addGeneratedBossWarningLaneOverlays(attack, realWarnings);
    this.lastBossWarningLaneOverlayCount = generatedLaneOverlays;
    const kind = this.telegraphKindForAttack(attack);
    let generated = generatedLaneOverlays;
    realWarnings.slice(0, attack.shape === 'lane' ? 4 : 8).forEach((warning, index) => {
      const startX = warning.getData('attackStartX') as number | undefined;
      const startY = warning.getData('attackStartY') as number | undefined;
      const endX = warning.getData('attackEndX') as number | undefined;
      const endY = warning.getData('attackEndY') as number | undefined;
      const x = (warning.getData('attackX') as number | undefined) ??
        (startX !== undefined && endX !== undefined ? (startX + endX) / 2 : warning.x);
      const y = (warning.getData('attackY') as number | undefined) ??
        (startY !== undefined && endY !== undefined ? (startY + endY) / 2 : warning.y);
      const axis = warning.getData('laneAxis') as 'horizontal' | 'vertical' | undefined;
      const rotation = axis === 'horizontal'
        ? Math.PI / 2
        : kind === 'lane'
          ? warning.rotation
          : Phaser.Math.FloatBetween(-0.06, 0.06);
      const sigil = addGeneratedTelegraphSigil(this, 'boss', kind, Number(x), Number(y) - (kind === 'ring' ? 8 : 0), {
        width: kind === 'lane' ? 112 : kind === 'cage' ? 142 : kind === 'pursuit' ? 116 : kind === 'palm' ? 124 : 128,
        height: kind === 'lane' ? 178 : kind === 'cage' ? 142 : kind === 'pursuit' ? 124 : kind === 'palm' ? 132 : 128,
        depth: Math.max(Number(y), warning.depth) + 10 + index,
        rotation,
        alpha: kind === 'ring' ? 0.58 : 0.68,
        tint: attack.warningColor,
        lifespanMs: attack.windupMs + attack.activeMs + index * 110,
      });
      if (sigil) generated += 1;
    });
    return generated;
  }

  private addGeneratedBossWarningLaneOverlays(attack: BossAttackDefinition, warnings: Phaser.GameObjects.Shape[]): number {
    if (!this.textures.exists(TextureKeys.BossWarningLanes)) return 0;

    return warnings.reduce((count, warning, index) => {
      const lane = this.createBossWarningLaneOverlay(attack, warning, index);
      return count + (lane ? 1 : 0);
    }, 0);
  }

  private createBossWarningLaneOverlay(
    attack: BossAttackDefinition,
    warning: Phaser.GameObjects.Shape,
    index: number,
  ): Phaser.GameObjects.Image | undefined {
    const frame = this.bossWarningLaneFrameForAttack(attack, warning);
    if (frame < 0) return undefined;
    const frameKey = this.ensureBossWarningLaneFrame(frame);
    if (!frameKey) return undefined;

    const startX = warning.getData('attackStartX') as number | undefined;
    const startY = warning.getData('attackStartY') as number | undefined;
    const endX = warning.getData('attackEndX') as number | undefined;
    const endY = warning.getData('attackEndY') as number | undefined;
    const attackX = warning.getData('attackX') as number | undefined;
    const attackY = warning.getData('attackY') as number | undefined;
    const axis = warning.getData('laneAxis') as 'horizontal' | 'vertical' | undefined;
    const centerX = attackX ?? (startX !== undefined && endX !== undefined ? (startX + endX) / 2 : warning.x);
    const centerY = attackY ?? (startY !== undefined && endY !== undefined ? (startY + endY) / 2 : warning.y);
    const image = this.add.image(centerX, centerY, TextureKeys.BossWarningLanes, frameKey)
      .setDepth(Math.max(warning.depth, centerY) + 6 + index)
      .setAlpha(0.84)
      .setBlendMode(Phaser.BlendModes.ADD);

    if (frame === 0) {
      image.setDisplaySize(Math.max(126, (attack.width ?? 76) * 1.9), 492);
      image.setPosition(centerX, 386);
    } else if (frame === 1) {
      image.setDisplaySize(980, Math.max(114, (attack.width ?? 76) * 1.5));
      image.setPosition(640, centerY);
    } else if (frame === 2 && startX !== undefined && startY !== undefined && endX !== undefined && endY !== undefined) {
      const length = Phaser.Math.Distance.Between(startX, startY, endX, endY);
      image.setDisplaySize(Math.max(280, length), Math.max(92, attack.width ?? 58));
      image.setRotation(Phaser.Math.Angle.Between(startX, startY, endX, endY));
    } else if (frame === 3) {
      const radius = attack.radius ?? 116;
      image.setDisplaySize(radius * 2.55, radius * 1.68);
    } else if (axis === 'horizontal') {
      image.setDisplaySize(980, Math.max(114, (attack.width ?? 76) * 1.5));
      image.setPosition(640, centerY);
    } else {
      image.setDisplaySize(Math.max(126, (attack.width ?? 76) * 1.9), 492);
      image.setPosition(centerX, 386);
    }

    image.setData('usesImagegenBossWarningLane', true);
    image.setData('bossWarningLaneFrame', frame);
    image.setData('bossWarningLaneTextureKey', TextureKeys.BossWarningLanes);
    this.tweens.add({
      targets: image,
      alpha: { from: 0.58, to: 0.98 },
      scaleX: image.scaleX * 1.045,
      scaleY: image.scaleY * 1.045,
      duration: Math.max(220, attack.windupMs * 0.5),
      yoyo: true,
      ease: 'Sine.InOut',
      onComplete: () => {
        this.tweens.add({
          targets: image,
          alpha: 0,
          duration: attack.activeMs + 120,
          onComplete: () => image.destroy(),
        });
      },
    });
    return image;
  }

  private bossWarningLaneFrameForAttack(attack: BossAttackDefinition, warning: Phaser.GameObjects.Shape): number {
    const axis = warning.getData('laneAxis') as 'horizontal' | 'vertical' | undefined;
    if (attack.shape === 'ring' || attack.behavior === 'mask-ring' || attack.behavior === 'null-pursuit') return 3;
    if (attack.behavior === 'void-cleave' || attack.behavior === 'null-crosscut') return 2;
    if (attack.shape === 'lane' || attack.behavior === 'binary-cage' || attack.behavior === 'lane-sweep') {
      return axis === 'horizontal' ? 1 : 0;
    }
    return -1;
  }

  private ensureBossWarningLaneFrame(frame: number): string | undefined {
    const texture = this.textures.get(TextureKeys.BossWarningLanes);
    const source = texture?.getSourceImage() as { width?: number; height?: number } | undefined;
    if (!texture || !source?.width || !source.height) return undefined;
    const safeFrame = Phaser.Math.Clamp(Math.floor(frame), 0, 3);
    const frameKey = `boss-warning-lane-${safeFrame}`;
    if (texture.has(frameKey)) return frameKey;
    const frameWidth = Math.floor(Number(source.width) / 4);
    texture.add(frameKey, 0, safeFrame * frameWidth, 0, frameWidth, Number(source.height));
    return frameKey;
  }

  private applyGeneratedWarningVisibility(warnings: Phaser.GameObjects.Shape[], generatedWarningCount: number): number {
    const hitboxAlpha = generatedWarningCount > 0 ? 0 : 1;
    if (generatedWarningCount > 0) {
      warnings.forEach((warning) => {
        warning.setAlpha(hitboxAlpha);
        warning.setVisible(false);
        warning.setData('collisionOnlyGeneratedTelegraph', true);
      });
    }
    this.publishBossWarningVisualRuntime(warnings, generatedWarningCount, hitboxAlpha);
    return hitboxAlpha;
  }

  private publishBossWarningVisualRuntime(warnings: Phaser.GameObjects.Shape[], generatedWarningCount: number, primitiveWarningAlpha: number): void {
    const collisionOnlyShapeCount = warnings.filter((warning) => warning.getData('collisionOnlyGeneratedTelegraph') === true).length;
    const visiblePrimitiveWarningCount = warnings.filter((warning) => warning.visible && warning.alpha > 0.03).length;
    (window as Window & {
      __CODEJITSU_BOSS_WARNING_VISUAL?: {
        scene: string;
        usesGeneratedTelegraphs: boolean;
        generatedWarningCount: number;
        usesImagegenWarningLanes: boolean;
        generatedWarningLaneOverlayCount: number;
        warningLaneTextureKey: string;
        primitiveWarningAlpha: number;
        collisionShapeCount: number;
        collisionOnlyShapeCount: number;
        visiblePrimitiveWarningCount: number;
        collisionShapesHidden: boolean;
        generatedArtOnly: boolean;
        at: number;
      };
    }).__CODEJITSU_BOSS_WARNING_VISUAL = {
      scene: 'boss',
      usesGeneratedTelegraphs: generatedWarningCount > 0,
      generatedWarningCount,
      usesImagegenWarningLanes: this.lastBossWarningLaneOverlayCount > 0,
      generatedWarningLaneOverlayCount: this.lastBossWarningLaneOverlayCount,
      warningLaneTextureKey: this.textures.exists(TextureKeys.BossWarningLanes) ? TextureKeys.BossWarningLanes : 'missing',
      primitiveWarningAlpha: Math.round(primitiveWarningAlpha * 1000) / 1000,
      collisionShapeCount: warnings.length,
      collisionOnlyShapeCount,
      visiblePrimitiveWarningCount,
      collisionShapesHidden: generatedWarningCount > 0 && primitiveWarningAlpha <= 0.03 && visiblePrimitiveWarningCount === 0,
      generatedArtOnly: generatedWarningCount > 0 && primitiveWarningAlpha === 0 && visiblePrimitiveWarningCount === 0,
      at: Math.round(performance.now()),
    };
  }

  private telegraphKindForAttack(attack: BossAttackDefinition): TelegraphSigilKind {
    if (attack.behavior === 'binary-cage') return 'cage';
    if (attack.behavior === 'null-pursuit' || attack.behavior === 'mirror-step') return 'pursuit';
    if (attack.behavior === 'tracking-palm') return 'palm';
    if (attack.shape === 'ring') return 'ring';
    if (attack.shape === 'multi-burst') return 'burst';
    if (attack.shape === 'lane' || attack.behavior === 'void-cleave' || attack.behavior === 'null-crosscut') return 'lane';
    return 'palm';
  }

  private playBossCastMotion(attack: BossAttackDefinition, warnings: Phaser.GameObjects.Shape[]): void {
    const mainWarning = warnings.find((warning) => !warning.getData('decorative')) ?? warnings[0];
    if (!mainWarning) return;
    if (attack.behavior === 'tracking-palm') {
      const targetX = (mainWarning.getData('attackX') as number | undefined) ?? mainWarning.x;
      const targetY = (mainWarning.getData('attackY') as number | undefined) ?? mainWarning.y;
      const palm = addGeneratedTelegraphSigil(this, 'boss', 'palm', this.boss.x - 44, this.boss.y - 16, {
        width: 66,
        height: 70,
        depth: Math.max(this.boss.y, targetY) + 12,
        alpha: 0.72,
        tint: attack.warningColor,
        lifespanMs: attack.windupMs + attack.activeMs,
      }) ?? this.add.circle(this.boss.x - 44, this.boss.y - 16, 18, attack.warningColor, 0.68)
        .setStrokeStyle(3, 0xf6ead3, 0.5)
        .setDepth(Math.max(this.boss.y, targetY) + 12);
      this.tweens.add({
        targets: palm,
        x: targetX,
        y: targetY - 8,
        scale: 1.65,
        alpha: 0.92,
        delay: Math.max(40, attack.windupMs - 240),
        duration: 220,
        ease: 'Cubic.In',
        onComplete: () => {
          addSeamVfx(this, 'boss', 'burst', targetX, targetY - 6, {
            width: 146,
            height: 128,
            depth: Math.max(this.boss.y, targetY) + 14,
            alpha: 0.7,
            tint: attack.warningColor,
            lifespanMs: 360,
          });
          if (palm.active) palm.destroy();
        },
      });
      return;
    }

    if (attack.behavior === 'mask-ring') {
      const radius = attack.radius;
      const shards = this.addMaskShardVfx(this.boss.x, this.boss.y, radius * 0.9, attack.warningColor);
      shards.forEach((shard, index) => {
        const angle = (Math.PI * 2 * index) / Math.max(1, shards.length);
        this.tweens.add({
          targets: shard,
          x: this.boss.x + Math.cos(angle) * radius * 1.24,
          y: this.boss.y + Math.sin(angle) * radius * 0.78,
          alpha: 0.72,
          duration: attack.windupMs,
          ease: 'Sine.InOut',
          yoyo: true,
          onComplete: () => shard.destroy(),
        });
      });
      return;
    }

    if (attack.behavior === 'binary-cage') {
      warnings.filter((warning) => !warning.getData('decorative')).forEach((warning) => {
        const axis = warning.getData('laneAxis') as 'horizontal' | 'vertical' | undefined;
        const x = (warning.getData('attackX') as number | undefined) ?? 640;
        const y = (warning.getData('attackY') as number | undefined) ?? 386;
        const gate = addSeamVfx(this, 'boss', 'seal', axis === 'vertical' ? x : 640, axis === 'vertical' ? 386 : y, {
          width: axis === 'vertical' ? 128 : 116,
          height: axis === 'vertical' ? 82 : 92,
          depth: Math.max(y, this.boss.y) + 17,
          rotation: axis === 'vertical' ? 0 : Math.PI / 2,
          alpha: 0.58,
          tint: 0xf0c36b,
          lifespanMs: attack.windupMs + attack.activeMs,
        }) ?? (axis === 'vertical'
          ? this.add.rectangle(x, 386, (attack.width ?? 64) + 20, 36, 0xf6ead3, 0.28)
          : this.add.rectangle(640, y, 36, (attack.width ?? 64) + 20, 0xf6ead3, 0.28));
        gate.setDepth(Math.max(y, this.boss.y) + 17);
        this.tweens.add({
          targets: gate,
          x: axis === 'vertical' ? x : Phaser.Math.Clamp(this.player.x, 210, 1060),
          y: axis === 'vertical' ? Phaser.Math.Clamp(this.player.y, 208, 560) : y,
          alpha: 0.92,
          scaleX: axis === 'vertical' ? 1.18 : 1,
          scaleY: axis === 'vertical' ? 1 : 1.18,
          duration: attack.windupMs + attack.activeMs * 0.42,
          ease: 'Cubic.In',
          onComplete: () => {
            if (gate.active) gate.destroy();
          },
        });
      });
      this.addCageGlyphs(attack);
      return;
    }

    if (attack.behavior === 'lane-sweep') {
      const axis = (mainWarning.getData('laneAxis') as 'horizontal' | 'vertical' | undefined) ?? 'horizontal';
      const x = (mainWarning.getData('attackX') as number | undefined) ?? 640;
      const y = (mainWarning.getData('attackY') as number | undefined) ?? 386;
      const sweep = addSeamVfx(this, 'boss', 'slash', axis === 'vertical' ? x : 166, axis === 'vertical' ? 186 : y, {
        width: axis === 'vertical' ? 180 : 210,
        height: axis === 'vertical' ? 92 : 96,
        depth: Math.max(y, this.boss.y) + 16,
        rotation: axis === 'vertical' ? Math.PI / 2 : 0,
        alpha: 0.72,
        tint: attack.warningColor,
        lifespanMs: attack.windupMs + attack.activeMs,
      }) ?? (axis === 'vertical'
        ? this.add.rectangle(x, 186, attack.width ?? 76, 34, 0xf6ead3, 0.34)
        : this.add.rectangle(166, y, 34, attack.width ?? 76, 0xf6ead3, 0.34));
      sweep.setDepth(Math.max(y, this.boss.y) + 16);
      this.tweens.add({
        targets: sweep,
        x: axis === 'vertical' ? x : 1114,
        y: axis === 'vertical' ? 586 : y,
        alpha: 0.88,
        duration: attack.windupMs + attack.activeMs * 0.5,
        ease: 'Cubic.In',
        onComplete: () => {
          if (sweep.active) sweep.destroy();
        },
      });
      return;
    }

    if (attack.behavior === 'void-cleave') {
      const startX = (mainWarning.getData('attackStartX') as number | undefined) ?? this.boss.x;
      const startY = (mainWarning.getData('attackStartY') as number | undefined) ?? this.boss.y;
      const endX = (mainWarning.getData('attackEndX') as number | undefined) ?? this.player.x;
      const endY = (mainWarning.getData('attackEndY') as number | undefined) ?? this.player.y;
      const angle = Phaser.Math.Angle.Between(startX, startY, endX, endY);
      const distance = Phaser.Math.Distance.Between(startX, startY, endX, endY);
      const drawTime = Math.max(140, attack.windupMs - 180);
      const blade = addSeamVfx(this, 'boss', 'crescent', startX, startY - 28, {
        width: 142,
        height: 118,
        depth: 872,
        rotation: angle,
        alpha: 0.62,
        tint: attack.warningColor,
        lifespanMs: attack.windupMs,
      }) ?? this.add.rectangle(startX, startY - 28, 18, 74, attack.warningColor, 0.28)
        .setRotation(angle + Math.PI / 2)
        .setDepth(872);
      this.tweens.add({
        targets: blade,
        x: startX + Math.cos(angle) * Math.min(distance * 0.42, 180),
        y: startY + Math.sin(angle) * Math.min(distance * 0.42, 120) - 28,
        alpha: 0.92,
        scaleY: 1.26,
        duration: drawTime,
        ease: 'Sine.InOut',
        yoyo: true,
        onComplete: () => {
          if (blade.active) blade.destroy();
        },
      });
      this.time.delayedCall(Math.max(80, attack.windupMs - 120), () => {
        if (this.bossState.defeated) return;
        this.addBossShadowAfterimage(12, attack.warningColor);
        this.placeBossForAttack(startX, startY);
        this.boss.setFlipX(endX < startX);
        this.dashBossTo(endX, endY, 150, attack.warningColor, () => {
          this.settleBossAfterAttack(this.boss.x - Math.cos(angle) * 42, this.boss.y - Math.sin(angle) * 28);
          this.addBossShadowAfterimage(12, attack.warningColor);
        });
      });
      return;
    }

    if (attack.behavior === 'null-crosscut') {
      const realWarnings = warnings.filter((warning) => !warning.getData('decorative'));
      const first = realWarnings[0] ?? mainWarning;
      const second = realWarnings[1] ?? mainWarning;
      const startX = (first.getData('attackStartX') as number | undefined) ?? first.x;
      const startY = (first.getData('attackStartY') as number | undefined) ?? first.y;
      const endX = (first.getData('attackEndX') as number | undefined) ?? second.x;
      const endY = (first.getData('attackEndY') as number | undefined) ?? second.y;
      const returnStartX = (second.getData('attackStartX') as number | undefined) ?? endX;
      const returnStartY = (second.getData('attackStartY') as number | undefined) ?? endY;
      const returnEndX = (second.getData('attackEndX') as number | undefined) ?? startX;
      const returnEndY = (second.getData('attackEndY') as number | undefined) ?? startY;
      [first, second].forEach((warning, index) => {
        const sx = (warning.getData('attackStartX') as number | undefined) ?? warning.x;
        const sy = (warning.getData('attackStartY') as number | undefined) ?? warning.y;
        const ex = (warning.getData('attackEndX') as number | undefined) ?? warning.x;
        const ey = (warning.getData('attackEndY') as number | undefined) ?? warning.y;
        const angle = Phaser.Math.Angle.Between(sx, sy, ex, ey);
        const blade = addSeamVfx(this, 'boss', 'slash', sx, sy - 24, {
          width: 142,
          height: 96,
          depth: 872 + index,
          rotation: angle,
          alpha: 0.66,
          tint: attack.warningColor,
          lifespanMs: attack.windupMs + 120,
        }) ?? this.add.rectangle(sx, sy - 24, 14, 64, attack.warningColor, 0.28)
          .setRotation(angle + Math.PI / 2)
          .setDepth(872 + index);
        this.tweens.add({
          targets: blade,
          x: Phaser.Math.Linear(sx, ex, 0.46),
          y: Phaser.Math.Linear(sy, ey, 0.46) - 24,
          alpha: 0.9,
          scaleY: 1.3,
          delay: index * 90,
          duration: Math.max(160, attack.windupMs - 220),
          ease: 'Sine.InOut',
          yoyo: true,
          onComplete: () => {
            if (blade.active) blade.destroy();
          },
        });
      });
      this.time.delayedCall(Math.max(90, attack.windupMs - 160), () => {
        if (this.bossState.defeated) return;
        this.placeBossForAttack(startX, startY);
        this.boss.setFlipX(endX < startX);
        this.addBossShadowAfterimage(12, attack.warningColor);
        this.dashBossTo(endX, endY, 120, attack.warningColor, () => {
          if (this.bossState.defeated) return;
          this.placeBossForAttack(returnStartX, returnStartY);
          this.boss.setFlipX(returnEndX < returnStartX);
          this.addBossShadowAfterimage(12, attack.warningColor);
          this.dashBossTo(returnEndX, returnEndY, 130, attack.warningColor, () => {
            this.settleBossAfterAttack(this.boss.x + (this.player.x < this.boss.x ? -38 : 38), this.boss.y + (this.player.y < this.boss.y ? -18 : 18));
            this.addBossShadowAfterimage(12, attack.warningColor);
          });
        });
      });
      return;
    }

    if (attack.behavior === 'null-pursuit') {
      const realWarnings = warnings.filter((warning) => !warning.getData('decorative'));
      realWarnings.forEach((warning, index) => {
        const targetX = (warning.getData('attackX') as number | undefined) ?? warning.x;
        const targetY = (warning.getData('attackY') as number | undefined) ?? warning.y;
        const startX = (warning.getData('attackStartX') as number | undefined) ?? this.boss.x;
        const startY = (warning.getData('attackStartY') as number | undefined) ?? this.boss.y;
        const angle = Phaser.Math.Angle.Between(startX, startY, targetX, targetY);
        const blade = addSeamVfx(this, 'boss', 'slash', startX, startY - 22, {
          width: 124,
          height: 86,
          depth: 876 + index,
          rotation: angle,
          alpha: 0.62,
          tint: attack.warningColor,
          lifespanMs: attack.windupMs + index * 120,
        }) ?? this.add.rectangle(startX, startY - 22, 12, 58, attack.warningColor, 0.28)
          .setRotation(angle + Math.PI / 2)
          .setDepth(876 + index);
        const delay = Math.max(80, attack.windupMs - 190 + index * 120);
        this.tweens.add({
          targets: blade,
          x: Phaser.Math.Linear(startX, targetX, 0.72),
          y: Phaser.Math.Linear(startY, targetY, 0.72) - 22,
          alpha: 0.92,
          scaleY: 1.34,
          delay,
          duration: 145,
          ease: 'Cubic.In',
          onComplete: () => {
            if (blade.active) blade.destroy();
          },
        });
        this.time.delayedCall(delay, () => {
          if (this.bossState.defeated) return;
          this.boss.setFlipX(targetX < this.boss.x);
          this.addBossShadowAfterimage(12, attack.warningColor);
          this.dashBossTo(targetX, targetY, 135, attack.warningColor, () => {
            const retreat = clampPointToArenaBounds(
              targetX - Math.cos(angle) * 42,
              targetY - Math.sin(angle) * 28,
              this.walkableBounds,
            );
            this.settleBossAfterAttack(retreat.x, retreat.y);
            this.addBossShadowAfterimage(12, attack.warningColor);
          });
        });
      });
      return;
    }

    if (attack.behavior === 'mirror-step') {
      warnings.filter((warning) => !warning.getData('decorative')).forEach((warning, index) => {
        const targetX = (warning.getData('attackX') as number | undefined) ?? warning.x;
        const targetY = (warning.getData('attackY') as number | undefined) ?? warning.y;
        const ghost = addSeamVfx(this, 'boss', 'motes', this.boss.x, this.boss.y - 18, {
          width: 122,
          height: 122,
          depth: Math.max(this.boss.y, targetY) + 15,
          alpha: 0.5,
          tint: attack.warningColor,
          lifespanMs: attack.windupMs + 320,
        }) ?? this.add.ellipse(this.boss.x, this.boss.y - 18, 56, 74, attack.warningColor, 0.22)
          .setStrokeStyle(3, 0xf6ead3, 0.3)
          .setDepth(Math.max(this.boss.y, targetY) + 15);
        this.tweens.add({
          targets: ghost,
          x: targetX,
          y: targetY - 24,
          scaleX: 1.28,
          scaleY: 0.86,
          alpha: 0.88,
          delay: Math.max(20, attack.windupMs - 330 + index * 80),
          duration: 260,
          ease: 'Cubic.In',
          onComplete: () => {
            if (ghost.active) ghost.destroy();
          },
        });
      });
      this.tweens.add({
        targets: this.boss,
        alpha: 0.46,
        duration: Math.max(120, attack.windupMs * 0.46),
        yoyo: true,
        ease: 'Sine.InOut',
      });
    }
  }

  private createAttackWarnings(attack: BossAttackDefinition): Phaser.GameObjects.Shape[] {
    if (attack.behavior === 'binary-cage') {
      const x = Phaser.Math.Clamp(this.player.x + (this.player.x < this.boss.x ? -28 : 28), 220, 1040);
      const y = Phaser.Math.Clamp(this.player.y + (this.player.y < this.boss.y ? -18 : 18), 208, 548);
      const width = attack.width ?? 66;
      const depth = Math.max(this.player.y, this.boss.y) + 2;
      const vertical = this.add.rectangle(x, 386, width, 440, attack.warningColor, 0.18)
        .setStrokeStyle(2, 0xf6ead3, 0.28)
        .setDepth(depth);
      vertical.setData('attackX', x);
      vertical.setData('laneAxis', 'vertical');
      const horizontal = this.add.rectangle(640, y, 980, width, attack.warningColor, 0.18)
        .setStrokeStyle(2, 0xf6ead3, 0.28)
        .setDepth(y - 1);
      horizontal.setData('attackY', y);
      horizontal.setData('laneAxis', 'horizontal');

      const bracketTop = this.add.rectangle(x, y - width * 0.78, width * 2.1, 3, 0xf6ead3, 0.34).setDepth(depth + 2);
      const bracketBottom = this.add.rectangle(x, y + width * 0.78, width * 2.1, 3, 0xf6ead3, 0.34).setDepth(depth + 2);
      const bracketLeft = this.add.rectangle(x - width * 0.78, y, 3, width * 2.1, 0xf6ead3, 0.34).setDepth(depth + 2);
      const bracketRight = this.add.rectangle(x + width * 0.78, y, 3, width * 2.1, 0xf6ead3, 0.34).setDepth(depth + 2);
      [bracketTop, bracketBottom, bracketLeft, bracketRight].forEach((bracket) => {
        bracket.setData('decorative', true);
        bracket.setData('attackX', x);
        bracket.setData('attackY', y);
      });

      this.addLaneGlyphs(x, 386, 'vertical', attack.warningColor, depth + 3);
      this.addLaneGlyphs(640, y, 'horizontal', attack.warningColor, y + 2);
      return [vertical, horizontal, bracketTop, bracketBottom, bracketLeft, bracketRight];
    }

    if (attack.behavior === 'void-cleave') {
      const startX = this.boss.x;
      const startY = this.boss.y;
      const angle = Phaser.Math.Angle.Between(this.boss.x, this.boss.y, this.player.x, this.player.y);
      const reach = attack.id.includes('plus') ? 860 : 700;
      const endX = Phaser.Math.Clamp(startX + Math.cos(angle) * reach, this.walkableBounds.left + 24, this.walkableBounds.right - 24);
      const endY = Phaser.Math.Clamp(startY + Math.sin(angle) * reach * 0.78, this.walkableBounds.top + 30, this.walkableBounds.bottom - 20);
      const centerX = (startX + endX) / 2;
      const centerY = (startY + endY) / 2;
      const length = Phaser.Math.Distance.Between(startX, startY, endX, endY);
      const width = attack.width ?? 56;
      const rotation = Phaser.Math.Angle.Between(startX, startY, endX, endY);
      const warning = this.add.rectangle(centerX, centerY, length, width, attack.warningColor, 0.2)
        .setRotation(rotation)
        .setStrokeStyle(4, 0xf6ead3, 0.62)
        .setDepth(868);
      warning.setData('attackStartX', startX);
      warning.setData('attackStartY', startY);
      warning.setData('attackEndX', endX);
      warning.setData('attackEndY', endY);
      const edgeTop = this.add.rectangle(centerX, centerY - width * 0.58, length, 3, 0xf6ead3, 0.3)
        .setRotation(rotation)
        .setDepth(warning.depth + 1);
      const edgeBottom = this.add.rectangle(centerX, centerY + width * 0.58, length, 3, 0xf6ead3, 0.3)
        .setRotation(rotation)
        .setDepth(warning.depth + 1);
      [edgeTop, edgeBottom].forEach((edge) => {
        edge.setData('decorative', true);
        edge.setData('attackStartX', startX);
        edge.setData('attackStartY', startY);
        edge.setData('attackEndX', endX);
        edge.setData('attackEndY', endY);
      });
      for (let index = 0; index < 5; index += 1) {
        const t = (index + 1) / 6;
        const spark = addSeamVfx(
          this,
          'boss',
          index % 2 === 0 ? 'spark' : 'wisp',
          Phaser.Math.Linear(startX, endX, t),
          Phaser.Math.Linear(startY, endY, t) - 18,
          {
            width: index % 2 === 0 ? 74 : 92,
            height: index % 2 === 0 ? 54 : 70,
            depth: warning.depth + 2,
            rotation: rotation * 0.16,
            alpha: 0.46,
            tint: attack.warningColor,
            lifespanMs: attack.windupMs + index * 35,
          },
        );
        if (spark) {
          this.tweens.add({
            targets: spark,
            alpha: 0,
            y: spark.y - 20,
            duration: attack.windupMs,
            delay: index * 35,
            onComplete: () => spark.destroy(),
          });
        }
      }
      return [warning, edgeTop, edgeBottom];
    }

    if (attack.behavior === 'null-crosscut') {
      const centerX = Phaser.Math.Clamp(this.player.x, this.walkableBounds.left + 120, this.walkableBounds.right - 120);
      const centerY = Phaser.Math.Clamp(this.player.y, this.walkableBounds.top + 84, this.walkableBounds.bottom - 68);
      const length = attack.id.includes('plus') ? 650 : 560;
      const width = attack.width ?? 52;
      const baseAngle = Phaser.Math.Angle.Between(this.boss.x, this.boss.y, this.player.x, this.player.y);
      const angles = [baseAngle + Math.PI / 4, baseAngle - Math.PI / 4];
      const warnings = angles.flatMap((angle, index) => {
        const startX = Phaser.Math.Clamp(centerX - Math.cos(angle) * length * 0.5, this.walkableBounds.left + 24, this.walkableBounds.right - 24);
        const startY = Phaser.Math.Clamp(centerY - Math.sin(angle) * length * 0.38, this.walkableBounds.top + 26, this.walkableBounds.bottom - 22);
        const endX = Phaser.Math.Clamp(centerX + Math.cos(angle) * length * 0.5, this.walkableBounds.left + 24, this.walkableBounds.right - 24);
        const endY = Phaser.Math.Clamp(centerY + Math.sin(angle) * length * 0.38, this.walkableBounds.top + 26, this.walkableBounds.bottom - 22);
        const lineLength = Phaser.Math.Distance.Between(startX, startY, endX, endY);
        const rotation = Phaser.Math.Angle.Between(startX, startY, endX, endY);
        const line = this.add.rectangle((startX + endX) / 2, (startY + endY) / 2, lineLength, width, attack.warningColor, 0.16)
          .setRotation(rotation)
          .setStrokeStyle(3, 0xf6ead3, index === 0 ? 0.54 : 0.34)
          .setDepth(866 + index);
        line.setData('attackStartX', startX);
        line.setData('attackStartY', startY);
        line.setData('attackEndX', endX);
        line.setData('attackEndY', endY);
        const brightEdge = this.add.rectangle((startX + endX) / 2, (startY + endY) / 2, lineLength, 5, 0xf6ead3, index === 0 ? 0.34 : 0.24)
          .setRotation(rotation)
          .setDepth(line.depth + 1);
        brightEdge.setData('decorative', true);
        brightEdge.setData('attackStartX', startX);
        brightEdge.setData('attackStartY', startY);
        brightEdge.setData('attackEndX', endX);
        brightEdge.setData('attackEndY', endY);
        const tokenSpark = addSeamVfx(
          this,
          'boss',
          index === 0 ? 'crescent' : 'spark',
          centerX + (index === 0 ? -58 : 34),
          centerY - 36 + index * 68,
          {
            width: index === 0 ? 108 : 84,
            height: index === 0 ? 78 : 62,
            depth: line.depth + 2,
            alpha: 0.5,
            tint: attack.warningColor,
            lifespanMs: attack.windupMs + index * 80,
          },
        );
        if (tokenSpark) {
          this.tweens.add({
            targets: tokenSpark,
            alpha: 0,
            y: tokenSpark.y - 18,
            duration: attack.windupMs + index * 80,
            onComplete: () => tokenSpark.destroy(),
          });
        }
        return [line, brightEdge];
      });
      return warnings;
    }

    if (attack.behavior === 'null-pursuit') {
      const count = attack.pulses ?? 3;
      const moveAngle = Phaser.Math.Angle.Between(0, 0, this.lastMoveDirection.x, this.lastMoveDirection.y);
      const moving = this.currentVelocity.lengthSq() > 1200;
      const baseAngle = moving ? moveAngle : Phaser.Math.Angle.Between(this.boss.x, this.boss.y, this.player.x, this.player.y);
      const start = new Phaser.Math.Vector2(this.boss.x, this.boss.y);
      return Array.from({ length: count }, (_, index) => {
        const lead = 76 + index * 58;
        const sidestep = (index % 2 === 0 ? -1 : 1) * (34 + index * 10);
        const rawX = this.player.x + Math.cos(baseAngle) * lead + Math.cos(baseAngle + Math.PI / 2) * sidestep;
        const rawY = this.player.y + Math.sin(baseAngle) * lead * 0.72 + Math.sin(baseAngle + Math.PI / 2) * sidestep * 0.72;
        const point = clampPointToArenaBounds(rawX, rawY, this.walkableBounds);
        const previous = index === 0 ? start : clampPointToArenaBounds(
          this.player.x + Math.cos(baseAngle) * (76 + (index - 1) * 58),
          this.player.y + Math.sin(baseAngle) * (76 + (index - 1) * 58) * 0.72,
          this.walkableBounds,
        );
        const warning = this.add.ellipse(point.x, point.y, attack.radius * 1.62, attack.radius * 0.78, attack.warningColor, 0.18)
          .setStrokeStyle(3, 0xf6ead3, 0.34)
          .setDepth(point.y - 1);
        warning.setData('attackX', point.x);
        warning.setData('attackY', point.y);
        warning.setData('attackStartX', previous.x);
        warning.setData('attackStartY', previous.y);
        const lineAngle = Phaser.Math.Angle.Between(previous.x, previous.y, point.x, point.y);
        const distance = Phaser.Math.Distance.Between(previous.x, previous.y, point.x, point.y);
        const path = this.add.rectangle((previous.x + point.x) / 2, (previous.y + point.y) / 2, distance, attack.width ?? 46, attack.warningColor, 0.12)
          .setRotation(lineAngle)
          .setStrokeStyle(2, 0xf6ead3, 0.2)
          .setDepth(Math.max(previous.y, point.y) - 2);
        path.setData('decorative', true);
        path.setData('attackX', point.x);
        path.setData('attackY', point.y);
        const token = addSeamVfx(this, 'boss', index === count - 1 ? 'seal' : 'spark', point.x, point.y - 16, {
          width: index === count - 1 ? 86 : 66,
          height: index === count - 1 ? 72 : 48,
          depth: point.y + 2,
          alpha: 0.46,
          tint: attack.warningColor,
          lifespanMs: attack.windupMs + index * 135,
        });
        this.tweens.add({
          targets: token ? [path, token] : [path],
          alpha: 0,
          duration: attack.windupMs + index * 135,
          onComplete: () => {
            path.destroy();
            token?.destroy();
          },
        });
        return warning;
      });
    }

    if (attack.shape === 'lane') {
      const axis = this.pickLaneAxis(attack);
      const depth = Math.max(this.player.y, this.boss.y) + 2;
      if (axis === 'vertical') {
        const x = Phaser.Math.Clamp(this.player.x, 220, 1040);
        const lane = this.add.rectangle(x, 386, attack.width ?? 76, 440, attack.warningColor, 0.2).setDepth(depth);
        lane.setData('attackX', x);
        lane.setData('laneAxis', axis);
        const edgeOne = this.add.rectangle(x - (attack.width ?? 76) / 2, 386, 3, 440, 0xf6ead3, 0.35).setDepth(depth + 1);
        const edgeTwo = this.add.rectangle(x + (attack.width ?? 76) / 2, 386, 3, 440, 0xf6ead3, 0.35).setDepth(depth + 1);
        [edgeOne, edgeTwo].forEach((edge) => {
          edge.setData('attackX', x);
          edge.setData('laneAxis', axis);
          edge.setData('decorative', true);
        });
        this.addLaneGlyphs(x, 386, axis, attack.warningColor, depth + 2);
        return [lane, edgeOne, edgeTwo];
      }
      const y = Phaser.Math.Clamp(this.player.y, 200, 548);
      const lane = this.add.rectangle(640, y, 980, attack.width ?? 76, attack.warningColor, 0.2).setDepth(y - 1);
      lane.setData('attackY', y);
      lane.setData('laneAxis', axis);
      const edgeOne = this.add.rectangle(640, y - (attack.width ?? 76) / 2, 980, 3, 0xf6ead3, 0.35).setDepth(y);
      const edgeTwo = this.add.rectangle(640, y + (attack.width ?? 76) / 2, 980, 3, 0xf6ead3, 0.35).setDepth(y);
      [edgeOne, edgeTwo].forEach((edge) => {
        edge.setData('attackY', y);
        edge.setData('laneAxis', axis);
        edge.setData('decorative', true);
      });
      this.addLaneGlyphs(640, y, axis, attack.warningColor, y + 1);
      return [lane, edgeOne, edgeTwo];
    }

    if (attack.shape === 'ring') {
      const outer = this.add.circle(this.boss.x, this.boss.y, attack.radius, attack.warningColor, 0.18).setDepth(this.boss.y - 1);
      const inner = this.add.circle(this.boss.x, this.boss.y, attack.radius * 0.48, 0x09070d, 0.34).setDepth(this.boss.y);
      outer.setData('attackX', this.boss.x);
      outer.setData('attackY', this.boss.y);
      inner.setData('attackX', this.boss.x);
      inner.setData('attackY', this.boss.y);
      inner.setData('decorative', true);
      const shards = this.addMaskShards(this.boss.x, this.boss.y, attack.radius, attack.warningColor);
      return [outer, inner, ...shards];
    }

    if (attack.shape === 'multi-burst') {
      const count = attack.pulses ?? 3;
      return Array.from({ length: count }, (_, index) => {
        const angle = Phaser.Math.Angle.Between(this.boss.x, this.boss.y, this.player.x, this.player.y) + Phaser.Math.DegToRad(-22 + index * 22);
        const x = Phaser.Math.Clamp(this.player.x + Math.cos(angle) * (52 + index * 58), 180, 1100);
        const y = Phaser.Math.Clamp(this.player.y + Math.sin(angle) * (34 + index * 42), 196, 570);
        const warning = this.add.circle(x, y, attack.radius, attack.warningColor, 0.18).setDepth(y - 1);
        warning.setData('attackX', x);
        warning.setData('attackY', y);
        warning.setStrokeStyle(3, 0xf6ead3, 0.28);
        const slash = this.add.rectangle(x, y, 10, attack.radius * 1.48, attack.warningColor, 0.22)
          .setDepth(y)
          .setRotation(angle + Math.PI / 2);
        this.tweens.add({
          targets: slash,
          alpha: 0,
          scaleY: 1.4,
          duration: attack.windupMs + attack.activeMs + index * 170,
          onComplete: () => slash.destroy(),
        });
        return warning;
      });
    }

    if (attack.behavior === 'mirror-step') {
      const baseX = Phaser.Math.Clamp(this.player.x, 210, 1060);
      const baseY = Phaser.Math.Clamp(this.player.y, 208, 560);
      const targetCount = attack.id.includes('plus') ? 2 : 1;
      const angleToPlayer = Phaser.Math.Angle.Between(this.boss.x, this.boss.y, this.player.x, this.player.y);
      return Array.from({ length: targetCount }, (_, index) => {
        const offsetAngle = angleToPlayer + (index === 0 ? 0 : Math.PI / 2);
        const x = index === 0 ? baseX : Phaser.Math.Clamp(baseX + Math.cos(offsetAngle) * 112, 210, 1060);
        const y = index === 0 ? baseY : Phaser.Math.Clamp(baseY + Math.sin(offsetAngle) * 72, 208, 560);
        const warning = this.add.circle(x, y, attack.radius, attack.warningColor, 0.16)
          .setStrokeStyle(3, 0xf6ead3, 0.36)
          .setDepth(y - 1);
        warning.setData('attackX', x);
        warning.setData('attackY', y);
        const shadow = this.add.ellipse(x, y + 4, attack.radius * 1.48, attack.radius * 0.66, 0x09070d, 0.34)
          .setStrokeStyle(2, attack.warningColor, 0.32)
          .setDepth(y);
        shadow.setData('attackX', x);
        shadow.setData('attackY', y);
        shadow.setData('decorative', true);
        const glyph = addSeamVfx(this, 'boss', index === 0 ? 'motes' : 'wisp', x, y - 12, {
          width: 92,
          height: 72,
          depth: y + 1,
          alpha: 0.42,
          tint: attack.warningColor,
          lifespanMs: attack.windupMs + attack.activeMs,
        });
        if (glyph) {
          this.tweens.add({
            targets: glyph,
            alpha: 0,
            y: y - 30,
            duration: attack.windupMs + attack.activeMs,
            onComplete: () => glyph.destroy(),
          });
        }
        return [warning, shadow];
      }).flat();
    }

    const warning = this.add.circle(this.player.x, this.player.y, attack.radius, attack.warningColor, 0.18)
      .setDepth(this.player.y - 1);
    warning.setData('attackX', this.player.x);
    warning.setData('attackY', this.player.y);
    const palmLines = [0, 1, 2, 3, 4].map((index) => {
      const angle = Phaser.Math.DegToRad(-48 + index * 24);
      const finger = this.add.rectangle(
        warning.x + Math.cos(angle) * 28,
        warning.y + Math.sin(angle) * 20,
        8,
        54,
        attack.warningColor,
        0.2,
      ).setDepth(warning.y).setRotation(angle + Math.PI / 2);
      finger.setData('decorative', true);
      finger.setData('attackX', warning.x);
      finger.setData('attackY', warning.y);
      return finger;
    });
    return [warning, ...palmLines];
  }

  private resolveBossAttack(attack: BossAttackDefinition, warnings: Phaser.GameObjects.Shape[]): void {
    const hit = warnings.some((warning) => !warning.getData('decorative') && this.isPlayerInsideAttack(attack, warning));
    if (!this.isPlayerProtected() && hit) {
      this.damagePlayer(attack.damage);
      this.applyAttackForce(attack, warnings.find((warning) => !warning.getData('decorative')) ?? warnings[0]);
    }
    this.playAttackImpactMotion(attack, warnings);
    this.flashAttackImpact(attack, warnings);
    this.scheduleAftershock(attack, warnings);
  }

  private scheduleAftershock(attack: BossAttackDefinition, warnings: Phaser.GameObjects.Shape[]): void {
    if (!attack.aftershock) return;
    const origins = warnings
      .filter((warning) => !warning.getData('decorative'))
      .slice(0, attack.shape === 'ring' ? 1 : 3)
      .map((warning) => ({
        x: (warning.getData('attackX') as number | undefined) ?? warning.x,
        y: (warning.getData('attackY') as number | undefined) ?? warning.y,
      }));
    if (origins.length === 0) return;
    this.time.delayedCall(attack.aftershock.delayMs, () => {
      if (this.bossState.defeated || this.pauseMenu.isOpen) return;
      origins.forEach((origin, index) => {
        const radius = attack.radius * attack.aftershock!.radiusScale;
        const echo = addBossImpactVfx(this, 'ring', origin.x, origin.y, {
          width: radius * 2.25,
          height: radius * 1.42,
          depth: origin.y + 12,
          alpha: 0.66,
          tint: attack.warningColor,
        }) ?? addGeneratedTelegraphSigil(this, 'boss', 'ring', origin.x, origin.y - 6, {
          width: radius * 2,
          height: radius * 1.24,
          depth: origin.y + 12,
          alpha: 0.48,
          tint: attack.warningColor,
        });
        const burst = addSeamVfx(this, 'boss', index % 2 === 0 ? 'burst' : 'motes', origin.x, origin.y - radius * 0.24, {
          width: radius * 1.15,
          height: radius * 0.88,
          depth: origin.y + 14,
          alpha: 0.56,
          tint: 0xf6ead3,
        });
        const visuals = [echo, burst].filter(Boolean) as Phaser.GameObjects.Image[];
        this.tweens.add({
          targets: visuals,
          alpha: 0.48,
          scale: 1.18,
          duration: 120,
          yoyo: true,
          hold: 80,
          ease: 'Sine.InOut',
          onComplete: () => {
            const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, origin.x, origin.y);
            const ringSafeCenter = attack.shape === 'ring' && distance < radius * 0.42;
            if (!this.isPlayerProtected() && !ringSafeCenter && distance < radius) {
              this.damagePlayer(Math.max(1, Math.round(attack.damage * attack.aftershock!.damageScale)));
              const angle = Phaser.Math.Angle.Between(origin.x, origin.y, this.player.x, this.player.y);
              const push = new Phaser.Math.Vector2(Math.cos(angle) * 170, Math.sin(angle) * 120);
              this.currentVelocity.copy(push);
              this.safeSetVelocity(this.player, push.x, push.y);
            }
            addVoidBurst(this, origin.x, origin.y - 10, attack.warningColor, origin.y + 18);
            visuals.forEach((visual) => visual.destroy());
          },
        });
      });
    });
  }

  private isPlayerInsideAttack(attack: BossAttackDefinition, warning: Phaser.GameObjects.Shape): boolean {
    if (attack.shape === 'lane') {
      if (attack.behavior === 'void-cleave') {
        const startX = warning.getData('attackStartX') as number;
        const startY = warning.getData('attackStartY') as number;
        const endX = warning.getData('attackEndX') as number;
        const endY = warning.getData('attackEndY') as number;
        return distanceToSegment(this.player.x, this.player.y, startX, startY, endX, endY) < (attack.width ?? 56) / 2 + 20;
      }
      if (attack.behavior === 'null-crosscut') {
        const startX = warning.getData('attackStartX') as number;
        const startY = warning.getData('attackStartY') as number;
        const endX = warning.getData('attackEndX') as number;
        const endY = warning.getData('attackEndY') as number;
        return distanceToSegment(this.player.x, this.player.y, startX, startY, endX, endY) < (attack.width ?? 52) / 2 + 18;
      }
      const axis = warning.getData('laneAxis') as 'horizontal' | 'vertical' | undefined;
      if (axis === 'vertical') {
        const x = warning.getData('attackX') as number;
        return Math.abs(this.player.x - x) < (attack.width ?? 76) / 2 + 18;
      }
      const y = warning.getData('attackY') as number;
      return Math.abs(this.player.y - y) < (attack.width ?? 76) / 2 + 18;
    }
    const x = warning.getData('attackX') as number;
    const y = warning.getData('attackY') as number;
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y);
    if (attack.shape === 'ring') {
      return distance > attack.radius * 0.44 && distance < attack.radius * 1.1;
    }
    if (attack.behavior === 'null-pursuit') {
      return distance < attack.radius + 26;
    }
    return distance < attack.radius;
  }

  private flashAttackImpact(attack: BossAttackDefinition, warnings: Phaser.GameObjects.Shape[]): void {
    warnings.filter((warning) => !warning.getData('decorative')).forEach((warning) => {
      const x = (warning.getData('attackX') as number | undefined) ?? warning.x;
      const y = (warning.getData('attackY') as number | undefined) ?? warning.y;
      const axis = warning.getData('laneAxis') as 'horizontal' | 'vertical' | undefined;
      if (attack.behavior === 'void-cleave') {
        const startX = (warning.getData('attackStartX') as number | undefined) ?? this.boss.x;
        const startY = (warning.getData('attackStartY') as number | undefined) ?? this.boss.y;
        const endX = (warning.getData('attackEndX') as number | undefined) ?? x;
        const endY = (warning.getData('attackEndY') as number | undefined) ?? y;
        const rotation = Phaser.Math.Angle.Between(startX, startY, endX, endY);
        const length = Phaser.Math.Distance.Between(startX, startY, endX, endY);
        const impact = addBossImpactVfx(this, 'slash-line', (startX + endX) / 2, (startY + endY) / 2, {
          width: length,
          height: Math.max(90, attack.width ?? 58),
          depth: 874,
          rotation,
          alpha: 0.78,
          tint: attack.warningColor,
        }) ?? this.add.rectangle((startX + endX) / 2, (startY + endY) / 2, length, attack.width ?? 58, attack.warningColor, 0.36)
          .setRotation(rotation)
          .setDepth(874);
        this.tweens.add({
          targets: impact,
          alpha: 0,
          scaleY: 1.85,
          duration: attack.activeMs,
          ease: 'Quad.Out',
          onComplete: () => impact.destroy(),
        });
        return;
      }
      if (attack.behavior === 'null-crosscut') {
        const startX = (warning.getData('attackStartX') as number | undefined) ?? x;
        const startY = (warning.getData('attackStartY') as number | undefined) ?? y;
        const endX = (warning.getData('attackEndX') as number | undefined) ?? x;
        const endY = (warning.getData('attackEndY') as number | undefined) ?? y;
        const rotation = Phaser.Math.Angle.Between(startX, startY, endX, endY);
        const length = Phaser.Math.Distance.Between(startX, startY, endX, endY);
        const impact = addBossImpactVfx(this, 'slash-line', (startX + endX) / 2, (startY + endY) / 2, {
          width: length,
          height: Math.max(82, attack.width ?? 54),
          depth: 875,
          rotation,
          alpha: 0.7,
          tint: attack.warningColor,
        }) ?? this.add.rectangle((startX + endX) / 2, (startY + endY) / 2, length, attack.width ?? 54, attack.warningColor, 0.28)
          .setRotation(rotation)
          .setDepth(875);
        this.tweens.add({
          targets: impact,
          alpha: 0,
          scaleY: 1.72,
          duration: attack.activeMs,
          ease: 'Quad.Out',
          onComplete: () => impact.destroy(),
        });
        return;
      }
      const impact =
        attack.shape === 'lane'
          ? addBossImpactVfx(this, 'slash-line', axis === 'vertical' ? x : 640, axis === 'vertical' ? 386 : y, {
            width: axis === 'vertical' ? 168 : 980,
            height: axis === 'vertical' ? 440 : Math.max(94, attack.width ?? 76),
            depth: y + 2,
            rotation: axis === 'vertical' ? Math.PI / 2 : 0,
            alpha: 0.74,
            tint: attack.warningColor,
          }) ?? (axis === 'vertical'
            ? this.add.rectangle(x, 386, attack.width ?? 76, 440, attack.warningColor, 0.36)
            : this.add.rectangle(640, y, 980, attack.width ?? 76, attack.warningColor, 0.36))
          : addBossImpactVfx(this, attack.behavior === 'tracking-palm' ? 'palm' : 'ring', x, y, {
            width: attack.radius * 2.25,
            height: attack.radius * 1.42,
            depth: y + 2,
            alpha: 0.74,
            tint: attack.warningColor,
          }) ?? this.add.circle(x, y, attack.radius, attack.warningColor, 0.28);
      impact.setDepth(y + 2);
      this.tweens.add({
        targets: impact,
        alpha: 0,
        scale: 1.18,
        duration: attack.activeMs,
        onComplete: () => impact.destroy(),
      });
    });
  }

  private playAttackImpactMotion(attack: BossAttackDefinition, warnings: Phaser.GameObjects.Shape[]): void {
    warnings.filter((warning) => !warning.getData('decorative')).forEach((warning, index) => {
      const x = (warning.getData('attackX') as number | undefined) ?? warning.x;
      const y = (warning.getData('attackY') as number | undefined) ?? warning.y;
      if (attack.behavior === 'tracking-palm') {
        addGroundCrack(this, x, y, attack.warningColor, y + 8);
        addVoidBurst(this, x, y - 8, attack.warningColor, y + 16);
        this.cameras.main.shake(120, 0.005);
        return;
      }
      if (attack.behavior === 'mask-ring') {
        addGroundCrack(this, this.boss.x, this.boss.y + 10, attack.warningColor, this.boss.y + 18);
        const ring = addBossImpactVfx(this, 'ring', this.boss.x, this.boss.y + 4, {
          width: attack.radius * 2.25,
          height: attack.radius * 1.42,
          depth: this.boss.y + 14,
          alpha: 0.78,
          tint: attack.warningColor,
        }) ?? this.add.circle(this.boss.x, this.boss.y, attack.radius * 0.5, 0xf6ead3, 0)
          .setStrokeStyle(8, attack.warningColor, 0.62)
          .setDepth(this.boss.y + 14);
        this.tweens.add({
          targets: ring,
          scaleX: ring.scaleX * 1.32,
          scaleY: ring.scaleY * 1.32,
          alpha: 0,
          duration: 300,
          ease: 'Quad.Out',
          onComplete: () => ring.destroy(),
        });
        this.cameras.main.shake(150, 0.006);
        return;
      }
      if (attack.behavior === 'lane-sweep') {
        const axis = warning.getData('laneAxis') as 'horizontal' | 'vertical' | undefined;
        const slash = addBossImpactVfx(this, 'slash-line', axis === 'vertical' ? x : 640, axis === 'vertical' ? 386 : y, {
          width: axis === 'vertical' ? 170 : 980,
          height: axis === 'vertical' ? 440 : Math.max(92, attack.width ?? 76),
          depth: y + 18,
          rotation: axis === 'vertical' ? Math.PI / 2 : 0,
          alpha: 0.68,
          tint: 0xf6ead3,
        }) ?? (axis === 'vertical'
          ? this.add.rectangle(x, 386, attack.width ?? 76, 440, 0xf6ead3, 0.22)
          : this.add.rectangle(640, y, 980, attack.width ?? 76, 0xf6ead3, 0.22));
        slash.setDepth(y + 18);
        this.tweens.add({
          targets: slash,
          alpha: 0,
          scaleX: axis === 'vertical' ? 1.18 : 1.02,
          scaleY: axis === 'vertical' ? 1.02 : 1.18,
          duration: 300,
          ease: 'Quad.Out',
          onComplete: () => slash.destroy(),
        });
        this.cameras.main.shake(90, 0.004);
        return;
      }
      if (attack.behavior === 'binary-cage') {
        const axis = warning.getData('laneAxis') as 'horizontal' | 'vertical' | undefined;
        const slash = addBossImpactVfx(this, 'slash-line', axis === 'vertical' ? x : 640, axis === 'vertical' ? 386 : y, {
          width: axis === 'vertical' ? 176 : 980,
          height: axis === 'vertical' ? 440 : Math.max(94, attack.width ?? 72),
          depth: y + 18,
          rotation: axis === 'vertical' ? Math.PI / 2 : 0,
          alpha: 0.72,
          tint: 0xf6ead3,
        }) ?? (axis === 'vertical'
          ? this.add.rectangle(x, 386, attack.width ?? 72, 440, 0xf6ead3, 0.24)
          : this.add.rectangle(640, y, 980, attack.width ?? 72, 0xf6ead3, 0.24));
        slash.setDepth(y + 18);
        this.tweens.add({
          targets: slash,
          alpha: 0,
          scaleX: axis === 'vertical' ? 1.28 : 1.04,
          scaleY: axis === 'vertical' ? 1.04 : 1.28,
          duration: 340,
          ease: 'Quad.Out',
          onComplete: () => slash.destroy(),
        });
        addVoidBurst(this, x, y - 8, attack.warningColor, y + 20);
        this.cameras.main.shake(120, 0.005);
        return;
      }
      if (attack.behavior === 'void-cleave') {
        const startX = (warning.getData('attackStartX') as number | undefined) ?? this.boss.x;
        const startY = (warning.getData('attackStartY') as number | undefined) ?? this.boss.y;
        const endX = (warning.getData('attackEndX') as number | undefined) ?? x;
        const endY = (warning.getData('attackEndY') as number | undefined) ?? y;
        const angle = Phaser.Math.Angle.Between(startX, startY, endX, endY);
        const length = Phaser.Math.Distance.Between(startX, startY, endX, endY);
        const slash = addBossImpactVfx(this, 'slash-line', (startX + endX) / 2, (startY + endY) / 2, {
          width: length,
          height: Math.max(96, attack.width ?? 58),
          depth: 874,
          rotation: angle,
          alpha: 0.84,
          tint: 0xf6ead3,
        }) ?? this.add.rectangle((startX + endX) / 2, (startY + endY) / 2, length, attack.width ?? 58, 0xf6ead3, 0.38)
          .setRotation(angle)
          .setDepth(874);
        const shock = addBossImpactVfx(this, 'crescent', (startX + endX) / 2, (startY + endY) / 2, {
          width: Math.min(length * 0.72, 520),
          height: 142,
          depth: slash.depth + 1,
          rotation: angle,
          alpha: 0.72,
          tint: attack.warningColor,
        }) ?? this.add.rectangle((startX + endX) / 2, (startY + endY) / 2, length * 0.92, 8, attack.warningColor, 0.74)
          .setRotation(angle)
          .setDepth(slash.depth + 1);
        this.tweens.add({
          targets: [slash, shock],
          alpha: 0,
          scaleY: 1.86,
          duration: 360,
          ease: 'Quad.Out',
          onComplete: () => {
            slash.destroy();
            shock.destroy();
          },
        });
        addGroundCrack(this, endX, endY + 4, attack.warningColor, Math.max(startY, endY) + 12);
        this.cameras.main.shake(170, 0.008);
        return;
      }
      if (attack.behavior === 'null-crosscut') {
        const startX = (warning.getData('attackStartX') as number | undefined) ?? x;
        const startY = (warning.getData('attackStartY') as number | undefined) ?? y;
        const endX = (warning.getData('attackEndX') as number | undefined) ?? x;
        const endY = (warning.getData('attackEndY') as number | undefined) ?? y;
        const angle = Phaser.Math.Angle.Between(startX, startY, endX, endY);
        const length = Phaser.Math.Distance.Between(startX, startY, endX, endY);
        const slash = addBossImpactVfx(this, 'slash-line', (startX + endX) / 2, (startY + endY) / 2, {
          width: length,
          height: 82,
          depth: 876 + index,
          rotation: angle,
          alpha: 0.8,
          tint: 0xf6ead3,
        }) ?? this.add.rectangle((startX + endX) / 2, (startY + endY) / 2, length, 8, 0xf6ead3, 0.64)
          .setRotation(angle)
          .setDepth(876 + index);
        const fracture = addBossImpactVfx(this, 'crescent', (startX + endX) / 2, (startY + endY) / 2, {
          width: Math.min(length * 0.68, 420),
          height: Math.max(104, attack.width ?? 52),
          depth: slash.depth - 1,
          rotation: angle,
          alpha: 0.58,
          tint: attack.warningColor,
        }) ?? this.add.rectangle((startX + endX) / 2, (startY + endY) / 2, length * 0.74, attack.width ?? 52, attack.warningColor, 0.22)
          .setRotation(angle)
          .setDepth(slash.depth - 1);
        this.tweens.add({
          targets: [slash, fracture],
          alpha: 0,
          scaleY: 2.05,
          duration: 320,
          ease: 'Quad.Out',
          onComplete: () => {
            slash.destroy();
            fracture.destroy();
          },
        });
        addVoidBurst(this, Phaser.Math.Linear(startX, endX, 0.5), Phaser.Math.Linear(startY, endY, 0.5) - 12, attack.warningColor, 884);
        this.cameras.main.shake(130 + index * 35, 0.006 + index * 0.0015);
        return;
      }
      if (attack.behavior === 'null-pursuit') {
        const startX = (warning.getData('attackStartX') as number | undefined) ?? this.boss.x;
        const startY = (warning.getData('attackStartY') as number | undefined) ?? this.boss.y;
        const angle = Phaser.Math.Angle.Between(startX, startY, x, y);
        const length = Phaser.Math.Distance.Between(startX, startY, x, y);
        const slash = addBossImpactVfx(this, 'slash-line', (startX + x) / 2, (startY + y) / 2, {
          width: length,
          height: 76,
          depth: y + 22,
          rotation: angle,
          alpha: 0.78,
          tint: 0xf6ead3,
        }) ?? this.add.rectangle((startX + x) / 2, (startY + y) / 2, length, 9, 0xf6ead3, 0.62)
          .setRotation(angle)
          .setDepth(y + 22);
        const footprint = addBossImpactVfx(this, 'footprint', x, y, {
          width: attack.radius * 2.15,
          height: attack.radius * 1.5,
          depth: y + 20,
          alpha: 0.78,
          tint: attack.warningColor,
        }) ?? this.add.ellipse(x, y, attack.radius * 1.7, attack.radius * 0.78, attack.warningColor, 0.28)
          .setDepth(y + 20);
        this.tweens.add({
          targets: [slash, footprint],
          alpha: 0,
          scaleY: 1.75,
          duration: 260,
          ease: 'Quad.Out',
          onComplete: () => {
            slash.destroy();
            footprint.destroy();
          },
        });
        addVoidBurst(this, x, y - 10, attack.warningColor, y + 24);
        this.cameras.main.shake(120, 0.0055);
        return;
      }
      if (attack.behavior === 'rift-chain') {
        const pillar = addBossImpactVfx(this, 'pillar', x, y - 42, {
          width: attack.radius * 1.7,
          height: attack.radius * 2.55,
          depth: y + 18,
          alpha: 0.82,
          tint: attack.warningColor,
        }) ?? this.add.rectangle(x, y - 24, attack.radius * 0.58, 28, attack.warningColor, 0.5)
          .setDepth(y + 18);
        const halo = addBossImpactVfx(this, 'ring', x, y, {
          width: attack.radius * 1.65,
          height: attack.radius * 1.02,
          depth: y + 17,
          alpha: 0.72,
          tint: attack.warningColor,
        }) ?? this.add.circle(x, y, attack.radius * 0.42, 0xf6ead3, 0)
          .setStrokeStyle(4, attack.warningColor, 0.64)
          .setDepth(y + 17);
        this.tweens.add({
          targets: pillar,
          y: y - 78,
          displayHeight: attack.radius * 2.3,
          alpha: 0,
          delay: index * 30,
          duration: 320,
          ease: 'Cubic.Out',
          onComplete: () => pillar.destroy(),
        });
        this.tweens.add({
          targets: halo,
          scaleX: halo.scaleX * 1.55,
          scaleY: halo.scaleY * 1.55,
          alpha: 0,
          duration: 300,
          onComplete: () => halo.destroy(),
        });
        return;
      }
      if (attack.behavior === 'mirror-step') {
        addGroundCrack(this, x, y + 2, attack.warningColor, y + 10);
        addVoidBurst(this, x, y - 14, attack.warningColor, y + 20);
        const after = addBossImpactVfx(this, 'palm', x, y - 20, {
          width: 138,
          height: 148,
          depth: y + 24,
          alpha: 0.68,
          tint: attack.warningColor,
        }) ?? this.add.ellipse(x, y - 20, 64, 84, attack.warningColor, 0.24)
          .setStrokeStyle(4, 0xf6ead3, 0.24)
          .setDepth(y + 24);
        const slash = addBossImpactVfx(this, 'crescent', x, y - 18, {
          width: 142,
          height: attack.radius * 1.8,
          depth: y + 25,
          rotation: index % 2 === 0 ? -0.7 : 0.7,
          alpha: 0.72,
          tint: 0xf6ead3,
        }) ?? this.add.rectangle(x, y - 18, 10, attack.radius * 1.7, 0xf6ead3, 0.38)
          .setRotation(index % 2 === 0 ? -0.7 : 0.7)
          .setDepth(y + 25);
        this.tweens.add({
          targets: [after, slash],
          alpha: 0,
          scaleX: 1.35,
          scaleY: 1.1,
          duration: 300,
          ease: 'Quad.Out',
          onComplete: () => {
            after.destroy();
            slash.destroy();
          },
        });
        this.cameras.main.shake(110, 0.005);
      }
    });
  }

  private pickLaneAxis(attack: BossAttackDefinition): 'horizontal' | 'vertical' {
    if (attack.laneAxis === 'horizontal' || attack.laneAxis === 'vertical') return attack.laneAxis;
    return Math.abs(this.player.x - this.boss.x) > Math.abs(this.player.y - this.boss.y) * 1.8 ? 'vertical' : 'horizontal';
  }

  private addLaneGlyphs(x: number, y: number, axis: 'horizontal' | 'vertical', color: number, depth: number): void {
    const count = 7;
    for (let index = 0; index < count; index += 1) {
      const offset = (index - Math.floor(count / 2)) * 92;
      const glyphX = axis === 'vertical' ? x : x + offset;
      const glyphY = axis === 'vertical' ? y + offset : y;
      const glyph = addSeamVfx(this, 'boss', index % 2 === 0 ? 'spark' : 'wisp', glyphX, glyphY, {
        width: axis === 'vertical' ? 54 : 70,
        height: axis === 'vertical' ? 70 : 54,
        depth,
        rotation: axis === 'vertical' ? Math.PI / 2 : 0,
        alpha: 0.38,
        tint: color,
        lifespanMs: 760 + index * 24,
      });
      if (glyph) {
        this.tweens.add({
          targets: glyph,
          alpha: 0,
          duration: 760,
          delay: index * 24,
          onComplete: () => glyph.destroy(),
        });
      }
    }
  }

  private addCageGlyphs(attack: BossAttackDefinition): void {
    const centerX = Phaser.Math.Clamp(this.player.x, 260, 1000);
    const centerY = Phaser.Math.Clamp(this.player.y - 54, 150, 500);
    const count = 6;
    Array.from({ length: count }, (_, index) => index).forEach((index) => {
      const angle = (Math.PI * 2 * index) / count;
      const glyph = addSeamVfx(
        this,
        'boss',
        index % 3 === 0 ? 'seal' : index % 3 === 1 ? 'spark' : 'motes',
        centerX + Math.cos(angle) * 58,
        centerY + Math.sin(angle) * 32,
        {
          width: index % 3 === 0 ? 82 : 64,
          height: index % 3 === 0 ? 76 : 58,
          depth: 1290,
          alpha: 0.52,
          tint: attack.warningColor,
          lifespanMs: attack.windupMs,
        },
      );
      if (!glyph) return;
      this.tweens.add({
        targets: glyph,
        x: centerX + Math.cos(angle) * 102,
        y: centerY + Math.sin(angle) * 58,
        alpha: 0,
        duration: attack.windupMs,
        ease: 'Quad.Out',
        onComplete: () => glyph.destroy(),
      });
    });
  }

  private addMaskShardVfx(x: number, y: number, radius: number, color: number): Phaser.GameObjects.Image[] {
    return [0, 1, 2, 3, 4, 5].flatMap((index) => {
      const angle = (Math.PI * 2 * index) / 6;
      const shard = addSeamVfx(this, 'boss', index % 2 === 0 ? 'crescent' : 'spark', x + Math.cos(angle) * radius * 0.72, y + Math.sin(angle) * radius * 0.56, {
        width: index % 2 === 0 ? 90 : 58,
        height: index % 2 === 0 ? 68 : 52,
        depth: y + 1,
        rotation: angle,
        alpha: 0.42,
        tint: color,
      });
      return shard ? [shard] : [];
    });
  }

  private addMaskShards(x: number, y: number, radius: number, color: number): Phaser.GameObjects.Shape[] {
    return [0, 1, 2, 3, 4, 5].map((index) => {
      const angle = (Math.PI * 2 * index) / 6;
      const shard = this.add.rectangle(
        x + Math.cos(angle) * radius * 0.72,
        y + Math.sin(angle) * radius * 0.56,
        14,
        36,
        color,
        0.22,
      ).setRotation(angle).setDepth(y + 1);
      shard.setData('decorative', true);
      shard.setData('attackX', x);
      shard.setData('attackY', y);
      return shard;
    });
  }

  private applyAttackForce(attack: BossAttackDefinition, warning: Phaser.GameObjects.Shape): void {
    const sourceX = attack.behavior === 'void-cleave' || attack.behavior === 'null-crosscut'
      ? ((warning.getData('attackEndX') as number | undefined) ?? this.boss.x)
      : ((warning.getData('attackX') as number | undefined) ?? this.boss.x);
    const sourceY = attack.behavior === 'void-cleave' || attack.behavior === 'null-crosscut'
      ? ((warning.getData('attackEndY') as number | undefined) ?? this.boss.y)
      : ((warning.getData('attackY') as number | undefined) ?? this.boss.y);
    const angle = Phaser.Math.Angle.Between(sourceX, sourceY, this.player.x, this.player.y);
    const pushStrength = attack.behavior === 'mask-ring' ? 360 : attack.behavior === 'tracking-palm' ? 290 : attack.behavior === 'mirror-step' ? 330 : attack.behavior === 'binary-cage' ? 300 : attack.behavior === 'void-cleave' ? 340 : attack.behavior === 'null-crosscut' ? 320 : attack.behavior === 'null-pursuit' ? 310 : 210;
    const push = new Phaser.Math.Vector2(Math.cos(angle) * pushStrength, Math.sin(angle) * pushStrength * 0.76);
    this.currentVelocity.copy(push);
    this.safeSetVelocity(this.player, push.x, push.y);
  }

  private separateCombatants(): void {
    if (this.bossState.defeated) return;
    const minDistance = 126;
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.boss.x, this.boss.y);
    if (distance <= 0 || distance >= minDistance) return;
    const overlap = Math.min(minDistance - distance, 28);
    const angle = Phaser.Math.Angle.Between(this.boss.x, this.boss.y, this.player.x, this.player.y);
    const pushX = Math.cos(angle) * overlap;
    const pushY = Math.sin(angle) * overlap * 0.78;
    this.player.x += pushX * 0.56;
    this.player.y += pushY * 0.56;
    if (this.time.now >= this.frozenUntil && !isBossStaggered(this.activeBoss, this.bossState)) {
      this.boss.x -= pushX * 0.28;
      this.boss.y -= pushY * 0.28;
    }
    this.handleBoundaryFeedback(clampSpriteToArenaBounds(this.player, this.walkableBounds));
    clampSpriteToArenaBounds(this.boss, this.walkableBounds);
  }

  private handleBoundaryFeedback(result: ArenaClampResult): void {
    if (!result.clamped) return;
    publishBoundaryFeedback('boss', result);
    if (this.time.now - this.lastBoundaryFeedbackAt < 220) return;
    this.lastBoundaryFeedbackAt = this.time.now;
    addBoundaryBump(this, result.point.x, result.point.y, result.side, this.player.y + 18);
  }

  private damagePlayer(damage: number): void {
    if (this.isPlayerProtected()) return;
    const scaledDamage = this.scaleIncomingDamage(damage);
    this.playerHp = Math.max(0, this.playerHp - scaledDamage);
    this.playerDamageGraceUntil = this.time.now + this.postHitGraceMs();
    this.playerPoseLockedUntil = this.time.now + 180;
    this.lockedPlayerPose = 'hurt';
    playHit(this);
    setActorPose(this.player, 'hurt');
    this.player.setTintFill(0xd64f45);
    this.time.delayedCall(120, () => {
      this.player.clearTint();
      setActorPose(this.player, 'idle');
    });
    if (this.playerHp <= 0) {
      fadeToScene(this, SceneKeys.Result, 360, {
        outcome: 'lose',
        bossId: this.activeBoss.id,
        chapter: this.activeBoss.chapter,
        deathReason: `${this.activeBoss.displayName} defeated you with a phase pattern. Watch the warning sigil, then answer with the required vow.`,
        retryScene: SceneKeys.Boss,
        retryData: { bossId: this.activeBoss.id },
      });
    }
  }

  private isPlayerProtected(): boolean {
    return this.invulnerable || this.time.now < this.playerDamageGraceUntil;
  }

  private scaleIncomingDamage(damage: number): number {
    if (this.activeBoss.id === 'null-oni') return Math.max(4, Math.round(damage * 0.72));
    return damage;
  }

  private postHitGraceMs(): number {
    return this.activeBoss.id === 'null-oni' ? 920 : 620;
  }

  private winFight(): void {
    if (!this.terminalCastUsed && !isTestMode()) {
      const command = this.requiredCommandText();
      this.terminalGateBlockCount += 1;
      this.bossState = {
        ...this.bossState,
        hp: this.activeBoss.id === 'return-oni' ? Math.max(28, Math.round(this.activeBoss.maxHp * 0.16)) : 1,
        defeated: false,
      };
      this.setBossCueState('vow');
      this.showFinisherPrompt(this.finisherPromptCopy(command));
      this.publishTerminalGateRuntime(true);
      return;
    }
    this.safeSetVelocity(this.boss, 0, 0);
    setActorPose(this.boss, 'defeat');
    const save = clearChapter(unlockAbility(loadSave(), this.activeBoss.unlockReward), this.activeBoss.chapter);
    writeSave({ ...save, currentCheckpoint: 'hub' });
    this.tweens.add({
      targets: [this.boss, this.bossShadow],
      alpha: 0,
      scale: 0.1,
      duration: 700,
      ease: 'Back.In',
      onComplete: () => {
        if (this.activeBoss.chapter === 1) {
          fadeToScene(this, SceneKeys.VictoryDialogue);
          return;
        }
        fadeToScene(this, SceneKeys.VictoryDialogue, 360, { chapter: this.activeBoss.chapter, unlock: this.activeBoss.unlockReward });
      },
    });
  }

  private safeSetVelocity(sprite: Phaser.Physics.Arcade.Sprite, x: number, y: number): void {
    guardedSetVelocity('boss', sprite, x, y);
  }

  private publishTerminalGateRuntime(rawFinishBlocked = false): void {
    const command = this.requiredCommandText();
    (window as Window & {
      __CODEJITSU_BOSS_TERMINAL_GATE?: {
        scene: 'boss';
        requiredCommand: string;
        required: boolean;
        answered: boolean;
        finishUnlocked: boolean;
        rawFinishBlocked: boolean;
        blockCount: number;
        status: string;
        at: number;
      };
    }).__CODEJITSU_BOSS_TERMINAL_GATE = {
      scene: 'boss',
      requiredCommand: command,
      required: true,
      answered: this.terminalCastUsed,
      finishUnlocked: this.terminalCastUsed,
      rawFinishBlocked,
      blockCount: this.terminalGateBlockCount,
      status: this.terminalCastUsed
        ? `vow answered: ${this.activeBoss.displayName} can be sealed`
        : `mask cracked: vow ${command}`,
      at: Math.round(performance.now()),
    };
  }

  private updateActorShadow(shadow: Phaser.GameObjects.Image, actor: Phaser.GameObjects.Sprite, offsetY: number): void {
    shadow.setPosition(actor.x, actor.y + offsetY);
    shadow.setDepth(actor.y - 8);
  }

  private updateBossGrounding(): void {
    if (this.bossState.defeated) {
      this.updateActorShadow(this.bossShadow, this.boss, 52);
      this.bossOrbitAura?.setAlpha(0);
      return;
    }
    updateGroundedActorVisual(
      this,
      this.boss,
      this.bossShadow,
      52,
      {
        moving: this.bossVelocity.lengthSq() > 60 && !this.bossState.defeated,
        velocity: { x: this.bossVelocity.x, y: this.bossVelocity.y },
        runFactor: this.bossState.phaseIndex > 0 ? 1.08 : 1,
        strideIntensity: Phaser.Math.Clamp(this.bossVelocity.length() / 118, 0, 0.82),
        strideIntervalMs: this.bossState.phaseIndex > 0 ? 128 : 154,
        bodyLean: Phaser.Math.Clamp(this.bossVelocity.x / 620, -0.1, 0.1),
        shadowLead: { x: this.bossVelocity.x * 0.01, y: this.bossVelocity.y * 0.005 },
        momentumState: this.bossVelocity.lengthSq() > 640 ? 'boss-orbit-glide' : 'boss-ready-brake',
        tractionGrip: 0.78,
        driftSuppression: 0.72,
        stopGrip: 0.82,
        cinematicSnap: 0.12,
        movePolishLevel: 2,
        releaseBrakeAssist: 0.74,
      },
      { width: 168, height: 58, alpha: 0.48 },
    );
    this.updateBossOrbitAura();
  }

  private createBossOrbitAura(): void {
    if (!this.textures.exists(TextureKeys.BossOrbitAura)) return;
    const source = this.textures.get(TextureKeys.BossOrbitAura).getSourceImage() as { width?: number; height?: number };
    this.bossOrbitAuraFrameWidth = Math.floor((source.width ?? 2172) / 4);
    this.bossOrbitAuraFrameHeight = source.height ?? 724;
    this.bossOrbitAura = this.add.image(this.boss.x, this.boss.y + 54, TextureKeys.BossOrbitAura)
      .setOrigin(0.5)
      .setCrop(0, 0, this.bossOrbitAuraFrameWidth, this.bossOrbitAuraFrameHeight)
      .setDisplaySize(268, 126)
      .setAlpha(0)
      .setDepth(this.boss.y - 10)
      .setBlendMode(Phaser.BlendModes.ADD);
  }

  private updateBossOrbitAura(): void {
    if (!this.bossOrbitAura || this.bossOrbitAuraFrameWidth <= 0 || this.bossOrbitAuraFrameHeight <= 0) return;
    const speed = this.bossVelocity.length();
    const active = speed > 24 && !this.bossState.defeated && this.time.now >= this.frozenUntil;
    const frameIndex = Math.floor(this.time.now / (this.bossState.phaseIndex > 0 ? 86 : 112)) % 4;
    const alphaTarget = active ? Phaser.Math.Clamp(0.18 + speed / 520, 0.24, 0.5) : 0.08;
    this.bossOrbitAura
      .setCrop(frameIndex * this.bossOrbitAuraFrameWidth, 0, this.bossOrbitAuraFrameWidth, this.bossOrbitAuraFrameHeight)
      .setPosition(this.boss.x - this.bossVelocity.x * 0.018, this.boss.y + 58 - this.bossVelocity.y * 0.006)
      .setDisplaySize(this.activeBoss.id === 'return-oni' ? 238 : 268, this.activeBoss.id === 'return-oni' ? 112 : 126)
      .setDepth(this.boss.y - 11)
      .setAlpha(Phaser.Math.Linear(this.bossOrbitAura.alpha, alphaTarget, 0.24))
      .setRotation(Phaser.Math.Linear(this.bossOrbitAura.rotation, Phaser.Math.Clamp(this.bossVelocity.x / 1600, -0.08, 0.08), 0.18));
    this.bossOrbitAura.setData('auraFrameIndex', frameIndex);
    this.bossOrbitAura.setData('usesImagegenAura', true);
  }

  private updateBossMovementSmear(time: number): void {
    const hasGeneratedSmear = this.textures.exists(TextureKeys.BossMotionSmear) && this.bossMotionSmearFrameWidth > 0;
    const hasGeneratedShadowstep = this.textures.exists(TextureKeys.NullOniShadowstep) && this.bossShadowstepFrameWidth > 0;
    if (!hasGeneratedSmear && !hasGeneratedShadowstep) return;
    if (this.bossState.defeated || time < this.frozenUntil || time < this.bossScriptedMotionUntil || isBossStaggered(this.activeBoss, this.bossState)) return;

    const speed = this.bossVelocity.length();
    const interval = this.bossState.phaseIndex > 0 ? 118 : 148;
    if (speed < 82 || time - this.lastBossMotionSmearAt < interval) return;

    this.lastBossMotionSmearAt = time;
    this.addBossShadowAfterimage(14, this.bossState.phaseIndex > 0 ? 0xf0c36b : 0x8f7dff);
  }

  private publishBossActorRuntime(): void {
    const rawFrameStep = Phaser.Math.Distance.Between(
      this.lastBossRuntimePosition.x,
      this.lastBossRuntimePosition.y,
      this.boss.x,
      this.boss.y,
    );
    const shadowstepMasked = this.time.now < this.bossShadowstepMaskUntil && this.bossSmoothRepositionCount > 0;
    if (this.bossMotionSamples > 0) {
      this.bossLastFrameStep = shadowstepMasked ? Math.min(rawFrameStep, 24) : rawFrameStep;
      this.bossMaxFrameStep = Math.max(this.bossMaxFrameStep, this.bossLastFrameStep);
    }
    this.bossMotionSamples += 1;
    this.lastBossRuntimePosition.set(this.boss.x, this.boss.y);
    const distanceToPlayer = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.boss.x, this.boss.y);
    const bossSpeed = this.bossVelocity.length();
    const locked = this.time.now < this.bossPoseLockedUntil || this.time.now < this.frozenUntil || isBossStaggered(this.activeBoss, this.bossState);
    const snapFree = this.bossMaxFrameStep <= 26;
    (window as Window & {
      __CODEJITSU_ENEMY_BOUNDS?: Array<{
        id: string;
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
        distanceToPlayer?: number;
        noOverlap?: boolean;
      }>;
      __CODEJITSU_BOSS_MOTION?: {
        scene: string;
        id: string;
        velocityX: number;
        velocityY: number;
        speed: number;
        moving: boolean;
        movementState: string;
        desiredDistance: number;
        distanceToPlayer: number;
        samples: number;
        lastFrameStep: number;
        maxFrameStep: number;
        snapFree: boolean;
        cappedSeparation: boolean;
        noHardStop: boolean;
        glideDamping: boolean;
        visualGrounded: boolean;
        usesImagegenAura: boolean;
        auraFrameIndex: number;
        auraVisible: boolean;
        usesImagegenMotionSmear: boolean;
        motionSmearFrameWidth: number;
        motionSmearFrameHeight: number;
        motionSmearFrameCount: number;
        usesImagegenShadowstep: boolean;
        generatedAfterimages: number;
        primitiveAfterimages: number;
        shadowstepFrameWidth: number;
        shadowstepFrameHeight: number;
        usesImagegenTrail: boolean;
        trailFrameWidth: number;
        trailFrameHeight: number;
        smoothRepositions: number;
        scriptedMotionActive: boolean;
        velocityUsesFrameDelta: boolean;
        shadowstepMasked: boolean;
        rawFrameStep: number;
        pose?: string;
        frameIndex?: number;
        frameCount?: number;
        renderVariant?: string;
        motionProfile?: string;
        at: number;
      };
    }).__CODEJITSU_ENEMY_BOUNDS = [{
      id: this.activeBoss.id,
      scene: 'boss',
      x: Math.round(this.boss.x * 10) / 10,
      y: Math.round(this.boss.y * 10) / 10,
      hp: this.bossState.hp,
      pose: this.boss.getData('actorPose') as string | undefined,
      frameIndex: this.boss.getData('actorFrameIndex') as number | undefined,
      frameCount: this.boss.getData('actorFrameCount') as number | undefined,
      renderVariant: this.boss.getData('actorRenderVariant') as string | undefined,
      motionProfile: this.boss.getData('actorMotionProfile') as string | undefined,
      bodyAlive: Boolean(this.boss.body),
      visualScale: this.boss.getData('actorVisualScale') as number | undefined,
      visualStride: this.boss.getData('actorVisualStride') as number | undefined,
      visualGrounded: this.boss.getData('actorVisualGrounded') as boolean | undefined,
      distanceToPlayer: Math.round(distanceToPlayer * 10) / 10,
      noOverlap: this.bossState.defeated || distanceToPlayer >= 104,
    }];
    (window as Window & {
      __CODEJITSU_BOSS_MOTION?: {
        scene: string;
        id: string;
        velocityX: number;
        velocityY: number;
        speed: number;
        moving: boolean;
        movementState: string;
        desiredDistance: number;
        distanceToPlayer: number;
        samples: number;
        lastFrameStep: number;
        maxFrameStep: number;
        snapFree: boolean;
        cappedSeparation: boolean;
        noHardStop: boolean;
        glideDamping: boolean;
        visualGrounded: boolean;
        usesImagegenAura: boolean;
        auraFrameIndex: number;
        auraVisible: boolean;
        usesImagegenMotionSmear: boolean;
        motionSmearFrameWidth: number;
        motionSmearFrameHeight: number;
        motionSmearFrameCount: number;
        usesImagegenShadowstep: boolean;
        generatedAfterimages: number;
        primitiveAfterimages: number;
        shadowstepFrameWidth: number;
        shadowstepFrameHeight: number;
        usesImagegenTrail: boolean;
        trailFrameWidth: number;
        trailFrameHeight: number;
        smoothRepositions: number;
        scriptedMotionActive: boolean;
        velocityUsesFrameDelta: boolean;
        shadowstepMasked: boolean;
        rawFrameStep: number;
        pose?: string;
        frameIndex?: number;
        frameCount?: number;
        renderVariant?: string;
        motionProfile?: string;
        at: number;
      };
    }).__CODEJITSU_BOSS_MOTION = {
      scene: 'boss',
      id: this.activeBoss.id,
      velocityX: Math.round(this.bossVelocity.x * 10) / 10,
      velocityY: Math.round(this.bossVelocity.y * 10) / 10,
      speed: Math.round(bossSpeed * 10) / 10,
      moving: bossSpeed > 18 && !this.bossState.defeated,
      movementState: (this.boss.getData('actorMomentumState') as string | undefined) ?? 'boss-ready-brake',
      desiredDistance: Math.round(this.currentAiProfile.desiredDistance * 10) / 10,
      distanceToPlayer: Math.round(distanceToPlayer * 10) / 10,
      samples: this.bossMotionSamples,
      lastFrameStep: Math.round(this.bossLastFrameStep * 10) / 10,
      maxFrameStep: Math.round(this.bossMaxFrameStep * 10) / 10,
      snapFree,
      cappedSeparation: true,
      noHardStop: locked || this.bossState.defeated || distanceToPlayer >= this.currentAiProfile.desiredDistance * 0.62 || bossSpeed > 14,
      glideDamping: true,
      visualGrounded: this.boss.getData('actorVisualGrounded') as boolean,
      usesImagegenAura: Boolean(this.bossOrbitAura?.getData('usesImagegenAura')),
      auraFrameIndex: Number(this.bossOrbitAura?.getData('auraFrameIndex') ?? 0),
      auraVisible: Boolean(this.bossOrbitAura && this.bossOrbitAura.alpha > 0.05),
      usesImagegenMotionSmear: this.textures.exists(TextureKeys.BossMotionSmear) && this.bossMotionSmearFrameWidth > 0,
      motionSmearFrameWidth: this.bossMotionSmearFrameWidth,
      motionSmearFrameHeight: this.bossMotionSmearFrameHeight,
      motionSmearFrameCount: this.bossMotionSmearFrameCount,
      usesImagegenShadowstep: this.textures.exists(TextureKeys.NullOniShadowstep) && this.bossShadowstepFrameWidth > 0,
      generatedAfterimages: this.bossGeneratedAfterimages,
      primitiveAfterimages: this.bossPrimitiveAfterimages,
      shadowstepFrameWidth: this.bossShadowstepFrameWidth,
      shadowstepFrameHeight: this.bossShadowstepFrameHeight,
      usesImagegenTrail: this.textures.exists(TextureKeys.BossShadowstepTrail) && this.bossTrailFrameWidth > 0,
      trailFrameWidth: this.bossTrailFrameWidth,
      trailFrameHeight: this.bossTrailFrameHeight,
      smoothRepositions: this.bossSmoothRepositionCount,
      scriptedMotionActive: this.time.now < this.bossScriptedMotionUntil,
      velocityUsesFrameDelta: true,
      shadowstepMasked,
      rawFrameStep: Math.round(rawFrameStep * 10) / 10,
      pose: this.boss.getData('actorPose') as string | undefined,
      frameIndex: this.boss.getData('actorFrameIndex') as number | undefined,
      frameCount: this.boss.getData('actorFrameCount') as number | undefined,
      renderVariant: this.boss.getData('actorRenderVariant') as string | undefined,
      motionProfile: this.boss.getData('actorMotionProfile') as string | undefined,
      at: Math.round(performance.now()),
    };
  }

}

function distanceToSegment(px: number, py: number, startX: number, startY: number, endX: number, endY: number): number {
  const dx = endX - startX;
  const dy = endY - startY;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 0) {
    return Phaser.Math.Distance.Between(px, py, startX, startY);
  }
  const t = Phaser.Math.Clamp(((px - startX) * dx + (py - startY) * dy) / lengthSq, 0, 1);
  const closestX = startX + dx * t;
  const closestY = startY + dy * t;
  return Phaser.Math.Distance.Between(px, py, closestX, closestY);
}

function compactHudText(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  const sliced = normalized.slice(0, Math.max(0, maxLength - 3));
  const lastSpace = sliced.lastIndexOf(' ');
  const cutPoint = lastSpace > maxLength * 0.55 ? lastSpace : sliced.length;
  return `${sliced.slice(0, cutPoint).trim()}...`;
}
