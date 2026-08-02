import * as THREE from "three";
import type { BeybladeType } from "@cyberblade/core";

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
// 1. 赤強晶片 (attack_core) Emblem: 狂龍皇冠 (Crimson Dragon Crown Crest)
function shadeAttackEmblem(x: number, y: number, accent: Rgb): Rgb {
  const len = Math.hypot(x, y);

  // Background: Deep magma crimson gradient
  let color = mixRgb(
    toRgb(0xd92222),
    toRgb(0x260307),
    Math.min(1, len) ** 1.25,
  );

  // Center vertical offset for perfect vertical centering
  const cy = y + 0.02;

  // Central Glowing Dragon Pearl / Core Orb
  let sd = sdCircle(x, cy, 0, 0, 0.08);

  // Dragon Eye Diamond Frame
  sd = Math.min(sd, sdSegment(x, cy, -0.28, 0, 0, 0.15) - 0.045);
  sd = Math.min(sd, sdSegment(x, cy, 0, 0.15, 0.28, 0) - 0.045);
  sd = Math.min(sd, sdSegment(x, cy, 0.28, 0, 0, -0.15) - 0.045);
  sd = Math.min(sd, sdSegment(x, cy, 0, -0.15, -0.28, 0) - 0.045);

  // Triple Dragon Horn Crown (上揚三叉龍角)
  // Center main dragon horn
  sd = Math.min(sd, sdSegment(x, cy, 0, 0.12, 0, 0.36) - 0.048);
  // Left dragon horn
  sd = Math.min(sd, sdSegment(x, cy, -0.12, 0.08, -0.42, 0.46) - 0.048);
  sd = Math.min(sd, sdSegment(x, cy, -0.42, 0.46, -0.24, 0.42) - 0.035);
  // Right dragon horn
  sd = Math.min(sd, sdSegment(x, cy, 0.12, 0.08, 0.42, 0.46) - 0.048);
  sd = Math.min(sd, sdSegment(x, cy, 0.42, 0.46, 0.24, 0.42) - 0.035);

  // Dragon Jaw & Fangs (下顎與龍牙)
  // Left fang
  sd = Math.min(sd, sdSegment(x, cy, -0.18, -0.08, -0.32, -0.42) - 0.045);
  sd = Math.min(sd, sdSegment(x, cy, -0.32, -0.42, -0.15, -0.48) - 0.038);
  // Right fang
  sd = Math.min(sd, sdSegment(x, cy, 0.18, -0.08, 0.32, -0.42) - 0.045);
  sd = Math.min(sd, sdSegment(x, cy, 0.32, -0.42, 0.15, -0.48) - 0.038);
  // Center lower spine
  sd = Math.min(sd, sdSegment(x, cy, 0, -0.15, 0, -0.54) - 0.048);

  color = paint(color, mixRgb(toRgb(0xfff1df), accent, 0.18), sd);

  // Border: Glowing gold ring inside a narrow deep-red outer band.
  color = paint(color, toRgb(0xf59e0b), Math.abs(len - 0.8) - 0.02);
  color = paint(color, toRgb(0x47101c), 0.92 - len);
  return color;
}

