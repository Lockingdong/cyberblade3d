import type { BeybladeType } from "@game-pool/beyblade-core";
import * as THREE from "three";
import {
  buildBlade as buildAttackBlade,
  buildIgnisBlade,
  buildRatchet as buildAttackRatchet,
  buildDrakeRatchet,
  buildBit as buildAttackBit,
  buildImpactBit,
  buildChip as buildAttackChip,
  buildDrakeChip,
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
import type { DetailedBladeBuilder } from "./types";

export const DETAILED_BUILDERS: Record<
  BeybladeType,
  DetailedBladeBuilder
> = {
  attack: buildAttackDetailed,
  balance: buildBalanceDetailed,
  defense: buildDefenseDetailed,
  stamina: buildStaminaDetailed,
};

export const BLADE_BUILDERS: Record<string, (color: number) => THREE.Group> = {
  // Canonical Beyblade Types & Custom Parts
  attack_slash: buildAttackBlade,
  attack_ignis: buildIgnisBlade,
  defense_shield: buildDefenseBlade,
  stamina_solar: buildStaminaBlade,
  balance_emerald: buildBalanceBlade,
};

export const RATCHET_BUILDERS: Record<string, (color: number) => THREE.Group> = {
  // Canonical Beyblade Types & Custom Parts
  attack_standard: buildAttackRatchet,
  attack_drake_ratchet: buildDrakeRatchet,
  defense_standard: buildDefenseRatchet,
  stamina_standard: buildStaminaRatchet,
  balance_standard: buildBalanceRatchet,
};

export const BIT_BUILDERS: Record<string, (color: number) => THREE.Group> = {
  // Canonical Beyblade Types & Custom Parts
  attack_flat: buildAttackBit,
  attack_impact_bit: buildImpactBit,
  defense_ball: buildDefenseBit,
  stamina_stamina: buildStaminaBit,
  balance_balance: buildBalanceBit,
};

export const CHIP_BUILDERS: Record<string, (color: number) => THREE.Group> = {
  // Canonical Beyblade Types & Custom Parts
  attack_core: buildAttackChip,
  attack_drake_chip: buildDrakeChip,
  defense_core: buildDefenseChip,
  stamina_core: buildStaminaChip,
  balance_core: buildBalanceChip,
};
