import * as THREE from "three";
import type { BeybladeType } from "@game-pool/beyblade-core";

// Emblem art for detailed face chips, rasterized on the CPU from composed 2D
// signed-distance fields into a DataTexture. No canvas/DOM involved so the
// exact same code runs on web, under expo-gl on mobile, and in node tests.
// Edges use a ~1.5px smoothstep — deliberately crisp to match the toon pass.

const SIZE = 256;
const AA = 1.5 * (2 / SIZE);

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function toRgb(hex: number): Rgb {
  return { r: (hex >> 16) & 0xff, g: (hex >> 8) & 0xff, b: hex & 0xff };
}

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Signed distances: negative inside the shape.
function sdCircle(
  px: number,
  py: number,
  cx: number,
  cy: number,
  r: number,
): number {
  return Math.hypot(px - cx, py - cy) - r;
}

// Distance to a line segment; subtracting a radius turns it into a capsule
// (a thick rounded stroke).
function sdSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const t = Math.min(
    1,
    Math.max(0, (apx * abx + apy * aby) / (abx * abx + aby * aby)),
  );
  return Math.hypot(apx - abx * t, apy - aby * t);
}

// Paints `color` over `base` where sd < 0, antialiased across the boundary.
function paint(base: Rgb, color: Rgb, sd: number): Rgb {
  return mixRgb(color, base, smoothstep(-AA, AA, sd));
}

// The printed face is the blade's own badge: the same glyph the home-page
// picker shows in BladeMiniIcon (for attack: a hub dot with three radiating
// strokes), drawn bold in warm white over a red gradient with a gold ring
// border. Keeping the two in sync makes the chip read as "this blade's mark".
function shadeAttackEmblem(x: number, y: number, accent: Rgb): Rgb {
  const len = Math.hypot(x, y);

  // Background: hot red alloy with a dark forged edge.
  let color = mixRgb(
    toRgb(0xd94841),
    toRgb(0x350d16),
    Math.min(1, len) ** 1.2,
  );

  // Glyph: four mirrored impact blades converging on a small core.
  let sd = sdCircle(x, y, 0, 0, 0.13);
  sd = Math.min(sd, sdSegment(x, y, -0.58, -0.54, -0.08, -0.08) - 0.075);
  sd = Math.min(sd, sdSegment(x, y, 0.58, -0.54, 0.08, -0.08) - 0.075);
  sd = Math.min(sd, sdSegment(x, y, -0.58, 0.54, -0.08, 0.08) - 0.075);
  sd = Math.min(sd, sdSegment(x, y, 0.58, 0.54, 0.08, 0.08) - 0.075);
  color = paint(color, mixRgb(toRgb(0xfff1df), accent, 0.1), sd);

  // Border: thin gold ring inside a narrow deep-red outer band. paint() fills
  // where sd < 0, so the outer band uses 0.92 - len (negative outside r 0.92).
  color = paint(color, toRgb(0xecb452), Math.abs(len - 0.8) - 0.02);
  color = paint(color, toRgb(0x47101c), 0.92 - len);
  return color;
}

function shadeDefenseEmblem(x: number, y: number, accent: Rgb): Rgb {
  const len = Math.hypot(x, y);

  // Background: graphite and oxidized teal, deliberately avoiding a blue-sun
  // silhouette while keeping the mark cold, dense, and defensive.
  let color = mixRgb(
    toRgb(0x16434a),
    toRgb(0x07181d),
    Math.min(1, len) ** 1.25,
  );

  // Glyph: a bilateral shield outline with three inset armor bars. This reads
  // as a defensive crest rather than a radial emblem.
  let sd = sdSegment(x, y, -0.42, -0.32, 0.42, -0.32) - 0.055;
  sd = Math.min(sd, sdSegment(x, y, 0.42, -0.32, 0.34, 0.16) - 0.055);
  sd = Math.min(sd, sdSegment(x, y, 0.34, 0.16, 0, 0.58) - 0.055);
  sd = Math.min(sd, sdSegment(x, y, 0, 0.58, -0.34, 0.16) - 0.055);
  sd = Math.min(sd, sdSegment(x, y, -0.34, 0.16, -0.42, -0.32) - 0.055);

  // Center spine and nested horizontal braces give the shield a machined,
  // engineered feel while remaining perfectly mirrored left-to-right.
  sd = Math.min(sd, sdSegment(x, y, 0, -0.2, 0, 0.34) - 0.04);
  sd = Math.min(sd, sdSegment(x, y, -0.23, -0.1, 0.23, -0.1) - 0.04);
  sd = Math.min(sd, sdSegment(x, y, -0.19, 0.07, 0.19, 0.07) - 0.04);
  sd = Math.min(sd, sdSegment(x, y, -0.11, 0.24, 0.11, 0.24) - 0.04);

  color = paint(color, mixRgb(toRgb(0xffd166), accent, 0.08), sd);
  color = paint(color, toRgb(0x2dd4bf), Math.abs(len - 0.77) - 0.018);
  color = paint(color, toRgb(0x020b0e), 0.92 - len);
  return color;
}