// 1b. 龍焰晶片 (attack_drake_chip) Emblem: 龍首展翅 (Dragon Head & Wings - Perfectly Centered)
function shadeDrakeEmblem(x: number, y: number, accent: Rgb): Rgb {
  const len = Math.hypot(x, y);

  // Background: Fiery crimson and dark magma forged steel
  let color = mixRgb(
    toRgb(0xbf1717),
    toRgb(0x1a0505),
    Math.min(1, len) ** 1.3,
  );

  // Offset Y so the whole dragon head & wings glyph is perfectly centered vertically
  const cy = y + 0.02;

  // Central Dragon Eye Pupil & Diamond Core
  let sd = sdCircle(x, cy, 0, 0, 0.065);
  sd = Math.min(sd, sdSegment(x, cy, -0.30, 0, 0, 0.16) - 0.04);
  sd = Math.min(sd, sdSegment(x, cy, 0, 0.16, 0.30, 0) - 0.04);
  sd = Math.min(sd, sdSegment(x, cy, 0.30, 0, 0, -0.16) - 0.04);
  sd = Math.min(sd, sdSegment(x, cy, 0, -0.16, -0.30, 0) - 0.04);

  // Dragon Snout & Fangs (Lower Half)
  sd = Math.min(sd, sdSegment(x, cy, 0, 0, 0, -0.42) - 0.045);
  sd = Math.min(sd, sdSegment(x, cy, -0.15, -0.26, 0, -0.42) - 0.038);
  sd = Math.min(sd, sdSegment(x, cy, 0.15, -0.26, 0, -0.42) - 0.038);

  // Dragon Horns Crown (Upper Half)
  sd = Math.min(sd, sdSegment(x, cy, -0.12, 0.12, -0.38, 0.48) - 0.048);
  sd = Math.min(sd, sdSegment(x, cy, -0.38, 0.48, -0.22, 0.44) - 0.035);
  sd = Math.min(sd, sdSegment(x, cy, 0.12, 0.12, 0.38, 0.48) - 0.048);
  sd = Math.min(sd, sdSegment(x, cy, 0.38, 0.48, 0.22, 0.44) - 0.035);

  // Sweeping Dragon Flame Wings (Left & Right Wings)
  sd = Math.min(sd, sdSegment(x, cy, -0.24, 0.08, -0.56, 0.32) - 0.048);
  sd = Math.min(sd, sdSegment(x, cy, -0.56, 0.32, -0.42, 0.02) - 0.038);
  sd = Math.min(sd, sdSegment(x, cy, 0.24, 0.08, 0.56, 0.32) - 0.048);
  sd = Math.min(sd, sdSegment(x, cy, 0.56, 0.32, 0.42, 0.02) - 0.038);

  color = paint(color, mixRgb(toRgb(0xffe2b3), accent, 0.2), sd);

  // Border: Crimson gold ring inside dark outer band.
  color = paint(color, toRgb(0xf59e0b), Math.abs(len - 0.8) - 0.022);
  color = paint(color, toRgb(0x2a0404), 0.92 - len);
  return color;
}

