import Phaser from 'phaser';
import { createGameKeys, type GameKeys } from '../systems/input';
import { apprenticeMovementTuning, readMovementInput, stepMovementVelocity } from '../systems/movementEngine';
import { loadSave, writeSave } from '../systems/saveSystem';
import { addActorSprite, setActorPose } from './actors';
import { installAudioUnlock } from './audioUnlock';
import { publishTextPanelAudit } from './layoutAudit';
import { PauseMenuOverlay } from './overlays';
import { guardedSetVelocity, publishBoundaryFeedback, publishControlScheme, publishFrameHealth, publishPlayerBounds } from './runtimeDebug';
import { SceneKeys, TextureKeys } from './sceneKeys';
import { clampSpriteToArenaBounds, fadeInFromBlack, walkSpriteIntoGate, type ArenaClampResult } from './transition';
import { addArenaDepthCues, addBoundaryBump, addForegroundDepthOverlay, addPanel, addRoomDepthBorders, addStepDust, makePixelText, updateGroundedActorVisual } from './ui';

export class HubScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private mentor!: Phaser.Physics.Arcade.Sprite;
  private playerShadow!: Phaser.GameObjects.Image;
  private mentorShadow!: Phaser.GameObjects.Image;
  private keys!: GameKeys;
  private pauseMenu!: PauseMenuOverlay;
  private controlsText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private hubPanel?: Phaser.GameObjects.GameObject;
  private hubCueIcon?: Phaser.GameObjects.Image;
  private hubCueFrameWidth = 0;
  private hubCueFrameHeight = 0;
  private hubGate?: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse;
  private hubAtmosphereUsesImagegen = false;
  private hubPrimitiveBackdropShadePieces = 0;
  private currentVelocity = new Phaser.Math.Vector2(0, 0);
  private lastMoveDirection = new Phaser.Math.Vector2(1, 0);
  private moveHeldMs = 0;
  private lastStepDustAt = 0;
  private lastBoundaryFeedbackAt = 0;
  private transitioning = false;
  private readonly walkableBounds = new Phaser.Geom.Rectangle(190, 260, 860, 316);
  private readonly hubPanelBounds = new Phaser.Geom.Rectangle(36, 590, 462, 90);
  private readonly gatePoint = new Phaser.Math.Vector2(932, 378);
  private currentStatusCopy = '';

  constructor() {
    super(SceneKeys.Hub);
  }

  create(): void {
    (window as unknown as { __CODEJITSU_SCENE?: string }).__CODEJITSU_SCENE = 'hub';
    publishControlScheme('hub');
    installAudioUnlock(this);
    this.keys = createGameKeys(this);
    const save = loadSave();
    writeSave({ ...save, currentCheckpoint: 'hub' });
    this.drawHub();
    addRoomDepthBorders(this, this.walkableBounds, { sceneId: 'hub', frontDepth: 860, accentColor: 0xf0c36b });
    addArenaDepthCues(this, this.walkableBounds, { sceneId: 'hub', accentColor: 0xf0c36b, foregroundDepth: 862 });
    addForegroundDepthOverlay(this, 865, 0.78);
    fadeInFromBlack(this);

    this.player = addActorSprite(this, 'hero', 420, 448, TextureKeys.Hero, 1.6).setCollideWorldBounds(true).setDrag(1500);
    this.mentor = addActorSprite(this, 'mentor', 650, 414, TextureKeys.Mentor, 1.4).setImmovable(true);
    this.player.body?.setSize(28, 24).setOffset(18, 62);
    this.mentor.body?.setSize(34, 28).setOffset(26, 84);
    this.mentor.setFlipX(true);

    this.playerShadow = this.add.image(this.player.x, this.player.y + 28, TextureKeys.Shadow).setDisplaySize(88, 38).setAlpha(0.42).setDepth(this.player.y - 4);
    this.mentorShadow = this.add.image(this.mentor.x, this.mentor.y + 32, TextureKeys.Shadow).setDisplaySize(106, 42).setAlpha(0.42).setDepth(this.mentor.y - 4);
    this.pauseMenu = new PauseMenuOverlay(this, () => this.scene.start(SceneKeys.Title));
    this.bindInput();
  }

  update(time: number, delta: number): void {
    publishFrameHealth('hub', delta);
    if (this.transitioning || this.pauseMenu.isOpen) {
      this.safeSetVelocity(this.player, 0, 0);
      return;
    }
    this.handleMovement(delta);
    this.handleBoundaryFeedback(clampSpriteToArenaBounds(this.player, this.walkableBounds));
    publishPlayerBounds('hub', this.player, this.walkableBounds, 0.48);
    this.updateActorShadow(this.playerShadow, this.player, 28);
    this.updateActorShadow(this.mentorShadow, this.mentor, 32);
    this.player.setDepth(this.player.y);
    this.mentor.setDepth(this.mentor.y);

    const save = loadSave();
    const nextChapterReady = save.clearedChapters.includes(1) && !save.clearedChapters.includes(2);
    if (Phaser.Math.Distance.Between(this.player.x, this.player.y, this.gatePoint.x, this.gatePoint.y) < 190) {
      this.setHubStatus(nextChapterReady ? 'Outer' : 'Open', true);
    } else {
      this.setHubStatus(nextChapterReady ? 'Outer' : 'Seek', false);
    }
  }

  private drawHub(): void {
    this.cameras.main.setBackgroundColor('#100b16');
    if (this.textures.exists(TextureKeys.BrokenDojo)) {
      this.add.image(640, 360, TextureKeys.BrokenDojo).setDisplaySize(1280, 720);
      this.addHubAtmosphereOverlay(0.5);
      this.publishHubBackdropRuntime(TextureKeys.BrokenDojo);
    } else {
      for (let row = 0; row < 9; row += 1) {
        for (let col = 0; col < 12; col += 1) {
          this.add.image(100 + col * 88 + row * 44, 260 + row * 32, TextureKeys.FloorTile).setAlpha(0.72);
        }
      }
      this.addHubAtmosphereOverlay(0.32);
      this.publishHubBackdropRuntime(TextureKeys.FloorTile);
    }

    this.drawGate();
    this.hubPanel = this.createHubPanel();
    this.hubCueIcon = this.createHubCueIcon();
    this.controlsText = makePixelText(this, 172, 626, '', 1, '#f0c36b')
      .setDepth(1001)
      .setAlpha(0)
      .setWordWrapWidth(1);
    this.statusText = makePixelText(this, 174, 628, 'Seek', 20, '#f6ead3')
      .setDepth(1001)
      .setStroke('#09070d', 8)
      .setWordWrapWidth(210)
      .setLineSpacing(4);
    this.setHubStatus('Seek', false);
  }

  private addHubAtmosphereOverlay(alpha: number): void {
    this.hubAtmosphereUsesImagegen = this.textures.exists(TextureKeys.HubAtmosphereOverlay);
    this.hubPrimitiveBackdropShadePieces = this.hubAtmosphereUsesImagegen ? 0 : 1;
    if (this.hubAtmosphereUsesImagegen) {
      const source = this.textures.get(TextureKeys.HubAtmosphereOverlay).getSourceImage() as { width?: number; height?: number };
      const sourceWidth = Number(source.width ?? 1280);
      const sourceHeight = Number(source.height ?? 720);
      const scale = Math.max(1280 / Math.max(1, sourceWidth), 720 / Math.max(1, sourceHeight));
      this.add.image(640, 360, TextureKeys.HubAtmosphereOverlay)
        .setDisplaySize(Math.ceil(sourceWidth * scale), Math.ceil(sourceHeight * scale))
        .setDepth(4)
        .setAlpha(alpha)
        .setData('usesImagegenHubAtmosphere', true);
      return;
    }
    this.add.rectangle(640, 360, 1280, 720, 0x08060c, alpha * 0.2).setDepth(4);
  }

  private publishHubBackdropRuntime(textureKey: string): void {
    const source = this.textures.exists(textureKey)
      ? this.textures.get(textureKey).getSourceImage() as { width?: number; height?: number }
      : undefined;
    (window as Window & {
      __CODEJITSU_HUB_BACKDROP?: {
        scene: string;
        textureKey: string;
        usesImagegenAtmosphere: boolean;
        primitiveBackdropShadePieces: number;
        atmosphereTextureKey: string;
        noExtraGateOverlay: boolean;
        sourceWidth: number;
        sourceHeight: number;
        at: number;
      };
    }).__CODEJITSU_HUB_BACKDROP = {
      scene: 'hub',
      textureKey,
      usesImagegenAtmosphere: this.hubAtmosphereUsesImagegen,
      primitiveBackdropShadePieces: this.hubPrimitiveBackdropShadePieces,
      atmosphereTextureKey: this.hubAtmosphereUsesImagegen ? TextureKeys.HubAtmosphereOverlay : 'fallback-rectangle',
      noExtraGateOverlay: true,
      sourceWidth: Number(source?.width ?? 0),
      sourceHeight: Number(source?.height ?? 0),
      at: Math.round(performance.now()),
    };
  }

  private createHubPanel(): Phaser.GameObjects.GameObject {
    if (this.textures.exists(TextureKeys.TutorialHudPanel)) {
      return this.add.image(this.hubPanelBounds.centerX, this.hubPanelBounds.centerY, TextureKeys.TutorialHudPanel)
        .setDisplaySize(this.hubPanelBounds.width, this.hubPanelBounds.height)
        .setDepth(1000)
        .setAlpha(0.94)
        .setData('usesImagegenHudPanel', true);
    }
    return addPanel(
      this,
      this.hubPanelBounds.x,
      this.hubPanelBounds.y,
      this.hubPanelBounds.width,
      this.hubPanelBounds.height,
      0.74,
    ).setDepth(1000);
  }

  private createHubCueIcon(): Phaser.GameObjects.Image | undefined {
    if (!this.textures.exists(TextureKeys.HubSeamCue)) return undefined;
    const source = this.textures.get(TextureKeys.HubSeamCue).getSourceImage() as { width?: number; height?: number };
    this.hubCueFrameWidth = Math.floor(Number(source.width ?? 1774) / 2);
    this.hubCueFrameHeight = Number(source.height ?? 887);
    const icon = this.add.image(112, 636, TextureKeys.HubSeamCue, this.ensureHubCueFrame(0))
      .setDisplaySize(82, 82)
      .setDepth(1001)
      .setAlpha(0.96)
      .setData('usesImagegenHubCue', true)
      .setData('hubCueFrameIndex', 0);
    this.tweens.add({
      targets: icon,
      alpha: { from: 0.82, to: 1 },
      scaleX: icon.scaleX * 1.04,
      scaleY: icon.scaleY * 1.04,
      duration: 760,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    return icon;
  }

  private ensureHubCueFrame(frameIndex: number): string {
    const texture = this.textures.get(TextureKeys.HubSeamCue) as Phaser.Textures.Texture & {
      has?: (name: string) => boolean;
    };
    const safeFrame = Phaser.Math.Clamp(frameIndex, 0, 1);
    const frameKey = `hub-seam-cue-${safeFrame}`;
    if (!texture.has?.(frameKey)) {
      texture.add(frameKey, 0, safeFrame * this.hubCueFrameWidth, 0, this.hubCueFrameWidth, this.hubCueFrameHeight);
    }
    return frameKey;
  }

  private setHubCueOpen(open: boolean): void {
    if (!this.hubCueIcon || !this.textures.exists(TextureKeys.HubSeamCue)) return;
    const frameIndex = open ? 1 : 0;
    this.hubCueIcon
      .setTexture(TextureKeys.HubSeamCue, this.ensureHubCueFrame(frameIndex))
      .setDisplaySize(open ? 88 : 82, open ? 88 : 82)
      .setData('hubCueFrameIndex', frameIndex);
  }

  private setHubStatus(copy: string, cueOpen = false): void {
    if (this.currentStatusCopy !== copy) {
      this.currentStatusCopy = copy;
      this.statusText?.setText(copy);
    }
    this.setHubCueOpen(cueOpen);
    this.publishHubHud();
  }

  private publishHubHud(): void {
    if (!this.controlsText || !this.statusText) return;
    publishTextPanelAudit('hub-hud', this.hubPanelBounds, [
      { id: 'controls', object: this.controlsText },
      { id: 'status', object: this.statusText },
    ], 16);
    const panel = this.hubPanel as (Phaser.GameObjects.GameObject & { getData?: (key: string) => unknown }) | undefined;
    const usesGeneratedPanel = Boolean(panel?.getData?.('usesImagegenHudPanel'));
    const wordCount = `${this.controlsText.text} ${this.statusText.text}`.split(/\s+/).filter(Boolean).length;
    (window as Window & {
      __CODEJITSU_HUB_HUD_VISUAL?: {
        scene: string;
        usesImagegenPanel: boolean;
        primitivePanelPieces: number;
        usesImagegenHubCue: boolean;
        primitiveCuePieces: number;
        compactCopy: boolean;
        wordCount: number;
        textOverlayCount: number;
        titleVisible: boolean;
        hubCueFrameIndex: number;
        objectiveCopy: string;
        panelWidth: number;
        panelHeight: number;
        at: number;
      };
    }).__CODEJITSU_HUB_HUD_VISUAL = {
      scene: 'hub',
      usesImagegenPanel: usesGeneratedPanel,
      primitivePanelPieces: usesGeneratedPanel ? 0 : 1,
      usesImagegenHubCue: Boolean(this.hubCueIcon?.getData('usesImagegenHubCue')),
      primitiveCuePieces: this.hubCueIcon?.getData('usesImagegenHubCue') ? 0 : 1,
      compactCopy: wordCount <= 1,
      wordCount,
      textOverlayCount: [this.controlsText.text, this.statusText.text].filter((text) => text.trim().length > 0).length,
      titleVisible: false,
      hubCueFrameIndex: Number(this.hubCueIcon?.getData('hubCueFrameIndex') ?? -1),
      objectiveCopy: this.statusText.text,
      panelWidth: this.hubPanelBounds.width,
      panelHeight: this.hubPanelBounds.height,
      at: Math.round(performance.now()),
    };
  }

  private drawGate(): void {
    const gateTexture = this.textures.exists(TextureKeys.Chapter1SeamPortal) ? TextureKeys.Chapter1SeamPortal : TextureKeys.GatePortal;
    const usesGeneratedGate = this.textures.exists(gateTexture);
    let primitiveGatePieces = 0;
    if (usesGeneratedGate) {
      this.hubGate = this.add.image(this.gatePoint.x, this.gatePoint.y + 26, gateTexture)
        .setDisplaySize(132, 132)
        .setAlpha(0.72)
        .setDepth(60);
      if (gateTexture === TextureKeys.GatePortal) this.hubGate.setBlendMode(Phaser.BlendModes.ADD);
      this.hubGate.setData('usesImagegenGate', true);
      this.hubGate.setData('gateTextureKey', gateTexture);
    } else {
      primitiveGatePieces = 4;
      const glow = this.add.ellipse(this.gatePoint.x, this.gatePoint.y + 44, 172, 72, 0x8f7dff, 0.18).setDepth(58);
      this.hubGate = glow;
      const arch = this.add.graphics().setDepth(59);
      arch.lineStyle(5, 0xf0c36b, 0.72);
      arch.beginPath();
      arch.arc(this.gatePoint.x, this.gatePoint.y + 32, 74, Math.PI, Math.PI * 2);
      arch.lineTo(this.gatePoint.x + 74, this.gatePoint.y + 82);
      arch.moveTo(this.gatePoint.x - 74, this.gatePoint.y + 32);
      arch.lineTo(this.gatePoint.x - 74, this.gatePoint.y + 82);
      arch.strokePath();
      arch.lineStyle(3, 0x8f7dff, 0.66);
      arch.strokeEllipse(this.gatePoint.x, this.gatePoint.y + 50, 120, 48);
    }
    const gatePulseScaleX = (this.hubGate?.scaleX ?? 1) * 1.08;
    const gatePulseScaleY = (this.hubGate?.scaleY ?? 1) * 1.08;
    this.tweens.add({
      targets: this.hubGate,
      alpha: 0.36,
      scaleX: gatePulseScaleX,
      scaleY: gatePulseScaleY,
      duration: 760,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    (window as Window & {
      __CODEJITSU_HUB_GATE_VISUAL?: {
        scene: string;
        usesImagegenGate: boolean;
        primitiveGatePieces: number;
        textureKey: string;
        binaryDigitLabels: number;
        gateVisible: boolean;
        at: number;
      };
    }).__CODEJITSU_HUB_GATE_VISUAL = {
      scene: 'hub',
      usesImagegenGate: usesGeneratedGate,
      primitiveGatePieces,
      textureKey: usesGeneratedGate ? gateTexture : 'fallback-graphics',
      binaryDigitLabels: 0,
      gateVisible: Boolean(this.hubGate?.visible),
      at: Math.round(performance.now()),
    };
  }

  private bindInput(): void {
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (this.pauseMenu.handleKey(event)) return;
      if (event.key === 'Escape') {
        this.pauseMenu.toggle();
        return;
      }
      if (this.pauseMenu.isOpen || this.transitioning) return;
      if (event.key === 'Enter') this.tryEnterGate();
    });
  }

  private tryEnterGate(): void {
    const nearGate = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.gatePoint.x, this.gatePoint.y) < 190;
    if (!nearGate) {
      this.setHubStatus('Seek', false);
      return;
    }
    this.transitioning = true;
    const save = loadSave();
    const nextChapterReady = save.clearedChapters.includes(1) && !save.clearedChapters.includes(2);
    if (nextChapterReady) {
      this.setHubStatus('Outer', true);
      fadeInFromBlack(this);
      this.time.delayedCall(120, () => this.scene.start(SceneKeys.Chapter2Story));
      return;
    }
    this.setHubStatus('Open', true);
    this.player.setFlipX(false);
    setActorPose(this.player, 'walk');
    walkSpriteIntoGate(this, this.player, new Phaser.Math.Vector2(this.gatePoint.x, this.gatePoint.y + 42), SceneKeys.Dungeon, {
      duration: 640,
      fadeDuration: 430,
      onStep: () => {
        setActorPose(this.player, 'walk');
        this.player.setDepth(this.player.y);
        this.updateActorShadow(this.playerShadow, this.player, 28);
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
    setActorPose(this.player, movement.moving ? (movement.runFactor > 1.08 ? 'run' : 'walk') : 'idle');
    updateGroundedActorVisual(this, this.player, this.playerShadow, 28, movement, { width: 88, height: 38, alpha: 0.42 });
    const dustDelay = movement.strideIntervalMs;
    if (movement.strideIntensity > 0.34 && movement.velocity.x * movement.velocity.x + movement.velocity.y * movement.velocity.y > 8200 && this.time.now - this.lastStepDustAt > dustDelay) {
      this.lastStepDustAt = this.time.now;
      addStepDust(this, this.player.x, this.player.y, this.player.y - 6, this.lastMoveDirection.x || 1);
    }
    if (this.lastMoveDirection.x < -0.1) this.player.setFlipX(true);
    if (this.lastMoveDirection.x > 0.1) this.player.setFlipX(false);
  }

  private handleBoundaryFeedback(result: ArenaClampResult): void {
    if (!result.clamped) return;
    publishBoundaryFeedback('hub', result);
    if (this.time.now - this.lastBoundaryFeedbackAt < 220) return;
    this.lastBoundaryFeedbackAt = this.time.now;
    addBoundaryBump(this, result.point.x, result.point.y, result.side, this.player.y + 16);
  }

  private safeSetVelocity(sprite: Phaser.Physics.Arcade.Sprite, x: number, y: number): void {
    guardedSetVelocity('hub', sprite, x, y);
  }

  private updateActorShadow(shadow: Phaser.GameObjects.Image, actor: Phaser.GameObjects.Sprite, offsetY: number): void {
    shadow.setPosition(actor.x, actor.y + offsetY);
    shadow.setDepth(actor.y - 8);
  }
}
