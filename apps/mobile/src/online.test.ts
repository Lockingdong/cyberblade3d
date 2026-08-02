import { describe, expect, it } from "vitest";
import {
  buildMobileInviteMessage,
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
    expect(() => resolveMobileWebSocketUrl("")).toThrow("EXPO_PUBLIC_WS_URL");
    expect(() => resolveMobileWebSocketUrl("https://game.example/ws")).toThrow(
      "ws:// 或 wss://",
    );
  });
});

describe("buildMobileInviteMessage", () => {
  it("adds a web invite link when the base URL is configured", () => {
    expect(buildMobileInviteMessage("k7m2p9", "https://game.example/")).toBe(
      "來 CyberBlade 3D 跟我對戰！房號：K7M2P9\nhttps://game.example/?room=K7M2P9",
    );
  });

  it("falls back to the bare code without a base URL", () => {
    expect(buildMobileInviteMessage("K7M2P9", "")).toBe(
      "來 CyberBlade 3D 跟我對戰！房號：K7M2P9",
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
