import { describe, expect, it } from "vitest";
import type { BattleSnapshot } from "@game-pool/beyblade-core";
import {
  MatchmakingClient,
  type MatchmakingClientEvent,
  type WebSocketLike,
} from "./matchmaking-client";

class FakeSocket implements WebSocketLike {
  readyState = 0;
  sent: string[] = [];
  closed = false;
  listeners = new Map<string, Set<(event: unknown) => void>>();

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string, event: unknown = {}): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

const snapshot: BattleSnapshot = {
  elapsed: 1,
  p1: {
    id: "p1",
    type: "attack",
    position: { x: -1, y: 0.8, z: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    rpm: 4000,
    stability: 80,
    isBurst: false,
    isStopped: false,
    isOut: false,
  },
  p2: {
    id: "p2",
    type: "defense",
    position: { x: 1, y: 0.8, z: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    rpm: 3000,
    stability: 60,
    isBurst: true,
    isStopped: false,
    isOut: false,
  },
};

describe("MatchmakingClient", () => {
  it("injects a socket, sends hello first and serializes room messages", () => {
    const socket = new FakeSocket();
    const client = new MatchmakingClient(() => socket);
    client.connect("ws://test");
    socket.readyState = 1;
    socket.emit("open");
    expect(JSON.parse(socket.sent[0]!)).toEqual({
      type: "hello",
      protocolVersion: 4,
    });

    const requestId = client.joinQueue();
    expect(JSON.parse(socket.sent[1]!)).toEqual({
      type: "join_queue",
      requestId,
    });
    socket.emit("message", {
      data: JSON.stringify({
        type: "matched",
        matchId: "m1",
        role: "host",
        localTopId: "p1",
      }),
    });
    client.ready({
      blade: "attack",
      power: 90,
      angle: 10,
      stadium: "neon",
    });
    const seq = client.sendHostSnapshot(snapshot);
    expect(seq).toBe(1);
    expect(JSON.parse(socket.sent.at(-1)!).p2.f).toBe(1);
    client.sendHostEvent(
      {
        type: "collision",
        position: { x: 0, y: 0.8, z: 0 },
        intensity: 3,
      },
      seq,
      1,
    );
    expect(JSON.parse(socket.sent.at(-1)!)).toMatchObject({
      type: "battle_event",
      eventId: 1,
      stateSeq: 1,
      event: { kind: "collision", p: [0, 0.8, 0], intensity: 3 },
    });
    client.sendHostEvent(
      {
        type: "burst",
        top: "p2",
        position: { x: 1, y: 0.8, z: 0 },
      },
      seq,
      1.1,
    );
    expect(JSON.parse(socket.sent.at(-1)!).event.kind).toBe("burst");
    client.sendHostEvent(
      {
        type: "ending",
        winnerId: "p1",
        finishType: "BURST FINISH",
      },
      seq,
      1.2,
    );
    client.sendMatchEnd(
      {
        winnerId: "p1",
        finishType: "BURST FINISH",
        duration: 1.2,
        finalRpm: 3500,
      },
      seq,
      1.3,
    );
    expect(JSON.parse(socket.sent.at(-1)!)).toMatchObject({
      type: "match_end",
      stateSeq: 1,
      winnerId: "p1",
      finishType: "BURST FINISH",
    });
    client.dispose();
    expect(socket.closed).toBe(true);
  });

  it("reports malformed inbound JSON without trusting it", () => {
    const socket = new FakeSocket();
    const client = new MatchmakingClient(() => socket);
    const events: MatchmakingClientEvent[] = [];
    client.subscribe((event) => events.push(event));
    client.connect("ws://test");
    socket.readyState = 1;
    socket.emit("open");
    socket.emit("message", { data: "{" });
    socket.emit("message", {
      data: JSON.stringify({ type: "state", seq: NaN }),
    });
    expect(
      events.filter((event) => event.type === "protocol_error"),
    ).toHaveLength(2);
  });
});
