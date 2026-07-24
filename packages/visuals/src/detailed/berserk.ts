import * as THREE from "three";
import { mergeStaticGeometries } from "../geometry-utils";
import { getChipEmblemTexture } from "./chip-art";
import type { DetailedBladeBuilder } from "./types";

const BERSERK_STYLE = {
  steel: 0xdce2e8,
  darkSteel: 0x475569,
  gunmetal: 0x2b303a,
  crimsonMetal: 0xd90429,
  chipBase: 0x1e293b,
  driverGlass: 0xf1f5f9,
  driverGlassEmissive: 0x64748b,
  spindle: 0x475569,
  contact: 0x64748b,
  ratchetPolycarbonate: 0x334155,
  emissiveLava: 0xff3300,
};

function extrudeBerserk(
  shape: THREE.Shape,
  depth: number,
  bevelThickness: number,
  bevelSize: number,
): THREE.BufferGeometry {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness,
    bevelSize,
    bevelSegments: 3,
    curveSegments: 16,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

// 1. BLADE (ブレード) - Blaze Asura 6-arm interleaved flame armor blade
export function buildBlade(accentColor: number): THREE.Group {
  const bladeGroup = new THREE.Group();
  bladeGroup.position.y = 0.052;
  bladeGroup.scale.y = 0.85;

  // 1A. Central Dark Gunmetal Core Hub
  const hubProfile = [
    new THREE.Vector2(0.1, -0.02),
    new THREE.Vector2(0.33, -0.02),
    new THREE.Vector2(0.37, 0.01),
    new THREE.Vector2(0.37, 0.05),
    new THREE.Vector2(0.31, 0.07),
    new THREE.Vector2(0.1, 0.07),
  ];
  const hubMesh = new THREE.Mesh(
    new THREE.LatheGeometry(hubProfile, 32),
    new THREE.MeshStandardMaterial({
      color: BERSERK_STYLE.gunmetal,
      roughness: 0.35,
      metalness: 0.85,
    }),
  );
  hubMesh.userData.outlineThickness = 0.012;
  bladeGroup.add(hubMesh);

  // 1B. Heavy Die-Cast Metal Blade Armor (Silver Metal Chrome Ring)
  const steelGeometries: THREE.BufferGeometry[] = [];
  const clawGeometries: THREE.BufferGeometry[] = [];

  for (let i = 0; i < 3; i += 1) {
    const anglePrimary = (i * Math.PI * 2) / 3;
    const angleInterleaved = anglePrimary + Math.PI / 3;

    // Primary Heavy Metal Horn shape
    const hornShape = new THREE.Shape();
    hornShape.moveTo(0.18, -0.08);
    hornShape.lineTo(0.46, -0.08);
    hornShape.quadraticCurveTo(0.52, 0.04, 0.58, 0.2);
    hornShape.lineTo(0.42, 0.26);
    hornShape.quadraticCurveTo(0.32, 0.14, 0.16, 0.06);
    hornShape.closePath();

    // Jagged flame cutout slot inside primary blade
    const flameSlot = new THREE.Path();
    flameSlot.moveTo(0.28, 0.01);
    flameSlot.lineTo(0.42, 0.05);
    flameSlot.lineTo(0.5, 0.15);
    flameSlot.lineTo(0.4, 0.17);
    flameSlot.closePath();
    hornShape.holes.push(flameSlot);

    const primaryHornGeom = extrudeBerserk(hornShape, 0.065, 0.014, 0.012);
    primaryHornGeom.translate(0, 0.04, 0);
    primaryHornGeom.rotateY(anglePrimary);
    steelGeometries.push(primaryHornGeom);

    // Interleaved Serrated Metal Teeth shape
    const teethShape = new THREE.Shape();
    teethShape.moveTo(0.24, -0.05);
    teethShape.lineTo(0.44, -0.05);
    teethShape.lineTo(0.52, 0.12);
    teethShape.lineTo(0.38, 0.16);
    teethShape.lineTo(0.22, 0.06);
    teethShape.closePath();

    const teethGeom = extrudeBerserk(teethShape, 0.045, 0.01, 0.008);
    teethGeom.translate(0, 0.07, 0);
    teethGeom.rotateY(angleInterleaved);
    steelGeometries.push(teethGeom);

    // 1C. Heavy Steel Spike Tips (Polished Chrome Cone Tips)
    const spikeBase = new THREE.ConeGeometry(0.045, 0.12, 12);
    spikeBase.rotateX(Math.PI / 2);
    spikeBase.translate(0.48, 0.07, 0);
    spikeBase.rotateY(anglePrimary);
    steelGeometries.push(spikeBase);

    const spikeInterleaved = new THREE.ConeGeometry(0.04, 0.1, 12);
    spikeInterleaved.rotateX(Math.PI / 2);
    spikeInterleaved.translate(0.48, 0.07, 0);
    spikeInterleaved.rotateY(angleInterleaved);
    steelGeometries.push(spikeInterleaved);

    // 1D. Overlaid Crimson Flame Armor Claws (Accent Color)
    const clawShape = new THREE.Shape();
    clawShape.moveTo(0.22, -0.06);
    clawShape.lineTo(0.44, -0.06);
    clawShape.quadraticCurveTo(0.48, 0.04, 0.52, 0.16);
    clawShape.lineTo(0.38, 0.21);
    clawShape.quadraticCurveTo(0.3, 0.1, 0.2, 0.04);
    clawShape.closePath();

    const clawGeom = extrudeBerserk(clawShape, 0.03, 0.008, 0.006);
    clawGeom.translate(0, 0.105, 0);
    clawGeom.rotateY(anglePrimary);
    clawGeometries.push(clawGeom);
  }

  // Metallic Chrome Outer Ring Mesh (Horns, Teeth, and Steel Spike Tips)
  const steelMesh = new THREE.Mesh(
    mergeStaticGeometries(steelGeometries),
    new THREE.MeshStandardMaterial({
      color: 0xd4dcff,
      roughness: 0.12,
      metalness: 0.92,
      emissive: 0x1a202c,
      emissiveIntensity: 0.25,
    }),
  );
  steelMesh.userData.outlineThickness = 0.014;
  steelMesh.userData.smoothOutline = true;
  bladeGroup.add(steelMesh);

  // Fiery Crimson Accent Flame Claws Mesh
  const clawsMesh = new THREE.Mesh(
    mergeStaticGeometries(clawGeometries),
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.2,
      metalness: 0.75,
    }),
  );
  clawsMesh.userData.outlineThickness = 0.01;
  clawsMesh.userData.smoothOutline = true;
  bladeGroup.add(clawsMesh);

  // 1E. Fiery Lava Emissive Slots (Glowing Fiery Orange-Red)
  const lavaGeometries: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i += 1) {
    const angle = (i * Math.PI * 2) / 3;
    const lavaSlotGeom = new THREE.BoxGeometry(0.16, 0.018, 0.03);
    lavaSlotGeom.translate(0.4, 0.1, 0);
    lavaSlotGeom.rotateY(angle);
    lavaGeometries.push(lavaSlotGeom);
  }

  const lavaMesh = new THREE.Mesh(
    mergeStaticGeometries(lavaGeometries),
    new THREE.MeshBasicMaterial({
      color: BERSERK_STYLE.emissiveLava,
      toneMapped: false,
    }),
  );
  lavaMesh.userData.noOutline = true;
  bladeGroup.add(lavaMesh);

  return bladeGroup;
}

