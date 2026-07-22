import {
  BEYBLADES,
  formatBattleRecord,
  opponentTopId,
  type BattleRecord,
  type BattleSnapshot,
  type BeybladeType,
  type FinishType,
  type TopId,
} from "./index";

export interface ShareCardData {
  readonly title: string;
  readonly headline: string;
  readonly bladeType: BeybladeType;
  readonly bladeName: string;
  readonly bladeEnglishName: string;
  readonly bladeColor: number;
  readonly finishType: FinishType;
  readonly playerName: string;
  readonly recordText: string;
  readonly opponentName: string;
}

export interface ShareCardInput {
  readonly battle: BattleSnapshot;
  readonly localTopId: TopId;
  readonly playerNames?: Partial<Record<TopId, string>> | undefined;
  readonly record?: BattleRecord | undefined;
  readonly finishType: FinishType;
  readonly playerColor?: number | null | undefined;
}

export function buildShareCardData(input: ShareCardInput): ShareCardData {
  const { battle, localTopId, playerNames, record, finishType, playerColor } =
    input;
  const opponentId = opponentTopId(localTopId);
  const blade = BEYBLADES[battle[localTopId].type];
  return {
    title: "CYBERBLADE 3D",
    headline: "VICTORY",
    bladeType: blade.type,
    bladeName: blade.name,
    bladeEnglishName: blade.englishName,
    bladeColor:
      playerColor !== null && playerColor !== undefined
        ? playerColor
        : blade.color,
    finishType,
    playerName: resolveShareName(battle, localTopId, playerNames),
    recordText: record ? formatBattleRecord(record) : "",
    opponentName: resolveShareName(battle, opponentId, playerNames),
  };
}

function resolveShareName(
  battle: BattleSnapshot,
  id: TopId,
  playerNames?: Partial<Record<TopId, string>>,
): string {
  const custom = playerNames?.[id]?.trim();
  return custom || BEYBLADES[battle[id].type].name;
}

/** Layout constants shared by the web canvas renderer and the mobile view
 *  renderer (mobile lays out at width/height ÷ SHARE_CARD.mobileScale). */
export const SHARE_CARD = {
  width: 1080,
  height: 1350,
  mobileScale: 3,
  colors: {
    bg: "#080b14",
    bgGradientStart: "#0a0e1a",
    bgGradientEnd: "#141b2d",
    card: "#111625",
    cardBorder: "#1e2942",
    ink: "#05070d",
    accent: "#00f0ff",
    win: "#ffe600",
    winGlow: "#ffb800",
    muted: "#7e8c9f",
    panelBg: "#171e33",
    panelBorder: "#2a3756",
    textLight: "#ffffff",
  },
  finishColors: {
    "BURST FINISH": "#ff2a5f",
    "OVER FINISH": "#00c8ff",
    "SPIN FINISH": "#ffb800",
    "TIME FINISH": "#8a9bb0",
  } satisfies Record<FinishType, string>,
} as const;
