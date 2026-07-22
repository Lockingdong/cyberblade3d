import type { SimulationEvent } from "@game-pool/beyblade-core";
import type { BattleEventMessage } from "@game-pool/beyblade-multiplayer";

export class RemoteFeedbackDeduper {
  #lastEventId = -1;

  consume(
    messages: readonly BattleEventMessage[],
    feedback: (event: SimulationEvent) => void,
  ): void {
    for (const message of messages) {
      if (message.eventId <= this.#lastEventId) continue;
      this.#lastEventId = message.eventId;
      const event = message.event;
      if (event.kind === "collision") {
        feedback({
          type: "collision",
          position: {
            x: event.p[0],
            y: event.p[1],
            z: event.p[2],
          },
          intensity: event.intensity,
        });
      } else if (event.kind === "burst") {
        feedback({
          type: "burst",
          top: event.top,
          position: {
            x: event.p[0],
            y: event.p[1],
            z: event.p[2],
          },
        });
      }
    }
  }

  reset(): void {
    this.#lastEventId = -1;
  }
}
