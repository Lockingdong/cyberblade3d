import * as THREE from "three";
import { mergeStaticGeometries } from "../geometry-utils";
import { getChipEmblemTexture } from "./chip-art";
import type { DetailedBladeBuilder } from "./types";

const BERSERK_STYLE = {
  steel: 0x303640,
  darkSteel: 0x270d02,
  gunmetal: 0x1f2937,
  crimsonMetal: 0x991b1b,
  chipBase: 0x1f0802,
  driverGlass: 0xea580c,
  driverGlassEmissive: 0x9a3412,
  spindle: 0x451a03,
  contact: 0xc2410c,
  ratchetPolycarbonate: 0x1c0902,
  emissiveLava: 0xffaa00,
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
    bevelSegments: 2,
    curveSegments: 8,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

// 1. BLADE (ブレード) - Blaze Asura 6-arm interleaved flame armor blade
export function buildBlade(accentColor: number): THREE.Group {
  const bladeGroup = new THREE.Group();
  bladeGroup.position.y = 0.05;

  const steelGeometries: THREE.BufferGeometry[] = [];

  // Heavy central gunmetal lathe hub
  const hubProfile = [
    new THREE.Vector2(0.1, -0.02),
    new THREE.Vector2(0.33, -0.02),
    new THREE.Vector2(0.37, 0.01),
    new THREE.Vector2(0.37, 0.05),
    new THREE.Vector2(0.31, 0.07),
    new THREE.Vector2(0.1, 0.07),
  ];
  steelGeometries.push(new THREE.LatheGeometry(hubProfile, 32));

  // Base geometry for Primary Heavy Flame Armor Blades (i=0)
  const hornShape = new THREE.Shape();
  hornShape.moveTo(-0.12, -0.08);
  hornShape.lineTo(0.16, -0.08);
  hornShape.quadraticCurveTo(0.32, 0.04, 0.42, 0.2);
  hornShape.lineTo(0.2, 0.26);
  hornShape.quadraticCurveTo(0.06, 0.14, -0.14, 0.06);
  hornShape.closePath();

  // Jagged flame cutout slot inside primary blade
  const flameSlot = new THREE.Path();
  flameSlot.moveTo(-0.02, 0.01);
  flameSlot.lineTo(0.12, 0.05);
  flameSlot.lineTo(0.24, 0.15);
  flameSlot.lineTo(0.12, 0.17);
  flameSlot.closePath();
  hornShape.holes.push(flameSlot);

  const primaryHornBase = extrudeBerserk(hornShape, 0.065, 0.014, 0.012);
  primaryHornBase.rotateY(0.1);
  primaryHornBase.translate(0.3, 0.04, 0);

  // Base geometry for Interleaved Serrated Flame Teeth (i=0)
  const teethShape = new THREE.Shape();
  teethShape.moveTo(-0.08, -0.05);
  teethShape.lineTo(0.12, -0.05);
  teethShape.lineTo(0.24, 0.12);
  teethShape.lineTo(0.06, 0.16);
  teethShape.lineTo(-0.1, 0.06);
  teethShape.closePath();

  const teethBase = extrudeBerserk(teethShape, 0.045, 0.01, 0.008);
  teethBase.translate(0.32, 0.07, 0);

  // Apply perfect rotational symmetry for primary blades and interleaved teeth
  for (let i = 0; i < 3; i += 1) {
    const angle = (i * Math.PI * 2) / 3;
    steelGeometries.push(primaryHornBase.clone().rotateY(angle));
    steelGeometries.push(teethBase.clone().rotateY(angle + Math.PI / 3));
  }
  primaryHornBase.dispose();
  teethBase.dispose();

  const steelMesh = new THREE.Mesh(
    mergeStaticGeometries(steelGeometries),
    new THREE.MeshStandardMaterial({
      color: BERSERK_STYLE.steel,
      roughness: 0.1,
      metalness: 0.9,
      emissive: 0x994422,
      emissiveIntensity: 0.4,
    }),
  );
  steelMesh.userData.outlineThickness = 0.014;
  steelMesh.userData.smoothOutline = true;
  bladeGroup.add(steelMesh);

  // Accent Fiery Crimson Spikes / Horn Tips (6-fold symmetry)
  const spikeBase = new THREE.ConeGeometry(0.045, 0.12, 8);
  spikeBase.rotateX(Math.PI / 2);
  spikeBase.translate(0.42, 0.07, 0);

  const spikeGeometries: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (i * Math.PI * 2) / 6;
    spikeGeometries.push(spikeBase.clone().rotateY(angle));
  }
  spikeBase.dispose();

  const spikesMesh = new THREE.Mesh(
    mergeStaticGeometries(spikeGeometries),
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.15,
      metalness: 0.8,
    }),
  );
  spikesMesh.userData.outlineThickness = 0.01;
  spikesMesh.userData.smoothOutline = true;
  bladeGroup.add(spikesMesh);

  // Fiery Lava Emissive Slots (3-fold symmetry inside primary flame cutouts)
  const lavaSlotBase = new THREE.BoxGeometry(0.16, 0.018, 0.03);
  lavaSlotBase.rotateY(0.4);
  lavaSlotBase.translate(0.38, 0.1, 0);

  const lavaGeometries: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i += 1) {
    const angle = (i * Math.PI * 2) / 3;
    lavaGeometries.push(lavaSlotBase.clone().rotateY(angle));
  }
  lavaSlotBase.dispose();

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

