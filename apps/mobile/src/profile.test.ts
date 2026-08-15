import { beforeEach, describe, expect, it, vi } from "vitest";

const values = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => values.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) =>
      values.set(key, value),
    ),
    removeItem: vi.fn(async (key: string) => values.delete(key)),
    multiRemove: vi.fn(async (keys: string[]) =>
      keys.forEach((key) => values.delete(key)),
    ),
  },
}));

import {
  MOBILE_PROFILE_KEYS,
  loadBattleRecord,
  loadCustomParts,
  loadPlayerColor,
  loadPlayerName,
  resetMobileProfile,
  saveBattleRecord,
  saveCustomParts,
  savePlayerColor,
  savePlayerName,
} from "./profile";

describe("mobile profile", () => {
  beforeEach(() => values.clear());

  it("persists the canonical profile fields", async () => {
    await savePlayerName("  Blade User  ");
    await savePlayerColor(0xff1744);
    await saveBattleRecord({ wins: 3, losses: 2 });
    await saveCustomParts({ attack: { bladeId: "attack_slash" } });
    expect(await loadPlayerName()).toBe("Blade User");
    expect(await loadPlayerColor()).toBe(0xff1744);
    expect(await loadBattleRecord()).toEqual({ wins: 3, losses: 2 });
    expect(await loadCustomParts()).toEqual({
      attack: { bladeId: "attack_slash" },
    });
  });

  it("falls back safely for corrupt data", async () => {
    values.set("cyberblade.battleRecord", "{");
    values.set("cyberblade.playerColor", "not-a-color");
    values.set("cyberblade.customPartsMap", "[]");
    expect(await loadBattleRecord()).toEqual({ wins: 0, losses: 0 });
    expect(await loadPlayerColor()).toBeNull();
    expect(await loadCustomParts()).toEqual({});
  });

  it("removes only CyberBlade profile keys", async () => {
    values.set("unrelated", "keep");
    MOBILE_PROFILE_KEYS.forEach((key) => values.set(key, "value"));
    await resetMobileProfile();
    expect(values.get("unrelated")).toBe("keep");
    expect(MOBILE_PROFILE_KEYS.every((key) => !values.has(key))).toBe(true);
  });
});
