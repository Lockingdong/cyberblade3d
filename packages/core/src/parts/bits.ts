import type { BitPart } from "./types";

export const BIT_PARTS: Record<string, BitPart> = {
  // Attack
  attack_flat: {
    id: "attack_flat",
    name: "赤紅平軸",
    englishName: "Crimson Flat Bit",
    maxRpm: 5900,
    rpmDecay: 390,
    speed: 12,
    friction: 0.12,
    massContribution: 0.11,
  },

  attack_impact_bit: {
    id: "attack_impact_bit",
    name: "狂暴衝壓軸",
    englishName: "Impact Bit",
    maxRpm: 5700,
    rpmDecay: 510,
    speed: 15,
    friction: 0.16,
    massContribution: 0.12,
  },

  // Defense
  defense_ball: {
    id: "defense_ball",
    name: "玄武球軸",
    englishName: "Iron Ball Bit",
    maxRpm: 5000,
    rpmDecay: 270,
    speed: 6,
    friction: 0.05,
    massContribution: 0.18,
  },

  // Stamina
  stamina_stamina: {
    id: "stamina_stamina",
    name: "黃金持久軸",
    englishName: "Sol Bit",
    maxRpm: 5500,
    rpmDecay: 290,
    speed: 9,
    friction: 0.02,
    massContribution: 0.08,
  },

  // Balance
  balance_balance: {
    id: "balance_balance",
    name: "翡翠平衡軸",
    englishName: "Emerald Bit",
    maxRpm: 5300,
    rpmDecay: 310,
    speed: 9.5,
    friction: 0.08,
    massContribution: 0.13,
  },
};
