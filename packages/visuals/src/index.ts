import * as THREE from "three";
import {
  BEYBLADES,
  STADIUMS,
  assembleBeybladeSpec,
  type BattleSnapshot,
  type BeybladeType,
  type BeybladeSpec,
  type SimulationEvent,
  type StadiumTheme,
  type StadiumVariant,
  type TopId,
  type TopSnapshot,
  type EnvironmentScene,
} from "@game-pool/beyblade-core";
import { mergeStaticGeometries } from "./geometry-utils";
import {
  DETAILED_BUILDERS,
  BLADE_BUILDERS,
  RATCHET_BUILDERS,
  BIT_BUILDERS,
  CHIP_BUILDERS,
} from "./detailed";
export {
  BLADE_BUILDERS,
  RATCHET_BUILDERS,
  BIT_BUILDERS,
  CHIP_BUILDERS,
};
import type { DetailedParts } from "./detailed/types";

export * from "./camera";

const MODEL_SCALE = 1.8;
const MODEL_TIP_OFFSET = 0.198;
const UP_VECTOR = new THREE.Vector3(0, 1, 0);
const tempNormal = new THREE.Vector3();

// Amount (0 = original, 1 = pure white) to mix each blade's base color toward
// white for the spinning ground trail so it pops against the dark stadium floor.
const TRAIL_TINT_AMOUNT = 0.55;

function lightenColor(color: number, amount: number): number {
  const tinted = new THREE.Color(color).lerp(new THREE.Color(0xffffff), amount);
  return tinted.getHex();
}

// The stadium bowl follows y = (r/8)^2 * 1.2; ground-hugging effects must sit
// on this surface or they vanish under the bowl away from the center.
function bowlHeight(radius: number): number {
  return (radius / 8) ** 2 * 1.2;
}

function bowlSurfaceNormal(x: number, z: number): THREE.Vector3 {
  const radius = Math.hypot(x, z);
  if (radius < 0.001) return new THREE.Vector3(0, 1, 0);
  const slope = 2 * (1.2 / 64) * radius; // d/dr of bowlHeight
  return new THREE.Vector3(
    (-slope * x) / radius,
    1,
    (-slope * z) / radius,
  ).normalize();
}

interface Spark {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface Shockwave {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  intensity: number;
}

interface CollisionLight {
  light: THREE.PointLight;
  life: number;
  maxLife: number;
  intensity: number;
}

interface Trail {
  mesh: THREE.Object3D;
  life: number;
  intensity: number;
}

interface Debris {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  rotationSpeed: THREE.Vector3;
  life: number;
  maxLife: number;
}

// A beyblade component detached during a burst. Objects are kept (not
// disposed) so reset() can reassemble the top for a rematch.
interface FlyingPart {
  object: THREE.Object3D;
  velocity: THREE.Vector3;
  rotationSpeed: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface ToppleState {
  started: boolean;
  progress: number;
  angleX: number;
  angleZ: number;
}

interface TopVisual {
  readonly id: TopId;
  readonly type: BeybladeType;
  readonly accentColor: number;
  readonly group: THREE.Group;
  readonly parts: THREE.Object3D[];
  spinAngle: number;
  burst: boolean;
  topple: ToppleState;
}

export class BeybladeVisualWorld {
  readonly root = new THREE.Group();
  readonly p1: THREE.Group;
  readonly p2: THREE.Group;
  #tops: Record<TopId, TopVisual>;
  #localTopId: TopId;
  #marker: THREE.Group;
  #snapshot: BattleSnapshot | null = null;
  #sparks: Spark[] = [];
  #trails: Trail[] = [];
  #debris: Debris[] = [];
  #flyingParts: FlyingPart[] = [];
  #time = 0;
  #lastEventTick = 0;

  // Pools and shared visual components for high-performance collision effects
  #sparkGeometry: THREE.ConeGeometry | undefined;
  #sparkMaterials: THREE.MeshBasicMaterial[] = [];
  #sparkPool: THREE.Mesh[] = [];
  #sparkGroup = new THREE.Group();

  #shockwaveGeometry: THREE.RingGeometry | undefined;
  #shockwavePool: THREE.Mesh[] = [];
  #shockwaves: Shockwave[] = [];
  #shockwaveGroup = new THREE.Group();

  #lightPool: THREE.PointLight[] = [];
  #lights: CollisionLight[] = [];
  #lightGroup = new THREE.Group();

  // Environment scene: drives which background builder is used. Bubble field
  // is the only environment object that animates per-frame; everything else
  // is baked once at construction so the mobile frame budget stays flat.
  #sceneType: EnvironmentScene;
  #bubbleField: THREE.Points | null = null;
  #bubblePositions: Float32Array | null = null;
  #bubbleSpeed = 0.4;
  #bubbleTopY = 8;
  #bubbleBottomY = -1;

