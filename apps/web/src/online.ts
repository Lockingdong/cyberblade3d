import type {
  OnlinePhase,
  WebSocketLike,
} from "@game-pool/beyblade-multiplayer";

export function resolveWebSocketUrl(
  configured: string | undefined = import.meta.env.VITE_PUBLIC_WS_URL ??
    import.meta.env.VITE_BEYBLADE_WS_URL,
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

export function isActiveOnlineRoom(phase: OnlinePhase): boolean {
  return ["matched", "waiting_ready", "countdown", "battle", "ending"].includes(
    phase,
  );
}

export function onlinePageExitAction(
  phase: OnlinePhase,
): "cancel_queue" | "leave" | null {
  if (phase === "connecting" || phase === "queued") return "cancel_queue";
  return isActiveOnlineRoom(phase) ? "leave" : null;
}
