import * as THREE from "three";
import { mergeStaticGeometries } from "../geometry-utils";
import { getChipEmblemTexture } from "./chip-art";
import type { DetailedBladeBuilder } from "./types";

// Beyblade X detailed stamina top (Storm Wing): 4 distinct components (Blade, Ratchet, Bit, Chip).
// Features a slim aerodynamic chrome perimeter rim with 3 open air slots, gold accent plates, a 5-80 stamina ratchet, a Ball Bit, and a storm emblem chip.

const STAMINA_STYLE = {
  brightChrome: 0xd8dde5,
  goldAccent: 0xf59e0b, // Ultra-bright gold/brass accent plate
  chipBase: 0x122019,
  driverGlass: 0x059669,
  driverGlassEmissive: 0x022c22,
  spindle: 0x1f2937,
  contact: 0x374151,
  ratchetPolycarbonate: 0x064e3b,
};

function extrudeStamina(
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

// 1. BLADE (ブレード) - Slim perimeter metal rim + 3 aerodynamic air slots + gold accent plates
export function buildBlade(accentColor: number): THREE.Group {
  const bladeGroup = new THREE.Group();
  bladeGroup.position.y = 0.052;
  bladeGroup.scale.y = 0.85;

  const chromeGeometries: THREE.BufferGeometry[] = [];

  // (a) Slim torus outer rim (reduced tube radius from 0.065 to 0.024 for a refined, non-bulky look)
  const outerRim = new THREE.TorusGeometry(0.38, 0.024, 12, 36);
  outerRim.rotateX(Math.PI / 2);
  outerRim.translate(0, 0.055, 0);
  chromeGeometries.push(outerRim);

  // (b) Sleek inner hub ring
  const hubProfile = [
    new THREE.Vector2(0.1, 0.01),
    new THREE.Vector2(0.24, 0.01),
    new THREE.Vector2(0.27, 0.03),
    new THREE.Vector2(0.27, 0.065),
    new THREE.Vector2(0.22, 0.075),
    new THREE.Vector2(0.1, 0.075),
  ];
  chromeGeometries.push(new THREE.LatheGeometry(hubProfile, 36));

  // (c) 3 Swept Micro-Wings along the outer rim
  for (let i = 0; i < 3; i += 1) {
    const angle = (i * Math.PI * 2) / 3;
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0.24, 0.02);
    wingShape.quadraticCurveTo(0.38, 0.08, 0.42, 0.02);
    wingShape.quadraticCurveTo(0.34, -0.03, 0.26, -0.04);
    wingShape.closePath();

    const wingGeom = extrudeStamina(wingShape, 0.028, 0.006, 0.006);
    wingGeom.rotateY(angle);
    wingGeom.translate(0, 0.065, 0);
    chromeGeometries.push(wingGeom);
  }

  const chromeMesh = new THREE.Mesh(
    mergeStaticGeometries(chromeGeometries),
    new THREE.MeshStandardMaterial({
      color: STAMINA_STYLE.brightChrome,
      roughness: 0.08,
      metalness: 0.88,
      emissive: 0xcccccc,
      emissiveIntensity: 0.5,
    }),
  );
  chromeMesh.userData.outlineThickness = 0.01;
  chromeMesh.userData.smoothOutline = true;
  bladeGroup.add(chromeMesh);

  // (d) Gold/Brass High-Contrast Accent Plates (visible through the 3 air slots)
  const goldGeometries: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i += 1) {
    const angle = (i * Math.PI * 2) / 3 + Math.PI / 3;

    // Curved gold plate spanning between the chrome wings
    const goldPlateShape = new THREE.Shape();
    goldPlateShape.moveTo(0.22, 0.03);
    goldPlateShape.lineTo(0.36, 0.05);
    goldPlateShape.lineTo(0.34, -0.04);
    goldPlateShape.lineTo(0.23, -0.02);
    goldPlateShape.closePath();

    const goldGeom = extrudeStamina(goldPlateShape, 0.022, 0.004, 0.004);
    goldGeom.rotateY(angle);
    goldGeom.translate(0, 0.05, 0);
    goldGeometries.push(goldGeom);
  }

  const goldMesh = new THREE.Mesh(
    mergeStaticGeometries(goldGeometries),
    new THREE.MeshStandardMaterial({
      color: STAMINA_STYLE.goldAccent,
      roughness: 0.2,
      metalness: 0.9,
    }),
  );
  goldMesh.userData.outlineThickness = 0.008;
  bladeGroup.add(goldMesh);

  // (e) Emerald Aerodynamic Fin Inserts x3
  const finGeometries: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i += 1) {
    const angle = (i * Math.PI * 2) / 3 + Math.PI / 6;
    const finShape = new THREE.Shape();
    finShape.moveTo(0.26, 0.01);
    finShape.lineTo(0.35, 0.03);
    finShape.lineTo(0.31, -0.01);
    finShape.closePath();

    const finGeom = extrudeStamina(finShape, 0.018, 0.003, 0.003);
    finGeom.rotateY(angle);
    finGeom.translate(0, 0.07, 0);
    finGeometries.push(finGeom);
  }

  const finsMesh = new THREE.Mesh(
    mergeStaticGeometries(finGeometries),
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.25,
      metalness: 0.7,
    }),
  );
  finsMesh.userData.outlineThickness = 0.006;
  bladeGroup.add(finsMesh);

  return bladeGroup;
}

