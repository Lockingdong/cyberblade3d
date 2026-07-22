import type {
  GameEvent,
  GameRuntime,
  GameStatus,
} from "@game-pool/game-runtime";

export type BeybladeType =
  | "attack"
  | "defense"
  | "stamina"
  | "balance"
  | "crusher"
  | "phantom"
  | "aegis"
  | "vampire"
  | "zephyr"
  | "berserk";
export type AiBehavior =
  "seek" | "hold" | "orbitEvade" | "adaptive" | "strafe" | "counterHold";
export type StadiumTheme = "neon" | "toxic" | "volcano";
export type StadiumVariant = "light" | "dark";
export type MatchPhase = "menu" | "launch" | "battle" | "ending" | "result";
export type TopId = "p1" | "p2";
export type WinnerId = TopId | "draw";
export type FinishType =
  "BURST FINISH" | "OVER FINISH" | "SPIN FINISH" | "TIME FINISH";
export type MatchTermination =
  "completed" | "opponent_left" | "connection_lost";

export interface BeybladeSpec {
  readonly type: BeybladeType;
  readonly bladeId: string;
  readonly ratchetId: string;
  readonly bitId: string;
  readonly chipId: string;
  name: string;
  englishName: string;
  mass: number;
  maxRpm: number;
  rpmDecay: number;
  maxStability: number;
  speed: number;
  friction: number;
  color: number;
  /** Fraction of collision damage this top takes. */
  damageTaken: number;
  /** Steering archetype consumed by the simulation. */
  ai: AiBehavior;
  /** The blade the AI picks to fight this one. */
  counteredBy: BeybladeType;
  /** Fraction of the opponent's collision rpm loss stolen as own rpm. */
  spinSteal?: number;
  /** Multiplier for the collision damage this top deals to others. */
  attackMultiplier?: number;
}

export interface BeybladeDisplayStat {
  readonly key: "rpm" | "stability" | "mass" | "speed" | "friction" | "decay";
  readonly label: string;
  readonly value: number;
  readonly displayValue: string;
  readonly ratio: number;
}

export interface VectorSnapshot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface QuaternionSnapshot extends VectorSnapshot {
  readonly w: number;
}

export interface TopSnapshot {
  readonly id: TopId;
  readonly type: BeybladeType;
  readonly position: VectorSnapshot;
  readonly quaternion: QuaternionSnapshot;
  readonly rpm: number;
  readonly stability: number;
  readonly isBurst: boolean;
  readonly isStopped: boolean;
  readonly isOut: boolean;
}

export interface BattleSnapshot {
  readonly elapsed: number;
  readonly p1: TopSnapshot;
  readonly p2: TopSnapshot;
}

export interface MatchConfig {
  readonly p1Type: BeybladeType;
  readonly p2Type: BeybladeType;
  readonly stadiumTheme: StadiumTheme;
  readonly stadiumVariant?: StadiumVariant;
  readonly seed?: number;
  readonly perfectLaunchTopIds?: readonly TopId[];
  readonly p1Color?: number;
  readonly p2Color?: number;
  readonly p1BladeId?: string;
  readonly p1RatchetId?: string;
  readonly p1BitId?: string;
  readonly p1ChipId?: string;
  readonly p2BladeId?: string;
  readonly p2RatchetId?: string;
  readonly p2BitId?: string;
  readonly p2ChipId?: string;
}

/**
 * Accent colors a player can pick to override their blade's default
 * `BeybladeSpec.color`. Curated to stay readable against the dark stadium and
 * to avoid colliding with the green local-player marker (0x39ff14).
 */
export const PLAYER_COLOR_PALETTE: readonly number[] = [
  0xe60012, // attack red (default for attack)
  0x1e90ff, // dodger blue
  0xff8c00, // dark orange
  0xffd700, // gold
  0xb026ff, // purple
  0xff2e88, // hot pink
  0x00d4c8, // teal
  0x9fc2ff, // ice blue
  0xff5349, // coral
  0xc0c8d8, // silver
];

/** Returns true when the value is a usable 24-bit RGB override. */
export function isPlayerColor(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 0xffffff
  );
}

