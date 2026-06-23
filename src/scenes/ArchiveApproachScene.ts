import Phaser from 'phaser';
import { createGameKeys, type GameKeys } from '../systems/input';
import { chapterOneDungeonRooms } from '../data/playtime';
import { apprenticeMovementTuning, readMovementInput, stepMovementVelocity } from '../systems/movementEngine';
import { loadSave, writeSave } from '../systems/saveSystem';
import { addActorSprite, setActorPose, type ActorPose } from './actors';
import { installAudioUnlock } from './audioUnlock';
import { publishTextPanelAudit } from './layoutAudit';
import { PauseMenuOverlay, TerminalOverlay } from './overlays';
import { guardedSetVelocity, publishBoundaryFeedback, publishControlScheme, publishFrameHealth, publishPlayerBounds } from './runtimeDebug';
import { SceneKeys, TextureKeys } from './sceneKeys';
import { addSeamVfx } from './seamVfx';
import { clampSpriteToArenaBounds, fadeInFromBlack, walkSpriteIntoGate, type ArenaClampResult } from './transition';
import { addArenaDepthCues, addBoundaryBump, addForegroundDepthOverlay, addPanel, addRoomDepthBorders, addStepDust, makePixelText, updateForegroundParallaxDepth, updateGroundedActorVisual } from './ui';

