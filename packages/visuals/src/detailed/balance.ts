import * as THREE from "three";
import { mergeStaticGeometries } from "../geometry-utils";
import { getChipEmblemTexture } from "./chip-art";
import type { DetailedBladeBuilder } from "./types";

// Beyblade X detailed balance top (Emerald Gale / 翡翠疾風): 4 distinct components (Blade, Ratchet, Bit, Chip).
// Hybrid design featuring 4 identical attack-defense wings with a four-fold symmetric silhouette,
// a translucent emerald PC inner guide ring, a 4-60 low-profile ratchet, a dual-stage Taper Bit, and a hurricane gale chip emblem.

const BALANCE_STYLE = {
  chrome: 0xd1d5db,
  gunmetal: 0x1f2937,
  gold: 0xf59e0b,
  emeraldAccent: 0xb5e61d, // Bright emerald / lime accent
  chipBase: 0x111827,
  driverGlass: 0x84cc16,
  driverGlassEmissive: 0x15803d,
};

const CHAMELEON_STYLE = {
  chrome: 0xd8d5ea,
  cyan: 0x22d3ee,
  deepIndigo: 0x312e81,
  chipBase: 0x160b2d,
  contact: 0x172033,
};

function extrudeBalance(
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

// 1. BLADE (ブレード) - Four-fold symmetric hybrid metal ring + Translucent Emerald inner ring
export function buildBlade(accentColor: number): THREE.Group {
  const bladeGroup = new THREE.Group();
  bladeGroup.position.y = 0.052;
  bladeGroup.scale.y = 0.85;

  const chromeGeometries: THREE.BufferGeometry[] = [];

  // (a) Inner Hub Lathe
  const hubProfile = [
    new THREE.Vector2(0.1, 0.01),
    new THREE.Vector2(0.24, 0.01),
    new THREE.Vector2(0.27, 0.035),
    new THREE.Vector2(0.27, 0.07),
    new THREE.Vector2(0.22, 0.08),
    new THREE.Vector2(0.1, 0.08),
  ];
  chromeGeometries.push(new THREE.LatheGeometry(hubProfile, 36));

  // (b) 4 identical hybrid wings: a pointed leading edge flows into a rounded
  // defense shoulder. Repeating one profile keeps both mass and silhouette
  // visually balanced around the spin axis.
  for (let i = 0; i < 4; i += 1) {
    const angle = (i * Math.PI) / 2;

    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(0.2, 0.11);
    bladeShape.quadraticCurveTo(0.34, 0.19, 0.46, 0.14);
    bladeShape.quadraticCurveTo(0.51, 0.1, 0.53, -0.035);
    bladeShape.lineTo(0.45, -0.105);
    bladeShape.quadraticCurveTo(0.34, -0.17, 0.22, -0.09);
    bladeShape.quadraticCurveTo(0.28, 0, 0.2, 0.11);
    bladeShape.closePath();

    // Matching wind cutout on every wing reveals the aligned accent insert.
    const slot = new THREE.Path();
    slot.absellipse(0.355, 0.005, 0.067, 0.03, 0, Math.PI * 2, true, -0.22);
    bladeShape.holes.push(slot);

    const wingGeom = extrudeBalance(bladeShape, 0.035, 0.008, 0.008);
    wingGeom.rotateY(angle);
    wingGeom.translate(0, 0.065, 0);
    chromeGeometries.push(wingGeom);
  }

  const chromeMesh = new THREE.Mesh(
    mergeStaticGeometries(chromeGeometries),
    new THREE.MeshStandardMaterial({
      color: BALANCE_STYLE.chrome,
      roughness: 0.1,
      metalness: 0.9,
      emissive: 0xcccccc,
      emissiveIntensity: 0.5,
    }),
  );
  chromeMesh.userData.outlineThickness = 0.012;
  chromeMesh.userData.smoothOutline = true;
  bladeGroup.add(chromeMesh);

  // (d) Translucent Emerald Guide Ring (PC) & Accent Plates
  const emeraldGeometries: THREE.BufferGeometry[] = [];

  const innerPolyRing = new THREE.TorusGeometry(0.33, 0.025, 12, 32);
  innerPolyRing.rotateX(Math.PI / 2);
  innerPolyRing.translate(0, 0.07, 0);
  emeraldGeometries.push(innerPolyRing);

  // 4 accent inserts align directly with their matching metal wings.
  for (let i = 0; i < 4; i += 1) {
    const angle = (i * Math.PI) / 2;
    const plateShape = new THREE.Shape();
    plateShape.moveTo(0.265, 0.065);
    plateShape.quadraticCurveTo(0.37, 0.085, 0.425, -0.01);
    plateShape.quadraticCurveTo(0.36, -0.075, 0.27, -0.045);
    plateShape.closePath();

    const plateGeom = extrudeBalance(plateShape, 0.02, 0.004, 0.004);
    plateGeom.rotateY(angle);
    plateGeom.translate(0, 0.072, 0);
    emeraldGeometries.push(plateGeom);
  }

  const emeraldMesh = new THREE.Mesh(
    mergeStaticGeometries(emeraldGeometries),
    new THREE.MeshPhysicalMaterial({
      color: accentColor,
      roughness: 0.15,
      metalness: 0.1,
      transmission: 0.65,
      transparent: true,
      opacity: 0.82,
      ior: 1.5,
      thickness: 0.05,
      emissive: accentColor,
      emissiveIntensity: 0.2,
    }),
  );
  emeraldMesh.userData.outlineThickness = 0.008;
  emeraldMesh.userData.noShadow = true;
  bladeGroup.add(emeraldMesh);

  return bladeGroup;
}

// 1b. BLADE (ブレード) - 幻彩變色龍刃 (balance_chameleon)
export function buildChameleonBlade(accentColor: number): THREE.Group {
  const bladeGroup = new THREE.Group();
  bladeGroup.position.y = 0.052;
  bladeGroup.scale.y = 0.84;

  const metalGeometries: THREE.BufferGeometry[] = [];
  const hubProfile = [
    new THREE.Vector2(0.1, 0.005),
    new THREE.Vector2(0.26, 0.005),
    new THREE.Vector2(0.3, 0.03),
    new THREE.Vector2(0.3, 0.065),
    new THREE.Vector2(0.24, 0.08),
    new THREE.Vector2(0.1, 0.08),
  ];
  metalGeometries.push(new THREE.LatheGeometry(hubProfile, 40));

  const wingShape = new THREE.Shape();
  wingShape.moveTo(0.19, 0.125);
  wingShape.quadraticCurveTo(0.34, 0.215, 0.465, 0.145);
  wingShape.quadraticCurveTo(0.515, 0.075, 0.49, -0.105);
  wingShape.quadraticCurveTo(0.38, -0.205, 0.195, -0.12);
  wingShape.quadraticCurveTo(0.255, 0, 0.19, 0.125);
  wingShape.closePath();
  for (let index = 0; index < 5; index += 1) {
    const wing = extrudeBalance(wingShape, 0.032, 0.007, 0.007);
    wing.rotateY((index * Math.PI * 2) / 5);
    wing.translate(0, 0.062, 0);
    metalGeometries.push(wing);
  }

  const metalMesh = new THREE.Mesh(
    mergeStaticGeometries(metalGeometries),
    new THREE.MeshStandardMaterial({
      color: CHAMELEON_STYLE.chrome,
      roughness: 0.16,
      metalness: 0.82,
      emissive: 0x77738c,
      emissiveIntensity: 0.18,
    }),
  );
  metalMesh.userData.outlineThickness = 0.011;
  metalMesh.userData.smoothOutline = true;
  bladeGroup.add(metalMesh);

  const armorShape = new THREE.Shape();
  armorShape.moveTo(0.245, 0.09);
  armorShape.quadraticCurveTo(0.355, 0.145, 0.43, 0.09);
  armorShape.quadraticCurveTo(0.465, 0.025, 0.42, -0.075);
  armorShape.quadraticCurveTo(0.34, -0.125, 0.25, -0.075);
  armorShape.closePath();
  const armorGeometries: THREE.BufferGeometry[] = [];
  for (let index = 0; index < 5; index += 1) {
    const armor = extrudeBalance(armorShape, 0.02, 0.005, 0.005);
    armor.rotateY((index * Math.PI * 2) / 5);
    armor.translate(0, 0.084, 0);
    armorGeometries.push(armor);
  }
  const armorMesh = new THREE.Mesh(
    mergeStaticGeometries(armorGeometries),
    new THREE.MeshPhysicalMaterial({
      color: accentColor,
      roughness: 0.16,
      metalness: 0.5,
      iridescence: 0.9,
      iridescenceIOR: 1.35,
      iridescenceThicknessRange: [120, 420],
      emissive: CHAMELEON_STYLE.deepIndigo,
      emissiveIntensity: 0.22,
    }),
  );
  armorMesh.userData.outlineThickness = 0.008;
  armorMesh.userData.smoothOutline = true;
  bladeGroup.add(armorMesh);

  const scaleShape = new THREE.Shape();
  scaleShape.moveTo(-0.018, 0);
  scaleShape.lineTo(0, 0.027);
  scaleShape.lineTo(0.018, 0);
  scaleShape.lineTo(0, -0.027);
  scaleShape.closePath();
  const scaleGeometries: THREE.BufferGeometry[] = [];
  for (let wingIndex = 0; wingIndex < 5; wingIndex += 1) {
    const wingAngle = (wingIndex * Math.PI * 2) / 5;
    for (let scaleIndex = 0; scaleIndex < 3; scaleIndex += 1) {
      const scale = extrudeBalance(scaleShape, 0.009, 0.002, 0.002);
      scale.rotateY(wingAngle + scaleIndex * 0.08 - 0.08);
      const radius = 0.295 + scaleIndex * 0.055;
      scale.translate(
        Math.cos(wingAngle) * radius,
        0.104,
        Math.sin(wingAngle) * radius,
      );
      scaleGeometries.push(scale);
    }
  }
  const scaleMesh = new THREE.Mesh(
    mergeStaticGeometries(scaleGeometries),
    new THREE.MeshBasicMaterial({
      color: CHAMELEON_STYLE.cyan,
      toneMapped: false,
    }),
  );
  scaleMesh.userData.noOutline = true;
  scaleMesh.userData.noShadow = true;
  bladeGroup.add(scaleMesh);

  return bladeGroup;
}

// 2. RATCHET (ラチェット) - 4-60 Low-profile Ratchet Ring with 3-Layer Structure
export function buildRatchet(accentColor: number): THREE.Group {
  const ratchetGroup = new THREE.Group();

  // Layer 1: Inner Mechanical Core (Gunmetal Steel)
  const coreMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 0.048, 32),
    new THREE.MeshStandardMaterial({
      color: BALANCE_STYLE.gunmetal,
      roughness: 0.22,
      metalness: 0.85,
    }),
  );
  coreMesh.position.y = 0.024;
  coreMesh.userData.outlineThickness = 0.009;
  ratchetGroup.add(coreMesh);

  // Layer 2: Outer Polycarbonate Shell & 4-60 Teeth (Translucent Emerald PC)
  const shellGeo = new THREE.CylinderGeometry(0.34, 0.32, 0.038, 32);
  shellGeo.translate(0, 0.021, 0);

  const toothGeometries: THREE.BufferGeometry[] = [shellGeo];
  for (let i = 0; i < 4; i += 1) {
    const angle = (i * Math.PI) / 2;
    const tooth = new THREE.BoxGeometry(0.085, 0.044, 0.115);
    tooth.rotateY(angle);
    tooth.translate(Math.cos(angle) * 0.335, 0.022, Math.sin(angle) * 0.335);
    toothGeometries.push(tooth);
  }

  const pcMesh = new THREE.Mesh(
    mergeStaticGeometries(toothGeometries),
    new THREE.MeshPhysicalMaterial({
      color: accentColor,
      roughness: 0.15,
      metalness: 0.1,
      transmission: 0.65,
      transparent: true,
      opacity: 0.88,
      ior: 1.5,
      thickness: 0.04,
      emissive: accentColor,
      emissiveIntensity: 0.18,
    }),
  );
  pcMesh.userData.outlineThickness = 0.008;
  ratchetGroup.add(pcMesh);

  // Layer 3a: Champagne Gold Top Accent Ring
  const goldRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.285, 0.01, 8, 32).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: BALANCE_STYLE.gold,
      roughness: 0.15,
      metalness: 0.85,
    }),
  );
  goldRing.position.y = 0.046;
  goldRing.userData.outlineThickness = 0.005;

  // Layer 3b: Titanium Silver Inner Bezel Ring
  const silverRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.252, 0.007, 8, 32).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: BALANCE_STYLE.chrome,
      roughness: 0.12,
      metalness: 0.9,
    }),
  );
  silverRing.position.y = 0.048;

  ratchetGroup.add(goldRing, silverRing);
  return ratchetGroup;
}

