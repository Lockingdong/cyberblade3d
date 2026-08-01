import * as THREE from "three";
import { mergeStaticGeometries } from "../geometry-utils";
import { getChipEmblemTexture } from "./chip-art";
import type { DetailedBladeBuilder } from "./types";

// Beyblade X detailed defense top (Aegis Shield): 4 distinct components (Blade, Ratchet, Bit, Chip).
// Features a heavy 6-sided fortress shield ring with deflective armor plates, a 4-60 defense ratchet, a needle tip bit, and a shield crest chip.

const DEFENSE_STYLE = {
  steel: 0x343b46,
  darkSteel: 0x4a525d,
  chipBase: 0x181c24,
  driverGlass: 0x1e40af,
  driverGlassEmissive: 0x0f172a,
  spindle: 0x334155,
  contact: 0x475569,
  ratchetPolycarbonate: 0x0f172a,
};

function extrudeDefense(
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

// 1. BLADE (ブレード) - Radially symmetric eight-segment fortress shield
export function buildBlade(accentColor: number): THREE.Group {
  const bladeGroup = new THREE.Group();
  bladeGroup.position.y = 0.052;
  bladeGroup.scale.y = 0.85;

  const steelGeometries: THREE.BufferGeometry[] = [];

  // Dual-tier inner hub disc
  const hubProfile = [
    new THREE.Vector2(0.1, -0.02),
    new THREE.Vector2(0.3, -0.02),
    new THREE.Vector2(0.34, 0.01),
    new THREE.Vector2(0.34, 0.04),
    new THREE.Vector2(0.28, 0.07),
    new THREE.Vector2(0.1, 0.07),
  ];
  steelGeometries.push(new THREE.LatheGeometry(hubProfile, 40));

  // A continuous inner ring makes the silhouette read as one balanced part.
  const innerRingGeo = new THREE.CylinderGeometry(0.33, 0.37, 0.05, 48, 1, true);
  innerRingGeo.translate(0, 0.04, 0);
  steelGeometries.push(innerRingGeo);

  // Eight identical plates. The profile is mirrored around its radial axis,
  // so every rotation has the same leading and trailing edge.
  const shieldShape = new THREE.Shape();
  shieldShape.moveTo(-0.19, -0.08);
  shieldShape.quadraticCurveTo(-0.12, -0.13, 0, -0.14);
  shieldShape.quadraticCurveTo(0.12, -0.13, 0.19, -0.08);
  shieldShape.lineTo(0.16, 0.08);
  shieldShape.quadraticCurveTo(0.1, 0.14, 0, 0.16);
  shieldShape.quadraticCurveTo(-0.1, 0.14, -0.16, 0.08);
  shieldShape.closePath();

  for (let i = 0; i < 8; i += 1) {
    const angle = (i * Math.PI * 2) / 8;
    const shieldGeom = extrudeDefense(shieldShape, 0.065, 0.014, 0.012);
    shieldGeom.rotateY(angle);
    shieldGeom.translate(Math.cos(angle) * 0.34, 0.04, Math.sin(angle) * 0.34);
    steelGeometries.push(shieldGeom);
  }

  // Matching raised ribs on every plate emphasize the bilateral symmetry of
  // each segment and give the top a readable defensive, armored profile.
  const ribShape = new THREE.Shape();
  ribShape.moveTo(-0.025, -0.08);
  ribShape.lineTo(0.025, -0.08);
  ribShape.lineTo(0.04, 0.1);
  ribShape.lineTo(0, 0.13);
  ribShape.lineTo(-0.04, 0.1);
  ribShape.closePath();
  const ribBase = extrudeDefense(ribShape, 0.022, 0.006, 0.005);
  ribBase.translate(0, 0.105, 0);
  for (let i = 0; i < 8; i += 1) {
    const angle = (i * Math.PI * 2) / 8;
    const rib = ribBase.clone();
    rib.rotateY(angle);
    rib.translate(Math.cos(angle) * 0.34, 0.01, Math.sin(angle) * 0.34);
    steelGeometries.push(rib);
  }
  ribBase.dispose();

  const steelMesh = new THREE.Mesh(
    mergeStaticGeometries(steelGeometries),
    new THREE.MeshStandardMaterial({
      color: DEFENSE_STYLE.steel,
      roughness: 0.08,
      metalness: 0.88,
      emissive: 0xcccccc,
      emissiveIntensity: 0.5,
    }),
  );
  steelMesh.userData.outlineThickness = 0.014;
  steelMesh.userData.smoothOutline = true;
  bladeGroup.add(steelMesh);

  // Eight identical accent locks sit at the same radial position.
  const clipShape = new THREE.Shape();
  clipShape.moveTo(0, -0.045);
  clipShape.lineTo(0.055, 0);
  clipShape.lineTo(0, 0.045);
  clipShape.lineTo(-0.055, 0);
  clipShape.closePath();

  const clipBase = extrudeDefense(clipShape, 0.035, 0.008, 0.006);
  clipBase.translate(0, 0.085, 0);

  const clipGeometries: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 8; i += 1) {
    const angle = (i * Math.PI * 2) / 8;
    const clipGeom = clipBase.clone();
    clipGeom.rotateY(angle);
    clipGeom.translate(Math.cos(angle) * 0.42, 0.01, Math.sin(angle) * 0.42);
    clipGeometries.push(clipGeom);
  }
  clipBase.dispose();

  const clipsMesh = new THREE.Mesh(
    mergeStaticGeometries(clipGeometries),
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.25,
      metalness: 0.8,
    }),
  );
  clipsMesh.userData.outlineThickness = 0.01;
  bladeGroup.add(clipsMesh);

  // Eight evenly spaced glow vents mark the gaps between the plates.
  const ventBase = new THREE.BoxGeometry(0.075, 0.018, 0.035);
  const ventGeometries: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 8; i += 1) {
    const angle = (i * Math.PI * 2) / 8 + Math.PI / 8;
    const ventGeom = ventBase.clone();
    ventGeom.rotateY(angle);
    ventGeom.translate(Math.cos(angle) * 0.36, 0.085, Math.sin(angle) * 0.36);
    ventGeometries.push(ventGeom);
  }
  ventBase.dispose();

  const vents = new THREE.Mesh(
    mergeStaticGeometries(ventGeometries),
    new THREE.MeshBasicMaterial({ color: accentColor, toneMapped: false }),
  );
  vents.userData.noOutline = true;
  bladeGroup.add(vents);

  return bladeGroup;
}

