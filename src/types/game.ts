export type AbilityEffectType = 'counter' | 'dash-strike' | 'split-slash' | 'freeze' | 'execute';

export interface HitboxDefinition {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  durationMs: number;
  damage: number;
}

export interface AbilityDefinition {
  id: string;
  displayName: string;
  syntaxTokens: string[];
  cooldownMs: number;
  energyCost: number;
  comboRequirement: number;
  effectType: AbilityEffectType;
  animationKey: string;
  hitbox: HitboxDefinition;
  unlockText: string;
  loreText?: string;
}

export interface CharacterDefinition {
  id: string;
  displayName: string;
  portraitKey: string;
  animations: Record<string, string>;
  defaultScale: number;
  faction: 'hero' | 'mentor' | 'enemy' | 'boss';
}

export interface AnimationDefinition {
  key: string;
  textureKey: string;
  frame: { x: number; y: number; width: number; height: number };
  fps: number;
  repeat: number;
}

export interface TerminalCommandDefinition {
  command: string;
  abilityId: string;
  aliases: string[];
  lockedMessage: string;
  successMessage: string;
}

export interface TutorialStep {
  id: string;
  trigger: 'move' | 'face' | 'swing' | 'terminal' | 'cast';
  instructionText: string;
  completionCondition: string;
  highlightTarget?: string;
}

export interface BossAttackDefinition {
  id: string;
  name: string;
  castLine?: string;
  phaseRole?: string;
  movementTell?: string;
  bossMotion?: string;
  counterStyle?: string;
  comboRole?: 'opener' | 'follow-up' | 'trap' | 'finisher' | 'phase-breaker';
  dangerLayers?: string[];
  counterRhythm?: string;
  commandHint?: string;
  phaseShift?: string;
  tellText?: string;
  techniqueTokens?: string[];
  movementHint?: string;
  punishHint?: string;
  threatLevel?: 1 | 2 | 3 | 4 | 5;
  shape: 'burst' | 'ring' | 'lane' | 'multi-burst';
  behavior?: 'tracking-palm' | 'mask-ring' | 'lane-sweep' | 'rift-chain' | 'mirror-step' | 'binary-cage' | 'void-cleave' | 'null-crosscut' | 'null-pursuit';
  laneAxis?: 'horizontal' | 'vertical' | 'adaptive';
  windupMs: number;
  activeMs: number;
  recoverMs: number;
  damage: number;
  radius: number;
  width?: number;
  pulses?: number;
  warningColor: number;
  counterWindowMs?: number;
  arenaEffect?: string;
  aftershock?: {
    delayMs: number;
    radiusScale: number;
    damageScale: number;
  };
}

export interface BossPhaseDefinition {
  startsAtHpPercent: number;
  speed: number;
  attacks: BossAttackDefinition[];
}

export interface BossDefinition {
  id: string;
  chapter: number;
  displayName: string;
  subtitle: string;
  maxHp: number;
  staggerDamage: number;
  unlockReward: string;
  phases: BossPhaseDefinition[];
  dialogueBeats: string[];
}

export interface DialogueNode {
  id: string;
  speaker: string;
  portrait: string;
  text: string;
  nextId?: string;
  trigger?: 'start-dungeon' | 'start-boss' | 'return-hub' | 'start-chapter-2' | 'start-chapter-2-boss' | 'start-chapter-3';
}

export type MissionType = 'combat-contract' | 'puzzle-shrine' | 'stealth-recovery' | 'traversal-breach' | 'mini-boss-gate' | 'story-boss';

export interface MissionDefinition {
  id: string;
  title: string;
  type: MissionType;
  difficulty: number;
  sceneKey: string;
  requiredMissionIds: string[];
  reward: {
    fragments: number;
    materials: number;
    abilityId?: string;
    unlockArcId?: string;
  };
  replayable: boolean;
  summary: string;
}

export interface UpgradeDefinition {
  id: string;
  displayName: string;
  cost: number;
  maxRank: number;
  stat: 'maxHp' | 'maxEnergy' | 'vowCooldown' | 'swordComboGain' | 'terminalSlowTime' | 'quickCastPower' | 'recoveryWindow';
  amountPerRank: number;
  unlockMissionIds: string[];
  description: string;
}

export interface VowLoadoutDefinition {
  terminalVows: string[];
  quickCastVow: string;
  passiveModifiers: {
    cooldownMultiplier: number;
    quickCastDamageMultiplier: number;
    terminalSlowTimeMultiplier: number;
  };
}

export interface ArcDefinition {
  id: string;
  title: string;
  entryChapter: number;
  regionScene: string;
  missionIds: string[];
  bossIds: string[];
  reward: {
    fragments: number;
    materials: number;
    abilityId?: string;
  };
  saveNamespace: string;
  summary: string;
}

export interface Chapter3Progress {
  unlockedMissionIds: string[];
  completedMissionIds: string[];
  claimedMissionRewardIds: string[];
  completedArcIds: string[];
  claimedArcRewardIds: string[];
  discoveredSecretIds: string[];
  fragments: number;
  materials: number;
  upgradeRanks: Record<string, number>;
  loadout: VowLoadoutDefinition;
  unlockedArcIds: string[];
  arcProgress: Record<string, {
    unlocked: boolean;
    completedMissionIds: string[];
    clearedBossIds: string[];
  }>;
}

export interface SaveState {
  unlockedAbilities: string[];
  clearedChapters: number[];
  playerUpgrades: {
    maxHp: number;
    maxEnergy: number;
  };
  abilityKeyBinding: string;
  abilityKeyUnlocked: boolean;
  boundAbilityId: string;
  currentCheckpoint: 'title' | 'story' | 'tutorial' | 'hub' | 'dungeon' | 'boss' | 'chapter2-story' | 'chapter2-trail' | 'chapter2-boss' | 'chapter3-story' | 'chapter3-hub' | 'chapter3-boss' | 'arc-fractured-openworld' | 'arc-silent-codex';
  chapter3: Chapter3Progress;
}

export interface CombatantStats {
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
}
