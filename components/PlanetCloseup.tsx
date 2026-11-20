"use client";

import { OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { bodyTexture } from "@/components/skySurfaces";
import { CLOSEUPS, type MoonModel, type RingModel } from "@/lib/closeup";
import { craftModelKey, modelApiPath, moonModelKey } from "@/lib/nasaModels";
import { SPACE_BODIES } from "@/lib/planets";

type Props = {
  target: string;
  zoomToken: number;
};

type VoyageKind = "planet" | "sun" | "moon" | "rock" | "craft";

const ATMOSPHERE: Record<string, { color: string; scale: number; opacity: number }> = {
  venus: { color: "#f6e2a8", scale: 1.06, opacity: 0.22 },
  earth: { color: "#8ecbff", scale: 1.08, opacity: 0.16 },
  mars: { color: "#f0b2a4", scale: 1.045, opacity: 0.12 },
  jupiter: { color: "#f3d7b4", scale: 1.06, opacity: 0.14 },
  saturn: { color: "#f6e7c6", scale: 1.055, opacity: 0.13 },
  uranus: { color: "#c9fff4", scale: 1.07, opacity: 0.18 },
  neptune: { color: "#7eb6ff", scale: 1.07, opacity: 0.18 },
  titan: { color: "#e7b56a", scale: 1.12, opacity: 0.2 },
};

type ViewModel = {
  modelKey: string | null;
  bodyId: string;
  title: string;
  spinSeconds: number;
  tilt: number;
  moons: MoonModel[];
  rings: RingModel[];
  sun: boolean;
  kind: VoyageKind;
  color: string;
  note?: string;
};

export default function PlanetCloseup({ target, zoomToken }: Props) {
  const view = useMemo(() => resolveView(target), [target]);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [ready, setReady] = useState(false);
  const [arrived, setArrived] = useState(false);
  const markReady = useMemo(() => () => setReady(true), []);

  useEffect(() => {
    setReady(false);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setArrived(media.matches);
  }, [target]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(media.matches);
    const onChange = () => setReduceMotion(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const reach = Math.max(
    5.6,
    view.moons.reduce((max, moon) => Math.max(max, moon.distance * 1.9), 0),
  );

  const trip = target === "earth" ? "Saliendo del suelo hacia afuera" : `Viaje desde la Tierra hasta ${view.title}`;

  return (
    <>
      {arrived ? null : (
        <>
          <VoyageCanvas
            color={view.color}
            kind={view.kind}
            bodyId={view.bodyId}
            earthOnly={target === "earth"}
            onDone={() => setArrived(true)}
          />
          <div className="voyage-banner">
            <p>{trip}</p>
            <button type="button" className="chip accent" onClick={() => setArrived(true)}>
              Llegar ya
            </button>
          </div>
        </>
      )}
      {arrived ? (
      <Canvas
        className="space-canvas"
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: "high-performance", alpha: false }}
        camera={{ position: [reach * 0.34, reach * 0.2, reach * 0.88], fov: 42, near: 0.05, far: 240 }}
        onCreated={({ gl }) => {
          gl.setClearColor("#070914", 1);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
      >
        <Suspense fallback={null}>
          <hemisphereLight args={["#e4eefc", "#24180f", 0.42]} />
          <directionalLight position={[6, 2.4, 4]} intensity={2.05} />
          <ambientLight intensity={0.16} />
          <StudioLight />
          <StarDust count={reduceMotion ? 700 : 1800} />
          <World view={view} reduceMotion={reduceMotion} onReady={markReady} />
          <OrbitControls
            makeDefault
            enablePan={false}
            enableDamping
            dampingFactor={0.08}
            minDistance={1.2}
            maxDistance={18}
            zoomSpeed={0.7}
          />
          <Dolly zoomToken={zoomToken} />
        </Suspense>
      </Canvas>
      ) : null}
      {arrived ? (
        <p className="sky-meta">
          {view.title} · modelo NASA · arrastra para mirar alrededor
        </p>
      ) : null}
      {arrived && !ready ? <p className="model-loading">Llegaste. Cargando modelo de NASA…</p> : null}
    </>
  );
}

function earthPaint() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);
  ctx.fillStyle = "#1c62b0";
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = "#3c7a3a";
  const blobs = [
    [48, 58, 28, 16],
    [92, 46, 18, 12],
    [150, 62, 34, 14],
    [198, 50, 22, 12],
    [70, 86, 20, 10],
    [170, 88, 26, 11],
  ];
  for (const [x, y, rx, ry] of blobs) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#1a2402";
  ctx.fillRect(0, 0, 256, 34);
  ctx.fillRect(0, 102, 256, 26);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function voyageStop(kind: VoyageKind) {
  if (kind === "rock" || kind === "craft") return -16;
  if (kind === "sun") return -52;
  return -48;
}

function VoyageCanvas({
  color,
  kind,
  bodyId,
  earthOnly,
  onDone,
}: {
  color: string;
  kind: VoyageKind;
  bodyId: string;
  earthOnly: boolean;
  onDone: () => void;
}) {
  return (
    <Canvas
      className="space-canvas"
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: "high-performance", alpha: false }}
      camera={{ position: earthOnly ? [0, 0.55, 0.35] : [2.1, 0.55, 3.1], fov: earthOnly ? 64 : 58, near: 0.05, far: 200 }}
      onCreated={({ gl }) => {
        gl.setClearColor(earthOnly ? "#1a3268" : "#070914", 1);
        gl.toneMapping = THREE.NoToneMapping;
      }}
    >
      <VoyageStart earthOnly={earthOnly} />
      <VoyageRig earthOnly={earthOnly} kind={kind} onDone={onDone} />
      <VoyageStars liftoff={earthOnly} />
      <VoyageEarth liftoff={earthOnly} />
      {earthOnly ? null : <VoyageTarget color={color} kind={kind} bodyId={bodyId} />}
    </Canvas>
  );
}

