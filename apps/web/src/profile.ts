import {
  EMPTY_BATTLE_RECORD,
  isPlayerColor,
  sanitizeBattleRecord,
  type BattleRecord,
  type CustomBeybladeConfig,
  type BeybladeType,
} from "@game-pool/beyblade-core";

const NAME_KEY = "cyberblade.playerName";
const RECORD_KEY = "cyberblade.battleRecord";
const COLOR_KEY = "cyberblade.playerColor";
const PARTS_KEY = "cyberblade.customPartsMap";

export function loadPlayerName(): string {
  try {
    return window.localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function savePlayerName(name: string): void {
  try {
    if (name) window.localStorage.setItem(NAME_KEY, name);
    else window.localStorage.removeItem(NAME_KEY);
  } catch {
    // Storage can be unavailable (private mode); the name just won't persist.
  }
}

export function loadPlayerColor(): number | null {
  try {
    const raw = window.localStorage.getItem(COLOR_KEY);
    if (!raw) return null;
    const value = Number(raw);
    return isPlayerColor(value) ? value : null;
  } catch {
    return null;
  }
}

export function savePlayerColor(color: number | null): void {
  try {
    if (color !== null) window.localStorage.setItem(COLOR_KEY, String(color));
    else window.localStorage.removeItem(COLOR_KEY);
  } catch {
    // Storage can be unavailable (private mode); the color just won't persist.
  }
}

export function loadBattleRecord(): BattleRecord {
  try {
    const raw = window.localStorage.getItem(RECORD_KEY);
    return raw ? sanitizeBattleRecord(JSON.parse(raw)) : EMPTY_BATTLE_RECORD;
  } catch {
    return EMPTY_BATTLE_RECORD;
  }
}

export function saveBattleRecord(record: BattleRecord): void {
  try {
    window.localStorage.setItem(RECORD_KEY, JSON.stringify(record));
  } catch {
    // Storage can be unavailable (private mode); the record just won't persist.
  }
}

export function loadCustomParts(): Partial<Record<BeybladeType, Partial<CustomBeybladeConfig>>> {
  try {
    const raw = window.localStorage.getItem(PARTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveCustomParts(map: Partial<Record<BeybladeType, Partial<CustomBeybladeConfig>>>): void {
  try {
    window.localStorage.setItem(PARTS_KEY, JSON.stringify(map));
  } catch {
    // Storage can be unavailable (private mode); the config just won't persist.
  }
}