function shadeStaminaEmblem(x: number, y: number, accent: Rgb): Rgb {
  const len = Math.hypot(x, y);

  // Background: deep green energy glass.
  let color = mixRgb(
    toRgb(0x047857),
    toRgb(0x022c22),
    Math.min(1, len) ** 1.2,
  );

  // Glyph: nested endurance rings with a balanced center spindle.
  let sd = Math.abs(Math.hypot(x, y) - 0.35) - 0.055;
  sd = Math.min(sd, Math.abs(Math.hypot(x, y) - 0.57) - 0.045);
  sd = Math.min(sd, sdSegment(x, y, 0, -0.2, 0, 0.2) - 0.06);
  sd = Math.min(sd, sdSegment(x, y, -0.2, 0, 0.2, 0) - 0.06);
  color = paint(color, mixRgb(toRgb(0xa7f3d0), accent, 0.15), sd);

  // Border: bright emerald ring inside dark outer band
  color = paint(color, toRgb(0x34d399), Math.abs(len - 0.8) - 0.02);
  color = paint(color, toRgb(0x064e3b), 0.92 - len);
  return color;
}

function shadeBalanceEmblem(x: number, y: number, accent: Rgb): Rgb {
  const len = Math.hypot(x, y);

  // Background: bright emerald/lime gale radial gradient
  let color = mixRgb(
    toRgb(0x65a30d),
    toRgb(0x14532d),
    Math.min(1, len) ** 1.2,
  );

  // Glyph: centered balance diamond and four equal stabilizer arms.
  let sd = sdSegment(x, y, 0, -0.24, 0.24, 0) - 0.065;
  sd = Math.min(sd, sdSegment(x, y, 0.24, 0, 0, 0.24) - 0.065);
  sd = Math.min(sd, sdSegment(x, y, 0, 0.24, -0.24, 0) - 0.065);
  sd = Math.min(sd, sdSegment(x, y, -0.24, 0, 0, -0.24) - 0.065);
  sd = Math.min(sd, sdSegment(x, y, -0.58, 0, -0.28, 0) - 0.045);
  sd = Math.min(sd, sdSegment(x, y, 0.28, 0, 0.58, 0) - 0.045);
  sd = Math.min(sd, sdSegment(x, y, 0, -0.58, 0, -0.28) - 0.045);
  sd = Math.min(sd, sdSegment(x, y, 0, 0.28, 0, 0.58) - 0.045);
  color = paint(color, mixRgb(toRgb(0xecfdf5), accent, 0.2), sd);

  // Border: bright gold ring inside deep emerald outer band
  color = paint(color, toRgb(0xf59e0b), Math.abs(len - 0.8) - 0.02);
  color = paint(color, toRgb(0x052e16), 0.92 - len);
  return color;
}

function shadeCrusherEmblem(x: number, y: number, accent: Rgb): Rgb {
  const len = Math.hypot(x, y);

  // Background: dark obsidian / bronze radial gradient
  let color = mixRgb(
    toRgb(0x451a03),
    toRgb(0x180c04),
    Math.min(1, len) ** 1.2,
  );

  // Glyph: two opposing breaker heads joined by a heavy diagonal axle.
  let sd = sdSegment(x, y, -0.5, -0.48, 0.5, 0.48) - 0.075;
  sd = Math.min(sd, sdSegment(x, y, -0.62, -0.62, -0.32, -0.62) - 0.11);
  sd = Math.min(sd, sdSegment(x, y, 0.32, 0.62, 0.62, 0.62) - 0.11);
  sd = Math.min(sd, sdCircle(x, y, 0, 0, 0.12));
  color = paint(color, mixRgb(toRgb(0xfef3c7), accent, 0.2), sd);

  // Border: bronze/copper ring inside deep obsidian outer band
  color = paint(color, toRgb(0xd97706), Math.abs(len - 0.8) - 0.02);
  color = paint(color, toRgb(0x271206), 0.92 - len);
  return color;
}

