import { describe, expect, it } from "vitest";
import {
  ROOM_CODE_LENGTH,
  isValidRoomCode,
  normalizeRoomCode,
} from "./room-code";

describe("room codes", () => {
  it("normalizes what players actually type", () => {
    expect(normalizeRoomCode(" k7m2-p9 ")).toBe("K7M2P9");
    expect(normalizeRoomCode("K7M 2P9")).toBe("K7M2P9");
  });

  it("accepts only codes built from the unambiguous alphabet", () => {
    expect(isValidRoomCode("K7M2P9")).toBe(true);
    expect(isValidRoomCode("k7m2p9")).toBe(false);
    // I, L, O, 0 and 1 are excluded because players misread them.
    expect(isValidRoomCode("K7M2P0")).toBe(false);
    expect(isValidRoomCode("K7M2PI")).toBe(false);
    expect(isValidRoomCode("K7M2P")).toBe(false);
    expect(isValidRoomCode("K7M2P99")).toBe(false);
    expect(ROOM_CODE_LENGTH).toBe(6);
  });
});
