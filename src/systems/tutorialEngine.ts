import { chapterOneTutorialSteps } from '../data/tutorial';
import type { TutorialStep } from '../types/game';

export interface TutorialRuntimeState {
  stepIndex: number;
  completedStepIds: string[];
}

export function createTutorialState(): TutorialRuntimeState {
  return { stepIndex: 0, completedStepIds: [] };
}

export function getCurrentTutorialStep(state: TutorialRuntimeState): TutorialStep | undefined {
  return chapterOneTutorialSteps[state.stepIndex];
}

export function completeTutorialTrigger(state: TutorialRuntimeState, trigger: TutorialStep['trigger']): TutorialRuntimeState {
  const current = getCurrentTutorialStep(state);
  if (!current || current.trigger !== trigger) {
    return state;
  }

  return {
    stepIndex: Math.min(state.stepIndex + 1, chapterOneTutorialSteps.length),
    completedStepIds: [...state.completedStepIds, current.id],
  };
}

export function isTutorialComplete(state: TutorialRuntimeState): boolean {
  return state.stepIndex >= chapterOneTutorialSteps.length;
}

