import Phaser from 'phaser';
import { TextureKeys } from './sceneKeys';

interface SkipPromptSealOptions {
  width?: number;
  height?: number;
  depth?: number;
  alpha?: number;
  sceneId?: string;
}

export function addSkipPromptSeal(
  scene: Phaser.Scene,
  x: number,
  y: number,
  onActivate: (pointer: Phaser.Input.Pointer, event: Phaser.Types.Input.EventData) => void,
  options: SkipPromptSealOptions = {},
): Phaser.GameObjects.Image | undefined {
  const textureKey = TextureKeys.SkipPromptSeal;
  if (!scene.textures.exists(textureKey)) {
    publishSkipPromptSealRuntime(scene, {
      scene: options.sceneId ?? scene.scene.key,
      usesImagegenSkipSeal: false,
      visibleTextPrompt: false,
      textureKey: 'missing',
      frameIndex: 0,
      visible: false,
    });
    return undefined;
  }

  const idleFrame = ensureSkipPromptSealFrame(scene, 0);
  const hoverFrame = ensureSkipPromptSealFrame(scene, 1);
  const displayWidth = options.width ?? 54;
  const displayHeight = options.height ?? 34;
  const depth = options.depth ?? 2001;
  const seal = scene.add.image(x, y, textureKey, idleFrame)
    .setDisplaySize(displayWidth, displayHeight)
    .setDepth(depth)
    .setAlpha(options.alpha ?? 0.92)
    .setData('usesImagegenSkipSeal', true)
    .setData('skipPromptSealFrameIndex', 0);
  const hitZone = scene.add.zone(x, y, displayWidth, displayHeight)
    .setDepth(depth + 1)
    .setInteractive({ useHandCursor: true });
  let lastActivationAt = 0;
  const activate = (pointer: Phaser.Input.Pointer, event?: Phaser.Types.Input.EventData) => {
    const now = performance.now();
    if (now - lastActivationAt < 80) return;
    lastActivationAt = now;
    onActivate(pointer, event ?? ({ stopPropagation: () => undefined } as Phaser.Types.Input.EventData));
    publishSkipPromptSealRuntime(scene, {
      scene: options.sceneId ?? scene.scene.key,
      usesImagegenSkipSeal: true,
      visibleTextPrompt: false,
      textureKey,
      frameIndex: Number(seal.getData('skipPromptSealFrameIndex') ?? 0),
      visible: seal.visible,
      clicked: true,
      clickBounds: boundsPayload(x, y, displayWidth, displayHeight),
    });
  };
  const scenePointerHandler = (pointer: Phaser.Input.Pointer) => {
    const insideX = pointer.x >= x - displayWidth / 2 && pointer.x <= x + displayWidth / 2;
    const insideY = pointer.y >= y - displayHeight / 2 && pointer.y <= y + displayHeight / 2;
    if (insideX && insideY) activate(pointer);
  };
  const canvasPointerHandler = (event: PointerEvent) => {
    const rect = scene.game.canvas.getBoundingClientRect();
    const scaleX = scene.scale.width / Math.max(1, rect.width);
    const scaleY = scene.scale.height / Math.max(1, rect.height);
    const gameX = (event.clientX - rect.left) * scaleX;
    const gameY = (event.clientY - rect.top) * scaleY;
    const insideX = gameX >= x - displayWidth / 2 && gameX <= x + displayWidth / 2;
    const insideY = gameY >= y - displayHeight / 2 && gameY <= y + displayHeight / 2;
    publishSkipPromptSealRuntime(scene, {
      scene: options.sceneId ?? scene.scene.key,
      usesImagegenSkipSeal: true,
      visibleTextPrompt: false,
      textureKey,
      frameIndex: Number(seal.getData('skipPromptSealFrameIndex') ?? 0),
      visible: seal.visible,
      clicked: false,
      clickBounds: boundsPayload(x, y, displayWidth, displayHeight),
      lastPointer: {
        gameX: Math.round(gameX),
        gameY: Math.round(gameY),
        clientX: Math.round(event.clientX),
        clientY: Math.round(event.clientY),
        inside: insideX && insideY,
      },
    });
    if (!insideX || !insideY) return;
    event.preventDefault();
    event.stopPropagation();
    activate(scene.input.activePointer);
  };
  const domButton = document.createElement('button');
  domButton.type = 'button';
  domButton.setAttribute('aria-label', 'Skip dialogue');
  domButton.style.position = 'fixed';
  domButton.style.padding = '0';
  domButton.style.margin = '0';
  domButton.style.border = '0';
  domButton.style.background = 'transparent';
  domButton.style.color = 'transparent';
  domButton.style.cursor = 'pointer';
  domButton.style.zIndex = '30';
  domButton.style.pointerEvents = 'auto';
  domButton.style.appearance = 'none';
  const positionDomButton = () => {
    const rect = scene.game.canvas.getBoundingClientRect();
    const scaleX = rect.width / Math.max(1, scene.scale.width);
    const scaleY = rect.height / Math.max(1, scene.scale.height);
    domButton.style.left = `${rect.left + (x - displayWidth / 2) * scaleX}px`;
    domButton.style.top = `${rect.top + (y - displayHeight / 2) * scaleY}px`;
    domButton.style.width = `${displayWidth * scaleX}px`;
    domButton.style.height = `${displayHeight * scaleY}px`;
  };
  positionDomButton();
  window.addEventListener('resize', positionDomButton);
  domButton.addEventListener('pointerover', () => hitZone.emit('pointerover'));
  domButton.addEventListener('pointerout', () => hitZone.emit('pointerout'));
  domButton.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    activate(scene.input.activePointer);
  });
  document.body.appendChild(domButton);
  scene.input.on('pointerdown', scenePointerHandler);
  scene.game.canvas.addEventListener('pointerdown', canvasPointerHandler, { capture: true });
  seal.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.input.off('pointerdown', scenePointerHandler);
    scene.game.canvas.removeEventListener('pointerdown', canvasPointerHandler, { capture: true });
    window.removeEventListener('resize', positionDomButton);
    domButton.remove();
    hitZone.destroy();
  });
  seal.setBlendMode(Phaser.BlendModes.ADD);
  hitZone.on('pointerover', () => {
    seal.setTexture(textureKey, hoverFrame);
    seal.setData('skipPromptSealFrameIndex', 1);
    publishSkipPromptSealRuntime(scene, {
      scene: options.sceneId ?? scene.scene.key,
      usesImagegenSkipSeal: true,
      visibleTextPrompt: false,
      textureKey,
      frameIndex: 1,
      visible: seal.visible,
    });
  });
  hitZone.on('pointerout', () => {
    seal.setTexture(textureKey, idleFrame);
    seal.setData('skipPromptSealFrameIndex', 0);
  });
  hitZone.on('pointerdown', (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => activate(pointer, event));

  publishSkipPromptSealRuntime(scene, {
    scene: options.sceneId ?? scene.scene.key,
    usesImagegenSkipSeal: true,
    visibleTextPrompt: false,
    textureKey,
    frameIndex: 0,
    visible: seal.visible,
    clickBounds: boundsPayload(x, y, displayWidth, displayHeight),
  });

  return seal;
}