function VoyageTarget({ color, kind, bodyId }: { color: string; kind: VoyageKind; bodyId: string }) {
  const z = voyageStop(kind);
  const textureId = bodyId || (kind === "sun" ? "sun" : kind === "moon" ? "moon" : "");
  const texture = useMemo(() => (kind === "rock" || kind === "craft" || !textureId ? null : bodyTexture(textureId)), [kind, textureId]);
  if (kind === "rock") {
    const lumps = [
      [0, 0, 0, 0.62, 0.5, 0.7],
      [0.34, 0.08, 0.06, 0.28, 0.24, 0.3],
      [-0.26, -0.1, 0.12, 0.3, 0.22, 0.26],
      [0.04, 0.22, -0.16, 0.2, 0.18, 0.22],
    ];
    return (
      <group position={[0, 0, z]}>
        {lumps.map(([x, y, lz, sx, sy, sz], index) => (
          <mesh key={index} position={[x, y, lz]} scale={[sx, sy, sz]}>
            <icosahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color={index === 0 ? color : "#8d7b68"} />
          </mesh>
        ))}
      </group>
    );
  }
  if (kind === "craft") {
    return (
      <group position={[0, 0, z]} scale={1.35}>
        <mesh>
          <boxGeometry args={[0.42, 0.32, 0.32]} />
          <meshBasicMaterial color="#e6e1d6" />
        </mesh>
        <mesh>
          <boxGeometry args={[1.7, 0.04, 0.38]} />
          <meshBasicMaterial color="#163e78" />
        </mesh>
      </group>
    );
  }
  const radius = kind === "sun" ? 5.2 : kind === "moon" ? 1.15 : 2.1;
  const air = ATMOSPHERE[textureId];
  return (
    <group position={[0, 0, z]}>
      <mesh>
        <sphereGeometry args={[radius, 64, 48]} />
        {texture ? <meshBasicMaterial map={texture} /> : <meshBasicMaterial color={color} />}
      </mesh>
      {air ? <Glow color={air.color} scale={radius * air.scale} opacity={air.opacity} /> : null}
      {kind === "sun" ? (
        <group scale={radius}>
          <SunGlow />
        </group>
      ) : null}
      {textureId === "saturn" ? <VoyageRings radius={radius} color="#ead7b0" inner={1.4} outer={2.2} opacity={0.82} /> : null}
      {textureId === "uranus" ? <VoyageRings radius={radius} color="#d5eef2" inner={1.45} outer={1.85} opacity={0.5} /> : null}
    </group>
  );
}

