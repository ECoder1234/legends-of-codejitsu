import Phaser from 'phaser';
import { chapterTwoDialogue } from '../data/dialogue';
import { loadSave, unlockAbility, writeSave } from '../systems/saveSystem';
import type { DialogueNode } from '../types/game';
import { addActorImage, addPortraitImage, setActorPose, type ActorKind } from './actors';
import { installAudioUnlock } from './audioUnlock';
import { addGeneratedTelegraphSigil } from './combatTelegraphs';
import { publishTextPanelAudit } from './layoutAudit';
import { publishFrameHealth } from './runtimeDebug';
import { SceneKeys, TextureKeys } from './sceneKeys';
import { fadeInFromBlack, fadeToScene } from './transition';
import { addPanel, makePixelText } from './ui';

function portraitKind(node: DialogueNode): ActorKind {
  if (node.portrait === 'mentor') return 'mentor';
  if (node.portrait === 'return-oni') return 'returnOni';
  return 'hero';
}

const CHAPTER2_DIALOGUE_PANEL_BOUNDS = new Phaser.Geom.Rectangle(190, 455, 900, 258);
const CHAPTER2_DIALOGUE_PANEL_CROP = {
  x: 0,
  y: 60,
  width: 1849,
  height: 530,
};
const CHAPTER2_DIALOGUE_PANEL_DISPLAY = new Phaser.Geom.Rectangle(190, 455, 900, 258);
const CHAPTER2_DIALOGUE_PANEL_FRAME = 'chapter2-dialogue-panel-framed-crop';
const CHAPTER2_DIALOGUE_PORTRAIT_SAFE = {
  x: 326,
  y: 596,
  width: 136,
  height: 136,
};
const CHAPTER2_DIALOGUE_TEXT_SAFE = {
  speakerX: 500,
  speakerY: 536,
  bodyX: 500,
  bodyY: 562,
  bodyWrapWidth: 410,
  bodyFontSize: 15,
  speakerFontSize: 17,
  skipX: 970,
  advanceX: 1036,
  promptY: 666,
};

function addDialogueTextPrompt(
  scene: Phaser.Scene,
  label: string,
  x: number,
  y: number,
  onActivate?: (pointer: Phaser.Input.Pointer, event: Phaser.Types.Input.EventData) => void,
): Phaser.GameObjects.Text {
  const prompt = makePixelText(scene, x, y, label, 13, '#f0c36b', 'center')
    .setOrigin(0.5)
    .setDepth(2001)
    .setAlpha(0.9)
    .setStroke('#09070d', 5)
    .setData('visibleTextPrompt', true)
    .setData('usesImagePrompt', false);
  if (onActivate) {
    prompt.setInteractive({ useHandCursor: true });
    prompt.on('pointerdown', (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      onActivate(pointer, event);
    });
    const domButton = document.createElement('button');
    domButton.type = 'button';
    domButton.setAttribute('aria-label', `${label} dialogue`);
    domButton.style.position = 'fixed';
    domButton.style.padding = '0';
    domButton.style.margin = '0';
    domButton.style.border = '0';
    domButton.style.background = 'transparent';
    domButton.style.color = 'transparent';
    domButton.style.cursor = 'pointer';
    domButton.style.zIndex = '30';
    domButton.style.pointerEvents = 'auto';
    domButton.style.appearance = 'none';
    const positionDomButton = () => {
      const rect = scene.game.canvas.getBoundingClientRect();
      const scaleX = rect.width / Math.max(1, scene.scale.width);
      const scaleY = rect.height / Math.max(1, scene.scale.height);
      domButton.style.left = `${rect.left + (x - 28) * scaleX}px`;
      domButton.style.top = `${rect.top + (y - 15) * scaleY}px`;
      domButton.style.width = `${56 * scaleX}px`;
      domButton.style.height = `${30 * scaleY}px`;
    };
    positionDomButton();
    window.addEventListener('resize', positionDomButton);
    domButton.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onActivate(scene.input.activePointer, { stopPropagation: () => undefined } as Phaser.Types.Input.EventData);
    });
    document.body.appendChild(domButton);
    prompt.once(Phaser.GameObjects.Events.DESTROY, () => {
      window.removeEventListener('resize', positionDomButton);
      domButton.remove();
    });
  }
  scene.tweens.add({
    targets: prompt,
    alpha: { from: 0.72, to: 1 },
    duration: 760,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.InOut',
  });
  return prompt;
}

