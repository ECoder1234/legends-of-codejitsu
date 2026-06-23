import Phaser from 'phaser';
import { chapterThreeDialogue } from '../data/dialogue';
import { loadSave, writeSave } from '../systems/saveSystem';
import { installAudioUnlock } from './audioUnlock';
import { SceneKeys, TextureKeys } from './sceneKeys';
import { makePixelText, addPanel } from './ui';

export class Chapter3StoryScene extends Phaser.Scene {
  private index = 0;
  private speakerText?: Phaser.GameObjects.Text;
  private bodyText?: Phaser.GameObjects.Text;

  constructor() {
    super(SceneKeys.Chapter3Story);
  }

  create(): void {
    installAudioUnlock(this);
    (window as unknown as { __CODEJITSU_SCENE?: string }).__CODEJITSU_SCENE = 'chapter3-story';
    writeSave({ ...loadSave(), currentCheckpoint: 'chapter3-story' });
    this.cameras.main.setBackgroundColor('#09070d');
    this.addBackdrop();
    addPanel(this, 130, 408, 1020, 218, 0.9).setDepth(10);
    this.speakerText = makePixelText(this, 178, 446, '', 24, '#f0c36b').setDepth(12);
    this.bodyText = makePixelText(this, 178, 498, '', 22, '#f6ead3').setWordWrapWidth(912).setDepth(12);
    makePixelText(this, 1000, 586, 'ENTER', 18, '#90d2b7', 'center').setDepth(12);
    this.renderDialogue();
    this.input.keyboard?.on('keydown-ENTER', () => this.advance());
    this.input.on('pointerdown', () => this.advance());
  }

  private addBackdrop(): void {
    const texture = this.textures.exists(TextureKeys.Chapter2OutdoorTrail)
      ? TextureKeys.Chapter2OutdoorTrail
      : this.textures.exists(TextureKeys.ArchiveMemory)
        ? TextureKeys.ArchiveMemory
        : undefined;
    if (texture) {
      this.add.image(640, 360, texture).setDisplaySize(1280, 720).setAlpha(0.88).setDepth(-20);
    } else {
      this.add.rectangle(640, 360, 1280, 720, 0x09070d, 1).setDepth(-20);
      for (let x = 104; x < 1200; x += 92) {
        this.add.image(x, 560, TextureKeys.FloorTile).setAlpha(0.55).setDepth(-10);
      }
    }
    this.add.rectangle(640, 360, 1280, 720, 0x050309, 0.34).setDepth(-5);
    makePixelText(this, 640, 132, 'The Broken Archive Gate', 42, '#f6ead3', 'center')
      .setOrigin(0.5)
      .setDepth(3);
    makePixelText(this, 640, 188, 'Chapter 3 begins where the tutorials end.', 20, '#cdbdcb', 'center')
      .setOrigin(0.5)
      .setDepth(3);
  }

  private renderDialogue(): void {
    const node = chapterThreeDialogue[this.index];
    if (!node || !this.speakerText || !this.bodyText) return;
    this.speakerText.setText(node.speaker);
    this.bodyText.setText(node.text);
    this.publishRuntime(node.id);
  }

  private advance(): void {
    const node = chapterThreeDialogue[this.index];
    if (node?.trigger === 'start-chapter-3' || this.index >= chapterThreeDialogue.length - 1) {
      writeSave({ ...loadSave(), currentCheckpoint: 'chapter3-hub' });
      this.scene.start(SceneKeys.Chapter3Hub);
      return;
    }
    this.index += 1;
    this.renderDialogue();
  }

  private publishRuntime(dialogueId: string): void {
    (window as Window & {
      __CODEJITSU_CHAPTER3_STORY?: {
        scene: string;
        dialogueId: string;
        startsMissionHub: boolean;
        at: number;
      };
    }).__CODEJITSU_CHAPTER3_STORY = {
      scene: 'chapter3-story',
      dialogueId,
      startsMissionHub: true,
      at: Math.round(performance.now()),
    };
  }
}
