import { describe, expect, it } from 'vitest';
import { createTutorialState, completeTutorialTrigger, getCurrentTutorialStep, isTutorialComplete } from '../src/systems/tutorialEngine';

describe('tutorialEngine', () => {
  it('advances only when the current trigger is completed', () => {
    let state = createTutorialState();
    expect(getCurrentTutorialStep(state)?.id).toBe('move');
    state = completeTutorialTrigger(state, 'swing');
    expect(getCurrentTutorialStep(state)?.id).toBe('move');
    state = completeTutorialTrigger(state, 'move');
    expect(getCurrentTutorialStep(state)?.id).toBe('face');
  });

  it('reaches completion after every tutorial trigger in order', () => {
    let state = createTutorialState();
    (['move', 'face', 'swing', 'terminal', 'cast'] as const).forEach((trigger) => {
      state = completeTutorialTrigger(state, trigger);
    });
    expect(isTutorialComplete(state)).toBe(true);
    expect(state.completedStepIds).toEqual(['move', 'face', 'swing', 'terminal', 'cast']);
  });
});