  constructor(
    p1Type: BeybladeType,
    p2Type: BeybladeType,
    theme: StadiumTheme,
    localTopId: TopId,
    sceneType: EnvironmentScene = "space",
    p1Color?: number,
    p2Color?: number,
    stadiumVariant: StadiumVariant = "dark",
    p1BladeId?: string,
    p1RatchetId?: string,
    p1BitId?: string,
    p1ChipId?: string,
    p2BladeId?: string,
    p2RatchetId?: string,
    p2BitId?: string,
    p2ChipId?: string,
  ) {
    this.root.add(createStadium(theme, stadiumVariant));

    const getSpec = (
      type: BeybladeType,
      bladeId?: string,
      ratchetId?: string,
      bitId?: string,
      chipId?: string,
    ): BeybladeSpec | undefined => {
      if (bladeId || ratchetId || bitId || chipId) {
        return assembleBeybladeSpec({
          type,
          bladeId: bladeId ?? type,
          ratchetId: ratchetId ?? type,
          bitId: bitId ?? type,
          chipId: chipId ?? type,
        });
      }
      return undefined;
    };

    const p1Spec = getSpec(p1Type, p1BladeId, p1RatchetId, p1BitId, p1ChipId);
    const p2Spec = getSpec(p2Type, p2BladeId, p2RatchetId, p2BitId, p2ChipId);

    const p1 = createBeyblade(p1Type, "p1", p1Color, p1Spec);
    const p2 = createBeyblade(p2Type, "p2", p2Color, p2Spec);
    this.#tops = { p1, p2 };
    this.#localTopId = localTopId;
    this.p1 = p1.group;
    this.p2 = p2.group;
    this.#marker = createPlayerMarker();
    // Initialize Pools and Groups
    this.root.add(this.#sparkGroup, this.#shockwaveGroup, this.#lightGroup);

    this.root.add(p1.group, p2.group, this.#marker);

    // Setup Sparks
    this.#sparkGeometry = new THREE.ConeGeometry(0.015, 0.18, 4);
    for (let i = 0; i < 45; i++) {
      const color = [0xffea00, 0xff7700, 0xff2200][i % 3] ?? 0xffea00;
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      this.#sparkMaterials.push(mat);
      const mesh = new THREE.Mesh(this.#sparkGeometry, mat);
      mesh.visible = false;
      this.#sparkGroup.add(mesh);
      this.#sparkPool.push(mesh);
    }

    // Setup Shockwaves
    const ringGeom = new THREE.RingGeometry(0.1, 0.15, 24);
    ringGeom.rotateX(-Math.PI / 2);
    this.#shockwaveGeometry = ringGeom;
    for (let i = 0; i < 6; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffeebb,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.#shockwaveGeometry, mat);
      mesh.visible = false;
      this.#shockwaveGroup.add(mesh);
      this.#shockwavePool.push(mesh);
    }

    // Setup Point Lights
    for (let i = 0; i < 3; i++) {
      const light = new THREE.PointLight(0xffaa44, 0, 6.0);
      light.castShadow = false;
      light.visible = false;
      this.#lightGroup.add(light);
      this.#lightPool.push(light);
    }

    this.#sceneType = sceneType;
    this.#buildEnvironment();
  }

  apply(
    snapshot: BattleSnapshot,
    events: readonly SimulationEvent[],
    tick?: number,
  ): void {
    this.#snapshot = snapshot;
    // Each simulation step's events batch must be consumed exactly once even
    // though render frames and simulation ticks run on separate loops.
    if (tick !== undefined) {
      if (tick <= this.#lastEventTick) return;
      this.#lastEventTick = tick;
    }
    for (const event of events) {
      if (event.type === "collision") {
        this.#spawnSparks(
          new THREE.Vector3(
            event.position.x,
            event.position.y,
            event.position.z,
          ),
          event.intensity,
        );
      } else if (event.type === "trail") {
        const baseColor = this.#tops[event.top].accentColor;
        const color = lightenColor(baseColor, TRAIL_TINT_AMOUNT);
        this.#spawnTrail(
          event.position.x,
          event.position.z,
          color,
          event.intensity,
        );
      } else if (event.type === "burst") {
        this.#burstTop(this.#tops[event.top]);
      }
    }
  }

  update(delta: number): void {
    this.#time += delta;
    if (this.#snapshot) {
      this.#updateTop(this.#tops.p1, this.#snapshot.p1, delta);
      this.#updateTop(this.#tops.p2, this.#snapshot.p2, delta);
      this.#updateMarker(this.#snapshot[this.#localTopId]);
    }
    this.#updateSparks(delta);
    this.#updateTrails(delta);
    this.#updateDebris(delta);
    this.#updateFlyingParts(delta);
    this.#updateShockwaves(delta);
    this.#updateLights(delta);
    this.#updateBubbles(delta);
  }

  #updateBubbles(delta: number): void {
    // Deep-sea only: 80 bubbles slowly rise through a cylinder around the
    // arena and reset to the bottom once they break the surface. One
    // BufferAttribute write per frame keeps this off the hot path.
    if (!this.#bubbleField || !this.#bubblePositions) return;
    const positions = this.#bubblePositions;
    const topY = this.#bubbleTopY;
    const bottomY = this.#bubbleBottomY;
    const speed = this.#bubbleSpeed;
    const count = positions.length / 3;
    for (let i = 0; i < count; i += 1) {
      const base = i * 3 + 1;
      const next = positions[base]! + delta * speed;
      positions[base] = next > topY ? bottomY : next;
    }
    const attribute = this.#bubbleField.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    attribute.needsUpdate = true;
  }

  /** Restore burst/toppled tops for a rematch without rebuilding the scene. */
  reset(): void {
    for (const flying of this.#flyingParts) this.root.remove(flying.object);
    this.#flyingParts = [];
    for (const top of Object.values(this.#tops)) {
      top.burst = false;
      top.spinAngle = 0;
      top.topple = { started: false, progress: 0, angleX: 0, angleZ: 0 };
      top.group.visible = true;
      top.group.rotation.set(0, 0, 0);
      for (const part of top.parts) {
        restorePart(part);
        top.group.add(part);
      }
    }
    this.#clearEffects();
    this.#marker.visible = true;
    this.#snapshot = null;
    this.#lastEventTick = 0;
  }

  #buildEnvironment(): void {
    // Each scene returns a single Group containing all background props.
    // The space scene keeps its existing static dust + starfield + nebula
    // stack; the other four scenes swap in their own skydome + props.
    let scene: THREE.Object3D;
    switch (this.#sceneType) {
      case "space":
        scene = createSpaceEnvironment();
        break;
      case "sunset":
        scene = createSunsetEnvironment();
        break;
      case "deep-sea":
        scene = createDeepSeaEnvironment();
        // Wire the bubble Points into the per-frame updater; everything else
        // in this scene is fully static.
        this.#bubbleField = findBubbleField(scene);
        this.#bubblePositions = this.#bubbleField
          ? (this.#bubbleField.geometry.getAttribute("position")
            .array as Float32Array)
          : null;
        break;
      case "neon-city":
        scene = createNeonCityEnvironment();
        break;
      case "glacier":
        scene = createGlacierEnvironment();
        break;
      default: {
        const _exhaustive: never = this.#sceneType;
        scene = createSpaceEnvironment();
        void _exhaustive;
        break;
      }
    }
    this.root.add(scene);
  }

  dispose(): void {
    // Remove pooled groups first so they aren't disposed in root.traverse()
    this.root.remove(this.#sparkGroup);
    this.root.remove(this.#shockwaveGroup);
    this.root.remove(this.#lightGroup);

    // Now safely traverse and dispose of the rest of the scene (stadium, tops, etc.)
    this.root.traverse((object) => {
      disposeObject(object);
    });
    this.root.clear();

    // Manually dispose of our pooled resources to avoid double-disposal or memory leaks
    if (this.#sparkGeometry) {
      this.#sparkGeometry.dispose();
      this.#sparkGeometry = undefined;
    }
    for (const mat of this.#sparkMaterials) {
      mat.dispose();
    }
    this.#sparkMaterials = [];

    if (this.#shockwaveGeometry) {
      this.#shockwaveGeometry.dispose();
      this.#shockwaveGeometry = undefined;
    }
    for (const mesh of this.#shockwavePool) {
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose();
      }
    }
    for (const wave of this.#shockwaves) {
      if (wave.mesh.material instanceof THREE.Material) {
        wave.mesh.material.dispose();
      }
    }

    // Reset pools
    this.#sparkPool = [];
    this.#sparks = [];
    this.#shockwavePool = [];
    this.#shockwaves = [];
    this.#lightPool = [];
    this.#lights = [];
    this.#trails = [];
    this.#debris = [];
    this.#flyingParts = [];
  }

  #updateTop(top: TopVisual, snapshot: TopSnapshot, delta: number): void {
    // Bursting via snapshot flag is a safety net in case the event was missed.
    if (snapshot.isBurst && !top.burst) this.#burstTop(top);
    if (top.burst) return;

    const radius = Math.hypot(snapshot.position.x, snapshot.position.z);
    const surfaceY = bowlHeight(radius);

    // Before launch (sim clock still at zero) the tops idle upright.
    const battleStarted = (this.#snapshot?.elapsed ?? 0) > 0;
    let tiltX = 0;
    let tiltZ = 0;

    // Centripetal slope tilt: as top gets closer to the stadium edge (radius r),
    // it smoothly tilts inward toward the center (0,0) up to ~22 degrees max tilt.
    if (radius > 0.001) {
      const normR = Math.min(1, radius / 6.5);
      const inwardAngle = normR * 0.38; // Max ~22 degrees tilt at perimeter
      const ux = snapshot.position.x / radius;
      const uz = snapshot.position.z / radius;
      tiltX -= uz * inwardAngle;
      tiltZ += ux * inwardAngle;
    }

    if (!battleStarted) {
      const totalTilt = Math.hypot(tiltX, tiltZ);
      const groundY = surfaceY + MODEL_TIP_OFFSET * Math.cos(totalTilt);
      top.group.position.set(snapshot.position.x, groundY, snapshot.position.z);
      top.group.rotation.set(tiltX, top.spinAngle, tiltZ);
      return;
    }
    if (snapshot.rpm > 0 && !snapshot.isStopped) {
      // Cosmetic spin integrates real RPM; the physics quaternion is ignored
      // because the sphere body rolls and would tumble the model.
      top.spinAngle += (snapshot.rpm / 60) * Math.PI * 2 * delta;
      const rpmRatio = snapshot.rpm / BEYBLADES[top.type].maxRpm;
      if (rpmRatio < 0.6) {
        // Precession wobble grows as the spin runs down.
        const intensity = (1 - rpmRatio) * 0.25;
        const speed = 12 + (1 - rpmRatio) * 8;
        tiltX += Math.sin(this.#time * speed) * intensity;
        tiltZ += Math.cos(this.#time * speed) * intensity;
      }
    } else {
      if (!top.topple.started) {
        let angleX = (Math.random() - 0.5) * 1.3;
        const angleZ = (Math.random() - 0.5) * 1.3;
        if (Math.abs(angleX) < 0.45 && Math.abs(angleZ) < 0.45) angleX = 1.0;
        top.topple = { started: true, progress: 0, angleX, angleZ };
      }
      top.topple.progress = Math.min(1, top.topple.progress + delta * 2.5);
      tiltX += top.topple.angleX * top.topple.progress;
      tiltZ += top.topple.angleZ * top.topple.progress;
    }

    const totalTilt = Math.hypot(tiltX, tiltZ);
    const groundY = surfaceY + MODEL_TIP_OFFSET * Math.cos(totalTilt);
    top.group.position.set(snapshot.position.x, groundY, snapshot.position.z);
    top.group.rotation.set(tiltX, top.spinAngle, tiltZ);
  }

  #updateMarker(snapshot: TopSnapshot): void {
    this.#marker.visible = !snapshot.isBurst;
    const surfaceY = bowlHeight(Math.hypot(snapshot.position.x, snapshot.position.z));
    this.#marker.position.set(
      snapshot.position.x,
      snapshot.position.y + surfaceY + 2.25 + Math.sin(this.#time * 5) * 0.12,
      snapshot.position.z,
    );
  }

  #spawnSparks(position: THREE.Vector3, intensity: number): void {
    const count = Math.min(22, Math.floor(8 + intensity * 3));
    for (let index = 0; index < count; index += 1) {
      const mesh = this.#sparkPool.pop();
      if (!mesh) break; // pool exhausted

      mesh.position.copy(position);
      mesh.position.x += (Math.random() - 0.5) * 0.1;
      mesh.position.y += (Math.random() - 0.5) * 0.05 + 0.05;
      mesh.position.z += (Math.random() - 0.5) * 0.1;
      mesh.position.y = Math.max(
        mesh.position.y,
        bowlHeight(Math.hypot(mesh.position.x, mesh.position.z)) + 0.05,
      );
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * (Math.PI / 2);
      const speed = 1.5 + Math.random() * 4 + intensity * 0.3;

      const velocity = new THREE.Vector3(
        Math.cos(theta) * Math.sin(phi) * speed,
        Math.cos(phi) * speed + 1,
        Math.sin(theta) * Math.sin(phi) * speed,
      );

      mesh.quaternion.setFromUnitVectors(
        UP_VECTOR,
        tempNormal.copy(velocity).normalize(),
      );

      // Reset scale and properties
      mesh.scale.set(1, 1, 1);
      (mesh.material as THREE.MeshBasicMaterial).opacity = 1.0;
      mesh.visible = true;

      this.#sparks.push({
        mesh,
        velocity,
        life: 0,
        maxLife: 0.3 + Math.random() * 0.4,
      });
    }

    // Spawn a shockwave ring
    this.#spawnShockwave(position, intensity);

    // Spawn a light flash
    this.#spawnLight(position, intensity);
  }

  #spawnShockwave(position: THREE.Vector3, intensity: number): void {
    const mesh = this.#shockwavePool.pop();
    if (!mesh) return;

    mesh.position.copy(position);
    mesh.position.y = Math.max(
      mesh.position.y,
      bowlHeight(Math.hypot(mesh.position.x, mesh.position.z)) + 0.02,
    );
    mesh.scale.set(0.01, 0.01, 0.01);
    (mesh.material as THREE.MeshBasicMaterial).opacity = 0.8;
    mesh.visible = true;

    this.#shockwaves.push({
      mesh,
      life: 0,
      maxLife: 0.18,
      intensity,
    });
  }

