import type {
  BattleSnapshot,
  EnvironmentScene,
  MatchTermination,
  MatchResult,
  SimulationEvent,
  TopId,
} from "@game-pool/beyblade-core";
import type {
  MatchmakingClientEvent,
  ReadySelection,
} from "./matchmaking-client";
import { SnapshotTimeline, type TimelineSample } from "./snapshot-timeline";
import type {
  BattleEventMessage,
  MatchEndMessage,
  ServerMessage,
  StartSelection,
} from "./protocol";

export type OnlinePhase =
  | "idle"
  | "connecting"
  | "queued"
  | "matched"
  | "waiting_ready"
  | "countdown"
  | "battle"
  | "ending"
  | "result"
  | "error";

export interface OnlineTransport {
  connect(url: string): void;
  joinQueue(): string;
  cancelQueue(): void;
  ready(selection: ReadySelection): void;
  leave(): void;
  sendHostSnapshot(snapshot: BattleSnapshot): number;
  sendHostEvent(
    event:
      | Exclude<SimulationEvent, { readonly type: "trail" }>
      | {
          readonly type: "ending";
          readonly winnerId: MatchResult["winnerId"];
          readonly finishType: MatchResult["finishType"];
        },
    stateSeq: number,
    t: number,
  ): number;
  sendMatchEnd(result: MatchResult, stateSeq: number, t: number): void;
  subscribe(listener: (event: MatchmakingClientEvent) => void): () => void;
  dispose(): void;
}

export interface OnlineBattleView {
  readonly snapshot: BattleSnapshot | null;
  readonly events: readonly BattleEventMessage[];
  readonly visualEvents: readonly SimulationEvent[];
  readonly eventsTick: number;
  readonly result: MatchResult | null;
  readonly connectionUnstable: boolean;
}

export interface OnlineMatchStart {
  readonly stadium: Extract<ServerMessage, { type: "start" }>["stadium"];
  readonly environment: EnvironmentScene;
  readonly p1: StartSelection;
  readonly p2: StartSelection;
}

export interface OnlineMatchState {
  readonly phase: OnlinePhase;
  readonly requestId: string | null;
  readonly matchId: string | null;
  readonly role: "host" | "guest" | null;
  readonly localTopId: TopId | null;
  readonly opponentReady: boolean;
  readonly countdownEndsAt: number | null;
  readonly start: OnlineMatchStart | null;
  readonly error: string | null;
  readonly termination: MatchTermination | null;
  readonly view: OnlineBattleView;
}

const EMPTY_VIEW: OnlineBattleView = {
  snapshot: null,
  events: [],
  visualEvents: [],
  eventsTick: 0,
  result: null,
  connectionUnstable: false,
};

