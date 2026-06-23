import Phaser from 'phaser';
import type { DialogueNode } from '../types/game';
import { addActorImage, addPortraitImage, setActorPose, type ActorKind } from './actors';
import { publishTextPanelAudit } from './layoutAudit';
import { TextureKeys } from './sceneKeys';
import { addPanel, makePixelText, playTalk } from './ui';

const DIALOGUE_PANEL_BOUNDS = new Phaser.Geom.Rectangle(190, 455, 900, 258);
const DIALOGUE_PANEL_CROP = {
  x: 0,
  y: 60,
  width: 1849,
  height: 530,
};
const DIALOGUE_PANEL_DISPLAY = new Phaser.Geom.Rectangle(190, 455, 900, 258);
const DIALOGUE_PANEL_FRAME = 'dialogue-panel-framed-crop';
const DIALOGUE_PORTRAIT_SAFE = {
  x: 326,
  y: 596,
  width: 136,
  height: 136,
};
const DIALOGUE_TEXT_SAFE = {
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

const portraitFallbacks: Record<ActorKind, string> = {
  hero: TextureKeys.Hero,
  mentor: TextureKeys.Mentor,
  sentinel: TextureKeys.NullOni,
  oni: TextureKeys.NullOni,
  returnOni: TextureKeys.NullOni,
};

function portraitKind(node: DialogueNode): ActorKind {
  if (node.portrait === 'mentor') return 'mentor';
  if (node.portrait === 'oni') return 'oni';
  if (node.portrait === 'return-oni') return 'returnOni';
  if (node.portrait === 'sentinel') return 'sentinel';
  return 'hero';
}

function ensureDialoguePanelFrame(scene: Phaser.Scene): string {
  const texture = scene.textures.get(TextureKeys.DialoguePanel) as Phaser.Textures.Texture & {
    frames: Record<string, Phaser.Textures.Frame>;
  };
  if (!texture.frames[DIALOGUE_PANEL_FRAME]) {
    texture.add(
      DIALOGUE_PANEL_FRAME,
      0,
      DIALOGUE_PANEL_CROP.x,
      DIALOGUE_PANEL_CROP.y,
      DIALOGUE_PANEL_CROP.width,
      DIALOGUE_PANEL_CROP.height,
    );
  }
  return DIALOGUE_PANEL_FRAME;
}

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

export class DialogueSceneController {
  private actorLayer: Phaser.GameObjects.Group;
  private uiLayer: Phaser.GameObjects.Group;
  private hero?: Phaser.GameObjects.Image;
  private mentor?: Phaser.GameObjects.Image;
  private oni?: Phaser.GameObjects.Image;
  private archiveEchoes: Phaser.GameObjects.Image[] = [];
  private heroShadow?: Phaser.GameObjects.Ellipse;
  private mentorShadow?: Phaser.GameObjects.Ellipse;
  private oniShadow?: Phaser.GameObjects.Ellipse;
  private archiveEchoShadows: Phaser.GameObjects.Ellipse[] = [];
  private bodyText?: Phaser.GameObjects.Text;
  private speakerText?: Phaser.GameObjects.Text;
  private enterPrompt?: Phaser.GameObjects.Text;
  private skipPrompt?: Phaser.GameObjects.Text;
  private speakerGlow?: Phaser.GameObjects.Ellipse;
  private dialoguePanel?: Phaser.GameObjects.GameObject;
  private typewriter?: Phaser.Time.TimerEvent;
  private revealedText = '';
  private fullText = '';
  private activeKind: ActorKind = 'hero';
  private actorMode: 'archive' | 'dojo' | 'victory' = 'dojo';
  private nextPoseRefreshAt = 0;
  private heroGateWalking = false;
  private talkTicks = 0;
  private lastTalkAt = 0;
  private movingActorIds = new Set<string>();
  private actorMoveTargets = new Map<string, { x: number; y: number }>();
  private victoryBossKind: Extract<ActorKind, 'oni' | 'returnOni'> = 'oni';
  private introThreatFrameWidth = 0;
  private introThreatFrameHeight = 0;
  private introThreatPose: 'idle' | 'attack' | 'stagger' = 'idle';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onSkip?: () => void,
  ) {
    this.actorLayer = scene.add.group();
    this.uiLayer = scene.add.group();
  }

  setBackground(textureKey: string, fallbackColor = '#100b16'): void {
    this.scene.cameras.main.setBackgroundColor(fallbackColor);
    let usesGeneratedAtmosphereOverlay = false;
    let primitiveShadePieces = 0;
    if (this.scene.textures.exists(textureKey)) {
      this.scene.add.image(640, 360, textureKey).setDisplaySize(1280, 720).setDepth(-20);
      if (textureKey === TextureKeys.ArchiveMemory && this.scene.textures.exists(TextureKeys.ArchiveApproachOverlay)) {
        this.scene.add.image(640, 360, TextureKeys.ArchiveApproachOverlay)
          .setDisplaySize(1280, 720)
          .setDepth(-18.9)
          .setAlpha(0.42);
        usesGeneratedAtmosphereOverlay = true;
      } else if (textureKey === TextureKeys.BrokenDojo && this.scene.textures.exists(TextureKeys.HubAtmosphereOverlay)) {
        this.scene.add.image(640, 360, TextureKeys.HubAtmosphereOverlay)
          .setDisplaySize(1280, 720)
          .setDepth(-18.9)
          .setAlpha(0.34);
        usesGeneratedAtmosphereOverlay = true;
      }
      if (!usesGeneratedAtmosphereOverlay) {
        this.scene.add.rectangle(640, 360, 1280, 720, 0x08060c, 0.14).setDepth(-19);
        primitiveShadePieces = 1;
      }
    }
    (window as Window & {
      __CODEJITSU_DIALOGUE_BACKDROP?: {
        textureKey: string;
        usesGeneratedBackground: boolean;
        usesGeneratedAtmosphereOverlay: boolean;
        primitiveShadePieces: number;
        archiveOmenDemoted: boolean;
        at: number;
      };
    }).__CODEJITSU_DIALOGUE_BACKDROP = {
      textureKey,
      usesGeneratedBackground: this.scene.textures.exists(textureKey),
      usesGeneratedAtmosphereOverlay,
      primitiveShadePieces,
      archiveOmenDemoted: textureKey !== TextureKeys.ArchiveMemory || usesGeneratedAtmosphereOverlay,
      at: Math.round(performance.now()),
    };
  }

  stageActors(sceneId: 'archive' | 'dojo' | 'victory', victoryBossKind: Extract<ActorKind, 'oni' | 'returnOni'> = 'oni'): void {
    this.actorMode = sceneId;
    this.victoryBossKind = victoryBossKind;
    this.actorLayer.clear(true, true);
    this.hero = undefined;
    this.mentor = undefined;
    this.oni = undefined;
    this.archiveEchoes = [];
    this.heroShadow = undefined;
    this.mentorShadow = undefined;
    this.oniShadow = undefined;
    this.archiveEchoShadows = [];
    this.movingActorIds.clear();
    this.actorMoveTargets.clear();
    if (sceneId === 'archive') {
      this.oni = this.createIntroNullOniThreat(1002, 326);
      this.hero = addActorImage(this.scene, 'hero', 326, 426, TextureKeys.Hero, 1.52).setDepth(426);
      this.heroShadow = this.addActorShadow(this.hero, 90, 34, 0.42, 28);
      this.oniShadow = this.addActorShadow(this.oni, 152, 42, 0.24, 34);
      this.actorLayer.addMultiple([this.heroShadow, this.oniShadow, this.hero, this.oni]);
      setActorPose(this.hero, 'walk');
      this.setIntroNullOniThreatPose(this.oni, 'idle');
      this.scene.tweens.add({
        targets: this.hero,
        x: 420,
        y: 416,
        duration: 720,
        ease: 'Sine.InOut',
        onUpdate: () => {
          if (!this.hero) return;
          setActorPose(this.hero, 'walk');
          this.hero.setDepth(this.hero.y);
          this.updateActorShadow(this.heroShadow, this.hero, 28);
        },
        onComplete: () => this.hero && setActorPose(this.hero, 'idle'),
      });
      this.publishDialogueRuntime();
      return;
    }
    if (sceneId === 'victory') {
      this.hero = addActorImage(this.scene, 'hero', 380, 448, TextureKeys.Hero, 1.5).setDepth(448);
      this.mentor = addActorImage(this.scene, 'mentor', 806, 392, TextureKeys.Mentor, 1.32).setDepth(392);
      this.oni = addActorImage(this.scene, this.victoryBossKind, 984, 390, TextureKeys.NullOni, this.victoryBossKind === 'returnOni' ? 1.08 : 1.45).setDepth(390);
      this.heroShadow = this.addActorShadow(this.hero, 88, 34, 0.42, 28);
      this.mentorShadow = this.addActorShadow(this.mentor, 108, 40, 0.38, 32);
      this.oniShadow = this.addActorShadow(this.oni, 140, 46, 0.32, 36);
      this.hero.setFlipX(false);
      this.mentor.setFlipX(true);
      this.oni.setFlipX(true);
      this.actorLayer.addMultiple([this.heroShadow, this.mentorShadow, this.oniShadow, this.hero, this.mentor, this.oni]);
      setActorPose(this.hero, 'walk');
      setActorPose(this.oni, 'defeat');
      this.scene.tweens.add({
        targets: this.hero,
        x: 488,
        y: 416,
        duration: 680,
        ease: 'Sine.InOut',
        onUpdate: () => {
          if (!this.hero) return;
          setActorPose(this.hero, 'walk');
          this.hero.setDepth(this.hero.y);
          this.updateActorShadow(this.heroShadow, this.hero, 28);
        },
        onComplete: () => this.hero && setActorPose(this.hero, 'idle'),
      });
      this.publishDialogueRuntime();
      return;
    }
    this.mentor = addActorImage(this.scene, 'mentor', 448, 430, TextureKeys.Mentor, 1.45).setDepth(430);
    this.hero = addActorImage(this.scene, 'hero', 914, 446, TextureKeys.Hero, 1.55).setDepth(446).setFlipX(true);
    this.mentorShadow = this.addActorShadow(this.mentor, 110, 42, 0.4, 32);
    this.heroShadow = this.addActorShadow(this.hero, 88, 34, 0.42, 28);
    this.actorLayer.addMultiple([this.mentorShadow, this.heroShadow, this.mentor, this.hero]);
    setActorPose(this.hero, 'idle');
    this.publishDialogueRuntime();
  }

  renderNode(node: DialogueNode | undefined): void {
    if (!node) return;
    this.typewriter?.remove(false);
    this.uiLayer.clear(true, true);
    this.activeKind = portraitKind(node);
    this.publishDialogueRuntime(node.speaker, node.text);
    this.refreshActorPoses(true);
    this.stageNodeMotion(node);

    const panelBounds = DIALOGUE_PANEL_BOUNDS;
    const panel = this.createDialoguePanel();
    const kind = portraitKind(node);
    const portraitX = DIALOGUE_PORTRAIT_SAFE.x;
    const portraitY = DIALOGUE_PORTRAIT_SAFE.y;
    const textX = DIALOGUE_TEXT_SAFE.bodyX;
    const portraitShadow = this.scene.add.ellipse(portraitX, portraitY + 48, 104, 28, 0x08060c, 0.26)
      .setDepth(2000);
    this.speakerGlow = this.scene.add.ellipse(portraitX, portraitY, 92, 98, kind === 'oni' ? 0xb85dff : 0xf0c36b, 0.1)
      .setDepth(2000);
    const portrait = addPortraitImage(this.scene, kind, portraitX, portraitY, portraitFallbacks[kind])
      .setDepth(2002)
      .setDisplaySize(DIALOGUE_PORTRAIT_SAFE.width, DIALOGUE_PORTRAIT_SAFE.height);
    this.speakerText = makePixelText(this.scene, DIALOGUE_TEXT_SAFE.speakerX, DIALOGUE_TEXT_SAFE.speakerY, node.speaker, DIALOGUE_TEXT_SAFE.speakerFontSize, '#f0c36b')
      .setDepth(2001)
      .setOrigin(0, 0.5);
    this.bodyText = makePixelText(this.scene, DIALOGUE_TEXT_SAFE.bodyX, DIALOGUE_TEXT_SAFE.bodyY, '', DIALOGUE_TEXT_SAFE.bodyFontSize, '#f6ead3')
      .setDepth(2001)
      .setOrigin(0, 0)
      .setWordWrapWidth(DIALOGUE_TEXT_SAFE.bodyWrapWidth)
      .setLineSpacing(4);
    this.enterPrompt = addDialogueTextPrompt(this.scene, 'Enter', DIALOGUE_TEXT_SAFE.advanceX, DIALOGUE_TEXT_SAFE.promptY);
    this.skipPrompt = addDialogueTextPrompt(this.scene, 'Skip', DIALOGUE_TEXT_SAFE.skipX, DIALOGUE_TEXT_SAFE.promptY, () => {
      this.publishSkipRuntime();
      if (this.onSkip) {
        this.onSkip();
        return;
      }
      this.skipTypewriter();
    });
    this.publishTextPromptRuntime();
    this.uiLayer.addMultiple([
      panel,
      portraitShadow,
      this.speakerGlow,
      portrait,
      this.speakerText,
      this.bodyText,
      ...(this.enterPrompt ? [this.enterPrompt] : []),
      ...(this.skipPrompt ? [this.skipPrompt] : []),
    ]);
    this.startTypewriter(node.text);
    this.publishDialogueRuntime(undefined, undefined, true);
  }

  private createDialoguePanel(): Phaser.GameObjects.GameObject {
    if (this.scene.textures.exists(TextureKeys.DialoguePanel)) {
      this.dialoguePanel = this.scene.add.image(
        DIALOGUE_PANEL_DISPLAY.centerX,
        DIALOGUE_PANEL_DISPLAY.centerY,
        TextureKeys.DialoguePanel,
        ensureDialoguePanelFrame(this.scene),
      )
        .setDisplaySize(DIALOGUE_PANEL_DISPLAY.width, DIALOGUE_PANEL_DISPLAY.height)
        .setDepth(2000)
        .setAlpha(0.96)
        .setData('usesImagegenPanel', true);
      return this.dialoguePanel;
    }
    this.dialoguePanel = addPanel(this.scene, DIALOGUE_PANEL_BOUNDS.x, DIALOGUE_PANEL_BOUNDS.y, DIALOGUE_PANEL_BOUNDS.width, DIALOGUE_PANEL_BOUNDS.height, 0.86)
      .setDepth(2000);
    return this.dialoguePanel;
  }

  update(): void {
    if (this.scene.time.now < this.nextPoseRefreshAt) return;
    this.nextPoseRefreshAt = this.scene.time.now + 90;
    this.refreshActorPoses(false);
    if (this.speakerGlow) {
      const pulse = this.isTyping() ? 0.12 + Math.sin(this.scene.time.now * 0.012) * 0.04 : 0.1;
      this.speakerGlow.setAlpha(pulse);
    }
    this.updateActorShadow(this.heroShadow, this.hero, 28);
    this.updateActorShadow(this.mentorShadow, this.mentor, 32);
    this.updateActorShadow(this.oniShadow, this.oni, 36);
    this.archiveEchoes.forEach((archiveEcho, index) => {
      this.setArchiveMemoryShardPose(archiveEcho, 'glow');
      archiveEcho.setDepth(archiveEcho.y);
      this.updateActorShadow(this.archiveEchoShadows[index], archiveEcho, 26);
    });
    this.publishDialogueRuntime();
  }

  isTyping(): boolean {
    return this.revealedText.length < this.fullText.length;
  }

  skipTypewriter(): void {
    this.typewriter?.remove(false);
    this.revealedText = this.fullText;
    this.bodyText?.setText(this.fullText);
    this.publishDialogueRuntime(undefined, undefined, false);
  }

  walkHeroToGate(onComplete: () => void): void {
    this.typewriter?.remove(false);
    this.uiLayer.clear(true, true);
    if (!this.hero) {
      onComplete();
      return;
    }
    this.heroGateWalking = true;
    this.movingActorIds.add('apprentice');
    this.actorMoveTargets.set('apprentice', { x: 1014, y: 508 });
    this.publishDialogueMotion('apprentice', 'gate-exit', 1014, 508);
    this.activeKind = 'hero';
    this.hero.setAlpha(1).setFlipX(false);
    setActorPose(this.hero, 'walk');
    this.scene.tweens.add({
      targets: this.hero,
      x: 1014,
      y: 508,
      alpha: 0.72,
      scaleX: this.hero.scaleX * 0.76,
      scaleY: this.hero.scaleY * 0.76,
      duration: 760,
      ease: 'Sine.InOut',
      onUpdate: () => {
        if (!this.hero) return;
        setActorPose(this.hero, 'walk');
        this.hero.setDepth(this.hero.y);
        this.updateActorShadow(this.heroShadow, this.hero, 28);
      },
      onComplete: () => {
        this.heroGateWalking = false;
        this.movingActorIds.delete('apprentice');
        this.actorMoveTargets.delete('apprentice');
        if (this.hero) setActorPose(this.hero, 'idle');
        onComplete();
      },
    });
  }

  private stageNodeMotion(node: DialogueNode): void {
    if (this.heroGateWalking) return;
    if (node.id === 'fallen-runner') {
      this.introThreatPose = 'idle';
      this.setIntroNullOniThreatPose(this.oni, 'idle');
      this.walkActorTo('apprentice', this.hero, 420, 416, 520, 'archive-runner-enters');
      return;
    }
    if (node.id === 'null-coworkers') {
      this.introThreatPose = 'attack';
      this.setIntroNullOniThreatPose(this.oni, 'attack');
      return;
    }
    if (node.id === 'dark-road') {
      this.introThreatPose = 'stagger';
      this.setIntroNullOniThreatPose(this.oni, 'stagger');
      this.walkActorTo('apprentice', this.hero, 456, 412, 620, 'archive-runner-finds-gate');
      return;
    }
    if (node.id === 'keiko-found') {
      this.walkActorTo('master-keiko', this.mentor, 500, 426, 460, 'keiko-welcome-step');
      return;
    }
    if (node.id === 'not-lessons') {
      this.walkActorTo('apprentice', this.hero, 888, 450, 500, 'apprentice-asks-training');
      return;
    }
    if (node.id === 'lines') {
      this.walkActorTo('master-keiko', this.mentor, 520, 424, 420, 'keiko-teaches-vow');
      return;
    }
    if (node.id === 'oni') {
      this.walkActorTo('apprentice', this.hero, 948, 444, 460, 'apprentice-turns-to-gate');
      return;
    }
    if (node.id === 'oni-falls') {
      this.walkActorTo('apprentice', this.hero, 520, 414, 480, 'apprentice-approaches-mask');
      return;
    }
    if (node.id === 'keiko-after-oni') {
      this.walkActorTo('master-keiko', this.mentor, 760, 400, 420, 'keiko-joins-victory');
      return;
    }
    if (node.id === 'apprentice-after-oni') {
      this.walkActorTo('apprentice', this.hero, 574, 414, 380, 'apprentice-claims-archive');
      return;
    }
    if (node.id === 'keiko-first-vow') {
      this.walkActorTo('master-keiko', this.mentor, 714, 404, 380, 'keiko-names-first-vow');
      return;
    }
    if (node.id === 'return-oni-reforms') {
      this.walkActorTo('return-oni', this.oni, 930, 396, 420, 'return-oni-reforms');
      return;
    }
    if (node.id === 'runner-breaks-loop') {
      this.walkActorTo('apprentice', this.hero, 552, 414, 420, 'apprentice-breaks-loop');
      return;
    }
    if (node.id === 'keiko-freed') {
      this.walkActorTo('master-keiko', this.mentor, 736, 402, 420, 'keiko-freed');
      return;
    }
  }

  private walkActorTo(
    id: string,
    actor: Phaser.GameObjects.Image | undefined,
    x: number,
    y: number,
    duration: number,
    reason: string,
  ): void {
    if (!actor) return;
    this.movingActorIds.add(id);
    this.actorMoveTargets.set(id, { x, y });
    this.publishDialogueMotion(id, reason, x, y);
    this.scene.tweens.killTweensOf(actor);
    actor.setFlipX(x < actor.x);
    setActorPose(actor, 'walk');
    this.scene.tweens.add({
      targets: actor,
      x,
      y,
      duration,
      ease: 'Sine.InOut',
      onUpdate: () => {
        setActorPose(actor, 'walk');
        actor.setDepth(actor.y);
        this.updateActorShadow(this.shadowForActorId(id), actor, id === 'master-keiko' ? 32 : id === 'null-oni' ? 36 : 28);
      },
      onComplete: () => {
        this.movingActorIds.delete(id);
        this.actorMoveTargets.delete(id);
        setActorPose(actor, this.activeKind === portraitKindForActorId(id) ? 'talk' : 'idle');
        this.publishDialogueRuntime();
      },
    });
  }

  private shadowForActorId(id: string): Phaser.GameObjects.Ellipse | undefined {
    if (id === 'apprentice') return this.heroShadow;
    if (id === 'master-keiko') return this.mentorShadow;
    if (id === 'null-oni') return this.oniShadow;
    if (id === 'return-oni') return this.oniShadow;
    return undefined;
  }

  private publishDialogueMotion(id: string, reason: string, x: number, y: number): void {
    const runtime = window as unknown as {
      __CODEJITSU_DIALOGUE_MOVEMENT_HISTORY?: Array<{
        id: string;
        reason: string;
        targetX: number;
        targetY: number;
        at: number;
      }>;
    };
    const entry = {
      id,
      reason,
      targetX: Math.round(x),
      targetY: Math.round(y),
      at: Math.round(performance.now()),
    };
    runtime.__CODEJITSU_DIALOGUE_MOVEMENT_HISTORY = [
      ...(runtime.__CODEJITSU_DIALOGUE_MOVEMENT_HISTORY ?? []),
      entry,
    ].slice(-24);
  }

  private startTypewriter(text: string): void {
    this.fullText = text;
    this.revealedText = '';
    this.talkTicks = 0;
    this.lastTalkAt = 0;
    this.bodyText?.setText('');
    this.publishDialogueRuntime(undefined, undefined, true);
    let index = 0;
    const fastDialogue = new URLSearchParams(window.location.search).has('e2e');
    this.typewriter = this.scene.time.addEvent({
      delay: fastDialogue ? 6 : 22,
      repeat: text.length - 1,
      callback: () => {
        index += 1;
        this.revealedText = text.slice(0, index);
        this.bodyText?.setText(this.revealedText);
        this.publishDialogueRuntime(undefined, undefined, index < text.length);
        if (index % 3 === 0 && text[index - 1] !== ' ') {
          this.talkTicks += 1;
          this.lastTalkAt = Math.round(performance.now());
          playTalk(this.scene);
          this.publishDialogueRuntime(undefined, undefined, index < text.length);
        }
      },
    });
  }

  private publishDialogueRuntime(speaker?: string, text?: string, typing?: boolean): void {
    const runtime = window as unknown as {
      __CODEJITSU_DIALOGUE_SPEAKER?: string;
      __CODEJITSU_DIALOGUE_TEXT?: string;
      __CODEJITSU_DIALOGUE_REVEALED?: string;
      __CODEJITSU_DIALOGUE_TYPING?: boolean;
      __CODEJITSU_LAYOUT_AUDITS?: Record<string, { noOverflow: boolean; noOverlap: boolean }>;
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
      __CODEJITSU_DIALOGUE_TALK_TICKS?: number;
      __CODEJITSU_DIALOGUE_LAST_TALK_AT?: number;
      __CODEJITSU_DIALOGUE_TYPEWRITER_HISTORY?: Array<{
        speaker: string;
        textLength: number;
        partialShown: boolean;
        talkTicks: number;
        at: number;
      }>;
      __CODEJITSU_DIALOGUE_ACTORS?: Array<{
        id: string;
        mode: string;
        x: number;
        y: number;
        moving: boolean;
        targetX?: number;
        targetY?: number;
        gateWalking: boolean;
        pose?: string;
        frameIndex?: number;
        frameCount?: number;
        renderVariant?: string;
        motionProfile?: string;
        flipX: boolean;
        facing: 'left' | 'right';
        alpha: number;
        targetObject: boolean;
        visualBottom: number;
        clearOfDialoguePanel: boolean;
        active: boolean;
      }>;
      __CODEJITSU_DIALOGUE_STAGING?: {
        mode: string;
        portraitCentered: boolean;
        activeActorVisible: boolean;
        activeActorPose: string;
        noActorOverlap: boolean;
        minActorDistance: number;
        facingReadable: boolean;
        actorCount: number;
        characterCount: number;
        memoryPropCount: number;
        archiveCombatScene: boolean;
        archiveConfrontationClear: boolean;
        at: number;
      };
    };
    if (speaker !== undefined) runtime.__CODEJITSU_DIALOGUE_SPEAKER = speaker;
    if (text !== undefined) runtime.__CODEJITSU_DIALOGUE_TEXT = text;
    if (typing !== undefined) runtime.__CODEJITSU_DIALOGUE_TYPING = typing;
    runtime.__CODEJITSU_DIALOGUE_REVEALED = this.revealedText;
    const usesImagegenPanel = Boolean((this.dialoguePanel as Phaser.GameObjects.GameObject & { getData?: (key: string) => unknown } | undefined)?.getData?.('usesImagegenPanel'));
    if (this.speakerText && this.bodyText && this.enterPrompt) {
      publishTextPanelAudit('dialogue', DIALOGUE_PANEL_BOUNDS, [
        { id: 'speaker', object: this.speakerText },
        { id: 'body', object: this.bodyText },
        { id: 'advance-seal', object: this.enterPrompt },
        ...(this.skipPrompt ? [{ id: 'skip-seal', object: this.skipPrompt }] : []),
      ], 14);
    }
    const layoutAudit = runtime.__CODEJITSU_LAYOUT_AUDITS?.dialogue;
    const portraitRight = DIALOGUE_PORTRAIT_SAFE.x + DIALOGUE_PORTRAIT_SAFE.width / 2;
    runtime.__CODEJITSU_DIALOGUE_LAYOUT = {
      usesImagegenPanel,
      primitivePanelPieces: usesImagegenPanel ? 0 : 2,
      usesIntegratedPortraitSocket: usesImagegenPanel,
      portraitX: DIALOGUE_PORTRAIT_SAFE.x,
      portraitY: DIALOGUE_PORTRAIT_SAFE.y,
      portraitInsidePanel: true,
      bodyX: DIALOGUE_TEXT_SAFE.bodyX,
      bodyY: DIALOGUE_TEXT_SAFE.bodyY,
      panelCenterX: 640,
      panel: {
        x: DIALOGUE_PANEL_DISPLAY.x,
        y: DIALOGUE_PANEL_DISPLAY.y,
        width: DIALOGUE_PANEL_DISPLAY.width,
        height: DIALOGUE_PANEL_DISPLAY.height,
        bottom: DIALOGUE_PANEL_DISPLAY.bottom,
      },
      panelAspectLocked: Math.abs((DIALOGUE_PANEL_DISPLAY.width / DIALOGUE_PANEL_DISPLAY.height) - (DIALOGUE_PANEL_CROP.width / DIALOGUE_PANEL_CROP.height)) < 0.02,
      noOverlap: layoutAudit?.noOverlap,
      noOverflow: layoutAudit?.noOverflow,
      bodyWrapWidth: DIALOGUE_TEXT_SAFE.bodyWrapWidth,
      portraitDisplayWidth: DIALOGUE_PORTRAIT_SAFE.width,
      portraitDisplayHeight: DIALOGUE_PORTRAIT_SAFE.height,
      portraitAspectLocked: DIALOGUE_PORTRAIT_SAFE.width === DIALOGUE_PORTRAIT_SAFE.height,
      portraitClearOfText: portraitRight <= DIALOGUE_TEXT_SAFE.bodyX - 96,
      textLayout: 'portrait-left',
    };
    runtime.__CODEJITSU_DIALOGUE_TALK_TICKS = this.talkTicks;
    runtime.__CODEJITSU_DIALOGUE_LAST_TALK_AT = this.lastTalkAt;
    if (speaker !== undefined && text !== undefined) {
      const history = runtime.__CODEJITSU_DIALOGUE_TYPEWRITER_HISTORY ?? [];
      runtime.__CODEJITSU_DIALOGUE_TYPEWRITER_HISTORY = [
        ...history,
        {
          speaker,
          textLength: text.length,
          partialShown: this.revealedText.length > 0 && this.revealedText.length < text.length,
          talkTicks: this.talkTicks,
          at: Math.round(performance.now()),
        },
      ].slice(-32);
    } else if (this.fullText.length > 0) {
      const history = runtime.__CODEJITSU_DIALOGUE_TYPEWRITER_HISTORY ?? [];
      const previous = history[history.length - 1];
      if (previous) {
        previous.partialShown ||= this.revealedText.length > 0 && this.revealedText.length < this.fullText.length;
        previous.talkTicks = Math.max(previous.talkTicks, this.talkTicks);
        previous.at = Math.round(performance.now());
      }
    }
    const actors = this.dialogueActorsRuntime();
    runtime.__CODEJITSU_DIALOGUE_ACTORS = actors;
    runtime.__CODEJITSU_DIALOGUE_STAGING = this.dialogueStagingRuntime(actors);
  }

  private publishSkipRuntime(): void {
    (window as Window & {
      __CODEJITSU_DIALOGUE_SKIP?: {
        visible: boolean;
        clicked: boolean;
        scene: string;
        at: number;
      };
    }).__CODEJITSU_DIALOGUE_SKIP = {
      visible: Boolean(this.skipPrompt?.visible),
      clicked: true,
      scene: this.scene.sys.settings.key,
      at: Math.round(performance.now()),
    };
  }

  private publishTextPromptRuntime(): void {
    const scene = this.scene.scene.key;
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
      scene,
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
      scene,
      usesImagegenSkipSeal: false,
      visibleTextPrompt: true,
      textureKey: 'text-prompt',
      frameIndex: -1,
      visible: Boolean(this.skipPrompt?.visible),
      clicked: false,
      at: Math.round(performance.now()),
    };
  }

  private dialogueStagingRuntime(actors: ReturnType<DialogueSceneController['dialogueActorsRuntime']>): {
    mode: string;
    portraitCentered: boolean;
    activeActorVisible: boolean;
    activeActorPose: string;
    noActorOverlap: boolean;
    minActorDistance: number;
    facingReadable: boolean;
    actorCount: number;
    characterCount: number;
    memoryPropCount: number;
    visibleThreatCount: number;
    primaryThreatName: string;
    storyCharacterCount: number;
    storyCharacterIds: string[];
    storyCharacterNames: string[];
    strayArchiveActorCount: number;
    threatRelationship: 'pursuer' | 'none';
    archiveCombatScene: boolean;
    archiveConfrontationClear: boolean;
    at: number;
  } {
    const active = actors.find((actor) => actor.active);
    const characterCount = actors.filter((actor) => !actor.targetObject).length;
    const memoryPropCount = actors.filter((actor) => actor.targetObject && actor.id.startsWith('archive-')).length;
    let minDistance = Number.POSITIVE_INFINITY;
    for (let a = 0; a < actors.length; a += 1) {
      for (let b = a + 1; b < actors.length; b += 1) {
        const first = actors[a];
        const second = actors[b];
        if (!first || !second || first.alpha < 0.2 || second.alpha < 0.2) continue;
        const distance = Math.hypot(first.x - second.x, (first.y - second.y) * 1.28);
        minDistance = Math.min(minDistance, distance);
      }
    }
    if (!Number.isFinite(minDistance)) minDistance = 999;
    const hero = actors.find((actor) => actor.id === 'apprentice');
    const keiko = actors.find((actor) => actor.id === 'master-keiko');
    const oni = actors.find((actor) => actor.id === 'null-oni' || actor.id === 'return-oni');
    const visibleThreatCount = actors.filter((actor) =>
      (actor.id === 'null-oni' || actor.id === 'return-oni') &&
      actor.alpha >= 0.2 &&
      actor.clearOfDialoguePanel,
    ).length;
    const storyCharacters = actors.filter((actor) =>
      actor.id === 'apprentice' ||
      actor.id === 'master-keiko' ||
      actor.id === 'null-oni' ||
      actor.id === 'return-oni',
    );
    const storyCharacterIds = storyCharacters.map((actor) => actor.id);
    const storyCharacterNames = storyCharacterIds.map((id) => {
      if (id === 'apprentice') return 'Apprentice';
      if (id === 'master-keiko') return 'Master Keiko';
      if (id === 'return-oni') return 'Return Oni';
      return 'Null Oni';
    });
    const strayArchiveActorCount = this.actorMode === 'archive'
      ? actors.filter((actor) => !['apprentice', 'null-oni'].includes(actor.id)).length
      : 0;
    const facingReadable = this.actorMode === 'archive'
      ? Boolean(hero?.facing === 'right' && oni?.facing === 'left')
      : this.actorMode === 'victory'
        ? Boolean(hero?.facing === 'right' && keiko?.facing === 'left' && oni?.facing === 'left')
        : Boolean(hero?.facing === 'left' && keiko?.facing === 'right');
    return {
      mode: this.actorMode,
      portraitCentered: true,
      activeActorVisible: Boolean(active && active.alpha >= 0.78),
      activeActorPose: active?.pose ?? '',
      noActorOverlap: minDistance >= (this.actorMode === 'archive' ? 112 : 134),
      minActorDistance: Math.round(minDistance * 10) / 10,
      facingReadable,
      actorCount: actors.length,
      characterCount,
      memoryPropCount,
      visibleThreatCount,
      primaryThreatName: oni?.id === 'return-oni' ? 'Return Oni' : oni ? 'Null Oni' : '',
      storyCharacterCount: storyCharacters.length,
      storyCharacterIds,
      storyCharacterNames,
      strayArchiveActorCount,
      threatRelationship: this.actorMode === 'archive' && hero && oni ? 'pursuer' : 'none',
      archiveCombatScene: false,
      archiveConfrontationClear: this.actorMode !== 'archive' || (
        actors.length === 2 &&
        storyCharacters.length === 2 &&
        storyCharacterIds.join(',') === 'apprentice,null-oni' &&
        strayArchiveActorCount === 0 &&
        memoryPropCount === 0 &&
        visibleThreatCount === 1 &&
        Boolean(hero && oni) &&
        facingReadable
      ),
      at: Math.round(performance.now()),
    };
  }

  private refreshActorPoses(force = false): void {
    if (!force && !this.hero && !this.mentor && !this.oni) return;
    const activePose: 'talk' | 'stagger' = (this.activeKind === 'oni' || this.activeKind === 'returnOni') ? 'stagger' : 'talk';
    if (this.hero) {
      if (!this.heroGateWalking) {
        this.hero.setFlipX(this.actorMode === 'dojo');
        setActorPose(this.hero, this.movingActorIds.has('apprentice') ? 'walk' : this.activeKind === 'hero' ? activePose : 'idle');
        this.hero.setAlpha(this.activeKind === 'hero' ? 1 : 0.78);
      }
    }
    if (this.mentor) {
      this.mentor.setFlipX(this.actorMode === 'victory');
      setActorPose(this.mentor, this.movingActorIds.has('master-keiko') ? 'walk' : this.activeKind === 'mentor' ? activePose : 'idle');
      this.mentor.setAlpha(this.activeKind === 'mentor' ? 1 : 0.78);
    }
    if (this.oni) {
      if (this.oni.getData('actorKind') === 'intro-null-oni-threat') {
        this.oni.setFlipX(true);
        this.setIntroNullOniThreatPose(this.oni, this.introThreatPose);
        this.oni.setAlpha(0.72);
      } else {
        const bossActive = this.activeKind === this.victoryBossKind || this.activeKind === 'oni' || this.activeKind === 'returnOni';
        this.oni.setFlipX(true);
        setActorPose(this.oni, bossActive ? 'stagger' : 'defeat');
        this.oni.setAlpha(bossActive ? 0.92 : 0.58);
      }
    }
    this.archiveEchoes.forEach((archiveEcho) => {
      archiveEcho.setFlipX(false);
      this.setArchiveMemoryShardPose(archiveEcho, this.activeKind === 'hero' ? 'glow' : 'idle');
      archiveEcho.setAlpha(this.activeKind === 'hero' ? 0.82 : 0.58);
    });
  }

  private createArchiveMemoryShard(x: number, y: number): Phaser.GameObjects.Image {
    if (this.scene.textures.exists(TextureKeys.ArchiveVowSeam)) {
      const vowSeam = this.scene.add.image(x, y, TextureKeys.ArchiveVowSeam)
        .setDepth(y)
        .setAlpha(0.72)
        .setFlipX(false)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.setArchiveMemoryShardPose(vowSeam, 'glow');
      return vowSeam;
    }
    if (this.scene.textures.exists(TextureKeys.ArchiveMemoryShard)) {
      const memoryShard = this.scene.add.image(x, y, TextureKeys.ArchiveMemoryShard)
        .setDepth(y)
        .setAlpha(0.86)
        .setFlipX(false);
      this.setArchiveMemoryShardPose(memoryShard, 'glow');
      return memoryShard;
    }
    if (this.scene.textures.exists(TextureKeys.ArchivePracticeEcho)) {
      const archiveEcho = this.scene.add.image(x, y, TextureKeys.ArchivePracticeEcho)
        .setDepth(y)
        .setAlpha(0.56)
        .setFlipX(false);
      this.setArchiveMemoryShardPose(archiveEcho, 'idle');
      return archiveEcho;
    }
    const fallback = addActorImage(this.scene, 'sentinel', x, y, TextureKeys.NullOni, 1.06)
      .setDepth(y)
      .setAlpha(0.34)
      .setTint(0xb85dff)
      .setFlipX(false);
    setActorPose(fallback, 'idle');
    return fallback;
  }

  private createIntroNullOniThreat(x: number, y: number): Phaser.GameObjects.Image {
    if (this.scene.textures.exists(TextureKeys.IntroNullOniThreat)) {
      const threat = this.scene.add.image(x, y, TextureKeys.IntroNullOniThreat, this.ensureIntroNullOniThreatFrame(0))
        .setDepth(y)
        .setAlpha(0.72)
        .setFlipX(true)
        .setDisplaySize(190, 172)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.setIntroNullOniThreatPose(threat, 'idle');
      return threat;
    }
    const fallback = this.scene.add.image(x, y, TextureKeys.ArchiveNullOniOmen)
      .setDepth(y)
      .setAlpha(0.68)
      .setFlipX(true)
      .setDisplaySize(184, 184)
      .setBlendMode(Phaser.BlendModes.ADD);
    fallback.setData('actorKind', 'intro-null-oni-threat');
    fallback.setData('actorPose', 'threat-idle');
    fallback.setData('actorFrameCount', 1);
    fallback.setData('actorFrameIndex', 0);
    fallback.setData('actorRenderVariant', 'imagegen-archive-null-oni-omen-fallback');
    fallback.setData('motionProfile', 'story-antagonist-threat');
    fallback.setData('targetObject', true);
    return fallback;
  }

  private ensureIntroNullOniThreatFrame(frameIndex: number): string {
    const texture = this.scene.textures.get(TextureKeys.IntroNullOniThreat);
    const source = texture.getSourceImage() as { width?: number; height?: number };
    this.introThreatFrameWidth ||= Math.floor(Number(source.width ?? 2172) / 3);
    this.introThreatFrameHeight ||= Number(source.height ?? 724);
    const safeFrame = Phaser.Math.Clamp(frameIndex, 0, 2);
    const frameName = `intro-null-oni-threat-${safeFrame}`;
    if (!texture.has(frameName)) {
      texture.add(frameName, 0, safeFrame * this.introThreatFrameWidth, 0, this.introThreatFrameWidth, this.introThreatFrameHeight);
    }
    return frameName;
  }

  private setIntroNullOniThreatPose(actor: Phaser.GameObjects.Image | undefined, pose: 'idle' | 'attack' | 'stagger'): void {
    if (!actor) return;
    const frameIndex = pose === 'attack' ? 1 : pose === 'stagger' ? 2 : 0;
    if (this.scene.textures.exists(TextureKeys.IntroNullOniThreat)) {
      actor
        .setTexture(TextureKeys.IntroNullOniThreat, this.ensureIntroNullOniThreatFrame(frameIndex))
        .setDisplaySize(pose === 'attack' ? 208 : pose === 'stagger' ? 202 : 190, pose === 'attack' ? 184 : 172)
        .setBlendMode(Phaser.BlendModes.ADD);
    }
    actor.setData('actorKind', 'intro-null-oni-threat');
    actor.setData('actorPose', `threat-${pose}`);
    actor.setData('actorFrameCount', this.scene.textures.exists(TextureKeys.IntroNullOniThreat) ? 3 : 1);
    actor.setData('actorFrameIndex', frameIndex);
    actor.setData('actorRenderVariant', this.scene.textures.exists(TextureKeys.IntroNullOniThreat) ? 'imagegen-intro-null-oni-threat' : 'imagegen-archive-null-oni-omen-fallback');
    actor.setData('motionProfile', 'story-antagonist-threat');
    actor.setData('targetObject', true);
  }

  private setArchiveMemoryShardPose(actor: Phaser.GameObjects.Image, pose: 'idle' | 'glow' | 'pulse' | 'fade'): void {
    if (this.scene.textures.exists(TextureKeys.ArchiveVowSeam)) {
      const frameIndex = pose === 'glow' ? 1 : pose === 'pulse' ? 2 : pose === 'fade' ? 3 : 0;
      const source = this.scene.textures.get(TextureKeys.ArchiveVowSeam).getSourceImage() as { width?: number; height?: number };
      const frameWidth = Math.floor(Number(source.width ?? 1983) / 4);
      const frameHeight = Number(source.height ?? 793);
      actor
        .setTexture(TextureKeys.ArchiveVowSeam)
        .setCrop(frameIndex * frameWidth, 0, frameWidth, frameHeight)
        .setDisplaySize(pose === 'pulse' ? 138 : pose === 'fade' ? 106 : 124, pose === 'pulse' ? 174 : pose === 'fade' ? 138 : 156)
        .setBlendMode(Phaser.BlendModes.ADD);
      actor.setData('actorPose', `vow-seam-${pose}`);
      actor.setData('actorKind', 'archive-vow-seam');
      actor.setData('actorFrameCount', 4);
      actor.setData('actorFrameIndex', frameIndex);
      actor.setData('actorRenderVariant', 'imagegen-archive-vow-seam');
      actor.setData('motionProfile', 'non-character-memory-vow-seam');
      actor.setData('targetObject', true);
      return;
    }
    if (this.scene.textures.exists(TextureKeys.ArchiveNullOniOmen) && actor.texture.key === TextureKeys.ArchiveNullOniOmen) {
      actor
        .setTexture(TextureKeys.ArchiveNullOniOmen)
        .setCrop()
        .setDisplaySize(pose === 'pulse' ? 232 : pose === 'fade' ? 196 : 218, pose === 'pulse' ? 232 : pose === 'fade' ? 196 : 218)
        .setBlendMode(Phaser.BlendModes.ADD);
      actor.setData('actorPose', pose === 'idle' ? 'omen' : `omen-${pose}`);
      actor.setData('actorKind', 'archive-null-oni-omen');
      actor.setData('actorFrameCount', 1);
      actor.setData('actorFrameIndex', 0);
      actor.setData('actorRenderVariant', 'imagegen-archive-null-oni-omen');
      actor.setData('motionProfile', 'non-character-threat-omen');
      actor.setData('targetObject', true);
      return;
    }
    if (this.scene.textures.exists(TextureKeys.ArchiveMemoryShard)) {
      const frameIndex = pose === 'glow' ? 1 : pose === 'pulse' ? 2 : pose === 'fade' ? 3 : 0;
      const source = this.scene.textures.get(TextureKeys.ArchiveMemoryShard).getSourceImage() as { width?: number; height?: number };
      const frameWidth = Math.floor(Number(source.width ?? 1984) / 4);
      const frameHeight = Number(source.height ?? 793);
      actor
        .setTexture(TextureKeys.ArchiveMemoryShard)
        .setCrop(frameIndex * frameWidth, 0, frameWidth, frameHeight)
        .setDisplaySize(pose === 'pulse' ? 176 : 156, pose === 'fade' ? 142 : 168);
      actor.setData('actorPose', pose);
      actor.setData('actorKind', 'archive-memory-shard');
      actor.setData('actorFrameCount', 4);
      actor.setData('actorFrameIndex', frameIndex);
      actor.setData('actorRenderVariant', 'imagegen-archive-memory-shard');
      actor.setData('motionProfile', 'non-character-memory-prop');
      actor.setData('targetObject', true);
      return;
    }
    if (this.scene.textures.exists(TextureKeys.ArchivePracticeEcho)) {
      const source = this.scene.textures.get(TextureKeys.ArchivePracticeEcho).getSourceImage() as { width?: number; height?: number };
      const frameWidth = Math.floor(Number(source.width ?? 2048) / 4);
      const frameHeight = Number(source.height ?? 768);
      actor
        .setTexture(TextureKeys.ArchivePracticeEcho)
        .setCrop(0, 0, frameWidth, frameHeight)
        .setDisplaySize(138, 154);
      actor.setData('actorPose', 'idle');
      actor.setData('actorKind', 'archive-memory-shard');
      actor.setData('actorFrameCount', 4);
      actor.setData('actorFrameIndex', 0);
      actor.setData('actorRenderVariant', 'imagegen-archive-memory-fallback');
      actor.setData('motionProfile', 'non-character-memory-prop-fallback');
      actor.setData('targetObject', true);
      return;
    }
    setActorPose(actor, 'idle');
  }

  private addActorShadow(
    actor: Phaser.GameObjects.Image,
    width: number,
    height: number,
    alpha: number,
    offsetY: number,
  ): Phaser.GameObjects.Ellipse {
    const shadow = this.scene.add.ellipse(actor.x, actor.y + offsetY, width, height, 0x08060c, alpha);
    shadow.setDepth(actor.y - 10);
    return shadow;
  }

  private updateActorShadow(
    shadow: Phaser.GameObjects.Ellipse | undefined,
    actor: Phaser.GameObjects.Image | undefined,
    offsetY: number,
  ): void {
    if (!shadow || !actor) return;
    shadow.setPosition(actor.x, actor.y + offsetY);
    shadow.setDepth(actor.y - 10);
  }

  private dialogueActorsRuntime(): Array<{
    id: string;
    mode: string;
    x: number;
    y: number;
    moving: boolean;
    targetX?: number;
    targetY?: number;
    gateWalking: boolean;
    pose?: string;
    renderVariant?: string;
    motionProfile?: string;
    flipX: boolean;
    facing: 'left' | 'right';
    alpha: number;
    targetObject: boolean;
    visualBottom: number;
    clearOfDialoguePanel: boolean;
    active: boolean;
  }> {
    const actors: Array<[string, ActorKind, Phaser.GameObjects.Image | undefined]> = [
      ['apprentice', 'hero', this.hero],
      ['master-keiko', 'mentor', this.mentor],
      [this.victoryBossKind === 'returnOni' ? 'return-oni' : 'null-oni', this.victoryBossKind, this.oni],
      ...this.archiveEchoes.map((actor, index) => {
        const rawKind = actor.getData('actorKind');
        const actorKind = rawKind === 'archive-null-oni-omen'
          ? 'archive-null-oni-omen'
          : rawKind === 'archive-vow-seam'
            ? 'archive-vow-seam'
            : 'archive-memory-shard';
        return [`${actorKind}-${index + 1}`, 'sentinel' as ActorKind, actor] as [string, ActorKind, Phaser.GameObjects.Image];
      }),
    ];
    return actors
      .filter(([, , actor]) => Boolean(actor))
      .map(([id, kind, actor]) => {
        const target = this.actorMoveTargets.get(id);
        const displayHeight = Number(actor!.displayHeight || actor!.height || 0);
        const visualBottom = Math.round(actor!.y + displayHeight / 2);
        return {
        id,
        mode: this.actorMode,
        x: Math.round(actor!.x),
        y: Math.round(actor!.y),
        moving: this.movingActorIds.has(id),
        targetX: target ? Math.round(target.x) : undefined,
        targetY: target ? Math.round(target.y) : undefined,
        gateWalking: id === 'apprentice' && this.heroGateWalking,
        pose: actor!.getData('actorPose') as string | undefined,
        frameIndex: actor!.getData('actorFrameIndex') as number | undefined,
        frameCount: actor!.getData('actorFrameCount') as number | undefined,
        renderVariant: actor!.getData('actorRenderVariant') as string | undefined,
        motionProfile: actor!.getData('motionProfile') as string | undefined,
        flipX: actor!.flipX,
        facing: actor!.flipX ? 'left' : 'right',
        alpha: Math.round(actor!.alpha * 100) / 100,
        targetObject: actor!.getData('targetObject') === true,
        visualBottom,
        clearOfDialoguePanel: visualBottom <= DIALOGUE_PANEL_DISPLAY.y,
        active: actor!.getData('targetObject') !== true && kind === this.activeKind,
        };
      });
  }
}

function portraitKindForActorId(id: string): ActorKind {
  if (id === 'master-keiko') return 'mentor';
  if (id === 'null-oni') return 'oni';
  if (id === 'return-oni') return 'returnOni';
  if (id.startsWith('archive-echo')) return 'sentinel';
  return 'hero';
}
