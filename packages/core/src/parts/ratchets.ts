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

  attack_drake_ratchet: {
    id: "attack_drake_ratchet",
    name: "龍骨棘輪",
    englishName: "Drake Ratchet",
    maxStability: 75,
    massContribution: 0.35,
  },

  attack_bastion_ratchet: {
    id: "attack_bastion_ratchet",
    name: "磐岩棘輪",
    englishName: "Bastion Ratchet",
    maxStability: 105,
    massContribution: 0.4,
  },

  // Defense
  defense_standard: {
    id: "defense_standard",
    name: "玄武棘輪",
    englishName: "Iron Ratchet",
    maxStability: 140,
    massContribution: 0.54,
  },

  defense_crusader_ratchet: {
    id: "defense_crusader_ratchet",
    name: "聖堡棘輪",
    englishName: "Citadel Ratchet",
    maxStability: 150,
    massContribution: 0.6,
  },

  // Stamina
  stamina_standard: {
    id: "stamina_standard",
    name: "黃金棘輪",
    englishName: "Sol Ratchet",
    maxStability: 80,
    massContribution: 0.24,
  },

  stamina_sky_ring_ratchet: {
    id: "stamina_sky_ring_ratchet",
    name: "日輪棘輪",
    englishName: "Solar Ring Ratchet",
    maxStability: 105,
    massContribution: 0.42,
  },

  // Balance
  balance_standard: {
    id: "balance_standard",
    name: "翡翠棘輪",
    englishName: "Emerald Ratchet",
    maxStability: 110,
    massContribution: 0.39,
  },

  balance_mirage_ratchet: {
    id: "balance_mirage_ratchet",
    name: "幻鱗棘輪",
    englishName: "Phantom Scale Ratchet",
    maxStability: 100,
    massContribution: 0.29,
  },
};