// 2. RATCHET (ラチェット) - 1-60 Heavy Jagged Ratchet (3-fold symmetry kept under blade boundary)
export function buildRatchet(accentColor: number): THREE.Group {
  const ratchetGroup = new THREE.Group();
  ratchetGroup.position.y = 0.01;

  // Dark amber/red polycarbonate body core ring
  const coreGeom = new THREE.CylinderGeometry(0.3, 0.32, 0.065, 32);
  const coreMesh = new THREE.Mesh(
    coreGeom,
    new THREE.MeshStandardMaterial({
      color: BERSERK_STYLE.ratchetPolycarbonate,
      roughness: 0.2,
      metalness: 0.3,
      transparent: true,
      opacity: 0.88,
    }),
  );
  coreMesh.userData.outlineThickness = 0.012;
  ratchetGroup.add(coreMesh);

  // 3 Heavy Asymmetric Serrated Bumper Teeth with 3-fold symmetry
  const toothGeometries: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i += 1) {
    const angle = (i * Math.PI * 2) / 3;
    const toothShape = new THREE.Shape();
    toothShape.moveTo(0.28, -0.06);
    toothShape.lineTo(0.385, -0.06);
    toothShape.lineTo(0.385, 0.03);
    toothShape.lineTo(0.32, 0.08);
    toothShape.lineTo(0.28, 0.08);
    toothShape.closePath();

    const toothGeom = extrudeBerserk(toothShape, 0.06, 0.006, 0.006);
    toothGeom.rotateY(angle);
    toothGeometries.push(toothGeom);
  }

  const toothMesh = new THREE.Mesh(
    mergeStaticGeometries(toothGeometries),
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.25,
      metalness: 0.75,
    }),
  );
  toothMesh.userData.outlineThickness = 0.01;
  ratchetGroup.add(toothMesh);

  return ratchetGroup;
}

