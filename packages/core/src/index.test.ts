import { describe, expect, it } from "vitest";
import {
  BEYBLADES,
  clampLaunchPower,
  counterType,
  isPerfectLaunch,
  localMatchOutcome,
  opponentTopId,
  resolveMatchFinish,
  stadiumVariantFromMatchId,
  stadiumVariantFromSeed,
  type BattleSnapshot,
} from "./index";

describe("beyblade rules", () => {
  it("selects a deterministic 50/50 stadium variant from a seed", () => {
    expect(stadiumVariantFromSeed(42)).toBe(stadiumVariantFromSeed(42));
    expect(new Set([0, 1, 2, 3].map(stadiumVariantFromSeed))).toEqual(
      new Set(["light", "dark"]),
    );
  });

  it("selects the same online stadium variant from the same match id", () => {
    expect(stadiumVariantFromMatchId("match-123")).toBe(
      stadiumVariantFromMatchId("match-123"),
    );
    expect(stadiumVariantFromMatchId("match-123")).not.toBe(
      stadiumVariantFromMatchId("match-124"),
    );
  });

  it("keeps the four-top core roster and counter cycle", () => {
    expect(Object.keys(BEYBLADES)).toHaveLength(4);
    expect(counterType("attack")).toBe("defense");
    expect(counterType("defense")).toBe("stamina");
    expect(counterType("stamina")).toBe("attack");
    expect(counterType("balance")).toBe("attack");
  });

  it("verifies Object.keys(BEYBLADES) order matches the expected preset order", () => {
    const expectedOrder = [
      "attack",
      "defense",
      "stamina",
      "balance",
    ];
    expect(Object.keys(BEYBLADES)).toEqual(expectedOrder);
  });

  it("verifies the assembled attributes of BEYBLADES match their original values", () => {
    const expectedPresets = {
      attack: {
        type: "attack",
        bladeId: "attack_slash",
        ratchetId: "attack_standard",
        bitId: "attack_flat",
        chipId: "attack_core",
        name: "赤紅核心",
        englishName: "Crimson Core",
        mass: 1.1,
        maxRpm: 5900,
        rpmDecay: 390,
        maxStability: 90,
        speed: 12,
        friction: 0.12,
        color: 0xe60012,
        damageTaken: 0.6,
        ai: "seek",
        counteredBy: "defense",
      },
      defense: {
        type: "defense",
        bladeId: "defense_shield",
        ratchetId: "defense_standard",
        bitId: "defense_ball",
        chipId: "defense_core",
        name: "玄武核心",
        englishName: "Iron Core",
        mass: 1.8,
        maxRpm: 5000,
        rpmDecay: 270,
        maxStability: 140,
        speed: 6,
        friction: 0.05,
        color: 0x7a8b99,
        damageTaken: 0.45,
        ai: "hold",
        counteredBy: "stamina",
      },
      stamina: {
        type: "stamina",
        bladeId: "stamina_solar",
        ratchetId: "stamina_standard",
        bitId: "stamina_stamina",
        chipId: "stamina_core",
        name: "黃金核心",
        englishName: "Sol Core",
        mass: 0.8,
        maxRpm: 5500,
        rpmDecay: 290,
        maxStability: 80,
        speed: 9,
        friction: 0.02,
        color: 0xffc800,
        damageTaken: 1.1,
        ai: "orbitEvade",
        counteredBy: "attack",
      },
      balance: {
        type: "balance",
        bladeId: "balance_emerald",
        ratchetId: "balance_standard",
        bitId: "balance_balance",
        chipId: "balance_core",
        name: "翡翠核心",
        englishName: "Emerald Core",
        mass: 1.3,
        maxRpm: 5300,
        rpmDecay: 310,
        maxStability: 110,
        speed: 9.5,
        friction: 0.08,
        color: 0x22c55e,
        damageTaken: 0.85,
        ai: "adaptive",
        counteredBy: "attack",
      },
    };
    expect(BEYBLADES).toEqual(expectedPresets);
  });

  it("recognizes and clamps launch power", () => {
    expect(isPerfectLaunch(85)).toBe(true);
    expect(isPerfectLaunch(95)).toBe(true);
    expect(isPerfectLaunch(84.9)).toBe(false);
    expect(clampLaunchPower(0)).toBe(10);
    expect(clampLaunchPower(120)).toBe(100);
  });

  it("maps the opponent and result relative to either local top", () => {
    expect(opponentTopId("p1")).toBe("p2");
    expect(opponentTopId("p2")).toBe("p1");
    expect(localMatchOutcome("p2", "p2")).toBe("victory");
    expect(localMatchOutcome("p1", "p2")).toBe("defeat");
    expect(localMatchOutcome("draw", "p2")).toBe("draw");
  });
});

const baseTop: BattleSnapshot["p1"] = {
  id: "p1",
  type: "attack",
  position: { x: 0, y: 0.7, z: 0 },
  quaternion: { x: 0, y: 0, z: 0, w: 1 },
  rpm: 3000,
  stability: 50,
  isBurst: false,
  isStopped: false,
  isOut: false,
};

function battle(
  p1: Partial<BattleSnapshot["p1"]> = {},
  p2: Partial<BattleSnapshot["p2"]> = {},
  elapsed = 10,
): BattleSnapshot {
  return {
    elapsed,
    p1: { ...baseTop, ...p1, id: "p1" },
    p2: { ...baseTop, ...p2, id: "p2", type: "defense" },
  };
}

describe("finish rules", () => {
  it("resolves over, burst and spin finishes", () => {
    expect(resolveMatchFinish(battle({ isOut: true }))).toEqual({
      winnerId: "p2",
      finishType: "OVER FINISH",
    });
    expect(
      resolveMatchFinish(battle({ isOut: true }, { isOut: true })),
    ).toEqual({
      winnerId: "draw",
      finishType: "OVER FINISH",
    });
    expect(resolveMatchFinish(battle({}, { isBurst: true }))).toEqual({
      winnerId: "p1",
      finishType: "BURST FINISH",
    });
    expect(
      resolveMatchFinish(battle({ isBurst: true }, { isBurst: true })),
    ).toEqual({
      winnerId: "draw",
      finishType: "BURST FINISH",
    });
    expect(resolveMatchFinish(battle({ isStopped: true }))).toEqual({
      winnerId: "p2",
      finishType: "SPIN FINISH",
    });
  });

  it("uses the 100 RPM draw window at the time limit", () => {
    expect(
      resolveMatchFinish(battle({ rpm: 3000 }, { rpm: 2950 }, 20)),
    ).toEqual({
      winnerId: "draw",
      finishType: "TIME FINISH",
    });
    expect(
      resolveMatchFinish(battle({ rpm: 3200 }, { rpm: 2900 }, 20)),
    ).toEqual({
      winnerId: "p1",
      finishType: "TIME FINISH",
    });
  });
});
