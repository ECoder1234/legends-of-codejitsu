import Phaser from 'phaser';
import { TextureKeys } from './sceneKeys';

export type ActorKind = 'hero' | 'mentor' | 'oni' | 'sentinel' | 'returnOni';
export type ActorPose = 'idle' | 'walk' | 'run' | 'swing' | 'hurt' | 'attack' | 'stagger' | 'defeat' | 'talk' | 'gesture';

interface RequiredPoseSpec {
  pose: ActorPose | 'portrait';
  animated: boolean;
}

const requiredChapter1Poses: Record<ActorKind, RequiredPoseSpec[]> = {
  hero: [
    { pose: 'idle', animated: true },
    { pose: 'walk', animated: true },
    { pose: 'run', animated: true },
    { pose: 'swing', animated: true },
    { pose: 'hurt', animated: true },
    { pose: 'talk', animated: false },
    { pose: 'defeat', animated: false },
    { pose: 'portrait', animated: false },
  ],
  mentor: [
    { pose: 'idle', animated: true },
    { pose: 'walk', animated: true },
    { pose: 'talk', animated: true },
    { pose: 'gesture', animated: true },
    { pose: 'hurt', animated: true },
    { pose: 'defeat', animated: true },
    { pose: 'portrait', animated: false },
  ],
  sentinel: [
    { pose: 'idle', animated: true },
    { pose: 'walk', animated: true },
    { pose: 'attack', animated: true },
    { pose: 'hurt', animated: true },
    { pose: 'stagger', animated: true },
    { pose: 'defeat', animated: true },
    { pose: 'portrait', animated: false },
  ],
  oni: [
    { pose: 'idle', animated: true },
    { pose: 'walk', animated: true },
    { pose: 'attack', animated: true },
    { pose: 'hurt', animated: true },
    { pose: 'stagger', animated: true },
    { pose: 'defeat', animated: true },
    { pose: 'talk', animated: true },
    { pose: 'portrait', animated: false },
  ],
  returnOni: [
    { pose: 'idle', animated: true },
    { pose: 'walk', animated: true },
    { pose: 'attack', animated: true },
    { pose: 'hurt', animated: true },
    { pose: 'stagger', animated: true },
    { pose: 'defeat', animated: true },
    { pose: 'talk', animated: true },
    { pose: 'portrait', animated: false },
  ],
};

const cropByActor: Record<ActorKind, { x: number; y: number; width: number; height: number }> = {
  hero: { x: 86, y: 30, width: 452, height: 456 },
  mentor: { x: 662, y: 20, width: 438, height: 520 },
  oni: { x: 82, y: 532, width: 560, height: 622 },
  sentinel: { x: 650, y: 740, width: 505, height: 332 },
  returnOni: { x: 82, y: 532, width: 560, height: 622 },
};

interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

const GENERATED_FRAME_PADDING = 24;
const GENERATED_EDGE_CLEAR = 5;

