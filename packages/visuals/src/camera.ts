import type { BattleSnapshot, TopId } from "@game-pool/beyblade-core";

export interface CameraView {
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
}

/** The fixed side of the arena from which each player views the battle. */
export function localPlayerSide(localTopId: TopId): -1 | 1 {
  return localTopId === "p1" ? -1 : 1;
}

export function getLaunchCameraView(
  localTopId: TopId,
  time: number,
): CameraView {
  const side = localPlayerSide(localTopId);
  const launchX = side * 4;
  const orbit = time * 0.5;

  return {
    position: [launchX + Math.cos(orbit) * 5, 4, Math.sin(orbit) * 5],
    target: [launchX, 0.5, 0],
  };
}

export function getBattleCameraView(
  localTopId: TopId,
  snapshot: BattleSnapshot,
): CameraView {
  const midpointX = (snapshot.p1.position.x + snapshot.p2.position.x) / 2;
  const midpointZ = (snapshot.p1.position.z + snapshot.p2.position.z) / 2;
  const distance = Math.hypot(
    snapshot.p1.position.x - snapshot.p2.position.x,
    snapshot.p1.position.z - snapshot.p2.position.z,
  );
  const side = localPlayerSide(localTopId);

  const zoomFactor = 1.2;
  const offsetX = side * Math.max(7, 5 + distance) * zoomFactor;
  const offsetY = Math.max(5, 3.5 + distance * 0.8) * zoomFactor;

  return {
    position: [midpointX + offsetX, 0.5 + offsetY, midpointZ],
    target: [midpointX, 0.5, midpointZ],
  };
}