// 2b. RATCHET (ラチェット) - 幻鱗棘輪 (balance_mirage_ratchet), 5-60 low profile
export function buildMirageRatchet(accentColor: number): THREE.Group {
  const ratchetGroup = new THREE.Group();

  const baseMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.31, 0.3, 0.042, 30),
    new THREE.MeshPhysicalMaterial({
      color: CHAMELEON_STYLE.chipBase,
      roughness: 0.24,
      metalness: 0.25,
      transparent: true,
      opacity: 0.9,
    }),
  );
  baseMesh.position.y = 0.021;
  baseMesh.userData.outlineThickness = 0.009;
  ratchetGroup.add(baseMesh);

  const nodeGeometries: THREE.BufferGeometry[] = [];
  for (let index = 0; index < 5; index += 1) {
    const angle = (index * Math.PI * 2) / 5;
    const node = new THREE.BoxGeometry(0.075, 0.04, 0.105);
    node.rotateY(angle);
    node.translate(
      Math.cos(angle) * 0.315,
      0.022,
      Math.sin(angle) * 0.315,
    );
    nodeGeometries.push(node);
  }
  const nodesMesh = new THREE.Mesh(
    mergeStaticGeometries(nodeGeometries),
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.2,
      metalness: 0.55,
      emissive: CHAMELEON_STYLE.deepIndigo,
      emissiveIntensity: 0.2,
    }),
  );
  nodesMesh.userData.outlineThickness = 0.008;
  ratchetGroup.add(nodesMesh);

  const guideRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.255, 0.009, 8, 30).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: CHAMELEON_STYLE.cyan,
      toneMapped: false,
    }),
  );
  guideRing.position.y = 0.044;
  guideRing.userData.noOutline = true;
  ratchetGroup.add(guideRing);

  return ratchetGroup;
}

