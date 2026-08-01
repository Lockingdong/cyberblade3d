import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getCompatibleParts,
  type CustomBeybladeConfig,
} from "@cyberblade/core";
import { loadCustomParts, saveCustomParts } from "./profile";

const values = new Map<string, string>();
const localStorage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key),
};

describe("Web stamina custom parts", () => {
  beforeEach(() => {
    values.clear();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage },
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
  });

  it("lists every Golden Falcon component in the garage catalogs", () => {
    const allowed = getCompatibleParts("stamina");
    expect(allowed.allowedBlades).toContain("stamina_sky_gale");
    expect(allowed.allowedRatchets).toContain("stamina_sky_ring_ratchet");
    expect(allowed.allowedBits).toContain("stamina_zephyr_needle_bit");
    expect(allowed.allowedChips).toContain("stamina_sky_falcon_chip");
  });

  it("saves and reloads the selected Golden Falcon assembly", () => {
    const selected: CustomBeybladeConfig = {
      type: "stamina",
      bladeId: "stamina_sky_gale",
      ratchetId: "stamina_sky_ring_ratchet",
      bitId: "stamina_zephyr_needle_bit",
      chipId: "stamina_sky_falcon_chip",
    };
    saveCustomParts({ stamina: selected });
    expect(loadCustomParts()).toEqual({ stamina: selected });
  });
});
