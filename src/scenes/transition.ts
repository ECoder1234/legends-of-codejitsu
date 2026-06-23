import Phaser from 'phaser';
import { setActorPose } from './actors';
import { TextureKeys } from './sceneKeys';
import { addSeamVfx } from './seamVfx';

export function transitionStoryStage(
  scene: Phaser.Scene,
  fromStage: string,
  toStage: string,
  onSwap: () => void,
  onComplete: () => void,
  duration = 280,
): void {
  setRuntimeTransition({
    stageTransition: `${fromStage}-to-${toStage}`,
    effect: 'story-stage-dark',
    fromStage,
    toStage,
    darkAlpha: 0,
    letterbox: true,
  });
  publishStageTransitionProof(fromStage, toStage, 0, { letterbox: true });
  const wipe = scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0)
    .setDepth(9997)
    .setScrollFactor(0)
    .setInteractive();
  const top = scene.add.rectangle(640, -34, 1280, 68, 0x000000, 0)
    .setDepth(9998)
    .setScrollFactor(0);
  const bottom = scene.add.rectangle(640, 754, 1280, 68, 0x000000, 0)
    .setDepth(9998)
    .setScrollFactor(0);
  scene.tweens.add({
    targets: [wipe, top, bottom],
    fillAlpha: 1,
    y: (target: Phaser.GameObjects.Rectangle) => {
      if (target === top) return 34;
      if (target === bottom) return 686;
      return target.y;
    },
    duration,
    ease: 'Quad.InOut',
    onUpdate: () => {
      wipe.setFillStyle(0x000000, wipe.fillAlpha);
      top.setFillStyle(0x000000, top.fillAlpha);
      bottom.setFillStyle(0x000000, bottom.fillAlpha);
      setRuntimeTransition({
        stageTransition: `${fromStage}-to-${toStage}`,
        effect: 'story-stage-dark',
        fromStage,
        toStage,
        darkAlpha: roundAlpha(Math.max(wipe.fillAlpha, top.fillAlpha, bottom.fillAlpha)),
        letterbox: true,
      });
      publishStageTransitionProof(fromStage, toStage, roundAlpha(Math.max(wipe.fillAlpha, top.fillAlpha, bottom.fillAlpha)), { letterbox: true });
    },
    onComplete: () => {
      setRuntimeTransition({
        stageTransition: `${fromStage}-to-${toStage}`,
        effect: 'story-stage-dark',
        fromStage,
        toStage,
        darkAlpha: 1,
        swapped: true,
        letterbox: true,
      });
      publishStageTransitionProof(fromStage, toStage, 1, { swapped: true, letterbox: true });
      onSwap();
      scene.tweens.add({
        targets: [wipe, top, bottom],
        fillAlpha: 0,
        y: (target: Phaser.GameObjects.Rectangle) => {
          if (target === top) return -34;
          if (target === bottom) return 754;
          return target.y;
        },
        duration,
        ease: 'Quad.InOut',
        onUpdate: () => {
          wipe.setFillStyle(0x000000, wipe.fillAlpha);
          top.setFillStyle(0x000000, top.fillAlpha);
          bottom.setFillStyle(0x000000, bottom.fillAlpha);
          setRuntimeTransition({
            stageTransition: `${fromStage}-to-${toStage}`,
            effect: 'story-stage-dark',
            fromStage,
            toStage,
            darkAlpha: roundAlpha(Math.max(wipe.fillAlpha, top.fillAlpha, bottom.fillAlpha)),
            swapped: true,
            letterbox: true,
          });
          publishStageTransitionProof(fromStage, toStage, roundAlpha(Math.max(wipe.fillAlpha, top.fillAlpha, bottom.fillAlpha)), { swapped: true, letterbox: true });
        },
        onComplete: () => {
          wipe.destroy();
          top.destroy();
          bottom.destroy();
          setRuntimeTransition({
            stageTransition: `${fromStage}-to-${toStage}`,
            effect: 'story-stage-dark',
            fromStage,
            toStage,
            darkAlpha: 0,
            swapped: true,
            complete: true,
            letterbox: true,
          });
          publishStageTransitionProof(fromStage, toStage, 0, { swapped: true, complete: true, letterbox: true });
          onComplete();
        },
      });
    },
  });
}

