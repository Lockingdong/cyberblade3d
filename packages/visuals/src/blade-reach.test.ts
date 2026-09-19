import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { BLADE_PARTS } from "@cyberblade/core";
import { BLADE_BUILDERS } from "./detailed";

// Must match createBeyblade's group scale in index.ts.
const MODEL_SCALE_XZ = 1.8;
const MODEL_SCALE_Y = 2.07;

function renderedReach(build: (color: number) => THREE.Group): number {
  const group = new THREE.Group();
  group.scale.set(MODEL_SCALE_XZ, MODEL_SCALE_Y, MODEL_SCALE_XZ);
  group.add(build(0xffffff));
  group.updateMatrixWorld(true);
  let reach = 0;
  const vertex = new THREE.Vector3();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const position = object.geometry.attributes.position;
    for (let index = 0; index < position.count; index += 1) {
      vertex.fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld);
      reach = Math.max(reach, Math.hypot(vertex.x, vertex.z));
    }
  });
  return reach;
}

describe("blade collision reach", () => {
  // The simulation collides tops at BLADE_PARTS[].radius; if the art changes
  // without it, tops visibly overlap (or bounce before touching) again.
  it.each(Object.keys(BLADE_PARTS))("%s matches its rendered blade", (id) => {
    const build = BLADE_BUILDERS[id];
    expect(build).toBeDefined();
    expect(renderedReach(build!)).toBeCloseTo(BLADE_PARTS[id]!.radius, 1);
  });
});