  #spawnLight(position: THREE.Vector3, intensity: number): void {
    const light = this.#lightPool.pop();
    if (!light) return;

    light.position.copy(position);
    light.position.y += 0.15; // slightly above collision point
    const maxIntensity = Math.min(intensity * 1.5, 8.0);
    light.intensity = maxIntensity;
    light.visible = maxIntensity > 0.1;

    this.#lights.push({
      light,
      life: 0,
      maxLife: 0.12,
      intensity: maxIntensity,
    });
  }

  #spawnTrail(x: number, z: number, color: number, intensity: number): void {
    const group = new THREE.Group();

    const geometry = new THREE.RingGeometry(0.305, 0.355, 20);
    geometry.rotateX(-Math.PI / 2);
    const mainMesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.7 * intensity,
        side: THREE.DoubleSide,
        blending: THREE.NormalBlending,
        depthWrite: false,
      }),
    );
    group.add(mainMesh);

    group.position.set(x, bowlHeight(Math.hypot(x, z)) + 0.03, z);
    group.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      bowlSurfaceNormal(x, z),
    );
    this.root.add(group);
    this.#trails.push({ mesh: group, life: 0, intensity });
  }

  #burstTop(top: TopVisual): void {
    if (top.burst) return;
    top.burst = true;
    const color = top.accentColor;
    const origin = top.group.position.clone();

    // Dismantle the actual components and send them flying.
    top.parts.forEach((part, index) => {
      const worldPosition = new THREE.Vector3();
      part.getWorldPosition(worldPosition);
      top.group.remove(part);
      part.position.copy(worldPosition);
      part.scale.multiplyScalar(MODEL_SCALE);
      this.root.add(part);
      const angle =
        (index * Math.PI * 2) / top.parts.length + Math.random() * 0.5;
      this.#flyingParts.push({
        object: part,
        velocity: new THREE.Vector3(
          Math.cos(angle) * (2.5 + Math.random() * 3.5),
          3 + Math.random() * 4,
          Math.sin(angle) * (2.5 + Math.random() * 3.5),
        ),
        rotationSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
        ),
        life: 0,
        maxLife: 1.5,
      });
    });
    top.group.visible = false;
    if (top.id === this.#localTopId) this.#marker.visible = false;

    // Glowing debris burst on top of the dismantled parts.
    for (let index = 0; index < 25; index += 1) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.08, 0.08),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          blending: THREE.NormalBlending,
        }),
      );
      mesh.position.copy(origin);
      mesh.position.y += 0.1;
      const angle = Math.random() * Math.PI * 2;
      const pitch = Math.random() * Math.PI;
      const speed = 2 + Math.random() * 5;
      this.root.add(mesh);
      this.#debris.push({
        mesh,
        velocity: new THREE.Vector3(
          Math.cos(angle) * Math.sin(pitch) * speed,
          Math.cos(pitch) * speed + 3,
          Math.sin(angle) * Math.sin(pitch) * speed,
        ),
        rotationSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 15,
          (Math.random() - 0.5) * 15,
          (Math.random() - 0.5) * 15,
        ),
        life: 0,
        maxLife: 0.8 + Math.random() * 0.6,
      });
    }
  }

  #updateSparks(delta: number): void {
    for (let index = this.#sparks.length - 1; index >= 0; index -= 1) {
      const spark = this.#sparks[index];
      if (!spark) continue;
      spark.life += delta;
      if (spark.life >= spark.maxLife) {
        spark.mesh.visible = false;
        this.#sparkPool.push(spark.mesh);
        this.#sparks.splice(index, 1);
        continue;
      }
      spark.velocity.y -= 9.8 * delta;
      spark.mesh.position.addScaledVector(spark.velocity, delta);

      const speed = spark.velocity.length();
      if (speed > 0.01) {
        spark.mesh.quaternion.setFromUnitVectors(
          UP_VECTOR,
          tempNormal.copy(spark.velocity).normalize(),
        );
      }

      const ratio = 1 - spark.life / spark.maxLife;
      (spark.mesh.material as THREE.MeshBasicMaterial).opacity = ratio;

      // Speed stretching for motion blur (stretch Y, thin X/Z)
      const lengthScale = ratio * (1.2 + speed * 0.15);
      const widthScale = ratio / (1.0 + speed * 0.05);
      spark.mesh.scale.set(widthScale, lengthScale, widthScale);
    }
  }

  #updateShockwaves(delta: number): void {
    for (let index = this.#shockwaves.length - 1; index >= 0; index -= 1) {
      const wave = this.#shockwaves[index];
      if (!wave) continue;
      wave.life += delta;
      if (wave.life >= wave.maxLife) {
        wave.mesh.visible = false;
        this.#shockwavePool.push(wave.mesh);
        this.#shockwaves.splice(index, 1);
        continue;
      }

      const progress = wave.life / wave.maxLife;
      // Expand shockwave size
      const currentScale = progress * (3.5 + wave.intensity * 0.3);
      wave.mesh.scale.set(currentScale, 1, currentScale);

      // Fade out
      (wave.mesh.material as THREE.MeshBasicMaterial).opacity =
        0.8 * (1 - progress);
    }
  }

  #updateLights(delta: number): void {
    for (let index = this.#lights.length - 1; index >= 0; index -= 1) {
      const lightState = this.#lights[index];
      if (!lightState) continue;
      lightState.life += delta;
      if (lightState.life >= lightState.maxLife) {
        lightState.light.visible = false;
        lightState.light.intensity = 0;
        this.#lightPool.push(lightState.light);
        this.#lights.splice(index, 1);
        continue;
      }

      // Exponential decay for natural flash fade-out
      const decay = Math.exp(-delta * 25);
      lightState.light.intensity *= decay;
      if (lightState.light.intensity < 0.05) {
        lightState.light.visible = false;
      }
    }
  }

  #updateTrails(delta: number): void {
    for (let index = this.#trails.length - 1; index >= 0; index -= 1) {
      const trail = this.#trails[index];
      if (!trail) continue;
      trail.life += delta;
      if (trail.life >= 0.4) {
        this.root.remove(trail.mesh);
        disposeObject(trail.mesh);
        this.#trails.splice(index, 1);
        continue;
      }
      const scale = 1 + (trail.life / 0.4) * 2;
      trail.mesh.scale.set(scale, 1, scale);

      const opacityRatio = 1 - trail.life / 0.4;
      trail.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material as THREE.MeshBasicMaterial;
          const isOutline = child.position.y < -0.001;
          const baseOpacity = isOutline ? 0.8 : 0.7;
          mat.opacity = baseOpacity * trail.intensity * opacityRatio;
        }
      });
    }
  }

  #updateDebris(delta: number): void {
    for (let index = this.#debris.length - 1; index >= 0; index -= 1) {
      const debris = this.#debris[index];
      if (!debris) continue;
      debris.life += delta;
      if (debris.life >= debris.maxLife) {
        this.root.remove(debris.mesh);
        disposeObject(debris.mesh);
        this.#debris.splice(index, 1);
        continue;
      }
      debris.velocity.y -= 9.8 * delta;
      debris.velocity.x *= 0.98;
      debris.velocity.z *= 0.98;
      debris.mesh.position.addScaledVector(debris.velocity, delta);
      debris.mesh.rotation.x += debris.rotationSpeed.x * delta;
      debris.mesh.rotation.y += debris.rotationSpeed.y * delta;
      debris.mesh.rotation.z += debris.rotationSpeed.z * delta;
      (debris.mesh.material as THREE.MeshBasicMaterial).opacity =
        1 - debris.life / debris.maxLife;
    }
  }

  #updateFlyingParts(delta: number): void {
    for (let index = this.#flyingParts.length - 1; index >= 0; index -= 1) {
      const flying = this.#flyingParts[index];
      if (!flying) continue;
      flying.life += delta;
      if (flying.life >= flying.maxLife) {
        // Keep the object alive for reset() — the top's parts list still
        // references it; only stop rendering and tracking it.
        this.root.remove(flying.object);
        this.#flyingParts.splice(index, 1);
        continue;
      }
      flying.velocity.y -= 9.8 * delta;
      flying.object.position.addScaledVector(flying.velocity, delta);
      flying.object.rotation.x += flying.rotationSpeed.x * delta;
      flying.object.rotation.y += flying.rotationSpeed.y * delta;
      flying.object.rotation.z += flying.rotationSpeed.z * delta;
      const opacityRatio = 1 - flying.life / flying.maxLife;
      flying.object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          for (const material of toMaterialList(child.material)) {
            material.transparent = true;
            material.opacity =
              ((material.userData.baseOpacity as number) ?? 1) * opacityRatio;
          }
        }
      });
    }
  }

  #clearEffects(): void {
    for (const spark of this.#sparks) {
      spark.mesh.visible = false;
      this.#sparkPool.push(spark.mesh);
    }
    this.#sparks = [];

    for (const wave of this.#shockwaves) {
      wave.mesh.visible = false;
      this.#shockwavePool.push(wave.mesh);
    }
    this.#shockwaves = [];

    for (const lightState of this.#lights) {
      lightState.light.visible = false;
      lightState.light.intensity = 0;
      this.#lightPool.push(lightState.light);
    }
    this.#lights = [];

    for (const trail of this.#trails) {
      this.root.remove(trail.mesh);
      disposeObject(trail.mesh);
    }
    this.#trails = [];

    for (const debris of this.#debris) {
      this.root.remove(debris.mesh);
      disposeObject(debris.mesh);
    }
    this.#debris = [];
  }
}