const generatedPoseFrames: Record<ActorKind, Partial<Record<ActorPose | 'portrait', Crop[]>>> = {
  hero: {
    idle: [
      { x: 38, y: 54, width: 112, height: 170 },
      { x: 162, y: 54, width: 112, height: 170 },
    ],
    walk: [
      { x: 288, y: 54, width: 124, height: 170 },
      { x: 414, y: 54, width: 124, height: 170 },
      { x: 536, y: 54, width: 124, height: 170 },
    ],
    swing: [{ x: 414, y: 54, width: 116, height: 170 }],
    hurt: [{ x: 812, y: 220, width: 122, height: 150 }],
    defeat: [{ x: 940, y: 238, width: 142, height: 104 }],
    portrait: [{ x: 1240, y: 44, width: 246, height: 224 }],
  },
  mentor: {
    idle: [
      { x: 40, y: 340, width: 130, height: 188 },
      { x: 176, y: 340, width: 126, height: 188 },
    ],
    walk: [
      { x: 308, y: 340, width: 126, height: 188 },
      { x: 442, y: 340, width: 126, height: 188 },
    ],
    talk: [
      { x: 620, y: 330, width: 210, height: 200 },
      { x: 824, y: 330, width: 210, height: 200 },
    ],
    gesture: [{ x: 824, y: 330, width: 210, height: 200 }],
    portrait: [{ x: 1238, y: 342, width: 250, height: 224 }],
  },
  sentinel: {
    idle: [
      { x: 38, y: 548, width: 104, height: 118 },
      { x: 168, y: 548, width: 118, height: 118 },
    ],
    walk: [
      { x: 168, y: 548, width: 118, height: 118 },
      { x: 306, y: 548, width: 118, height: 118 },
      { x: 444, y: 548, width: 118, height: 118 },
    ],
    attack: [
      { x: 590, y: 544, width: 150, height: 130 },
      { x: 1030, y: 544, width: 170, height: 130 },
    ],
    hurt: [{ x: 750, y: 548, width: 116, height: 128 }],
    defeat: [{ x: 888, y: 560, width: 165, height: 112 }],
    portrait: [{ x: 1250, y: 564, width: 220, height: 182 }],
  },
  oni: {
    idle: [
      { x: 36, y: 720, width: 172, height: 284 },
      { x: 210, y: 720, width: 162, height: 284 },
    ],
    walk: [
      { x: 210, y: 720, width: 162, height: 284 },
      { x: 374, y: 720, width: 162, height: 284 },
    ],
    attack: [
      { x: 482, y: 706, width: 270, height: 300 },
      { x: 760, y: 720, width: 178, height: 284 },
    ],
    hurt: [{ x: 760, y: 720, width: 178, height: 284 }],
    stagger: [{ x: 924, y: 720, width: 190, height: 284 }],
    defeat: [
      { x: 1016, y: 720, width: 200, height: 284 },
      { x: 1080, y: 720, width: 170, height: 284 },
    ],
    portrait: [{ x: 1250, y: 742, width: 250, height: 280 }],
  },
  returnOni: {
    idle: [{ x: 36, y: 720, width: 172, height: 284 }],
    walk: [{ x: 210, y: 720, width: 162, height: 284 }],
    attack: [{ x: 482, y: 706, width: 270, height: 300 }],
    hurt: [{ x: 760, y: 720, width: 178, height: 284 }],
    stagger: [{ x: 924, y: 720, width: 190, height: 284 }],
    defeat: [{ x: 1016, y: 720, width: 200, height: 284 }],
    talk: [{ x: 924, y: 720, width: 190, height: 284 }],
    portrait: [{ x: 1250, y: 742, width: 250, height: 280 }],
  },
};

const apprenticeCombatFrames: Partial<Record<ActorPose | 'portrait', Crop[]>> = {
  idle: [
    { x: 70, y: 24, width: 154, height: 230 },
    { x: 270, y: 24, width: 154, height: 230 },
    { x: 458, y: 24, width: 154, height: 230 },
  ],
  walk: [
    { x: 46, y: 256, width: 176, height: 178 },
    { x: 250, y: 256, width: 190, height: 178 },
    { x: 440, y: 254, width: 182, height: 184 },
    { x: 648, y: 258, width: 154, height: 176 },
    { x: 834, y: 258, width: 156, height: 176 },
    { x: 1010, y: 258, width: 166, height: 176 },
  ],
  swing: [
    { x: 62, y: 432, width: 250, height: 190 },
    { x: 324, y: 438, width: 250, height: 190 },
    { x: 604, y: 438, width: 216, height: 188 },
  ],
  hurt: [
    { x: 58, y: 778, width: 158, height: 190 },
    { x: 248, y: 778, width: 134, height: 190 },
  ],
  gesture: [
    { x: 452, y: 768, width: 190, height: 216 },
    { x: 690, y: 768, width: 144, height: 216 },
  ],
  talk: [{ x: 452, y: 768, width: 190, height: 216 }],
  defeat: [{ x: 868, y: 870, width: 290, height: 104 }],
  portrait: [{ x: 1202, y: 22, width: 316, height: 326 }],
};

const masterKeikoCombatFrames: Partial<Record<ActorPose | 'portrait', Crop[]>> = {
  idle: [
    { x: 62, y: 28, width: 212, height: 258 },
    { x: 316, y: 28, width: 220, height: 258 },
    { x: 548, y: 28, width: 220, height: 258 },
    { x: 770, y: 28, width: 222, height: 258 },
  ],
  walk: [
    { x: 60, y: 286, width: 224, height: 246 },
    { x: 308, y: 286, width: 230, height: 246 },
    { x: 552, y: 288, width: 230, height: 242 },
    { x: 800, y: 286, width: 224, height: 246 },
  ],
  talk: [
    { x: 60, y: 520, width: 250, height: 244 },
    { x: 326, y: 520, width: 250, height: 248 },
    { x: 586, y: 518, width: 264, height: 250 },
    { x: 850, y: 518, width: 274, height: 250 },
  ],
  gesture: [
    { x: 60, y: 520, width: 250, height: 244 },
    { x: 586, y: 518, width: 264, height: 250 },
    { x: 60, y: 764, width: 296, height: 236 },
    { x: 828, y: 764, width: 206, height: 236 },
  ],
  hurt: [
    { x: 60, y: 764, width: 296, height: 236 },
    { x: 300, y: 764, width: 240, height: 236 },
  ],
  stagger: [
    { x: 60, y: 764, width: 296, height: 236 },
    { x: 300, y: 764, width: 240, height: 236 },
  ],
  defeat: [
    { x: 588, y: 770, width: 220, height: 230 },
    { x: 828, y: 764, width: 206, height: 236 },
  ],
  portrait: [{ x: 1124, y: 12, width: 322, height: 360 }],
};

