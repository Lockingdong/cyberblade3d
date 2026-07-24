import * as THREE from "three";
import { mergeStaticGeometries } from "../geometry-utils";
import { getChipEmblemTexture } from "./chip-art";
import type { DetailedBladeBuilder } from "./types";

const CRUSHER_STYLE = {
  steel: 0x59636f,
  darkSteel: 0x241e1a,
  chipBase: 0x1a1410,
  driverGlass: 0xd4883b,
  driverGlassEmissive: 0x662b00,
  spindle: 0x3d2b1f,
  contact: 0x6e4e37,
  ratchetPolycarbonate: 0x2e1b10,
  emissiveAmber: 0xff7700,
};

function extrudeCrusher(
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
    bevelSegments: 3,
    curveSegments: 16,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

// 1. BLADE (ブレード) - Obsidian Maul heavy dual-step hammer blade
export function buildBlade(accentColor: number): THREE.Group {
  const bladeGroup = new THREE.Group();
  bladeGroup.position.y = 0.052;
  bladeGroup.scale.y = 0.85;

  const steelGeometries: THREE.BufferGeometry[] = [];

  // Inner octagonal hub plate
  const hubProfile = [
    new THREE.Vector2(0.1, -0.02),
    new THREE.Vector2(0.32, -0.02),
    new THREE.Vector2(0.36, 0.01),
    new THREE.Vector2(0.36, 0.05),
    new THREE.Vector2(0.3, 0.07),
    new THREE.Vector2(0.1, 0.07),
  ];
  steelGeometries.push(new THREE.LatheGeometry(hubProfile, 16));

  // Heavy metal connecting linkage beam across the two hammer heads
  const beamGeom = new THREE.BoxGeometry(0.72, 0.055, 0.22);
  beamGeom.translate(0, 0.045, 0);
  steelGeometries.push(beamGeom);

  // 2 Opposed Heavy Dual-Step Hammer Heads - mathematically 100% 2-fold symmetrical
  for (let i = 0; i < 2; i += 1) {
    const angle = i * Math.PI;

    // Base heavy hammer head shape centered at X ~ 0.36
    const hammerShape = new THREE.Shape();
    hammerShape.moveTo(0.18, -0.14);
    hammerShape.lineTo(0.54, -0.14);
    hammerShape.lineTo(0.61, -0.04);
    hammerShape.lineTo(0.58, 0.08);
    hammerShape.lineTo(0.5, 0.14);
    hammerShape.lineTo(0.22, 0.14);
    hammerShape.lineTo(0.14, 0.08);
    hammerShape.lineTo(0.11, -0.04);
    hammerShape.closePath();

    const hammerGeom = extrudeCrusher(hammerShape, 0.075, 0.016, 0.014);
    hammerGeom.translate(0, 0.04, 0);
    hammerGeom.rotateY(angle);
    steelGeometries.push(hammerGeom);

    // Upper secondary hammer step for dual-layer impact look
    const upperHammerShape = new THREE.Shape();
    upperHammerShape.moveTo(0.25, -0.09);
    upperHammerShape.lineTo(0.51, -0.09);
    upperHammerShape.lineTo(0.55, 0.05);
    upperHammerShape.lineTo(0.21, 0.05);
    upperHammerShape.closePath();

    const upperHammerGeom = extrudeCrusher(upperHammerShape, 0.045, 0.012, 0.01);
    upperHammerGeom.translate(0, 0.095, 0);
    upperHammerGeom.rotateY(angle);
    steelGeometries.push(upperHammerGeom);
  }

  // 2 Side Stabilizer Deflective Armor Wings (at Z = +0.34 and Z = -0.34 for 4-point balance)
  for (let i = 0; i < 2; i += 1) {
    const angle = i * Math.PI + Math.PI / 2;
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0.22, -0.06);
    wingShape.lineTo(0.46, -0.06);
    wingShape.lineTo(0.5, 0.06);
    wingShape.lineTo(0.18, 0.06);
    wingShape.closePath();

    const wingGeom = extrudeCrusher(wingShape, 0.05, 0.01, 0.008);
    wingGeom.translate(0, 0.045, 0);
    wingGeom.rotateY(angle);
    steelGeometries.push(wingGeom);
  }

  const steelMesh = new THREE.Mesh(
    mergeStaticGeometries(steelGeometries),
    new THREE.MeshStandardMaterial({
      color: CRUSHER_STYLE.steel,
      roughness: 0.12,
      metalness: 0.9,
      emissive: 0x20242b,
      emissiveIntensity: 0.35,
    }),
  );
  steelMesh.userData.outlineThickness = 0.014;
  steelMesh.userData.smoothOutline = true;
  bladeGroup.add(steelMesh);

  // 2 Accent Impact Wedges on top of hammer heads - symmetrical
  const wedgeGeometries: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 2; i += 1) {
    const angle = i * Math.PI;
    const wedgeShape = new THREE.Shape();
    wedgeShape.moveTo(0.35, -0.05);
    wedgeShape.lineTo(0.49, -0.05);
    wedgeShape.lineTo(0.47, 0.07);
    wedgeShape.lineTo(0.37, 0.07);
    wedgeShape.closePath();

    const wedgeGeom = extrudeCrusher(wedgeShape, 0.035, 0.008, 0.006);
    wedgeGeom.translate(0, 0.13, 0);
    wedgeGeom.rotateY(angle);
    wedgeGeometries.push(wedgeGeom);
  }

  const wedgesMesh = new THREE.Mesh(
    mergeStaticGeometries(wedgeGeometries),
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.15,
      metalness: 0.85,
    }),
  );
  wedgesMesh.userData.outlineThickness = 0.01;
  bladeGroup.add(wedgesMesh);

  // 2 Emissive Glow Vents (Slots) along linkage frame gaps
  const ventGeometries: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 2; i += 1) {
    const angle = i * Math.PI + Math.PI / 2;
    const ventGeom = new THREE.BoxGeometry(0.1, 0.02, 0.05);
    ventGeom.translate(0.28, 0.09, 0);
    ventGeom.rotateY(angle);
    ventGeometries.push(ventGeom);
  }

  const vents = new THREE.Mesh(
    mergeStaticGeometries(ventGeometries),
    new THREE.MeshBasicMaterial({ color: accentColor, toneMapped: false }),
  );
  vents.userData.noOutline = true;
  bladeGroup.add(vents);

  return bladeGroup;
}