function shadePhantomEmblem(x: number, y: number, accent: Rgb): Rgb {
  const len = Math.hypot(x, y);

  // Background: deep purple / shadow void radial gradient
  let color = mixRgb(
    toRgb(0x4c1d95),
    toRgb(0x1e1b4b),
    Math.min(1, len) ** 1.2,
  );

  // Glyph: a symmetrical eclipse with four spectral hooks.
  let sd = Math.abs(Math.hypot(x, y) - 0.34) - 0.065;
  sd = Math.min(sd, sdCircle(x, y, 0, 0, 0.12));
  sd = Math.min(sd, sdSegment(x, y, -0.55, -0.08, -0.24, -0.08) - 0.055);
  sd = Math.min(sd, sdSegment(x, y, 0.24, -0.08, 0.55, -0.08) - 0.055);
  sd = Math.min(sd, sdSegment(x, y, -0.55, 0.08, -0.24, 0.08) - 0.055);
  sd = Math.min(sd, sdSegment(x, y, 0.24, 0.08, 0.55, 0.08) - 0.055);
  color = paint(color, mixRgb(toRgb(0xf3e8ff), accent, 0.15), sd);

  // Border: neon purple/magenta ring inside dark void band
  color = paint(color, toRgb(0xc084fc), Math.abs(len - 0.8) - 0.02);
  color = paint(color, toRgb(0x0f0927), 0.92 - len);
  return color;
}

function shadeAegisEmblem(x: number, y: number, accent: Rgb): Rgb {
  const len = Math.hypot(x, y);

  // Background: deep royal navy / silver radial gradient
  let color = mixRgb(
    toRgb(0x1e293b),
    toRgb(0x0f172a),
    Math.min(1, len) ** 1.2,
  );

  // Glyph: an inset aegis plate with a clean split-chevron mark.
  let sd = sdSegment(x, y, -0.48, -0.28, 0, 0.46) - 0.07;
  sd = Math.min(sd, sdSegment(x, y, 0, 0.46, 0.48, -0.28) - 0.07);
  sd = Math.min(sd, sdSegment(x, y, -0.34, -0.08, 0, 0.22) - 0.06);
  sd = Math.min(sd, sdSegment(x, y, 0, 0.22, 0.34, -0.08) - 0.06);
  sd = Math.min(sd, sdSegment(x, y, -0.18, -0.12, 0.18, -0.12) - 0.045);
  color = paint(color, mixRgb(toRgb(0xf8fafc), accent, 0.1), sd);

  // Border: bright silver ring inside dark navy outer band
  color = paint(color, toRgb(0xcbd5e1), Math.abs(len - 0.8) - 0.02);
  color = paint(color, toRgb(0x020617), 0.92 - len);
  return color;
}

function shadeVampireEmblem(x: number, y: number, accent: Rgb): Rgb {
  const len = Math.hypot(x, y);

  // Background: crimson / blood night radial gradient
  let color = mixRgb(
    toRgb(0x881337),
    toRgb(0x2a040e),
    Math.min(1, len) ** 1.2,
  );

  // Glyph: mirrored bat crest with a compact blood core and two fangs.
  let sd = sdCircle(x, y, 0, 0.04, 0.13);
  sd = Math.min(sd, sdSegment(x, y, -0.1, -0.02, -0.58, -0.34) - 0.075);
  sd = Math.min(sd, sdSegment(x, y, 0.1, -0.02, 0.58, -0.34) - 0.075);
  sd = Math.min(sd, sdSegment(x, y, -0.58, -0.34, -0.3, 0.12) - 0.06);
  sd = Math.min(sd, sdSegment(x, y, 0.58, -0.34, 0.3, 0.12) - 0.06);
  sd = Math.min(sd, sdSegment(x, y, -0.12, 0.12, -0.08, 0.42) - 0.055);
  sd = Math.min(sd, sdSegment(x, y, 0.12, 0.12, 0.08, 0.42) - 0.055);
  color = paint(color, mixRgb(toRgb(0xffe4e6), accent, 0.2), sd);

  // Border: ruby red ring inside dark blood outer band
  color = paint(color, toRgb(0xf43f5e), Math.abs(len - 0.8) - 0.02);
  color = paint(color, toRgb(0x190207), 0.92 - len);
  return color;
}