function ensureChapter2DialoguePanelFrame(scene: Phaser.Scene): string {
  const texture = scene.textures.get(TextureKeys.DialoguePanel) as Phaser.Textures.Texture & {
    frames: Record<string, Phaser.Textures.Frame>;
  };
  if (!texture.frames[CHAPTER2_DIALOGUE_PANEL_FRAME]) {
    texture.add(
      CHAPTER2_DIALOGUE_PANEL_FRAME,
      0,
      CHAPTER2_DIALOGUE_PANEL_CROP.x,
      CHAPTER2_DIALOGUE_PANEL_CROP.y,
      CHAPTER2_DIALOGUE_PANEL_CROP.width,
      CHAPTER2_DIALOGUE_PANEL_CROP.height,
    );
  }
  return CHAPTER2_DIALOGUE_PANEL_FRAME;
}

export class Chapter2StoryScene extends Phaser.Scene {
  private index = 0;
  private canAdvanceAt = 0;
  private bodyText?: Phaser.GameObjects.Text;
  private speakerText?: Phaser.GameObjects.Text;
  private enterPrompt?: Phaser.GameObjects.Text;
  private skipPrompt?: Phaser.GameObjects.Text;
  private fullText = '';
  private revealedText = '';
  private typewriter?: Phaser.Time.TimerEvent;
  private hero?: Phaser.GameObjects.Image;
  private mentor?: Phaser.GameObjects.Image;
  private returnOni?: Phaser.GameObjects.Image;
  private returnAura?: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse;
  private returnMask?: Phaser.GameObjects.Image;
  private stolenCinematic?: Phaser.GameObjects.Image;
  private mentorShadow?: Phaser.GameObjects.Image;
  private returnShadow?: Phaser.GameObjects.Image;
  private dialogueObjects: Phaser.GameObjects.GameObject[] = [];
  private chainGraphics?: Phaser.GameObjects.Graphics;
  private meditationGlyphs: Phaser.GameObjects.GameObject[] = [];
  private loopVowUnlocked = false;
  private skipping = false;
  private stagedActorsHiddenForCinematic = false;

  constructor() {
    super(SceneKeys.Chapter2Story);
  }