// 2. RATCHET (ラチェット) - Heavy 3-60 Ratchet with copper accents (3-fold symmetry kept under blade boundary)
export function buildRatchet(accentColor: number): THREE.Group {
  const ratchetGroup = new THREE.Group();
  ratchetGroup.position.y = 0.01;

  const coreGeom = new THREE.CylinderGeometry(0.3, 0.32, 0.065, 32);
  const coreMesh = new THREE.Mesh(
    coreGeom,
    new THREE.MeshStandardMaterial({
      color: CRUSHER_STYLE.ratchetPolycarbonate,
      roughness: 0.2,
      metalness: 0.3,
      transparent: true,
      opacity: 0.88,
    }),
  );
  coreMesh.userData.outlineThickness = 0.012;
  ratchetGroup.add(coreMesh);

  const toothGeometries: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i += 1) {
    const angle = (i * Math.PI * 2) / 3;
    const toothShape = new THREE.Shape();
    toothShape.moveTo(0.28, -0.06);
    toothShape.lineTo(0.385, -0.06);
    toothShape.lineTo(0.37, 0.08);
    toothShape.lineTo(0.28, 0.08);
    toothShape.closePath();

    const tooth = extrudeCrusher(toothShape, 0.06, 0.006, 0.006);
    tooth.rotateY(angle);
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

// 3. BIT (ビット) - Heavy Flat Impact Bit with X-Dash gear ring
export function buildBit(accentColor: number): THREE.Group {
  const bitGroup = new THREE.Group();

  // X-Dash gear ring (12 teeth)
  const gearGeometries: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 12; i += 1) {
    const gearTooth = new THREE.BoxGeometry(0.025, 0.06, 0.04);
    gearTooth.translate(0.165, -0.02, 0);
    gearTooth.rotateY((i * Math.PI * 2) / 12);
    gearGeometries.push(gearTooth);
  }

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
    12,
    2,
  ).toNonIndexed();
  facetGeometry.computeVertexNormals();
  facetGeometry.translate(0, -0.1, 0);
  const facets = new THREE.Mesh(
    facetGeometry,
    new THREE.MeshStandardMaterial({
      color: CRUSHER_STYLE.driverGlass,
      transparent: true,
      opacity: 0.65,
      roughness: 0.15,
      metalness: 0.1,
      emissive: CRUSHER_STYLE.driverGlassEmissive,
      emissiveIntensity: 0.4,
    }),
  );
  facets.userData.noOutline = true;
  facets.userData.noShadow = true;
  bitGroup.add(facets);

  // Inner spindle
  const spindle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.15, 12),
    new THREE.MeshStandardMaterial({
      color: CRUSHER_STYLE.spindle,
      roughness: 0.3,
      metalness: 0.7,
    }),
  );
  spindle.position.y = -0.09;
  spindle.userData.noOutline = true;
  bitGroup.add(spindle);

  // Heavy Flat Impact Tip (wide flat ground contact point)
  const contactGeometry = new THREE.CylinderGeometry(0.065, 0.065, 0.05, 24);
  contactGeometry.translate(0, -0.205, 0);
  const contact = new THREE.Mesh(
    contactGeometry,
    new THREE.MeshStandardMaterial({
      color: CRUSHER_STYLE.contact,
      roughness: 0.2,
      metalness: 0.9,
    }),
  );
  contact.userData.outlineThickness = 0.01;
  bitGroup.add(contact);

  const collarGeometry = new THREE.TorusGeometry(0.15, 0.045, 12, 24);
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

// 4. CHIP (晶片 / 核心印記) - Center Obsidian Maul chip
export function buildChip(accentColor: number): THREE.Group {
  const chipGroup = new THREE.Group();
  chipGroup.position.y = 0.165;

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.175, 0.185, 0.13, 32),
    new THREE.MeshStandardMaterial({
      color: CRUSHER_STYLE.chipBase,
      roughness: 0.4,
      metalness: 0.8,
    }),
  );
  base.userData.outlineThickness = 0.014;
  chipGroup.add(base);

  const rimGeometry = new THREE.TorusGeometry(0.165, 0.012, 8, 32);
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
      map: getChipEmblemTexture("crusher", accentColor),
      toneMapped: false,
    }),
  );
  art.position.y = 0.066;
  art.userData.noOutline = true;
  chipGroup.add(art);

  return chipGroup;
}

export const buildCrusherDetailed: DetailedBladeBuilder = (accentColor) => ({
  blade: buildBlade(accentColor),
  ratchet: buildRatchet(accentColor),
  bit: buildBit(accentColor),
  chip: buildChip(accentColor),
});

