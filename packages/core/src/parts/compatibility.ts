import type { BeybladeType } from "../index";
import type { AllowedPartsConfig, CustomBeybladeConfig } from "./types";

export const BEYBLADE_ALLOWED_PARTS: Record<BeybladeType, AllowedPartsConfig> = {
  attack: {
    allowedBlades: ["attack_slash", "attack_ignis"],
    allowedRatchets: ["attack_standard", "attack_drake_ratchet"],
    allowedBits: ["attack_flat", "attack_impact_bit"],
    allowedChips: ["attack_core", "attack_drake_chip"],
  },
  defense: {
    allowedBlades: ["defense_shield"],
    allowedRatchets: ["defense_standard"],
    allowedBits: ["defense_ball"],
    allowedChips: ["defense_core"],
  },
  stamina: {
    allowedBlades: ["stamina_solar"],
    allowedRatchets: ["stamina_standard"],
    allowedBits: ["stamina_stamina"],
    allowedChips: ["stamina_core"],
  },
  balance: {
    allowedBlades: ["balance_emerald"],
    allowedRatchets: ["balance_standard"],
    allowedBits: ["balance_balance"],
    allowedChips: ["balance_core"],
  },
};

/**
 * Returns the list of compatible part IDs for a specific BeybladeType.
 */
export function getCompatibleParts(type: BeybladeType): AllowedPartsConfig {
  return BEYBLADE_ALLOWED_PARTS[type] || {
    allowedBlades: [type],
    allowedRatchets: [type],
    allowedBits: [type],
    allowedChips: [type],
  };
}

/**
 * Validates whether a CustomBeybladeConfig uses only compatible parts for its BeybladeType.
 * Returns `valid: true` if valid, or `valid: false` along with `correctedConfig` if invalid.
 */
export function validatePartCompatibility(config: CustomBeybladeConfig): {
  valid: boolean;
  correctedConfig: CustomBeybladeConfig;
} {
  const allowed = getCompatibleParts(config.type);

  const isBladeValid = allowed.allowedBlades.includes(config.bladeId);
  const isRatchetValid = allowed.allowedRatchets.includes(config.ratchetId);
  const isBitValid = allowed.allowedBits.includes(config.bitId);
  const isChipValid = allowed.allowedChips.includes(config.chipId);

  const isValid = isBladeValid && isRatchetValid && isBitValid && isChipValid;

  if (isValid) {
    return { valid: true, correctedConfig: config };
  }

  const correctedConfig: CustomBeybladeConfig = {
    ...config,
    bladeId: isBladeValid ? config.bladeId : (allowed.allowedBlades[0] ?? config.type),
    ratchetId: isRatchetValid ? config.ratchetId : (allowed.allowedRatchets[0] ?? config.type),
    bitId: isBitValid ? config.bitId : (allowed.allowedBits[0] ?? config.type),
    chipId: isChipValid ? config.chipId : (allowed.allowedChips[0] ?? config.type),
  };

  return { valid: false, correctedConfig };
}
