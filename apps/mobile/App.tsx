/* eslint-disable react-hooks/set-state-in-effect, react-hooks/purity */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AppState,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import {
  BEYBLADES,
  BeybladeRuntime,
  EMPTY_BATTLE_RECORD,
  applyBattleOutcome,
  assembleBeybladeSpec,
  buildShareCardData,
  darkenColor,
  formatBattleRecord,
  localMatchOutcome,
  opponentTopId,
  resolveCustomConfig,
  type BattleRecord,
  type BattleSnapshot,
  type BeybladeSpec,
  type BeybladeState,
  type BeybladeType,
  type MatchConfig,
  type MatchPhase,
  type MatchResult,
  type MatchTermination,
  type CustomBeybladeConfig,
  type TopId,
  type TopSnapshot,
  type WinnerId,
  type EnvironmentScene,
  environmentSceneForStadium,
  environmentSceneForMatch,
  stadiumThemeFromSeed,
  stadiumVariantFromMatchId,
  stadiumVariantFromSeed,
} from "@cyberblade/core";
import {
  MatchmakingClient,
  OnlineMatchCoordinator,
  ROOM_CODE_LENGTH,
  isValidRoomCode,
  normalizeRoomCode,
  type OnlineIntent,
  type OnlineMatchState,
} from "@cyberblade/multiplayer";
import { CannonBattleSimulation } from "@cyberblade/simulation";
import { border, palette, radius, spacing } from "@cyberblade/design-system";
import {
  NON_BATTLE_COPY,
  buildBladeSelectionViewModel,
  buildOnlinePreparationCopy,
  resultOutcomeCopy,
  type BladeCarouselItem,
  type BladeSelectionViewModel,
} from "@cyberblade/ui-model";
import {
  PREVIEW_CAMERA_PRESET_ORDER,
  type PreviewCameraPreset,
} from "@cyberblade/visuals";
import {
  Eyebrow,
  InkButton,
  InkCard,
  InkPanel,
  LogoTitle,
  PaperBackdrop,
  PrimaryButton,
  StatBar,
} from "./src/ui";
import { BattleScene } from "./src/BattleScene";
import { BladePreviewScene } from "./src/BladePreviewScene";
import { IS_SIMULATOR } from "./src/render-performance";
import {
  CameraPresetIcon,
  ExplodedLayersIcon,
  GarageIcon,
} from "./src/CustomizerIcons";
import { PartCustomizer } from "./src/PartCustomizer";
import { ShareCardModal } from "./src/ShareCard";
import {
  loadBattleRecord,
  loadCustomParts,
  loadPlayerColor,
  loadPlayerName,
  resetMobileProfile,
  saveBattleRecord,
  saveCustomParts,
  savePlayerColor,
  savePlayerName,
  type CustomPartsMap,
} from "./src/profile";
import {
  RemoteFeedbackDeduper,
  battleFeedback,
  selectionFeedback,
} from "./src/feedback";
import {
  buildMobileInviteMessage,
  createMobileWebSocket,
  resolveMobileWebSocketUrl,
  shouldHostLeaveForAppState,
} from "./src/online";

const LOCAL_TOP_ID: TopId = "p1";
type AppMode = "menu" | "local" | "online";