// 3. BIT (ビット) - Dual-stage Tapered Point Bit with 3-Layer Structure
export function buildBit(accentColor: number): THREE.Group {
  const bitGroup = new THREE.Group();

  // Layer 1: Titanium Silver Friction Contact Gear Ring (12 teeth)
  const gearGeom = new THREE.CylinderGeometry(0.245, 0.225, 0.028, 12);
  gearGeom.translate(0, -0.014, 0);

  const gearMesh = new THREE.Mesh(
    gearGeom,
    new THREE.MeshStandardMaterial({
      color: BALANCE_STYLE.chrome,
      roughness: 0.15,
      metalness: 0.85,
    }),
  );
  gearMesh.userData.outlineThickness = 0.007;
  bitGroup.add(gearMesh);

  // Layer 2: Translucent Emerald PC Spindle Body
  const spindleGeom = new THREE.CylinderGeometry(0.18, 0.11, 0.058, 24);
  spindleGeom.translate(0, -0.032, 0);

  const pcMesh = new THREE.Mesh(
    spindleGeom,
    new THREE.MeshPhysicalMaterial({
      color: accentColor,
      roughness: 0.15,
      metalness: 0.1,
      transmission: 0.65,
      transparent: true,
      opacity: 0.88,
      ior: 1.5,
      thickness: 0.03,
      emissive: accentColor,
      emissiveIntensity: 0.18,
    }),
  );
  pcMesh.userData.outlineThickness = 0.007;
  bitGroup.add(pcMesh);

  // Layer 3a: Steel Core Shaft & Dual-Stage Tapered Tip Cone (Titanium Silver Chrome)
  const coreShaft = new THREE.CylinderGeometry(0.06, 0.06, 0.08, 16);
  coreShaft.translate(0, -0.04, 0);

  const taperCone = new THREE.ConeGeometry(0.1, 0.07, 24);
  taperCone.rotateX(Math.PI);
  taperCone.translate(0, -0.075, 0);

  const metalMesh = new THREE.Mesh(
    mergeStaticGeometries([coreShaft, taperCone]),
    new THREE.MeshStandardMaterial({
      color: BALANCE_STYLE.chrome,
      roughness: 0.15,
      metalness: 0.85,
    }),
  );
  metalMesh.userData.outlineThickness = 0.008;
  bitGroup.add(metalMesh);

  // Layer 3b: Central Translucent Emerald Tip Crystal
  const glassTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 16, 16),
    new THREE.MeshStandardMaterial({
      color: BALANCE_STYLE.driverGlass,
      emissive: BALANCE_STYLE.driverGlassEmissive,
      emissiveIntensity: 0.8,
      roughness: 0.1,
      metalness: 0.3,
      transparent: true,
      opacity: 0.9,
    }),
  );
  glassTip.position.y = -0.11;
  bitGroup.add(glassTip);

  return bitGroup;
}

