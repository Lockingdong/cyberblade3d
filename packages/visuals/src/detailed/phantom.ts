import * as THREE from "three";
import { mergeStaticGeometries } from "../geometry-utils";
import { getChipEmblemTexture } from "./chip-art";
import type { DetailedBladeBuilder } from "./types";

const PHANTOM_STYLE = {
  steel: 0x3a414c,
  darkSteel: 0x3b0764,
  chipBase: 0x17072b,
  driverGlass: 0xa855f7,
  driverGlassEmissive: 0x581c87,
  spindle: 0x4c1d95,
  contact: 0x6b21a8,
  ratchetPolycarbonate: 0x190938,
  emissiveViolet: 0xd8b4fe,
  accentCyan: 0x06b6d4,
};

function extrudePhantom(
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

// 1. BLADE (ブレード) - Phantom Edge 4-scythe metal blade with dual-layer scythe arcs
export function buildBlade(accentColor: number): THREE.Group {
  const bladeGroup = new THREE.Group();
  bladeGroup.position.y = 0.05;

  const steelGeometries: THREE.BufferGeometry[] = [];

  // Dual-tier inner hub disc
  const hubProfile = [
    new THREE.Vector2(0.1, -0.02),
    new THREE.Vector2(0.31, -0.02),
    new THREE.Vector2(0.35, 0.01),
    new THREE.Vector2(0.35, 0.05),
    new THREE.Vector2(0.29, 0.07),
    new THREE.Vector2(0.1, 0.07),
  ];
  steelGeometries.push(new THREE.LatheGeometry(hubProfile, 32));

  // Inner structural reinforcement ring
  const innerRingGeo = new THREE.CylinderGeometry(0.34, 0.37, 0.045, 32, 1, true);
  innerRingGeo.translate(0, 0.04, 0);
  steelGeometries.push(innerRingGeo);

  // 4 Razor-Sharp Crescent Scythe Blade Arcs (Nightblades)
  for (let i = 0; i < 4; i += 1) {
    const angle = (i * Math.PI * 2) / 4;

    // Base razor-sharp scythe blade
    const scytheShape = new THREE.Shape();
    scytheShape.moveTo(-0.16, -0.05);
    scytheShape.quadraticCurveTo(0.06, -0.08, 0.24, -0.04);
    scytheShape.lineTo(0.4, 0.22); // Razor-sharp outer scythe blade tip!
    scytheShape.lineTo(0.28, 0.18); // Crescent back notch
    scytheShape.quadraticCurveTo(0.08, 0.08, -0.14, 0.05); // Concave inner blade curve
    scytheShape.closePath();

    const scytheGeom = extrudePhantom(scytheShape, 0.065, 0.014, 0.012);
    scytheGeom.rotateY(angle + 0.1);
    scytheGeom.translate(Math.cos(angle) * 0.3, 0.04, Math.sin(angle) * 0.3);
    steelGeometries.push(scytheGeom);

    // Upper secondary scythe blade step (adds 3D metallic bevel along sharp edge)
    const upperScytheShape = new THREE.Shape();
    upperScytheShape.moveTo(-0.12, -0.03);
    upperScytheShape.quadraticCurveTo(0.04, -0.05, 0.18, -0.02);
    upperScytheShape.lineTo(0.32, 0.16); // Sharp upper tip point
    upperScytheShape.lineTo(0.22, 0.13);
    upperScytheShape.quadraticCurveTo(0.05, 0.05, -0.1, 0.03);
    upperScytheShape.closePath();

    const upperScytheGeom = extrudePhantom(upperScytheShape, 0.04, 0.01, 0.008);
    upperScytheGeom.rotateY(angle + 0.12);
    upperScytheGeom.translate(Math.cos(angle) * 0.34, 0.09, Math.sin(angle) * 0.34);
    steelGeometries.push(upperScytheGeom);
  }

  const steelMesh = new THREE.Mesh(
    mergeStaticGeometries(steelGeometries),
    new THREE.MeshStandardMaterial({
      color: PHANTOM_STYLE.steel,
      roughness: 0.1,
      metalness: 0.92,
      emissive: 0xcccccc,
      emissiveIntensity: 0.5,
    }),
  );
  steelMesh.userData.outlineThickness = 0.014;
  steelMesh.userData.smoothOutline = true;
  bladeGroup.add(steelMesh);

  // 4 Accent Scythe Spine Claws (sharp angled metal clips)
  const clawShape = new THREE.Shape();
  clawShape.moveTo(-0.04, -0.03);
  clawShape.lineTo(0.08, -0.01);
  clawShape.lineTo(0.04, 0.09); // Sharp claw tip
  clawShape.lineTo(-0.04, 0.05);
  clawShape.closePath();

  const clawBase = extrudePhantom(clawShape, 0.035, 0.008, 0.006);
  clawBase.translate(0, 0.085, 0);

  const clawGeometries: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i += 1) {
    const angle = (i * Math.PI * 2) / 4 + 0.35;
    const clawGeom = clawBase.clone();
    clawGeom.rotateY(angle);
    clawGeom.translate(Math.cos(angle) * 0.42, 0.01, Math.sin(angle) * 0.42);
    clawGeometries.push(clawGeom);
  }
  clawBase.dispose();

  const clawsMesh = new THREE.Mesh(
    mergeStaticGeometries(clawGeometries),
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.15,
      metalness: 0.8,
    }),
  );
  clawsMesh.userData.outlineThickness = 0.01;
  bladeGroup.add(clawsMesh);

  // 4 Emissive Glow Vents (Slots) along scythe inner crescent gaps
  const ventBase = new THREE.BoxGeometry(0.08, 0.018, 0.04);
  const ventGeometries: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i += 1) {
    const angle = (i * Math.PI * 2) / 4 + Math.PI / 4;
    const ventGeom = ventBase.clone();
    ventGeom.rotateY(angle);
    ventGeom.translate(Math.cos(angle) * 0.32, 0.085, Math.sin(angle) * 0.32);
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

// 2. RATCHET (ラチェット) - 4-60 Ratchet
export function buildRatchet(accentColor: number): THREE.Group {
  const ratchetGroup = new THREE.Group();
  ratchetGroup.position.y = 0.005;

  const coreGeom = new THREE.CylinderGeometry(0.38, 0.4, 0.065, 32);
  const coreMesh = new THREE.Mesh(
    coreGeom,
    new THREE.MeshStandardMaterial({
      color: PHANTOM_STYLE.ratchetPolycarbonate,
      roughness: 0.2,
      metalness: 0.3,
      transparent: true,
      opacity: 0.88,
    }),
  );
  coreMesh.userData.outlineThickness = 0.012;
  ratchetGroup.add(coreMesh);

  const toothGeometries: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i += 1) {
    const angle = (i * Math.PI * 2) / 4;
    const toothShape = new THREE.Shape();
    toothShape.moveTo(-0.06, -0.05);
    toothShape.lineTo(0.06, -0.05);
    toothShape.lineTo(0.04, 0.09);
    toothShape.lineTo(-0.04, 0.09);
    toothShape.closePath();

    const tooth = extrudePhantom(toothShape, 0.06, 0.008, 0.008);
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

// 3. BIT (ビット) - Phantom Taper Bit with X-Dash gear ring
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
      color: PHANTOM_STYLE.driverGlass,
      transparent: true,
      opacity: 0.65,
      roughness: 0.15,
      metalness: 0.1,
      emissive: PHANTOM_STYLE.driverGlassEmissive,
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
      color: PHANTOM_STYLE.spindle,
      roughness: 0.3,
      metalness: 0.7,
    }),
  );
  spindle.position.y = -0.09;
  spindle.userData.noOutline = true;
  bitGroup.add(spindle);

  // Taper contact cone tip
  const contactGeometry = new THREE.ConeGeometry(0.075, 0.065, 12);
  contactGeometry.rotateX(Math.PI);
  contactGeometry.translate(0, -0.21, 0);
  const contact = new THREE.Mesh(
    contactGeometry,
    new THREE.MeshStandardMaterial({
      color: PHANTOM_STYLE.contact,
      roughness: 0.2,
      metalness: 0.9,
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

// 4. CHIP (晶片 / 核心印記) - Center Phantom Edge chip
export function buildChip(accentColor: number): THREE.Group {
  const chipGroup = new THREE.Group();
  chipGroup.position.y = 0.155;

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.175, 0.185, 0.13, 24),
    new THREE.MeshStandardMaterial({
      color: PHANTOM_STYLE.chipBase,
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
      map: getChipEmblemTexture("phantom", accentColor),
      toneMapped: false,
    }),
  );
  art.position.y = 0.066;
  art.userData.noOutline = true;
  chipGroup.add(art);

  return chipGroup;
}

export const buildPhantomDetailed: DetailedBladeBuilder = (accentColor) => ({
  blade: buildBlade(accentColor),
  ratchet: buildRatchet(accentColor),
  bit: buildBit(accentColor),
  chip: buildChip(accentColor),
});
