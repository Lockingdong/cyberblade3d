import {
  normalizeRoomCode,
  type OnlinePhase,
  type WebSocketLike,
} from "@cyberblade/multiplayer";

export function resolveMobileWebSocketUrl(
  configured: string | undefined = process.env.EXPO_PUBLIC_WS_URL,
): string {
  const value = configured?.trim();
  if (!value)
    throw new Error("請設定 EXPO_PUBLIC_WS_URL；實機開發請使用電腦的 LAN IP。");
  if (!/^wss?:\/\//i.test(value))
    throw new Error("EXPO_PUBLIC_WS_URL 必須使用 ws:// 或 wss://。");
  return value;
}

export function createMobileWebSocket(url: string): WebSocketLike {
  return new WebSocket(url);
}

/**
 * Invite link for the web build. Mobile has no deep link, so this is only
 * useful when the web app is deployed; without the base URL we share the bare
 * room code instead.
 */
export function buildMobileInviteMessage(
  code: string,
  base: string | undefined = process.env.EXPO_PUBLIC_INVITE_BASE_URL,
): string {
  const normalized = normalizeRoomCode(code);
  const value = base?.trim().replace(/\/+$/, "");
  if (!value) return `來 CyberBlade 3D 跟我對戰！房號：${normalized}`;
  return `來 CyberBlade 3D 跟我對戰！房號：${normalized}\n${value}/?room=${normalized}`;
}

export function shouldHostLeaveForAppState(
  role: "host" | "guest" | null,
  phase: OnlinePhase,
  nextState: string,
): boolean {
  return (
    nextState !== "active" &&
    role === "host" &&
    ["matched", "waiting_ready", "countdown", "battle", "ending"].includes(
      phase,
    )
  );
}
