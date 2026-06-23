import Phaser from 'phaser';
import { publishGeneratedBackdropQuality } from './assetQuality';
import { TextureKeys } from './sceneKeys';

export interface GeneratedManifest {
  useGenerated: boolean;
  titleKeyArt: string;
  titleSkyfallFx?: string;
  titleCinematicVignette?: string;
  titleStartSeal?: string;
  titleStartPlaque?: string;
  advancePromptSeal?: string;
  skipPromptSeal?: string;
  arenaKeyArt: string;
  spriteAtlas: string;
  abilityVowCards?: string;
  abilityVowEffects?: string;
  swordSwingVfx?: string;
  combatHitMarks?: string;
  combatTelegraphSigils?: string;
  bossTelegraphSigils?: string;
  bossHudPanel?: string;
  bossCombatCue?: string;
  bossPlayerCue?: string;
  bossFinisherCue?: string;
  bossAttackCue?: string;
  bossPhaseRupture?: string;
  bossComboCadence?: string;
  bossWarningLanes?: string;
  bossAttackBanner?: string;
  bossThreatPip?: string;
  healthBarFrame?: string;
  healthMeterFill?: string;
  terminalPanel?: string;
  pausePanel?: string;
  dialoguePanel?: string;
  resultPanel?: string;
  warningSigils?: string;
  dungeonHudPanel?: string;
  tutorialHudPanel?: string;
  tutorialHintStrip?: string;
  chapter2TrailHudPanel?: string;
  seamVfx?: string;
  bossImpactVfx?: string;
  resultBackdrop?: string;
  resultVictoryBackdrop?: string;
  resultDeathBackdrop?: string;
  resultRitualVfx?: string;
  resultAmbientMotes?: string;
  resultAtmosphereOverlay?: string;
  abilityKeyTalisman?: string;
  stealthDetectionFill?: string;
  roomHintBanner?: string;
  vowAutocompleteRow?: string;
  keikoRadioOverlay?: string;
  exitBeaconBanner?: string;
  keikoMentorOverlay?: string;
  helperDismissArrow?: string;
  chapter1?: {
    characters: string;
    apprenticeCombat?: string;
    masterKeikoCombat?: string;
    binarySentinelCombat?: string;
    nullOniBossCombat?: string;
    tutorialYard?: string;
    tutorialFocusOverlay?: string;
    archivePracticeEcho?: string;
    tutorialVowTarget?: string;
    tutorialSigils?: string;
    archiveMemory: string;
    archiveMemoryShard?: string;
    archiveVowSeam?: string;
    archiveNullOniOmen?: string;
    introNullOniThreat?: string;
    brokenDojo: string;
    hubAtmosphereOverlay?: string;
    hubSeamCue?: string;
    archiveSeamCue?: string;
    archiveApproachOverlay?: string;
    dungeonGate: string;
    dungeonAtmosphereOverlay?: string;
    dungeonSealStatus?: string;
    dungeonSeamTransition?: string;
    dungeonExitBeacon?: string;
    dungeonSentinelWarning?: string;
    roomArchiveShard?: string;
    roomSentinelPassage?: string;
    roomBooleanGate?: string;
    roomOniThreshold?: string;
    roomDataAshCrossing?: string;
    roomBitmaskBridge?: string;
    roomCacheShrine?: string;
    roomNullGateAntechamber?: string;
    puzzleRoomArchive?: string;
    traversalDataAsh?: string;
    sageEncounterShrine?: string;
    sageCompilerPortrait?: string;
    sageCompilerIcon?: string;
    keybindElderPortrait?: string;
    keybindElderIcon?: string;
    sageRescueMinions?: string;
    trapBitmaskBridge?: string;
    stealthArchiveReliquary?: string;
    stealthWatcherMask?: string;
    nullWardenCombat?: string;
    nullWardenExtended?: string;
    nullGateForegroundPillars?: string;
    nullGateAntechamber?: string;
    puzzleNodeStates?: string;
    trapVariants?: string;
    extendedDungeonRooms?: string;
    nullOniArena: string;
    bossOrbitAura?: string;
    bossArenaAtmosphere?: string;
    nullOniShadowstep?: string;
    bossShadowstepTrail?: string;
    bossMotionSmear?: string;
    respawnSeal?: string;
    seamPortal?: string;
    foregroundDepth?: string;
  };
  chapter2?: {
    outdoorTrail: string;
    trailAtmosphereOverlay?: string;
    trailStatusCue?: string;
    stageGateLoop?: string;
    stageBooleanSwitchback?: string;
    stageArrayShrine?: string;
    stageRuntimeRavine?: string;
    stageReturnThreshold?: string;
    revengeArena: string;
    returnOniSheet: string;
    stolenCinematic?: string;
    nullWarriors?: string;
    minionVariants?: string;
    stageInterludeCue?: string;
    stageInterludeAtmosphere?: string;
    trailAttackMarkers?: string;
    gatePortal: string;
    vowInterlude?: string;
  };
  chapter3?: {
    arcFracturedHub?: string;
    arcFracturedTrial?: string;
    arcSkyNullOni?: string;
    arcSilentCodexHub?: string;
    arcMirrorShade?: string;
    arcChecksumShade?: string;
    arcCodexWarden?: string;
    arcWaypointGlow?: string;
    arcRewardBanner?: string;
    upgradeIcons?: string;
    missionMedals?: string;
    arcBadges?: string;
    hubPanel?: string;
  };
}

