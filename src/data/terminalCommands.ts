import type { TerminalCommandDefinition } from '../types/game';

export const terminalCommands: TerminalCommandDefinition[] = [
  {
    command: 'try.catch',
    abilityId: 'try-catch',
    aliases: ['trycatch', 'try catch'],
    lockedMessage: 'The vow is still sleeping.',
    successMessage: 'try.catch: hold the danger, then answer it.',
  },
  {
    command: 'loop.strike',
    abilityId: 'loop-strike',
    aliases: ['loopstrike', 'loop strike'],
    lockedMessage: 'Repeating force has not been mastered yet.',
    successMessage: 'loop.strike: repeat the cut until the pattern breaks.',
  },
  {
    command: 'array.split',
    abilityId: 'array-split',
    aliases: ['arraysplit', 'array split'],
    lockedMessage: 'The many-lane cut is beyond Chapter 1.',
    successMessage: 'array.split: one path becomes many blades.',
  },
  {
    command: 'debug.break',
    abilityId: 'debug-break',
    aliases: ['debugbreak', 'debug break'],
    lockedMessage: 'The pause between frames has not opened.',
    successMessage: 'debug.break: even cursed logic must stop breathing.',
  },
  {
    command: 'window.kill',
    abilityId: 'window-kill',
    aliases: ['windowkill', 'window kill'],
    lockedMessage: 'The final closing line is forbidden for now.',
    successMessage: 'window.kill: close the false world.',
  },
];