/**
 * Returns a darkened version of a 24-bit RGB color by scaling its HSL
 * lightness. `factor` defaults to 0.35 (≈ 35% of the original lightness).
 */
export function darkenColor(color: number, factor = 0.35): number {
  const r = ((color >> 16) & 0xff) / 255;
  const g = ((color >> 8) & 0xff) / 255;
  const b = (color & 0xff) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    // Achromatic – just scale lightness directly.
    const v = Math.round(l * factor * 255);
    return (v << 16) | (v << 8) | v;
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  // Rebuild with darkened lightness.
  const nl = l * factor;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q2 = nl < 0.5 ? nl * (1 + s) : nl + s - nl * s;
  const p2 = 2 * nl - q2;
  const nr = Math.round(hue2rgb(p2, q2, h + 1 / 3) * 255);
  const ng = Math.round(hue2rgb(p2, q2, h) * 255);
  const nb = Math.round(hue2rgb(p2, q2, h - 1 / 3) * 255);

  return (nr << 16) | (ng << 8) | nb;
}

export interface LaunchInput {
  readonly p1Power: number;
  readonly p1Angle: number;
  readonly p2Power: number;
  readonly p2Angle: number;
}

export interface MatchResult {
  readonly winnerId: WinnerId;
  readonly finishType: FinishType;
  readonly duration: number;
  readonly finalRpm: number;
}

export type SimulationEvent =
  | {
      readonly type: "collision";
      readonly position: VectorSnapshot;
      readonly intensity: number;
    }
  | {
      readonly type: "trail";
      readonly top: TopId;
      readonly position: VectorSnapshot;
      /** 0–1, scales the ring's opacity with the top's travel speed. */
      readonly intensity: number;
    }
  | {
      readonly type: "burst";
      readonly top: TopId;
      readonly position: VectorSnapshot;
    };

export interface SimulationStep {
  readonly snapshot: BattleSnapshot;
  readonly events: readonly SimulationEvent[];
  /** Monotonic step counter; consumers use it to process each events batch exactly once. */
  readonly tick: number;
  readonly finish?: {
    readonly winnerId: WinnerId;
    readonly finishType: FinishType;
  };
}

export interface BattleSimulation {
  readonly snapshot: BattleSnapshot;
  initialize(config: MatchConfig): void;
  launch(input: LaunchInput): void;
  step(deltaSeconds: number): SimulationStep;
  dispose(): void;
}

export interface BeybladeState {
  readonly phase: MatchPhase;
  readonly config: MatchConfig;
  readonly battle: BattleSnapshot | null;
  readonly result: MatchResult | null;
  readonly events: readonly SimulationEvent[];
  /** Tick of the simulation step that produced `events`; 0 before the battle starts. */
  readonly eventsTick: number;
}

export type BeybladeInput =
  | { readonly type: "prepare"; readonly config: MatchConfig }
  | { readonly type: "launch"; readonly launch: LaunchInput }
  | { readonly type: "tick"; readonly deltaSeconds: number }
  | { readonly type: "leave" };

import { assembleBeybladeSpec, type CustomBeybladeConfig } from "./parts";
export * from "./parts";


const PRESET_ORDER: BeybladeType[] = [
  "attack",
  "defense",
  "stamina",
  "balance",
  "crusher",
  "phantom",
  "aegis",
  "vampire",
  "zephyr",
  "berserk",
];

