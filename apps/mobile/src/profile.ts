import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BeybladeType, CustomBeybladeConfig } from "@cyberblade/core";

/**
 * Mirrors the web profile store (apps/web/src/profile.ts) for the one thing
 * mobile persists today: the garage loadout. The key is shared so the shape on
 * disk stays identical across platforms.
 *
 * AsyncStorage is asynchronous, so callers start from `{}` and fill it in once
 * `loadCustomParts` resolves. Player name and battle record stay session-only
 * on mobile.
 */
const PARTS_KEY = "cyberblade.customPartsMap";

export type CustomPartsMap = Partial<
  Record<BeybladeType, Partial<CustomBeybladeConfig>>
>;

export async function loadCustomParts(): Promise<CustomPartsMap> {
  try {
    const raw = await AsyncStorage.getItem(PARTS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    // Anything that is not an object would break the per-type lookups below;
    // resolveCustomConfig repairs bad part ids, but not a bad container.
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    return parsed as CustomPartsMap;
  } catch {
    // Unreadable or corrupt storage just means the stock loadout.
    return {};
  }
}

export async function saveCustomParts(map: CustomPartsMap): Promise<void> {
  try {
    await AsyncStorage.setItem(PARTS_KEY, JSON.stringify(map));
  } catch {
    // Storage can fail on a full device; the config just won't persist.
  }
}
