import type { TutorialStep } from '../types/game';

export const chapterOneTutorialSteps: TutorialStep[] = [
  {
    id: 'move',
    trigger: 'move',
    instructionText: 'WASD: move to the glowing seal. Movement keeps you alive.',
    completionCondition: 'player enters the marked tile and learns movement',
    highlightTarget: 'archive-tile',
  },
  {
    id: 'face',
    trigger: 'face',
    instructionText: 'Step into the line and face the echo before striking.',
    completionCondition: 'player enters the practice line and faces the target',
    highlightTarget: 'practice-line',
  },
  {
    id: 'swing',
    trigger: 'swing',
    instructionText: 'Press X twice; clean spacing breaks the vow target.',
    completionCondition: 'player breaks the vow target with X swings',
    highlightTarget: 'dummy',
  },
  {
    id: 'terminal',
    trigger: 'terminal',
    instructionText: 'Press T; the terminal slows time so you can type.',
    completionCondition: 'terminal opens and time slows',
    highlightTarget: 'terminal',
  },
  {
    id: 'cast',
    trigger: 'cast',
    instructionText: 'Type try.catch then Enter; it counters and heals.',
    completionCondition: 'try.catch casts as the first Codejitsu line',
    highlightTarget: 'terminal',
  },
];