// 2. RATCHET (ラチェット) - 4-60 Heavy Defense Ratchet (4 wide defensive bumper teeth)
export function buildRatchet(accentColor: number): THREE.Group {
  const ratchetGroup = new THREE.Group();

  // Polycarbonate body ring
  const ringGeo = new THREE.CylinderGeometry(0.3, 0.32, 0.05, 32);
  ringGeo.translate(0, 0.02, 0);
  const ringMesh = new THREE.Mesh(
    ringGeo,
    new THREE.MeshStandardMaterial({
      color: DEFENSE_STYLE.ratchetPolycarbonate,
      roughness: 0.25,
      metalness: 0.4,
      transparent: true,
      opacity: 0.88,
    }),
  );
  ringMesh.userData.outlineThickness = 0.01;
  ratchetGroup.add(ringMesh);

  // 4-60 Defense Bumper Teeth x4
  const toothShape = new THREE.Shape();
  toothShape.moveTo(0.28, -0.08);
  toothShape.lineTo(0.39, -0.04);
  toothShape.lineTo(0.39, 0.04);
  toothShape.lineTo(0.28, 0.08);
  toothShape.closePath();

  const toothGeom = extrudeDefense(toothShape, 0.048, 0.006, 0.006);
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
      roughness: 0.3,
      metalness: 0.7,
    }),
  );
  teethMesh.userData.outlineThickness = 0.01;
  ratchetGroup.add(teethMesh);

  return ratchetGroup;
}

// 3. BIT (ビット) - Precision Needle Bit (conical tip for low friction & maximum stability)
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
    0.04,
    0.17,
    8,
    2,
  ).toNonIndexed();
  facetGeometry.computeVertexNormals();
  facetGeometry.translate(0, -0.1, 0);
  const facets = new THREE.Mesh(
    facetGeometry,
    new THREE.MeshStandardMaterial({
      color: DEFENSE_STYLE.driverGlass,
      transparent: true,
      opacity: 0.65,
      roughness: 0.15,
      metalness: 0.1,
      emissive: DEFENSE_STYLE.driverGlassEmissive,
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
      color: DEFENSE_STYLE.spindle,
      roughness: 0.3,
      metalness: 0.7,
    }),
  );
  spindle.position.y = -0.09;
  spindle.userData.noOutline = true;
  bitGroup.add(spindle);

  // Precision Needle Tip (sharp cone contact point)
  const contactGeometry = new THREE.ConeGeometry(0.025, 0.07, 12);
  contactGeometry.rotateX(Math.PI);
  contactGeometry.translate(0, -0.215, 0);
  const contact = new THREE.Mesh(
    contactGeometry,
    new THREE.MeshStandardMaterial({
      color: DEFENSE_STYLE.contact,
      roughness: 0.15,
      metalness: 0.95,
    }),
  );
  contact.userData.outlineThickness = 0.01;
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

