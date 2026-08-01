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

  attack_guard_bit: {
    id: "attack_guard_bit",
    name: "重甲穩軸",
    englishName: "Guard Bit",
    maxRpm: 5600,
    rpmDecay: 340,
    speed: 9,
    friction: 0.09,
    massContribution: 0.15,
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

  defense_anchor_bit: {
    id: "defense_anchor_bit",
    name: "反擊錨軸",
    englishName: "Counter Anchor Bit",
    maxRpm: 4700,
    rpmDecay: 320,
    speed: 5.5,
    friction: 0.07,
    massContribution: 0.2,
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

  stamina_zephyr_needle_bit: {
    id: "stamina_zephyr_needle_bit",
    name: "永恆針軸",
    englishName: "Eternal Needle Bit",
    maxRpm: 5800,
    rpmDecay: 335,
    speed: 8,
    friction: 0.015,
    massContribution: 0.1,
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
