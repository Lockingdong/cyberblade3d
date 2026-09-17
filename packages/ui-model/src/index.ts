import {
  BEYBLADES,
  BEYBLADE_DESCRIPTIONS,
  beybladeDisplayStats,
  type BeybladeDisplayStat,
  type BeybladeSpec,
  type BeybladeType,
} from "@cyberblade/core";

export type NonBattleActionId =
  | "online"
  | "local"
  | "customize"
  | "camera"
  | "explode"
  | "confirm"
  | "back"
  | "leave"
  | "ready";

export interface BladeCarouselItem {
  readonly id: BeybladeType | "upcoming";
  readonly kind: "blade" | "upcoming";
  readonly type: BeybladeType | null;
  readonly typeLabel: string;
  readonly name: string;
  readonly englishName: string;
  readonly color: number | null;
  readonly selected: boolean;
  readonly selectable: boolean;
}

export interface BladeSelectionViewModel {
  readonly eyebrow: string;
  readonly title: string;
  readonly counter: string;
  readonly selectedType: BeybladeType;
  readonly items: readonly BladeCarouselItem[];
  readonly details: {
    readonly name: string;
    readonly englishName: string;
    readonly description: string;
    readonly color: number;
    readonly stats: readonly BeybladeDisplayStat[];
  };
}

export interface NonBattleScreenCopy {
  readonly brandEyebrow: string;
  readonly brandTitle: string;
  readonly brandSubtitle: string;
  readonly onlineAction: string;
  readonly localAction: string;
  readonly customizerAction: string;
  readonly footer: string;
  readonly upcomingEyebrow: string;
  readonly upcomingTitle: string;
  readonly upcomingDetail: string;
}

export const NON_BATTLE_COPY: NonBattleScreenCopy = {
  brandEyebrow: "DONGSTUDIO PRESENTS",
  brandTitle: "CYBERBLADE 3D",
  brandSubtitle: "極限爆裂對決",
  onlineAction: "線上對戰",
  localAction: "單機 VS AI",
  customizerAction: "陀螺改裝工坊",
  footer: "抓準時機發射，20 秒定勝負",
  upcomingEyebrow: "COMING SOON",
  upcomingTitle: "敬請期待",
  upcomingDetail:
    "全新世代的神祕陀螺正在開發中！敬請關注後續更新，解鎖更多爆裂對決與專屬技能。",
};

const BLADE_ORDER = Object.keys(BEYBLADES) as BeybladeType[];

export function buildBladeSelectionViewModel(
  selectedType: BeybladeType,
  customSpec?: BeybladeSpec,
): BladeSelectionViewModel {
  const selected = customSpec ?? BEYBLADES[selectedType];
  const selectedIndex = BLADE_ORDER.indexOf(selectedType);
  const items: BladeCarouselItem[] = BLADE_ORDER.map((type) => {
    const blade = BEYBLADES[type];
    return {
      id: type,
      kind: "blade",
      type,
      typeLabel: type.toUpperCase(),
      name: blade.name,
      englishName: blade.englishName,
      color: blade.color,
      selected: type === selectedType,
      selectable: true,
    };
  });

  return {
    eyebrow: "SELECT YOUR BLADE",
    title: "選擇戰鬥陀螺",
    counter: `${selectedIndex + 1} / ${String(items.length).padStart(2, "0")}`,
    selectedType,
    items,
    details: {
      name: selected.name,
      englishName: selected.englishName,
      description: selected.description ?? BEYBLADE_DESCRIPTIONS[selectedType],
      color: selected.color,
      stats: beybladeDisplayStats(selectedType, customSpec),
    },
  };
}

export interface OnlinePreparationCopy {
  readonly eyebrow: string;
  readonly title: string;
  readonly detail: string;
  readonly opponentLabel: string;
  readonly primaryAction: string;
  readonly secondaryAction: string | null;
  readonly leaveAction: string;
}

export function buildOnlinePreparationCopy(input: {
  readonly step: "select" | "power";
  readonly canSelectBlade: boolean;
  readonly locked: boolean;
  readonly opponentReady: boolean;
}): OnlinePreparationCopy {
  const opponentLabel = input.opponentReady ? "對手 READY" : "等待對手 READY";
  if (input.step === "select") {
    return {
      eyebrow: "OPPONENT FOUND",
      title: "選擇出戰陀螺",
      detail: input.opponentReady
        ? "對手已準備，挑好你的陀螺"
        : "挑選陀螺與零件，確定後再鎖定發射",
      opponentLabel,
      primaryAction: "確定出戰",
      secondaryAction: null,
      leaveAction: "離開房間",
    };
  }
  return {
    eyebrow: "OPPONENT FOUND",
    title: "準備戰鬥",
    detail: input.locked
      ? input.opponentReady
        ? "雙方已準備，等待伺服器開始"
        : input.canSelectBlade
          ? "已鎖定發射，等待對手選角"
          : "已鎖定發射，等待對手"
      : input.opponentReady
        ? "對手已準備，輪到你了"
        : "鎖定發射力道",
    opponentLabel,
    primaryAction: input.locked ? "已鎖定發射" : "鎖定發射並準備",
    secondaryAction: input.canSelectBlade ? "返回重選陀螺" : null,
    leaveAction: "離開房間",
  };
}

export function resultOutcomeCopy(outcome: "victory" | "defeat" | "draw") {
  if (outcome === "victory") return "VICTORY" as const;
  if (outcome === "defeat") return "DEFEAT" as const;
  return "DRAW" as const;
}
