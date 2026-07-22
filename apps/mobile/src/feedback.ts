import * as Haptics from "expo-haptics";
import type { SimulationEvent } from "@game-pool/beyblade-core";
export { RemoteFeedbackDeduper } from "./feedback-deduper";

export function selectionFeedback(): void {
  void Haptics.selectionAsync();
}

export function battleFeedback(event: SimulationEvent): void {
  if (event.type === "collision") {
    void Haptics.impactAsync(
      event.intensity > 5
        ? Haptics.ImpactFeedbackStyle.Heavy
        : Haptics.ImpactFeedbackStyle.Medium,
    );
  } else if (event.type === "burst") {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }
}
