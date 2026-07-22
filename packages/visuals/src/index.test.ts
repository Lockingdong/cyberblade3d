import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { BEYBLADES, type BattleSnapshot, type TopId } from "@game-pool/beyblade-core";
import { BeybladePreviewWorld, BeybladeVisualWorld, BLADE_BUILDERS, disposeObject } from "./index";

function snapshot(): BattleSnapshot {
  const top = (id: TopId, x: number): BattleSnapshot[TopId] => ({
    id,
    type: id === "p1" ? "attack" : "defense",
    position: { x, y: 0.8, z: id === "p1" ? 1 : -1 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    rpm: 4000,
    stability: 80,
    isBurst: false,
    isStopped: false,
    isOut: false,
  });
  return { elapsed: 1, p1: top("p1", -2), p2: top("p2", 3) };
}

describe("BeybladeVisualWorld", () => {
  it.each(["p1", "p2"] as const)(
    "places the player marker over local top %s",
    (localTopId) => {
      const world = new BeybladeVisualWorld(
        "attack",
        "defense",
        "neon",
        localTopId,
      );
      const battle = snapshot();
      world.apply(battle, []);
      world.update(0);

      // The marker is the only Group whose child is a green cone. Walk the
      // tree to find it instead of relying on the add order of root.
      let marker: THREE.Group | undefined;
      world.root.traverse((node) => {
        if (marker) return;
        if (node instanceof THREE.Group && node.name === "player-marker") {
          marker = node;
        }
      });
      expect(marker).toBeDefined();
      expect(marker!.position.x).toBe(battle[localTopId].position.x);
      expect(marker!.position.z).toBe(battle[localTopId].position.z);
      world.dispose();
    },
  );
});

describe("BeybladePreviewWorld", () => {
  it.each(["attack", "defense", "stamina", "balance"] as const)(
    "creates and switches the %s preview",
    (type) => {
      const world = new BeybladePreviewWorld(type);
      expect(world.root.children).toHaveLength(1);
      world.update(1 / 60);
      world.setType("balance");
      expect(world.root.children).toHaveLength(1);
      world.dispose();
      expect(world.root.children).toHaveLength(0);
    },
  );

  it("renders a custom mix-and-match top correctly based on part IDs", () => {
    const originalSpec = { ...BEYBLADES.attack };
    try {
      (BEYBLADES.attack as any).bladeId = "defense";
      const color = 0x123456;
      const world = new BeybladePreviewWorld("attack", color);

      const topGroup = world.root.children[0];
      expect(topGroup).toBeDefined();
      const bladeGroup = topGroup!.children[0];
      expect(bladeGroup).toBeDefined();

      const defenseBuilder = BLADE_BUILDERS.defense;
      expect(defenseBuilder).toBeDefined();
      const referenceBlade = defenseBuilder!(color);

      const assembledMesh = bladeGroup!.children[0] as THREE.Mesh;
      const referenceMesh = referenceBlade.children[0] as THREE.Mesh;

      expect(assembledMesh.geometry.attributes.position!.count)
        .toBe(referenceMesh.geometry.attributes.position!.count);

      disposeObject(referenceBlade);
      world.dispose();
    } finally {
      (BEYBLADES.attack as any).bladeId = originalSpec.bladeId;
    }
  });
});