function boundsPayload(x: number, y: number, width: number, height: number) {
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
    left: Math.round(x - width / 2),
    right: Math.round(x + width / 2),
    top: Math.round(y - height / 2),
    bottom: Math.round(y + height / 2),
  };
}

function ensureSkipPromptSealFrame(scene: Phaser.Scene, frameIndex: number): string {
  const texture = scene.textures.get(TextureKeys.SkipPromptSeal) as Phaser.Textures.Texture & {
    has?: (name: string) => boolean;
  };
  const frameName = `skip-prompt-seal-${frameIndex}`;
  if (typeof texture.has === 'function' && texture.has(frameName)) return frameName;
  const source = texture.getSourceImage() as { width?: number; height?: number };
  const frameWidth = Math.max(1, Math.floor(Number(source.width ?? 1774) / 2));
  const frameHeight = Math.max(1, Math.floor(Number(source.height ?? 887)));
  const safeFrame = Phaser.Math.Clamp(frameIndex, 0, 1);
  texture.add(frameName, 0, safeFrame * frameWidth, 0, frameWidth, frameHeight);
  return frameName;
}

function publishSkipPromptSealRuntime(scene: Phaser.Scene, payload: {
  scene: string;
  usesImagegenSkipSeal: boolean;
  visibleTextPrompt: boolean;
  textureKey: string;
  frameIndex: number;
  visible: boolean;
  clicked?: boolean;
  clickBounds?: ReturnType<typeof boundsPayload>;
  lastPointer?: {
    gameX: number;
    gameY: number;
    clientX: number;
    clientY: number;
    inside: boolean;
  };
}): void {
  (window as Window & {
    __CODEJITSU_SKIP_PROMPT_SEAL?: typeof payload & { at: number };
  }).__CODEJITSU_SKIP_PROMPT_SEAL = {
    ...payload,
    clicked: Boolean(payload.clicked),
    at: Math.round(performance.now()),
  };
}
