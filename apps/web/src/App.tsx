/* eslint-disable react-hooks/set-state-in-effect, react-hooks/purity */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BEYBLADES,
  BeybladeRuntime,
  darkenColor,
  applyBattleOutcome,
  beybladeDisplayStats,
  buildShareCardData,
  formatBattleRecord,
  localMatchOutcome,
  opponentTopId,
  assembleBeybladeSpec,
  getCompatibleParts,
  validatePartCompatibility,
  BLADE_PARTS,
  type BeybladeSpec,
  type BattleRecord,
  type BattleSnapshot,
  type BeybladeState,
  type BeybladeType,
  type MatchConfig,
  type MatchPhase,
  type MatchResult,
  type MatchTermination,
  type TopId,
  type TopSnapshot,
  type WinnerId,
  type EnvironmentScene,
  pickRandomEnvironmentScene,
  stadiumVariantFromMatchId,
  stadiumVariantFromSeed,
  type CustomBeybladeConfig,
} from "@game-pool/beyblade-core";
import {
  MatchmakingClient,
  OnlineMatchCoordinator,
  type OnlineMatchState,
} from "@game-pool/beyblade-multiplayer";
import { CannonBattleSimulation } from "@game-pool/beyblade-simulation";
import { BattleScene } from "./BattleScene";
import { BladeMiniIcon } from "./components/BladeMiniIcon";
import { GarageIcon } from "./components/CustomizerIcons";
import {
  BladePreviewScene,
  CAMERA_PRESETS,
  ExplodedLayersIcon,
  type CameraPreset,
} from "./BladePreviewScene";
import { PartCustomizerModal } from "./PartCustomizerModal";
import { ShareCardModal } from "./ShareCardModal";
import { synth } from "./audio";
import {
  createWebSocket,
  isActiveOnlineRoom,
  onlinePageExitAction,
  resolveWebSocketUrl,
} from "./online";
import {
  loadBattleRecord,
  loadCustomParts,
  loadPlayerColor,
  loadPlayerName,
  saveBattleRecord,
  saveCustomParts,
  savePlayerColor,
  savePlayerName,
} from "./profile";

const descriptions: Record<BeybladeType, string> = {
  attack: "速度快、撞擊力極強，擅長將對手撞出盤外或引爆。",
  defense: "重量極重、底座穩固，受到撞擊時不易位移。",
  stamina: "低摩擦底軸帶來驚人持久力，但質量較輕。",
  balance: "各屬性均衡，能依戰況切換進攻與閃避。",
  crusher: "沉重雙鎚帶來毀滅性撞擊，但速度緩慢、追不上游擊型對手。",
  phantom: "極速螺旋走位擦撞削血，裝甲極薄，經不起正面對撞。",
  aegis: "頂級減傷聖盾，穩定度領先時會轉守為攻壓制對手。",
  vampire: "每次碰撞竊取對手轉速回補自身，持久戰的天敵，惟自身脆弱。",
  zephyr: "史上最輕的極速機體，靈活無比，但撞擊輕如鴻毛且易爆。",
  berserk: "全力全開的玻璃大砲，爆發力最強，撐不過長期戰。",
};

const LOCAL_TOP_ID: TopId = "p1";
type AppMode = "menu" | "local" | "online";

