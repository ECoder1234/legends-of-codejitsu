import { describe, expect, it } from 'vitest';
import { createPauseMenuState, selectPauseMenuAction, togglePauseMenu } from '../src/systems/pauseMenuEngine';

describe('pauseMenuEngine', () => {
  it('toggles pause state and records selected menu actions', () => {
    const open = togglePauseMenu(createPauseMenuState());
    expect(open.open).toBe(true);
    expect(selectPauseMenuAction(open, 'settings')).toEqual({ open: true, lastAction: 'settings' });
    expect(selectPauseMenuAction(open, 'exit-title')).toEqual({ open: false, lastAction: 'exit-title' });
  });
});
