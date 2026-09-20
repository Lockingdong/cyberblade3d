import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { SpecialAura } from "./special-aura";

// Same bowl as the stadium: y = (r/8)^2 * 1.2.
const floor = (x: number, z: number) => (Math.hypot(x, z) / 8) ** 2 * 1.2;

describe("special aura", () => {
  it.each([0, 3, 6, 7.5])(
    "keeps the floor glow above the bowl with the top %s from center",
    (distance) => {
      const aura = new SpecialAura("defense", 1.13, floor);
      const center = { x: distance, y: floor(distance, 0), z: 0 };
      for (let frame = 0; frame < 30; frame += 1)
        aura.update(1 / 60, true, center);
      aura.group.updateMatrixWorld(true);

      const glow = aura.group.getObjectByProperty(
        "renderOrder",
        1,
      ) as THREE.Mesh;
      const position = glow.geometry.getAttribute("position");
      const vertex = new THREE.Vector3();
      for (let index = 0; index < position.count; index += 1) {
        vertex
          .fromBufferAttribute(position, index)
          .applyMatrix4(glow.matrixWorld);
        expect(vertex.y).toBeGreaterThan(floor(vertex.x, vertex.z));
      }
    },
  );

  it("fades out after the special ends", () => {
    const aura = new SpecialAura("attack", 0.96, floor);
    const center = { x: 0, y: 0, z: 0 };
    aura.update(0.5, true, center);
    expect(aura.group.visible).toBe(true);
    aura.update(0.2, false, center);
    expect(aura.group.visible).toBe(true);
    aura.update(0.2, false, center);
    expect(aura.group.visible).toBe(false);
  });
});
