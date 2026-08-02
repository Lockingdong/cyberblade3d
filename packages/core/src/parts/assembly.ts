import type { BeybladeSpec } from "../index";
import type { CustomBeybladeConfig } from "./types";
import { BLADE_PARTS } from "./blades";
import { RATCHET_PARTS } from "./ratchets";
import { BIT_PARTS } from "./bits";
import { CHIP_PARTS } from "./chips";
import { validatePartCompatibility } from "./compatibility";

export function assembleBeybladeSpec(config: CustomBeybladeConfig): BeybladeSpec {
  const { correctedConfig } = validatePartCompatibility(config);

  const blade = BLADE_PARTS[correctedConfig.bladeId];
  const ratchet = RATCHET_PARTS[correctedConfig.ratchetId];
  const bit = BIT_PARTS[correctedConfig.bitId];
  const chip = CHIP_PARTS[correctedConfig.chipId];

  if (!blade || !ratchet || !bit || !chip) {
    throw new Error(
      `Invalid part IDs: ${correctedConfig.bladeId}, ${correctedConfig.ratchetId}, ${correctedConfig.bitId}, ${correctedConfig.chipId}`
    );
  }

  const defaultNames: Record<string, { name: string; englishName: string }> = {
    attack: { name: "赤紅狂龍", englishName: "Crimson Drake" },
    defense: { name: "鐵臂玄武", englishName: "Iron Fortress" },
    stamina: { name: "耀陽神隼", englishName: "Solar Falcon" },
    balance: { name: "翡翠幻獸", englishName: "Jade Chameleon" },
  };

  const defaultName = defaultNames[correctedConfig.type] ?? {
    name: "自訂陀螺",
    englishName: "Custom Beyblade",
  };

  const spec: BeybladeSpec = {
    type: correctedConfig.type,
    bladeId: correctedConfig.bladeId,
    ratchetId: correctedConfig.ratchetId,
    bitId: correctedConfig.bitId,
    chipId: correctedConfig.chipId,
    name: correctedConfig.name || defaultName.name,
    englishName: correctedConfig.englishName || defaultName.englishName,
    ...(correctedConfig.description ? { description: correctedConfig.description } : {}),
    mass: Math.round((blade.massContribution + ratchet.massContribution + bit.massContribution) * 100) / 100,
    maxRpm: bit.maxRpm,
    rpmDecay: bit.rpmDecay,
    maxStability: ratchet.maxStability,
    speed: bit.speed,
    friction: bit.friction,
    color: blade.color,
    damageTaken: blade.damageTaken,
    ai: blade.ai,
    counteredBy: blade.counteredBy,
  };

  if (bit.spinSteal !== undefined) {
    spec.spinSteal = bit.spinSteal;
  }
  if (blade.attackMultiplier !== undefined) {
    spec.attackMultiplier = blade.attackMultiplier;
  }

  return spec;
}
