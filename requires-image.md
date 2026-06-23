# Required New Image Assets

This document lists image assets that are **still needed** for the latest build.
Existing assets that already ship in `public/assets/generated/` (and that the
boot loader auto-detects) are NOT listed here.

All assets should follow the existing pixel-art style of the project, at
**1280×720** display size for full backdrops, with pixel-perfect detail at
native asset resolution.

---

## Section A — Characters

### A1. Keybind Elder portrait (`keybind-elder-portrait`)
- Used by: [src/scenes/SageEncounterScene.ts](src/scenes/SageEncounterScene.ts)
- Size: 256×320 PNG (single still pose, scaled to ~80×100 in scene)
- Subject: An old, weather-worn keyboard-master. Robes layered with mechanical
  switch caps as ornaments. Cataract-cloudy eyes hint at the years he spent
  binding vows. Palette: `#90d2b7`, `#5a4232`, `#0b0918`.
- IMPORTANT: this character is **NOT** Master Keiko. The rescue scene
  previously used Keiko's mentor texture as a placeholder — the artwork should
  read as distinctly older and more frail than Keiko.

### A2. Keybind Elder portrait icon (`keybind-elder-icon`)
- Size: 192×192 PNG
- Subject: Headshot icon of the Keybind Elder. Used in dialogue speaker tags so
  players can recognise him outside of the rescue scene.

### A3. Sentinel minion variants (`sage-rescue-minions`)
- Used by: [src/scenes/SageEncounterScene.ts](src/scenes/SageEncounterScene.ts)
- Size: spritesheet, 3 frames × 96×96 (idle, attack, defeat)
- Subject: Three red-armoured guard sentinels that patrol the cage. Distinct
  silhouette from the dungeon sentinels so they read as cage guards. Palette:
  `#d64f45`, `#3a1f44`.
- Currently rendered as tinted hero sprites (red tint) — placeholder only.

### A4. Master Keiko radio overlay (`keiko-radio-overlay`)
- Size: 320×96 PNG
- Subject: A small "radio frequency" overlay that frames Keiko's voice when she
  speaks via radio in scenes where she is not physically present
  (Sage Encounter, the two arcs). Should evoke scanlines, static, and gold
  border accents.

---

## Section B — Mini-boss & big enemies

### B1. Mini-boss Null Gate Warden — extended frames (`null-warden-extended`)
- Used by: [src/scenes/MiniBossScene.ts](src/scenes/MiniBossScene.ts)
- Status: a 6-frame, 1152×192 spritesheet already ships and is now loaded as a
  proper Phaser spritesheet. The mini-boss displays at 220×220 (was 150×150).
- **Outstanding need:** an **enlarged taller variant** at 256×384 PNG to make
  the warden read as taller-than-player rather than wider. The current sheet
  produces a short, stout silhouette which the player called "too thin".

### B2. Mini-boss arena foreground silhouette (`null-gate-foreground-pillars`)
- Used by: [src/scenes/MiniBossScene.ts](src/scenes/MiniBossScene.ts)
- Size: 1280×320 PNG (extends across the bottom 45% of the arena)
- Subject: Dark pillar silhouettes that frame the arena so the warden has
  visual scale anchors. Currently the room reads flat.

---

## Section C — Arc content (NEW — Section needed in full)

Two arcs ship as fully-playable scenes:
- **Fractured Openworld Arc** — three combat trials → boss capstone.
- **Silent Codex Arc** — three duel/mirror/warden trials → vow-heavy capstone.

Both currently use existing chapter backdrops as placeholders. They need their
own atmosphere art.

### C1. Fractured Openworld Arc hub backdrop (`arc-fractured-hub`)
- Used by: [src/scenes/FracturedOpenworldArcScene.ts](src/scenes/FracturedOpenworldArcScene.ts)
- Size: 1280×720 PNG
- Subject: A windswept open plateau at dawn. Three weathered shrines arranged
  in a line. Subtle compass roses etched into the ground at (380, 360),
  (660, 360), and (940, 360) where the trial waypoints sit. Palette:
  `#4fc3f7`, `#0a1424`.

### C2. Fractured Openworld trial atmosphere (`arc-fractured-trial`)
- Size: 1280×720 PNG
- Subject: Dawn road with mountains receding into mist. Used when a trial is
  active (currently inherits the hub backdrop).

### C3. Sky Null Oni boss sprite (`arc-sky-null-oni`)
- Used by: Fractured Openworld Arc (final trial)
- Size: spritesheet, 6 frames × 256×256 (idle, walk, claw, blast, hurt,
  defeat)
- Subject: A lighter, faster variant of Null Oni — same silhouette but with
  cloud trails and a blue tint to read as "sky" version. Palette: `#4fc3f7`,
  `#8f7dff`.
- Currently rendered as 130×140 red-tinted hero sprite.