const PRESET_CONFIGS: Record<BeybladeType, CustomBeybladeConfig> = {
  attack: { type: "attack", bladeId: "attack", ratchetId: "attack", bitId: "attack", chipId: "attack" },
  defense: { type: "defense", bladeId: "defense", ratchetId: "defense", bitId: "defense", chipId: "defense" },
  stamina: { type: "stamina", bladeId: "stamina", ratchetId: "stamina", bitId: "stamina", chipId: "stamina" },
  balance: { type: "balance", bladeId: "balance", ratchetId: "balance", bitId: "balance", chipId: "balance" },
  crusher: { type: "crusher", bladeId: "crusher", ratchetId: "crusher", bitId: "crusher", chipId: "crusher" },
  phantom: { type: "phantom", bladeId: "phantom", ratchetId: "phantom", bitId: "phantom", chipId: "phantom" },
  aegis: { type: "aegis", bladeId: "aegis", ratchetId: "aegis", bitId: "aegis", chipId: "aegis" },
  vampire: { type: "vampire", bladeId: "vampire", ratchetId: "vampire", bitId: "vampire", chipId: "vampire" },
  zephyr: { type: "zephyr", bladeId: "zephyr", ratchetId: "zephyr", bitId: "zephyr", chipId: "zephyr" },
  berserk: { type: "berserk", bladeId: "berserk", ratchetId: "berserk", bitId: "berserk", chipId: "berserk" },
};

export const BEYBLADES: Record<BeybladeType, BeybladeSpec> = PRESET_ORDER.reduce(
  (acc, type) => {
    acc[type] = assembleBeybladeSpec(PRESET_CONFIGS[type]);
    return acc;
  },
  {} as Record<BeybladeType, BeybladeSpec>
);

export function beybladeDisplayStats(
  type: BeybladeType,
  customSpec?: BeybladeSpec,
): readonly BeybladeDisplayStat[] {
  const blade = customSpec ?? BEYBLADES[type];
  const stats = [
    {
      key: "rpm" as const,
      label: "最大轉速",
      value: blade.maxRpm,
      max: 6000,
      unit: "RPM",
    },
    {
      key: "stability" as const,
      label: "穩定度",
      value: blade.maxStability,
      max: 140,
      unit: "STB",
    },
    {
      key: "mass" as const,
      label: "重量",
      value: blade.mass,
      max: 1.8,
      unit: "",
    },
    {
      key: "speed" as const,
      label: "速度",
      value: blade.speed,
      max: 14,
      unit: "",
    },
    {
      key: "friction" as const,
      label: "摩擦力",
      value: blade.friction,
      max: 0.12,
      unit: "",
    },
    {
      key: "decay" as const,
      label: "轉速衰減",
      value: blade.rpmDecay,
      max: 420,
      unit: "",
    },
  ];

  return stats.map((stat) => ({
    key: stat.key,
    label: stat.label,
    value: stat.value,
    displayValue: `${stat.value}${stat.unit ? ` ${stat.unit}` : ""}`,
    ratio: Math.min(1, Math.max(0, stat.value / stat.max)),
  }));
}

export const STADIUMS: ReadonlyArray<{
  type: StadiumTheme;
  variant: StadiumVariant;
  name: string;
  englishName: string;
  primary: number;
  secondary: number;
  floor: number;
  wall: number;
  /** Emissive accent color used for floor line art and pocket glow. */
  floorEmissive: number;
  /** Danger-zone bar color shown in the gaps between wall arcs. */
  accent: number;
  /** Strength multiplier applied to emissive accents (0–1). */
  accentIntensity: number;
}> = [
  {
    type: "neon",
    variant: "dark",
    name: "極速蒼藍",
    englishName: "Extreme Cobalt",
    primary: 0x009bd6,
    secondary: 0x282a36,
    floor: 0x3e4256,
    wall: 0x5a5f78,
    floorEmissive: 0x4cd2ff,
    accent: 0x9bf0ff,
    accentIntensity: 0.9,
  },
  {
    type: "neon",
    variant: "light",
    name: "極速蒼藍",
    englishName: "Extreme Cobalt",
    primary: 0x006b9c,
    secondary: 0xd9e8f2,
    floor: 0xd7e1ea,
    wall: 0xaabcca,
    floorEmissive: 0x008fc4,
    accent: 0x006b9c,
    accentIntensity: 0.75,
  },
  {
    type: "toxic",
    variant: "dark",
    name: "鋼鐵萊姆",
    englishName: "Steel Lime",
    primary: 0xb5e61d,
    secondary: 0x282a36,
    floor: 0x3e4538,
    wall: 0x5a6350,
    floorEmissive: 0xc8ff3a,
    accent: 0xeaff7a,
    accentIntensity: 0.95,
  },
  {
    type: "toxic",
    variant: "light",
    name: "鋼鐵萊姆",
    englishName: "Steel Lime",
    primary: 0x5f8300,
    secondary: 0xe4ead8,
    floor: 0xdce5d2,
    wall: 0xb6c5aa,
    floorEmissive: 0x6d9b00,
    accent: 0x557700,
    accentIntensity: 0.8,
  },
  {
    type: "volcano",
    variant: "dark",
    name: "烈焰狂紅",
    englishName: "Crimson Rift",
    primary: 0xe60012,
    secondary: 0x282a36,
    floor: 0x483a3a,
    wall: 0x6a5858,
    floorEmissive: 0xff7a2a,
    accent: 0xffb066,
    accentIntensity: 1.0,
  },
  {
    type: "volcano",
    variant: "light",
    name: "烈焰狂紅",
    englishName: "Crimson Rift",
    primary: 0xa51b22,
    secondary: 0xf0dfd8,
    floor: 0xe7d6d0,
    wall: 0xc4aaa3,
    floorEmissive: 0xc84b25,
    accent: 0x9d271e,
    accentIntensity: 0.85,
  },
];

