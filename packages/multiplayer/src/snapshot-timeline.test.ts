import { describe, expect, it } from "vitest";
import type {
  BattleEventMessage,
  MatchEndMessage,
  StateMessage,
} from "./protocol";
import type { FinishType, WinnerId } from "@game-pool/beyblade-core";
import { SnapshotTimeline } from "./snapshot-timeline";

function state(
  seq: number,
  t: number,
  x: number,
  matchId = "m1",
  flags = 0,
): StateMessage {
  return {
    type: "state",
    matchId,
    seq,
    t,
    p1: { p: [x, 0.8, 0], rpm: 4000 - t * 100, st: 80 - t, f: flags },
    p2: { p: [-x, 0.8, 0], rpm: 3800 - t * 100, st: 70 - t, f: 0 },
  };
}

function collision(
  t: number,
  stateSeq: number,
  eventId = 1,
): BattleEventMessage {
  return {
    type: "battle_event",
    matchId: "m1",
    eventId,
    stateSeq,
    t,
    event: { kind: "collision", p: [0, 0.8, 0], intensity: 3 },
  };
}

function end(
  t: number,
  stateSeq: number,
  finishType: FinishType = "BURST FINISH",
  winnerId: WinnerId = "p1",
): MatchEndMessage {
  return {
    type: "match_end",
    matchId: "m1",
    stateSeq,
    t,
    winnerId,
    finishType,
    duration: t,
    finalRpm: 3500,
  };
}

function timeline(options = {}) {
  return new SnapshotTimeline(
    "m1",
    { p1Type: "attack", p2Type: "defense" },
    options,
  );
}