function publishStageTransitionProof(
  fromStage: string,
  toStage: string,
  darkAlpha: number,
  flags: { swapped?: boolean; complete?: boolean; letterbox?: boolean } = {},
): void {
  const runtime = window as Window & {
    __CODEJITSU_STAGE_TRANSITIONS?: Array<{
      id: string;
      effect: string;
      fromStage: string;
      toStage: string;
      maxDarkAlpha: number;
      swapped: boolean;
      complete: boolean;
      letterbox: boolean;
      at: number;
    }>;
  };
  const id = `${fromStage}-to-${toStage}`;
  const existing = (runtime.__CODEJITSU_STAGE_TRANSITIONS ?? []).find((entry) => entry.id === id);
  const next = {
    id,
    effect: 'story-stage-dark',
    fromStage,
    toStage,
    maxDarkAlpha: Math.max(existing?.maxDarkAlpha ?? 0, darkAlpha),
    swapped: Boolean(existing?.swapped || flags.swapped),
    complete: Boolean(existing?.complete || flags.complete),
    letterbox: Boolean(existing?.letterbox || flags.letterbox),
    at: Math.round(performance.now()),
  };
  runtime.__CODEJITSU_STAGE_TRANSITIONS = [
    ...(runtime.__CODEJITSU_STAGE_TRANSITIONS ?? []).filter((entry) => entry.id !== id),
    next,
  ].slice(-12);
}

export function fadeToScene(scene: Phaser.Scene, sceneKey: string, duration = 360, data?: object): void {
  setRuntimeTransition({ fadingTo: sceneKey, darkAlpha: 0 });
  const wipe = scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0)
    .setDepth(9999)
    .setInteractive();
  wipe.setScrollFactor(0);
  scene.tweens.add({
    targets: wipe,
    fillAlpha: 1,
    duration,
    ease: 'Quad.InOut',
    onUpdate: () => {
      wipe.setFillStyle(0x000000, wipe.fillAlpha);
      setRuntimeTransition({ fadingTo: sceneKey, darkAlpha: roundAlpha(wipe.fillAlpha) });
    },
    onComplete: () => {
      setRuntimeTransition({ fadingTo: sceneKey, darkAlpha: 1, complete: true });
      scene.scene.start(sceneKey, data);
    },
  });
}

export function fadeInFromBlack(scene: Phaser.Scene, duration = 320): void {
  setRuntimeTransition({ fadingIn: scene.scene.key, darkAlpha: 1 });
  const wipe = scene.add.rectangle(640, 360, 1280, 720, 0x000000, 1)
    .setDepth(9999);
  wipe.setScrollFactor(0);
  scene.tweens.add({
    targets: wipe,
    fillAlpha: 0,
    duration,
    ease: 'Quad.InOut',
    onUpdate: () => {
      wipe.setFillStyle(0x000000, wipe.fillAlpha);
      setRuntimeTransition({ fadingIn: scene.scene.key, darkAlpha: roundAlpha(wipe.fillAlpha) });
    },
    onComplete: () => {
      wipe.destroy();
      setRuntimeTransition({ idle: scene.scene.key, darkAlpha: 0 });
    },
  });
}

function addFallbackPullLine(
  scene: Phaser.Scene,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  depth: number,
): Phaser.GameObjects.Graphics {
  const pullLine = scene.add.graphics()
    .setDepth(depth)
    .setAlpha(0.42);
  pullLine.lineStyle(4, 0xf0c36b, 0.32);
  pullLine.beginPath();
  pullLine.moveTo(startX, startY);
  pullLine.lineTo(endX, endY);
  pullLine.strokePath();
  return pullLine;
}

