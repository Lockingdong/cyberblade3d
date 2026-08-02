import type {
  BattleSnapshot,
  EnvironmentScene,
  MatchTermination,
  MatchResult,
  SimulationEvent,
  TopId,
} from "@cyberblade/core";
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
  // Connected with nothing pending: the player can create or join a friend
  // room. A rejected room code returns here instead of dropping the socket.
  | "lobby"
  | "connecting"
  | "queued"
  | "hosting"
  | "joining"
  | "matched"
  | "waiting_ready"
  | "countdown"
  | "battle"
  | "ending"
  | "result"
  | "error";

/** How a session that is being connected intends to find its opponent. */
export type OnlineIntent =
  | { readonly kind: "quick" }
  | { readonly kind: "create" }
  | { readonly kind: "join"; readonly code: string };

export interface OnlineTransport {
  connect(url: string): void;
  joinQueue(): string;
  createRoom(): string;
  joinRoom(code: string): string;
  cancelQueue(): void;
  ready(selection: ReadySelection): void;
  leave(): void;
  rematch(): void;
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
  readonly roomCode: string | null;
  readonly role: "host" | "guest" | null;
  readonly localTopId: TopId | null;
  readonly opponentReady: boolean;
  /** True while the finished room is still open for a rematch. */
  readonly rematchAvailable: boolean;
  readonly opponentRematch: boolean;
  readonly rematchRequested: boolean;
  readonly countdownEndsAt: number | null;
  readonly start: OnlineMatchStart | null;
  readonly error: string | null;
  readonly errorCode: string | null;
  readonly termination: MatchTermination | null;
  readonly view: OnlineBattleView;
}

// Room errors leave the connection usable, so the player stays in the lobby and
// can retype a code instead of being dropped back to the main menu.
const RECOVERABLE_ERROR_CODES = new Set([
  "ROOM_NOT_FOUND",
  "ROOM_EXPIRED",
  "ROOM_SELF",
  "SERVER_BUSY",
]);

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
  #intent: OnlineIntent = { kind: "quick" };
  #state: OnlineMatchState = {
    phase: "idle",
    requestId: null,
    matchId: null,
    roomCode: null,
    role: null,
    localTopId: null,
    opponentReady: false,
    rematchAvailable: false,
    opponentRematch: false,
    rematchRequested: false,
    countdownEndsAt: null,
    start: null,
    error: null,
    errorCode: null,
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

  connect(url: string, intent: OnlineIntent = { kind: "quick" }): void {
    this.#guestBattleStartedAt = null;
    this.#intent = intent;
    this.#setState({
      ...this.#initialState,
      phase: "connecting",
    });
    this.#transport.connect(url);
  }

  joinQueue(): void {
    const requestId = this.#transport.joinQueue();
    this.#setState({ ...this.#state, requestId, error: null, errorCode: null });
  }

  createRoom(): void {
    const requestId = this.#transport.createRoom();
    this.#setState({
      ...this.#state,
      phase: "connecting",
      requestId,
      roomCode: null,
      error: null,
      errorCode: null,
    });
  }

  joinRoom(code: string): void {
    const requestId = this.#transport.joinRoom(code);
    this.#setState({
      ...this.#state,
      phase: "joining",
      requestId,
      error: null,
      errorCode: null,
    });
  }

  /** Asks to replay against the same opponent. Both sides must ask. */
  requestRematch(): void {
    if (
      this.#state.phase !== "result" ||
      !this.#state.rematchAvailable ||
      this.#state.rematchRequested
    )
      return;
    this.#transport.rematch();
    this.#setState({ ...this.#state, rematchRequested: true });
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
      rematchAvailable: true,
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
      if (this.#state.phase !== "connecting" || this.#state.requestId) return;
      if (this.#intent.kind === "create") this.createRoom();
      else if (this.#intent.kind === "join") this.joinRoom(this.#intent.code);
      else this.joinQueue();
      return;
    }
    if (message.type === "error") {
      this.#handleServerError(message.code, message.message);
      return;
    }
    if (message.type === "room_created") {
      if (this.#state.requestId && message.requestId !== this.#state.requestId)
        return;
      this.#setState({
        ...this.#state,
        phase: "hosting",
        requestId: message.requestId,
        roomCode: message.code,
      });
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
      // A rematch arrives as a fresh matched under a new id, so everything the
      // previous match left behind is cleared here rather than at leave().
      this.#timeline?.reset();
      this.#timeline = null;
      this.#guestBattleStartedAt = null;
      this.#setState({
        ...this.#state,
        phase: "matched",
        requestId: null,
        matchId: message.matchId,
        roomCode: null,
        role: message.role,
        localTopId: message.localTopId,
        opponentReady: false,
        rematchAvailable: false,
        opponentRematch: false,
        rematchRequested: false,
        countdownEndsAt: null,
        start: null,
        error: null,
        errorCode: null,
        termination: null,
        view: EMPTY_VIEW,
      });
      return;
    }
    if (!this.#isCurrentMatch(message)) return;
    if (message.type === "opponent_ready") {
      this.#setState({ ...this.#state, opponentReady: true });
    } else if (message.type === "opponent_rematch") {
      this.#setState({ ...this.#state, opponentRematch: true });
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
        rematchAvailable: true,
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
      // After match_end the room only exists for the rematch offer, so losing
      // the opponent there withdraws the offer instead of replacing the result.
      if (this.#state.termination === "completed") {
        this.#setState({
          ...this.#state,
          rematchAvailable: false,
          rematchRequested: false,
          opponentRematch: false,
        });
        return;
      }
      this.#setState({
        ...this.#state,
        phase: "result",
        termination: "opponent_left",
      });
    }
  }

  #handleServerError(code: string, text: string): void {
    if (RECOVERABLE_ERROR_CODES.has(code)) {
      this.#setState({
        ...this.#state,
        phase: "lobby",
        requestId: null,
        roomCode: null,
        error: text,
        errorCode: code,
      });
      return;
    }
    this.#setState({
      ...this.#state,
      phase: "error",
      error: text,
      errorCode: code,
    });
  }

  #isCurrentMatch(message: ServerMessage): boolean {
    if (!("matchId" in message)) return false;
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
      rematchAvailable: sample.result ? true : this.#state.rematchAvailable,
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
      roomCode: null,
      role: null,
      localTopId: null,
      opponentReady: false,
      rematchAvailable: false,
      opponentRematch: false,
      rematchRequested: false,
      countdownEndsAt: null,
      start: null,
      error: null,
      errorCode: null,
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
