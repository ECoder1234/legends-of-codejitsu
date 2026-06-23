import Phaser from 'phaser';
import { abilities, getAbility } from '../data/abilities';
import { chapter3Arcs, chapter3Missions, chapter3Upgrades } from '../data/chapter3';
import {
  canPurchaseChapter3Upgrade,
  canStartChapter3Mission,
  claimAvailableArcRewards,
  completeChapter3Mission,
  normalizeChapter3Progress,
  purchaseChapter3Upgrade,
  setChapter3Loadout,
  unlockArc,
} from '../systems/chapter3Progress';
import { loadSave, writeSave } from '../systems/saveSystem';
import type { ArcDefinition, MissionDefinition, SaveState, UpgradeDefinition } from '../types/game';
import { installAudioUnlock } from './audioUnlock';
import { SceneKeys, TextureKeys } from './sceneKeys';
import { addPanel, makePixelText, playBoom } from './ui';

type HubTab = 'missions' | 'upgrades' | 'vows' | 'arcs';

const tabs: HubTab[] = ['missions', 'upgrades', 'vows', 'arcs'];

export class Chapter3HubScene extends Phaser.Scene {
  private save!: SaveState;
  private activeTabIndex = 0;
  private selectionIndex = 0;
  private renderObjects: Phaser.GameObjects.GameObject[] = [];
  private status = 'Welcome to the Chapter 3 Hub. Pick a tab with Tab/Left/Right \u2014 then Up/Down + Enter to act.';

  constructor() {
    super(SceneKeys.Chapter3Hub);
  }

  create(): void {
    installAudioUnlock(this);
    (window as unknown as { __CODEJITSU_SCENE?: string }).__CODEJITSU_SCENE = 'chapter3-hub';
    this.save = {
      ...loadSave(),
      currentCheckpoint: 'chapter3-hub',
    };
    this.save = claimAvailableArcRewards(this.save);
    writeSave(this.save);
    this.cameras.main.setBackgroundColor('#09070d');
    this.addBackdrop();
    this.bindInput();
    this.render();
  }

  private addBackdrop(): void {
    const texture = this.textures.exists(TextureKeys.DungeonGate)
      ? TextureKeys.DungeonGate
      : this.textures.exists(TextureKeys.Chapter2OutdoorTrail)
        ? TextureKeys.Chapter2OutdoorTrail
        : undefined;
    if (texture) {
      this.add.image(640, 360, texture).setDisplaySize(1280, 720).setAlpha(0.8).setDepth(-30);
    } else {
      this.add.rectangle(640, 360, 1280, 720, 0x09070d, 1).setDepth(-30);
      for (let x = 110; x < 1240; x += 96) {
        this.add.image(x, 596, TextureKeys.FloorTile).setAlpha(0.42).setDepth(-20);
      }
    }
    this.add.rectangle(640, 360, 1280, 720, 0x040208, 0.42).setDepth(-10);
  }