export function walkSpriteIntoGate(
  scene: Phaser.Scene,
  sprite: Phaser.Physics.Arcade.Sprite,
  gate: Phaser.Math.Vector2,
  sceneKey: string,
  options: {
    duration?: number;
    fadeDuration?: number;
    data?: object;
    onStep?: () => void;
  } = {},
): void {
  sprite.body?.stop();
  const duration = options.duration ?? 620;
  sprite.setFlipX(gate.x < sprite.x);
  if (sprite.getData('actorKind')) {
    setActorPose(sprite, 'walk');
  }
  const startScaleX = Math.abs(sprite.scaleX);
  const startScaleY = Math.abs(sprite.scaleY);
  const startX = sprite.x;
  const startY = sprite.y;
  const initialGateDistance = Phaser.Math.Distance.Between(startX, startY, gate.x, gate.y);
  const entryDirectionX = gate.x >= startX ? 1 : -1;
  const entryTarget = initialGateDistance < 78
    ? new Phaser.Math.Vector2(gate.x + entryDirectionX * 72, gate.y + 34)
    : gate.clone();
  const cameraStartZoom = scene.cameras.main.zoom;
  const cameraStartX = scene.cameras.main.scrollX;
  const cameraStartY = scene.cameras.main.scrollY;
  const target = {
    x: entryTarget.x,
    y: entryTarget.y,
  };
  const pathLength = Phaser.Math.Distance.Between(startX, startY, target.x, target.y);
  setRuntimeTransition({
    walkingGate: scene.scene.key,
    effect: 'gate-walk-start',
    style: 'scroller-gate-walk',
    interpolation: 'phaser-tween-position',
    usesGeneratedGateVfx: scene.textures.exists(TextureKeys.SeamVfx),
    primitiveGatePieces: scene.textures.exists(TextureKeys.SeamVfx) ? 0 : 5,
    generatedGatePieces: 0,
    from: { x: Math.round(startX * 10) / 10, y: Math.round(startY * 10) / 10 },
    to: { x: Math.round(target.x * 10) / 10, y: Math.round(target.y * 10) / 10 },
    gate: { x: Math.round(gate.x * 10) / 10, y: Math.round(gate.y * 10) / 10 },
    actor: { x: Math.round(sprite.x * 10) / 10, y: Math.round(sprite.y * 10) / 10 },
    pathLength: Math.round(pathLength * 10) / 10,
    entryCarryThrough: initialGateDistance < 78,
    progress: 0,
    darkAlpha: 0,
  });
  const gateDepth = Math.max(sprite.y, gate.y);
  const usesGeneratedGateVfx = scene.textures.exists(TextureKeys.SeamVfx);
  const gateGlow = usesGeneratedGateVfx
    ? addSeamVfx(scene, scene.scene.key, 'seal', gate.x, gate.y + 28, {
      width: 176,
      height: 98,
      depth: gateDepth + 2,
      alpha: 0.54,
      tint: 0xf0c36b,
    })
    : scene.add.ellipse(gate.x, gate.y + 28, 154, 58, 0xf0c36b, 0.14)
      .setStrokeStyle(3, 0xf6ead3, 0.24)
      .setDepth(gateDepth + 2);
  const gateRing = usesGeneratedGateVfx
    ? addSeamVfx(scene, scene.scene.key, 'burst', gate.x, gate.y + 28, {
      width: 132,
      height: 92,
      depth: gateDepth + 3,
      alpha: 0.48,
      tint: 0x8f7dff,
    })
    : scene.add.ellipse(gate.x, gate.y + 28, 110, 42, 0x8f7dff, 0)
      .setStrokeStyle(5, 0x8f7dff, 0.42)
      .setDepth(gateDepth + 3);
  const leftShutter = usesGeneratedGateVfx
    ? addSeamVfx(scene, scene.scene.key, 'trail', gate.x - 88, gate.y + 28, {
      width: 54,
      height: 116,
      depth: gateDepth + 4,
      rotation: Math.PI / 2,
      alpha: 0.5,
      tint: 0xf0c36b,
    })
    : scene.add.rectangle(gate.x - 88, gate.y + 28, 12, 92, 0x09070d, 0.62)
      .setStrokeStyle(2, 0xf0c36b, 0.26)
      .setDepth(gateDepth + 4);
  const rightShutter = usesGeneratedGateVfx
    ? addSeamVfx(scene, scene.scene.key, 'trail', gate.x + 88, gate.y + 28, {
      width: 54,
      height: 116,
      depth: gateDepth + 4,
      rotation: -Math.PI / 2,
      alpha: 0.5,
      tint: 0xf0c36b,
    })
    : scene.add.rectangle(gate.x + 88, gate.y + 28, 12, 92, 0x09070d, 0.62)
      .setStrokeStyle(2, 0xf0c36b, 0.26)
      .setDepth(gateDepth + 4);
  const pullLine = usesGeneratedGateVfx
    ? addSeamVfx(scene, scene.scene.key, 'slash', (sprite.x + gate.x) / 2, (sprite.y + gate.y + 6) / 2, {
      width: Math.max(96, Phaser.Math.Distance.Between(sprite.x, sprite.y - 18, gate.x, gate.y + 24)),
      height: 52,
      depth: gateDepth + 1,
      rotation: Phaser.Math.Angle.Between(sprite.x, sprite.y - 18, gate.x, gate.y + 24),
      alpha: 0.42,
      tint: 0xf0c36b,
    })
    : addFallbackPullLine(scene, sprite.x, sprite.y - 18, gate.x, gate.y + 24, gateDepth + 1);
  const letterboxTop = scene.add.rectangle(640, -44, 1280, 88, 0x000000, 0)
    .setDepth(9980)
    .setScrollFactor(0);
  const letterboxBottom = scene.add.rectangle(640, 764, 1280, 88, 0x000000, 0)
    .setDepth(9980)
    .setScrollFactor(0);
  const sideShadeLeft = scene.add.rectangle(-64, 360, 128, 720, 0x000000, 0)
    .setDepth(9981)
    .setScrollFactor(0);
  const sideShadeRight = scene.add.rectangle(1344, 360, 128, 720, 0x000000, 0)
    .setDepth(9981)
    .setScrollFactor(0);
  const streaks = Array.from({ length: 10 }, (_, index) => {
    const y = Phaser.Math.Linear(142, 610, index / 9);
    const direction = gate.x >= startX ? 1 : -1;
    const x = direction > 0 ? Phaser.Math.Between(94, 340) : Phaser.Math.Between(940, 1180);
    const streak = usesGeneratedGateVfx
      ? addSeamVfx(scene, scene.scene.key, index % 2 === 0 ? 'spark' : 'wisp', x, y, {
        width: Phaser.Math.Between(86, 168),
        height: index % 2 === 0 ? 46 : 58,
        depth: 9982,
        alpha: 0,
        tint: index % 2 === 0 ? 0xf0c36b : 0x8f7dff,
        blendMode: Phaser.BlendModes.ADD,
      })?.setScrollFactor(0)
      : scene.add.rectangle(x, y, Phaser.Math.Between(86, 168), 3, index % 2 === 0 ? 0xf0c36b : 0x8f7dff, 0)
        .setDepth(9982)
        .setScrollFactor(0);
    if (!streak) return undefined;
    scene.tweens.add({
      targets: streak,
      x: x - direction * Phaser.Math.Between(90, 190),
      alpha: { from: 0.02, to: 0.34 },
      duration: Phaser.Math.Between(260, 520),
      yoyo: true,
      repeat: -1,
      repeatDelay: Phaser.Math.Between(90, 260),
      ease: 'Sine.InOut',
    });
    return streak;
  }).filter(Boolean) as Array<Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle>;
  const footsteps: Array<Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse> = [];
  const generatedGatePieces = [gateGlow, gateRing, leftShutter, rightShutter, pullLine, ...streaks].filter((piece) =>
    Boolean(piece && piece.getData('usesImagegenSeamVfx')),
  ).length;
  scene.tweens.add({
    targets: [gateGlow, gateRing, pullLine],
    alpha: 0.72,
    scaleX: 1.18,
    scaleY: 1.12,
    duration: Math.min(duration, 420),
    yoyo: true,
    ease: 'Sine.InOut',
  });
  scene.tweens.add({
    targets: gateRing,
    scaleX: 1.44,
    scaleY: 1.36,
    alpha: 0,
    duration: Math.max(260, Math.floor(duration * 0.58)),
    repeat: 1,
    ease: 'Quad.Out',
  });
  scene.tweens.add({
    targets: leftShutter,
    x: gate.x - 42,
    alpha: 0.88,
    duration: duration,
    ease: 'Sine.InOut',
  });
  scene.tweens.add({
    targets: rightShutter,
    x: gate.x + 42,
    alpha: 0.88,
    duration: duration,
    ease: 'Sine.InOut',
  });
  scene.tweens.add({
    targets: scene.cameras.main,
    zoom: cameraStartZoom * 1.055,
    scrollX: cameraStartX + (gate.x - startX) * 0.018,
    scrollY: cameraStartY + (gate.y - startY) * 0.012,
    duration,
    ease: 'Sine.InOut',
  });
  scene.tweens.add({
    targets: [letterboxTop, letterboxBottom],
    y: (target: Phaser.GameObjects.Rectangle) => target === letterboxTop ? 22 : 698,
    fillAlpha: 0.76,
    duration: Math.min(360, duration),
    ease: 'Quad.Out',
    onUpdate: () => {
      letterboxTop.setFillStyle(0x000000, letterboxTop.fillAlpha);
      letterboxBottom.setFillStyle(0x000000, letterboxBottom.fillAlpha);
    },
  });
  scene.tweens.add({
    targets: [sideShadeLeft, sideShadeRight],
    x: (target: Phaser.GameObjects.Rectangle) => target === sideShadeLeft ? 24 : 1256,
    fillAlpha: 0.5,
    duration: Math.min(360, duration),
    ease: 'Quad.Out',
    onUpdate: () => {
      sideShadeLeft.setFillStyle(0x000000, sideShadeLeft.fillAlpha);
      sideShadeRight.setFillStyle(0x000000, sideShadeRight.fillAlpha);
    },
  });
  scene.tweens.add({
    targets: sprite,
    x: target.x,
    y: target.y,
    scaleX: Math.max(0.08, startScaleX * 0.72),
    scaleY: Math.max(0.08, startScaleY * 0.72),
    alpha: 0.72,
    duration,
    ease: 'Sine.InOut',
    onUpdate: () => {
      if (scene.time.now % 130 < 18) {
        const footstep = usesGeneratedGateVfx
          ? addSeamVfx(scene, scene.scene.key, 'spark', sprite.x, sprite.y + 26, {
            width: 48,
            height: 28,
            depth: sprite.y - 2,
            alpha: 0.26,
            tint: 0xf0c36b,
          })
          : scene.add.ellipse(sprite.x, sprite.y + 26, 34, 12, 0xf0c36b, 0.18)
            .setStrokeStyle(1, 0xf6ead3, 0.24)
            .setDepth(sprite.y - 2);
        if (!footstep) return;
        const footstepVisual = footstep;
        footsteps.push(footstep);
        scene.tweens.add({
          targets: footstepVisual,
          alpha: 0,
          scaleX: 1.5,
          scaleY: 1.24,
          duration: 260,
          ease: 'Quad.Out',
          onComplete: () => footstepVisual.destroy(),
        });
      }
      if (sprite.getData('actorKind')) {
        setActorPose(sprite, 'walk');
      }
      setRuntimeTransition({
        walkingGate: scene.scene.key,
        effect: 'gate-walk',
        style: 'scroller-gate-walk',
        interpolation: 'phaser-tween-position',
        usesGeneratedGateVfx,
        primitiveGatePieces: usesGeneratedGateVfx ? 0 : 5 + streaks.length + footsteps.length,
        generatedGatePieces: generatedGatePieces + (usesGeneratedGateVfx ? footsteps.length : 0),
        from: { x: Math.round(startX * 10) / 10, y: Math.round(startY * 10) / 10 },
        to: { x: Math.round(target.x * 10) / 10, y: Math.round(target.y * 10) / 10 },
        gate: { x: Math.round(gate.x * 10) / 10, y: Math.round(gate.y * 10) / 10 },
        actor: { x: Math.round(sprite.x * 10) / 10, y: Math.round(sprite.y * 10) / 10 },
        pathLength: Math.round(pathLength * 10) / 10,
        entryCarryThrough: initialGateDistance < 78,
        letterbox: true,
        cameraPan: true,
        actorPose: sprite.getData('actorPose') as string | undefined,
        actorFrameIndex: sprite.getData('actorFrameIndex') as number | undefined,
        actorFrameCount: sprite.getData('actorFrameCount') as number | undefined,
        actorMotionProfile: sprite.getData('actorMotionProfile') as string | undefined,
        actorRenderVariant: sprite.getData('actorRenderVariant') as string | undefined,
        walkingAnimated: true,
        footstepCount: footsteps.length,
        darkAlpha: roundAlpha(Math.max(letterboxTop.fillAlpha, letterboxBottom.fillAlpha)),
        cameraZoom: Math.round(scene.cameras.main.zoom * 1000) / 1000,
        progress: Phaser.Math.Clamp(Phaser.Math.Distance.Between(startX, startY, sprite.x, sprite.y) / Math.max(1, pathLength), 0, 1),
        distanceRemaining: Math.round(Phaser.Math.Distance.Between(sprite.x, sprite.y, target.x, target.y) * 10) / 10,
        gateClosing: true,
      });
      options.onStep?.();
    },
    onComplete: () => {
      setRuntimeTransition({
        walkingGate: scene.scene.key,
        effect: 'gate-arrived',
        style: 'scroller-gate-walk',
        interpolation: 'phaser-tween-position',
        usesGeneratedGateVfx,
        primitiveGatePieces: usesGeneratedGateVfx ? 0 : 5 + streaks.length + footsteps.length,
        generatedGatePieces: generatedGatePieces + (usesGeneratedGateVfx ? footsteps.length : 0),
        from: { x: Math.round(startX * 10) / 10, y: Math.round(startY * 10) / 10 },
        to: { x: Math.round(target.x * 10) / 10, y: Math.round(target.y * 10) / 10 },
        gate: { x: Math.round(gate.x * 10) / 10, y: Math.round(gate.y * 10) / 10 },
        actor: { x: Math.round(sprite.x * 10) / 10, y: Math.round(sprite.y * 10) / 10 },
        pathLength: Math.round(pathLength * 10) / 10,
        entryCarryThrough: initialGateDistance < 78,
        letterbox: true,
        cameraPan: true,
        actorPose: sprite.getData('actorPose') as string | undefined,
        actorFrameIndex: sprite.getData('actorFrameIndex') as number | undefined,
        actorFrameCount: sprite.getData('actorFrameCount') as number | undefined,
        actorMotionProfile: sprite.getData('actorMotionProfile') as string | undefined,
        actorRenderVariant: sprite.getData('actorRenderVariant') as string | undefined,
        walkingAnimated: true,
        footstepCount: footsteps.length,
        darkAlpha: roundAlpha(Math.max(letterboxTop.fillAlpha, letterboxBottom.fillAlpha)),
        progress: 1,
        distanceRemaining: 0,
        arrived: true,
        gateClosed: true,
        fadeAfterArrival: true,
      });
      scene.tweens.add({
        targets: scene.cameras.main,
        zoom: cameraStartZoom,
        scrollX: cameraStartX,
        scrollY: cameraStartY,
        duration: options.fadeDuration ?? 360,
        ease: 'Quad.Out',
      });
      gateGlow?.destroy();
      gateRing?.destroy();
      leftShutter?.destroy();
      rightShutter?.destroy();
      pullLine?.destroy();
      letterboxTop.destroy();
      letterboxBottom.destroy();
      sideShadeLeft.destroy();
      sideShadeRight.destroy();
      streaks.forEach((streak) => streak.destroy());
      footsteps.forEach((footstep) => {
        if (!footstep.scene) return;
        footstep.destroy();
      });
      fadeToScene(scene, sceneKey, options.fadeDuration ?? 360, options.data);
    },
  });
}

