import Phaser from 'phaser';
import { installAudioUnlock } from './audioUnlock';
import { addActorSprite, setActorPose } from './actors';
import { SceneKeys, TextureKeys } from './sceneKeys';
import { addPanel, makePixelText, addHealthBar, addRoomDepthBorders, addArenaDepthCues, playBoom, playHit, playCast } from './ui';
import { createGameKeys, type GameKeys } from '../systems/input';
import { loadSave, writeSave } from '../systems/saveSystem';
import { PauseMenuOverlay, TerminalOverlay } from './overlays';
import { publishControlScheme, publishFrameHealth } from './runtimeDebug';
import { apprenticeMovementTuning, readMovementInput, stepMovementVelocity } from '../systems/movementEngine';
import { clampSpriteToArenaBounds, fadeInFromBlack, fadeToScene } from './transition';
import { addRoomHint } from './roomHint';
import { addBrightnessLift, addVisibleExitBeacon, showKeikoHelper } from './roomIntro';

interface TrapTile {
  shape: Phaser.GameObjects.Rectangle;
  icon?: Phaser.GameObjects.Image;
  x: number;
  y: number;
  armed: boolean;
  detonateAt: number;
  type: 'spike' | 'void' | 'crumble';
  revealed: boolean;
}

export class TrapRoomScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerShadow!: Phaser.GameObjects.Image;
  private keys!: GameKeys;
  private terminal!: TerminalOverlay;
  private pauseMenu!: PauseMenuOverlay;
  private currentVelocity = new Phaser.Math.Vector2(0, 0);
  private lastMoveDirection = new Phaser.Math.Vector2(1, 0);
  private moveHeldMs = 0;
  private playerHp = 100;
  private maxHp = 100;
  private playerBar!: ReturnType<typeof addHealthBar>;
  private traps: TrapTile[] = [];
  private statusText!: Phaser.GameObjects.Text;
  private trapsSurvived = 0;
  private totalTraps = 0;
  private goalReached = false;
  private transitioning = false;
  private invulnerableUntil = 0;
  private revealedCount = 0;
  private readonly walkableBounds = new Phaser.Geom.Rectangle(120, 180, 1040, 420);
  private goalZone!: Phaser.GameObjects.Rectangle;

  constructor() {
    super(SceneKeys.TrapRoom);
  }

  init(): void {
    this.transitioning = false;
    this.goalReached = false;
    this.invulnerableUntil = 0;
    this.currentVelocity.set(0, 0);
    this.lastMoveDirection.set(1, 0);
    this.moveHeldMs = 0;
    this.traps = [];
    this.trapsSurvived = 0;
    this.totalTraps = 0;
    this.revealedCount = 0;
  }

  create(): void {
    (window as unknown as { __CODEJITSU_SCENE?: string }).__CODEJITSU_SCENE = 'trap';
    publishControlScheme('trap');
    installAudioUnlock(this);
    writeSave({ ...loadSave(), currentCheckpoint: 'dungeon' });
    this.keys = createGameKeys(this);
    this.maxHp = loadSave().playerUpgrades.maxHp;
    this.playerHp = this.maxHp;
    this.cameras.main.setBackgroundColor('#100810');
    if (this.textures.exists(TextureKeys.TrapBitmaskBridge)) {
      this.add.image(640, 360, TextureKeys.TrapBitmaskBridge).setDisplaySize(1280, 720).setDepth(0);
    } else {
      this.add.rectangle(640, 360, 1280, 720, 0x100810).setDepth(0);
    }
    addRoomDepthBorders(this, this.walkableBounds, { sceneId: 'trap', frontDepth: 850, accentColor: 0xd64f45 });
    addArenaDepthCues(this, this.walkableBounds, { sceneId: 'trap', accentColor: 0xd64f45, foregroundDepth: 852 });
    addBrightnessLift(this, 3, 0.18);
    fadeInFromBlack(this);
    this.buildTrapGrid();
    this.player = addActorSprite(this, 'hero', 200, 500, TextureKeys.Hero, 1.28);
    this.player.setCollideWorldBounds(true).setDrag(1500);
    this.player.body?.setSize(28, 24).setOffset(18, 62);
    this.playerShadow = this.add.image(this.player.x, this.player.y + 29, TextureKeys.Shadow).setDisplaySize(82, 34).setAlpha(0.43).setDepth(this.player.y - 8);
    this.playerBar = addHealthBar(this, 36, 20, 260, 20, 'Apprentice');
    addPanel(this, 30, 650, 600, 50, 0.65).setDepth(900);
    this.statusText = makePixelText(this, 44, 658, 'Terminal: scan | disarm <id> | reveal', 12, '#d64f45').setDepth(901);
    this.goalZone = addVisibleExitBeacon(this, { x: 1110, y: 290, label: 'EXIT' }).rect;
    this.terminal = new TerminalOverlay(this, (cmd) => this.handleTrapCommand(cmd), undefined, {
      helpHeader: 'trap commands',
      greeting: ['# bitmask bridge — defuse the floor'],
      commandSet: [
        { command: 'scan', description: 'briefly reveal traps within 200px' },
        { command: 'reveal', description: 'flash every armed trap on the bridge' },
        { command: 'disarm', description: 'defuse the nearest trap (must be in range)' },
        { command: 'help', description: 'show this list again' },
      ],
    });
    this.pauseMenu = new PauseMenuOverlay(this, () => this.scene.start(SceneKeys.Title));
    addRoomHint(this, {
      title: 'TRAP ROOM — bitmask bridge',
      steps: [
        'Hidden traps are scattered across the floor.',
        'Press T → type:  scan   |   reveal   |   disarm',
        '"scan" reveals nearby traps. "disarm" defuses one in range.',
        'Reach the gold EXIT to advance.',
      ],
    });    showKeikoHelper(this, {
      title: 'Bitmask Bridge \u2014 Trap Room',
      lines: [
        'The floor here is a boolean grid \u2014 every dim tile is a primed trap.',
        'Press T to open the terminal. Type "scan" to pulse the floor, then "disarm" when you stand near one.',
        'You can also walk carefully through unrevealed gaps, but each hit costs HP.',
        'Walk into the bright gold EXIT beacon on the right to advance.',
      ],
    });    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (this.terminal.handleKey(event)) return;
      if (this.pauseMenu.handleKey(event)) return;
      if (event.key === 'Escape') { this.pauseMenu.toggle(); return; }
      if (this.pauseMenu.isOpen || this.transitioning) return;
      if (event.key.toLowerCase() === 't') this.terminal.open(event.timeStamp);
    });
  }

  update(time: number, delta: number): void {
    publishFrameHealth('trap', delta);
    if (this.transitioning || this.pauseMenu.isOpen || this.terminal.isOpen) return;
    this.handleMovement(delta);
    clampSpriteToArenaBounds(this.player, this.walkableBounds, 1.0);
    this.playerShadow.setPosition(this.player.x, this.player.y + 29).setDepth(this.player.y - 8);
    this.player.setDepth(this.player.y);
    this.checkTrapCollisions(time);
    this.checkGoal();
    this.playerBar.setValue(this.playerHp, this.maxHp);
  }

  private buildTrapGrid(): void {
    const trapPositions = [
      { x: 320, y: 300, type: 'spike' as const },
      { x: 440, y: 350, type: 'void' as const },
      { x: 560, y: 280, type: 'spike' as const },
      { x: 680, y: 400, type: 'crumble' as const },
      { x: 800, y: 320, type: 'void' as const },
      { x: 920, y: 380, type: 'spike' as const },
      { x: 380, y: 450, type: 'crumble' as const },
      { x: 500, y: 240, type: 'void' as const },
      { x: 740, y: 260, type: 'spike' as const },
      { x: 860, y: 460, type: 'crumble' as const },
      { x: 600, y: 440, type: 'spike' as const },
      { x: 1000, y: 300, type: 'void' as const },
    ];

    trapPositions.forEach((pos, index) => {
      const shape = this.add.rectangle(pos.x, pos.y, 50, 50, 0x1a0d1e, 0.3).setDepth(10);
      const trapFrameIndex = pos.type === 'void' ? 1 : pos.type === 'crumble' ? 2 : 0;
      const icon = this.textures.exists(TextureKeys.TrapVariants)
        ? this.add.image(pos.x, pos.y, TextureKeys.TrapVariants, trapFrameIndex)
          .setOrigin(0.5, 0.5)
          .setDisplaySize(54, 54)
          .setAlpha(0.16)
          .setDepth(11)
        : undefined;
      this.traps.push({
        shape, icon, x: pos.x, y: pos.y,
        armed: true, detonateAt: 0,
        type: pos.type, revealed: false,
      });
    });
    this.totalTraps = this.traps.length;
  }

  private checkTrapCollisions(time: number): void {
    if (this.time.now < this.invulnerableUntil) return;
    this.traps.forEach((trap) => {
      if (!trap.armed) return;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, trap.x, trap.y);
      if (dist < 35) {
        this.triggerTrap(trap);
      }
    });
  }

  private triggerTrap(trap: TrapTile): void {
    if (!trap.armed) return;
    const damage = trap.type === 'spike' ? 15 : trap.type === 'void' ? 20 : 10;
    trap.armed = false;
    this.trapsSurvived += 1;
    trap.shape.setFillStyle(trap.type === 'spike' ? 0xd64f45 : trap.type === 'void' ? 0xb85dff : 0xff8a65, 0.6);
    trap.shape.setStrokeStyle(2, 0xd64f45, 0.8);
    trap.icon?.setAlpha(0.9);
    this.tweens.add({ targets: [trap.shape, trap.icon].filter(Boolean), alpha: 0, scaleX: 1.5, scaleY: 1.5, duration: 500, onComplete: () => { trap.shape.destroy(); trap.icon?.destroy(); } });
    this.damagePlayer(damage, trap.x, trap.y);
    playBoom(this, 0.4);
    this.cameras.main.shake(80, 0.004);
  }

  private damagePlayer(damage: number, sourceX: number, sourceY: number): void {
    this.playerHp = Math.max(0, this.playerHp - damage);
    this.invulnerableUntil = this.time.now + 600;
    setActorPose(this.player, 'hurt');
    playHit(this);
    this.player.setTintFill(0xd64f45);
    this.time.delayedCall(120, () => this.player.clearTint());
    this.time.delayedCall(220, () => setActorPose(this.player, 'idle'));
    const angle = Phaser.Math.Angle.Between(sourceX, sourceY, this.player.x, this.player.y);
    this.currentVelocity.set(Math.cos(angle) * 180, Math.sin(angle) * 130);
    this.player.setVelocity(this.currentVelocity.x, this.currentVelocity.y);
    if (this.playerHp <= 0) {
      this.playerHp = Math.floor(this.maxHp * 0.4);
      this.player.setPosition(200, 500);
      this.currentVelocity.set(0, 0);
      this.cameras.main.flash(300, 13, 4, 16);
      this.statusText.setText('Respawned. Use terminal to scan for traps.');
    }
  }

  private handleTrapCommand(input: string): void {
    const cmd = input.trim().toLowerCase();
    const parts = cmd.split(/\s+/);
    const action = parts[0];

    if (action === 'scan') {
      const nearby = this.traps
        .filter((t) => t.armed && Phaser.Math.Distance.Between(this.player.x, this.player.y, t.x, t.y) < 200)
        .length;
      this.statusText.setText(`Scan: ${nearby} trap(s) nearby. ${this.traps.filter((t) => t.armed).length} total armed.`);
      playCast(this);
      // Briefly reveal nearby traps
      this.traps.forEach((trap) => {
        if (!trap.armed) return;
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, trap.x, trap.y);
        if (dist < 200) {
          trap.revealed = true;
          this.revealedCount += 1;
          const color = trap.type === 'spike' ? 0xd64f45 : trap.type === 'void' ? 0xb85dff : 0xff8a65;
          trap.shape.setFillStyle(color, 0.25).setStrokeStyle(2, color, 0.5);
          trap.icon?.setAlpha(0.9);
          this.time.delayedCall(3000, () => {
            if (trap.armed) {
              trap.shape.setFillStyle(0x1a0d1e, 0.3).setStrokeStyle(0);
              trap.icon?.setAlpha(0.16);
              trap.revealed = false;
            }
          });
        }
      });
      return;
    }

    if (action === 'reveal') {
      this.traps.forEach((trap) => {
        if (!trap.armed) return;
        trap.revealed = true;
        const color = trap.type === 'spike' ? 0xd64f45 : trap.type === 'void' ? 0xb85dff : 0xff8a65;
        trap.shape.setFillStyle(color, 0.15).setStrokeStyle(1, color, 0.3);
        trap.icon?.setAlpha(0.72);
      });
      this.statusText.setText(`All ${this.traps.filter((t) => t.armed).length} traps revealed briefly.`);
      playCast(this);
      this.time.delayedCall(5000, () => {
        this.traps.forEach((trap) => {
          if (trap.armed && trap.revealed) {
            trap.shape.setFillStyle(0x1a0d1e, 0.3).setStrokeStyle(0);
            trap.icon?.setAlpha(0.16);
            trap.revealed = false;
          }
        });
      });
      return;
    }

    if (action === 'disarm') {
      const nearest = this.traps
        .filter((t) => t.armed && Phaser.Math.Distance.Between(this.player.x, this.player.y, t.x, t.y) < 120)
        .sort((a, b) => Phaser.Math.Distance.Between(this.player.x, this.player.y, a.x, a.y) - Phaser.Math.Distance.Between(this.player.x, this.player.y, b.x, b.y))[0];
      if (nearest) {
        nearest.armed = false;
        nearest.shape.setFillStyle(0x4fc3f7, 0.2).setStrokeStyle(2, 0x4fc3f7, 0.5);
        nearest.icon?.setAlpha(0.35).setTint(0x4fc3f7);
        this.trapsSurvived += 1;
        playCast(this);
        this.statusText.setText(`Trap disarmed. ${this.traps.filter((t) => t.armed).length} remain.`);
        this.tweens.add({ targets: nearest.shape, alpha: 0.1, duration: 800 });
      } else {
        this.statusText.setText('No trap in range to disarm. Move closer.');
      }
      return;
    }

    if (action === 'help') {
      this.statusText.setText('Commands: scan | reveal | disarm | help');
      return;
    }

    this.statusText.setText(`Unknown: "${action}". Try: scan, reveal, disarm`);
  }

  private checkGoal(): void {
    if (this.goalReached) return;
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.goalZone.x, this.goalZone.y);
    if (dist < 80) {
      this.goalReached = true;
      this.transitioning = true;
      this.statusText.setText('Bitmask Bridge cleared.');
      playBoom(this, 0.5);
      this.cameras.main.flash(400, 240, 195, 101);
      this.time.delayedCall(800, () => {
        fadeToScene(this, SceneKeys.Dungeon, 360, { startRoom: 6 });
      });
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