// 3b. BIT (ビット) - 幻步錐軸 (balance_phantom_taper_bit)
export function buildPhantomTaperBit(accentColor: number): THREE.Group {
  const bitGroup = new THREE.Group();

  const gearGeometries: THREE.BufferGeometry[] = [];
  for (let index = 0; index < 10; index += 1) {
    const tooth = new THREE.BoxGeometry(0.022, 0.042, 0.04);
    const angle = (index * Math.PI * 2) / 10;
    tooth.rotateY(angle);
    tooth.translate(Math.cos(angle) * 0.16, -0.018, Math.sin(angle) * 0.16);
    gearGeometries.push(tooth);
  }
  const gearMesh = new THREE.Mesh(
    mergeStaticGeometries(gearGeometries),
    new THREE.MeshBasicMaterial({
      color: CHAMELEON_STYLE.cyan,
      toneMapped: false,
    }),
  );
  gearMesh.userData.noOutline = true;
  bitGroup.add(gearMesh);

  const bodyMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.145, 0.075, 0.13, 10, 2),
    new THREE.MeshPhysicalMaterial({
      color: accentColor,
      roughness: 0.12,
      metalness: 0.18,
      transmission: 0.35,
      transparent: true,
      opacity: 0.88,
      emissive: CHAMELEON_STYLE.deepIndigo,
      emissiveIntensity: 0.28,
    }),
  );
  bodyMesh.position.y = -0.085;
  bodyMesh.userData.outlineThickness = 0.009;
  bitGroup.add(bodyMesh);

  const spindle = new THREE.CylinderGeometry(0.026, 0.026, 0.12, 10);
  spindle.translate(0, -0.11, 0);
  const taper = new THREE.ConeGeometry(0.06, 0.085, 16);
  taper.rotateX(Math.PI);
  taper.translate(0, -0.18, 0);
  const contactMesh = new THREE.Mesh(
    mergeStaticGeometries([spindle, taper]),
    new THREE.MeshStandardMaterial({
      color: CHAMELEON_STYLE.contact,
      roughness: 0.28,
      metalness: 0.75,
    }),
  );
  contactMesh.userData.outlineThickness = 0.009;
  bitGroup.add(contactMesh);

  const flatRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.052, 0.01, 8, 20).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: CHAMELEON_STYLE.cyan,
      roughness: 0.18,
      metalness: 0.7,
      emissive: CHAMELEON_STYLE.cyan,
      emissiveIntensity: 0.25,
    }),
  );
  flatRing.position.y = -0.205;
  flatRing.userData.outlineThickness = 0.006;
  bitGroup.add(flatRing);

  return bitGroup;
}

