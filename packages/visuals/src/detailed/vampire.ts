import * as THREE from "three";
import { mergeStaticGeometries } from "../geometry-utils";
import { getChipEmblemTexture } from "./chip-art";
import type { DetailedBladeBuilder } from "./types";

const VAMPIRE_STYLE = {
  steel: 0x0b0d12,
  darkSteel: 0x4c0519,
  chipBase: 0x1f040a,
  driverGlass: 0xe11d48,
  driverGlassEmissive: 0x881337,
  spindle: 0x3f0717,
  contact: 0x9f1239,
  ratchetPolycarbonate: 0x2e0611,
  obsidianArmor: 0x111827,
  emissiveBlood: 0xff1744,
};

function extrudeVampire(
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

// 1. BLADE (ブレード) - Crimson Eclipse 4 dual-layer blood-fang blade
export function buildBlade(accentColor: number): THREE.Group {
  const bladeGroup = new THREE.Group();
  bladeGroup.position.y = 0.05;

  const steelGeometries: THREE.BufferGeometry[] = [];

  // Central lathe hub
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

  // 4 Razor-Sharp Crescent Blood Fangs (dual-layer: base + upper tip)
  for (let i = 0; i < 4; i += 1) {
    const angle = (i * Math.PI * 2) / 4;

    // Base fang — concave inner curve, sharp outward tip
    const fangShape = new THREE.Shape();
    fangShape.moveTo(-0.13, -0.04);
    fangShape.quadraticCurveTo(0.05, -0.06, 0.2, -0.02);
    fangShape.lineTo(0.42, 0.22); // Razor-sharp outer fang tip
    fangShape.lineTo(0.3, 0.14); // Back upper edge
    fangShape.quadraticCurveTo(0.08, 0.05, -0.13, 0.04); // Concave inner curve
    fangShape.closePath();

    const fangGeom = extrudeVampire(fangShape, 0.065, 0.014, 0.012);
    fangGeom.rotateY(angle + 0.1);
    fangGeom.translate(Math.cos(angle) * 0.3, 0.04, Math.sin(angle) * 0.3);
    steelGeometries.push(fangGeom);

    // Upper fang tip — narrower, sits above the base for dual-layer 3D bevel
    const upperFangShape = new THREE.Shape();
    upperFangShape.moveTo(-0.1, -0.03);
    upperFangShape.quadraticCurveTo(0.04, -0.04, 0.16, -0.01);
    upperFangShape.lineTo(0.34, 0.16); // Sharp upper fang tip
    upperFangShape.lineTo(0.22, 0.11);
    upperFangShape.quadraticCurveTo(0.04, 0.03, -0.1, 0.03);
    upperFangShape.closePath();

    const upperFangGeom = extrudeVampire(upperFangShape, 0.04, 0.01, 0.008);
    upperFangGeom.rotateY(angle + 0.12);
    upperFangGeom.translate(
      Math.cos(angle) * 0.34,
      0.09,
      Math.sin(angle) * 0.34,
    );
    steelGeometries.push(upperFangGeom);
  }

  const steelMesh = new THREE.Mesh(
    mergeStaticGeometries(steelGeometries),
    new THREE.MeshStandardMaterial({
      color: VAMPIRE_STYLE.steel,
      roughness: 0.1,
      metalness: 0.92,
      emissive: 0xcccccc,
      emissiveIntensity: 0.5,
    }),
  );
  steelMesh.userData.outlineThickness = 0.014;
  steelMesh.userData.smoothOutline = true;
  bladeGroup.add(steelMesh);

  // 4 Accent Crimson Spine Claws (sharp angled metal clips between fangs)
  const clawShape = new THREE.Shape();
  clawShape.moveTo(-0.04, -0.03);
  clawShape.lineTo(0.08, -0.01);
  clawShape.lineTo(0.05, 0.09); // Sharp claw tip
  clawShape.lineTo(-0.04, 0.05);
  clawShape.closePath();

  const clawBase = extrudeVampire(clawShape, 0.035, 0.008, 0.006);
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

  // 4 Emissive Crimson Eclipse Glow Vents (slots) between fangs
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

// 2. RATCHET (ラチェット) - 4-60 Ratchet with crimson fang teeth
export function buildRatchet(accentColor: number): THREE.Group {
  const ratchetGroup = new THREE.Group();
  ratchetGroup.position.y = 0.005;

  const coreGeom = new THREE.CylinderGeometry(0.38, 0.4, 0.065, 32);
  const coreMesh = new THREE.Mesh(
    coreGeom,
    new THREE.MeshStandardMaterial({
      color: VAMPIRE_STYLE.ratchetPolycarbonate,
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
    const angle = (i * Math.PI * 2) / 4 + Math.PI / 4;
    // Slightly tapered, inward-curved fang tooth
    const toothShape = new THREE.Shape();
    toothShape.moveTo(-0.06, -0.05);
    toothShape.lineTo(0.06, -0.05);
    toothShape.quadraticCurveTo(0.045, 0.03, 0.02, 0.09);
    toothShape.quadraticCurveTo(-0.045, 0.03, -0.06, -0.05);
    toothShape.closePath();

    const tooth = extrudeVampire(toothShape, 0.06, 0.007, 0.007);
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

// 3. BIT (ビット) - Needle Spire Bit with X-Dash gear ring
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
      color: VAMPIRE_STYLE.driverGlass,
      transparent: true,
      opacity: 0.65,
      roughness: 0.15,
      metalness: 0.1,
      emissive: VAMPIRE_STYLE.driverGlassEmissive,
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
      color: VAMPIRE_STYLE.spindle,
      roughness: 0.3,
      metalness: 0.7,
    }),
  );
  spindle.position.y = -0.09;
  spindle.userData.noOutline = true;
  bitGroup.add(spindle);

  // Needle Spire contact tip (taller, sharper cone for the vampire's needle bit)
  const contactGeometry = new THREE.ConeGeometry(0.06, 0.085, 12);
  contactGeometry.rotateX(Math.PI);
  contactGeometry.translate(0, -0.22, 0);
  const contact = new THREE.Mesh(
    contactGeometry,
    new THREE.MeshStandardMaterial({
      color: VAMPIRE_STYLE.contact,
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

// 4. CHIP (晶片 / 核心印記) - Center Crimson Eclipse chip
export function buildChip(accentColor: number): THREE.Group {
  const chipGroup = new THREE.Group();
  chipGroup.position.y = 0.155;

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.175, 0.185, 0.13, 24),
    new THREE.MeshStandardMaterial({
      color: VAMPIRE_STYLE.chipBase,
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
      map: getChipEmblemTexture("vampire", accentColor),
      toneMapped: false,
    }),
  );
  art.position.y = 0.066;
  art.userData.noOutline = true;
  chipGroup.add(art);

  return chipGroup;
}

export const buildVampireDetailed: DetailedBladeBuilder = (accentColor) => ({
  blade: buildBlade(accentColor),
  ratchet: buildRatchet(accentColor),
  bit: buildBit(accentColor),
  chip: buildChip(accentColor),
});
