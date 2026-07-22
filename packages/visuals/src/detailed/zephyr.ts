import * as THREE from "three";
import { mergeStaticGeometries } from "../geometry-utils";
import { getChipEmblemTexture } from "./chip-art";
import type { DetailedBladeBuilder } from "./types";

const ZEPHYR_STYLE = {
  steel: 0xc5ccd7,
  titaniumWhite: 0xf1f5f9,
  darkSteel: 0x0c4a6e,
  chipBase: 0x041921,
  driverGlass: 0x0ea5e9,
  driverGlassEmissive: 0x0369a1,
  spindle: 0x075985,
  contact: 0x0284c7,
  ratchetPolycarbonate: 0x082f49,
  emissiveCyan: 0x00f0ff,
};

function extrudeZephyr(
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

// 1. BLADE (ブレード) - Azure Meteor 50% Cyan Coverage & 4 Emissive Bands per Wing
export function buildBlade(accentColor: number): THREE.Group {
  const bladeGroup = new THREE.Group();
  bladeGroup.position.y = 0.05;

  const steelGeometries: THREE.BufferGeometry[] = [];

  // Central aerodynamic lathe hub
  const hubProfile = [
    new THREE.Vector2(0.1, -0.02),
    new THREE.Vector2(0.33, -0.02),
    new THREE.Vector2(0.37, 0.01),
    new THREE.Vector2(0.37, 0.05),
    new THREE.Vector2(0.31, 0.07),
    new THREE.Vector2(0.1, 0.07),
  ];
  steelGeometries.push(new THREE.LatheGeometry(hubProfile, 32));

  // Main 3 Swept Jet Wings (Base steel geometry)
  const wingShape = new THREE.Shape();
  wingShape.moveTo(-0.14, -0.08);
  wingShape.lineTo(0.16, -0.08);
  wingShape.quadraticCurveTo(0.32, 0.04, 0.42, 0.2);
  wingShape.lineTo(0.18, 0.26);
  wingShape.quadraticCurveTo(0.02, 0.14, -0.16, 0.06);
  wingShape.closePath();

  const ventSlot = new THREE.Path();
  ventSlot.moveTo(-0.02, 0.02);
  ventSlot.lineTo(0.14, 0.06);
  ventSlot.lineTo(0.22, 0.16);
  ventSlot.lineTo(0.1, 0.18);
  ventSlot.closePath();
  wingShape.holes.push(ventSlot);

  const mainWingBase = extrudeZephyr(wingShape, 0.055, 0.012, 0.01);
  mainWingBase.rotateY(-0.15);
  mainWingBase.translate(0.28, 0.035, 0);

  // Upper aerodynamic wing layer
  const upperShape = new THREE.Shape();
  upperShape.moveTo(-0.08, -0.05);
  upperShape.lineTo(0.12, -0.05);
  upperShape.lineTo(0.26, 0.14);
  upperShape.lineTo(0.08, 0.18);
  upperShape.closePath();

  const upperWingBase = extrudeZephyr(upperShape, 0.035, 0.008, 0.008);
  upperWingBase.rotateY(-0.1);
  upperWingBase.translate(0.3, 0.085, 0);

  for (let i = 0; i < 3; i += 1) {
    const angle = (i * Math.PI * 2) / 3;
    steelGeometries.push(mainWingBase.clone().rotateY(angle));
    steelGeometries.push(upperWingBase.clone().rotateY(angle));
  }
  mainWingBase.dispose();
  upperWingBase.dispose();

  const steelMesh = new THREE.Mesh(
    mergeStaticGeometries(steelGeometries),
    new THREE.MeshStandardMaterial({
      color: ZEPHYR_STYLE.steel,
      roughness: 0.08,
      metalness: 0.94,
      emissive: 0xcccccc,
      emissiveIntensity: 0.5,
    }),
  );
  steelMesh.userData.outlineThickness = 0.014;
  steelMesh.userData.smoothOutline = true;
  bladeGroup.add(steelMesh);

  // Large-Area Cyan Armor Plates & Cyan Accents (~50% Cyan Surface Coverage)
  const tipGeometries: THREE.BufferGeometry[] = [];

  // 1. Large-Area Anodized Cyan Armor Plate (大面積電鍍藍裝甲板，覆蓋率達 50%)
  const bigCyanPlateShape = new THREE.Shape();
  bigCyanPlateShape.moveTo(-0.1, -0.06);
  bigCyanPlateShape.lineTo(0.14, -0.06);
  bigCyanPlateShape.quadraticCurveTo(0.3, 0.03, 0.4, 0.18);
  bigCyanPlateShape.lineTo(0.18, 0.23);
  bigCyanPlateShape.quadraticCurveTo(0.04, 0.12, -0.12, 0.05);
  bigCyanPlateShape.closePath();

  const bigCyanPlateBase = extrudeZephyr(bigCyanPlateShape, 0.028, 0.007, 0.007);
  bigCyanPlateBase.rotateY(-0.15);
  bigCyanPlateBase.translate(0.28, 0.09, 0);

  // 2. Aerodynamic Cyan Wingtip Edge Fins
  const tipShape = new THREE.Shape();
  tipShape.moveTo(0.02, -0.04);
  tipShape.lineTo(0.12, 0.06);
  tipShape.lineTo(0.08, 0.1);
  tipShape.lineTo(-0.04, 0.02);
  tipShape.closePath();

  const tipBase = extrudeZephyr(tipShape, 0.04, 0.006, 0.006);
  tipBase.rotateY(-0.2);
  tipBase.translate(0.42, 0.06, 0);

  for (let i = 0; i < 3; i += 1) {
    const angle = (i * Math.PI * 2) / 3;
    tipGeometries.push(bigCyanPlateBase.clone().rotateY(angle));
    tipGeometries.push(tipBase.clone().rotateY(angle));
  }
  bigCyanPlateBase.dispose();
  tipBase.dispose();

  // 3. Inner Cyan Turbine Collar Ring & 6 Turbine Fin Blades
  const innerRingGeom = new THREE.TorusGeometry(0.22, 0.014, 8, 24);
  innerRingGeom.rotateX(Math.PI / 2);
  innerRingGeom.translate(0, 0.075, 0);
  tipGeometries.push(innerRingGeom);

  const turbineFinBase = new THREE.BoxGeometry(0.04, 0.016, 0.08);
  turbineFinBase.rotateY(0.4);
  turbineFinBase.translate(0.22, 0.075, 0);
  for (let i = 0; i < 6; i += 1) {
    const angle = (i * Math.PI * 2) / 6;
    tipGeometries.push(turbineFinBase.clone().rotateY(angle));
  }
  turbineFinBase.dispose();

  const tipsMesh = new THREE.Mesh(
    mergeStaticGeometries(tipGeometries),
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.18,
      metalness: 0.85,
    }),
  );
  tipsMesh.userData.outlineThickness = 0.01;
  tipsMesh.userData.smoothOutline = true;
  bladeGroup.add(tipsMesh);

  // 4 Forward-Swept Emissive Cyan Energy Slots per Wing (12 Slots Total Across Top)
  const sliverGeometries: THREE.BufferGeometry[] = [];

  // Slot 1: Top Inner Wide Emissive Band
  const sliver1 = new THREE.BoxGeometry(0.14, 0.015, 0.022);
  sliver1.rotateY(0.28);
  sliver1.translate(0.37, 0.115, 0.02);

  // Slot 2: Top Outer Wide Emissive Band
  const sliver2 = new THREE.BoxGeometry(0.12, 0.015, 0.022);
  sliver2.rotateY(0.18);
  sliver2.translate(0.31, 0.115, -0.03);

  // Slot 3: Leading Edge Intake Emissive Band
  const sliver3 = new THREE.BoxGeometry(0.16, 0.015, 0.02);
  sliver3.rotateY(0.35);
  sliver3.translate(0.38, 0.105, 0.05);

  // Slot 4: Trailing Edge Emissive Band
  const sliver4 = new THREE.BoxGeometry(0.1, 0.015, 0.018);
  sliver4.rotateY(-0.15);
  sliver4.translate(0.28, 0.045, 0);

  for (let i = 0; i < 3; i += 1) {
    const angle = (i * Math.PI * 2) / 3;
    sliverGeometries.push(sliver1.clone().rotateY(angle));
    sliverGeometries.push(sliver2.clone().rotateY(angle));
    sliverGeometries.push(sliver3.clone().rotateY(angle));
    sliverGeometries.push(sliver4.clone().rotateY(angle));
  }
  sliver1.dispose();
  sliver2.dispose();
  sliver3.dispose();
  sliver4.dispose();

  const slivers = new THREE.Mesh(
    mergeStaticGeometries(sliverGeometries),
    new THREE.MeshBasicMaterial({
      color: ZEPHYR_STYLE.emissiveCyan,
      toneMapped: false,
    }),
  );
  slivers.userData.noOutline = true;
  bladeGroup.add(slivers);

  return bladeGroup;
}