// 4. CHIP (フェイスチップ) - Central Emerald Chip with Gale Emblem & Layered Rims
export function buildChip(accentColor: number): THREE.Group {
  const chipGroup = new THREE.Group();
  chipGroup.position.y = 0.055;

  // Gunmetal steel base cylinder
  const baseMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.17, 0.06, 32),
    new THREE.MeshStandardMaterial({
      color: BALANCE_STYLE.chipBase,
      roughness: 0.22,
      metalness: 0.75,
    }),
  );
  baseMesh.position.y = 0.07;
  chipGroup.add(baseMesh);

  // Champagne gold metallic border ring
  const borderRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.165, 0.012, 12, 32).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: BALANCE_STYLE.gold,
      roughness: 0.15,
      metalness: 0.85,
    }),
  );
  borderRing.position.y = 0.1;
  chipGroup.add(borderRing);

  // Titanium silver inner accent bezel ring
  const innerSilverRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.156, 0.006, 8, 32).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: BALANCE_STYLE.chrome,
      roughness: 0.12,
      metalness: 0.9,
    }),
  );
  innerSilverRing.position.y = 0.101;
  chipGroup.add(innerSilverRing);

  // Printed emblem texture face
  const texture = getChipEmblemTexture("balance", accentColor);
  const emblemMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.15, 32).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.2,
      metalness: 0.1,
    }),
  );
  emblemMesh.position.y = 0.102;
  chipGroup.add(emblemMesh);

  return chipGroup;
}

