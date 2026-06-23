import Phaser from 'phaser';
import { abilities } from '../data/abilities';
import { terminalCommands } from '../data/terminalCommands';
import { parseTerminalCommand } from '../systems/terminalCommandEngine';
import { loadSave, writeSave } from '../systems/saveSystem';
import { addAbilityIcon, publishAbilityArtRuntime } from './abilityVisuals';
import { publishTextPanelAudit } from './layoutAudit';
import { TextureKeys } from './sceneKeys';
import { addPanel, makePixelText } from './ui';

type SubmitHandler = (command: string) => void;
const TERMINAL_DEPTH = 11000;
const PAUSE_DEPTH = 12000;
// Compact, centered terminal (smaller than before)
const TERMINAL_PANEL_BOUNDS = new Phaser.Geom.Rectangle(280, 180, 720, 360);
const PAUSE_PANEL_BOUNDS = new Phaser.Geom.Rectangle(416, 116, 448, 520);

export interface TerminalCommandHelp {
  command: string;
  description: string;
}

export interface TerminalContext {
  /** Header label for the log e.g. "vows available", "puzzle commands" */
  helpHeader?: string;
  /** Custom autocomplete dictionary (overrides built-in vow list) */
  commandSet?: TerminalCommandHelp[];
  /** Greeting log lines shown before any input */
  greeting?: string[];
}

function setRuntimeFlag(key: string, value: unknown): void {
  (window as unknown as Record<string, unknown>)[key] = value;
}

