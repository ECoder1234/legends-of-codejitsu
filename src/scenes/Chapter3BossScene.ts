import Phaser from 'phaser';
import { getAbility } from '../data/abilities';
import { completeChapter3Mission, normalizeChapter3Progress } from '../systems/chapter3Progress';
import { loadSave, writeSave } from '../systems/saveSystem';
import type { SaveState } from '../types/game';
import { addAdvancePromptSeal } from './advancePromptSeal';
import { installAudioUnlock } from './audioUnlock';
import { publishTextPanelAudit } from './layoutAudit';
import { SceneKeys, TextureKeys } from './sceneKeys';
import { addPanel, makePixelText, playBoom } from './ui';

export class Chapter3BossScene extends Phaser.Scene {
  private save!: SaveState;
  private bossHp = 150;
  private playerHp = 100;
  private combo = 0;
  private phase = 1;
  private status = 'Phase 1: build combo with X.';
  private titleText?: Phaser.GameObjects.Text;
  private hpText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private comboText?: Phaser.GameObjects.Text;
  private bossCore?: Phaser.GameObjects.Ellipse;
  private defeated = false;

  constructor() {
    super(SceneKeys.Chapter3Boss);
  }

  create(): void {
    installAudioUnlock(this);
    (window as unknown as { __CODEJITSU_SCENE?: string }).__CODEJITSU_SCENE = 'chapter3-boss';
    this.save = { ...loadSave(), currentCheckpoint: 'chapter3-boss' };
    this.save.chapter3 = normalizeChapter3Progress(this.save.chapter3);
    writeSave(this.save);
    this.playerHp = this.save.playerUpgrades.maxHp;
    this.cameras.main.setBackgroundColor('#09070d');
    this.addBackdrop();
    this.addBossPresentation();
    this.bindInput();
    this.refreshHud();
  }

  private addBackdrop(): void {
    const texture = this.textures.exists(TextureKeys.NullGateAntechamber)
      ? TextureKeys.NullGateAntechamber
      : this.textures.exists(TextureKeys.Chapter2RevengeArena)
        ? TextureKeys.Chapter2RevengeArena
        : this.textures.exists(TextureKeys.NullOniArena)
          ? TextureKeys.NullOniArena
          : undefined;
    if (texture) {
      this.add.image(640, 360, texture).setDisplaySize(1280, 720).setAlpha(0.9).setDepth(-30);
    } else {
      this.add.rectangle(640, 360, 1280, 720, 0x0d0711, 1).setDepth(-30);
      for (let x = 90; x < 1240; x += 92) {
        this.add.image(x, 580, TextureKeys.FloorTile).setAlpha(0.52).setDepth(-20);
      }
    }
    this.add.rectangle(640, 360, 1280, 720, 0x030107, 0.3).setDepth(-10);
  }

  private addBossPresentation(): void {
    addPanel(this, 72, 56, 1136, 112, 0.86).setDepth(5);
    this.titleText = makePixelText(this, 112, 86, 'Archive Heart', 34, '#f6ead3').setDepth(7);
    this.hpText = makePixelText(this, 890, 92, '', 22, '#f0c36b').setDepth(7);
    addPanel(this, 94, 516, 1092, 112, 0.86).setDepth(5);
    this.statusText = makePixelText(this, 132, 548, '', 21, '#f6ead3').setWordWrapWidth(780).setDepth(7);
    this.comboText = makePixelText(this, 922, 548, '', 18, '#90d2b7').setDepth(7);
    this.bossCore = this.add.ellipse(640, 330, 220, 220, 0xb85dff, 0.28)
      .setStrokeStyle(5, 0xf0c36b, 0.82)
      .setDepth(3);
    this.add.ellipse(640, 330, 330, 120, 0x90d2b7, 0.08).setDepth(2);
    this.tweens.add({
      targets: this.bossCore,
      scaleX: 1.08,
      scaleY: 0.94,
      alpha: { from: 0.38, to: 0.7 },
      duration: 860,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    makePixelText(this, 132, 604, 'X sword combo / T terminal vow / Z quick-cast', 16, '#cdbdcb').setDepth(7);
  }

  private bindInput(): void {
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (this.defeated) return;
      const key = event.key.toLowerCase();
      if (key === 'x') this.swordStrike();
      if (key === 't') this.terminalCast();
      if (key === this.save.abilityKeyBinding.toLowerCase()) this.quickCast();
      if (key === 'escape') this.scene.start(SceneKeys.Chapter3Hub);
    });
  }

