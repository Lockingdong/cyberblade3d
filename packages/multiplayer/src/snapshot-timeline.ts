import type {
  BattleSnapshot,
  BeybladeType,
  MatchResult,
  SimulationEvent,
  TopId,
  TopSnapshot,
} from "@game-pool/beyblade-core";
import type {
  BattleEventMessage,
  MatchEndMessage,
  StateMessage,
  WireTopState,
} from "./protocol";

export interface SnapshotTimelineOptions {
  readonly interpolationDelayMs?: number;
  readonly maxExtrapolationMs?: number;
  readonly staleAfterMs?: number;
  readonly teleportDistance?: number;
  readonly maxSnapshots?: number;
  readonly maxBufferDurationMs?: number;
  readonly deriveTrails?: boolean;
}

export interface TimelineSample {
  readonly snapshot: BattleSnapshot;
  readonly renderedT: number;
  readonly stale: boolean;
  readonly events: readonly BattleEventMessage[];
  readonly visualEvents: readonly SimulationEvent[];
  readonly result: MatchResult | null;
}

interface BufferedState {
  readonly message: StateMessage;
  readonly receivedAt: number;
}

const DEFAULTS = {
  interpolationDelayMs: 120,
  maxExtrapolationMs: 200,
  staleAfterMs: 500,
  teleportDistance: 3,
  maxSnapshots: 120,
  maxBufferDurationMs: 10_000,
  deriveTrails: true,
} as const;

export class SnapshotTimeline {
  #matchId: string;
  #p1Type: BeybladeType;
  #p2Type: BeybladeType;
  #options: Required<SnapshotTimelineOptions>;
  #states: BufferedState[] = [];
  #events: BattleEventMessage[] = [];
  #matchEnd: MatchEndMessage | null = null;
  #lastSeq = -1;
  #lastEventId = -1;
  #lastRenderedT = -1;
  #deliveredEventId = -1;
  #result: MatchResult | null = null;
  #previousRendered: BattleSnapshot | null = null;
  #previousRenderAt = 0;
  #lastTrailAt: Record<TopId, number> = { p1: -Infinity, p2: -Infinity };

  constructor(
    matchId: string,
    types: { readonly p1Type: BeybladeType; readonly p2Type: BeybladeType },
    options: SnapshotTimelineOptions = {},
  ) {
    this.#matchId = matchId;
    this.#p1Type = types.p1Type;
    this.#p2Type = types.p2Type;
    this.#options = { ...DEFAULTS, ...options };
  }

  get size(): number {
    return this.#states.length;
  }