function shadeZephyrEmblem(x: number, y: number, accent: Rgb): Rgb {
  const len = Math.hypot(x, y);

  // Background: deep cyan / sky rift radial gradient
  let color = mixRgb(
    toRgb(0x0e7490),
    toRgb(0x083344),
    Math.min(1, len) ** 1.2,
  );

  // Glyph: a sharp symmetric wind-chevron with a split tail.
  let sd = sdSegment(x, y, -0.52, -0.38, 0, 0.18) - 0.07;
  sd = Math.min(sd, sdSegment(x, y, 0, 0.18, 0.52, -0.38) - 0.07);
  sd = Math.min(sd, sdSegment(x, y, -0.34, -0.02, -0.58, 0.34) - 0.055);
  sd = Math.min(sd, sdSegment(x, y, 0.34, -0.02, 0.58, 0.34) - 0.055);
  sd = Math.min(sd, sdCircle(x, y, 0, 0.18, 0.1));
  color = paint(color, mixRgb(toRgb(0xe0f2fe), accent, 0.15), sd);

  // Border: bright sky-blue ring inside dark cyan outer band
  color = paint(color, toRgb(0x38bdf8), Math.abs(len - 0.8) - 0.02);
  color = paint(color, toRgb(0x041d27), 0.92 - len);
  return color;
}

function shadeBerserkEmblem(x: number, y: number, accent: Rgb): Rgb {
  const len = Math.hypot(x, y);

  // Background: intense blaze orange / dark flame radial gradient
  let color = mixRgb(
    toRgb(0xc2410c),
    toRgb(0x451a03),
    Math.min(1, len) ** 1.2,
  );

  // Glyph: mirrored furnace jaws around a hot central core.
  let sd = sdCircle(x, y, 0, 0, 0.14);
  sd = Math.min(sd, sdSegment(x, y, -0.12, -0.08, -0.56, -0.54) - 0.085);
  sd = Math.min(sd, sdSegment(x, y, 0.12, -0.08, 0.56, -0.54) - 0.085);
  sd = Math.min(sd, sdSegment(x, y, -0.12, 0.08, -0.56, 0.54) - 0.085);
  sd = Math.min(sd, sdSegment(x, y, 0.12, 0.08, 0.56, 0.54) - 0.085);
  color = paint(color, mixRgb(toRgb(0xfffbe7), accent, 0.2), sd);

  // Border: fiery yellow ring inside deep amber outer band
  color = paint(color, toRgb(0xfde047), Math.abs(len - 0.8) - 0.02);
  color = paint(color, toRgb(0x270d02), 0.92 - len);
  return color;
}

const textureCache = new Map<string, THREE.DataTexture>();

export function getChipEmblemTexture(
  type: BeybladeType,
  accentColor: number,
): THREE.DataTexture {
  const key = `${type}:${accentColor.toString(16)}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const accent = toRgb(accentColor);
  let shader = shadeAttackEmblem;
  if (type === "defense") shader = shadeDefenseEmblem;
  else if (type === "stamina") shader = shadeStaminaEmblem;
  else if (type === "balance") shader = shadeBalanceEmblem;
  else if (type === "crusher") shader = shadeCrusherEmblem;
  else if (type === "phantom") shader = shadePhantomEmblem;
  else if (type === "aegis") shader = shadeAegisEmblem;
  else if (type === "vampire") shader = shadeVampireEmblem;
  else if (type === "zephyr") shader = shadeZephyrEmblem;
  else if (type === "berserk") shader = shadeBerserkEmblem;

  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let row = 0; row < SIZE; row += 1) {
    const y = (row / (SIZE - 1)) * 2 - 1;
    for (let col = 0; col < SIZE; col += 1) {
      const x = (col / (SIZE - 1)) * 2 - 1;
      const { r, g, b } = shader(x, y, accent);
      const offset = (row * SIZE + col) * 4;
      data[offset] = Math.round(r);
      data[offset + 1] = Math.round(g);
      data[offset + 2] = Math.round(b);
      data[offset + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 4;
  texture.userData.shared = true;
  texture.needsUpdate = true;
  textureCache.set(key, texture);
  return texture;
}
