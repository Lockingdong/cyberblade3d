import { Canvas, useFrame } from "@react-three/fiber/native";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  BeybladePreviewWorld,
  PREVIEW_CAMERA_PRESETS,
  type PreviewCameraPreset,
} from "@cyberblade/visuals";
import type { BeybladeSpec, BeybladeType } from "@cyberblade/core";

export function BladePreviewScene({
  type,
  color,
  exploded = false,
  preset = "default",
  customSpec,
}: {
  type: BeybladeType;
  color?: number | null;
  exploded?: boolean;
  preset?: PreviewCameraPreset;
  customSpec?: BeybladeSpec | undefined;
}) {
  // Only the initial pose goes to the Canvas; switching presets afterwards is
  // an eased move handled per frame in PreviewContent.
  const initialPosition = [...PREVIEW_CAMERA_PRESETS[preset].position] as [
    number,
    number,
    number,
  ];

  return (
    <Canvas
      camera={{ position: initialPosition, fov: 32, near: 0.1, far: 100 }}
    >
      <PreviewContent
        type={type}
        color={color ?? undefined}
        exploded={exploded}
        preset={preset}
        customSpec={customSpec}
      />
    </Canvas>
  );
}

export function PreviewContent({
  type,
  color,
  exploded = false,
  preset = "default",
  customSpec,
}: {
  type: BeybladeType;
  color?: number;
  exploded?: boolean;
  preset?: PreviewCameraPreset;
  customSpec?: BeybladeSpec | undefined;
}) {
  const world = useMemo(
    () => new BeybladePreviewWorld(type, color, customSpec),
    [type, color, customSpec],
  );

  const targetPosition = useRef(new THREE.Vector3());
  const targetLook = useRef(new THREE.Vector3());
  const currentLook = useRef(
    new THREE.Vector3(...PREVIEW_CAMERA_PRESETS.default.target),
  );

  useEffect(() => () => world.dispose(), [world]);

  useEffect(() => {
    world.setExploded(exploded);
  }, [world, exploded]);

  useFrame((state, delta) => {
    const view = PREVIEW_CAMERA_PRESETS[preset];
    targetPosition.current.set(...view.position);
    targetLook.current.set(...view.target);

    const lerpFactor = Math.min(1, delta * 6);
    state.camera.position.lerp(targetPosition.current, lerpFactor);
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
