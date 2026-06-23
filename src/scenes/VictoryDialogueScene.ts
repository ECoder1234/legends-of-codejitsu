import Phaser from 'phaser';
import { chapterTwoVictoryDialogue, nullOniVictoryDialogue } from '../data/dialogue';
import type { DialogueNode } from '../types/game';
import { installAudioUnlock } from './audioUnlock';
import { DialogueSceneController } from './dialogueController';
import { publishFrameHealth } from './runtimeDebug';
import { SceneKeys, TextureKeys } from './sceneKeys';
import { fadeInFromBlack, fadeToScene } from './transition';

export class VictoryDialogueScene extends Phaser.Scene {
  private dialogue!: DialogueSceneController;
  private index = 0;
  private canAdvanceAt = 0;
  private chapter = 1;
  private unlock = 'try-catch';
  private nodes: DialogueNode[] = nullOniVictoryDialogue;

  constructor() {
    super(SceneKeys.VictoryDialogue);
  }

  init(data?: { chapter?: number; unlock?: string }): void {
    this.chapter = data?.chapter ?? 1;
    this.unlock = data?.unlock ?? (this.chapter === 2 ? 'loop-strike' : 'try-catch');
    this.nodes = this.chapter === 2 ? chapterTwoVictoryDialogue : nullOniVictoryDialogue;
  }

  create(): void {
    (window as unknown as { __CODEJITSU_SCENE?: string }).__CODEJITSU_SCENE = 'victory-dialogue';
    installAudioUnlock(this);
    this.index = 0;
    this.dialogue = new DialogueSceneController(this, () => this.skipVictoryDialogue());
    this.dialogue.setBackground(this.chapter === 2 ? TextureKeys.Chapter2RevengeArena : TextureKeys.NullOniArena, '#09070d');
    this.dialogue.stageActors('victory', this.chapter === 2 ? 'returnOni' : 'oni');
    fadeInFromBlack(this);
    this.showNode();
    this.input.keyboard?.on('keydown-ENTER', () => this.advance());
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());
    this.input.on('pointerdown', () => this.advance());
  }

  update(_time: number, delta: number): void {
    publishFrameHealth('victory-dialogue', delta);
    this.dialogue?.update();
  }

  private showNode(): void {
    this.canAdvanceAt = this.time.now + (this.isFastDialogue() ? 120 : 650);
    this.dialogue.renderNode(this.nodes[this.index]);
  }

  private isFastDialogue(): boolean {
    return new URLSearchParams(window.location.search).has('e2e');
  }

  private advance(): void {
    if (this.time.now < this.canAdvanceAt) return;
    if (this.dialogue.isTyping()) {
      this.dialogue.skipTypewriter();
      this.canAdvanceAt = this.time.now + 120;
      return;
    }
    this.index += 1;
    if (this.index >= this.nodes.length) {
      fadeToScene(this, SceneKeys.Result, 360, { outcome: 'win', unlock: this.unlock, chapter: this.chapter });
      return;
    }
    this.showNode();
  }

  private skipVictoryDialogue(): void {
    fadeToScene(this, SceneKeys.Result, 360, { outcome: 'win', unlock: this.unlock, chapter: this.chapter });
  }
}
