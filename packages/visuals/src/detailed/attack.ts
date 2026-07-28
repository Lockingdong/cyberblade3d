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

const IGNIS_STYLE = {
  chipBase: 0x1a1c22,
  driverGlass: 0xff2200,
  driverGlassEmissive: 0x8c0800,
  spindle: 0x222233,
  contact: 0x33343c,
  ratchetPolycarbonate: 0x2a080c,
};

const AEGIS_STYLE = {
  chipBase: 0x231a0e,
  driverGlass: 0xd98c1f,
  driverGlassEmissive: 0x5c3a0a,
  spindle: 0x2b2119,
  contact: 0x3a2c18,
  ratchetPolycarbonate: 0x2a1a08,
};

function makeOriginalBladeShape(scale: number, withSlot: boolean): THREE.Shape {
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

function makeIgnisBladeShape(scale: number, withSlot: boolean): THREE.Shape {
  const s = scale;
  const blade = new THREE.Shape();
  // 4-blade symmetrical heavy cross impact profile
  blade.moveTo(0.18 * s, 0.08 * s);
  blade.quadraticCurveTo(0.36 * s, 0.16 * s, 0.52 * s, 0.02 * s);
  blade.lineTo(0.44 * s, -0.04 * s);
  blade.quadraticCurveTo(0.32 * s, -0.06 * s, 0.18 * s, -0.12 * s);
  blade.closePath();
  if (withSlot) {
    const slot = new THREE.Path();
    slot.absellipse(0.32 * s, 0.01 * s, 0.05 * s, 0.022 * s, 0, Math.PI * 2, true, 0.5);
    blade.holes.push(slot);
  }
  return blade;
}

function makeAegisBladeShape(scale: number, withSlot: boolean): THREE.Shape {
  const s = scale;
  const blade = new THREE.Shape();
  // Blunt, flat-edged shield-blade: an armored leading face instead of a slashing point.
  blade.moveTo(0.16 * s, 0.14 * s);
  blade.lineTo(0.42 * s, 0.13 * s);
  blade.quadraticCurveTo(0.5 * s, 0.05 * s, 0.46 * s, -0.06 * s);
  blade.lineTo(0.34 * s, -0.14 * s);
  blade.quadraticCurveTo(0.24 * s, -0.1 * s, 0.16 * s, -0.1 * s);
  blade.closePath();
  if (withSlot) {
    const slot = new THREE.Path();
    slot.absellipse(0.3 * s, 0, 0.06 * s, 0.03 * s, 0, Math.PI * 2, true, 0.5);
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

// 1. BLADE (ブレード) - 赤紅斬刃 (attack_slash)
export function buildBlade(accentColor: number): THREE.Group {
  const bladeGroup = new THREE.Group();
  bladeGroup.position.y = 0.052;
  bladeGroup.scale.y = 0.85;

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

  const mainBlade = extrudeBlade(makeOriginalBladeShape(1, true), 0.05, 0.012, 0.01);
  mainBlade.translate(0, 0.055, 0);
  const upperBlade = extrudeBlade(makeOriginalBladeShape(0.72, false), 0.04, 0.012, 0.01);
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

// 1b. BLADE (ブレード) - 烈焰暴龍刃 (attack_ignis)
export function buildIgnisBlade(accentColor: number): THREE.Group {
  const bladeGroup = new THREE.Group();
  bladeGroup.position.y = 0.052;
  bladeGroup.scale.y = 0.88;

  const chromeGeometries: THREE.BufferGeometry[] = [];

  const hubProfile = [
    new THREE.Vector2(0.1, -0.02),
    new THREE.Vector2(0.31, -0.02),
    new THREE.Vector2(0.355, 0.01),
    new THREE.Vector2(0.355, 0.045),
    new THREE.Vector2(0.29, 0.065),
    new THREE.Vector2(0.1, 0.065),
  ];
  chromeGeometries.push(new THREE.LatheGeometry(hubProfile, 40));

  const mainBlade = extrudeBlade(makeIgnisBladeShape(1.02, true), 0.055, 0.014, 0.012);
  mainBlade.translate(0, 0.055, 0);
  const upperBlade = extrudeBlade(makeIgnisBladeShape(0.74, false), 0.045, 0.012, 0.01);
  upperBlade.rotateY(0.32);
  upperBlade.translate(0, 0.11, 0);

  // 4-blade cross structure (4 blades at 90 degrees)
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

  // 4 Accent heavy claws
  const clawShape = new THREE.Shape();
  clawShape.moveTo(0.18, 0.03);
  clawShape.quadraticCurveTo(0.38, 0.15, 0.52, 0.04);
  clawShape.lineTo(0.44, 0.01);
  clawShape.quadraticCurveTo(0.36, 0.04, 0.28, -0.04);
  clawShape.quadraticCurveTo(0.22, -0.06, 0.18, -0.03);
  clawShape.closePath();
  const clawBase = extrudeBlade(clawShape, 0.035, 0.008, 0.006);
  clawBase.translate(0, 0.088, 0);
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
      roughness: 0.25,
      metalness: 0.7,
    }),
  );
  claws.userData.outlineThickness = 0.01;
  claws.userData.smoothOutline = true;
  bladeGroup.add(claws);

  // 4 Emissive energy lines (Matching Crimson Red)
  const sliverBase = new THREE.BoxGeometry(0.16, 0.016, 0.03);
  sliverBase.rotateY(-0.35);
  sliverBase.translate(0.4, 0.115, -0.1);
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

// 1c. BLADE (ブレード) - 熔壁犀刃 (attack_aegis) - Counter-hold defensive attacker
export function buildAegisBlade(accentColor: number): THREE.Group {
  const bladeGroup = new THREE.Group();
  bladeGroup.position.y = 0.052;
  bladeGroup.scale.y = 0.92;

  const chromeGeometries: THREE.BufferGeometry[] = [];

  const hubProfile = [
    new THREE.Vector2(0.11, -0.02),
    new THREE.Vector2(0.32, -0.02),
    new THREE.Vector2(0.37, 0.015),
    new THREE.Vector2(0.37, 0.05),
    new THREE.Vector2(0.3, 0.075),
    new THREE.Vector2(0.11, 0.075),
  ];
  chromeGeometries.push(new THREE.LatheGeometry(hubProfile, 40));

  const mainBlade = extrudeBlade(makeAegisBladeShape(1, true), 0.065, 0.016, 0.014);
  mainBlade.translate(0, 0.055, 0);
  const upperBlade = extrudeBlade(makeAegisBladeShape(0.7, false), 0.05, 0.013, 0.011);
  upperBlade.rotateY(0.3);
  upperBlade.translate(0, 0.115, 0);

  // 3-fold symmetric shield-blade structure (wide, blunt-edged plates)
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
      roughness: 0.2,
      metalness: 0.05,
    }),
  );
  chrome.userData.outlineThickness = 0.014;
  chrome.userData.smoothOutline = true;
  bladeGroup.add(chrome);

  // 3 riveted armor plates bolted over the shield faces (defensive bulk)
  const plateShape = new THREE.Shape();
  plateShape.moveTo(-0.09, -0.09);
  plateShape.lineTo(0.09, -0.09);
  plateShape.lineTo(0.11, 0.06);
  plateShape.lineTo(0, 0.11);
  plateShape.lineTo(-0.11, 0.06);
  plateShape.closePath();
  const plateBase = extrudeBlade(plateShape, 0.028, 0.008, 0.007);
  plateBase.translate(0.33, 0.09, 0);
  const plateGeometries: THREE.BufferGeometry[] = [];
  for (let index = 0; index < 3; index += 1) {
    plateGeometries.push(plateBase.clone().rotateY((index * Math.PI * 2) / 3));
  }
  plateBase.dispose();
  const plates = new THREE.Mesh(
    mergeStaticGeometries(plateGeometries),
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.3,
      metalness: 0.65,
    }),
  );
  plates.userData.outlineThickness = 0.012;
  plates.userData.smoothOutline = true;
  bladeGroup.add(plates);

  // 3 emissive edge highlights (matching accent)
  const sliverBase = new THREE.BoxGeometry(0.15, 0.015, 0.03);
  sliverBase.rotateY(-0.3);
  sliverBase.translate(0.4, 0.12, -0.08);
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
  return buildBlade(accentColor);
}

