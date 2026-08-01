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
// 1. 赤紅核心 (Crimson Core) Emblem: 3-Blade Radiating Slash Mark (No Cross)
function shadeAttackEmblem(x: number, y: number, accent: Rgb): Rgb {
  const len = Math.hypot(x, y);

  // Background: hot red alloy with a dark forged edge.
  let color = mixRgb(
    toRgb(0xd94841),
    toRgb(0x350d16),
    Math.min(1, len) ** 1.2,
  );

  // Glyph: 3-Blade Radiating Curved Slash (3-way rotational symmetry: 30°, 150°, 270°, no cross)
  let sd = sdCircle(x, y, 0, 0, 0.12);
  // 3 radiating slashing arms
  sd = Math.min(sd, sdSegment(x, y, 0, -0.08, 0, -0.58) - 0.07);
  sd = Math.min(sd, sdSegment(x, y, -0.07, 0.04, -0.50, 0.29) - 0.07);
  sd = Math.min(sd, sdSegment(x, y, 0.07, 0.04, 0.50, 0.29) - 0.07);
  // 3 sweeping arc tips
  sd = Math.min(sd, sdSegment(x, y, 0, -0.58, -0.42, -0.36) - 0.05);
  sd = Math.min(sd, sdSegment(x, y, -0.50, 0.29, 0.10, 0.56) - 0.05);
  sd = Math.min(sd, sdSegment(x, y, 0.50, 0.29, 0.32, -0.44) - 0.05);

  color = paint(color, mixRgb(toRgb(0xfff1df), accent, 0.1), sd);

  // Border: thin gold ring inside a narrow deep-red outer band.
  color = paint(color, toRgb(0xecb452), Math.abs(len - 0.8) - 0.02);
  color = paint(color, toRgb(0x47101c), 0.92 - len);
  return color;
}

// 1b. 龍焰核心 (Drake Core) Emblem: Dragon Eye & Ascending Wings Emblem
function shadeDrakeEmblem(x: number, y: number, accent: Rgb): Rgb {
  const len = Math.hypot(x, y);

  // Background: Fiery crimson and dark magma forged steel
  let color = mixRgb(
    toRgb(0xbf1717),
    toRgb(0x1a0505),
    Math.min(1, len) ** 1.3,
  );

  // Central Dragon Eye Pupil
  let sd = sdCircle(x, y, 0, 0, 0.07);
  // Dragon Eye Diamond Frame
  sd = Math.min(sd, sdSegment(x, y, -0.36, 0, 0, 0.18) - 0.045);
  sd = Math.min(sd, sdSegment(x, y, 0, 0.18, 0.36, 0) - 0.045);
  sd = Math.min(sd, sdSegment(x, y, 0.36, 0, 0, -0.18) - 0.045);
  sd = Math.min(sd, sdSegment(x, y, 0, -0.18, -0.36, 0) - 0.045);

  // Ascending Flame Dragon Wings / Horns (Left & Right)
  sd = Math.min(sd, sdSegment(x, y, -0.24, 0.08, -0.55, 0.48) - 0.055);
  sd = Math.min(sd, sdSegment(x, y, -0.55, 0.48, -0.28, 0.52) - 0.04);
  sd = Math.min(sd, sdSegment(x, y, 0.24, 0.08, 0.55, 0.48) - 0.055);
  sd = Math.min(sd, sdSegment(x, y, 0.55, 0.48, 0.28, 0.52) - 0.04);

  // Lower Dragon Jaw / Flame Spine
  sd = Math.min(sd, sdSegment(x, y, 0, -0.18, 0, -0.54) - 0.05);

  color = paint(color, mixRgb(toRgb(0xffe2b3), accent, 0.2), sd);

  // Border: Crimson gold ring inside dark outer band.
  color = paint(color, toRgb(0xf59e0b), Math.abs(len - 0.8) - 0.022);
  color = paint(color, toRgb(0x2a0404), 0.92 - len);
  return color;
}

