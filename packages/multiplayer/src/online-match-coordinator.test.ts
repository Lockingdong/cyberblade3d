import { describe, expect, it } from "vitest";
import type { BattleSnapshot, MatchResult } from "@game-pool/beyblade-core";
import type {
  MatchmakingClientEvent,
  ReadySelection,
} from "./matchmaking-client";
import {
  OnlineMatchCoordinator,
  type OnlineTransport,
} from "./online-match-coordinator";

class FakeTransport implements OnlineTransport {
  listener: ((event: MatchmakingClientEvent) => void) | null = null;
  snapshots: BattleSnapshot[] = [];
  connected = "";
  disposed = false;
  joined = 0;

  connect(url: string): void {
    this.connected = url;
  }
  joinQueue(): string {
    this.joined += 1;
    return "q1";
  }
  cancelQueue(): void {}
  ready(_selection: ReadySelection): void {
    void _selection;
  }
  leave(): void {}
  sendHostSnapshot(snapshot: BattleSnapshot): number {
    this.snapshots.push(snapshot);
    return this.snapshots.length;
  }
  sendHostEvent(): number {
    return 1;
  }
  sendMatchEnd(_result: MatchResult): void {
    void _result;
  }
  subscribe(listener: (event: MatchmakingClientEvent) => void): () => void {
    this.listener = listener;
    return () => {
      this.listener = null;
    };
  }
  dispose(): void {
    this.disposed = true;
  }
  emit(event: MatchmakingClientEvent): void {
    this.listener?.(event);
  }
}

function message(
  value: Extract<MatchmakingClientEvent, { type: "message" }>["message"],
): MatchmakingClientEvent {
  return { type: "message", message: value };
}

const battle: BattleSnapshot = {
  elapsed: 0,
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
    rpm: 3800,
    stability: 70,
    isBurst: false,
    isStopped: false,
    isOut: false,
  },
};