/** Maps a match seed to a stable 50/50 stadium presentation variant. */
export function stadiumVariantFromSeed(seed: number): StadiumVariant {
  let hash = (Math.trunc(seed) >>> 0) ^ 0x9e3779b9;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  return (hash >>> 0) % 2 === 0 ? "light" : "dark";
}

/** Uses a deterministic string hash so both online clients choose identically. */
export function stadiumVariantFromMatchId(matchId: string): StadiumVariant {
  let hash = 0x811c9dc5;
  for (let index = 0; index < matchId.length; index += 1) {
    hash ^= matchId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return stadiumVariantFromSeed(hash);
}

export function counterType(type: BeybladeType): BeybladeType {
  return BEYBLADES[type].counteredBy;
}

export function isPerfectLaunch(power: number): boolean {
  return power >= 85 && power <= 95;
}

export function clampLaunchPower(power: number): number {
  return Math.max(10, Math.min(100, power));
}

export function opponentTopId(localTopId: TopId): TopId {
  return localTopId === "p1" ? "p2" : "p1";
}

export function localMatchOutcome(
  winnerId: WinnerId,
  localTopId: TopId,
): "victory" | "defeat" | "draw" {
  if (winnerId === "draw") return "draw";
  return winnerId === localTopId ? "victory" : "defeat";
}

export interface BattleRecord {
  readonly wins: number;
  readonly losses: number;
}

export const EMPTY_BATTLE_RECORD: BattleRecord = { wins: 0, losses: 0 };

export const MAX_BATTLE_RECORD_COUNT = 1_000_000;

export function applyBattleOutcome(
  record: BattleRecord,
  outcome: "win" | "loss",
): BattleRecord {
  return outcome === "win"
    ? { ...record, wins: Math.min(record.wins + 1, MAX_BATTLE_RECORD_COUNT) }
    : {
        ...record,
        losses: Math.min(record.losses + 1, MAX_BATTLE_RECORD_COUNT),
      };
}

export function formatBattleRecord(record: BattleRecord): string {
  const total = record.wins + record.losses;
  const winRate = total === 0 ? 0 : (record.wins / total) * 100;
  return `${total}場 (勝率 ${winRate.toFixed(1)}%)`;
}

export function sanitizeBattleRecord(value: unknown): BattleRecord {
  if (typeof value !== "object" || value === null) return EMPTY_BATTLE_RECORD;
  const { wins, losses } = value as { wins?: unknown; losses?: unknown };
  return {
    wins: sanitizeBattleCount(wins),
    losses: sanitizeBattleCount(losses),
  };
}

function sanitizeBattleCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0)
    return 0;
  return Math.min(value, MAX_BATTLE_RECORD_COUNT);
}

