import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { BeybladePreviewWorld } from "@cyberblade/visuals";
import type { BeybladeType, BeybladeSpec } from "@cyberblade/core";

import { CAMERA_PRESETS, type CameraPreset } from "./preview-controls";

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
  const initialPos = [
    ...(overridePos ??
      PRESET_CONFIGS[preset]?.position ??
      PRESET_CONFIGS.default.position),
  ] as [number, number, number];
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas
        dpr={[1, 1.5]}
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
  const [world, setWorld] = useState<BeybladePreviewWorld | null>(null);
  useEffect(() => {
    const next = new BeybladePreviewWorld(type, color, customSpec);
    setWorld(next);
    return () => next.dispose();
  }, [type, color, customSpec]);

  const targetPos = useRef(new THREE.Vector3());
  const targetLook = useRef(new THREE.Vector3());
  const currentLook = useRef(new THREE.Vector3(0, 0.38, 0));

  useEffect(() => {
    world?.setExploded(exploded);
  }, [world, exploded]);

  useFrame((state, delta) => {
    const config = PRESET_CONFIGS[preset] ?? PRESET_CONFIGS.default;
    targetPos.current.set(...(overridePos ?? config.position));
    targetLook.current.set(...config.target);

    const lerpFactor = Math.min(1, delta * 6);
    state.camera.position.lerp(targetPos.current, lerpFactor);
    currentLook.current.lerp(targetLook.current, lerpFactor);
    state.camera.lookAt(currentLook.current);

    world?.update(Math.min(delta, 0.1));
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
      {world && <primitive object={world.root} />}
    </>
  );
}