export function clampSpriteToBounds(sprite: Phaser.GameObjects.Sprite, bounds: Phaser.Geom.Rectangle): void {
  sprite.setPosition(
    Phaser.Math.Clamp(sprite.x, bounds.left, bounds.right),
    Phaser.Math.Clamp(sprite.y, bounds.top, bounds.bottom),
  );
}

export function clampPointToArenaBounds(
  x: number,
  y: number,
  bounds: Phaser.Geom.Rectangle,
  topWidthRatio = 0.48,
): Phaser.Math.Vector2 {
  const clampedY = Phaser.Math.Clamp(y, bounds.top, bounds.bottom);
  const progress = Phaser.Math.Clamp((clampedY - bounds.top) / Math.max(1, bounds.height), 0, 1);
  const eased = 1 - Math.pow(1 - progress, 1.35);
  const widthAtY = bounds.width * Phaser.Math.Linear(topWidthRatio, 1, eased);
  const left = bounds.centerX - widthAtY / 2;
  const right = bounds.centerX + widthAtY / 2;
  return new Phaser.Math.Vector2(Phaser.Math.Clamp(x, left, right), clampedY);
}

export type ArenaClampSide = 'left' | 'right' | 'top' | 'bottom' | 'none';

export interface ArenaClampResult {
  clamped: boolean;
  side: ArenaClampSide;
  attempted: {
    x: number;
    y: number;
  };
  point: Phaser.Math.Vector2;
  arena: {
    leftAtY: number;
    rightAtY: number;
    topWidthRatio: number;
  };
}

