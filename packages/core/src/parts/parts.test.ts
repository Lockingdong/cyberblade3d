import { describe, expect, it } from "vitest";
import { BEYBLADES } from "../index";
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
    expect(attackParts.allowedBlades).toEqual(["attack_slash", "attack_ignis", "attack_aegis"]);
    expect(attackParts.allowedRatchets).toEqual([
      "attack_standard",
      "attack_drake_ratchet",
      "attack_bastion_ratchet",
    ]);
    expect(attackParts.allowedBits).toEqual(["attack_flat", "attack_impact_bit", "attack_guard_bit"]);
    expect(attackParts.allowedChips).toEqual(["attack_core", "attack_drake_chip", "attack_bastion_chip"]);

    const defenseParts = getCompatibleParts("defense");
    expect(defenseParts.allowedBlades).toEqual(["defense_shield", "defense_silver_aegis"]);
    expect(defenseParts.allowedRatchets).toEqual([
      "defense_standard",
      "defense_crusader_ratchet",
    ]);
    expect(defenseParts.allowedBits).toEqual(["defense_ball", "defense_anchor_bit"]);
    expect(defenseParts.allowedChips).toEqual(["defense_core", "defense_aegis_chip"]);

    const staminaParts = getCompatibleParts("stamina");
    expect(staminaParts.allowedBlades).toEqual(["stamina_solar", "stamina_sky_gale"]);
    expect(staminaParts.allowedRatchets).toEqual([
      "stamina_standard",
      "stamina_sky_ring_ratchet",
    ]);
    expect(staminaParts.allowedBits).toEqual([
      "stamina_stamina",
      "stamina_zephyr_needle_bit",
    ]);
    expect(staminaParts.allowedChips).toEqual([
      "stamina_core",
      "stamina_sky_falcon_chip",
    ]);

    const balanceParts = getCompatibleParts("balance");
    expect(balanceParts.allowedBlades).toEqual([
      "balance_emerald",
      "balance_chameleon",
    ]);
    expect(balanceParts.allowedRatchets).toEqual([
      "balance_standard",
      "balance_mirage_ratchet",
    ]);
    expect(balanceParts.allowedBits).toEqual([
      "balance_balance",
      "balance_phantom_taper_bit",
    ]);
    expect(balanceParts.allowedChips).toEqual([
      "balance_core",
      "balance_chameleon_chip",
    ]);
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
    expect(specOriginal.name).toBe("赤紅狂龍");
    expect(specOriginal.englishName).toBe("Crimson Drake");

    const specDrake = assembleBeybladeSpec({
      type: "attack",
      bladeId: "attack_ignis",
      ratchetId: "attack_drake_ratchet",
      bitId: "attack_impact_bit",
      chipId: "attack_drake_chip",
      name: "龍焰暴龍",
      englishName: "Drake Ignis",
    });
    expect(specDrake.name).toBe("龍焰暴龍");
    expect(specDrake.englishName).toBe("Drake Ignis");
    expect(specDrake.attackMultiplier).toBe(1.4);
    expect(specDrake.mass).toBe(1.17);

    const specBastion = assembleBeybladeSpec({
      type: "attack",
      bladeId: "attack_aegis",
      ratchetId: "attack_bastion_ratchet",
      bitId: "attack_guard_bit",
      chipId: "attack_bastion_chip",
    });
    expect(specBastion.name).toBe("赤紅狂龍");
    expect(specBastion.englishName).toBe("Crimson Drake");
    expect(specBastion.attackMultiplier).toBe(1.15);
    expect(specBastion.damageTaken).toBe(0.55);
    expect(specBastion.maxStability).toBe(105);
    expect(specBastion.mass).toBe(1.3);
  });

  it("assembles the Silver Aegis defense set without replacing the Iron preset", () => {
    const spec = assembleBeybladeSpec({
      type: "defense",
      bladeId: "defense_silver_aegis",
      ratchetId: "defense_crusader_ratchet",
      bitId: "defense_anchor_bit",
      chipId: "defense_aegis_chip",
    });

    expect(spec).toMatchObject({
      type: "defense",
      name: "鐵臂玄武",
      englishName: "Iron Fortress",
      mass: 1.94,
      maxRpm: 4700,
      rpmDecay: 320,
      maxStability: 150,
      speed: 5.5,
      friction: 0.07,
      color: 0xc9d2dc,
      damageTaken: 0.52,
      attackMultiplier: 1.2,
      ai: "counterHold",
      counteredBy: "stamina",
    });
    expect(BEYBLADES.defense.bladeId).toBe("defense_shield");
    expect(BEYBLADES.defense.ratchetId).toBe("defense_standard");
    expect(BEYBLADES.defense.bitId).toBe("defense_ball");
    expect(BEYBLADES.defense.chipId).toBe("defense_core");
  });

  it("keeps the Iron set first when correcting an invalid defense config", () => {
    const result = validatePartCompatibility({
      type: "defense",
      bladeId: "missing_blade",
      ratchetId: "missing_ratchet",
      bitId: "missing_bit",
      chipId: "missing_chip",
    });
    expect(result.valid).toBe(false);
    expect(result.correctedConfig).toMatchObject({
      bladeId: "defense_shield",
      ratchetId: "defense_standard",
      bitId: "defense_ball",
      chipId: "defense_core",
    });
  });

  it("assembles the Golden Falcon stamina set without replacing the Sol preset", () => {
    const spec = assembleBeybladeSpec({
      type: "stamina",
      bladeId: "stamina_sky_gale",
      ratchetId: "stamina_sky_ring_ratchet",
      bitId: "stamina_zephyr_needle_bit",
      chipId: "stamina_sky_falcon_chip",
    });

    expect(spec).toMatchObject({
      type: "stamina",
      name: "耀陽神隼",
      englishName: "Solar Falcon",
      mass: 1.22,
      maxRpm: 5800,
      rpmDecay: 335,
      maxStability: 105,
      speed: 8,
      friction: 0.015,
      color: 0xffc800,
      damageTaken: 0.78,
      ai: "orbitEvade",
      counteredBy: "attack",
    });
    expect(spec.spinSteal).toBeUndefined();
    expect(spec.attackMultiplier).toBeUndefined();
    expect(BEYBLADES.stamina).toMatchObject({
      bladeId: "stamina_solar",
      ratchetId: "stamina_standard",
      bitId: "stamina_stamina",
      chipId: "stamina_core",
    });
  });

  it("allows free mixing between the Sol and Golden Falcon stamina parts", () => {
    const result = validatePartCompatibility({
      type: "stamina",
      bladeId: "stamina_sky_gale",
      ratchetId: "stamina_standard",
      bitId: "stamina_zephyr_needle_bit",
      chipId: "stamina_core",
    });
    expect(result.valid).toBe(true);
  });

  it("keeps the Sol set first when correcting an invalid stamina config", () => {
    const result = validatePartCompatibility({
      type: "stamina",
      bladeId: "missing_blade",
      ratchetId: "missing_ratchet",
      bitId: "missing_bit",
      chipId: "missing_chip",
    });
    expect(result.valid).toBe(false);
    expect(result.correctedConfig).toMatchObject({
      bladeId: "stamina_solar",
      ratchetId: "stamina_standard",
      bitId: "stamina_stamina",
      chipId: "stamina_core",
    });
  });

  it("assembles the Chameleon balance set without replacing the Emerald preset", () => {
    const spec = assembleBeybladeSpec({
      type: "balance",
      bladeId: "balance_chameleon",
      ratchetId: "balance_mirage_ratchet",
      bitId: "balance_phantom_taper_bit",
      chipId: "balance_chameleon_chip",
    });

    expect(spec).toMatchObject({
      type: "balance",
      name: "翡翠幻獸",
      englishName: "Jade Chameleon",
      mass: 1.05,
      maxRpm: 5550,
      rpmDecay: 350,
      maxStability: 100,
      speed: 11.5,
      friction: 0.06,
      color: 0x7c3aed,
      damageTaken: 0.9,
      ai: "adaptive",
      counteredBy: "attack",
    });
    expect(BEYBLADES.balance).toMatchObject({
      bladeId: "balance_emerald",
      ratchetId: "balance_standard",
      bitId: "balance_balance",
      chipId: "balance_core",
    });
  });

  it("allows free mixing between the Emerald and Chameleon balance parts", () => {
    const result = validatePartCompatibility({
      type: "balance",
      bladeId: "balance_chameleon",
      ratchetId: "balance_standard",
      bitId: "balance_phantom_taper_bit",
      chipId: "balance_core",
    });
    expect(result.valid).toBe(true);
  });
});