/** A single, idle top used by loadout screens and other non-battle previews. */
export class BeybladePreviewWorld {
  readonly root = new THREE.Group();
  #top: TopVisual;
  #colorOverride: number | undefined;
  #time = 0;
  #isExploded = false;
  #explodeFactor = 0;

  constructor(type: BeybladeType, colorOverride?: number, customSpec?: BeybladeSpec) {
    this.#colorOverride = colorOverride;
    this.#top = createBeyblade(type, "p1", colorOverride, customSpec);
    this.root.add(this.#top.group);
    this.root.scale.setScalar(0.9);
    this.root.position.y = 0.3;
    this.root.rotation.x = -0.18;
  }

  setExploded(exploded: boolean): void {
    this.#isExploded = exploded;
  }

  setType(type: BeybladeType, customSpec?: BeybladeSpec): void {
    const next = createBeyblade(type, "p1", this.#colorOverride, customSpec);
    this.root.remove(this.#top.group);
    disposeObject(this.#top.group);
    this.#top = next;
    this.root.add(next.group);
    this.#explodeFactor = this.#isExploded ? 1 : 0;
  }

  update(delta: number): void {
    this.#time += delta;
    const targetFactor = this.#isExploded ? 1 : 0;
    this.#explodeFactor +=
      (targetFactor - this.#explodeFactor) * Math.min(1, delta * 8);

    const f = this.#explodeFactor;
    // Animate 4 parts apart vertically (blade, ratchet, bit, chip)
    const offsets = [0.18 * f, -0.05 * f, -0.35 * f, 0.45 * f];
    this.#top.parts.forEach((part, idx) => {
      const homeY = (part.userData.homePosition as THREE.Vector3)?.y ?? 0;
      part.position.y = homeY + (offsets[idx] ?? 0);
    });

    if (this.#isExploded) {
      this.#top.spinAngle += delta * 0.9;
    } else {
      this.#top.spinAngle += delta * 2.6;
    }
    this.#top.group.rotation.y = this.#top.spinAngle;
    this.#top.group.position.y = Math.sin(this.#time * 1.8) * 0.06;
  }

  dispose(): void {
    disposeObject(this.#top.group);
    this.root.clear();
  }
}

function createStadium(
  theme: StadiumTheme,
  variant: StadiumVariant = "dark",
): THREE.Group {
  const stadium =
    STADIUMS.find(
      (entry) => entry.type === theme && entry.variant === variant,
    ) ?? STADIUMS.find((entry) => entry.type === theme) ?? STADIUMS[0]!;
  const group = new THREE.Group();

  const points: THREE.Vector2[] = [];
  for (let index = 0; index <= 40; index += 1) {
    const ratio = index / 40;
    points.push(new THREE.Vector2(ratio * 8, ratio * ratio * 1.2));
  }
  const bowl = new THREE.Mesh(
    new THREE.LatheGeometry(points, 64),
    new THREE.MeshStandardMaterial({
      color: stadium.floor,
      metalness: 0.25,
      roughness: 0.55,
      side: THREE.DoubleSide,
    }),
  );
  bowl.receiveShadow = true;
  group.add(bowl);

  // Theme-specific static floor line art (replaces the old GridHelper).
  group.add(createFloorPattern(stadium));

  // Inner playfield rings
  for (const [radius, width, color] of [
    [1.5, 0.05, stadium.primary],
    [3.5, 0.06, stadium.secondary],
  ] as const) {
    const geometry = new THREE.RingGeometry(radius, radius + width, 32);
    geometry.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
    );
    ring.position.y = 0.02;
    group.add(ring);
  }

  // Two emissive glow rings around the center emblem, batched into one mesh
  const glowGeometries = [1.0, 2.5].map((radius) => {
    const glowGeometry = new THREE.RingGeometry(radius, radius + 0.03, 64);
    glowGeometry.rotateX(-Math.PI / 2);
    glowGeometry.translate(0, 0.03, 0);
    return glowGeometry;
  });
  const glow = new THREE.Mesh(
    mergeStaticGeometries(glowGeometries),
    new THREE.MeshBasicMaterial({
      color: stadium.floorEmissive,
      side: THREE.DoubleSide,
      toneMapped: false,
      transparent: true,
      opacity: 0.85,
    }),
  );
  group.add(glow);

  // Center emblem disc (theme-specific)
  group.add(createCenterEmblem(stadium));

  // Four curved wall arcs with gaps between them — the gaps line up with the
  // physics pockets so what you see matches where a top can be knocked out.
  const wallRadius = 7.9;
  const wallHeight = 0.8;
  const wallY = wallHeight / 2 + 0.9;
  const pipeGeometries: THREE.BufferGeometry[] = [];
  const wallEdgeGeometries: THREE.BufferGeometry[] = [];
  for (let index = 0; index < 4; index += 1) {
    const angle = (index * Math.PI * 2) / 4 + Math.PI / 4;
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(
        wallRadius,
        wallRadius,
        wallHeight,
        32,
        1,
        true,
        angle - 0.5,
        1.0,
      ),
      new THREE.MeshStandardMaterial({
        color: stadium.wall,
        roughness: 0.5,
        metalness: 0.15,
        side: THREE.DoubleSide,
      }),
    );
    wall.position.y = wallY;
    group.add(wall);

    // Double emissive piping along the top of the wall (inner + outer).
    for (const offset of [-0.04, 0.04]) {
      const pipe = new THREE.CylinderGeometry(
        wallRadius,
        wallRadius,
        0.04,
        32,
        1,
        true,
        angle - 0.5,
        1.0,
      );
      pipe.translate(0, wallY + wallHeight / 2 + 0.005 + offset, 0);
      pipeGeometries.push(pipe);
    }

    // Edge outline overlay on the wall
    const edgeSource = new THREE.CylinderGeometry(
      wallRadius,
      wallRadius,
      wallHeight,
      8,
      1,
      true,
      angle - 0.5,
      1.0,
    );
    const edges = new THREE.EdgesGeometry(edgeSource);
    edgeSource.dispose();
    edges.translate(0, wallY, 0);
    wallEdgeGeometries.push(edges);
  }
  // All eight pipes render as one mesh, all four edge outlines as one line set.
  const pipes = new THREE.Mesh(
    mergeStaticGeometries(pipeGeometries),
    new THREE.MeshBasicMaterial({
      color: stadium.primary,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
  group.add(pipes);
  const wallEdges = new THREE.LineSegments(
    mergeStaticGeometries(wallEdgeGeometries),
    new THREE.LineBasicMaterial({ color: 0x020106 }),
  );
  group.add(wallEdges);

  // Four danger zone energy bars in the gaps between wall arcs, one mesh.
  const barGeometries = [0, Math.PI / 2, Math.PI, Math.PI * 1.5].map(
    (angle) => {
      const bar = new THREE.PlaneGeometry(0.8, wallHeight + 0.2);
      // Face the stadium center, matching what lookAt() did per mesh.
      bar.rotateY(Math.atan2(-Math.cos(angle), -Math.sin(angle)));
      bar.translate(Math.cos(angle) * 7.5, wallY, Math.sin(angle) * 7.5);
      return bar;
    },
  );
  const bars = new THREE.Mesh(
    mergeStaticGeometries(barGeometries),
    new THREE.MeshBasicMaterial({
      color: stadium.accent,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55 * stadium.accentIntensity,
      toneMapped: false,
    }),
  );
  group.add(bars);

  // Dark pocket openings with emissive inner glow + outline edges. Each of
  // the four layers is batched across all four pockets into one draw call.
  const pocketRadius = 7.5;
  const pocketGeometries: THREE.BufferGeometry[] = [];
  const innerGlowGeometries: THREE.BufferGeometry[] = [];
  const borderGeometries: THREE.BufferGeometry[] = [];
  const pocketEdgeGeometries: THREE.BufferGeometry[] = [];
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const x = Math.cos(angle) * pocketRadius;
    const z = Math.sin(angle) * pocketRadius;

    const pocket = new THREE.CircleGeometry(0.8, 16);
    pocket.rotateX(-Math.PI / 2);
    pocket.translate(x, 1.06, z);
    pocketGeometries.push(pocket);

    const innerGlow = new THREE.CircleGeometry(0.7, 24);
    innerGlow.rotateX(-Math.PI / 2);
    innerGlow.translate(x, 1.05, z);
    innerGlowGeometries.push(innerGlow);

    const border = new THREE.RingGeometry(0.78, 0.82, 16);
    border.rotateX(-Math.PI / 2);
    border.translate(x, 1.07, z);
    borderGeometries.push(border);

    const edgeSource = new THREE.CircleGeometry(0.8, 24);
    const pocketEdges = new THREE.EdgesGeometry(edgeSource);
    edgeSource.dispose();
    pocketEdges.rotateX(-Math.PI / 2);
    pocketEdges.translate(x, 1.08, z);
    pocketEdgeGeometries.push(pocketEdges);
  }
  group.add(
    new THREE.Mesh(
      mergeStaticGeometries(pocketGeometries),
      new THREE.MeshBasicMaterial({ color: 0x020105 }),
    ),
    new THREE.Mesh(
      mergeStaticGeometries(innerGlowGeometries),
      new THREE.MeshBasicMaterial({
        color: stadium.primary,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5,
        toneMapped: false,
      }),
    ),
    new THREE.Mesh(
      mergeStaticGeometries(borderGeometries),
      new THREE.MeshBasicMaterial({
        color: stadium.secondary,
        side: THREE.DoubleSide,
      }),
    ),
    new THREE.LineSegments(
      mergeStaticGeometries(pocketEdgeGeometries),
      new THREE.LineBasicMaterial({ color: 0x020106 }),
    ),
  );
  applyToonAndOutline(group, 0.04, 0x020106);
  return group;
}

function createFloorPattern(stadium: {
  type: StadiumTheme;
  primary: number;
  floorEmissive: number;
  secondary: number;
}): THREE.Group {
  const group = new THREE.Group();
  if (stadium.type === "neon") {
    // Concentric static rings + 24 emissive tick marks at the outer ring.
    // Rings share one mesh and the ticks another.
    const ringGeometries = [2, 4, 5, 6, 7].map((radius) => {
      const ringGeom = new THREE.RingGeometry(
        radius - 0.012,
        radius + 0.012,
        64,
      );
      ringGeom.rotateX(-Math.PI / 2);
      ringGeom.translate(0, 0.015, 0);
      return ringGeom;
    });
    const rings = new THREE.Mesh(
      mergeStaticGeometries(ringGeometries),
      new THREE.MeshBasicMaterial({
        color: stadium.primary,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.4,
        toneMapped: false,
      }),
    );
    group.add(rings);

    const tickGeometries: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 24; i += 1) {
      const angle = (i / 24) * Math.PI * 2;
      const tick = new THREE.PlaneGeometry(0.5, 0.05);
      tick.rotateZ(-angle);
      tick.rotateX(-Math.PI / 2);
      tick.translate(Math.cos(angle) * 7.3, 0.025, Math.sin(angle) * 7.3);
      tickGeometries.push(tick);
    }
    const ticks = new THREE.Mesh(
      mergeStaticGeometries(tickGeometries),
      new THREE.MeshBasicMaterial({
        color: stadium.floorEmissive,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        toneMapped: false,
      }),
    );
    group.add(ticks);
  } else if (stadium.type === "toxic") {
    // Tree-like crack lines radiating from eight seed points, one line set.
    const startPoints: ReadonlyArray<readonly [number, number]> = [
      [4, 0],
      [-4, 0],
      [0, 4],
      [0, -4],
      [3, 3],
      [-3, 3],
      [3, -3],
      [-3, -3],
    ];
    const segmentPoints: THREE.Vector3[] = [];
    for (const [sx, sz] of startPoints) {
      const points: THREE.Vector3[] = [new THREE.Vector3(sx, 0.02, sz)];
      let x = sx;
      let z = sz;
      for (let j = 0; j < 5; j += 1) {
        x += Math.sin(sx * 0.7 + sz * 0.3 + j) * 0.9;
        z += Math.cos(sx * 0.3 - sz * 0.3 + j * 1.7) * 0.9;
        if (Math.hypot(x, z) > 7.4) break;
        points.push(new THREE.Vector3(x, 0.02, z));
      }
      appendPolylineSegments(segmentPoints, points);
    }
    const cracks = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(segmentPoints),
      new THREE.LineBasicMaterial({
        color: stadium.floorEmissive,
        transparent: true,
        opacity: 0.7,
      }),
    );
    group.add(cracks);
  } else {
    // Irregular polygon outlines scattered across the bowl, one line set.
    const segmentPoints: THREE.Vector3[] = [];
    for (let i = 0; i < 7; i += 1) {
      const cx = Math.sin(i * 1.3) * 4.5;
      const cz = Math.cos(i * 2.1) * 4.5;
      const sides = 5 + (i % 3);
      const radius = 0.9 + (i % 2) * 0.6;
      const shape: THREE.Vector3[] = [];
      for (let s = 0; s <= sides; s += 1) {
        const a = (s / sides) * Math.PI * 2;
        shape.push(
          new THREE.Vector3(
            cx + Math.cos(a) * radius,
            0.02,
            cz + Math.sin(a) * radius,
          ),
        );
      }
      appendPolylineSegments(segmentPoints, shape);
    }
    const polygons = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(segmentPoints),
      new THREE.LineBasicMaterial({
        color: stadium.floorEmissive,
        transparent: true,
        opacity: 0.7,
      }),
    );
    group.add(polygons);
  }
  return group;
}

function createCenterEmblem(stadium: {
  type: StadiumTheme;
  primary: number;
  floorEmissive: number;
}): THREE.Group {
  const group = new THREE.Group();
  group.position.y = 0.05;

  // Base disc
  const base = new THREE.Mesh(
    new THREE.CircleGeometry(0.6, 32),
    new THREE.MeshStandardMaterial({
      color: stadium.primary,
      emissive: stadium.floorEmissive,
      emissiveIntensity: 0.4,
      metalness: 0.6,
      roughness: 0.3,
      side: THREE.DoubleSide,
    }),
  );
  base.geometry.rotateX(-Math.PI / 2);
  group.add(base);

  // Emissive ring around base
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.62, 0.7, 32),
    new THREE.MeshBasicMaterial({
      color: stadium.floorEmissive,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
  ring.geometry.rotateX(-Math.PI / 2);
  group.add(ring);

  // The theme-specific detail pieces all share one material, so they are
  // batched into a single mesh.
  if (stadium.type === "neon") {
    // Hex cog: six radial teeth around the base
    const toothGeometries: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2;
      const tooth = new THREE.BoxGeometry(0.4, 0.08, 0.12);
      tooth.rotateY(-angle);
      tooth.translate(Math.cos(angle) * 0.5, 0.08, Math.sin(angle) * 0.5);
      toothGeometries.push(tooth);
    }
    const teeth = new THREE.Mesh(
      mergeStaticGeometries(toothGeometries),
      new THREE.MeshStandardMaterial({
        color: 0xeeeeee,
        emissive: stadium.floorEmissive,
        emissiveIntensity: 0.6,
        metalness: 0.85,
        roughness: 0.2,
      }),
    );
    group.add(teeth);
  } else if (stadium.type === "toxic") {
    // Three-blade leaf pattern
    const leafGeometries: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 3; i += 1) {
      const angle = (i / 3) * Math.PI * 2;
      const leaf = new THREE.BoxGeometry(0.55, 0.05, 0.2);
      leaf.rotateY(-angle + Math.PI / 2);
      leaf.translate(Math.cos(angle) * 0.35, 0.06, Math.sin(angle) * 0.35);
      leafGeometries.push(leaf);
    }
    const leaves = new THREE.Mesh(
      mergeStaticGeometries(leafGeometries),
      new THREE.MeshStandardMaterial({
        color: 0xdddddd,
        emissive: stadium.floorEmissive,
        emissiveIntensity: 0.55,
        metalness: 0.6,
        roughness: 0.3,
      }),
    );
    group.add(leaves);
  } else {
    // Ring of fire: eight small cones around the base
    const flameGeometries: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      const flame = new THREE.ConeGeometry(0.1, 0.3, 4);
      flame.translate(Math.cos(angle) * 0.55, 0.15, Math.sin(angle) * 0.55);
      flameGeometries.push(flame);
    }
    const flames = new THREE.Mesh(
      mergeStaticGeometries(flameGeometries),
      new THREE.MeshStandardMaterial({
        color: stadium.floorEmissive,
        emissive: stadium.floorEmissive,
        emissiveIntensity: 0.9,
        metalness: 0.2,
        roughness: 0.4,
      }),
    );
    group.add(flames);
  }

  return group;
}

