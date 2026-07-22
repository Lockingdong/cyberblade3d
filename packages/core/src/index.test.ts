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

  it("keeps the full ten-top roster and counter cycle", () => {
    expect(Object.keys(BEYBLADES)).toHaveLength(10);
    expect(counterType("attack")).toBe("defense");
    expect(counterType("defense")).toBe("vampire");
    expect(counterType("stamina")).toBe("attack");
    expect(counterType("balance")).toBe("phantom");
    expect(counterType("berserk")).toBe("balance");
  });

  it("verifies Object.keys(BEYBLADES) order matches the expected preset order", () => {
    const expectedOrder = [
      "attack",
      "defense",
      "stamina",
      "balance",
      "crusher",
      "phantom",
      "aegis",
      "vampire",
      "zephyr",
      "berserk",
    ];
    expect(Object.keys(BEYBLADES)).toEqual(expectedOrder);
  });

  it("verifies the assembled attributes of BEYBLADES match their original values", () => {
    const expectedPresets = {
      attack: {
        type: "attack",
        bladeId: "attack",
        ratchetId: "attack",
        bitId: "attack",
        chipId: "attack",
        name: "赤紅狂嵐",
        englishName: "Red Storm",
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
        bladeId: "defense",
        ratchetId: "defense",
        bitId: "defense",
        chipId: "defense",
        name: "玄武重甲",
        englishName: "Iron Dome",
        mass: 1.8,
        maxRpm: 5000,
        rpmDecay: 270,
        maxStability: 140,
        speed: 6,
        friction: 0.05,
        color: 0x7a8b99,
        damageTaken: 0.5,
        ai: "hold",
        counteredBy: "vampire",
      },
      stamina: {
        type: "stamina",
        bladeId: "stamina",
        ratchetId: "stamina",
        bitId: "stamina",
        chipId: "stamina",
        name: "黃金恆星",
        englishName: "Sol Corona",
        mass: 0.8,
        maxRpm: 5500,
        rpmDecay: 290,
        maxStability: 80,
        speed: 9,
        friction: 0.02,
        color: 0xffc800,
        damageTaken: 1.2,
        ai: "orbitEvade",
        counteredBy: "attack",
      },
      balance: {
        type: "balance",
        bladeId: "balance",
        ratchetId: "balance",
        bitId: "balance",
        chipId: "balance",
        name: "翡翠疾風",
        englishName: "Emerald Gale",
        mass: 1.3,
        maxRpm: 5300,
        rpmDecay: 310,
        maxStability: 110,
        speed: 9.5,
        friction: 0.08,
        color: 0xb5e61d,
        damageTaken: 0.9,
        ai: "adaptive",
        counteredBy: "phantom",
      },
      crusher: {
        type: "crusher",
        bladeId: "crusher",
        ratchetId: "crusher",
        bitId: "crusher",
        chipId: "crusher",
        name: "黑曜巨鎚",
        englishName: "Obsidian Maul",
        mass: 1.7,
        maxRpm: 5100,
        rpmDecay: 330,
        maxStability: 105,
        speed: 8,
        friction: 0.1,
        color: 0xd4883b,
        damageTaken: 0.7,
        ai: "seek",
        counteredBy: "zephyr",
      },
      phantom: {
        type: "phantom",
        bladeId: "phantom",
        ratchetId: "phantom",
        bitId: "phantom",
        chipId: "phantom",
        name: "幻影夜刃",
        englishName: "Phantom Edge",
        mass: 0.9,
        maxRpm: 6000,
        rpmDecay: 400,
        maxStability: 70,
        speed: 11.5,
        friction: 0.11,
        color: 0xa855f7,
        damageTaken: 0.8,
        ai: "strafe",
        counteredBy: "stamina",
      },
      aegis: {
        type: "aegis",
        bladeId: "aegis",
        ratchetId: "aegis",
        bitId: "aegis",
        chipId: "aegis",
        name: "白銀聖盾",
        englishName: "Silver Aegis",
        mass: 1.6,
        maxRpm: 5150,
        rpmDecay: 260,
        maxStability: 130,
        speed: 7,
        friction: 0.04,
        color: 0xe2e8f0,
        damageTaken: 0.55,
        ai: "counterHold",
        counteredBy: "berserk",
      },
      vampire: {
        type: "vampire",
        bladeId: "vampire",
        ratchetId: "vampire",
        bitId: "vampire",
        chipId: "vampire",
        name: "暗夜血蝕",
        englishName: "Blood Eclipse",
        mass: 1.0,
        maxRpm: 5400,
        rpmDecay: 300,
        maxStability: 85,
        speed: 8.5,
        friction: 0.03,
        color: 0xe11d48,
        damageTaken: 1.1,
        ai: "seek",
        counteredBy: "crusher",
        spinSteal: 0.5,
      },
      zephyr: {
        type: "zephyr",
        bladeId: "zephyr",
        ratchetId: "zephyr",
        bitId: "zephyr",
        chipId: "zephyr",
        name: "蒼穹流星",
        englishName: "Azure Meteor",
        mass: 0.7,
        maxRpm: 5700,
        rpmDecay: 360,
        maxStability: 75,
        speed: 12,
        friction: 0.09,
        color: 0x0ea5e9,
        damageTaken: 0.85,
        ai: "strafe",
        counteredBy: "aegis",
      },
      berserk: {
        type: "berserk",
        bladeId: "berserk",
        ratchetId: "berserk",
        bitId: "berserk",
        chipId: "berserk",
        name: "狂焰修羅",
        englishName: "Blaze Asura",
        mass: 1.7,
        maxRpm: 6000,
        rpmDecay: 330,
        maxStability: 70,
        speed: 14.0,
        friction: 0.12,
        color: 0xf97316,
        damageTaken: 0.85,
        ai: "seek",
        counteredBy: "balance",
        attackMultiplier: 1.5,
      },
    };
    expect(BEYBLADES).toEqual(expectedPresets);
  });

  it("uses every top exactly once as a counter", () => {
    const types = Object.keys(BEYBLADES) as (keyof typeof BEYBLADES)[];
    const counters = types.map((type) => counterType(type));
    expect(new Set(counters).size).toBe(types.length);
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
