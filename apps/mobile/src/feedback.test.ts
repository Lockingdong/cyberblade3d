import { describe, expect, it, vi } from "vitest";
import type { BattleEventMessage } from "@game-pool/beyblade-multiplayer";
import { RemoteFeedbackDeduper } from "./feedback-deduper";

const collision: BattleEventMessage = {
  type: "battle_event",
  matchId: "m1",
  eventId: 4,
  stateSeq: 8,
  t: 1,
  event: { kind: "collision", p: [0, 0.8, 0], intensity: 3 },
};

describe("RemoteFeedbackDeduper", () => {
  it("plays each remote eventId once across repeated renders", () => {
    const deduper = new RemoteFeedbackDeduper();
    const feedback = vi.fn();
    deduper.consume([collision], feedback);
    deduper.consume([collision], feedback);
    expect(feedback).toHaveBeenCalledTimes(1);
    expect(feedback).toHaveBeenCalledWith(
      expect.objectContaining({ type: "collision", intensity: 3 }),
    );

    deduper.reset();
    deduper.consume([collision], feedback);
    expect(feedback).toHaveBeenCalledTimes(2);
  });
});