export function getGeneratedManifest(scene: Phaser.Scene): GeneratedManifest | undefined {
  return scene.cache.json.get('generated-manifest') as GeneratedManifest | undefined;
}

export function queueGeneratedChapterAssets(scene: Phaser.Scene): void {
  const manifest = getGeneratedManifest(scene);
  if (!manifest?.useGenerated || scene.registry.get('generated-assets-loading')) {
    return;
  }

  const candidates: Array<[string, string | undefined]> = [
    [TextureKeys.ArenaKeyArt, manifest.arenaKeyArt],
    [TextureKeys.TitleSkyfallFx, manifest.titleSkyfallFx],
    [TextureKeys.TitleCinematicVignette, manifest.titleCinematicVignette],
    [TextureKeys.TitleStartSeal, manifest.titleStartSeal],
    [TextureKeys.TitleStartPlaque, manifest.titleStartPlaque],
    [TextureKeys.AdvancePromptSeal, manifest.advancePromptSeal],
    [TextureKeys.SkipPromptSeal, manifest.skipPromptSeal],
    [TextureKeys.SpriteAtlas, manifest.spriteAtlas],
    [TextureKeys.AbilityVowCards, manifest.abilityVowCards],
    [TextureKeys.AbilityVowEffects, manifest.abilityVowEffects],
    [TextureKeys.SwordSwingVfx, manifest.swordSwingVfx],
    [TextureKeys.CombatHitMarks, manifest.combatHitMarks],
    [TextureKeys.CombatTelegraphSigils, manifest.combatTelegraphSigils],
    [TextureKeys.BossTelegraphSigils, manifest.bossTelegraphSigils],
    [TextureKeys.BossHudPanel, manifest.bossHudPanel],
    [TextureKeys.BossCombatCue, manifest.bossCombatCue],
    [TextureKeys.BossPlayerCue, manifest.bossPlayerCue],
    [TextureKeys.BossFinisherCue, manifest.bossFinisherCue],
    [TextureKeys.BossAttackCue, manifest.bossAttackCue],
    [TextureKeys.BossPhaseRupture, manifest.bossPhaseRupture],
    [TextureKeys.BossComboCadence, manifest.bossComboCadence],
    [TextureKeys.BossWarningLanes, manifest.bossWarningLanes],
    [TextureKeys.BossAttackBanner, manifest.bossAttackBanner],
    [TextureKeys.BossThreatPip, manifest.bossThreatPip],
    [TextureKeys.HealthBarFrame, manifest.healthBarFrame],
    [TextureKeys.HealthMeterFill, manifest.healthMeterFill],
    [TextureKeys.TerminalPanel, manifest.terminalPanel],
    [TextureKeys.PausePanel, manifest.pausePanel],
    [TextureKeys.DialoguePanel, manifest.dialoguePanel],
    [TextureKeys.ResultPanel, manifest.resultPanel],
    [TextureKeys.WarningSigils, manifest.warningSigils],
    [TextureKeys.DungeonHudPanel, manifest.dungeonHudPanel],
    [TextureKeys.TutorialHudPanel, manifest.tutorialHudPanel],
    [TextureKeys.TutorialHintStrip, manifest.tutorialHintStrip],
    [TextureKeys.Chapter2TrailHudPanel, manifest.chapter2TrailHudPanel],
    [TextureKeys.SeamVfx, manifest.seamVfx],
    [TextureKeys.BossImpactVfx, manifest.bossImpactVfx],
    [TextureKeys.ResultBackdrop, manifest.resultBackdrop],
    [TextureKeys.ResultVictoryBackdrop, manifest.resultVictoryBackdrop],
    [TextureKeys.ResultDeathBackdrop, manifest.resultDeathBackdrop],
    [TextureKeys.ResultRitualVfx, manifest.resultRitualVfx],
    [TextureKeys.ResultAmbientMotes, manifest.resultAmbientMotes],
    [TextureKeys.ResultAtmosphereOverlay, manifest.resultAtmosphereOverlay],
    [TextureKeys.AbilityKeyTalisman, manifest.abilityKeyTalisman],
    [TextureKeys.StealthDetectionFill, manifest.stealthDetectionFill],
    [TextureKeys.RoomHintBanner, manifest.roomHintBanner],
    [TextureKeys.VowAutocompleteRow, manifest.vowAutocompleteRow],
    [TextureKeys.KeikoRadioOverlay, manifest.keikoRadioOverlay],
    [TextureKeys.ExitBeaconBanner, manifest.exitBeaconBanner],
    [TextureKeys.KeikoMentorOverlay, manifest.keikoMentorOverlay],
    [TextureKeys.HelperDismissArrow, manifest.helperDismissArrow],
    [TextureKeys.Chapter1Characters, manifest.chapter1?.characters],
    [TextureKeys.ApprenticeCombat, manifest.chapter1?.apprenticeCombat ?? 'assets/generated/chapter1/apprentice-combat-alpha.png'],
    [TextureKeys.MasterKeikoCombat, manifest.chapter1?.masterKeikoCombat ?? 'assets/generated/chapter1/master-keiko-v2-alpha.png'],
    [TextureKeys.BinarySentinelCombat, manifest.chapter1?.binarySentinelCombat ?? 'assets/generated/chapter1/binary-sentinel-alpha.png'],
    [TextureKeys.NullOniBossCombat, manifest.chapter1?.nullOniBossCombat ?? 'assets/generated/chapter1/null-oni-boss-alpha.png'],
    [TextureKeys.TutorialYard, manifest.chapter1?.tutorialYard],
    [TextureKeys.TutorialFocusOverlay, manifest.chapter1?.tutorialFocusOverlay],
    [TextureKeys.ArchivePracticeEcho, manifest.chapter1?.archivePracticeEcho],
    [TextureKeys.TutorialVowTarget, manifest.chapter1?.tutorialVowTarget],
    [TextureKeys.TutorialSigils, manifest.chapter1?.tutorialSigils],
    [TextureKeys.ArchiveMemory, manifest.chapter1?.archiveMemory],
    [TextureKeys.ArchiveMemoryShard, manifest.chapter1?.archiveMemoryShard],
    [TextureKeys.ArchiveVowSeam, manifest.chapter1?.archiveVowSeam],
    [TextureKeys.ArchiveNullOniOmen, manifest.chapter1?.archiveNullOniOmen],
    [TextureKeys.IntroNullOniThreat, manifest.chapter1?.introNullOniThreat],
    [TextureKeys.BrokenDojo, manifest.chapter1?.brokenDojo],
    [TextureKeys.HubAtmosphereOverlay, manifest.chapter1?.hubAtmosphereOverlay],
    [TextureKeys.HubSeamCue, manifest.chapter1?.hubSeamCue],
    [TextureKeys.ArchiveSeamCue, manifest.chapter1?.archiveSeamCue],
    [TextureKeys.ArchiveApproachOverlay, manifest.chapter1?.archiveApproachOverlay],
    [TextureKeys.DungeonGate, manifest.chapter1?.dungeonGate],
    [TextureKeys.DungeonAtmosphereOverlay, manifest.chapter1?.dungeonAtmosphereOverlay],
    [TextureKeys.DungeonSealStatus, manifest.chapter1?.dungeonSealStatus],
    [TextureKeys.DungeonSeamTransition, manifest.chapter1?.dungeonSeamTransition],
    [TextureKeys.DungeonExitBeacon, manifest.chapter1?.dungeonExitBeacon],
    [TextureKeys.DungeonSentinelWarning, manifest.chapter1?.dungeonSentinelWarning],
    [TextureKeys.DungeonRoomArchiveShard, manifest.chapter1?.roomArchiveShard],
    [TextureKeys.DungeonRoomSentinelPassage, manifest.chapter1?.roomSentinelPassage],
    [TextureKeys.DungeonRoomBooleanGate, manifest.chapter1?.roomBooleanGate],
    [TextureKeys.DungeonRoomOniThreshold, manifest.chapter1?.roomOniThreshold],
    [TextureKeys.DungeonRoomDataAshCrossing, manifest.chapter1?.roomDataAshCrossing],
    [TextureKeys.DungeonRoomBitmaskBridge, manifest.chapter1?.roomBitmaskBridge],
    [TextureKeys.DungeonRoomCacheShrine, manifest.chapter1?.roomCacheShrine],
    [TextureKeys.DungeonRoomNullGateAntechamber, manifest.chapter1?.roomNullGateAntechamber],
    [TextureKeys.PuzzleRoomArchive, manifest.chapter1?.puzzleRoomArchive],
    [TextureKeys.TraversalDataAsh, manifest.chapter1?.traversalDataAsh],
    [TextureKeys.SageEncounterShrine, manifest.chapter1?.sageEncounterShrine],
    [TextureKeys.SageCompilerPortrait, manifest.chapter1?.sageCompilerPortrait],
    [TextureKeys.SageCompilerIcon, manifest.chapter1?.sageCompilerIcon],
    [TextureKeys.KeybindElderPortrait, manifest.chapter1?.keybindElderPortrait],
    [TextureKeys.KeybindElderIcon, manifest.chapter1?.keybindElderIcon],
    [TextureKeys.SageRescueMinions, manifest.chapter1?.sageRescueMinions],
    [TextureKeys.TrapBitmaskBridge, manifest.chapter1?.trapBitmaskBridge],
    [TextureKeys.StealthArchiveReliquary, manifest.chapter1?.stealthArchiveReliquary],
    [TextureKeys.StealthWatcherMask, manifest.chapter1?.stealthWatcherMask],
    [TextureKeys.NullWardenCombat, manifest.chapter1?.nullWardenCombat],
    [TextureKeys.NullWardenExtended, manifest.chapter1?.nullWardenExtended],
    [TextureKeys.NullGateForegroundPillars, manifest.chapter1?.nullGateForegroundPillars],
    [TextureKeys.NullGateAntechamber, manifest.chapter1?.nullGateAntechamber],
    [TextureKeys.PuzzleNodeStates, manifest.chapter1?.puzzleNodeStates],
    [TextureKeys.TrapVariants, manifest.chapter1?.trapVariants],
    [TextureKeys.ExtendedDungeonRooms, manifest.chapter1?.extendedDungeonRooms],
    [TextureKeys.NullOniArena, manifest.chapter1?.nullOniArena],
    [TextureKeys.BossOrbitAura, manifest.chapter1?.bossOrbitAura],
    [TextureKeys.BossArenaAtmosphere, manifest.chapter1?.bossArenaAtmosphere],
    [TextureKeys.NullOniShadowstep, manifest.chapter1?.nullOniShadowstep],
    [TextureKeys.BossShadowstepTrail, manifest.chapter1?.bossShadowstepTrail],
    [TextureKeys.BossMotionSmear, manifest.chapter1?.bossMotionSmear],
    [TextureKeys.RespawnSeal, manifest.chapter1?.respawnSeal],
    [TextureKeys.Chapter1SeamPortal, manifest.chapter1?.seamPortal],
    [TextureKeys.ForegroundDepth, manifest.chapter1?.foregroundDepth],
    [TextureKeys.Chapter2OutdoorTrail, manifest.chapter2?.outdoorTrail],
    [TextureKeys.Chapter2TrailAtmosphereOverlay, manifest.chapter2?.trailAtmosphereOverlay],
    [TextureKeys.Chapter2TrailStatusCue, manifest.chapter2?.trailStatusCue],
    [TextureKeys.Chapter2StageGateLoop, manifest.chapter2?.stageGateLoop],
    [TextureKeys.Chapter2StageBooleanSwitchback, manifest.chapter2?.stageBooleanSwitchback],
    [TextureKeys.Chapter2StageArrayShrine, manifest.chapter2?.stageArrayShrine],
    [TextureKeys.Chapter2StageRuntimeRavine, manifest.chapter2?.stageRuntimeRavine],
    [TextureKeys.Chapter2StageReturnThreshold, manifest.chapter2?.stageReturnThreshold],
    [TextureKeys.Chapter2RevengeArena, manifest.chapter2?.revengeArena],
    [TextureKeys.ReturnOniSheet, manifest.chapter2?.returnOniSheet],
    [TextureKeys.Chapter2StolenCinematic, manifest.chapter2?.stolenCinematic],
    [TextureKeys.Chapter2NullWarriors, manifest.chapter2?.nullWarriors],
    [TextureKeys.Chapter2MinionVariants, manifest.chapter2?.minionVariants],
    [TextureKeys.Chapter2StageInterludeCue, manifest.chapter2?.stageInterludeCue],
    [TextureKeys.Chapter2StageInterludeAtmosphere, manifest.chapter2?.stageInterludeAtmosphere],
    [TextureKeys.Chapter2TrailAttackMarkers, manifest.chapter2?.trailAttackMarkers],
    [TextureKeys.GatePortal, manifest.chapter2?.gatePortal],
    [TextureKeys.Chapter2VowInterlude, manifest.chapter2?.vowInterlude],
    [TextureKeys.ArcFracturedHub, manifest.chapter3?.arcFracturedHub],
    [TextureKeys.ArcFracturedTrial, manifest.chapter3?.arcFracturedTrial],
    [TextureKeys.ArcSkyNullOni, manifest.chapter3?.arcSkyNullOni],
    [TextureKeys.ArcSilentCodexHub, manifest.chapter3?.arcSilentCodexHub],
    [TextureKeys.ArcMirrorShade, manifest.chapter3?.arcMirrorShade],
    [TextureKeys.ArcChecksumShade, manifest.chapter3?.arcChecksumShade],
    [TextureKeys.ArcCodexWarden, manifest.chapter3?.arcCodexWarden],
    [TextureKeys.ArcWaypointGlow, manifest.chapter3?.arcWaypointGlow],
    [TextureKeys.ArcRewardBanner, manifest.chapter3?.arcRewardBanner],
    [TextureKeys.Chapter3UpgradeIcons, manifest.chapter3?.upgradeIcons],
    [TextureKeys.Chapter3MissionMedals, manifest.chapter3?.missionMedals],
    [TextureKeys.Chapter3ArcBadges, manifest.chapter3?.arcBadges],
    [TextureKeys.Chapter3HubPanel, manifest.chapter3?.hubPanel],
  ];

  const pending = candidates.filter(([key, path]) => path && !scene.textures.exists(key));
  if (pending.length === 0 || scene.load.isLoading()) {
    return;
  }

  scene.registry.set('generated-assets-loading', true);
  pending.forEach(([key, path]) => {
    if (!path) return;
    if (key === TextureKeys.PuzzleNodeStates) {
      scene.load.spritesheet(key, path, { frameWidth: 96, frameHeight: 96 });
      return;
    }
    if (key === TextureKeys.TrapVariants) {
      scene.load.spritesheet(key, path, { frameWidth: 80, frameHeight: 80 });
      return;
    }
    if (key === TextureKeys.StealthWatcherMask) {
      scene.load.spritesheet(key, path, { frameWidth: 64, frameHeight: 64 });
      return;
    }
    if (key === TextureKeys.NullWardenCombat) {
      scene.load.spritesheet(key, path, { frameWidth: 192, frameHeight: 192 });
      return;
    }
    if (key === TextureKeys.SageRescueMinions) {
      scene.load.spritesheet(key, path, { frameWidth: 96, frameHeight: 96 });
      return;
    }
    if (key === TextureKeys.ArcSkyNullOni) {
      scene.load.spritesheet(key, path, { frameWidth: 256, frameHeight: 256 });
      return;
    }
    if (key === TextureKeys.ArcMirrorShade) {
      scene.load.spritesheet(key, path, { frameWidth: 96, frameHeight: 96 });
      return;
    }
    if (key === TextureKeys.ArcChecksumShade) {
      scene.load.spritesheet(key, path, { frameWidth: 96, frameHeight: 96 });
      return;
    }
    if (key === TextureKeys.ArcCodexWarden) {
      scene.load.spritesheet(key, path, { frameWidth: 256, frameHeight: 256 });
      return;
    }
    if (key === TextureKeys.Chapter3UpgradeIcons) {
      scene.load.spritesheet(key, path, { frameWidth: 128, frameHeight: 128 });
      return;
    }
    if (key === TextureKeys.Chapter3MissionMedals) {
      scene.load.spritesheet(key, path, { frameWidth: 128, frameHeight: 128 });
      return;
    }
    if (key === TextureKeys.Chapter3ArcBadges) {
      scene.load.spritesheet(key, path, { frameWidth: 160, frameHeight: 160 });
      return;
    }
    scene.load.image(key, path);
  });
  scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
    scene.registry.set('generated-assets-loading', false);
    publishGeneratedBackdropQuality(scene);
  });
  scene.load.start();
}
