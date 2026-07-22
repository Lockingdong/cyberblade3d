import { Canvas, useFrame } from "@react-three/fiber/native";
import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import * as Sharing from "expo-sharing";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { captureRef } from "react-native-view-shot";
import { SHARE_CARD, type ShareCardData } from "@game-pool/beyblade-core";
import { PreviewContent } from "./BladePreviewScene";

const CARD = SHARE_CARD;
const S = CARD.mobileScale;
const CARD_WIDTH = CARD.width / S;
const CARD_HEIGHT = CARD.height / S;
const BLADE_SIZE = 560 / S;

/** Fires once after the preview settles, snapshotting the GL framebuffer.
 *  view-shot cannot capture GLView pixels, so the blade must become a plain
 *  <Image> before the card itself is captured. */
function SnapshotOnSettle({
  onSnapshot,
}: {
  onSnapshot: (uri: string | null) => void;
}) {
  const frames = useRef(0);
  const done = useRef(false);
  useFrame((state) => {
    if (done.current || ++frames.current < 12) return;
    done.current = true;
    const exgl = state.gl.getContext() as unknown as ExpoWebGLRenderingContext;
    GLView.takeSnapshotAsync(exgl, { format: "png", flip: true })
      .then((shot) => onSnapshot(String(shot.uri)))
      .catch(() => onSnapshot(null));
  });
  return null;
}