const binarySentinelCombatFrames: Partial<Record<ActorPose | 'portrait', Crop[]>> = {
  idle: [
    { x: 81, y: 43, width: 283, height: 357 },
    { x: 475, y: 43, width: 283, height: 357 },
    { x: 849, y: 44, width: 268, height: 356 },
    { x: 1236, y: 43, width: 282, height: 357 },
  ],
  walk: [
    { x: 77, y: 400, width: 283, height: 395 },
    { x: 465, y: 400, width: 284, height: 395 },
    { x: 831, y: 400, width: 267, height: 395 },
    { x: 1236, y: 400, width: 266, height: 395 },
  ],
  attack: [
    { x: 40, y: 800, width: 327, height: 400 },
    { x: 444, y: 803, width: 293, height: 345 },
    { x: 826, y: 814, width: 330, height: 337 },
    { x: 1218, y: 816, width: 343, height: 332 },
  ],
  hurt: [
    { x: 48, y: 1200, width: 288, height: 304 },
    { x: 454, y: 1200, width: 271, height: 311 },
  ],
  defeat: [
    { x: 814, y: 1228, width: 359, height: 291 },
    { x: 1203, y: 1200, width: 346, height: 327 },
  ],
  stagger: [
    { x: 48, y: 1200, width: 288, height: 304 },
    { x: 454, y: 1200, width: 271, height: 311 },
  ],
  portrait: [{ x: 81, y: 43, width: 283, height: 357 }],
};

const nullOniBossCombatFrames: Partial<Record<ActorPose | 'portrait', Crop[]>> = {
  idle: [
    { x: 22, y: 18, width: 244, height: 206 },
    { x: 286, y: 18, width: 244, height: 206 },
    { x: 548, y: 18, width: 244, height: 206 },
  ],
  walk: [
    { x: 22, y: 18, width: 244, height: 206 },
    { x: 286, y: 18, width: 244, height: 206 },
    { x: 548, y: 18, width: 244, height: 206 },
  ],
  attack: [
    { x: 18, y: 388, width: 330, height: 178 },
    { x: 300, y: 386, width: 286, height: 180 },
    { x: 588, y: 386, width: 270, height: 180 },
  ],
  hurt: [
    { x: 24, y: 586, width: 250, height: 172 },
    { x: 286, y: 586, width: 270, height: 172 },
  ],
  stagger: [
    { x: 24, y: 716, width: 240, height: 168 },
    { x: 286, y: 716, width: 240, height: 168 },
  ],
  defeat: [
    { x: 24, y: 864, width: 238, height: 176 },
    { x: 278, y: 856, width: 238, height: 184 },
    { x: 520, y: 856, width: 320, height: 184 },
  ],
  talk: [
    { x: 24, y: 716, width: 240, height: 168 },
    { x: 286, y: 716, width: 240, height: 168 },
  ],
  portrait: [{ x: 1160, y: 42, width: 340, height: 314 }],
};

