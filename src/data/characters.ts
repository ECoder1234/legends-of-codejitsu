import type { CharacterDefinition } from '../types/game';

export const chapterOneCharacters: CharacterDefinition[] = [
  {
    id: 'apprentice',
    displayName: 'Apprentice',
    portraitKey: 'portrait-apprentice',
    animations: {
      idle: 'apprentice-idle',
      walk: 'apprentice-walk',
      swing: 'apprentice-swing',
      hurt: 'apprentice-hurt',
      defeat: 'apprentice-defeat',
    },
    defaultScale: 1.55,
    faction: 'hero',
  },
  {
    id: 'keiko',
    displayName: 'Master Keiko',
    portraitKey: 'portrait-keiko',
    animations: {
      idle: 'keiko-idle',
      walk: 'keiko-walk',
      gesture: 'keiko-gesture',
      talk: 'keiko-talk',
    },
    defaultScale: 1.45,
    faction: 'mentor',
  },
  {
    id: 'binary-sentinel',
    displayName: 'Binary Sentinel',
    portraitKey: 'portrait-sentinel',
    animations: {
      idle: 'sentinel-idle',
      walk: 'sentinel-walk',
      attack: 'sentinel-attack',
      hurt: 'sentinel-hurt',
      defeat: 'sentinel-defeat',
    },
    defaultScale: 1.25,
    faction: 'enemy',
  },
  {
    id: 'null-oni',
    displayName: 'Null Oni',
    portraitKey: 'portrait-null-oni',
    animations: {
      idle: 'oni-idle',
      walk: 'oni-walk',
      attack: 'oni-void-palm',
      slam: 'oni-mask-crash',
      hurt: 'oni-hurt',
      stagger: 'oni-stagger',
      defeat: 'oni-defeat',
    },
    defaultScale: 1.38,
    faction: 'boss',
  },
];