// 2. RATCHET (ラチェット) - 5-80 Stamina Ratchet (5 rounded low-drag teeth)
export function buildRatchet(accentColor: number): THREE.Group {
  const ratchetGroup = new THREE.Group();

  // Translucent emerald body ring
  const ringGeo = new THREE.CylinderGeometry(0.29, 0.31, 0.065, 32);
  ringGeo.translate(0, 0.025, 0);
  const ringMesh = new THREE.Mesh(
    ringGeo,
    new THREE.MeshStandardMaterial({
      color: STAMINA_STYLE.ratchetPolycarbonate,
      roughness: 0.25,
      metalness: 0.3,
      transparent: true,
      opacity: 0.85,
    }),
  );
  ringMesh.userData.outlineThickness = 0.01;
  ratchetGroup.add(ringMesh);

  // 5-80 Rounded Bumper Teeth x5
  const toothShape = new THREE.Shape();
  toothShape.moveTo(0.28, -0.06);
  toothShape.quadraticCurveTo(0.37, 0, 0.36, 0.04);
  toothShape.lineTo(0.27, 0.05);
  toothShape.closePath();

  const toothGeom = extrudeStamina(toothShape, 0.055, 0.005, 0.005);
  toothGeom.translate(0, -0.002, 0);

  const toothGeometries: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i += 1) {
    toothGeometries.push(toothGeom.clone().rotateY((i * Math.PI * 2) / 5));
  }
  toothGeom.dispose();

  const teethMesh = new THREE.Mesh(
    mergeStaticGeometries(toothGeometries),
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.3,
      metalness: 0.6,
    }),
  );
  teethMesh.userData.outlineThickness = 0.01;
  ratchetGroup.add(teethMesh);

  return ratchetGroup;
}

// 3. BIT (ビット) - Ball Bit (spherical ball point contact for prolonged centrifugal balance)
export function buildBit(accentColor: number): THREE.Group {
  const bitGroup = new THREE.Group();

  // X-Dash gear ring (12 teeth)
  const gearGeometries: THREE.BufferGeometry[] = [];
  const gearTooth = new THREE.BoxGeometry(0.025, 0.06, 0.04);
  gearTooth.translate(0.165, -0.02, 0);
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

  // Translucent driver body
  const facetGeometry = new THREE.CylinderGeometry(
    0.13,
    0.06,
    0.17,
    8,
    2,
  ).toNonIndexed();
  facetGeometry.computeVertexNormals();
  facetGeometry.translate(0, -0.1, 0);
  const facets = new THREE.Mesh(
    facetGeometry,
    new THREE.MeshStandardMaterial({
      color: STAMINA_STYLE.driverGlass,
      transparent: true,
      opacity: 0.65,
      roughness: 0.15,
      metalness: 0.1,
      emissive: STAMINA_STYLE.driverGlassEmissive,
      emissiveIntensity: 0.4,
    }),
  );
  facets.userData.noOutline = true;
  facets.userData.noShadow = true;
  bitGroup.add(facets);

  // Inner spindle
  const spindle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.15, 8),
    new THREE.MeshStandardMaterial({
      color: STAMINA_STYLE.spindle,
      roughness: 0.3,
      metalness: 0.7,
    }),
  );
  spindle.position.y = -0.09;
  spindle.userData.noOutline = true;
  bitGroup.add(spindle);

  // Spherical Ball Tip Contact Point (low friction ground contact)
  const ballGeometry = new THREE.SphereGeometry(0.048, 16, 12);
  ballGeometry.translate(0, -0.21, 0);
  const ballMesh = new THREE.Mesh(
    ballGeometry,
    new THREE.MeshStandardMaterial({
      color: STAMINA_STYLE.contact,
      roughness: 0.1,
      metalness: 0.9,
    }),
  );
  ballMesh.userData.outlineThickness = 0.01;
  bitGroup.add(ballMesh);

  const collarGeometry = new THREE.TorusGeometry(0.15, 0.045, 8, 16);
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
  bitGroup.add(collar);

  return bitGroup;
}