export class ArchiveApproachScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerShadow!: Phaser.GameObjects.Image;
  private keys!: GameKeys;
  private terminal!: TerminalOverlay;
  private pauseMenu!: PauseMenuOverlay;
  private foregroundOverlay?: Phaser.GameObjects.Image;
  private currentVelocity = new Phaser.Math.Vector2(0, 0);
  private lastMoveDirection = new Phaser.Math.Vector2(1, 0);
  private moveHeldMs = 0;
  private poseLockedUntil = 0;
  private lockedPlayerPose: ActorPose = 'idle';
  private lastStepDustAt = 0;
  private lastBoundaryFeedbackAt = 0;
  private transitioning = false;
  private readonly walkableBounds = new Phaser.Geom.Rectangle(156, 266, 956, 308);
  private readonly approachPanelBounds = new Phaser.Geom.Rectangle(44, 604, 430, 74);
  private readonly gatePoint = new Phaser.Math.Vector2(1024, 404);
  private gateText!: Phaser.GameObjects.Text;
  private gatePanel?: Phaser.GameObjects.GameObject;
  private gateCueIcon?: Phaser.GameObjects.Image;
  private gateCueFrameWidth = 0;
  private gateCueFrameHeight = 0;
  private currentGateOpen = false;
  private approachAtmosphereUsesImagegen = false;
  private approachPrimitiveBackdropShadePieces = 0;

  constructor() {
    super(SceneKeys.ArchiveApproach);
  }

  create(): void {
    (window as unknown as { __CODEJITSU_SCENE?: string }).__CODEJITSU_SCENE = 'archive-approach';
    publishControlScheme('archive-approach');
    installAudioUnlock(this);
    writeSave({ ...loadSave(), currentCheckpoint: 'dungeon' });
    this.keys = createGameKeys(this);
    this.drawApproachScene();
    addRoomDepthBorders(this, this.walkableBounds, { sceneId: 'archive-approach', frontDepth: 850, accentColor: 0xf0c36b });
    addArenaDepthCues(this, this.walkableBounds, { sceneId: 'archive-approach', accentColor: 0xf0c36b, foregroundDepth: 852 });
    this.foregroundOverlay = addForegroundDepthOverlay(this, 855, 0.78);
    fadeInFromBlack(this);
    this.player = addActorSprite(this, 'hero', 220, 474, TextureKeys.Hero, 1.16).setCollideWorldBounds(true).setDrag(1500);
    this.player.body?.setSize(26, 22).setOffset(19, 64);
    this.playerShadow = this.add.image(this.player.x, this.player.y + 27, TextureKeys.Shadow).setDisplaySize(78, 32).setAlpha(0.4).setDepth(this.player.y - 8);
    this.terminal = new TerminalOverlay(this, () => this.setGateCueOpen(false));
    this.pauseMenu = new PauseMenuOverlay(this, () => this.scene.start(SceneKeys.Title));
    this.bindInput();
    this.publishRouteProgress();
  }

  update(time: number, delta: number): void {
    publishFrameHealth('archive-approach', delta);
    if (this.transitioning || this.pauseMenu.isOpen || this.terminal.isOpen) {
      this.safeSetVelocity(this.player, 0, 0);
      return;
    }
    this.handleMovement(delta);
    this.handleBoundaryFeedback(clampSpriteToArenaBounds(this.player, this.walkableBounds));
    publishPlayerBounds('archive-approach', this.player, this.walkableBounds, 0.52);
    this.playerShadow.setPosition(this.player.x, this.player.y + 27).setDepth(this.player.y - 8);
    this.player.setDepth(this.player.y);
    this.setGateCueOpen(Phaser.Math.Distance.Between(this.player.x, this.player.y, this.gatePoint.x, this.gatePoint.y + 42) < 118);
  }

  private drawApproachScene(): void {
    this.cameras.main.setBackgroundColor('#0b0710');
    if (this.textures.exists(TextureKeys.ArchiveMemory)) {
      this.add.image(640, 360, TextureKeys.ArchiveMemory).setDisplaySize(1280, 720).setAlpha(0.92);
      this.addArchiveApproachOverlay();
    } else {
      for (let row = 0; row < 8; row += 1) {
        for (let col = 0; col < 12; col += 1) {
          this.add.image(136 + col * 82 + row * 42, 252 + row * 30, TextureKeys.FloorTile).setAlpha(0.8);
        }
      }
    }
    this.gatePanel = this.createApproachPanel();
    this.gateCueIcon = this.createApproachCueIcon();
    this.gateText = makePixelText(this, 170, 632, '', 1, '#f6ead3')
      .setDepth(1001)
      .setAlpha(0)
      .setWordWrapWidth(1);
    this.setGateCueOpen(false);
    const gateTexture = this.textures.exists(TextureKeys.Chapter1SeamPortal) ? TextureKeys.Chapter1SeamPortal : TextureKeys.GatePortal;
    const usesGeneratedGate = this.textures.exists(gateTexture);
    let primitiveGatePieces = 0;
    if (usesGeneratedGate) {
      const gate = this.add.image(this.gatePoint.x, this.gatePoint.y + 32, gateTexture)
        .setDisplaySize(166, 132)
        .setAlpha(0.86)
        .setDepth(69);
      if (gateTexture === TextureKeys.GatePortal) gate.setBlendMode(Phaser.BlendModes.ADD);
    } else {
      primitiveGatePieces = 1;
      this.add.ellipse(this.gatePoint.x, this.gatePoint.y + 42, 158, 64, 0xf0c36b, 0.18).setDepth(70);
    }
    let seamVfxCount = 0;
    for (let index = 0; index < 5; index += 1) {
      const seam = addSeamVfx(this, 'archive-approach', index % 2 === 0 ? 'wisp' : 'trail', 440 + index * 118, 474 - index * 12, {
        width: index % 2 === 0 ? 76 : 92,
        height: index % 2 === 0 ? 58 : 72,
        depth: 74,
        alpha: 0.5,
        rotation: -0.22 + index * 0.04,
      });
      if (!seam) continue;
      seamVfxCount += 1;
      this.tweens.add({
        targets: seam,
        alpha: { from: 0.24, to: 0.78 },
        x: seam.x + 12,
        scaleX: seam.scaleX * 1.08,
        scaleY: seam.scaleY * 1.08,
        duration: 520,
        yoyo: true,
        repeat: -1,
        delay: index * 80,
        ease: 'Sine.InOut',
      });
    }
    (window as Window & {
      __CODEJITSU_ARCHIVE_PATH_VISUAL?: {
        scene: string;
        usesImagegenSeamVfx: boolean;
        textArrowCount: number;
        seamVfxCount: number;
        at: number;
      };
    }).__CODEJITSU_ARCHIVE_PATH_VISUAL = {
      scene: 'archive-approach',
      usesImagegenSeamVfx: seamVfxCount > 0,
      textArrowCount: 0,
      seamVfxCount,
      at: Math.round(performance.now()),
    };
    (window as Window & {
      __CODEJITSU_ARCHIVE_GATE_VISUAL?: {
        scene: string;
        usesImagegenGate: boolean;
        primitiveGatePieces: number;
        textureKey: string;
        labelVisible: boolean;
        debugMapCopyVisible: boolean;
        roomTitleVisible: boolean;
        singleGatePresentation: boolean;
        noExtraGateOverlay: boolean;
        at: number;
      };
    }).__CODEJITSU_ARCHIVE_GATE_VISUAL = {
      scene: 'archive-approach',
      usesImagegenGate: usesGeneratedGate,
      primitiveGatePieces,
      textureKey: usesGeneratedGate ? gateTexture : 'fallback-ellipse',
      labelVisible: false,
      debugMapCopyVisible: false,
      roomTitleVisible: false,
      singleGatePresentation: usesGeneratedGate && primitiveGatePieces === 0,
      noExtraGateOverlay: usesGeneratedGate && primitiveGatePieces === 0,
      at: Math.round(performance.now()),
    };
    this.publishArchiveBackdropRuntime();
  }

  private addArchiveApproachOverlay(): void {
    if (this.textures.exists(TextureKeys.ArchiveApproachOverlay)) {
      const source = this.textures.get(TextureKeys.ArchiveApproachOverlay).getSourceImage() as { width?: number; height?: number };
      const scale = Math.max(1280 / Number(source.width ?? 1280), 720 / Number(source.height ?? 720));
      this.add.image(640, 360, TextureKeys.ArchiveApproachOverlay)
        .setScale(scale)
        .setAlpha(0.72)
        .setDepth(5)
        .setData('usesImagegenArchiveApproachOverlay', true);
      this.approachAtmosphereUsesImagegen = true;
      this.approachPrimitiveBackdropShadePieces = 0;
      return;
    }

    this.add.rectangle(640, 360, 1280, 720, 0x09070d, 0.34).setDepth(5);
    this.approachAtmosphereUsesImagegen = false;
    this.approachPrimitiveBackdropShadePieces = 1;
  }

  private publishArchiveBackdropRuntime(): void {
    const source = this.textures.exists(TextureKeys.ArchiveMemory)
      ? this.textures.get(TextureKeys.ArchiveMemory).getSourceImage() as { width?: number; height?: number }
      : undefined;
    (window as Window & {
      __CODEJITSU_ARCHIVE_BACKDROP?: {
        scene: string;
        textureKey: string;
        usesImagegenApproachOverlay: boolean;
        primitiveBackdropShadePieces: number;
        overlayTextureKey: string;
        noExtraGateOverlay: boolean;
        sourceWidth: number;
        sourceHeight: number;
        at: number;
      };
    }).__CODEJITSU_ARCHIVE_BACKDROP = {
      scene: 'archive-approach',
      textureKey: this.textures.exists(TextureKeys.ArchiveMemory) ? TextureKeys.ArchiveMemory : 'fallback-floor-grid',
      usesImagegenApproachOverlay: this.approachAtmosphereUsesImagegen,
      primitiveBackdropShadePieces: this.approachPrimitiveBackdropShadePieces,
      overlayTextureKey: this.approachAtmosphereUsesImagegen ? TextureKeys.ArchiveApproachOverlay : 'fallback-rectangle',
      noExtraGateOverlay: true,
      sourceWidth: Number(source?.width ?? 1280),
      sourceHeight: Number(source?.height ?? 720),
      at: Math.round(performance.now()),
    };
  }

  private createApproachPanel(): Phaser.GameObjects.GameObject {
    if (this.textures.exists(TextureKeys.DungeonHudPanel)) {
      return this.add.image(
        this.approachPanelBounds.centerX,
        this.approachPanelBounds.centerY,
        TextureKeys.DungeonHudPanel,
      )
        .setDisplaySize(this.approachPanelBounds.width, this.approachPanelBounds.height)
        .setDepth(1000)
        .setAlpha(0.93)
        .setData('usesImagegenHudPanel', true);
    }
    return addPanel(
      this,
      this.approachPanelBounds.x,
      this.approachPanelBounds.y,
      this.approachPanelBounds.width,
      this.approachPanelBounds.height,
      0.66,
    ).setDepth(1000);
  }

  private createApproachCueIcon(): Phaser.GameObjects.Image | undefined {
    if (!this.textures.exists(TextureKeys.ArchiveSeamCue)) return undefined;
    const source = this.textures.get(TextureKeys.ArchiveSeamCue).getSourceImage() as { width?: number; height?: number };
    this.gateCueFrameWidth = Math.floor(Number(source.width ?? 1774) / 2);
    this.gateCueFrameHeight = Number(source.height ?? 887);
    const icon = this.add.image(96, 640, TextureKeys.ArchiveSeamCue, this.ensureApproachCueFrame(0))
      .setDisplaySize(68, 68)
      .setDepth(1001)
      .setAlpha(0.96)
      .setData('usesImagegenArchiveCue', true)
      .setData('archiveCueFrameIndex', 0);
    this.tweens.add({
      targets: icon,
      alpha: { from: 0.84, to: 1 },
      scaleX: icon.scaleX * 1.04,
      scaleY: icon.scaleY * 1.04,
      duration: 720,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    return icon;
  }

  private ensureApproachCueFrame(frameIndex: number): string {
    const texture = this.textures.get(TextureKeys.ArchiveSeamCue) as Phaser.Textures.Texture & {
      has?: (name: string) => boolean;
    };
    const safeFrame = Phaser.Math.Clamp(frameIndex, 0, 1);
    const frameKey = `archive-seam-cue-${safeFrame}`;
    if (!texture.has?.(frameKey)) {
      texture.add(frameKey, 0, safeFrame * this.gateCueFrameWidth, 0, this.gateCueFrameWidth, this.gateCueFrameHeight);
    }
    return frameKey;
  }

  private setGateCueOpen(open: boolean): void {
    if (this.currentGateOpen !== open) this.currentGateOpen = open;
    const frameIndex = open ? 1 : 0;
    this.gateCueIcon
      ?.setTexture(TextureKeys.ArchiveSeamCue, this.ensureApproachCueFrame(frameIndex))
      .setDisplaySize(open ? 74 : 68, open ? 74 : 68)
      .setData('archiveCueFrameIndex', frameIndex);
    this.publishApproachHud();
  }

  private publishApproachHud(): void {
    if (!this.gateText) return;
    publishTextPanelAudit('archive-approach-hud', this.approachPanelBounds, [
      { id: 'gate-copy', object: this.gateText },
    ], 16);
    const panel = this.gatePanel as (Phaser.GameObjects.GameObject & { getData?: (key: string) => unknown }) | undefined;
    const usesGeneratedPanel = Boolean(panel?.getData?.('usesImagegenHudPanel'));
    (window as Window & {
      __CODEJITSU_ARCHIVE_HUD_VISUAL?: {
        scene: string;
        usesImagegenPanel: boolean;
        primitivePanelPieces: number;
        usesImagegenArchiveCue: boolean;
        primitiveCuePieces: number;
        compactCopy: boolean;
        wordCount: number;
        textOverlayCount: number;
        archiveCueFrameIndex: number;
        objectiveCopy: string;
        panelWidth: number;
        panelHeight: number;
        at: number;
      };
    }).__CODEJITSU_ARCHIVE_HUD_VISUAL = {
      scene: 'archive-approach',
      usesImagegenPanel: usesGeneratedPanel,
      primitivePanelPieces: usesGeneratedPanel ? 0 : 1,
      usesImagegenArchiveCue: Boolean(this.gateCueIcon?.getData('usesImagegenArchiveCue')),
      primitiveCuePieces: this.gateCueIcon?.getData('usesImagegenArchiveCue') ? 0 : 1,
      compactCopy: true,
      wordCount: this.gateText.text.split(/\s+/).filter(Boolean).length,
      textOverlayCount: this.gateText.text.trim().length > 0 ? 1 : 0,
      archiveCueFrameIndex: Number(this.gateCueIcon?.getData('archiveCueFrameIndex') ?? -1),
      objectiveCopy: this.gateText.text,
      panelWidth: this.approachPanelBounds.width,
      panelHeight: this.approachPanelBounds.height,
      at: Math.round(performance.now()),
    };
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
      if (event.key.toLowerCase() === 't') this.terminal.open(event.timeStamp);
      if (event.key === 'Enter') this.tryEnterGate();
    });
  }

  private tryEnterGate(): void {
    const nearGate = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.gatePoint.x, this.gatePoint.y + 42) < 128;
    if (!nearGate) {
      this.setGateCueOpen(false);
      return;
    }
    this.transitioning = true;
    this.poseLockedUntil = this.time.now + 760;
    this.lockedPlayerPose = 'walk';
    setActorPose(this.player, 'walk');
    walkSpriteIntoGate(this, this.player, new Phaser.Math.Vector2(this.gatePoint.x, this.gatePoint.y + 42), SceneKeys.Dungeon, {
      duration: 660,
      fadeDuration: 420,
      onStep: () => {
        this.player.setDepth(this.player.y);
        this.playerShadow.setPosition(this.player.x, this.player.y + 27).setDepth(this.player.y - 8);
      },
    });
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
    updateGroundedActorVisual(this, this.player, this.playerShadow, 27, movement, { width: 78, height: 32, alpha: 0.4 });
    updateForegroundParallaxDepth(this, 'archive-approach', this.foregroundOverlay, movement, 0.32);
    if (movement.strideIntensity > 0.34 && movement.velocity.x * movement.velocity.x + movement.velocity.y * movement.velocity.y > 8200 && this.time.now - this.lastStepDustAt > movement.strideIntervalMs) {
      this.lastStepDustAt = this.time.now;
      addStepDust(this, this.player.x, this.player.y, this.player.y - 6, this.lastMoveDirection.x || 1);
    }
    if (this.lastMoveDirection.x < -0.1) this.player.setFlipX(true);
    if (this.lastMoveDirection.x > 0.1) this.player.setFlipX(false);
  }

  private handleBoundaryFeedback(result: ArenaClampResult): void {
    if (!result.clamped) return;
    publishBoundaryFeedback('archive-approach', result);
    if (this.time.now - this.lastBoundaryFeedbackAt < 220) return;
    this.lastBoundaryFeedbackAt = this.time.now;
    addBoundaryBump(this, result.point.x, result.point.y, result.side, this.player.y + 16);
  }

  private safeSetVelocity(sprite: Phaser.Physics.Arcade.Sprite, x: number, y: number): void {
    guardedSetVelocity('archive-approach', sprite, x, y);
  }

  private publishRouteProgress(): void {
    (window as Window & {
      __CODEJITSU_CHAPTER1_ROUTE_PROGRESS?: {
        currentArea: string;
        totalRooms: number;
        routeStage: 'approach' | 'dungeon';
        approachSceneActive: boolean;
        at: number;
      };
    }).__CODEJITSU_CHAPTER1_ROUTE_PROGRESS = {
      currentArea: 'Archive Approach',
      totalRooms: chapterOneDungeonRooms.length,
      routeStage: 'approach',
      approachSceneActive: true,
      at: Math.round(performance.now()),
    };
  }
}
