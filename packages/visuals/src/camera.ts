import type { BattleSnapshot, TopId } from "@cyberblade/core";

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

/** The angles a `BeybladePreviewWorld` can be inspected from in the garage. */
export type PreviewCameraPreset = "default" | "top" | "side" | "bottom";

export const PREVIEW_CAMERA_PRESET_ORDER: readonly PreviewCameraPreset[] = [
  "default",
  "top",
  "side",
  "bottom",
];

/**
 * Shared poses for the garage preview, so the web and mobile customizers frame
 * a blade identically. Each app supplies its own icon for the view switcher —
 * only the geometry and the label live here.
 *
 * The top and bottom poses sit a hundredth off the Z axis because a camera
 * exactly on it is collinear with the default up vector, which makes `lookAt`
 * pick an arbitrary roll.
 */
export const PREVIEW_CAMERA_PRESETS: Record<
  PreviewCameraPreset,
  CameraView & { readonly label: string }
> = {
  default: { label: "斜角視角", position: [0, 2.8, 3.8], target: [0, 0.38, 0] },
  top: { label: "正頂視角", position: [0, 4.8, 0.01], target: [0, 0.38, 0] },
  side: { label: "正側視角", position: [0, 0.4, 4.2], target: [0, 0.38, 0] },
  bottom: {
    label: "正底視角",
    position: [0, -3.8, 0.01],
    target: [0, 0.38, 0],
  },
};