describe("OnlineMatchCoordinator", () => {
  it("drives a guest from queue through countdown into snapshot playback", () => {
    let now = 1000;
    const transport = new FakeTransport();
    const coordinator = new OnlineMatchCoordinator(transport, () => now);
    coordinator.connect("ws://test");
    transport.emit(message({ type: "hello_ok", protocolVersion: 1 }));
    expect(transport.joined).toBe(1);
    transport.emit(message({ type: "queued", requestId: "q1" }));
    expect(coordinator.state.phase).toBe("queued");
    transport.emit(
      message({
        type: "matched",
        matchId: "m1",
        role: "guest",
        localTopId: "p2",
      }),
    );
    transport.emit(
      message({
        type: "start",
        matchId: "m1",
        countdownMs: 3000,
        stadium: "neon",
        environment: "sunset",
        p1: { blade: "attack", power: 90, angle: 10 },
        p2: { blade: "defense", power: 80, angle: -10 },
      }),
    );
    expect(coordinator.state.phase).toBe("countdown");
    expect(coordinator.state.start).toEqual({
      stadium: "neon",
      environment: "sunset",
      p1: { blade: "attack", power: 90, angle: 10 },
      p2: { blade: "defense", power: 80, angle: -10 },
    });
    now = 4000;
    coordinator.update();
    expect(coordinator.state.phase).toBe("battle");
    now = 4501;
    expect(coordinator.update().connectionUnstable).toBe(true);

    transport.emit(
      message({
        type: "state",
        matchId: "m1",
        seq: 1,
        t: 0,
        p1: { p: [-1, 0.8, 0], rpm: 4000, st: 80, f: 0 },
        p2: { p: [1, 0.8, 0], rpm: 3800, st: 70, f: 0 },
      }),
    );
    expect(coordinator.update().snapshot?.p2.type).toBe("defense");
    expect(coordinator.state.view.connectionUnstable).toBe(false);
    expect(coordinator.state.view.eventsTick).toBe(0);
    transport.emit(
      message({
        type: "battle_event",
        matchId: "m1",
        eventId: 1,
        stateSeq: 1,
        t: 0,
        event: { kind: "collision", p: [0, 0.8, 0], intensity: 3 },
      }),
    );
    expect(coordinator.update().eventsTick).toBe(1);
    expect(coordinator.update().eventsTick).toBe(1);
    expect(transport.snapshots).toHaveLength(0);
  });

  it("throttles host snapshots to 20Hz and ignores stale match messages", () => {
    let now = 0;
    const transport = new FakeTransport();
    const coordinator = new OnlineMatchCoordinator(transport, () => now);
    coordinator.connect("ws://test");
    transport.emit(
      message({
        type: "matched",
        matchId: "m1",
        role: "host",
        localTopId: "p1",
      }),
    );
    transport.emit(
      message({
        type: "start",
        matchId: "old",
        countdownMs: 0,
        stadium: "neon",
        environment: "space",
        p1: { blade: "attack", power: 90, angle: 0 },
        p2: { blade: "defense", power: 80, angle: 0 },
      }),
    );
    expect(coordinator.state.phase).toBe("matched");
    transport.emit(
      message({
        type: "start",
        matchId: "m1",
        countdownMs: 0,
        stadium: "neon",
        environment: "space",
        p1: { blade: "attack", power: 90, angle: 0 },
        p2: { blade: "defense", power: 80, angle: 0 },
      }),
    );
    coordinator.update();
    expect(coordinator.publishHostSnapshot(battle)).toBe(1);
    now = 49;
    expect(coordinator.publishHostSnapshot(battle)).toBeNull();
    expect(coordinator.publishHostSnapshot(battle, now, true)).toBe(2);
    now = 50;
    expect(coordinator.publishHostSnapshot(battle)).toBeNull();
    now = 99;
    expect(coordinator.publishHostSnapshot(battle)).toBe(3);
  });

  it("distinguishes opponent departure, connection loss, and completion", () => {
    const transport = new FakeTransport();
    const coordinator = new OnlineMatchCoordinator(transport, () => 0);
    coordinator.connect("ws://test");
    transport.emit(
      message({
        type: "matched",
        matchId: "m1",
        role: "host",
        localTopId: "p1",
      }),
    );
    transport.emit(
      message({ type: "opponent_left", matchId: "m1", phase: "matched" }),
    );
    expect(coordinator.state.termination).toBe("opponent_left");

    coordinator.connect("ws://test");
    transport.emit({ type: "socket_error" });
    expect(coordinator.state.termination).toBe("connection_lost");

    coordinator.connect("ws://test");
    transport.emit(
      message({
        type: "matched",
        matchId: "m2",
        role: "host",
        localTopId: "p1",
      }),
    );
    transport.emit(
      message({
        type: "start",
        matchId: "m2",
        countdownMs: 0,
        stadium: "neon",
        environment: "space",
        p1: { blade: "attack", power: 90, angle: 0 },
        p2: { blade: "defense", power: 80, angle: 0 },
      }),
    );
    coordinator.update();
    coordinator.publishMatchEnd(
      {
        winnerId: "p1",
        finishType: "SPIN FINISH",
        duration: 1,
        finalRpm: 3000,
      },
      1,
      1,
    );
    expect(coordinator.state.termination).toBe("completed");
  });

  it("shows the result when match_end arrives before the final snapshot", () => {
    const now = 1000;
    const transport = new FakeTransport();
    const coordinator = new OnlineMatchCoordinator(transport, () => now);
    coordinator.connect("ws://test");
    transport.emit(message({ type: "hello_ok", protocolVersion: 1 }));
    transport.emit(message({ type: "queued", requestId: "q1" }));
    transport.emit(
      message({
        type: "matched",
        matchId: "m1",
        role: "guest",
        localTopId: "p2",
      }),
    );
    transport.emit(
      message({
        type: "start",
        matchId: "m1",
        countdownMs: 0,
        stadium: "neon",
        environment: "space",
        p1: { blade: "attack", power: 90, angle: 0 },
        p2: { blade: "defense", power: 80, angle: 0 },
      }),
    );
    transport.emit(
      message({
        type: "match_end",
        matchId: "m1",
        stateSeq: 2,
        t: 1,
        winnerId: "draw",
        finishType: "SPIN FINISH",
        duration: 1,
        finalRpm: 0,
      }),
    );

    expect(coordinator.state.phase).toBe("result");
    expect(coordinator.state.view.result).toMatchObject({
      winnerId: "draw",
      finishType: "SPIN FINISH",
    });
  });
});
