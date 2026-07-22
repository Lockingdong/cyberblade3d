import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { BEYBLADES } from "@game-pool/beyblade-core";
import { BeybladePreviewWorld } from "../index";
import { buildAttackDetailed } from "./attack";
import { getChipEmblemTexture } from "./chip-art";

function meshes(object: THREE.Object3D): THREE.Mesh[] {
  const found: THREE.Mesh[] = [];
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) found.push(child);
  });
  return found;
}

describe("buildAttackDetailed", () => {
  const spec = BEYBLADES.attack;

  it("returns the four burst-separable composites", () => {
    const parts = buildAttackDetailed(spec.color, spec);
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

  it("stays within the draw-call budget (<= 14 meshes before outlines)", () => {
    const parts = buildAttackDetailed(spec.color, spec);
    const count =
      meshes(parts.blade).length +
      meshes(parts.ratchet).length +
      meshes(parts.bit).length +
      meshes(parts.chip).length;
    expect(count).toBeLessThanOrEqual(14);
  });

  it("keeps glow slivers as untoned MeshBasicMaterial", () => {
    const parts = buildAttackDetailed(spec.color, spec);
    const glow = meshes(parts.blade).filter(
      (mesh) => mesh.material instanceof THREE.MeshBasicMaterial,
    );
    expect(glow.length).toBe(1);
    expect((glow[0]!.material as THREE.MeshBasicMaterial).toneMapped).toBe(
      false,
    );
  });
});

describe("getChipEmblemTexture", () => {
  it("returns the identical cached instance for the same key", () => {
    const first = getChipEmblemTexture("attack", 0xe60012);
    const second = getChipEmblemTexture("attack", 0xe60012);
    expect(second).toBe(first);
    expect(getChipEmblemTexture("attack", 0x123456)).not.toBe(first);
  });

  it("produces opaque non-empty sRGB pixel data flagged as shared", () => {
    const texture = getChipEmblemTexture("attack", 0xe60012);
    expect(texture.userData.shared).toBe(true);
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
    const data = texture.image.data as Uint8Array;
    expect(data.length).toBe(256 * 256 * 4);
    // Every alpha byte opaque, and the RGB channels are not a constant fill.
    let allSame = true;
    for (let i = 0; i < data.length; i += 4) {
      expect(data[i + 3]).toBe(255);
      if (
        data[i] !== data[0] ||
        data[i + 1] !== data[1] ||
        data[i + 2] !== data[2]
      ) {
        allSame = false;
      }
    }
    expect(allSame).toBe(false);

    // Guard against sign mistakes in the SDF painting (a flipped border band
    // once flooded the whole face dark): the glyph hub at the center must be
    // pale, and the field between the strokes must read as bright red.
    const pixel = (u: number, v: number) => {
      const col = Math.round(((u + 1) / 2) * 255);
      const row = Math.round(((v + 1) / 2) * 255);
      const i = (row * 256 + col) * 4;
      return [data[i]!, data[i + 1]!, data[i + 2]!] as const;
    };
    const [hr, hg, hb] = pixel(0, 0);
    expect(hr).toBeGreaterThan(180);
    expect(hg).toBeGreaterThan(180);
    expect(hb).toBeGreaterThan(150);
    const [br, bg] = pixel(0, 0.45);
    expect(br).toBeGreaterThan(100);
    expect(br).toBeGreaterThan(bg * 2);
  });
});

describe("detailed attack top through the toon/outline pass", () => {
  it("respects noOutline flags and keeps the emblem texture across disposal", () => {
    const world = new BeybladePreviewWorld("attack");
    const outlined: THREE.Mesh[] = [];
    let emblemMaterial: THREE.MeshBasicMaterial | undefined;
    world.root.traverse((node) => {
      if (!(node instanceof THREE.Mesh) || node.userData.isOutline) return;
      const hasOutline = node.children.some(
        (child) => child.userData.isOutline === true,
      );
      if (node.userData.noOutline === true) {
        expect(hasOutline).toBe(false);
      }
      if (hasOutline) outlined.push(node);
      for (const material of Array.isArray(node.material)
        ? node.material
        : [node.material]) {
        if (
          material instanceof THREE.MeshBasicMaterial &&
          material.map instanceof THREE.DataTexture
        ) {
          emblemMaterial = material;
        }
      }
    });
    // Chrome ring, claws, chip base, contact cone, collar keep their ink line.
    expect(outlined.length).toBeGreaterThanOrEqual(5);
    // The printed chip survived toon conversion with its map attached.
    expect(emblemMaterial).toBeDefined();

    const texture = getChipEmblemTexture("attack", BEYBLADES.attack.color);
    expect(emblemMaterial!.map).toBe(texture);
    // Disposing the world (garage blade swap path) must not kill the cached
    // texture: the next build returns the same live instance.
    world.dispose();
    expect(getChipEmblemTexture("attack", BEYBLADES.attack.color)).toBe(
      texture,
    );
  });
});
