import type * as THREE from "three";
import type { BeybladeSpec } from "@game-pool/beyblade-core";

// The four burst-separable composites every top is assembled from according to Beyblade X system.
export interface DetailedParts {
  blade: THREE.Object3D;
  ratchet: THREE.Object3D;
  bit: THREE.Object3D;
  chip: THREE.Object3D;
}

export type DetailedBladeBuilder = (
  accentColor: number,
  spec: BeybladeSpec,
) => DetailedParts;
