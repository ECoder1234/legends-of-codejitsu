export type PauseMenuAction = 'resume' | 'settings' | 'exit-title' | 'back';

export interface PauseMenuState {
  open: boolean;
  lastAction?: PauseMenuAction;
}

export function createPauseMenuState(): PauseMenuState {
  return { open: false };
}

export function togglePauseMenu(state: PauseMenuState): PauseMenuState {
  return { ...state, open: !state.open };
}

export function selectPauseMenuAction(state: PauseMenuState, action: PauseMenuAction): PauseMenuState {
  return {
    open: action === 'settings' || action === 'back',
    lastAction: action,
  };
}
