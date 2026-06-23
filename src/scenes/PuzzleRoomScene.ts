import Phaser from 'phaser';
import { installAudioUnlock } from './audioUnlock';
import { addActorSprite, setActorPose } from './actors';
import { SceneKeys, TextureKeys } from './sceneKeys';
import { addPanel, makePixelText, addHealthBar, addRoomDepthBorders, addArenaDepthCues, playBoom, playCast } from './ui';
import { createGameKeys, type GameKeys } from '../systems/input';
import { loadSave, writeSave } from '../systems/saveSystem';
import { PauseMenuOverlay, TerminalOverlay } from './overlays';
import { publishControlScheme, publishFrameHealth } from './runtimeDebug';
import { apprenticeMovementTuning, readMovementInput, stepMovementVelocity } from '../systems/movementEngine';
import { clampSpriteToArenaBounds, fadeInFromBlack, fadeToScene } from './transition';
import { isTestMode } from '../systems/testMode';
import { addRoomHint } from './roomHint';

interface GateNode {
  sprite: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image;
  outline: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  id: string;
  value: boolean;
  solved: boolean;
  x: number;
  y: number;
}

interface PuzzleConfig {
  id: string;
  title: string;
  description: string;
  nodes: Array<{ id: string; x: number; y: number; initialValue: boolean; targetValue: boolean }>;
  terminalHint: string;
  solution: string[];
  nextScene: string;
  nextSceneData?: Record<string, unknown>;
}

const puzzleConfigs: Record<string, PuzzleConfig> = {
  'boolean-gate': {
    id: 'boolean-gate',
    title: 'Boolean Gate',
    description: 'Match each node to its target rune.',
    nodes: [
      { id: 'alpha', x: 420, y: 280, initialValue: false, targetValue: true },
      { id: 'beta', x: 640, y: 280, initialValue: true, targetValue: false },
      { id: 'gamma', x: 860, y: 280, initialValue: true, targetValue: true },
      { id: 'delta', x: 320, y: 420, initialValue: true, targetValue: false },
      { id: 'epsilon', x: 530, y: 420, initialValue: false, targetValue: true },
      { id: 'zeta', x: 750, y: 420, initialValue: true, targetValue: false },
      { id: 'eta', x: 960, y: 420, initialValue: false, targetValue: true },
    ],
    terminalHint: 'toggle <node> | negate <node> | and <a> <b> | xor <a> <b> | inspect',
    solution: ['toggle alpha', 'negate beta'],
    nextScene: SceneKeys.Dungeon,
    nextSceneData: { startRoom: 3 },
  },
  'checksum-mausoleum': {
    id: 'checksum-mausoleum',
    title: 'Checksum Mausoleum',
    description: 'Match the bit pattern, then run "checksum".',
    nodes: [
      { id: 'bit0', x: 340, y: 300, initialValue: true, targetValue: false },
      { id: 'bit1', x: 460, y: 300, initialValue: false, targetValue: true },
      { id: 'bit2', x: 580, y: 300, initialValue: true, targetValue: true },
      { id: 'bit3', x: 700, y: 300, initialValue: false, targetValue: false },
      { id: 'bit4', x: 820, y: 300, initialValue: true, targetValue: true },
      { id: 'bit5', x: 940, y: 300, initialValue: false, targetValue: true },
      { id: 'sum', x: 640, y: 460, initialValue: false, targetValue: true },
    ],
    terminalHint: 'flip <bit> | xor <a> <b> | checksum | verify',
    solution: ['flip bit0', 'flip bit1', 'flip bit5', 'checksum'],
    nextScene: SceneKeys.MiniBoss,
  },
};

