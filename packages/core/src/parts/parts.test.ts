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
    expect(attackParts.allowedBlades).toContain("attack");
    expect(attackParts.allowedBlades).toContain("attack_v2");
    expect(attackParts.allowedRatchets).toEqual(["attack"]);
    expect(attackParts.allowedBits).toEqual(["attack"]);
    expect(attackParts.allowedChips).toEqual(["attack"]);
  });

  it("validates compatible configs successfully", () => {
    const validConfig = {
      type: "attack" as const,
      bladeId: "attack_v2",
      ratchetId: "attack",
      bitId: "attack",
      chipId: "attack",
    };
    const result = validatePartCompatibility(validConfig);
    expect(result.valid).toBe(true);
    expect(result.correctedConfig).toEqual(validConfig);
  });

  it("corrects incompatible configs to allowed parts", () => {
    const invalidConfig = {
      type: "attack" as const,
      bladeId: "defense", // Invalid for attack
      ratchetId: "stamina", // Invalid for attack
      bitId: "attack",
      chipId: "attack",
    };
    const result = validatePartCompatibility(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.correctedConfig.bladeId).toBe("attack");
    expect(result.correctedConfig.ratchetId).toBe("attack");
    expect(result.correctedConfig.bitId).toBe("attack");
  });

  it("assembles spec with automatic correction for incompatible parts", () => {
    const spec = assembleBeybladeSpec({
      type: "attack",
      bladeId: "defense",
      ratchetId: "defense",
      bitId: "defense",
      chipId: "defense",
    });
    expect(spec.type).toBe("attack");
    expect(spec.bladeId).toBe("attack");
    expect(spec.ratchetId).toBe("attack");
    expect(spec.bitId).toBe("attack");
    expect(spec.chipId).toBe("attack");
  });

  it("uses chip name as default Beyblade name regardless of blade part", () => {
    const spec = assembleBeybladeSpec({
      type: "attack",
      bladeId: "attack_v2",
      ratchetId: "attack",
      bitId: "attack",
      chipId: "attack",
    });
    expect(spec.name).toBe("赤紅狂嵐");
    expect(spec.englishName).toBe("Red Storm");
  });
});
