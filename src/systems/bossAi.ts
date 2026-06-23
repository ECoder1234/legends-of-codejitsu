export type BossCombatStance = 'hunter' | 'duelist' | 'unstable' | 'cornered';

export interface BossAiInput {
  hpPercent: number;
  phaseIndex: number;
  distanceToPlayer: number;
  terminalCastUsed: boolean;
  queuedComboCount: number;
  isStaggered: boolean;
}

export interface BossAiProfile {
  stance: BossCombatStance;
  moveSpeedMultiplier: number;
  orbitStrength: number;
  desiredDistance: number;
  attackDelayMs: number;
  comboEvery: number;
  pressureText: string;
  warningColor: number;
}

export function createBossAiProfile(input: BossAiInput): BossAiProfile {
  if (input.isStaggered) {
    return {
      stance: 'duelist',
      moveSpeedMultiplier: 0,
      orbitStrength: 0,
      desiredDistance: 126,
      attackDelayMs: 1320,
      comboEvery: 4,
      pressureText: 'mask cracked: punish window',
      warningColor: 0xf0c36b,
    };
  }

  if (input.hpPercent <= 0.24) {
    return {
      stance: 'cornered',
      moveSpeedMultiplier: 1.28,
      orbitStrength: 0.46,
      desiredDistance: 96,
      attackDelayMs: input.terminalCastUsed ? 720 : 860,
      comboEvery: 2,
      pressureText: 'cornered: desperate chained cuts',
      warningColor: 0xd64f45,
    };
  }

  if (input.phaseIndex >= 1 || input.queuedComboCount > 0) {
    return {
      stance: 'unstable',
      moveSpeedMultiplier: 1.16,
      orbitStrength: 0.34,
      desiredDistance: 112,
      attackDelayMs: input.distanceToPlayer < 150 ? 820 : 940,
      comboEvery: 2,
      pressureText: 'unstable: recursive follow-ups',
      warningColor: 0xb85dff,
    };
  }

  if (input.distanceToPlayer < 132) {
    return {
      stance: 'duelist',
      moveSpeedMultiplier: 0.82,
      orbitStrength: 0.52,
      desiredDistance: 132,
      attackDelayMs: 1120,
      comboEvery: 3,
      pressureText: 'duelist: waits for a bad swing',
      warningColor: 0x8f7dff,
    };
  }

  return {
    stance: 'hunter',
    moveSpeedMultiplier: 1,
    orbitStrength: 0.18,
    desiredDistance: 118,
    attackDelayMs: 1020,
    comboEvery: 3,
    pressureText: 'hunter: closing the empty lane',
    warningColor: 0xf6ead3,
  };
}

export function shouldQueueBossCombo(profile: BossAiProfile, attackCounter: number): boolean {
  return attackCounter % profile.comboEvery === 0;
}