export class TerminalOverlay {
  private group: Phaser.GameObjects.Group;
  private bgGraphics: Phaser.GameObjects.Graphics;
  private bgImage?: Phaser.GameObjects.Image;
  private headerText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private inputText!: Phaser.GameObjects.Text;
  private ghostText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private suggestionText!: Phaser.GameObjects.Text;
  private suggestionIcon?: Phaser.GameObjects.Image;
  private cursorBlink: Phaser.Time.TimerEvent | undefined;
  private cursorVisible = true;
  private value = '';
  private openState = false;
  private openedAt = 0;
  private openerEventTimeStamp = -1;
  private commandHistory: string[] = [];
  private historyIndex = -1;
  private logLines: string[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onSubmit: SubmitHandler,
    private readonly onVisibilityChange?: (open: boolean) => void,
    private readonly context: TerminalContext = {},
  ) {
    this.group = scene.add.group();
    const scrim = scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.78).setDepth(TERMINAL_DEPTH - 1);
    this.bgGraphics = scene.add.graphics().setDepth(TERMINAL_DEPTH);
    this.drawTerminalBackground();
    this.createTerminalContents();
    this.group.addMultiple([scrim, this.bgGraphics, this.headerText, this.logText, this.inputText, this.ghostText, this.suggestionText, this.hintText]);
    if (this.bgImage) this.group.add(this.bgImage);
    if (this.suggestionIcon) this.group.add(this.suggestionIcon);
    this.group.setVisible(false);
  }

  private drawTerminalBackground(): void {
    const g = this.bgGraphics;
    g.clear();
    const r = TERMINAL_PANEL_BOUNDS;
    // Always draw natively — image panel is intentionally not used
    // Outer shadow/border
    g.fillStyle(0x050505, 1);
    g.fillRoundedRect(r.x - 2, r.y - 2, r.width + 4, r.height + 4, 8);
    // Title bar
    g.fillStyle(0x1e1e1e, 1);
    g.fillRoundedRect(r.x, r.y, r.width, 30, { tl: 6, tr: 6, bl: 0, br: 0 });
    // Traffic-light window controls
    g.fillStyle(0xff5f56, 1);
    g.fillCircle(r.x + 16, r.y + 15, 6);
    g.fillStyle(0xffbd2e, 1);
    g.fillCircle(r.x + 34, r.y + 15, 6);
    g.fillStyle(0x27c93f, 1);
    g.fillCircle(r.x + 52, r.y + 15, 6);
    // Separator line between title bar and content
    g.fillStyle(0x2d2d2d, 1);
    g.fillRect(r.x, r.y + 30, r.width, 1);
    // Main terminal body — dark with a very subtle green tint
    g.fillStyle(0x030b04, 1);
    g.fillRoundedRect(r.x, r.y + 31, r.width, r.height - 31, { tl: 0, tr: 0, bl: 6, br: 6 });
    // Outer border
    g.lineStyle(1, 0x2a4a2e, 1);
    g.strokeRoundedRect(r.x, r.y, r.width, r.height, 6);
    // Input area top divider
    g.lineStyle(1, 0x1c3321, 1);
    g.beginPath();
    g.moveTo(r.x + 12, r.bottom - 82);
    g.lineTo(r.right - 12, r.bottom - 82);
    g.strokePath();
  }

  private createTerminalContents(): void {
    const r = TERMINAL_PANEL_BOUNDS;
    const contentLeft = this.terminalContentLeft();
    const contentWidth = this.terminalContentWidth();
    const inputY = r.bottom - 68;
    const suggestionY = r.bottom - 42;
    const hintY = r.bottom - 22;
    const monoStyle = (size: number, color: string): Phaser.Types.GameObjects.Text.TextStyle => ({
      fontFamily: 'ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace',
      fontSize: `${size}px`,
      color,
      align: 'left',
    });
    // Title bar text (centered)
    this.headerText = this.scene.add.text(r.centerX, r.y + 8, 'ninja@codejitsu: ~ — bash', monoStyle(12, '#9ca3af'))
      .setOrigin(0.5, 0)
      .setDepth(TERMINAL_DEPTH + 1);
    // Log of past output (above input area)
    this.logText = this.scene.add.text(contentLeft, r.y + 42, '', monoStyle(13, '#33ff66'))
      .setDepth(TERMINAL_DEPTH + 1)
      .setLineSpacing(2)
      .setWordWrapWidth(contentWidth);
    // Input prompt line
    this.inputText = this.scene.add.text(contentLeft, inputY, '', monoStyle(16, '#33ff66'))
      .setDepth(TERMINAL_DEPTH + 2);
    // Ghost autocomplete text (rendered over input area, dimmed)
    this.ghostText = this.scene.add.text(contentLeft, inputY, '', monoStyle(16, '#1f4030'))
      .setDepth(TERMINAL_DEPTH + 1)
      .setAlpha(0.85);
    // Inline suggestion / detail line (below input)
    this.suggestionText = this.scene.add.text(contentLeft, suggestionY, '', monoStyle(12, '#9ca3af'))
      .setDepth(TERMINAL_DEPTH + 1)
      .setWordWrapWidth(contentWidth);
    if (this.scene.textures.exists(TextureKeys.VowAutocompleteRow)) {
      this.suggestionIcon = this.scene.add.image(contentLeft + 18, suggestionY + 6, TextureKeys.VowAutocompleteRow)
        .setCrop(0, 0, 48, 48)
        .setDisplaySize(24, 24)
        .setDepth(TERMINAL_DEPTH + 1)
        .setVisible(false);
    }
    // Hotkey footer
    this.hintText = this.scene.add.text(contentLeft, hintY, 'Tab: complete   ↑↓: history   Enter: cast   Esc: close', monoStyle(11, '#6b7280'))
      .setDepth(TERMINAL_DEPTH + 1);
  }

  get isOpen(): boolean {
    return this.openState;
  }

  open(openerEventTimeStamp?: number): void {
    if (this.openState) return;
    this.openState = true;
    this.value = '';
    this.openedAt = this.scene.time.now;
    this.openerEventTimeStamp = openerEventTimeStamp ?? -1;
    this.historyIndex = -1;
    this.refreshLog();
    this.group.setVisible(true);
    this.onVisibilityChange?.(true);
    this.scene.time.timeScale = 0.5;
    this.scene.physics.world.timeScale = 0.5;
    setRuntimeFlag('__CODEJITSU_TERMINAL_OPEN', true);
    setRuntimeFlag('__CODEJITSU_TIME_SCALE', 0.5);
    this.startCursorBlink();
    this.render();
    this.publishTerminalVisual();
  }

  close(): void {
    if (!this.openState) return;
    this.openState = false;
    this.group.setVisible(false);
    this.onVisibilityChange?.(false);
    this.scene.time.timeScale = 1;
    this.scene.physics.world.timeScale = 1;
    setRuntimeFlag('__CODEJITSU_TERMINAL_OPEN', false);
    setRuntimeFlag('__CODEJITSU_TIME_SCALE', 1);
    this.stopCursorBlink();
  }

  private startCursorBlink(): void {
    this.cursorVisible = true;
    this.cursorBlink = this.scene.time.addEvent({
      delay: 530,
      loop: true,
      callback: () => {
        this.cursorVisible = !this.cursorVisible;
        this.renderInput();
      },
    });
  }

  private stopCursorBlink(): void {
    if (this.cursorBlink) {
      this.cursorBlink.destroy();
      this.cursorBlink = undefined;
    }
  }

  private renderInput(): void {
    const cursor = this.cursorVisible ? '_' : ' ';
    const prompt = '$ ';
    this.inputText.setText(`${prompt}${this.value}${cursor}`);
    // Compute ghost text x offset using Phaser's text measurement so it lines
    // up correctly regardless of font metrics.
    const measureText = this.scene.add.text(0, 0, `${prompt}${this.value}`, {
      fontFamily: 'ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace',
      fontSize: '16px',
    }).setVisible(false);
    const promptWidth = measureText.width;
    measureText.destroy();
    this.ghostText.setX(this.inputText.x + promptWidth);
    this.ghostText.setY(this.inputText.y);
    this.ghostText.setText(this.computeGhostSuggestion());
  }

  private measureWidth(text: string): number {
    return text.length * 9.6;
  }

  private computeGhostSuggestion(): string {
    if (this.value.length === 0) return '';
    const dictionary = this.context.commandSet
      ? this.context.commandSet.map((c) => c.command)
      : terminalCommands.map((c) => c.command);
    const match = dictionary.find((cmd) => cmd.startsWith(this.value));
    if (match) return match.slice(this.value.length);
    return '';
  }

  handleKey(event: KeyboardEvent): boolean {
    if (!this.openState) return false;
    if (event.key === 'Escape') {
      this.close();
      return true;
    }
    if (event.key === 'Enter') {
      const submitted = this.value;
      if (submitted.trim().length > 0) {
        this.commandHistory.push(submitted);
        this.appendLog(`$ ${submitted}`);
      }
      this.close();
      this.onSubmit(submitted);
      return true;
    }
    if (event.key === 'Backspace') {
      this.value = this.value.slice(0, -1);
      this.render();
      return true;
    }
    if (event.key === 'ArrowUp') {
      if (this.commandHistory.length > 0) {
        this.historyIndex = this.historyIndex < 0 ? this.commandHistory.length - 1 : Math.max(0, this.historyIndex - 1);
        this.value = this.commandHistory[this.historyIndex] ?? '';
        this.render();
      }
      return true;
    }
    if (event.key === 'ArrowDown') {
      if (this.historyIndex >= 0) {
        this.historyIndex = Math.min(this.commandHistory.length - 1, this.historyIndex + 1);
        this.value = this.commandHistory[this.historyIndex] ?? '';
        this.render();
      }
      return true;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      const dictionary = this.context.commandSet
        ? this.context.commandSet.map((c) => c.command)
        : terminalCommands.map((c) => c.command);
      const exact = dictionary.find((cmd) => cmd.startsWith(this.value) && this.value.length > 0);
      if (exact) {
        this.value = exact;
        this.render();
        return true;
      }
      const compact = this.value.replace('.', '');
      const fuzzy = dictionary.find((cmd) => cmd.replace('.', '').startsWith(compact) && this.value.length > 0);
      if (fuzzy) {
        this.value = fuzzy;
        this.render();
      }
      return true;
    }
    if (event.key.toLowerCase() === 't' && event.timeStamp === this.openerEventTimeStamp) {
      return true;
    }
    if (this.scene.time.now - this.openedAt < 180 && ['x', 'k'].includes(event.key.toLowerCase())) {
      return true;
    }
    if (/^[a-zA-Z0-9._\- ]$/.test(event.key) && this.value.length < 28) {
      this.value += event.key.toLowerCase();
      this.render();
      return true;
    }
    return true;
  }

  appendLog(line: string): void {
    this.logLines.push(line);
    while (this.logLines.length > 8) this.logLines.shift();
    this.refreshLog();
  }

  private refreshLog(): void {
    if (this.logLines.length === 0) {
      if (this.context.commandSet) {
        const lines: string[] = [];
        if (this.context.greeting) lines.push(...this.context.greeting);
        const header = this.context.helpHeader ?? 'commands';
        lines.push(`# ${header}:`);
        this.context.commandSet.forEach((c) => {
          lines.push(`#   ${c.command.padEnd(14, ' ')} ${c.description}`);
        });
        this.logText.setText(lines.join('\n'));
        return;
      }
      const save = loadSave();
      const ready = terminalCommands.filter((c) => save.unlockedAbilities.includes(c.abilityId)).map((c) => c.command).join('  ') || '(none yet)';
      const d = new Date();
      const login = d.toDateString() + ' ' + d.toTimeString().slice(0, 8);
      this.logText.setText(`Last login: ${login}\nninja@codejitsu: ~ $ _\n\n# vows unlocked: ${ready}\n# type a vow name and press Enter`);
      return;
    }
    this.logText.setText(this.logLines.join('\n'));
  }

  private render(): void {
    this.renderInput();
    setRuntimeFlag('__CODEJITSU_TERMINAL_INPUT', this.value);
    this.renderSuggestion();
    if (this.openState) this.publishTerminalVisual();
  }

  private renderSuggestion(): void {
    if (this.value.length === 0) {
      this.setSuggestionIcon();
      this.suggestionText.setColor('#9ca3af');
      this.suggestionText.setText(this.context.commandSet
        ? '# autocomplete suggestions appear as you type'
        : '# try.catch — A vow of survival. Tab to complete');
      setRuntimeFlag('__CODEJITSU_TERMINAL_PREVIEW', this.suggestionText.text);
      return;
    }
    if (this.context.commandSet) {
      const match = this.context.commandSet.find((c) => c.command.startsWith(this.value)) ??
        this.context.commandSet.find((c) => c.command.replace('.', '').startsWith(this.value.replace('.', '')));
      if (match) {
        this.setSuggestionIcon();
        this.suggestionText.setColor('#9ca3af');
        this.suggestionText.setText(`# ${match.command} — ${match.description}`);
      } else {
        this.setSuggestionIcon();
        this.suggestionText.setColor('#ff6b6b');
        this.suggestionText.setText('# unknown command');
      }
      return;
    }
    const save = loadSave();
    const parsed = parseTerminalCommand(this.value);
    const command = parsed.command ?? terminalCommands.find((entry) => entry.command.startsWith(this.value)) ?? terminalCommands.find((entry) => entry.command.replace('.', '').startsWith(this.value.replace('.', '')));
    if (!command) {
      this.setSuggestionIcon();
      this.suggestionText.setColor('#ff6b6b');
      this.suggestionText.setText('# unknown vow');
      return;
    }
    const ability = abilities.find((entry) => entry.id === command.abilityId);
    if (!ability) {
      this.setSuggestionIcon();
      this.suggestionText.setColor('#ff6b6b');
      this.suggestionText.setText('# unknown vow');
      return;
    }
    const unlocked = save.unlockedAbilities.includes(command.abilityId);
    this.setSuggestionIcon(command.command);
    if (!unlocked) {
      this.suggestionText.setColor('#ffbd2e');
      this.suggestionText.setText(`# ${command.command} [sealed] ${command.lockedMessage}`);
      return;
    }
    this.suggestionText.setColor('#9ca3af');
    this.suggestionText.setText(`# ${command.command} [ready] energy ${ability.energyCost}, cd ${Math.round(ability.cooldownMs / 100) / 10}s`);
    setRuntimeFlag('__CODEJITSU_TERMINAL_PREVIEW', this.suggestionText.text);
  }

  private setSuggestionIcon(command?: string): void {
    if (!this.suggestionIcon) return;
    const r = TERMINAL_PANEL_BOUNDS;
    const index = command ? terminalCommands.findIndex((entry) => entry.command === command) : -1;
    if (index < 0) {
      this.suggestionIcon.setVisible(false);
      this.suggestionText.setX(this.terminalContentLeft()).setWordWrapWidth(this.terminalContentWidth());
      return;
    }
    this.suggestionIcon.setVisible(true).setCrop(index * 48, 0, 48, 48);
    this.suggestionText.setX(this.terminalContentLeft() + 52).setWordWrapWidth(this.terminalContentWidth() - 52);
  }

  private terminalContentLeft(): number {
    return TERMINAL_PANEL_BOUNDS.x + 16;
  }

  private terminalContentWidth(): number {
    return TERMINAL_PANEL_BOUNDS.width - 32;
  }

  private publishTerminalVisual(): void {
    publishTextPanelAudit('terminal', TERMINAL_PANEL_BOUNDS, [
      { id: 'header', object: this.headerText },
      { id: 'log', object: this.logText },
      { id: 'input', object: this.inputText },
      { id: 'suggestion', object: this.suggestionText },
      { id: 'hint', object: this.hintText },
    ], 18);
    const layoutAudit = (window as Window & {
      __CODEJITSU_LAYOUT_AUDITS?: Record<string, {
        noOverflow?: boolean;
        noOverlap?: boolean;
        overflowIds?: string[];
        overlaps?: Array<{ a: string; b: string }>;
      }>;
    }).__CODEJITSU_LAYOUT_AUDITS?.terminal;
    setRuntimeFlag('__CODEJITSU_TERMINAL_VISUAL', {
      scene: this.scene.scene.key,
      usesImagegenPanel: Boolean(this.bgImage),
      primitivePanelPieces: this.bgImage ? 0 : 5,
      compactHelperCopy: true,
      panelWidth: TERMINAL_PANEL_BOUNDS.width,
      panelHeight: TERMINAL_PANEL_BOUNDS.height,
      usesAutocompleteIcons: Boolean(this.suggestionIcon),
      noOverflow: layoutAudit?.noOverflow === true,
      noOverlap: layoutAudit?.noOverlap === true,
      overflowIds: layoutAudit?.overflowIds ?? [],
      overlaps: layoutAudit?.overlaps ?? [],
      at: Math.round(performance.now()),
    });
    setRuntimeFlag('__CODEJITSU_TERMINAL_COMMAND_CARDS', terminalCommands.map((command, index) => ({
      command: command.command,
      abilityId: command.abilityId,
      usesGeneratedIcon: this.scene.textures.exists(TextureKeys.VowAutocompleteRow),
      textureKey: this.scene.textures.exists(TextureKeys.VowAutocompleteRow) ? TextureKeys.VowAutocompleteRow : 'none',
      frameIndex: index,
    })));
  }
}

