import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { BEYBLADES } from "@game-pool/beyblade-core";
import { getChipEmblemTexture } from "./chip-art";
import {
  buildEternalNeedleBit,
  buildGoldenFalconBlade,
  buildGoldenFalconChip,
  buildSolarRingRatchet,
  buildStaminaDetailed,
} from "./stamina";

function meshes(object: THREE.Object3D): THREE.Mesh[] {
  const found: THREE.Mesh[] = [];
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) found.push(child);
  });
  return found;
}

describe("buildStaminaDetailed", () => {
  const spec = BEYBLADES.stamina;

  it("returns the four burst-separable composites for stamina top", () => {
    const parts = buildStaminaDetailed(spec.color, spec);
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
    const parts = buildStaminaDetailed(spec.color, spec);
    const count =
      meshes(parts.blade).length +
      meshes(parts.ratchet).length +
      meshes(parts.bit).length +
      meshes(parts.chip).length;
    expect(count).toBeLessThanOrEqual(14);
  });

  it("builds all four distinct Golden Falcon components within budget", () => {
    const parts = [
      buildGoldenFalconBlade(0xffc800),
      buildSolarRingRatchet(0xffc800),
      buildEternalNeedleBit(0xffc800),
      buildGoldenFalconChip(0xffc800),
    ];
    for (const part of parts) {
      expect(part).toBeInstanceOf(THREE.Group);
      expect(meshes(part).length).toBeGreaterThan(0);
    }
    expect(parts.reduce((count, part) => count + meshes(part).length, 0)).toBeLessThanOrEqual(14);
  });

  it("uses dedicated Golden Falcon chip art", () => {
    const base = getChipEmblemTexture("stamina", 0xffc800);
    const falcon = getChipEmblemTexture("stamina_sky_falcon_chip", 0xffc800);
    expect(falcon).not.toBe(base);
    expect(
      falcon.image.data.some(
        (value: number, index: number) => value !== base.image.data[index],
      ),
    ).toBe(true);
  });

  it("matches the default stamina chrome, yellow, black, and green palette", () => {
    const customAccent = 0xb026ff;
    const bladeMeshes = meshes(buildGoldenFalconBlade(customAccent));
    const ratchetMeshes = meshes(buildSolarRingRatchet(customAccent));
    const bitMeshes = meshes(buildEternalNeedleBit(customAccent));
    const chipMeshes = meshes(buildGoldenFalconChip(customAccent));

    expect(
      (bladeMeshes[0]!.material as THREE.MeshStandardMaterial).color.getHex(),
    ).toBe(0xd8dde5);
    expect(
      (bladeMeshes[1]!.material as THREE.MeshStandardMaterial).color.getHex(),
    ).toBe(customAccent);
    expect(
      (ratchetMeshes[0]!.material as THREE.MeshStandardMaterial).color.getHex(),
    ).toBe(0x064e3b);
    expect(
      (ratchetMeshes[1]!.material as THREE.MeshStandardMaterial).color.getHex(),
    ).toBe(customAccent);
    expect(
      (bitMeshes[1]!.material as THREE.MeshStandardMaterial).color.getHex(),
    ).toBe(0x059669);
    expect(
      (chipMeshes[0]!.material as THREE.MeshStandardMaterial).color.getHex(),
    ).toBe(0x122019);
    expect(
      (chipMeshes[1]!.material as THREE.MeshStandardMaterial).color.getHex(),
    ).toBe(customAccent);
  });
});
