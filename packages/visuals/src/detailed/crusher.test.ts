import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { BEYBLADES } from "@game-pool/beyblade-core";
import { buildCrusherDetailed } from "./crusher";

function meshes(object: THREE.Object3D): THREE.Mesh[] {
  const found: THREE.Mesh[] = [];
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) found.push(child);
  });
  return found;
}

describe("buildCrusherDetailed", () => {
  const spec = BEYBLADES.crusher;

  it("returns the four burst-separable composites for crusher top", () => {
    const parts = buildCrusherDetailed(spec.color, spec);
    expect(Object.keys(parts).sort()).toEqual([
      "bit",
      "blade",
      "chip",
      "ratchet",
    ]);
    for (const part of [parts.blade, parts.ratchet, parts.bit, parts.chip]) {
      expect(part).toBeInstanceOf(THREE.Object3D);
      expect(meshes(part).length).toBeGreaterThan(0);
    }
  });

  it("stays within the draw-call budget", () => {
    const parts = buildCrusherDetailed(spec.color, spec);
    const count =
      meshes(parts.blade).length +
      meshes(parts.ratchet).length +
      meshes(parts.bit).length +
      meshes(parts.chip).length;
    expect(count).toBeLessThanOrEqual(14);
  });
});
