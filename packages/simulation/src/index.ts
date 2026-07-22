import * as CANNON from "cannon-es";
import {
  BEYBLADES,
  clampLaunchPower,
  isPerfectLaunch,
  resolveMatchFinish,
  assembleBeybladeSpec,
  type BeybladeType,
  type BattleSimulation,
  type BattleSnapshot,
  type BeybladeSpec,
  type LaunchInput,
  type MatchConfig,
  type SimulationEvent,
  type SimulationStep,
  type TopId,
  type TopSnapshot,
} from "@game-pool/beyblade-core";

interface ActiveTop {
  readonly id: TopId;
  readonly spec: BeybladeSpec;
  readonly body: CANNON.Body;
  readonly perfectLaunchEligible: boolean;
  rpm: number;
  stability: number;
  isBurst: boolean;
  isStopped: boolean;
  /** Sim time when the top ran out of spin and began falling over. */
  stoppedAt: number | null;
  lastTrailAt: number;
}

const FIXED_STEP = 1 / 60;
const TIME_LIMIT = 20;

// Tops rest with their sphere center at this height on the flat physics floor.
const TOP_RADIUS = 0.8;
// The visual bowl slopes up to radius 8; beyond POCKET_RADIUS lie the pockets.
const BOWL_RADIUS = 7.8;
const POCKET_RADIUS = 7.5;
const OUTER_LIMIT = 8.5;
const POCKET_ANGLES = [0, Math.PI / 2, Math.PI, -Math.PI / 2, -Math.PI];

