import * as THREE from "three";
import type { BeybladeType } from "@cyberblade/core";

/**
 * How one type's aura looks and moves. Every aura shares the same parts — a
 * soft floor glow, helical light streaks and rising motes, all kept outside
 * the blade so the top itself stays readable — and differs only in these.
 */
interface AuraStyle {
  color: number;
  /** Floor glow radius as a multiple of the blade reach. */
  glowScale: number;
  glowOpacity: number;
  /** Floor glow breathing: angular frequency and relative size swing. */
  glowPulseSpeed: number;
  glowPulseAmount: number;
  streakCount: number;
  streakWidth: number;
  /** Radians of arc each streak wraps around the top. */
  streakArc: number;
  /** Height gained over one streak; ~0 keeps it a flat, shield-like band. */
  streakRise: number;
  /** Radians per second the streaks circle the top. */
  spinSpeed: number;
  /** Seconds for a streak to climb from the floor to the top of the aura. */
  climbSeconds: number;
  height: number;
  /** Alternate streaks climb downward instead of up. */
  alternate: boolean;
  moteCount: number;
  moteSpeed: number;
  moteHeight: number;
}

const AURA_STYLES: Record<BeybladeType, AuraStyle> = {
  // Fire: thin streaks racing upward in a tight spiral, sparks spewing off.
  attack: {
    color: 0xff5a1f,
    glowScale: 1.35,
    glowOpacity: 0.75,
    glowPulseSpeed: 22,
    glowPulseAmount: 0.06,
    streakCount: 5,
    streakWidth: 0.07,
    streakArc: 1.9,
    streakRise: 0.9,
    spinSpeed: 7,
    climbSeconds: 0.45,
    height: 1.25,
    alternate: false,
    moteCount: 28,
    moteSpeed: 2.6,
    moteHeight: 1.6,
  },
  // Shield: wide, low bands slowly circling over the thickest floor glow.
  defense: {
    color: 0x3d8bff,
    glowScale: 1.6,
    glowOpacity: 0.9,
    glowPulseSpeed: 3,
    glowPulseAmount: 0.02,
    streakCount: 6,
    streakWidth: 0.26,
    streakArc: 0.95,
    streakRise: 0.04,
    spinSpeed: 1.4,
    climbSeconds: 2.4,
    height: 0.55,
    alternate: false,
    moteCount: 10,
    moteSpeed: 0.5,
    moteHeight: 0.9,
  },
  // Wind: soft, long streaks turning at an even pace, motes drifting high.
  stamina: {
    color: 0xffc53d,
    glowScale: 1.5,
    glowOpacity: 0.7,
    glowPulseSpeed: 4,
    glowPulseAmount: 0.05,
    streakCount: 4,
    streakWidth: 0.12,
    streakArc: 2.6,
    streakRise: 0.6,
    spinSpeed: 3.2,
    climbSeconds: 1.1,
    height: 1.2,
    alternate: false,
    moteCount: 18,
    moteSpeed: 0.9,
    moteHeight: 2,
  },
  // Resonance: streaks crossing up and down over a visibly beating glow.
  balance: {
    color: 0x2ee88a,
    glowScale: 1.5,
    glowOpacity: 0.75,
    glowPulseSpeed: 7,
    glowPulseAmount: 0.16,
    streakCount: 4,
    streakWidth: 0.1,
    streakArc: 1.8,
    streakRise: 0.6,
    spinSpeed: 2.6,
    climbSeconds: 0.9,
    height: 1.15,
    alternate: true,
    moteCount: 16,
    moteSpeed: 1.2,
    moteHeight: 1.4,
  },
};

const FADE_IN_SECONDS = 0.2;
const FADE_OUT_SECONDS = 0.3;
/** Streaks orbit just outside the blade edge. */
const STREAK_ORBIT = 1.12;
/** Floor glow grid resolution and clearance above the stadium surface. */
const GLOW_SEGMENTS = 16;
const GLOW_LIFT = 0.03;
const UP = new THREE.Vector3(0, 1, 0);
const leanNormal = new THREE.Vector3();

let glowTexture: THREE.DataTexture | null = null;
let streakTexture: THREE.DataTexture | null = null;
let moteTexture: THREE.DataTexture | null = null;

/** White texture whose alpha comes from `alpha(u, v)`; no DOM needed. */
function alphaTexture(
  width: number,
  height: number,
  alpha: (u: number, v: number) => number,
): THREE.DataTexture {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      data[offset] = data[offset + 1] = data[offset + 2] = 255;
      const value = alpha((x + 0.5) / width, (y + 0.5) / height);
      data[offset + 3] = Math.round(THREE.MathUtils.clamp(value, 0, 1) * 255);
    }
  }
  const texture = new THREE.DataTexture(data, width, height);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