  pushState(message: StateMessage, receivedAt: number): boolean {
    if (
      message.matchId !== this.#matchId ||
      message.seq <= this.#lastSeq ||
      !Number.isFinite(receivedAt) ||
      (this.#states.at(-1)?.message.t ?? -Infinity) > message.t
    )
      return false;
    this.#lastSeq = message.seq;
    this.#states.push({ message, receivedAt });
    this.#trim();
    return true;
  }

  pushEvent(message: BattleEventMessage): boolean {
    if (
      message.matchId !== this.#matchId ||
      message.eventId <= this.#lastEventId
    )
      return false;
    this.#lastEventId = message.eventId;
    this.#events.push(message);
    return true;
  }

  pushMatchEnd(message: MatchEndMessage): boolean {
    if (message.matchId !== this.#matchId || this.#matchEnd) return false;
    this.#matchEnd = message;
    return true;
  }

  sample(now: number): TimelineSample | null {
    const latest = this.#states.at(-1);
    if (!latest) return null;
    const stale = now - latest.receivedAt > this.#options.staleAfterMs;
    let targetT = stale
      ? latest.message.t
      : latest.message.t +
        (now - latest.receivedAt - this.#options.interpolationDelayMs) / 1000;
    targetT = Math.max(this.#lastRenderedT, targetT);

    const snapshot = this.#render(targetT);
    const renderedT = snapshot.elapsed;
    this.#lastRenderedT = renderedT;
    const events = this.#takeReadyEvents(renderedT);
    const visualEvents: SimulationEvent[] = [];
    for (const message of events) {
      const event = message.event;
      if (event.kind === "collision") {
        visualEvents.push({
          type: "collision",
          position: vec(event.p),
          intensity: event.intensity,
        });
      } else if (event.kind === "burst") {
        visualEvents.push({
          type: "burst",
          top: event.top,
          position: vec(event.p),
        });
      }
    }
    if (this.#options.deriveTrails)
      visualEvents.push(...this.#deriveTrails(snapshot, now));

    const matchEnd = this.#matchEnd;
    if (
      matchEnd &&
      !this.#result &&
      matchEnd.t <= renderedT &&
      this.#lastSeq >= matchEnd.stateSeq
    ) {
      this.#result = {
        winnerId: matchEnd.winnerId,
        finishType: matchEnd.finishType,
        duration: matchEnd.duration,
        finalRpm: matchEnd.finalRpm,
      };
    }
    this.#previousRendered = snapshot;
    this.#previousRenderAt = now;
    return {
      snapshot,
      renderedT,
      stale,
      events,
      visualEvents,
      result: this.#result,
    };
  }

  reset(
    matchId = this.#matchId,
    types = { p1Type: this.#p1Type, p2Type: this.#p2Type },
  ): void {
    this.#matchId = matchId;
    this.#p1Type = types.p1Type;
    this.#p2Type = types.p2Type;
    this.#states = [];
    this.#events = [];
    this.#matchEnd = null;
    this.#lastSeq = -1;
    this.#lastEventId = -1;
    this.#lastRenderedT = -1;
    this.#deliveredEventId = -1;
    this.#result = null;
    this.#previousRendered = null;
    this.#previousRenderAt = 0;
    this.#lastTrailAt = { p1: -Infinity, p2: -Infinity };
  }

  #render(targetT: number): BattleSnapshot {
    const first = this.#states[0]!;
    const last = this.#states.at(-1)!;
    if (targetT <= first.message.t)
      return toSnapshot(first.message, this.#types);

    for (let index = 1; index < this.#states.length; index += 1) {
      const before = this.#states[index - 1]!;
      const after = this.#states[index]!;
      if (targetT > after.message.t) continue;
      const duration = after.message.t - before.message.t;
      const alpha = duration <= 0 ? 1 : (targetT - before.message.t) / duration;
      return interpolateState(
        before.message,
        after.message,
        alpha,
        this.#options.teleportDistance,
        this.#types,
      );
    }

    const previous = this.#states.at(-2);
    const extrapolation = Math.min(
      Math.max(0, targetT - last.message.t),
      this.#options.maxExtrapolationMs / 1000,
    );
    if (!previous || extrapolation === 0)
      return toSnapshot(last.message, this.#types);
    return extrapolateState(
      previous.message,
      last.message,
      extrapolation,
      this.#options.teleportDistance,
      this.#types,
    );
  }

  #takeReadyEvents(renderedT: number): BattleEventMessage[] {
    const ready = this.#events.filter(
      (message) =>
        message.eventId > this.#deliveredEventId &&
        message.t <= renderedT &&
        message.stateSeq <= this.#lastSeq,
    );
    if (ready.length) this.#deliveredEventId = ready.at(-1)!.eventId;
    return ready;
  }

  #deriveTrails(snapshot: BattleSnapshot, now: number): SimulationEvent[] {
    const previous = this.#previousRendered;
    const dt = (now - this.#previousRenderAt) / 1000;
    if (!previous || dt <= 0) return [];
    const trails: SimulationEvent[] = [];
    for (const id of ["p1", "p2"] as const) {
      if (now - this.#lastTrailAt[id] < 100) continue;
      const current = snapshot[id].position;
      const prior = previous[id].position;
      const distance = Math.hypot(
        current.x - prior.x,
        current.y - prior.y,
        current.z - prior.z,
      );
      if (distance < 0.03 || distance > this.#options.teleportDistance)
        continue;
      this.#lastTrailAt[id] = now;
      trails.push({
        type: "trail",
        top: id,
        position: current,
        intensity: Math.min(1, distance / dt / 4),
      });
    }
    return trails;
  }

  #trim(): void {
    while (this.#states.length > this.#options.maxSnapshots)
      this.#states.shift();
    const latest = this.#states.at(-1);
    while (
      latest &&
      this.#states.length > 2 &&
      latest.receivedAt - this.#states[0]!.receivedAt >
        this.#options.maxBufferDurationMs
    )
      this.#states.shift();
  }

  get #types() {
    return { p1Type: this.#p1Type, p2Type: this.#p2Type };
  }
}

function interpolateState(
  before: StateMessage,
  after: StateMessage,
  alpha: number,
  teleportDistance: number,
  types: { readonly p1Type: BeybladeType; readonly p2Type: BeybladeType },
): BattleSnapshot {
  return {
    elapsed: lerp(before.t, after.t, alpha),
    p1: interpolateTop(
      "p1",
      types.p1Type,
      before.p1,
      after.p1,
      alpha,
      teleportDistance,
    ),
    p2: interpolateTop(
      "p2",
      types.p2Type,
      before.p2,
      after.p2,
      alpha,
      teleportDistance,
    ),
  };
}

function interpolateTop(
  id: TopId,
  type: BeybladeType,
  before: WireTopState,
  after: WireTopState,
  alpha: number,
  teleportDistance: number,
): TopSnapshot {
  const teleport = distance(before.p, after.p) > teleportDistance;
  const flags = alpha >= 1 ? after.f : before.f;
  const position =
    teleport && alpha < 1
      ? before.p
      : teleport
        ? after.p
        : ([
            lerp(before.p[0], after.p[0], alpha),
            lerp(before.p[1], after.p[1], alpha),
            lerp(before.p[2], after.p[2], alpha),
          ] as const);
  return topSnapshot(
    id,
    type,
    position,
    lerp(before.rpm, after.rpm, alpha),
    lerp(before.st, after.st, alpha),
    flags,
  );
}

function extrapolateState(
  before: StateMessage,
  latest: StateMessage,
  duration: number,
  teleportDistance: number,
  types: { readonly p1Type: BeybladeType; readonly p2Type: BeybladeType },
): BattleSnapshot {
  const dt = latest.t - before.t;
  const extrapolateTop = (
    id: TopId,
    type: BeybladeType,
    a: WireTopState,
    b: WireTopState,
  ): TopSnapshot => {
    if (dt <= 0 || distance(a.p, b.p) > teleportDistance)
      return toTopSnapshot(id, type, b);
    const position = b.p.map(
      (value, index) => value + ((value - a.p[index]!) / dt) * duration,
    ) as unknown as readonly [number, number, number];
    return topSnapshot(id, type, position, b.rpm, b.st, b.f);
  };
  return {
    elapsed: latest.t + duration,
    p1: extrapolateTop("p1", types.p1Type, before.p1, latest.p1),
    p2: extrapolateTop("p2", types.p2Type, before.p2, latest.p2),
  };
}

function toSnapshot(
  state: StateMessage,
  types: { readonly p1Type: BeybladeType; readonly p2Type: BeybladeType },
): BattleSnapshot {
  return {
    elapsed: state.t,
    p1: toTopSnapshot("p1", types.p1Type, state.p1),
    p2: toTopSnapshot("p2", types.p2Type, state.p2),
  };
}

function toTopSnapshot(
  id: TopId,
  type: BeybladeType,
  state: WireTopState,
): TopSnapshot {
  return topSnapshot(id, type, state.p, state.rpm, state.st, state.f);
}

function topSnapshot(
  id: TopId,
  type: BeybladeType,
  position: readonly [number, number, number],
  rpm: number,
  stability: number,
  flags: number,
): TopSnapshot {
  return {
    id,
    type,
    position: vec(position),
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    rpm,
    stability,
    isBurst: (flags & 1) !== 0,
    isStopped: (flags & 2) !== 0,
    isOut: (flags & 4) !== 0,
  };
}

function vec(value: readonly [number, number, number]) {
  return { x: value[0], y: value[1], z: value[2] };
}

function lerp(a: number, b: number, alpha: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, alpha));
}

function distance(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