// 1c. 磐岩核心 (Bastion Core) Emblem: Riveted Shield-Boss with a braced center bar
function shadeBastionEmblem(x: number, y: number, accent: Rgb): Rgb {
  const len = Math.hypot(x, y);

  // Background: warm bronze/amber forged armor - stays in the attack color family
  // but leans metallic and grounded rather than hot-blooded.
  let color = mixRgb(
    toRgb(0xb5651d),
    toRgb(0x2a1608),
    Math.min(1, len) ** 1.25,
  );

  // Glyph: a bilateral shield outline (steadfast stance) with a braced center bar
  // and four rivet dots, echoing the riveted armor plates on the physical chip.
  let sd = sdSegment(x, y, -0.4, -0.3, 0.4, -0.3) - 0.05;
  sd = Math.min(sd, sdSegment(x, y, 0.4, -0.3, 0.32, 0.14) - 0.05);
  sd = Math.min(sd, sdSegment(x, y, 0.32, 0.14, 0, 0.5) - 0.05);
  sd = Math.min(sd, sdSegment(x, y, 0, 0.5, -0.32, 0.14) - 0.05);
  sd = Math.min(sd, sdSegment(x, y, -0.32, 0.14, -0.4, -0.3) - 0.05);
  sd = Math.min(sd, sdSegment(x, y, -0.2, -0.05, 0.2, -0.05) - 0.045);
  sd = Math.min(sd, sdSegment(x, y, 0, -0.22, 0, 0.28) - 0.04);
  sd = Math.min(sd, sdCircle(x, y, -0.22, -0.18, 0.035));
  sd = Math.min(sd, sdCircle(x, y, 0.22, -0.18, 0.035));
  sd = Math.min(sd, sdCircle(x, y, -0.18, 0.28, 0.035));
  sd = Math.min(sd, sdCircle(x, y, 0.18, 0.28, 0.035));

  color = paint(color, mixRgb(toRgb(0xffe8c2), accent, 0.15), sd);

  // Border: bright amber ring inside a dark bronze outer band.
  color = paint(color, toRgb(0xf2a541), Math.abs(len - 0.8) - 0.02);
  color = paint(color, toRgb(0x1a0d04), 0.92 - len);
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

function shadeSilverAegisEmblem(x: number, y: number, accent: Rgb): Rgb {
  const len = Math.hypot(x, y);

  // Cold silver enamel gives this crest its own identity instead of reusing
  // the graphite-and-teal Iron Core shield mark.
  let color = mixRgb(
    toRgb(0xdbe4ec),
    toRgb(0x334155),
    Math.min(1, len) ** 1.35,
  );

  // A tall knight shield with a cross-shaped reinforcing boss.
  let sd = sdSegment(x, y, -0.4, -0.42, 0.4, -0.42) - 0.052;
  sd = Math.min(sd, sdSegment(x, y, 0.4, -0.42, 0.34, 0.14) - 0.052);
  sd = Math.min(sd, sdSegment(x, y, 0.34, 0.14, 0, 0.58) - 0.052);
  sd = Math.min(sd, sdSegment(x, y, 0, 0.58, -0.34, 0.14) - 0.052);
  sd = Math.min(sd, sdSegment(x, y, -0.34, 0.14, -0.4, -0.42) - 0.052);
  sd = Math.min(sd, sdSegment(x, y, 0, -0.28, 0, 0.34) - 0.055);
  sd = Math.min(sd, sdSegment(x, y, -0.25, -0.02, 0.25, -0.02) - 0.055);
  color = paint(color, mixRgb(toRgb(0xffffff), accent, 0.28), sd);

  // Four crown points echo the counter shoulders on the physical blade.
  let crown = sdSegment(x, y, -0.34, -0.55, -0.18, -0.7) - 0.045;
  crown = Math.min(crown, sdSegment(x, y, -0.18, -0.7, 0, -0.54) - 0.045);
  crown = Math.min(crown, sdSegment(x, y, 0, -0.54, 0.18, -0.7) - 0.045);
  crown = Math.min(crown, sdSegment(x, y, 0.18, -0.7, 0.34, -0.55) - 0.045);
  color = paint(color, toRgb(0xf8fafc), crown);

  color = paint(color, mixRgb(toRgb(0x93c5fd), accent, 0.35), Math.abs(len - 0.79) - 0.02);
  color = paint(color, toRgb(0x172033), 0.92 - len);
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

const textureCache = new Map<string, THREE.DataTexture>();

export function getChipEmblemTexture(
  type: string,
  accentColor: number,
): THREE.DataTexture {
  const key = `${type}:${accentColor.toString(16)}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const accent = toRgb(accentColor);
  let shader = shadeAttackEmblem;
  if (type.includes("drake")) shader = shadeDrakeEmblem;
  else if (type.includes("bastion")) shader = shadeBastionEmblem;
  else if (type.includes("aegis")) shader = shadeSilverAegisEmblem;
  else if (type.startsWith("defense")) shader = shadeDefenseEmblem;
  else if (type.startsWith("stamina")) shader = shadeStaminaEmblem;
  else if (type.startsWith("balance")) shader = shadeBalanceEmblem;

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