export function App() {
  const [runtime] = useState(
    () => new BeybladeRuntime(new CannonBattleSimulation()),
  );
  const [coordinator] = useState(
    () =>
      new OnlineMatchCoordinator(
        new MatchmakingClient((url) => createWebSocket(url)),
      ),
  );
  const [game, setGame] = useState<BeybladeState>(runtime.state);
  const [online, setOnline] = useState<OnlineMatchState>(coordinator.state);
  const [mode, setMode] = useState<AppMode>("menu");
  const modeRef = useRef<AppMode>("menu");
  const [playerType, setPlayerType] = useState<BeybladeType>("attack");
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [customPartsMap, setCustomPartsMap] = useState<
    Partial<Record<BeybladeType, CustomBeybladeConfig>>
  >(() => loadCustomParts() as Partial<Record<BeybladeType, CustomBeybladeConfig>>);

  const currentConfig = useMemo<CustomBeybladeConfig>(() => {
    const existing = customPartsMap[playerType];
    const allowed = getCompatibleParts(playerType);

    const bladeId =
      existing?.bladeId && allowed.allowedBlades.includes(existing.bladeId)
        ? existing.bladeId
        : allowed.allowedBlades[0] ?? playerType;
    const ratchetId =
      existing?.ratchetId && allowed.allowedRatchets.includes(existing.ratchetId)
        ? existing.ratchetId
        : allowed.allowedRatchets[0] ?? playerType;
    const bitId =
      existing?.bitId && allowed.allowedBits.includes(existing.bitId)
        ? existing.bitId
        : allowed.allowedBits[0] ?? playerType;
    const chipId =
      existing?.chipId && allowed.allowedChips.includes(existing.chipId)
        ? existing.chipId
        : allowed.allowedChips[0] ?? playerType;

    return {
      type: playerType,
      bladeId,
      ratchetId,
      bitId,
      chipId,
    };
  }, [customPartsMap, playerType]);

  const selectedBladeId = currentConfig.bladeId;

  const customSpec = useMemo(() => {
    return assembleBeybladeSpec(currentConfig);
  }, [currentConfig]);

  const handleCustomConfigChange = (newConfig: CustomBeybladeConfig) => {
    const updatedMap = {
      ...customPartsMap,
      [playerType]: newConfig,
    };
    setCustomPartsMap(updatedMap);
    saveCustomParts(updatedMap);
  };

  const [customName, setCustomName] = useState(() => loadPlayerName());
  const [customColor, setCustomColor] = useState<number | null>(() =>
    loadPlayerColor(),
  );
  const [record, setRecord] = useState<BattleRecord>(() => loadBattleRecord());
  const [launchPower, setLaunchPower] = useState(20);
  const [countdownNow, setCountdownNow] = useState(0);
  const [showIntro, setShowIntro] = useState(true);
  const [upcomingModalOpen, setUpcomingModalOpen] = useState(false);
  const [scene, setScene] = useState<EnvironmentScene>(() =>
    pickRandomEnvironmentScene(),
  );

  const powerDirection = useRef(1);
  const preparedMatch = useRef<string | null>(null);
  const launchedMatch = useRef<string | null>(null);
  const endingSentMatch = useRef<string | null>(null);
  const resultSentMatch = useRef<string | null>(null);
  const lastHostSeq = useRef(0);
  const lastRelayedEventsTick = useRef(0);
  const recordRef = useRef(record);
  const recordedMatch = useRef<string | null>(null);
  const lastOnlinePhase = useRef<OnlineMatchState["phase"]>("idle");

  useEffect(() => savePlayerName(customName.trim()), [customName]);
  useEffect(() => savePlayerColor(customColor), [customColor]);

  const handleBladeChange = (type: BeybladeType) => {
    setPlayerType(type);
    setCustomColor(null);
  };

  // Persists synchronously so pagehide-triggered losses survive the unload.
  function recordOnlineOutcome(
    outcome: "win" | "loss",
    matchId: string | null,
  ): void {
    if (!matchId || recordedMatch.current === matchId) return;
    recordedMatch.current = matchId;
    const next = applyBattleOutcome(recordRef.current, outcome);
    recordRef.current = next;
    saveBattleRecord(next);
    setRecord(next);
  }

  const onlineConfig = useMemo<MatchConfig | null>(() => {
    if (!online.start || !online.matchId) return null;
    return {
      p1Type: online.start.p1.blade,
      p2Type: online.start.p2.blade,
      stadiumTheme: "neon",
      stadiumVariant: stadiumVariantFromMatchId(online.matchId),
      perfectLaunchTopIds: ["p1", "p2"],
      ...(online.start.p1.color !== undefined
        ? { p1Color: online.start.p1.color }
        : {}),
      ...(online.start.p2.color !== undefined
        ? { p2Color: online.start.p2.color }
        : {}),
      ...(online.start.p1.bladeId ? { p1BladeId: online.start.p1.bladeId } : {}),
      ...(online.start.p1.ratchetId ? { p1RatchetId: online.start.p1.ratchetId } : {}),
      ...(online.start.p1.bitId ? { p1BitId: online.start.p1.bitId } : {}),
      ...(online.start.p1.chipId ? { p1ChipId: online.start.p1.chipId } : {}),
      ...(online.start.p2.bladeId ? { p2BladeId: online.start.p2.bladeId } : {}),
      ...(online.start.p2.ratchetId ? { p2RatchetId: online.start.p2.ratchetId } : {}),
      ...(online.start.p2.bitId ? { p2BitId: online.start.p2.bitId } : {}),
      ...(online.start.p2.chipId ? { p2ChipId: online.start.p2.chipId } : {}),
    };
  }, [online.matchId, online.start]);

  const activeScene: EnvironmentScene = useMemo(() => {
    if (mode === "online" && online.start) return online.start.environment;
    return scene;
  }, [mode, online.start, scene]);

  useEffect(
    () =>
      coordinator.subscribe((state) => {
        setOnline(state);
        const previousPhase = lastOnlinePhase.current;
        lastOnlinePhase.current = state.phase;
        if (
          state.termination === "completed" &&
          state.view.result &&
          state.view.result.winnerId !== "draw"
        ) {
          recordOnlineOutcome(
            state.view.result.winnerId === state.localTopId ? "win" : "loss",
            state.matchId,
          );
        }
        if (
          state.termination === "opponent_left" &&
          (previousPhase === "battle" || previousPhase === "ending")
        ) {
          recordOnlineOutcome("win", state.matchId);
        }
        if (
          state.termination &&
          state.termination !== "completed" &&
          runtime.state.phase !== "menu"
        ) {
          runtime.dispatch({ type: "leave" });
        }
      }),
    [coordinator, runtime],
  );

  useEffect(
    () =>
      runtime.subscribe((event) => {
        if (event.type !== "stateChanged") return;
        const next = event.state;
        setGame(next);
        const currentOnline = coordinator.state;
        if (
          modeRef.current !== "online" ||
          currentOnline.role !== "host" ||
          !currentOnline.matchId
        )
          return;

        if (
          next.battle &&
          (next.phase === "battle" || next.phase === "ending")
        ) {
          const seq = coordinator.publishHostSnapshot(next.battle);
          if (seq !== null) lastHostSeq.current = seq;
        }
        if (
          currentOnline.phase === "battle" &&
          next.battle &&
          next.eventsTick > lastRelayedEventsTick.current
        ) {
          if (lastHostSeq.current === 0) {
            lastHostSeq.current =
              coordinator.publishHostSnapshot(
                next.battle,
                performance.now(),
                true,
              ) ?? 0;
          }
          for (const simulationEvent of next.events) {
            if (simulationEvent.type === "trail") continue;
            coordinator.publishHostEvent(
              simulationEvent,
              lastHostSeq.current,
              next.battle.elapsed,
            );
          }
          lastRelayedEventsTick.current = next.eventsTick;
        }
        if (
          next.phase === "ending" &&
          next.result &&
          endingSentMatch.current !== currentOnline.matchId
        ) {
          if (next.battle && lastHostSeq.current === 0) {
            lastHostSeq.current =
              coordinator.publishHostSnapshot(
                next.battle,
                performance.now(),
                true,
              ) ?? 0;
          }
          coordinator.publishHostEvent(
            {
              type: "ending",
              winnerId: next.result.winnerId,
              finishType: next.result.finishType,
            },
            lastHostSeq.current,
            next.battle?.elapsed ?? next.result.duration,
          );
          endingSentMatch.current = currentOnline.matchId;
        }
        if (
          next.phase === "result" &&
          next.result &&
          next.battle &&
          resultSentMatch.current !== currentOnline.matchId
        ) {
          const finalSeq = coordinator.publishHostSnapshot(
            next.battle,
            performance.now(),
            true,
          );
          if (finalSeq !== null) lastHostSeq.current = finalSeq;
          coordinator.publishMatchEnd(
            next.result,
            lastHostSeq.current,
            next.battle.elapsed,
          );
          resultSentMatch.current = currentOnline.matchId;
        }
      }),
    [coordinator, runtime],
  );

  const powerActive =
    (mode === "local" && game.phase === "launch") ||
    (mode === "online" && online.phase === "matched");
  useEffect(() => {
    if (!powerActive) return;
    const timer = window.setInterval(() => {
      setLaunchPower((current) => {
        let next = current + powerDirection.current * 3.5;
        if (next >= 100) {
          next = 100;
          powerDirection.current = -1;
        } else if (next <= 10) {
          next = 10;
          powerDirection.current = 1;
        }
        return next;
      });
    }, 16);
    return () => window.clearInterval(timer);
  }, [powerActive]);

  useEffect(() => {
    if (
      mode !== "online" ||
      online.role !== "host" ||
      online.phase !== "countdown" ||
      !online.matchId ||
      !onlineConfig ||
      preparedMatch.current === online.matchId
    )
      return;
    runtime.dispatch({ type: "prepare", config: onlineConfig });
    preparedMatch.current = online.matchId;
  }, [mode, online.matchId, online.phase, online.role, onlineConfig, runtime]);

  useEffect(() => {
    if (
      mode !== "online" ||
      !["countdown", "battle", "ending"].includes(online.phase)
    )
      return;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      coordinator.update(now);
      const current = coordinator.state;
      if (
        current.role === "host" &&
        current.phase === "battle" &&
        current.matchId &&
        current.start &&
        runtime.state.phase === "launch" &&
        launchedMatch.current !== current.matchId
      ) {
        runtime.dispatch({
          type: "launch",
          launch: {
            p1Power: current.start.p1.power,
            p1Angle: current.start.p1.angle,
            p2Power: current.start.p2.power,
            // Network angles are local deviations; p2 launches inward from +x.
            p2Angle: 180 + current.start.p2.angle,
          },
        });
        launchedMatch.current = current.matchId;
      }
      if (
        current.role === "host" &&
        (current.phase === "battle" || current.phase === "ending") &&
        (runtime.state.phase === "battle" || runtime.state.phase === "ending")
      ) {
        runtime.dispatch({
          type: "tick",
          deltaSeconds: (now - previous) / 1000,
        });
      }
      previous = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [coordinator, mode, online.phase, runtime]);

  useEffect(() => {
    if (
      mode !== "local" ||
      (game.phase !== "battle" && game.phase !== "ending")
    )
      return;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      runtime.dispatch({ type: "tick", deltaSeconds: (now - previous) / 1000 });
      previous = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [game.phase, mode, runtime]);

  useEffect(() => {
    if (online.phase !== "countdown") return;
    setCountdownNow(performance.now());
    const timer = window.setInterval(
      () => setCountdownNow(performance.now()),
      100,
    );
    return () => window.clearInterval(timer);
  }, [online.phase]);

  useEffect(() => {
    if (mode === "online" && online.phase === "idle") {
      modeRef.current = "menu";
      setMode("menu");
    }
  }, [mode, online.phase]);

  useEffect(() => {
    const leaveActiveSession = (): void => {
      const current = coordinator.state;
      if (modeRef.current !== "online") return;
      const action = onlinePageExitAction(current.phase);
      if (!action) return;
      if (current.phase === "battle" || current.phase === "ending")
        recordOnlineOutcome("loss", current.matchId);
      if (action === "leave") coordinator.leave();
      else {
        coordinator.cancelQueue();
        coordinator.leave();
      }
      if (runtime.state.phase !== "menu") runtime.dispatch({ type: "leave" });
      modeRef.current = "menu";
      setMode("menu");
      synth.stop();
    };
    const onVisibilityChange = (): void => {
      if (
        document.visibilityState === "hidden" &&
        coordinator.state.role === "host" &&
        isActiveOnlineRoom(coordinator.state.phase)
      )
        leaveActiveSession();
    };
    window.addEventListener("pagehide", leaveActiveSession);
    window.addEventListener("beforeunload", leaveActiveSession);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", leaveActiveSession);
      window.removeEventListener("beforeunload", leaveActiveSession);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [coordinator, runtime]);

  const localBattleActive =
    mode === "local" &&
    (game.phase === "battle" ||
      game.phase === "ending" ||
      game.phase === "result");
  const onlineSnapshot =
    online.role === "host" ? game.battle : online.view.snapshot;
  const onlineBattleActive =
    mode === "online" && ["battle", "ending", "result"].includes(online.phase);
  const activeSnapshot = localBattleActive
    ? game.battle
    : onlineBattleActive
      ? onlineSnapshot
      : null;
  const activeEvents =
    mode === "online" && online.role === "guest"
      ? online.view.visualEvents
      : game.events;
  const activeEventsTick =
    mode === "online" && online.role === "guest"
      ? online.view.eventsTick
      : game.eventsTick;
  const lastAudioTick = useRef(0);
  const scraped = useRef({ p1: false, p2: false });
  useEffect(() => {
    if (activeEventsTick > lastAudioTick.current) {
      lastAudioTick.current = activeEventsTick;
      let maxCollisionIntensity = 0;
      let hasBurst = false;
      for (const event of activeEvents) {
        if (event.type === "collision") {
          maxCollisionIntensity = Math.max(
            maxCollisionIntensity,
            event.intensity,
          );
        }
        if (event.type === "burst") {
          hasBurst = true;
        }
      }
      if (maxCollisionIntensity > 0) {
        synth.collision(maxCollisionIntensity);
      }
      if (hasBurst) {
        synth.burst();
      }
    }
    if (activeSnapshot && (localBattleActive || onlineBattleActive)) {
      for (const id of ["p1", "p2"] as const) {
        const top = activeSnapshot[id];
        if (!top.isStopped && !top.isBurst) {
          synth.startSpin(id, top.rpm);
          synth.updateSpin(id, top.rpm);
        } else {
          if (top.isStopped && !top.isBurst && !scraped.current[id])
            synth.scrape();
          scraped.current[id] = true;
          synth.stopSpin(id);
        }
      }
    } else {
      synth.stop();
    }
  }, [
    activeEvents,
    activeEventsTick,
    activeSnapshot,
    localBattleActive,
    onlineBattleActive,
  ]);

  function resetMatchRefs(): void {
    powerDirection.current = 1;
    setLaunchPower(20);
    lastAudioTick.current = 0;
    scraped.current = { p1: false, p2: false };
    preparedMatch.current = null;
    launchedMatch.current = null;
    endingSentMatch.current = null;
    resultSentMatch.current = null;
    lastHostSeq.current = 0;
    lastRelayedEventsTick.current = 0;
  }

  function prepareLocal(): void {
    synth.click();
    resetMatchRefs();
    modeRef.current = "local";
    setMode("local");
    setScene(pickRandomEnvironmentScene());
    const types = Object.keys(BEYBLADES) as BeybladeType[];
    const randomAiType = types[Math.floor(Math.random() * types.length)]!;
    const seed = Math.floor(Math.random() * 0x1_0000_0000);
    runtime.dispatch({
      type: "prepare",
      config: {
        p1Type: playerType,
        p2Type: randomAiType,
        stadiumTheme: "neon",
        stadiumVariant: stadiumVariantFromSeed(seed),
        seed,
        perfectLaunchTopIds: [LOCAL_TOP_ID],
        p1BladeId: selectedBladeId,
        ...(customColor !== null ? { p1Color: customColor } : {}),
      },
    });
  }

  function launchLocal(): void {
    if (mode !== "local" || game.phase !== "launch") return;
    synth.click();
    const offset = () =>
      (Math.random() > 0.5 ? 1 : -1) * (15 + Math.random() * 15);
    runtime.dispatch({
      type: "launch",
      launch: {
        p1Power: launchPower,
        p1Angle: offset(),
        p2Power: 60 + Math.random() * 30,
        p2Angle: 180 + offset(),
      },
    });
  }

  function startOnline(): void {
    synth.click();
    resetMatchRefs();
    modeRef.current = "online";
    setMode("online");
    coordinator.connect(resolveWebSocketUrl());
  }

  function readyOnline(): void {
    if (online.phase !== "matched") return;
    synth.click();
    coordinator.ready({
      blade: playerType,
      name: customName.trim() || BEYBLADES[playerType].name,
      wins: record.wins,
      losses: record.losses,
      power: launchPower,
      angle: Math.random() * 60 - 30,
      stadium: "neon",
      ...(customColor !== null ? { color: customColor } : {}),
      bladeId: currentConfig.bladeId,
      ratchetId: currentConfig.ratchetId,
      bitId: currentConfig.bitId,
      chipId: currentConfig.chipId,
    });
  }

  function cancelQueue(): void {
    synth.click();
    coordinator.cancelQueue();
  }

  function returnToMenu(): void {
    synth.click();
    if (modeRef.current === "online") {
      const current = coordinator.state;
      if (current.phase === "battle" || current.phase === "ending")
        recordOnlineOutcome("loss", current.matchId);
      coordinator.leave();
    }
    if (runtime.state.phase !== "menu") runtime.dispatch({ type: "leave" });
    modeRef.current = "menu";
    setMode("menu");
    synth.stop();
  }

  const onlinePhase = online.phase;
  const localTopId = online.localTopId ?? LOCAL_TOP_ID;
  const localName = customName.trim() || BEYBLADES[playerType].name;
  const onlineNames = online.start
    ? {
      p1: online.start.p1.name ?? BEYBLADES[online.start.p1.blade].name,
      p2: online.start.p2.name ?? BEYBLADES[online.start.p2.blade].name,
    }
    : null;
  const onlineLocalName = onlineNames?.[localTopId] || localName;
  const onlineOpponentName = onlineNames?.[opponentTopId(localTopId)] || "對手";
  const onlineRecords = online.start
    ? {
      p1: {
        wins: online.start.p1.wins ?? 0,
        losses: online.start.p1.losses ?? 0,
      },
      p2: {
        wins: online.start.p2.wins ?? 0,
        losses: online.start.p2.losses ?? 0,
      },
    }
    : null;
  const onlineLocalRecord = onlineRecords?.[localTopId] ?? null;
  const onlineOpponentRecord =
    onlineRecords?.[opponentTopId(localTopId)] ?? null;
  const onlineResult = online.view.result;
  const countdownReference =
    onlinePhase === "countdown"
      ? Math.max(countdownNow, performance.now())
      : countdownNow;
  const countdown = Math.max(
    0,
    Math.ceil(
      ((online.countdownEndsAt ?? countdownReference) - countdownReference) /
      1000,
    ),
  );
  const sceneConfig = mode === "online" ? onlineConfig : game.config;
  const sceneSnapshot = mode === "online" ? onlineSnapshot : game.battle;
  const scenePhase: MatchPhase =
    mode === "online"
      ? onlinePhase === "countdown"
        ? "launch"
        : onlinePhase === "result"
          ? "result"
          : onlinePhase === "ending"
            ? "ending"
            : "battle"
      : game.phase;
  const showScene =
    sceneConfig !== null &&
    ((mode === "local" && game.phase !== "menu") ||
      (mode === "online" &&
        ["countdown", "battle", "ending", "result"].includes(onlinePhase)));

  return (
    <main
      className={`app mode-${mode} phase-${mode === "online" ? onlinePhase : game.phase
        }`}
    >
      {showIntro && <IntroScreen onComplete={() => setShowIntro(false)} />}
      {showScene && sceneConfig && (
        <BattleScene
          config={sceneConfig}
          phase={scenePhase}
          snapshot={sceneSnapshot}
          events={activeEvents}
          eventsTick={activeEventsTick}
          localTopId={mode === "online" ? localTopId : LOCAL_TOP_ID}
          scene={activeScene}
        />
      )}
      {mode === "online" &&
        online.role === "guest" &&
        (onlinePhase === "battle" || onlinePhase === "ending") &&
        online.view.connectionUnstable && (
          <div className="connection-warning" role="status">
            連線不穩 · 畫面已暫停同步
          </div>
        )}

      {mode === "menu" && game.phase === "menu" && (
        <MainMenu
          playerType={playerType}
          onBlade={handleBladeChange}
          customName={customName}
          onCustomNameChange={setCustomName}
          customColor={customColor}
          onCustomColorChange={setCustomColor}
          record={record}
          onLocal={prepareLocal}
          onOnline={startOnline}
          onUpcomingClick={() => setUpcomingModalOpen(true)}
          customSpec={customSpec}
          selectedBladeId={selectedBladeId}
          onBladeIdChange={(bladeId) =>
            handleCustomConfigChange({ ...currentConfig, bladeId })
          }
          onOpenCustomizer={() => setIsCustomizerOpen(true)}
        />
      )}

      <PartCustomizerModal
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
        beybladeType={playerType}
        config={currentConfig}
        onChangeConfig={handleCustomConfigChange}
      />

      {mode === "local" && game.phase === "launch" && (
        <LaunchScreen power={launchPower} onLaunch={launchLocal} />
      )}

      {mode === "online" &&
        (onlinePhase === "connecting" || onlinePhase === "queued") && (
          <OnlineOverlay
            eyebrow={
              onlinePhase === "connecting" ? "CONNECTING" : "MATCHMAKING"
            }
            title={
              onlinePhase === "connecting" ? "正在連線至競技場" : "正在尋找對手"
            }
            detail="找到對手前會持續等待。"
            busy
          >
            <button onClick={cancelQueue}>取消配對</button>
          </OnlineOverlay>
        )}

      {mode === "online" &&
        (onlinePhase === "matched" || onlinePhase === "waiting_ready") && (
          <OnlineSelection
            online={online}
            power={launchPower}
            onReady={readyOnline}
            onLeave={returnToMenu}
          />
        )}

      {mode === "online" && onlinePhase === "countdown" && onlineConfig && (
        <OnlineOverlay
          eyebrow="READY TO LAUNCH"
          title="3, 2, 1, GO SHOOT!"
          detail={`對手: ${withRecordLabel(onlineOpponentName, onlineOpponentRecord)}`}
          countdown
          countdownVal={countdown > 0 ? String(countdown) : "GO SHOOT!"}
        />
      )}

      {mode === "local" && game.phase === "battle" && game.battle && (
        <BattleHud
          snapshot={game.battle}
          localTopId={LOCAL_TOP_ID}
          localLabel={localName}
          opponentLabel="AI"
          onExit={returnToMenu}
        />
      )}

      {mode === "online" &&
        (onlinePhase === "battle" || onlinePhase === "ending") &&
        onlineSnapshot && (
          <BattleHud
            snapshot={onlineSnapshot}
            localTopId={localTopId}
            localLabel={withRecordLabel(onlineLocalName, onlineLocalRecord)}
            opponentLabel={withRecordLabel(
              onlineOpponentName,
              onlineOpponentRecord,
            )}
            onExit={returnToMenu}
          />
        )}

      {mode === "local" && game.phase === "result" && game.result && (
        <ResultScreen
          result={game.result}
          battle={game.battle}
          localTopId={LOCAL_TOP_ID}
          online={false}
          playerNames={{
            p1: customName.trim() || BEYBLADES[playerType].name,
            p2: BEYBLADES[game.config.p2Type].name,
          }}
          record={record}
          playerColor={customColor}
          onRematch={prepareLocal}
          onMenu={returnToMenu}
        />
      )}

      {mode === "online" && onlinePhase === "result" && onlineResult && (
        <ResultScreen
          result={onlineResult}
          battle={onlineSnapshot}
          localTopId={localTopId}
          online
          {...(onlineNames ? { playerNames: onlineNames } : {})}
          record={record}
          playerColor={
            localTopId === "p1"
              ? online.start?.p1.color
              : online.start?.p2.color
          }
          onMenu={returnToMenu}
        />
      )}

      {mode === "online" &&
        (onlinePhase === "error" ||
          (onlinePhase === "result" && !onlineResult)) && (
          <OnlineOverlay
            eyebrow="ONLINE MATCH"
            {...terminationCopy(online.termination, online.error)}
          >
            <button className="primary" onClick={returnToMenu}>
              返回主選單
            </button>
          </OnlineOverlay>
        )}

      {upcomingModalOpen && (
        <UpcomingModal onClose={() => setUpcomingModalOpen(false)} />
      )}
    </main>
  );
}

function getPlayerTitle(wins: number): string {
  if (wins >= 50) return "👑 陀螺大師";
  if (wins >= 25) return "🌟 榮耀精英";
  if (wins >= 10) return "🔥 競技高手";
  if (wins >= 3) return "⚡ 陀螺戰士";
  return "🎯 陀螺新手";
}

function MainMenu({
  playerType,
  onBlade,
  customName,
  onCustomNameChange,
  customColor,
  onCustomColorChange,
  record,
  onLocal,
  onOnline,
  onUpcomingClick,
  customSpec,
  selectedBladeId,
  onBladeIdChange,
  onOpenCustomizer,
}: {
  playerType: BeybladeType;
  onBlade: (type: BeybladeType) => void;
  customName: string;
  onCustomNameChange: (name: string) => void;
  customColor: number | null;
  onCustomColorChange: (color: number | null) => void;
  record: BattleRecord;
  onLocal: () => void;
  onOnline: () => void;
  onUpcomingClick?: () => void;
  customSpec?: BeybladeSpec | undefined;
  selectedBladeId: string;
  onBladeIdChange: (id: string) => void;
  onOpenCustomizer?: () => void;
}) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isExploded, setIsExploded] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>("default");

  const presetKeys: CameraPreset[] = ["default", "top", "side", "bottom"];
  const handleCycleCameraPreset = () => {
    synth.click();
    const currentIndex = presetKeys.indexOf(cameraPreset);
    const nextPreset = presetKeys[(currentIndex + 1) % presetKeys.length] ?? "default";
    setCameraPreset(nextPreset);
  };

  const [activeModal, setActiveModal] = useState<"terms" | "privacy" | null>(
    null,
  );
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isMuted, setIsMuted] = useState(() => synth.isMuted);
  const [isBGMMuted, setIsBGMMuted] = useState(() => synth.isBGMMuted);

  const totalMatches = record.wins + record.losses;
  const winRate = totalMatches > 0 ? (record.wins / totalMatches) * 100 : 0;

  return (
    <section className="screen menu-screen">
      {/* 背景音樂獨立按鈕 */}
      <button
        className="bgm-trigger"
        onClick={() => {
          const nextBGMMuted = !isBGMMuted;
          synth.setBGMMuted(nextBGMMuted);
          setIsBGMMuted(nextBGMMuted);
          if (!nextBGMMuted) {
            synth.click();
          }
        }}
        aria-label={isBGMMuted ? "開啟背景音樂" : "靜音背景音樂"}
      >
        {isBGMMuted ? "🔇" : "🎵"}
      </button>

      {/* 選單按鈕 */}
      <button
        className="menu-trigger"
        onClick={() => {
          synth.click();
          setIsDrawerOpen(true);
        }}
        aria-label="開啟選單"
      >
        ☰
      </button>

      <Logo />
      {(record.wins > 0 || record.losses > 0) && (
        <p className="player-record">線上戰績 {formatBattleRecord(record)}</p>
      )}
      <BladePicker
        value={playerType}
        onChange={onBlade}
        customName={customName}
        onCustomNameChange={onCustomNameChange}
        customColor={customColor}
        onCustomColorChange={onCustomColorChange}
        onUpcomingClick={onUpcomingClick}
      />
      <div className="garage-preview-stage">
        <div className="preview-controls-bar">
          {onOpenCustomizer && (
            <button
              className="preview-control-btn customizer-btn"
              onClick={() => {
                synth.click();
                onOpenCustomizer();
              }}
              title="開啟零件改裝工坊"
              aria-label="開啟零件改裝工坊"
            >
              <GarageIcon size={18} />
            </button>
          )}
          <button
            className="preview-control-btn camera-cycle-btn"
            onClick={handleCycleCameraPreset}
            title={`切換視角 (目前：${CAMERA_PRESETS[cameraPreset].label})`}
            aria-label={`切換視角 (目前：${CAMERA_PRESETS[cameraPreset].label})`}
          >
            {CAMERA_PRESETS[cameraPreset].icon}
          </button>
          <button
            className={`preview-control-btn exploded-toggle-btn ${isExploded ? "active" : ""}`}
            onClick={() => {
              synth.click();
              setIsExploded(!isExploded);
            }}
            title={isExploded ? "切換組裝檢視" : "切換 4 零件拆解視圖"}
            aria-label={isExploded ? "切換組裝檢視" : "切換 4 零件拆解視圖"}
          >
            <ExplodedLayersIcon />
          </button>
        </div>
        <BladePreviewScene
          type={playerType}
          color={customColor}
          exploded={isExploded}
          preset={cameraPreset}
          customSpec={customSpec}
        />
      </div>
      <BladeDetails value={playerType} customSpec={customSpec} />
      <div className="mode-actions">
        <button className="primary start" onClick={onOnline}>
          線上對戰
        </button>
        <button className="secondary start" onClick={onLocal}>
          單機 VS AI
        </button>
      </div>
      <p className="credits">抓準時機發射，20 秒定勝負</p>

      {/* 側邊收合選單 (Drawer) */}
      {isDrawerOpen && (
        <div
          className="menu-drawer-backdrop"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}
      <div className={`menu-drawer ${isDrawerOpen ? "open" : ""}`}>
        <div className="menu-drawer-header">
          <h3>遊戲選單</h3>
          <button
            className="menu-drawer-close"
            onClick={() => {
              synth.click();
              setIsDrawerOpen(false);
            }}
          >
            ✕
          </button>
        </div>
        <div className="menu-drawer-content">
          {/* 個人戰績卡片 */}
          <div className="menu-stats-card">
            <div className="stats-card-header">
              <div
                className="player-avatar"
                style={{
                  backgroundColor: customColor
                    ? `#${customColor.toString(16).padStart(6, "0")}`
                    : "#009bd6",
                }}
              >
                {customName ? customName.slice(0, 1).toUpperCase() : "B"}
              </div>
              <div className="player-info">
                <div className="player-name">{customName || "未知戰士"}</div>
                <div className="player-title">
                  {getPlayerTitle(record.wins)}
                </div>
              </div>
            </div>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">總場次</span>
                <span className="stat-value">{totalMatches}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">勝場</span>
                <span className="stat-value text-win">{record.wins}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">敗場</span>
                <span className="stat-value text-loss">{record.losses}</span>
              </div>
            </div>
            <div className="win-rate-container">
              <div className="win-rate-header">
                <span>勝率</span>
                <span className="win-rate-value">{winRate.toFixed(1)}%</span>
              </div>
              <div className="win-rate-bar-bg">
                <div
                  className="win-rate-bar-fill"
                  style={{ width: `${winRate}%` }}
                ></div>
              </div>
            </div>
          </div>

          <button
            className="menu-drawer-item"
            onClick={() => {
              synth.click();
              setActiveModal("terms");
            }}
          >
            服務條款
          </button>
          <button
            className="menu-drawer-item"
            onClick={() => {
              synth.click();
              setActiveModal("privacy");
            }}
          >
            隱私權政策
          </button>
          <button
            className="menu-drawer-item"
            onClick={() => {
              const nextMuted = !isMuted;
              synth.setMuted(nextMuted);
              setIsMuted(nextMuted);
              if (!nextMuted) {
                synth.click();
              }
            }}
          >
            {isMuted ? "🔇 啟用音效" : "🔊 靜音音效"}
          </button>
          <button
            className="menu-drawer-item"
            onClick={() => {
              const nextBGMMuted = !isBGMMuted;
              synth.setBGMMuted(nextBGMMuted);
              setIsBGMMuted(nextBGMMuted);
              if (!nextBGMMuted) {
                synth.click();
              }
            }}
          >
            {isBGMMuted ? "🎵 啟用背景音樂" : "🎶 靜音背景音樂"}
          </button>
          <button
            className="menu-drawer-item"
            onClick={() => {
              synth.click();
              setShowResetConfirm(true);
            }}
          >
            重設資料 (清除)
          </button>
        </div>
        <div className="menu-drawer-footer">
          <p>© 2026 Game Pool. All rights reserved.</p>
        </div>
      </div>

      {/* 條款與政策 Modal */}
      {activeModal && (
        <div className="legal-modal">
          <div
            className="legal-modal-backdrop"
            onClick={() => setActiveModal(null)}
          />
          <div className="legal-card">
            <p className="eyebrow">
              {activeModal === "terms" ? "TERMS OF SERVICE" : "PRIVACY POLICY"}
            </p>
            <h2>{activeModal === "terms" ? "服務條款" : "隱私權政策"}</h2>
            <div className="legal-content">
              {activeModal === "terms" ? (
                <div className="legal-text">
                  <h3>1. 服務接受</h3>
                  <p>
                    當您存取或使用本遊戲時，即代表您同意接受並遵守本服務條款。若您不同意，請勿使用本服務。
                  </p>
                  <h3>2. 使用權限與授權</h3>
                  <p>
                    本遊戲僅供個人、非商業目的娛樂使用。您不得對本遊戲進行逆向工程、反編譯、修改或散佈任何遊戲內容與代碼。
                  </p>
                  <h3>3. 線上對戰與行為準則</h3>
                  <p>
                    本服務提供線上即時配對功能。您同意不會利用任何外掛程式、自動化指令碼或漏洞來干擾遊戲公平性。如有惡意斷線或作弊之行為，我們保留中止您存取線上服務之權利。
                  </p>
                  <h3>4. 著作權聲明</h3>
                  <p>
                    本遊戲內的所有美術資產、音樂、3D
                    模型、物理模擬引擎及代碼，均屬 Game Pool
                    智慧財產權所有，受相關著作權法保護。
                  </p>
                  <h3>5. 免責聲明</h3>
                  <p>
                    本服務按「現狀」提供，不附帶任何形式的保證。我們不保證服務不會中斷、無延遲或無漏洞。
                  </p>
                  <h3>6. 條款修訂</h3>
                  <p>
                    我們保留隨時修改本服務條款的權利，修訂後之條款於公布時立即生效。
                  </p>
                </div>
              ) : (
                <div className="legal-text">
                  <h3>1. 資訊收集與使用</h3>
                  <p>
                    <strong>本地儲存 (Local Storage)：</strong>
                    我們會在您的瀏覽器中以 Local Storage
                    記錄您的自訂陀螺名稱、戰績 (勝/敗場數) 以及遊戲設定
                    (如場景主題)。這些資料保留在您的本地設備中，您隨時可以透過瀏覽器清除資料。
                  </p>
                  <p>
                    <strong>連線資料：</strong>
                    在您使用線上對戰時，我們只會傳輸進行即時同步所需的臨時資料（如您的自訂名稱、勝敗統計、陀螺屬性與操作數據）。我們不會收集或儲存您的身分證號、真實姓名、電話號碼等敏感個人資料。
                  </p>
                  <p>
                    <strong>伺服器記錄：</strong>
                    為了改善服務品質與維護網路安全，我們的伺服器可能會自動記錄您連線時的
                    IP 位址與存取時間。
                  </p>
                  <h3>2. 資訊分享</h3>
                  <p>我們不會將您的資料販售、交換或租借給任何第三方。</p>
                  <h3>3. 資料安全</h3>
                  <p>
                    我們採用標準的安全加密傳輸協議，以確保線上配對與數據同步之安全性，但請注意，網際網路傳輸無法保證百分之百安全。
                  </p>
                  <h3>4. 聯絡我們</h3>
                  <p>
                    若您對本隱私權政策有任何疑問，歡迎透過 Game Pool
                    官方平台與我們聯繫。
                  </p>
                </div>
              )}
            </div>
            <div className="legal-actions">
              <button
                className="primary"
                onClick={() => {
                  synth.click();
                  setActiveModal(null);
                }}
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div className="legal-modal">
          <div
            className="legal-modal-backdrop"
            onClick={() => setShowResetConfirm(false)}
          />
          <div className="legal-card">
            <p className="eyebrow">RESET GAME DATA</p>
            <h2>重設遊戲資料</h2>
            <div className="legal-content">
              <div className="legal-text">
                <p>您確定要清除所有的本地遊戲資料嗎？此操作將會：</p>
                <ul
                  style={{
                    paddingLeft: "20px",
                    color: "#555b70",
                    fontSize: "0.92rem",
                    lineHeight: "1.6",
                    marginBlock: "10px",
                  }}
                >
                  <li>清除您的自訂陀螺名稱。</li>
                  <li>清空您的線上對戰勝場與敗場戰績。</li>
                  <li>還原您的所有背景與主題設定。</li>
                </ul>
                <p
                  style={{
                    color: "#e53935",
                    fontWeight: "bold",
                    marginTop: "12px",
                  }}
                >
                  注意：此動作將無法復原！
                </p>
              </div>
            </div>
            <div className="legal-actions" style={{ gap: "12px" }}>
              <button
                className="btn-cancel"
                onClick={() => {
                  synth.click();
                  setShowResetConfirm(false);
                }}
              >
                取消
              </button>
              <button
                className="btn-danger"
                onClick={() => {
                  synth.click();
                  window.localStorage.clear();
                  window.location.reload();
                }}
              >
                確定重設
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Logo() {
  return (
    <header className="logo">
      <p className="eyebrow">GAME POOL PRESENTS</p>
      <h1>CYBERBLADE 3D</h1>
      <p>極限爆裂對決</p>
    </header>
  );
}

function BladePicker({
  value,
  onChange,
  customName,
  onCustomNameChange,
  customColor,
  onCustomColorChange,
  onUpcomingClick,
  disabled = false,
}: {
  value: BeybladeType;
  onChange: (type: BeybladeType) => void;
  customName?: string;
  onCustomNameChange?: (name: string) => void;
  customColor?: number | null;
  onCustomColorChange?: (color: number | null) => void;
  onUpcomingClick?: (() => void) | undefined;
  disabled?: boolean;
}) {
  const selected = BEYBLADES[value];
  const keys = Object.keys(BEYBLADES) as BeybladeType[];
  const listItems = [...keys, "upcoming" as const];
  const currentIndex = keys.indexOf(value);

  const dragStartX = useRef<number | null>(null);

  const handlePrev = () => {
    synth.click();
    const prevIndex = (currentIndex - 1 + keys.length) % keys.length;
    onChange(keys[prevIndex]!);
  };

  const handleNext = () => {
    synth.click();
    const nextIndex = (currentIndex + 1) % keys.length;
    onChange(keys[nextIndex]!);
  };

  const handleDragStart = (clientX: number) => {
    dragStartX.current = clientX;
  };

  const handleDragEnd = (clientX: number) => {
    if (dragStartX.current === null) return;
    const deltaX = clientX - dragStartX.current;
    if (deltaX > 50) {
      handlePrev();
    } else if (deltaX < -50) {
      handleNext();
    }
    dragStartX.current = null;
  };

  return (
    <section className="garage-picker">
      <div className="garage-heading">
        <div>
          <p className="eyebrow">SELECT YOUR BLADE</p>
          <h2>選擇戰鬥陀螺</h2>
        </div>
        <span className="garage-counter">
          {currentIndex + 1} / {String(listItems.length).padStart(2, "0")}
        </span>
      </div>

      <div className="blade-carousel-container">
        <button
          className="carousel-arrow prev"
          onClick={handlePrev}
          disabled={disabled}
          aria-label="上一個陀螺"
        >
          ◀
        </button>

        <div
          className="blade-carousel-view"
          onTouchStart={(e) => handleDragStart(e.touches[0]?.clientX ?? 0)}
          onTouchEnd={(e) => handleDragEnd(e.changedTouches[0]?.clientX ?? 0)}
          onMouseDown={(e) => handleDragStart(e.clientX)}
          onMouseUp={(e) => handleDragEnd(e.clientX)}
          onMouseLeave={() => {
            dragStartX.current = null;
          }}
          style={{ cursor: "grab" }}
        >
          <div
            className="blade-carousel-track"
            style={
              {
                "--active-index": currentIndex,
                "--card-width": "220px",
                "--card-gap": "16px",
              } as React.CSSProperties
            }
            role="listbox"
            aria-label="選擇戰鬥陀螺"
          >
            {listItems.map((type) => {
              if (type === "upcoming") {
                return (
                  <button
                    key="upcoming"
                    disabled={disabled}
                    className="blade-card upcoming"
                    onClick={() => {
                      synth.click();
                      onUpcomingClick?.();
                    }}
                    role="option"
                    aria-selected={false}
                  >
                    <span className="blade-type">???</span>
                    <span className="blade-mini-preview upcoming">
                      <i className="shadow" />
                    </span>
                    <strong>敬請期待</strong>
                    <small>COMING SOON</small>
                  </button>
                );
              }
              const blade = BEYBLADES[type];
              const bladeColor = `#${blade.color.toString(16).padStart(6, "0")}`;
              return (
                <button
                  key={type}
                  disabled={disabled}
                  className={`blade-card ${value === type ? "active" : ""}`}
                  style={
                    {
                      "--blade-color": bladeColor,
                      "--blade-text-color":
                        type === "stamina"
                          ? "#c49000"
                          : type === "balance"
                            ? "#558b2f"
                            : type === "aegis"
                              ? "#3a4a6b"
                              : bladeColor,
                    } as React.CSSProperties
                  }
                  onClick={() => {
                    synth.click();
                    onChange(type);
                  }}
                  role="option"
                  aria-selected={value === type}
                >
                  <span className="blade-type">{type.toUpperCase()}</span>
                  <span
                    className="blade-mini-preview"
                    style={
                      { "--blade-color": bladeColor } as React.CSSProperties
                    }
                  >
                    <BladeMiniIcon type={type} />
                  </span>
                  <strong>{blade.name}</strong>
                  <small>{blade.englishName}</small>
                </button>
              );
            })}
          </div>
        </div>

        <button
          className="carousel-arrow next"
          onClick={handleNext}
          disabled={disabled}
          aria-label="下一個陀螺"
        >
          ▶
        </button>
      </div>

      {customName !== undefined && onCustomNameChange && (
        <label className="garage-name-field" htmlFor="custom-top-name">
          <span>自訂名稱</span>
          <input
            id="custom-top-name"
            type="text"
            placeholder={selected.name}
            value={customName}
            onChange={(event) => onCustomNameChange(event.target.value)}
            maxLength={10}
          />
        </label>
      )}
      {customColor !== undefined && onCustomColorChange && (() => {
        const baseColor = BEYBLADES[value].color;
        const darkColor = darkenColor(baseColor);
        const options: { key: string; label: string; color: number | null; display: string }[] = [
          {
            key: "original",
            label: "原色",
            color: null,
            display: `#${baseColor.toString(16).padStart(6, "0")}`,
          },
          {
            key: "dark",
            label: "暗色",
            color: darkColor,
            display: `#${darkColor.toString(16).padStart(6, "0")}`,
          },
        ];
        return (
          <div className="garage-color-field">
            <span>陀螺配色</span>
            <div
              className="color-palette"
              role="radiogroup"
              aria-label="選擇陀螺配色"
            >
              {options.map((opt) => {
                const isActive =
                  opt.color === null
                    ? customColor === null
                    : customColor === opt.color;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    className={`color-swatch ${isActive ? "active" : ""}`}
                    style={{ backgroundColor: opt.display }}
                    onClick={() => {
                      synth.click();
                      onCustomColorChange(opt.color);
                    }}
                    disabled={disabled}
                    aria-label={`選擇${opt.label}`}
                    aria-pressed={isActive}
                    title={opt.label}
                  />
                );
              })}
            </div>
          </div>
        );
      })()}
    </section>
  );
}

function BladeDetails({
  value,
  customSpec,
}: {
  value: BeybladeType;
  customSpec?: BeybladeSpec | undefined;
}) {
  const selected = customSpec ?? BEYBLADES[value];
  const color = `#${selected.color.toString(16).padStart(6, "0")}`;
  const stats = beybladeDisplayStats(value, customSpec);

  return (
    <article
      className="blade-detail standalone-blade-detail"
      style={{ "--blade-color": color } as React.CSSProperties}
    >
      <div className="blade-detail-copy">
        <p className="eyebrow">{selected.englishName}</p>
        <h3>{selected.name}</h3>
        <p>{descriptions[value]}</p>
      </div>
      <div className="stat-grid">
        {stats.map((stat) => (
          <div className="stat-item" key={stat.key}>
            <div className="stat-label">
              <span>{stat.label}</span>
              <strong>{stat.displayValue}</strong>
            </div>
            <span className="stat-track">
              <i style={{ width: `${stat.ratio * 100}%` }} />
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}

function OnlineSelection({
  online,
  power,
  onReady,
  onLeave,
}: {
  online: OnlineMatchState;
  power: number;
  onReady: () => void;
  onLeave: () => void;
}) {
  const locked = online.phase === "waiting_ready";
  return (
    <section className="screen menu-screen online-selection">
      <header className="online-heading">
        <p className="eyebrow">OPPONENT FOUND</p>
        <h1>準備戰鬥</h1>
        <p>
          {locked
            ? online.opponentReady
              ? "雙方已準備，等待伺服器開始"
              : "你的發射資料已鎖定，等待對手"
            : online.opponentReady
              ? "對手已準備，輪到你了"
              : "鎖定發射力道"}
        </p>
      </header>
      <div className="online-ready-panel">
        <PowerMeter power={power} />
        <div className="online-ready-copy">
          <span>{online.opponentReady ? "對手 READY" : "等待對手 READY"}</span>
          <strong>{Math.round(power)}%</strong>
        </div>
        <div className="online-ready-actions">
          <button disabled={locked} className="primary" onClick={onReady}>
            {locked ? "已鎖定發射" : "鎖定發射並準備"}
          </button>
          <button onClick={onLeave}>離開房間</button>
        </div>
      </div>
    </section>
  );
}

function LaunchScreen({
  power,
  onLaunch,
}: {
  power: number;
  onLaunch: () => void;
}) {
  return (
    <button className="screen launch-screen" onClick={onLaunch}>
      <div>
        <p className="eyebrow">READY TO LAUNCH</p>
        <h2>3, 2, 1, GO SHOOT!</h2>
        <p>抓準時機，點擊螢幕任一處發射</p>
      </div>
      <div className="power-panel">
        <div className="power-copy">
          <span>LAUNCH POWER</span>
          <strong>{Math.round(power)}%</strong>
        </div>
        <PowerMeter power={power} />
        <small>85–95% 完美發射可獲得額外轉速</small>
      </div>
    </button>
  );
}

function PowerMeter({ power }: { power: number }) {
  return (
    <div className="power-track">
      <span className="perfect-zone" />
      <span className="power-fill" style={{ width: `${power}%` }} />
    </div>
  );
}

function OnlineOverlay({
  eyebrow,
  title,
  detail,
  busy = false,
  countdown = false,
  countdownVal,
  children,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  busy?: boolean;
  countdown?: boolean;
  countdownVal?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="screen online-overlay">
      <div className={`online-card ${countdown ? "countdown-card" : ""}`}>
        <p className="eyebrow">{eyebrow}</p>
        {busy && <span className="matchmaking-spinner" />}
        <h2>{title}</h2>
        {countdownVal && (
          <div key={countdownVal} className="countdown-number">
            {countdownVal}
          </div>
        )}
        <p>{detail}</p>
        {children && <div className="online-overlay-actions">{children}</div>}
      </div>
    </section>
  );
}

function BattleHud({
  snapshot,
  localTopId,
  localLabel,
  opponentLabel,
  onExit,
}: {
  snapshot: BattleSnapshot;
  localTopId: TopId;
  localLabel: string;
  opponentLabel: string;
  onExit: () => void;
}) {
  const remaining = Math.max(0, Math.ceil(20 - snapshot.elapsed));
  const opponentId = opponentTopId(localTopId);
  return (
    <section className="hud">
      <div className="hud-top">
        <strong className={remaining <= 5 ? "critical" : ""}>
          {remaining}
        </strong>
        <button onClick={onExit}>退出戰鬥</button>
      </div>
      <div className="hud-bottom">
        <TopHud top={snapshot[localTopId]} label={localLabel} />
        <span className="versus">VS</span>
        <TopHud top={snapshot[opponentId]} label={opponentLabel} reverse />
      </div>
    </section>
  );
}

function TopHud({
  top,
  label,
  reverse = false,
}: {
  top: TopSnapshot;
  label: string;
  reverse?: boolean;
}) {
  const spec = BEYBLADES[top.type];
  return (
    <article className={`top-hud ${reverse ? "reverse" : ""}`}>
      <div className="hud-name">
        <strong>
          {label} · {spec.name}
        </strong>
        <span>{top.type.toUpperCase()}</span>
      </div>
      <Meter label={`${Math.round(top.rpm)} RPM`} value={top.rpm / 6000} />
      <Meter
        label={top.isBurst ? "BURST!" : `穩定度 ${Math.round(top.stability)}`}
        value={top.stability / spec.maxStability}
        stability
      />
    </article>
  );
}

function ResultScreen({
  result,
  battle,
  localTopId,
  online,
  playerNames,
  record,
  playerColor,
  onRematch,
  onMenu,
}: {
  result: MatchResult;
  battle: BattleSnapshot | null;
  localTopId: TopId;
  online: boolean;
  playerNames?: Partial<Record<TopId, string>>;
  record?: BattleRecord;
  playerColor?: number | null | undefined;
  onRematch?: () => void;
  onMenu: () => void;
}) {
  const outcome = localMatchOutcome(result.winnerId, localTopId);
  const [shareOpen, setShareOpen] = useState(false);
  return (
    <section className="screen result-screen">
      <div className="result-card">
        <p className="eyebrow">MATCH COMPLETE</p>
        <h2
          className={
            outcome === "victory" ? "win" : outcome === "defeat" ? "lose" : ""
          }
        >
          {outcome === "victory"
            ? "VICTORY"
            : outcome === "defeat"
              ? "DEFEAT"
              : "DRAW MATCH"}
        </h2>
        <span
          className={`finish-badge ${result.finishType.toLowerCase().replace(" ", "-")}`}
        >
          {result.finishType}
        </span>
        <dl>
          <div>
            <dt>獲勝陀螺</dt>
            <dd>
              {formatWinnerName(
                result.winnerId,
                battle,
                localTopId,
                online,
                playerNames,
              )}
            </dd>
          </div>
          {result.winnerId !== "draw" && (
            <div>
              <dt>戰敗陀螺</dt>
              <dd>
                {formatTopPlayerName(
                  opponentTopId(result.winnerId),
                  battle,
                  localTopId,
                  online,
                  playerNames,
                )}
              </dd>
            </div>
          )}
          <div>
            <dt>戰鬥時間</dt>
            <dd>{result.duration.toFixed(1)} 秒</dd>
          </div>
          <div>
            <dt>剩餘轉速</dt>
            <dd>{result.finalRpm} RPM</dd>
          </div>
          {record && (
            <div>
              <dt>我的戰績</dt>
              <dd>{formatBattleRecord(record)}</dd>
            </div>
          )}
        </dl>
        <div className="result-actions">
          {outcome === "victory" && battle && (
            <button className="primary" onClick={() => setShareOpen(true)}>
              分享戰績
            </button>
          )}
          {!online && onRematch && (
            <button className="primary" onClick={onRematch}>
              再戰一局
            </button>
          )}
          <button className={online ? "primary" : ""} onClick={onMenu}>
            返回主選單
          </button>
        </div>
      </div>
      {shareOpen && battle && (
        <ShareCardModal
          data={buildShareCardData({
            battle,
            localTopId,
            playerNames,
            record,
            finishType: result.finishType,
            playerColor,
          })}
          onClose={() => setShareOpen(false)}
        />
      )}
    </section>
  );
}

function withRecordLabel(name: string, record: BattleRecord | null): string {
  return record ? `${name} (${formatBattleRecord(record)})` : name;
}

export function formatWinnerName(
  winnerId: WinnerId,
  battle: BattleSnapshot | null,
  localTopId: TopId,
  online = false,
  playerNames?: Partial<Record<TopId, string>>,
): string {
  if (winnerId === "draw") return "平手 (DRAW)";
  return formatTopPlayerName(winnerId, battle, localTopId, online, playerNames);
}

export function formatTopPlayerName(
  topId: TopId,
  battle: BattleSnapshot | null,
  localTopId: TopId,
  online = false,
  playerNames?: Partial<Record<TopId, string>>,
): string {
  const role =
    topId === localTopId ? (online ? "你" : "玩家") : online ? "對手" : "AI";
  const name =
    playerNames?.[topId] ||
    (battle?.[topId] ? BEYBLADES[battle[topId].type].name : null) ||
    topId.toUpperCase();
  return `${name} (${role})`;
}

export function terminationCopy(
  termination: MatchTermination | null,
  error: string | null,
): { title: string; detail: string } {
  if (termination === "opponent_left")
    return {
      title: "對手已離開",
      detail: "對戰已中止，本場不產生物理勝負結果。",
    };
  if (termination === "connection_lost")
    return {
      title: "連線已中斷",
      detail: "無法確認本場勝負，請返回主選單後重新配對。",
    };
  return {
    title: "連線失敗",
    detail: error ?? "本場對戰已結束",
  };
}

function Meter({
  label,
  value,
  stability = false,
}: {
  label: string;
  value: number;
  stability?: boolean;
}) {
  return (
    <div className="meter">
      <small>{label}</small>
      <span>
        <i
          className={stability ? "stability" : ""}
          style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
        />
      </span>
    </div>
  );
}

function IntroScreen({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("INITIALIZING CORE SYSTEMS...");
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    let current = 0;
    const interval = setInterval(() => {
      current += Math.random() * 8 + 4;
      if (current >= 100) {
        current = 100;
        clearInterval(interval);
        setStatus("SYSTEM READY");
        setIsFading(true);
        setTimeout(() => {
          onComplete();
        }, 500);
      } else {
        if (current > 75) {
          setStatus("SYNCING ONLINE PROTOCOLS...");
        } else if (current > 45) {
          setStatus("CALIBRATING 3D ARENA...");
        } else if (current > 20) {
          setStatus("LOADING BEYBLADE ASSETS...");
        }
      }
      setProgress(Math.floor(current));
    }, 80);
    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className={`intro-screen ${isFading ? "fade-out" : ""}`}>
      <div className="intro-grid-overlay" />
      <div className="intro-content">
        <p className="eyebrow glow">GAME POOL PRESENTS</p>
        <h1 className="intro-title">CYBERBLADE 3D</h1>
        <p className="intro-subtitle">極限爆裂對決</p>

        <div className="intro-loading-box">
          <div className="intro-progress-track">
            <div
              className="intro-progress-bar"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="intro-status-row">
            <span className="intro-status-text">{status}</span>
            <span className="intro-progress-percent">{progress}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function UpcomingModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="upcoming-modal-overlay">
      <div className="upcoming-modal-backdrop" onClick={onClose} />
      <div className="upcoming-modal-card">
        <div className="upcoming-modal-accent" />
        <p className="upcoming-eyebrow">COMING SOON</p>
        <h2>敬請期待</h2>
        <p className="upcoming-description">
          全新世代的神祕陀螺正在開發中！
          <br />
          敬請關注後續更新，解鎖更多爆裂對決與專屬技能。
        </p>
        <div className="upcoming-silhouette-wrap">
          <div className="upcoming-silhouette-shadow" />
        </div>
        <button
          className="primary upcoming-close-btn"
          onClick={() => {
            synth.click();
            onClose();
          }}
        >
          我知道了
        </button>
      </div>
    </div>
  );
}
