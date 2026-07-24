import type { BeybladeType } from "@game-pool/beyblade-core";
import * as THREE from "three";
import {
  buildBlade as buildAttackBlade,
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
  // 4 Canonical Beyblade Types
  attack_slash: buildAttackBlade,
  defense_shield: buildDefenseBlade,
  stamina_solar: buildStaminaBlade,
  balance_emerald: buildBalanceBlade,
};

export const RATCHET_BUILDERS: Record<string, (color: number) => THREE.Group> = {
  // 4 Canonical Beyblade Types
  attack_standard: buildAttackRatchet,
  defense_standard: buildDefenseRatchet,
  stamina_standard: buildStaminaRatchet,
  balance_standard: buildBalanceRatchet,
};

export const BIT_BUILDERS: Record<string, (color: number) => THREE.Group> = {
  // 4 Canonical Beyblade Types
  attack_flat: buildAttackBit,
  defense_ball: buildDefenseBit,
  stamina_stamina: buildStaminaBit,
  balance_balance: buildBalanceBit,
};

export const CHIP_BUILDERS: Record<string, (color: number) => THREE.Group> = {
  // 4 Canonical Beyblade Types
  attack_core: buildAttackChip,
  defense_core: buildDefenseChip,
  stamina_core: buildStaminaChip,
  balance_core: buildBalanceChip,
};
