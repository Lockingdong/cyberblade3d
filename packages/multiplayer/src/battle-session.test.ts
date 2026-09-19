import { describe, expect, it, vi } from "vitest";
import {
  BeybladeRuntime,
  type BattleSimulation,
  type BattleSnapshot,
  type LaunchInput,
  type SimulationStep,
  type TopId,
} from "@cyberblade/core";
import { BattleSession } from "./battle-session";
import {
  OnlineMatchCoordinator,
  type OnlineTransport,
} from "./online-match-coordinator";
import type { MatchmakingClientEvent } from "./matchmaking-client";
import type { ServerMessage } from "./protocol";

const top = (id: "p1" | "p2") => ({
  id,
  type: "attack" as const,
  position: { x: 0, y: 1, z: 0 },
  quaternion: { x: 0, y: 0, z: 0, w: 1 },
  rpm: 4000,
  stability: 80,
  isBurst: false,
  isStopped: false,
  isOut: false,
});
class Simulation implements BattleSimulation {
  snapshot: BattleSnapshot = { elapsed: 0, p1: top("p1"), p2: top("p2") };
  tick = 0;
  launch = vi.fn<(input: LaunchInput) => void>();
  activateSpecial = vi.fn<(top: TopId) => boolean>(() => true);
  initialize = vi.fn(() => {
    this.tick = 0;
  });
  dispose() {}
  step(delta: number): SimulationStep {
    this.tick++;
    this.snapshot = {
      ...this.snapshot,
      elapsed: this.snapshot.elapsed + delta,
    };
    return {
      snapshot: this.snapshot,
      tick: this.tick,
      events:
        this.tick === 2
          ? [{ type: "burst", top: "p2", position: { x: 0, y: 0, z: 0 } }]
          : [],
      ...(this.tick >= 2
        ? {
            finish: {
              winnerId: "p1" as const,
              finishType: "BURST FINISH" as const,
            },
          }
        : {}),
    };
  }
}
function setup(role: "host" | "guest") {
  let listener: ((event: MatchmakingClientEvent) => void) | undefined;
  let now = 0;
  let seq = 0;
  const transport: OnlineTransport = {
    connect() {},
    joinQueue: () => "q1",
    createRoom: () => "r1",
    joinRoom: () => "j1",
    cancelQueue() {},
    ready() {},
    leave() {},
    rematch() {},
    requestSpecial() {},
    dispose() {},
    sendHostSnapshot: vi.fn(() => ++seq),
    sendHostEvent: vi.fn(() => 1),
    sendMatchEnd: vi.fn(),
    subscribe(fn) {
      listener = fn;
      return () => {
        listener = undefined;
      };
    },
  };
  const coordinator = new OnlineMatchCoordinator(transport, () => now);
  const simulation = new Simulation();
  const runtime = new BeybladeRuntime(simulation);
  const session = new BattleSession(runtime, coordinator, () => now);
  const emit = (message: ServerMessage) =>
    listener?.({ type: "message", message });
  runtime.subscribe((event) => {
    if (event.type === "stateChanged") session.publish(event.state);
  });
  function match(id: string) {
    emit({
      type: "matched",
      matchId: id,
      role,
      localTopId: role === "host" ? "p1" : "p2",
    });
    emit({
      type: "start",
      matchId: id,
      countdownMs: 100,
      stadium: "neon",
      environment: "neon-city",
      p1: { blade: "attack", power: 80, angle: 10 },
      p2: { blade: "defense", power: 90, angle: -15 },
    });
    session.prepare();
  }
  function step() {
    now += 100;
    session.tick(now, 0.1);
  }
  return {
    session,
    coordinator,
    runtime,
    simulation,
    transport,
    match,
    step,
    emit,
  };
}

describe("BattleSession", () => {
  it("launches once, relays burst/ending once, completes, and resets on a new match", () => {
    const { session, runtime, simulation, transport, match, step } =
      setup("host");
    match("m1");
    session.prepare();
    expect(simulation.initialize).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 20; i++) step();
    expect(simulation.launch).toHaveBeenCalledExactlyOnceWith({
      p1Power: 80,
      p1Angle: 10,
      p2Power: 90,
      p2Angle: 165,
    });
    expect(runtime.state.phase).toBe("result");
    expect(transport.sendHostEvent).toHaveBeenCalledTimes(2);
    expect(transport.sendMatchEnd).toHaveBeenCalledTimes(1);
    session.publish(runtime.state);
    expect(transport.sendMatchEnd).toHaveBeenCalledTimes(1);
    match("m2");
    for (let i = 0; i < 20; i++) step();
    expect(simulation.launch).toHaveBeenCalledTimes(2);
    expect(transport.sendHostEvent).toHaveBeenCalledTimes(4);
    expect(transport.sendMatchEnd).toHaveBeenCalledTimes(2);
  });
  it("fires the guest's special on the host simulation when relayed", () => {
    const { coordinator, simulation, match, step, emit } = setup("host");
    match("m1");
    step();
    expect(coordinator.state.phase).toBe("battle");
    emit({ type: "opponent_special", matchId: "m1" });
    step();
    expect(simulation.activateSpecial).toHaveBeenCalledExactlyOnceWith("p2");
    step();
    expect(simulation.activateSpecial).toHaveBeenCalledTimes(1);
  });
  it("advances guest playback without initializing or running local physics", () => {
    const { coordinator, simulation, transport, match, step } = setup("guest");
    match("m1");
    step();
    expect(coordinator.state.phase).toBe("battle");
    expect(simulation.initialize).not.toHaveBeenCalled();
    expect(simulation.launch).not.toHaveBeenCalled();
    expect(simulation.tick).toBe(0);
    expect(transport.sendHostSnapshot).not.toHaveBeenCalled();
  });
});
