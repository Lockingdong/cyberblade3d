import type {
  OnlinePhase,
  WebSocketLike,
} from "@game-pool/beyblade-multiplayer";

export function resolveMobileWebSocketUrl(
  configured: string | undefined = process.env.EXPO_PUBLIC_BEYBLADE_WS_URL,
): string {
  const value = configured?.trim();
  if (!value)
    throw new Error(
      "請設定 EXPO_PUBLIC_BEYBLADE_WS_URL；實機開發請使用電腦的 LAN IP。",
    );
  if (!/^wss?:\/\//i.test(value))
    throw new Error("EXPO_PUBLIC_BEYBLADE_WS_URL 必須使用 ws:// 或 wss://。");
  return value;
}

export function createMobileWebSocket(url: string): WebSocketLike {
  return new WebSocket(url);
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
