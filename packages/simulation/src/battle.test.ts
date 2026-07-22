import { describe, expect, it } from "vitest";
import type { SimulationEvent } from "@game-pool/beyblade-core";
import { CannonBattleSimulation } from "./index";

function runBattle(seed: number) {
  const simulation = new CannonBattleSimulation();
  simulation.initialize({
    p1Type: "attack",
    p2Type: "defense",
    stadiumTheme: "neon",
    seed,
    perfectLaunchTopIds: ["p1"],
  });
  simulation.launch({
    p1Power: 90,
    p1Angle: 20,
    p2Power: 75,
    p2Angle: 200,
  });
  const events: SimulationEvent[] = [];
  const ticks: number[] = [];
  let finish: ReturnType<CannonBattleSimulation["step"]>["finish"];
  for (let index = 0; index < 60 * 25 && !finish; index += 1) {
    const step = simulation.step(1 / 60);
    events.push(...step.events);
    ticks.push(step.tick);
    finish = step.finish;
  }
  return { simulation, events, ticks, finish };
}

describe("full battle", () => {
  it("produces collisions and resolves a finish within the time limit", () => {
    const { events, finish } = runBattle(7);
    expect(events.some((event) => event.type === "collision")).toBe(true);
    expect(events.some((event) => event.type === "trail")).toBe(true);
    expect(finish).toBeDefined();
  });

  it("emits strictly increasing tick ids", () => {
    const { ticks } = runBattle(7);
    for (let index = 1; index < ticks.length; index += 1) {
      expect(ticks[index]!).toBeGreaterThan(ticks[index - 1]!);
    }
  });

  it("keeps tops inside the arena unless knocked out", () => {
    const { simulation } = runBattle(11);
    for (const top of [simulation.snapshot.p1, simulation.snapshot.p2]) {
      const distance = Math.hypot(top.position.x, top.position.z);
      if (!top.isOut) expect(distance).toBeLessThan(8.5);
    }
  });
});