export class CannonBattleSimulation implements BattleSimulation {
  #world = new CANNON.World();
  #beyMaterial = new CANNON.Material("beyblade");
  #config: MatchConfig = {
    p1Type: "attack",
    p2Type: "defense",
    stadiumTheme: "neon",
    perfectLaunchTopIds: ["p1"],
  };
  #p1!: ActiveTop;
  #p2!: ActiveTop;
  #elapsed = 0;
  #accumulator = 0;
  #launched = false;
  #tick = 0;
  #events: SimulationEvent[] = [];
  #lastHitAt = -1;
  #pendingRemovals: CANNON.Body[] = [];
  #random = mulberry32(1);

  constructor() {
    this.#resetWorld();
    this.initialize(this.#config);
  }

  get snapshot(): BattleSnapshot {
    return {
      elapsed: this.#elapsed,
      p1: toSnapshot(this.#p1),
      p2: toSnapshot(this.#p2),
    };
  }

  initialize(config: MatchConfig): void {
    this.#config = config;
    this.#random = mulberry32(config.seed ?? Date.now());
    this.#resetWorld();
    const perfectLaunchTopIds = new Set(config.perfectLaunchTopIds ?? []);
    const p1OffsetX = (this.#random() - 0.5) * 2;
    const p1OffsetZ = (this.#random() - 0.5) * 2;
    const p2OffsetX = (this.#random() - 0.5) * 2;
    const p2OffsetZ = (this.#random() - 0.5) * 2;

    const getSpec = (
      type: BeybladeType,
      bladeId?: string,
      ratchetId?: string,
      bitId?: string,
      chipId?: string,
    ): BeybladeSpec => {
      if (bladeId || ratchetId || bitId || chipId) {
        return assembleBeybladeSpec({
          type,
          bladeId: bladeId ?? type,
          ratchetId: ratchetId ?? type,
          bitId: bitId ?? type,
          chipId: chipId ?? type,
        });
      }
      return BEYBLADES[type];
    };

    this.#p1 = this.#createTop(
      "p1",
      getSpec(config.p1Type, config.p1BladeId, config.p1RatchetId, config.p1BitId, config.p1ChipId),
      perfectLaunchTopIds.has("p1"),
      -4 + p1OffsetX,
      p1OffsetZ,
    );
    this.#p2 = this.#createTop(
      "p2",
      getSpec(config.p2Type, config.p2BladeId, config.p2RatchetId, config.p2BitId, config.p2ChipId),
      perfectLaunchTopIds.has("p2"),
      4 + p2OffsetX,
      p2OffsetZ,
    );
    this.#registerCollisionHandler();
    this.#elapsed = 0;
    this.#accumulator = 0;
    this.#launched = false;
    this.#tick = 0;
    this.#events = [];
    this.#lastHitAt = -1;
    this.#pendingRemovals = [];
  }

  launch(input: LaunchInput): void {
    this.#launchTop(this.#p1, input.p1Power, input.p1Angle);
    this.#launchTop(this.#p2, input.p2Power, input.p2Angle);
    this.#launched = true;
  }

  step(deltaSeconds: number): SimulationStep {
    this.#tick += 1;
    if (!this.#launched) {
      return { snapshot: this.snapshot, events: [], tick: this.#tick };
    }
    this.#events = [];
    this.#accumulator += Math.min(Math.max(deltaSeconds, 0), 0.1);
    while (this.#accumulator >= FIXED_STEP) {
      this.#fixedStep(FIXED_STEP);
      this.#accumulator -= FIXED_STEP;
    }
    const finish = resolveMatchFinish(this.snapshot, TIME_LIMIT);
    return {
      snapshot: this.snapshot,
      events: this.#events,
      tick: this.#tick,
      ...(finish ? { finish } : {}),
    };
  }

  dispose(): void {
    this.#world.bodies.slice().forEach((body) => this.#world.removeBody(body));
    this.#events = [];
    this.#launched = false;
  }

  #resetWorld(): void {
    this.#world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.81, 0) });
    if (this.#world.solver instanceof CANNON.GSSolver) {
      this.#world.solver.iterations = 10;
    }
    this.#beyMaterial = new CANNON.Material("beyblade");
    const floorMaterial = new CANNON.Material("floor");
    const wallMaterial = new CANNON.Material("wall");

    // Contact tuning ported from the original game: tops slide on the floor,
    // rebound hard off each other and bounce back from the boundary walls.
    this.#world.addContactMaterial(
      new CANNON.ContactMaterial(this.#beyMaterial, floorMaterial, {
        friction: 0.015,
        restitution: 0.3,
      }),
    );
    this.#world.addContactMaterial(
      new CANNON.ContactMaterial(this.#beyMaterial, this.#beyMaterial, {
        friction: 0.05,
        restitution: 0.85,
      }),
    );
    this.#world.addContactMaterial(
      new CANNON.ContactMaterial(this.#beyMaterial, wallMaterial, {
        friction: 0.02,
        restitution: 0.7,
      }),
    );

    const floor = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
      material: floorMaterial,
    });
    floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.#world.addBody(floor);

    // 16 tangent wall segments with gaps near 0/90/180/270 degrees so tops can
    // be knocked out through the four pockets (OVER FINISH).
    const radius = 7.95;
    const segments = 16;
    const halfLength = radius * Math.tan(Math.PI / segments);
    for (let index = 0; index < segments; index += 1) {
      const angle = (index * Math.PI * 2) / segments;
      if (isNearPocket(angle, 0.25)) continue;
      const wall = new CANNON.Body({
        mass: 0,
        material: wallMaterial,
        shape: new CANNON.Box(new CANNON.Vec3(halfLength, 1.0, 0.15)),
      });
      wall.position.set(
        Math.cos(angle) * radius,
        0.5,
        Math.sin(angle) * radius,
      );
      wall.quaternion.setFromEuler(0, -angle - Math.PI / 2, 0);
      this.#world.addBody(wall);
    }
  }

  #createTop(
    id: TopId,
    spec: BeybladeSpec,
    perfectLaunchEligible: boolean,
    x: number,
    z: number,
  ): ActiveTop {
    const body = new CANNON.Body({
      mass: spec.mass,
      linearDamping: 0.05,
      angularDamping: 0.02,
      shape: new CANNON.Sphere(TOP_RADIUS),
      material: this.#beyMaterial,
    });
    body.position.set(x, TOP_RADIUS + 0.1, z);
    this.#world.addBody(body);
    return {
      id,
      spec,
      body,
      perfectLaunchEligible,
      rpm: 0,
      stability: spec.maxStability,
      isBurst: false,
      isStopped: false,
      stoppedAt: null,
      lastTrailAt: 0,
    };
  }

  #registerCollisionHandler(): void {
    const opponentBody = this.#p2.body;
    this.#p1.body.addEventListener(
      "collide",
      (event: { body: CANNON.Body; contact: CANNON.ContactEquation }) => {
        if (event.body !== opponentBody) return;
        // The collide event re-fires on every substep while bodies stay in
        // contact — the cooldown keeps one visible hit from landing many times.
        if (this.#elapsed - this.#lastHitAt < 0.4) return;
        const impact = Math.abs(event.contact.getImpactVelocityAlongNormal());
        if (impact <= 0.4) return;
        this.#lastHitAt = this.#elapsed;
        this.#applyHit(impact);
      },
    );
  }

  #applyHit(impact: number): void {
    const damage = Math.min(30, impact * 2);
    const tops = [this.#p1, this.#p2] as const;
    // Spin loss is a fraction of the remaining spin so chained hits have
    // diminishing returns — a hit never kills the spin outright; the final
    // wind-down (wobble, then topple) always comes from natural decay.
    const lossFraction = Math.min(0.35, Math.max(0.05, impact * 0.025)) * 0.45;
    const rpmLosses = tops.map((top) =>
      top.isBurst || top.isStopped ? 0 : top.rpm * lossFraction,
    );
    for (const [index, top] of tops.entries()) {
      if (top.isBurst || top.isStopped) continue;
      const opponent = tops[1 - index]!;
      const attackMultiplier = opponent.spec.attackMultiplier ?? 1.0;
      top.stability = Math.max(
        0,
        top.stability - damage * attackMultiplier * top.spec.damageTaken,
      );
      top.rpm = Math.max(0, top.rpm - rpmLosses[index]!);
      // Spin-steal converts part of the opponent's collision spin loss into
      // the thief's own spin, so trading hits favors the leech over time.
      const stolen = (top.spec.spinSteal ?? 0) * rpmLosses[1 - index]!;
      if (stolen > 0) top.rpm = Math.min(top.spec.maxRpm, top.rpm + stolen);
      if (top.stability <= 0 && !top.isBurst) {
        top.isBurst = true;
        // Hits are resolved inside the collide callback while the world is
        // mid-step; removing the body immediately corrupts cannon's internal
        // arrays, so defer the removal until the step completes.
        this.#pendingRemovals.push(top.body);
        this.#events.push({
          type: "burst",
          top: top.id,
          position: vec(top.body.position),
        });
      }
    }
    this.#events.push({
      type: "collision",
      position: {
        x: (this.#p1.body.position.x + this.#p2.body.position.x) / 2,
        y: TOP_RADIUS,
        z: (this.#p1.body.position.z + this.#p2.body.position.z) / 2,
      },
      intensity: impact,
    });
  }

  #launchTop(top: ActiveTop, power: number, angleDegrees: number): void {
    const normalized = clampLaunchPower(power) / 100;
    top.rpm =
      top.spec.maxRpm *
      (0.65 + normalized * 0.35) *
      (isPerfectLaunch(power) && top.perfectLaunchEligible ? 1.15 : 1);
    const angle = (angleDegrees * Math.PI) / 180;
    const impulse = 3 + normalized * 5;
    top.body.linearDamping = 0.05;
    top.body.velocity.set(
      Math.cos(angle) * impulse,
      -3, // downward thrust slams the top into the arena
      Math.sin(angle) * impulse,
    );
    // Physical spin is set once at launch (a fraction of the visual spin rate)
    // so deflections feel spin-driven without curving the trajectory.
    const radPerSec = (top.rpm / 60) * Math.PI * 2;
    top.body.angularVelocity.set(0, radPerSec * 0.02, 0);
  }

  #fixedStep(dt: number): void {
    this.#elapsed += dt;
    this.#applyTopForces(this.#p1, this.#p2, dt);
    this.#applyTopForces(this.#p2, this.#p1, dt);
    this.#world.step(FIXED_STEP);
    for (const body of this.#pendingRemovals) this.#world.removeBody(body);
    this.#pendingRemovals = [];
  }

  #applyTopForces(top: ActiveTop, opponent: ActiveTop, dt: number): void {
    if (top.isBurst || top.isStopped) return;
    top.rpm = Math.max(0, top.rpm - top.spec.rpmDecay * 0.45 * dt);
    if (top.rpm <= 40) {
      top.rpm = 0;
      if (top.stoppedAt === null) {
        top.stoppedAt = this.#elapsed;
        top.body.angularVelocity.setZero();
        // Heavy damping makes the toppled top skid to a stop.
        top.body.linearDamping = 0.85;
      } else if (this.#elapsed - top.stoppedAt >= 0.5) {
        // Grace period: the fall-over animation plays out before the match
        // is judged, instead of the loser freezing and the result popping up.
        top.isStopped = true;
      }
      return;
    }

    const position = top.body.position;
    const distance = Math.hypot(position.x, position.z);
    if (distance < BOWL_RADIUS) {
      // Radial pull mimics the bowl slope (F = k * r) so tops meet mid-arena.
      top.body.applyForce(
        new CANNON.Vec3(-position.x * 6, 0, -position.z * 6),
        position,
      );

      // Damp the tangential velocity so wide orbits spiral inward instead of
      // circling the rim forever. Scaled by mass for consistent deceleration.
      const dirX = -position.x / (distance + 0.001);
      const dirZ = -position.z / (distance + 0.001);
      const radialSpeed =
        top.body.velocity.x * dirX + top.body.velocity.z * dirZ;
      const tangentX = top.body.velocity.x - radialSpeed * dirX;
      const tangentZ = top.body.velocity.z - radialSpeed * dirZ;
      const orbitDamping = 0.8 * Math.max(1.1, top.body.mass);
      top.body.applyForce(
        new CANNON.Vec3(-tangentX * orbitDamping, 0, -tangentZ * orbitDamping),
        position,
      );

      if (position.y < TOP_RADIUS) {
        position.y = TOP_RADIUS;
        top.body.velocity.y = Math.max(0, top.body.velocity.y);
      }
    }

    const dx = opponent.body.position.x - position.x;
    const dz = opponent.body.position.z - position.z;
    const length = Math.max(0.01, Math.hypot(dx, dz));
    let steerX = dx / length;
    let steerZ = dz / length;
    switch (top.spec.ai) {
      case "orbitEvade":
        steerX = -steerX + (-position.z / Math.max(distance, 1)) * 0.8;
        steerZ = -steerZ + (position.x / Math.max(distance, 1)) * 0.8;
        break;
      case "hold":
        steerX = -position.x / Math.max(distance, 1);
        steerZ = -position.z / Math.max(distance, 1);
        break;
      case "adaptive":
        if (top.rpm < opponent.rpm) {
          steerX = -steerX;
          steerZ = -steerZ;
        }
        break;
      case "strafe": {
        // Spiral pursuit: close distance while circling for glancing hits.
        const tangentX = -dz / length;
        const tangentZ = dx / length;
        steerX = steerX * 0.55 + tangentX * 0.85;
        steerZ = steerZ * 0.55 + tangentZ * 0.85;
        break;
      }
      case "counterHold": {
        // Turtle by default, but press the attack once ahead on stability.
        const ahead =
          top.stability / top.spec.maxStability >
          opponent.stability / opponent.spec.maxStability;
        if (!ahead) {
          steerX = -position.x / Math.max(distance, 1);
          steerZ = -position.z / Math.max(distance, 1);
        }
        break;
      }
      case "seek":
        break;
    }
    // Steering weakens as spin runs down, like the original game.
    const rpmFactor = Math.min(0.2 + (top.rpm / top.spec.maxRpm) * 0.8, 1);
    const wobble = (this.#random() - 0.5) * 0.25;
    top.body.applyForce(
      new CANNON.Vec3(
        (steerX + wobble) * top.spec.speed * rpmFactor,
        0,
        (steerZ - wobble) * top.spec.speed * rpmFactor,
      ),
      position,
    );

    // Trail strength follows travel speed so rings fade in and out smoothly
    // instead of popping at a hard speed threshold.
    const horizontalSpeed = Math.hypot(
      top.body.velocity.x,
      top.body.velocity.z,
    );
    const trailIntensity = Math.min(1, horizontalSpeed / 4);
    if (trailIntensity > 0.15 && this.#elapsed - top.lastTrailAt >= 0.1) {
      top.lastTrailAt = this.#elapsed;
      this.#events.push({
        type: "trail",
        top: top.id,
        position: vec(top.body.position),
        intensity: trailIntensity,
      });
    }
  }
}

