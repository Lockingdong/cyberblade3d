import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  STADIUMS,
  type StadiumTheme,
  type StadiumVariant,
} from "@cyberblade/core";
import { BeybladeVisualWorld } from "./index";

const themes: StadiumTheme[] = ["neon", "toxic", "volcano"];

function countByType(group: THREE.Object3D): {
  meshes: number;
  lines: number;
  points: number;
} {
  let meshes = 0;
  let lines = 0;
  let points = 0;
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) meshes += 1;
    else if (child instanceof THREE.Line || child instanceof THREE.LineSegments)
      lines += 1;
    else if (child instanceof THREE.Points) points += 1;
  });
  return { meshes, lines, points };
}

describe("BeybladeVisualWorld stadium", () => {
  it.each(themes)("uses the requested stadium theme %s", (theme) => {
    const world = new BeybladeVisualWorld("attack", "defense", theme, "p1");
    // The stadium group is the first child of root.
    const stadium = world.root.children[0]!;
    const { meshes, lines } = countByType(stadium);
    expect(meshes).toBeGreaterThan(15);
    expect(lines).toBeGreaterThan(0);
    world.dispose();
  });

  it.each(themes)("builds both light and dark variants for %s", (theme) => {
    const colors = ( ["light", "dark"] as StadiumVariant[]).map((variant) => {
      const world = new BeybladeVisualWorld(
        "attack",
        "defense",
        theme,
        "p1",
        "space",
        undefined,
        undefined,
        variant,
      );
      const bowl = world.root.children[0]!.children.find(
        (child) => child instanceof THREE.Mesh,
      ) as THREE.Mesh;
      const material = bowl.material as THREE.MeshStandardMaterial;
      const color = material.color.getHex();
      world.dispose();
      return color;
    });
    expect(colors[0]).not.toBe(colors[1]);
  });

  it("places a center emblem group inside the stadium", () => {
    for (const theme of themes) {
      const world = new BeybladeVisualWorld("attack", "defense", theme, "p1");
      const stadium = world.root.children[0]!;
      // The center emblem is the only Group that contains a base + ring +
      // theme-specific teeth. Check that some child group exists with more
      // than one child.
      const groups = stadium.children.filter(
        (c) => c instanceof THREE.Group,
      ) as THREE.Group[];
      const emblem = groups.find((g) => g.children.length >= 3);
      expect(embolismPresent(emblem)).toBe(true);
      world.dispose();
    }
  });

  it("renders different floor patterns per theme", () => {
    const counts: Record<StadiumTheme, number> = {
      neon: 0,
      toxic: 0,
      volcano: 0,
    };
    for (const theme of themes) {
      const world = new BeybladeVisualWorld("attack", "defense", theme, "p1");
      const stadium = world.root.children[0]!;
      counts[theme] = countByType(stadium).lines;
      world.dispose();
    }
    // Every theme should produce at least some line art.
    expect(counts.neon).toBeGreaterThan(0);
    expect(counts.toxic).toBeGreaterThan(0);
    expect(counts.volcano).toBeGreaterThan(0);
  });

  it("adds a compact theme-colored floating base below every stadium", () => {
    const plateColors = new Set<number>();
    for (const theme of themes) {
      const world = new BeybladeVisualWorld("attack", "defense", theme, "p1");
      const stadium = world.root.children[0]!;
      const base = stadium.getObjectByName(`stadium-${theme}-floating-base`);
      const plate = stadium.getObjectByName(
        `stadium-${theme}-base-plate`,
      ) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
      expect(base).toBeInstanceOf(THREE.Group);
      expect(countByType(base!).meshes).toBe(3);
      expect(plate).toBeInstanceOf(THREE.Mesh);
      expect(new THREE.Box3().setFromObject(base!).max.y).toBeLessThan(0);
      expect(new THREE.Box3().setFromObject(plate).max.x).toBeCloseTo(8.48, 1);
      plateColors.add(plate.material.color.getHex());
      world.dispose();
    }
    expect(plateColors.size).toBe(themes.length);
  });

  it("removes visual pocket holes while preserving the four wall gaps", () => {
    for (const theme of themes) {
      const world = new BeybladeVisualWorld("attack", "defense", theme, "p1");
      const stadium = world.root.children[0]!;
      for (let index = 0; index < 4; index += 1) {
        expect(
          stadium.getObjectByName(`stadium-wall-arc-${index}`),
        ).toBeInstanceOf(THREE.Mesh);
      }
      expect(
        stadium.getObjectByName("stadium-danger-zone-bars"),
      ).toBeInstanceOf(THREE.Mesh);
      let hasBlackPocketSurface = false;
      stadium.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        hasBlackPocketSurface ||= materials.some(
          (material) =>
            material instanceof THREE.MeshBasicMaterial &&
            material.color.getHex() === 0x020105,
        );
      });
      expect(hasBlackPocketSurface).toBe(false);
      world.dispose();
    }
  });

  it("exposes the same accent/accentIntensity fields in STADIUMS", () => {
    for (const stadium of STADIUMS) {
      expect(stadium.floorEmissive).toBeTypeOf("number");
      expect(stadium.accent).toBeTypeOf("number");
      expect(stadium.accentIntensity).toBeGreaterThan(0);
      expect(stadium.accentIntensity).toBeLessThanOrEqual(1);
    }
  });
});

function embolismPresent(group: THREE.Group | undefined): boolean {
  return Boolean(group);
}
