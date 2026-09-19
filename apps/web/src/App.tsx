import { BladePreviewScene } from "./lazy-scenes";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/purity */
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  BEYBLADES,
  BeybladeRuntime,
  darkenColor,
  applyBattleOutcome,
  buildShareCardData,
  formatBattleRecord,
  localMatchOutcome,
  opponentTopId,
  assembleBeybladeSpec,
  resolveCustomConfig,
  specialMoveFor,
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
  type SpecialMove,
  type TopId,
  type TopSnapshot,
  type WinnerId,
  type EnvironmentScene,
  environmentSceneForStadium,
  environmentSceneForMatch,
  stadiumThemeFromSeed,
  stadiumVariantFromSeed,
  type CustomBeybladeConfig,
} from "@cyberblade/core";
import {
  MatchmakingClient,
  OnlineMatchCoordinator,
  type OnlineMatchState,
  BattleSession,
  onlineMatchConfig,
} from "@cyberblade/multiplayer";
import { CannonBattleSimulation } from "@cyberblade/simulation";
import { PREVIEW_CAMERA_PRESET_ORDER } from "./preview-controls";
import {
  NON_BATTLE_COPY,
  buildBladeSelectionViewModel,
  buildOnlinePreparationCopy,
  resultOutcomeCopy,
  type BladeSelectionViewModel,
} from "@cyberblade/ui-model";
import { BattleScene, preloadBattleScene } from "./lazy-scenes";
import { BladeMiniIcon } from "./components/BladeMiniIcon";
import { GarageIcon } from "./components/CustomizerIcons";
import {
  CAMERA_PRESETS,
  ExplodedLayersIcon,
  type CameraPreset,
} from "./preview-controls";
import { PartCustomizerModal } from "./lazy-scenes";
import { ShareCardModal } from "./lazy-scenes";
import { synth } from "./audio";
import {
  clearRoomParamFromUrl,
  createWebSocket,
  hostShouldLeaveWhenHidden,
  loadFriendRoomResumeToken,
  onlinePageExitAction,
  readRoomCodeFromLocation,
  resolveWebSocketUrl,
  saveFriendRoomResumeToken,
  shouldWarnBeforeOnlineExit,
} from "./online";
import {
  OnlineLobby,
  OnlineRoomCode,
  type OnlineLobbyChoice,
} from "./OnlineLobby";
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

import { HudPublisher } from "./battle-presentation";
import { useBattlePresentation } from "./use-battle-presentation";

const LOCAL_TOP_ID: TopId = "p1";
type AppMode = "menu" | "local" | "online";

const POWER_START = 20;
const POWER_MIN = 10;
const POWER_MAX = 100;
/** Percent per millisecond — matches the old 3.5% every 16ms. */
const POWER_SPEED = 3.5 / 16;

type PowerState = { value: number; direction: number };

/**
 * Animates the launch meter without React state: the value lives in a ref and
 * the bar/label are written directly to the DOM each frame. A 60fps setState on
 * <App> would re-render the whole tree (3D scene included) every frame, which
 * is what made this stutter on phones.
 */
