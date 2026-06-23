import Phaser from 'phaser';
import { createAbilityState, pushSyntaxToken, recordComboHit, castAbility, type AbilityRuntimeState } from '../systems/abilityEngine';
import { createGameKeys, type GameKeys } from '../systems/input';
import { loadSave, writeSave } from '../systems/saveSystem';
import { parseTerminalCommand, tokensForCommand } from '../systems/terminalCommandEngine';
import { apprenticeMovementTuning, readMovementInput, stepMovementVelocity } from '../systems/movementEngine';
import {
  completeTutorialTrigger,
  createTutorialState,
  getCurrentTutorialStep,
  isTutorialComplete,
  type TutorialRuntimeState,
} from '../systems/tutorialEngine';
import { addActorSprite, setActorPose, type ActorPose } from './actors';
import { addAbilityCastBurst } from './abilityVisuals';
import { installAudioUnlock } from './audioUnlock';
import { PauseMenuOverlay, TerminalOverlay } from './overlays';
import { guardedSetVelocity, publishBoundaryFeedback, publishControlScheme, publishFrameHealth, publishPlayerBounds, publishSwordSwing } from './runtimeDebug';
import { SceneKeys, TextureKeys } from './sceneKeys';
import { clampSpriteToArenaBounds, fadeInFromBlack, walkSpriteIntoGate, type ArenaClampResult } from './transition';
import { showKeikoHelper } from './roomIntro';
import { addArenaDepthCues, addBoundaryBump, addForegroundDepthOverlay, addPanel, addRoomDepthBorders, addStepDust, addSwordSwing, makePixelText, playCast, playSlash, updateForegroundParallaxDepth, updateGroundedActorVisual } from './ui';

const TUTORIAL_TEXT_CENTER_OFFSET_X = 330;
const TUTORIAL_INSTRUCTION_OFFSET_Y = 36;
const TUTORIAL_STATUS_OFFSET_Y = 66;
const TUTORIAL_STATUS_BOTTOM_MARGIN = 22;

