import type { RatchetPart } from "./types";

export const RATCHET_PARTS: Record<string, RatchetPart> = {
  attack: {
    id: "attack",
    name: "赤紅棘輪",
    englishName: "Red Ratchet",
    maxStability: 90,
    massContribution: 0.33,
  },
  defense: {
    id: "defense",
    name: "玄武棘輪",
    englishName: "Iron Ratchet",
    maxStability: 140,
    massContribution: 0.54,
  },
  stamina: {
    id: "stamina",
    name: "黃金棘輪",
    englishName: "Sol Ratchet",
    maxStability: 80,
    massContribution: 0.24,
  },
  balance: {
    id: "balance",
    name: "翡翠棘輪",
    englishName: "Emerald Ratchet",
    maxStability: 110,
    massContribution: 0.39,
  },
  crusher: {
    id: "crusher",
    name: "黑曜棘輪",
    englishName: "Obsidian Ratchet",
    maxStability: 105,
    massContribution: 0.51,
  },
  phantom: {
    id: "phantom",
    name: "幻影棘輪",
    englishName: "Phantom Ratchet",
    maxStability: 70,
    massContribution: 0.27,
  },
  aegis: {
    id: "aegis",
    name: "白銀棘輪",
    englishName: "Silver Ratchet",
    maxStability: 130,
    massContribution: 0.48,
  },
  vampire: {
    id: "vampire",
    name: "暗夜棘輪",
    englishName: "Blood Ratchet",
    maxStability: 85,
    massContribution: 0.3,
  },
  zephyr: {
    id: "zephyr",
    name: "蒼穹棘輪",
    englishName: "Azure Ratchet",
    maxStability: 75,
    massContribution: 0.21,
  },
  berserk: {
    id: "berserk",
    name: "狂焰棘輪",
    englishName: "Blaze Ratchet",
    maxStability: 70,
    massContribution: 0.51,
  },
};
