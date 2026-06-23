import Phaser from 'phaser';
import { playableContentAudit } from '../data/playtime';
import { publishGeneratedBackdropQuality, publishGeneratedCombatSheetQuality } from './assetQuality';
import { publishAbilityArtRuntime } from './abilityVisuals';
import { publishChapter1AnimationCatalog } from './actors';
import { publishTelegraphAssetRuntime } from './combatTelegraphs';
import { getGeneratedManifest } from './generatedAssets';
import { SceneKeys, TextureKeys } from './sceneKeys';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Boot);
  }

  preload(): void {
    this.load.json('generated-manifest', 'assets/generated/manifest.json');
    // We'll queue the rest in create() using a second scene
  }

  create(): void {
    this.publishPlayableContentAudit();
    this.createFallbackTextures();
    const manifest = getGeneratedManifest(this);
    if (!manifest?.useGenerated) {
      this.startInitialScene();
      return;
    }
    // Launch a child scene to handle the heavy asset load in its preload()
    this.scene.add('AssetLoaderScene', {
      preload: () => {
        const loader = this.scene.get('AssetLoaderScene') as Phaser.Scene;
        this.queueAllAssets(loader, manifest);
      },
      create: () => {
        publishChapter1AnimationCatalog(this);
        publishAbilityArtRuntime(this);
        publishTelegraphAssetRuntime(this);
        publishGeneratedBackdropQuality(this);
        publishGeneratedCombatSheetQuality(this);
        this.scene.remove('AssetLoaderScene');
        this.startInitialScene();
      },
    }, true);
  }

  private queueAllAssets(loader: Phaser.Scene, manifest: ReturnType<typeof getGeneratedManifest>): void {
    if (!manifest) return;

    const candidates: Array<[string, string | undefined]> = [
      [TextureKeys.TitleKeyArt, manifest.titleKeyArt],
      [TextureKeys.TitleSkyfallFx, manifest.titleSkyfallFx],
      [TextureKeys.TitleCinematicVignette, manifest.titleCinematicVignette],
      [TextureKeys.TitleStartSeal, manifest.titleStartSeal],
      [TextureKeys.TitleStartPlaque, manifest.titleStartPlaque],
      [TextureKeys.AdvancePromptSeal, manifest.advancePromptSeal],
      [TextureKeys.SkipPromptSeal, manifest.skipPromptSeal],
      [TextureKeys.ArenaKeyArt, manifest.arenaKeyArt],
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
      [TextureKeys.ApprenticeCombat, manifest.chapter1?.apprenticeCombat],
      [TextureKeys.MasterKeikoCombat, manifest.chapter1?.masterKeikoCombat],
      [TextureKeys.BinarySentinelCombat, manifest.chapter1?.binarySentinelCombat],
      [TextureKeys.NullOniBossCombat, manifest.chapter1?.nullOniBossCombat],
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
    ];
    candidates.forEach(([key, path]) => {
      if (!path || loader.textures.exists(key)) return;
      if (key === TextureKeys.PuzzleNodeStates) {
        loader.load.spritesheet(key, path, { frameWidth: 96, frameHeight: 96 });
        return;
      }
      if (key === TextureKeys.TrapVariants) {
        loader.load.spritesheet(key, path, { frameWidth: 80, frameHeight: 80 });
        return;
      }
      if (key === TextureKeys.StealthWatcherMask) {
        loader.load.spritesheet(key, path, { frameWidth: 64, frameHeight: 64 });
        return;
      }
      if (key === TextureKeys.NullWardenCombat) {
        loader.load.spritesheet(key, path, { frameWidth: 192, frameHeight: 192 });
        return;
      }
      if (key === TextureKeys.SageRescueMinions) {
        loader.load.spritesheet(key, path, { frameWidth: 96, frameHeight: 96 });
        return;
      }
      loader.load.image(key, path);
    });
  }

  private publishPlayableContentAudit(): void {
    (window as Window & {
      __CODEJITSU_PLAYTIME_AUDIT?: ReturnType<typeof playableContentAudit>;
    }).__CODEJITSU_PLAYTIME_AUDIT = playableContentAudit();
  }

  private startInitialScene(): void {
    const params = new URLSearchParams(window.location.search);
    const start = params.get('start');
    if (start === 'story') {
      this.scene.start(SceneKeys.Story);
      return;
    }
    if (start === 'tutorial') {
      this.scene.start(SceneKeys.Tutorial);
      return;
    }
    if (start === 'archive' || start === 'hub' || start === 'dungeon') {
      this.scene.start(SceneKeys.Dungeon);
      return;
    }
    if (start === 'boss') {
      this.scene.start(SceneKeys.Boss);
      return;
    }
    if (start === 'chapter2-story') {
      this.scene.start(SceneKeys.Chapter2Story);
      return;
    }
    if (start === 'chapter2-trail') {
      this.scene.start(SceneKeys.Chapter2Trail);
      return;
    }
    if (start === 'return-oni') {
      this.scene.start(SceneKeys.Boss, { bossId: 'return-oni' });
      return;
    }
    if (start === 'result-win') {
      const chapter = Phaser.Math.Clamp(Number(params.get('chapter') ?? 1), 1, 2);
      const unlock = params.get('unlock') ?? (chapter === 2 ? 'loop-strike' : 'try-catch');
      this.scene.start(SceneKeys.Result, { outcome: 'win', unlock, chapter });
      return;
    }
    if (start === 'result-lose') {
      this.scene.start(SceneKeys.Result, {
        outcome: 'lose',
        bossId: 'null-oni',
        chapter: 1,
        deathReason: 'Null Oni cracked your guard at the mask sigil.',
        retryScene: SceneKeys.Boss,
        retryData: { bossId: 'null-oni' },
      });
      return;
    }
    this.scene.start(SceneKeys.Dungeon);
  }

  private createFallbackTextures(): void {
    this.createFloorTile();
    this.createShadow();
    this.createSlash();
    this.createHero();
    this.createMentor();
    this.createNullOni();
  }

  private createFloorTile(): void {
    const canvas = this.textures.createCanvas(TextureKeys.FloorTile, 128, 72);
    if (!canvas) return;
    const ctx = canvas.getContext();
    ctx.clearRect(0, 0, 128, 72);
    ctx.fillStyle = '#211625';
    ctx.beginPath();
    ctx.moveTo(64, 2);
    ctx.lineTo(126, 36);
    ctx.lineTo(64, 70);
    ctx.lineTo(2, 36);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#4c344d';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#2d1c30';
    ctx.fillRect(40, 28, 48, 10);
    canvas.refresh();
  }

  private createShadow(): void {
    const canvas = this.textures.createCanvas(TextureKeys.Shadow, 96, 44);
    if (!canvas) return;
    const ctx = canvas.getContext();
    const gradient = ctx.createRadialGradient(48, 22, 2, 48, 22, 48);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.48)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 96, 44);
    canvas.refresh();
  }

  private createSlash(): void {
    const canvas = this.textures.createCanvas(TextureKeys.Slash, 128, 72);
    if (!canvas) return;
    const ctx = canvas.getContext();
    ctx.clearRect(0, 0, 128, 72);
    ctx.strokeStyle = '#f6ead3';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(42, 68, 62, -1.25, -0.05);
    ctx.stroke();
    ctx.strokeStyle = '#8f7dff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(42, 68, 54, -1.15, -0.1);
    ctx.stroke();
    canvas.refresh();
  }

  private createHero(): void {
    const canvas = this.textures.createCanvas(TextureKeys.Hero, 64, 92);
    if (!canvas) return;
    const ctx = canvas.getContext();
    ctx.clearRect(0, 0, 64, 92);
    ctx.fillStyle = '#1b1320';
    ctx.fillRect(24, 28, 18, 34);
    ctx.fillStyle = '#f0c36b';
    ctx.fillRect(22, 14, 22, 20);
    ctx.fillStyle = '#2c2132';
    ctx.fillRect(18, 36, 10, 28);
    ctx.fillRect(40, 36, 10, 28);
    ctx.fillStyle = '#8f7dff';
    ctx.fillRect(15, 52, 12, 6);
    ctx.fillRect(42, 52, 12, 6);
    ctx.fillStyle = '#f6ead3';
    ctx.fillRect(22, 66, 10, 18);
    ctx.fillRect(36, 66, 10, 18);
    ctx.fillStyle = '#d64f45';
    ctx.fillRect(18, 20, 28, 6);
    canvas.refresh();
  }

  private createMentor(): void {
    const canvas = this.textures.createCanvas(TextureKeys.Mentor, 70, 100);
    if (!canvas) return;
    const ctx = canvas.getContext();
    ctx.clearRect(0, 0, 70, 100);
    ctx.fillStyle = '#37283a';
    ctx.fillRect(24, 32, 24, 44);
    ctx.fillStyle = '#f6ead3';
    ctx.fillRect(25, 15, 24, 22);
    ctx.fillStyle = '#f0c36b';
    ctx.fillRect(18, 38, 12, 36);
    ctx.fillRect(46, 38, 12, 36);
    ctx.fillStyle = '#90d2b7';
    ctx.fillRect(20, 78, 40, 8);
    canvas.refresh();
  }

  private createNullOni(): void {
    const canvas = this.textures.createCanvas(TextureKeys.NullOni, 112, 128);
    if (!canvas) return;
    const ctx = canvas.getContext();
    ctx.clearRect(0, 0, 112, 128);
    ctx.fillStyle = '#251424';
    ctx.fillRect(34, 42, 44, 50);
    ctx.fillStyle = '#f6ead3';
    ctx.fillRect(30, 16, 52, 38);
    ctx.fillStyle = '#09070d';
    ctx.fillRect(42, 32, 10, 8);
    ctx.fillRect(62, 32, 10, 8);
    ctx.fillStyle = '#d64f45';
    ctx.fillRect(24, 16, 12, 12);
    ctx.fillRect(76, 16, 12, 12);
    ctx.fillStyle = '#4c344d';
    ctx.fillRect(18, 58, 20, 42);
    ctx.fillRect(76, 58, 20, 42);
    ctx.fillStyle = '#8f7dff';
    ctx.fillRect(38, 94, 12, 20);
    ctx.fillRect(62, 94, 12, 20);
    canvas.refresh();
  }
}