// 4b. CHIP (フェイスチップ) - 變色龍核心 (balance_chameleon_chip)
export function buildChameleonChip(accentColor: number): THREE.Group {
  const chipGroup = new THREE.Group();
  chipGroup.position.y = 0.055;

  const baseMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.17, 0.06, 32),
    new THREE.MeshStandardMaterial({
      color: CHAMELEON_STYLE.chipBase,
      roughness: 0.18,
      metalness: 0.45,
    }),
  );
  baseMesh.position.y = 0.07;
  chipGroup.add(baseMesh);

  const borderRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.165, 0.012, 12, 32).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: CHAMELEON_STYLE.cyan,
      roughness: 0.12,
      metalness: 0.72,
      emissive: CHAMELEON_STYLE.cyan,
      emissiveIntensity: 0.25,
    }),
  );
  borderRing.position.y = 0.1;
  chipGroup.add(borderRing);

  const texture = getChipEmblemTexture("balance_chameleon_chip", accentColor);
  const emblemMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.155, 32).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.16,
      metalness: 0.12,
    }),
  );
  emblemMesh.position.y = 0.101;
  chipGroup.add(emblemMesh);

  return chipGroup;
}

export const buildBalanceDetailed: DetailedBladeBuilder = (
  accentColor: number,
  _spec?,
) => {
  const blade = buildBlade(accentColor);
  const ratchet = buildRatchet(accentColor);
  const bit = buildBit(accentColor);
  const chip = buildChip(accentColor);

  return { blade, ratchet, bit, chip };
};