export class PuzzleRoomScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerShadow!: Phaser.GameObjects.Image;
  private keys!: GameKeys;
  private terminal!: TerminalOverlay;
  private pauseMenu!: PauseMenuOverlay;
  private currentVelocity = new Phaser.Math.Vector2(0, 0);
  private lastMoveDirection = new Phaser.Math.Vector2(1, 0);
  private moveHeldMs = 0;
  private nodes: GateNode[] = [];
  private puzzleConfig!: PuzzleConfig;
  private titleText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private transitioning = false;
  private commandHistory: string[] = [];
  private readonly walkableBounds = new Phaser.Geom.Rectangle(176, 200, 912, 380);

  constructor() {
    super(SceneKeys.PuzzleRoom);
  }

  init(data?: { puzzleId?: string }): void {
    this.transitioning = false;
    this.currentVelocity.set(0, 0);
    this.lastMoveDirection.set(1, 0);
    this.moveHeldMs = 0;
    this.nodes = [];
    this.commandHistory = [];
    this.puzzleConfig = puzzleConfigs[data?.puzzleId ?? 'boolean-gate'] ?? puzzleConfigs['boolean-gate'];
  }

  create(): void {
    (window as unknown as { __CODEJITSU_SCENE?: string }).__CODEJITSU_SCENE = 'puzzle';
    publishControlScheme('puzzle');
    installAudioUnlock(this);
    writeSave({ ...loadSave(), currentCheckpoint: 'dungeon' });
    this.keys = createGameKeys(this);
    this.cameras.main.setBackgroundColor('#0a0812');
    if (this.textures.exists(TextureKeys.PuzzleRoomArchive)) {
      this.add.image(640, 360, TextureKeys.PuzzleRoomArchive).setDisplaySize(1280, 720).setDepth(0);
    } else {
      this.add.rectangle(640, 360, 1280, 720, 0x0a0812).setDepth(0);
    }
    addRoomDepthBorders(this, this.walkableBounds, { sceneId: 'puzzle', frontDepth: 850, accentColor: 0x4fc3f7 });
    addArenaDepthCues(this, this.walkableBounds, { sceneId: 'puzzle', accentColor: 0x4fc3f7, foregroundDepth: 852 });
    fadeInFromBlack(this);
    this.player = addActorSprite(this, 'hero', 200, 540, TextureKeys.Hero, 1.28);
    this.player.setCollideWorldBounds(true).setDrag(1500);
    this.player.body?.setSize(28, 24).setOffset(18, 62);
    this.playerShadow = this.add.image(this.player.x, this.player.y + 29, TextureKeys.Shadow).setDisplaySize(82, 34).setAlpha(0.43).setDepth(this.player.y - 8);
    this.createPuzzleNodes();
    this.createHud();
    this.terminal = new TerminalOverlay(this, (cmd) => this.handlePuzzleCommand(cmd), undefined, {
      helpHeader: 'puzzle commands',
      greeting: [`# ${this.puzzleConfig.title.toLowerCase()} — solve the gate`],
      commandSet: [
        { command: 'inspect', description: 'list every node and its current state' },
        { command: 'toggle', description: 'flip <node> e.g. toggle alpha' },
        { command: 'negate', description: 'invert <node> e.g. negate beta' },
        { command: 'and', description: 'AND <a> <b> stores result in <a>' },
        { command: 'xor', description: 'XOR <a> <b> stores result in <a>' },
        { command: 'flip', description: 'alias for toggle' },
        { command: 'checksum', description: 'verify the sum matches' },
        { command: 'reset', description: 'restore all nodes to their start state' },
        { command: 'help', description: 'show this list again' },
      ],
    });
    this.pauseMenu = new PauseMenuOverlay(this, () => this.scene.start(SceneKeys.Title));
    addRoomHint(this, {
      title: `PUZZLE — ${this.puzzleConfig.title}`,
      steps: [
        'Press T to open the terminal',
        'Tab autocompletes commands. ↑↓ for history.',
        'The small bar above each node shows its target colour.',
        'Match every node to unlock the gate.',
      ],
    });
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (this.terminal.handleKey(event)) return;
      if (this.pauseMenu.handleKey(event)) return;
      if (event.key === 'Escape') { this.pauseMenu.toggle(); return; }
      if (this.pauseMenu.isOpen || this.transitioning) return;
      if (event.key.toLowerCase() === 't') this.terminal.open(event.timeStamp);
    });
  }

  update(_time: number, delta: number): void {
    publishFrameHealth('puzzle', delta);
    if (this.transitioning || this.pauseMenu.isOpen || this.terminal.isOpen) return;
    this.handleMovement(delta);
    clampSpriteToArenaBounds(this.player, this.walkableBounds, 1.0);
    this.playerShadow.setPosition(this.player.x, this.player.y + 29).setDepth(this.player.y - 8);
    this.player.setDepth(this.player.y);
    this.updateNodeProximityHighlight();
  }

  private createPuzzleNodes(): void {
    this.puzzleConfig.nodes.forEach((nodeConfig) => {
      const color = nodeConfig.initialValue ? 0x4fc3f7 : 0x3a1f44;
      const outline = this.add.rectangle(nodeConfig.x, nodeConfig.y, 86, 86, 0x000000, 0)
        .setStrokeStyle(3, 0xf0c36b, 0.6).setDepth(99);
      const sprite = this.textures.exists(TextureKeys.PuzzleNodeStates)
        ? this.add.image(nodeConfig.x, nodeConfig.y, TextureKeys.PuzzleNodeStates, nodeConfig.initialValue ? 1 : 0)
          .setOrigin(0.5, 0.5)
          .setDisplaySize(80, 80)
          .setDepth(100)
        : this.add.rectangle(nodeConfig.x, nodeConfig.y, 80, 80, color, 0.7).setDepth(100);
      // Label below the node so it doesn't overlap the body
      const label = makePixelText(this, nodeConfig.x, nodeConfig.y + 50, nodeConfig.id, 13, '#f6ead3', 'center')
        .setOrigin(0.5, 0).setDepth(101);
      // Target state indicator (small bar above the node)
      const targetColor = nodeConfig.targetValue ? 0x4fc3f7 : 0x3a1f44;
      this.add.rectangle(nodeConfig.x, nodeConfig.y - 56, 70, 8, targetColor, 0.95)
        .setStrokeStyle(1, 0xf0c36b, 0.7).setDepth(102);
      makePixelText(this, nodeConfig.x, nodeConfig.y - 72, 'target', 9, '#f0c36b', 'center')
        .setOrigin(0.5, 0).setDepth(102);
      this.nodes.push({
        sprite, outline, label, id: nodeConfig.id,
        value: nodeConfig.initialValue,
        solved: nodeConfig.initialValue === nodeConfig.targetValue,
        x: nodeConfig.x, y: nodeConfig.y,
      });
    });
    this.drawNodeConnections();
  }

  private drawNodeConnections(): void {
    const gfx = this.add.graphics().setDepth(99);
    gfx.lineStyle(2, 0x4fc3f7, 0.2);
    for (let i = 0; i < this.nodes.length - 1; i++) {
      gfx.lineBetween(this.nodes[i].x, this.nodes[i].y, this.nodes[i + 1].x, this.nodes[i + 1].y);
    }
  }

  private createHud(): void {
    addPanel(this, 30, 10, 400, 60, 0.7).setDepth(900);
    this.titleText = makePixelText(this, 44, 18, this.puzzleConfig.title, 20, '#4fc3f7').setDepth(901);
    this.statusText = makePixelText(this, 44, 42, this.puzzleConfig.description, 12, '#cdbdcb').setDepth(901).setWordWrapWidth(380);
    addPanel(this, 30, 650, 500, 50, 0.65).setDepth(900);
    this.hintText = makePixelText(this, 44, 658, `Terminal: ${this.puzzleConfig.terminalHint}`, 12, '#90d2b7').setDepth(901).setWordWrapWidth(480);
  }

  private updateNodeProximityHighlight(): void {
    this.nodes.forEach((node) => {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, node.x, node.y);
      const near = dist < 120;
      node.outline.setStrokeStyle(3, near ? 0xf0c36b : (node.solved ? 0x4fc3f7 : 0x4c344d), near ? 0.9 : 0.6);
    });
  }

  private handlePuzzleCommand(input: string): void {
    const cmd = input.trim().toLowerCase();
    this.commandHistory.push(cmd);
    const parts = cmd.split(/\s+/);
    const action = parts[0];
    const target = parts[1];

    if (action === 'inspect' || action === 'ls') {
      const state = this.nodes.map((n) => `${n.id}=${n.value ? '1' : '0'}`).join(' ');
      this.statusText.setText(`State: ${state}`);
      playCast(this);
      return;
    }

    if (action === 'toggle' || action === 'flip') {
      const node = this.nodes.find((n) => n.id === target);
      if (node) {
        node.value = !node.value;
        this.updateNodeVisual(node);
        playCast(this);
        this.statusText.setText(`${node.id} toggled to ${node.value ? 'TRUE' : 'FALSE'}`);
        this.checkPuzzleSolved();
        return;
      }
      this.statusText.setText(`Node "${target}" not found.`);
      return;
    }

    if (action === 'negate' || action === 'not') {
      const node = this.nodes.find((n) => n.id === target);
      if (node) {
        node.value = !node.value;
        this.updateNodeVisual(node);
        playCast(this);
        this.statusText.setText(`${node.id} negated to ${node.value ? 'TRUE' : 'FALSE'}`);
        this.checkPuzzleSolved();
        return;
      }
      this.statusText.setText(`Node "${target}" not found.`);
      return;
    }

    if (action === 'and') {
      const nodeA = this.nodes.find((n) => n.id === target);
      const nodeB = this.nodes.find((n) => n.id === parts[2]);
      if (nodeA && nodeB) {
        nodeA.value = nodeA.value && nodeB.value;
        this.updateNodeVisual(nodeA);
        playCast(this);
        this.statusText.setText(`${nodeA.id} AND ${nodeB.id} = ${nodeA.value ? 'TRUE' : 'FALSE'}`);
        this.checkPuzzleSolved();
        return;
      }
      this.statusText.setText('AND requires two valid nodes.');
      return;
    }

    if (action === 'xor') {
      const nodeA = this.nodes.find((n) => n.id === target);
      const nodeB = this.nodes.find((n) => n.id === parts[2]);
      if (nodeA && nodeB) {
        nodeA.value = nodeA.value !== nodeB.value;
        this.updateNodeVisual(nodeA);
        playCast(this);
        this.statusText.setText(`${nodeA.id} XOR ${nodeB.id} = ${nodeA.value ? 'TRUE' : 'FALSE'}`);
        this.checkPuzzleSolved();
        return;
      }
      this.statusText.setText('XOR requires two valid nodes.');
      return;
    }

    if (action === 'checksum' || action === 'verify') {
      const sum = this.nodes.filter((n) => n.id !== 'sum').reduce((acc, n) => acc + (n.value ? 1 : 0), 0);
      const targetSum = this.puzzleConfig.nodes.filter((n) => n.id !== 'sum').reduce((acc, n) => acc + (n.targetValue ? 1 : 0), 0);
      const sumNode = this.nodes.find((n) => n.id === 'sum');
      if (sumNode) {
        sumNode.value = sum === targetSum;
        this.updateNodeVisual(sumNode);
      }
      this.statusText.setText(`Checksum: ${sum}/${targetSum} ${sum === targetSum ? '- VALID' : '- MISMATCH'}`);
      playCast(this);
      this.checkPuzzleSolved();
      return;
    }

    if (action === 'reset') {
      this.puzzleConfig.nodes.forEach((cfg, i) => {
        this.nodes[i].value = cfg.initialValue;
        this.updateNodeVisual(this.nodes[i]);
      });
      this.statusText.setText('All nodes reset to initial state.');
      return;
    }

    if (action === 'help') {
      this.statusText.setText(this.puzzleConfig.terminalHint);
      return;
    }

    this.statusText.setText(`Unknown command: ${action}. Type "help".`);
  }

  private updateNodeVisual(node: GateNode): void {
    const cfg = this.puzzleConfig.nodes.find((n) => n.id === node.id);
    node.solved = cfg ? node.value === cfg.targetValue : false;
    if (node.sprite instanceof Phaser.GameObjects.Image) {
      // frames: 0=off, 1=on, 2=locked, 3=solved
      const frameIndex = node.solved ? 3 : node.value ? 1 : 0;
      node.sprite.setFrame(frameIndex);
    } else {
      node.sprite.setFillStyle(node.value ? 0x4fc3f7 : 0x3a1f44, 0.7);
    }
    node.label.setColor(node.solved ? '#33ff66' : '#f6ead3');
    if (node.solved) {
      node.outline.setStrokeStyle(3, 0x33ff66, 0.9);
    } else {
      node.outline.setStrokeStyle(3, 0xf0c36b, 0.6);
    }
  }

  private checkPuzzleSolved(): void {
    const allSolved = this.nodes.every((n) => n.solved);
    if (!allSolved) return;
    this.transitioning = true;
    this.statusText.setText('Gate unsealed. The path opens.');
    playBoom(this, 0.6);
    this.cameras.main.flash(500, 79, 195, 247);
    this.nodes.forEach((node) => {
      this.tweens.add({
        targets: node.sprite,
        alpha: 0, scaleX: 1.5, scaleY: 1.5,
        duration: 600, ease: 'Quad.Out',
      });
    });
    this.time.delayedCall(1200, () => {
      fadeToScene(this, this.puzzleConfig.nextScene, 360, this.puzzleConfig.nextSceneData);
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