// 2. RATCHET (ラチェット) - 赤紅棘輪 (attack_standard)
export function buildRatchet(accentColor: number): THREE.Group {
  const ratchetGroup = new THREE.Group();

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

// 2b. RATCHET (ラチェット) - 龍骨棘輪 (attack_drake_ratchet) - 4-tooth dragon spine ratchet
export function buildDrakeRatchet(accentColor: number): THREE.Group {
  const ratchetGroup = new THREE.Group();

  const ringGeo = new THREE.CylinderGeometry(0.29, 0.31, 0.052, 32);
  ringGeo.translate(0, 0.02, 0);
  const ringMesh = new THREE.Mesh(
    ringGeo,
    new THREE.MeshStandardMaterial({
      color: ATTACK_STYLE.ratchetPolycarbonate,
      roughness: 0.25,
      metalness: 0.5,
      transparent: true,
      opacity: 0.88,
    }),
  );
  ringMesh.userData.outlineThickness = 0.01;
  ratchetGroup.add(ringMesh);

  // 4 serrated dragon spine teeth (4-tooth layout matching 4-blade Ignis Blade)
  const toothShape = new THREE.Shape();
  toothShape.moveTo(0.28, -0.06);
  toothShape.lineTo(0.34, -0.02);
  toothShape.lineTo(0.32, 0.01);
  toothShape.lineTo(0.39, 0.03);
  toothShape.lineTo(0.33, 0.06);
  toothShape.lineTo(0.27, 0.04);
  toothShape.closePath();

  const toothGeom = extrudeBlade(toothShape, 0.048, 0.005, 0.005);
  toothGeom.translate(0, -0.002, 0);

  const toothGeometries: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i += 1) {
    toothGeometries.push(toothGeom.clone().rotateY((i * Math.PI * 2) / 4));
  }
  toothGeom.dispose();

  const teethMesh = new THREE.Mesh(
    mergeStaticGeometries(toothGeometries),
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.2,
      metalness: 0.8,
    }),
  );
  teethMesh.userData.outlineThickness = 0.01;
  ratchetGroup.add(teethMesh);

  return ratchetGroup;
}

