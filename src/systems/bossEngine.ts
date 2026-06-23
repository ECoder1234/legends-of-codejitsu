import type { BossAttackDefinition, BossDefinition, BossPhaseDefinition } from '../types/game';

export interface BossRuntimeState {
  hp: number;
  stagger: number;
  phaseIndex: number;
  defeated: boolean;
}

export function createBossState(boss: BossDefinition): BossRuntimeState {
  return {
    hp: boss.maxHp,
    stagger: 0,
    phaseIndex: 0,
    defeated: false,
  };
}

export function getBossPhase(boss: BossDefinition, state: BossRuntimeState): BossPhaseDefinition {
  const hpPercent = state.hp / boss.maxHp;
  const phases = boss.phases.length > 0 ? boss.phases : [{ startsAtHpPercent: 1, speed: 64, attacks: [] }];
  let selected = phases[0];
  for (const phase of phases) {
    if (hpPercent <= phase.startsAtHpPercent) {
      selected = phase;
    }
  }
  return selected;
}

export function applyBossDamage(
  boss: BossDefinition,
  state: BossRuntimeState,
  damage: number,
): BossRuntimeState {
  const hp = Math.max(0, state.hp - damage);
  const stagger = Math.min(boss.staggerDamage, state.stagger + damage);
  const phase = getBossPhase(boss, { ...state, hp });
  const phaseIndex = Math.max(0, boss.phases.indexOf(phase));
  return {
    hp,
    stagger,
    phaseIndex,
    defeated: hp <= 0,
  };
}

export function isBossStaggered(boss: BossDefinition, state: BossRuntimeState): boolean {
  return state.stagger >= boss.staggerDamage;
}

export function resetBossStagger(state: BossRuntimeState): BossRuntimeState {
  return { ...state, stagger: 0 };
}

export function chooseBossAttack(
  boss: BossDefinition,
  state: BossRuntimeState,
  attackCounter: number,
): BossAttackDefinition | undefined {
  const attacks = getBossPhase(boss, state).attacks;
  if (attacks.length === 0) {
    return undefined;
  }
  return attacks[attackCounter % attacks.length];
}