function VoyageRings({ radius, color, inner, outer, opacity }: { radius: number; color: string; inner: number; outer: number; opacity: number }) {
  return (
    <group rotation={[1.15, 0.25, 0.35]}>
      <mesh>
        <ringGeometry args={[radius * inner, radius * outer, 96]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

function VoyageEarth({ liftoff }: { liftoff: boolean }) {
  const texture = useMemo(() => earthPaint(), []);
  useEffect(() => () => texture.dispose(), [texture]);
  const radius = liftoff ? 14 : 1.15;
  return (
    <group position={liftoff ? [0, -radius, 0] : [0, 0, 0]}>
      <mesh>
        <sphereGeometry args={[radius, liftoff ? 64 : 32, liftoff ? 48 : 24]} />
        <meshBasicMaterial map={texture} />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius * 1.04, 28, 20]} />
        <meshBasicMaterial color="#9fd6ff" transparent opacity={0.2} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

function VoyageStars({ liftoff }: { liftoff: boolean }) {
  const points = useRef<THREE.Points>(null);
  const material = useRef<THREE.PointsMaterial>(null);
  const elapsed = useRef(0);
  const geometry = useMemo(() => {
    const count = 900;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 28;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 16;
      positions[i * 3 + 2] = 8 - Math.random() * 78;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((_, dt) => {
    elapsed.current += Math.min(dt, 0.05);
    const t = Math.min(1, elapsed.current / 5.6);
    if (material.current) material.current.opacity = liftoff ? Math.max(0, (t - 0.28) / 0.45) : 1;
    const attr = points.current?.geometry.getAttribute("position");
    if (!attr) return;
    const speed = liftoff ? t * 10 : 22;
    for (let i = 0; i < attr.count; i += 1) {
      let z = attr.getZ(i) + dt * speed;
      if (z > 8) z = -70;
      attr.setZ(i, z);
    }
    attr.needsUpdate = true;
  });
  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial ref={material} color="#f7f3ea" size={0.06} sizeAttenuation transparent opacity={liftoff ? 0 : 1} depthWrite={false} />
    </points>
  );
}

function VoyageStart({ earthOnly }: { earthOnly: boolean }) {
  const camera = useThree((state) => state.camera);
  useLayoutEffect(() => {
    if (!earthOnly) return;
    camera.position.set(0, 0.55, 0.35);
    camera.lookAt(0, 0.2, -6);
  }, [camera, earthOnly]);
  return null;
}

function VoyageRig({ earthOnly, kind, onDone }: { earthOnly: boolean; kind: VoyageKind; onDone: () => void }) {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const done = useRef(false);
  const elapsed = useRef(0);
  const sky = useMemo(() => new THREE.Color("#1a3268"), []);
  const space = useMemo(() => new THREE.Color("#070914"), []);
  const mixed = useMemo(() => new THREE.Color(), []);
  useFrame((_, dt) => {
    if (done.current) return;
    elapsed.current += Math.min(dt, 0.05);
    const t = Math.min(1, elapsed.current / 5.6);
    const e = t * t * (3 - 2 * t);
    if (earthOnly) {
      gl.setClearColor(mixed.copy(sky).lerp(space, e), 1);
      if (e < 0.4) {
        const k = e / 0.4;
        camera.position.set(0, THREE.MathUtils.lerp(0.55, 2.6, k), THREE.MathUtils.lerp(0.35, 1.5, k));
        camera.lookAt(0, THREE.MathUtils.lerp(0.2, -0.2, k), THREE.MathUtils.lerp(-6, -2.5, k));
      } else {
        const k = (e - 0.4) / 0.6;
        camera.position.set(0, THREE.MathUtils.lerp(2.6, 8, k), THREE.MathUtils.lerp(1.5, 24, k));
        camera.lookAt(0, THREE.MathUtils.lerp(-0.2, -10, k), THREE.MathUtils.lerp(-2.5, 0, k));
      }
    } else {
      const stop = voyageStop(kind);
      const near = kind === "rock" || kind === "craft" ? 2.4 : 4.5;
      camera.position.set(
        THREE.MathUtils.lerp(2.1, 0.2, e),
        THREE.MathUtils.lerp(0.55, 0.35, e),
        THREE.MathUtils.lerp(3.1, stop + near, e),
      );
      camera.lookAt(0, 0, THREE.MathUtils.lerp(0, stop, Math.min(1, e * 1.2)));
    }
    if (t >= 1) {
      done.current = true;
      onDone();
    }
  });
  return null;
}

function resolveView(target: string): ViewModel {
  if (target.startsWith("neo:")) {
    return {
      modelKey: "bennu",
      bodyId: "bennu",
      title: "Asteroide",
      spinSeconds: 16,
      tilt: 18,
      moons: [],
      rings: [],
      sun: false,
      kind: "rock",
      color: "#b7a48a",
      note: "bennu",
    };
  }
  if (target.startsWith("craft:")) {
    const id = target.slice(6);
    const modelKey = craftModelKey(id);
    return {
      modelKey: modelKey === "satellite" ? null : modelKey,
      bodyId: modelKey,
      title: modelKey === "iss" ? "Estación Espacial" : modelKey === "hubble" ? "Hubble" : "Satélite",
      spinSeconds: 40,
      tilt: 12,
      moons: [],
      rings: [],
      sun: false,
      kind: "craft",
      color: "#d5dbe6",
    };
  }
  const body = SPACE_BODIES.find((item) => item.id === target);
  const model = CLOSEUPS[target];
  const kind: VoyageKind = target === "sun" ? "sun" : target === "moon" ? "moon" : "planet";
  return {
    modelKey: model ? target : null,
    bodyId: target,
    title: body?.name ?? "Cuerpo",
    spinSeconds: model?.spinSeconds ?? 14,
    tilt: model?.tilt ?? 0,
    moons: model?.moons ?? [],
    rings: target === "uranus" ? model?.rings ?? [] : [],
    sun: target === "sun",
    kind,
    color: body?.color ?? "#d9d3c5",
  };
}

function Dolly({ zoomToken }: { zoomToken: number }) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as { update?: () => void } | null;
  const last = useRef(zoomToken);

  useEffect(() => {
    if (last.current === zoomToken) return;
    const inward = zoomToken > last.current;
    last.current = zoomToken;
    const next = camera.position.clone();
    const dist = THREE.MathUtils.clamp(next.length() * (inward ? 0.78 : 1.28), 1.25, 17);
    next.setLength(dist);
    camera.position.copy(next);
    controls?.update?.();
  }, [zoomToken, camera, controls]);

  return null;
}

function StudioLight() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    return () => {
      if (scene.environment === env) scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

function StarDust({ count }: { count: number }) {
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const radius = 28 + Math.random() * 55;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [count]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points geometry={geometry}>
      <pointsMaterial color="#f4efe2" size={0.07} sizeAttenuation />
    </points>
  );
}

function World({
  view,
  reduceMotion,
  onReady,
}: {
  view: ViewModel;
  reduceMotion: boolean;
  onReady: () => void;
}) {
  const spin = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    if (reduceMotion || !spin.current) return;
    spin.current.rotation.y += (Math.PI * 2 * dt) / view.spinSeconds;
  });

  return (
    <group rotation={[0, 0, (view.tilt * Math.PI) / 180]}>
      <group ref={spin}>
        <ModelBoundary resetKey={view.modelKey ?? "craft"} fallback={view.kind === "rock" ? <RockLump color={view.color} /> : <FallbackSphere color={view.color} radius={1} />}>
          <Suspense fallback={<FallbackSphere color={view.color} radius={1} />}>
            {view.modelKey ? (
              <NasaBody modelKey={view.modelKey} radius={1} sun={view.sun} onReady={onReady} />
            ) : (
              <SatelliteCraft onReady={onReady} />
            )}
          </Suspense>
        </ModelBoundary>
        {view.sun ? <SunGlow /> : null}
        {ATMOSPHERE[view.bodyId] ? (
          <Glow color={ATMOSPHERE[view.bodyId].color} scale={ATMOSPHERE[view.bodyId].scale} opacity={ATMOSPHERE[view.bodyId].opacity} />
        ) : null}
      </group>
      {view.rings.map((ring) => (
        <mesh key={`${ring.inner}-${ring.outer}`} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[ring.inner, ring.outer, 128]} />
          <meshStandardMaterial
            color={ring.color}
            side={THREE.DoubleSide}
            transparent
            opacity={ring.opacity}
            roughness={0.6}
            depthWrite={false}
          />
        </mesh>
      ))}
      {view.moons.map((moon) => (
        <OrbitPath key={`path-${moon.name}`} moon={moon} />
      ))}
      {view.moons.map((moon) => (
        <OrbitingMoon key={moon.name} moon={moon} reduceMotion={reduceMotion} />
      ))}
    </group>
  );
}