// 2c. RATCHET (ラチェット) - 磐岩棘輪 (attack_bastion_ratchet) - 3-tooth wide bumper ratchet
export function buildBastionRatchet(accentColor: number): THREE.Group {
  const ratchetGroup = new THREE.Group();

  const ringGeo = new THREE.CylinderGeometry(0.3, 0.32, 0.055, 32);
  ringGeo.translate(0, 0.022, 0);
  const ringMesh = new THREE.Mesh(
    ringGeo,
    new THREE.MeshStandardMaterial({
      color: AEGIS_STYLE.ratchetPolycarbonate,
      roughness: 0.28,
      metalness: 0.45,
      transparent: true,
      opacity: 0.88,
    }),
  );
  ringMesh.userData.outlineThickness = 0.01;
  ratchetGroup.add(ringMesh);

  // 3 wide flat bumper teeth (defensive bulk, matched to the 3-fold Aegis Blade)
  const toothShape = new THREE.Shape();
  toothShape.moveTo(0.28, -0.09);
  toothShape.lineTo(0.4, -0.05);
  toothShape.lineTo(0.4, 0.05);
  toothShape.lineTo(0.28, 0.09);
  toothShape.closePath();

  const toothGeom = extrudeBlade(toothShape, 0.05, 0.007, 0.007);
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
      roughness: 0.32,
      metalness: 0.68,
    }),
  );
  teethMesh.userData.outlineThickness = 0.01;
  ratchetGroup.add(teethMesh);

  return ratchetGroup;
}

