import { describe, expect, it } from "vitest";
import {
  assembleBeybladeSpec,
  BEYBLADE_ALLOWED_PARTS,
  BLADE_PARTS,
  getCompatibleParts,
  validatePartCompatibility,
} from "./index";

describe("parts module", () => {
  it("returns allowed parts for each beyblade type", () => {
    const attackParts = getCompatibleParts("attack");
    expect(attackParts.allowedBlades).toEqual(["attack_slash", "attack_ignis"]);
    expect(attackParts.allowedRatchets).toEqual(["attack_standard", "attack_drake_ratchet"]);
    expect(attackParts.allowedBits).toEqual(["attack_flat", "attack_impact_bit"]);
    expect(attackParts.allowedChips).toEqual(["attack_core", "attack_drake_chip"]);
  });

  it("validates compatible configs successfully", () => {
    const validConfig = {
      type: "attack" as const,
      bladeId: "attack_ignis",
      ratchetId: "attack_drake_ratchet",
      bitId: "attack_impact_bit",
      chipId: "attack_drake_chip",
    };
    const result = validatePartCompatibility(validConfig);
    expect(result.valid).toBe(true);
    expect(result.correctedConfig).toEqual(validConfig);
  });

  it("corrects incompatible configs to allowed parts", () => {
    const invalidConfig = {
      type: "attack" as const,
      bladeId: "defense_shield", // Invalid for attack
      ratchetId: "stamina_standard", // Invalid for attack
      bitId: "attack_flat",
      chipId: "attack_core",
    };
    const result = validatePartCompatibility(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.correctedConfig.bladeId).toBe("attack_slash");
    expect(result.correctedConfig.ratchetId).toBe("attack_standard");
    expect(result.correctedConfig.bitId).toBe("attack_flat");
  });

  it("assembles spec with automatic correction for incompatible parts", () => {
    const spec = assembleBeybladeSpec({
      type: "attack",
      bladeId: "defense_shield",
      ratchetId: "defense_standard",
      bitId: "defense_ball",
      chipId: "defense_core",
    });
    expect(spec.type).toBe("attack");
    expect(spec.bladeId).toBe("attack_slash");
    expect(spec.ratchetId).toBe("attack_standard");
    expect(spec.bitId).toBe("attack_flat");
    expect(spec.chipId).toBe("attack_core");
  });

  it("uses chip name as default Beyblade name regardless of blade part", () => {
    const specOriginal = assembleBeybladeSpec({
      type: "attack",
      bladeId: "attack_slash",
      ratchetId: "attack_standard",
      bitId: "attack_flat",
      chipId: "attack_core",
    });
    expect(specOriginal.name).toBe("赤紅核心");
    expect(specOriginal.englishName).toBe("Crimson Core");

    const specDrake = assembleBeybladeSpec({
      type: "attack",
      bladeId: "attack_ignis",
      ratchetId: "attack_drake_ratchet",
      bitId: "attack_impact_bit",
      chipId: "attack_drake_chip",
    });
    expect(specDrake.name).toBe("龍焰核心");
    expect(specDrake.englishName).toBe("Drake Core");
    expect(specDrake.attackMultiplier).toBe(1.4);
    expect(specDrake.mass).toBe(1.17);
  });
});
