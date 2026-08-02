import { describe, expect, it } from "vitest";
import {
  buildInviteUrl,
  isActiveOnlineRoom,
  onlinePageExitAction,
  readRoomCodeFromLocation,
  resolveWebSocketUrl,
} from "./online";

describe("resolveWebSocketUrl", () => {
  it("uses an explicit public URL", () => {
    expect(
      resolveWebSocketUrl(" wss://game.example/ws ", {
        protocol: "http:",
        host: "localhost:5173",
      }),
    ).toBe("wss://game.example/ws");
  });

  it("derives the proxied development URL from the page", () => {
    expect(
      resolveWebSocketUrl(undefined, {
        protocol: "http:",
        host: "localhost:5173",
      }),
    ).toBe("ws://localhost:5173/ws");
    expect(
      resolveWebSocketUrl(undefined, {
        protocol: "https:",
        host: "game.example",
      }),
    ).toBe("wss://game.example/ws");
  });
});

describe("isActiveOnlineRoom", () => {
  it("only leaves server-owned room phases on page lifecycle events", () => {
    expect(isActiveOnlineRoom("matched")).toBe(true);
    expect(isActiveOnlineRoom("waiting_ready")).toBe(true);
    expect(isActiveOnlineRoom("countdown")).toBe(true);
    expect(isActiveOnlineRoom("battle")).toBe(true);
    expect(isActiveOnlineRoom("ending")).toBe(true);
    expect(isActiveOnlineRoom("queued")).toBe(false);
    expect(isActiveOnlineRoom("result")).toBe(false);
  });
});

describe("onlinePageExitAction", () => {
  it("cancels matchmaking and leaves active rooms", () => {
    expect(onlinePageExitAction("connecting")).toBe("cancel_queue");
    expect(onlinePageExitAction("queued")).toBe("cancel_queue");
    expect(onlinePageExitAction("hosting")).toBe("cancel_queue");
    expect(onlinePageExitAction("joining")).toBe("cancel_queue");
    expect(onlinePageExitAction("countdown")).toBe("leave");
    expect(onlinePageExitAction("battle")).toBe("leave");
    // The room outlives match_end for the rematch offer, so it must be released.
    expect(onlinePageExitAction("result")).toBe("leave");
    expect(onlinePageExitAction("lobby")).toBeNull();
  });
});

describe("invite links", () => {
  it("builds a link on the current page", () => {
    expect(
      buildInviteUrl("k7m2p9", {
        origin: "https://game.example",
        pathname: "/play",
      }),
    ).toBe("https://game.example/play?room=K7M2P9");
  });

  it("reads only well-formed codes back out", () => {
    expect(readRoomCodeFromLocation("?room=k7m2-p9")).toBe("K7M2P9");
    expect(readRoomCodeFromLocation("?room=K7M2P0")).toBeNull();
    expect(readRoomCodeFromLocation("?other=1")).toBeNull();
    expect(readRoomCodeFromLocation("")).toBeNull();
  });
});