export function resolveMatchFinish(
  snapshot: BattleSnapshot,
  timeLimit = 20,
):
  | {
      winnerId: WinnerId;
      finishType: FinishType;
    }
  | undefined {
  const { p1, p2 } = snapshot;
  if (p1.isOut && p2.isOut)
    return { winnerId: "draw", finishType: "OVER FINISH" };
  if (p1.isOut && !p2.isOut)
    return { winnerId: "p2", finishType: "OVER FINISH" };
  if (p2.isOut && !p1.isOut)
    return { winnerId: "p1", finishType: "OVER FINISH" };

  if (p1.isBurst && p2.isBurst)
    return { winnerId: "draw", finishType: "BURST FINISH" };
  if (p1.isBurst && !p2.isBurst)
    return { winnerId: "p2", finishType: "BURST FINISH" };
  if (p2.isBurst && !p1.isBurst)
    return { winnerId: "p1", finishType: "BURST FINISH" };

  if (p1.isStopped && p2.isStopped)
    return { winnerId: "draw", finishType: "SPIN FINISH" };
  if (p1.isStopped) return { winnerId: "p2", finishType: "SPIN FINISH" };
  if (p2.isStopped) return { winnerId: "p1", finishType: "SPIN FINISH" };
  if (snapshot.elapsed < timeLimit) return undefined;
  const difference = p1.rpm - p2.rpm;
  return {
    winnerId:
      Math.abs(difference) < 100 ? "draw" : difference > 0 ? "p1" : "p2",
    finishType: "TIME FINISH",
  };
}

export class BeybladeRuntime implements GameRuntime<
  MatchConfig,
  BeybladeState,
  BeybladeInput,
  MatchResult
> {
  #status: GameStatus = "idle";
  #simulation: BattleSimulation;
  #listeners = new Set<
    (event: GameEvent<BeybladeState, MatchResult>) => void
  >();
  #state: BeybladeState;
  #endingRemaining = 0;
  #pendingResult: MatchResult | null = null;

  constructor(simulation: BattleSimulation) {
    this.#simulation = simulation;
    const config: MatchConfig = {
      p1Type: "attack",
      p2Type: "defense",
      stadiumTheme: "neon",
      perfectLaunchTopIds: ["p1"],
    };
    this.#state = {
      phase: "menu",
      config,
      battle: null,
      result: null,
      events: [],
      eventsTick: 0,
    };
  }

  get status(): GameStatus {
    return this.#status;
  }

  get state(): BeybladeState {
    return this.#state;
  }

  initialize(config: MatchConfig): void {
    this.#assertActive();
    this.#simulation.initialize(config);
    this.#endingRemaining = 0;
    this.#pendingResult = null;
    this.#setState({
      phase: "launch",
      config,
      battle: this.#simulation.snapshot,
      result: null,
      events: [],
      eventsTick: 0,
    });
    this.#setStatus("idle");
  }

  start(): void {
    this.#assertActive();
    this.#setStatus("running");
  }

  pause(): void {
    if (this.#status === "running") this.#setStatus("paused");
  }

  resume(): void {
    if (this.#status === "paused") this.#setStatus("running");
  }

  dispatch(input: BeybladeInput): void {
    this.#assertActive();
    if (input.type === "prepare") {
      this.initialize(input.config);
      return;
    }
    if (input.type === "leave") {
      this.#simulation.dispose();
      this.#endingRemaining = 0;
      this.#pendingResult = null;
      this.#setStatus("idle");
      this.#setState({
        ...this.#state,
        phase: "menu",
        battle: null,
        result: null,
        events: [],
        eventsTick: 0,
      });
      return;
    }
    if (input.type === "launch" && this.#state.phase === "launch") {
      this.#simulation.launch(input.launch);
      this.#setStatus("running");
      this.#setState({ ...this.#state, phase: "battle", events: [] });
      return;
    }
    if (
      input.type !== "tick" ||
      this.#status !== "running" ||
      (this.#state.phase !== "battle" && this.#state.phase !== "ending")
    ) {
      return;
    }
    const deltaSeconds = Math.min(input.deltaSeconds, 0.1);
    if (this.#state.phase === "ending") {
      const step = this.#simulation.step(deltaSeconds * 0.25);
      this.#endingRemaining -= deltaSeconds;
      if (this.#endingRemaining > 0 || !this.#pendingResult) {
        this.#setState({
          ...this.#state,
          battle: step.snapshot,
          events: step.events,
          eventsTick: step.tick,
        });
        return;
      }
      const result = this.#pendingResult;
      this.#pendingResult = null;
      this.#setStatus("ended");
      this.#setState({
        ...this.#state,
        phase: "result",
        battle: step.snapshot,
        events: step.events,
        eventsTick: step.tick,
        result,
      });
      this.#emit({ type: "ended", result });
      return;
    }
    const step = this.#simulation.step(deltaSeconds);
    if (!step.finish) {
      this.#setState({
        ...this.#state,
        battle: step.snapshot,
        events: step.events,
        eventsTick: step.tick,
      });
      return;
    }
    const winner =
      step.finish.winnerId === "p1"
        ? step.snapshot.p1
        : step.finish.winnerId === "p2"
          ? step.snapshot.p2
          : null;
    const result: MatchResult = {
      winnerId: step.finish.winnerId,
      finishType: step.finish.finishType,
      duration: step.snapshot.elapsed,
      finalRpm: winner ? Math.round(winner.rpm) : 0,
    };
    this.#pendingResult = result;
    this.#endingRemaining = 1.2;
    this.#setState({
      ...this.#state,
      phase: "ending",
      battle: step.snapshot,
      events: step.events,
      eventsTick: step.tick,
      result,
    });
  }

  subscribe(
    listener: (event: GameEvent<BeybladeState, MatchResult>) => void,
  ): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  dispose(): void {
    this.#simulation.dispose();
    this.#setStatus("disposed");
    this.#listeners.clear();
  }

  #setState(state: BeybladeState): void {
    this.#state = state;
    this.#emit({ type: "stateChanged", state });
  }

  #setStatus(status: GameStatus): void {
    this.#status = status;
    this.#emit({ type: "statusChanged", status });
  }

  #emit(event: GameEvent<BeybladeState, MatchResult>): void {
    this.#listeners.forEach((listener) => listener(event));
  }

  #assertActive(): void {
    if (this.#status === "disposed") throw new Error("runtime is disposed");
  }
}

