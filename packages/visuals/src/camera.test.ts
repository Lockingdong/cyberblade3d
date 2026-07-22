import { describe, expect, it } from "vitest";
import type { BattleSnapshot } from "@game-pool/beyblade-core";
import {
  getBattleCameraView,
  getLaunchCameraView,
  localPlayerSide,
} from "./camera";

const battle: BattleSnapshot = {
  elapsed: 1,
  p1: {
    id: "p1",
    type: "attack",
    position: { x: -2, y: 0.8, z: 1 },
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
    position: { x: 3, y: 0.8, z: -1 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    rpm: 4000,
    stability: 80,
    isBurst: false,
    isStopped: false,
    isOut: false,
  },
};

describe("local battle camera", () => {
  it("assigns opposite fixed sides to p1 and p2", () => {
    expect(localPlayerSide("p1")).toBe(-1);
    expect(localPlayerSide("p2")).toBe(1);
  });

  it("puts each local player on the camera-facing side", () => {
    const p1 = getBattleCameraView("p1", battle);
    const p2 = getBattleCameraView("p2", battle);
    const midpointX = (battle.p1.position.x + battle.p2.position.x) / 2;

    expect(p1.position[0]).toBeLessThan(midpointX);
    expect(p2.position[0]).toBeGreaterThan(midpointX);
    expect(p1.target).toEqual(p2.target);
  });

  it("keeps launch views centered on the local top", () => {
    expect(getLaunchCameraView("p1", 0).target).toEqual([-4, 0.5, 0]);
    expect(getLaunchCameraView("p2", 0).target).toEqual([4, 0.5, 0]);
  });
});
