import Phaser from 'phaser';
import { resumeAudio } from './ui';

export function installAudioUnlock(scene: Phaser.Scene): void {
  const unlock = () => resumeAudio(scene);
  scene.input.keyboard?.on('keydown', unlock);
  scene.input.on('pointerdown', unlock);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.input.keyboard?.off('keydown', unlock);
    scene.input.off('pointerdown', unlock);
  });
}
