import { describe, expect, it } from "vitest";
import { BattlePresentation, HudPublisher } from "./battle-presentation";
import type { SimulationEvent } from "@cyberblade/core";

const collision: SimulationEvent = {
  type: "collision",
  position: { x: 0, y: 0, z: 0 },
  intensity: 2,
};
const burst: SimulationEvent = {
  type: "burst",
  top: "p1",
  position: { x: 0, y: 0, z: 0 },
};

describe("battle presentation", () => {
  it("preserves events across steps, consumes them once, and accepts restarted ticks", () => {
    const feed = new BattlePresentation();
    feed.push(null, [collision], 1);
    feed.push(null, [collision], 1);
    feed.push(null, [burst], 2);
    const frame = feed.read();
    expect(frame.events).toEqual([collision, burst]);
    expect(feed.read().events).toEqual([]);
    feed.reset();
    feed.push(null, [burst], 1);
    expect(feed.read().tick).toBeGreaterThan(frame.tick);
    expect(feed.push(null, [burst], 1)).toEqual([]);
  });

  it("bounds a delayed decorative batch while preserving burst events", () => {
    const feed = new BattlePresentation();
    const trail: SimulationEvent = {
      type: "trail",
      top: "p1",
      position: { x: 0, y: 0, z: 0 },
      intensity: 1,
    };
    feed.push(null, [...Array<SimulationEvent>(200).fill(trail), burst], 1);
    const frame = feed.read();
    expect(frame.events).toHaveLength(65);
    expect(frame.events.at(-1)).toBe(burst);
  });

  it("publishes a 60 fps stream at 10 Hz but never delays phase changes", () => {
    const published: number[] = [];
    const hud = new HudPublisher<number>((value) => published.push(value));
    for (let time = 0; time < 1000; time += 1000 / 60)
      hud.update(time, "battle", time);
    expect(published.length).toBeLessThanOrEqual(10);
    hud.update(1001, "ending", 1001);
    hud.update(1002, "result", 1002);
    expect(published.slice(-2)).toEqual([1001, 1002]);
  });
});