function toSnapshot(top: ActiveTop): TopSnapshot {
  return {
    id: top.id,
    type: top.spec.type,
    position: vec(top.body.position),
    quaternion: {
      x: top.body.quaternion.x,
      y: top.body.quaternion.y,
      z: top.body.quaternion.z,
      w: top.body.quaternion.w,
    },
    rpm: top.rpm,
    stability: top.stability,
    isBurst: top.isBurst,
    isStopped: top.isStopped,
    isOut: isOut(top),
  };
}

function vec(value: CANNON.Vec3) {
  return { x: value.x, y: value.y, z: value.z };
}

function isOut(top: ActiveTop): boolean {
  const { x, y, z } = top.body.position;
  const distance = Math.hypot(x, z);
  if (distance > OUTER_LIMIT) return true;
  // Inside the pocket band, a top low enough and aligned with one of the four
  // wall gaps counts as knocked out (ported from the original stadium logic).
  if (distance >= POCKET_RADIUS - 0.2 && y < 1.2) {
    const angle = Math.atan2(z, x);
    return isNearPocket(angle, 0.35);
  }
  return false;
}

function isNearPocket(angle: number, margin: number): boolean {
  return POCKET_ANGLES.some((pocketAngle) => {
    let diff = Math.abs(angle - pocketAngle);
    while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
    return diff < margin;
  });
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
