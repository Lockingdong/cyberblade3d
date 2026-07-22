import type { AiBehavior, BeybladeType } from "../index";

export interface BladePart {
  readonly id: string;
  readonly name: string;
  readonly englishName: string;
  readonly ai: AiBehavior;
  readonly damageTaken: number;
  readonly counteredBy: BeybladeType;
  readonly color: number;
  readonly massContribution: number;
  readonly attackMultiplier?: number;
  readonly exclusiveTo?: BeybladeType;
}

export interface RatchetPart {
  readonly id: string;
  readonly name: string;
  readonly englishName: string;
  readonly maxStability: number;
  readonly massContribution: number;
}

export interface BitPart {
  readonly id: string;
  readonly name: string;
  readonly englishName: string;
  readonly maxRpm: number;
  readonly rpmDecay: number;
  readonly speed: number;
  readonly friction: number;
  readonly massContribution: number;
  readonly spinSteal?: number;
}

export interface ChipPart {
  readonly id: string;
  readonly name: string;
  readonly englishName: string;
}

export interface CustomBeybladeConfig {
  readonly type: BeybladeType;
  readonly bladeId: string;
  readonly ratchetId: string;
  readonly bitId: string;
  readonly chipId: string;
  readonly name?: string;
  readonly englishName?: string;
}

export interface AllowedPartsConfig {
  readonly allowedBlades: readonly string[];
  readonly allowedRatchets: readonly string[];
  readonly allowedBits: readonly string[];
  readonly allowedChips: readonly string[];
}