const returnOniCombatFrames: Partial<Record<ActorPose | 'portrait', Crop[]>> = {
  idle: [
    { x: 58, y: 38, width: 178, height: 210 },
    { x: 310, y: 38, width: 178, height: 210 },
    { x: 560, y: 38, width: 178, height: 210 },
    { x: 812, y: 38, width: 198, height: 210 },
  ],
  walk: [
    { x: 58, y: 220, width: 188, height: 204 },
    { x: 316, y: 220, width: 188, height: 204 },
    { x: 576, y: 220, width: 188, height: 204 },
    { x: 842, y: 220, width: 188, height: 204 },
  ],
  attack: [
    { x: 40, y: 468, width: 300, height: 160 },
    { x: 316, y: 444, width: 318, height: 184 },
    { x: 588, y: 452, width: 278, height: 176 },
    { x: 874, y: 448, width: 326, height: 190 },
  ],
  hurt: [
    { x: 58, y: 608, width: 190, height: 172 },
    { x: 306, y: 608, width: 190, height: 172 },
  ],
  stagger: [
    { x: 58, y: 742, width: 230, height: 156 },
    { x: 302, y: 742, width: 230, height: 156 },
    { x: 560, y: 736, width: 220, height: 166 },
  ],
  defeat: [
    { x: 48, y: 768, width: 252, height: 164 },
    { x: 300, y: 768, width: 236, height: 164 },
    { x: 556, y: 746, width: 236, height: 184 },
  ],
  talk: [
    { x: 1114, y: 640, width: 250, height: 220 },
    { x: 1320, y: 620, width: 220, height: 248 },
  ],
  portrait: [{ x: 1176, y: 22, width: 340, height: 324 }],
};

const displayByActor: Record<ActorKind, { width: number; height: number }> = {
  hero: { width: 92, height: 108 },
  mentor: { width: 106, height: 126 },
  oni: { width: 154, height: 172 },
  sentinel: { width: 86, height: 78 },
  returnOni: { width: 154, height: 172 },
};

const generatedDisplayByActor: Record<ActorKind, { width: number; height: number }> = {
  hero: { width: 70, height: 108 },
  mentor: { width: 82, height: 122 },
  oni: { width: 134, height: 176 },
  sentinel: { width: 70, height: 78 },
  returnOni: { width: 148, height: 180 },
};

const generatedDisplayByPose: Partial<Record<ActorKind, Partial<Record<ActorPose | 'portrait', { width: number; height: number }>>>> = {
  hero: {
    idle: { width: 82, height: 124 },
    walk: { width: 124, height: 104 },
    swing: { width: 142, height: 108 },
    hurt: { width: 86, height: 112 },
    gesture: { width: 88, height: 122 },
    talk: { width: 88, height: 122 },
    defeat: { width: 118, height: 58 },
  },
  mentor: {
    idle: { width: 96, height: 134 },
    walk: { width: 108, height: 126 },
    talk: { width: 126, height: 132 },
    gesture: { width: 126, height: 132 },
    hurt: { width: 116, height: 124 },
    stagger: { width: 116, height: 124 },
    defeat: { width: 98, height: 122 },
  },
  oni: {
    attack: { width: 170, height: 184 },
    hurt: { width: 142, height: 164 },
    stagger: { width: 142, height: 164 },
    defeat: { width: 146, height: 150 },
    talk: { width: 142, height: 164 },
  },
  returnOni: {
    idle: { width: 150, height: 178 },
    walk: { width: 154, height: 168 },
    attack: { width: 196, height: 174 },
    hurt: { width: 142, height: 150 },
    stagger: { width: 154, height: 142 },
    defeat: { width: 152, height: 118 },
    talk: { width: 154, height: 162 },
  },
  sentinel: {
    idle: { width: 92, height: 116 },
    walk: { width: 108, height: 108 },
    attack: { width: 144, height: 112 },
    hurt: { width: 104, height: 118 },
    defeat: { width: 122, height: 78 },
    stagger: { width: 104, height: 118 },
  },
};

function setGeneratedCrop<T extends Phaser.GameObjects.Image | Phaser.Physics.Arcade.Sprite>(
  target: T,
  kind: ActorKind,
  pose: ActorPose | 'portrait',
  scale: number,
): T {
  const frame = getGeneratedFrame(target.scene, kind, pose);
  const crop = frame?.crop;
  if (!crop) return target;
  const display = pose === 'portrait'
    ? { width: 112, height: 112 }
    : generatedDisplayByPose[kind]?.[pose] ?? (pose === 'run' ? generatedDisplayByPose[kind]?.walk : undefined) ?? generatedDisplayByActor[kind];
  target
    .setTexture(ensureGeneratedFrame(target.scene, kind, pose, frame.index))
    .setScale((display.width * scale) / crop.width, (display.height * scale) / crop.height);
  target.setData('actorKind', kind);
  target.setData('actorScale', scale);
  target.setData('actorPose', pose);
  target.setData('actorFrameIndex', frame.index);
  target.setData('actorFrameCount', frame.frameCount);
  target.setData('actorSourcePose', frame.sourcePose);
  target.setData('actorRenderVariant', frame.renderVariant);
  target.setData('actorMotionProfile', motionProfileFor(kind, pose));
  target.setData('actorBaseScaleX', Math.abs(target.scaleX));
  target.setData('actorBaseScaleY', Math.abs(target.scaleY));
  return target;
}

