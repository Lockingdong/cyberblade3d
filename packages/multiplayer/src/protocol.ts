import type {
  BeybladeType,
  EnvironmentScene,
  FinishType,
  StadiumTheme,
  TopId,
  WinnerId,
} from "@game-pool/beyblade-core";

// v2: six new blade types — old clients would crash on an unknown blade id
// mid-match, so the version gate rejects them cleanly at hello.
// v3: optional per-player accent color on ready/start.
// v4: optional 4-part custom assembly (bladeId, ratchetId, bitId, chipId) on ready/start.
export const PROTOCOL_VERSION = 4;

export interface WireTopState {
  readonly p: readonly [number, number, number];
  readonly rpm: number;
  readonly st: number;
  readonly f: number;
}

export interface StateMessage {
  readonly type: "state";
  readonly matchId: string;
  readonly seq: number;
  readonly t: number;
  readonly p1: WireTopState;
  readonly p2: WireTopState;
}

export type WireBattleEvent =
  | {
      readonly kind: "collision";
      readonly p: readonly [number, number, number];
      readonly intensity: number;
    }
  | {
      readonly kind: "burst";
      readonly top: TopId;
      readonly p: readonly [number, number, number];
    }
  | {
      readonly kind: "ending";
      readonly winnerId: WinnerId;
      readonly finishType: FinishType;
    };

export interface BattleEventMessage {
  readonly type: "battle_event";
  readonly matchId: string;
  readonly eventId: number;
  readonly stateSeq: number;
  readonly t: number;
  readonly event: WireBattleEvent;
}

export interface MatchEndMessage {
  readonly type: "match_end";
  readonly matchId: string;
  readonly stateSeq: number;
  readonly t: number;
  readonly winnerId: WinnerId;
  readonly finishType: FinishType;
  readonly duration: number;
  readonly finalRpm: number;
}

