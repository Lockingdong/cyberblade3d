import * as THREE from "three";
import { mergeStaticGeometries } from "../geometry-utils";
import { getChipEmblemTexture } from "./chip-art";
import type { DetailedBladeBuilder } from "./types";

// Beyblade X detailed attack top: 4 distinct components (Blade, Ratchet, Bit, Chip).
// Extrusion convention: shapes are authored in XY, extruded along +Z, then
// rotateX(-PI/2) maps shape (x, y) onto world (x, -z) with extrusion becoming height (+Y).

const ATTACK_STYLE = {
  chrome: 0xffffff,
  chipBase: 0x1a1c22,
  driverGlass: 0x2b6bff,
  driverGlassEmissive: 0x123a8c,
  spindle: 0x222233,
  contact: 0x33343c,
  ratchetPolycarbonate: 0x151c28,
};

function makeBladeShape(scale: number, withSlot: boolean): THREE.Shape {
  const s = scale;
  const blade = new THREE.Shape();
  blade.moveTo(0.18 * s, 0.1 * s);
  blade.quadraticCurveTo(0.42 * s, 0.16 * s, 0.52 * s, -0.02 * s);
  blade.quadraticCurveTo(0.4 * s, -0.06 * s, 0.3 * s, -0.16 * s);
  blade.quadraticCurveTo(0.26 * s, -0.02 * s, 0.18 * s, -0.08 * s);
  blade.closePath();
  if (withSlot) {
    const slot = new THREE.Path();
    slot.absellipse(0.32 * s, 0, 0.055 * s, 0.028 * s, 0, Math.PI * 2, true, 0.5);
    blade.holes.push(slot);
  }
  return blade;
}

function extrudeBlade(
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
    bevelSegments: 1,
    curveSegments: 7,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

// 1. BLADE (ブレード) - Upper metal attack ring layer
export function buildBlade(accentColor: number): THREE.Group {
  const bladeGroup = new THREE.Group();
  bladeGroup.position.y = 0.05;

  const chromeGeometries: THREE.BufferGeometry[] = [];

  const hubProfile = [
    new THREE.Vector2(0.1, -0.02),
    new THREE.Vector2(0.3, -0.02),
    new THREE.Vector2(0.345, 0.01),
    new THREE.Vector2(0.345, 0.04),
    new THREE.Vector2(0.28, 0.06),
    new THREE.Vector2(0.1, 0.06),
  ];
  chromeGeometries.push(new THREE.LatheGeometry(hubProfile, 40));

  const mainBlade = extrudeBlade(makeBladeShape(1, true), 0.05, 0.012, 0.01);
  mainBlade.translate(0, 0.055, 0);
  const upperBlade = extrudeBlade(makeBladeShape(0.72, false), 0.04, 0.012, 0.01);
  upperBlade.rotateY(0.35);
  upperBlade.translate(0, 0.105, 0);
  for (let index = 0; index < 3; index += 1) {
    const angle = (index * Math.PI * 2) / 3;
    chromeGeometries.push(mainBlade.clone().rotateY(angle));
    chromeGeometries.push(upperBlade.clone().rotateY(angle));
  }
  mainBlade.dispose();
  upperBlade.dispose();

  const chrome = new THREE.Mesh(
    mergeStaticGeometries(chromeGeometries),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xcccccc,
      emissiveIntensity: 0.5,
      roughness: 0.15,
      metalness: 0.0,
    }),
  );
  chrome.userData.outlineThickness = 0.012;
  chrome.userData.smoothOutline = true;
  bladeGroup.add(chrome);

  // Accent claws
  const clawShape = new THREE.Shape();
  clawShape.moveTo(0.2, 0.02);
  clawShape.quadraticCurveTo(0.36, 0.1, 0.47, 0.02);
  clawShape.quadraticCurveTo(0.38, 0.04, 0.3, -0.03);
  clawShape.quadraticCurveTo(0.24, -0.06, 0.2, -0.04);
  clawShape.closePath();
  const clawBase = extrudeBlade(clawShape, 0.03, 0.008, 0.006);
  clawBase.translate(0, 0.085, 0);
  const clawGeometries: THREE.BufferGeometry[] = [];
  for (let index = 0; index < 3; index += 1) {
    clawGeometries.push(
      clawBase.clone().rotateY(Math.PI / 3 + (index * Math.PI * 2) / 3),
    );
  }
  clawBase.dispose();
  const claws = new THREE.Mesh(
    mergeStaticGeometries(clawGeometries),
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.35,
      metalness: 0.6,
    }),
  );
  claws.userData.outlineThickness = 0.01;
  claws.userData.smoothOutline = true;
  bladeGroup.add(claws);

  // Emissive slivers
  const sliverBase = new THREE.BoxGeometry(0.14, 0.014, 0.028);
  sliverBase.rotateY(-0.34);
  sliverBase.translate(0.385, 0.112, -0.1);
  const sliverGeometries: THREE.BufferGeometry[] = [];
  for (let index = 0; index < 3; index += 1) {
    sliverGeometries.push(sliverBase.clone().rotateY((index * Math.PI * 2) / 3));
  }
  sliverBase.dispose();
  const slivers = new THREE.Mesh(
    mergeStaticGeometries(sliverGeometries),
    new THREE.MeshBasicMaterial({ color: accentColor, toneMapped: false }),
  );
  slivers.userData.noOutline = true;
  bladeGroup.add(slivers);

  return bladeGroup;
}