const smooth = (edge0: number, edge1: number, x: number) =>
  THREE.MathUtils.smoothstep(x, edge0, edge1);

/** Radial falloff with a brighter band where it meets the blade edge. */
function getGlowTexture(): THREE.DataTexture {
  glowTexture ??= alphaTexture(128, 128, (u, v) => {
    const r = Math.hypot(u - 0.5, v - 0.5) * 2;
    const body = 0.35 * (1 - smooth(0.5, 1, r));
    const band = Math.exp(-(((r - 0.68) / 0.1) ** 2));
    return (body + 0.75 * band) * (1 - smooth(0.9, 1, r));
  });
  return glowTexture;
}

/** Bright head fading to a tail along u, soft across v. */
function getStreakTexture(): THREE.DataTexture {
  streakTexture ??= alphaTexture(128, 16, (u, v) => {
    const along = smooth(0, 0.9, u) * (1 - smooth(0.94, 1, u));
    const across = Math.sin(v * Math.PI);
    return along * across * across;
  });
  return streakTexture;
}

function getMoteTexture(): THREE.DataTexture {
  moteTexture ??= alphaTexture(32, 32, (u, v) => {
    const r = Math.hypot(u - 0.5, v - 0.5) * 2;
    return (1 - smooth(0, 1, r)) ** 2;
  });
  return moteTexture;
}

