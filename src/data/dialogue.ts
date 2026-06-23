import type { DialogueNode } from '../types/game';

export const introDialogue: DialogueNode[] = [
  {
    id: 'fallen-runner',
    speaker: 'Apprentice',
    portrait: 'hero',
    text: 'A demon mask called Null Oni invaded the archive and erased everyone who worked there. Their names, their records — gone. I was the only one who escaped.',
    nextId: 'null-coworkers',
  },
  {
    id: 'null-coworkers',
    speaker: 'Apprentice',
    portrait: 'hero',
    text: 'I have to get them back. But the archive is full of Null Oni\'s masked sentinels. I need to learn how to fight before I go in.',
    nextId: 'dark-road',
  },
  {
    id: 'dark-road',
    speaker: 'Apprentice',
    portrait: 'hero',
    text: 'A single surviving data line pointed me to this dojo — the last place Null Oni has not reached yet.',
    nextId: 'keiko-found',
  },
  {
    id: 'keiko-found',
    speaker: 'Master Keiko',
    portrait: 'mentor',
    text: 'I sensed you coming. The archive chose well — you heard the broken code calling for help instead of running from it.',
    nextId: 'not-lessons',
  },
  {
    id: 'not-lessons',
    speaker: 'Apprentice',
    portrait: 'hero',
    text: 'Then train me. I will not let Null Oni erase another name.',
    nextId: 'lines',
  },
  {
    id: 'lines',
    speaker: 'Master Keiko',
    portrait: 'mentor',
    text: 'Codejitsu is not a lesson. It is a vow written with breath, blade, and timing. First you learn to survive the masked sentinels inside the archive.',
    nextId: 'oni',
  },
  {
    id: 'oni',
    speaker: 'Master Keiko',
    portrait: 'mentor',
    text: 'Stand up, Archive Runner. We begin in the courtyard. Clear the sentinels, reach Null Oni, and take back every name that was stolen.',
    trigger: 'start-dungeon',
  },
];

export const chapterTwoDialogue: DialogueNode[] = [
  {
    id: 'chapter2-keiko-calls',
    speaker: 'Master Keiko',
    portrait: 'mentor',
    text: 'Null Oni warned you of a brother before it fell. I feared this. The moon gate outside the dojo is moving on its own — the brother is already here.',
    nextId: 'chapter2-runner-asks',
  },
  {
    id: 'chapter2-runner-asks',
    speaker: 'Apprentice',
    portrait: 'hero',
    text: 'Null Oni said his brother would seek revenge. That threat wasn\'t empty. What do we know about him?',
    nextId: 'chapter2-return-oni',
  },
  {
    id: 'chapter2-return-oni',
    speaker: 'Return Oni',
    portrait: 'return-oni',
    text: 'You broke my brother. Now I will pull your teacher through the moon gate and make you watch every rescue fail until your vow collapses.',
    nextId: 'chapter2-keiko-taken',
  },
  {
    id: 'chapter2-keiko-taken',
    speaker: 'Master Keiko',
    portrait: 'mentor',
    text: 'Do not chase with anger. Watch what he loops: gate, chain, breath. The answer is hidden in the pattern he repeats.',
    nextId: 'chapter2-runner-chases',
  },
  {
    id: 'chapter2-runner-chases',
    speaker: 'Apprentice',
    portrait: 'hero',
    text: 'Keiko! I can still hear the chain on the gate. If I move fast enough I can cut it before it resets.',
    nextId: 'chapter2-keiko-vow',
  },
  {
    id: 'chapter2-keiko-vow',
    speaker: 'Master Keiko',
    portrait: 'mentor',
    text: 'No. Kneel. Breathe. A Codejitsu vow is not copied from a master — it is discovered when the world strikes the same place twice.',
    nextId: 'chapter2-meditation',
  },
  {
    id: 'chapter2-meditation',
    speaker: 'Apprentice',
    portrait: 'hero',
    text: 'The chain repeats. My blade repeats. This isn\'t rage — it\'s rhythm. Loop strike.',
    nextId: 'chapter2-apprentice-alone',
  },
  {
    id: 'chapter2-apprentice-alone',
    speaker: 'Apprentice',
    portrait: 'hero',
    text: 'I will follow the path he opened, break the loops one by one, and bring Master Keiko home.',
    trigger: 'start-chapter-2',
  },
];

export const chapterTwoVictoryDialogue: DialogueNode[] = [
  {
    id: 'return-oni-reforms',
    speaker: 'Return Oni',
    portrait: 'return-oni',
    text: 'A loop cannot be killed. I return. I return. I return.',
    nextId: 'runner-breaks-loop',
  },
  {
    id: 'runner-breaks-loop',
    speaker: 'Apprentice',
    portrait: 'hero',
    text: 'No. A true loop has a purpose. Yours only repeats grief.',
    nextId: 'keiko-freed',
  },
  {
    id: 'keiko-freed',
    speaker: 'Master Keiko',
    portrait: 'mentor',
    text: 'You did not copy my art. You found the rhythm yourself. That is why loop.strike obeyed you.',
    trigger: 'return-hub',
  },
];

export const chapterThreeDialogue: DialogueNode[] = [
  {
    id: 'chapter3-gate-opens',
    speaker: 'Master Keiko',
    portrait: 'mentor',
    text: 'Return Oni broke the moon gate open. Beyond it is not one path. It is the Archive split into districts, contracts, shrines, and names still waiting.',
    nextId: 'chapter3-builds',
  },
  {
    id: 'chapter3-builds',
    speaker: 'Apprentice',
    portrait: 'hero',
    text: 'Then I choose where to cut first. Not every vow needs to be carried the same way.',
    nextId: 'chapter3-keiko-loadout',
  },
  {
    id: 'chapter3-keiko-loadout',
    speaker: 'Master Keiko',
    portrait: 'mentor',
    text: 'Good. Chapter Three begins when you stop asking what the lesson is and start shaping your own Codejitsu style.',
    trigger: 'start-chapter-3',
  },
];

export const nullOniVictoryDialogue: DialogueNode[] = [
  {
    id: 'oni-revenge-taunt',
    speaker: 'Null Oni',
    portrait: 'oni',
    text: 'You have beaten me... but my brother will seek revenge!',
    nextId: 'oni-falls',
  },
  {
    id: 'oni-falls',
    speaker: 'Null Oni',
    portrait: 'oni',
    text: 'Nothing... cannot hold you... while your vow still answers.',
    nextId: 'keiko-after-oni',
  },
  {
    id: 'keiko-after-oni',
    speaker: 'Master Keiko',
    portrait: 'mentor',
    text: 'You did not destroy the mask. You forced it to remember its name. That is the first art of Codejitsu: answer the void without becoming it.',
    nextId: 'apprentice-after-oni',
  },
  {
    id: 'apprentice-after-oni',
    speaker: 'Apprentice',
    portrait: 'hero',
    text: 'Then my coworkers are not gone forever. They are lost inside the null, waiting for a line strong enough to call them back.',
    nextId: 'keiko-first-vow',
  },
  {
    id: 'keiko-first-vow',
    speaker: 'Master Keiko',
    portrait: 'mentor',
    text: 'Carry try.catch as your first vow. Not a lesson. A guard for the blade, a breath before panic, and a promise that the Archive Clan can still be named.',
    trigger: 'return-hub',
  },
];

export const hubDialogue: DialogueNode[] = [
  {
    id: 'hub-start',
    speaker: 'Master Keiko',
    portrait: 'mentor',
    text: 'WASD moves. X swings. T opens the terminal, where vows become commands.',
    trigger: 'start-dungeon',
  },
];
