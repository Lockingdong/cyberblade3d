import { useEffect, useState, type RefObject } from "react";
import type {
  BeybladeRuntime,
  BattleSnapshot,
  SimulationEvent,
} from "@cyberblade/core";
import type { OnlineMatchCoordinator } from "@cyberblade/multiplayer";
import { BattlePresentation } from "./battle-presentation";
import { synth } from "./audio";

export function useBattlePresentation(
  runtime: BeybladeRuntime,
  coordinator: OnlineMatchCoordinator,
  mode: RefObject<string>,
) {
  const [presentation] = useState(() => new BattlePresentation());
  useEffect(() => {
    let source: unknown;
    const scraped = { p1: false, p2: false };
    const push = (
      snapshot: BattleSnapshot | null,
      events: readonly SimulationEvent[],
      tick: number,
      audible = true,
    ) => {
      const fresh = presentation.push(snapshot, events, tick);
      let collision = 0;
      let burst = false;
      let special = false;
      for (const event of fresh) {
        if (event.type === "collision")
          collision = Math.max(collision, event.intensity);
        if (event.type === "burst") burst = true;
        if (event.type === "special") special = true;
      }
      if (collision > 0) synth.collision(collision);
      if (burst) synth.burst();
      if (special) synth.special();
      if (!snapshot || !audible) {
        scraped.p1 = scraped.p2 = false;
        synth.stop();
        return;
      }
      for (const id of ["p1", "p2"] as const) {
        const top = snapshot[id];
        if (!top.isStopped && !top.isBurst) {
          scraped[id] = false;
          synth.startSpin(id, top.rpm);
          synth.updateSpin(id, top.rpm);
        } else {
          if (top.isStopped && !top.isBurst && !scraped[id]) synth.scrape();
          scraped[id] = true;
          synth.stopSpin(id);
        }
      }
    };
    const local = runtime.subscribe((event) => {
      if (
        event.type !== "stateChanged" ||
        mode.current === "menu" ||
        (mode.current === "online" && coordinator.state.role !== "host")
      )
        return;
      const state = event.state;
      if (source !== state.config) {
        source = state.config;
        presentation.reset();
      }
      const active = ["battle", "ending", "result"].includes(state.phase);
      push(state.battle, active ? state.events : [], state.eventsTick, active);
    });
    const remote = coordinator.subscribe((state) => {
      if (mode.current !== "online") return;
      const active = ["battle", "ending", "result"].includes(state.phase);
      if (!active) synth.stop();
      if (state.role !== "guest") return;
      if (source !== state.matchId) {
        source = state.matchId;
        presentation.reset();
      }
      push(
        state.view.snapshot,
        active ? state.view.visualEvents : [],
        state.view.eventsTick,
        active,
      );
    });
    return () => {
      local();
      remote();
      synth.stop();
    };
  }, [runtime, coordinator, mode, presentation]);
  return presentation;
}