export class TutorialScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private mentor!: Phaser.Physics.Arcade.Sprite;
  private dummy!: Phaser.Physics.Arcade.Sprite;
  private keys!: GameKeys;
  private instruction!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  private tutorialPanel?: Phaser.GameObjects.GameObject;
  private tutorialHintIcon?: Phaser.GameObjects.Image;
  private readonly tutorialPanelBounds = new Phaser.Geom.Rectangle(34, 574, 560, 134);
  private tutorialFocusOverlayUsesImagegen = false;
  private tutorialPrimitiveBackdropShadePieces = 0;
  private marker!: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse;
  private warning!: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse;
  private tutorialSigilFrameWidth = 0;
  private tutorialSigilFrameHeight = 0;
  private tutorialHintFrameWidth = 0;
  private tutorialHintFrameHeight = 0;
  private gateMarker?: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse;
  private gateGroup!: Phaser.GameObjects.Group;
  private foregroundOverlay?: Phaser.GameObjects.Image;
  private playerShadow!: Phaser.GameObjects.Image;
  private mentorShadow!: Phaser.GameObjects.Image;
  private dummyShadow!: Phaser.GameObjects.Image;
  private dummyHp = 2;
  private dummyHits = 0;
  private lastDummyHitAt = -9999;
  private tutorial = createTutorialState();
  private abilityState: AbilityRuntimeState = createAbilityState();
  private terminal!: TerminalOverlay;
  private pauseMenu!: PauseMenuOverlay;
  private canSwing = true;
  private poseLockedUntil = 0;
  private lockedPlayerPose: ActorPose = 'idle';
  private currentVelocity = new Phaser.Math.Vector2(0, 0);
  private lastMoveDirection = new Phaser.Math.Vector2(1, 0);
  private moveHeldMs = 0;
  private lastStepDustAt = 0;
  private lastBoundaryFeedbackAt = 0;
  private exitReady = false;
  private transitioning = false;
  private terminalOpenedOnce = false;
  private vowCastOnce = false;
  private readonly soloPractice = true;
  private lastDebugPublishAt = 0;
  private readonly walkableBounds = new Phaser.Geom.Rectangle(190, 260, 860, 288);
  private readonly gatePoint = new Phaser.Math.Vector2(940, 376);
  private readonly tutorialSigilCropYRatio = 0.18;
  private readonly tutorialSigilCropHeightRatio = 0.58;
  private readonly tutorialHintCropYRatio = 0.08;
  private readonly tutorialHintCropHeightRatio = 0.74;

  constructor() {
    super(SceneKeys.Tutorial);
  }

  create(): void {
    (window as unknown as { __CODEJITSU_SCENE?: string }).__CODEJITSU_SCENE = 'tutorial';
    publishControlScheme('tutorial');
    installAudioUnlock(this);
    (window as unknown as { __CODEJITSU_TUTORIAL_GATE_OPEN?: boolean }).__CODEJITSU_TUTORIAL_GATE_OPEN = false;
    writeSave({ ...loadSave(), currentCheckpoint: 'tutorial' });
    this.keys = createGameKeys(this);
    this.abilityState = createAbilityState(loadSave().playerUpgrades.maxEnergy);
    this.drawDojo();
    addRoomDepthBorders(this, this.walkableBounds, { sceneId: 'tutorial', frontDepth: 860, accentColor: 0xf0c36b });
    addArenaDepthCues(this, this.walkableBounds, { sceneId: 'tutorial', accentColor: 0xf0c36b, foregroundDepth: 862 });
    this.foregroundOverlay = addForegroundDepthOverlay(this, 865, 0.78);
    fadeInFromBlack(this);
    this.player = addActorSprite(this, 'hero', 346, 500, TextureKeys.Hero, 1.16).setCollideWorldBounds(true).setDrag(1500);
    this.mentor = addActorSprite(this, 'mentor', -160, -160, TextureKeys.Mentor, 0.98)
      .setImmovable(true)
      .setVisible(false)
      .setActive(false)
      .setAlpha(0);
    this.dummy = this.createPracticeDummy(650, 484);
    this.playerShadow = this.add.image(this.player.x, this.player.y + 27, TextureKeys.Shadow).setDisplaySize(78, 32).setAlpha(0.42).setDepth(this.player.y - 4);
    this.mentorShadow = this.add.image(this.mentor.x, this.mentor.y + 29, TextureKeys.Shadow).setDisplaySize(82, 30).setAlpha(0).setVisible(false).setDepth(this.mentor.y - 4);
    this.dummyShadow = this.add.image(this.dummy.x, this.dummy.y + 28, TextureKeys.Shadow).setDisplaySize(84, 30).setAlpha(0.36).setDepth(this.dummy.y - 4);
    this.mentor.setFlipX(false);
    this.player.setFlipX(false);
    this.player.body?.setSize(28, 24).setOffset(18, 62);
    this.mentor.body?.setSize(18, 16).setOffset(34, 94);
    if (this.mentor.body) this.mentor.body.enable = false;
    if (this.textures.exists(TextureKeys.TutorialVowTarget)) {
      this.dummy.body?.setSize(42, 58, true);
    } else if (this.textures.exists(TextureKeys.ArchivePracticeEcho)) {
      this.dummy.body?.setSize(58, 50, true);
    } else {
      this.dummy.body?.setSize(36, 34).setOffset(52, 142);
    }
    this.marker = this.createTutorialMarker(520, 464, 0, 172, 92, 0.92, 60);
    this.warning = this.createTutorialMarker(520, 464, 2, 164, 88, 0.78, 59).setVisible(false);
    this.setDummyPose('idle');
    this.tweens.add({
      targets: [this.dummy, this.dummyShadow],
      y: '+=5',
      duration: 680,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
      onUpdate: () => {
        this.dummy.setDepth(this.dummy.y);
        this.updateActorShadow(this.dummyShadow, this.dummy, 28);
      },
    });
    this.createDojoGate();
    this.createHud();
    this.terminal = new TerminalOverlay(
      this,
      (command) => this.castTerminalCommand(command),
      (open) => this.setTutorialHudVisible(!open, open ? 'terminal-open' : 'terminal-closed'),
    );
    this.pauseMenu = new PauseMenuOverlay(
      this,
      () => this.scene.start(SceneKeys.Title),
    );
    this.bindInput();
    this.publishTutorialFlowRuntime();
    this.renderStep();

    // After a brief settle, Keiko explains what kinds of rooms the apprentice will face.
    this.time.delayedCall(900, () => {
      showKeikoHelper(this, {
        title: 'Tutorial — what waits ahead',
        speaker: 'Master Keiko\'s Friend',
        lines: [
          'Apprentice, listen up. This copy is a straight combat gauntlet now.',
          'Chapter 1 is ten rooms of high-health archive minions, then Null Oni.',
          'Chapter 2 is ten more rooms of looping minions, then Return Oni.',
          'No puzzle rooms. No stealth rooms. No traversal detours. Clear every room by fighting.',
          'X strikes are your backbone. T opens terminal vows when the fight drags long.',
        ],
      });
    });
  }

  update(time: number, delta: number): void {
    publishFrameHealth('tutorial', delta);
    this.reconcileTutorialProgress();
    if (this.transitioning || this.pauseMenu.isOpen || this.terminal.isOpen) {
      this.safeSetVelocity(this.player, 0, 0);
      return;
    }
    this.handleMovement(delta);
    this.handleBoundaryFeedback(clampSpriteToArenaBounds(this.player, this.walkableBounds));
    this.separateFromMentor();
    this.updateActorShadow(this.playerShadow, this.player, 27);
    if (!this.soloPractice) this.updateActorShadow(this.mentorShadow, this.mentor, 32);
    this.updateActorShadow(this.dummyShadow, this.dummy, 28);
    this.player.setDepth(this.player.y);
    if (!this.soloPractice) this.mentor.setDepth(this.mentor.y);
    this.dummy.setDepth(this.dummy.y);
    if (time - this.lastDebugPublishAt > 150) {
      this.lastDebugPublishAt = time;
      publishPlayerBounds('tutorial', this.player, this.walkableBounds, 0.48);
      this.publishDummyRuntime();
    }

    if (getCurrentTutorialStep(this.tutorial)?.trigger === 'move' && Phaser.Math.Distance.Between(this.player.x, this.player.y, 520, 464) < 54) {
      this.completeStep('move');
    }
    if (getCurrentTutorialStep(this.tutorial)?.trigger === 'face' && Phaser.Math.Distance.Between(this.player.x, this.player.y, 562, 492) < 62) {
      this.player.setFlipX(false);
      this.completeStep('face');
    }
    if (this.exitReady && Phaser.Math.Distance.Between(this.player.x, this.player.y, this.gatePoint.x, this.gatePoint.y) < 86) {
      this.setTutorialStatus('Cross seam');
    }
  }

  private reconcileTutorialProgress(): void {
    const currentTrigger = getCurrentTutorialStep(this.tutorial)?.trigger;
    if (currentTrigger === 'swing' && this.dummyHp <= 0) {
      this.completeStep('swing');
      return;
    }
    if (currentTrigger === 'terminal' && (this.terminalOpenedOnce || this.terminal.isOpen)) {
      this.completeStep('terminal');
      return;
    }
    if (currentTrigger === 'cast' && this.vowCastOnce) {
      this.completeStep('cast');
    }
  }

  private drawDojo(): void {
    this.cameras.main.setBackgroundColor('#100b16');
    if (this.textures.exists(TextureKeys.TutorialYard)) {
      this.add.image(640, 360, TextureKeys.TutorialYard).setDisplaySize(1280, 720);
      this.addTutorialFocusOverlay(0.3);
      this.publishTutorialBackdropRuntime(true, TextureKeys.TutorialYard);
      return;
    }
    if (this.textures.exists(TextureKeys.BrokenDojo)) {
      this.add.image(640, 360, TextureKeys.BrokenDojo).setDisplaySize(1280, 720);
      this.addTutorialFocusOverlay(0.36);
      this.publishTutorialBackdropRuntime(false, TextureKeys.BrokenDojo);
      return;
    }
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 10; col += 1) {
        this.add.image(220 + col * 88 + row * 44, 250 + row * 32, TextureKeys.FloorTile).setAlpha(0.84);
      }
    }
    this.publishTutorialBackdropRuntime(false, TextureKeys.FloorTile);
  }

  private addTutorialFocusOverlay(alpha: number): void {
    this.tutorialFocusOverlayUsesImagegen = this.textures.exists(TextureKeys.TutorialFocusOverlay);
    this.tutorialPrimitiveBackdropShadePieces = this.tutorialFocusOverlayUsesImagegen ? 0 : 1;
    if (this.tutorialFocusOverlayUsesImagegen) {
      const source = this.textures.get(TextureKeys.TutorialFocusOverlay).getSourceImage() as { width?: number; height?: number };
      const sourceWidth = Number(source.width ?? 1280);
      const sourceHeight = Number(source.height ?? 720);
      const scale = Math.max(1280 / Math.max(1, sourceWidth), 720 / Math.max(1, sourceHeight));
      this.add.image(640, 360, TextureKeys.TutorialFocusOverlay)
        .setDisplaySize(Math.ceil(sourceWidth * scale), Math.ceil(sourceHeight * scale))
        .setDepth(4)
        .setAlpha(alpha)
        .setBlendMode(Phaser.BlendModes.NORMAL)
        .setData('usesImagegenTutorialFocusOverlay', true);
      return;
    }
    this.add.rectangle(640, 360, 1280, 720, 0x08060c, alpha * 0.26).setDepth(4);
  }

  private publishTutorialBackdropRuntime(usesCleanImagegenBackdrop: boolean, textureKey: string): void {
    const source = this.textures.exists(textureKey)
      ? this.textures.get(textureKey).getSourceImage() as { width?: number; height?: number }
      : undefined;
    (window as Window & {
      __CODEJITSU_TUTORIAL_BACKDROP?: {
        scene: string;
        textureKey: string;
        usesCleanImagegenBackdrop: boolean;
        routeLineRemoved: boolean;
        noBakedText: boolean;
        noBakedCharacters: boolean;
        usesImagegenFocusOverlay: boolean;
        primitiveBackdropShadePieces: number;
        focusOverlayTextureKey: string;
        sourceWidth: number;
        sourceHeight: number;
        at: number;
      };
    }).__CODEJITSU_TUTORIAL_BACKDROP = {
      scene: 'tutorial',
      textureKey,
      usesCleanImagegenBackdrop,
      routeLineRemoved: usesCleanImagegenBackdrop,
      noBakedText: usesCleanImagegenBackdrop,
      noBakedCharacters: usesCleanImagegenBackdrop,
      usesImagegenFocusOverlay: this.tutorialFocusOverlayUsesImagegen,
      primitiveBackdropShadePieces: this.tutorialPrimitiveBackdropShadePieces,
      focusOverlayTextureKey: this.tutorialFocusOverlayUsesImagegen ? TextureKeys.TutorialFocusOverlay : 'fallback-rectangle',
      sourceWidth: Number(source?.width ?? 0),
      sourceHeight: Number(source?.height ?? 0),
      at: Math.round(performance.now()),
    };
  }

  private createPracticeDummy(x: number, y: number): Phaser.Physics.Arcade.Sprite {
    if (this.textures.exists(TextureKeys.TutorialVowTarget)) {
      const target = this.physics.add.sprite(x, y, TextureKeys.TutorialVowTarget, this.ensureVowTargetFrame(0))
        .setDisplaySize(96, 126)
        .setAlpha(0.96)
        .setImmovable(true);
      target.setData('actorKind', 'tutorial-vow-target');
      target.setData('actorPose', 'idle');
      target.setData('actorRenderVariant', 'imagegen-vow-target');
      target.setData('actorFrameCount', 4);
      target.setData('actorFrameIndex', 0);
      target.setData('motionProfile', 'non-character-vow-target');
      target.setData('spectralEcho', false);
      target.setData('targetObject', true);
      return target;
    }
    if (this.textures.exists(TextureKeys.ArchivePracticeEcho)) {
      const dummy = this.physics.add.sprite(x, y, TextureKeys.ArchivePracticeEcho, this.ensureArchiveEchoFrame(0))
        .setDisplaySize(128, 118)
        .setAlpha(0.94)
        .setImmovable(true);
      dummy.setData('actorKind', 'archive-practice-echo');
      dummy.setData('actorPose', 'idle');
      dummy.setData('actorRenderVariant', 'imagegen-archive-practice-echo');
      dummy.setData('actorFrameCount', 4);
      dummy.setData('actorFrameIndex', 0);
      dummy.setData('spectralEcho', true);
      return dummy;
    }
    return addActorSprite(this, 'sentinel', x, y, TextureKeys.NullOni, 0.68).setImmovable(true).setTint(0xd8b064);
  }

  private ensureVowTargetFrame(frameIndex: number): string {
    const texture = this.textures.get(TextureKeys.TutorialVowTarget) as Phaser.Textures.Texture & {
      frames: Record<string, Phaser.Textures.Frame>;
    };
    const source = texture.getSourceImage() as { width?: number; height?: number };
    const frameWidth = Math.floor(Number(source.width ?? 1984) / 4);
    const frameHeight = Number(source.height ?? 793);
    const safeFrame = Phaser.Math.Clamp(frameIndex, 0, 3);
    const frameKey = `tutorial-vow-target-${safeFrame}`;
    if (!texture.frames[frameKey]) {
      texture.add(frameKey, 0, safeFrame * frameWidth, 0, frameWidth, frameHeight);
    }
    return frameKey;
  }

  private ensureArchiveEchoFrame(frameIndex: number): string {
    const texture = this.textures.get(TextureKeys.ArchivePracticeEcho) as Phaser.Textures.Texture & {
      frames: Record<string, Phaser.Textures.Frame>;
    };
    const source = texture.getSourceImage() as { width?: number; height?: number };
    const frameWidth = Math.floor(Number(source.width ?? 2048) / 4);
    const frameHeight = Number(source.height ?? 640);
    const safeFrame = Phaser.Math.Clamp(frameIndex, 0, 3);
    const frameKey = `archive-practice-echo-${safeFrame}`;
    if (!texture.frames[frameKey]) {
      texture.add(frameKey, 0, safeFrame * frameWidth, 0, frameWidth, frameHeight);
    }
    return frameKey;
  }

  private createTutorialMarker(
    x: number,
    y: number,
    frameIndex: number,
    width: number,
    height: number,
    alpha: number,
    depth: number,
  ): Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse {
    if (this.textures.exists(TextureKeys.TutorialSigils)) {
      const frame = this.ensureTutorialSigilFrame(frameIndex);
      const marker = this.add.image(x, y, TextureKeys.TutorialSigils, frame)
        .setOrigin(0.5)
        .setDisplaySize(width, height)
        .setAlpha(alpha)
        .setDepth(depth)
        .setBlendMode(Phaser.BlendModes.NORMAL);
      marker.setData('usesImagegenSigil', true);
      marker.setData('sigilFrameIndex', frameIndex);
      return marker;
    }
    return this.add.ellipse(x, y, width, height, frameIndex === 2 ? 0xd64f45 : 0xf0c36b, alpha * 0.28).setDepth(depth);
  }

  private setTutorialMarker(
    marker: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse,
    frameIndex: number,
    x: number,
    y: number,
    width: number,
    height: number,
    alpha?: number,
  ): void {
    marker.setPosition(x, y).setDisplaySize(width, height);
    if (marker instanceof Phaser.GameObjects.Image) {
      marker.setTexture(TextureKeys.TutorialSigils, this.ensureTutorialSigilFrame(frameIndex));
      marker.setDisplaySize(width, height).setBlendMode(Phaser.BlendModes.NORMAL);
      marker.setData('usesImagegenSigil', true);
      marker.setData('sigilFrameIndex', frameIndex);
    } else {
      marker.setFillStyle(frameIndex === 2 ? 0xd64f45 : 0xf0c36b, (alpha ?? marker.alpha) * 0.28);
    }
    if (alpha !== undefined) marker.setAlpha(alpha);
  }

  private ensureTutorialSigilFrame(frameIndex: number): string {
    const texture = this.textures.get(TextureKeys.TutorialSigils) as Phaser.Textures.Texture & {
      frames: Record<string, Phaser.Textures.Frame>;
    };
    const source = texture.getSourceImage() as { width?: number; height?: number };
    this.tutorialSigilFrameWidth = Math.floor(Number(source.width ?? 2172) / 4);
    this.tutorialSigilFrameHeight = Number(source.height ?? 724);
    const safeFrame = Phaser.Math.Clamp(frameIndex, 0, 3);
    const cropY = Math.round(this.tutorialSigilFrameHeight * this.tutorialSigilCropYRatio);
    const cropHeight = Math.round(this.tutorialSigilFrameHeight * this.tutorialSigilCropHeightRatio);
    const frameKey = `tutorial-sigil-${safeFrame}`;
    if (!texture.frames[frameKey]) {
      texture.add(frameKey, 0, safeFrame * this.tutorialSigilFrameWidth, cropY, this.tutorialSigilFrameWidth, cropHeight);
    }
    return frameKey;
  }

  private setDummyPose(pose: 'idle' | 'attack' | 'hurt' | 'defeat'): void {
    if (!this.dummy) return;
    if (this.textures.exists(TextureKeys.TutorialVowTarget)) {
      const poseFrame = pose === 'attack' ? 1 : pose === 'hurt' ? 2 : pose === 'defeat' ? 3 : 0;
      const width = pose === 'attack' ? 108 : pose === 'defeat' ? 112 : 96;
      this.dummy
        .setTexture(TextureKeys.TutorialVowTarget, this.ensureVowTargetFrame(poseFrame))
        .setCrop()
        .setDisplaySize(width, pose === 'defeat' ? 118 : 126)
        .setAlpha(pose === 'defeat' ? 0.7 : 0.96)
        .setBlendMode(Phaser.BlendModes.NORMAL);
      if (pose === 'hurt') {
        this.dummy.setTint(0xf0c36b);
      } else {
        this.dummy.clearTint();
      }
      this.dummy.setData('actorKind', 'tutorial-vow-target');
      this.dummy.setData('actorPose', pose);
      this.dummy.setData('actorRenderVariant', 'imagegen-vow-target');
      this.dummy.setData('actorFrameCount', 4);
      this.dummy.setData('actorFrameIndex', poseFrame);
      this.dummy.setData('motionProfile', pose === 'attack' ? 'vow-target-warning-glow' : pose === 'defeat' ? 'vow-target-fracture' : 'vow-target-practice-object');
      this.dummy.setData('spectralEcho', false);
      this.dummy.setData('targetObject', true);
      return;
    }
    if (this.textures.exists(TextureKeys.ArchivePracticeEcho)) {
      const poseFrame = pose === 'attack' ? 1 : pose === 'hurt' ? 2 : pose === 'defeat' ? 3 : 0;
      const width = pose === 'attack' ? 144 : pose === 'defeat' ? 136 : 128;
      this.dummy
        .setTexture(TextureKeys.ArchivePracticeEcho, this.ensureArchiveEchoFrame(poseFrame))
        .setCrop()
        .setDisplaySize(width, pose === 'defeat' ? 108 : 118)
        .setAlpha(pose === 'defeat' ? 0.7 : 0.94)
        .setBlendMode(Phaser.BlendModes.NORMAL);
      if (pose === 'hurt') {
        this.dummy.setTint(0xf0c36b);
      } else {
        this.dummy.clearTint();
      }
      this.dummy.setData('actorKind', 'archive-practice-echo');
      this.dummy.setData('actorPose', pose);
      this.dummy.setData('actorRenderVariant', 'imagegen-archive-practice-echo');
      this.dummy.setData('actorFrameCount', 4);
      this.dummy.setData('actorFrameIndex', poseFrame);
      this.dummy.setData('motionProfile', pose === 'attack' ? 'practice-blade-windup' : pose === 'defeat' ? 'mask-break-collapse' : 'archive-target-pose');
      this.dummy.setData('spectralEcho', true);
      return;
    }
    setActorPose(this.dummy, pose === 'attack' ? 'attack' : pose);
  }

  private createHud(): void {
    this.tutorialPanel = this.createTutorialHudPanel();
    this.tutorialHintIcon = this.createTutorialHintIcon();
    const textCenterX = this.tutorialPanelBounds.x + TUTORIAL_TEXT_CENTER_OFFSET_X;
    this.instruction = makePixelText(this, textCenterX, this.tutorialPanelBounds.y + TUTORIAL_INSTRUCTION_OFFSET_Y, '', 13, '#f6ead3')
      .setOrigin(0.5, 0)
      .setAlign('center')
      .setWordWrapWidth(390)
      .setLineSpacing(2)
      .setDepth(1001);
    this.status = makePixelText(this, textCenterX, this.tutorialPanelBounds.y + TUTORIAL_STATUS_OFFSET_Y, '', 11, '#ded1df')
      .setOrigin(0.5, 0)
      .setAlign('center')
      .setWordWrapWidth(340)
      .setLineSpacing(2)
      .setDepth(1001);
  }

  private setTutorialHudVisible(visible: boolean, reason: string): void {
    (this.tutorialPanel as Phaser.GameObjects.GameObject & { setVisible?: (value: boolean) => unknown } | undefined)?.setVisible?.(visible);
    this.tutorialHintIcon?.setVisible(visible);
    this.instruction?.setVisible(visible);
    this.status?.setVisible(visible);
    (window as Window & {
      __CODEJITSU_TUTORIAL_HUD_VISIBILITY?: {
        visible: boolean;
        hiddenForTerminal: boolean;
        reason: string;
        at: number;
      };
    }).__CODEJITSU_TUTORIAL_HUD_VISIBILITY = {
      visible,
      hiddenForTerminal: !visible && this.terminal?.isOpen === true,
      reason,
      at: Math.round(performance.now()),
    };
  }

  private createTutorialHudPanel(): Phaser.GameObjects.GameObject {
    if (this.textures.exists(TextureKeys.TutorialHudPanel)) {
      return this.add.image(this.tutorialPanelBounds.centerX, this.tutorialPanelBounds.centerY, TextureKeys.TutorialHudPanel)
        .setDisplaySize(this.tutorialPanelBounds.width, this.tutorialPanelBounds.height)
        .setDepth(1000)
        .setAlpha(0.94)
        .setData('usesImagegenHudPanel', true);
    }
    return addPanel(this, this.tutorialPanelBounds.x, this.tutorialPanelBounds.y, this.tutorialPanelBounds.width, this.tutorialPanelBounds.height, 0.74)
      .setDepth(1000);
  }

  private createTutorialHintIcon(): Phaser.GameObjects.Image | undefined {
    if (!this.textures.exists(TextureKeys.TutorialHintStrip)) return undefined;
    const icon = this.add.image(this.tutorialPanelBounds.x + 66, this.tutorialPanelBounds.y + 51, TextureKeys.TutorialHintStrip, this.ensureTutorialHintFrame(0))
      .setOrigin(0.5)
      .setDisplaySize(78, 60)
      .setDepth(1001)
      .setAlpha(0.96)
      .setBlendMode(Phaser.BlendModes.NORMAL);
    icon.setData('usesImagegenHintStrip', true);
    icon.setData('hintFrameIndex', 0);
    icon.setData('primitiveHintPieces', 0);
    return icon;
  }

  private ensureTutorialHintFrame(frameIndex: number): string {
    const texture = this.textures.get(TextureKeys.TutorialHintStrip) as Phaser.Textures.Texture & {
      frames: Record<string, Phaser.Textures.Frame>;
    };
    const source = texture.getSourceImage() as { width?: number; height?: number };
    this.tutorialHintFrameWidth = Math.floor(Number(source.width ?? 2172) / 4);
    this.tutorialHintFrameHeight = Number(source.height ?? 724);
    const safeFrame = Phaser.Math.Clamp(frameIndex, 0, 3);
    const cropY = Math.round(this.tutorialHintFrameHeight * this.tutorialHintCropYRatio);
    const cropHeight = Math.round(this.tutorialHintFrameHeight * this.tutorialHintCropHeightRatio);
    const frameKey = `tutorial-hint-${safeFrame}`;
    if (!texture.frames[frameKey]) {
      texture.add(frameKey, 0, safeFrame * this.tutorialHintFrameWidth, cropY, this.tutorialHintFrameWidth, cropHeight);
    }
    return frameKey;
  }

  private tutorialHintFrameForStep(trigger?: string): number {
    if (trigger === 'face') return 1;
    if (trigger === 'swing') return 2;
    if (trigger === 'terminal' || trigger === 'cast' || trigger === 'complete') return 3;
    return 0;
  }

  private updateTutorialHintIcon(trigger?: string): void {
    if (!this.tutorialHintIcon) return;
    const frameIndex = this.tutorialHintFrameForStep(trigger);
    this.tutorialHintIcon
      .setTexture(TextureKeys.TutorialHintStrip, this.ensureTutorialHintFrame(frameIndex))
      .setDisplaySize(68, 52);
    this.tutorialHintIcon.setData('hintFrameIndex', frameIndex);
  }

  private createDojoGate(): void {
    this.gateGroup = this.add.group();
    const gateTexture = this.textures.exists(TextureKeys.Chapter1SeamPortal) ? TextureKeys.Chapter1SeamPortal : TextureKeys.GatePortal;
    const usesGeneratedGate = this.textures.exists(gateTexture);
    if (usesGeneratedGate) {
      this.gateMarker = this.add.image(this.gatePoint.x, this.gatePoint.y + 34, gateTexture)
        .setDisplaySize(168, 132)
        .setAlpha(0.86)
        .setDepth(61);
      if (gateTexture === TextureKeys.GatePortal) this.gateMarker.setBlendMode(Phaser.BlendModes.ADD);
      this.gateMarker.setData('usesImagegenGate', true);
      this.gateMarker.setData('gateTextureKey', gateTexture);
      this.gateGroup.add(this.gateMarker);
    } else {
      this.gateMarker = this.add.ellipse(this.gatePoint.x, this.gatePoint.y + 54, 112, 48, 0xf0c36b, 0.18).setDepth(61);
      this.gateGroup.add(this.gateMarker);
    }
    this.gateGroup.setVisible(false);
    const gatePulseScaleX = this.gateMarker.scaleX * 1.08;
    const gatePulseScaleY = this.gateMarker.scaleY * 1.08;
    this.tweens.add({
      targets: this.gateMarker,
      alpha: 0.38,
      scaleX: gatePulseScaleX,
      scaleY: gatePulseScaleY,
      duration: 720,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    (window as Window & {
      __CODEJITSU_TUTORIAL_GATE_VISUAL?: {
        scene: string;
        usesImagegenGate: boolean;
        primitiveGatePieces: number;
        textureKey: string;
        labelVisible: boolean;
        gateVisible: boolean;
        at: number;
      };
    }).__CODEJITSU_TUTORIAL_GATE_VISUAL = {
      scene: 'tutorial',
      usesImagegenGate: usesGeneratedGate,
      primitiveGatePieces: usesGeneratedGate ? 0 : 1,
      textureKey: usesGeneratedGate ? gateTexture : 'fallback-ellipse',
      labelVisible: false,
      gateVisible: false,
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
      if (this.pauseMenu.isOpen) return;
      if (this.transitioning) return;
      if (event.key.toLowerCase() === 'x') this.swing();
      if (event.key.toLowerCase() === 't') {
        this.terminal.open(event.timeStamp);
        this.terminalOpenedOnce = true;
        this.completeStep('terminal');
      }
      if (event.key === 'Enter') this.tryEnterGate();
    });
  }

  private tryEnterGate(): void {
    if (!this.exitReady) {
      this.setTutorialStatus('Finish the vow');
      return;
    }
    const nearGate = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.gatePoint.x, this.gatePoint.y) < 96;
    if (!nearGate) {
      this.setTutorialStatus('Move to seam');
      return;
    }
    this.transitioning = true;
    this.setTutorialStatus('Seam opens');
    this.player.setFlipX(false);
    this.poseLockedUntil = this.time.now + 900;
    this.lockedPlayerPose = 'walk';
    setActorPose(this.player, 'walk');
    walkSpriteIntoGate(this, this.player, new Phaser.Math.Vector2(this.gatePoint.x, this.gatePoint.y + 42), SceneKeys.Dungeon, {
      duration: 620,
      fadeDuration: 420,
      onStep: () => {
        this.player.setDepth(this.player.y);
        this.updateActorShadow(this.playerShadow, this.player, 27);
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
    updateGroundedActorVisual(this, this.player, this.playerShadow, 27, movement, { width: 78, height: 32, alpha: 0.42 });
    updateForegroundParallaxDepth(this, 'tutorial', this.foregroundOverlay, movement, 0.32);
    const dustDelay = movement.strideIntervalMs;
    if (movement.strideIntensity > 0.34 && movement.velocity.x * movement.velocity.x + movement.velocity.y * movement.velocity.y > 8200 && this.time.now - this.lastStepDustAt > dustDelay) {
      this.lastStepDustAt = this.time.now;
      addStepDust(this, this.player.x, this.player.y, this.player.y - 6, this.lastMoveDirection.x || 1);
    }
    if (this.lastMoveDirection.x < -0.1) this.player.setFlipX(true);
    if (this.lastMoveDirection.x > 0.1) this.player.setFlipX(false);
  }

  private separateFromMentor(): void {
    if (this.soloPractice) {
      (window as Window & {
        __CODEJITSU_TUTORIAL_SPACING?: {
          player: { x: number; y: number };
          mentor: { x: number; y: number };
          minDistance: number;
          actualDistance: number;
          noOverlap: boolean;
          soloPractice: boolean;
          at: number;
        };
      }).__CODEJITSU_TUTORIAL_SPACING = {
        player: { x: Math.round(this.player.x * 10) / 10, y: Math.round(this.player.y * 10) / 10 },
        mentor: { x: -160, y: -160 },
        minDistance: 0,
        actualDistance: 999,
        noOverlap: true,
        soloPractice: true,
        at: Math.round(performance.now()),
      };
      return;
    }
    const dx = this.player.x - this.mentor.x;
    const dy = (this.player.y - this.mentor.y) * 1.42;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const minDistance = 86;
    if (distance >= minDistance) return;
    const push = (minDistance - distance) * 0.62;
    const pushX = (dx / distance) * push;
    const pushY = (dy / distance) * push * 0.7;
    this.player.x += pushX;
    this.player.y += pushY;
    this.currentVelocity.x *= 0.42;
    this.currentVelocity.y *= 0.42;
    this.safeSetVelocity(this.player, this.currentVelocity.x, this.currentVelocity.y);
    this.handleBoundaryFeedback(clampSpriteToArenaBounds(this.player, this.walkableBounds));
    const afterDx = this.player.x - this.mentor.x;
    const afterDy = (this.player.y - this.mentor.y) * 1.42;
    const afterDistance = Math.hypot(afterDx, afterDy);
    (window as Window & {
      __CODEJITSU_TUTORIAL_SPACING?: {
        player: { x: number; y: number };
        mentor: { x: number; y: number };
        minDistance: number;
        actualDistance: number;
        noOverlap: boolean;
        soloPractice: boolean;
        at: number;
      };
    }).__CODEJITSU_TUTORIAL_SPACING = {
      player: { x: Math.round(this.player.x * 10) / 10, y: Math.round(this.player.y * 10) / 10 },
      mentor: { x: Math.round(this.mentor.x * 10) / 10, y: Math.round(this.mentor.y * 10) / 10 },
      minDistance,
      actualDistance: Math.round(afterDistance * 10) / 10,
      noOverlap: afterDistance >= minDistance * 0.94,
      soloPractice: false,
      at: Math.round(performance.now()),
    };
  }

  private swing(): void {
    if (!this.canSwing) return;
    this.canSwing = false;
    this.completeIfCurrent('face');
    this.abilityState = recordComboHit(this.abilityState);
    this.poseLockedUntil = this.time.now + 260;
    this.lockedPlayerPose = 'swing';
    setActorPose(this.player, 'swing');
    playSlash(this);
    const direction: 1 | -1 = this.player.flipX ? -1 : 1;
    this.player.x += direction * 12;
    this.currentVelocity.set(direction * 90, this.currentVelocity.y * 0.2);
    this.safeSetVelocity(this.player, this.currentVelocity.x, this.currentVelocity.y);
    this.handleBoundaryFeedback(clampSpriteToArenaBounds(this.player, this.walkableBounds));
    const sword = addSwordSwing(this, this.player.x, this.player.y, direction, this.player.y + 24);
    publishSwordSwing('tutorial', this.player.x, this.player.y, sword.hitX, sword.hitY, 0, '', sword);
    this.tryHitPracticeDummy(sword.hitX, sword.hitY, direction);
    this.time.delayedCall(220, () => {
      this.canSwing = true;
      setActorPose(this.player, 'idle');
    });
  }

  private handleBoundaryFeedback(result: ArenaClampResult): void {
    if (!result.clamped) return;
    publishBoundaryFeedback('tutorial', result);
    if (this.time.now - this.lastBoundaryFeedbackAt < 220) return;
    this.lastBoundaryFeedbackAt = this.time.now;
    addBoundaryBump(this, result.point.x, result.point.y, result.side, this.player.y + 16);
  }

  private castTerminalCommand(input: string): void {
    const parsed = parseTerminalCommand(input);
    if (!parsed.command) {
      this.setTutorialStatus('Vow rejected');
      return;
    }
    let next = this.abilityState;
    tokensForCommand(parsed.command.command).forEach((token) => {
      next = pushSyntaxToken(next, token, 2);
    });
    const [afterCast, result] = castAbility(next, loadSave().unlockedAbilities, this.time.now);
    this.abilityState = afterCast;
    this.setTutorialStatus(result.ok ? 'Vow answered' : 'Vow failed');
    if (result.ok && result.ability) {
      this.vowCastOnce = true;
      playCast(this);
      const icon = addAbilityCastBurst(this, this.player.x, this.player.y, result.ability.id, this.player.y + 120);
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
        scene: 'tutorial',
        abilityId: result.ability.id,
        usesGeneratedIcon: Boolean(icon),
        usesGeneratedEffect: Boolean(icon?.getData('usesGeneratedEffect')),
        effectFrameCount: Number(icon?.getData('effectFrameCount') ?? 0),
        at: Math.round(performance.now()),
      };
      this.completeIfCurrent('terminal');
      this.completeStep('cast');
    }
  }

  private tryHitPracticeDummy(hitX: number, hitY: number, direction: 1 | -1): void {
    if (this.dummyHp <= 0) return;
    const swordDistance = Phaser.Math.Distance.Between(hitX, hitY, this.dummy.x, this.dummy.y);
    const bodyDistance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.dummy.x, this.dummy.y);
    if (Math.min(swordDistance, bodyDistance) > 142) {
      this.setTutorialStatus('Closer');
      this.publishDummyRuntime(false);
      return;
    }
    this.dummyHp = Math.max(0, this.dummyHp - 1);
    this.dummyHits += 1;
    this.lastDummyHitAt = this.time.now;
    this.dummy.x += direction * 14;
    this.setDummyPose(this.dummyHp <= 0 ? 'defeat' : 'hurt');
    this.dummy.setTintFill(this.dummyHp <= 0 ? 0xf0c36b : 0xf6ead3);
    this.warning.setVisible(true);
    this.setTutorialMarker(this.warning, 3, this.dummy.x, this.dummy.y + 8, 166, 88, 0.82);
    this.publishTutorialMarkerRuntime('dummy-hit');
    this.time.delayedCall(120, () => {
      if (this.dummyHp > 0) {
        this.dummy.setTint(0xd8b064);
        this.setDummyPose('attack');
        this.setTutorialStatus('Again');
      } else {
        this.dummy.clearTint();
        this.dummy.setAlpha(0.52);
        this.dummyShadow.setAlpha(0.16);
        this.warning.setVisible(false);
        this.setTutorialStatus('Echo breaks');
        this.completeStep('swing');
      }
      this.publishDummyRuntime(true);
    });
    this.publishDummyRuntime(true);
  }

  private completeIfCurrent(trigger: Parameters<typeof completeTutorialTrigger>[1]): void {
    if (getCurrentTutorialStep(this.tutorial)?.trigger === trigger) {
      this.completeStep(trigger);
    }
  }

  private completeStep(trigger: Parameters<typeof completeTutorialTrigger>[1]): void {
    const before = this.tutorial.stepIndex;
    this.tutorial = completeTutorialTrigger(this.tutorial, trigger);
    if (this.tutorial.stepIndex === before) return;
    this.renderStep();
    if (isTutorialComplete(this.tutorial)) {
      this.exitReady = true;
      this.gateGroup.setVisible(true);
      (window as unknown as { __CODEJITSU_TUTORIAL_GATE_OPEN?: boolean }).__CODEJITSU_TUTORIAL_GATE_OPEN = true;
      const gateVisual = (window as Window & {
        __CODEJITSU_TUTORIAL_GATE_VISUAL?: {
          scene: string;
          usesImagegenGate: boolean;
          primitiveGatePieces: number;
          textureKey: string;
          labelVisible: boolean;
          gateVisible: boolean;
          at: number;
        };
      }).__CODEJITSU_TUTORIAL_GATE_VISUAL;
      if (gateVisual) {
        (window as Window & { __CODEJITSU_TUTORIAL_GATE_VISUAL?: typeof gateVisual }).__CODEJITSU_TUTORIAL_GATE_VISUAL = {
          ...gateVisual,
          gateVisible: true,
          at: Math.round(performance.now()),
        };
      }
      this.updateTutorialHintIcon('complete');
      this.setTutorialCopy('Cross seam.', 'Vow answered');
    }
  }

  private renderStep(): void {
    const step = getCurrentTutorialStep(this.tutorial);
    (window as unknown as { __CODEJITSU_TUTORIAL_STEP?: string }).__CODEJITSU_TUTORIAL_STEP = step?.trigger ?? 'complete';
    this.updateTutorialHintIcon(step?.trigger);
    const status = step?.trigger === 'face'
      ? 'Line up before you attack.'
      : step?.trigger === 'swing'
        ? 'Spacing matters more than mashing.'
        : step?.trigger === 'terminal'
          ? 'Slow time, then enter a vow.'
          : step?.trigger === 'cast'
            ? 'try.catch is your first defensive combo.'
            : '';
    this.setTutorialCopy(step?.instructionText ?? 'Tutorial complete.', status);
    this.marker.setVisible(step?.highlightTarget === 'archive-tile' || step?.highlightTarget === 'practice-line');
    this.warning.setVisible(step?.highlightTarget === 'dummy' && this.dummyHp > 0);
    if (step?.highlightTarget === 'archive-tile') {
      this.setTutorialMarker(this.marker, 0, 520, 464, 146, 78, 0.78);
    }
    if (step?.highlightTarget === 'practice-line') {
      this.setTutorialMarker(this.marker, 1, 562, 492, 176, 84, 0.76);
    }
    if (step?.highlightTarget === 'dummy') {
      this.setTutorialMarker(this.warning, 2, this.dummy.x, this.dummy.y + 8, 164, 88, 0.78);
      if (this.dummyHp > 0) this.setDummyPose('attack');
    } else if (this.dummyHp > 0) {
      this.setDummyPose('idle');
    }
    this.publishTutorialMarkerRuntime(step?.highlightTarget ?? 'complete');
    this.publishDummyRuntime();
  }

  private setTutorialCopy(instruction: string, status: string): void {
    this.instruction.setText(instruction);
    this.instruction.setY(this.tutorialPanelBounds.y + TUTORIAL_INSTRUCTION_OFFSET_Y);
    this.status.setText(status);
    this.positionTutorialStatus();
    this.publishTutorialHudLayout();
  }

  private positionTutorialStatus(): void {
    const instructionBounds = this.instruction.getBounds();
    const preferredStatusY = this.tutorialPanelBounds.y + TUTORIAL_STATUS_OFFSET_Y;
    const minStatusY = instructionBounds.bottom + 8;
    const maxStatusY = this.tutorialPanelBounds.bottom - TUTORIAL_STATUS_BOTTOM_MARGIN;
    this.status.setY(Math.min(maxStatusY, Math.max(preferredStatusY, minStatusY)));
  }

  private setTutorialStatus(status: string): void {
    this.status.setText(status);
    this.positionTutorialStatus();
    this.publishTutorialHudLayout();
  }

  private publishTutorialHudLayout(): void {
    const instructionBounds = this.instruction.getBounds();
    const rawStatusBounds = this.status.getBounds();
    const statusBounds = this.status.text.trim().length > 0
      ? rawStatusBounds
      : new Phaser.Geom.Rectangle(this.status.x, this.status.y, 0, 0);
    const panelBottom = this.tutorialPanelBounds.bottom;
    const panel = this.tutorialPanel as (Phaser.GameObjects.GameObject & { getData?: (key: string) => unknown }) | undefined;
    const usesGeneratedPanel = Boolean(panel?.getData?.('usesImagegenHudPanel'));
    const wordCount = `${this.instruction.text} ${this.status.text}`.split(/\s+/).filter(Boolean).length;
    const hintBounds = this.tutorialHintIcon?.getBounds() ?? new Phaser.Geom.Rectangle(this.tutorialPanelBounds.x + 39, this.tutorialPanelBounds.y + 9, 86, 66);
    const usesGeneratedHintStrip = this.tutorialHintIcon?.getData('usesImagegenHintStrip') === true;
    const hintGap = instructionBounds.x - hintBounds.right;
    const hintFits = hintBounds.x >= this.tutorialPanelBounds.x &&
      hintBounds.right <= this.tutorialPanelBounds.right &&
      hintBounds.y >= this.tutorialPanelBounds.y &&
      hintBounds.bottom <= panelBottom - 6;
    const hintNoOverlap = hintGap >= 8;
    (window as unknown as {
      __CODEJITSU_TUTORIAL_PANEL_LAYOUT?: {
        panel: { x: number; y: number; width: number; height: number; bottom: number };
        instruction: { x: number; y: number; width: number; height: number; bottom: number };
        status: { x: number; y: number; width: number; height: number; bottom: number };
        hint: { x: number; y: number; width: number; height: number; bottom: number; right: number };
        gap: number;
        hintGap: number;
        noOverlap: boolean;
        hintNoOverlap: boolean;
        fitsPanel: boolean;
        hintFits: boolean;
        panelAvoidsPlayfield: boolean;
        playfieldGap: number;
        usesImagegenPanel: boolean;
        usesImagegenHintStrip: boolean;
        primitivePanelPieces: number;
        primitiveHintPieces: number;
        compactCopy: boolean;
        quietCopy: boolean;
        hintFrameIndex: number;
        hintTextureKey: string;
        lowerDocked: boolean;
        microDocked: boolean;
        wordCount: number;
        objectiveCopy: string;
        statusCopy: string;
        at: number;
      };
    }).__CODEJITSU_TUTORIAL_PANEL_LAYOUT = {
      panel: {
        x: this.tutorialPanelBounds.x,
        y: this.tutorialPanelBounds.y,
        width: this.tutorialPanelBounds.width,
        height: this.tutorialPanelBounds.height,
        bottom: panelBottom,
      },
      instruction: {
        x: instructionBounds.x,
        y: instructionBounds.y,
        width: instructionBounds.width,
        height: instructionBounds.height,
        bottom: instructionBounds.bottom,
      },
      status: {
        x: statusBounds.x,
        y: statusBounds.y,
        width: statusBounds.width,
        height: statusBounds.height,
        bottom: statusBounds.bottom,
      },
      hint: {
        x: hintBounds.x,
        y: hintBounds.y,
        width: hintBounds.width,
        height: hintBounds.height,
        bottom: hintBounds.bottom,
        right: hintBounds.right,
      },
      gap: Math.round((statusBounds.y - instructionBounds.bottom) * 10) / 10,
      hintGap: Math.round(hintGap * 10) / 10,
      noOverlap: (this.status.text.trim().length === 0 || statusBounds.y >= instructionBounds.bottom + 8) && hintNoOverlap,
      hintNoOverlap,
      panelAvoidsPlayfield: this.tutorialPanelBounds.y >= this.walkableBounds.bottom + 34,
      playfieldGap: Math.round((this.tutorialPanelBounds.y - this.walkableBounds.bottom) * 10) / 10,
      fitsPanel: instructionBounds.x >= this.tutorialPanelBounds.x &&
        statusBounds.x >= this.tutorialPanelBounds.x &&
        instructionBounds.right <= this.tutorialPanelBounds.right &&
        statusBounds.right <= this.tutorialPanelBounds.right &&
        statusBounds.bottom <= panelBottom - 12 &&
        hintFits,
      hintFits,
      usesImagegenPanel: usesGeneratedPanel,
      usesImagegenHintStrip: usesGeneratedHintStrip,
      primitivePanelPieces: usesGeneratedPanel ? 0 : 1,
      primitiveHintPieces: usesGeneratedHintStrip ? 0 : 1,
      compactCopy: wordCount <= 20,
      quietCopy: wordCount <= 16,
      hintFrameIndex: Number(this.tutorialHintIcon?.getData('hintFrameIndex') ?? -1),
      hintTextureKey: usesGeneratedHintStrip ? TextureKeys.TutorialHintStrip : 'fallback-none',
      lowerDocked: this.tutorialPanelBounds.y >= 560 && this.tutorialPanelBounds.height <= 116,
      microDocked: this.tutorialPanelBounds.y >= 580 && this.tutorialPanelBounds.width <= 580 && this.tutorialPanelBounds.height <= 116,
      wordCount,
      objectiveCopy: this.instruction.text,
      statusCopy: this.status.text,
      at: Math.round(performance.now()),
    };
  }

  private publishTutorialFlowRuntime(): void {
    (window as Window & {
      __CODEJITSU_TUTORIAL_FLOW?: {
        stepCount: number;
        controls: string[];
        codeLinesExplained: string[];
        storyIdentity: string;
        hasTerminalSlowTimeStep: boolean;
        hasCombatStep: boolean;
        hasMovementStep: boolean;
        at: number;
      };
    }).__CODEJITSU_TUTORIAL_FLOW = {
      stepCount: 5,
      controls: ['WASD / Arrows', 'X', 'T', 'Enter'],
      codeLinesExplained: [
        'WASD or Arrow Keys: position before danger',
        'X: spacing-based cut',
        'T: slow-time terminal',
        'try.catch: counter oath, guard, heal',
      ],
      storyIdentity: 'Last Archive Runner',
      hasTerminalSlowTimeStep: true,
      hasCombatStep: true,
      hasMovementStep: true,
      at: Math.round(performance.now()),
    };
  }

  private publishTutorialMarkerRuntime(highlightTarget: string): void {
    const markerUsesImagegen = this.marker instanceof Phaser.GameObjects.Image && this.marker.getData('usesImagegenSigil') === true;
    const warningUsesImagegen = this.warning instanceof Phaser.GameObjects.Image && this.warning.getData('usesImagegenSigil') === true;
    (window as Window & {
      __CODEJITSU_TUTORIAL_MARKER_VISUAL?: {
        scene: string;
        usesImagegenSigils: boolean;
        primitiveMarkerPieces: number;
        activeHighlight: string;
        markerVisible: boolean;
        warningVisible: boolean;
        markerFrameIndex: number;
        warningFrameIndex: number;
        frameCount: number;
        markerWidth: number;
        warningWidth: number;
        lowNoise: boolean;
        textureKey: string;
        at: number;
      };
    }).__CODEJITSU_TUTORIAL_MARKER_VISUAL = {
      scene: 'tutorial',
      usesImagegenSigils: markerUsesImagegen && warningUsesImagegen,
      primitiveMarkerPieces: markerUsesImagegen && warningUsesImagegen ? 0 : 2,
      activeHighlight: highlightTarget,
      markerVisible: this.marker.visible,
      warningVisible: this.warning.visible,
      markerFrameIndex: Number(this.marker.getData('sigilFrameIndex') ?? -1),
      warningFrameIndex: Number(this.warning.getData('sigilFrameIndex') ?? -1),
      frameCount: 4,
      markerWidth: Math.round(this.marker.displayWidth),
      warningWidth: Math.round(this.warning.displayWidth),
      lowNoise: this.marker.alpha <= 0.8 && this.warning.alpha <= 0.82 && this.marker.displayWidth <= 180 && this.warning.displayWidth <= 170,
      textureKey: TextureKeys.TutorialSigils,
      at: Math.round(performance.now()),
    };
  }

  private safeSetVelocity(sprite: Phaser.Physics.Arcade.Sprite, x: number, y: number): void {
    guardedSetVelocity('tutorial', sprite, x, y);
  }

  private updateActorShadow(shadow: Phaser.GameObjects.Image, actor: Phaser.GameObjects.Sprite, offsetY: number): void {
    shadow.setPosition(actor.x, actor.y + offsetY);
    shadow.setDepth(actor.y - 8);
  }

  private publishDummyRuntime(hit = false): void {
    (window as Window & {
	      __CODEJITSU_TUTORIAL_DUMMY?: {
	        hp: number;
	        hits: number;
	        hitRegistered: boolean;
        broken: boolean;
	        soloPractice: boolean;
	        mentorVisible: boolean;
	        mentorHitboxSmall: boolean;
        playerFacingDummy: boolean;
        labelVisible: boolean;
        renderVariant?: string;
        pose?: string;
        spectralEcho: boolean;
        targetObject: boolean;
        alpha: number;
        displayWidth: number;
        displayHeight: number;
        sourceWidth: number;
        sourceHeight: number;
        distinctFromPlayer: boolean;
        at: number;
      };
    }).__CODEJITSU_TUTORIAL_DUMMY = {
      hp: this.dummyHp,
      hits: this.dummyHits,
      hitRegistered: hit || this.time.now - this.lastDummyHitAt < 900,
      broken: this.dummyHp <= 0,
      soloPractice: this.soloPractice,
      mentorVisible: this.mentor.visible && this.mentor.alpha > 0.05,
      mentorHitboxSmall: !this.mentor.body?.enable || Boolean(this.mentor.body.width <= 22 && this.mentor.body.height <= 20),
      playerFacingDummy: this.player.flipX === (this.player.x > this.dummy.x),
      labelVisible: false,
      renderVariant: this.dummy.getData('actorRenderVariant') as string | undefined,
      pose: this.dummy.getData('actorPose') as string | undefined,
      spectralEcho: this.dummy.getData('spectralEcho') === true,
      targetObject: this.dummy.getData('targetObject') === true,
      alpha: Math.round(this.dummy.alpha * 100) / 100,
      displayWidth: Math.round(this.dummy.displayWidth),
      displayHeight: Math.round(this.dummy.displayHeight),
      sourceWidth: Number(this.textures.get(this.tutorialTargetTextureKey())?.getSourceImage()?.width ?? 0),
      sourceHeight: Number(this.textures.get(this.tutorialTargetTextureKey())?.getSourceImage()?.height ?? 0),
      distinctFromPlayer: this.dummy.getData('actorKind') !== 'hero' &&
        this.dummy.getData('targetObject') === true &&
        this.dummy.getData('actorRenderVariant') === 'imagegen-vow-target' &&
        this.dummy.displayHeight < 150,
      at: Math.round(performance.now()),
    };
  }

  private tutorialTargetTextureKey(): string {
    return this.textures.exists(TextureKeys.TutorialVowTarget)
      ? TextureKeys.TutorialVowTarget
      : TextureKeys.ArchivePracticeEcho;
  }
}
