import type { ChipPart } from "./types";

export const CHIP_PARTS: Record<string, ChipPart> = {
  // Attack
  attack_core: {
    id: "attack_core",
    name: "赤紅晶片",
    englishName: "Crimson Chip",
    special: "blaze_rush",
  },
  attack_drake_chip: {
    id: "attack_drake_chip",
    name: "龍焰晶片",
    englishName: "Drake Chip",
    special: "drake_pierce",
  },
  attack_bastion_chip: {
    id: "attack_bastion_chip",
    name: "磐岩晶片",
    englishName: "Bastion Chip",
    special: "bastion_charge",
  },

  // Defense
  defense_core: {
    id: "defense_core",
    name: "玄武晶片",
    englishName: "Iron Chip",
    special: "genbu_bulwark",
  },
  defense_aegis_chip: {
    id: "defense_aegis_chip",
    name: "聖盾晶片",
    englishName: "Aegis Chip",
    special: "aegis_shockwave",
  },

  // Stamina
  stamina_core: {
    id: "stamina_core",
    name: "黃金晶片",
    englishName: "Sol Chip",
    special: "corona_regen",
  },
  stamina_sky_falcon_chip: {
    id: "stamina_sky_falcon_chip",
    name: "獵隼晶片",
    englishName: "Falcon Chip",
    special: "falcon_evade",
  },

  // Balance
  balance_core: {
    id: "balance_core",
    name: "翡翠晶片",
    englishName: "Emerald Chip",
    special: "jade_resonance",
  },
  balance_chameleon_chip: {
    id: "balance_chameleon_chip",
    name: "變色龍晶片",
    englishName: "Chameleon Chip",
    special: "chameleon_mimic",
  },
};
