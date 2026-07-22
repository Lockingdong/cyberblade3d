import * as THREE from "three";
import { mergeStaticGeometries } from "../geometry-utils";
import { getChipEmblemTexture } from "./chip-art";
import type { DetailedBladeBuilder } from "./types";

const AEGIS_STYLE = {
  steel: 0xffffff,
  darkSteel: 0x334155,
  chipBase: 0x0f172a,
  driverGlass: 0x38bdf8,
  driverGlassEmissive: 0x0284c7,
  spindle: 0x1e293b,
  contact: 0x64748b,
  ratchetPolycarbonate: 0x0f172a,
  accentGold: 0xfacc15,
  emissiveIce: 0x7dd3fc,
};

function extrudeAegis(
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

// 1. BLADE (ブレード) - Silver Aegis fortress shield blade
export function buildBlade(accentColor: number): THREE.Group {
  const bladeGroup = new THREE.Group();
  bladeGroup.position.y = 0.05;

  const steelGeometries: THREE.BufferGeometry[] = [];

  const hubProfile = [
    new THREE.Vector2(0.1, -0.02),
    new THREE.Vector2(0.32, -0.02),
    new THREE.Vector2(0.36, 0.01),
    new THREE.Vector2(0.36, 0.05),
    new THREE.Vector2(0.3, 0.07),
    new THREE.Vector2(0.1, 0.07),
  ];
  steelGeometries.push(new THREE.LatheGeometry(hubProfile, 36));

  // 8 Aegis Fortress Armor Plates
  for (let i = 0; i < 8; i += 1) {
    const angle = (i * Math.PI * 2) / 8;
    const plateShape = new THREE.Shape();
    plateShape.moveTo(-0.12, -0.04);
    plateShape.lineTo(0.12, -0.04);
    plateShape.lineTo(0.16, 0.06);
    plateShape.lineTo(0.08, 0.11);
    plateShape.lineTo(-0.08, 0.11);
    plateShape.lineTo(-0.16, 0.06);
    plateShape.closePath();

    const plateGeom = extrudeAegis(plateShape, 0.065, 0.012, 0.01);
    plateGeom.rotateY(angle);
    plateGeom.translate(Math.cos(angle) * 0.33, 0.04, Math.sin(angle) * 0.33);
    steelGeometries.push(plateGeom);
  }

  const steelMesh = new THREE.Mesh(
    mergeStaticGeometries(steelGeometries),
    new THREE.MeshStandardMaterial({
      color: AEGIS_STYLE.steel,
      roughness: 0.06,
      metalness: 0.95,
      emissive: 0xcccccc,
      emissiveIntensity: 0.5,
    }),
  );
  steelMesh.userData.outlineThickness = 0.014;
  steelMesh.userData.smoothOutline = true;
  bladeGroup.add(steelMesh);

  // Accent Rivets
  const studGeometries: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 8; i += 1) {
    const angle = (i * Math.PI * 2) / 8 + Math.PI / 8;
    const studGeom = new THREE.SphereGeometry(0.032, 8, 8);
    studGeom.translate(Math.cos(angle) * 0.43, 0.08, Math.sin(angle) * 0.43);
    studGeometries.push(studGeom);
  }

  const studsMesh = new THREE.Mesh(
    mergeStaticGeometries(studGeometries),
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.1,
      metalness: 0.8,
    }),
  );
  studsMesh.userData.noOutline = true;
  bladeGroup.add(studsMesh);

  return bladeGroup;
}

// 2. RATCHET (ラチェット) - 9-60 Ratchet
export function buildRatchet(accentColor: number): THREE.Group {
  const ratchetGroup = new THREE.Group();
  ratchetGroup.position.y = 0.005;

  const coreGeom = new THREE.CylinderGeometry(0.38, 0.4, 0.065, 32);
  const coreMesh = new THREE.Mesh(
    coreGeom,
    new THREE.MeshStandardMaterial({
      color: AEGIS_STYLE.ratchetPolycarbonate,
      roughness: 0.2,
      metalness: 0.3,
      transparent: true,
      opacity: 0.88,
    }),
  );
  coreMesh.userData.outlineThickness = 0.012;
  ratchetGroup.add(coreMesh);

  const toothGeometries: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i += 1) {
    const angle = (i * Math.PI * 2) / 9;
    const toothShape = new THREE.Shape();
    toothShape.moveTo(-0.04, -0.04);
    toothShape.lineTo(0.04, -0.04);
    toothShape.lineTo(0.03, 0.07);
    toothShape.lineTo(-0.03, 0.07);
    toothShape.closePath();

    const tooth = extrudeAegis(toothShape, 0.06, 0.006, 0.006);
    tooth.rotateY(angle);
    tooth.translate(Math.cos(angle) * 0.41, 0, Math.sin(angle) * 0.41);
    toothGeometries.push(tooth);
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

// 3. BIT (ビット) - High Ball Defense Bit
export function buildBit(accentColor: number): THREE.Group {
  const bitGroup = new THREE.Group();
  bitGroup.position.y = -0.055;

  const bodyGeom = new THREE.CylinderGeometry(0.24, 0.19, 0.07, 24);
  const bodyMesh = new THREE.Mesh(
    bodyGeom,
    new THREE.MeshStandardMaterial({
      color: AEGIS_STYLE.driverGlass,
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.75,
      emissive: AEGIS_STYLE.driverGlassEmissive,
      emissiveIntensity: 0.4,
    }),
  );
  bodyMesh.userData.noShadow = true;
  bitGroup.add(bodyMesh);

  const tipGeom = new THREE.SphereGeometry(0.08, 16, 12);
  const tipMesh = new THREE.Mesh(
    tipGeom,
    new THREE.MeshStandardMaterial({
      color: AEGIS_STYLE.contact,
      roughness: 0.2,
      metalness: 0.8,
    }),
  );
  tipMesh.position.y = -0.05;
  bitGroup.add(tipMesh);

  return bitGroup;
}

// 4. CHIP (晶片 / 核心印記) - Center Silver Aegis chip
export function buildChip(accentColor: number): THREE.Group {
  const chipGroup = new THREE.Group();
  chipGroup.position.y = 0.155;

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.175, 0.185, 0.13, 24),
    new THREE.MeshStandardMaterial({
      color: AEGIS_STYLE.chipBase,
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
      map: getChipEmblemTexture("aegis", accentColor),
      toneMapped: false,
    }),
  );
  art.position.y = 0.066;
  art.userData.noOutline = true;
  chipGroup.add(art);

  return chipGroup;
}

export const buildAegisDetailed: DetailedBladeBuilder = (accentColor) => ({
  blade: buildBlade(accentColor),
  ratchet: buildRatchet(accentColor),
  bit: buildBit(accentColor),
  chip: buildChip(accentColor),
});
