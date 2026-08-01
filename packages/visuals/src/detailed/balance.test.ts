import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { BEYBLADES } from "@cyberblade/core";
import { getChipEmblemTexture } from "./chip-art";
import {
  buildBalanceDetailed,
  buildChameleonBlade,
  buildChameleonChip,
  buildMirageRatchet,
  buildPhantomTaperBit,
} from "./balance";

function meshes(object: THREE.Object3D): THREE.Mesh[] {
  const found: THREE.Mesh[] = [];
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) found.push(child);
  });
  return found;
}

describe("buildBalanceDetailed", () => {
  const spec = BEYBLADES.balance;

  it("returns the four burst-separable composites for balance top", () => {
    const parts = buildBalanceDetailed(spec.color, spec);
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
    const parts = buildBalanceDetailed(spec.color, spec);
    const count =
      meshes(parts.blade).length +
      meshes(parts.ratchet).length +
      meshes(parts.bit).length +
      meshes(parts.chip).length;
    expect(count).toBeLessThanOrEqual(14);
  });

  it("keeps the blade silhouette centered and four-fold symmetric", () => {
    const { blade } = buildBalanceDetailed(spec.color, spec);
    const bounds = new THREE.Box3().setFromObject(blade);

    expect(bounds.min.x).toBeCloseTo(-bounds.max.x, 5);
    expect(bounds.min.z).toBeCloseTo(-bounds.max.z, 5);
    expect(bounds.max.x - bounds.min.x).toBeCloseTo(
      bounds.max.z - bounds.min.z,
      5,
    );
  });

  it("builds all four distinct Chameleon components within budget", () => {
    const parts = [
      buildChameleonBlade(0x7c3aed),
      buildMirageRatchet(0x7c3aed),
      buildPhantomTaperBit(0x7c3aed),
      buildChameleonChip(0x7c3aed),
    ];
    for (const part of parts) {
      expect(part).toBeInstanceOf(THREE.Group);
      expect(meshes(part).length).toBeGreaterThan(0);
    }
    expect(
      parts.reduce((count, part) => count + meshes(part).length, 0),
    ).toBeLessThanOrEqual(14);
  });

  it("uses dedicated Chameleon chip art", () => {
    const base = getChipEmblemTexture("balance", 0x7c3aed);
    const chameleon = getChipEmblemTexture(
      "balance_chameleon_chip",
      0x7c3aed,
    );
    expect(chameleon).not.toBe(base);
    expect(
      chameleon.image.data.some(
        (value: number, index: number) => value !== base.image.data[index],
      ),
    ).toBe(true);
  });
});