function NasaBody({
  modelKey,
  radius,
  sun,
  onReady,
}: {
  modelKey: string;
  radius: number;
  sun: boolean;
  onReady?: () => void;
}) {
  const gltf = useGLTF(modelApiPath(modelKey));
  const fitted = useMemo(() => fitNasaModel(gltf.scene, radius, sun), [gltf.scene, radius, sun]);
  useEffect(() => {
    onReady?.();
  }, [onReady]);
  return <primitive object={fitted} />;
}

function fitNasaModel(source: THREE.Object3D, radius: number, sun: boolean) {
  const root = source.clone(true);
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const ring = /ring/i.test(mesh.name) || hasRingParent(mesh);
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = list.map((material) => tuneSurface(material, sun, ring));
    mesh.material = Array.isArray(mesh.material) ? next : next[0];
  });

  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  let counted = 0;
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || /ring/i.test(mesh.name) || hasRingParent(mesh)) return;
    box.expandByObject(mesh);
    counted += 1;
  });
  if (!counted) box.setFromObject(root);

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  root.position.sub(center);
  const modelRadius = Math.max(size.x, size.y, size.z) / 2 || 1;
  const holder = new THREE.Group();
  holder.add(root);
  holder.scale.setScalar(radius / modelRadius);
  return holder;
}