function usePowerMeter(powerRef: RefObject<PowerState>, active: boolean) {
  const fillRef = useRef<HTMLSpanElement>(null);
  const valueRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const paint = (value: number) => {
      if (fillRef.current) {
        fillRef.current.style.transform = `scaleX(${value / POWER_MAX})`;
      }
      const label = `${Math.round(value)}%`;
      if (valueRef.current && valueRef.current.textContent !== label) {
        valueRef.current.textContent = label;
      }
    };

    paint(powerRef.current.value);
    if (!active) return;

    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      // Clamp so a backgrounded tab doesn't resume with a giant jump.
      const delta = Math.min(now - last, 64);
      last = now;
      const power = powerRef.current;
      let next = power.value + power.direction * POWER_SPEED * delta;
      if (next >= POWER_MAX) {
        next = POWER_MAX;
        power.direction = -1;
      } else if (next <= POWER_MIN) {
        next = POWER_MIN;
        power.direction = 1;
      }
      power.value = next;
      paint(next);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [powerRef, active]);

  return { fillRef, valueRef };
}

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
  const [session] = useState(() => new BattleSession(runtime, coordinator));
  const [game, setGame] = useState<BeybladeState>(runtime.state);
  const [online, setOnline] = useState<OnlineMatchState>(coordinator.state);
  const [mode, setMode] = useState<AppMode>("menu");
  const modeRef = useRef<AppMode>("menu");
  const presentation = useBattlePresentation(runtime, coordinator, modeRef);
  const [gamePublisher] = useState(() => new HudPublisher(setGame));
  const [onlinePublisher] = useState(() => new HudPublisher(setOnline));
  const [playerType, setPlayerType] = useState<BeybladeType>("attack");
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [customPartsMap, setCustomPartsMap] = useState<
    Partial<Record<BeybladeType, CustomBeybladeConfig>>
  >(
    () =>
      loadCustomParts() as Partial<Record<BeybladeType, CustomBeybladeConfig>>,
  );

  const currentConfig = useMemo<CustomBeybladeConfig>(
    () => resolveCustomConfig(playerType, customPartsMap[playerType]),
    [customPartsMap, playerType],
  );

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
  const [countdownNow, setCountdownNow] = useState(0);
  const [showIntro, setShowIntro] = useState(true);
  const [lobbyOpen, setLobbyOpen] = useState(false);
  const [scene, setScene] = useState<EnvironmentScene>(() =>
    environmentSceneForStadium("neon"),
  );

  // The launch meter runs at 60fps. Keeping it in a ref (and painting it
  // imperatively, see usePowerMeter) avoids re-rendering the whole app — and
  // the 3D scene under it — on every frame.
  const powerRef = useRef<PowerState>({ value: POWER_START, direction: 1 });
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

  const onlineConfig = useMemo(
    () => onlineMatchConfig(online),
    [online.matchId, online.start],
  );

  const activeScene: EnvironmentScene = useMemo(() => {
    if (mode === "online" && online.start) return online.start.environment;
    return scene;
  }, [mode, online.start, scene]);

  useEffect(
    () =>
      coordinator.subscribe((state) => {
        const { view, ...flow } = state;
        onlinePublisher.update(
          state,
          JSON.stringify({
            ...flow,
            result: view.result,
            connectionUnstable: view.connectionUnstable,
          }),
          performance.now(),
        );
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
    [coordinator, runtime, onlinePublisher],
  );

  useEffect(
    () =>
      runtime.subscribe((event) => {
        if (event.type !== "stateChanged") return;
        const next = event.state;
        gamePublisher.update(next, next.phase, performance.now());
        if (modeRef.current === "online") session.publish(next);
      }),
    [runtime, gamePublisher, session],
  );

  useEffect(() => {
    if (mode === "online") session.prepare();
  }, [mode, online.matchId, online.phase, session]);

  useEffect(() => {
    if (
      mode !== "online" ||
      !["countdown", "battle", "ending"].includes(online.phase)
    )
      return;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      session.tick(now, (now - previous) / 1000);
      previous = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [session, mode, online.phase]);

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

  // The customizer is mounted outside the phase conditionals, so an opponent
  // leaving mid-selection would leave it floating over the termination screen.
  useEffect(() => {
    if (mode !== "online") return;
    if (online.phase === "matched" || online.phase === "waiting_ready") return;
    setIsCustomizerOpen(false);
  }, [mode, online.phase]);

  // An invite link (?room=CODE) goes straight into the friend room. The
  // parameter is dropped so reloading later does not rejoin a dead room.
  const invitedRoom = useRef(false);
  useEffect(() => {
    if (invitedRoom.current) return;
    invitedRoom.current = true;
    const code = readRoomCodeFromLocation();
    const resumeToken = code ? null : loadFriendRoomResumeToken();
    if (!code && !resumeToken) return;
    if (code) clearRoomParamFromUrl();
    resetMatchRefs();
    modeRef.current = "online";
    setMode("online");
    coordinator.connect(
      resolveWebSocketUrl(),
      code
        ? { kind: "join", code }
        : { kind: "create", resumeToken: resumeToken! },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinator]);

  useEffect(() => {
    if (online.roomResumeToken)
      saveFriendRoomResumeToken(online.roomResumeToken);
    if (
      online.phase === "matched" ||
      online.errorCode === "ROOM_EXPIRED" ||
      online.errorCode === "ROOM_IN_USE"
    )
      saveFriendRoomResumeToken(null);
  }, [online.errorCode, online.phase, online.roomResumeToken]);

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
        hostShouldLeaveWhenHidden(coordinator.state.phase)
      )
        leaveActiveSession();
    };
    const confirmActiveSessionExit = (event: BeforeUnloadEvent): void => {
      if (
        modeRef.current !== "online" ||
        !shouldWarnBeforeOnlineExit(coordinator.state.phase)
      )
        return;
      // Setting returnValue is still required by browsers that support the
      // standard preventDefault-based beforeunload confirmation.
      event.preventDefault();
      event.returnValue = true;
    };
    window.addEventListener("pagehide", leaveActiveSession);
    window.addEventListener("beforeunload", confirmActiveSessionExit);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", leaveActiveSession);
      window.removeEventListener("beforeunload", confirmActiveSessionExit);
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
  function resetMatchRefs(): void {
    session.reset();
    powerRef.current = { value: POWER_START, direction: 1 };
  }

  function prepareLocal(): void {
    preloadBattleScene();
    synth.click();
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
        aiSpecialTopIds: [opponentTopId(LOCAL_TOP_ID)],
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
    synth.click();
    const offset = () =>
      (Math.random() > 0.5 ? 1 : -1) * (15 + Math.random() * 15);
    runtime.dispatch({
      type: "launch",
      launch: {
        p1Power: powerRef.current.value,
        p1Angle: offset(),
        p2Power: 60 + Math.random() * 30,
        p2Angle: 180 + offset(),
      },
    });
  }

  function fireSpecial(): void {
    if (mode === "local") {
      runtime.dispatch({ type: "special", top: LOCAL_TOP_ID });
    } else if (online.role === "host" && online.localTopId) {
      runtime.dispatch({ type: "special", top: online.localTopId });
    } else if (online.role === "guest") {
      coordinator.requestSpecial();
    }
  }

  function openOnlineLobby(): void {
    synth.click();
    setLobbyOpen(true);
  }

  function beginOnline(choice: OnlineLobbyChoice): void {
    preloadBattleScene();
    synth.click();
    setLobbyOpen(false);
    // A rejected room code keeps the socket open in the lobby phase, so the
    // next attempt reuses that connection instead of reconnecting.
    if (modeRef.current === "online" && coordinator.state.phase === "lobby") {
      if (choice.kind === "join") coordinator.joinRoom(choice.code);
      else if (choice.kind === "create") coordinator.createRoom();
      else coordinator.joinQueue();
      return;
    }
    resetMatchRefs();
    modeRef.current = "online";
    setMode("online");
    coordinator.connect(
      resolveWebSocketUrl(),
      choice.kind === "join"
        ? { kind: "join", code: choice.code }
        : { kind: choice.kind },
    );
  }

  function rematchOnline(): void {
    synth.click();
    resetMatchRefs();
    coordinator.requestRematch();
  }

  function readyOnline(): void {
    if (online.phase !== "matched") return;
    synth.click();
    coordinator.ready({
      blade: playerType,
      name: customName.trim() || BEYBLADES[playerType].name,
      wins: record.wins,
      losses: record.losses,
      power: powerRef.current.value,
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
    saveFriendRoomResumeToken(null);
    coordinator.cancelQueue();
  }

  function returnToMenu(): void {
    synth.click();
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
  const specialMoves = useMemo(
    () =>
      sceneConfig
        ? {
            p1: specialMoveFor(sceneConfig.p1Type, sceneConfig.p1ChipId),
            p2: specialMoveFor(sceneConfig.p2Type, sceneConfig.p2ChipId),
          }
        : null,
    [sceneConfig],
  );
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
      className={`app mode-${mode} phase-${
        mode === "online" ? onlinePhase : game.phase
      }`}
    >
      {showIntro && <IntroScreen onComplete={() => setShowIntro(false)} />}
      {showScene && sceneConfig && (
        <BattleScene
          config={sceneConfig}
          phase={scenePhase}
          readFrame={presentation.read}
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
            onOnline={openOnlineLobby}
            customSpec={customSpec}
            selectedBladeId={selectedBladeId}
            onBladeIdChange={(bladeId) =>
              handleCustomConfigChange({ ...currentConfig, bladeId })
            }
            onOpenCustomizer={() => setIsCustomizerOpen(true)}
          />
        )}

        {isCustomizerOpen && (
          <PartCustomizerModal
            isOpen={isCustomizerOpen}
            onClose={() => setIsCustomizerOpen(false)}
            beybladeType={playerType}
            config={currentConfig}
            onChangeConfig={handleCustomConfigChange}
          />
        )}

        {mode === "local" && game.phase === "launch" && (
          <LaunchScreen powerRef={powerRef} onLaunch={launchLocal} />
        )}

        {(lobbyOpen || (mode === "online" && onlinePhase === "lobby")) && (
          <OnlineLobby
            error={onlinePhase === "lobby" ? online.error : null}
            onSelect={beginOnline}
            onClose={returnToMenu}
          />
        )}

        {mode === "online" && onlinePhase === "hosting" && online.roomCode && (
          <OnlineRoomCode code={online.roomCode} onCancel={cancelQueue} />
        )}

        {mode === "online" &&
          (onlinePhase === "connecting" ||
            onlinePhase === "queued" ||
            onlinePhase === "joining") && (
            <OnlineOverlay
              eyebrow={onlinePhase === "queued" ? "MATCHMAKING" : "CONNECTING"}
              title={
                onlinePhase === "queued"
                  ? "正在尋找對手"
                  : onlinePhase === "joining"
                    ? "正在加入好友房"
                    : "正在連線至競技場"
              }
              detail={
                onlinePhase === "queued"
                  ? "找到對手前會持續等待。"
                  : "請稍候片刻。"
              }
              busy
            >
              <button onClick={cancelQueue}>取消</button>
            </OnlineOverlay>
          )}

        {mode === "online" &&
          (onlinePhase === "matched" || onlinePhase === "waiting_ready") && (
            <OnlineSelection
              // A rematch arrives as a fresh match id. Remounting resets the
              // friend room back to its blade-selection step.
              key={online.matchId ?? "pending"}
              online={online}
              powerRef={powerRef}
              playerType={playerType}
              onBlade={handleBladeChange}
              customColor={customColor}
              onCustomColorChange={setCustomColor}
              customSpec={customSpec}
              onOpenCustomizer={() => setIsCustomizerOpen(true)}
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
            moves={specialMoves}
            canSpecial={game.phase === "battle"}
            onSpecial={fireSpecial}
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
              moves={specialMoves}
              canSpecial={onlinePhase === "battle"}
              onSpecial={fireSpecial}
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
            {...(online.rematchAvailable
              ? {
                  onRematch: rematchOnline,
                  rematchRequested: online.rematchRequested,
                  opponentRematch: online.opponentRematch,
                  rematchReselects: online.roomKind === "friend",
                }
              : {})}
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
  customSpec?: BeybladeSpec | undefined;
  selectedBladeId: string;
  onBladeIdChange: (id: string) => void;
  onOpenCustomizer?: () => void;
}) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isExploded, setIsExploded] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>("default");

  const handleCycleCameraPreset = () => {
    synth.click();
    const order = PREVIEW_CAMERA_PRESET_ORDER;
    const currentIndex = order.indexOf(cameraPreset);
    const nextPreset = order[(currentIndex + 1) % order.length] ?? "default";
    setCameraPreset(nextPreset);
  };

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isMuted, setIsMuted] = useState(() => synth.isMuted);
  const [isBGMMuted, setIsBGMMuted] = useState(() => synth.isBGMMuted);

  const totalMatches = record.wins + record.losses;
  const winRate = totalMatches > 0 ? (record.wins / totalMatches) * 100 : 0;
  const bladeModel = useMemo(
    () => buildBladeSelectionViewModel(playerType, customSpec),
    [customSpec, playerType],
  );

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
        model={bladeModel}
        onChange={onBlade}
        customName={customName}
        onCustomNameChange={onCustomNameChange}
        customColor={customColor}
        onCustomColorChange={onCustomColorChange}
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
      <BladeDetails model={bladeModel} />
      <div className="mode-actions">
        <button className="primary start" onClick={onOnline}>
          {NON_BATTLE_COPY.onlineAction}
        </button>
        <button className="secondary start" onClick={onLocal}>
          {NON_BATTLE_COPY.localAction}
        </button>
      </div>
      <p className="credits">{NON_BATTLE_COPY.footer}</p>

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
          <p>© 2026 DONGSTUDIO. All rights reserved.</p>
        </div>
      </div>


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
      <p className="eyebrow">{NON_BATTLE_COPY.brandEyebrow}</p>
      <h1>{NON_BATTLE_COPY.brandTitle}</h1>
      <p>{NON_BATTLE_COPY.brandSubtitle}</p>
    </header>
  );
}

function BladePicker({
  model,
  onChange,
  customName,
  onCustomNameChange,
  customColor,
  onCustomColorChange,
  disabled = false,
}: {
  model: BladeSelectionViewModel;
  onChange: (type: BeybladeType) => void;
  customName?: string;
  onCustomNameChange?: (name: string) => void;
  customColor?: number | null;
  onCustomColorChange?: (color: number | null) => void;
  disabled?: boolean;
}) {
  const value = model.selectedType;
  const selected = model.details;
  const keys = model.items
    .filter((item) => item.type !== null)
    .map((item) => item.type!);
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
          <p className="eyebrow">{model.eyebrow}</p>
          <h2>{model.title}</h2>
        </div>
        <span className="garage-counter">{model.counter}</span>
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
            {model.items.map((item) => {
              if (item.type === null) return null;
              const type = item.type;
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
                  <span className="blade-chip-emblem">
                    <BladeMiniIcon type={type} />
                  </span>
                  <div className="blade-card-info">
                    <span className="blade-type">{type.toUpperCase()}</span>
                    <strong>{blade.name}</strong>
                    <small>{blade.englishName}</small>
                  </div>
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
      {customColor !== undefined &&
        onCustomColorChange &&
        (() => {
          const baseColor = BEYBLADES[value].color;
          const darkColor = darkenColor(baseColor);
          const options: {
            key: string;
            label: string;
            color: number | null;
            display: string;
          }[] = [
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

function BladeDetails({ model }: { model: BladeSelectionViewModel }) {
  const selected = model.details;
  const color = `#${selected.color.toString(16).padStart(6, "0")}`;

  return (
    <article
      className="blade-detail standalone-blade-detail"
      style={{ "--blade-color": color } as React.CSSProperties}
    >
      <div className="blade-detail-copy">
        <p className="eyebrow">{selected.englishName}</p>
        <h3>{selected.name}</h3>
        <p>{selected.description}</p>
      </div>
      <div className="stat-grid">
        {selected.stats.map((stat) => (
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

/**
 * The pre-battle screen. A friend room gets a blade-and-parts step first, so
 * both players can counter their opponent's last pick before locking in; the
 * public queue keeps the single-page launch meter it always had. The parent
 * remounts this with a `key` on the match id, so a rematch starts over at the
 * first step.
 */
function OnlineSelection({
  online,
  powerRef,
  playerType,
  onBlade,
  customColor,
  onCustomColorChange,
  customSpec,
  onOpenCustomizer,
  onReady,
  onLeave,
}: {
  online: OnlineMatchState;
  powerRef: RefObject<PowerState>;
  playerType: BeybladeType;
  onBlade: (type: BeybladeType) => void;
  customColor: number | null;
  onCustomColorChange: (color: number | null) => void;
  customSpec?: BeybladeSpec | undefined;
  onOpenCustomizer: () => void;
  onReady: () => void;
  onLeave: () => void;
}) {
  const canSelectBlade = online.roomKind === "friend";
  const locked = online.phase === "waiting_ready";
  const [step, setStep] = useState<"select" | "power">(
    canSelectBlade ? "select" : "power",
  );
  // The meter is a timing minigame, so it must not swing while the player is
  // browsing blades — it only starts once they commit to a top.
  const meter = usePowerMeter(powerRef, step === "power" && !locked);
  const bladeModel = useMemo(
    () => buildBladeSelectionViewModel(playerType, customSpec),
    [customSpec, playerType],
  );
  const copy = buildOnlinePreparationCopy({
    step,
    canSelectBlade,
    locked,
    opponentReady: online.opponentReady,
  });

  if (step === "select") {
    return (
      <section className="screen menu-screen online-selection">
        <header className="online-heading">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.detail}</p>
        </header>
        <BladePicker
          model={bladeModel}
          onChange={onBlade}
          customColor={customColor}
          onCustomColorChange={onCustomColorChange}
        />
        <div className="garage-preview-stage">
          <div className="preview-controls-bar">
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
          </div>
          <BladePreviewScene
            type={playerType}
            color={customColor}
            customSpec={customSpec}
          />
        </div>
        <BladeDetails model={bladeModel} />
        <div className="online-ready-actions">
          <button
            className="primary"
            onClick={() => {
              synth.click();
              setStep("power");
            }}
          >
            {copy.primaryAction}
          </button>
          <button onClick={onLeave}>{copy.leaveAction}</button>
        </div>
        <p className="credits">{copy.opponentLabel}</p>
      </section>
    );
  }

  return (
    <section className="screen menu-screen online-selection">
      <header className="online-heading">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.detail}</p>
      </header>
      <div className="online-ready-panel">
        <PowerMeter fillRef={meter.fillRef} />
        <div className="online-ready-copy">
          <span>{copy.opponentLabel}</span>
          <strong className="power-value" ref={meter.valueRef} />
        </div>
        <div className="online-ready-actions">
          <button disabled={locked} className="primary" onClick={onReady}>
            {copy.primaryAction}
          </button>
          {canSelectBlade && (
            <button
              disabled={locked}
              onClick={() => {
                synth.click();
                setStep("select");
              }}
            >
              {copy.secondaryAction}
            </button>
          )}
          <button onClick={onLeave}>{copy.leaveAction}</button>
        </div>
      </div>
    </section>
  );
}

function LaunchScreen({
  powerRef,
  onLaunch,
}: {
  powerRef: RefObject<PowerState>;
  onLaunch: () => void;
}) {
  const meter = usePowerMeter(powerRef, true);
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
          <strong className="power-value" ref={meter.valueRef} />
        </div>
        <PowerMeter fillRef={meter.fillRef} />
        <small>85–95% 完美發射可獲得額外轉速</small>
      </div>
    </button>
  );
}

function PowerMeter({
  fillRef,
}: {
  fillRef: RefObject<HTMLSpanElement | null>;
}) {
  return (
    <div className="power-track">
      <span className="perfect-zone" />
      <span className="power-fill" ref={fillRef} />
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
  moves,
  canSpecial,
  onSpecial,
  onExit,
}: {
  snapshot: BattleSnapshot;
  localTopId: TopId;
  localLabel: string;
  opponentLabel: string;
  moves: Record<TopId, SpecialMove> | null;
  canSpecial: boolean;
  onSpecial: () => void;
  onExit: () => void;
}) {
  const remaining = Math.max(0, Math.ceil(20 - snapshot.elapsed));
  const opponentId = opponentTopId(localTopId);
  const local = snapshot[localTopId];
  const localSpecial = local.special;
  const specialReady =
    canSpecial &&
    Boolean(localSpecial && localSpecial.charge >= 1 && !localSpecial.used) &&
    !local.isBurst &&
    !local.isStopped &&
    !local.isOut;
  const cutIns = useSpecialCutIns(snapshot, localTopId, moves);

  useEffect(() => {
    if (!specialReady) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) return;
      event.preventDefault();
      onSpecial();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [specialReady, onSpecial]);

  return (
    <section className="hud">
      <div className="hud-top">
        <strong className={remaining <= 5 ? "critical" : ""}>
          {remaining}
        </strong>
        <button onClick={onExit}>退出戰鬥</button>
      </div>
      <div className="special-cutins" role="status">
        {cutIns.map((cutIn) => (
          <div
            key={cutIn.key}
            className={`special-cutin ${cutIn.mine ? "mine" : "theirs"}`}
          >
            <small>{cutIn.mine ? "絕招發動" : "對手絕招"}</small>
            <strong>{cutIn.name}！</strong>
          </div>
        ))}
      </div>
      {moves && (
        <SpecialButton
          move={moves[localTopId]}
          charge={localSpecial?.charge ?? 0}
          used={localSpecial?.used ?? false}
          active={localSpecial?.active ?? false}
          ready={specialReady}
          onFire={onSpecial}
        />
      )}
      <div className="hud-bottom">
        <TopHud top={snapshot[localTopId]} label={localLabel} />
        <span className="versus">VS</span>
        <TopHud top={snapshot[opponentId]} label={opponentLabel} reverse />
      </div>
    </section>
  );
}

/** Flashes a move's name when either top's special switches on. */
function useSpecialCutIns(
  snapshot: BattleSnapshot,
  localTopId: TopId,
  moves: Record<TopId, SpecialMove> | null,
) {
  const [cutIns, setCutIns] = useState<
    { key: number; name: string; mine: boolean }[]
  >([]);
  const previous = useRef({ p1: false, p2: false });
  const p1Active = snapshot.p1.special?.active ?? false;
  const p2Active = snapshot.p2.special?.active ?? false;
  useEffect(() => {
    for (const [id, active] of [
      ["p1", p1Active],
      ["p2", p2Active],
    ] as const) {
      if (active && !previous.current[id] && moves) {
        // Both sides can fire within a beat; stack instead of replacing.
        const cutIn = {
          key: performance.now(),
          name: moves[id].name,
          mine: id === localTopId,
        };
        setCutIns((current) => [...current, cutIn]);
        window.setTimeout(
          () =>
            setCutIns((current) => current.filter((item) => item !== cutIn)),
          1000,
        );
      }
      previous.current[id] = active;
    }
  }, [p1Active, p2Active, localTopId, moves]);
  return cutIns;
}

function SpecialButton({
  move,
  charge,
  used,
  active,
  ready,
  onFire,
}: {
  move: SpecialMove;
  charge: number;
  used: boolean;
  active: boolean;
  ready: boolean;
  onFire: () => void;
}) {
  const fill = used ? 0 : Math.max(0, Math.min(1, charge));
  const state = active
    ? "active"
    : ready
      ? "ready"
      : used
        ? "used"
        : "charging";
  return (
    <button
      type="button"
      className={`special-button ${state}`}
      style={{ "--charge": `${fill * 360}deg` } as React.CSSProperties}
      disabled={!ready}
      onClick={onFire}
      aria-label={`絕招：${move.name}${ready ? "（空白鍵）" : ""}`}
      title={move.description}
    >
      <span className="special-core">
        <strong>{move.name}</strong>
        <small>
          {active
            ? "發動中"
            : used
              ? "已使用"
              : ready
                ? "SPACE"
                : `${Math.floor(fill * 100)}%`}
        </small>
      </span>
    </button>
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
  /** Friend rooms return to blade selection, so the button says so. */
  rematchReselects?: boolean;
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
          {resultOutcomeCopy(outcome)}
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
          {onRematch && (
            <button
              className="primary"
              disabled={rematchRequested}
              onClick={onRematch}
            >
              {!online
                ? "再戰一局"
                : rematchRequested
                  ? "等待對手回應…"
                  : opponentRematch
                    ? "對手想再戰，接受"
                    : rematchReselects
                      ? "再戰（可重選陀螺）"
                      : "再來一場"}
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

  // Pay one-time setup costs behind the intro instead of on the first
  // "start battle" tap.
  useEffect(() => {
    preloadBattleScene();
    try {
      synth.prepare();
    } catch {
      // Web Audio unavailable; the synth retries on first use.
    }
  }, []);

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
        <p className="eyebrow glow">DONGSTUDIO PRESENTS</p>
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
