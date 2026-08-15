import { useThree } from "@react-three/fiber/native";
import * as Device from "expo-device";
import { type ReactNode, useEffect } from "react";
import { StyleSheet, View } from "react-native";

export const IS_SIMULATOR = !Device.isDevice;
export const SIMULATOR_FRAME_RATE = 30;

export function SimulatorRenderSurface({ children }: { children: ReactNode }) {
  return (
    <View style={styles.surface} pointerEvents="box-none">
      <View
        style={IS_SIMULATOR ? styles.simulatorBuffer : styles.nativeBuffer}
      >
        {children}
      </View>
    </View>
  );
}

/**
 * Native R3F renders continuously by default. In the iOS Simulator Expo GL is
 * backed by a CPU-heavy software renderer, so drive `frameloop="never"` at a
 * lower rate there. Physical devices keep R3F's normal continuous loop.
 */
export function SimulatorFrameDriver() {
  const advance = useThree((state) => state.advance);

  useEffect(() => {
    if (!IS_SIMULATOR) return;

    const frameDuration = 1000 / SIMULATOR_FRAME_RATE;
    let animationFrame = 0;
    let lastRender = 0;

    const tick = (timestamp: number) => {
      if (lastRender === 0 || timestamp - lastRender >= frameDuration) {
        lastRender = timestamp;
        advance(timestamp, true);
      }
      animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [advance]);

  return null;
}

const styles = StyleSheet.create({
  surface: { flex: 1, overflow: "hidden" },
  nativeBuffer: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  // Expo GL always allocates at native DPR. Rendering into a half-size view
  // and scaling the composited surface back up provides an effective 0.5
  // render scale (one quarter of the pixels) for the software Simulator GL.
  simulatorBuffer: {
    position: "absolute",
    left: "25%",
    top: "25%",
    width: "50%",
    height: "50%",
    transform: [{ scale: 2 }],
  },
});
