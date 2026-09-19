import { describe, expect, it } from "vitest";
import { BEYBLADE_ALLOWED_PARTS, type BeybladeType } from "@cyberblade/core";
import { CannonBattleSimulation } from "./index";

// Matchup matrix with both sides firing specials under the CPU policy. Guards
// the design goal that no blade type is a hard counter once the underdog
// picks the right chip. Type matchups keep their base lean, so a wrong chip
// may still lose badly; only mirrors are capped.
const SEEDS = 40;
const MIN_COUNTER_RATE = 0.35;
// Accepted counters, with their own floor so they still can't collapse. The
// Falcon chip out-dodges and out-spins defense to the time limit, echoing the
// classic stamina-beats-defense matchup.
const COUNTER_EXCEPTIONS: Record<string, number> = {
  "defense vs stamina_sky_falcon_chip": 0.15,
};
const MAX_RATE = 0.8;
const TYPES: readonly BeybladeType[] = [
  "attack",
  "defense",
  "stamina",
  "balance",
];

function winRate(
  p1Type: BeybladeType,
  p1ChipId: string,
  p2Type: BeybladeType,
  p2ChipId: string,
): number {
  let score = 0;
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const simulation = new CannonBattleSimulation();
    simulation.initialize({
      p1Type,
      p2Type,
      p1ChipId,
      p2ChipId,
      stadiumTheme: "neon",
      seed,
      aiSpecialTopIds: ["p1", "p2"],
    });
    // Deterministic spread of launch powers and directions per seed.
    const spread = (factor: number) => ((seed * factor) % 97) / 97;
    simulation.launch({
      p1Power: 70 + spread(13) * 30,
      p1Angle: spread(7) * 360,
      p2Power: 70 + spread(29) * 30,
      p2Angle: spread(31) * 360,
    });
    let finish;
    for (let index = 0; index < 60 * 30 && !finish; index += 1) {
      finish = simulation.step(1 / 60).finish;
    }
    simulation.dispose();
    if (finish?.winnerId === "p1") score += 1;
    else if (finish?.winnerId === "draw") score += 0.5;
  }
  return score / SEEDS;
}

describe("special move balance", () => {
  it("lets every type answer every opponent chip, and no chip decides a mirror", () => {
    const counterFailures: string[] = [];
    const cappedFailures: string[] = [];
    const report: string[] = [];
    for (const p1Type of TYPES) {
      for (const p2Type of TYPES) {
        for (const p2Chip of BEYBLADE_ALLOWED_PARTS[p2Type].allowedChips) {
          const rates = BEYBLADE_ALLOWED_PARTS[p1Type].allowedChips.map(
            (p1Chip) =>
              [p1Chip, winRate(p1Type, p1Chip, p2Type, p2Chip)] as const,
          );
          report.push(
            `${p1Type} vs ${p2Chip}: ${rates
              .map(([chip, rate]) => `${chip}=${Math.round(rate * 100)}`)
              .join(" ")}`,
          );
          const best = Math.max(...rates.map(([, rate]) => rate));
          const floor =
            COUNTER_EXCEPTIONS[`${p1Type} vs ${p2Chip}`] ?? MIN_COUNTER_RATE;
          if (best < floor)
            counterFailures.push(`${p1Type} vs ${p2Chip}: best ${best}`);
          // Within a mirror the chip alone must not decide the match.
          if (p1Type === p2Type)
            for (const [chip, rate] of rates)
              if (rate > MAX_RATE || rate < 1 - MAX_RATE)
                cappedFailures.push(`${chip} vs ${p2Chip}: ${rate}`);
        }
      }
    }
    if (process.env.BALANCE_REPORT) console.log(report.join("\n"));
    expect(counterFailures).toEqual([]);
    expect(cappedFailures).toEqual([]);
  }, 300_000);
});