export type EnvironmentScene =
  "space" | "sunset" | "deep-sea" | "neon-city" | "glacier";

export interface EnvironmentSceneConfig {
  readonly id: EnvironmentScene;
  readonly name: string;
  readonly englishName: string;
  readonly backgroundColor: number;
  readonly fogDensity: number;
}

export const ENVIRONMENT_SCENES: ReadonlyArray<EnvironmentSceneConfig> = [
  {
    id: "space",
    name: "預設太空",
    englishName: "Space Void",
    backgroundColor: 0x05060d,
    fogDensity: 0.022,
  },
  {
    id: "sunset",
    name: "黃昏競技場",
    englishName: "Sunset Arena",
    backgroundColor: 0x1a0a1f,
    fogDensity: 0.02,
  },
  {
    id: "deep-sea",
    name: "深海競技場",
    englishName: "Deep Sea",
    backgroundColor: 0x04161f,
    fogDensity: 0.026,
  },
  {
    id: "neon-city",
    name: "霓虹城市",
    englishName: "Neon City",
    backgroundColor: 0x080014,
    fogDensity: 0.025,
  },
  {
    id: "glacier",
    name: "冰原極光",
    englishName: "Glacier Aurora",
    backgroundColor: 0x08131a,
    fogDensity: 0.022,
  },
];

export function getEnvironmentSceneConfig(
  id: EnvironmentScene,
): EnvironmentSceneConfig {
  const config = ENVIRONMENT_SCENES.find((scene) => scene.id === id);
  if (!config) {
    throw new Error(`Unknown environment scene: ${id}`);
  }
  return config;
}

export function pickRandomEnvironmentScene(
  random: () => number = Math.random,
): EnvironmentScene {
  const index = Math.floor(random() * ENVIRONMENT_SCENES.length);
  const safe = Math.max(0, Math.min(index, ENVIRONMENT_SCENES.length - 1));
  return ENVIRONMENT_SCENES[safe]!.id;
}

export * from "./share-card";
