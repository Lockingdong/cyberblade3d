import type { BeybladeType } from "../index";
import type { AllowedPartsConfig, CustomBeybladeConfig } from "./types";

export const BEYBLADE_ALLOWED_PARTS: Record<BeybladeType, AllowedPartsConfig> = {
  attack: {
    allowedBlades: ["attack_slash", "attack_ignis", "attack_aegis"],
    allowedRatchets: ["attack_standard", "attack_drake_ratchet", "attack_bastion_ratchet"],
    allowedBits: ["attack_flat", "attack_impact_bit", "attack_guard_bit"],
    allowedChips: ["attack_core", "attack_drake_chip", "attack_bastion_chip"],
  },
  defense: {
    allowedBlades: ["defense_shield", "defense_silver_aegis"],
    allowedRatchets: ["defense_standard", "defense_crusader_ratchet"],
    allowedBits: ["defense_ball", "defense_anchor_bit"],
    allowedChips: ["defense_core", "defense_aegis_chip"],
  },
  stamina: {
    allowedBlades: ["stamina_solar", "stamina_sky_gale"],
    allowedRatchets: ["stamina_standard", "stamina_sky_ring_ratchet"],
    allowedBits: ["stamina_stamina", "stamina_zephyr_needle_bit"],
    allowedChips: ["stamina_core", "stamina_sky_falcon_chip"],
  },
  balance: {
    allowedBlades: ["balance_emerald", "balance_chameleon"],
    allowedRatchets: ["balance_standard", "balance_mirage_ratchet"],
    allowedBits: ["balance_balance", "balance_phantom_taper_bit"],
    allowedChips: ["balance_core", "balance_chameleon_chip"],
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

/**
 * Turns a stored loadout into a complete, compatible config for `type`.
 *
 * Persisted loadouts are partial by nature: a player may never have opened the
 * garage for this blade, and a config saved by an older build can name parts
 * that the compatibility table no longer allows. Both cases resolve the same
 * way — the slot falls back to that blade's first compatible part.
 */
export function resolveCustomConfig(
  type: BeybladeType,
  stored?: Partial<CustomBeybladeConfig> | null,
): CustomBeybladeConfig {
  // An unset slot is passed through as an id no table can contain, so the
  // validator's own fallback handles "never chosen" and "no longer allowed"
  // through a single code path.
  const { correctedConfig } = validatePartCompatibility({
    type,
    bladeId: stored?.bladeId ?? "",
    ratchetId: stored?.ratchetId ?? "",
    bitId: stored?.bitId ?? "",
    chipId: stored?.chipId ?? "",
    ...(stored?.name ? { name: stored.name } : {}),
    ...(stored?.englishName ? { englishName: stored.englishName } : {}),
    ...(stored?.description ? { description: stored.description } : {}),
  });
  return correctedConfig;
}
