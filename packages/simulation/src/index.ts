import * as CANNON from "cannon-es";
import {
  BEYBLADES,
  clampLaunchPower,
  isPerfectLaunch,
  resolveMatchFinish,
  assembleBeybladeSpec,
  SPECIAL_MOVES,
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
} from "@cyberblade/core";

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
  readonly baseMass: number;
  specialCharge: number;
  specialUsed: boolean;
  /** Seconds left on the running special's effect window. */
  specialRemaining: number;
  /** Blaze Rush's doubled hit waits for the next contact. */
  empoweredHit: boolean;
  /** CPU only: when the charged special became ready, and the planned fire time. */
  aiReadyAt: number | null;
  aiFireAt: number | null;
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

// Special moves: a full gauge takes this long on time alone; stability lost to
// hits adds on top so the side taking the beating charges first.
const SPECIAL_CHARGE_SECONDS = 9;
const SPECIAL_HIT_CHARGE = 1.5;
// The CPU never waits longer than this once charged.
const AI_SPECIAL_PATIENCE = 8;

// Every special's strength in one place; tuned against the matchup matrix in
// special-balance.test.ts.
const TUNING = {
  blazeDashSpeed: 10,
  blazeHitMultiplier: 2,
  drakeHitMultiplier: 1.3,
  /** Drake Pierce adds this much per point of armor (1 − damageTaken). */
  drakeArmorBreak: 3.5,
  bastionMass: 2,
  bastionSpeed: 1.6,
  bastionDamage: 0.3,
  /** Extra outward speed Bastion Charge adds to the opponent on each hit. */
  bastionKnockback: 12,
  genbuMass: 4,
  genbuDamping: 0.6,
  genbuReflect: 0.5,
  aegisRange: 6,
  aegisPush: 12,
  coronaRpm: 0.25,
  falconDamage: 0.5,
  falconSpeed: 1.5,
  /** Falcon Evade also halts natural spin decay while it runs. */
  falconHaltsDecay: true,
  /** Instant spin top-up; with the decay halt it matches Corona's total. */
  falconRpm: 0.18,
  jadeStability: 0.25,
  jadeRpm: 0.15,
  /** Mimic never copies less than this multiple of the user's own stats. */
  mimicFloor: 1.5,
} as const;

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
  #queuedEvents: SimulationEvent[] = [];
  #stepping = false;
  #lastHitAt = -1;
  #pendingRemovals: CANNON.Body[] = [];
  #random = mulberry32(1);
  #aiSpecialTops = new Set<TopId>();

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
    this.#aiSpecialTops = new Set(config.aiSpecialTopIds ?? []);
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
    this.#queuedEvents = [];
    this.#lastHitAt = -1;
    this.#pendingRemovals = [];
  }

  launch(input: LaunchInput): void {
    this.#launchTop(this.#p1, input.p1Power, input.p1Angle);
    this.#launchTop(this.#p2, input.p2Power, input.p2Angle);
    this.#launched = true;
  }

  activateSpecial(id: TopId): boolean {
    const top = id === "p1" ? this.#p1 : this.#p2;
    const opponent = id === "p1" ? this.#p2 : this.#p1;
    if (
      !this.#launched ||
      top.specialUsed ||
      top.specialCharge < 1 ||
      top.isBurst ||
      top.stoppedAt !== null ||
      isOut(top)
    )
      return false;
    const move = SPECIAL_MOVES[top.spec.special];
    top.specialUsed = true;
    top.specialCharge = 0;
    top.specialRemaining = move.duration;
    const position = top.body.position;
    const dx = opponent.body.position.x - position.x;
    const dz = opponent.body.position.z - position.z;
    const distance = Math.max(0.01, Math.hypot(dx, dz));
    switch (move.id) {
      case "blaze_rush":
        top.empoweredHit = true;
        top.body.velocity.set(
          (dx / distance) * TUNING.blazeDashSpeed,
          0,
          (dz / distance) * TUNING.blazeDashSpeed,
        );
        break;
      case "aegis_shockwave":
        if (!opponent.isBurst && distance < TUNING.aegisRange) {
          const push =
            TUNING.aegisPush * (1 - distance / (TUNING.aegisRange + 1));
          opponent.body.velocity.x += (dx / distance) * push;
          opponent.body.velocity.z += (dz / distance) * push;
        }
        break;
      case "corona_regen":
        top.rpm = Math.min(
          Math.max(top.spec.maxRpm, top.rpm),
          top.rpm + top.spec.maxRpm * TUNING.coronaRpm,
        );
        break;
      case "falcon_evade":
        top.rpm = Math.min(
          Math.max(top.spec.maxRpm, top.rpm),
          top.rpm + top.spec.maxRpm * TUNING.falconRpm,
        );
        break;
      case "jade_resonance":
        top.stability = Math.min(
          top.spec.maxStability,
          top.stability + top.spec.maxStability * TUNING.jadeStability,
        );
        top.rpm = Math.min(
          Math.max(top.spec.maxRpm, top.rpm),
          top.rpm + top.spec.maxRpm * TUNING.jadeRpm,
        );
        break;
      default:
        break;
    }
    this.#applySpecialMass(top, opponent);
    (this.#stepping ? this.#events : this.#queuedEvents).push({
      type: "special",
      top: top.id,
      move: move.id,
      position: vec(position),
    });
    return true;
  }

  step(deltaSeconds: number): SimulationStep {
    this.#tick += 1;
    if (!this.#launched) {
      return { snapshot: this.snapshot, events: [], tick: this.#tick };
    }
    // Specials fired from input between steps belong to this step's batch.
    this.#events = this.#queuedEvents;
    this.#queuedEvents = [];
    this.#stepping = true;
    this.#accumulator += Math.min(Math.max(deltaSeconds, 0), 0.1);
    while (this.#accumulator >= FIXED_STEP) {
      this.#fixedStep(FIXED_STEP);
      this.#accumulator -= FIXED_STEP;
    }
    this.#stepping = false;
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
      baseMass: spec.mass,
      specialCharge: 0,
      specialUsed: false,
      specialRemaining: 0,
      empoweredHit: false,
      aiReadyAt: null,
      aiFireAt: null,
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
    const active = (top: ActiveTop, id: string) =>
      top.specialRemaining > 0 && top.spec.special === id;
    // Spin loss is a fraction of the remaining spin so chained hits have
    // diminishing returns — a hit never kills the spin outright; the final
    // wind-down (wobble, then topple) always comes from natural decay.
    const lossFraction = Math.min(0.35, Math.max(0.05, impact * 0.025)) * 0.45;
    const rpmLosses = tops.map((top) =>
      top.isBurst || top.isStopped
        ? 0
        : top.rpm *
          lossFraction *
          (active(top, "falcon_evade") ? TUNING.falconDamage : 1),
    );
    const stabilityLosses = tops.map((top, index) => {
      const opponent = tops[1 - index]!;
      let multiplier = opponent.spec.attackMultiplier ?? 1.0;
      if (active(opponent, "chameleon_mimic"))
        multiplier = Math.max(
          multiplier * TUNING.mimicFloor,
          top.spec.attackMultiplier ?? 1.0,
        );
      if (opponent.empoweredHit) multiplier *= TUNING.blazeHitMultiplier;
      let taken = top.spec.damageTaken;
      if (active(top, "chameleon_mimic"))
        taken = Math.min(taken / TUNING.mimicFloor, opponent.spec.damageTaken);
      // Drake Pierce scales with the target's armor: heavy blades crack.
      if (active(opponent, "drake_pierce"))
        taken =
          taken * TUNING.drakeHitMultiplier +
          TUNING.drakeArmorBreak * Math.max(0, 1 - top.spec.damageTaken);
      let loss = damage * multiplier * taken;
      if (active(top, "falcon_evade")) loss *= TUNING.falconDamage;
      if (active(top, "bastion_charge")) loss *= TUNING.bastionDamage;
      // The Blaze Rush strike itself leaves the rusher unscathed.
      if (top.empoweredHit) loss = 0;
      return loss;
    });
    for (const top of tops) top.empoweredHit = false;
    for (const [index, top] of tops.entries()) {
      const opponent = tops[1 - index]!;
      if (!active(top, "bastion_charge") || opponent.isBurst) continue;
      const dx = opponent.body.position.x - top.body.position.x;
      const dz = opponent.body.position.z - top.body.position.z;
      const distance = Math.max(0.01, Math.hypot(dx, dz));
      opponent.body.velocity.x += (dx / distance) * TUNING.bastionKnockback;
      opponent.body.velocity.z += (dz / distance) * TUNING.bastionKnockback;
    }
    // Genbu Bulwark shrugs the hit off and throws half of it back, unless
    // Drake Pierce is cutting through the armor.
    for (const [index, top] of tops.entries()) {
      if (!active(top, "genbu_bulwark")) continue;
      if (active(tops[1 - index]!, "drake_pierce")) continue;
      stabilityLosses[1 - index]! +=
        stabilityLosses[index]! * TUNING.genbuReflect;
      stabilityLosses[index] = 0;
      rpmLosses[index] = 0;
    }
    for (const [index, top] of tops.entries()) {
      if (top.isBurst || top.isStopped) continue;
      const stabilityLoss = Math.min(top.stability, stabilityLosses[index]!);
      top.stability -= stabilityLoss;
      if (!top.specialUsed)
        top.specialCharge = Math.min(
          1,
          top.specialCharge +
            (stabilityLoss / top.spec.maxStability) * SPECIAL_HIT_CHARGE,
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

  #updateSpecial(top: ActiveTop, opponent: ActiveTop, dt: number): void {
    if (top.specialRemaining > 0) {
      top.specialRemaining = Math.max(0, top.specialRemaining - dt);
      if (top.specialRemaining === 0) {
        top.empoweredHit = false;
        this.#applySpecialMass(top, opponent);
      }
    }
    if (top.isBurst || top.stoppedAt !== null || top.specialUsed) return;
    top.specialCharge = Math.min(
      1,
      top.specialCharge + dt / SPECIAL_CHARGE_SECONDS,
    );
    if (top.specialCharge >= 1 && this.#aiSpecialTops.has(top.id))
      this.#runSpecialAi(top, opponent);
  }

  #runSpecialAi(top: ActiveTop, opponent: ActiveTop): void {
    top.aiReadyAt ??= this.#elapsed;
    if (top.aiFireAt === null) {
      const patienceOut = this.#elapsed - top.aiReadyAt >= AI_SPECIAL_PATIENCE;
      if (!patienceOut && !this.#aiWantsSpecial(top, opponent)) return;
      // Human-like reaction delay between spotting the moment and pressing.
      top.aiFireAt = this.#elapsed + 0.3 + this.#random() * 0.7;
    }
    if (this.#elapsed >= top.aiFireAt) this.activateSpecial(top.id);
  }

  #aiWantsSpecial(top: ActiveTop, opponent: ActiveTop): boolean {
    const dx = opponent.body.position.x - top.body.position.x;
    const dz = opponent.body.position.z - top.body.position.z;
    const distance = Math.max(0.01, Math.hypot(dx, dz));
    // Positive when the two are converging.
    const closing =
      ((top.body.velocity.x - opponent.body.velocity.x) * dx +
        (top.body.velocity.z - opponent.body.velocity.z) * dz) /
      distance;
    const rpmRatio = top.rpm / top.spec.maxRpm;
    const stabilityRatio = top.stability / top.spec.maxStability;
    const opponentActive = opponent.specialRemaining > 0;
    switch (SPECIAL_MOVES[top.spec.special].role) {
      case "offense":
        return distance < 4 && closing > 0;
      case "recovery":
        return top.spec.special === "corona_regen"
          ? rpmRatio < 0.5
          : stabilityRatio < 0.5 || rpmRatio < 0.4;
      case "guard":
        if (top.spec.special === "aegis_shockwave") return distance < 3.5;
        if (top.spec.special === "falcon_evade" && rpmRatio < 0.6) return true;
        return opponentActive || (distance < 3.5 && closing > 3);
      case "mimic":
        return distance < 4 && closing > 0;
    }
  }

  /** Sets the body mass the running special calls for (or restores it). */
  #applySpecialMass(top: ActiveTop, opponent: ActiveTop): void {
    let mass = top.baseMass;
    let damping = top.stoppedAt === null ? 0.05 : top.body.linearDamping;
    if (top.specialRemaining > 0) {
      if (top.spec.special === "bastion_charge") mass *= TUNING.bastionMass;
      if (top.spec.special === "genbu_bulwark") {
        mass *= TUNING.genbuMass;
        damping = TUNING.genbuDamping;
      }
      if (top.spec.special === "chameleon_mimic")
        mass = Math.max(mass * TUNING.mimicFloor, opponent.baseMass);
    }
    top.body.mass = mass;
    top.body.linearDamping = damping;
    top.body.updateMassProperties();
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
    this.#updateSpecial(this.#p1, this.#p2, dt);
    this.#updateSpecial(this.#p2, this.#p1, dt);
    this.#applyTopForces(this.#p1, this.#p2, dt);
    this.#applyTopForces(this.#p2, this.#p1, dt);
    this.#applyProximityInteractions();
    this.#world.step(FIXED_STEP);
    for (const body of this.#pendingRemovals) this.#world.removeBody(body);
    this.#pendingRemovals = [];
  }

  #applyProximityInteractions(): void {
    if (
      this.#p1.isBurst ||
      this.#p1.isStopped ||
      this.#p2.isBurst ||
      this.#p2.isStopped ||
      this.#p1.rpm <= 40 ||
      this.#p2.rpm <= 40
    ) {
      return;
    }

    const dx = this.#p1.body.position.x - this.#p2.body.position.x;
    const dz = this.#p1.body.position.z - this.#p2.body.position.z;
    const dist = Math.hypot(dx, dz);
    const contactThreshold = TOP_RADIUS * 2 + 0.05; // 1.65

    if (dist < contactThreshold) {
      const nx = dist > 0.001 ? dx / dist : 1;
      const nz = dist > 0.001 ? dz / dist : 0;
      // Repulsion force counters the bowl slope inward pull so tops don't get stuck fusing together
      const overlap = contactThreshold - dist;
      const pushForce = 6 + overlap * 35;
      this.#p1.body.applyForce(
        new CANNON.Vec3(nx * pushForce, 0, nz * pushForce),
        this.#p1.body.position,
      );
      this.#p2.body.applyForce(
        new CANNON.Vec3(-nx * pushForce, 0, -nz * pushForce),
        this.#p2.body.position,
      );
    }
  }

  #applyTopForces(top: ActiveTop, opponent: ActiveTop, dt: number): void {
    if (top.isBurst || top.isStopped) return;
    const decayHalted =
      TUNING.falconHaltsDecay &&
      top.specialRemaining > 0 &&
      top.spec.special === "falcon_evade";
    if (!decayHalted)
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
    const rpmFactor =
      Math.min(0.2 + (top.rpm / top.spec.maxRpm) * 0.8, 1) *
      specialSpeedFactor(top);
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
    special: {
      charge: top.specialCharge,
      used: top.specialUsed,
      active: top.specialRemaining > 0,
    },
  };
}

function specialSpeedFactor(top: ActiveTop): number {
  if (top.specialRemaining <= 0) return 1;
  if (top.spec.special === "bastion_charge") return TUNING.bastionSpeed;
  if (top.spec.special === "falcon_evade") return TUNING.falconSpeed;
  return 1;
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
