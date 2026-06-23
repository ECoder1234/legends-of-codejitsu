export interface RoadmapPhase {
  id: number;
  title: string;
  summary: string;
  verifies: string[];
}

export const chapterOneRoadmap: RoadmapPhase[] = [
  {
    id: 1,
    title: 'Foundation and Safety',
    summary: 'Crash-free Phaser scenes, guarded physics, save/load, audio unlock, and restart flow.',
    verifies: ['crash-free scenes', 'guarded setVelocity', 'audio unlock', 'save game'],
  },
  {
    id: 2,
    title: 'Lore and Presentation',
    summary: 'Archive Clan ninja origin, Null Oni corruption, Keiko welcome, portraits, and typewriter dialogue.',
    verifies: ['Archive Clan', 'Null Oni corruption', 'Keiko welcome', 'centered portraits'],
  },
  {
    id: 3,
    title: 'Movement and 2.5D Rooms',
    summary: 'Grounded WASD movement, anti-drift braking, 2.5D borders, y-sorted actors, parallax, gate walking, and dark fades.',
    verifies: ['anti-drift', '2.5D borders', 'gate walking', 'dark fades'],
  },
  {
    id: 4,
    title: 'Combat and Commands',
    summary: 'X sword targeting, readable movement, T terminal slow-time vows, try.catch, hit-stop, and readable HUD.',
    verifies: ['X sword', 'J removed', 'T terminal', 'try.catch'],
  },
  {
    id: 5,
    title: 'Enemies, Bosses, and Animation Assets',
    summary: 'Generated clean-alpha combat sheets, Sentinel attacks, Null Oni patterns, stagger, and victory dialogue.',
    verifies: ['generated animations', 'clean texture edges', 'boss phases', 'victory dialogue'],
  },
  {
    id: 6,
    title: 'Playtest, Polish, and Packaging Prep',
    summary: 'Full Chapter 1 browser clear, visual QA, overlap checks, E2E coverage, and future PC packaging prep.',
    verifies: ['vision checks', 'E2E playtest', 'no overlap', 'packaging prep'],
  },
];

export function roadmapRuntimeLines(): string[] {
  return chapterOneRoadmap.map((phase) => `${phase.id} ${phase.title}: ${phase.summary} Verifies: ${phase.verifies.join(', ')}`);
}
