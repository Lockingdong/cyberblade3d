import {
  isValidRoomCode,
  normalizeRoomCode,
  type OnlinePhase,
  type WebSocketLike,
} from "@cyberblade/multiplayer";

export const ROOM_QUERY_PARAM = "room";

export function resolveWebSocketUrl(
  configured: string | undefined = import.meta.env.VITE_PUBLIC_WS_URL,
  location: Pick<Location, "protocol" | "host"> = window.location,
): string {
  const value = configured?.trim();
  if (value) return value;
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/ws`;
}

export function createWebSocket(url: string): WebSocketLike {
  return new WebSocket(url);
}

/** Invite link a friend can open to land straight in the room code prompt. */
export function buildInviteUrl(
  code: string,
  location: Pick<Location, "origin" | "pathname"> = window.location,
): string {
  return `${location.origin}${location.pathname}?${ROOM_QUERY_PARAM}=${normalizeRoomCode(code)}`;
}

export function readRoomCodeFromLocation(
  search: string = window.location.search,
): string | null {
  const value = new URLSearchParams(search).get(ROOM_QUERY_PARAM);
  if (!value) return null;
  const code = normalizeRoomCode(value);
  return isValidRoomCode(code) ? code : null;
}

/** Drops the invite parameter so a reload does not rejoin a dead room. */
export function clearRoomParamFromUrl(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(ROOM_QUERY_PARAM)) return;
  url.searchParams.delete(ROOM_QUERY_PARAM);
  window.history.replaceState(null, "", url.toString());
}

export function isActiveOnlineRoom(phase: OnlinePhase): boolean {
  return ["matched", "waiting_ready", "countdown", "battle", "ending"].includes(
    phase,
  );
}

/**
 * Whether a backgrounded host has to release the room. Only the phases the host
 * actually drives count: it owns the simulation from the countdown onwards, and
 * a hidden tab stops rendering frames, which would freeze the guest's view.
 *
 * Blade selection is deliberately excluded. Nothing depends on the host there,
 * and a friend room now stays in that phase for minutes — long enough that
 * switching away to send someone the room code must not destroy the room. The
 * server's friend-room ready timeout is the backstop instead.
 */
export function hostShouldLeaveWhenHidden(phase: OnlinePhase): boolean {
  return ["countdown", "battle", "ending"].includes(phase);
}

export function onlinePageExitAction(
  phase: OnlinePhase,
): "cancel_queue" | "leave" | null {
  if (["connecting", "queued", "hosting", "joining"].includes(phase))
    return "cancel_queue";
  // A finished room stays open for a rematch, so result must release it too.
  return isActiveOnlineRoom(phase) || phase === "result" ? "leave" : null;
}