function tuneSurface(material: THREE.Material, sun: boolean, ring: boolean) {
  const cloned = material.clone();
  const standard = cloned as THREE.MeshStandardMaterial;
  if (!standard.isMeshStandardMaterial) return cloned;
  if (ring) {
    standard.side = THREE.DoubleSide;
    standard.depthWrite = false;
    standard.envMapIntensity = 0.05;
    standard.roughness = 1;
    standard.metalness = 0;
    return standard;
  }
  if (sun) return sunSurface(standard.emissiveMap ?? standard.map ?? null);
  standard.envMapIntensity = standard.normalMap ? 0.42 : 0.08;
  if (!standard.normalMap) standard.color.multiplyScalar(0.9);
  return standard;
}

function hasRingParent(obj: THREE.Object3D): boolean {
  let parent = obj.parent;
  while (parent) {
    if (/ring/i.test(parent.name)) return true;
    parent = parent.parent;
  }
  return false;
}

function RockLump({ color }: { color: string }) {
  return (
    <group>
      <mesh scale={[1, 0.82, 1.12]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={color} roughness={0.92} />
      </mesh>
      <mesh position={[0.45, 0.12, 0.1]} scale={[0.42, 0.36, 0.4]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#8d7b68" roughness={0.95} />
      </mesh>
    </group>
  );
}

function FallbackSphere({ color, radius }: { color: string; radius: number }) {
  return (
    <mesh>
      <sphereGeometry args={[radius, 32, 24]} />
      <meshStandardMaterial color={color} roughness={0.8} />
    </mesh>
  );
}

function SatelliteCraft({ onReady }: { onReady?: () => void }) {
  useEffect(() => {
    onReady?.();
  }, [onReady]);
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[0.55, 0.42, 0.42]} />
        <meshStandardMaterial color="#e6e1d6" metalness={0.72} roughness={0.28} />
      </mesh>
      <mesh castShadow position={[0, 0, 0]}>
        <boxGeometry args={[2.15, 0.035, 0.48]} />
        <meshStandardMaterial color="#163e78" metalness={0.35} roughness={0.42} />
      </mesh>
      <mesh position={[0, 0.28, 0.12]} rotation={[0.5, 0, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.18, 0.06, 24]} />
        <meshStandardMaterial color="#f7f7f7" metalness={0.85} roughness={0.18} />
      </mesh>
      <mesh position={[0, -0.28, 0]}>
        <boxGeometry args={[0.08, 0.35, 0.08]} />
        <meshStandardMaterial color="#c5ccd6" metalness={0.8} roughness={0.25} />
      </mesh>
    </group>
  );
}