export function ShareCardModal({
  data,
  onClose,
}: {
  data: ShareCardData;
  onClose: () => void;
}) {
  const cardRef = useRef<View>(null);
  const [bladeUri, setBladeUri] = useState<string | null>(null);
  const [bladeFailed, setBladeFailed] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState(false);

  const bladeReady = bladeUri !== null || bladeFailed;
  const bladeColor = `#${data.bladeColor.toString(16).padStart(6, "0")}`;
  const finishColor = CARD.finishColors[data.finishType];

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    setShareError(false);
    try {
      const uri = await captureRef(cardRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
        width: CARD.width,
        height: CARD.height,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(
          uri.startsWith("file://") ? uri : `file://${uri}`,
          { mimeType: "image/png", dialogTitle: "分享戰績" },
        );
      }
    } catch {
      setShareError(true);
    } finally {
      setSharing(false);
    }
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View
          ref={cardRef}
          collapsable={false}
          style={styles.cardFrame}
          accessibilityLabel={`${data.playerName} 的勝利分享卡`}
        >
          <View style={styles.cardShadow} />
          <View style={styles.cardBody}>
            <Text style={styles.eyebrow}>{data.title}</Text>
            <Text style={styles.headline}>{data.headline}</Text>
            <View style={styles.bladeSlot}>
              <View
                style={[
                  styles.bladeGlow,
                  { backgroundColor: `${bladeColor}2e` },
                ]}
              />
              {bladeUri ? (
                <Image
                  source={{ uri: bladeUri }}
                  style={styles.bladeImage}
                  resizeMode="contain"
                />
              ) : bladeFailed ? (
                <View
                  style={[
                    styles.bladeFallback,
                    { backgroundColor: bladeColor },
                  ]}
                />
              ) : (
                <View style={styles.bladeImage}>
                  <Canvas
                    style={styles.bladeCanvas}
                    camera={{
                      position: [0, 2.1, 3.5],
                      fov: 29,
                      near: 0.1,
                      far: 100,
                    }}
                  >
                    <PreviewContent type={data.bladeType} />
                    <SnapshotOnSettle
                      onSnapshot={(uri) => {
                        if (uri) setBladeUri(uri);
                        else setBladeFailed(true);
                      }}
                    />
                  </Canvas>
                </View>
              )}
            </View>
            <Text style={styles.bladeName}>{data.bladeName}</Text>
            <Text style={styles.bladeEnglish}>
              {data.bladeEnglishName.toUpperCase()}
            </Text>
            <View
              style={[styles.finishBadge, { backgroundColor: finishColor }]}
            >
              <Text style={styles.finishText}>{data.finishType}</Text>
            </View>

            {/* Glassmorphic Battle Stats Panel */}
            <View style={styles.statsBox}>
              <View style={styles.statsLeft}>
                <Text style={styles.winnerName} numberOfLines={1}>
                  {data.playerName}
                </Text>
                {data.recordText ? (
                  <View style={styles.recordPill}>
                    <Text style={styles.recordText}>{data.recordText}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.vsText}>VS</Text>
              <View style={styles.statsRight}>
                <Text style={styles.opponentName} numberOfLines={1}>
                  {data.opponentName}
                </Text>
              </View>
            </View>

            <Text style={styles.footerDate}>
              {formatShareDate()} · CYBERBLADE 3D BATTLE
            </Text>
            <View style={styles.footerBtnContainer}>
              <View style={styles.footerBtnShadow} />
              <View style={styles.footerBtnBody}>
                <Text style={styles.footerBtnText}>
                  PLAY FREE AT{" "}
                  <Text style={styles.footerBtnUrlText}>CYBERBLADE3D.COM</Text>
                </Text>
              </View>
            </View>
          </View>
        </View>
        {shareError && (
          <Text style={styles.errorText}>分享失敗，請再試一次。</Text>
        )}
        <View style={styles.actions}>
          <Pressable
            style={[
              styles.button,
              styles.buttonPrimary,
              (!bladeReady || sharing) && styles.buttonDisabled,
            ]}
            disabled={!bladeReady || sharing}
            onPress={() => void handleShare()}
          >
            {sharing ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.buttonPrimaryText}>分享</Text>
            )}
          </Pressable>
          <Pressable style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>關閉</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function formatShareDate(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}.${month}.${day}`;
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(6, 8, 14, 0.88)",
  },
  cardFrame: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: CARD.colors.bg,
    overflow: "hidden",
  },
  cardShadow: {
    position: "absolute",
    top: 13,
    left: 3,
    right: 13,
    bottom: 3,
    backgroundColor: CARD.colors.ink,
  },
  cardBody: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: CARD.colors.cardBorder,
    backgroundColor: CARD.colors.card,
    paddingTop: 16,
  },
  eyebrow: {
    color: CARD.colors.accent,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 3,
  },
  headline: {
    marginTop: 1,
    color: CARD.colors.win,
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: 1,
    transform: [{ skewX: "-6deg" }],
    textShadowColor: CARD.colors.ink,
    textShadowOffset: { width: -2, height: 2 },
    textShadowRadius: 0,
  },
  bladeSlot: {
    width: BLADE_SIZE,
    height: BLADE_SIZE,
    marginTop: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  bladeGlow: {
    position: "absolute",
    width: BLADE_SIZE,
    height: BLADE_SIZE,
    borderRadius: BLADE_SIZE / 2,
  },
  bladeImage: {
    width: BLADE_SIZE,
    height: BLADE_SIZE,
  },
  bladeCanvas: {
    flex: 1,
  },
  bladeFallback: {
    width: BLADE_SIZE * 0.6,
    height: BLADE_SIZE * 0.6,
    borderRadius: (BLADE_SIZE * 0.6) / 2,
    borderWidth: 4,
    borderColor: CARD.colors.ink,
  },
  bladeName: {
    marginTop: 0,
    color: CARD.colors.textLight,
    fontSize: 22,
    fontWeight: "900",
  },
  bladeEnglish: {
    marginTop: 0,
    color: CARD.colors.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
  },
  finishBadge: {
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1.5,
    borderColor: CARD.colors.ink,
    borderRadius: 2,
    transform: [{ skewX: "-4deg" }],
  },
  finishText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    transform: [{ skewX: "4deg" }],
  },
  statsBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: CARD_WIDTH - 40,
    height: 48,
    marginTop: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CARD.colors.panelBorder,
    backgroundColor: CARD.colors.panelBg,
  },
  statsLeft: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statsRight: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  winnerName: {
    color: CARD.colors.win,
    fontSize: 14,
    fontWeight: "900",
  },
  recordPill: {
    marginTop: 2,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CARD.colors.accent,
    backgroundColor: CARD.colors.card,
  },
  recordText: {
    color: CARD.colors.accent,
    fontSize: 9,
    fontWeight: "800",
  },
  vsText: {
    marginHorizontal: 6,
    color: CARD.colors.accent,
    fontSize: 12,
    fontWeight: "900",
    fontStyle: "italic",
  },
  opponentName: {
    color: CARD.colors.muted,
    fontSize: 13,
    fontWeight: "800",
  },
  footerDate: {
    marginTop: 6,
    color: CARD.colors.muted,
    fontSize: 6.0,
    fontWeight: "600",
    letterSpacing: 1.3,
    textAlign: "center",
  },
  footerBtnContainer: {
    marginTop: 4,
    alignSelf: "center",
    position: "relative",
  },
  footerBtnShadow: {
    position: "absolute",
    top: 1.3,
    left: -1.3,
    right: 1.3,
    bottom: -1.3,
    backgroundColor: CARD.colors.ink,
    transform: [{ skewX: "-4deg" }],
  },
  footerBtnBody: {
    paddingHorizontal: 14,
    paddingVertical: 3,
    backgroundColor: CARD.colors.panelBg,
    borderWidth: 1,
    borderColor: CARD.colors.accent,
    transform: [{ skewX: "-4deg" }],
  },
  footerBtnText: {
    color: "#ffffff",
    fontSize: 7.3,
    fontWeight: "900",
    letterSpacing: 0.6,
    transform: [{ skewX: "4deg" }],
  },
  footerBtnUrlText: {
    color: CARD.colors.accent,
  },
  errorText: {
    marginTop: 12,
    color: "#ff2a5f",
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  button: {
    minWidth: 104,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderWidth: 2,
    borderColor: CARD.colors.cardBorder,
    borderRadius: 4,
    backgroundColor: CARD.colors.card,
    transform: [{ skewX: "-8deg" }],
  },
  buttonPrimary: {
    borderColor: CARD.colors.accent,
    backgroundColor: CARD.colors.accent,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: CARD.colors.textLight,
    fontWeight: "800",
    transform: [{ skewX: "8deg" }],
  },
  buttonPrimaryText: {
    color: "#05070d",
    fontWeight: "900",
    transform: [{ skewX: "8deg" }],
  },
});