export class OnlineMatchCoordinator {
  #transport: OnlineTransport;
  #unsubscribe: (() => void) | null;
  #listeners = new Set<(state: OnlineMatchState) => void>();
  #timeline: SnapshotTimeline | null = null;
  #now: () => number;
  #lastHostStateSentAt = -Infinity;
  #guestBattleStartedAt: number | null = null;
  #state: OnlineMatchState = {
    phase: "idle",
    requestId: null,
    matchId: null,
    role: null,
    localTopId: null,
    opponentReady: false,
    countdownEndsAt: null,
    start: null,
    error: null,
    termination: null,
    view: EMPTY_VIEW,
  };

  constructor(
    transport: OnlineTransport,
    now: () => number = () => performance.now(),
  ) {
    this.#transport = transport;
    this.#now = now;
    this.#unsubscribe = transport.subscribe(this.#handleTransportEvent);
  }

  get state(): OnlineMatchState {
    return this.#state;
  }

  connect(url: string): void {
    this.#guestBattleStartedAt = null;
    this.#setState({
      ...this.#initialState,
      phase: "connecting",
    });
    this.#transport.connect(url);
  }

  joinQueue(): void {
    const requestId = this.#transport.joinQueue();
    this.#setState({ ...this.#state, requestId, error: null });
  }

  cancelQueue(): void {
    if (!this.#state.requestId) {
      this.#transport.dispose();
      this.#setState(this.#initialState);
      return;
    }
    this.#transport.cancelQueue();
  }

  ready(selection: ReadySelection): void {
    this.#transport.ready(selection);
    this.#setState({ ...this.#state, phase: "waiting_ready" });
  }

  leave(): void {
    this.#transport.leave();
    this.#transport.dispose();
    this.#timeline?.reset();
    this.#timeline = null;
    this.#guestBattleStartedAt = null;
    this.#setState(this.#initialState);
  }

  update(now = this.#now()): OnlineBattleView {
    if (
      this.#state.phase === "countdown" &&
      this.#state.countdownEndsAt !== null &&
      now >= this.#state.countdownEndsAt
    ) {
      if (this.#state.role === "guest") this.#guestBattleStartedAt = now;
      this.#setState({ ...this.#state, phase: "battle" });
    }
    if (
      this.#state.role === "guest" &&
      this.#timeline &&
      (this.#state.phase === "battle" || this.#state.phase === "ending")
    ) {
      const sample = this.#timeline.sample(now);
      if (sample) {
        this.#applySample(sample);
      } else if (
        this.#guestBattleStartedAt !== null &&
        now - this.#guestBattleStartedAt > 500 &&
        !this.#state.view.connectionUnstable
      ) {
        this.#setState({
          ...this.#state,
          view: { ...this.#state.view, connectionUnstable: true },
        });
      }
    }
    return this.#state.view;
  }

  publishHostSnapshot(
    snapshot: BattleSnapshot,
    now = this.#now(),
    force = false,
  ): number | null {
    if (
      this.#state.role !== "host" ||
      (this.#state.phase !== "battle" && this.#state.phase !== "ending") ||
      (!force && now - this.#lastHostStateSentAt < 50)
    )
      return null;
    this.#lastHostStateSentAt = now;
    return this.#transport.sendHostSnapshot(snapshot);
  }

  publishHostEvent(
    event: Parameters<OnlineTransport["sendHostEvent"]>[0],
    stateSeq: number,
    t: number,
  ): number {
    if (this.#state.role !== "host")
      throw new Error("Only host can send events");
    if (event.type === "ending")
      this.#setState({ ...this.#state, phase: "ending" });
    return this.#transport.sendHostEvent(event, stateSeq, t);
  }

  publishMatchEnd(result: MatchResult, stateSeq: number, t: number): void {
    if (this.#state.role !== "host")
      throw new Error("Only host can end a match");
    this.#transport.sendMatchEnd(result, stateSeq, t);
    this.#setState({
      ...this.#state,
      phase: "result",
      termination: "completed",
      view: { ...this.#state.view, result },
    });
  }

  subscribe(listener: (state: OnlineMatchState) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  dispose(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#timeline?.reset();
    this.#timeline = null;
    this.#listeners.clear();
    this.#transport.dispose();
  }

  #handleTransportEvent = (event: MatchmakingClientEvent): void => {
    if (event.type === "message") {
      this.#handleMessage(event.message);
      return;
    }
    if (event.type === "protocol_error" || event.type === "socket_error") {
      this.#setState({
        ...this.#state,
        phase: "error",
        termination: event.type === "socket_error" ? "connection_lost" : null,
        error:
          event.type === "protocol_error" ? event.error : "WebSocket error",
      });
      return;
    }
    if (
      event.type === "connection" &&
      event.state === "closed" &&
      this.#state.phase !== "idle"
    ) {
      this.#setState({
        ...this.#state,
        phase: "error",
        termination: "connection_lost",
        error: "Connection lost",
      });
    }
  };

  #handleMessage(message: ServerMessage): void {
    if (message.type === "hello_ok") {
      if (this.#state.phase === "connecting" && !this.#state.requestId)
        this.joinQueue();
      return;
    }
    if (message.type === "queued") {
      if (!this.#state.requestId || message.requestId === this.#state.requestId)
        this.#setState({
          ...this.#state,
          phase: "queued",
          requestId: message.requestId,
        });
      return;
    }
    if (message.type === "queue_left") {
      if (message.requestId === this.#state.requestId) {
        this.#transport.dispose();
        this.#setState(this.#initialState);
      }
      return;
    }
    if (message.type === "matched") {
      this.#setState({
        ...this.#state,
        phase: "matched",
        requestId: null,
        matchId: message.matchId,
        role: message.role,
        localTopId: message.localTopId,
        start: null,
      });
      return;
    }
    if (!this.#isCurrentMatch(message)) return;
    if (message.type === "opponent_ready") {
      this.#setState({ ...this.#state, opponentReady: true });
    } else if (message.type === "start") {
      if (this.#state.role === "guest") {
        this.#timeline = new SnapshotTimeline(
          message.matchId,
          {
            p1Type: message.p1.blade,
            p2Type: message.p2.blade,
          },
          { deriveTrails: true },
        );
      }
      this.#lastHostStateSentAt = -Infinity;
      this.#guestBattleStartedAt = null;
      this.#setState({
        ...this.#state,
        phase: "countdown",
        countdownEndsAt: this.#now() + message.countdownMs,
        start: {
          stadium: message.stadium,
          environment: message.environment,
          p1: message.p1,
          p2: message.p2,
        },
      });
    } else if (message.type === "state") {
      this.#timeline?.pushState(message, this.#now());
    } else if (message.type === "battle_event") {
      this.#timeline?.pushEvent(message);
    } else if (message.type === "match_end") {
      this.#timeline?.pushMatchEnd(message);
      // State snapshots and control messages use separate server queues. A
      // match_end can therefore arrive before the final snapshot. The result
      // is authoritative and must not wait for timeline interpolation.
      this.#setState({
        ...this.#state,
        phase: "result",
        termination: "completed",
        view: {
          ...this.#state.view,
          result: {
            winnerId: message.winnerId,
            finishType: message.finishType,
            duration: message.duration,
            finalRpm: message.finalRpm,
          },
        },
      });
    } else if (message.type === "opponent_left") {
      this.#setState({
        ...this.#state,
        phase: "result",
        termination: "opponent_left",
      });
    }
  }

  #isCurrentMatch(message: ServerMessage): boolean {
    if (!("matchId" in message)) {
      if (message.type === "error") {
        this.#setState({
          ...this.#state,
          phase: "error",
          error: message.message,
        });
      }
      return false;
    }
    return message.matchId === this.#state.matchId;
  }

  #applySample(sample: TimelineSample): void {
    const ending = sample.events.some(
      (message) => message.event.kind === "ending",
    );
    this.#setState({
      ...this.#state,
      phase: sample.result ? "result" : ending ? "ending" : this.#state.phase,
      termination: sample.result ? "completed" : this.#state.termination,
      view: {
        snapshot: sample.snapshot,
        events: sample.events,
        visualEvents: sample.visualEvents,
        eventsTick:
          sample.visualEvents.length > 0
            ? this.#state.view.eventsTick + 1
            : this.#state.view.eventsTick,
        result: sample.result,
        connectionUnstable: sample.stale,
      },
    });
  }

  #setState(state: OnlineMatchState): void {
    this.#state = state;
    for (const listener of this.#listeners) listener(state);
  }

  get #initialState(): OnlineMatchState {
    return {
      phase: "idle",
      requestId: null,
      matchId: null,
      role: null,
      localTopId: null,
      opponentReady: false,
      countdownEndsAt: null,
      start: null,
      error: null,
      termination: null,
      view: EMPTY_VIEW,
    };
  }
}

export function startConfig(
  message: Extract<ServerMessage, { type: "start" }>,
): {
  readonly p1: StartSelection;
  readonly p2: StartSelection;
} {
  return { p1: message.p1, p2: message.p2 };
}

export type TimelineNetworkMessage = BattleEventMessage | MatchEndMessage;