  create(): void {
    (window as unknown as { __CODEJITSU_SCENE?: string }).__CODEJITSU_SCENE = 'chapter2-story';
    installAudioUnlock(this);
    writeSave({ ...loadSave(), currentCheckpoint: 'chapter2-story' });
    this.index = 0;
    this.loopVowUnlocked = false;
    this.skipping = false;
    this.stagedActorsHiddenForCinematic = false;
    this.drawStage();
    fadeInFromBlack(this);
    this.showNode();
    this.input.keyboard?.on('keydown-ENTER', () => this.advance());
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());
    this.input.on('pointerdown', () => this.advance());
  }

  update(_time: number, delta: number): void {
    publishFrameHealth('chapter2-story', delta);
    if (this.returnOni) setActorPose(this.returnOni, 'talk');
    if (this.mentor && this.index >= 3) setActorPose(this.mentor, 'hurt');
  }

  private drawStage(): void {
    this.cameras.main.setBackgroundColor('#09070d');
    if (this.textures.exists(TextureKeys.Chapter2OutdoorTrail)) {
      this.add.image(640, 360, TextureKeys.Chapter2OutdoorTrail).setDisplaySize(1280, 720).setDepth(-30);
      this.add.rectangle(640, 360, 1280, 720, 0x08060c, 0.2).setDepth(-29);
    }
    if (this.textures.exists(TextureKeys.Chapter2StolenCinematic)) {
      this.stolenCinematic = this.add.image(640, 360, TextureKeys.Chapter2StolenCinematic)
        .setDisplaySize(1280, 720)
        .setDepth(-24)
        .setAlpha(0);
    }

    this.hero = addActorImage(this, 'hero', 354, 490, TextureKeys.Hero, 1.88).setDepth(500);
    this.mentor = addActorImage(this, 'mentor', 626, 410, TextureKeys.Mentor, 1.65).setDepth(420);
    this.returnOni = addActorImage(this, 'returnOni', 950, 384, TextureKeys.ReturnOniSheet, 1.44).setDepth(394).setFlipX(true);
    this.returnAura = this.createReturnAura(this.returnOni.x, this.returnOni.y - 30);
    this.returnMask = addPortraitImage(this, 'returnOni', this.returnOni.x, this.returnOni.y - 30, TextureKeys.ReturnOniSheet)
      .setDepth(509)
      .setAlpha(0)
      .setScale(0.78);
    this.mentorShadow = this.add.image(this.mentor.x, this.mentor.y + 32, TextureKeys.Shadow).setDisplaySize(112, 42).setAlpha(0.42).setDepth(this.mentor.y - 8);
    this.returnShadow = this.add.image(this.returnOni.x, this.returnOni.y + 42, TextureKeys.Shadow).setDisplaySize(150, 50).setAlpha(0.44).setDepth(this.returnOni.y - 8);
    this.hero.setFlipX(false);
    this.mentor.setFlipX(true);
    setActorPose(this.hero, 'idle');
    setActorPose(this.mentor, 'talk');
    setActorPose(this.returnOni, 'idle');

    makePixelText(this, 640, 54, 'The Looping Brother', 32, '#f0c36b', 'center')
      .setOrigin(0.5)
      .setStroke('#09070d', 7)
      .setDepth(900);
    this.publishStoryVisualRuntime();
  }

  private createReturnAura(x: number, y: number): Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse {
    if (this.textures.exists(TextureKeys.BossOrbitAura)) {
      const aura = this.add.image(x, y, TextureKeys.BossOrbitAura)
        .setDisplaySize(196, 236)
        .setAlpha(0)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(506);
      aura.setData('usesImagegenAura', true);
      return aura;
    }
    return this.add.ellipse(x, y, 152, 204, 0x2c1436, 0)
      .setStrokeStyle(5, 0xb85dff, 0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(506);
  }

  private showNode(): void {
    const node = chapterTwoDialogue[this.index];
    if (!node) {
      fadeToScene(this, SceneKeys.Chapter2Trail);
      return;
    }
    this.canAdvanceAt = this.time.now + (this.isFastDialogue() ? 90 : 520);
    this.renderDialogue(node);
    this.stageMotion(node.id);
  }

  private isFastDialogue(): boolean {
    return new URLSearchParams(window.location.search).has('e2e');
  }

  private renderDialogue(node: DialogueNode): void {
    this.typewriter?.remove(false);
    this.dialogueObjects.forEach((object) => object.destroy());
    this.dialogueObjects = [];

    let primitivePanelPieces = 0;
    const panel = this.createDialoguePanel();
    if (!panel.getData('usesImagegenPanel')) primitivePanelPieces = 1;
    const kind = portraitKind(node);
    const portraitShadow = this.add.ellipse(CHAPTER2_DIALOGUE_PORTRAIT_SAFE.x, CHAPTER2_DIALOGUE_PORTRAIT_SAFE.y + 48, 104, 28, 0x08060c, 0.26)
      .setDepth(2001);
    const portraitGlow = this.add.ellipse(CHAPTER2_DIALOGUE_PORTRAIT_SAFE.x, CHAPTER2_DIALOGUE_PORTRAIT_SAFE.y, 92, 98, kind === 'returnOni' ? 0xb85dff : 0xf0c36b, 0.1)
      .setDepth(2001);
    const portrait = addPortraitImage(this, kind, CHAPTER2_DIALOGUE_PORTRAIT_SAFE.x, CHAPTER2_DIALOGUE_PORTRAIT_SAFE.y, TextureKeys.NullOni)
      .setDepth(2002)
      .setDisplaySize(CHAPTER2_DIALOGUE_PORTRAIT_SAFE.width, CHAPTER2_DIALOGUE_PORTRAIT_SAFE.height);
    this.speakerText = makePixelText(this, CHAPTER2_DIALOGUE_TEXT_SAFE.speakerX, CHAPTER2_DIALOGUE_TEXT_SAFE.speakerY, node.speaker, CHAPTER2_DIALOGUE_TEXT_SAFE.speakerFontSize, '#f0c36b')
      .setDepth(2001)
      .setOrigin(0, 0.5);
    this.bodyText = makePixelText(this, CHAPTER2_DIALOGUE_TEXT_SAFE.bodyX, CHAPTER2_DIALOGUE_TEXT_SAFE.bodyY, '', CHAPTER2_DIALOGUE_TEXT_SAFE.bodyFontSize, '#f6ead3')
      .setDepth(2001)
      .setOrigin(0, 0)
      .setWordWrapWidth(CHAPTER2_DIALOGUE_TEXT_SAFE.bodyWrapWidth)
      .setLineSpacing(4);
    this.enterPrompt = addDialogueTextPrompt(this, 'Enter', CHAPTER2_DIALOGUE_TEXT_SAFE.advanceX, CHAPTER2_DIALOGUE_TEXT_SAFE.promptY);
    this.skipPrompt = addDialogueTextPrompt(this, 'Skip', CHAPTER2_DIALOGUE_TEXT_SAFE.skipX, CHAPTER2_DIALOGUE_TEXT_SAFE.promptY, () => {
      this.skipToTrail();
    });
    this.publishTextPromptRuntime();
    this.dialogueObjects = [
      panel,
      portraitShadow,
      portraitGlow,
      portrait,
      this.speakerText,
      this.bodyText,
      ...(this.enterPrompt ? [this.enterPrompt] : []),
      ...(this.skipPrompt ? [this.skipPrompt] : []),
    ];
    (window as Window & {
      __CODEJITSU_DIALOGUE_LAYOUT?: {
        usesImagegenPanel: boolean;
        primitivePanelPieces: number;
        usesIntegratedPortraitSocket: boolean;
        portraitX: number;
        portraitY: number;
        portraitInsidePanel: boolean;
        bodyX: number;
        bodyY: number;
        panelCenterX: number;
        panel: { x: number; y: number; width: number; height: number; bottom: number };
        panelAspectLocked?: boolean;
        noOverlap?: boolean;
        noOverflow?: boolean;
        bodyWrapWidth?: number;
        portraitDisplayWidth?: number;
        portraitDisplayHeight?: number;
        portraitAspectLocked?: boolean;
        portraitClearOfText?: boolean;
        textLayout: 'portrait-left';
      };
    }).__CODEJITSU_DIALOGUE_LAYOUT = {
      usesImagegenPanel: Boolean(panel.getData('usesImagegenPanel')),
      primitivePanelPieces,
      usesIntegratedPortraitSocket: Boolean(panel.getData('usesImagegenPanel')),
      portraitX: CHAPTER2_DIALOGUE_PORTRAIT_SAFE.x,
      portraitY: CHAPTER2_DIALOGUE_PORTRAIT_SAFE.y,
      portraitInsidePanel: true,
      bodyX: CHAPTER2_DIALOGUE_TEXT_SAFE.bodyX,
      bodyY: CHAPTER2_DIALOGUE_TEXT_SAFE.bodyY,
      panelCenterX: CHAPTER2_DIALOGUE_PANEL_DISPLAY.centerX,
      panel: {
        x: CHAPTER2_DIALOGUE_PANEL_DISPLAY.x,
        y: CHAPTER2_DIALOGUE_PANEL_DISPLAY.y,
        width: CHAPTER2_DIALOGUE_PANEL_DISPLAY.width,
        height: CHAPTER2_DIALOGUE_PANEL_DISPLAY.height,
        bottom: CHAPTER2_DIALOGUE_PANEL_DISPLAY.bottom,
      },
      panelAspectLocked: Math.abs((CHAPTER2_DIALOGUE_PANEL_DISPLAY.width / CHAPTER2_DIALOGUE_PANEL_DISPLAY.height) - (CHAPTER2_DIALOGUE_PANEL_CROP.width / CHAPTER2_DIALOGUE_PANEL_CROP.height)) < 0.02,
      bodyWrapWidth: CHAPTER2_DIALOGUE_TEXT_SAFE.bodyWrapWidth,
      portraitDisplayWidth: CHAPTER2_DIALOGUE_PORTRAIT_SAFE.width,
      portraitDisplayHeight: CHAPTER2_DIALOGUE_PORTRAIT_SAFE.height,
      portraitAspectLocked: CHAPTER2_DIALOGUE_PORTRAIT_SAFE.width === CHAPTER2_DIALOGUE_PORTRAIT_SAFE.height,
      portraitClearOfText: CHAPTER2_DIALOGUE_PORTRAIT_SAFE.x + CHAPTER2_DIALOGUE_PORTRAIT_SAFE.width / 2 <= CHAPTER2_DIALOGUE_TEXT_SAFE.bodyX - 96,
      textLayout: 'portrait-left',
    };
    (window as Window & {
      __CODEJITSU_DIALOGUE_SKIP?: {
      visible: boolean;
      clicked: boolean;
      scene: string;
      at: number;
      };
    }).__CODEJITSU_DIALOGUE_SKIP = {
      visible: Boolean(this.skipPrompt?.visible),
      clicked: false,
      scene: 'chapter2-story',
      at: Math.round(performance.now()),
    };

    this.fullText = node.text;
    this.revealedText = '';
    this.typewriter = this.time.addEvent({
      delay: this.isFastDialogue() ? 5 : 18,
      repeat: node.text.length,
      callback: () => {
        this.revealedText = node.text.slice(0, this.revealedText.length + 1);
        this.bodyText?.setText(this.revealedText);
        this.publishRuntime(node);
      },
    });
    this.publishRuntime(node);
  }

  private createDialoguePanel(): Phaser.GameObjects.GameObject {
    if (this.textures.exists(TextureKeys.DialoguePanel)) {
      const panel = this.add.image(
        CHAPTER2_DIALOGUE_PANEL_DISPLAY.centerX,
        CHAPTER2_DIALOGUE_PANEL_DISPLAY.centerY,
        TextureKeys.DialoguePanel,
        ensureChapter2DialoguePanelFrame(this),
      )
        .setDisplaySize(CHAPTER2_DIALOGUE_PANEL_DISPLAY.width, CHAPTER2_DIALOGUE_PANEL_DISPLAY.height)
        .setDepth(2000)
        .setAlpha(0.96);
      panel.setData('usesImagegenPanel', true);
      return panel;
    }
    const fallback = addPanel(
      this,
      CHAPTER2_DIALOGUE_PANEL_BOUNDS.x,
      CHAPTER2_DIALOGUE_PANEL_BOUNDS.y,
      CHAPTER2_DIALOGUE_PANEL_BOUNDS.width,
      CHAPTER2_DIALOGUE_PANEL_BOUNDS.height,
      0.88,
    ).setDepth(2000);
    fallback.setData('usesImagegenPanel', false);
    return fallback;
  }

  private stageMotion(id: string): void {
    if (!this.hero || !this.mentor || !this.returnOni) return;
    if (id === 'chapter2-return-oni') {
      this.showStolenCinematic('return-oni-arrives');
      setActorPose(this.returnOni, 'attack');
      this.chainGraphics?.clear();
    }
    if (id === 'chapter2-keiko-taken') {
      this.showStolenCinematic('keiko-stolen');
      setActorPose(this.mentor, 'hurt');
      this.chainGraphics?.clear();
      this.hideStagedActorsForCinematic();
      this.publishStoryVisualRuntime();
    }
    if (id === 'chapter2-runner-chases') {
      setActorPose(this.hero, 'walk');
      this.tweens.add({
        targets: this.hero,
        x: 522,
        y: 478,
        duration: 460,
        ease: 'Sine.InOut',
        onComplete: () => this.hero && setActorPose(this.hero, 'idle'),
      });
    }
    if (id === 'chapter2-keiko-vow') {
      setActorPose(this.hero, 'idle');
      this.drawMeditationGlyphs(false);
    }
    if (id === 'chapter2-meditation') {
      setActorPose(this.hero, 'stagger');
      this.drawMeditationGlyphs(true);
      this.learnLoopVow();
    }
    if (id === 'chapter2-apprentice-alone') {
      setActorPose(this.hero, 'walk');
      this.tweens.add({
        targets: this.hero,
        x: 500,
        y: 470,
        duration: 520,
        ease: 'Sine.InOut',
        onComplete: () => this.hero && setActorPose(this.hero, 'idle'),
      });
      this.tweens.add({
        targets: [this.mentor, this.mentorShadow],
        alpha: 0,
        duration: 420,
      });
      this.chainGraphics?.clear();
    }
  }

  private showStolenCinematic(reason: string): void {
    if (!this.stolenCinematic) return;
    this.tweens.killTweensOf(this.stolenCinematic);
    this.tweens.add({
      targets: this.stolenCinematic,
      alpha: reason === 'keiko-stolen' ? 0.96 : 0.78,
      duration: 320,
      ease: 'Sine.InOut',
    });
    this.hideStagedActorsForCinematic();
    if (reason === 'keiko-stolen') {
      this.addAbductionGlyphStorm();
    }
    (window as Window & {
      __CODEJITSU_STOLEN_CINEMATIC?: {
        usesImagegenAsset: boolean;
        textureKey: string;
        reason: string;
        alpha: number;
        at: number;
      };
    }).__CODEJITSU_STOLEN_CINEMATIC = {
      usesImagegenAsset: true,
      textureKey: TextureKeys.Chapter2StolenCinematic,
      reason,
      alpha: reason === 'keiko-stolen' ? 0.96 : 0.78,
      at: Math.round(performance.now()),
    };
    this.publishStoryVisualRuntime();
  }

  private hideStagedActorsForCinematic(): void {
    this.tweens.killTweensOf([this.hero, this.mentor, this.returnOni, this.mentorShadow, this.returnShadow, this.returnAura, this.returnMask]);
    [this.hero, this.mentor, this.returnOni, this.mentorShadow, this.returnShadow, this.returnAura, this.returnMask]
      .filter(Boolean)
      .forEach((object) => object?.setAlpha(0));
    this.chainGraphics?.clear();
    this.stagedActorsHiddenForCinematic = true;
  }

  private addAbductionGlyphStorm(): void {
    const positions = [
      { x: 330, y: 152, kind: 'cage' as const, tint: 0xb85dff },
      { x: 520, y: 196, kind: 'pursuit' as const, tint: 0xf0c36b },
      { x: 734, y: 150, kind: 'burst' as const, tint: 0xbda3ff },
      { x: 942, y: 196, kind: 'palm' as const, tint: 0xf0c36b },
    ];
    positions.forEach((entry, index) => {
      const sigil = addGeneratedTelegraphSigil(this, 'chapter2-story', entry.kind, entry.x, entry.y, {
        width: entry.kind === 'cage' ? 132 : 116,
        height: entry.kind === 'cage' ? 132 : 116,
        depth: 1500,
        alpha: 0.76,
        tint: entry.tint,
      });
      if (!sigil) return;
      sigil.setAlpha(0);
      sigil.setData('chapter2StoryGlyph', true);
      this.tweens.add({
        targets: sigil,
        alpha: { from: 0, to: 0.82 },
        y: sigil.y - 28,
        delay: index * 80,
        duration: 760,
        ease: 'Quad.Out',
        onComplete: () => sigil.destroy(),
      });
    });
    this.publishStoryVisualRuntime();
  }

  private drawChainBetween(from: Phaser.GameObjects.Image, to: Phaser.GameObjects.Image, alpha: number): void {
    this.chainGraphics?.destroy();
    this.chainGraphics = this.add.graphics().setDepth(880);
    this.chainGraphics.lineStyle(4, 0xb85dff, alpha);
    this.chainGraphics.beginPath();
    this.chainGraphics.moveTo(from.x - 24, from.y - 74);
    this.chainGraphics.lineTo(to.x + 20, to.y - 48);
    this.chainGraphics.strokePath();
    this.chainGraphics.lineStyle(2, 0xf0c36b, alpha * 0.72);
    for (let index = 0; index < 6; index += 1) {
      const t = index / 5;
      this.chainGraphics.strokeCircle(
        Phaser.Math.Linear(from.x - 24, to.x + 20, t),
        Phaser.Math.Linear(from.y - 74, to.y - 48, t),
        8,
      );
    }
  }

  private drawMeditationGlyphs(active: boolean): void {
    this.meditationGlyphs.forEach((object) => object.destroy());
    this.meditationGlyphs = [];
    if (!this.hero) return;
    const baseY = this.hero.y + 30;
    const glowY = active ? this.hero.y - 46 : baseY;
    const textY = active ? this.hero.y - 70 : baseY - 12;
    const glow = this.add.ellipse(this.hero.x, glowY, active ? 210 : 138, active ? 82 : 52, active ? 0x90d2b7 : 0xb85dff, active ? 0.22 : 0.12)
      .setDepth(this.hero.y + 18);
    const vow = makePixelText(this, this.hero.x, textY, active ? 'loop.strike' : 'listen()', active ? 22 : 16, active ? '#90d2b7' : '#bda3ff', 'center')
      .setOrigin(0.5)
      .setDepth(this.hero.y + 20);
    this.meditationGlyphs.push(glow, vow);
    this.tweens.add({
      targets: this.meditationGlyphs,
      alpha: active ? 0.74 : 0.42,
      scaleX: 1.12,
      scaleY: 1.12,
      duration: 620,
      yoyo: true,
      repeat: active ? -1 : 1,
      ease: 'Sine.InOut',
    });
  }

  private publishStoryVisualRuntime(): void {
    (window as Window & {
      __CODEJITSU_CHAPTER2_STORY_VISUALS?: {
        scene: string;
        usesImagegenAura: boolean;
        primitiveGateSigils: number;
        textGlyphOverlays: number;
        generatedGlyphStorm: boolean;
        stagedActorsHiddenForCinematic: boolean;
        at: number;
      };
    }).__CODEJITSU_CHAPTER2_STORY_VISUALS = {
      scene: 'chapter2-story',
      usesImagegenAura: Boolean(this.returnAura?.getData('usesImagegenAura')),
      primitiveGateSigils: 0,
      textGlyphOverlays: 0,
      generatedGlyphStorm: true,
      stagedActorsHiddenForCinematic: this.stagedActorsHiddenForCinematic,
      at: Math.round(performance.now()),
    };
  }

  private publishTextPromptRuntime(): void {
    (window as Window & {
      __CODEJITSU_ADVANCE_PROMPT_SEAL?: {
        scene: string;
        kind: 'advance';
        usesImagegenPromptSeal: boolean;
        visibleTextPrompt: boolean;
        textureKey: string;
        frameIndex: number;
        at: number;
      };
      __CODEJITSU_SKIP_PROMPT_SEAL?: {
        scene: string;
        usesImagegenSkipSeal: boolean;
        visibleTextPrompt: boolean;
        textureKey: string;
        frameIndex: number;
        visible: boolean;
        clicked: boolean;
        at: number;
      };
    }).__CODEJITSU_ADVANCE_PROMPT_SEAL = {
      scene: 'chapter2-story',
      kind: 'advance',
      usesImagegenPromptSeal: false,
      visibleTextPrompt: true,
      textureKey: 'text-prompt',
      frameIndex: -1,
      at: Math.round(performance.now()),
    };
    (window as Window & {
      __CODEJITSU_SKIP_PROMPT_SEAL?: {
        scene: string;
        usesImagegenSkipSeal: boolean;
        visibleTextPrompt: boolean;
        textureKey: string;
        frameIndex: number;
        visible: boolean;
        clicked: boolean;
        at: number;
      };
    }).__CODEJITSU_SKIP_PROMPT_SEAL = {
      scene: 'chapter2-story',
      usesImagegenSkipSeal: false,
      visibleTextPrompt: true,
      textureKey: 'text-prompt',
      frameIndex: -1,
      visible: Boolean(this.skipPrompt?.visible),
      clicked: false,
      at: Math.round(performance.now()),
    };
  }

  private learnLoopVow(): void {
    if (this.loopVowUnlocked) return;
    this.loopVowUnlocked = true;
    writeSave({
      ...unlockAbility(loadSave(), 'loop-strike'),
      currentCheckpoint: 'chapter2-story',
    });
    (window as Window & {
      __CODEJITSU_CHAPTER2_VOW?: {
        abilityId: string;
        learnedByMeditation: boolean;
        at: number;
      };
    }).__CODEJITSU_CHAPTER2_VOW = {
      abilityId: 'loop-strike',
      learnedByMeditation: true,
      at: Math.round(performance.now()),
    };
  }

  private advance(): void {
    if (this.skipping) return;
    if (this.time.now < this.canAdvanceAt) return;
    if (this.revealedText.length < this.fullText.length) {
      this.typewriter?.remove(false);
      this.revealedText = this.fullText;
      this.bodyText?.setText(this.fullText);
      this.canAdvanceAt = this.time.now + 90;
      return;
    }
    this.index += 1;
    if (this.index >= chapterTwoDialogue.length) {
      fadeToScene(this, SceneKeys.Chapter2Trail);
      return;
    }
    this.showNode();
  }

  private skipToTrail(): void {
    if (this.skipping) return;
    this.skipping = true;
    this.learnLoopVow();
    (window as Window & {
      __CODEJITSU_DIALOGUE_SKIP?: {
        visible: boolean;
        clicked: boolean;
        scene: string;
        at: number;
      };
    }).__CODEJITSU_DIALOGUE_SKIP = {
      visible: true,
      clicked: true,
      scene: 'chapter2-story',
      at: Math.round(performance.now()),
    };
    fadeToScene(this, SceneKeys.Chapter2Trail);
  }

  private publishRuntime(node: DialogueNode): void {
    (window as Window & {
      __CODEJITSU_DIALOGUE_SPEAKER?: string;
      __CODEJITSU_DIALOGUE_TEXT?: string;
      __CODEJITSU_DIALOGUE_REVEALED?: string;
      __CODEJITSU_DIALOGUE_TYPING?: boolean;
    }).__CODEJITSU_DIALOGUE_SPEAKER = node.speaker;
    (window as Window & { __CODEJITSU_DIALOGUE_TEXT?: string }).__CODEJITSU_DIALOGUE_TEXT = node.text;
    (window as Window & { __CODEJITSU_DIALOGUE_REVEALED?: string }).__CODEJITSU_DIALOGUE_REVEALED = this.revealedText;
    (window as Window & { __CODEJITSU_DIALOGUE_TYPING?: boolean }).__CODEJITSU_DIALOGUE_TYPING = this.revealedText.length < node.text.length;
    if (this.speakerText && this.bodyText && this.enterPrompt) {
      publishTextPanelAudit('chapter2-dialogue', CHAPTER2_DIALOGUE_PANEL_BOUNDS, [
        { id: 'speaker', object: this.speakerText },
        { id: 'body', object: this.bodyText },
        { id: 'advance-seal', object: this.enterPrompt },
        ...(this.skipPrompt ? [{ id: 'skip-seal', object: this.skipPrompt }] : []),
      ], 14);
      const runtime = window as Window & {
        __CODEJITSU_LAYOUT_AUDITS?: Record<string, { noOverflow: boolean; noOverlap: boolean }>;
        __CODEJITSU_DIALOGUE_LAYOUT?: {
          noOverflow?: boolean;
          noOverlap?: boolean;
        };
      };
      const audit = runtime.__CODEJITSU_LAYOUT_AUDITS?.['chapter2-dialogue'];
      if (runtime.__CODEJITSU_DIALOGUE_LAYOUT && audit) {
        runtime.__CODEJITSU_DIALOGUE_LAYOUT.noOverflow = audit.noOverflow;
        runtime.__CODEJITSU_DIALOGUE_LAYOUT.noOverlap = audit.noOverlap;
      }
    }
  }
}
