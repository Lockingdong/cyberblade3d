import { describe, expect, it } from "vitest";
import {
  BEYBLADES,
  buildShareCardData,
  SHARE_CARD,
  type BattleSnapshot,
} from "./index";

const baseTop: BattleSnapshot["p1"] = {
  id: "p1",
  type: "attack",
  position: { x: 0, y: 0.7, z: 0 },
  quaternion: { x: 0, y: 0, z: 0, w: 1 },
  rpm: 3000,
  stability: 50,
  isBurst: false,
  isStopped: false,
  isOut: false,
};

const battle: BattleSnapshot = {
  elapsed: 12,
  p1: baseTop,
  p2: { ...baseTop, id: "p2", type: "defense" },
};

describe("buildShareCardData", () => {
  it("resolves the winning blade from the local top", () => {
    const data = buildShareCardData({
      battle,
      localTopId: "p2",
      finishType: "BURST FINISH",
    });
    expect(data.bladeType).toBe("defense");
    expect(data.bladeName).toBe(BEYBLADES.defense.name);
    expect(data.bladeEnglishName).toBe(BEYBLADES.defense.englishName);
    expect(data.bladeColor).toBe(BEYBLADES.defense.color);
    expect(data.finishType).toBe("BURST FINISH");
    expect(data.headline).toBe("VICTORY");
  });

  it("uses custom player names and falls back to blade names", () => {
    const named = buildShareCardData({
      battle,
      localTopId: "p1",
      playerNames: { p1: "小明", p2: "小華" },
      finishType: "SPIN FINISH",
    });
    expect(named.playerName).toBe("小明");
    expect(named.opponentName).toBe("小華");

    const fallback = buildShareCardData({
      battle,
      localTopId: "p1",
      playerNames: { p1: "   " },
      finishType: "SPIN FINISH",
    });
    expect(fallback.playerName).toBe(BEYBLADES.attack.name);
    expect(fallback.opponentName).toBe(BEYBLADES.defense.name);
  });

  it("formats the record and leaves it empty when absent", () => {
    const withRecord = buildShareCardData({
      battle,
      localTopId: "p1",
      record: { wins: 12, losses: 3 },
      finishType: "OVER FINISH",
    });
    expect(withRecord.recordText).toBe("15場 (勝率 80.0%)");

    const withoutRecord = buildShareCardData({
      battle,
      localTopId: "p1",
      finishType: "OVER FINISH",
    });
    expect(withoutRecord.recordText).toBe("");
  });

  it("applies the custom playerColor override when provided", () => {
    const customColor = 0xff00ff;
    const data = buildShareCardData({
      battle,
      localTopId: "p1",
      finishType: "OVER FINISH",
      playerColor: customColor,
    });
    expect(data.bladeColor).toBe(customColor);

    const defaultData = buildShareCardData({
      battle,
      localTopId: "p1",
      finishType: "OVER FINISH",
      playerColor: null,
    });
    expect(defaultData.bladeColor).toBe(BEYBLADES.attack.color);
  });
});

describe("SHARE_CARD", () => {
  it("keeps a 4:5 canvas with a finish color for every finish type", () => {
    expect(SHARE_CARD.width / SHARE_CARD.height).toBeCloseTo(4 / 5);
    expect(Object.keys(SHARE_CARD.finishColors)).toEqual([
      "BURST FINISH",
      "OVER FINISH",
      "SPIN FINISH",
      "TIME FINISH",
    ]);
  });
});
