import Phaser from 'phaser';
import { installAudioUnlock } from './audioUnlock';
import { addActorSprite, setActorPose } from './actors';
import { SceneKeys, TextureKeys } from './sceneKeys';
import { addPanel, makePixelText, addHealthBar, addRoomDepthBorders, addArenaDepthCues, addSwordSwing, addHitSparks, playBoom, playHit, playSlash, playCast } from './ui';
import { createGameKeys, type GameKeys } from '../systems/input';
import { loadSave, writeSave } from '../systems/saveSystem';
import { chapter3Arcs } from '../data/chapter3';
import { claimAvailableArcRewards, completeArcTrial, normalizeChapter3Progress } from '../systems/chapter3Progress';
import { PauseMenuOverlay } from './overlays';
import { publishControlScheme, publishFrameHealth } from './runtimeDebug';
import { apprenticeMovementTuning, readMovementInput, stepMovementVelocity } from '../systems/movementEngine';
import { clampSpriteToArenaBounds, fadeInFromBlack } from './transition';
import { addBrightnessLift, addVisibleExitBeacon, showKeikoHelper } from './roomIntro';

interface ArcEnemy {
  sprite: Phaser.Physics.Arcade.Sprite;
  shadow: Phaser.GameObjects.Image;
  hp: number;
  maxHp: number;
  velocity: Phaser.Math.Vector2;
  attackReadyAt: number;
  alive: boolean;
  variant: 'sentinel' | 'warden';
}

interface ArcTrial {
  id: string;
  title: string;
  description: string;
  enemyCount: number;
  enemyVariant: 'sentinel' | 'warden';
  reward: { fragments: number; materials: number };
}

const trials: ArcTrial[] = [
  {
    id: 'arc-open-road',
    title: 'Open Road',
    description: 'Three drifting sentinels challenge passage to the next waypoint.',
    enemyCount: 3,
    enemyVariant: 'sentinel',
    reward: { fragments: 2, materials: 1 },
  },
  {
    id: 'arc-lost-names',
    title: 'Lost Names Ridge',
    description: 'Four sentinels patrol an unnamed ridge. Clear them to claim the cache.',
    enemyCount: 4,
    enemyVariant: 'sentinel',
    reward: { fragments: 3, materials: 2 },
  },
  {
    id: 'arc-sky-null',
    title: 'Sky Null Oni',
    description: 'A fragment of Null Oni returns. Bigger, slower, deadlier. Boss trial.',
    enemyCount: 2,
    enemyVariant: 'warden',
    reward: { fragments: 5, materials: 4 },
  },
];

type ArcPhase = 'hub' | 'trial-active' | 'trial-cleared' | 'arc-complete';

const ARC_ID = 'fractured-openworld';