// 4. CHIP (晶片 / 核心印記) - Center printed Shield Crest chip & dome
export function buildChip(accentColor: number): THREE.Group {
  const chipGroup = new THREE.Group();
  chipGroup.position.y = 0.165;

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.175, 0.185, 0.13, 24),
    new THREE.MeshStandardMaterial({
      color: DEFENSE_STYLE.chipBase,
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
      map: getChipEmblemTexture("defense", accentColor),
      toneMapped: false,
    }),
  );
  art.position.y = 0.066;
  art.userData.noOutline = true;
  chipGroup.add(art);

  return chipGroup;
}

// 1b. BLADE - 白銀聖盾刃: four broad shield faces with raised counter shoulders.
export function buildSilverAegisBlade(accentColor: number): THREE.Group {
  const group = new THREE.Group();
  group.position.y = 0.052;
  group.scale.y = 0.88;

  const armorGeometries: THREE.BufferGeometry[] = [];
  const hub = new THREE.CylinderGeometry(0.34, 0.37, 0.075, 40);
  hub.translate(0, 0.04, 0);
  armorGeometries.push(hub);

  const shieldShape = new THREE.Shape();
  shieldShape.moveTo(-0.25, -0.11);
  shieldShape.lineTo(-0.2, 0.1);
  shieldShape.quadraticCurveTo(0, 0.2, 0.2, 0.1);
  shieldShape.lineTo(0.25, -0.11);
  shieldShape.quadraticCurveTo(0, -0.17, -0.25, -0.11);
  shieldShape.closePath();
  for (let i = 0; i < 4; i += 1) {
    const angle = (i * Math.PI) / 2;
    const shield = extrudeDefense(shieldShape, 0.085, 0.016, 0.014);
    shield.rotateY(angle);
    shield.translate(Math.cos(angle) * 0.35, 0.035, Math.sin(angle) * 0.35);
    armorGeometries.push(shield);
  }

  const silverArmor = new THREE.Mesh(
    mergeStaticGeometries(armorGeometries),
    new THREE.MeshStandardMaterial({
      color: 0xdbe4ec,
      roughness: 0.16,
      metalness: 0.92,
      emissive: 0x718096,
      emissiveIntensity: 0.18,
    }),
  );
  silverArmor.userData.outlineThickness = 0.015;
  silverArmor.userData.smoothOutline = true;
  group.add(silverArmor);

  const shoulderGeometries: THREE.BufferGeometry[] = [];
  const shoulder = new THREE.BoxGeometry(0.14, 0.095, 0.16);
  for (let i = 0; i < 4; i += 1) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const geometry = shoulder.clone();
    geometry.rotateY(-angle);
    geometry.translate(Math.cos(angle) * 0.48, 0.105, Math.sin(angle) * 0.48);
    shoulderGeometries.push(geometry);
  }
  shoulder.dispose();
  const shoulders = new THREE.Mesh(
    mergeStaticGeometries(shoulderGeometries),
    new THREE.MeshStandardMaterial({
      color: 0x8896a5,
      roughness: 0.22,
      metalness: 0.9,
    }),
  );
  shoulders.userData.outlineThickness = 0.012;
  group.add(shoulders);

  const inlayGeometries: THREE.BufferGeometry[] = [];
  const inlay = new THREE.BoxGeometry(0.035, 0.025, 0.2);
  for (let i = 0; i < 4; i += 1) {
    const angle = (i * Math.PI) / 2;
    const geometry = inlay.clone();
    geometry.rotateY(-angle);
    geometry.translate(Math.cos(angle) * 0.43, 0.135, Math.sin(angle) * 0.43);
    inlayGeometries.push(geometry);
  }
  inlay.dispose();
  const inlays = new THREE.Mesh(
    mergeStaticGeometries(inlayGeometries),
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.2,
      metalness: 0.75,
      emissive: accentColor,
      emissiveIntensity: 0.12,
    }),
  );
  inlays.userData.outlineThickness = 0.008;
  group.add(inlays);

  return group;
}