const SUN_VERT = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const SUN_FRAG = `
  uniform sampler2D uMap;
  uniform float uHasMap;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec3 tex = vec3(1.0, 0.72, 0.28);
    if (uHasMap > 0.5) tex = texture2D(uMap, vUv).rgb;
    float luma = dot(tex, vec3(0.299, 0.587, 0.114));
    vec3 gran = tex * (0.62 + luma * 0.85);
    float mu = clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0);
    float limb = pow(mu, 0.42);
    vec3 edge = vec3(0.78, 0.18, 0.02);
    vec3 face = gran * vec3(1.08, 0.72, 0.32);
    gl_FragColor = vec4(mix(edge, face, limb), 1.0);
  }
`;

const CORONA_VERT = `
  varying float vRadial;
  varying float vFacing;
  void main() {
    vec4 center = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 rel = mv.xyz - center.xyz;
    vec3 axis = normalize(-center.xyz);
    vRadial = length(rel - axis * dot(rel, axis)) / max(length(mat3(modelViewMatrix) * vec3(1.0, 0.0, 0.0)), 0.0001);
    vFacing = dot(normalize(normalMatrix * normal), normalize(-mv.xyz));
    gl_Position = projectionMatrix * mv;
  }
`;

const CORONA_FRAG = `
  uniform float uPhoto;
  varying float vRadial;
  varying float vFacing;
  void main() {
    if (vFacing < 0.0 || vRadial < uPhoto) discard;
    float t = clamp((vRadial - uPhoto) / (1.0 - uPhoto), 0.0, 1.0);
    float alpha = exp(-t * 2.6) * 0.72;
    vec3 col = mix(vec3(1.0, 0.9, 0.62), vec3(1.0, 0.32, 0.04), smoothstep(0.0, 1.0, t));
    gl_FragColor = vec4(col, alpha);
  }
`;

function sunSurface(map: THREE.Texture | null) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uHasMap: { value: map ? 1 : 0 },
    },
    vertexShader: SUN_VERT,
    fragmentShader: SUN_FRAG,
  });
  material.toneMapped = false;
  return material;
}

