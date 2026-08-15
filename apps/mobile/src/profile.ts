import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  EMPTY_BATTLE_RECORD,
  isPlayerColor,
  sanitizeBattleRecord,
  type BattleRecord,
  type BeybladeType,
  type CustomBeybladeConfig,
} from "@cyberblade/core";

const NAME_KEY = "cyberblade.playerName";
const RECORD_KEY = "cyberblade.battleRecord";
const COLOR_KEY = "cyberblade.playerColor";
const PARTS_KEY = "cyberblade.customPartsMap";

export const MOBILE_PROFILE_KEYS = [
  NAME_KEY,
  RECORD_KEY,
  COLOR_KEY,
  PARTS_KEY,
] as const;

export type CustomPartsMap = Partial<
  Record<BeybladeType, Partial<CustomBeybladeConfig>>
>;

async function read(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function write(key: string, value: string | null): Promise<void> {
  try {
    if (value === null) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, value);
  } catch {
    // A full or unavailable store must not prevent the game from running.
  }
}

export async function loadPlayerName(): Promise<string> {
  return (await read(NAME_KEY)) ?? "";
}

export async function savePlayerName(name: string): Promise<void> {
  const normalized = name.trim().slice(0, 24);
  await write(NAME_KEY, normalized || null);
}

export async function loadPlayerColor(): Promise<number | null> {
  const raw = await read(COLOR_KEY);
  if (!raw) return null;
  const value = Number(raw);
  return isPlayerColor(value) ? value : null;
}

export async function savePlayerColor(color: number | null): Promise<void> {
  await write(COLOR_KEY, color === null ? null : String(color));
}

export async function loadBattleRecord(): Promise<BattleRecord> {
  const raw = await read(RECORD_KEY);
  if (!raw) return EMPTY_BATTLE_RECORD;
  try {
    return sanitizeBattleRecord(JSON.parse(raw));
  } catch {
    return EMPTY_BATTLE_RECORD;
  }
}

export async function saveBattleRecord(record: BattleRecord): Promise<void> {
  await write(RECORD_KEY, JSON.stringify(sanitizeBattleRecord(record)));
}

export async function loadCustomParts(): Promise<CustomPartsMap> {
  const raw = await read(PARTS_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    return parsed as CustomPartsMap;
  } catch {
    return {};
  }
}

export async function saveCustomParts(map: CustomPartsMap): Promise<void> {
  await write(PARTS_KEY, JSON.stringify(map));
}

export async function resetMobileProfile(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([...MOBILE_PROFILE_KEYS]);
  } catch {
    await Promise.all(MOBILE_PROFILE_KEYS.map((key) => write(key, null)));
  }
}