function createBeyblade(
  type: BeybladeType,
  id: TopId,
  colorOverride?: number,
  customSpec?: BeybladeSpec,
): TopVisual {
  const spec = customSpec ?? BEYBLADES[type];
  const color = colorOverride ?? spec.color;
  const group = new THREE.Group();
  group.scale.setScalar(MODEL_SCALE);

  const bladeFn = BLADE_BUILDERS[spec.bladeId];
  const ratchetFn = RATCHET_BUILDERS[spec.ratchetId];
  const bitFn = BIT_BUILDERS[spec.bitId];
  const chipFn = CHIP_BUILDERS[spec.chipId];

  if (!bladeFn || !ratchetFn || !bitFn || !chipFn) {
    throw new Error(
      `Missing visual builder for component parts: blade=${spec.bladeId}, ratchet=${spec.ratchetId}, bit=${spec.bitId}, chip=${spec.chipId}`
    );
  }

  const blade = bladeFn(color);
  const ratchet = ratchetFn(color);
  const bit = bitFn(color);
  const chip = chipFn(color);

  const parts = [blade, ratchet, bit, chip];
  group.add(...parts);
  applyToonAndOutline(group, 0.022, 0x020106);
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      if (object.userData.isOutline) {
        object.castShadow = false;
        object.receiveShadow = false;
      } else {
        // Translucent parts opt out of casting: shadow maps treat them as
        // opaque, and a hard shadow under "glass" breaks the read.
        object.castShadow = object.userData.noShadow !== true;
        object.receiveShadow = true;
      }
      for (const material of toMaterialList(object.material)) {
        material.userData.baseOpacity = material.opacity;
        material.userData.baseTransparent = material.transparent;
      }
    }
  });
  for (const part of parts) {
    part.userData.homePosition = part.position.clone();
    part.userData.homeRotation = part.rotation.clone();
    part.userData.homeScale = part.scale.clone();
  }
  return {
    id,
    type,
    accentColor: color,
    group,
    parts,
    spinAngle: 0,
    burst: false,
    topple: { started: false, progress: 0, angleX: 0, angleZ: 0 },
  };
}

