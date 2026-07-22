import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type JSX } from "react";
import * as THREE from "three";
import { BeybladePreviewWorld } from "@game-pool/beyblade-visuals";
import type { BeybladeType, BeybladeSpec } from "@game-pool/beyblade-core";

export type CameraPreset = "default" | "top" | "side" | "bottom";

export const CAMERA_PRESETS: Record<
  CameraPreset,
  { label: string; icon: JSX.Element; pos: [number, number, number]; target: [number, number, number] }
> = {
  default: {
    label: "斜角視角",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
    pos: [0, 2.8, 3.8],
    target: [0, 0.38, 0],
  },
  top: {
    label: "正頂視角",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      </svg>
    ),
    pos: [0, 4.8, 0.01],
    target: [0, 0.38, 0],
  },
  side: {
    label: "正側視角",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12h16" />
        <path d="M4 7l8-3 8 3v10l-8 3-8-3V7z" />
      </svg>
    ),
    pos: [0, 0.4, 4.2],
    target: [0, 0.38, 0],
  },
  bottom: {
    label: "正底視角",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="8" strokeDasharray="3 3" />
        <path d="M12 5v14M5 12h14" />
        <circle cx="12" cy="12" r="2.5" fill="currentColor" />
      </svg>
    ),
    pos: [0, -3.8, 0.01],
    target: [0, 0.38, 0],
  },
};

export function ExplodedLayersIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 12 12 17 22 12" />
      <polyline points="2 17 12 22 22 17" />
    </svg>
  );
}

const PRESET_CONFIGS = CAMERA_PRESETS;

export function BladePreviewScene({
  type,
  color,
  exploded = false,
  preset = "default",
  customSpec,
  overridePos,
  showExplodedLabels = true,
}: {
  type: BeybladeType;
  color?: number | null;
  exploded?: boolean;
  preset?: CameraPreset;
  customSpec?: BeybladeSpec | undefined;
  overridePos?: [number, number, number] | undefined;
  showExplodedLabels?: boolean;
}) {
  const initialPos = overridePos ?? (PRESET_CONFIGS[preset]?.pos ?? PRESET_CONFIGS.default.pos);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas
        className="blade-preview-canvas"
        aria-label={`${type} 3D 預覽`}
        camera={{ position: initialPos, fov: 32, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true }}
      >
        <PreviewContent
          type={type}
          color={color ?? undefined}
          exploded={exploded}
          preset={preset}
          customSpec={customSpec}
          overridePos={overridePos}
        />
      </Canvas>
      {exploded && showExplodedLabels && (
        <div className="exploded-parts-labels">
          <div className="part-label chip-label">
            <span className="part-name">CHIP 晶片</span>
            <span className="part-desc">核心紋章印記</span>
          </div>
          <div className="part-label blade-label">
            <span className="part-name">BLADE 刃</span>
            <span className="part-desc">主要攻擊與防禦金屬環</span>
          </div>
          <div className="part-label ratchet-label">
            <span className="part-name">RATCHET 棘輪</span>
            <span className="part-desc">中層高度與鎖定結構</span>
          </div>
          <div className="part-label bit-label">
            <span className="part-name">BIT 軸心</span>
            <span className="part-desc">底層軸尖與齒輪環</span>
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewContent({
  type,
  color,
  exploded,
  preset,
  customSpec,
  overridePos,
}: {
  type: BeybladeType;
  color: number | undefined;
  exploded: boolean;
  preset: CameraPreset;
  customSpec?: BeybladeSpec | undefined;
  overridePos?: [number, number, number] | undefined;
}) {
  const world = useMemo(
    () => new BeybladePreviewWorld(type, color, customSpec),
    [type, color, customSpec],
  );

  const targetPos = useRef(new THREE.Vector3());
  const targetLook = useRef(new THREE.Vector3());
  const currentLook = useRef(new THREE.Vector3(0, 0.38, 0));

  useEffect(() => () => world.dispose(), [world]);

  useEffect(() => {
    world.setExploded(exploded);
  }, [world, exploded]);

  useFrame((state, delta) => {
    const config = PRESET_CONFIGS[preset] ?? PRESET_CONFIGS.default;
    targetPos.current.set(...(overridePos ?? config.pos));
    targetLook.current.set(...config.target);

    const lerpFactor = Math.min(1, delta * 6);
    state.camera.position.lerp(targetPos.current, lerpFactor);
    currentLook.current.lerp(targetLook.current, lerpFactor);
    state.camera.lookAt(currentLook.current);

    world.update(Math.min(delta, 0.1));
  });

  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight intensity={2.2} position={[4, 7, 5]} />
      <pointLight
        color={0x009bd6}
        intensity={1.5}
        distance={8}
        position={[-3, 2, 2]}
      />
      <primitive object={world.root} />
    </>
  );
}