describe("SnapshotTimeline", () => {
  it("interpolates using host simulation time with the default 120ms delay", () => {
    const value = timeline();
    value.pushState(state(1, 0, 0), 0);
    value.pushState(state(2, 0.1, 1), 100);

    const sample = value.sample(170)!;
    expect(sample.renderedT).toBeCloseTo(0.05);
    expect(sample.snapshot.p1.position.x).toBeCloseTo(0.5);
    expect(sample.snapshot.p1.rpm).toBeCloseTo(3995);
  });

  it("handles jitter and missing packets while rejecting duplicate and old seq", () => {
    const value = timeline();
    expect(value.pushState(state(1, 0, 0), 0)).toBe(true);
    expect(value.pushState(state(3, 0.2, 2), 260)).toBe(true);
    expect(value.pushState(state(3, 0.2, 9), 270)).toBe(false);
    expect(value.pushState(state(2, 0.1, 1), 280)).toBe(false);

    expect(value.sample(280)!.snapshot.p1.position.x).toBeCloseTo(1);
  });

  it("extrapolates at most 200ms and freezes after 500ms without a state", () => {
    const value = timeline();
    value.pushState(state(1, 0, 0), 0);
    value.pushState(state(2, 0.1, 1), 100);

    expect(value.sample(420)!.snapshot.p1.position.x).toBeCloseTo(3);
    const stale = value.sample(701)!;
    expect(stale.stale).toBe(true);
    expect(stale.snapshot.p1.position.x).toBe(3);
    expect(stale.renderedT).toBeCloseTo(0.3);
  });

  it("snaps teleports and uses flags from the latest rendered state", () => {
    const value = timeline();
    value.pushState(state(1, 0, 0), 0);
    value.pushState(state(2, 0.1, 5, "m1", 1), 100);

    const before = value.sample(170)!;
    expect(before.snapshot.p1.position.x).toBe(0);
    expect(before.snapshot.p1.isBurst).toBe(false);
    const after = value.sample(220)!;
    expect(after.snapshot.p1.position.x).toBe(5);
    expect(after.snapshot.p1.isBurst).toBe(true);
  });

  it("holds events and results until the corresponding rendered state time", () => {
    const value = timeline({ deriveTrails: false });
    value.pushState(state(1, 0, 0), 0);
    value.pushState(state(2, 0.2, 2), 200);
    value.pushEvent(collision(0.1, 2));
    value.pushEvent({
      type: "battle_event",
      matchId: "m1",
      eventId: 2,
      stateSeq: 2,
      t: 0.12,
      event: { kind: "burst", top: "p2", p: [0.5, 0.8, 0] },
    });
    value.pushEvent({
      type: "battle_event",
      matchId: "m1",
      eventId: 3,
      stateSeq: 2,
      t: 0.14,
      event: {
        kind: "ending",
        winnerId: "p1",
        finishType: "BURST FINISH",
      },
    });
    value.pushMatchEnd(end(0.15, 2));

    const early = value.sample(219)!;
    expect(early.renderedT).toBeCloseTo(0.099);
    expect(early.events).toHaveLength(0);
    expect(early.result).toBeNull();

    const collisionFrame = value.sample(220)!;
    expect(collisionFrame.events).toHaveLength(1);
    expect(collisionFrame.visualEvents[0]?.type).toBe("collision");
    expect(collisionFrame.result).toBeNull();

    const burstFrame = value.sample(240)!;
    expect(burstFrame.events.map((message) => message.event.kind)).toEqual([
      "burst",
    ]);
    expect(burstFrame.visualEvents[0]?.type).toBe("burst");

    const endingFrame = value.sample(260)!;
    expect(endingFrame.events.map((message) => message.event.kind)).toEqual([
      "ending",
    ]);
    expect(endingFrame.result).toBeNull();

    const resultFrame = value.sample(270)!;
    expect(resultFrame.result?.winnerId).toBe("p1");
  });

  it("derives guest trails, can disable them, and fully resets for a new match", () => {
    const value = timeline({ interpolationDelayMs: 0 });
    value.pushState(state(1, 0, 0), 0);
    value.pushState(state(2, 0.1, 0.4), 100);
    value.sample(50);
    const moved = value.sample(100)!;
    expect(moved.visualEvents.some((event) => event.type === "trail")).toBe(
      true,
    );

    value.reset("m2", { p1Type: "stamina", p2Type: "balance" });
    expect(value.size).toBe(0);
    expect(value.pushState(state(1, 0, 0, "m1"), 200)).toBe(false);
    expect(value.pushState(state(1, 0, 0, "m2"), 200)).toBe(true);
    expect(value.sample(200)!.snapshot.p1.type).toBe("stamina");

    const noTrails = timeline({ interpolationDelayMs: 0, deriveTrails: false });
    noTrails.pushState(state(1, 0, 0), 0);
    noTrails.pushState(state(2, 0.1, 1), 100);
    noTrails.sample(50);
    expect(noTrails.sample(100)!.visualEvents).toEqual([]);
  });

  it("bounds snapshot count and ignores events for another match", () => {
    const value = timeline({ maxSnapshots: 3 });
    for (let seq = 1; seq <= 5; seq += 1)
      value.pushState(state(seq, seq / 10, seq), seq * 100);
    expect(value.size).toBe(3);
    expect(value.pushEvent({ ...collision(0.5, 5), matchId: "old" })).toBe(
      false,
    );
  });

  it.each([
    ["BURST FINISH", "p1"],
    ["OVER FINISH", "p2"],
    ["SPIN FINISH", "p1"],
    ["TIME FINISH", "draw"],
  ] as const)(
    "preserves the authoritative %s result after delayed playback",
    (finishType, winnerId) => {
      const value = timeline({ interpolationDelayMs: 120 });
      value.pushState(state(1, 0, 0), 20);
      value.pushState(state(3, 0.2, 2), 280); // seq 2 was dropped.
      value.pushMatchEnd(end(0.2, 3, finishType, winnerId));

      expect(value.sample(399)!.result).toBeNull();
      const completed = value.sample(400)!;
      expect(completed.result).toMatchObject({ finishType, winnerId });
    },
  );
});
