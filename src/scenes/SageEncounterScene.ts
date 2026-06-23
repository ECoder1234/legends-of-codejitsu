import Phaser from 'phaser';
import { installAudioUnlock } from './audioUnlock';
import { addActorSprite, setActorPose } from './actors';
import { SceneKeys, TextureKeys } from './sceneKeys';
import { addPanel, makePixelText, addRoomDepthBorders, addArenaDepthCues, addHealthBar, addHitSparks, addSwordSwing, playCast, playBoom, playSlash, playHit } from './ui';
import { createGameKeys, type GameKeys } from '../systems/input';
import { loadSave, writeSave } from '../systems/saveSystem';
import { PauseMenuOverlay } from './overlays';
import { publishControlScheme, publishFrameHealth } from './runtimeDebug';
import { apprenticeMovementTuning, readMovementInput, stepMovementVelocity } from '../systems/movementEngine';
import { clampSpriteToArenaBounds, fadeInFromBlack, fadeToScene } from './transition';
import { addRoomHint } from './roomHint';
import { addBrightnessLift, addVisibleExitBeacon, showKeikoHelper } from './roomIntro';

interface SageDialogueLine {
  speaker: string;
  text: string;
  color: string;
}

interface SageMinion {
  sprite: Phaser.Physics.Arcade.Sprite;
  shadow: Phaser.GameObjects.Image;
  hp: number;
  velocity: Phaser.Math.Vector2;
  attackReadyAt: number;
  alive: boolean;
}

const rescueDialogue: SageDialogueLine[] = [
  { speaker: 'Keiko (radio)', text: 'Apprentice — that\'s the Keybind Elder behind the bars. He taught me the Z keybind years ago.', color: '#f0c36b' },
  { speaker: 'Keybind Elder', text: 'A new apprentice… The sentinels caught me before I could finish my last vow.', color: '#90d2b7' },
  { speaker: 'Keybind Elder', text: 'Clear the masks first. I cannot channel a binding while their gaze pins me.', color: '#90d2b7' },
  { speaker: 'Apprentice', text: 'On it. Hold tight.', color: '#f6ead3' },
];

const postCombatDialogue: SageDialogueLine[] = [
  { speaker: 'Keybind Elder', text: 'Good. Now stand close. I bind the Z key into your hand — instant vow, no terminal needed.', color: '#90d2b7' },
  { speaker: 'Keybind Elder', text: 'Press Z in combat and your bound vow fires at the speed of reflex.', color: '#4fc3f7' },
  { speaker: 'Apprentice', text: 'A vow at the speed of instinct.', color: '#f6ead3' },
  { speaker: 'Keybind Elder', text: 'X builds your strike chain. Z spends it for a heavier hit. Practice and the chain becomes part of you.', color: '#4fc3f7' },
];

const afterRescueDialogue: SageDialogueLine[] = [
  { speaker: 'Keybind Elder', text: 'Free at last. Go — Keiko\'s waiting at the hub. The trap corridor ahead is cruel.', color: '#90d2b7' },
  { speaker: 'Apprentice', text: 'Thank you, Elder. I\'ll come back for you.', color: '#f6ead3' },
];

type SagePhase = 'pre-combat' | 'combat' | 'post-combat' | 'rescued' | 'done';

