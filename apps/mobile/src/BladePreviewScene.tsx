import { Canvas, useFrame } from "@react-three/fiber/native";
import { useEffect, useMemo } from "react";
import { BeybladePreviewWorld } from "@game-pool/beyblade-visuals";
import type { BeybladeType } from "@game-pool/beyblade-core";

export function BladePreviewScene({
  type,
  color,
  exploded = false,
}: {
  type: BeybladeType;
  color?: number | null;
  exploded?: boolean;
}) {
  return (
    <Canvas camera={{ position: [0, 2.1, 3.8], fov: 32, near: 0.1, far: 100 }}>
      <PreviewContent
        type={type}
        color={color ?? undefined}
        exploded={exploded}
      />
    </Canvas>
  );
}

export function PreviewContent({
  type,
  color,
  exploded = false,
}: {
  type: BeybladeType;
  color?: number;
  exploded?: boolean;
}) {
  const world = useMemo(
    () => new BeybladePreviewWorld(type, color),
    [type, color],
  );

  useEffect(() => () => world.dispose(), [world]);

  useEffect(() => {
    world.setExploded(exploded);
  }, [world, exploded]);

  useFrame((state, delta) => {
    state.camera.lookAt(0, 0.25, 0);
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
