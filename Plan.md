
Chapter 1 Combat + Lore Revamp Plan
Summary
Revamp the current Chapter 1 slice into a stronger “full game” foundation: better lore, staged dialogue with portraits, animated characters, a real tutorial, X melee, T terminal casting with 0.5x slow time, Escape pause/options, and a playtested Null Oni fight. Scope is the polished Chapter 1 slice, not all Season 1 bosses yet.

Six-Phase Breakdown
Phase 1: Foundation and Safety
Lock in Vite, TypeScript, Phaser scenes, save/load, test mode, audio unlock, and crash-free scene transitions.

Phase 2: Lore and Presentation
Rewrite the opening around the ninja Apprentice, Null Oni corruption, Keiko's greeting, typewriter dialogue, centered portraits, and staged actor movement.

Phase 3: Movement and 2.5D Rooms
Make WASD movement responsive with acceleration, run feel, depth sorting, room borders, gate walking, dark fades, and scroller-like room exits.

Phase 4: Combat and Commands
Use X for sword swings, T for terminal vows, remove J, add real sword arcs, cooldowns, energy, and try.catch as a typed combat vow.

Phase 5: Enemies, Bosses, and Animation Assets
Replace placeholder/bleeding textures with generated sprite sheets, add Sentinel attack telegraphs, Null Oni phases, readable warnings, stagger, defeat, and post-boss dialogue.

Phase 6: Playtest, Polish, and Packaging Prep
Beat Chapter 1 in browser, check screenshots for overlap/bleeding, keep 60 FPS targets, document remaining Season 1 bosses, and prepare the project for later PC packaging.

Key Changes
Rewrite intro lore around the Apprentice as a ninja of the Archive Clan whose coworkers were corrupted by the Null Oni into null warriors.
Replace exposition-heavy move text with story-first dialogue, then teach controls inside a playable tutorial.
Add portrait dialogue UI: speaker name, head portrait, wrapped text, no overlap, and actor staging where characters face each other.
Add animated sprites for every active character in Chapter 1 using imagegen: Apprentice, Master Keiko, Binary Sentinel, Null Oni.
Generate separate image assets for idle, walk, strike, hurt, defeat, and boss attack animations where relevant.
Add new talking-scene maps with generated art: archive memory scene, broken dojo scene, and dungeon gate scene.
Move combat controls to:
WASD move
X swing

T open terminal
Enter submit/interact
Escape pause/cancel
Add terminal combat popup:
Press T to open.
Game slows to 0.5x.
Player types full commands like try.catch.
Enter casts if unlocked and valid.
Escape closes terminal without casting.
Add clearer “lines of code” explanations through lore/tooltips, not lessons: each command is a mystical combat oath with short flavor plus combat effect.
Add Escape menu with Resume, Save Game, Settings, Exit to Title, and Extras.
Reposition HUD/objectives so title text, objective panels, boss HP, and dialogue never overlap.
Interfaces And Systems
Extend game data with:
CharacterDefinition: id, display name, portrait key, animation keys, default scale, faction.
AnimationDefinition: key, texture path, frame size, frame count, fps, repeat mode.
TerminalCommandDefinition: command text, linked ability id, aliases, locked message, success message.
TutorialStep: id, trigger, instruction text, completion condition, optional highlight target.
Update existing abilities so syntaxTokens still support tests, but terminal casting uses full command strings such as try.catch.
Add a reusable DialogueSceneController for portraits, facing, actor placement, and safe text wrapping.
Add a reusable TerminalOverlay used by dungeon and boss scenes.
Add a reusable PauseMenuOverlay available in all playable scenes.
Update asset manifest to include Chapter 1 generated maps, portraits, and animation sheets under public/assets/generated/chapter1/.
Imagegen Asset Plan
Use built-in image_gen for every generated raster asset, then copy final project assets into the workspace.

Generate:

Apprentice portrait/head, idle sheet, walk sheet, swing sheet, movement sheet, hurt sheet.
Master Keiko portrait/head, idle sheet, talking/gesture sheet, walk sheet.
Binary Sentinel idle, walk, attack, hurt, defeat sheets.
Null Oni portrait/head, idle, walk, void-palm, mask-crash, hurt, stagger, defeat sheets.
Archive memory talking backdrop.
Broken Dojo talking backdrop.
Corrupted dungeon gate backdrop.
Null Oni arena backdrop polish pass if needed.
All sprites use pixel-art “Glitch Mythology”: cursed temples, ancient syntax scrolls, binary spirits, readable silhouettes, no modern VS Code/cyber office look.

Tutorial And Chapter Flow
Title → Archive memory flashback → Broken Dojo intro.
Keiko welcomes the Apprentice after the dark road to the Broken Dojo and frames Codejitsu vows as the way to recover people erased into null.
Playable dojo tutorial:
Move to marked tile.
Face Keiko.
Swing with X.

Open terminal with T.
Type try.catch and press Enter.
Dungeon room:
Fight two Binary Sentinels with animated attacks.
Objective panel uses compact placement and hides after completion.
Gate opens only after sentinels are defeated.
Null Oni boss:
Uses readable warning attacks.
Has stagger window.
Terminal casting is required once.
Victory unlocks/masters try.catch.
Test Plan
Unit tests:
terminal command parsing
ability cooldowns from typed commands
pause/menu state transitions
tutorial step completion
save/load after tutorial and boss win
E2E tests:
load title → intro → tutorial → dungeon → boss → win
press X to swing instead of J
open T terminal, confirm game slow factor, type try.catch, cast
Escape opens pause menu, Resume closes it, Save writes localStorage
no text overlap at desktop viewport
Manual/Playwright playtest:
Beat Chapter 1 using normal controls, not the test-only L shortcut.
Verify character animations play during movement and attacks.
Verify dialogue portraits match the active speaker.
Verify boss attacks are readable and the fight is beatable.
Assumptions
Implement only the polished Chapter 1 slice in this pass.
Apprentice origin is Archive Clan ninja, with the Null Oni corruption of coworkers as the Chapter 1 wound.
Terminal input is full command typing, not autocomplete.
imagegen is required for all new Chapter 1 character, portrait, map, and animation assets.
Existing Vite + TypeScript + Phaser stack stays.
