import Phaser from 'phaser';
import { installAudioUnlock } from './audioUnlock';
import { addActorSprite, setActorPose, type ActorPose } from './actors';
import { SceneKeys, TextureKeys } from './sceneKeys';
import { addPanel, makePixelText, addHealthBar, addRoomDepthBorders, addArenaDepthCues, addSwordSwing, addHitSparks, addImpactPause, addGroundCrack, addVoidBurst, addStepDust, playBoom, playHit, playSlash, playCast, updateGroundedActorVisual } from './ui';
import { createGameKeys, type GameKeys } from '../systems/input';
import { loadSave, writeSave, unlockAbility } from '../systems/saveSystem';
import { PauseMenuOverlay, TerminalOverlay } from './overlays';
import { publishControlScheme, publishFrameHealth, publishSwordSwing } from './runtimeDebug';
import { apprenticeMovementTuning, readMovementInput, stepMovementVelocity } from '../systems/movementEngine';
import { clampSpriteToArenaBounds, fadeInFromBlack, fadeToScene } from './transition';
import { addAbilityCastBurst } from './abilityVisuals';
import { getAbility } from '../data/abilities';
import { parseTerminalCommand } from '../systems/terminalCommandEngine';
import { addGeneratedTelegraphSigil } from './combatTelegraphs';
import { isTestMode } from '../systems/testMode';
import { addRoomHint } from './roomHint';
import { addBrightnessLift, showKeikoHelper } from './roomIntro';

type MiniBossPhase = 'hunt' | 'rage' | 'vulnerable';