export function clampSpriteToArenaBounds(
  sprite: Phaser.GameObjects.Sprite,
  bounds: Phaser.Geom.Rectangle,
  topWidthRatio = 0.48,
): ArenaClampResult {
  const attempted = { x: sprite.x, y: sprite.y };
  const point = clampPointToArenaBounds(attempted.x, attempted.y, bounds, topWidthRatio);
  sprite.setPosition(point.x, point.y);
  const clamped = Math.abs(point.x - attempted.x) > 0.1 || Math.abs(point.y - attempted.y) > 0.1;
  const side = resolveArenaClampSide(attempted.x, attempted.y, point, bounds);
  const arenaRange = arenaRangeAtY(point.y, bounds, topWidthRatio);
  return {
    clamped,
    side,
    attempted,
    point,
    arena: {
      leftAtY: arenaRange.left,
      rightAtY: arenaRange.right,
      topWidthRatio,
    },
  };
}

function resolveArenaClampSide(
  attemptedX: number,
  attemptedY: number,
  point: Phaser.Math.Vector2,
  bounds: Phaser.Geom.Rectangle,
): ArenaClampSide {
  const dx = point.x - attemptedX;
  const dy = point.y - attemptedY;
  if (Math.abs(dy) > Math.abs(dx) && attemptedY < bounds.top) return 'top';
  if (Math.abs(dy) > Math.abs(dx) && attemptedY > bounds.bottom) return 'bottom';
  if (attemptedX < point.x) return 'left';
  if (attemptedX > point.x) return 'right';
  if (attemptedY < point.y) return 'top';
  if (attemptedY > point.y) return 'bottom';
  return 'none';
}

