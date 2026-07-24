import type { ChipPart } from "./types";

export const CHIP_PARTS: Record<string, ChipPart> = {
  // Attack
  attack_core: { id: "attack_core", name: "赤紅核心", englishName: "Crimson Core" },
  attack_drake_chip: { id: "attack_drake_chip", name: "龍焰核心", englishName: "Drake Core" },

  // Defense
  defense_core: { id: "defense_core", name: "玄武核心", englishName: "Iron Core" },

  // Stamina
  stamina_core: { id: "stamina_core", name: "黃金核心", englishName: "Sol Core" },

  // Balance
  balance_core: { id: "balance_core", name: "翡翠核心", englishName: "Emerald Core" },
};