function generatedFrameKey(kind: ActorKind, pose: ActorPose | 'portrait', index: number): string {
  return `chapter1-${kind}-${pose}-${index}`;
}

function ensureGeneratedFrame(scene: Phaser.Scene, kind: ActorKind, pose: ActorPose | 'portrait', index = 0): string {
  const sourceKey = getSourceTextureKey(scene, kind);
  const key = `${generatedFrameKey(kind, pose, index)}-${sourceKey}`;
  if (scene.textures.exists(key)) {
    return key;
  }
  const crop = getGeneratedFrame(scene, kind, pose, index)?.crop;
  if (!crop) {
    return TextureKeys.Chapter1Characters;
  }
  const texture = scene.textures.createCanvas(key, crop.width + GENERATED_FRAME_PADDING * 2, crop.height + GENERATED_FRAME_PADDING * 2);
  if (!texture) {
    return TextureKeys.Chapter1Characters;
  }
  const ctx = texture.getContext();
  const source = scene.textures.get(sourceKey).getSourceImage() as CanvasImageSource | null | undefined;
  if (!ctx || !source) {
    scene.textures.remove(key);
    return TextureKeys.Chapter1Characters;
  }
  ctx.clearRect(0, 0, texture.width, texture.height);
  ctx.imageSmoothingEnabled = false;
  try {
    drawGeneratedFrame(ctx, source, crop, kind, pose);
  } catch {
    scene.textures.remove(key);
    return TextureKeys.Chapter1Characters;
  }
  clearFrameSamplingEdges(ctx, crop.width, crop.height);
  publishGeneratedFrameAudit(scene, key, texture.width, texture.height);
  texture.refresh();
  return key;
}

function drawGeneratedFrame(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  crop: Crop,
  kind: ActorKind,
  pose: ActorPose | 'portrait',
): void {
  if (kind === 'hero' && pose === 'run') {
    const lean = -0.085;
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.drawImage(
      source,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      GENERATED_FRAME_PADDING - 8,
      GENERATED_FRAME_PADDING + 3,
      crop.width,
      crop.height,
    );
    ctx.globalAlpha = 1;
    ctx.transform(1, 0, lean, 1, GENERATED_FRAME_PADDING + Math.abs(lean) * crop.height, GENERATED_FRAME_PADDING);
    ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
    ctx.restore();
    drawRunMotionAccents(ctx, crop.width, crop.height);
    return;
  }
  ctx.drawImage(
    source,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    GENERATED_FRAME_PADDING,
    GENERATED_FRAME_PADDING,
    crop.width,
    crop.height,
  );
  if (kind === 'hero' && pose === 'swing') {
    drawHeroSwingAccents(ctx, crop.width, crop.height);
  }
  if (kind === 'sentinel' && pose === 'attack') {
    drawSentinelAttackAccents(ctx, crop.width, crop.height);
  }
  if ((kind === 'oni' || kind === 'returnOni') && pose === 'attack') {
    drawOniAttackAccents(ctx, crop.width, crop.height);
  }
}

function drawRunMotionAccents(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const baseX = GENERATED_FRAME_PADDING + Math.floor(width * 0.18);
  const baseY = GENERATED_FRAME_PADDING + Math.floor(height * 0.42);
  ctx.fillStyle = 'rgba(240, 195, 107, 0.46)';
  ctx.fillRect(baseX - 12, baseY, 28, 3);
  ctx.fillStyle = 'rgba(143, 125, 255, 0.35)';
  ctx.fillRect(baseX - 18, baseY + 12, 38, 2);
  ctx.fillStyle = 'rgba(246, 234, 211, 0.28)';
  ctx.fillRect(baseX - 8, baseY - 13, 22, 2);
}

function drawHeroSwingAccents(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const x = GENERATED_FRAME_PADDING + Math.floor(width * 0.58);
  const y = GENERATED_FRAME_PADDING + Math.floor(height * 0.28);
  ctx.save();
  ctx.strokeStyle = 'rgba(246, 234, 211, 0.72)';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(x - 14, y + 44, Math.max(30, width * 0.24), -1.1, 0.44);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(143, 125, 255, 0.48)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x - 14, y + 44, Math.max(22, width * 0.18), -1, 0.34);
  ctx.stroke();
  ctx.fillStyle = 'rgba(240, 195, 107, 0.78)';
  ctx.fillRect(x + 20, y + 10, Math.max(24, width * 0.16), 4);
  ctx.restore();
}