// 3. BIT (ビット) - 赤紅平軸 (attack_flat)
export function buildBit(accentColor: number): THREE.Group {
  const bitGroup = new THREE.Group();

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

// 3b. BIT (ビット) - 狂暴衝壓軸 (attack_impact_bit) - Heavy 16-gear multi-ring & wide flat tip
export function buildImpactBit(accentColor: number): THREE.Group {
  const bitGroup = new THREE.Group();

  // 16 wide protruding gear teeth around X-Dash gear ring base
  const gearGeometries: THREE.BufferGeometry[] = [];
  const gearTooth = new THREE.BoxGeometry(0.03, 0.07, 0.05);
  gearTooth.translate(0.185, -0.02, 0);
  for (let i = 0; i < 16; i += 1) {
    gearGeometries.push(gearTooth.clone().rotateY((i * Math.PI * 2) / 16));
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
  gearMesh.userData.outlineThickness = 0.01;
  bitGroup.add(gearMesh);

  const facetGeometry = new THREE.CylinderGeometry(
    0.15,
    0.08,
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
      opacity: 0.75,
      roughness: 0.15,
      metalness: 0.2,
      emissive: ATTACK_STYLE.driverGlassEmissive,
      emissiveIntensity: 0.5,
    }),
  );
  facets.userData.noOutline = true;
  facets.userData.noShadow = true;
  bitGroup.add(facets);

  // Heavy middle metallic armor ring
  const armorRingGeo = new THREE.TorusGeometry(0.145, 0.028, 8, 16);
  armorRingGeo.rotateX(Math.PI / 2);
  const armorRing = new THREE.Mesh(
    armorRingGeo,
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.2,
      metalness: 0.8,
    }),
  );
  armorRing.position.y = -0.1;
  armorRing.userData.outlineThickness = 0.008;
  bitGroup.add(armorRing);

  const spindle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.15, 8),
    new THREE.MeshStandardMaterial({
      color: ATTACK_STYLE.spindle,
      roughness: 0.3,
      metalness: 0.7,
    }),
  );
  spindle.position.y = -0.09;
  spindle.userData.noOutline = true;
  bitGroup.add(spindle);

  // Wide flat heavy impact tip
  const contactGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.05, 16);
  contactGeometry.translate(0, -0.21, 0);
  const contact = new THREE.Mesh(
    contactGeometry,
    new THREE.MeshStandardMaterial({
      color: ATTACK_STYLE.contact,
      roughness: 0.15,
      metalness: 0.9,
    }),
  );
  contact.userData.outlineThickness = 0.014;
  bitGroup.add(contact);

  const collarGeometry = new THREE.TorusGeometry(0.17, 0.052, 8, 16);
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

// 3c. BIT (ビット) - 重甲穩軸 (attack_guard_bit) - Wide, low, grounded stance for stability
export function buildGuardBit(accentColor: number): THREE.Group {
  const bitGroup = new THREE.Group();

  // 10 broad flat gear teeth - stubbier and lower-count than Impact Bit's 16
  const gearGeometries: THREE.BufferGeometry[] = [];
  const gearTooth = new THREE.BoxGeometry(0.032, 0.055, 0.055);
  gearTooth.translate(0.175, -0.02, 0);
  for (let i = 0; i < 10; i += 1) {
    gearGeometries.push(gearTooth.clone().rotateY((i * Math.PI * 2) / 10));
  }
  gearTooth.dispose();

  const gearMesh = new THREE.Mesh(
    mergeStaticGeometries(gearGeometries),
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.25,
      metalness: 0.75,
    }),
  );
  gearMesh.userData.outlineThickness = 0.01;
  bitGroup.add(gearMesh);

  const facetGeometry = new THREE.CylinderGeometry(
    0.14,
    0.09,
    0.15,
    8,
    2,
  ).toNonIndexed();
  facetGeometry.computeVertexNormals();
  facetGeometry.translate(0, -0.09, 0);
  const facets = new THREE.Mesh(
    facetGeometry,
    new THREE.MeshStandardMaterial({
      color: AEGIS_STYLE.driverGlass,
      transparent: true,
      opacity: 0.7,
      roughness: 0.2,
      metalness: 0.15,
      emissive: AEGIS_STYLE.driverGlassEmissive,
      emissiveIntensity: 0.45,
    }),
  );
  facets.userData.noOutline = true;
  facets.userData.noShadow = true;
  bitGroup.add(facets);

  // Heavy middle armor ring for a grounded, stable base
  const armorRingGeo = new THREE.TorusGeometry(0.155, 0.03, 8, 16);
  armorRingGeo.rotateX(Math.PI / 2);
  const armorRing = new THREE.Mesh(
    armorRingGeo,
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.22,
      metalness: 0.78,
    }),
  );
  armorRing.position.y = -0.09;
  armorRing.userData.outlineThickness = 0.009;
  bitGroup.add(armorRing);

  const spindle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.038, 0.13, 8),
    new THREE.MeshStandardMaterial({
      color: AEGIS_STYLE.spindle,
      roughness: 0.3,
      metalness: 0.7,
    }),
  );
  spindle.position.y = -0.08;
  spindle.userData.noOutline = true;
  bitGroup.add(spindle);

  // Wide, low, flat contact tip - broader and lower than Impact Bit's for a stable stance
  const contactGeometry = new THREE.CylinderGeometry(0.09, 0.095, 0.04, 16);
  contactGeometry.translate(0, -0.185, 0);
  const contact = new THREE.Mesh(
    contactGeometry,
    new THREE.MeshStandardMaterial({
      color: AEGIS_STYLE.contact,
      roughness: 0.18,
      metalness: 0.88,
    }),
  );
  contact.userData.outlineThickness = 0.014;
  bitGroup.add(contact);

  const collarGeometry = new THREE.TorusGeometry(0.175, 0.05, 8, 16);
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