function createPlayerMarker(): THREE.Group {
  const marker = new THREE.Group();
  marker.name = "player-marker";
  const triangle = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.32, 3),
    new THREE.MeshBasicMaterial({
      color: 0x39ff14,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.95,
    }),
  );
  triangle.rotation.z = Math.PI;
  marker.add(triangle);
  marker.traverse((object) => {
    object.renderOrder = 100;
  });
  return marker;
}

function restorePart(part: THREE.Object3D): void {
  const home = part.userData;
  if (home.homePosition instanceof THREE.Vector3) {
    part.position.copy(home.homePosition);
  }
  if (home.homeRotation instanceof THREE.Euler) {
    part.rotation.copy(home.homeRotation);
  }
  if (home.homeScale instanceof THREE.Vector3) {
    part.scale.copy(home.homeScale);
  }
  part.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      for (const material of toMaterialList(child.material)) {
        material.opacity = (material.userData.baseOpacity as number) ?? 1;
        material.transparent =
          (material.userData.baseTransparent as boolean) ?? false;
      }
    }
  });
}

function toMaterialList(
  material: THREE.Material | THREE.Material[],
): THREE.Material[] {
  return Array.isArray(material) ? material : [material];
}

// Flattens a polyline into the point-pair layout LineSegments expects, so
// several separate strokes can share one geometry and draw call.
function appendPolylineSegments(
  target: THREE.Vector3[],
  points: THREE.Vector3[],
): void {
  for (let index = 0; index < points.length - 1; index += 1) {
    target.push(points[index]!, points[index + 1]!);
  }
}

export function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (
      child instanceof THREE.Mesh ||
      child instanceof THREE.Points ||
      child instanceof THREE.Line ||
      child instanceof THREE.LineSegments
    ) {
      const geometry = child.geometry;
      const material = child.material;
      if (geometry) geometry.dispose();
      if (material) {
        toMaterialList(material).forEach((mat) => {
          const m = mat as THREE.Material & { map?: THREE.Texture };
          // Textures flagged as shared live in a module-level cache (e.g. the
          // chip emblem art) and outlive any single mesh.
          if (m.map && m.map.userData.shared !== true) m.map.dispose();
          mat.dispose();
        });
      }
    }
  });
}

let sharedGradientMap: THREE.Texture | null = null;
function createStepGradientMap(): THREE.Texture {
  if (sharedGradientMap) return sharedGradientMap;
  const colors = new Uint8Array([76, 76, 76, 153, 153, 153, 255, 255, 255]);
  const texture = new THREE.DataTexture(colors, 3, 1, THREE.RedFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  sharedGradientMap = texture;
  return texture;
}

// Averages normals across coincident vertices so an inverted-hull outline on
// hard-edged geometry (extrusions, non-indexed merges) stays closed at creases
// instead of tearing open along each face's own displacement direction.
function weldOutlineNormals(geometry: THREE.BufferGeometry): void {
  const positionAttribute = geometry.getAttribute("position");
  const normalAttribute = geometry.getAttribute("normal");
  if (!positionAttribute || !normalAttribute) return;
  const groups = new Map<string, { n: [number, number, number]; indices: number[] }>();
  for (let i = 0; i < positionAttribute.count; i++) {
    const key =
      `${Math.round(positionAttribute.getX(i) * 1e4)},` +
      `${Math.round(positionAttribute.getY(i) * 1e4)},` +
      `${Math.round(positionAttribute.getZ(i) * 1e4)}`;
    let entry = groups.get(key);
    if (!entry) {
      entry = { n: [0, 0, 0], indices: [] };
      groups.set(key, entry);
    }
    entry.n[0] += normalAttribute.getX(i);
    entry.n[1] += normalAttribute.getY(i);
    entry.n[2] += normalAttribute.getZ(i);
    entry.indices.push(i);
  }
  for (const { n, indices } of groups.values()) {
    const length = Math.hypot(n[0], n[1], n[2]) || 1;
    for (const i of indices) {
      normalAttribute.setXYZ(i, n[0] / length, n[1] / length, n[2] / length);
    }
  }
  normalAttribute.needsUpdate = true;
}

function addOutline(
  mesh: THREE.Mesh,
  thickness: number,
  color: number,
  smoothNormals = false,
): void {
  const geometry = mesh.geometry.clone();
  if (smoothNormals) weldOutlineNormals(geometry);
  const positionAttribute = geometry.getAttribute("position");
  const normalAttribute = geometry.getAttribute("normal");

  if (positionAttribute && normalAttribute) {
    for (let i = 0; i < positionAttribute.count; i++) {
      const vx = positionAttribute.getX(i);
      const vy = positionAttribute.getY(i);
      const vz = positionAttribute.getZ(i);
      const nx = normalAttribute.getX(i);
      const ny = normalAttribute.getY(i);
      const nz = normalAttribute.getZ(i);
      positionAttribute.setXYZ(
        i,
        vx + nx * thickness,
        vy + ny * thickness,
        vz + nz * thickness,
      );
    }
    positionAttribute.needsUpdate = true;
  }

  const material = new THREE.MeshBasicMaterial({
    color,
    side: THREE.BackSide,
  });

  const outlineMesh = new THREE.Mesh(geometry, material);
  outlineMesh.userData.isOutline = true;
  mesh.add(outlineMesh);
}

function applyToonAndOutline(
  object: THREE.Object3D,
  outlineThickness: number,
  outlineColor: number,
): void {
  const meshesToProcess: THREE.Mesh[] = [];

  object.traverse((child) => {
    if (child instanceof THREE.Mesh && !child.userData.isOutline) {
      meshesToProcess.push(child);
    }
  });

  const gradientMap = createStepGradientMap();

  for (const mesh of meshesToProcess) {
    const origMaterials = toMaterialList(mesh.material);
    const newMaterials = origMaterials.map((orig) => {
      if (orig instanceof THREE.MeshBasicMaterial) {
        return orig;
      }
      const m = orig as THREE.Material & {
        color?: THREE.Color;
        emissive?: THREE.Color;
        emissiveIntensity?: number;
        map?: THREE.Texture | null;
      };
      const toon = new THREE.MeshToonMaterial({
        opacity: orig.opacity,
        transparent: orig.transparent,
        side: orig.side,
        gradientMap: gradientMap,
        emissiveIntensity: m.emissiveIntensity ?? 1,
      });
      if (m.color !== undefined) toon.color = m.color;
      if (m.emissive !== undefined) toon.emissive = m.emissive;
      if (m.map) toon.map = m.map;
      return toon;
    });

    mesh.material = newMaterials.length === 1 ? newMaterials[0]! : newMaterials;

    // Meshes can opt out of (noOutline) or fine-tune (outlineThickness,
    // smoothOutline) the inked silhouette — thin blade layers need a thinner
    // welded hull, and transparent/flat parts look wrong with one at all.
    if (outlineThickness > 0 && mesh.userData.noOutline !== true) {
      const thickness =
        (mesh.userData.outlineThickness as number | undefined) ??
        outlineThickness;
      addOutline(
        mesh,
        thickness,
        outlineColor,
        mesh.userData.smoothOutline === true,
      );
    }
  }
}

function createStaticDust(): THREE.Points {
  // 80 small dust motes scattered in a cylinder above the bowl. Positions
  // are baked once so the cloud is fully static between frames.
  const count = 80;
  const positions = new Float32Array(count * 3);
  // Deterministic pseudo-random so the layout is identical on every reload.
  let seed = 1337;
  const rand = (): number => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < count; i += 1) {
    const r = Math.sqrt(rand()) * 8;
    const a = rand() * Math.PI * 2;
    positions[i * 3 + 0] = Math.cos(a) * r;
    positions[i * 3 + 1] = 1.5 + rand() * 6;
    positions[i * 3 + 2] = Math.sin(a) * r;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xc8e4ff,
    size: 0.05,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.name = "static-dust";
  return points;
}

function createStarfield(): THREE.Points {
  // 240 static stars in a 60-unit sphere shell around the arena.
  const count = 240;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  let seed = 7919;
  const rand = (): number => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < count; i += 1) {
    // Spherical shell distribution, biased outward.
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    const r = 40 + rand() * 25;
    positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi) + 4;
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    const tint = 0.6 + rand() * 0.4;
    colors[i * 3 + 0] = tint;
    colors[i * 3 + 1] = tint * (0.9 + rand() * 0.1);
    colors[i * 3 + 2] = tint;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 0.18,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.name = "starfield";
  return points;
}

