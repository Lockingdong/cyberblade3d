import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { BlendFunction, KernelSize } from "postprocessing";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  STADIUMS,
  getEnvironmentSceneConfig,
  type MatchConfig,
  type MatchPhase,
  type TopId,
  type EnvironmentScene,
} from "@cyberblade/core";
import {
  BeybladeVisualWorld,
  getBattleCameraView,
  getLaunchCameraView,
} from "@cyberblade/visuals";

import type { BattleFrame } from "./battle-presentation";

interface Props {
  config: MatchConfig;
  phase: MatchPhase;
  readFrame: () => BattleFrame;
  localTopId: TopId;
  scene: EnvironmentScene;
}

export function BattleScene(props: Props) {
  // Hold the frame loop until shaders finish compiling in the background;
  // rendering earlier makes WebGL block on every unfinished program.
  const [ready, setReady] = useState(false);
  return (
    <div className="battle-canvas" data-ready={ready} aria-hidden="true">
      <Canvas
        frameloop={ready ? "always" : "never"}
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
        <SceneContent {...props} onReadyChange={setReady} />
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
  readFrame,
  localTopId,
  scene,
  onReadyChange,
}: Props & { onReadyChange: (ready: boolean) => void }) {
  const [world, setWorld] = useState<BeybladeVisualWorld | null>(null);
  useEffect(() => {
    const next = new BeybladeVisualWorld(
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
    );
    setWorld(next);
    return () => next.dispose();
  }, [
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
  ]);

  // Compile every shader up front, including the hidden pooled spark and
  // shockwave meshes, so neither entering the battle nor the first collision
  // stalls on shader linking.
  const { gl, scene: threeScene, camera: threeCamera } = useThree();
  useEffect(() => {
    if (!world) return;
    let cancelled = false;
    onReadyChange(false);
    const ready = precompile(gl, threeScene, threeCamera);
    // Never leave the arena blank if the driver never reports completion.
    const timeout = new Promise((resolve) => setTimeout(resolve, 3000));
    void Promise.race([ready, timeout]).then(() => {
      if (!cancelled) onReadyChange(true);
    });
    return () => {
      cancelled = true;
    };
  }, [world, gl, threeScene, threeCamera, onReadyChange]);

  const colors =
    STADIUMS.find((stadium) => stadium.type === config.stadiumTheme) ??
    STADIUMS[0]!;
  const shake = useRef(0);
  const cameraTarget = useMemo(() => new THREE.Vector3(), []);
  const lastShakeTick = useRef(0);

  // A rematch with the same config reuses the memoized world, so restore any
  // burst/toppled tops when a new launch phase begins.
  useEffect(() => {
    if (phase === "launch" && world) {
      world.reset();
      shake.current = 0;
      lastShakeTick.current = 0;
    }
  }, [phase, world]);

  useFrame((state, delta) => {
    if (!world) return;
    const { camera } = state;
    const { snapshot, events, tick: eventsTick } = readFrame();
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
    cameraTarget.set(...view.position);
    camera.position.lerp(cameraTarget, 1 - Math.exp(-5 * delta));
    if (shake.current > 0.01) {
      camera.position.x += (Math.random() - 0.5) * shake.current;
      camera.position.y += (Math.random() - 0.5) * shake.current;
      camera.position.z += (Math.random() - 0.5) * shake.current;
      shake.current *= Math.exp(-6.3 * delta);
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
      {world && <primitive object={world.root} />}
    </>
  );
}

function precompile(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
): Promise<unknown> {
  // The EffectComposer renders the scene into an offscreen target, which
  // turns off tone mapping and sRGB output in each shader's cache key.
  // Compiling against a target makes the prepared programs the ones used.
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
  });
  // Stand-in for the shadow map's internal depth material.
  const shadowCaster = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }),
  );
  const previous = gl.getRenderTarget();
  gl.setRenderTarget(target);
  const ready = Promise.all([
    gl.compileAsync(scene, camera),
    gl.compileAsync(shadowCaster, camera, scene),
  ]);
  gl.setRenderTarget(previous);
  target.dispose();
  return ready.finally(() => {
    shadowCaster.geometry.dispose();
    shadowCaster.material.dispose();
  });
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
