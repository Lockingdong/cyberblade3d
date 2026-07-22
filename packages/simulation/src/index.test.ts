import { describe, expect, it } from "vitest";
import { CannonBattleSimulation } from "./index";

describe("CannonBattleSimulation", () => {
  it("is reproducible for a fixed seed", () => {
    const run = () => {
      const simulation = new CannonBattleSimulation();
      simulation.initialize({
        p1Type: "attack",
        p2Type: "defense",
        stadiumTheme: "neon",
        seed: 42,
        perfectLaunchTopIds: ["p1"],
      });
      simulation.launch({
        p1Power: 90,
        p1Angle: 20,
        p2Power: 75,
        p2Angle: 200,
      });
      for (let index = 0; index < 60; index += 1) simulation.step(1 / 60);
      return simulation.snapshot;
    };
    expect(run()).toEqual(run());
  });

  it("starts both tops with rpm after launch", () => {
    const simulation = new CannonBattleSimulation();
    simulation.initialize({
      p1Type: "attack",
      p2Type: "defense",
      stadiumTheme: "toxic",
      seed: 1,
      perfectLaunchTopIds: ["p1"],
    });
    simulation.launch({
      p1Power: 90,
      p1Angle: 0,
      p2Power: 70,
      p2Angle: 180,
    });
    simulation.step(1 / 60);
    expect(simulation.snapshot.p1.rpm).toBeGreaterThan(0);
    expect(simulation.snapshot.p2.rpm).toBeGreaterThan(0);
  });

  it.each([
    ["p1", ["p1"] as const],
    ["p2", ["p2"] as const],
  ] as const)(
    "applies the perfect launch bonus to eligible %s",
    (id, eligible) => {
      const simulation = new CannonBattleSimulation();
      simulation.initialize({
        p1Type: "attack",
        p2Type: "attack",
        stadiumTheme: "neon",
        seed: 1,
        perfectLaunchTopIds: eligible,
      });
      simulation.launch({
        p1Power: 90,
        p1Angle: 0,
        p2Power: 90,
        p2Angle: 180,
      });

      const eligibleRpm = simulation.snapshot[id].rpm;
      const otherId = id === "p1" ? "p2" : "p1";
      expect(eligibleRpm).toBeCloseTo(simulation.snapshot[otherId].rpm * 1.15);
    },
  );
});