// 4. CHIP (晶片 / 核心印記) - 赤紅核心 (attack_core)
export function buildChip(accentColor: number): THREE.Group {
  const chipGroup = new THREE.Group();
  chipGroup.position.y = 0.165;

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

// 4b. CHIP (晶片 / 核心印記) - 龍焰核心 (attack_drake_chip) - Heavy Crown Bezel with Corner Teeth
export function buildDrakeChip(accentColor: number): THREE.Group {
  const chipGroup = new THREE.Group();
  chipGroup.position.y = 0.165;

  // Heavy metal base
  const baseGeometries: THREE.BufferGeometry[] = [];
  baseGeometries.push(new THREE.CylinderGeometry(0.175, 0.19, 0.13, 8));

  // 4 corner armor studs around crown base
  const cornerStud = new THREE.BoxGeometry(0.045, 0.07, 0.045);
  cornerStud.translate(0.18, 0.02, 0);
  for (let i = 0; i < 4; i += 1) {
    baseGeometries.push(cornerStud.clone().rotateY((i * Math.PI * 2) / 4));
  }
  cornerStud.dispose();

  const base = new THREE.Mesh(
    mergeStaticGeometries(baseGeometries),
    new THREE.MeshStandardMaterial({
      color: ATTACK_STYLE.chipBase,
      roughness: 0.4,
      metalness: 0.8,
    }),
  );
  base.userData.outlineThickness = 0.014;
  chipGroup.add(base);

  // Heavy octagonal outer rim torus
  const rimGeometry = new THREE.TorusGeometry(0.17, 0.018, 6, 8);
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
      map: getChipEmblemTexture("attack_drake_chip", accentColor),
      toneMapped: false,
    }),
  );
  art.position.y = 0.066;
  art.userData.noOutline = true;
  chipGroup.add(art);

  return chipGroup;
}

// 4c. CHIP (晶片 / 核心印記) - 磐岩核心 (attack_bastion_chip) - Riveted Shield Boss
export function buildBastionChip(accentColor: number): THREE.Group {
  const chipGroup = new THREE.Group();
  chipGroup.position.y = 0.165;

  const baseGeometries: THREE.BufferGeometry[] = [];
  baseGeometries.push(new THREE.CylinderGeometry(0.175, 0.195, 0.14, 20));

  // 6 rivet studs ringing the shield-boss base
  const rivetStud = new THREE.CylinderGeometry(0.018, 0.018, 0.03, 8);
  rivetStud.translate(0.165, 0.02, 0);
  for (let i = 0; i < 6; i += 1) {
    baseGeometries.push(rivetStud.clone().rotateY((i * Math.PI * 2) / 6));
  }
  rivetStud.dispose();

  const base = new THREE.Mesh(
    mergeStaticGeometries(baseGeometries),
    new THREE.MeshStandardMaterial({
      color: AEGIS_STYLE.chipBase,
      roughness: 0.4,
      metalness: 0.8,
    }),
  );
  base.userData.outlineThickness = 0.014;
  chipGroup.add(base);

  const rimGeometry = new THREE.TorusGeometry(0.165, 0.014, 6, 20);
  rimGeometry.rotateX(Math.PI / 2);
  const rim = new THREE.Mesh(
    rimGeometry,
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.3,
      metalness: 0.7,
    }),
  );
  rim.position.y = 0.071;
  rim.userData.noOutline = true;
  chipGroup.add(rim);

  const artGeometry = new THREE.CircleGeometry(0.15, 32);
  artGeometry.rotateX(-Math.PI / 2);
  const art = new THREE.Mesh(
    artGeometry,
    new THREE.MeshBasicMaterial({
      map: getChipEmblemTexture("attack_bastion_chip", accentColor),
      toneMapped: false,
    }),
  );
  art.position.y = 0.071;
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
