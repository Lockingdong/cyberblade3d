import { describe, expect, it } from "vitest";
import type { BattleSnapshot } from "@game-pool/beyblade-core";
import { formatWinnerName, terminationCopy } from "./App";

const battle: BattleSnapshot = {
  elapsed: 1,
  p1: {
    id: "p1",
    type: "attack",
    position: { x: -1, y: 0.8, z: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    rpm: 4000,
    stability: 80,
    isBurst: false,
    isStopped: false,
    isOut: false,
  },
  p2: {
    id: "p2",
    type: "defense",
    position: { x: 1, y: 0.8, z: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    rpm: 3800,
    stability: 70,
    isBurst: false,
    isStopped: false,
    isOut: false,
  },
};

describe("formatWinnerName", () => {
  it("maps online p2 winner labels from the guest perspective", () => {
    expect(formatWinnerName("p2", battle, "p2", true)).toBe("玄武重甲 (你)");
    expect(formatWinnerName("p1", battle, "p2", true)).toBe("赤紅狂嵐 (對手)");
  });

  it("keeps the local player and AI labels", () => {
    expect(formatWinnerName("p1", battle, "p1")).toBe("赤紅狂嵐 (玩家)");
    expect(formatWinnerName("p2", battle, "p1")).toBe("玄武重甲 (AI)");
  });

  it("handles null battle snapshot by falling back gracefully", () => {
    expect(formatWinnerName("p1", null, "p1")).toBe("P1 (玩家)");
    expect(formatWinnerName("p2", null, "p1")).toBe("P2 (AI)");
    expect(formatWinnerName("draw", null, "p1")).toBe("平手 (DRAW)");
    expect(formatWinnerName("p1", null, "p1", false, { p1: "自訂姓名" })).toBe(
      "自訂姓名 (玩家)",
    );
  });
});

describe("terminationCopy", () => {
  it("does not claim a winner after departure or connection loss", () => {
    expect(terminationCopy("opponent_left", null)).toEqual({
      title: "對手已離開",
      detail: "對戰已中止，本場不產生物理勝負結果。",
    });
    expect(terminationCopy("connection_lost", null).title).toBe("連線已中斷");
  });
});