// 4. CHIP (晶片 / 核心印記) - Center printed Storm Wing emblem chip & dome
export function buildChip(accentColor: number): THREE.Group {
  const chipGroup = new THREE.Group();
  chipGroup.position.y = 0.165;

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.175, 0.185, 0.13, 24),
    new THREE.MeshStandardMaterial({
      color: STAMINA_STYLE.chipBase,
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
      map: getChipEmblemTexture("stamina", accentColor),
      toneMapped: false,
    }),
  );
  art.position.y = 0.066;
  art.userData.noOutline = true;
  chipGroup.add(art);

  return chipGroup;
}

// 1b. BLADE - 黃金獵隼刃: three swept golden falcon wings around an aerodynamic ring.
export function buildGoldenFalconBlade(accentColor: number): THREE.Group {
  const group = new THREE.Group();
  group.position.y = 0.052;
  group.scale.y = 0.82;

  const chromeGeometries: THREE.BufferGeometry[] = [];
  const outerRing = new THREE.TorusGeometry(0.41, 0.03, 10, 48);
  outerRing.rotateX(Math.PI / 2);
  outerRing.translate(0, 0.06, 0);
  chromeGeometries.push(outerRing);
  const hub = new THREE.CylinderGeometry(0.19, 0.23, 0.075, 36);
  hub.translate(0, 0.045, 0);
  chromeGeometries.push(hub);

  const wingShape = new THREE.Shape();
  wingShape.moveTo(0.17, -0.055);
  wingShape.quadraticCurveTo(0.36, -0.11, 0.5, 0.015);
  wingShape.quadraticCurveTo(0.42, 0.16, 0.22, 0.085);
  wingShape.lineTo(0.13, 0.02);
  wingShape.closePath();
  for (let index = 0; index < 3; index += 1) {
    const wing = extrudeStamina(wingShape, 0.035, 0.007, 0.008);
    wing.rotateY((index * Math.PI * 2) / 3);
    wing.translate(0, 0.055, 0);
    chromeGeometries.push(wing);
  }
  const chromeBody = new THREE.Mesh(
    mergeStaticGeometries(chromeGeometries),
    new THREE.MeshStandardMaterial({
      color: STAMINA_STYLE.brightChrome,
      roughness: 0.12,
      metalness: 0.92,
      emissive: 0xcccccc,
      emissiveIntensity: 0.35,
    }),
  );
  chromeBody.userData.outlineThickness = 0.012;
  chromeBody.userData.smoothOutline = true;
  group.add(chromeBody);

  const featherGeometries: THREE.BufferGeometry[] = [];
  const featherShape = new THREE.Shape();
  featherShape.moveTo(0.22, -0.018);
  featherShape.quadraticCurveTo(0.36, -0.06, 0.44, 0.012);
  featherShape.quadraticCurveTo(0.34, 0.07, 0.24, 0.042);
  featherShape.closePath();
  for (let index = 0; index < 3; index += 1) {
    const feather = extrudeStamina(featherShape, 0.018, 0.003, 0.004);
    feather.rotateY((index * Math.PI * 2) / 3);
    feather.translate(0, 0.105, 0);
    featherGeometries.push(feather);
  }
  const feathers = new THREE.Mesh(
    mergeStaticGeometries(featherGeometries),
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.18,
      metalness: 0.78,
    }),
  );
  feathers.userData.outlineThickness = 0.008;
  group.add(feathers);

  return group;
}

// 2b. RATCHET - 日輪棘輪: a low continuous gold ring with six stabilizing vanes.
export function buildSolarRingRatchet(accentColor: number): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.31, 0.33, 0.055, 40),
    new THREE.MeshStandardMaterial({
      color: STAMINA_STYLE.ratchetPolycarbonate,
      roughness: 0.24,
      metalness: 0.38,
      transparent: true,
      opacity: 0.88,
    }),
  );
  body.position.y = 0.018;
  body.userData.outlineThickness = 0.009;
  group.add(body);

  const vaneGeometries: THREE.BufferGeometry[] = [];
  const vaneShape = new THREE.Shape();
  vaneShape.moveTo(0.27, -0.035);
  vaneShape.quadraticCurveTo(0.37, -0.02, 0.38, 0.025);
  vaneShape.lineTo(0.28, 0.045);
  vaneShape.closePath();
  const vane = extrudeStamina(vaneShape, 0.04, 0.004, 0.005);
  vane.translate(0, 0.008, 0);
  for (let index = 0; index < 6; index += 1) {
    vaneGeometries.push(vane.clone().rotateY((index * Math.PI) / 3));
  }
  vane.dispose();
  const vanes = new THREE.Mesh(
    mergeStaticGeometries(vaneGeometries),
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.2,
      metalness: 0.72,
    }),
  );
  vanes.userData.outlineThickness = 0.008;
  group.add(vanes);
  return group;
}