export class FracturedOpenworldArcScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerShadow!: Phaser.GameObjects.Image;
  private keys!: GameKeys;
  private pauseMenu!: PauseMenuOverlay;
  private currentVelocity = new Phaser.Math.Vector2(0, 0);
  private lastMoveDirection = new Phaser.Math.Vector2(1, 0);
  private moveHeldMs = 0;
  private playerHp = 100;
  private maxHp = 100;
  private playerBar!: ReturnType<typeof addHealthBar>;
  private canStrike = true;
  private invulnerableUntil = 0;
  private enemies: ArcEnemy[] = [];
  private trialIndex = 0;
  private phase: ArcPhase = 'hub';
  private hubTrialNodes: Array<{ panel: Phaser.GameObjects.GameObject; circle: Phaser.GameObjects.GameObject; glow: Phaser.GameObjects.GameObject; label: Phaser.GameObjects.Text; subLabel: Phaser.GameObjects.Text; x: number; y: number }> = [];
  private statusText!: Phaser.GameObjects.Text;
  private titleText!: Phaser.GameObjects.Text;
  private subtitleText!: Phaser.GameObjects.Text;
  private backdrop?: Phaser.GameObjects.GameObject;
  private exitToHubBeacon?: { rect: Phaser.GameObjects.Rectangle; destroy: () => void };
  private transitioning = false;
  private readonly walkableBounds = new Phaser.Geom.Rectangle(120, 200, 1040, 400);
  private completedTrialIds: Set<string> = new Set();
  private interactHintText!: Phaser.GameObjects.Text;

  constructor() {
    super(SceneKeys.FracturedOpenworldArc);
  }

  init(): void {
    this.transitioning = false;
    this.canStrike = true;
    this.invulnerableUntil = 0;
    this.enemies = [];
    this.phase = 'hub';
    this.trialIndex = 0;
    this.hubTrialNodes = [];
    this.currentVelocity.set(0, 0);
    this.lastMoveDirection.set(1, 0);
    this.moveHeldMs = 0;
    this.completedTrialIds = new Set();
  }

  create(): void {
    (window as unknown as { __CODEJITSU_SCENE?: string }).__CODEJITSU_SCENE = 'arc-fractured-openworld';
    publishControlScheme('arc-fractured');
    installAudioUnlock(this);
    const save = claimAvailableArcRewards(loadSave());
    const chapter3 = normalizeChapter3Progress(save.chapter3);
    this.completedTrialIds = new Set(chapter3.arcProgress[ARC_ID]?.completedMissionIds ?? []);
    writeSave({ ...save, chapter3, currentCheckpoint: 'arc-fractured-openworld' });
    this.keys = createGameKeys(this);
    this.maxHp = save.playerUpgrades.maxHp;
    this.playerHp = this.maxHp;

    this.cameras.main.setBackgroundColor('#0a1424');
    this.setArcBackdrop(TextureKeys.ArcFracturedHub, TextureKeys.Chapter2OutdoorTrail);
    addRoomDepthBorders(this, this.walkableBounds, { sceneId: 'arc-fractured', frontDepth: 850, accentColor: 0x4fc3f7 });
    addArenaDepthCues(this, this.walkableBounds, { sceneId: 'arc-fractured', accentColor: 0x4fc3f7, foregroundDepth: 852 });
    addBrightnessLift(this, 3, 0.16);
    fadeInFromBlack(this);

    // Hub title
    this.titleText = makePixelText(this, 640, 38, 'FRACTURED OPENWORLD ARC', 26, '#f0c36b', 'center')
      .setOrigin(0.5, 0).setDepth(800).setStroke('#09070d', 5);
    this.subtitleText = makePixelText(this, 640, 76, 'Walk onto a glowing waypoint to start that trial', 16, '#cdbdcb', 'center')
      .setOrigin(0.5, 0).setDepth(800);

    // Player
    this.player = addActorSprite(this, 'hero', 200, 480, TextureKeys.Hero, 1.28);
    this.player.setCollideWorldBounds(true).setDrag(1500);
    this.player.body?.setSize(28, 24).setOffset(18, 62);
    this.playerShadow = this.add.image(this.player.x, this.player.y + 29, TextureKeys.Shadow).setDisplaySize(82, 34).setAlpha(0.43).setDepth(this.player.y - 8);

    // HUD
    this.playerBar = addHealthBar(this, 36, 100, 260, 20, 'Apprentice');
    addPanel(this, 30, 660, 600, 50, 0.7).setDepth(900);
    this.statusText = makePixelText(this, 44, 670, 'Walk onto a waypoint to start a trial.', 14, '#4fc3f7').setDepth(901);
    this.interactHintText = makePixelText(this, 640, 660, '', 16, '#f0c36b', 'center').setOrigin(0.5, 0).setDepth(901);

    this.buildHubNodes();

    this.pauseMenu = new PauseMenuOverlay(this, () => this.scene.start(SceneKeys.Chapter3Hub));
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (this.pauseMenu.handleKey(event)) return;
      if (event.key === 'Escape') { this.pauseMenu.toggle(); return; }
      if (this.pauseMenu.isOpen || this.transitioning) return;
      if (event.key.toLowerCase() === 'x') this.strike();
      if (event.key === 'Enter') this.handleInteract();
    });

    showKeikoHelper(this, {
      title: 'Fractured Openworld Arc — Hub',
      speaker: 'Keiko (radio)',
      radio: true,
      lines: [
        'Welcome to your first Arc. Arcs are open-ended runs that replay missions for fragments and materials.',
        'This hub has three glowing waypoints. Walk onto one to start that trial.',
        'Clear all three to complete the arc and earn the Sky Null Oni reward.',
        'You can leave any time through the gold "BACK" beacon on the right.',
      ],
    });
  }

  update(_time: number, delta: number): void {
    publishFrameHealth('arc-fractured', delta);
    if (this.transitioning || this.pauseMenu.isOpen) {
      this.player.setVelocity(0, 0);
      this.enemies.forEach((e) => e.alive && e.sprite.setVelocity(0, 0));
      return;
    }
    this.handleMovement(delta);
    clampSpriteToArenaBounds(this.player, this.walkableBounds, 1.0);
    this.playerShadow.setPosition(this.player.x, this.player.y + 29).setDepth(this.player.y - 8);
    this.player.setDepth(this.player.y);
    this.playerBar.setValue(this.playerHp, this.maxHp);

    if (this.phase === 'hub') {
      this.checkHubInteraction();
    } else if (this.phase === 'trial-active') {
      this.updateEnemies(delta);
      if (this.enemies.every((e) => !e.alive)) {
        this.completeTrial();
      }
    } else if (this.phase === 'trial-cleared') {
      this.checkExitToHub();
    } else if (this.phase === 'arc-complete') {
      this.checkExitToHub();
    }
  }

  private buildHubNodes(): void {
    this.hubTrialNodes.forEach((n) => { n.panel.destroy(); n.circle.destroy(); n.glow.destroy(); n.label.destroy(); n.subLabel.destroy(); });
    this.hubTrialNodes = [];

    trials.forEach((trial, index) => {
      const x = 380 + index * 280;
      const y = 360;
      const cleared = this.completedTrialIds.has(trial.id);
      const color = cleared ? 0x90d2b7 : 0x4fc3f7;

      const glow = this.textures.exists(TextureKeys.ArcWaypointGlow)
        ? this.add.image(x, y, TextureKeys.ArcWaypointGlow).setDisplaySize(128, 128).setTint(color).setAlpha(cleared ? 0.7 : 0.86).setDepth(40)
        : this.add.circle(x, y, 70, color, 0.15).setDepth(40);
      this.tweens.add({ targets: glow, alpha: 0.32, scaleX: 1.08, scaleY: 1.08, duration: 800, yoyo: true, repeat: -1 });
      const circle = this.add.circle(x, y, 52, color, this.textures.exists(TextureKeys.ArcWaypointGlow) ? 0.12 : 0.36).setStrokeStyle(3, color, 0.9).setDepth(50);

      const panel = this.add.rectangle(x, y + 90, 240, 60, 0x140d18, 0.85).setStrokeStyle(2, color, 0.7).setDepth(60);
      const label = makePixelText(this, x, y + 75, trial.title, 18, cleared ? '#90d2b7' : '#f6ead3', 'center')
        .setOrigin(0.5, 0).setDepth(61);
      const subLabel = makePixelText(this, x, y + 100, cleared ? 'CLEARED' : `+${trial.reward.fragments}f +${trial.reward.materials}m`, 13, cleared ? '#90d2b7' : '#f0c36b', 'center')
        .setOrigin(0.5, 0).setDepth(61);

      this.hubTrialNodes.push({ panel: panel as unknown as Phaser.GameObjects.GameObject, circle, glow, label, subLabel, x, y });
    });

    // Exit-to-hub beacon on far right
    this.exitToHubBeacon?.destroy();
    this.exitToHubBeacon = addVisibleExitBeacon(this, { x: 1130, y: 360, label: 'BACK', color: 0xf0c36b, width: 110, height: 130 });
  }

  private checkHubInteraction(): void {
    let nearAny = false;
    this.hubTrialNodes.forEach((node, index) => {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, node.x, node.y);
      if (dist < 70 && !this.completedTrialIds.has(trials[index].id)) {
        nearAny = true;
        this.interactHintText.setText(`Press ENTER to start "${trials[index].title}"`);
      }
    });
    // Check exit-to-Chapter3-hub beacon
    if (this.exitToHubBeacon && Phaser.Math.Distance.Between(this.player.x, this.player.y, this.exitToHubBeacon.rect.x, this.exitToHubBeacon.rect.y) < 80) {
      nearAny = true;
      this.interactHintText.setText('Walk to leave the arc and return to the hub');
      if (!this.transitioning) {
        this.transitioning = true;
        playBoom(this, 0.4);
        this.cameras.main.flash(400, 240, 195, 101);
        this.time.delayedCall(400, () => this.scene.start(SceneKeys.Chapter3Hub));
      }
    }
    if (!nearAny) this.interactHintText.setText('');
  }

  private handleInteract(): void {
    if (this.phase !== 'hub') return;
    let chosenIndex = -1;
    this.hubTrialNodes.forEach((node, index) => {
      if (this.completedTrialIds.has(trials[index].id)) return;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, node.x, node.y);
      if (dist < 70) chosenIndex = index;
    });
    if (chosenIndex < 0) return;
    this.startTrial(chosenIndex);
  }

  private startTrial(index: number): void {
    this.trialIndex = index;
    const trial = trials[index];
    this.phase = 'trial-active';
    this.statusText.setText(`Trial: ${trial.title} — ${trial.description}`);
    // Hide hub nodes
    this.hubTrialNodes.forEach((n) => { n.panel.destroy(); n.circle.destroy(); n.glow.destroy(); n.label.destroy(); n.subLabel.destroy(); });
    this.hubTrialNodes = [];
    this.exitToHubBeacon?.destroy();
    this.exitToHubBeacon = undefined;
    this.interactHintText.setText('');
    this.titleText.setText(`TRIAL — ${trial.title.toUpperCase()}`);
    this.subtitleText.setText(`${trial.enemyCount} enemies. Clear them all.`);
    this.setArcBackdrop(TextureKeys.ArcFracturedTrial, TextureKeys.ArcFracturedHub);
    this.spawnEnemies(trial);
  }

  private spawnEnemies(trial: ArcTrial): void {
    this.enemies = [];
    for (let i = 0; i < trial.enemyCount; i++) {
      const x = 600 + (i % 3) * 140;
      const y = 320 + Math.floor(i / 3) * 100;
      const isWarden = trial.enemyVariant === 'warden';
      const usesSkyNullOni = isWarden && this.textures.exists(TextureKeys.ArcSkyNullOni);
      const sprite = this.physics.add.sprite(x, y, usesSkyNullOni ? TextureKeys.ArcSkyNullOni : TextureKeys.Hero, 0)
        .setCollideWorldBounds(true)
        .setDrag(900)
        .setData('usesSkyNullOni', usesSkyNullOni);
      sprite.setDisplaySize(usesSkyNullOni ? 150 : isWarden ? 110 : 64, usesSkyNullOni ? 150 : isWarden ? 120 : 70);
      if (!usesSkyNullOni) sprite.setTint(isWarden ? 0xce93d8 : 0xd64f45);
      sprite.body?.setSize(usesSkyNullOni ? 96 : isWarden ? 50 : 34, usesSkyNullOni ? 90 : isWarden ? 50 : 36).setOffset(usesSkyNullOni ? 80 : isWarden ? 30 : 15, usesSkyNullOni ? 142 : isWarden ? 60 : 30);
      if (usesSkyNullOni) sprite.setFrame(0);
      else setActorPose(sprite, 'idle');
      const shadow = this.add.image(x, y + (isWarden ? 38 : 26), TextureKeys.Shadow)
        .setDisplaySize(isWarden ? 130 : 76, isWarden ? 44 : 28).setAlpha(0.5).setDepth(y - 8);
      const baseHp = isWarden ? 80 : 28;
      this.enemies.push({
        sprite, shadow,
        hp: baseHp,
        maxHp: baseHp,
        velocity: new Phaser.Math.Vector2(0, 0),
        attackReadyAt: this.time.now + Phaser.Math.Between(2000, 3200),
        alive: true,
        variant: trial.enemyVariant,
      });
    }
  }

  private updateEnemies(delta: number): void {
    this.enemies.forEach((enemy) => {
      if (!enemy.alive) return;
      const dx = this.player.x - enemy.sprite.x;
      const dy = this.player.y - enemy.sprite.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const range = enemy.variant === 'warden' ? 120 : 90;
      if (this.time.now >= enemy.attackReadyAt && distance < range) {
        if (enemy.sprite.getData('usesSkyNullOni')) enemy.sprite.setFrame(3);
        if (this.time.now >= this.invulnerableUntil) {
          const damage = enemy.variant === 'warden' ? 14 : 8;
          this.damagePlayer(damage, enemy.sprite.x, enemy.sprite.y);
        }
        enemy.attackReadyAt = this.time.now + Phaser.Math.Between(2000, 2800);
        return;
      }
      const angle = Math.atan2(dy, dx);
      const speed = enemy.variant === 'warden' ? 70 : 55;
      const desired = new Phaser.Math.Vector2(Math.cos(angle) * speed, Math.sin(angle) * (speed * 0.75));
      enemy.velocity.lerp(desired, Math.min(1, delta / 120));
      enemy.sprite.setVelocity(enemy.velocity.x, enemy.velocity.y);
      if (enemy.sprite.getData('usesSkyNullOni')) enemy.sprite.setFrame(enemy.velocity.lengthSq() > 100 ? 1 : 0);
      clampSpriteToArenaBounds(enemy.sprite, this.walkableBounds, 1.0);
      enemy.sprite.setFlipX(enemy.sprite.x > this.player.x);
      enemy.sprite.setDepth(enemy.sprite.y);
      enemy.shadow.setPosition(enemy.sprite.x, enemy.sprite.y + (enemy.variant === 'warden' ? 38 : 26)).setDepth(enemy.sprite.y - 8);
    });
  }

  private strike(): void {
    if (!this.canStrike || this.phase !== 'trial-active') return;
    this.canStrike = false;
    playSlash(this);
    setActorPose(this.player, 'swing');
    const direction = this.lastMoveDirection.x < -0.1 ? -1 : 1;
    const sword = addSwordSwing(this, this.player.x, this.player.y, direction, this.player.y + 20, 0);
    this.enemies.forEach((enemy) => {
      if (!enemy.alive) return;
      const dist = Math.min(
        Phaser.Math.Distance.Between(sword.hitX, sword.hitY, enemy.sprite.x, enemy.sprite.y),
        Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.sprite.x, enemy.sprite.y),
      );
      const range = enemy.variant === 'warden' ? 160 : 130;
      if (dist < range) {
        const damage = enemy.variant === 'warden' ? 16 : 14;
        enemy.hp -= damage;
        playHit(this);
        addHitSparks(this, enemy.sprite.x, enemy.sprite.y - 30, enemy.sprite.y + 16);
        enemy.sprite.setTintFill(0xf6ead3);
        const baseTint = enemy.variant === 'warden' ? 0xce93d8 : 0xd64f45;
        if (enemy.sprite.getData('usesSkyNullOni')) enemy.sprite.setFrame(4);
        this.time.delayedCall(80, () => {
          enemy.sprite.clearTint();
          if (enemy.sprite.getData('usesSkyNullOni')) enemy.sprite.setFrame(0);
          else enemy.sprite.setTint(baseTint);
        });
        if (enemy.hp <= 0) {
          enemy.alive = false;
          if (enemy.sprite.getData('usesSkyNullOni')) enemy.sprite.setFrame(5);
          this.tweens.add({
            targets: [enemy.sprite, enemy.shadow],
            alpha: 0, scale: 0.3, duration: 280,
            onComplete: () => { enemy.sprite.destroy(); enemy.shadow.destroy(); },
          });
        }
      }
    });
    this.time.delayedCall(260, () => {
      this.canStrike = true;
      setActorPose(this.player, 'idle');
    });
  }

  private damagePlayer(damage: number, sourceX: number, sourceY: number): void {
    this.playerHp = Math.max(0, this.playerHp - damage);
    this.invulnerableUntil = this.time.now + 750;
    setActorPose(this.player, 'hurt');
    playHit(this);
    this.player.setTintFill(0xd64f45);
    this.time.delayedCall(120, () => this.player.clearTint());
    this.time.delayedCall(220, () => setActorPose(this.player, 'idle'));
    const angle = Phaser.Math.Angle.Between(sourceX, sourceY, this.player.x, this.player.y);
    this.currentVelocity.set(Math.cos(angle) * 160, Math.sin(angle) * 110);
    this.player.setVelocity(this.currentVelocity.x, this.currentVelocity.y);
    if (this.playerHp <= 0) {
      this.playerHp = Math.floor(this.maxHp * 0.5);
      this.player.setPosition(200, 480);
      this.currentVelocity.set(0, 0);
      this.cameras.main.flash(300, 13, 4, 16);
    }
  }

  private completeTrial(): void {
    const trial = trials[this.trialIndex];
    this.completedTrialIds.add(trial.id);
    const save = loadSave();
    const before = normalizeChapter3Progress(save.chapter3);
    const previousTrialIds = before.arcProgress[ARC_ID]?.completedMissionIds ?? [];
    const trialRewardClaimed = !previousTrialIds.includes(trial.id);
    const arc = chapter3Arcs.find((entry) => entry.id === ARC_ID);
    const arcRewardClaimed = Boolean(
      arc &&
      arc.missionIds.every((missionId) => missionId === trial.id || previousTrialIds.includes(missionId)) &&
      !before.claimedArcRewardIds.includes(ARC_ID),
    );
    const nextSave = completeArcTrial(save, ARC_ID, trial.id, trial.reward);
    this.completedTrialIds = new Set(nextSave.chapter3.arcProgress[ARC_ID]?.completedMissionIds ?? [...this.completedTrialIds]);
    writeSave(nextSave);

    this.phase = this.completedTrialIds.size >= trials.length ? 'arc-complete' : 'trial-cleared';
    const trialRewardText = trialRewardClaimed ? `+${trial.reward.fragments} fragments, +${trial.reward.materials} materials` : 'reward already claimed';
    const arcRewardText = arcRewardClaimed && arc ? ` Arc mastered! +${arc.reward.fragments} fragments, +${arc.reward.materials} materials.` : '';
    this.statusText.setText(`Trial cleared. ${trialRewardText}.${arcRewardText}`);
    playBoom(this, 0.6);
    this.cameras.main.flash(400, 240, 195, 101);
    const bannerArt = this.textures.exists(TextureKeys.ArcRewardBanner)
      ? this.add.image(640, 220, TextureKeys.ArcRewardBanner).setDisplaySize(480, 96).setDepth(1499)
      : undefined;
    const banner = makePixelText(this, 640, 220, arcRewardClaimed ? 'ARC MASTERED' : `${trial.title} — CLEARED`, 28, '#90d2b7', 'center')
      .setOrigin(0.5).setDepth(1500).setStroke('#09070d', 5);
    this.tweens.add({ targets: bannerArt ? [banner, bannerArt] : banner, alpha: 0, y: 180, duration: 1400, delay: 600, onComplete: () => { banner.destroy(); bannerArt?.destroy(); } });
    this.time.delayedCall(1300, () => {
      this.titleText.setText(this.phase === 'arc-complete' ? 'ARC COMPLETE — return to hub' : 'FRACTURED OPENWORLD ARC');
      this.subtitleText.setText(this.phase === 'arc-complete' ? 'All three trials cleared!' : 'Walk onto another waypoint to continue');
      this.phase = this.completedTrialIds.size >= trials.length ? 'arc-complete' : 'hub';
      this.setArcBackdrop(TextureKeys.ArcFracturedHub, TextureKeys.Chapter2OutdoorTrail);
      this.buildHubNodes();
    });
  }

  private setArcBackdrop(primaryKey: string, fallbackKey?: string): void {
    const textureKey = this.textures.exists(primaryKey) ? primaryKey : fallbackKey;
    this.backdrop?.destroy();
    if (textureKey && this.textures.exists(textureKey)) {
      this.backdrop = this.add.image(640, 360, textureKey).setDisplaySize(1280, 720).setAlpha(0.96).setDepth(0);
      return;
    }
    this.backdrop = this.add.rectangle(640, 360, 1280, 720, 0x0a1424).setDepth(0);
  }

  private checkExitToHub(): void {
    if (this.exitToHubBeacon && !this.transitioning) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.exitToHubBeacon.rect.x, this.exitToHubBeacon.rect.y);
      if (dist < 80) {
        this.transitioning = true;
        playBoom(this, 0.4);
        this.cameras.main.flash(400, 240, 195, 101);
        this.time.delayedCall(400, () => this.scene.start(SceneKeys.Chapter3Hub));
      }
    }
  }

  private handleMovement(delta: number): void {
    const input = readMovementInput(this.keys);
    const wantsMove = input.x * input.x + input.y * input.y > 0;
    this.moveHeldMs = wantsMove ? Math.min(this.moveHeldMs + delta, 1400) : 0;
    const movement = stepMovementVelocity(this.currentVelocity, input, delta, apprenticeMovementTuning, this.moveHeldMs);
    if (movement.moving) this.lastMoveDirection.copy(movement.direction);
    this.player.setVelocity(movement.velocity.x, movement.velocity.y);
    setActorPose(this.player, movement.moving ? 'walk' : 'idle');
    if (this.lastMoveDirection.x < -0.1) this.player.setFlipX(true);
    if (this.lastMoveDirection.x > 0.1) this.player.setFlipX(false);
  }
}
