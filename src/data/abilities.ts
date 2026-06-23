import type { AbilityDefinition } from '../types/game';

export const abilities: AbilityDefinition[] = [
  {
    id: 'try-catch',
    displayName: 'try.catch',
    syntaxTokens: ['try', 'catch'],
    cooldownMs: 4800,
    energyCost: 18,
    comboRequirement: 0,
    effectType: 'counter',
    animationKey: 'ability-counter',
    hitbox: { width: 108, height: 82, offsetX: 34, offsetY: 0, durationMs: 220, damage: 26 },
    unlockText: 'A guard-counter pulse: heals your guard, staggers nearby enemies, and still cuts bosses.',
    loreText: 'A vow of survival: name the danger, catch its sigil, heal your guard, and answer with a counter pulse.',
  },
  {
    id: 'loop-strike',
    displayName: 'loop.strike',
    syntaxTokens: ['loop', 'strike'],
    cooldownMs: 5800,
    energyCost: 24,
    comboRequirement: 2,
    effectType: 'dash-strike',
    animationKey: 'ability-dash',
    hitbox: { width: 156, height: 68, offsetX: 70, offsetY: 0, durationMs: 260, damage: 38 },
    unlockText: 'A repeated dash cut that damages every echo caught in the loop and punishes predictable bosses.',
    loreText: 'A vow of rhythm: repeat only what still has purpose.',
  },
  {
    id: 'array-split',
    displayName: 'array.split',
    syntaxTokens: ['array', 'split'],
    cooldownMs: 6800,
    energyCost: 30,
    comboRequirement: 3,
    effectType: 'split-slash',
    animationKey: 'ability-split',
    hitbox: { width: 200, height: 116, offsetX: 82, offsetY: 0, durationMs: 280, damage: 48 },
    unlockText: 'A clone slash that divides one answer into many cuts.',
    loreText: 'A vow of division: one path splits into every lane the enemy forgot to guard.',
  },
  {
    id: 'debug-break',
    displayName: 'debug.break',
    syntaxTokens: ['debug', 'break'],
    cooldownMs: 8800,
    energyCost: 36,
    comboRequirement: 3,
    effectType: 'freeze',
    animationKey: 'ability-freeze',
    hitbox: { width: 250, height: 170, offsetX: 0, offsetY: 0, durationMs: 520, damage: 22 },
    unlockText: 'A breath between frames. Even cursed logic must pause.',
    loreText: 'A vow of stillness: place a finger on the world and make the curse wait.',
  },
  {
    id: 'window-kill',
    displayName: 'window.kill',
    syntaxTokens: ['window', 'kill'],
    cooldownMs: 12000,
    energyCost: 50,
    comboRequirement: 4,
    effectType: 'execute',
    animationKey: 'ability-execute',
    hitbox: { width: 220, height: 138, offsetX: 92, offsetY: 0, durationMs: 360, damage: 92 },
    unlockText: 'The forbidden closing line. Only mercy keeps it from ruin.',
    loreText: 'A vow of ending: close only the window that should never have opened.',
  },
];

export function getAbility(id: string): AbilityDefinition {
  const ability = abilities.find((entry) => entry.id === id);
  if (!ability) {
    throw new Error(`Unknown ability: ${id}`);
  }
  return ability;
}