// 3b. BIT - 永恆針軸: a narrow needle contact protected by a broad endurance ring.
export function buildEternalNeedleBit(accentColor: number): THREE.Group {
  const group = new THREE.Group();
  const gearGeometries: THREE.BufferGeometry[] = [];
  const tooth = new THREE.BoxGeometry(0.024, 0.045, 0.035);
  tooth.translate(0.16, -0.015, 0);
  for (let index = 0; index < 12; index += 1) {
    gearGeometries.push(tooth.clone().rotateY((index * Math.PI) / 6));
  }
  tooth.dispose();
  const gear = new THREE.Mesh(
    mergeStaticGeometries(gearGeometries),
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.18,
      metalness: 0.78,
    }),
  );
  gear.userData.outlineThickness = 0.007;
  group.add(gear);

  const driverGeometry = new THREE.CylinderGeometry(0.12, 0.055, 0.16, 12);
  driverGeometry.translate(0, -0.095, 0);
  const driver = new THREE.Mesh(
    driverGeometry,
    new THREE.MeshStandardMaterial({
      color: STAMINA_STYLE.driverGlass,
      transparent: true,
      opacity: 0.68,
      roughness: 0.15,
      metalness: 0.12,
      emissive: STAMINA_STYLE.driverGlassEmissive,
      emissiveIntensity: 0.35,
    }),
  );
  driver.userData.noOutline = true;
  driver.userData.noShadow = true;
  group.add(driver);

  const needleGeometry = new THREE.CylinderGeometry(0.018, 0.006, 0.115, 10);
  needleGeometry.translate(0, -0.225, 0);
  const needle = new THREE.Mesh(
    needleGeometry,
    new THREE.MeshStandardMaterial({
      color: STAMINA_STYLE.contact,
      roughness: 0.12,
      metalness: 0.9,
    }),
  );
  needle.userData.outlineThickness = 0.009;
  group.add(needle);

  const airRingGeometry = new THREE.TorusGeometry(0.145, 0.025, 8, 28);
  airRingGeometry.rotateX(Math.PI / 2);
  const airRing = new THREE.Mesh(
    airRingGeometry,
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.12,
      metalness: 0.2,
      transparent: true,
      opacity: 0.75,
      emissive: accentColor,
      emissiveIntensity: 0.12,
    }),
  );
  airRing.position.y = -0.055;
  airRing.userData.noOutline = true;
  airRing.userData.noShadow = true;
  group.add(airRing);
  return group;
}

// 4b. CHIP - 獵隼核心: a golden winged bezel surrounding the falcon crest.
export function buildGoldenFalconChip(accentColor: number): THREE.Group {
  const group = new THREE.Group();
  group.position.y = 0.165;
  const baseGeometries: THREE.BufferGeometry[] = [
    new THREE.CylinderGeometry(0.18, 0.19, 0.13, 28),
  ];
  const wing = new THREE.BoxGeometry(0.11, 0.035, 0.045);
  wing.translate(0.18, 0.025, 0);
  for (let index = 0; index < 3; index += 1) {
    baseGeometries.push(wing.clone().rotateY((index * Math.PI * 2) / 3));
  }
  wing.dispose();
  const base = new THREE.Mesh(
    mergeStaticGeometries(baseGeometries),
    new THREE.MeshStandardMaterial({
      color: STAMINA_STYLE.chipBase,
      roughness: 0.16,
      metalness: 0.9,
    }),
  );
  base.userData.outlineThickness = 0.013;
  group.add(base);

  const rimGeometry = new THREE.TorusGeometry(0.165, 0.015, 6, 28);
  rimGeometry.rotateX(Math.PI / 2);
  const rim = new THREE.Mesh(
    rimGeometry,
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.18,
      metalness: 0.76,
    }),
  );
  rim.position.y = 0.067;
  rim.userData.noOutline = true;
  group.add(rim);

  const artGeometry = new THREE.CircleGeometry(0.148, 32);
  artGeometry.rotateX(-Math.PI / 2);
  const art = new THREE.Mesh(
    artGeometry,
    new THREE.MeshBasicMaterial({
      map: getChipEmblemTexture("stamina_sky_falcon_chip", accentColor),
      toneMapped: false,
    }),
  );
  art.position.y = 0.068;
  art.userData.noOutline = true;
  group.add(art);
  return group;
}

export const buildStaminaDetailed: DetailedBladeBuilder = (accentColor) => ({
  blade: buildBlade(accentColor),
  ratchet: buildRatchet(accentColor),
  bit: buildBit(accentColor),
  chip: buildChip(accentColor),
});