export class PauseMenuOverlay {
  private group: Phaser.GameObjects.Group;
  private panel: Phaser.GameObjects.GameObject;
  private openState = false;
  private readonly rows: Phaser.GameObjects.Text[] = [];
  private readonly rowZones: Phaser.GameObjects.Zone[] = [];
  private readonly accessoryImages: Phaser.GameObjects.Image[] = [];
  private title!: Phaser.GameObjects.Text;
  private menuState: 'main' | 'settings' | 'saved' | 'extras' | 'controls' | 'vows' = 'main';
  private items: Array<[string, () => void]> = [];
  private selectedIndex = 0;
  private sfxEnabled = localStorage.getItem('codejitsu-sfx') !== 'off';
  private shakeEnabled = localStorage.getItem('codejitsu-shake') !== 'off';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onExit: () => void,
  ) {
    this.group = scene.add.group();
    this.panel = this.createPausePanel();
    this.title = makePixelText(scene, 640, 174, 'Pause', 34, '#f0c36b', 'center').setOrigin(0.5).setDepth(PAUSE_DEPTH + 1);
    this.group.addMultiple([this.panel, this.title]);
    this.buildRows([
      ['Resume', () => this.close()],
      ['Save Game', () => this.saveGame()],
      ['Settings', () => this.showSettings()],
      ['Extras', () => this.showExtras()],
      ['Exit to Title', () => this.exitToTitle()],
    ]);
    this.group.setVisible(false);
  }

  private buildRows(items: Array<[string, () => void]>): void {
    this.items = items;
    this.selectedIndex = 0;
    this.rows.forEach((row) => row.destroy());
    this.rowZones.forEach((zone) => zone.destroy());
    this.accessoryImages.forEach((image) => image.destroy());
    this.rows.length = 0;
    this.rowZones.length = 0;
    this.accessoryImages.length = 0;
    items.forEach(([label, action], index) => {
      const y = 238 + index * 56;
      const zone = this.scene.add.zone(640, y + 18, 286, 48).setDepth(PAUSE_DEPTH + 2).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', action);
      const row = makePixelText(this.scene, 512, y, label, 23, '#f6ead3').setDepth(PAUSE_DEPTH + 3);
      row.setPadding(0, 6, 0, 6);
      row.setInteractive({ useHandCursor: true });
      row.on('pointerdown', action);
      this.rows.push(row);
      this.rowZones.push(zone);
      this.group.addMultiple([zone, row]);
    });
    this.renderSelection();
  }

  private createPausePanel(): Phaser.GameObjects.GameObject {
    if (this.scene.textures.exists(TextureKeys.PausePanel)) {
      return this.scene.add.image(PAUSE_PANEL_BOUNDS.centerX, PAUSE_PANEL_BOUNDS.centerY, TextureKeys.PausePanel)
        .setDisplaySize(PAUSE_PANEL_BOUNDS.width, PAUSE_PANEL_BOUNDS.height)
        .setDepth(PAUSE_DEPTH)
        .setAlpha(0.97)
        .setData('usesImagegenPanel', true);
    }
    return addPanel(
      this.scene,
      PAUSE_PANEL_BOUNDS.x,
      PAUSE_PANEL_BOUNDS.y,
      PAUSE_PANEL_BOUNDS.width,
      PAUSE_PANEL_BOUNDS.height,
      0.96,
    ).setDepth(PAUSE_DEPTH);
  }

  get isOpen(): boolean {
    return this.openState;
  }

  open(): void {
    if (this.openState) return;
    this.openState = true;
    this.group.setVisible(true);
    this.scene.physics.world.pause();
    setRuntimeFlag('__CODEJITSU_PAUSED', true);
    setRuntimeFlag('__CODEJITSU_PAUSE_MENU', 'main');
    this.showMain();
    this.publishPauseVisual();
  }

  close(): void {
    if (!this.openState) return;
    this.openState = false;
    this.group.setVisible(false);
    this.scene.physics.world.resume();
    setRuntimeFlag('__CODEJITSU_PAUSED', false);
    setRuntimeFlag('__CODEJITSU_PAUSE_MENU', 'closed');
  }

  toggle(): void {
    if (this.openState) {
      if (this.menuState !== 'main') {
        this.showMain();
        return;
      }
      this.close();
      return;
    }
    this.open();
  }

  handleKey(event: KeyboardEvent): boolean {
    if (!this.openState) return false;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') {
      if (this.menuState !== 'main') {
        this.showMain();
      } else {
        this.close();
      }
      return true;
    }
    if (/^[1-9]$/.test(event.key)) {
      const index = Number(event.key) - 1;
      if (this.items[index]) {
        this.selectedIndex = index;
        this.renderSelection();
        this.items[index][1]();
      }
      return true;
    }
    if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') {
      this.selectedIndex = (this.selectedIndex + 1) % Math.max(1, this.items.length);
      this.renderSelection();
      return true;
    }
    if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') {
      this.selectedIndex = (this.selectedIndex - 1 + Math.max(1, this.items.length)) % Math.max(1, this.items.length);
      this.renderSelection();
      return true;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      this.items[this.selectedIndex]?.[1]();
      return true;
    }
    return false;
  }

  private showMain(): void {
    this.menuState = 'main';
    this.title.setText('Pause');
    setRuntimeFlag('__CODEJITSU_PAUSE_MENU', 'main');
    this.buildRows([
      ['Resume', () => this.close()],
      ['Save Game', () => this.saveGame()],
      ['Settings', () => this.showSettings()],
      ['Extras', () => this.showExtras()],
      ['Exit to Title', () => this.exitToTitle()],
    ]);
  }

  private showSettings(): void {
    this.menuState = 'settings';
    this.title.setText('Settings');
    setRuntimeFlag('__CODEJITSU_PAUSE_MENU', 'settings');
    this.buildRows([
      [`SFX: ${this.sfxEnabled ? 'ON' : 'OFF'}`, () => this.toggleSfx()],
      [`Screenshake: ${this.shakeEnabled ? 'ON' : 'OFF'}`, () => this.toggleShake()],
      ['Back', () => this.showMain()],
    ]);
  }

  private toggleSfx(): void {
    this.sfxEnabled = !this.sfxEnabled;
    localStorage.setItem('codejitsu-sfx', this.sfxEnabled ? 'on' : 'off');
    this.showSettings();
  }

  private toggleShake(): void {
    this.shakeEnabled = !this.shakeEnabled;
    localStorage.setItem('codejitsu-shake', this.shakeEnabled ? 'on' : 'off');
    this.showSettings();
  }

  private saveGame(): void {
    this.menuState = 'saved';
    writeSave(loadSave());
    this.title.setText('Saved');
    setRuntimeFlag('__CODEJITSU_PAUSE_MENU', 'saved');
    this.buildRows([
      ['Resume', () => this.close()],
      ['Back', () => this.showMain()],
    ]);
  }

  private showExtras(): void {
    this.menuState = 'extras';
    this.title.setText('Extras');
    setRuntimeFlag('__CODEJITSU_PAUSE_MENU', 'extras');
    this.buildRows([
      ['Controls', () => this.showControls()],
      ['Code Vows', () => this.showVows()],
      ['Back', () => this.showMain()],
    ]);
  }

  private showControls(): void {
    this.menuState = 'controls';
    this.title.setText('WASD  X  K  T');
    setRuntimeFlag('__CODEJITSU_PAUSE_MENU', 'controls');
    this.buildRows([
      ['Back', () => this.showExtras()],
    ]);
  }

  private showVows(): void {
    this.menuState = 'vows';
    this.title.setText('try.catch');
    setRuntimeFlag('__CODEJITSU_PAUSE_MENU', 'vows');
    this.buildRows([
      ['Back', () => this.showExtras()],
    ]);
    if (this.scene.textures.exists(TextureKeys.AbilityKeyTalisman)) {
      const icon = this.scene.add.image(640, 334, TextureKeys.AbilityKeyTalisman)
        .setDisplaySize(74, 74)
        .setDepth(PAUSE_DEPTH + 2)
        .setData('usesAbilityKeyTalisman', true);
      this.accessoryImages.push(icon);
      this.group.add(icon);
    }
  }

  private exitToTitle(): void {
    this.close();
    this.onExit();
  }

  private renderSelection(): void {
    this.rows.forEach((row, index) => {
      const selected = index === this.selectedIndex;
      row.setColor(selected ? '#f0c36b' : '#f6ead3');
      row.setText(`${selected ? '> ' : '  '}${this.items[index]?.[0] ?? ''}`);
    });
    this.publishPauseVisual();
  }

  private publishPauseVisual(): void {
    const usesImagegenPanel = Boolean((this.panel as Phaser.GameObjects.GameObject & { getData?: (key: string) => unknown }).getData?.('usesImagegenPanel'));
    publishTextPanelAudit('pause-menu', PAUSE_PANEL_BOUNDS, [
      { id: 'title', object: this.title },
      ...this.rows.map((row, index) => ({ id: `row-${index + 1}`, object: row })),
    ], 26);
    const layoutAudit = (window as Window & {
      __CODEJITSU_LAYOUT_AUDITS?: Record<string, {
        noOverflow?: boolean;
        noOverlap?: boolean;
        overflowIds?: string[];
        overlaps?: Array<{ a: string; b: string }>;
      }>;
    }).__CODEJITSU_LAYOUT_AUDITS?.['pause-menu'];
    setRuntimeFlag('__CODEJITSU_PAUSE_VISUAL', {
      scene: this.scene.scene.key,
      usesImagegenPanel,
      primitivePanelPieces: usesImagegenPanel ? 0 : 1,
      menuState: this.menuState,
      title: this.title.text,
      rowLabels: this.rows.map((row) => row.text.replace(/^>\s*/, '').trim()),
      selectedIndex: this.selectedIndex,
      rowCount: this.rows.length,
      panelWidth: PAUSE_PANEL_BOUNDS.width,
      panelHeight: PAUSE_PANEL_BOUNDS.height,
      noOverflow: layoutAudit?.noOverflow === true,
      noOverlap: layoutAudit?.noOverlap === true,
      overflowIds: layoutAudit?.overflowIds ?? [],
      overlaps: layoutAudit?.overlaps ?? [],
      at: Math.round(performance.now()),
    });
  }
}
