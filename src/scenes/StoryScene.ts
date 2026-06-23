import Phaser from 'phaser';
import { introDialogue } from '../data/dialogue';
import { SceneKeys, TextureKeys } from './sceneKeys';
import { installAudioUnlock } from './audioUnlock';
import { DialogueSceneController } from './dialogueController';
import { publishFrameHealth } from './runtimeDebug';
import { fadeInFromBlack, fadeToScene, transitionStoryStage } from './transition';

export class StoryScene extends Phaser.Scene {
  private index = 0;
  private dialogue!: DialogueSceneController;
  private canAdvanceAt = 0;
  private currentStage?: 'archive' | 'dojo';
  private transitioningStage = false;

  constructor() {
    super(SceneKeys.Story);
  }

  create(): void {
    if (this.index >= introDialogue.length) {
      this.index = 0;
    }
    (window as unknown as { __CODEJITSU_SCENE?: string }).__CODEJITSU_SCENE = 'story';
    installAudioUnlock(this);
    this.dialogue = new DialogueSceneController(this, () => this.skipStory());
    this.currentStage = undefined;
    this.transitioningStage = false;
    this.drawStoryStage(this.stageForCurrentNode());
    fadeInFromBlack(this);
    this.showNode();
    this.input.keyboard?.on('keydown-ENTER', () => this.advance());
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());
    this.input.on('pointerdown', () => this.advance());
  }

  update(_time: number, delta: number): void {
    publishFrameHealth('story', delta);
    this.dialogue?.update();
  }

  private drawStoryStage(stage: 'archive' | 'dojo'): void {
    if (this.currentStage === stage) return;
    this.currentStage = stage;
    if (stage === 'archive') {
      this.dialogue.setBackground(TextureKeys.ArchiveMemory);
      this.dialogue.stageActors('archive');
      return;
    }
    this.dialogue.setBackground(TextureKeys.BrokenDojo);
    this.dialogue.stageActors('dojo');
  }

  private stageForCurrentNode(): 'archive' | 'dojo' {
    return this.index <= 2 ? 'archive' : 'dojo';
  }

  private showNode(): void {
    const node = introDialogue[this.index];
    if (!node) {
      this.index = 0;
      fadeToScene(this, SceneKeys.Tutorial);
      return;
    }
    this.canAdvanceAt = this.time.now + (this.isFastStory() ? 120 : 620);
    this.dialogue.renderNode(node);
  }

  private isFastStory(): boolean {
    return new URLSearchParams(window.location.search).has('e2e');
  }

  private advance(): void {
    if (this.transitioningStage || this.time.now < this.canAdvanceAt) {
      return;
    }
    if (this.dialogue.isTyping()) {
      this.dialogue.skipTypewriter();
      this.canAdvanceAt = this.time.now + 120;
      return;
    }
    this.index += 1;
    if (this.index >= introDialogue.length) {
      this.transitioningStage = true;
      this.dialogue.walkHeroToGate(() => fadeToScene(this, SceneKeys.Tutorial));
      return;
    }
    const nextStage = this.stageForCurrentNode();
    if (nextStage !== this.currentStage) {
      this.transitioningStage = true;
      const previousStage = this.currentStage ?? 'archive';
      transitionStoryStage(this, previousStage, nextStage, () => {
        this.drawStoryStage(nextStage);
        this.showNode();
      }, () => {
        this.transitioningStage = false;
      });
      return;
    }
    this.showNode();
  }

  private skipStory(): void {
    if (this.transitioningStage) return;
    this.transitioningStage = true;
    this.index = 0;
    fadeToScene(this, SceneKeys.Tutorial);
  }
}
