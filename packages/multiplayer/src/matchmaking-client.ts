import type {
  BattleSnapshot,
  BeybladeType,
  FinishType,
  MatchResult,
  SimulationEvent,
  StadiumTheme,
  WinnerId,
} from "@game-pool/beyblade-core";
import {
  PROTOCOL_VERSION,
  decodeServerMessage,
  type BattleEventMessage,
  type ClientMessage,
  type MatchEndMessage,
  type ServerMessage,
  type StateMessage,
  type WireBattleEvent,
} from "./protocol";

export interface WebSocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(
    type: "open" | "message" | "error" | "close",
    listener: (event: unknown) => void,
  ): void;
  removeEventListener(
    type: "open" | "message" | "error" | "close",
    listener: (event: unknown) => void,
  ): void;
}

export type SocketFactory = (url: string) => WebSocketLike;

export type MatchmakingClientEvent =
  | {
      readonly type: "connection";
      readonly state: "connecting" | "open" | "closed";
    }
  | { readonly type: "message"; readonly message: ServerMessage }
  | { readonly type: "protocol_error"; readonly error: string }
  | { readonly type: "socket_error" };

export interface ReadySelection {
  readonly blade: BeybladeType;
  readonly name?: string;
  readonly wins?: number;
  readonly losses?: number;
  readonly power: number;
  readonly angle: number;
  readonly stadium: StadiumTheme;
  readonly color?: number;
  readonly bladeId?: string;
  readonly ratchetId?: string;
  readonly bitId?: string;
  readonly chipId?: string;
}

export class MatchmakingClient {
  #factory: SocketFactory;
  #socket: WebSocketLike | null = null;
  #listeners = new Set<(event: MatchmakingClientEvent) => void>();
  #requestId: string | null = null;
  #matchId: string | null = null;
  #stateSeq = 0;
  #eventId = 0;
  #idCounter = 0;

  constructor(factory: SocketFactory) {
    this.#factory = factory;
  }

