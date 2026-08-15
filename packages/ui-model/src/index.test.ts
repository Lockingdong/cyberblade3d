import { describe, expect, it } from "vitest";
import { BEYBLADES } from "@cyberblade/core";
import {
  buildBladeSelectionViewModel,
  buildOnlinePreparationCopy,
  resultOutcomeCopy,
} from "./index";

describe("ui model", () => {
  it("builds the canonical carousel with an unavailable upcoming item", () => {
    const model = buildBladeSelectionViewModel("defense");
    expect(model.items.map((item) => item.id)).toEqual([
      "attack",
      "defense",
      "stamina",
      "balance",
      "upcoming",
    ]);
    expect(model.counter).toBe("2 / 05");
    expect(model.items[1]?.selected).toBe(true);
    expect(model.items.at(-1)).toMatchObject({ selectable: false, type: null });
  });

  it("uses a custom assembled spec for details and display stats", () => {
    const custom = { ...BEYBLADES.attack, name: "測試陀螺", maxRpm: 4321 };
    const model = buildBladeSelectionViewModel("attack", custom);
    expect(model.details.name).toBe("測試陀螺");
    expect(model.details.stats[0]?.displayValue).toBe("4321 RPM");
  });

  it("keeps friend selection and power copy deterministic", () => {
    expect(
      buildOnlinePreparationCopy({
        step: "select",
        canSelectBlade: true,
        locked: false,
        opponentReady: true,
      }).title,
    ).toBe("選擇出戰陀螺");
    expect(
      buildOnlinePreparationCopy({
        step: "power",
        canSelectBlade: true,
        locked: true,
        opponentReady: false,
      }),
    ).toMatchObject({
      primaryAction: "已鎖定發射",
      secondaryAction: "返回重選陀螺",
    });
  });

  it("maps result outcomes to shared labels", () => {
    expect(resultOutcomeCopy("victory")).toBe("VICTORY");
    expect(resultOutcomeCopy("defeat")).toBe("DEFEAT");
    expect(resultOutcomeCopy("draw")).toBe("DRAW");
  });
});