  private swordStrike(): void {
    const comboRank = this.save.chapter3.upgradeRanks['combo-script'] ?? 0;
    this.combo += 1 + comboRank;
    const damage = this.phase === 1 ? 16 + comboRank * 4 : 6;
    this.damageBoss(damage, this.phase === 1 ? 'Sword combo cracked the first lock.' : 'The blade bites, but this phase wants vows.');
  }

  private terminalCast(): void {
    const loadout = this.save.chapter3.loadout;
    const preferred = loadout.terminalVows.includes('array-split') ? 'array-split' : loadout.terminalVows[0] ?? 'try-catch';
    const ability = getAbility(preferred);
    const slowRank = this.save.chapter3.upgradeRanks['slow-terminal'] ?? 0;
    const damage = this.phase === 2 ? 24 + slowRank * 8 : 10;
    this.damageBoss(damage, this.phase === 2 ? `${ability.displayName} threads through the second lock.` : `${ability.displayName} lands, but the lock resists.`);
  }

  private quickCast(): void {
    const loadout = this.save.chapter3.loadout;
    const ability = getAbility(loadout.quickCastVow);
    const quickRank = this.save.chapter3.upgradeRanks['quick-seal'] ?? 0;
    const damage = this.phase === 3 ? Math.round(28 * (1 + quickRank * 0.18)) : 11;
    this.damageBoss(damage, this.phase === 3 ? `${ability.displayName} answers on instinct.` : `${ability.displayName} flashes early.`);
  }

  private damageBoss(damage: number, message: string): void {
    this.bossHp = Math.max(0, this.bossHp - damage);
    playBoom(this, 0.32);
    this.status = message;
    this.updatePhase();
    if (this.bossHp <= 0) {
      this.win();
      return;
    }
    this.playerHp = Math.max(1, this.playerHp - (this.phase + 2));
    this.refreshHud();
  }

  private updatePhase(): void {
    const previousPhase = this.phase;
    if (this.bossHp <= 50) this.phase = 3;
    else if (this.bossHp <= 100) this.phase = 2;
    else this.phase = 1;
    if (this.phase !== previousPhase) {
      this.status = this.phase === 2
        ? 'Phase 2: type through the lock with T.'
        : 'Phase 3: finish with your Z quick-cast build.';
      this.bossCore?.setStrokeStyle(5, this.phase === 2 ? 0x90d2b7 : 0xd64f45, 0.88);
    }
  }

  private refreshHud(): void {
    this.hpText?.setText(`Heart ${this.bossHp}/150  HP ${this.playerHp}`);
    this.statusText?.setText(this.status);
    this.comboText?.setText(`Combo ${this.combo}\nPhase ${this.phase}\nZ ${getAbility(this.save.chapter3.loadout.quickCastVow).displayName}`);
    this.publishRuntime();
  }

  private win(): void {
    this.defeated = true;
    this.save = completeChapter3Mission(this.save, 'archive-heart');
    writeSave(this.save);
    this.status = 'The Archive Heart opens. The first arc is unlocked.';
    this.refreshHud();
    const seal = addAdvancePromptSeal(this, 'confirm', 640, 454, {
      sceneId: 'chapter3-boss',
      width: 100,
      height: 50,
      depth: 12,
    });
    publishTextPanelAudit('chapter3-boss-win', new Phaser.Geom.Rectangle(94, 516, 1092, 112), [
      ...(this.statusText ? [{ id: 'status', object: this.statusText }] : []),
      ...(seal ? [{ id: 'advance', object: seal, allowOutside: true }] : []),
    ], 12);
    this.time.delayedCall(650, () => {
      this.input.keyboard?.once('keydown-ENTER', () => {
        this.scene.start(SceneKeys.Result, {
          outcome: 'win',
          unlock: 'window-kill',
          chapter: 3,
          bossId: 'archive-heart',
        });
      });
      this.input.once('pointerdown', () => {
        this.scene.start(SceneKeys.Result, {
          outcome: 'win',
          unlock: 'window-kill',
          chapter: 3,
          bossId: 'archive-heart',
        });
      });
    });
  }

  private publishRuntime(): void {
    (window as Window & {
      __CODEJITSU_CHAPTER3_BOSS?: {
        scene: string;
        bossHp: number;
        playerHp: number;
        phase: number;
        combo: number;
        quickCastVow: string;
        defeated: boolean;
        at: number;
      };
    }).__CODEJITSU_CHAPTER3_BOSS = {
      scene: 'chapter3-boss',
      bossHp: this.bossHp,
      playerHp: this.playerHp,
      phase: this.phase,
      combo: this.combo,
      quickCastVow: this.save.chapter3.loadout.quickCastVow,
      defeated: this.defeated,
      at: Math.round(performance.now()),
    };
  }
}
