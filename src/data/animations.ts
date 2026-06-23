import { TextureKeys } from '../scenes/sceneKeys';
import type { AnimationDefinition } from '../types/game';

export const chapterOneAnimationDefinitions: AnimationDefinition[] = [
  { key: 'apprentice-idle', textureKey: TextureKeys.Chapter1Characters, frame: { x: 38, y: 54, width: 112, height: 170 }, fps: 4, repeat: -1 },
  { key: 'apprentice-walk', textureKey: TextureKeys.Chapter1Characters, frame: { x: 288, y: 54, width: 124, height: 170 }, fps: 8, repeat: -1 },
  { key: 'apprentice-swing', textureKey: TextureKeys.Chapter1Characters, frame: { x: 664, y: 54, width: 210, height: 174 }, fps: 10, repeat: 0 },
  { key: 'keiko-idle', textureKey: TextureKeys.Chapter1Characters, frame: { x: 40, y: 340, width: 130, height: 188 }, fps: 4, repeat: -1 },
  { key: 'keiko-talk', textureKey: TextureKeys.Chapter1Characters, frame: { x: 620, y: 330, width: 210, height: 200 }, fps: 6, repeat: -1 },
  { key: 'sentinel-idle', textureKey: TextureKeys.Chapter1Characters, frame: { x: 38, y: 548, width: 104, height: 118 }, fps: 5, repeat: -1 },
  { key: 'sentinel-attack', textureKey: TextureKeys.Chapter1Characters, frame: { x: 590, y: 544, width: 150, height: 130 }, fps: 10, repeat: 0 },
  { key: 'sentinel-defeat', textureKey: TextureKeys.Chapter1Characters, frame: { x: 888, y: 560, width: 165, height: 112 }, fps: 8, repeat: 0 },
  { key: 'oni-idle', textureKey: TextureKeys.Chapter1Characters, frame: { x: 36, y: 720, width: 172, height: 284 }, fps: 4, repeat: -1 },
  { key: 'oni-walk', textureKey: TextureKeys.Chapter1Characters, frame: { x: 210, y: 720, width: 162, height: 284 }, fps: 7, repeat: -1 },
  { key: 'oni-void-palm', textureKey: TextureKeys.Chapter1Characters, frame: { x: 482, y: 706, width: 270, height: 300 }, fps: 10, repeat: 0 },
  { key: 'oni-stagger', textureKey: TextureKeys.Chapter1Characters, frame: { x: 924, y: 720, width: 190, height: 284 }, fps: 6, repeat: 0 },
  { key: 'oni-defeat', textureKey: TextureKeys.Chapter1Characters, frame: { x: 1016, y: 720, width: 200, height: 284 }, fps: 8, repeat: 0 },
];