function createNebulaPlanes(): THREE.Group {
  // Two large semi-transparent emissive discs at the horizon to suggest a
  // distant nebula. Both are placed once and never updated.
  const group = new THREE.Group();
  const palette = [
    { color: 0x2a3a8a, position: [-30, 8, -40] as const, scale: 38 },
    { color: 0x6a1a7a, position: [32, 6, -38] as const, scale: 32 },
    { color: 0x1a6a8a, position: [0, 14, -50] as const, scale: 50 },
  ];
  for (const p of palette) {
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(p.scale, 32),
      new THREE.MeshBasicMaterial({
        color: p.color,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );
    disc.position.set(p.position[0], p.position[1], p.position[2]);
    disc.lookAt(0, p.position[1], 0);
    group.add(disc);
  }
  return group;
}

// Shared skydome helper. Builds a large inverted cylinder composed of
// stacked "bands" (BackSide, MeshBasicMaterial, depthWrite:false,
// vertexColors:true) so each scene can supply a vertical gradient with
// exactly one draw call and no shaders.
function createGradientSkydome(
  colors: readonly [number, number, number, number],
  radius = 80,
  segments = 24,
): THREE.Mesh {
  const bands = colors.length;
  const yMin = -radius * 0.4;
  const yMax = radius * 0.8;
  const bandHeight = (yMax - yMin) / bands;

  const positions: number[] = [];
  const colorBuffer: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;
  for (let i = 0; i < bands; i += 1) {
    const yLow = yMin + bandHeight * i;
    const yHigh = yLow + bandHeight;
    const color = new THREE.Color(colors[i]!);
    for (let s = 0; s < segments; s += 1) {
      const a0 = (s / segments) * Math.PI * 2;
      const a1 = ((s + 1) / segments) * Math.PI * 2;
      const cos0 = Math.cos(a0);
      const sin0 = Math.sin(a0);
      const cos1 = Math.cos(a1);
      const sin1 = Math.sin(a1);
      const r = radius;
      const corners = [
        r * cos0,
        yLow,
        r * sin0,
        r * cos1,
        yLow,
        r * sin1,
        r * cos1,
        yHigh,
        r * sin1,
        r * cos0,
        yHigh,
        r * sin0,
      ];
      for (let v = 0; v < 4; v += 1) {
        positions.push(
          corners[v * 3]!,
          corners[v * 3 + 1]!,
          corners[v * 3 + 2]!,
        );
        colorBuffer.push(color.r, color.g, color.b);
      }
      const base = vertexOffset + s * 4;
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    vertexOffset += segments * 4;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(positions), 3),
  );
  geometry.setAttribute(
    "color",
    new THREE.BufferAttribute(new Float32Array(colorBuffer), 3),
  );
  geometry.setIndex(indices);
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const dome = new THREE.Mesh(geometry, material);
  dome.name = "skydome";
  dome.renderOrder = -10;
  return dome;
}

// The original space scene composition (kept exactly as-is for backward
// compat with the existing test).
function createSpaceEnvironment(): THREE.Group {
  const group = new THREE.Group();
  group.name = "space-environment";
  group.add(createStaticDust());
  group.add(createStarfield());
  group.add(createNebulaPlanes());
  return group;
}

function createSunsetEnvironment(): THREE.Group {
  const group = new THREE.Group();
  group.name = "sunset-environment";
  // Skydome: gradient runs bottom (warm horizon) -> top (cool purple zenith).
  // createGradientSkydome takes colors in bottom-to-top order, so the warm
  // sunset palette sits at the bottom and the dusk purple at the top.
  group.add(createGradientSkydome([0xffc070, 0xf08040, 0xa83858, 0x3a1456]));
  // Wide warm horizon glow: a flat ring around the bowl at eye level that
  // sells the "sun is just below the horizon" feel. Additive blending so it
  // brightens whatever gradient band is behind it.
  const horizonGlow = new THREE.Mesh(
    new THREE.RingGeometry(14, 55, 48),
    new THREE.MeshBasicMaterial({
      color: 0xff9a44,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      fog: false,
    }),
  );
  horizonGlow.rotation.x = -Math.PI / 2;
  horizonGlow.position.y = 0.2;
  horizonGlow.name = "sunset-horizon-glow";
  group.add(horizonGlow);
  // Sun: bright core disc + two additive halo rings for the soft falloff.
  const sunY = 3.5;
  const sunZ = -42;
  const sunCore = new THREE.Mesh(
    new THREE.CircleGeometry(3.2, 32),
    new THREE.MeshBasicMaterial({
      color: 0xfff0c8,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    }),
  );
  sunCore.position.set(0, sunY, sunZ);
  sunCore.lookAt(0, sunY, 0);
  sunCore.name = "sun-disc";
  group.add(sunCore);
  const haloSpecs = [
    { radius: 5.5, color: 0xffc070, opacity: 0.55 },
    { radius: 9.0, color: 0xff8838, opacity: 0.28 },
  ];
  for (const halo of haloSpecs) {
    const ring = new THREE.Mesh(
      new THREE.CircleGeometry(halo.radius, 48),
      new THREE.MeshBasicMaterial({
        color: halo.color,
        transparent: true,
        opacity: halo.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
    );
    ring.position.set(0, sunY, sunZ - 0.1);
    ring.lookAt(0, sunY, 0);
    ring.name = "sun-halo";
    group.add(ring);
  }
  // 7 cloud silhouette planes, merged into a single draw call. Clouds that
  // sit near the sun's y get a warmer tint to suggest sunlit edges.
  const cloudSpecs: Array<{
    x: number;
    y: number;
    z: number;
    w: number;
    h: number;
    warm: boolean;
  }> = [
      { x: -22, y: 6, z: -38, w: 16, h: 2.2, warm: true },
      { x: -10, y: 9, z: -44, w: 20, h: 2, warm: true },
      { x: 12, y: 7, z: -40, w: 18, h: 2.4, warm: true },
      { x: 26, y: 10, z: -42, w: 12, h: 2, warm: true },
      { x: -6, y: 16, z: -50, w: 24, h: 1.6, warm: false },
      { x: 18, y: 18, z: -52, w: 14, h: 1.4, warm: false },
      { x: -30, y: 14, z: -46, w: 10, h: 1.8, warm: false },
    ];
  const cloudColors: number[] = [];
  const cloudPositions: number[] = [];
  const cloudIndices: number[] = [];
  let cloudVertexOffset = 0;
  const warmColor = new THREE.Color(0x7a2a2a);
  const coolColor = new THREE.Color(0x2a0a3a);
  for (const c of cloudSpecs) {
    const w = c.w;
    const h = c.h;
    const color = c.warm ? warmColor : coolColor;
    cloudPositions.push(
      c.x - w / 2,
      c.y - h / 2,
      c.z,
      c.x + w / 2,
      c.y - h / 2,
      c.z,
      c.x + w / 2,
      c.y + h / 2,
      c.z,
      c.x - w / 2,
      c.y + h / 2,
      c.z,
    );
    for (let v = 0; v < 4; v += 1) {
      cloudColors.push(color.r, color.g, color.b);
    }
    const base = cloudVertexOffset;
    cloudIndices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    cloudVertexOffset += 4;
  }
  const cloudGeom = new THREE.BufferGeometry();
  cloudGeom.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(cloudPositions), 3),
  );
  cloudGeom.setAttribute(
    "color",
    new THREE.BufferAttribute(new Float32Array(cloudColors), 3),
  );
  cloudGeom.setIndex(cloudIndices);
  const cloudMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    fog: false,
  });
  const clouds = new THREE.Mesh(cloudGeom, cloudMat);
  clouds.name = "sunset-clouds";
  group.add(clouds);
  return group;
}

function createDeepSeaEnvironment(): THREE.Group {
  const group = new THREE.Group();
  group.name = "deep-sea-environment";
  // Mid-water teal at the visible bands (0-1), brighter surface hints above.
  // The original "darkest at bottom" palette vanished into a near-black void
  // when the camera sat at y=10 and only saw the lower two bands.
  group.add(createGradientSkydome([0x0a3a48, 0x0e4a58, 0x1a6078, 0x2a8090]));
  // Bubble field: 80 points distributed in a cylinder around the arena. The
  // Y component is animated in #updateBubbles.
  const count = 80;
  const positions = new Float32Array(count * 3);
  let seed = 2024;
  const rand = (): number => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < count; i += 1) {
    const r = Math.sqrt(rand()) * 7.5;
    const a = rand() * Math.PI * 2;
    positions[i * 3 + 0] = Math.cos(a) * r;
    positions[i * 3 + 1] = -1 + rand() * 9; // -1 to 8
    positions[i * 3 + 2] = Math.sin(a) * r;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xfafff5,
    size: 0.1,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    toneMapped: false,
  });
  const bubbles = new THREE.Points(geometry, material);
  bubbles.name = "bubble-field";
  group.add(bubbles);
  // God rays: 4 vertical light shafts, all placed BEHIND the arena (z < 0)
  // and outside the stadium bowl (radius >= 14) so they never sit between
  // the camera and the action. The previous placement (radius 7-8 with some
  // rays in the z>0 half) put two of the pillars in front of the arena,
  // which blocked the camera. Each ray is a tall PlaneGeometry rotated to
  // face the arena centre so it always reads as a vertical beam of light.
  const rayGeoms: THREE.BufferGeometry[] = [];
  const raySpecs = [
    { angle: 3.4, radius: 14, width: 2.6, height: 22, opacity: 0.22 },
    { angle: 4.0, radius: 15, width: 3.0, height: 24, opacity: 0.18 },
    { angle: 5.0, radius: 15, width: 2.4, height: 22, opacity: 0.2 },
    { angle: 5.6, radius: 14, width: 2.8, height: 22, opacity: 0.16 },
  ];
  const rayDummy = new THREE.Object3D();
  for (const r of raySpecs) {
    const plane = new THREE.PlaneGeometry(r.width, r.height);
    const x = Math.cos(r.angle) * r.radius;
    const z = Math.sin(r.angle) * r.radius;
    rayDummy.position.set(x, 10, z);
    rayDummy.lookAt(0, 10, 0);
    rayDummy.updateMatrix();
    plane.applyMatrix4(rayDummy.matrix);
    rayGeoms.push(plane);
  }
  const raysMerged = mergeStaticGeometries(rayGeoms);
  const rays = new THREE.Mesh(
    raysMerged,
    new THREE.MeshBasicMaterial({
      color: 0x9cdcff,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      fog: false,
    }),
  );
  rays.name = "god-rays";
  group.add(rays);
  return group;
}