function drawSentinelAttackAccents(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const x = GENERATED_FRAME_PADDING + Math.floor(width * 0.66);
  const y = GENERATED_FRAME_PADDING + Math.floor(height * 0.5);
  ctx.save();
  ctx.strokeStyle = 'rgba(143, 125, 255, 0.72)';
  ctx.lineWidth = 4;
  for (let index = 0; index < 3; index += 1) {
    ctx.beginPath();
    ctx.moveTo(x - index * 10, y - 28 + index * 18);
    ctx.lineTo(x + 42, y - 42 + index * 26);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(246, 234, 211, 0.36)';
  ctx.fillRect(x + 8, y - 6, 34, 3);
  ctx.restore();
}

function drawOniAttackAccents(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const x = GENERATED_FRAME_PADDING + Math.floor(width * 0.48);
  const y = GENERATED_FRAME_PADDING + Math.floor(height * 0.52);
  ctx.save();
  ctx.strokeStyle = 'rgba(184, 93, 255, 0.68)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(28, width * 0.14), 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(246, 234, 211, 0.34)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(42, width * 0.2), -0.3, Math.PI * 1.35);
  ctx.stroke();
  ctx.fillStyle = 'rgba(214, 79, 69, 0.42)';
  ctx.fillRect(x - 4, y - Math.floor(height * 0.28), 8, Math.max(42, height * 0.22));
  ctx.restore();
}

function clearFrameSamplingEdges(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const x = GENERATED_FRAME_PADDING;
  const y = GENERATED_FRAME_PADDING;
  const right = x + width - 1;
  const bottom = y + height - 1;
  ctx.clearRect(x - GENERATED_EDGE_CLEAR, y - GENERATED_EDGE_CLEAR, width + GENERATED_EDGE_CLEAR * 2, GENERATED_EDGE_CLEAR);
  ctx.clearRect(x - GENERATED_EDGE_CLEAR, bottom + 1, width + GENERATED_EDGE_CLEAR * 2, GENERATED_EDGE_CLEAR);
  ctx.clearRect(x - GENERATED_EDGE_CLEAR, y - GENERATED_EDGE_CLEAR, GENERATED_EDGE_CLEAR, height + GENERATED_EDGE_CLEAR * 2);
  ctx.clearRect(right + 1, y - GENERATED_EDGE_CLEAR, GENERATED_EDGE_CLEAR, height + GENERATED_EDGE_CLEAR * 2);
}

function publishGeneratedFrameAudit(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
): void {
  const border = Math.min(6, Math.floor(width / 4), Math.floor(height / 4));
  const runtime = window as Window & {
    __CODEJITSU_ASSET_AUDIT?: Array<{
      scene: string;
      key: string;
      width: number;
      height: number;
      padding: number;
      border: number;
      alphaErrors: number;
    }>;
  };
  const next = {
    scene: scene.scene.key,
    key,
      width,
      height,
      padding: GENERATED_FRAME_PADDING,
      border,
      alphaErrors: 0,
    };
  const withoutDuplicate = (runtime.__CODEJITSU_ASSET_AUDIT ?? []).filter((entry) => entry.key !== key);
  runtime.__CODEJITSU_ASSET_AUDIT = [...withoutDuplicate, next].slice(-80);
}

export function addActorImage(
  scene: Phaser.Scene,
  kind: ActorKind,
  x: number,
  y: number,
  fallbackTexture: string,
  fallbackScale: number,
): Phaser.GameObjects.Image {
  if (scene.textures.exists(TextureKeys.Chapter1Characters)) {
    return setGeneratedCrop(scene.add.image(x, y, ensureGeneratedFrame(scene, kind, 'idle', 0)), kind, 'idle', fallbackScale);
  }
  if (scene.textures.exists(TextureKeys.SpriteAtlas)) {
    const crop = cropByActor[kind];
    const display = displayByActor[kind];
    return scene.add
      .image(x, y, TextureKeys.SpriteAtlas)
      .setCrop(crop.x, crop.y, crop.width, crop.height)
      .setDisplaySize(display.width * fallbackScale, display.height * fallbackScale);
  }
  return scene.add.image(x, y, fallbackTexture).setScale(fallbackScale);
}

export function addActorSprite(
  scene: Phaser.Scene,
  kind: ActorKind,
  x: number,
  y: number,
  fallbackTexture: string,
  fallbackScale: number,
): Phaser.Physics.Arcade.Sprite {
  const texture = scene.textures.exists(TextureKeys.Chapter1Characters)
    ? ensureGeneratedFrame(scene, kind, 'idle', 0)
    : scene.textures.exists(TextureKeys.SpriteAtlas)
      ? TextureKeys.SpriteAtlas
      : fallbackTexture;
  const sprite = scene.physics.add.sprite(x, y, texture);
  if (scene.textures.exists(TextureKeys.Chapter1Characters)) {
    setGeneratedCrop(sprite, kind, 'idle', fallbackScale);
  } else if (texture === TextureKeys.SpriteAtlas) {
    const crop = cropByActor[kind];
    const display = displayByActor[kind];
    sprite.setCrop(crop.x, crop.y, crop.width, crop.height).setDisplaySize(display.width * fallbackScale, display.height * fallbackScale);
  } else {
    sprite.setScale(fallbackScale);
  }
  return sprite;
}

export function setActorPose(target: Phaser.GameObjects.Image | Phaser.Physics.Arcade.Sprite, pose: ActorPose): void {
  const kind = target.getData('actorKind') as ActorKind | undefined;
  const scale = target.getData('actorScale') as number | undefined;
  if (!kind || !scale) return;
  setGeneratedCrop(target, kind, pose, scale);
}

export function addPortraitImage(
  scene: Phaser.Scene,
  kind: ActorKind,
  x: number,
  y: number,
  fallbackTexture: string,
): Phaser.GameObjects.Image {
  if (scene.textures.exists(TextureKeys.Chapter1Characters)) {
    return setGeneratedCrop(scene.add.image(x, y, ensureGeneratedFrame(scene, kind, 'portrait', 0)), kind, 'portrait', 1);
  }
  return scene.add.image(x, y, fallbackTexture).setDisplaySize(112, 112);
}

export function publishChapter1AnimationCatalog(scene: Phaser.Scene): void {
  const runtime = window as Window & {
    __CODEJITSU_ANIMATION_CATALOG?: Array<{
      kind: ActorKind;
      displayName: string;
      sourceTexture: string;
      usesGeneratedTexture: boolean;
      requiredPoseCount: number;
      animatedPoseCount: number;
      allRequiredPresent: boolean;
      poses: Array<{
        pose: ActorPose | 'portrait';
        requiredAnimated: boolean;
        present: boolean;
        sourcePose?: ActorPose | 'portrait';
        frameCount: number;
        animated: boolean;
        renderVariant: string;
        motionProfile: string;
      }>;
    }>;
  };
  const names: Record<ActorKind, string> = {
    hero: 'Apprentice',
    mentor: 'Master Keiko',
    sentinel: 'Binary Sentinel',
    oni: 'Null Oni',
    returnOni: 'Return Oni',
  };
  const kinds: ActorKind[] = ['hero', 'mentor', 'sentinel', 'oni', 'returnOni'];
  runtime.__CODEJITSU_ANIMATION_CATALOG = kinds.map((kind) => {
    const sourceTexture = getSourceTextureKey(scene, kind);
    const poses = requiredChapter1Poses[kind].map((spec) => {
      const frame = getGeneratedFrame(scene, kind, spec.pose, 0);
      const frameCount = frame?.frameCount ?? 0;
      return {
        pose: spec.pose,
        requiredAnimated: spec.animated,
        present: Boolean(frame),
        sourcePose: frame?.sourcePose,
        frameCount,
        animated: frameCount > 1,
        renderVariant: frame ? renderVariantFor(kind, spec.pose, frame.sourcePose) : 'missing',
        motionProfile: frame ? motionProfileFor(kind, spec.pose) : 'missing',
      };
    });
    return {
      kind,
      displayName: names[kind],
      sourceTexture,
      usesGeneratedTexture: sourceTexture !== TextureKeys.Chapter1Characters || scene.textures.exists(TextureKeys.Chapter1Characters),
      requiredPoseCount: poses.length,
      animatedPoseCount: poses.filter((pose) => pose.animated).length,
      allRequiredPresent: poses.every((pose) => pose.present && (!pose.requiredAnimated || pose.animated)),
      poses,
    };
  });
}

function getGeneratedFrame(scene: Phaser.Scene, kind: ActorKind, pose: ActorPose | 'portrait', forcedIndex?: number): { crop: Crop; index: number; frameCount: number; sourcePose: ActorPose | 'portrait'; renderVariant: string } | undefined {
  const frameMap = getFrameMap(scene, kind);
  const framePose = frameMap[pose]
    ? pose
    : pose === 'run' && frameMap.walk
      ? 'walk'
      : 'idle';
  const sourcePose = pose === 'run' && frameMap.walk ? 'run' : framePose;
  const frames = frameMap[framePose];
  if (!frames?.length) return undefined;
  const index = forcedIndex ?? getFrameIndexForPose(pose, frames.length, scene.time.now) % frames.length;
  return {
    crop: frames[index % frames.length],
    index: index % frames.length,
    frameCount: frames.length,
    sourcePose,
    renderVariant: renderVariantFor(kind, pose, framePose),
  };
}

function renderVariantFor(kind: ActorKind, pose: ActorPose | 'portrait', framePose: ActorPose | 'portrait'): string {
  if (kind === 'hero' && pose === 'run' && framePose === 'walk') return 'run-from-walk-lean';
  if (kind === 'hero' && pose === 'swing') return 'sword-arc-accent';
  if (kind === 'sentinel' && pose === 'attack') return 'sentinel-claw-accent';
  if (kind === 'oni' && pose === 'attack') return 'oni-void-palm-accent';
  if (kind === 'returnOni' && pose === 'attack') return 'return-oni-loop-chain-accent';
  return 'native';
}

function motionProfileFor(kind: ActorKind, pose: ActorPose | 'portrait'): string {
  if (kind === 'hero' && pose === 'run') return 'grounded-run-lean-trail';
  if (kind === 'hero' && pose === 'swing') return 'sword-contact-arc';
  if (kind === 'sentinel' && pose === 'attack') return 'binary-claw-windup';
  if (kind === 'oni' && pose === 'attack') return 'void-palm-cast';
  if (kind === 'returnOni' && pose === 'attack') return 'loop-chain-revenge-slash';
  if (pose === 'walk') return 'grounded-walk-cycle';
  return 'pose-cycle';
}

function getFrameIndexForPose(pose: ActorPose | 'portrait', frameCount: number, time = 0): number {
  if (frameCount <= 1) return 0;
  const fpsByPose: Partial<Record<ActorPose | 'portrait', number>> = {
    idle: 3,
    walk: 8,
    run: 12,
    swing: 14,
    attack: 8,
    talk: 5,
    defeat: 6,
  };
  const fps = fpsByPose[pose] ?? 6;
  return Math.floor((time / 1000) * fps) % frameCount;
}

function getFrameMap(scene: Phaser.Scene, kind: ActorKind): Partial<Record<ActorPose | 'portrait', Crop[]>> {
  if (kind === 'hero' && scene.textures.exists(TextureKeys.ApprenticeCombat)) {
    return apprenticeCombatFrames;
  }
  if (kind === 'mentor' && scene.textures.exists(TextureKeys.MasterKeikoCombat)) {
    return masterKeikoCombatFrames;
  }
  if (kind === 'sentinel' && scene.textures.exists(TextureKeys.BinarySentinelCombat)) {
    return binarySentinelCombatFrames;
  }
  if (kind === 'oni' && scene.textures.exists(TextureKeys.NullOniBossCombat)) {
    return nullOniBossCombatFrames;
  }
  if (kind === 'returnOni' && scene.textures.exists(TextureKeys.ReturnOniSheet)) {
    return returnOniCombatFrames;
  }
  return generatedPoseFrames[kind];
}

function getSourceTextureKey(scene: Phaser.Scene, kind: ActorKind): string {
  if (kind === 'hero' && scene.textures.exists(TextureKeys.ApprenticeCombat)) {
    return TextureKeys.ApprenticeCombat;
  }
  if (kind === 'mentor' && scene.textures.exists(TextureKeys.MasterKeikoCombat)) {
    return TextureKeys.MasterKeikoCombat;
  }
  if (kind === 'sentinel' && scene.textures.exists(TextureKeys.BinarySentinelCombat)) {
    return TextureKeys.BinarySentinelCombat;
  }
  if (kind === 'oni' && scene.textures.exists(TextureKeys.NullOniBossCombat)) {
    return TextureKeys.NullOniBossCombat;
  }
  if (kind === 'returnOni' && scene.textures.exists(TextureKeys.ReturnOniSheet)) {
    return TextureKeys.ReturnOniSheet;
  }
  return TextureKeys.Chapter1Characters;
}