// 2b. RATCHET - 聖堡棘輪: six thick armor teeth around a reinforced body.
export function buildCrusaderRatchet(accentColor: number): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.34, 0.065, 36),
    new THREE.MeshStandardMaterial({
      color: 0x253247,
      roughness: 0.28,
      metalness: 0.62,
      transparent: true,
      opacity: 0.92,
    }),
  );
  body.position.y = 0.018;
  body.userData.outlineThickness = 0.01;
  group.add(body);

  const teethGeometries: THREE.BufferGeometry[] = [];
  const tooth = new THREE.BoxGeometry(0.12, 0.075, 0.13);
  for (let i = 0; i < 6; i += 1) {
    const angle = (i * Math.PI * 2) / 6;
    const geometry = tooth.clone();
    geometry.rotateY(-angle);
    geometry.translate(Math.cos(angle) * 0.35, 0.02, Math.sin(angle) * 0.35);
    teethGeometries.push(geometry);
  }
  tooth.dispose();
  const teeth = new THREE.Mesh(
    mergeStaticGeometries(teethGeometries),
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.2,
      metalness: 0.82,
    }),
  );
  teeth.userData.outlineThickness = 0.012;
  group.add(teeth);
  return group;
}

// 3b. BIT - 反擊錨軸: a broad rounded contact patch and weighted stabilizer collar.
export function buildAnchorBit(accentColor: number): THREE.Group {
  const group = new THREE.Group();
  const gearGeometries: THREE.BufferGeometry[] = [];
  const tooth = new THREE.BoxGeometry(0.035, 0.06, 0.065);
  tooth.translate(0.17, -0.02, 0);
  for (let i = 0; i < 8; i += 1) {
    gearGeometries.push(tooth.clone().rotateY((i * Math.PI * 2) / 8));
  }
  tooth.dispose();
  const gear = new THREE.Mesh(
    mergeStaticGeometries(gearGeometries),
    new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.24, metalness: 0.8 }),
  );
  gear.userData.outlineThickness = 0.01;
  group.add(gear);

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.095, 0.16, 10),
    new THREE.MeshStandardMaterial({
      color: 0xaab7c6,
      roughness: 0.18,
      metalness: 0.45,
      transparent: true,
      opacity: 0.78,
    }),
  );
  body.position.y = -0.1;
  body.userData.noOutline = true;
  group.add(body);

  const collarGeometry = new THREE.TorusGeometry(0.16, 0.042, 8, 20);
  collarGeometry.rotateX(Math.PI / 2);
  const collar = new THREE.Mesh(
    collarGeometry,
    new THREE.MeshStandardMaterial({ color: 0xdbe4ec, roughness: 0.16, metalness: 0.92 }),
  );
  collar.position.y = -0.075;
  collar.userData.outlineThickness = 0.009;
  group.add(collar);

  const contact = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x536171, roughness: 0.3, metalness: 0.82 }),
  );
  contact.scale.y = 0.65;
  contact.position.y = -0.205;
  contact.userData.outlineThickness = 0.012;
  group.add(contact);
  return group;
}

// 4b. CHIP - 聖盾核心: silver knight crest with a four-point crown bezel.
export function buildAegisChip(accentColor: number): THREE.Group {
  const group = new THREE.Group();
  group.position.y = 0.165;

  const baseGeometries: THREE.BufferGeometry[] = [
    new THREE.CylinderGeometry(0.18, 0.19, 0.13, 24),
  ];
  const crownPoint = new THREE.BoxGeometry(0.055, 0.07, 0.055);
  crownPoint.translate(0.185, 0.015, 0);
  for (let i = 0; i < 4; i += 1) {
    baseGeometries.push(crownPoint.clone().rotateY((i * Math.PI) / 2));
  }
  crownPoint.dispose();
  const base = new THREE.Mesh(
    mergeStaticGeometries(baseGeometries),
    new THREE.MeshStandardMaterial({ color: 0xdbe4ec, roughness: 0.18, metalness: 0.9 }),
  );
  base.userData.outlineThickness = 0.014;
  group.add(base);

  const rimGeometry = new THREE.TorusGeometry(0.166, 0.016, 6, 24);
  rimGeometry.rotateX(Math.PI / 2);
  const rim = new THREE.Mesh(
    rimGeometry,
    new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.22, metalness: 0.78 }),
  );
  rim.position.y = 0.067;
  rim.userData.noOutline = true;
  group.add(rim);

  const artGeometry = new THREE.CircleGeometry(0.148, 32);
  artGeometry.rotateX(-Math.PI / 2);
  const art = new THREE.Mesh(
    artGeometry,
    new THREE.MeshBasicMaterial({
      map: getChipEmblemTexture("defense_aegis_chip", accentColor),
      toneMapped: false,
    }),
  );
  art.position.y = 0.068;
  art.userData.noOutline = true;
  group.add(art);
  return group;
}

export const buildDefenseDetailed: DetailedBladeBuilder = (accentColor) => ({
  blade: buildBlade(accentColor),
  ratchet: buildRatchet(accentColor),
  bit: buildBit(accentColor),
  chip: buildChip(accentColor),
});