export type ClientMessage =
  | { readonly type: "hello"; readonly protocolVersion: number }
  | { readonly type: "join_queue"; readonly requestId: string }
  | { readonly type: "cancel_queue"; readonly requestId: string }
  | {
      readonly type: "ready";
      readonly matchId: string;
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
  | { readonly type: "leave"; readonly matchId: string }
  | StateMessage
  | BattleEventMessage
  | MatchEndMessage;

export interface StartSelection {
  readonly blade: BeybladeType;
  readonly name?: string;
  readonly wins?: number;
  readonly losses?: number;
  readonly power: number;
  readonly angle: number;
  readonly color?: number;
  readonly bladeId?: string;
  readonly ratchetId?: string;
  readonly bitId?: string;
  readonly chipId?: string;
}

export type ServerMessage =
  | { readonly type: "hello_ok"; readonly protocolVersion: number }
  | { readonly type: "queued"; readonly requestId: string }
  | { readonly type: "queue_left"; readonly requestId: string }
  | {
      readonly type: "matched";
      readonly matchId: string;
      readonly role: "host" | "guest";
      readonly localTopId: TopId;
    }
  | { readonly type: "opponent_ready"; readonly matchId: string }
  | {
      readonly type: "start";
      readonly matchId: string;
      readonly countdownMs: number;
      readonly stadium: StadiumTheme;
      readonly environment: EnvironmentScene;
      readonly p1: StartSelection;
      readonly p2: StartSelection;
    }
  | {
      readonly type: "opponent_left";
      readonly matchId: string;
      readonly phase: "matched" | "countdown" | "battle" | "ending";
    }
  | { readonly type: "error"; readonly code: string; readonly message: string }
  | StateMessage
  | BattleEventMessage
  | MatchEndMessage;

export type DecodeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

export function decodeClientMessage(
  input: unknown,
): DecodeResult<ClientMessage> {
  return decodeMessage(input, "client");
}

export function decodeServerMessage(
  input: unknown,
): DecodeResult<ServerMessage> {
  return decodeMessage(input, "server");
}

function decodeMessage(
  input: unknown,
  direction: "client",
): DecodeResult<ClientMessage>;
function decodeMessage(
  input: unknown,
  direction: "server",
): DecodeResult<ServerMessage>;
function decodeMessage(
  input: unknown,
  direction: "client" | "server",
): DecodeResult<ClientMessage | ServerMessage> {
  if (!isRecord(input) || !isString(input.type)) return invalid("missing type");
  const value = input;
  switch (value.type) {
    case "hello":
      return direction === "client" && isInteger(value.protocolVersion)
        ? valid(value as unknown as ClientMessage)
        : invalid("invalid hello");
    case "hello_ok":
      return direction === "server" && isInteger(value.protocolVersion)
        ? valid(value as unknown as ServerMessage)
        : invalid("invalid hello_ok");
    case "join_queue":
    case "cancel_queue":
      return direction === "client" && isOpaque(value.requestId)
        ? valid(value as unknown as ClientMessage)
        : invalid(`invalid ${value.type}`);
    case "queued":
    case "queue_left":
      return direction === "server" && isOpaque(value.requestId)
        ? valid(value as unknown as ServerMessage)
        : invalid(`invalid ${value.type}`);
    case "matched":
      return direction === "server" &&
        isOpaque(value.matchId) &&
        (value.role === "host" || value.role === "guest") &&
        isTopId(value.localTopId)
        ? valid(value as unknown as ServerMessage)
        : invalid("invalid matched");
    case "opponent_ready":
      return direction === "server" && isOpaque(value.matchId)
        ? valid(value as unknown as ServerMessage)
        : invalid("invalid opponent_ready");
    case "start":
      return direction === "server" &&
        isOpaque(value.matchId) &&
        isFiniteNumber(value.countdownMs) &&
        value.countdownMs >= 0 &&
        isStadium(value.stadium) &&
        isEnvironmentScene(value.environment) &&
        isStartSelection(value.p1) &&
        isStartSelection(value.p2)
        ? valid(value as unknown as ServerMessage)
        : invalid("invalid start");
    case "ready":
      return direction === "client" &&
        isOpaque(value.matchId) &&
        isBlade(value.blade) &&
        (value.name === undefined || isOpaque(value.name)) &&
        isRecordCount(value.wins) &&
        isRecordCount(value.losses) &&
        isFiniteNumber(value.power) &&
        isFiniteNumber(value.angle) &&
        isStadium(value.stadium) &&
        isOptionalColor(value.color) &&
        isOptionalPartId(value.bladeId) &&
        isOptionalPartId(value.ratchetId) &&
        isOptionalPartId(value.bitId) &&
        isOptionalPartId(value.chipId)
        ? valid(value as unknown as ClientMessage)
        : invalid("invalid ready");
    case "leave":
      return direction === "client" && isOpaque(value.matchId)
        ? valid(value as unknown as ClientMessage)
        : invalid("invalid leave");
    case "opponent_left":
      return direction === "server" &&
        isOpaque(value.matchId) &&
        ["matched", "countdown", "battle", "ending"].includes(
          String(value.phase),
        )
        ? valid(value as unknown as ServerMessage)
        : invalid("invalid opponent_left");
    case "error":
      return direction === "server" &&
        isString(value.code) &&
        isString(value.message)
        ? valid(value as unknown as ServerMessage)
        : invalid("invalid error");
    case "state":
      return isState(value)
        ? valid(value as unknown as StateMessage)
        : invalid("invalid state");
    case "battle_event":
      return isBattleEventMessage(value)
        ? valid(value as unknown as BattleEventMessage)
        : invalid("invalid battle_event");
    case "match_end":
      return isMatchEnd(value)
        ? valid(value as unknown as MatchEndMessage)
        : invalid("invalid match_end");
    default:
      return invalid(`unknown type: ${value.type}`);
  }
}

function isState(value: Record<string, unknown>): boolean {
  return (
    isOpaque(value.matchId) &&
    isNonNegativeInteger(value.seq) &&
    isFiniteNumber(value.t) &&
    value.t >= 0 &&
    isWireTop(value.p1) &&
    isWireTop(value.p2)
  );
}

function isBattleEventMessage(value: Record<string, unknown>): boolean {
  if (
    !isOpaque(value.matchId) ||
    !isNonNegativeInteger(value.eventId) ||
    !isNonNegativeInteger(value.stateSeq) ||
    !isFiniteNumber(value.t) ||
    value.t < 0 ||
    !isRecord(value.event)
  )
    return false;
  const event = value.event;
  if (event.kind === "collision")
    return isVec3(event.p) && isFiniteNumber(event.intensity);
  if (event.kind === "burst") return isTopId(event.top) && isVec3(event.p);
  if (event.kind === "ending")
    return isWinner(event.winnerId) && isFinish(event.finishType);
  return false;
}

function isMatchEnd(value: Record<string, unknown>): boolean {
  return (
    isOpaque(value.matchId) &&
    isNonNegativeInteger(value.stateSeq) &&
    isFiniteNumber(value.t) &&
    value.t >= 0 &&
    isWinner(value.winnerId) &&
    isFinish(value.finishType) &&
    isFiniteNumber(value.duration) &&
    value.duration >= 0 &&
    isFiniteNumber(value.finalRpm) &&
    value.finalRpm >= 0
  );
}

function isWireTop(value: unknown): boolean {
  return (
    isRecord(value) &&
    isVec3(value.p) &&
    isFiniteNumber(value.rpm) &&
    value.rpm >= 0 &&
    isFiniteNumber(value.st) &&
    value.st >= 0 &&
    isNonNegativeInteger(value.f) &&
    value.f <= 7
  );
}

function isStartSelection(value: unknown): boolean {
  return (
    isRecord(value) &&
    isBlade(value.blade) &&
    (value.name === undefined || isOpaque(value.name)) &&
    isRecordCount(value.wins) &&
    isRecordCount(value.losses) &&
    isFiniteNumber(value.power) &&
    isFiniteNumber(value.angle) &&
    isOptionalColor(value.color) &&
    isOptionalPartId(value.bladeId) &&
    isOptionalPartId(value.ratchetId) &&
    isOptionalPartId(value.bitId) &&
    isOptionalPartId(value.chipId)
  );
}

function isOptionalPartId(value: unknown): boolean {
  return (
    value === undefined ||
    (isString(value) && value.length > 0 && value.length <= 64)
  );
}

function isOptionalColor(value: unknown): boolean {
  return (
    value === undefined ||
    (typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 0 &&
      value <= 0xffffff)
  );
}

function isRecordCount(value: unknown): boolean {
  return value === undefined || isNonNegativeInteger(value);
}

function isVec3(value: unknown): value is readonly [number, number, number] {
  return (
    Array.isArray(value) && value.length === 3 && value.every(isFiniteNumber)
  );
}

function isBlade(value: unknown): value is BeybladeType {
  return [
    "attack",
    "defense",
    "stamina",
    "balance",
    "crusher",
    "phantom",
    "aegis",
    "vampire",
    "zephyr",
    "berserk",
  ].includes(String(value));
}

function isStadium(value: unknown): value is StadiumTheme {
  return ["neon", "toxic", "volcano"].includes(String(value));
}

function isEnvironmentScene(value: unknown): value is EnvironmentScene {
  return ["space", "sunset", "deep-sea", "neon-city", "glacier"].includes(
    String(value),
  );
}

function isTopId(value: unknown): value is TopId {
  return value === "p1" || value === "p2";
}

function isWinner(value: unknown): value is WinnerId {
  return isTopId(value) || value === "draw";
}

function isFinish(value: unknown): value is FinishType {
  return ["BURST FINISH", "OVER FINISH", "SPIN FINISH", "TIME FINISH"].includes(
    String(value),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isOpaque(value: unknown): value is string {
  return isString(value) && value.length > 0 && value.length <= 256;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return isInteger(value) && value >= 0;
}

function valid<T>(value: T): DecodeResult<T> {
  return { ok: true, value };
}

function invalid<T>(error: string): DecodeResult<T> {
  return { ok: false, error };
}
