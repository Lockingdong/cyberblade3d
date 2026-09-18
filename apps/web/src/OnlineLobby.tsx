import { useState, type FormEvent } from "react";
import {
  ROOM_CODE_LENGTH,
  isValidRoomCode,
  normalizeRoomCode,
} from "@cyberblade/multiplayer";
import { buildInviteUrl, buildRoomInviteShareData } from "./online";

export type OnlineLobbyChoice =
  | { readonly kind: "quick" }
  | { readonly kind: "create" }
  | { readonly kind: "join"; readonly code: string };

export function OnlineLobby({
  error,
  initialCode = "",
  onSelect,
  onClose,
}: {
  error?: string | null;
  initialCode?: string;
  onSelect: (choice: OnlineLobbyChoice) => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState(initialCode);
  const canJoin = isValidRoomCode(code);

  function submitJoin(event: FormEvent): void {
    event.preventDefault();
    if (canJoin) onSelect({ kind: "join", code });
  }

  return (
    <section className="screen online-overlay lobby-overlay">
      <div className="online-card lobby-card">
        <p className="eyebrow">ONLINE</p>
        <h2>選擇對戰方式</h2>
        {error && <p className="lobby-error">{error}</p>}
        <div className="lobby-modes">
          <button
            className="primary"
            onClick={() => onSelect({ kind: "quick" })}
          >
            隨機配對
          </button>
          <button onClick={() => onSelect({ kind: "create" })}>
            建立好友房
          </button>
        </div>
        <form className="lobby-join" onSubmit={submitJoin}>
          <label htmlFor="room-code">輸入好友的房號</label>
          <div className="lobby-join-row">
            <input
              id="room-code"
              className="room-code-input"
              value={code}
              // Normalizing on input keeps the field showing exactly what will
              // be sent, so a pasted "k7m2-p9" becomes K7M2P9 as you type.
              onChange={(event) =>
                setCode(
                  normalizeRoomCode(event.target.value).slice(
                    0,
                    ROOM_CODE_LENGTH,
                  ),
                )
              }
              placeholder={"A".repeat(ROOM_CODE_LENGTH)}
              maxLength={ROOM_CODE_LENGTH}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" disabled={!canJoin}>
              加入
            </button>
          </div>
        </form>
        <div className="online-overlay-actions">
          <button onClick={onClose}>返回主選單</button>
        </div>
      </div>
    </section>
  );
}

export function OnlineRoomCode({
  code,
  onCancel,
}: {
  code: string;
  onCancel: () => void;
}) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [shared, setShared] = useState(false);
  const invite = buildInviteUrl(code);

  async function copy(value: string, kind: "code" | "link"): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard access is blocked on insecure origins; the link stays
      // visible below so it can still be selected by hand.
      setCopied(null);
    }
  }

  async function share(): Promise<void> {
    if (!navigator.share) {
      await copy(invite, "link");
      return;
    }
    try {
      await navigator.share(buildRoomInviteShareData(code, invite));
      setShared(true);
      window.setTimeout(() => setShared(false), 1500);
    } catch (error) {
      // Closing the native share sheet is an intentional no-op. Other share
      // failures leave the visible link available for manual copying.
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setShared(false);
    }
  }

  return (
    <section className="screen online-overlay">
      <div className="online-card">
        <p className="eyebrow">FRIEND ROOM</p>
        <h2>等待好友加入</h2>
        <div className="room-code-display">{code}</div>
        <p>把房號或邀請連結傳給朋友，他加入後就能各自挑選陀螺。</p>
        <p className="room-connection-note" role="note">
          可直接分享，或暫時關閉去貼連結；10 分鐘內回到遊戲會自動恢復房間。
        </p>
        <input className="invite-link" value={invite} readOnly />
        <div className="online-overlay-actions">
          <button className="primary" onClick={() => void share()}>
            {shared ? "已開啟分享" : "分享邀請"}
          </button>
          <button onClick={() => void copy(code, "code")}>
            {copied === "code" ? "已複製房號" : "複製房號"}
          </button>
          <button onClick={() => void copy(invite, "link")}>
            {copied === "link" ? "已複製連結" : "複製邀請連結"}
          </button>
          <button onClick={onCancel}>取消</button>
        </div>
      </div>
    </section>
  );
}
