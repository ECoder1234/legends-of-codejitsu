import Phaser from 'phaser';

interface AuditRect {
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

interface AuditEntry {
  id: string;
  object?: Phaser.GameObjects.GameObject & { getBounds?: () => Phaser.Geom.Rectangle };
  bounds?: Phaser.Geom.Rectangle;
  allowOutside?: boolean;
  allowOverlap?: boolean;
}

type LayoutAuditMap = Record<string, {
  key: string;
  panel: AuditRect;
  entries: Array<{ id: string; bounds: AuditRect; allowOutside: boolean; allowOverlap: boolean }>;
  noOverflow: boolean;
  noOverlap: boolean;
  overflowIds: string[];
  overlaps: Array<{ a: string; b: string }>;
  at: number;
}>;

function rectFromBounds(bounds: Phaser.Geom.Rectangle): AuditRect {
  return {
    x: Math.round(bounds.x * 10) / 10,
    y: Math.round(bounds.y * 10) / 10,
    width: Math.round(bounds.width * 10) / 10,
    height: Math.round(bounds.height * 10) / 10,
    right: Math.round(bounds.right * 10) / 10,
    bottom: Math.round(bounds.bottom * 10) / 10,
  };
}

function boundsFor(entry: AuditEntry): Phaser.Geom.Rectangle | undefined {
  if (entry.bounds) return entry.bounds;
  if (!entry.object || typeof entry.object.getBounds !== 'function') return undefined;
  return entry.object.getBounds();
}

export function publishTextPanelAudit(
  key: string,
  panel: Phaser.Geom.Rectangle,
  entries: AuditEntry[],
  padding = 12,
): void {
  const measured = entries
    .map((entry) => ({ ...entry, measuredBounds: boundsFor(entry) }))
    .filter((entry): entry is AuditEntry & { measuredBounds: Phaser.Geom.Rectangle } => Boolean(entry.measuredBounds));
  const overflow = measured.filter((entry) => {
    if (entry.allowOutside) return false;
    return entry.measuredBounds.x < panel.x + padding ||
      entry.measuredBounds.right > panel.right - padding ||
      entry.measuredBounds.y < panel.y + padding ||
      entry.measuredBounds.bottom > panel.bottom - padding;
  });
  const overlaps: Array<{ a: string; b: string }> = [];
  for (let left = 0; left < measured.length; left += 1) {
    for (let right = left + 1; right < measured.length; right += 1) {
      const a = measured[left];
      const b = measured[right];
      if (a.allowOverlap || b.allowOverlap) continue;
      if (Phaser.Geom.Intersects.RectangleToRectangle(a.measuredBounds, b.measuredBounds)) {
        overlaps.push({ a: a.id, b: b.id });
      }
    }
  }
  const runtime = window as Window & {
    __CODEJITSU_LAYOUT_AUDITS?: LayoutAuditMap;
  };
  runtime.__CODEJITSU_LAYOUT_AUDITS = {
    ...(runtime.__CODEJITSU_LAYOUT_AUDITS ?? {}),
    [key]: {
      key,
      panel: rectFromBounds(panel),
      entries: measured.map((entry) => ({
        id: entry.id,
        bounds: rectFromBounds(entry.measuredBounds),
        allowOutside: Boolean(entry.allowOutside),
        allowOverlap: Boolean(entry.allowOverlap),
      })),
      noOverflow: overflow.length === 0,
      noOverlap: overlaps.length === 0,
      overflowIds: overflow.map((entry) => entry.id),
      overlaps,
      at: Math.round(performance.now()),
    },
  };
}

export function clearTextPanelAudits(keys: string[]): void {
  const runtime = window as Window & { __CODEJITSU_LAYOUT_AUDITS?: LayoutAuditMap };
  if (!runtime.__CODEJITSU_LAYOUT_AUDITS) return;
  keys.forEach((key) => {
    delete runtime.__CODEJITSU_LAYOUT_AUDITS?.[key];
  });
}