/** A ribbon wound along a helix: u runs tail→head, v across the width. */
function helixRibbon(
  radius: number,
  arc: number,
  rise: number,
  width: number,
): THREE.BufferGeometry {
  const segments = 24;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const angle = t * arc;
    const x = Math.cos(angle) * radius;
    const z = -Math.sin(angle) * radius;
    const y = t * rise;
    positions.push(x, y - width / 2, z, x, y + width / 2, z);
    uvs.push(t, 0, t, 1);
    if (index < segments) {
      const base = index * 2;
      indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

function additive(color: number, map: THREE.Texture): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    map,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

interface Mote {
  angle: number;
  radius: number;
  phase: number;
}

/** Type-coloured glow, streaks and motes wrapped around a top during its special. */
export class SpecialAura {
  readonly group = new THREE.Group();
  #style: AuraStyle;
  #glow: THREE.Mesh;
  #glowMaterial: THREE.MeshBasicMaterial;
  #glowRadius: number;
  #glowBase: Float32Array;
  #surfaceHeight: (x: number, z: number) => number;
  #streaks: THREE.Mesh[] = [];
  #streakMaterial: THREE.MeshBasicMaterial;
  #streakSpin = new THREE.Group();
  /** Tilts streaks and motes to the bowl slope so they don't sink uphill. */
  #lean = new THREE.Group();
  #motes: Mote[] = [];
  #motePoints: THREE.Points;
  #moteMaterial: THREE.PointsMaterial;
  #reach: number;
  #strength = 0;
  #time = 0;

  /**
   * `surfaceHeight` gives the stadium floor height at a world x/z so the floor
   * glow can drape over the bowl instead of cutting into its slope.
   */
  constructor(
    type: BeybladeType,
    reach: number,
    surfaceHeight: (x: number, z: number) => number,
  ) {
    const style = AURA_STYLES[type];
    this.#style = style;
    this.#reach = reach;
    this.group.name = "special-aura";

    this.#surfaceHeight = surfaceHeight;
    this.#glowRadius = reach * style.glowScale;
    this.#glowMaterial = additive(style.color, getGlowTexture());
    // A unit grid; update() scales and drapes its vertices every frame.
    this.#glow = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2, GLOW_SEGMENTS, GLOW_SEGMENTS).rotateX(
        -Math.PI / 2,
      ),
      this.#glowMaterial,
    );
    this.#glowBase = Float32Array.from(
      this.#glow.geometry.getAttribute("position").array,
    );
    this.#glow.frustumCulled = false;
    this.#glow.renderOrder = 1;

    this.#streakMaterial = additive(
      new THREE.Color(style.color)
        .lerp(new THREE.Color(0xffffff), 0.35)
        .getHex(),
      getStreakTexture(),
    );
    const ribbon = helixRibbon(
      reach * STREAK_ORBIT,
      style.streakArc,
      style.streakRise,
      style.streakWidth,
    );
    for (let index = 0; index < style.streakCount; index += 1) {
      const streak = new THREE.Mesh(ribbon, this.#streakMaterial);
      streak.rotation.y = (index / style.streakCount) * Math.PI * 2;
      streak.renderOrder = 2;
      this.#streaks.push(streak);
      this.#streakSpin.add(streak);
    }

    const positions = new Float32Array(style.moteCount * 3);
    const colors = new Float32Array(style.moteCount * 3);
    for (let index = 0; index < style.moteCount; index += 1) {
      this.#motes.push({
        angle: (index / style.moteCount) * Math.PI * 2 + index * 1.7,
        radius: reach * (1.05 + ((index * 0.37) % 0.4)),
        phase: (index * 0.618) % 1,
      });
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    this.#moteMaterial = new THREE.PointsMaterial({
      color: style.color,
      map: getMoteTexture(),
      size: 0.14,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.#motePoints = new THREE.Points(geometry, this.#moteMaterial);
    this.#motePoints.frustumCulled = false;
    this.#motePoints.renderOrder = 2;

    this.#lean.add(this.#streakSpin, this.#motePoints);
    this.group.add(this.#glow, this.#lean);
    this.group.visible = false;
  }

  #leanToSurface(center: { x: number; z: number }): void {
    const step = 0.05;
    const heightAt = this.#surfaceHeight;
    leanNormal
      .set(
        -(
          heightAt(center.x + step, center.z) -
          heightAt(center.x - step, center.z)
        ),
        2 * step,
        -(
          heightAt(center.x, center.z + step) -
          heightAt(center.x, center.z - step)
        ),
      )
      .normalize();
    this.#lean.quaternion.setFromUnitVectors(UP, leanNormal);
  }

  /** Lays the floor glow on the stadium surface around `center`. */
  #drapeGlow(
    center: { x: number; y: number; z: number },
    radius: number,
  ): void {
    const attribute = this.#glow.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const base = this.#glowBase;
    for (let index = 0; index < attribute.count; index += 1) {
      const x = base[index * 3]! * radius;
      const z = base[index * 3 + 2]! * radius;
      const floor = this.#surfaceHeight(center.x + x, center.z + z);
      attribute.setXYZ(index, x, floor - center.y + GLOW_LIFT, z);
    }
    attribute.needsUpdate = true;
  }

  /** Hides the aura at once, skipping the fade (rematch, burst). */
  reset(): void {
    this.#strength = 0;
    this.group.visible = false;
  }

  update(
    delta: number,
    active: boolean,
    position: { x: number; y: number; z: number },
  ): void {
    const step = delta / (active ? FADE_IN_SECONDS : FADE_OUT_SECONDS);
    this.#strength = THREE.MathUtils.clamp(
      this.#strength + (active ? step : -step),
      0,
      1,
    );
    this.group.visible = this.#strength > 0;
    if (!this.group.visible) {
      this.#time = 0;
      return;
    }
    this.#time += delta;
    const style = this.#style;
    const time = this.#time;
    // Ease so the fade reads as a swell rather than a linear ramp.
    const strength = this.#strength * this.#strength * (3 - 2 * this.#strength);
    this.group.position.set(position.x, position.y, position.z);
    this.#leanToSurface(position);

    const breath = Math.sin(time * style.glowPulseSpeed);
    // Grows out from the top as it fades in.
    const glowSize =
      (0.6 + 0.4 * strength) * (1 + breath * style.glowPulseAmount);
    this.#drapeGlow(position, this.#glowRadius * glowSize);
    this.#glowMaterial.opacity =
      style.glowOpacity *
      strength *
      (1 - style.glowPulseAmount + breath * style.glowPulseAmount);

    this.#streakSpin.rotation.y = time * style.spinSpeed;
    this.#streakMaterial.opacity = strength;
    const climbRange = Math.max(0, style.height - style.streakRise);
    this.#streaks.forEach((streak, index) => {
      const offset = index / style.streakCount;
      if (style.climbSeconds >= 2) {
        // Shield bands bob gently instead of climbing.
        streak.position.y =
          style.streakWidth / 2 +
          0.05 +
          climbRange * (0.5 + 0.5 * Math.sin(time * 2 + offset * Math.PI * 2));
        streak.scale.setScalar(1);
        return;
      }
      let progress = (time / style.climbSeconds + offset) % 1;
      if (style.alternate && index % 2 === 1) progress = 1 - progress;
      streak.position.y = progress * climbRange;
      // Taper in and out at the ends of the climb instead of popping.
      const envelope = Math.sin(progress * Math.PI);
      streak.scale.set(1, Math.max(0.05, envelope), 1);
    });

    this.#moteMaterial.opacity = strength;
    const positions = this.#motePoints.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const colors = this.#motePoints.geometry.getAttribute(
      "color",
    ) as THREE.BufferAttribute;
    this.#motes.forEach((mote, index) => {
      const life =
        (time * (style.moteSpeed / style.moteHeight) + mote.phase) % 1;
      const angle = mote.angle + time * style.spinSpeed * 0.35;
      const radius = mote.radius + life * this.#reach * 0.15;
      positions.setXYZ(
        index,
        Math.cos(angle) * radius,
        life * style.moteHeight,
        Math.sin(angle) * radius,
      );
      const fade = Math.sin(life * Math.PI);
      colors.setXYZ(index, fade, fade, fade);
    });
    positions.needsUpdate = true;
    colors.needsUpdate = true;
  }
}
