import Phaser from 'phaser';
import './styles.css';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { StoryScene } from './scenes/StoryScene';
import { TutorialScene } from './scenes/TutorialScene';
import { DungeonScene } from './scenes/DungeonScene';
import { BossScene } from './scenes/BossScene';
import { VictoryDialogueScene } from './scenes/VictoryDialogueScene';
import { Chapter2StoryScene } from './scenes/Chapter2StoryScene';
import { Chapter2TrailScene } from './scenes/Chapter2TrailScene';
import { ResultScene } from './scenes/ResultScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  backgroundColor: '#09070d',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
  },
  audio: {
    disableWebAudio: true,
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
      gravity: { x: 0, y: 0 },
    },
  },
  scene: [BootScene, TitleScene, StoryScene, TutorialScene, DungeonScene, BossScene, VictoryDialogueScene, Chapter2StoryScene, Chapter2TrailScene, ResultScene],
};

const game = new Phaser.Game(config);
(window as unknown as { __GAME__: Phaser.Game }).__GAME__ = game;
