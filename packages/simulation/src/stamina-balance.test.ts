import { describe, expect, it } from "vitest";
import type { BeybladeType, FinishType, MatchConfig, WinnerId } from "@game-pool/beyblade-core";
import { CannonBattleSimulation } from "./index";

const GOLDEN_FALCON_PARTS = {
  bladeId: "stamina_sky_gale",
  ratchetId: "stamina_sky_ring_ratchet",
  bitId: "stamina_zephyr_needle_bit",
  chipId: "stamina_sky_falcon_chip",
} as const;

const OPPONENTS: readonly BeybladeType[] = [
  "attack",
  "defense",
  "stamina",
  "balance",
];

function runBattle(opponent: BeybladeType, seed: number, skyFalconSide: "p1" | "p2"): {
  winnerId: WinnerId;
  finishType: FinishType;
} {
  const simulation = new CannonBattleSimulation();
  const config: MatchConfig = {
    p1Type: skyFalconSide === "p1" ? "stamina" : opponent,
    p2Type: skyFalconSide === "p2" ? "stamina" : opponent,
    stadiumTheme: "neon",
    seed,
    perfectLaunchTopIds: [],
    ...(skyFalconSide === "p1"
      ? {
          p1BladeId: GOLDEN_FALCON_PARTS.bladeId,
          p1RatchetId: GOLDEN_FALCON_PARTS.ratchetId,
          p1BitId: GOLDEN_FALCON_PARTS.bitId,
          p1ChipId: GOLDEN_FALCON_PARTS.chipId,
        }
      : {
          p2BladeId: GOLDEN_FALCON_PARTS.bladeId,
          p2RatchetId: GOLDEN_FALCON_PARTS.ratchetId,
          p2BitId: GOLDEN_FALCON_PARTS.bitId,
          p2ChipId: GOLDEN_FALCON_PARTS.chipId,
        }),
  };
  simulation.initialize(config);
  simulation.launch({ p1Power: 75, p1Angle: 0, p2Power: 75, p2Angle: 180 });
  for (let tick = 0; tick < 60 * 21; tick += 1) {
    const finish = simulation.step(1 / 60).finish;
    if (finish) {
      simulation.dispose();
      return finish;
    }
  }
  simulation.dispose();
  throw new Error(`Battle did not finish for ${opponent}, seed ${seed}, side ${skyFalconSide}`);
}

function decisiveWinRate(wins: number, losses: number): number {
  return wins + losses === 0 ? 0.5 : wins / (wins + losses);
}

describe("Golden Falcon stamina balance matrix", () => {
  it("stays competitive across the complete default-archetype matrix", () => {
    let totalWins = 0;
    let totalLosses = 0;
    const summaries: string[] = [];

    for (const opponent of OPPONENTS) {
      let wins = 0;
      let losses = 0;
      const finishes: Partial<Record<FinishType, number>> = {};
      for (let seed = 1; seed <= 25; seed += 1) {
        for (const side of ["p1", "p2"] as const) {
          const finish = runBattle(opponent, seed, side);
          finishes[finish.finishType] = (finishes[finish.finishType] ?? 0) + 1;
          if (finish.winnerId === "draw") continue;
          if (finish.winnerId === side) wins += 1;
          else losses += 1;
        }
      }
      const rate = decisiveWinRate(wins, losses);
      summaries.push(
        `${opponent}: ${wins}-${losses} (${Math.round(rate * 100)}%), ${JSON.stringify(finishes)}`,
      );
      totalWins += wins;
      totalLosses += losses;
    }

    const totalRate = decisiveWinRate(totalWins, totalLosses);
    const label = `overall: ${totalWins}-${totalLosses}; ${summaries.join("; ")}`;
    expect.soft(totalRate, label).toBeGreaterThanOrEqual(0.45);
    expect.soft(totalRate, label).toBeLessThanOrEqual(0.55);
  }, 30_000);
});
