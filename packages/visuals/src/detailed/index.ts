import type { BeybladeType } from "@game-pool/beyblade-core";
import * as THREE from "three";
import {
  buildBlade as buildAttackBlade,
  buildAttackV2Blade,
  buildRatchet as buildAttackRatchet,
  buildBit as buildAttackBit,
  buildChip as buildAttackChip,
  buildAttackDetailed,
} from "./attack";
import {
  buildBlade as buildBalanceBlade,
  buildRatchet as buildBalanceRatchet,
  buildBit as buildBalanceBit,
  buildChip as buildBalanceChip,
  buildBalanceDetailed,
} from "./balance";
import {
  buildBlade as buildDefenseBlade,
  buildRatchet as buildDefenseRatchet,
  buildBit as buildDefenseBit,
  buildChip as buildDefenseChip,
  buildDefenseDetailed,
} from "./defense";
import {
  buildBlade as buildStaminaBlade,
  buildRatchet as buildStaminaRatchet,
  buildBit as buildStaminaBit,
  buildChip as buildStaminaChip,
  buildStaminaDetailed,
} from "./stamina";
import {
  buildBlade as buildCrusherBlade,
  buildRatchet as buildCrusherRatchet,
  buildBit as buildCrusherBit,
  buildChip as buildCrusherChip,
  buildCrusherDetailed,
} from "./crusher";
import {
  buildBlade as buildPhantomBlade,
  buildRatchet as buildPhantomRatchet,
  buildBit as buildPhantomBit,
  buildChip as buildPhantomChip,
  buildPhantomDetailed,
} from "./phantom";
import {
  buildBlade as buildAegisBlade,
  buildRatchet as buildAegisRatchet,
  buildBit as buildAegisBit,
  buildChip as buildAegisChip,
  buildAegisDetailed,
} from "./aegis";
import {
  buildBlade as buildVampireBlade,
  buildRatchet as buildVampireRatchet,
  buildBit as buildVampireBit,
  buildChip as buildVampireChip,
  buildVampireDetailed,
} from "./vampire";
import {
  buildBlade as buildZephyrBlade,
  buildRatchet as buildZephyrRatchet,
  buildBit as buildZephyrBit,
  buildChip as buildZephyrChip,
  buildZephyrDetailed,
} from "./zephyr";
import {
  buildBlade as buildBerserkBlade,
  buildRatchet as buildBerserkRatchet,
  buildBit as buildBerserkBit,
  buildChip as buildBerserkChip,
  buildBerserkDetailed,
} from "./berserk";
import type { DetailedBladeBuilder } from "./types";

// High-detail 3D model builders for all 10 Beyblade types.
export const DETAILED_BUILDERS: Record<
  BeybladeType,
  DetailedBladeBuilder
> = {
  attack: buildAttackDetailed,
  balance: buildBalanceDetailed,
  defense: buildDefenseDetailed,
  stamina: buildStaminaDetailed,
  crusher: buildCrusherDetailed,
  phantom: buildPhantomDetailed,
  aegis: buildAegisDetailed,
  vampire: buildVampireDetailed,
  zephyr: buildZephyrDetailed,
  berserk: buildBerserkDetailed,
};

export const BLADE_BUILDERS: Record<string, (color: number) => THREE.Group> = {
  attack: buildAttackBlade,
  attack_v2: buildAttackV2Blade,
  balance: buildBalanceBlade,
  defense: buildDefenseBlade,
  stamina: buildStaminaBlade,
  crusher: buildCrusherBlade,
  phantom: buildPhantomBlade,
  aegis: buildAegisBlade,
  vampire: buildVampireBlade,
  zephyr: buildZephyrBlade,
  berserk: buildBerserkBlade,
};

export const RATCHET_BUILDERS: Record<string, (color: number) => THREE.Group> = {
  attack: buildAttackRatchet,
  balance: buildBalanceRatchet,
  defense: buildDefenseRatchet,
  stamina: buildStaminaRatchet,
  crusher: buildCrusherRatchet,
  phantom: buildPhantomRatchet,
  aegis: buildAegisRatchet,
  vampire: buildVampireRatchet,
  zephyr: buildZephyrRatchet,
  berserk: buildBerserkRatchet,
};

export const BIT_BUILDERS: Record<string, (color: number) => THREE.Group> = {
  attack: buildAttackBit,
  balance: buildBalanceBit,
  defense: buildDefenseBit,
  stamina: buildStaminaBit,
  crusher: buildCrusherBit,
  phantom: buildPhantomBit,
  aegis: buildAegisBit,
  vampire: buildVampireBit,
  zephyr: buildZephyrBit,
  berserk: buildBerserkBit,
};

export const CHIP_BUILDERS: Record<string, (color: number) => THREE.Group> = {
  attack: buildAttackChip,
  balance: buildBalanceChip,
  defense: buildDefenseChip,
  stamina: buildStaminaChip,
  crusher: buildCrusherChip,
  phantom: buildPhantomChip,
  aegis: buildAegisChip,
  vampire: buildVampireChip,
  zephyr: buildZephyrChip,
  berserk: buildBerserkChip,
};
