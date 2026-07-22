import { describe, expect, it } from "vitest";
import {
  decodeClientMessage,
  decodeServerMessage,
  type ClientMessage,
  type ServerMessage,
} from "./protocol";

describe("protocol decoders", () => {
  it("accepts every client message kind", () => {
    const state = {
      type: "state",
      matchId: "m1",
      seq: 1,
      t: 0.1,
      p1: { p: [-1, 0.8, 0], rpm: 4000, st: 80, f: 0 },
      p2: { p: [1, 0.8, 0], rpm: 3900, st: 70, f: 0 },
    } as const;
    const messages: ClientMessage[] = [
      { type: "hello", protocolVersion: 1 },
      { type: "join_queue", requestId: "q1" },
      { type: "cancel_queue", requestId: "q1" },
      {
        type: "ready",
        matchId: "m1",
        blade: "attack",
        name: "小明",
        wins: 12,
        losses: 3,
        power: 90,
        angle: -20,
        stadium: "neon",
      },
      { type: "leave", matchId: "m1" },
      state,
      {
        type: "battle_event",
        matchId: "m1",
        eventId: 1,
        stateSeq: 1,
        t: 0.1,
        event: { kind: "collision", p: [0, 0.8, 0], intensity: 2 },
      },
      {
        type: "match_end",
        matchId: "m1",
        stateSeq: 1,
        t: 0.1,
        winnerId: "p1",
        finishType: "BURST FINISH",
        duration: 0.1,
        finalRpm: 4000,
      },
    ];
    for (const message of messages)
      expect(decodeClientMessage(message)).toEqual({
        ok: true,
        value: message,
      });
  });

  it("accepts every server control kind and relayed messages", () => {
    const messages: ServerMessage[] = [
      { type: "hello_ok", protocolVersion: 1 },
      { type: "queued", requestId: "q1" },
      { type: "queue_left", requestId: "q1" },
      { type: "matched", matchId: "m1", role: "guest", localTopId: "p2" },
      { type: "opponent_ready", matchId: "m1" },
      {
        type: "start",
        matchId: "m1",
        countdownMs: 3000,
        stadium: "neon",
        environment: "space",
        p1: {
          blade: "attack",
          name: "小明",
          wins: 12,
          losses: 3,
          power: 90,
          angle: 10,
          color: 0xff2e88,
        },
        p2: { blade: "defense", power: 80, angle: -10 },
      },
      { type: "opponent_left", matchId: "m1", phase: "battle" },
      { type: "error", code: "ROOM_TIMEOUT", message: "timeout" },
    ];
    for (const message of messages)
      expect(decodeServerMessage(message)).toEqual({
        ok: true,
        value: message,
      });
  });

  it("rejects unknown enums, non-finite numbers and malformed arrays", () => {
    expect(
      decodeClientMessage({
        type: "ready",
        matchId: "m1",
        blade: "unknown",
        power: Infinity,
        angle: 0,
        stadium: "neon",
      }).ok,
    ).toBe(false);
    expect(
      decodeServerMessage({
        type: "state",
        matchId: "m1",
        seq: 1,
        t: 0,
        p1: { p: [0, 1], rpm: 1, st: 1, f: 0 },
        p2: { p: [0, 1, 0], rpm: 1, st: 1, f: 8 },
      }).ok,
    ).toBe(false);
    expect(decodeServerMessage({ type: "surprise" }).ok).toBe(false);
  });

  it("rejects negative or fractional win/loss records", () => {
    const ready = {
      type: "ready",
      matchId: "m1",
      blade: "attack",
      power: 90,
      angle: 0,
      stadium: "neon",
    };
    expect(decodeClientMessage({ ...ready, wins: -1 }).ok).toBe(false);
    expect(decodeClientMessage({ ...ready, losses: 1.5 }).ok).toBe(false);
    expect(decodeClientMessage({ ...ready, wins: 0, losses: 0 }).ok).toBe(true);
  });

  it("rejects start messages with unknown environment scene", () => {
    const start = {
      type: "start",
      matchId: "m1",
      countdownMs: 3000,
      stadium: "neon",
      p1: { blade: "attack", power: 90, angle: 10 },
      p2: { blade: "defense", power: 80, angle: -10 },
    };
    expect(decodeServerMessage({ ...start, environment: "volcano" }).ok).toBe(
      false,
    );
    expect(decodeServerMessage({ ...start, environment: "deep-sea" }).ok).toBe(
      true,
    );
  });

  it("accepts ready/start with optional accent colors and rejects bad ones", () => {
    const ready = {
      type: "ready",
      matchId: "m1",
      blade: "attack",
      power: 90,
      angle: 0,
      stadium: "neon",
    } as const;
    expect(decodeClientMessage(ready).ok).toBe(true);
    expect(decodeClientMessage({ ...ready, color: 0xff2e88 }).ok).toBe(true);
    expect(decodeClientMessage({ ...ready, color: -1 }).ok).toBe(false);
    expect(decodeClientMessage({ ...ready, color: 0x1000000 }).ok).toBe(false);
    expect(decodeClientMessage({ ...ready, color: 1.5 }).ok).toBe(false);
    expect(decodeClientMessage({ ...ready, color: "red" }).ok).toBe(false);

    const start = {
      type: "start",
      matchId: "m1",
      countdownMs: 3000,
      stadium: "neon",
      environment: "space",
      p1: { blade: "attack", power: 90, angle: 10, color: 0xb026ff, bladeId: "b1", ratchetId: "r1", bitId: "bt1", chipId: "c1" },
      p2: { blade: "defense", power: 80, angle: -10 },
    } as const;
    expect(decodeServerMessage(start).ok).toBe(true);
    expect(
      decodeServerMessage({
        ...start,
        p1: { blade: "attack", power: 90, angle: 10, color: 0x1000000 },
      }).ok,
    ).toBe(false);
  });

  it("accepts ready/start with optional 4-part custom assembly", () => {
    const ready = {
      type: "ready",
      matchId: "m1",
      blade: "attack",
      power: 90,
      angle: 0,
      stadium: "neon",
      bladeId: "red-tempest",
      ratchetId: "ratchet-3-60",
      bitId: "bit-flat",
      chipId: "chip-valkyrie",
    } as const;
    expect(decodeClientMessage(ready).ok).toBe(true);
  });
});