function coronaMaterial(scale: number) {
  const material = new THREE.ShaderMaterial({
    uniforms: { uPhoto: { value: 1 / scale } },
    vertexShader: CORONA_VERT,
    fragmentShader: CORONA_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
  });
  material.toneMapped = false;
  return material;
}

function SunGlow() {
  const scale = 2.45;
  const material = useMemo(() => coronaMaterial(scale), []);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh scale={scale} material={material} raycast={() => null}>
      <sphereGeometry args={[1, 64, 40]} />
    </mesh>
  );
}

function Glow({ color, scale, opacity }: { color: string; scale: number; opacity: number }) {
  return (
    <mesh scale={scale}>
      <sphereGeometry args={[1, 32, 24]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.BackSide} />
    </mesh>
  );
}

function OrbitPath({ moon }: { moon: MoonModel }) {
  return (
    <group rotation={[(moon.inclination * Math.PI) / 180, 0, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[moon.distance - 0.012, moon.distance + 0.012, 128]} />
        <meshBasicMaterial color="#d5deef" transparent opacity={0.28} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function OrbitingMoon({ moon, reduceMotion }: { moon: MoonModel; reduceMotion: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const modelKey = moonModelKey(moon.name);

  useFrame(({ clock }) => {
    const travel = reduceMotion ? 0 : clock.elapsedTime;
    const dir = moon.retrograde ? -1 : 1;
    const ang = moon.phase + (dir * travel * Math.PI * 2) / moon.period;
    const inc = (moon.inclination * Math.PI) / 180;
    const radius = moon.distance * (1 + moon.eccentricity * Math.sin(ang * 2));
    if (!ref.current) return;
    ref.current.position.set(
      Math.cos(ang) * radius,
      Math.sin(ang) * radius * Math.sin(inc),
      Math.sin(ang) * radius * Math.cos(inc),
    );
    ref.current.rotation.y = ang + Math.PI;
  });

  return (
    <group ref={ref}>
      <ModelBoundary resetKey={modelKey} fallback={<FallbackSphere color={moon.color} radius={moon.scale} />}>
        <Suspense fallback={<FallbackSphere color={moon.color} radius={moon.scale} />}>
          <NasaBody modelKey={modelKey} radius={moon.scale} sun={false} />
        </Suspense>
      </ModelBoundary>
      {moon.name === "Titán" ? <Glow color="#e7b56a" scale={moon.scale * 1.18} opacity={0.22} /> : null}
      <MoonName name={moon.name} y={moon.scale + 0.28} />
    </group>
  );
}

function MoonName({ name, y }: { name: string; y: number }) {
  const texture = useMemo(() => labelTexture(name), [name]);
  const sprite = useRef<THREE.Sprite>(null);
  const camera = useThree((state) => state.camera);
  const point = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame(() => {
    const mesh = sprite.current;
    if (!mesh) return;
    mesh.getWorldPosition(point);
    const dist = Math.max(camera.position.distanceTo(point), 0.4);
    const height = THREE.MathUtils.clamp(dist * 0.045, 0.11, 0.34);
    mesh.scale.set(height * (2.1 + name.length * 0.2), height, 1);
  });

  return (
    <sprite ref={sprite} position={[0, y, 0]} renderOrder={20}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}

function labelTexture(name: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Sin lienzo");
  ctx.font = "800 72px Nunito, Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 10;
  ctx.strokeStyle = "#070914";
  ctx.strokeText(name, 256, 64);
  ctx.fillStyle = "#fff6e8";
  ctx.fillText(name, 256, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

class ModelBoundary extends Component<{ resetKey: string; fallback: ReactNode; children: ReactNode }, { error: boolean }> {
  state = { error: false };

  static getDerivedStateFromError() {
    return { error: true };
  }

  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: false });
  }

  render() {
    return this.state.error ? this.props.fallback : this.props.children;
  }
}
