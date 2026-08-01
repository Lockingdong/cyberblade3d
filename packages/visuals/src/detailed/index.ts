import type { BeybladeType } from "@cyberblade/core";
import * as THREE from "three";
import {
  buildBlade as buildAttackBlade,
  buildIgnisBlade,
  buildAegisBlade,
  buildRatchet as buildAttackRatchet,
  buildDrakeRatchet,
  buildBastionRatchet,
  buildBit as buildAttackBit,
  buildImpactBit,
  buildGuardBit,
  buildChip as buildAttackChip,
  buildDrakeChip,
  buildBastionChip,
  buildAttackDetailed,
} from "./attack";
import {
  buildBlade as buildBalanceBlade,
  buildRatchet as buildBalanceRatchet,
  buildBit as buildBalanceBit,
  buildChip as buildBalanceChip,
  buildChameleonBlade,
  buildMirageRatchet,
  buildPhantomTaperBit,
  buildChameleonChip,
  buildBalanceDetailed,
} from "./balance";
import {
  buildBlade as buildDefenseBlade,
  buildRatchet as buildDefenseRatchet,
  buildBit as buildDefenseBit,
  buildChip as buildDefenseChip,
  buildSilverAegisBlade,
  buildCrusaderRatchet,
  buildAnchorBit,
  buildAegisChip,
  buildDefenseDetailed,
} from "./defense";
import {
  buildBlade as buildStaminaBlade,
  buildRatchet as buildStaminaRatchet,
  buildBit as buildStaminaBit,
  buildChip as buildStaminaChip,
  buildGoldenFalconBlade,
  buildSolarRingRatchet,
  buildEternalNeedleBit,
  buildGoldenFalconChip,
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
  attack_aegis: buildAegisBlade,
  defense_shield: buildDefenseBlade,
  defense_silver_aegis: buildSilverAegisBlade,
  stamina_solar: buildStaminaBlade,
  stamina_sky_gale: buildGoldenFalconBlade,
  balance_emerald: buildBalanceBlade,
  balance_chameleon: buildChameleonBlade,
};

export const RATCHET_BUILDERS: Record<string, (color: number) => THREE.Group> = {
  // Canonical Beyblade Types & Custom Parts
  attack_standard: buildAttackRatchet,
  attack_drake_ratchet: buildDrakeRatchet,
  attack_bastion_ratchet: buildBastionRatchet,
  defense_standard: buildDefenseRatchet,
  defense_crusader_ratchet: buildCrusaderRatchet,
  stamina_standard: buildStaminaRatchet,
  stamina_sky_ring_ratchet: buildSolarRingRatchet,
  balance_standard: buildBalanceRatchet,
  balance_mirage_ratchet: buildMirageRatchet,
};

export const BIT_BUILDERS: Record<string, (color: number) => THREE.Group> = {
  // Canonical Beyblade Types & Custom Parts
  attack_flat: buildAttackBit,
  attack_impact_bit: buildImpactBit,
  attack_guard_bit: buildGuardBit,
  defense_ball: buildDefenseBit,
  defense_anchor_bit: buildAnchorBit,
  stamina_stamina: buildStaminaBit,
  stamina_zephyr_needle_bit: buildEternalNeedleBit,
  balance_balance: buildBalanceBit,
  balance_phantom_taper_bit: buildPhantomTaperBit,
};

export const CHIP_BUILDERS: Record<string, (color: number) => THREE.Group> = {
  // Canonical Beyblade Types & Custom Parts
  attack_core: buildAttackChip,
  attack_drake_chip: buildDrakeChip,
  attack_bastion_chip: buildBastionChip,
  defense_core: buildDefenseChip,
  defense_aegis_chip: buildAegisChip,
  stamina_core: buildStaminaChip,
  stamina_sky_falcon_chip: buildGoldenFalconChip,
  balance_core: buildBalanceChip,
  balance_chameleon_chip: buildChameleonChip,
};