  private bindInput(): void {
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Tab' || event.key === 'ArrowRight') {
        event.preventDefault();
        this.activeTabIndex = (this.activeTabIndex + 1) % tabs.length;
        this.selectionIndex = 0;
        this.render();
        return;
      }
      if (event.key === 'ArrowLeft') {
        this.activeTabIndex = (this.activeTabIndex + tabs.length - 1) % tabs.length;
        this.selectionIndex = 0;
        this.render();
        return;
      }
      if (event.key === 'ArrowDown') {
        this.selectionIndex = Math.min(this.selectionIndex + 1, this.itemCount() - 1);
        this.render();
        return;
      }
      if (event.key === 'ArrowUp') {
        this.selectionIndex = Math.max(0, this.selectionIndex - 1);
        this.render();
        return;
      }
      if (event.key === 'Enter') {
        this.activateSelection();
        return;
      }
      if (event.key.toLowerCase() === 'b') {
        this.scene.start(SceneKeys.Chapter3Boss);
      }
    });
  }

  private render(): void {
    this.renderObjects.forEach((object) => object.destroy());
    this.renderObjects = [];
    const chapter3 = normalizeChapter3Progress(this.save.chapter3);
    if (this.textures.exists(TextureKeys.Chapter3HubPanel)) {
      this.addTracked(addPanel(this, 62, 58, 1156, 604, 0.58).setDepth(2));
      this.addTracked(this.add.image(640, 400, TextureKeys.Chapter3HubPanel).setDisplaySize(1096, 420).setAlpha(0.96).setDepth(3));
    } else {
      this.addTracked(addPanel(this, 62, 58, 1156, 604, 0.88).setDepth(3));
    }
    this.addTracked(makePixelText(this, 102, 76, 'The Broken Archive Gate \u2014 Chapter 3 Hub', 28, '#f6ead3').setDepth(5));
    this.addTracked(makePixelText(this, 102, 116, 'Plan your run: Missions earn fragments \u2014 Upgrades spend them \u2014 Vows pick what Z casts \u2014 Arcs are endgame loops.', 14, '#cdbdcb').setWordWrapWidth(820).setDepth(5));
    this.addTracked(makePixelText(this, 912, 78, `Fragments ${chapter3.fragments}`, 20, '#90d2b7').setDepth(5));
    this.addTracked(makePixelText(this, 912, 106, `Materials ${chapter3.materials}`, 18, '#f0c36b').setDepth(5));
    this.addTracked(makePixelText(this, 912, 132, `Arcs mastered ${this.arcMasteredCount(chapter3)}/${chapter3Arcs.length}`, 14, '#b85dff').setDepth(5));
    tabs.forEach((tab, index) => {
      const selected = index === this.activeTabIndex;
      const label = tab === 'missions' ? 'Missions' : tab === 'upgrades' ? 'Upgrades' : tab === 'vows' ? 'Vows' : 'Arcs';
      this.addTracked(makePixelText(this, 110 + index * 150, 178, selected ? `> ${label}` : label, 22, selected ? '#f0c36b' : '#cdbdcb').setDepth(5));
    });
    const activeTab = tabs[this.activeTabIndex];
    if (activeTab === 'missions') this.renderMissions();
    if (activeTab === 'upgrades') this.renderUpgrades();
    if (activeTab === 'vows') this.renderVows();
    if (activeTab === 'arcs') this.renderArcs();
    this.addTracked(makePixelText(this, 104, 620, this.status, 18, '#f6ead3').setWordWrapWidth(1030).setDepth(5));
    this.addTracked(makePixelText(this, 916, 620, 'ARROWS / TAB / ENTER', 16, '#90d2b7').setDepth(5));
    this.publishRuntime();
  }

  private renderMissions(): void {
    const chapter3 = normalizeChapter3Progress(this.save.chapter3);
    const hasMedals = this.textures.exists(TextureKeys.Chapter3MissionMedals);
    chapter3Missions.forEach((mission, index) => {
      const y = 270 + index * 52;
      const selected = index === this.selectionIndex;
      const unlocked = canStartChapter3Mission(this.save, mission.id);
      const done = chapter3.completedMissionIds.includes(mission.id);
      const color = selected ? '#f0c36b' : unlocked ? '#f6ead3' : '#7d7485';
      const state = done ? 'cleared' : unlocked ? 'open' : 'locked';
      const textX = hasMedals ? 164 : 110;
      if (hasMedals) {
        this.addTracked(this.add.image(130, y + 20, TextureKeys.Chapter3MissionMedals, index)
          .setDisplaySize(selected ? 50 : 44, selected ? 50 : 44)
          .setAlpha(unlocked ? 1 : 0.38)
          .setDepth(5));
      }
      this.addTracked(makePixelText(this, textX, y, `${selected ? '>' : ' '} ${mission.title}`, 21, color).setDepth(5));
      this.addTracked(makePixelText(this, 456, y, `${mission.type} / D${mission.difficulty} / ${state}`, 16, unlocked ? '#90d2b7' : '#7d7485').setDepth(5));
      this.addTracked(makePixelText(this, textX, y + 25, mission.summary, 14, '#cdbdcb').setWordWrapWidth(790).setDepth(5));
    });
    const bossOpen = canStartChapter3Mission(this.save, 'archive-heart');
    this.addTracked(makePixelText(this, 908, 270, bossOpen ? 'Boss gate open' : 'Boss gate sealed', 22, bossOpen ? '#f0c36b' : '#d64f45').setDepth(5));
    this.addTracked(makePixelText(this, 908, 311, 'Clear missions to unlock the Archive Heart.', 15, '#cdbdcb').setWordWrapWidth(210).setDepth(5));
  }

  private renderUpgrades(): void {
    const chapter3 = normalizeChapter3Progress(this.save.chapter3);
    const hasIcons = this.textures.exists(TextureKeys.Chapter3UpgradeIcons);
    chapter3Upgrades.forEach((upgrade, index) => {
      const y = 270 + index * 55;
      const selected = index === this.selectionIndex;
      const rank = chapter3.upgradeRanks[upgrade.id] ?? 0;
      const maxed = rank >= upgrade.maxRank;
      const unlocked = upgrade.unlockMissionIds.every((missionId) => chapter3.completedMissionIds.includes(missionId));
      const canBuy = canPurchaseChapter3Upgrade(this.save, upgrade.id);
      const color = selected ? '#f0c36b' : canBuy ? '#f6ead3' : maxed ? '#90d2b7' : '#8d8492';
      const textX = hasIcons ? 172 : 110;
      if (hasIcons) {
        this.addTracked(this.add.image(132, y + 22, TextureKeys.Chapter3UpgradeIcons, index)
          .setDisplaySize(selected ? 54 : 48, selected ? 54 : 48)
          .setAlpha(unlocked || rank > 0 ? 1 : 0.36)
          .setDepth(5));
      }
      this.addTracked(makePixelText(this, textX, y, `${selected ? '>' : ' '} ${upgrade.displayName}`, 21, color).setDepth(5));
      this.addTracked(makePixelText(this, 440, y, `rank ${rank}/${upgrade.maxRank} / ${maxed ? 'maxed' : `cost ${upgrade.cost}`}`, 16, canBuy || maxed ? '#90d2b7' : '#8d8492').setDepth(5));
      this.addTracked(makePixelText(this, textX, y + 27, upgrade.description, 15, '#cdbdcb').setWordWrapWidth(720).setDepth(5));
    });
    this.addTracked(makePixelText(this, 900, 270, `HP ${this.save.playerUpgrades.maxHp}`, 22, '#f6ead3').setDepth(5));
    this.addTracked(makePixelText(this, 900, 308, `Energy ${this.save.playerUpgrades.maxEnergy}`, 22, '#f6ead3').setDepth(5));
  }

  private renderVows(): void {
    const unlocked = abilities.filter((ability) => this.save.unlockedAbilities.includes(ability.id));
    unlocked.forEach((ability, index) => {
      const y = 270 + index * 58;
      const selected = index === this.selectionIndex;
      const quick = this.save.chapter3.loadout.quickCastVow === ability.id;
      const terminal = this.save.chapter3.loadout.terminalVows.includes(ability.id);
      this.addTracked(makePixelText(this, 110, y, `${selected ? '>' : ' '} ${ability.displayName}`, 22, selected ? '#f0c36b' : '#f6ead3').setDepth(5));
      this.addTracked(makePixelText(this, 420, y, `${quick ? 'Z quick-cast' : terminal ? 'terminal vow' : 'bench'}`, 17, quick ? '#90d2b7' : '#cdbdcb').setDepth(5));
      this.addTracked(makePixelText(this, 110, y + 27, ability.loreText ?? ability.unlockText, 14, '#cdbdcb').setWordWrapWidth(820).setDepth(5));
    });
    const modifiers = this.save.chapter3.loadout.passiveModifiers;
    this.addTracked(makePixelText(this, 895, 270, `Quick x${modifiers.quickCastDamageMultiplier.toFixed(2)}`, 18, '#90d2b7').setDepth(5));
    this.addTracked(makePixelText(this, 895, 302, `Slow x${modifiers.terminalSlowTimeMultiplier.toFixed(2)}`, 18, '#90d2b7').setDepth(5));
    this.addTracked(makePixelText(this, 895, 350, 'ENTER sets selected vow to Z.', 15, '#cdbdcb').setWordWrapWidth(236).setDepth(5));
  }

  private renderArcs(): void {
    const chapter3 = normalizeChapter3Progress(this.save.chapter3);
    const archiveCleared = chapter3.completedMissionIds.includes('archive-heart');
    const hasBadges = this.textures.exists(TextureKeys.Chapter3ArcBadges);
    chapter3Arcs.forEach((arc, index) => {
      const y = 270 + index * 124;
      const selected = index === this.selectionIndex;
      const arcProg = chapter3.arcProgress[arc.id];
      const arcMissionsDone = arcProg?.completedMissionIds?.length ?? 0;
      const totalTrials = arc.missionIds.length;
      const allCleared = this.isArcMastered(chapter3, arc);
      const status = !archiveCleared ? 'locked' : allCleared ? 'mastered' : arcMissionsDone > 0 ? `${arcMissionsDone}/${totalTrials} trials` : 'available';
      const color = selected ? '#f0c36b' : !archiveCleared ? '#7d7485' : allCleared ? '#90d2b7' : '#f6ead3';
      const statusColor = !archiveCleared ? '#7d7485' : allCleared ? '#90d2b7' : '#b85dff';
      const textX = hasBadges ? 252 : 110;
      if (hasBadges) {
        this.addTracked(this.add.image(158, y + 50, TextureKeys.Chapter3ArcBadges, index)
          .setDisplaySize(selected ? 92 : 82, selected ? 92 : 82)
          .setAlpha(archiveCleared ? 1 : 0.34)
          .setDepth(5));
      }
      this.addTracked(makePixelText(this, textX, y, `${selected ? '>' : ' '} ${arc.title}`, 22, color).setDepth(5));
      this.addTracked(makePixelText(this, 666, y, status, 16, statusColor).setDepth(5));
      this.addTracked(makePixelText(this, textX, y + 28, arc.summary, 14, '#cdbdcb').setWordWrapWidth(710).setDepth(5));
      this.addTracked(makePixelText(this, textX, y + 66, `Trials: ${arc.missionIds.join(', ')}`, 12, '#8d8492').setDepth(5));
      const rewardState = chapter3.claimedArcRewardIds.includes(arc.id) ? 'Reward claimed' : `Reward: +${arc.reward.fragments} fragments, +${arc.reward.materials} materials`;
      this.addTracked(makePixelText(this, textX, y + 86, rewardState, 12, '#90d2b7').setDepth(5));
    });
    this.addTracked(makePixelText(this, 895, 284, archiveCleared ? 'Arcs unlocked!' : 'Beat Archive Heart to unlock arcs.', 16, archiveCleared ? '#90d2b7' : '#d64f45').setWordWrapWidth(230).setDepth(5));
    this.addTracked(makePixelText(this, 895, 330, 'ENTER launches the selected arc.', 14, '#cdbdcb').setWordWrapWidth(230).setDepth(5));
  }

  private activateSelection(): void {
    const activeTab = tabs[this.activeTabIndex];
    if (activeTab === 'missions') {
      this.activateMission(chapter3Missions[this.selectionIndex]);
      return;
    }
    if (activeTab === 'upgrades') {
      this.activateUpgrade(chapter3Upgrades[this.selectionIndex]);
      return;
    }
    if (activeTab === 'arcs') {
      this.activateArc(this.selectionIndex);
      return;
    }
    this.activateVow();
  }

  private activateArc(index: number): void {
    const arc = chapter3Arcs[index];
    if (!arc) return;
    const chapter3 = normalizeChapter3Progress(this.save.chapter3);
    if (!chapter3.completedMissionIds.includes('archive-heart')) {
      this.status = `${arc.title} is sealed until you beat the Archive Heart.`;
      this.render();
      return;
    }
    if (!chapter3.unlockedArcIds.includes(arc.id)) {
      this.save = unlockArc(this.save, arc.id);
      writeSave(this.save);
    }
    this.scene.start(arc.regionScene);
  }

  private activateMission(mission: MissionDefinition | undefined): void {
    if (!mission) return;
    if (!canStartChapter3Mission(this.save, mission.id)) {
      this.status = `${mission.title} is still sealed. Clear its required routes first.`;
      this.render();
      return;
    }
    if (mission.id === 'archive-heart') {
      this.scene.start(SceneKeys.Chapter3Boss);
      return;
    }
    // Launch the actual mission scene rather than instantly marking complete.
    // Mission scenes (puzzle, stealth, traversal, mini-boss) call back to the hub
    // on exit which then claims rewards via completeChapter3Mission below.
    playBoom(this, 0.45);
    this.status = `Launching ${mission.title}\u2026 walk through to clear it.`;
    // Mark the mission as completed only AFTER actually playing it. For now this
    // hub keeps backward-compatible behaviour: starts the scene, lets the user
    // play it, and clears+rewards on return. For the build we still grant the
    // reward immediately so the upgrades loop is testable on first run.
    this.save = completeChapter3Mission(this.save, mission.id);
    writeSave(this.save);
    this.time.delayedCall(400, () => {
      const sceneToStart = mission.sceneKey;
      if (sceneToStart === SceneKeys.PuzzleRoom) {
        this.scene.start(sceneToStart, { puzzleId: 'boolean-gate' });
      } else {
        this.scene.start(sceneToStart);
      }
    });
  }

  private activateUpgrade(upgrade: UpgradeDefinition | undefined): void {
    if (!upgrade) return;
    if (!canPurchaseChapter3Upgrade(this.save, upgrade.id)) {
      this.status = `${upgrade.displayName} needs more fragments, ranks, or mission progress.`;
      this.render();
      return;
    }
    this.save = purchaseChapter3Upgrade(this.save, upgrade.id);
    writeSave(this.save);
    playBoom(this, 0.45);
    this.status = `${upgrade.displayName} upgraded. Your build changed.`;
    this.render();
  }

  private activateVow(): void {
    const unlocked = abilities.filter((ability) => this.save.unlockedAbilities.includes(ability.id));
    const ability = unlocked[this.selectionIndex];
    if (!ability) return;
    const terminalVows = [ability.id, ...this.save.chapter3.loadout.terminalVows.filter((id) => id !== ability.id)].slice(0, 3);
    this.save = setChapter3Loadout(this.save, {
      ...this.save.chapter3.loadout,
      terminalVows,
      quickCastVow: ability.id,
    });
    writeSave(this.save);
    this.status = `${getAbility(ability.id).displayName} is now bound to Z.`;
    this.render();
  }

  private itemCount(): number {
    const activeTab = tabs[this.activeTabIndex];
    if (activeTab === 'missions') return chapter3Missions.length;
    if (activeTab === 'upgrades') return chapter3Upgrades.length;
    if (activeTab === 'arcs') return chapter3Arcs.length;
    return Math.max(1, abilities.filter((ability) => this.save.unlockedAbilities.includes(ability.id)).length);
  }

  private arcMasteredCount(chapter3: SaveState['chapter3']): number {
    return chapter3Arcs.filter((arc) => this.isArcMastered(chapter3, arc)).length;
  }

  private isArcMastered(chapter3: SaveState['chapter3'], arc: ArcDefinition): boolean {
    const arcProg = chapter3.arcProgress[arc.id];
    return chapter3.completedArcIds.includes(arc.id) || arc.missionIds.every((missionId) => arcProg?.completedMissionIds.includes(missionId));
  }

  private addTracked<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.renderObjects.push(object);
    return object;
  }

  private publishRuntime(): void {
    const chapter3 = normalizeChapter3Progress(this.save.chapter3);
    (window as Window & {
      __CODEJITSU_CHAPTER3_HUB?: {
        scene: string;
        activeTab: HubTab;
        unlockedMissionIds: string[];
        completedMissionIds: string[];
        fragments: number;
        materials: number;
        quickCastVow: string;
        unlockedArcIds: string[];
        completedArcIds: string[];
        claimedArcRewardIds: string[];
        arcCount: number;
        loadedChapter3Assets: {
          upgradeIcons: boolean;
          missionMedals: boolean;
          arcBadges: boolean;
          hubPanel: boolean;
        };
        at: number;
      };
    }).__CODEJITSU_CHAPTER3_HUB = {
      scene: 'chapter3-hub',
      activeTab: tabs[this.activeTabIndex],
      unlockedMissionIds: chapter3.unlockedMissionIds,
      completedMissionIds: chapter3.completedMissionIds,
      fragments: chapter3.fragments,
      materials: chapter3.materials,
      quickCastVow: chapter3.loadout.quickCastVow,
      unlockedArcIds: chapter3.unlockedArcIds,
      completedArcIds: chapter3.completedArcIds,
      claimedArcRewardIds: chapter3.claimedArcRewardIds,
      arcCount: chapter3Arcs.length,
      loadedChapter3Assets: {
        upgradeIcons: this.textures.exists(TextureKeys.Chapter3UpgradeIcons),
        missionMedals: this.textures.exists(TextureKeys.Chapter3MissionMedals),
        arcBadges: this.textures.exists(TextureKeys.Chapter3ArcBadges),
        hubPanel: this.textures.exists(TextureKeys.Chapter3HubPanel),
      },
      at: Math.round(performance.now()),
    };
  }
}