// 2. RATCHET (ラチェット) - 3-70 High Aerodynamic Ratchet
export function buildRatchet(accentColor: number): THREE.Group {
  const ratchetGroup = new THREE.Group();
  ratchetGroup.position.y = 0.005;

  const coreGeom = new THREE.CylinderGeometry(0.38, 0.4, 0.065, 32);
  const coreMesh = new THREE.Mesh(
    coreGeom,
    new THREE.MeshStandardMaterial({
      color: ZEPHYR_STYLE.ratchetPolycarbonate,
      roughness: 0.2,
      metalness: 0.3,
      transparent: true,
      opacity: 0.88,
    }),
  );
  coreMesh.userData.outlineThickness = 0.012;
  ratchetGroup.add(coreMesh);

  const toothShape = new THREE.Shape();
  toothShape.moveTo(-0.08, -0.06);
  toothShape.lineTo(0.08, -0.06);
  toothShape.lineTo(0.12, 0.04);
  toothShape.lineTo(0.04, 0.11);
  toothShape.lineTo(-0.06, 0.11);
  toothShape.closePath();

  const toothBase = extrudeZephyr(toothShape, 0.06, 0.008, 0.008);
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

// 3. BIT (ビット) - High Flat Speed Bit with 12-gear X-Dash ring
export function buildBit(accentColor: number): THREE.Group {
  const bitGroup = new THREE.Group();
  bitGroup.position.y = -0.055;

  const gearTooth = new THREE.BoxGeometry(0.025, 0.06, 0.04);
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

  const facetGeometry = new THREE.CylinderGeometry(
    0.14,
    0.06,
    0.17,
    8,
    2,
  ).toNonIndexed();
  facetGeometry.computeVertexNormals();
  facetGeometry.translate(0, -0.09, 0);
  const facets = new THREE.Mesh(
    facetGeometry,
    new THREE.MeshStandardMaterial({
      color: ZEPHYR_STYLE.driverGlass,
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.75,
      emissive: ZEPHYR_STYLE.driverGlassEmissive,
      emissiveIntensity: 0.4,
    }),
  );
  facets.userData.noOutline = true;
  facets.userData.noShadow = true;
  bitGroup.add(facets);

  const spindle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.15, 8),
    new THREE.MeshStandardMaterial({
      color: ZEPHYR_STYLE.spindle,
      roughness: 0.3,
      metalness: 0.7,
    }),
  );
  spindle.position.y = -0.09;
  spindle.userData.noOutline = true;
  bitGroup.add(spindle);

  const tipGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.05, 16);
  const tipMesh = new THREE.Mesh(
    tipGeom,
    new THREE.MeshStandardMaterial({
      color: ZEPHYR_STYLE.contact,
      roughness: 0.3,
      metalness: 0.7,
    }),
  );
  tipMesh.position.y = -0.19;
  tipMesh.userData.outlineThickness = 0.01;
  bitGroup.add(tipMesh);

  const collarGeometry = new THREE.TorusGeometry(0.15, 0.04, 8, 16);
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

// 4. CHIP (晶片 / 核心印記) - Center Azure Meteor emblem chip
export function buildChip(accentColor: number): THREE.Group {
  const chipGroup = new THREE.Group();
  chipGroup.position.y = 0.155;

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.175, 0.185, 0.13, 24),
    new THREE.MeshStandardMaterial({
      color: ZEPHYR_STYLE.chipBase,
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
      map: getChipEmblemTexture("zephyr", accentColor),
      toneMapped: false,
    }),
  );
  art.position.y = 0.066;
  art.userData.noOutline = true;
  chipGroup.add(art);

  return chipGroup;
}

export const buildZephyrDetailed: DetailedBladeBuilder = (accentColor) => ({
  blade: buildBlade(accentColor),
  ratchet: buildRatchet(accentColor),
  bit: buildBit(accentColor),
  chip: buildChip(accentColor),
});
