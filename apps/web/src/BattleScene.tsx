import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { BlendFunction, KernelSize } from "postprocessing";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  STADIUMS,
  getEnvironmentSceneConfig,
  type BattleSnapshot,
  type MatchConfig,
  type MatchPhase,
  type SimulationEvent,
  type TopId,
  type EnvironmentScene,
} from "@game-pool/beyblade-core";
import {
  BeybladeVisualWorld,
  getBattleCameraView,
  getLaunchCameraView,
} from "@game-pool/beyblade-visuals";

interface Props {
  config: MatchConfig;
  phase: MatchPhase;
  snapshot: BattleSnapshot | null;
  events: readonly SimulationEvent[];
  eventsTick: number;
  localTopId: TopId;
  scene: EnvironmentScene;
}

export function BattleScene(props: Props) {
  return (
    <div className="battle-canvas" aria-hidden="true">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, 10, 15], fov: 45, near: 0.1, far: 100 }}
        gl={{
          antialias: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <SceneContent {...props} />
        <ScenePostFX />
        {import.meta.env.DEV && window.location.search.includes("debug") && (
          <PerfProbe />
        )}
      </Canvas>
    </div>
  );
}

function SceneContent({
  config,
  phase,
  snapshot,
  events,
  eventsTick,
  localTopId,
  scene,
}: Props) {
  const world = useMemo(
    () =>
      new BeybladeVisualWorld(
        config.p1Type,
        config.p2Type,
        config.stadiumTheme,
        localTopId,
        scene,
        config.p1Color,
        config.p2Color,
        config.stadiumVariant,
        config.p1BladeId,
        config.p1RatchetId,
        config.p1BitId,
        config.p1ChipId,
        config.p2BladeId,
        config.p2RatchetId,
        config.p2BitId,
        config.p2ChipId,
      ),
    [
      config.p1Type,
      config.p2Type,
      config.stadiumTheme,
      config.stadiumVariant,
      localTopId,
      scene,
      config.p1Color,
      config.p2Color,
      config.p1BladeId,
      config.p1RatchetId,
      config.p1BitId,
      config.p1ChipId,
      config.p2BladeId,
      config.p2RatchetId,
      config.p2BitId,
      config.p2ChipId,
    ],
  );
  const colors =
    STADIUMS.find((stadium) => stadium.type === config.stadiumTheme) ??
    STADIUMS[0]!;
  const shake = useRef(0);
  const lastShakeTick = useRef(0);

  useEffect(() => {
    return () => {
      world.dispose();
    };
  }, [world]);

  // A rematch with the same config reuses the memoized world, so restore any
  // burst/toppled tops when a new launch phase begins.
  useEffect(() => {
    if (phase === "launch") {
      world.reset();
      shake.current = 0;
      lastShakeTick.current = 0;
    }
  }, [phase, world]);

  useFrame((state, delta) => {
    const { camera } = state;
    if (snapshot) world.apply(snapshot, events, eventsTick);
    world.update(Math.min(delta, 0.1));

    if (phase === "launch") {
      // Gentle camera orbit around the player's launch point.
      const time = state.clock.elapsedTime;
      const view = getLaunchCameraView(localTopId, time);
      camera.position.set(...view.position);
      camera.lookAt(...view.target);
      return;
    }
    if (!snapshot) return;

    if (eventsTick > lastShakeTick.current) {
      lastShakeTick.current = eventsTick;
      for (const event of events) {
        if (event.type === "collision") {
          shake.current = Math.max(
            shake.current,
            Math.min(event.intensity * 0.08, 0.6),
          );
        }
      }
    }

    const view = getBattleCameraView(localTopId, snapshot);
    camera.position.lerp(new THREE.Vector3(...view.position), 0.08);
    if (shake.current > 0.01) {
      camera.position.x += (Math.random() - 0.5) * shake.current;
      camera.position.y += (Math.random() - 0.5) * shake.current;
      camera.position.z += (Math.random() - 0.5) * shake.current;
      shake.current *= 0.9;
    }
    camera.lookAt(...view.target);
  });

  const backgroundColor = getEnvironmentSceneConfig(scene).backgroundColor;
  const fogDensity = getEnvironmentSceneConfig(scene).fogDensity;

  return (
    <>
      <color attach="background" args={[backgroundColor]} />
      <fogExp2 attach="fog" args={[backgroundColor, fogDensity]} />
      <ambientLight intensity={0.45} />
      <directionalLight
        castShadow
        intensity={1.5}
        color={0xffffff}
        position={[8, 20, 8]}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={50}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />
      <directionalLight
        intensity={0.4}
        color={0x9ec5ff}
        position={[-8, 12, -4]}
      />
      <directionalLight
        intensity={0.55}
        color={0x88c0ff}
        position={[0, 6, 14]}
      />
      <pointLight
        color={colors.primary}
        intensity={1.0}
        distance={20}
        position={[-6, 3, -6]}
      />
      <primitive object={world.root} />
    </>
  );
}

// Dev-only renderer stats, enabled with ?debug in the URL: logs per-frame
// draw calls and triangles (accumulated manually — the EffectComposer resets
// gl.info on every internal pass) plus fps, once per second, so blade-detail
// changes can be budgeted.
function PerfProbe() {
  const lastLog = useRef(0);
  const frames = useRef(0);
  const { gl } = useThree();
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability -- diagnostics toggle on the renderer, not React state
    gl.info.autoReset = false;
    return () => {
      gl.info.autoReset = true;
    };
  }, [gl]);
  useFrame(({ clock }) => {
    frames.current += 1;
    const elapsed = clock.elapsedTime - lastLog.current;
    if (elapsed < 1) return;
    const calls = Math.round(gl.info.render.calls / frames.current);
    const triangles = Math.round(gl.info.render.triangles / frames.current);
    console.log(
      `[perf] calls/frame=${calls} tris/frame=${triangles} fps=${Math.round(frames.current / elapsed)}`,
    );
    gl.info.reset();
    lastLog.current = clock.elapsedTime;
    frames.current = 0;
  });
  return null;
}

function ScenePostFX() {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom
        intensity={0.7}
        luminanceThreshold={0.7}
        luminanceSmoothing={0.2}
        mipmapBlur
        kernelSize={KernelSize.LARGE}
      />
      <Vignette
        offset={0.3}
        darkness={0.5}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  );
}
