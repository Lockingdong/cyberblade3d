import { useEffect, useState } from "react";
import type { ShareCardData } from "@game-pool/beyblade-core";
import {
  canShareFile,
  composeShareCard,
  downloadCard,
  shareCard,
} from "./share-card";

interface CardAsset {
  readonly blob: Blob;
  readonly file: File;
  readonly url: string;
}

/** data: URL instead of a blob: object URL — long-pressing the preview to
 *  share would otherwise hand receivers a blob link only this browser can
 *  resolve. */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("讀取圖片失敗"));
    reader.readAsDataURL(blob);
  });
}

export function ShareCardModal({
  data,
  onClose,
}: {
  data: ShareCardData;
  onClose: () => void;
}) {
  const [asset, setAsset] = useState<CardAsset | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    composeShareCard(data)
      .then(async (blob) => {
        const url = await blobToDataUrl(blob);
        if (cancelled) return;
        const file = new File([blob], "cyberblade-victory.png", {
          type: "image/png",
        });
        setAsset({ blob, file, url });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [data]);

  return (
    <div className="share-modal" role="dialog" aria-label="分享戰績">
      <div className="share-modal-card">
        <p className="eyebrow">SHARE VICTORY</p>
        {failed ? (
          <p className="share-status">分享卡產生失敗，請再試一次。</p>
        ) : asset ? (
          <>
            <img
              className="share-preview-img"
              src={asset.url}
              alt={`${data.playerName} 的勝利分享卡`}
            />
            <p className="share-hint">
              {canShareFile(asset.file)
                ? "點「分享」把圖片傳給朋友，長按圖片可能只會分享連結"
                : "「長按圖片」分享或點「下載圖片」儲存後即可分享給朋友"}
            </p>
          </>
        ) : (
          <p className="share-status">分享卡產生中…</p>
        )}
        <div className="share-actions">
          {asset && canShareFile(asset.file) && (
            <button
              className="primary"
              onClick={() => void shareCard(asset.file).catch(() => {})}
            >
              分享
            </button>
          )}
          {asset && (
            <button
              className={canShareFile(asset.file) ? "" : "primary"}
              onClick={() => downloadCard(asset.blob)}
            >
              下載圖片
            </button>
          )}
          <button onClick={onClose}>關閉</button>
        </div>
      </div>
    </div>
  );
}