  connect(url: string): void {
    this.dispose();
    const socket = this.#factory(url);
    this.#socket = socket;
    socket.addEventListener("open", this.#onOpen);
    socket.addEventListener("message", this.#onMessage);
    socket.addEventListener("error", this.#onError);
    socket.addEventListener("close", this.#onClose);
    this.#emit({ type: "connection", state: "connecting" });
  }

  joinQueue(): string {
    const requestId = `q_${++this.#idCounter}`;
    this.#requestId = requestId;
    this.#send({ type: "join_queue", requestId });
    return requestId;
  }

  cancelQueue(): void {
    if (!this.#requestId) return;
    this.#send({ type: "cancel_queue", requestId: this.#requestId });
  }

  ready(selection: ReadySelection): void {
    if (!this.#matchId) throw new Error("Cannot ready before a match");
    this.#send({ type: "ready", matchId: this.#matchId, ...selection });
  }

  leave(): void {
    if (!this.#matchId) return;
    this.#send({ type: "leave", matchId: this.#matchId });
    this.#matchId = null;
    this.#stateSeq = 0;
    this.#eventId = 0;
  }

  sendHostSnapshot(snapshot: BattleSnapshot): number {
    if (!this.#matchId) throw new Error("Cannot send state before a match");
    const seq = ++this.#stateSeq;
    this.#send(toStateMessage(this.#matchId, seq, snapshot));
    return seq;
  }

  sendHostEvent(
    event:
      | Exclude<SimulationEvent, { readonly type: "trail" }>
      | {
          readonly type: "ending";
          readonly winnerId: WinnerId;
          readonly finishType: FinishType;
        },
    stateSeq: number,
    t: number,
  ): number {
    if (!this.#matchId) throw new Error("Cannot send event before a match");
    const eventId = ++this.#eventId;
    const message: BattleEventMessage = {
      type: "battle_event",
      matchId: this.#matchId,
      eventId,
      stateSeq,
      t,
      event: toWireEvent(event),
    };
    this.#send(message);
    return eventId;
  }

  sendMatchEnd(result: MatchResult, stateSeq: number, t: number): void {
    if (!this.#matchId) throw new Error("Cannot end before a match");
    const message: MatchEndMessage = {
      type: "match_end",
      matchId: this.#matchId,
      stateSeq,
      t,
      ...result,
    };
    this.#send(message);
  }

  subscribe(listener: (event: MatchmakingClientEvent) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  dispose(): void {
    const socket = this.#socket;
    if (!socket) return;
    socket.removeEventListener("open", this.#onOpen);
    socket.removeEventListener("message", this.#onMessage);
    socket.removeEventListener("error", this.#onError);
    socket.removeEventListener("close", this.#onClose);
    socket.close(1000, "client disposed");
    this.#socket = null;
    this.#requestId = null;
    this.#matchId = null;
    this.#stateSeq = 0;
    this.#eventId = 0;
  }

  #onOpen = (): void => {
    this.#emit({ type: "connection", state: "open" });
    this.#send({ type: "hello", protocolVersion: PROTOCOL_VERSION });
  };

  #onMessage = (event: unknown): void => {
    const data =
      typeof event === "object" && event !== null && "data" in event
        ? (event as { data: unknown }).data
        : event;
    if (typeof data !== "string") {
      this.#emit({ type: "protocol_error", error: "message data is not text" });
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      this.#emit({ type: "protocol_error", error: "invalid JSON" });
      return;
    }
    const decoded = decodeServerMessage(parsed);
    if (!decoded.ok) {
      this.#emit({ type: "protocol_error", error: decoded.error });
      return;
    }
    const message = decoded.value;
    if (message.type === "matched") {
      this.#matchId = message.matchId;
      this.#requestId = null;
      this.#stateSeq = 0;
      this.#eventId = 0;
    } else if (message.type === "queue_left") {
      if (message.requestId === this.#requestId) this.#requestId = null;
    }
    this.#emit({ type: "message", message });
  };

  #onError = (): void => this.#emit({ type: "socket_error" });

  #onClose = (): void => {
    this.#socket = null;
    this.#emit({ type: "connection", state: "closed" });
  };

  #send(message: ClientMessage): void {
    if (!this.#socket || this.#socket.readyState !== 1)
      throw new Error("Socket is not open");
    this.#socket.send(JSON.stringify(message));
  }

  #emit(event: MatchmakingClientEvent): void {
    for (const listener of this.#listeners) listener(event);
  }
}

function toStateMessage(
  matchId: string,
  seq: number,
  snapshot: BattleSnapshot,
): StateMessage {
  const top = (id: "p1" | "p2") => {
    const value = snapshot[id];
    return {
      p: [value.position.x, value.position.y, value.position.z] as const,
      rpm: value.rpm,
      st: value.stability,
      f:
        (value.isBurst ? 1 : 0) |
        (value.isStopped ? 2 : 0) |
        (value.isOut ? 4 : 0),
    };
  };
  return {
    type: "state",
    matchId,
    seq,
    t: snapshot.elapsed,
    p1: top("p1"),
    p2: top("p2"),
  };
}

function toWireEvent(
  event:
    | Exclude<SimulationEvent, { readonly type: "trail" }>
    | {
        readonly type: "ending";
        readonly winnerId: WinnerId;
        readonly finishType: FinishType;
      },
): WireBattleEvent {
  if (event.type === "collision")
    return {
      kind: "collision",
      p: [event.position.x, event.position.y, event.position.z],
      intensity: event.intensity,
    };
  if (event.type === "burst")
    return {
      kind: "burst",
      top: event.top,
      p: [event.position.x, event.position.y, event.position.z],
    };
  return {
    kind: "ending",
    winnerId: event.winnerId,
    finishType: event.finishType,
  };
}
