import { describe, expect, it } from "vitest";
import {
  buildInviteUrl,
  buildRoomInviteShareData,
  hostShouldLeaveWhenHidden,
  isActiveOnlineRoom,
  onlinePageExitAction,
  readRoomCodeFromLocation,
  resolveWebSocketUrl,
  loadFriendRoomResumeToken,
  saveFriendRoomResumeToken,
  shouldWarnBeforeOnlineExit,
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

describe("hostShouldLeaveWhenHidden", () => {
  it("keeps a backgrounded host in the room while blades are being picked", () => {
    // Friend rooms sit in these phases for minutes, so switching away to send
    // someone the room code must not tear the room down.
    expect(hostShouldLeaveWhenHidden("matched")).toBe(false);
    expect(hostShouldLeaveWhenHidden("waiting_ready")).toBe(false);
  });

  it("still releases the room once the host drives the simulation", () => {
    expect(hostShouldLeaveWhenHidden("countdown")).toBe(true);
    expect(hostShouldLeaveWhenHidden("battle")).toBe(true);
    expect(hostShouldLeaveWhenHidden("ending")).toBe(true);
    expect(hostShouldLeaveWhenHidden("result")).toBe(false);
    expect(hostShouldLeaveWhenHidden("hosting")).toBe(false);
  });
});

describe("onlinePageExitAction", () => {
  it("cancels matchmaking and leaves active rooms", () => {
    expect(onlinePageExitAction("connecting")).toBe("cancel_queue");
    expect(onlinePageExitAction("queued")).toBe("cancel_queue");
    expect(onlinePageExitAction("hosting")).toBeNull();
    expect(onlinePageExitAction("joining")).toBe("cancel_queue");
    expect(onlinePageExitAction("countdown")).toBe("leave");
    expect(onlinePageExitAction("battle")).toBe("leave");
    // The room outlives match_end for the rematch offer, so it must be released.
    expect(onlinePageExitAction("result")).toBe("leave");
    expect(onlinePageExitAction("lobby")).toBeNull();
  });
});

describe("shouldWarnBeforeOnlineExit", () => {
  it("warns whenever closing the page would release matchmaking state", () => {
    expect(shouldWarnBeforeOnlineExit("hosting")).toBe(false);
    expect(shouldWarnBeforeOnlineExit("waiting_ready")).toBe(true);
    expect(shouldWarnBeforeOnlineExit("battle")).toBe(true);
    expect(shouldWarnBeforeOnlineExit("result")).toBe(true);
  });

  it("does not warn on screens without an active request or room", () => {
    expect(shouldWarnBeforeOnlineExit("idle")).toBe(false);
    expect(shouldWarnBeforeOnlineExit("lobby")).toBe(false);
    expect(shouldWarnBeforeOnlineExit("error")).toBe(false);
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

  it("builds native share content with the normalized room code", () => {
    expect(
      buildRoomInviteShareData("k7m2-p9", "https://game.example/?room=K7M2P9"),
    ).toEqual({
      title: "CyberBlade 3D 好友對戰",
      text: "加入我的 CyberBlade 3D 好友房：K7M2P9",
      url: "https://game.example/?room=K7M2P9",
    });
  });

  it("reads only well-formed codes back out", () => {
    expect(readRoomCodeFromLocation("?room=k7m2-p9")).toBe("K7M2P9");
    expect(readRoomCodeFromLocation("?room=K7M2P0")).toBeNull();
    expect(readRoomCodeFromLocation("?other=1")).toBeNull();
    expect(readRoomCodeFromLocation("")).toBeNull();
  });
});

describe("friend room resume token", () => {
  it("persists and clears the opaque host credential", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    saveFriendRoomResumeToken("resume_123", storage);
    expect(loadFriendRoomResumeToken(storage)).toBe("resume_123");
    saveFriendRoomResumeToken(null, storage);
    expect(loadFriendRoomResumeToken(storage)).toBeNull();
  });
});
