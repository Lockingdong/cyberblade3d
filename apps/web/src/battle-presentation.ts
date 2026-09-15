import type { BattleSnapshot, SimulationEvent } from "@cyberblade/core";

export interface BattleFrame {
  snapshot: BattleSnapshot | null;
  events: readonly SimulationEvent[];
  tick: number;
}

/** One render consumer; events survive multiple simulation steps between frames. */
export class BattlePresentation {
  #snapshot: BattleSnapshot | null = null;
  #pending: SimulationEvent[] = [];
  #sourceTick = -1;
  #version = 0;

  push(
    snapshot: BattleSnapshot | null,
    events: readonly SimulationEvent[],
    tick: number,
  ): readonly SimulationEvent[] {
    this.#snapshot = snapshot;
    if (tick <= this.#sourceTick) return [];
    this.#sourceTick = tick;
    this.#version++;
    // Bound decorative backlog while preserving gameplay effects through a delayed render.
    const fresh: SimulationEvent[] = [];
    for (const event of events) {
      if (event.type === "trail" && this.#pending.length >= 64) continue;
      this.#pending.push(event);
      fresh.push(event);
    }
    return fresh;
  }

  read = (): BattleFrame => {
    const events = this.#pending;
    this.#pending = [];
    return { snapshot: this.#snapshot, events, tick: this.#version };
  };

  reset(): void {
    this.#snapshot = null;
    this.#pending = [];
    this.#sourceTick = -1;
    // Remain monotonic even when a rematch reuses the visual world.
    this.#version++;
  }
}

/** Only high-frequency snapshots are throttled; semantic changes publish immediately. */
export class HudPublisher<T> {
  #lastAt = -Infinity;
  #key: string | null = null;
  constructor(
    readonly publish: (value: T) => void,
    readonly interval = 100,
  ) {}
  update(value: T, key: string, now: number): void {
    if (key !== this.#key || now - this.#lastAt >= this.interval) {
      this.#key = key;
      this.#lastAt = now;
      this.publish(value);
    }
  }
}