export function buildAttackV2Blade(accentColor: number): THREE.Group {
  const bladeGroup = new THREE.Group();
  bladeGroup.position.y = 0.05;

  const chromeGeometries: THREE.BufferGeometry[] = [];

  const hubProfile = [
    new THREE.Vector2(0.1, -0.02),
    new THREE.Vector2(0.3, -0.02),
    new THREE.Vector2(0.345, 0.01),
    new THREE.Vector2(0.345, 0.04),
    new THREE.Vector2(0.28, 0.06),
    new THREE.Vector2(0.1, 0.06),
  ];
  chromeGeometries.push(new THREE.LatheGeometry(hubProfile, 40));

  const mainBlade = extrudeBlade(makeBladeShape(1.05, true), 0.052, 0.012, 0.01);
  mainBlade.translate(0, 0.055, 0);
  const upperBlade = extrudeBlade(makeBladeShape(0.75, false), 0.042, 0.012, 0.01);
  upperBlade.rotateY(0.35);
  upperBlade.translate(0, 0.105, 0);
  for (let index = 0; index < 4; index += 1) {
    const angle = (index * Math.PI * 2) / 4;
    chromeGeometries.push(mainBlade.clone().rotateY(angle));
    chromeGeometries.push(upperBlade.clone().rotateY(angle));
  }
  mainBlade.dispose();
  upperBlade.dispose();

  const chrome = new THREE.Mesh(
    mergeStaticGeometries(chromeGeometries),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xcccccc,
      emissiveIntensity: 0.5,
      roughness: 0.15,
      metalness: 0.0,
    }),
  );
  chrome.userData.outlineThickness = 0.012;
  chrome.userData.smoothOutline = true;
  bladeGroup.add(chrome);

  // Accent claws - 4 blades & further extended
  const clawShape = new THREE.Shape();
  clawShape.moveTo(0.2, 0.02);
  clawShape.quadraticCurveTo(0.38, 0.12, 0.52, 0.03);
  clawShape.quadraticCurveTo(0.40, 0.05, 0.32, -0.03);
  clawShape.quadraticCurveTo(0.24, -0.06, 0.2, -0.04);
  clawShape.closePath();
  const clawBase = extrudeBlade(clawShape, 0.032, 0.008, 0.006);
  clawBase.translate(0, 0.085, 0);
  const clawGeometries: THREE.BufferGeometry[] = [];
  for (let index = 0; index < 4; index += 1) {
    clawGeometries.push(
      clawBase.clone().rotateY(Math.PI / 4 + (index * Math.PI * 2) / 4),
    );
  }
  clawBase.dispose();
  const claws = new THREE.Mesh(
    mergeStaticGeometries(clawGeometries),
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.35,
      metalness: 0.6,
    }),
  );
  claws.userData.outlineThickness = 0.01;
  claws.userData.smoothOutline = true;
  bladeGroup.add(claws);

  // Emissive slivers - 4 elements
  const sliverBase = new THREE.BoxGeometry(0.14, 0.014, 0.028);
  sliverBase.rotateY(-0.34);
  sliverBase.translate(0.42, 0.112, -0.1);
  const sliverGeometries: THREE.BufferGeometry[] = [];
  for (let index = 0; index < 4; index += 1) {
    sliverGeometries.push(sliverBase.clone().rotateY((index * Math.PI * 2) / 4));
  }
  sliverBase.dispose();
  const slivers = new THREE.Mesh(
    mergeStaticGeometries(sliverGeometries),
    new THREE.MeshBasicMaterial({ color: accentColor, toneMapped: false }),
  );
  slivers.userData.noOutline = true;
  bladeGroup.add(slivers);

  return bladeGroup;
}

