import { describe, expect, it } from "vitest";
import {
  resolveMobileWebSocketUrl,
  shouldHostLeaveForAppState,
} from "./online";

describe("resolveMobileWebSocketUrl", () => {
  it("accepts LAN development and production WebSocket URLs", () => {
    expect(resolveMobileWebSocketUrl(" ws://192.168.1.20:8787/ws ")).toBe(
      "ws://192.168.1.20:8787/ws",
    );
    expect(resolveMobileWebSocketUrl("wss://game.example/ws")).toBe(
      "wss://game.example/ws",
    );
  });

  it("rejects missing and non-WebSocket URLs", () => {
    expect(() => resolveMobileWebSocketUrl("")).toThrow(
      "EXPO_PUBLIC_BEYBLADE_WS_URL",
    );
    expect(() => resolveMobileWebSocketUrl("https://game.example/ws")).toThrow(
      "ws:// 或 wss://",
    );
  });
});

describe("shouldHostLeaveForAppState", () => {
  it("leaves active host rooms but preserves a background guest view", () => {
    expect(shouldHostLeaveForAppState("host", "battle", "background")).toBe(
      true,
    );
    expect(shouldHostLeaveForAppState("host", "countdown", "inactive")).toBe(
      true,
    );
    expect(shouldHostLeaveForAppState("guest", "battle", "background")).toBe(
      false,
    );
    expect(shouldHostLeaveForAppState("host", "result", "background")).toBe(
      false,
    );
    expect(shouldHostLeaveForAppState("host", "battle", "active")).toBe(false);
  });
});
