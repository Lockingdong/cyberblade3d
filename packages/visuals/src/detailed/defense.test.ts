import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { BEYBLADES } from "@cyberblade/core";
import {
  buildAegisChip,
  buildAnchorBit,
  buildCrusaderRatchet,
  buildDefenseDetailed,
  buildSilverAegisBlade,
} from "./defense";

function meshes(object: THREE.Object3D): THREE.Mesh[] {
  const found: THREE.Mesh[] = [];
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) found.push(child);
  });
  return found;
}

describe("buildDefenseDetailed", () => {
  const spec = BEYBLADES.defense;

  it("returns the four burst-separable composites for defense top", () => {
    const parts = buildDefenseDetailed(spec.color, spec);
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
    const parts = buildDefenseDetailed(spec.color, spec);
    const count =
      meshes(parts.blade).length +
      meshes(parts.ratchet).length +
      meshes(parts.bit).length +
      meshes(parts.chip).length;
    expect(count).toBeLessThanOrEqual(14);
  });

  it("builds all four distinct Silver Aegis components", () => {
    const parts = [
      buildSilverAegisBlade(0xc9d2dc),
      buildCrusaderRatchet(0xc9d2dc),
      buildAnchorBit(0xc9d2dc),
      buildAegisChip(0xc9d2dc),
    ];
    for (const part of parts) {
      expect(part).toBeInstanceOf(THREE.Group);
      expect(meshes(part).length).toBeGreaterThan(0);
    }
  });
});
