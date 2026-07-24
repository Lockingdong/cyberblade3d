import type { BladePart } from "./types";

export const BLADE_PARTS: Record<string, BladePart> = {
  // Attack (Red/Crimson)
  attack_slash: {
    id: "attack_slash",
    name: "赤紅斬刃",
    englishName: "Crimson Slash",
    ai: "seek",
    damageTaken: 0.6,
    counteredBy: "defense",
    color: 0xe60012,
    massContribution: 0.66,
    exclusiveTo: "attack",
  },

  attack_ignis: {
    id: "attack_ignis",
    name: "烈焰暴龍刃",
    englishName: "Ignis Blade",
    ai: "seek",
    damageTaken: 0.8,
    counteredBy: "defense",
    color: 0xe60012,
    massContribution: 0.7,
    attackMultiplier: 1.4,
    exclusiveTo: "attack",
  },

  // Defense (Iron/Grey)
  defense_shield: {
    id: "defense_shield",
    name: "玄武盾刃",
    englishName: "Iron Fortress",
    ai: "hold",
    damageTaken: 0.45,
    counteredBy: "stamina",
    color: 0x7a8b99,
    massContribution: 1.08,
    exclusiveTo: "defense",
  },

  // Stamina (Gold/Yellow)
  stamina_solar: {
    id: "stamina_solar",
    name: "黃金日輪",
    englishName: "Sol Solar",
    ai: "orbitEvade",
    damageTaken: 1.1,
    counteredBy: "attack",
    color: 0xffc800,
    massContribution: 0.48,
    exclusiveTo: "stamina",
  },

  // Balance (Emerald/Green)
  balance_emerald: {
    id: "balance_emerald",
    name: "翡翠疾風",
    englishName: "Emerald Gale",
    ai: "adaptive",
    damageTaken: 0.85,
    counteredBy: "attack",
    color: 0x22c55e,
    massContribution: 0.78,
    exclusiveTo: "balance",
  },
};
