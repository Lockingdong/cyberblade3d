/* eslint-disable react-hooks/set-state-in-effect, react-hooks/purity */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  BEYBLADES,
  BeybladeRuntime,
  EMPTY_BATTLE_RECORD,
  PLAYER_COLOR_PALETTE,
  applyBattleOutcome,
  beybladeDisplayStats,
  buildShareCardData,
  formatBattleRecord,
  localMatchOutcome,
  opponentTopId,
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
} from "@game-pool/beyblade-core";
import {
  MatchmakingClient,
  OnlineMatchCoordinator,
  type OnlineMatchState,
} from "@game-pool/beyblade-multiplayer";
import { CannonBattleSimulation } from "@game-pool/beyblade-simulation";
import { colors, radius, spacing } from "@game-pool/design-system";
import { BattleScene } from "./src/BattleScene";
import { BladePreviewScene } from "./src/BladePreviewScene";
import { ShareCardModal } from "./src/ShareCard";
import {
  RemoteFeedbackDeduper,
  battleFeedback,
  selectionFeedback,
} from "./src/feedback";
import {
  createMobileWebSocket,
  resolveMobileWebSocketUrl,
  shouldHostLeaveForAppState,
} from "./src/online";

const LOCAL_TOP_ID: TopId = "p1";
type AppMode = "menu" | "local" | "online";
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
  // Session-only custom accent color, matching the session-only record above.
  const [customColor, setCustomColor] = useState<number | null>(null);
  // Session-only record: mobile has no storage dependency, so this resets on
  // app restart. Web persists its record in localStorage.
  const [record, setRecord] = useState<BattleRecord>(EMPTY_BATTLE_RECORD);
  const [scene, setScene] = useState<EnvironmentScene>(() =>
    pickRandomEnvironmentScene(),
  );
  const [power, setPower] = useState(20);
  const [countdownNow, setCountdownNow] = useState(0);
  const [connectionError, setConnectionError] = useState<string | null>(null);

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

  const powerActive =
    (mode === "local" && game.phase === "launch") ||
    (mode === "online" && online.phase === "matched");
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

  function startOnline(): void {
    selectionFeedback();
    resetMatchRefs();
    modeRef.current = "online";
    setMode("online");
    try {
      coordinator.connect(resolveMobileWebSocketUrl());
    } catch (error) {
      setConnectionError(
        error instanceof Error ? error.message : "無法讀取線上對戰設定。",
      );
    }
  }

  function readyOnline(): void {
    if (online.phase !== "matched") return;
    selectionFeedback();
    coordinator.ready({
      blade: playerType,
      name: BEYBLADES[playerType].name,
      wins: record.wins,
      losses: record.losses,
      power,
      angle: Math.random() * 60 - 30,
      stadium: "neon",
      ...(customColor !== null ? { color: customColor } : {}),
    });
  }

  function returnToMenu(): void {
    selectionFeedback();
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
      <StatusBar barStyle="light-content" />
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
          record={record}
          onLocal={prepareLocal}
          onOnline={startOnline}
        />
      )}

      {mode === "local" && game.phase === "launch" && (
        <LaunchScreen power={power} onLaunch={launchLocal} />
      )}

      {mode === "online" &&
        !connectionError &&
        ["connecting", "queued"].includes(online.phase) && (
          <Overlay
            eyebrow={
              online.phase === "connecting" ? "CONNECTING" : "MATCHMAKING"
            }
            title={
              online.phase === "connecting"
                ? "正在連線至競技場"
                : "正在尋找對手"
            }
            detail="找到對手前會持續等待。"
          >
            <Action
              label="取消配對"
              onPress={() => coordinator.cancelQueue()}
            />
          </Overlay>
        )}

      {mode === "online" &&
        ["matched", "waiting_ready"].includes(online.phase) && (
          <OnlineSelection
            online={online}
            power={power}
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
            p1: BEYBLADES[playerType].name,
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
  customColor,
  onCustomColor,
  record,
  onLocal,
  onOnline,
}: {
  playerType: BeybladeType;
  onPlayerType: (type: BeybladeType) => void;
  customColor: number | null;
  onCustomColor: (color: number | null) => void;
  record: BattleRecord;
  onLocal: () => void;
  onOnline: () => void;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.menu}>
        <Text style={styles.eyebrow}>GAME POOL PRESENTS</Text>
        <Text style={styles.title}>CYBERBLADE 3D</Text>
        <Text style={styles.subtitle}>極限爆裂對決</Text>
        {(record.wins > 0 || record.losses > 0) && (
          <Text style={styles.playerRecord}>
            線上戰績 {formatBattleRecord(record)}
          </Text>
        )}
        <View style={styles.menuPreview}>
          <BladePreviewScene type={playerType} color={customColor} />
        </View>
        <BladePicker value={playerType} onChange={onPlayerType} />
        <ColorPalette value={customColor} onChange={onCustomColor} />
        <Action label="線上對戰" primary onPress={onOnline} />
        <Action label="單機 VS AI" onPress={onLocal} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ColorPalette({
  value,
  onChange,
  disabled = false,
}: {
  value: number | null;
  onChange: (color: number | null) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.colorField}>
      <Text style={styles.colorFieldLabel}>自訂顏色</Text>
      <View style={styles.colorPalette}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="使用預設顏色"
          disabled={disabled}
          onPress={() => {
            selectionFeedback();
            onChange(null);
          }}
          style={[
            styles.colorSwatch,
            styles.colorSwatchDefault,
            value === null && styles.colorSwatchActive,
            disabled && styles.disabled,
          ]}
        >
          <Text style={styles.colorSwatchDefaultMark}>×</Text>
        </Pressable>
        {PLAYER_COLOR_PALETTE.map((paletteColor) => {
          const hex = `#${paletteColor.toString(16).padStart(6, "0")}`;
          const isActive = value === paletteColor;
          return (
            <Pressable
              key={paletteColor}
              accessibilityRole="button"
              accessibilityLabel={`選擇顏色 ${hex}`}
              disabled={disabled}
              onPress={() => {
                selectionFeedback();
                onChange(paletteColor);
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
  value,
  onChange,
  disabled = false,
}: {
  value: BeybladeType;
  onChange: (type: BeybladeType) => void;
  disabled?: boolean;
}) {
  const selected = BEYBLADES[value];
  const selectedColor = `#${selected.color.toString(16).padStart(6, "0")}`;
  const stats = beybladeDisplayStats(value);
  return (
    <>
      <View style={styles.garageHeading}>
        <View>
          <Text style={styles.eyebrow}>SELECT YOUR BLADE</Text>
          <Text style={styles.sectionTitle}>選擇戰鬥陀螺</Text>
        </View>
        <Text style={styles.garageCounter}>
          {Object.keys(BEYBLADES).indexOf(value) + 1} /{" "}
          {String(Object.keys(BEYBLADES).length).padStart(2, "0")}
        </Text>
      </View>
      <View style={styles.selectedBladePanel}>
        <View style={styles.selectedCopy}>
          <Text style={[styles.eyebrow, { color: selectedColor }]}>
            {selected.englishName}
          </Text>
          <Text style={styles.selectedName}>{selected.name}</Text>
          <Text style={styles.muted}>{descriptions[value]}</Text>
        </View>
        <View style={styles.statGrid}>
          {stats.map((stat) => (
            <View style={styles.statItem} key={stat.key}>
              <View style={styles.row}>
                <Text style={styles.statLabel}>{stat.label}</Text>
                <Text style={styles.statValue}>{stat.displayValue}</Text>
              </View>
              <View style={styles.statTrack}>
                <View
                  style={[styles.statFill, { width: `${stat.ratio * 100}%` }]}
                />
              </View>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.bladeGrid}>
        {(Object.keys(BEYBLADES) as BeybladeType[]).map((type) => {
          const blade = BEYBLADES[type];
          return (
            <Pressable
              key={type}
              disabled={disabled}
              style={[
                styles.bladeCard,
                value === type && {
                  borderColor: `#${blade.color.toString(16).padStart(6, "0")}`,
                },
                disabled && styles.disabled,
              ]}
              onPress={() => {
                selectionFeedback();
                onChange(type);
              }}
            >
              <View
                style={[
                  styles.bladeMiniPreview,
                  {
                    borderColor: `#${blade.color.toString(16).padStart(6, "0")}`,
                  },
                ]}
              />
              <Text style={styles.bladeName}>{blade.name}</Text>
              <Text style={styles.bladeType}>{type.toUpperCase()}</Text>
              <Text style={styles.bladeStats}>
                {blade.maxRpm} RPM · {blade.maxStability} STB
              </Text>
            </Pressable>
          );
        })}
      </View>
    </>
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
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.menu}>
        <Text style={styles.title}>準備戰鬥</Text>
        <Text style={styles.subtitle}>
          {locked
            ? online.opponentReady
              ? "雙方已準備，等待伺服器開始"
              : "已鎖定發射，等待對手"
            : online.opponentReady
              ? "對手已準備，輪到你了"
              : "鎖定發射力道"}
        </Text>
        <PowerMeter power={power} />
        <View style={styles.readyCopy}>
          <Text style={styles.muted}>
            {online.opponentReady ? "對手 READY" : "等待對手 READY"}
          </Text>
          <Text style={styles.powerText}>{Math.round(power)}%</Text>
        </View>
        <Action
          label={locked ? "已鎖定發射" : "鎖定發射並準備"}
          primary
          disabled={locked}
          onPress={onReady}
        />
        <Action label="離開房間" onPress={onLeave} />
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
          {outcome === "victory"
            ? "VICTORY"
            : outcome === "defeat"
              ? "DEFEAT"
              : "DRAW"}
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
        {!online && onRematch && (
          <Action label="再戰一局" primary onPress={onRematch} />
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
  return (
    <Pressable
      disabled={disabled}
      style={[
        primary ? styles.primary : styles.secondary,
        online && styles.onlineButton,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
    >
      <Text
        style={primary || online ? styles.primaryText : styles.secondaryText}
      >
        {label}
      </Text>
    </Pressable>
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
  root: { flex: 1, backgroundColor: "#020106" },
  safe: { flex: 1, backgroundColor: "#020106" },
  // Static darkening layered above the GL scene to reinforce the vignette
  // (the Expo GL renderer doesn't run postprocessing, so this CSS-side
  // overlay is the closest equivalent).
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
  menu: { alignItems: "center", padding: spacing.lg, paddingBottom: 48 },
  eyebrow: {
    color: "#39ff14",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 3,
  },
  title: {
    marginTop: spacing.sm,
    color: colors.text,
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: -2,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 4,
    color: colors.muted,
    letterSpacing: 1,
    textAlign: "center",
  },
  playerRecord: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#414a69",
    borderRadius: 99,
    color: "#c9d2ef",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
  sectionTitle: {
    alignSelf: "flex-start",
    marginTop: spacing.xl,
    marginBottom: 12,
    color: colors.text,
    fontWeight: "800",
    letterSpacing: 2,
  },
  bladeGrid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  bladeCard: {
    width: "48.5%",
    minHeight: 135,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#303750",
    borderRadius: radius.lg,
    backgroundColor: "#111427",
  },
  bladeIcon: { fontSize: 30 },
  bladeName: { marginTop: 8, color: colors.text, fontWeight: "800" },
  bladeType: {
    marginTop: 2,
    color: "#00f0ff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  bladeStats: { marginTop: 8, color: colors.muted, fontSize: 10 },
  disabled: { opacity: 0.45 },
  colorField: {
    width: "100%",
    marginTop: spacing.md,
    gap: 8,
  },
  colorFieldLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  colorPalette: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  colorSwatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: "rgba(248, 249, 251, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  colorSwatchActive: {
    borderColor: "#f8f9fb",
    borderWidth: 3,
  },
  colorSwatchDefault: {
    backgroundColor: "transparent",
  },
  colorSwatchDefaultMark: {
    color: colors.muted,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 20,
  },
  primary: {
    width: "100%",
    marginTop: spacing.lg,
    padding: 16,
    alignItems: "center",
    borderRadius: radius.md,
    backgroundColor: "#713cff",
  },
  onlineButton: {
    width: "100%",
    marginTop: 10,
    padding: 16,
    alignItems: "center",
    borderRadius: radius.md,
    backgroundColor: "#007d91",
  },
  primaryText: { color: colors.text, fontWeight: "900" },
  secondary: {
    width: "100%",
    marginTop: 10,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#414a69",
    borderRadius: radius.md,
    backgroundColor: "#101426",
  },
  secondaryText: { color: colors.text, fontWeight: "700" },
  launchScreen: { ...StyleSheet.absoluteFill, backgroundColor: "#02010688" },
  launchContent: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: "space-between",
  },
  centered: { alignItems: "center", marginTop: 80 },
  launchTitle: {
    marginTop: 8,
    color: colors.text,
    fontSize: 42,
    fontWeight: "900",
  },
  muted: { marginTop: 6, color: colors.muted, textAlign: "center" },
  powerCard: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "#414a69",
    borderRadius: radius.lg,
    backgroundColor: "#090b16e8",
  },
  row: { flexDirection: "row", justifyContent: "space-between" },
  readyCopy: {
    width: "100%",
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardLabel: { color: colors.text, fontWeight: "800", letterSpacing: 2 },
  powerText: { color: "#39ff14", fontWeight: "900" },
  powerTrack: {
    width: "100%",
    height: 20,
    marginTop: 12,
    overflow: "hidden",
    borderRadius: 99,
    backgroundColor: "#252a3d",
  },
  perfectZone: {
    position: "absolute",
    left: "85%",
    width: "10%",
    height: "100%",
    backgroundColor: "#39ff1455",
  },
  powerFill: { height: "100%", backgroundColor: "#8e2dff" },
  hint: {
    marginTop: 10,
    color: colors.muted,
    fontSize: 11,
    textAlign: "center",
  },
  hud: { flex: 1, justifyContent: "space-between" },
  hudTop: {
    padding: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timer: {
    marginLeft: "43%",
    color: colors.text,
    fontSize: 34,
    fontWeight: "900",
    textShadowColor: "#00f0ff",
    textShadowRadius: 10,
  },
  exit: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "#414a69",
    borderRadius: radius.md,
    backgroundColor: "#090b16cc",
  },
  hudBottom: { padding: spacing.md, gap: 8 },
  topHud: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#00f0ff66",
    borderRadius: radius.md,
    backgroundColor: "#050713e8",
  },
  hudName: { color: colors.text, fontWeight: "800" },
  meter: { marginTop: 7 },
  meterText: { color: colors.muted, fontSize: 10 },
  meterTrack: {
    height: 6,
    marginTop: 3,
    overflow: "hidden",
    borderRadius: 9,
    backgroundColor: "#30364a",
  },
  meterFill: { height: "100%", backgroundColor: "#00f0ff" },
  dangerFill: { backgroundColor: "#ff4d71" },
  overlay: {
    flex: 1,
    padding: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#020106cc",
  },
  resultCard: {
    width: "100%",
    padding: spacing.xl,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#4a5270",
    borderRadius: radius.lg,
    backgroundColor: "#090b16f5",
  },
  overlayTitle: {
    marginTop: 12,
    color: colors.text,
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
  },
  countdown: {
    marginTop: 12,
    color: "#39ff14",
    fontSize: 72,
    fontWeight: "900",
  },
  resultTitle: {
    marginTop: 8,
    color: colors.text,
    fontSize: 48,
    fontWeight: "900",
  },
  win: { color: "#39ff14" },
  lose: { color: "#ff2a5f" },
  finish: {
    marginVertical: spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
    color: "#ffea00",
    borderWidth: 1,
    borderColor: "#ffea00",
    borderRadius: 99,
    fontSize: 11,
    fontWeight: "900",
  },
  resultName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  connectionWarning: {
    position: "absolute",
    top: 54,
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: "#8f351cee",
  },
  warningText: { color: colors.text, fontSize: 12, fontWeight: "800" },
  garageHeading: {
    width: "100%",
    marginTop: spacing.xl,
    paddingBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: "#dfe3eb",
  },
  garageCounter: {
    color: "#009bd6",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  menuPreview: {
    width: "100%",
    height: 330,
    marginTop: spacing.sm,
    backgroundColor: "transparent",
  },
  selectedBladePanel: {
    width: "100%",
    marginTop: spacing.md,
    padding: spacing.md,
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: 2,
    borderColor: "#1f2235",
    borderRadius: 8,
    backgroundColor: "#f8f9fb",
  },
  previewColumn: {
    width: "100%",
    minHeight: 300,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#dfe3eb",
  },
  previewLabel: {
    color: "#6c7488",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
  },
  bladePreview: {
    width: 112,
    height: 112,
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderRadius: 99,
    backgroundColor: "#fff",
  },
  bladePreviewCanvas: { width: "100%", height: 260, marginTop: 8 },
  previewArc: {
    position: "absolute",
    width: 92,
    height: 58,
    borderWidth: 8,
    borderLeftColor: "transparent",
    borderRadius: 99,
    transform: [{ rotate: "25deg" }],
  },
  previewArcInner: {
    position: "absolute",
    width: 62,
    height: 40,
    borderWidth: 4,
    borderRightColor: "transparent",
    borderRadius: 99,
    transform: [{ rotate: "-25deg" }],
  },
  previewCore: {
    width: 22,
    height: 22,
    borderWidth: 4,
    borderColor: "#1f2235",
    borderRadius: 99,
  },
  previewType: {
    marginTop: 12,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
  },
  selectedCopy: {
    flex: 1,
    minWidth: 130,
    paddingLeft: spacing.md,
    justifyContent: "center",
  },
  selectedName: {
    marginTop: 4,
    color: "#1f2235",
    fontSize: 24,
    fontWeight: "900",
  },
  statGrid: {
    width: "100%",
    marginTop: spacing.md,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statItem: { width: "47%" },
  statLabel: { color: "#6c7488", fontSize: 10, fontWeight: "800" },
  statValue: { color: "#1f2235", fontSize: 9, fontWeight: "800" },
  statTrack: {
    height: 6,
    marginTop: 4,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1f2235",
    borderRadius: 2,
    backgroundColor: "#e4e7ed",
  },
  statFill: { height: "100%", backgroundColor: "#009bd6" },
  bladeMiniPreview: {
    width: 25,
    height: 25,
    marginBottom: 4,
    borderWidth: 2,
    borderRadius: 99,
    backgroundColor: "#fff",
  },
});
