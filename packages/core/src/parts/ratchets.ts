import type { RatchetPart } from "./types";

export const RATCHET_PARTS: Record<string, RatchetPart> = {
  // Attack
  attack_standard: {
    id: "attack_standard",
    name: "赤紅棘輪",
    englishName: "Crimson Ratchet",
    maxStability: 90,
    massContribution: 0.33,
  },

  // Defense
  defense_standard: {
    id: "defense_standard",
    name: "玄武棘輪",
    englishName: "Iron Ratchet",
    maxStability: 140,
    massContribution: 0.54,
  },

  // Stamina
  stamina_standard: {
    id: "stamina_standard",
    name: "黃金棘輪",
    englishName: "Sol Ratchet",
    maxStability: 80,
    massContribution: 0.24,
  },

  // Balance
  balance_standard: {
    id: "balance_standard",
    name: "翡翠棘輪",
    englishName: "Emerald Ratchet",
    maxStability: 110,
    massContribution: 0.39,
  },
};