export class MiniBossScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerShadow!: Phaser.GameObjects.Image;
  private miniBoss!: Phaser.Physics.Arcade.Sprite;
  private miniBossShadow!: Phaser.GameObjects.Image;
  private keys!: GameKeys;
  private terminal!: TerminalOverlay;
  private pauseMenu!: PauseMenuOverlay;
  private currentVelocity = new Phaser.Math.Vector2(0, 0);
  private lastMoveDirection = new Phaser.Math.Vector2(1, 0);
  private moveHeldMs = 0;
  private playerHp = 100;
  private maxHp = 100;
  private playerBar!: ReturnType<typeof addHealthBar>;
  private bossBar!: ReturnType<typeof addHealthBar>;
  private bossHp = 300;
  private bossMaxHp = 300;
  private bossPhase: MiniBossPhase = 'hunt';
  private bossStagger = 0;
  private bossStaggerMax = 80;
  private bossAttackTimer = 0;
  private bossVelocity = new Phaser.Math.Vector2(0, 0);
  private canStrike = true;
  private strikeChain = 0;
  private lastStrikeAt = 0;
  private invulnerableUntil = 0;
  private poseLockedUntil = 0;
  private lockedPlayerPose: ActorPose = 'idle';
  private transitioning = false;
  private statusText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;
  private readonly walkableBounds = new Phaser.Geom.Rectangle(158, 180, 966, 420);

  constructor() {
    super(SceneKeys.MiniBoss);
  }

  init(): void {
    this.transitioning = false;
    this.canStrike = true;
    this.strikeChain = 0;
    this.lastStrikeAt = 0;
    this.invulnerableUntil = 0;
    this.poseLockedUntil = 0;
    this.lockedPlayerPose = 'idle';
    this.currentVelocity.set(0, 0);
    this.lastMoveDirection.set(1, 0);
    this.moveHeldMs = 0;
    this.bossVelocity.set(0, 0);
    this.bossHp = 300;
    this.bossMaxHp = 300;
    this.bossPhase = 'hunt';
    this.bossStagger = 0;
    this.bossStaggerMax = 80;
    this.bossAttackTimer = 0;
  }

  create(): void {
    (window as unknown as { __CODEJITSU_SCENE?: string }).__CODEJITSU_SCENE = 'miniboss';
    publishControlScheme('miniboss');
    installAudioUnlock(this);
    writeSave({ ...loadSave(), currentCheckpoint: 'dungeon' });
    this.keys = createGameKeys(this);
    this.maxHp = loadSave().playerUpgrades.maxHp;
    this.playerHp = this.maxHp;
    this.cameras.main.setBackgroundColor('#0d0711');
    if (this.textures.exists(TextureKeys.NullGateAntechamber)) {
      this.add.image(640, 360, TextureKeys.NullGateAntechamber).setDisplaySize(1280, 720).setDepth(0);
    } else {
      this.add.rectangle(640, 360, 1280, 720, 0x0d0711).setDepth(0);
    }
    addRoomDepthBorders(this, this.walkableBounds, { sceneId: 'miniboss', frontDepth: 850, accentColor: 0xce93d8 });
    addArenaDepthCues(this, this.walkableBounds, { sceneId: 'miniboss', accentColor: 0xce93d8, foregroundDepth: 852 });
    if (this.textures.exists(TextureKeys.NullGateForegroundPillars)) {
      this.add.image(640, 560, TextureKeys.NullGateForegroundPillars)
        .setDisplaySize(1280, 320)
        .setDepth(856)
        .setAlpha(0.94);
    }
    addBrightnessLift(this, 3, 0.18);
    fadeInFromBlack(this);

    // Player
    this.player = addActorSprite(this, 'hero', 320, 440, TextureKeys.Hero, 1.28);
    this.player.setCollideWorldBounds(true).setDrag(1500);
    this.player.body?.setSize(28, 24).setOffset(18, 62);
    this.playerShadow = this.add.image(this.player.x, this.player.y + 29, TextureKeys.Shadow).setDisplaySize(82, 34).setAlpha(0.43).setDepth(this.player.y - 8);

    // Mini-boss (Null Gate Warden) \u2014 bigger and bulkier than a sentinel
    this.miniBoss = this.textures.exists(TextureKeys.NullWardenExtended)
      ? this.physics.add.sprite(850, 336, TextureKeys.NullWardenExtended)
        .setOrigin(0.5, 0.5)
        .setDisplaySize(184, 276)
        .setData('usesNullWardenExtended', true)
      : this.textures.exists(TextureKeys.NullWardenCombat)
      ? this.physics.add.sprite(850, 350, TextureKeys.NullWardenCombat, 0)
        .setOrigin(0.5, 0.5)
        .setDisplaySize(220, 220)
        .setData('usesNullWardenCombat', true)
      : addActorSprite(this, 'sentinel', 850, 350, TextureKeys.NullOni, 2.0);
    this.miniBoss.setCollideWorldBounds(true).setDrag(900);
    if (this.miniBoss.getData('usesNullWardenExtended')) {
      this.miniBoss.body?.setSize(88, 118).setOffset(84, 244);
    } else {
      this.miniBoss.body?.setSize(70, 70).setOffset(60, 130);
    }
    this.miniBossShadow = this.add.image(850, this.miniBoss.y + (this.miniBoss.getData('usesNullWardenExtended') ? 92 : 60), TextureKeys.Shadow).setDisplaySize(170, 56).setAlpha(0.5).setDepth(340);

    // Aura
    const aura = this.add.ellipse(850, 370, 140, 90, 0xce93d8, 0.06).setDepth(200);
    this.tweens.add({ targets: aura, alpha: 0.12, scaleX: 1.1, scaleY: 1.1, duration: 1400, yoyo: true, repeat: -1 });

    // HUD
    this.playerBar = addHealthBar(this, 36, 20, 260, 20, 'Apprentice');
    this.bossBar = addHealthBar(this, 984, 20, 260, 20, 'Null Warden');
    addPanel(this, 480, 10, 320, 36, 0.65).setDepth(900);
    this.phaseText = makePixelText(this, 500, 16, 'Phase: Hunt', 14, '#ce93d8').setDepth(901);
    addPanel(this, 30, 660, 400, 40, 0.65).setDepth(900);
    this.statusText = makePixelText(this, 44, 668, 'Null Gate Warden blocks the path.', 12, '#ce93d8').setDepth(901);

    this.terminal = new TerminalOverlay(this, (cmd) => this.handleTerminal(cmd));
    this.pauseMenu = new PauseMenuOverlay(this, () => this.scene.start(SceneKeys.Title));
    addRoomHint(this, {
      title: 'MINI-BOSS — null gate warden',
      steps: [
        'X strikes (combos build stagger). WASD or Arrows to dodge.',
        'When phase shows VULNERABLE — press Z to unleash your bound vow.',
        'Vows do massive damage to staggered enemies.',
      ],
    });
    showKeikoHelper(this, {
      title: 'Null Gate Warden — Mini-Boss',
      lines: [
        'The Warden blocks the way to Null Oni\'s final gate. Three phases: Hunt, Rage, Vulnerable.',
        'X to strike (chains build a stagger meter). WASD or Arrows to circle and dodge.',
        'When the phase banner reads VULNERABLE, hammer Z to fire your bound vow for massive damage.',
        'You can also press T to type a vow (e.g. try.catch) during the slow-time moment.',
      ],
    });
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (this.terminal.handleKey(event)) return;
      if (this.pauseMenu.handleKey(event)) return;
      if (event.key === 'Escape') { this.pauseMenu.toggle(); return; }
      if (this.pauseMenu.isOpen || this.transitioning) return;
      if (event.key.toLowerCase() === 'x') this.strike();
      if (event.key.toLowerCase() === 't') this.terminal.open(event.timeStamp);
      if (event.key.toLowerCase() === 'z') this.useAbilityKey();
    });

    this.bossAttackTimer = this.time.now + 2000;
  }

  update(time: number, delta: number): void {
    publishFrameHealth('miniboss', delta);
    if (this.transitioning || this.pauseMenu.isOpen || this.terminal.isOpen) return;
    this.handleMovement(delta);
    clampSpriteToArenaBounds(this.player, this.walkableBounds);
    this.playerShadow.setPosition(this.player.x, this.player.y + 29).setDepth(this.player.y - 8);
    this.player.setDepth(this.player.y);
    this.updateMiniBoss(time, delta);
    this.playerBar.setValue(this.playerHp, this.maxHp);
    this.bossBar.setValue(this.bossHp, this.bossMaxHp);
  }

  private updateMiniBoss(time: number, delta: number): void {
    if (this.bossHp <= 0) return;

    // Update phase
    const hpPct = this.bossHp / this.bossMaxHp;
    if (this.bossStagger >= this.bossStaggerMax) {
      this.bossPhase = 'vulnerable';
      this.phaseText.setText('Phase: VULNERABLE').setColor('#f0c36b');
    } else if (hpPct < 0.4) {
      this.bossPhase = 'rage';
      this.phaseText.setText('Phase: Rage').setColor('#d64f45');
    } else {
      this.bossPhase = 'hunt';
      this.phaseText.setText('Phase: Hunt').setColor('#ce93d8');
    }

    if (this.bossPhase === 'vulnerable') {
      this.miniBoss.setTint(0xf0c36b);
      this.setMiniBossPose('stagger');
      this.statusText.setText('Warden staggered! Use vow (Z) or terminal!');
      return;
    }

    // Movement
    const dx = this.player.x - this.miniBoss.x;
    const dy = this.player.y - this.miniBoss.y;
    const dist = Math.hypot(dx, dy);
    const speed = this.bossPhase === 'rage' ? 90 : 60;
    if (dist > 140) {
      this.bossVelocity.set((dx / dist) * speed, (dy / dist) * speed * 0.7);
    } else if (dist < 90) {
      this.bossVelocity.set(-(dx / dist) * 40, -(dy / dist) * 30);
    } else {
      this.bossVelocity.lerp(new Phaser.Math.Vector2(0, 0), 0.05);
    }
    this.miniBoss.setVelocity(this.bossVelocity.x, this.bossVelocity.y);
    clampSpriteToArenaBounds(this.miniBoss, this.walkableBounds);
    this.miniBoss.setFlipX(this.miniBoss.x > this.player.x);
    this.miniBoss.setDepth(this.miniBoss.y);
    this.miniBossShadow.setPosition(this.miniBoss.x, this.miniBoss.y + (this.miniBoss.getData('usesNullWardenExtended') ? 92 : 42)).setDepth(this.miniBoss.y - 8);
    this.setMiniBossPose(this.bossVelocity.lengthSq() > 100 ? 'walk' : 'idle');

    // Attacks
    if (time >= this.bossAttackTimer) {
      const delay = this.bossPhase === 'rage' ? 1200 : 1800;
      this.bossAttackTimer = time + delay;
      this.performBossAttack();
    }
  }

  private performBossAttack(): void {
    const attackType = Phaser.Math.Between(0, 2);
    if (attackType === 0) this.bossSlam();
    else if (attackType === 1) this.bossLaneSweep();
    else this.bossCharge();
  }

  private bossSlam(): void {
    const x = this.player.x;
    const y = this.player.y;
    addGeneratedTelegraphSigil(this, 'miniboss', 'ring', x, y, {
      width: 160, height: 100, depth: y - 1, alpha: 0.5, tint: 0xce93d8, lifespanMs: 600,
    }) ?? this.add.ellipse(x, y, 120, 70, 0xce93d8, 0.2).setStrokeStyle(2, 0xf6ead3, 0.3).setDepth(y - 1);
    this.time.delayedCall(600, () => {
      addGroundCrack(this, x, y + 10, 0xce93d8, y + 12);
      addVoidBurst(this, x, y, 0xce93d8, y + 3);
      playBoom(this, 0.5);
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y) < 80) {
        this.damagePlayer(12, x, y);
      }
    });
  }

  private bossLaneSweep(): void {
    const horizontal = Math.random() > 0.5;
    const x = horizontal ? this.miniBoss.x + (this.player.x > this.miniBoss.x ? 120 : -120) : this.player.x;
    const y = horizontal ? this.player.y : this.miniBoss.y + (this.player.y > this.miniBoss.y ? 90 : -90);
    const w = horizontal ? 260 : 50;
    const h = horizontal ? 40 : 200;
    const warning = this.add.rectangle(x, y, w, h, 0xce93d8, 0.15).setStrokeStyle(2, 0xf6ead3, 0.3).setDepth(Math.max(this.player.y, this.miniBoss.y) + 2);
    this.tweens.add({
      targets: warning, alpha: 0.5, duration: 500, yoyo: true, onComplete: () => {
        warning.destroy();
        playBoom(this, 0.4);
        const hit = horizontal
          ? Math.abs(this.player.y - y) < 35 && Math.abs(this.player.x - x) < 150
          : Math.abs(this.player.x - x) < 40 && Math.abs(this.player.y - y) < 120;
        if (hit) this.damagePlayer(10, x, y);
      },
    });
  }

  private bossCharge(): void {
    const targetX = this.player.x;
    const targetY = this.player.y;
    this.setMiniBossPose('attack');
    this.time.delayedCall(400, () => {
      const angle = Phaser.Math.Angle.Between(this.miniBoss.x, this.miniBoss.y, targetX, targetY);
      this.bossVelocity.set(Math.cos(angle) * 300, Math.sin(angle) * 200);
      this.miniBoss.setVelocity(this.bossVelocity.x, this.bossVelocity.y);
      playBoom(this, 0.5);
      this.time.delayedCall(300, () => {
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, this.miniBoss.x, this.miniBoss.y) < 90) {
          this.damagePlayer(15, this.miniBoss.x, this.miniBoss.y);
        }
        this.bossVelocity.set(0, 0);
        this.miniBoss.setVelocity(0, 0);
        this.setMiniBossPose('idle');
      });
    });
  }

  private strike(): void {
    if (!this.canStrike || this.bossHp <= 0) return;
    this.canStrike = false;
    this.strikeChain = this.time.now - this.lastStrikeAt > 620 ? 0 : (this.strikeChain + 1) % 3;
    this.lastStrikeAt = this.time.now;
    const variant = this.strikeChain;
    this.poseLockedUntil = this.time.now + (variant === 2 ? 340 : 270);
    this.lockedPlayerPose = 'swing';
    setActorPose(this.player, 'swing');
    playSlash(this);
    const direction = this.miniBoss.x < this.player.x ? -1 : 1;
    this.player.setFlipX(direction < 0);
    this.player.x += direction * (variant === 2 ? 20 : 12);
    const sword = addSwordSwing(this, this.player.x, this.player.y, direction as 1 | -1, this.player.y + 20, variant);
    const swordDist = Phaser.Math.Distance.Between(sword.hitX, sword.hitY, this.miniBoss.x, this.miniBoss.y);
    const bodyDist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.miniBoss.x, this.miniBoss.y);
    if (Math.min(swordDist, bodyDist) < (variant === 2 ? 158 : 134)) {
      const dmg = variant === 2 ? 18 : 12;
      this.bossHp = Math.max(0, this.bossHp - dmg);
      this.bossStagger = Math.min(this.bossStaggerMax, this.bossStagger + dmg);
      playHit(this);
      addHitSparks(this, this.miniBoss.x, this.miniBoss.y - 30, this.miniBoss.y + 16);
      this.cameras.main.shake(variant === 2 ? 90 : 60, 0.004);
      this.miniBoss.setTintFill(0xf6ead3);
      this.time.delayedCall(90, () => this.miniBoss.clearTint());
      addImpactPause(this, variant === 2 ? 80 : 55, 0.15);
      if (this.bossHp <= 0) this.onBossDefeat();
    }
    this.time.delayedCall(variant === 2 ? 300 : 220, () => {
      this.canStrike = true;
      if (this.time.now >= this.poseLockedUntil) setActorPose(this.player, 'idle');
    });
  }

  private useAbilityKey(): void {
    const save = loadSave();
    if (!save.abilityKeyUnlocked) return;
    if (this.bossPhase !== 'vulnerable') {
      this.statusText.setText('Vow blocked! Stagger the warden first.');
      return;
    }
    const ability = getAbility(save.boundAbilityId);
    playCast(this);
    addAbilityCastBurst(this, this.player.x, this.player.y, ability.id, this.player.y + 120);
    // Big damage on staggered boss
    const vowDamage = 60;
    this.bossHp = Math.max(0, this.bossHp - vowDamage);
    this.bossStagger = 0;
    this.bossPhase = 'hunt';
    this.miniBoss.clearTint();
    this.setMiniBossPose('hurt');
    addHitSparks(this, this.miniBoss.x, this.miniBoss.y - 30, this.miniBoss.y + 16);
    this.cameras.main.shake(150, 0.01);
    addImpactPause(this, 120, 0.12);
    playBoom(this, 0.7);
    this.statusText.setText(`${ability.displayName} unleashed!`);
    this.time.delayedCall(300, () => {
      if (this.bossHp > 0) this.setMiniBossPose('idle');
    });
    if (this.bossHp <= 0) this.onBossDefeat();
  }

  private handleTerminal(command: string): void {
    const parsed = parseTerminalCommand(command);
    if (parsed.command && this.bossPhase === 'vulnerable') {
      this.useAbilityKey();
    } else if (parsed.command) {
      this.statusText.setText('Vow blocked. Stagger the warden first.');
    }
  }

  private damagePlayer(damage: number, sx: number, sy: number): void {
    if (this.time.now < this.invulnerableUntil) return;
    this.playerHp = Math.max(0, this.playerHp - damage);
    this.invulnerableUntil = this.time.now + 520;
    setActorPose(this.player, 'hurt');
    playHit(this);
    this.player.setTintFill(0xd64f45);
    this.time.delayedCall(120, () => this.player.clearTint());
    this.time.delayedCall(220, () => setActorPose(this.player, 'idle'));
    const angle = Phaser.Math.Angle.Between(sx, sy, this.player.x, this.player.y);
    this.currentVelocity.set(Math.cos(angle) * 200, Math.sin(angle) * 140);
    if (this.playerHp <= 0) {
      this.transitioning = true;
      this.time.delayedCall(300, () => this.scene.start(SceneKeys.Result, {
        outcome: 'lose', chapter: 1,
        deathReason: 'The Null Warden overwhelmed you.',
        retryScene: SceneKeys.MiniBoss,
      }));
    }
  }

  private onBossDefeat(): void {
    this.transitioning = true;
    this.setMiniBossPose('defeat');
    this.miniBoss.setVelocity(0, 0);
    this.tweens.add({
      targets: [this.miniBoss, this.miniBossShadow],
      alpha: 0, scaleX: 0.3, scaleY: 0.3, duration: 800,
      onComplete: () => { this.miniBoss.destroy(); this.miniBossShadow.destroy(); },
    });
    playBoom(this, 0.8);
    this.cameras.main.flash(600, 206, 147, 216);
    this.statusText.setText('Null Warden defeated. The gate opens.');
    // Unlock loop.strike
    let save = loadSave();
    save = unlockAbility(save, 'loop-strike');
    writeSave(save);
    this.time.delayedCall(2000, () => {
      fadeToScene(this, SceneKeys.Boss);
    });
  }

  private setMiniBossPose(pose: ActorPose): void {
    if (this.miniBoss.getData('usesNullWardenExtended')) {
      return;
    }
    if (this.miniBoss.getData('usesNullWardenCombat')) {
      const frameByPose: Partial<Record<ActorPose, number>> = {
        idle: 0,
        walk: 1,
        attack: 2,
        hurt: 3,
        stagger: 4,
        defeat: 5,
      };
      const frame = frameByPose[pose] ?? 0;
      this.miniBoss.setFrame(frame);
      return;
    }
    setActorPose(this.miniBoss, pose);
  }

  private handleMovement(delta: number): void {
    const input = readMovementInput(this.keys);
    const wantsMove = input.x * input.x + input.y * input.y > 0;
    this.moveHeldMs = wantsMove ? Math.min(this.moveHeldMs + delta, 1400) : 0;
    const movement = stepMovementVelocity(this.currentVelocity, input, delta, apprenticeMovementTuning, this.moveHeldMs);
    if (movement.moving) this.lastMoveDirection.copy(movement.direction);
    this.player.setVelocity(movement.velocity.x, movement.velocity.y);
    if (this.time.now < this.poseLockedUntil) {
      setActorPose(this.player, this.lockedPlayerPose);
    } else {
      setActorPose(this.player, movement.moving ? 'walk' : 'idle');
    }
    if (this.lastMoveDirection.x < -0.1) this.player.setFlipX(true);
    if (this.lastMoveDirection.x > 0.1) this.player.setFlipX(false);
  }
}