// 2. RATCHET (ラチェット) - 1-60 Heavy Jagged Ratchet
export function buildRatchet(accentColor: number): THREE.Group {
  const ratchetGroup = new THREE.Group();
  ratchetGroup.position.y = 0.005;

  // Dark amber/red polycarbonate body core ring
  const coreGeom = new THREE.CylinderGeometry(0.38, 0.4, 0.065, 32);
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
  const toothShape = new THREE.Shape();
  toothShape.moveTo(-0.09, -0.06);
  toothShape.lineTo(0.09, -0.06);
  toothShape.lineTo(0.14, 0.03);
  toothShape.lineTo(0.05, 0.12);
  toothShape.lineTo(-0.06, 0.12);
  toothShape.closePath();

  const toothBase = extrudeBerserk(toothShape, 0.06, 0.008, 0.008);
  toothBase.translate(0.4, 0, 0);

  const toothGeometries: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i += 1) {
    const angle = (i * Math.PI * 2) / 3;
    toothGeometries.push(toothBase.clone().rotateY(angle));
  }
  toothBase.dispose();

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
  bitGroup.position.y = -0.055;

  // Heavy 12-Tooth X-Dash gear ring (12-fold symmetry)
  const gearTooth = new THREE.BoxGeometry(0.028, 0.06, 0.045);
  gearTooth.translate(0.165, -0.015, 0);

  const gearGeometries: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 12; i += 1) {
    gearGeometries.push(gearTooth.clone().rotateY((i * Math.PI * 2) / 12));
  }
  gearTooth.dispose();

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
    8,
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
    new THREE.CylinderGeometry(0.03, 0.03, 0.15, 8),
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
  const tipGeom = new THREE.CylinderGeometry(0.095, 0.095, 0.05, 16);
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
  const collarGeometry = new THREE.TorusGeometry(0.155, 0.04, 8, 16);
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
  chipGroup.position.y = 0.155;

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.175, 0.185, 0.13, 24),
    new THREE.MeshStandardMaterial({
      color: BERSERK_STYLE.chipBase,
      roughness: 0.4,
      metalness: 0.8,
    }),
  );
  base.userData.outlineThickness = 0.014;
  chipGroup.add(base);

  const rimGeometry = new THREE.TorusGeometry(0.165, 0.012, 6, 24);
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