export class SageEncounterScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerShadow!: Phaser.GameObjects.Image;
  private elder!: Phaser.GameObjects.Sprite;
  private elderShadow!: Phaser.GameObjects.Image;
  private cageBars: Phaser.GameObjects.Rectangle[] = [];
  private cageTop!: Phaser.GameObjects.Rectangle;
  private cageBottom!: Phaser.GameObjects.Rectangle;
  private cageGlow!: Phaser.GameObjects.Ellipse;
  private minions: SageMinion[] = [];
  private playerHp = 100;
  private maxHp = 100;
  private playerBar!: ReturnType<typeof addHealthBar>;
  private canStrike = true;
  private invulnerableUntil = 0;
  private keys!: GameKeys;
  private pauseMenu!: PauseMenuOverlay;
  private currentVelocity = new Phaser.Math.Vector2(0, 0);
  private lastMoveDirection = new Phaser.Math.Vector2(1, 0);
  private moveHeldMs = 0;
  private dialoguePanel?: Phaser.GameObjects.GameObject;
  private dialogueIcon?: Phaser.GameObjects.Image;
  private dialogueRadioOverlay?: Phaser.GameObjects.Image;
  private dialogueSpeaker!: Phaser.GameObjects.Text;
  private dialogueBody!: Phaser.GameObjects.Text;
  private dialogueIndex = 0;
  private dialogueActive = false;
  private transitioning = false;
  private interactPrompt!: Phaser.GameObjects.Text;
  private exitBeacon?: ReturnType<typeof addVisibleExitBeacon>;
  private phase: SagePhase = 'pre-combat';
  private currentDialogue: SageDialogueLine[] = rescueDialogue;
  private readonly walkableBounds = new Phaser.Geom.Rectangle(140, 200, 1000, 380);
  private readonly ELDER_X = 740;
  private readonly ELDER_Y = 370;
  private readonly EXIT_X = 1120;
  private readonly EXIT_Y = 380;

  constructor() {
    super(SceneKeys.SageEncounter);
  }

  init(): void {
    this.transitioning = false;
    this.dialogueIndex = 0;
    this.dialogueActive = false;
    this.phase = 'pre-combat';
    this.currentDialogue = rescueDialogue;
    this.cageBars = [];
    this.minions = [];
    this.canStrike = true;
    this.invulnerableUntil = 0;
    this.currentVelocity.set(0, 0);
    this.lastMoveDirection.set(1, 0);
    this.moveHeldMs = 0;
  }

  create(): void {
    (window as unknown as { __CODEJITSU_SCENE?: string }).__CODEJITSU_SCENE = 'sage-encounter';
    publishControlScheme('sage');
    installAudioUnlock(this);
    writeSave({ ...loadSave(), currentCheckpoint: 'dungeon' });
    this.keys = createGameKeys(this);
    this.maxHp = loadSave().playerUpgrades.maxHp;
    this.playerHp = this.maxHp;
    this.cameras.main.setBackgroundColor('#0b0918');
    if (this.textures.exists(TextureKeys.SageEncounterShrine)) {
      this.add.image(640, 360, TextureKeys.SageEncounterShrine).setDisplaySize(1280, 720).setDepth(0);
    } else {
      this.add.rectangle(640, 360, 1280, 720, 0x0b0918).setDepth(0);
    }
    addRoomDepthBorders(this, this.walkableBounds, { sceneId: 'sage', frontDepth: 850, accentColor: 0x90d2b7 });
    addArenaDepthCues(this, this.walkableBounds, { sceneId: 'sage', accentColor: 0x90d2b7, foregroundDepth: 852 });
    addBrightnessLift(this, 3, 0.14);
    fadeInFromBlack(this);

    // Elder (rescued NPC)
    if (this.textures.exists(TextureKeys.KeybindElderPortrait)) {
      this.elder = this.add.sprite(this.ELDER_X, this.ELDER_Y - 10, TextureKeys.KeybindElderPortrait)
        .setDisplaySize(96, 120)
        .setDepth(this.ELDER_Y)
        .setData('usesKeybindElderPortrait', true);
    } else {
      this.elder = addActorSprite(this, 'mentor', this.ELDER_X, this.ELDER_Y, TextureKeys.Mentor, 1.45) as unknown as Phaser.GameObjects.Sprite;
      this.elder.setTint(0x90d2b7);
      setActorPose(this.elder as unknown as Phaser.Physics.Arcade.Sprite, 'talk');
    }
    this.elderShadow = this.add.image(this.ELDER_X, this.ELDER_Y + 38, TextureKeys.Shadow).setDisplaySize(110, 36).setAlpha(0.45).setDepth(this.ELDER_Y - 8);
    this.elder.setFlipX(true);

    this.buildCage();
    this.spawnMinions();

    // Player
    this.player = addActorSprite(this, 'hero', 240, 440, TextureKeys.Hero, 1.28);
    this.player.setCollideWorldBounds(true).setDrag(1500);
    this.player.body?.setSize(28, 24).setOffset(18, 62);
    this.playerShadow = this.add.image(this.player.x, this.player.y + 29, TextureKeys.Shadow).setDisplaySize(82, 34).setAlpha(0.43).setDepth(this.player.y - 8);

    // HUD
    this.playerBar = addHealthBar(this, 36, 20, 260, 20, 'Apprentice');

    // Exit beacon (visible after the final Elder dialogue)
    this.exitBeacon = addVisibleExitBeacon(this, { x: this.EXIT_X, y: this.EXIT_Y, label: 'EXIT', color: 0xf0c36b, width: 110, height: 130 });
    this.exitBeacon.setVisible(false);

    // Interact prompt
    this.interactPrompt = makePixelText(this, this.ELDER_X, this.ELDER_Y - 110, 'Press Enter to talk', 14, '#f0c36b', 'center')
      .setOrigin(0.5, 0).setDepth(500).setAlpha(0);

    // Dialogue panel
    this.dialoguePanel = addPanel(this, 160, 520, 960, 150, 0.88).setDepth(1000);
    (this.dialoguePanel as Phaser.GameObjects.GameObject & { setVisible: (v: boolean) => void }).setVisible(false);
    if (this.textures.exists(TextureKeys.KeybindElderIcon)) {
      this.dialogueIcon = this.add.image(206, 596, TextureKeys.KeybindElderIcon)
        .setDisplaySize(64, 64)
        .setDepth(1002)
        .setVisible(false);
    }
    if (this.textures.exists(TextureKeys.KeikoRadioOverlay)) {
      this.dialogueRadioOverlay = this.add.image(338, 590, TextureKeys.KeikoRadioOverlay)
        .setDisplaySize(270, 82)
        .setDepth(1001)
        .setVisible(false);
    }
    this.dialogueSpeaker = makePixelText(this, 270, 530, '', 17, '#f0c36b').setDepth(1003).setVisible(false);
    this.dialogueBody = makePixelText(this, 270, 558, '', 14, '#f6ead3').setDepth(1003).setWordWrapWidth(820).setVisible(false);

    this.pauseMenu = new PauseMenuOverlay(this, () => this.scene.start(SceneKeys.Title));
    addRoomHint(this, {
      title: 'RESCUE — The Keybind Elder',
      steps: [
        'Three sentinels guard the cage — defeat them all first',
        'Use X to strike. WASD or Arrows to move.',
        'Then walk to the Elder and press Enter to talk',
        'After rescue, the gold EXIT on the right opens',
      ],
    });    showKeikoHelper(this, {
      title: 'The Keybind Elder \u2014 Rescue Room',
      speaker: 'Keiko (radio)',
      radio: true,
      lines: [
        'That man in the cage is the Keybind Elder \u2014 the one who taught me the Z key years ago.',
        'Null Oni\u2019s sentinels caught him before he could finish his last vow. He cannot help while they pin him.',
        'Clear the three red sentinels with X first, then walk to the cage and press Enter to talk.',
        'After the rescue, walk through the gold EXIT on the right to continue.',
      ],
    });    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (this.pauseMenu.handleKey(event)) return;
      if (event.key === 'Escape') { this.pauseMenu.toggle(); return; }
      if (this.pauseMenu.isOpen || this.transitioning) return;
      if (event.key.toLowerCase() === 'x') this.strike();
      if (event.key === 'Enter') this.handleInteract();
    });
  }

  update(_time: number, delta: number): void {
    publishFrameHealth('sage', delta);
    if (this.transitioning || this.pauseMenu.isOpen || this.dialogueActive) {
      this.player.setVelocity(0, 0);
      this.minions.forEach((m) => m.alive && m.sprite.setVelocity(0, 0));
      return;
    }
    this.handleMovement(delta);
    clampSpriteToArenaBounds(this.player, this.walkableBounds, 1.0);
    this.playerShadow.setPosition(this.player.x, this.player.y + 29).setDepth(this.player.y - 8);
    this.player.setDepth(this.player.y);
    this.playerBar.setValue(this.playerHp, this.maxHp);
    this.updateMinions(delta);
    this.updatePrompts();

    if (this.phase === 'combat') {
      if (this.minions.every((m) => !m.alive)) {
        this.phase = 'post-combat';
        this.dialogueIndex = 0;
        this.currentDialogue = postCombatDialogue;
        this.interactPrompt.setText('Press Enter to speak with the Elder');
      }
    }
  }

  private spawnMinions(): void {
    const positions = [
      { x: 540, y: 320 },
      { x: 560, y: 460 },
      { x: 880, y: 420 },
    ];
    positions.forEach((pos) => {
      const usesMinionSheet = this.textures.exists(TextureKeys.SageRescueMinions);
      const sprite = this.physics.add.sprite(pos.x, pos.y, usesMinionSheet ? TextureKeys.SageRescueMinions : TextureKeys.Hero, 0)
        .setCollideWorldBounds(true)
        .setDrag(900)
        .setDisplaySize(usesMinionSheet ? 76 : 64, usesMinionSheet ? 76 : 70)
        .setData('usesSageRescueMinions', usesMinionSheet);
      if (!usesMinionSheet) sprite.setTint(0xd64f45);
      sprite.body?.setSize(34, 36).setOffset(15, 30);
      if (usesMinionSheet) sprite.setFrame(0);
      else setActorPose(sprite, 'idle');
      const shadow = this.add.image(pos.x, pos.y + 26, TextureKeys.Shadow).setDisplaySize(76, 28).setAlpha(0.42).setDepth(pos.y - 8);
      this.minions.push({
        sprite,
        shadow,
        hp: 24,
        velocity: new Phaser.Math.Vector2(0, 0),
        attackReadyAt: this.time.now + Phaser.Math.Between(1800, 2800),
        alive: true,
      });
    });
    this.phase = 'combat';
  }

  private updateMinions(delta: number): void {
    this.minions.forEach((minion) => {
      if (!minion.alive) return;
      const dx = this.player.x - minion.sprite.x;
      const dy = this.player.y - minion.sprite.y;
      const distance = Math.max(1, Math.hypot(dx, dy));

      if (this.time.now >= minion.attackReadyAt && distance < 90) {
        // Attack the player
        if (minion.sprite.getData('usesSageRescueMinions')) minion.sprite.setFrame(1);
        if (this.time.now >= this.invulnerableUntil) {
          this.damagePlayer(7, minion.sprite.x, minion.sprite.y);
        }
        minion.attackReadyAt = this.time.now + Phaser.Math.Between(1600, 2400);
        return;
      }

      const angle = Math.atan2(dy, dx);
      const desired = new Phaser.Math.Vector2(Math.cos(angle) * 60, Math.sin(angle) * 45);
      minion.velocity.lerp(desired, Math.min(1, delta / 120));
      minion.sprite.setVelocity(minion.velocity.x, minion.velocity.y);
      if (minion.sprite.getData('usesSageRescueMinions')) minion.sprite.setFrame(0);
      clampSpriteToArenaBounds(minion.sprite, this.walkableBounds, 1.0);
      minion.sprite.setFlipX(minion.sprite.x > this.player.x);
      minion.sprite.setDepth(minion.sprite.y);
      minion.shadow.setPosition(minion.sprite.x, minion.sprite.y + 26).setDepth(minion.sprite.y - 8);
    });
  }

  private strike(): void {
    if (!this.canStrike || this.phase === 'rescued' || this.phase === 'done') return;
    this.canStrike = false;
    playSlash(this);
    setActorPose(this.player, 'swing');
    const direction = this.lastMoveDirection.x < -0.1 ? -1 : 1;
    const sword = addSwordSwing(this, this.player.x, this.player.y, direction, this.player.y + 20, 0);
    this.minions.forEach((minion) => {
      if (!minion.alive) return;
      const dist = Math.min(
        Phaser.Math.Distance.Between(sword.hitX, sword.hitY, minion.sprite.x, minion.sprite.y),
        Phaser.Math.Distance.Between(this.player.x, this.player.y, minion.sprite.x, minion.sprite.y),
      );
      if (dist < 130) {
        minion.hp -= 14;
        playHit(this);
        addHitSparks(this, minion.sprite.x, minion.sprite.y - 30, minion.sprite.y + 16);
        minion.sprite.setTintFill(0xf6ead3);
        this.time.delayedCall(80, () => {
          minion.sprite.clearTint();
          if (!minion.sprite.getData('usesSageRescueMinions')) minion.sprite.setTint(0xd64f45);
        });
        if (minion.hp <= 0) {
          minion.alive = false;
          if (minion.sprite.getData('usesSageRescueMinions')) minion.sprite.setFrame(2);
          this.tweens.add({
            targets: [minion.sprite, minion.shadow],
            alpha: 0, scale: 0.3, duration: 280,
            onComplete: () => { minion.sprite.destroy(); minion.shadow.destroy(); },
          });
        }
      }
    });
    this.time.delayedCall(280, () => {
      this.canStrike = true;
      setActorPose(this.player, 'idle');
    });
  }

  private damagePlayer(damage: number, sourceX: number, sourceY: number): void {
    this.playerHp = Math.max(0, this.playerHp - damage);
    this.invulnerableUntil = this.time.now + 700;
    setActorPose(this.player, 'hurt');
    playHit(this);
    this.player.setTintFill(0xd64f45);
    this.time.delayedCall(120, () => this.player.clearTint());
    this.time.delayedCall(220, () => setActorPose(this.player, 'idle'));
    const angle = Phaser.Math.Angle.Between(sourceX, sourceY, this.player.x, this.player.y);
    this.currentVelocity.set(Math.cos(angle) * 150, Math.sin(angle) * 105);
    this.player.setVelocity(this.currentVelocity.x, this.currentVelocity.y);
    if (this.playerHp <= 0) {
      this.playerHp = Math.floor(this.maxHp * 0.5);
      this.player.setPosition(240, 440);
      this.currentVelocity.set(0, 0);
      this.cameras.main.flash(300, 13, 4, 16);
    }
  }

  private updatePrompts(): void {
    const nearElder = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.ELDER_X, this.ELDER_Y) < 180;
    const nearExit = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.EXIT_X, this.EXIT_Y) < 120;
    if (this.phase === 'pre-combat' || this.phase === 'combat') {
      const enemiesLeft = this.minions.filter((m) => m.alive).length;
      if (enemiesLeft > 0) {
        this.interactPrompt.setAlpha(0);
      } else {
        this.interactPrompt.setAlpha(nearElder ? 0.95 : 0).setText('Press Enter to speak with the Elder');
      }
    } else if (this.phase === 'post-combat') {
      this.interactPrompt.setAlpha(nearElder ? 0.95 : 0);
    } else if (this.phase === 'rescued' || this.phase === 'done') {
      this.interactPrompt.setAlpha(nearElder ? 0.8 : 0).setText('Walk to the EXIT on the right');
      if (this.phase === 'done' && nearExit && !this.transitioning) {
        this.transitioning = true;
        playBoom(this, 0.45);
        this.cameras.main.flash(300, 240, 195, 101);
        this.time.delayedCall(420, () => fadeToScene(this, SceneKeys.Dungeon, 360, { startRoom: 5 }));
      }
    }
  }

  private buildCage(): void {
    const cx = this.ELDER_X;
    const cy = this.ELDER_Y;
    const halfW = 76;
    const top = cy - 90;
    const bottom = cy + 58;
    const height = bottom - top;
    const barColor = 0x8f5030;
    const glowColor = 0xd64f45;

    this.cageTop = this.add.rectangle(cx, top, halfW * 2 + 14, 10, barColor, 0.9)
      .setStrokeStyle(2, glowColor, 0.5).setDepth(this.ELDER_Y + 5);
    this.cageBottom = this.add.rectangle(cx, bottom, halfW * 2 + 14, 10, barColor, 0.9)
      .setStrokeStyle(2, glowColor, 0.5).setDepth(this.ELDER_Y + 5);

    const barXPositions = [-halfW, -halfW / 2, 0, halfW / 2, halfW];
    barXPositions.forEach((offsetX) => {
      const bar = this.add.rectangle(cx + offsetX, cy - 16, 10, height, barColor, 0.88)
        .setStrokeStyle(1, glowColor, 0.4).setDepth(this.ELDER_Y + 6);
      this.cageBars.push(bar);
    });

    this.cageGlow = this.add.ellipse(cx, cy - 16, halfW * 2 + 30, height + 20, glowColor, 0.06)
      .setDepth(this.ELDER_Y - 2);
    this.tweens.add({ targets: this.cageGlow, alpha: 0.14, scaleX: 1.06, scaleY: 1.06, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  private handleInteract(): void {
    if (this.transitioning) return;
    if (this.phase === 'pre-combat' || this.phase === 'combat') {
      if (this.minions.some((m) => m.alive)) return;
      this.phase = 'post-combat';
      this.dialogueIndex = 0;
      this.currentDialogue = postCombatDialogue;
    }

    if (this.dialogueActive) {
      this.dialogueIndex += 1;
      if (this.dialogueIndex >= this.currentDialogue.length) {
        this.endDialogueBlock();
        return;
      }
      this.showDialogueLine(this.currentDialogue[this.dialogueIndex]);
      return;
    }

    if (this.phase === 'post-combat' || this.phase === 'rescued') {
      const nearElder = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.ELDER_X, this.ELDER_Y) < 180;
      if (!nearElder) return;
      this.dialogueActive = true;
      this.dialogueIndex = 0;
      this.showDialogueLine(this.currentDialogue[0]);
    }
  }

  private endDialogueBlock(): void {
    this.dialogueActive = false;
    (this.dialoguePanel as Phaser.GameObjects.GameObject & { setVisible: (v: boolean) => void }).setVisible(false);
    this.dialogueIcon?.setVisible(false);
    this.dialogueRadioOverlay?.setVisible(false);
    this.dialogueSpeaker.setVisible(false);
    this.dialogueBody.setVisible(false);

    if (this.phase === 'post-combat') {
      // Grant Z key, break cage, transition to rescued
      this.breakCage();
      this.phase = 'rescued';
      this.dialogueIndex = 0;
      this.currentDialogue = afterRescueDialogue;
    } else if (this.phase === 'rescued') {
      this.phase = 'done';
      // Show exit marker
      this.exitBeacon?.setVisible(true);
    }
  }

  private showDialogueLine(line: SageDialogueLine): void {
    (this.dialoguePanel as Phaser.GameObjects.GameObject & { setVisible: (v: boolean) => void }).setVisible(true);
    const isElder = line.speaker.includes('Keybind Elder');
    const isRadio = line.speaker.includes('radio');
    this.dialogueIcon?.setVisible(isElder);
    this.dialogueRadioOverlay?.setVisible(isRadio);
    this.dialogueSpeaker.setVisible(true).setText(line.speaker).setColor(line.color);
    this.dialogueBody.setVisible(true).setText(line.text);
  }

  private breakCage(): void {
    const save = loadSave();
    save.abilityKeyUnlocked = true;
    writeSave(save);

    playCast(this);
    this.cameras.main.flash(500, 240, 180, 50);
    playBoom(this, 0.6);

    [...this.cageBars].forEach((bar, i) => {
      const dir = i < this.cageBars.length / 2 ? -1 : 1;
      this.tweens.add({
        targets: bar,
        x: bar.x + dir * (80 + i * 22),
        y: bar.y - 120 - i * 18,
        alpha: 0,
        rotation: dir * (0.8 + i * 0.3),
        scaleY: 0.4,
        duration: 600,
        ease: 'Quad.Out',
        onComplete: () => bar.destroy(),
      });
    });
    this.tweens.add({ targets: this.cageTop, y: this.cageTop.y - 180, alpha: 0, duration: 500, ease: 'Quad.Out', onComplete: () => this.cageTop.destroy() });
    this.tweens.add({ targets: this.cageBottom, y: this.cageBottom.y + 140, alpha: 0, duration: 500, ease: 'Quad.Out', onComplete: () => this.cageBottom.destroy() });
    this.tweens.add({ targets: this.cageGlow, alpha: 0, scaleX: 2, scaleY: 2, duration: 400, onComplete: () => this.cageGlow.destroy() });

    const banner = makePixelText(this, 640, 200, 'Z KEY UNLOCKED — instant vow cast', 22, '#f0c36b', 'center')
      .setOrigin(0.5).setDepth(1500).setAlpha(0).setStroke('#09070d', 6);
    this.tweens.add({ targets: banner, alpha: 1, y: 180, duration: 400, ease: 'Quad.Out' });
    this.tweens.add({ targets: banner, alpha: 0, duration: 500, ease: 'Quad.In', delay: 1800, onComplete: () => banner.destroy() });

    this.time.delayedCall(700, () => {
      setActorPose(this.elder as unknown as Phaser.Physics.Arcade.Sprite, 'idle');
      this.tweens.add({ targets: [this.elder, this.elderShadow], x: '-=60', duration: 600, ease: 'Quad.Out' });
    });
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