### C4. Silent Codex Arc hub backdrop (`arc-silent-codex-hub`)
- Used by: [src/scenes/SilentCodexArcScene.ts](src/scenes/SilentCodexArcScene.ts)
- Size: 1280×720 PNG
- Subject: A silent stone vault chamber. Three small altars in a line, each
  holding a closed book whose runes glow softly. Heavy violet light. Palette:
  `#b85dff`, `#0c0b18`.

### C5. Mirror shade sprite (`arc-mirror-shade`)
- Size: spritesheet, 4 frames × 96×96 (idle, mirror-step, attack, defeat)
- Subject: Translucent gold copy of the apprentice with reversed pose. Used in
  the Mirror Trial. Palette: `#f0c36b`, `#cdbdcb`.

### C6. Checksum shade sprite (`arc-checksum-shade`)
- Size: spritesheet, 4 frames × 96×96 (idle, drift, attack, defeat)
- Subject: A small purple shade with a floating digit "1" or "0" above its
  head. Used in Checksum Spire. Palette: `#ce93d8`, `#3a1f44`.

### C7. Codex Warden sprite (`arc-codex-warden`)
- Size: spritesheet, 6 frames × 256×256 (idle, slam, sweep, recover, hurt,
  defeat)
- Subject: A massive silent figure cloaked in chained books. Slow, deliberate.
  Used in the Codex Warden duel. Palette: `#b85dff`, `#5a4232`.

### C8. Arc waypoint glow (`arc-waypoint-glow`)
- Size: 128×128 PNG
- Subject: The cyan/violet pulsing waypoint disc currently drawn as a Phaser
  circle. A real radial gradient with rune etchings would read better at the
  three node positions in each arc hub.

### C9. Arc reward banner (`arc-reward-banner`)
- Size: 480×96 PNG
- Subject: A decorated banner that flies in when an arc trial is cleared.
  Currently uses a plain text drop.

---

## Section D — UI helpers

### D1. Exit beacon banner (`exit-beacon-banner`)
- Used by: every special room (Trap, Stealth, Traversal, Sage rescue, both
  arcs) via [src/scenes/roomIntro.ts](src/scenes/roomIntro.ts).
- Size: 256×96 PNG
- Subject: The "EXIT" / "BACK" label currently drawn in text. A pixel-art gold
  plate with a stamped arrow would read better at a glance.

### D2. Keiko mentor overlay portrait (`keiko-mentor-overlay`)
- Used by: [src/scenes/roomIntro.ts](src/scenes/roomIntro.ts) via
  `showKeikoHelper(...)`.
- Size: 256×320 PNG
- Subject: A 3/4 view of Master Keiko looking directly at the player, used in
  the room-intro overlay. The current code falls back to the mentor texture
  which renders very small.

### D3. Helper dismiss arrow (`helper-dismiss-arrow`)
- Size: 64×24 PNG
- Subject: A small "[SPACE]" / "[ENTER]" key glyph that animates at the bottom
  of the helper overlay. Currently uses pulsing text.

---

## Asset placement & wiring

When new assets are produced:

1. Drop the PNG in `public/assets/generated/<chapter-or-arc>/<group>/<name>.png`
2. Add an entry in `public/assets/generated/manifest.json`
3. Register the texture key in
   [src/scenes/sceneKeys.ts](src/scenes/sceneKeys.ts) under `TextureKeys`
4. Preload it in [src/scenes/BootScene.ts](src/scenes/BootScene.ts) — for
   spritesheets (PuzzleNodeStates, TrapVariants, StealthWatcherMask,
   NullWardenCombat, and the new arc enemy sheets) load with
   `this.load.spritesheet(key, path, { frameWidth, frameHeight })` rather than
   the plain image loader.
5. Reference it in the matching scene file (each fallback path is documented
   inline next to a `this.textures.exists(...)` guard so swapping in the real
   asset is a one-line change).

Until each asset lands, every fallback path renders the scene with primitives
that maintain gameplay parity — nothing crashes, but the game looks plain in
those rooms.

## Verified playable scenes (this build)

- Tutorial (Master Keiko explains every room type the apprentice will face)
- Hub → Dungeon → Combat rooms → Puzzle (Boolean Gate) → Traversal → Sage
  Rescue (NEW: 3 minion sentinels guard the Keybind Elder) → Trap → Stealth →
  Mini-Boss → Boss (Null Oni)
- Chapter 2 Story / Trail
- Chapter 3 Story / Hub (now with Missions / Upgrades / Vows / **Arcs** tabs)
- Chapter 3 Boss (Archive Heart)
- **Fractured Openworld Arc** (3 trials + Sky Null Oni boss) — playable
- **Silent Codex Arc** (3 duels + Codex Warden boss) — playable

Every special room now starts with a Master Keiko helper overlay
(`showKeikoHelper(...)`) explaining the rules, has a brightness lift so the
generated backdrops don't render too dark, and exits via a bright gold
walk-onto **EXIT/BACK beacon** instead of an invisible interaction.
