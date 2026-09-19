import { describe, expect, it } from "vitest";
import { BeybladeRuntime, type MatchConfig } from "@cyberblade/core";
import { CannonBattleSimulation } from "./index";

function launched(config: Partial<MatchConfig> = {}) {
  const simulation = new CannonBattleSimulation();
  simulation.initialize({
    p1Type: "stamina",
    p2Type: "stamina",
    stadiumTheme: "neon",
    seed: 3,
    ...config,
  });
  simulation.launch({ p1Power: 80, p1Angle: 90, p2Power: 80, p2Angle: 270 });
  return simulation;
}

function run(simulation: CannonBattleSimulation, seconds: number) {
  const events = [];
  for (let index = 0; index < seconds * 60; index += 1)
    events.push(...simulation.step(1 / 60).events);
  return events;
}

describe("special moves", () => {
  it("refuses to fire before the gauge is full", () => {
    const simulation = launched();
    run(simulation, 1);
    expect(simulation.snapshot.p1.special?.charge).toBeLessThan(1);
    expect(simulation.activateSpecial("p1")).toBe(false);
  });

  it("charges over time, fires once, and reports the activation", () => {
    const simulation = launched();
    run(simulation, 10);
    expect(simulation.snapshot.p1.special?.charge).toBe(1);
    const rpmBefore = simulation.snapshot.p1.rpm;

    expect(simulation.activateSpecial("p1")).toBe(true);
    // Corona Regen (the stamina default) restores spin immediately.
    expect(simulation.snapshot.p1.rpm).toBeGreaterThan(rpmBefore);
    expect(simulation.snapshot.p1.special).toMatchObject({
      charge: 0,
      used: true,
      active: true,
    });
    const events = run(simulation, 1 / 60);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "special",
        top: "p1",
        move: "corona_regen",
      }),
    );

    run(simulation, 10);
    expect(simulation.snapshot.p1.special?.charge).toBe(0);
    expect(simulation.activateSpecial("p1")).toBe(false);
  });

  it("lets the CPU fire its own special without input", () => {
    const simulation = launched({ aiSpecialTopIds: ["p2"] });
    const events = run(simulation, 19);
    const fired = events.filter((event) => event.type === "special");
    expect(fired.map((event) => event.type === "special" && event.top)).toEqual(
      ["p2"],
    );
    expect(simulation.snapshot.p1.special?.used).toBe(false);
  });

  it("routes a runtime special input to the simulation during battle", () => {
    const runtime = new BeybladeRuntime(new CannonBattleSimulation());
    runtime.dispatch({
      type: "prepare",
      config: {
        p1Type: "attack",
        p2Type: "defense",
        stadiumTheme: "neon",
        seed: 5,
      },
    });
    runtime.dispatch({
      type: "launch",
      launch: { p1Power: 80, p1Angle: 0, p2Power: 80, p2Angle: 180 },
    });
    // Tick only until the gauge fills so the match can't end first.
    for (
      let index = 0;
      index < 600 && runtime.state.battle?.p1.special?.charge !== 1;
      index += 1
    )
      runtime.dispatch({ type: "tick", deltaSeconds: 1 / 60 });
    expect(runtime.state.phase).toBe("battle");
    runtime.dispatch({ type: "special", top: "p1" });
    runtime.dispatch({ type: "tick", deltaSeconds: 1 / 60 });
    expect(runtime.state.battle?.p1.special?.used).toBe(true);
    expect(runtime.state.events).toContainEqual(
      expect.objectContaining({ type: "special", top: "p1" }),
    );
  });
});