// 1c. 磐岩晶片 (attack_bastion_chip) Emblem: 龍鱗龍角盾 (Dragon Scale & Horn Shield)
function shadeBastionEmblem(x: number, y: number, accent: Rgb): Rgb {
  const len = Math.hypot(x, y);

  // Background: warm bronze/amber forged dragon armor
  let color = mixRgb(
    toRgb(0xb5651d),
    toRgb(0x2a1608),
    Math.min(1, len) ** 1.25,
  );

  // Dragon Horn Shield Frame
  let sd = sdSegment(x, y, -0.42, -0.3, 0.42, -0.3) - 0.05;
  sd = Math.min(sd, sdSegment(x, y, 0.42, -0.3, 0.35, 0.15) - 0.05);
  sd = Math.min(sd, sdSegment(x, y, 0.35, 0.15, 0, 0.54) - 0.05);
  sd = Math.min(sd, sdSegment(x, y, 0, 0.54, -0.35, 0.15) - 0.05);
  sd = Math.min(sd, sdSegment(x, y, -0.35, 0.15, -0.42, -0.3) - 0.05);

  // Dragon Horn Crests at Top Corners
  sd = Math.min(sd, sdSegment(x, y, -0.38, -0.3, -0.56, -0.5) - 0.045);
  sd = Math.min(sd, sdSegment(x, y, -0.56, -0.5, -0.4, -0.42) - 0.035);
  sd = Math.min(sd, sdSegment(x, y, 0.38, -0.3, 0.56, -0.5) - 0.045);
  sd = Math.min(sd, sdSegment(x, y, 0.56, -0.5, 0.4, -0.42) - 0.035);

  // Dragon Scale Overlapping Armor Lines (Nested V-Shapes)
  sd = Math.min(sd, sdSegment(x, y, -0.22, -0.15, 0, -0.02) - 0.04);
  sd = Math.min(sd, sdSegment(x, y, 0, -0.02, 0.22, -0.15) - 0.04);
  sd = Math.min(sd, sdSegment(x, y, -0.2, 0.06, 0, 0.18) - 0.04);
  sd = Math.min(sd, sdSegment(x, y, 0, 0.18, 0.2, 0.06) - 0.04);
  sd = Math.min(sd, sdSegment(x, y, -0.14, 0.26, 0, 0.38) - 0.035);
  sd = Math.min(sd, sdSegment(x, y, 0, 0.38, 0.14, 0.26) - 0.035);

  // Central Dragon Spine
  sd = Math.min(sd, sdSegment(x, y, 0, -0.24, 0, 0.42) - 0.035);

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

  // Deep royal navy & midnight sapphire gradient background
  let color = mixRgb(
    toRgb(0x1d4ed8),
    toRgb(0x0b132b),
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
  color = paint(color, mixRgb(toRgb(0xf59e0b), accent, 0.28), sd);

  color = paint(color, mixRgb(toRgb(0x38bdf8), accent, 0.35), Math.abs(len - 0.79) - 0.02);
  color = paint(color, toRgb(0x030712), 0.92 - len);
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

function shadeGoldenFalconEmblem(x: number, y: number, accent: Rgb): Rgb {
  const len = Math.hypot(x, y);
  let color = mixRgb(
    toRgb(0x047857),
    toRgb(0x022c22),
    Math.min(1, len) ** 1.15,
  );

  // A sharp falcon head with three swept feather strokes on either side.
  let sd = sdSegment(x, y, -0.24, 0.18, 0.02, -0.22) - 0.065;
  sd = Math.min(sd, sdSegment(x, y, 0.02, -0.22, 0.28, 0.14) - 0.065);
  sd = Math.min(sd, sdSegment(x, y, 0.28, 0.14, 0.06, 0.05) - 0.055);
  sd = Math.min(sd, sdCircle(x, y, 0.09, 0.03, 0.035));
  for (let index = 0; index < 3; index += 1) {
    const offset = index * 0.12;
    sd = Math.min(
      sd,
      sdSegment(x, y, -0.14 - offset, 0.05, -0.62, 0.2 + offset) - 0.045,
    );
    sd = Math.min(
      sd,
      sdSegment(x, y, 0.14 + offset, 0.05, 0.62, 0.2 + offset) - 0.045,
    );
  }
  color = paint(color, mixRgb(toRgb(0xfffbeb), accent, 0.14), sd);
  color = paint(color, toRgb(0xf59e0b), Math.abs(len - 0.8) - 0.025);
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

function shadeChameleonEmblem(x: number, y: number, accent: Rgb): Rgb {
  const len = Math.hypot(x, y);
  let color = mixRgb(
    mixRgb(toRgb(0x312e81), accent, 0.55),
    toRgb(0x160b2d),
    Math.min(1, len) ** 1.18,
  );

  // Side-profile chameleon: rounded head, arched body, feet, and a coiled tail.
  let glyph = sdCircle(x, y, 0.28, -0.08, 0.14);
  glyph = Math.min(glyph, sdSegment(x, y, -0.18, 0.06, 0.24, -0.03) - 0.12);
  glyph = Math.min(glyph, sdSegment(x, y, 0.33, -0.09, 0.48, -0.04) - 0.045);
  glyph = Math.min(glyph, sdSegment(x, y, -0.03, 0.12, 0.05, 0.35) - 0.045);
  glyph = Math.min(glyph, sdSegment(x, y, 0.05, 0.35, 0.2, 0.38) - 0.04);
  glyph = Math.min(glyph, sdSegment(x, y, 0.13, 0.04, 0.22, 0.28) - 0.045);
  glyph = Math.min(glyph, sdSegment(x, y, 0.22, 0.28, 0.37, 0.3) - 0.04);

  let previousX = -0.18;
  let previousY = 0.06;
  for (let index = 1; index <= 12; index += 1) {
    const t = index / 12;
    const angle = t * Math.PI * 2.25;
    const radius = 0.38 * (1 - t * 0.72);
    const nextX = -0.2 - Math.cos(angle) * radius;
    const nextY = 0.02 + Math.sin(angle) * radius;
    glyph = Math.min(
      glyph,
      sdSegment(x, y, previousX, previousY, nextX, nextY) - 0.042,
    );
    previousX = nextX;
    previousY = nextY;
  }
  color = paint(color, mixRgb(toRgb(0x67e8f9), accent, 0.16), glyph);

  // Five bright scales echo the five short wings on the blade.
  for (let index = 0; index < 5; index += 1) {
    const scaleX = -0.12 + index * 0.085;
    const scaleY = 0.015 - Math.abs(index - 2) * 0.018;
    color = paint(color, toRgb(0xa7f3d0), sdCircle(x, y, scaleX, scaleY, 0.025));
  }
  color = paint(color, toRgb(0x0f172a), sdCircle(x, y, 0.31, -0.12, 0.035));
  color = paint(color, toRgb(0x22d3ee), Math.abs(len - 0.8) - 0.022);
  color = paint(color, toRgb(0x160b2d), 0.92 - len);
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
  else if (type.includes("sky_falcon")) shader = shadeGoldenFalconEmblem;
  else if (type.includes("chameleon")) shader = shadeChameleonEmblem;
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