// 3. BIT (ビット) - Extreme Rubber Flat Bit with 12-gear X-Dash ring
export function buildBit(accentColor: number): THREE.Group {
  const bitGroup = new THREE.Group();
  bitGroup.position.y = -0.065;

  // Heavy 12-Tooth X-Dash gear ring (12-fold symmetry)
  const gearGeometries: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 12; i += 1) {
    const gearTooth = new THREE.BoxGeometry(0.028, 0.06, 0.045);
    gearTooth.translate(0.165, -0.015, 0);
    gearTooth.rotateY((i * Math.PI * 2) / 12);
    gearGeometries.push(gearTooth);
  }

  const gearMesh = new THREE.Mesh(
    mergeStaticGeometries(gearGeometries),
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.2,
      metalness: 0.8,
    }),
  );
  gearMesh.userData.outlineThickness = 0.008;
  bitGroup.add(gearMesh);

  // Faceted translucent amber glass driver body
  const facetGeometry = new THREE.CylinderGeometry(
    0.145,
    0.065,
    0.17,
    12,
    2,
  ).toNonIndexed();
  facetGeometry.computeVertexNormals();
  facetGeometry.translate(0, -0.09, 0);
  const facets = new THREE.Mesh(
    facetGeometry,
    new THREE.MeshStandardMaterial({
      color: BERSERK_STYLE.driverGlass,
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.75,
      emissive: BERSERK_STYLE.driverGlassEmissive,
      emissiveIntensity: 0.4,
    }),
  );
  facets.userData.noOutline = true;
  facets.userData.noShadow = true;
  bitGroup.add(facets);

  // Opaque inner metal spindle
  const spindle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.15, 12),
    new THREE.MeshStandardMaterial({
      color: BERSERK_STYLE.spindle,
      roughness: 0.3,
      metalness: 0.7,
    }),
  );
  spindle.position.y = -0.09;
  spindle.userData.noOutline = true;
  bitGroup.add(spindle);

  // Extreme Rubber Flat ground contact tip cylinder
  const tipGeom = new THREE.CylinderGeometry(0.095, 0.095, 0.05, 24);
  const tipMesh = new THREE.Mesh(
    tipGeom,
    new THREE.MeshStandardMaterial({
      color: BERSERK_STYLE.contact,
      roughness: 0.5,
      metalness: 0.4,
    }),
  );
  tipMesh.position.y = -0.19;
  tipMesh.userData.outlineThickness = 0.01;
  bitGroup.add(tipMesh);

  // Metallic accent collar torus
  const collarGeometry = new THREE.TorusGeometry(0.155, 0.04, 12, 24);
  collarGeometry.rotateX(Math.PI / 2);
  const collar = new THREE.Mesh(
    collarGeometry,
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.3,
      metalness: 0.8,
    }),
  );
  collar.position.y = -0.04;
  collar.userData.noOutline = true;
  bitGroup.add(collar);

  return bitGroup;
}

// 4. CHIP (晶片 / 核心印記) - Center Blaze Asura emblem chip
export function buildChip(accentColor: number): THREE.Group {
  const chipGroup = new THREE.Group();
  chipGroup.position.y = 0.165;

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.175, 0.185, 0.13, 32),
    new THREE.MeshStandardMaterial({
      color: BERSERK_STYLE.chipBase,
      roughness: 0.4,
      metalness: 0.8,
    }),
  );
  base.userData.outlineThickness = 0.014;
  chipGroup.add(base);

  const rimGeometry = new THREE.TorusGeometry(0.165, 0.012, 8, 32);
  rimGeometry.rotateX(Math.PI / 2);
  const rim = new THREE.Mesh(
    rimGeometry,
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.3,
      metalness: 0.7,
    }),
  );
  rim.position.y = 0.066;
  rim.userData.noOutline = true;
  chipGroup.add(rim);

  const artGeometry = new THREE.CircleGeometry(0.15, 32);
  artGeometry.rotateX(-Math.PI / 2);
  const art = new THREE.Mesh(
    artGeometry,
    new THREE.MeshBasicMaterial({
      map: getChipEmblemTexture("berserk", accentColor),
      toneMapped: false,
    }),
  );
  art.position.y = 0.066;
  art.userData.noOutline = true;
  chipGroup.add(art);

  return chipGroup;
}

export const buildBerserkDetailed: DetailedBladeBuilder = (accentColor) => ({
  blade: buildBlade(accentColor),
  ratchet: buildRatchet(accentColor),
  bit: buildBit(accentColor),
  chip: buildChip(accentColor),
});