// 2. RATCHET (ラチェット) - Middle height & locking teeth layer (3-60 Ratchet)
export function buildRatchet(accentColor: number): THREE.Group {
  const ratchetGroup = new THREE.Group();

  // Translucent polycarbonate body ring
  const ringGeo = new THREE.CylinderGeometry(0.28, 0.3, 0.05, 32);
  ringGeo.translate(0, 0.02, 0);
  const ringMesh = new THREE.Mesh(
    ringGeo,
    new THREE.MeshStandardMaterial({
      color: ATTACK_STYLE.ratchetPolycarbonate,
      roughness: 0.3,
      metalness: 0.4,
      transparent: true,
      opacity: 0.85,
    }),
  );
  ringMesh.userData.outlineThickness = 0.01;
  ratchetGroup.add(ringMesh);

  // 3-60 Ratchet protruding bumper teeth x3
  const toothShape = new THREE.Shape();
  toothShape.moveTo(0.28, -0.05);
  toothShape.lineTo(0.38, -0.01);
  toothShape.lineTo(0.35, 0.05);
  toothShape.lineTo(0.27, 0.04);
  toothShape.closePath();

  const toothGeom = extrudeBlade(toothShape, 0.045, 0.005, 0.005);
  toothGeom.translate(0, -0.002, 0);

  const toothGeometries: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i += 1) {
    toothGeometries.push(toothGeom.clone().rotateY((i * Math.PI * 2) / 3));
  }
  toothGeom.dispose();

  const teethMesh = new THREE.Mesh(
    mergeStaticGeometries(toothGeometries),
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.25,
      metalness: 0.7,
    }),
  );
  teethMesh.userData.outlineThickness = 0.01;
  ratchetGroup.add(teethMesh);

  return ratchetGroup;
}

// 3. BIT (ビット) - Bottom shaft, X-Dash gear ring & driver tip
export function buildBit(accentColor: number): THREE.Group {
  const bitGroup = new THREE.Group();

  // X-Dash gear teeth ring (12 gears around shaft base)
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
    0.055,
    0.17,
    8,
    2,
  ).toNonIndexed();
  facetGeometry.computeVertexNormals();
  facetGeometry.translate(0, -0.1, 0);
  const facets = new THREE.Mesh(
    facetGeometry,
    new THREE.MeshStandardMaterial({
      color: ATTACK_STYLE.driverGlass,
      transparent: true,
      opacity: 0.62,
      roughness: 0.15,
      metalness: 0.1,
      emissive: ATTACK_STYLE.driverGlassEmissive,
      emissiveIntensity: 0.4,
    }),
  );
  facets.userData.noOutline = true;
  facets.userData.noShadow = true;
  bitGroup.add(facets);

  // Opaque inner spindle
  const spindle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.15, 8),
    new THREE.MeshStandardMaterial({
      color: ATTACK_STYLE.spindle,
      roughness: 0.3,
      metalness: 0.7,
    }),
  );
  spindle.position.y = -0.09;
  spindle.userData.noOutline = true;
  bitGroup.add(spindle);

  // Ground contact tip cone
  const contactGeometry = new THREE.ConeGeometry(0.045, 0.06, 10);
  contactGeometry.rotateX(Math.PI);
  contactGeometry.translate(0, -0.215, 0);
  const contact = new THREE.Mesh(
    contactGeometry,
    new THREE.MeshStandardMaterial({
      color: ATTACK_STYLE.contact,
      roughness: 0.2,
      metalness: 0.9,
    }),
  );
  contact.userData.outlineThickness = 0.012;
  bitGroup.add(contact);

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

// 4. CHIP (晶片 / 核心印記) - Center printed emblem chip & dome
export function buildChip(accentColor: number): THREE.Group {
  const chipGroup = new THREE.Group();
  chipGroup.position.y = 0.155;

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.175, 0.185, 0.13, 24),
    new THREE.MeshStandardMaterial({
      color: ATTACK_STYLE.chipBase,
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
      map: getChipEmblemTexture("attack", accentColor),
      toneMapped: false,
    }),
  );
  art.position.y = 0.066;
  art.userData.noOutline = true;
  chipGroup.add(art);

  return chipGroup;
}

export const buildAttackDetailed: DetailedBladeBuilder = (accentColor) => ({
  blade: buildBlade(accentColor),
  ratchet: buildRatchet(accentColor),
  bit: buildBit(accentColor),
  chip: buildChip(accentColor),
});