function arenaRangeAtY(
  y: number,
  bounds: Phaser.Geom.Rectangle,
  topWidthRatio: number,
): { left: number; right: number } {
  const clampedY = Phaser.Math.Clamp(y, bounds.top, bounds.bottom);
  const progress = Phaser.Math.Clamp((clampedY - bounds.top) / Math.max(1, bounds.height), 0, 1);
  const eased = 1 - Math.pow(1 - progress, 1.35);
  const widthAtY = bounds.width * Phaser.Math.Linear(topWidthRatio, 1, eased);
  return {
    left: bounds.centerX - widthAtY / 2,
    right: bounds.centerX + widthAtY / 2,
  };
}

function setRuntimeTransition(value: Record<string, unknown>): void {
  const runtime = window as Window & {
    __CODEJITSU_TRANSITION?: Record<string, unknown>;
    __CODEJITSU_TRANSITION_HISTORY?: Record<string, unknown>[];
  };
  const stamped = { ...value, at: Math.round(performance.now()) };
  runtime.__CODEJITSU_TRANSITION = stamped;
  runtime.__CODEJITSU_TRANSITION_HISTORY = [...(runtime.__CODEJITSU_TRANSITION_HISTORY ?? []), stamped].slice(-140);
}

function roundAlpha(value: number): number {
  return Math.round(value * 1000) / 1000;
}
