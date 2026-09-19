import {
  BeybladeRuntime,
  stadiumVariantFromMatchId,
  type BeybladeState,
  type MatchConfig,
} from "@cyberblade/core";
import {
  OnlineMatchCoordinator,
  type OnlineMatchState,
} from "./online-match-coordinator";

/** Platform-neutral assembly of the server's agreed match selection. */
export function onlineMatchConfig(
  online: OnlineMatchState,
): MatchConfig | null {
  if (!online.start || !online.matchId) return null;
  return {
    p1Type: online.start.p1.blade,
    p2Type: online.start.p2.blade,
    stadiumTheme: online.start.stadium,
    stadiumVariant: stadiumVariantFromMatchId(online.matchId),
    perfectLaunchTopIds: ["p1", "p2"],
    ...(online.start.p1.color !== undefined
      ? { p1Color: online.start.p1.color }
      : {}),
    ...(online.start.p2.color !== undefined
      ? { p2Color: online.start.p2.color }
      : {}),
    ...(online.start.p1.bladeId ? { p1BladeId: online.start.p1.bladeId } : {}),
    ...(online.start.p1.ratchetId
      ? { p1RatchetId: online.start.p1.ratchetId }
      : {}),
    ...(online.start.p1.bitId ? { p1BitId: online.start.p1.bitId } : {}),
    ...(online.start.p1.chipId ? { p1ChipId: online.start.p1.chipId } : {}),
    ...(online.start.p2.bladeId ? { p2BladeId: online.start.p2.bladeId } : {}),
    ...(online.start.p2.ratchetId
      ? { p2RatchetId: online.start.p2.ratchetId }
      : {}),
    ...(online.start.p2.bitId ? { p2BitId: online.start.p2.bitId } : {}),
    ...(online.start.p2.chipId ? { p2ChipId: online.start.p2.chipId } : {}),
  };
}

/** Coordinates an injected local runtime with the host/guest network session.
 * Platform adapters own scheduling, storage, audio and subscriptions.
 */
export class BattleSession {
  #preparedMatch: string | null = null;
  #launchedMatch: string | null = null;
  #endingSentMatch: string | null = null;
  #resultSentMatch: string | null = null;
  #lastHostSeq = 0;
  #lastRelayedEventsTick = 0;
  constructor(
    readonly runtime: BeybladeRuntime,
    readonly coordinator: OnlineMatchCoordinator,
    readonly now: () => number = () => performance.now(),
  ) {}
  reset(): void {
    this.#preparedMatch = null;
    this.#launchedMatch = null;
    this.#endingSentMatch = null;
    this.#resultSentMatch = null;
    this.#lastHostSeq = 0;
    this.#lastRelayedEventsTick = 0;
  }
  prepare(): void {
    const current = this.coordinator.state;
    const config = onlineMatchConfig(current);
    if (
      current.role !== "host" ||
      current.phase !== "countdown" ||
      !current.matchId ||
      !config ||
      this.#preparedMatch === current.matchId
    )
      return;
    this.reset();
    this.runtime.dispatch({ type: "prepare", config });
    this.#preparedMatch = current.matchId;
  }
  tick(now: number, deltaSeconds: number): void {
    this.coordinator.update(now);
    const current = this.coordinator.state;
    if (
      current.role === "host" &&
      current.phase === "battle" &&
      current.matchId &&
      current.start &&
      this.runtime.state.phase === "launch" &&
      this.#launchedMatch !== current.matchId
    ) {
      this.runtime.dispatch({
        type: "launch",
        launch: {
          p1Power: current.start.p1.power,
          p1Angle: current.start.p1.angle,
          p2Power: current.start.p2.power,
          // Network angles are local deviations; p2 launches inward from +x.
          p2Angle: 180 + current.start.p2.angle,
        },
      });
      this.#launchedMatch = current.matchId;
    }
    if (
      current.role === "host" &&
      current.localTopId &&
      this.coordinator.takeOpponentSpecial()
    ) {
      this.runtime.dispatch({
        type: "special",
        top: current.localTopId === "p1" ? "p2" : "p1",
      });
    }
    if (
      current.role === "host" &&
      (current.phase === "battle" || current.phase === "ending") &&
      (this.runtime.state.phase === "battle" ||
        this.runtime.state.phase === "ending")
    ) {
      this.runtime.dispatch({
        type: "tick",
        deltaSeconds: deltaSeconds,
      });
    }
  }
  publish(next: BeybladeState): void {
    const currentOnline = this.coordinator.state;
    if (currentOnline.role !== "host" || !currentOnline.matchId) return;

    if (next.battle && (next.phase === "battle" || next.phase === "ending")) {
      const seq = this.coordinator.publishHostSnapshot(next.battle);
      if (seq !== null) this.#lastHostSeq = seq;
    }
    if (
      currentOnline.phase === "battle" &&
      next.battle &&
      next.eventsTick > this.#lastRelayedEventsTick
    ) {
      if (this.#lastHostSeq === 0) {
        this.#lastHostSeq =
          this.coordinator.publishHostSnapshot(next.battle, this.now(), true) ??
          0;
      }
      for (const simulationEvent of next.events) {
        if (simulationEvent.type === "trail") continue;
        this.coordinator.publishHostEvent(
          simulationEvent,
          this.#lastHostSeq,
          next.battle.elapsed,
        );
      }
      this.#lastRelayedEventsTick = next.eventsTick;
    }
    if (
      next.phase === "ending" &&
      next.result &&
      this.#endingSentMatch !== currentOnline.matchId
    ) {
      if (next.battle && this.#lastHostSeq === 0) {
        this.#lastHostSeq =
          this.coordinator.publishHostSnapshot(next.battle, this.now(), true) ??
          0;
      }
      this.coordinator.publishHostEvent(
        {
          type: "ending",
          winnerId: next.result.winnerId,
          finishType: next.result.finishType,
        },
        this.#lastHostSeq,
        next.battle?.elapsed ?? next.result.duration,
      );
      this.#endingSentMatch = currentOnline.matchId;
    }
    if (
      next.phase === "result" &&
      next.result &&
      next.battle &&
      this.#resultSentMatch !== currentOnline.matchId
    ) {
      const finalSeq = this.coordinator.publishHostSnapshot(
        next.battle,
        this.now(),
        true,
      );
      if (finalSeq !== null) this.#lastHostSeq = finalSeq;
      this.coordinator.publishMatchEnd(
        next.result,
        this.#lastHostSeq,
        next.battle.elapsed,
      );
      this.#resultSentMatch = currentOnline.matchId;
    }
  }
}
