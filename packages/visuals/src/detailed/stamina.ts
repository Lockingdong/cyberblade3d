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
  bladeGroup.position.y = 0.05;

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
  chipGroup.position.y = 0.155;

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

export const buildStaminaDetailed: DetailedBladeBuilder = (accentColor) => ({
  blade: buildBlade(accentColor),
  ratchet: buildRatchet(accentColor),
  bit: buildBit(accentColor),
  chip: buildChip(accentColor),
});