export default function App() {
  const [runtime] = useState(
    () => new BeybladeRuntime(new CannonBattleSimulation()),
  );
  const [coordinator] = useState(
    () =>
      new OnlineMatchCoordinator(
        new MatchmakingClient((url) => createMobileWebSocket(url)),
      ),
  );
  const [game, setGame] = useState<BeybladeState>(runtime.state);
  const [online, setOnline] = useState<OnlineMatchState>(coordinator.state);
  const [mode, setMode] = useState<AppMode>("menu");
  const [playerType, setPlayerType] = useState<BeybladeType>("attack");
  const [customName, setCustomName] = useState("");
  const [customColor, setCustomColor] = useState<number | null>(null);
  const [record, setRecord] = useState<BattleRecord>(EMPTY_BATTLE_RECORD);
  const [scene, setScene] = useState<EnvironmentScene>(() =>
    environmentSceneForStadium("neon"),
  );
  const [power, setPower] = useState(20);
  const [countdownNow, setCountdownNow] = useState(0);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [lobbyOpen, setLobbyOpen] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [customPartsMap, setCustomPartsMap] = useState<CustomPartsMap>({});

  const modeRef = useRef<AppMode>("menu");
  const direction = useRef(1);
  const preparedMatch = useRef<string | null>(null);
  const launchedMatch = useRef<string | null>(null);
  const endingSentMatch = useRef<string | null>(null);
  const resultSentMatch = useRef<string | null>(null);
  const lastHostSeq = useRef(0);
  const lastRelayedEventsTick = useRef(0);
  const lastLocalFeedbackTick = useRef(0);
  const remoteFeedback = useRef(new RemoteFeedbackDeduper());
  const recordRef = useRef(record);
  const recordedMatch = useRef<string | null>(null);
  const profileLoaded = useRef(false);
  const lastOnlinePhase = useRef<OnlineMatchState["phase"]>("idle");

  function recordOnlineOutcome(
    outcome: "win" | "loss",
    matchId: string | null,
  ): void {
    if (!matchId || recordedMatch.current === matchId) return;
    recordedMatch.current = matchId;
    const next = applyBattleOutcome(recordRef.current, outcome);
    recordRef.current = next;
    setRecord(next);
  }

  const currentConfig = useMemo<CustomBeybladeConfig>(
    () => resolveCustomConfig(playerType, customPartsMap[playerType]),
    [customPartsMap, playerType],
  );

  const customSpec = useMemo(
    () => assembleBeybladeSpec(currentConfig),
    [currentConfig],
  );

  function handleCustomConfigChange(next: CustomBeybladeConfig): void {
    setCustomPartsMap({ ...customPartsMap, [playerType]: next });
  }

  const onlineConfig = useMemo<MatchConfig | null>(() => {
    if (!online.start || !online.matchId) return null;
    return {
      p1Type: online.start.p1.blade,
      p2Type: online.start.p2.blade,
      stadiumTheme: online.start.stadium,
      stadiumVariant: stadiumVariantFromMatchId(online.matchId),
      perfectLaunchTopIds: ["p1", "p2"],
      ...(online.start.p1.color !== undefined
        ? { p1Color: online.start.p1.color }
        : {}),
      ...(online.start.p2.color !== undefined
        ? { p2Color: online.start.p2.color }
        : {}),
      ...(online.start.p1.bladeId
        ? { p1BladeId: online.start.p1.bladeId }
        : {}),
      ...(online.start.p1.ratchetId
        ? { p1RatchetId: online.start.p1.ratchetId }
        : {}),
      ...(online.start.p1.bitId ? { p1BitId: online.start.p1.bitId } : {}),
      ...(online.start.p1.chipId ? { p1ChipId: online.start.p1.chipId } : {}),
      ...(online.start.p2.bladeId
        ? { p2BladeId: online.start.p2.bladeId }
        : {}),
      ...(online.start.p2.ratchetId
        ? { p2RatchetId: online.start.p2.ratchetId }
        : {}),
      ...(online.start.p2.bitId ? { p2BitId: online.start.p2.bitId } : {}),
      ...(online.start.p2.chipId ? { p2ChipId: online.start.p2.chipId } : {}),
    };
  }, [online.matchId, online.start]);

  const activeScene: EnvironmentScene = useMemo(() => {
    if (mode === "online" && online.start) return online.start.environment;
    return scene;
  }, [mode, online.start, scene]);

  const onlineNames = useMemo(() => {
    if (!online.start) return null;
    return {
      p1: online.start.p1.name ?? BEYBLADES[online.start.p1.blade].name,
      p2: online.start.p2.name ?? BEYBLADES[online.start.p2.blade].name,
    };
  }, [online.start]);

  const onlineRecords = useMemo(() => {
    if (!online.start) return null;
    return {
      p1: {
        wins: online.start.p1.wins ?? 0,
        losses: online.start.p1.losses ?? 0,
      },
      p2: {
        wins: online.start.p2.wins ?? 0,
        losses: online.start.p2.losses ?? 0,
      },
    };
  }, [online.start]);

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
        const current = coordinator.state;
        if (
          modeRef.current !== "online" ||
          current.role !== "host" ||
          !current.matchId
        )
          return;

        if (next.battle && ["battle", "ending"].includes(next.phase)) {
          const seq = coordinator.publishHostSnapshot(next.battle);
          if (seq !== null) lastHostSeq.current = seq;
        }
        if (
          current.phase === "battle" &&
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
          endingSentMatch.current !== current.matchId
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
          endingSentMatch.current = current.matchId;
        }
        if (
          next.phase === "result" &&
          next.result &&
          next.battle &&
          resultSentMatch.current !== current.matchId
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
          resultSentMatch.current = current.matchId;
        }
      }),
    [coordinator, runtime],
  );

  // Only a friend room gets a blade-selection step; quick match keeps going
  // straight to the power meter.
  const canSelectBlade = online.roomKind === "friend";
  const [friendPrepStep, setFriendPrepStep] = useState<"select" | "power">(
    "select",
  );
  // A rematch arrives as a fresh match id and sends the room back to selection.
  // Resetting during render rather than in an effect matters here: an effect
  // would leave the step stale for one frame, which is long enough to swing the
  // power meter on a screen the player has already left.
  const prepMatchId = useRef(online.matchId);
  if (prepMatchId.current !== online.matchId) {
    prepMatchId.current = online.matchId;
    if (friendPrepStep !== "select") setFriendPrepStep("select");
  }
  const prepStep = canSelectBlade ? friendPrepStep : "power";

  const powerActive =
    (mode === "local" && game.phase === "launch") ||
    (mode === "online" && online.phase === "matched" && prepStep === "power");
  useEffect(() => {
    if (!powerActive) return;
    const timer = setInterval(() => {
      setPower((current) => {
        let next = current + direction.current * 3.5;
        if (next >= 100) {
          next = 100;
          direction.current = -1;
        } else if (next <= 10) {
          next = 10;
          direction.current = 1;
        }
        return next;
      });
    }, 16);
    return () => clearInterval(timer);
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
            p2Angle: 180 + current.start.p2.angle,
          },
        });
        launchedMatch.current = current.matchId;
      }
      if (
        current.role === "host" &&
        ["battle", "ending"].includes(current.phase) &&
        ["battle", "ending"].includes(runtime.state.phase)
      ) {
        runtime.dispatch({
          type: "tick",
          deltaSeconds: Math.min((now - previous) / 1000, 0.1),
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
      runtime.dispatch({
        type: "tick",
        deltaSeconds: Math.min((now - previous) / 1000, 0.1),
      });
      previous = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [game.phase, mode, runtime]);

  useEffect(() => {
    if (online.phase !== "countdown") return;
    setCountdownNow(performance.now());
    const timer = setInterval(() => setCountdownNow(performance.now()), 100);
    return () => clearInterval(timer);
  }, [online.phase]);

  useEffect(() => {
    if (
      mode === "online" &&
      online.phase === "idle" &&
      connectionError === null
    ) {
      modeRef.current = "menu";
      setMode("menu");
    }
  }, [connectionError, mode, online.phase]);

  useEffect(() => {
    if (
      (mode === "local" || (mode === "online" && online.role === "host")) &&
      game.eventsTick > lastLocalFeedbackTick.current
    ) {
      lastLocalFeedbackTick.current = game.eventsTick;
      game.events.forEach(battleFeedback);
    }
  }, [game.events, game.eventsTick, mode, online.role]);

  useEffect(() => {
    if (mode === "online" && online.role === "guest") {
      remoteFeedback.current.consume(online.view.events, battleFeedback);
    }
  }, [mode, online.role, online.view.events]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const current = coordinator.state;
      if (
        modeRef.current !== "online" ||
        !shouldHostLeaveForAppState(current.role, current.phase, nextState)
      )
        return;
      if (current.phase === "battle" || current.phase === "ending")
        recordOnlineOutcome("loss", current.matchId);
      coordinator.leave();
      if (runtime.state.phase !== "menu") runtime.dispatch({ type: "leave" });
      modeRef.current = "menu";
      setMode("menu");
    });
    return () => subscription.remove();
  }, [coordinator, runtime]);

  // The customizer is mounted outside the phase conditionals, so an opponent
  // leaving mid-selection would leave it floating over the termination screen.
  useEffect(() => {
    if (mode !== "online") return;
    if (online.phase === "matched" || online.phase === "waiting_ready") return;
    setIsCustomizerOpen(false);
  }, [mode, online.phase]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      loadPlayerName(),
      loadPlayerColor(),
      loadBattleRecord(),
      loadCustomParts(),
    ]).then(([name, color, storedRecord, storedParts]) => {
      if (cancelled) return;
      setCustomName(name);
      setCustomColor(color);
      setRecord(storedRecord);
      recordRef.current = storedRecord;
      setCustomPartsMap((current) => ({ ...storedParts, ...current }));
      profileLoaded.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!profileLoaded.current) return;
    void saveCustomParts(customPartsMap);
  }, [customPartsMap]);

  useEffect(() => {
    if (!profileLoaded.current) return;
    void savePlayerName(customName);
  }, [customName]);

  useEffect(() => {
    if (!profileLoaded.current) return;
    void savePlayerColor(customColor);
  }, [customColor]);

  useEffect(() => {
    if (!profileLoaded.current) return;
    void saveBattleRecord(record);
  }, [record]);

  useEffect(
    () => () => {
      coordinator.dispose();
      runtime.dispose();
    },
    [coordinator, runtime],
  );

  function resetMatchRefs(): void {
    direction.current = 1;
    setPower(20);
    setConnectionError(null);
    preparedMatch.current = null;
    launchedMatch.current = null;
    endingSentMatch.current = null;
    resultSentMatch.current = null;
    lastHostSeq.current = 0;
    lastRelayedEventsTick.current = 0;
    lastLocalFeedbackTick.current = 0;
    remoteFeedback.current.reset();
  }

  function prepareLocal(): void {
    selectionFeedback();
    resetMatchRefs();
    modeRef.current = "local";
    setMode("local");
    const types = Object.keys(BEYBLADES) as BeybladeType[];
    const randomAiType = types[Math.floor(Math.random() * types.length)]!;
    const seed = Math.floor(Math.random() * 0x1_0000_0000);
    const stadiumTheme = stadiumThemeFromSeed(seed);
    setScene(environmentSceneForMatch(stadiumTheme, seed));
    runtime.dispatch({
      type: "prepare",
      config: {
        p1Type: playerType,
        p2Type: randomAiType,
        stadiumTheme,
        stadiumVariant: stadiumVariantFromSeed(seed),
        seed,
        perfectLaunchTopIds: [LOCAL_TOP_ID],
        p1BladeId: currentConfig.bladeId,
        p1RatchetId: currentConfig.ratchetId,
        p1BitId: currentConfig.bitId,
        p1ChipId: currentConfig.chipId,
        ...(customColor !== null ? { p1Color: customColor } : {}),
      },
    });
  }

  function launchLocal(): void {
    if (mode !== "local" || game.phase !== "launch") return;
    selectionFeedback();
    const offset = () =>
      (Math.random() > 0.5 ? 1 : -1) * (15 + Math.random() * 15);
    runtime.dispatch({
      type: "launch",
      launch: {
        p1Power: power,
        p1Angle: offset(),
        p2Power: 60 + Math.random() * 30,
        p2Angle: 180 + offset(),
      },
    });
  }

  function openOnlineLobby(): void {
    selectionFeedback();
    setLobbyOpen(true);
  }

  function beginOnline(intent: OnlineIntent): void {
    selectionFeedback();
    setLobbyOpen(false);
    // A rejected room code keeps the socket open in the lobby phase, so the
    // next attempt reuses that connection instead of reconnecting.
    if (modeRef.current === "online" && coordinator.state.phase === "lobby") {
      if (intent.kind === "join") coordinator.joinRoom(intent.code);
      else if (intent.kind === "create") coordinator.createRoom();
      else coordinator.joinQueue();
      return;
    }
    resetMatchRefs();
    modeRef.current = "online";
    setMode("online");
    try {
      coordinator.connect(resolveMobileWebSocketUrl(), intent);
    } catch (error) {
      setConnectionError(
        error instanceof Error ? error.message : "無法讀取線上對戰設定。",
      );
    }
  }

  function rematchOnline(): void {
    selectionFeedback();
    resetMatchRefs();
    coordinator.requestRematch();
  }

  function readyOnline(): void {
    if (online.phase !== "matched") return;
    selectionFeedback();
    coordinator.ready({
      blade: playerType,
      name: customName.trim() || BEYBLADES[playerType].name,
      wins: record.wins,
      losses: record.losses,
      power,
      angle: Math.random() * 60 - 30,
      stadium: "neon",
      ...(customColor !== null ? { color: customColor } : {}),
      bladeId: currentConfig.bladeId,
      ratchetId: currentConfig.ratchetId,
      bitId: currentConfig.bitId,
      chipId: currentConfig.chipId,
    });
  }

  function returnToMenu(): void {
    selectionFeedback();
    setLobbyOpen(false);
    if (modeRef.current === "online") {
      const current = coordinator.state;
      if (current.phase === "battle" || current.phase === "ending")
        recordOnlineOutcome("loss", current.matchId);
      coordinator.leave();
    }
    if (runtime.state.phase !== "menu") runtime.dispatch({ type: "leave" });
    modeRef.current = "menu";
    setMode("menu");
    setConnectionError(null);
  }

  async function resetProfile(): Promise<void> {
    await resetMobileProfile();
    profileLoaded.current = false;
    setCustomName("");
    setCustomColor(null);
    setRecord(EMPTY_BATTLE_RECORD);
    recordRef.current = EMPTY_BATTLE_RECORD;
    setCustomPartsMap({});
    profileLoaded.current = true;
  }

  const onlineSnapshot =
    online.role === "host" ? game.battle : online.view.snapshot;
  const localTopId = online.localTopId ?? LOCAL_TOP_ID;
  const onlineLocalRecord = onlineRecords?.[localTopId] ?? null;
  const onlineOpponentRecord =
    onlineRecords?.[opponentTopId(localTopId)] ?? null;
  const onlineOpponentName = onlineNames?.[opponentTopId(localTopId)] ?? "對手";
  const activeEvents =
    mode === "online" && online.role === "guest"
      ? online.view.visualEvents
      : game.events;
  const activeEventsTick =
    mode === "online" && online.role === "guest"
      ? online.view.eventsTick
      : game.eventsTick;
  const sceneConfig = mode === "online" ? onlineConfig : game.config;
  const sceneSnapshot = mode === "online" ? onlineSnapshot : game.battle;
  const scenePhase: MatchPhase =
    mode === "online"
      ? online.phase === "countdown"
        ? "launch"
        : online.phase === "ending"
          ? "ending"
          : online.phase === "result"
            ? "result"
            : "battle"
      : game.phase;
  const showScene =
    sceneConfig !== null &&
    ((mode === "local" && game.phase !== "menu") ||
      (mode === "online" &&
        ["countdown", "battle", "ending", "result"].includes(online.phase)));
  const countdownReference =
    online.phase === "countdown"
      ? Math.max(countdownNow, performance.now())
      : countdownNow;
  const countdown = Math.max(
    0,
    Math.ceil(
      ((online.countdownEndsAt ?? countdownReference) - countdownReference) /
        1000,
    ),
  );

  return (
    <View style={styles.root}>
      {/* The battle scene is its own background; paper only shows behind the
          menu-side screens, so it is skipped once the GL scene is up. */}
      <StatusBar barStyle={showScene ? "light-content" : "dark-content"} />
      {!showScene && <PaperBackdrop />}
      {showScene && sceneConfig && (
        <View style={StyleSheet.absoluteFill}>
          <BattleScene
            config={sceneConfig}
            phase={scenePhase}
            snapshot={sceneSnapshot}
            events={activeEvents}
            eventsTick={activeEventsTick}
            localTopId={mode === "online" ? localTopId : LOCAL_TOP_ID}
            scene={activeScene}
          />
          <View pointerEvents="none" style={styles.battleVignette}>
            <View style={styles.battleVignetteInner} />
          </View>
        </View>
      )}

      {mode === "menu" && (
        <Menu
          playerType={playerType}
          onPlayerType={setPlayerType}
          customColor={customColor}
          onCustomColor={setCustomColor}
          customName={customName}
          onCustomName={setCustomName}
          customSpec={customSpec}
          onOpenCustomizer={() => {
            selectionFeedback();
            setIsCustomizerOpen(true);
          }}
          record={record}
          onResetProfile={resetProfile}
          onLocal={prepareLocal}
          onOnline={openOnlineLobby}
        />
      )}

      <PartCustomizer
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
        beybladeType={playerType}
        config={currentConfig}
        onChangeConfig={handleCustomConfigChange}
      />

      {(lobbyOpen || (mode === "online" && online.phase === "lobby")) && (
        <OnlineLobby
          error={online.phase === "lobby" ? online.error : null}
          onSelect={beginOnline}
          onClose={returnToMenu}
        />
      )}

      {mode === "online" && online.phase === "hosting" && online.roomCode && (
        <RoomCodePanel
          code={online.roomCode}
          onCancel={() => coordinator.cancelQueue()}
        />
      )}

      {mode === "local" && game.phase === "launch" && (
        <LaunchScreen power={power} onLaunch={launchLocal} />
      )}

      {mode === "online" &&
        !connectionError &&
        ["connecting", "queued", "joining"].includes(online.phase) && (
          <Overlay
            eyebrow={online.phase === "queued" ? "MATCHMAKING" : "CONNECTING"}
            title={
              online.phase === "queued"
                ? "正在尋找對手"
                : online.phase === "joining"
                  ? "正在加入好友房"
                  : "正在連線至競技場"
            }
            detail={
              online.phase === "queued"
                ? "找到對手前會持續等待。"
                : "請稍候片刻。"
            }
          >
            <Action label="取消" onPress={() => coordinator.cancelQueue()} />
          </Overlay>
        )}

      {mode === "online" &&
        ["matched", "waiting_ready"].includes(online.phase) && (
          <OnlineSelection
            online={online}
            power={power}
            step={prepStep}
            onStep={setFriendPrepStep}
            playerType={playerType}
            onPlayerType={setPlayerType}
            customColor={customColor}
            onCustomColor={setCustomColor}
            customSpec={customSpec}
            onOpenCustomizer={() => {
              selectionFeedback();
              setIsCustomizerOpen(true);
            }}
            onReady={readyOnline}
            onLeave={returnToMenu}
          />
        )}

      {mode === "online" && online.phase === "countdown" && onlineConfig && (
        <Overlay
          eyebrow="COUNTDOWN"
          title={countdown > 0 ? String(countdown) : "GO SHOOT!"}
          detail={`對手: ${withRecordLabel(onlineOpponentName, onlineOpponentRecord)}`}
          countdown
        />
      )}

      {mode === "local" && game.phase === "battle" && game.battle && (
        <BattleHud
          snapshot={game.battle}
          localTopId={LOCAL_TOP_ID}
          localLabel="玩家"
          opponentLabel="AI"
          onExit={returnToMenu}
        />
      )}

      {mode === "online" &&
        ["battle", "ending"].includes(online.phase) &&
        onlineSnapshot && (
          <BattleHud
            snapshot={onlineSnapshot}
            localTopId={localTopId}
            localLabel={withRecordLabel("你", onlineLocalRecord)}
            opponentLabel={withRecordLabel(
              onlineOpponentName,
              onlineOpponentRecord,
            )}
            onExit={returnToMenu}
          />
        )}

      {mode === "online" &&
        online.role === "guest" &&
        ["battle", "ending"].includes(online.phase) &&
        online.view.connectionUnstable && (
          <View style={styles.connectionWarning}>
            <Text style={styles.warningText}>連線不穩 · 畫面已暫停同步</Text>
          </View>
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

      {mode === "online" && online.phase === "result" && online.view.result && (
        <ResultScreen
          result={online.view.result}
          battle={onlineSnapshot}
          localTopId={localTopId}
          online
          playerNames={onlineNames || undefined}
          record={record}
          playerColor={
            localTopId === "p1"
              ? online.start?.p1.color
              : online.start?.p2.color
          }
          {...(online.rematchAvailable
            ? {
                onRematch: rematchOnline,
                rematchRequested: online.rematchRequested,
                opponentRematch: online.opponentRematch,
                rematchReselects: canSelectBlade,
              }
            : {})}
          onMenu={returnToMenu}
        />
      )}

      {mode === "online" &&
        (connectionError ||
          online.phase === "error" ||
          (online.phase === "result" && !online.view.result)) && (
          <Overlay
            eyebrow="ONLINE MATCH"
            {...terminationCopy(
              online.termination,
              connectionError ?? online.error,
            )}
          >
            <Action label="返回主選單" primary onPress={returnToMenu} />
          </Overlay>
        )}
    </View>
  );
}

function Menu({
  playerType,
  onPlayerType,
  customName,
  onCustomName,
  customColor,
  onCustomColor,
  customSpec,
  onOpenCustomizer,
  record,
  onResetProfile,
  onLocal,
  onOnline,
}: {
  playerType: BeybladeType;
  onPlayerType: (type: BeybladeType) => void;
  customName: string;
  onCustomName: (name: string) => void;
  customColor: number | null;
  onCustomColor: (color: number | null) => void;
  customSpec: BeybladeSpec;
  onOpenCustomizer: () => void;
  record: BattleRecord;
  onResetProfile: () => Promise<void>;
  onLocal: () => void;
  onOnline: () => void;
}) {
  const [cameraPreset, setCameraPreset] =
    useState<PreviewCameraPreset>("default");
  const [isExploded, setIsExploded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const model = useMemo(
    () => buildBladeSelectionViewModel(playerType, customSpec),
    [customSpec, playerType],
  );

  function cycleCamera(): void {
    selectionFeedback();
    const index = PREVIEW_CAMERA_PRESET_ORDER.indexOf(cameraPreset);
    setCameraPreset(
      PREVIEW_CAMERA_PRESET_ORDER[
        (index + 1) % PREVIEW_CAMERA_PRESET_ORDER.length
      ] ?? "default",
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.menu}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="開啟玩家設定"
          onPress={() => setSettingsOpen(true)}
          style={styles.settingsTrigger}
        >
          <Text style={styles.settingsTriggerText}>☰</Text>
        </Pressable>
        <Eyebrow>{NON_BATTLE_COPY.brandEyebrow}</Eyebrow>
        <LogoTitle text={NON_BATTLE_COPY.brandTitle} />
        <Text style={styles.subtitle}>{NON_BATTLE_COPY.brandSubtitle}</Text>
        {(record.wins > 0 || record.losses > 0) && (
          <Text style={styles.playerRecord}>
            線上戰績 {formatBattleRecord(record)}
          </Text>
        )}

        <BladePicker
          model={model}
          onChange={onPlayerType}
          onUpcoming={() => setUpcomingOpen(true)}
        />

        <View style={styles.identityFields}>
          <Text style={styles.fieldLabel}>自訂名稱</Text>
          <TextInput
            accessibilityLabel="自訂名稱"
            value={customName}
            maxLength={24}
            placeholder={model.details.name}
            placeholderTextColor={palette.inkFaint}
            onChangeText={onCustomName}
            style={styles.nameInput}
          />
          <ColorPalette
            value={customColor}
            baseColor={BEYBLADES[playerType].color}
            onChange={onCustomColor}
          />
        </View>

        <View
          style={[
            styles.previewStage,
            IS_SIMULATOR && styles.previewStageSimulator,
          ]}
        >
          <View style={styles.previewControls}>
            <PreviewControl label="開啟零件改裝工坊" onPress={onOpenCustomizer}>
              <GarageIcon size={18} color={palette.card} />
            </PreviewControl>
            <PreviewControl label="切換預覽視角" onPress={cycleCamera}>
              <CameraPresetIcon
                preset={cameraPreset}
                size={18}
                color={palette.card}
              />
            </PreviewControl>
            <PreviewControl
              label={isExploded ? "切換組裝檢視" : "切換四零件拆解檢視"}
              active={isExploded}
              onPress={() => {
                selectionFeedback();
                setIsExploded((current) => !current);
              }}
            >
              <ExplodedLayersIcon size={18} color={palette.card} />
            </PreviewControl>
          </View>
          <BladePreviewScene
            type={playerType}
            color={customColor}
            exploded={isExploded}
            preset={cameraPreset}
            customSpec={customSpec}
          />
        </View>

        <BladeDetails model={model} />
        <Action
          label={NON_BATTLE_COPY.onlineAction}
          primary
          onPress={onOnline}
        />
        <Action label={NON_BATTLE_COPY.localAction} onPress={onLocal} />
        <Text style={styles.footerCopy}>{NON_BATTLE_COPY.footer}</Text>
      </ScrollView>

      <InfoModal
        visible={upcomingOpen}
        eyebrow={NON_BATTLE_COPY.upcomingEyebrow}
        title={NON_BATTLE_COPY.upcomingTitle}
        detail={NON_BATTLE_COPY.upcomingDetail}
        onClose={() => setUpcomingOpen(false)}
      />

      <Modal
        visible={settingsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSettingsOpen(false)}
      >
        <SafeAreaView style={styles.sheetBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSettingsOpen(false)}
          />
          <View style={styles.profileSheet}>
            <Eyebrow>PLAYER PROFILE</Eyebrow>
            <Text style={styles.sheetTitle}>
              {customName.trim() || "未知戰士"}
            </Text>
            <Text style={styles.profileRecord}>
              {formatBattleRecord(record)}
            </Text>
            <TextInput
              accessibilityLabel="玩家名稱"
              value={customName}
              maxLength={24}
              placeholder="輸入玩家名稱"
              placeholderTextColor={palette.inkFaint}
              onChangeText={onCustomName}
              style={styles.nameInput}
            />
            {resetConfirm ? (
              <>
                <Text style={styles.resetWarning}>
                  將清除名稱、配色、戰績與所有零件配置。
                </Text>
                <Action
                  label="確認清除資料"
                  primary
                  onPress={() => {
                    void onResetProfile().then(() => {
                      setResetConfirm(false);
                      setSettingsOpen(false);
                    });
                  }}
                />
                <Action label="取消" onPress={() => setResetConfirm(false)} />
              </>
            ) : (
              <Action
                label="重設遊戲資料"
                onPress={() => setResetConfirm(true)}
              />
            )}
            <Action
              label="關閉"
              primary
              onPress={() => setSettingsOpen(false)}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function PreviewControl({
  children,
  label,
  active = false,
  onPress,
}: {
  children: ReactNode;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.previewControl,
        active && styles.previewControlActive,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      {children}
    </Pressable>
  );
}

function ColorPalette({
  value,
  baseColor,
  onChange,
  disabled = false,
}: {
  value: number | null;
  baseColor: number;
  onChange: (color: number | null) => void;
  disabled?: boolean;
}) {
  const darkColor = darkenColor(baseColor);
  const options = [
    { key: "original", label: "原色", value: null, display: baseColor },
    { key: "dark", label: "暗色", value: darkColor, display: darkColor },
  ] as const;
  return (
    <View style={styles.colorField}>
      <Text style={styles.colorFieldLabel}>陀螺配色</Text>
      <View style={styles.colorPalette}>
        {options.map((option) => {
          const hex = `#${option.display.toString(16).padStart(6, "0")}`;
          const isActive = value === option.value;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="button"
              accessibilityLabel={`選擇${option.label}`}
              disabled={disabled}
              onPress={() => {
                selectionFeedback();
                onChange(option.value);
              }}
              style={[
                styles.colorSwatch,
                { backgroundColor: hex },
                isActive && styles.colorSwatchActive,
                disabled && styles.disabled,
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

function BladePicker({
  model,
  onChange,
  onUpcoming,
  disabled = false,
}: {
  model: BladeSelectionViewModel;
  onChange: (type: BeybladeType) => void;
  onUpcoming: () => void;
  disabled?: boolean;
}) {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const cardWidth = Math.min(248, Math.max(210, width - 112));
  const interval = cardWidth + spacing.md;
  const selectedIndex = model.items.findIndex(
    (item) => item.type === model.selectedType,
  );

  function activate(item: BladeCarouselItem): void {
    if (!item.selectable || !item.type) {
      onUpcoming();
      return;
    }
    selectionFeedback();
    onChange(item.type);
  }

  function move(offset: number): void {
    const nextIndex = Math.max(
      0,
      Math.min(model.items.length - 1, selectedIndex + offset),
    );
    const item = model.items[nextIndex];
    if (!item) return;
    scrollRef.current?.scrollTo({ x: nextIndex * interval, animated: true });
    activate(item);
  }

  function settle(event: NativeSyntheticEvent<NativeScrollEvent>): void {
    const index = Math.round(event.nativeEvent.contentOffset.x / interval);
    const item = model.items[index];
    if (item) activate(item);
  }

  return (
    <View style={styles.carouselSection}>
      <View style={styles.garageHeading}>
        <View>
          <Eyebrow>{model.eyebrow}</Eyebrow>
          <Text style={styles.sectionTitle}>{model.title}</Text>
        </View>
        <Text style={styles.garageCounter}>{model.counter}</Text>
      </View>
      <View style={styles.carouselRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="上一個陀螺"
          disabled={selectedIndex <= 0 || disabled}
          onPress={() => move(-1)}
          style={[styles.carouselArrow, selectedIndex <= 0 && styles.disabled]}
        >
          <Text style={styles.carouselArrowText}>‹</Text>
        </Pressable>
        <ScrollView
          ref={scrollRef}
          style={styles.carouselViewport}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={interval}
          decelerationRate="fast"
          contentOffset={{ x: selectedIndex * interval, y: 0 }}
          contentContainerStyle={styles.carouselContent}
          onMomentumScrollEnd={settle}
        >
          {model.items.map((item) => {
            const accent =
              item.color === null
                ? palette.ruleStrong
                : `#${item.color.toString(16).padStart(6, "0")}`;
            return (
              <Pressable
                key={item.id}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={`${item.typeLabel} ${item.name}`}
                style={{ width: cardWidth, marginRight: spacing.md }}
                onPress={() => activate(item)}
              >
                <InkCard
                  lean
                  active={item.selected}
                  accent={accent}
                  contentStyle={styles.carouselCardContent}
                >
                  <Text style={[styles.bladeType, { color: accent }]}>
                    {item.typeLabel}
                  </Text>
                  <Text style={styles.carouselGlyph}>
                    {item.kind === "upcoming" ? "?" : "◎"}
                  </Text>
                  <Text style={styles.bladeName}>{item.name}</Text>
                  <Text style={styles.bladeStats}>{item.englishName}</Text>
                </InkCard>
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="下一個陀螺"
          disabled={selectedIndex >= model.items.length - 1 || disabled}
          onPress={() => move(1)}
          style={[
            styles.carouselArrow,
            selectedIndex >= model.items.length - 1 && styles.disabled,
          ]}
        >
          <Text style={styles.carouselArrowText}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

function BladeDetails({ model }: { model: BladeSelectionViewModel }) {
  const accent = `#${model.details.color.toString(16).padStart(6, "0")}`;
  return (
    <InkPanel style={styles.bladeDetails}>
      <Eyebrow style={{ color: accent }}>{model.details.englishName}</Eyebrow>
      <Text style={styles.selectedName}>{model.details.name}</Text>
      <Text style={styles.detailDescription}>{model.details.description}</Text>
      <View style={styles.statGrid}>
        {model.details.stats.map((stat) => (
          <View style={styles.statItem} key={stat.key}>
            <View style={styles.row}>
              <Text style={styles.statLabel}>{stat.label}</Text>
              <Text style={styles.statValue}>{stat.displayValue}</Text>
            </View>
            <StatBar ratio={stat.ratio} />
          </View>
        ))}
      </View>
    </InkPanel>
  );
}

function InfoModal({
  visible,
  eyebrow,
  title,
  detail,
  onClose,
}: {
  visible: boolean;
  eyebrow: string;
  title: string;
  detail: string;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalBackdrop}>
        <InkPanel style={styles.infoModalCard}>
          <Eyebrow>{eyebrow}</Eyebrow>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Text style={styles.detailDescription}>{detail}</Text>
          <Action label="知道了" primary onPress={onClose} />
        </InkPanel>
      </SafeAreaView>
    </Modal>
  );
}

function OnlineSelection({
  online,
  power,
  step,
  onStep,
  playerType,
  onPlayerType,
  customColor,
  onCustomColor,
  customSpec,
  onOpenCustomizer,
  onReady,
  onLeave,
}: {
  online: OnlineMatchState;
  power: number;
  step: "select" | "power";
  onStep: (step: "select" | "power") => void;
  playerType: BeybladeType;
  onPlayerType: (type: BeybladeType) => void;
  customColor: number | null;
  onCustomColor: (color: number | null) => void;
  customSpec: BeybladeSpec;
  onOpenCustomizer: () => void;
  onReady: () => void;
  onLeave: () => void;
}) {
  const canSelectBlade = online.roomKind === "friend";
  const locked = online.phase === "waiting_ready";
  const [cameraPreset, setCameraPreset] =
    useState<PreviewCameraPreset>("default");
  const [isExploded, setIsExploded] = useState(false);
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const model = useMemo(
    () => buildBladeSelectionViewModel(playerType, customSpec),
    [customSpec, playerType],
  );
  const copy = buildOnlinePreparationCopy({
    step,
    canSelectBlade,
    locked,
    opponentReady: online.opponentReady,
  });

  function cycleCamera(): void {
    const index = PREVIEW_CAMERA_PRESET_ORDER.indexOf(cameraPreset);
    setCameraPreset(
      PREVIEW_CAMERA_PRESET_ORDER[
        (index + 1) % PREVIEW_CAMERA_PRESET_ORDER.length
      ] ?? "default",
    );
  }

  if (step === "select") {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.menu}>
          <Eyebrow>{copy.eyebrow}</Eyebrow>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.subtitle}>{copy.detail}</Text>
          <BladePicker
            model={model}
            onChange={onPlayerType}
            onUpcoming={() => setUpcomingOpen(true)}
          />
          <ColorPalette
            value={customColor}
            baseColor={BEYBLADES[playerType].color}
            onChange={onCustomColor}
          />
          <View
            style={[
              styles.previewStage,
              IS_SIMULATOR && styles.previewStageSimulator,
            ]}
          >
            <View style={styles.previewControls}>
              <PreviewControl
                label="開啟零件改裝工坊"
                onPress={onOpenCustomizer}
              >
                <GarageIcon size={18} color={palette.card} />
              </PreviewControl>
              <PreviewControl label="切換預覽視角" onPress={cycleCamera}>
                <CameraPresetIcon
                  preset={cameraPreset}
                  size={18}
                  color={palette.card}
                />
              </PreviewControl>
              <PreviewControl
                label={isExploded ? "切換組裝檢視" : "切換四零件拆解檢視"}
                active={isExploded}
                onPress={() => setIsExploded((current) => !current)}
              >
                <ExplodedLayersIcon size={18} color={palette.card} />
              </PreviewControl>
            </View>
            <BladePreviewScene
              type={playerType}
              color={customColor}
              exploded={isExploded}
              preset={cameraPreset}
              customSpec={customSpec}
            />
          </View>
          <BladeDetails model={model} />
          <Action
            label={copy.primaryAction}
            primary
            onPress={() => {
              selectionFeedback();
              onStep("power");
            }}
          />
          <Action label={copy.leaveAction} onPress={onLeave} />
          <Text style={styles.muted}>{copy.opponentLabel}</Text>
        </ScrollView>
        <InfoModal
          visible={upcomingOpen}
          eyebrow={NON_BATTLE_COPY.upcomingEyebrow}
          title={NON_BATTLE_COPY.upcomingTitle}
          detail={NON_BATTLE_COPY.upcomingDetail}
          onClose={() => setUpcomingOpen(false)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.menu}>
        <Eyebrow>{copy.eyebrow}</Eyebrow>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.subtitle}>{copy.detail}</Text>
        <PowerMeter power={power} />
        <View style={styles.readyCopy}>
          <Text style={styles.muted}>{copy.opponentLabel}</Text>
          <Text style={styles.powerText}>{Math.round(power)}%</Text>
        </View>
        <Action
          label={copy.primaryAction}
          primary
          disabled={locked}
          onPress={onReady}
        />
        {canSelectBlade && (
          <Action
            label={copy.secondaryAction ?? "返回重選陀螺"}
            disabled={locked}
            onPress={() => {
              selectionFeedback();
              onStep("select");
            }}
          />
        )}
        <Action label={copy.leaveAction} onPress={onLeave} />
      </ScrollView>
    </SafeAreaView>
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
    <Pressable style={styles.launchScreen} onPress={onLaunch}>
      <SafeAreaView style={styles.launchContent}>
        <View style={styles.centered}>
          <Text style={styles.eyebrow}>READY TO LAUNCH</Text>
          <Text style={styles.launchTitle}>GO SHOOT!</Text>
          <Text style={styles.muted}>點擊螢幕任一處發射</Text>
        </View>
        <View style={styles.powerCard}>
          <View style={styles.row}>
            <Text style={styles.cardLabel}>LAUNCH POWER</Text>
            <Text style={styles.powerText}>{Math.round(power)}%</Text>
          </View>
          <PowerMeter power={power} />
          <Text style={styles.hint}>85–95% 完美發射可獲得額外轉速</Text>
        </View>
      </SafeAreaView>
    </Pressable>
  );
}

function PowerMeter({ power }: { power: number }) {
  return (
    <View style={styles.powerTrack}>
      <View style={styles.perfectZone} />
      <View style={[styles.powerFill, { width: `${power}%` }]} />
    </View>
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
  return (
    <SafeAreaView style={styles.hud} pointerEvents="box-none">
      <View style={styles.hudTop}>
        <Text style={[styles.timer, remaining <= 5 && styles.lose]}>
          {remaining}
        </Text>
        <Pressable style={styles.exit} onPress={onExit}>
          <Text style={styles.secondaryText}>退出</Text>
        </Pressable>
      </View>
      <View style={styles.hudBottom}>
        <TopHud top={snapshot[localTopId]} label={localLabel} />
        <TopHud
          top={snapshot[opponentTopId(localTopId)]}
          label={opponentLabel}
        />
      </View>
    </SafeAreaView>
  );
}

function TopHud({ top, label }: { top: TopSnapshot; label: string }) {
  const spec = BEYBLADES[top.type];
  return (
    <View style={styles.topHud}>
      <View style={styles.row}>
        <Text style={styles.hudName}>
          {label} · {spec.name}
        </Text>
        <Text style={styles.bladeType}>{top.type.toUpperCase()}</Text>
      </View>
      <Meter value={top.rpm / 6000} label={`${Math.round(top.rpm)} RPM`} />
      <Meter
        value={top.stability / spec.maxStability}
        label={top.isBurst ? "BURST!" : `穩定度 ${Math.round(top.stability)}`}
        danger
      />
    </View>
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
  rematchRequested = false,
  opponentRematch = false,
  rematchReselects = false,
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
  rematchRequested?: boolean;
  opponentRematch?: boolean;
  rematchReselects?: boolean;
  onMenu: () => void;
}) {
  const outcome = localMatchOutcome(result.winnerId, localTopId);
  const [shareOpen, setShareOpen] = useState(false);
  return (
    <SafeAreaView style={styles.overlay}>
      <View style={styles.resultCard}>
        <Text style={styles.eyebrow}>MATCH COMPLETE</Text>
        <Text
          style={[
            styles.resultTitle,
            outcome === "victory"
              ? styles.win
              : outcome === "defeat"
                ? styles.lose
                : null,
          ]}
        >
          {resultOutcomeCopy(outcome)}
        </Text>
        <Text style={styles.finish}>{result.finishType}</Text>
        <Text style={styles.resultName}>
          {formatWinnerName(
            result.winnerId,
            battle,
            localTopId,
            online,
            playerNames,
          )}
        </Text>
        {result.winnerId !== "draw" && (
          <Text style={styles.muted}>
            戰敗:{" "}
            {formatTopPlayerName(
              opponentTopId(result.winnerId),
              battle,
              localTopId,
              online,
              playerNames,
            )}
          </Text>
        )}
        <Text style={styles.muted}>
          {result.duration.toFixed(1)} 秒 · {result.finalRpm} RPM
        </Text>
        {record && (
          <Text style={styles.muted}>
            我的戰績 {formatBattleRecord(record)}
          </Text>
        )}
        {outcome === "victory" && battle && (
          <Action label="分享戰績" primary onPress={() => setShareOpen(true)} />
        )}
        {onRematch && (
          <Action
            label={
              !online
                ? "再戰一局"
                : rematchRequested
                  ? "等待對手回應…"
                  : opponentRematch
                    ? "對手想再戰，接受"
                    : rematchReselects
                      ? "再戰（可重選陀螺）"
                      : "再來一場"
            }
            primary
            disabled={rematchRequested}
            onPress={onRematch}
          />
        )}
        <Action label="返回主選單" primary={online} onPress={onMenu} />
      </View>
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
    </SafeAreaView>
  );
}

function OnlineLobby({
  error,
  onSelect,
  onClose,
}: {
  error?: string | null;
  onSelect: (intent: OnlineIntent) => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState("");
  const canJoin = isValidRoomCode(code);
  return (
    <SafeAreaView style={styles.overlay}>
      <View style={styles.resultCard}>
        <Text style={styles.eyebrow}>ONLINE</Text>
        <Text style={styles.overlayTitle}>選擇對戰方式</Text>
        {error && <Text style={styles.lobbyError}>{error}</Text>}
        <Action
          label="隨機配對"
          primary
          onPress={() => onSelect({ kind: "quick" })}
        />
        <Action
          label="建立好友房"
          onPress={() => onSelect({ kind: "create" })}
        />
        <Text style={styles.muted}>輸入好友的房號</Text>
        <TextInput
          style={styles.roomCodeInput}
          value={code}
          // Normalizing on input keeps the field showing exactly what will be
          // sent, so a pasted "k7m2-p9" becomes K7M2P9 as you type.
          onChangeText={(value) =>
            setCode(normalizeRoomCode(value).slice(0, ROOM_CODE_LENGTH))
          }
          placeholder={"A".repeat(ROOM_CODE_LENGTH)}
          placeholderTextColor="#b7bccb"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={ROOM_CODE_LENGTH}
        />
        <Action
          label="加入"
          disabled={!canJoin}
          onPress={() => onSelect({ kind: "join", code })}
        />
        <Action label="返回主選單" onPress={onClose} />
      </View>
    </SafeAreaView>
  );
}

function RoomCodePanel({
  code,
  onCancel,
}: {
  code: string;
  onCancel: () => void;
}) {
  return (
    <SafeAreaView style={styles.overlay}>
      <View style={styles.resultCard}>
        <Text style={styles.eyebrow}>FRIEND ROOM</Text>
        <Text style={styles.overlayTitle}>等待好友加入</Text>
        <Text style={styles.roomCode}>{code}</Text>
        <Text style={styles.muted}>
          把房號傳給朋友，他加入後你們就能各自挑選陀螺。
        </Text>
        <Action
          label="分享邀請"
          primary
          onPress={() => {
            void Share.share({ message: buildMobileInviteMessage(code) });
          }}
        />
        <Action label="取消" onPress={onCancel} />
      </View>
    </SafeAreaView>
  );
}

function Overlay({
  eyebrow,
  title,
  detail,
  countdown = false,
  children,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  countdown?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <SafeAreaView style={styles.overlay}>
      <View style={styles.resultCard}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={countdown ? styles.countdown : styles.overlayTitle}>
          {title}
        </Text>
        <Text style={styles.muted}>{detail}</Text>
        {children}
      </View>
    </SafeAreaView>
  );
}

function Action({
  label,
  onPress,
  primary = false,
  online = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  online?: boolean;
  disabled?: boolean;
}) {
  // `online` used to mean a second filled colour; in the print theme there is
  // one filled treatment, so it just promotes the button to primary.
  if (primary || online) {
    return (
      <PrimaryButton
        label={label}
        disabled={disabled}
        onPress={onPress}
        style={styles.actionSpacing}
      />
    );
  }
  return (
    <InkButton
      label={label}
      disabled={disabled}
      onPress={onPress}
      style={styles.actionSpacing}
    />
  );
}

function Meter({
  value,
  label,
  danger = false,
}: {
  value: number;
  label: string;
  danger?: boolean;
}) {
  return (
    <View style={styles.meter}>
      <Text style={styles.meterText}>{label}</Text>
      <View style={styles.meterTrack}>
        <View
          style={[
            styles.meterFill,
            danger && styles.dangerFill,
            { width: `${Math.max(0, Math.min(1, value)) * 100}%` },
          ]}
        />
      </View>
    </View>
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
  return { title: "連線失敗", detail: error ?? "本場對戰已結束" };
}

const styles = StyleSheet.create({
  // The battle screens keep the dark GL scene as their background; everything
  // else sits on paper, which PaperBackdrop draws.
  root: { flex: 1, backgroundColor: palette.paper },
  safe: { flex: 1 },
  battleVignette: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
  },
  battleVignetteInner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(2, 1, 6, 0.42)",
  },
  menu: {
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    // Room for the offset shadow under the last card, which is drawn outside
    // the content box.
    paddingBottom: 64,
  },
  eyebrow: {
    color: palette.cyan,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 3,
  },
  title: {
    marginTop: spacing.sm,
    color: palette.ink,
    fontSize: 34,
    fontWeight: "900",
    fontStyle: "italic",
    letterSpacing: -1,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 6,
    color: palette.inkMuted,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 3,
    textAlign: "center",
  },
  playerRecord: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 5,
    overflow: "hidden",
    borderWidth: border.thin,
    borderColor: palette.ink,
    borderRadius: radius.pill,
    backgroundColor: palette.card,
    color: palette.ink,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
  sectionTitle: {
    marginTop: 4,
    color: palette.ink,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
  actionSpacing: { marginTop: 12 },
  settingsTrigger: {
    position: "absolute",
    top: 14,
    right: spacing.lg,
    zIndex: 10,
    width: 44,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: border.thick,
    borderColor: palette.ink,
    borderRadius: radius.md,
    backgroundColor: palette.card,
  },
  settingsTriggerText: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "900",
  },
  identityFields: { width: "100%", marginTop: spacing.md },
  fieldLabel: {
    marginBottom: 6,
    color: palette.inkFaint,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  nameInput: {
    width: "100%",
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: border.thin,
    borderColor: palette.ink,
    borderRadius: radius.md,
    backgroundColor: palette.card,
    color: palette.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  previewStage: {
    width: "100%",
    height: 340,
    marginTop: spacing.md,
    position: "relative",
  },
  previewStageSimulator: { height: 240 },
  previewControls: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 5,
    flexDirection: "row",
    gap: 8,
  },
  previewControl: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: border.thin,
    borderColor: palette.cyan,
    borderRadius: radius.md,
    backgroundColor: palette.ink,
  },
  previewControlActive: { backgroundColor: palette.purple },
  footerCopy: {
    marginTop: spacing.md,
    color: palette.inkMuted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textAlign: "center",
  },
  carouselSection: { width: "100%" },
  carouselRow: {
    width: "100%",
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
  },
  carouselContent: { paddingVertical: 16, paddingHorizontal: 6 },
  carouselViewport: { flex: 1 },
  carouselArrow: {
    width: 38,
    height: 38,
    zIndex: 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: border.thick,
    borderColor: palette.ink,
    borderRadius: radius.pill,
    backgroundColor: palette.card,
  },
  carouselArrowText: {
    marginTop: -3,
    color: palette.ink,
    fontSize: 30,
    fontWeight: "900",
  },
  carouselCardContent: {
    minHeight: 132,
    alignItems: "center",
    justifyContent: "center",
  },
  carouselGlyph: {
    marginVertical: 8,
    color: palette.ink,
    fontSize: 34,
    fontWeight: "900",
  },
  bladeDetails: { width: "100%", marginTop: spacing.md },
  detailDescription: {
    marginTop: spacing.sm,
    color: palette.inkMuted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  modalBackdrop: {
    flex: 1,
    padding: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(31, 34, 53, 0.55)",
  },
  infoModalCard: { width: "100%" },
  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(31, 34, 53, 0.45)",
  },
  profileSheet: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: border.thick,
    borderColor: palette.ink,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: palette.card,
  },
  sheetTitle: {
    marginTop: spacing.sm,
    color: palette.ink,
    fontSize: 28,
    fontWeight: "900",
  },
  profileRecord: {
    marginVertical: spacing.md,
    color: palette.cyan,
    fontSize: 14,
    fontWeight: "900",
  },
  resetWarning: {
    marginTop: spacing.md,
    color: palette.danger,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },

  garageHeading: {
    width: "100%",
    marginTop: spacing.xl,
    paddingBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderBottomWidth: border.thin,
    borderBottomColor: palette.rule,
  },
  garageCounter: {
    color: palette.cyan,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  menuPreview: {
    width: "100%",
    height: 320,
    marginTop: spacing.sm,
    backgroundColor: "transparent",
  },
  selectedBladePanel: { width: "100%", marginTop: spacing.md },
  selectedCopy: { width: "100%" },
  selectedName: {
    marginTop: 4,
    color: palette.ink,
    fontSize: 24,
    fontWeight: "900",
  },
  statGrid: {
    width: "100%",
    marginTop: spacing.md,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statItem: { width: "47%" },
  statLabel: { color: palette.inkFaint, fontSize: 10, fontWeight: "800" },
  statValue: { color: palette.ink, fontSize: 10, fontWeight: "800" },

  bladeGrid: {
    width: "100%",
    marginTop: spacing.md,
    flexDirection: "row",
    flexWrap: "wrap",
    // The leaning cards and their offset shadows both spill past the card box,
    // so the gutters are wider than the visual gap suggests.
    gap: spacing.md,
    paddingLeft: 10,
    paddingBottom: 10,
  },
  bladeCardSlot: { width: "46%" },
  bladeCardContent: { alignItems: "center", paddingVertical: 4 },
  bladeMiniPreview: {
    width: 34,
    height: 34,
    marginVertical: 10,
    borderWidth: border.thick,
    borderRadius: radius.pill,
    backgroundColor: palette.card,
  },
  bladeName: { color: palette.ink, fontSize: 15, fontWeight: "900" },
  bladeType: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  bladeStats: {
    marginTop: 6,
    color: palette.inkFaint,
    fontSize: 10,
    fontWeight: "700",
  },

  garageButton: {
    width: "100%",
    marginTop: spacing.md,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: border.thick,
    borderColor: palette.cyan,
    borderRadius: radius.md,
    backgroundColor: palette.card,
  },
  garageButtonText: {
    color: palette.cyan,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  colorField: { width: "100%", marginTop: spacing.md, gap: 8 },
  colorFieldLabel: {
    color: palette.inkFaint,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  colorPalette: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  colorSwatch: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: border.thin,
    borderColor: palette.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  colorSwatchActive: { borderWidth: 4, borderColor: palette.cyan },
  colorSwatchDefault: { backgroundColor: palette.card },
  colorSwatchDefaultMark: {
    color: palette.inkFaint,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 20,
  },

  secondaryText: { color: palette.ink, fontWeight: "800" },
  muted: { marginTop: 6, color: palette.inkMuted, textAlign: "center" },
  hint: {
    marginTop: 10,
    color: palette.inkFaint,
    fontSize: 11,
    textAlign: "center",
  },
  row: { flexDirection: "row", justifyContent: "space-between" },
  centered: { alignItems: "center", marginTop: 80 },

  // Launch and battle overlays sit on the GL scene, so they stay dark-on-dark
  // rather than switching to paper.
  launchScreen: { ...StyleSheet.absoluteFill, backgroundColor: "#02010688" },
  launchContent: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: "space-between",
  },
  launchTitle: {
    marginTop: 8,
    color: "#ffffff",
    fontSize: 42,
    fontWeight: "900",
    fontStyle: "italic",
  },
  powerCard: {
    padding: spacing.lg,
    borderWidth: border.thick,
    borderColor: "#ffffff",
    borderRadius: radius.lg,
    backgroundColor: "rgba(9, 11, 22, 0.92)",
  },
  cardLabel: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
  },
  powerText: { color: palette.cyanBright, fontSize: 16, fontWeight: "900" },
  powerTrack: {
    width: "100%",
    height: 20,
    marginTop: 12,
    overflow: "hidden",
    borderWidth: border.thin,
    borderColor: palette.ink,
    borderRadius: radius.sm,
    backgroundColor: palette.track,
  },
  perfectZone: {
    position: "absolute",
    left: "85%",
    width: "10%",
    height: "100%",
    backgroundColor: "rgba(0, 179, 126, 0.35)",
  },
  powerFill: { height: "100%", backgroundColor: palette.purple },
  readyCopy: {
    width: "100%",
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  hud: { flex: 1, justifyContent: "space-between" },
  hudTop: {
    padding: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timer: {
    marginLeft: "43%",
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "900",
    textShadowColor: palette.cyanBright,
    textShadowRadius: 10,
  },
  exit: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: border.thin,
    borderColor: "#ffffff",
    borderRadius: radius.md,
    backgroundColor: "rgba(9, 11, 22, 0.85)",
  },
  hudBottom: { padding: spacing.md, gap: 8 },
  topHud: {
    padding: 12,
    borderWidth: border.thin,
    borderColor: "#ffffff",
    borderRadius: radius.md,
    backgroundColor: "rgba(5, 7, 19, 0.9)",
  },
  hudName: { color: "#ffffff", fontWeight: "800" },
  meter: { marginTop: 7 },
  meterText: { color: "#c9cede", fontSize: 10 },
  meterTrack: {
    height: 6,
    marginTop: 3,
    overflow: "hidden",
    borderRadius: radius.sm,
    backgroundColor: "#30364a",
  },
  meterFill: { height: "100%", backgroundColor: palette.cyanBright },
  dangerFill: { backgroundColor: palette.danger },
  connectionWarning: {
    position: "absolute",
    top: 54,
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: border.thin,
    borderColor: palette.ink,
    borderRadius: radius.md,
    backgroundColor: palette.warning,
  },
  warningText: { color: palette.ink, fontSize: 12, fontWeight: "900" },

  overlay: {
    flex: 1,
    padding: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(31, 34, 53, 0.55)",
  },
  resultCard: {
    width: "100%",
    padding: spacing.xl,
    alignItems: "center",
    borderWidth: border.thick,
    borderColor: palette.ink,
    borderRadius: radius.lg,
    backgroundColor: palette.card,
  },
  overlayTitle: {
    marginTop: 12,
    color: palette.ink,
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
  },
  countdown: {
    marginTop: 12,
    color: palette.cyan,
    fontSize: 72,
    fontWeight: "900",
    fontStyle: "italic",
  },
  resultTitle: {
    marginTop: 8,
    color: palette.ink,
    fontSize: 48,
    fontWeight: "900",
    fontStyle: "italic",
  },
  win: { color: palette.cyan },
  lose: { color: palette.danger },
  finish: {
    marginVertical: spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
    overflow: "hidden",
    color: palette.ink,
    borderWidth: border.thin,
    borderColor: palette.ink,
    borderRadius: radius.pill,
    backgroundColor: palette.warning,
    fontSize: 11,
    fontWeight: "900",
  },
  resultName: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  lobbyError: {
    marginTop: 10,
    color: palette.danger,
    fontWeight: "800",
    textAlign: "center",
  },
  roomCodeInput: {
    width: "100%",
    marginTop: 8,
    padding: 14,
    borderWidth: border.thick,
    borderColor: palette.ink,
    borderRadius: radius.md,
    backgroundColor: palette.card,
    color: palette.ink,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 6,
    textAlign: "center",
  },
  roomCode: {
    marginTop: 14,
    color: palette.cyan,
    fontSize: 42,
    fontWeight: "900",
    fontStyle: "italic",
    letterSpacing: 8,
    textAlign: "center",
  },
});
