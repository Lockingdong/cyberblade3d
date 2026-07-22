import * as THREE from "three";
import { mergeStaticGeometries } from "../geometry-utils";
import { getChipEmblemTexture } from "./chip-art";
import type { DetailedBladeBuilder } from "./types";

// Beyblade X detailed balance top (Emerald Gale / 翡翠疾風): 4 distinct components (Blade, Ratchet, Bit, Chip).
// Hybrid design featuring 2 sharp metal attack wings + 2 smooth airflow defense arcs,
// a translucent emerald PC inner guide ring, a 4-60 low-profile ratchet, a dual-stage Taper Bit, and a hurricane gale chip emblem.

const BALANCE_STYLE = {
  chrome: 0xaeb7c4,
  emeraldAccent: 0xb5e61d, // Bright emerald / lime accent
  chipBase: 0x0c2513,
  driverGlass: 0x84cc16,
  driverGlassEmissive: 0x14532d,
  spindle: 0x1f2937,
  contact: 0x374151,
  ratchetPolycarbonate: 0x0d381e,
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

// 1. BLADE (ブレード) - Upper hybrid metal ring (2 attack wings + 2 defense arcs) + Translucent Emerald inner ring
export function buildBlade(accentColor: number): THREE.Group {
  const bladeGroup = new THREE.Group();
  bladeGroup.position.y = 0.05;

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

  // (b) 2 Sharp Attack Blades (at 0° and 180°)
  for (let i = 0; i < 2; i += 1) {
    const angle = i * Math.PI;

    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(0.2, 0.08);
    bladeShape.quadraticCurveTo(0.42, 0.16, 0.52, -0.02);
    bladeShape.quadraticCurveTo(0.4, -0.08, 0.3, -0.16);
    bladeShape.quadraticCurveTo(0.26, -0.04, 0.2, -0.08);
    bladeShape.closePath();

    // Wind cutout slot
    const slot = new THREE.Path();
    slot.absellipse(0.34, 0, 0.05, 0.025, 0, Math.PI * 2, true, 0.5);
    bladeShape.holes.push(slot);

    const wingGeom = extrudeBalance(bladeShape, 0.035, 0.008, 0.008);
    wingGeom.rotateY(angle);
    wingGeom.translate(0, 0.065, 0);
    chromeGeometries.push(wingGeom);
  }

  // (c) 2 Smooth Defense Arcs (at 90° and 270°)
  for (let i = 0; i < 2; i += 1) {
    const angle = i * Math.PI + Math.PI / 2;

    const arcShape = new THREE.Shape();
    arcShape.moveTo(0.22, 0.18);
    arcShape.quadraticCurveTo(0.46, 0.14, 0.46, -0.14);
    arcShape.quadraticCurveTo(0.22, -0.18, 0.22, -0.1);
    arcShape.quadraticCurveTo(0.38, 0, 0.22, 0.1);
    arcShape.closePath();

    const arcGeom = extrudeBalance(arcShape, 0.032, 0.007, 0.007);
    arcGeom.rotateY(angle);
    arcGeom.translate(0, 0.065, 0);
    chromeGeometries.push(arcGeom);
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

  // 4 accent fill plates visible in wind slots
  for (let i = 0; i < 4; i += 1) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const plateShape = new THREE.Shape();
    plateShape.moveTo(0.24, 0.05);
    plateShape.lineTo(0.36, 0.06);
    plateShape.lineTo(0.32, -0.05);
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

// 2. RATCHET (ラチェット) - 4-60 Low-profile Ratchet Ring
export function buildRatchet(accentColor: number): THREE.Group {
  const ratchetGroup = new THREE.Group();

  const baseRing = new THREE.CylinderGeometry(0.34, 0.32, 0.05, 32);
  baseRing.translate(0, 0.025, 0);

  const nodeGeometries: THREE.BufferGeometry[] = [baseRing];
  for (let i = 0; i < 4; i += 1) {
    const angle = (i * Math.PI) / 2;
    const node = new THREE.BoxGeometry(0.09, 0.048, 0.12);
    node.rotateY(angle);
    node.translate(Math.cos(angle) * 0.34, 0.025, Math.sin(angle) * 0.34);
    nodeGeometries.push(node);
  }

  const ratchetMesh = new THREE.Mesh(
    mergeStaticGeometries(nodeGeometries),
    new THREE.MeshStandardMaterial({
      color: BALANCE_STYLE.ratchetPolycarbonate,
      roughness: 0.3,
      metalness: 0.2,
    }),
  );

  // Accent detail ring on top of ratchet
  const accentRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.01, 8, 24).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.2,
      metalness: 0.4,
    }),
  );
  accentRing.position.y = 0.048;

  ratchetGroup.add(ratchetMesh, accentRing);
  return ratchetGroup;
}

// 3. BIT (ビット) - Dual-stage Tapered Point Bit with central Emerald tip
export function buildBit(accentColor: number): THREE.Group {
  const bitGroup = new THREE.Group();

  // Spindle body
  const spindleGeom = new THREE.CylinderGeometry(0.18, 0.12, 0.06, 24);
  spindleGeom.translate(0, -0.03, 0);

  // Friction contact gear ring
  const gearGeom = new THREE.CylinderGeometry(0.24, 0.22, 0.03, 12);
  gearGeom.translate(0, -0.015, 0);

  // Dual-stage tapered tip (Point Bit)
  const taperCone = new THREE.ConeGeometry(0.1, 0.07, 24);
  taperCone.rotateX(Math.PI);
  taperCone.translate(0, -0.075, 0);

  const metalMesh = new THREE.Mesh(
    mergeStaticGeometries([spindleGeom, gearGeom, taperCone]),
    new THREE.MeshStandardMaterial({
      color: BALANCE_STYLE.spindle,
      roughness: 0.4,
      metalness: 0.7,
    }),
  );
  bitGroup.add(metalMesh);

  // Central Translucent Emerald Tip Crystal
  const glassTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 16, 16),
    new THREE.MeshStandardMaterial({
      color: BALANCE_STYLE.driverGlass,
      emissive: BALANCE_STYLE.driverGlassEmissive,
      emissiveIntensity: 0.6,
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

// 4. CHIP (フェイスチップ) - Central Emerald Chip with Gale Emblem
export function buildChip(accentColor: number): THREE.Group {
  const chipGroup = new THREE.Group();
  chipGroup.position.y = 0.05;

  const baseMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.17, 0.06, 32),
    new THREE.MeshStandardMaterial({
      color: BALANCE_STYLE.chipBase,
      roughness: 0.2,
      metalness: 0.3,
    }),
  );
  baseMesh.position.y = 0.07;
  chipGroup.add(baseMesh);

  // Gold metallic border ring
  const borderRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.165, 0.012, 12, 32).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.15,
      metalness: 0.85,
    }),
  );
  borderRing.position.y = 0.1;
  chipGroup.add(borderRing);

  // Printed emblem texture face
  const texture = getChipEmblemTexture("balance", accentColor);
  const emblemMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.155, 32).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.2,
      metalness: 0.1,
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
