import type { BeybladeType } from "../index";
import type { AllowedPartsConfig, CustomBeybladeConfig } from "./types";

export const BEYBLADE_ALLOWED_PARTS: Record<BeybladeType, AllowedPartsConfig> = {
  attack: {
    allowedBlades: ["attack", "attack_v2"],
    allowedRatchets: ["attack"],
    allowedBits: ["attack"],
    allowedChips: ["attack"],
  },
  defense: {
    allowedBlades: ["defense"],
    allowedRatchets: ["defense"],
    allowedBits: ["defense"],
    allowedChips: ["defense"],
  },
  stamina: {
    allowedBlades: ["stamina"],
    allowedRatchets: ["stamina"],
    allowedBits: ["stamina"],
    allowedChips: ["stamina"],
  },
  balance: {
    allowedBlades: ["balance"],
    allowedRatchets: ["balance"],
    allowedBits: ["balance"],
    allowedChips: ["balance"],
  },
  crusher: {
    allowedBlades: ["crusher"],
    allowedRatchets: ["crusher"],
    allowedBits: ["crusher"],
    allowedChips: ["crusher"],
  },
  phantom: {
    allowedBlades: ["phantom"],
    allowedRatchets: ["phantom"],
    allowedBits: ["phantom"],
    allowedChips: ["phantom"],
  },
  aegis: {
    allowedBlades: ["aegis"],
    allowedRatchets: ["aegis"],
    allowedBits: ["aegis"],
    allowedChips: ["aegis"],
  },
  vampire: {
    allowedBlades: ["vampire"],
    allowedRatchets: ["vampire"],
    allowedBits: ["vampire"],
    allowedChips: ["vampire"],
  },
  zephyr: {
    allowedBlades: ["zephyr"],
    allowedRatchets: ["zephyr"],
    allowedBits: ["zephyr"],
    allowedChips: ["zephyr"],
  },
  berserk: {
    allowedBlades: ["berserk"],
    allowedRatchets: ["berserk"],
    allowedBits: ["berserk"],
    allowedChips: ["berserk"],
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