function createNeonCityEnvironment(): THREE.Group {
  const group = new THREE.Group();
  group.name = "neon-city-environment";
  // Synthwave sky: hot pink at the horizon, magenta/purple mid, dark navy
  // at the top. The camera mostly sees bands 0-1 so they have to carry the
  // signature neon glow that backlights the city silhouette.
  group.add(createGradientSkydome([0xff3a7a, 0xc01a4a, 0x4a0a2a, 0x0a0a2a]));
  // Synthwave sun: a bright magenta disc sitting on the horizon, behind the
  // city. Two additive halos mimic the classic gradient-sun look without any
  // textures or extra draw calls beyond the halos.
  const sunY = 4.5;
  const sunZ = -38;
  const sunCore = new THREE.Mesh(
    new THREE.CircleGeometry(3.0, 32),
    new THREE.MeshBasicMaterial({
      color: 0xfff0a8,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    }),
  );
  sunCore.position.set(0, sunY, sunZ);
  sunCore.lookAt(0, sunY, 0);
  sunCore.name = "neon-sun";
  group.add(sunCore);
  const neonHaloSpecs = [
    { radius: 5.0, color: 0xff4a8a, opacity: 0.6 },
    { radius: 8.5, color: 0xff2a5a, opacity: 0.32 },
  ];
  for (const halo of neonHaloSpecs) {
    const ring = new THREE.Mesh(
      new THREE.CircleGeometry(halo.radius, 48),
      new THREE.MeshBasicMaterial({
        color: halo.color,
        transparent: true,
        opacity: halo.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
    );
    ring.position.set(0, sunY, sunZ - 0.1);
    ring.lookAt(0, sunY, 0);
    ring.name = "neon-sun-halo";
    group.add(ring);
  }
  // Hot-pink ground glow at the horizon line. Same trick as the sunset's
  // horizon glow: a flat ring on the ground with additive blending.
  const horizonGlow = new THREE.Mesh(
    new THREE.RingGeometry(14, 55, 48),
    new THREE.MeshBasicMaterial({
      color: 0xff4a8a,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      fog: false,
    }),
  );
  horizonGlow.rotation.x = -Math.PI / 2;
  horizonGlow.position.y = 0.2;
  horizonGlow.name = "neon-horizon-glow";
  group.add(horizonGlow);
  // City skyline: ~24 boxes arranged in a 200° arc behind the arena,
  // merged into a single draw call. Color nudged up from the old 0x140820
  // (indistinguishable from the sky) so the silhouette reads against the
  // bright horizon.
  const boxGeoms: THREE.BufferGeometry[] = [];
  const skylineSpecs: Array<{
    angle: number;
    h: number;
    w: number;
    d: number;
  }> = [];
  let seed = 31415;
  const rand = (): number => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const boxCount = 24;
  for (let i = 0; i < boxCount; i += 1) {
    const t = i / (boxCount - 1);
    // 200° arc centred behind the arena (-Z).
    const angle = -Math.PI * 0.55 + t * Math.PI * 1.1;
    const h = 6 + rand() * 14;
    const w = 2 + rand() * 3;
    const d = 1.5 + rand() * 1.5;
    const r = 32;
    const box = new THREE.BoxGeometry(w, h, d);
    box.translate(Math.sin(angle) * r, h * 0.5 - 1.5, -Math.cos(angle) * r);
    boxGeoms.push(box);
    skylineSpecs.push({ angle, h, w, d });
  }
  const cityMerged = mergeStaticGeometries(boxGeoms);
  const cityMat = new THREE.MeshBasicMaterial({
    color: 0x0a0210,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
    fog: true,
  });
  const city = new THREE.Mesh(cityMerged, cityMat);
  city.name = "neon-skyline";
  group.add(city);
  // A few emissive window lines as a single LineSegments.
  const windowPoints: THREE.Vector3[] = [];
  const windowColors: number[] = [];
  const neonPalette = [0xff66cc, 0x66ffff, 0xffaa44, 0xaa66ff, 0x66ff99];
  for (const s of skylineSpecs) {
    const r = 31.2; // slightly in front of the box
    const cx = Math.sin(s.angle) * r;
    const cz = -Math.cos(s.angle) * r;
    const floorCount = Math.max(2, Math.floor(s.h / 1.6));
    for (let f = 0; f < floorCount; f += 1) {
      const y = f * 1.6 - 1.4;
      if (rand() < 0.6) {
        const xOff = (rand() - 0.5) * (s.w * 0.6);
        const color = neonPalette[Math.floor(rand() * neonPalette.length)]!;
        const c = new THREE.Color(color);
        windowPoints.push(new THREE.Vector3(cx - 0.2 + xOff, y, cz));
        windowPoints.push(new THREE.Vector3(cx + 0.2 + xOff, y, cz));
        windowColors.push(c.r, c.g, c.b, c.r, c.g, c.b);
      }
    }
  }
  const windowGeom = new THREE.BufferGeometry().setFromPoints(windowPoints);
  windowGeom.setAttribute(
    "color",
    new THREE.BufferAttribute(new Float32Array(windowColors), 3),
  );
  const windowMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    toneMapped: false,
  });
  const windows = new THREE.LineSegments(windowGeom, windowMat);
  windows.name = "neon-windows";
  group.add(windows);
  return group;
}

function createGlacierEnvironment(): THREE.Group {
  const group = new THREE.Group();
  group.name = "glacier-environment";
  // Icy horizon at the visible bands (0-1) fading into a colder winter sky
  // above. Flipped from the original (which had dark at the horizon and pale
  // cyan at the zenith — the opposite of what a glacier landscape looks like).
  group.add(createGradientSkydome([0x5a7a9a, 0x4a6a8a, 0x2a4a6a, 0x0a2a3a]));
  // Pale icy ground glow at the horizon, same ring-on-the-floor trick used
  // by the sunset and neon-city scenes. Sells the "snow reflecting cold sky
  // light" effect without any textures.
  const horizonGlow = new THREE.Mesh(
    new THREE.RingGeometry(14, 55, 48),
    new THREE.MeshBasicMaterial({
      color: 0xc8e4ff,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      fog: false,
    }),
  );
  horizonGlow.rotation.x = -Math.PI / 2;
  horizonGlow.position.y = 0.2;
  horizonGlow.name = "glacier-horizon-glow";
  group.add(horizonGlow);
  // 2 aurora ribbons. The previous version sat at y=18-22 which is well
  // above the camera's eye level (y=10) and largely out of view; they were
  // also only 4-5 units tall. Dropped to y=9-14 and stretched so they sweep
  // across the visible sky.
  const auroraSpecs = [
    {
      color: 0x66ffaa,
      x: -4,
      y: 11,
      z: -40,
      rot: 0.18,
      w: 70,
      h: 9,
      opacity: 0.28,
    },
    {
      color: 0xaa66ff,
      x: 6,
      y: 14,
      z: -44,
      rot: -0.12,
      w: 75,
      h: 7,
      opacity: 0.22,
    },
  ];
  for (const a of auroraSpecs) {
    const plane = new THREE.PlaneGeometry(a.w, a.h);
    const mesh = new THREE.Mesh(
      plane,
      new THREE.MeshBasicMaterial({
        color: a.color,
        transparent: true,
        opacity: a.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
        fog: false,
      }),
    );
    mesh.position.set(a.x, a.y, a.z);
    mesh.rotation.z = a.rot;
    mesh.name = "aurora-ribbon";
    group.add(mesh);
  }
  // 60 static snow dust points (baked once, no per-frame work).
  const snowCount = 60;
  const snowPositions = new Float32Array(snowCount * 3);
  let seed = 909;
  const rand = (): number => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < snowCount; i += 1) {
    const r = Math.sqrt(rand()) * 9;
    const a = rand() * Math.PI * 2;
    snowPositions[i * 3 + 0] = Math.cos(a) * r;
    snowPositions[i * 3 + 1] = 0.5 + rand() * 7;
    snowPositions[i * 3 + 2] = Math.sin(a) * r;
  }
  const snowGeom = new THREE.BufferGeometry();
  snowGeom.setAttribute(
    "position",
    new THREE.BufferAttribute(snowPositions, 3),
  );
  const snowMat = new THREE.PointsMaterial({
    color: 0xfafff5,
    size: 0.08,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    toneMapped: false,
  });
  const snow = new THREE.Points(snowGeom, snowMat);
  snow.name = "snow-dust";
  group.add(snow);
  return group;
}

function findBubbleField(group: THREE.Object3D): THREE.Points | null {
  let found: THREE.Points | null = null;
  group.traverse((node) => {
    if (found) return;
    if (node instanceof THREE.Points && node.name === "bubble-field") {
      found = node;
    }
  });
  return found;
}
