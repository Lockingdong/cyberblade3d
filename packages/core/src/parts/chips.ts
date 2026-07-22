import type { ChipPart } from "./types";

export const CHIP_PARTS: Record<string, ChipPart> = {
  attack: { id: "attack", name: "赤紅狂嵐", englishName: "Red Storm" },
  defense: { id: "defense", name: "玄武重甲", englishName: "Iron Dome" },
  stamina: { id: "stamina", name: "黃金恆星", englishName: "Sol Corona" },
  balance: { id: "balance", name: "翡翠疾風", englishName: "Emerald Gale" },
  crusher: { id: "crusher", name: "黑曜巨鎚", englishName: "Obsidian Maul" },
  phantom: { id: "phantom", name: "幻影夜刃", englishName: "Phantom Edge" },
  aegis: { id: "aegis", name: "白銀聖盾", englishName: "Silver Aegis" },
  vampire: { id: "vampire", name: "暗夜血蝕", englishName: "Blood Eclipse" },
  zephyr: { id: "zephyr", name: "蒼穹流星", englishName: "Azure Meteor" },
  berserk: { id: "berserk", name: "狂焰修羅", englishName: "Blaze Asura" },
};
