import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  ENVIRONMENT_SCENES,
  type EnvironmentScene,
} from "@game-pool/beyblade-core";
import { BeybladeVisualWorld } from "./index";

function countPoints(group: THREE.Object3D): number {
  let count = 0;
  group.traverse((child) => {
    if (child instanceof THREE.Points) count += 1;
  });
  return count;
}

function findPointsWithName(
  group: THREE.Object3D,
  name: string,
): THREE.Points | undefined {
  let found: THREE.Points | undefined;
  group.traverse((node) => {
    if (found) return;
    if (node instanceof THREE.Points && node.name === name) found = node;
  });
  return found;
}

function findMeshWithName(
  group: THREE.Object3D,
  name: string,
): THREE.Mesh | undefined {
  let found: THREE.Mesh | undefined;
  group.traverse((node) => {
    if (found) return;
    if (node instanceof THREE.Mesh && node.name === name) found = node;
  });
  return found;
}

function findByName(
  group: THREE.Object3D,
  name: string,
): THREE.Object3D | undefined {
  let found: THREE.Object3D | undefined;
  group.traverse((node) => {
    if (found) return;
    if (node.name === name) found = node;
  });
  return found;
}

function countByName(group: THREE.Object3D, name: string): number {
  let count = 0;
  group.traverse((node) => {
    if (node.name === name) count += 1;
  });
  return count;
}

function buildWorld(scene: EnvironmentScene): BeybladeVisualWorld {
  return new BeybladeVisualWorld("attack", "defense", "neon", "p1", scene);
}

describe("BeybladeVisualWorld environment", () => {
  it("builds the space scene with a static dust field", () => {
    const world = buildWorld("space");
    const dust = findPointsWithName(world.root, "static-dust");
    expect(dust).toBeInstanceOf(THREE.Points);
    if (dust) {
      const positions = dust.geometry.getAttribute("position") as
        THREE.BufferAttribute | undefined;
      expect(positions?.count ?? 0).toBeGreaterThan(0);
    }
    world.dispose();
  });

  it("adds a starfield + nebula in the space scene", () => {
    const world = buildWorld("space");
    const totalPoints = countPoints(world.root);
    // Starfield (1 Points) + dust (1 Points) = at least 2.
    expect(totalPoints).toBeGreaterThanOrEqual(2);
    expect(findPointsWithName(world.root, "starfield")).toBeDefined();
    world.dispose();
  });

  it("builds a sunset scene with a skydome + sun disc + clouds", () => {
    const world = buildWorld("sunset");
    const sky = findMeshWithName(world.root, "skydome");
    expect(sky).toBeInstanceOf(THREE.Mesh);
    expect(findMeshWithName(world.root, "sun-disc")).toBeInstanceOf(THREE.Mesh);
    expect(findMeshWithName(world.root, "sunset-clouds")).toBeInstanceOf(
      THREE.Mesh,
    );
    // A real sunset reads through the warm horizon glow + sun halo, not just
    // the gradient. Guard against accidental removal of either.
    expect(findByName(world.root, "sunset-horizon-glow")).toBeDefined();
    expect(countByName(world.root, "sun-halo")).toBeGreaterThanOrEqual(2);
    world.dispose();
  });

  it("builds a deep-sea scene with bubbles + god rays and animates them", () => {
    const world = buildWorld("deep-sea");
    expect(findMeshWithName(world.root, "skydome")).toBeInstanceOf(THREE.Mesh);
    const bubbles = findPointsWithName(world.root, "bubble-field");
    expect(bubbles).toBeDefined();
    if (!bubbles) {
      world.dispose();
      return;
    }
    const positions = bubbles.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const before = (positions.array as Float32Array).slice();
    world.update(0.5);
    const after = positions.array as Float32Array;
    // At least one Y coordinate must have moved (bubbles rise over time).
    const moved = before.some((value, index) => {
      if (index % 3 !== 1) return false;
      return Math.abs((after[index] ?? 0) - value) > 1e-6;
    });
    expect(moved).toBe(true);
    expect(findByName(world.root, "god-rays")).toBeInstanceOf(THREE.Mesh);
    world.dispose();
  });

  it("builds a neon-city scene with a skyline + windows + sun", () => {
    const world = buildWorld("neon-city");
    expect(findMeshWithName(world.root, "skydome")).toBeInstanceOf(THREE.Mesh);
    expect(findMeshWithName(world.root, "neon-skyline")).toBeInstanceOf(
      THREE.Mesh,
    );
    expect(findByName(world.root, "neon-windows")).toBeDefined();
    expect(findMeshWithName(world.root, "neon-sun")).toBeInstanceOf(THREE.Mesh);
    expect(countByName(world.root, "neon-sun-halo")).toBeGreaterThanOrEqual(2);
    expect(findByName(world.root, "neon-horizon-glow")).toBeDefined();
    world.dispose();
  });

  it("builds a glacier scene with aurora ribbons + snow dust + horizon glow", () => {
    const world = buildWorld("glacier");
    expect(findMeshWithName(world.root, "skydome")).toBeInstanceOf(THREE.Mesh);
    expect(countByName(world.root, "aurora-ribbon")).toBeGreaterThanOrEqual(2);
    expect(findByName(world.root, "glacier-horizon-glow")).toBeInstanceOf(
      THREE.Mesh,
    );
    const snow = findPointsWithName(world.root, "snow-dust");
    expect(snow).toBeDefined();
    if (snow) {
      const positions = snow.geometry.getAttribute("position") as
        THREE.BufferAttribute | undefined;
      expect(positions?.count ?? 0).toBeGreaterThan(0);
    }
    world.dispose();
  });

  it("disposes every scene without throwing", () => {
    for (const scene of ENVIRONMENT_SCENES) {
      const world = buildWorld(scene.id);
      expect(() => world.dispose()).not.toThrow();
    }
  });
});
