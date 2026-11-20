"use client";

import { Billboard, Line, Text, useCursor } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { bodyTexture } from "@/components/skySurfaces";
import { SPACE_BODIES, type SpaceBody } from "@/lib/planets";
import {
  BODY_DISTANCE,
  CONSTELLATIONS,
  SKY_RADIUS,
  altAzToDir,
  angularRadius,
  bodyAltAz,
  bodyAngularDeg,
  cardinalName,
  debrisSkyPos,
  dirToAltAz,
  localSiderealTime,
  makeStarField,
  observerLatitude,
  neoSkyPos,
  raDecToAltAz,
  type AltAz,
} from "@/lib/sky";
import type { DebrisPiece, NeoRock } from "@/lib/types";

type Props = {
  selectedId: string | null;
  onSelect: (id: string) => void;
  showAsteroids: boolean;
  showDebris: boolean;
  showConstellations: boolean;
  rocks: NeoRock[];
  debris: DebrisPiece[];
  overviewToken: number;
  zoomToken: number;
  onApproach: (id: string) => void;
  when: Date;
  aimToken: number;
};

type SkyClock = { when: Date; lst: number };
const SkyClockContext = createContext<SkyClock | null>(null);

function useSkyClock(): SkyClock {
  const clock = useContext(SkyClockContext);
  if (!clock) throw new Error("El cielo no tiene hora.");
  return clock;
}

const WIDE_FOV = 68;
const MIN_FOV = 10;
const MAX_FOV = 82;

const SKY_VERT = `
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = `
  varying vec3 vPos;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uWarm;
  uniform vec3 uSun;
  uniform float uGlow;
  uniform float uLst;
  uniform float uLat;
  uniform float uNight;
  void main() {
    vec3 dir = normalize(vPos);
    float h = clamp(dir.y, 0.0, 1.0);
    vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.72, h));
    float face = pow(max(dot(dir, normalize(uSun)), 0.0), 10.0);
    col += uWarm * face * uGlow;
    float alt = asin(clamp(dir.y, -1.0, 1.0));
    float az = atan(dir.x, -dir.z);
    float sinDec = sin(alt) * sin(uLat) + cos(alt) * cos(uLat) * cos(az);
    float dec = asin(clamp(sinDec, -1.0, 1.0));
    float ha = atan(-sin(az) * cos(alt), sin(alt) * cos(uLat) - cos(az) * cos(alt) * sin(uLat));
    float ra = mod(uLst - ha + 6.2831853, 6.2831853);
    vec3 eq = vec3(cos(dec) * cos(ra), sin(dec), cos(dec) * sin(ra));
    vec3 pole = vec3(-0.868, 0.456, -0.198);
    float band = exp(-pow(asin(clamp(dot(eq, pole), -1.0, 1.0)) / 0.16, 2.0));
    col += vec3(0.62, 0.7, 0.9) * band * 0.18 * uNight;
    gl_FragColor = vec4(col, 1.0);
  }
`;

function sunAltAz(when: Date, lst: number): AltAz {
  const sun = SPACE_BODIES.find((body) => body.id === "sun");
  if (!sun) return { alt: -0.4, az: 0 };
  return bodyAltAz(sun, lst, when);
}

function openingLook(when: Date, lst: number): AltAz {
  const sun = sunAltAz(when, lst);
  if (sun.alt > -0.08) return { az: sun.az, alt: THREE.MathUtils.clamp(Math.max(sun.alt * 0.65, 0.28), 0.22, 0.72) };
  const moon = SPACE_BODIES.find((body) => body.id === "moon");
  if (moon) {
    const place = bodyAltAz(moon, lst, when);
    if (place.alt > 0.12) return { az: place.az, alt: Math.min(place.alt, 0.8) };
  }
  return { az: Math.PI, alt: 0.46 };
}

function skyPalette(sunAlt: number) {
  const day = THREE.MathUtils.smoothstep(sunAlt, -0.08, 0.25);
  const twilight = THREE.MathUtils.smoothstep(sunAlt, -0.45, 0.02) * (1 - day);
  const zenith = new THREE.Color("#1a3268").lerp(new THREE.Color("#4a3568"), twilight * 0.7).lerp(new THREE.Color("#3c86d6"), day);
  const horizon = new THREE.Color("#2d4f96").lerp(new THREE.Color("#e88848"), twilight).lerp(new THREE.Color("#b7e2fb"), day);
  const warm = new THREE.Color("#1a3268").lerp(new THREE.Color("#ffb15a"), Math.max(twilight * 0.9, day * 0.3));
  const ground = new THREE.Color("#1a2402").lerp(new THREE.Color("#2a2204"), twilight * 0.35).lerp(new THREE.Color("#243208"), day * 0.45);
  return { zenith, horizon, warm, ground, glow: twilight * 0.62 + day * 0.22, starOpacity: 1 - day * 0.92 };
}

function fade01(t: number) {
  return t * t * (3 - 2 * t);
}

function hash01(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function valueNoise2(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = fade01(x - ix);
  const fy = fade01(y - iy);
  const a = hash01(ix + iy * 57.1);
  const b = hash01(ix + 1 + iy * 57.1);
  const c = hash01(ix + (iy + 1) * 57.1);
  const d = hash01(ix + 1 + (iy + 1) * 57.1);
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}

/** Seamless around the horizon. `turns` is how many ridges fit in the full circle. */
function loopNoise(az: number, turns: number, seed: number) {
  return valueNoise2(Math.cos(az) * turns + seed, Math.sin(az) * turns + seed * 1.37);
}

type CerroPeak = {
  az: number;
  radius: number;
  height: number;
  spread: number;
  radial: number;
};

function angleGap(a: number, b: number) {
  let gap = Math.abs(a - b) % (Math.PI * 2);
  if (gap > Math.PI) gap = Math.PI * 2 - gap;
  return gap;
}

function cerroPeaks(): CerroPeak[] {
  const peaks: CerroPeak[] = [];
  const ring = (count: number, radius: number, height: number, spread: number, radial: number, seed: number, shift: number) => {
    for (let i = 0; i < count; i += 1) {
      const j = hash01(seed + i * 2.17);
      const k = hash01(seed + i * 5.91 + 4);
      peaks.push({
        az: (i / count) * Math.PI * 2 + shift + (j - 0.5) * spread,
        radius: radius + (k - 0.5) * radial,
        height: height * (0.62 + j * 0.7),
        spread: spread * (0.72 + k * 0.55),
        radial: radial * (0.75 + j * 0.5),
      });
    }
  };
  ring(14, 150, 12, 0.22, 16, 2, 0.04);
  ring(8, 106, 30, 0.32, 20, 9, 0.2);
  ring(8, 98, 14, 0.14, 12, 15, 0.42);
  return peaks;
}

function cerroSample(az: number, radius: number, peaks: CerroPeak[]) {
  let height = 0;
  for (const peak of peaks) {
    const along = Math.exp(-(angleGap(az, peak.az) ** 2) / (peak.spread * peak.spread));
    const across = Math.exp(-((radius - peak.radius) ** 2) / (peak.radial * peak.radial));
    height = Math.max(height, peak.height * Math.pow(along, 0.85) * Math.pow(across, 0.75));
  }
  return height * (0.88 + 0.12 * loopNoise(az, 7, radius * 0.05));
}

const RIDGE_BINS = 720;
const RIDGE_ALT = new Float32Array(RIDGE_BINS);

function fillRidge() {
  const peaks = cerroPeaks();
  const eye = 0.4;
  for (let i = 0; i < RIDGE_BINS; i += 1) {
    const az = (i / RIDGE_BINS) * Math.PI * 2;
    let top = -0.25;
    for (let step = 0; step <= 42; step += 1) {
      const radius = 86 + ((172 - 86) * step) / 42;
      const h = cerroSample(az, radius, peaks);
      if (h < 1.2) continue;
      const alt = Math.atan2(h - 1.25 - eye, radius);
      if (alt > top) top = alt;
    }
    RIDGE_ALT[i] = top;
  }
}

fillRidge();

function ridgeAlt(az: number) {
  const turns = ((az % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const index = Math.round((turns / (Math.PI * 2)) * RIDGE_BINS) % RIDGE_BINS;
  return RIDGE_ALT[index];
}

function behindCerros(alt: number, az: number) {
  return alt < ridgeAlt(az);
}

function buildCerros() {
  const peaks = cerroPeaks();
  const seg = 280;
  const steps = 36;
  const inner = 86;
  const outer = 172;
  const positions: number[] = [];
  const colors: number[] = [];
  const heights: number[] = [];
  const grass = new THREE.Color("#6f8c4e");
  const soil = new THREE.Color("#8d6240");
  const rock = new THREE.Color("#c4b3a0");
  const pale = new THREE.Color("#f4f0e7");
  const haze = new THREE.Color("#b9cce0");
  for (let s = 0; s <= steps; s += 1) {
    const radius = inner + ((outer - inner) * s) / steps;
    const far = THREE.MathUtils.smoothstep(radius, 118, 166);
    for (let i = 0; i <= seg; i += 1) {
      const az = (i / seg) * Math.PI * 2;
      const h = cerroSample(az, radius, peaks);
      heights.push(h);
      // El anillo interior baja bajo el suelo para que el cielo no asome
      // debajo de la silueta. La forma de los picos no cambia.
      const y = s === 0 ? -2.8 : h - 1.25;
      positions.push(Math.sin(az) * radius, y, -Math.cos(az) * radius);
      const crest = THREE.MathUtils.clamp(h / 18, 0, 1);
      const col = soil.clone();
      col.lerp(grass, 1 - THREE.MathUtils.smoothstep(crest, 0.05, 0.22));
      col.lerp(rock, THREE.MathUtils.smoothstep(crest, 0.12, 0.45));
      col.lerp(pale, THREE.MathUtils.smoothstep(crest, 0.5, 0.9));
      col.lerp(haze, far * 0.55);
      colors.push(col.r, col.g, col.b);
    }
  }
  const row = seg + 1;
  const indices: number[] = [];
  for (let s = 0; s < steps; s += 1) {
    for (let i = 0; i < seg; i += 1) {
      const a = s * row + i;
      const b = a + row;
      const top = Math.max(heights[a], heights[a + 1], heights[b], heights[b + 1]);
      if (top < 1.2) continue;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

type TreeSpot = { x: number; y: number; z: number; h: number; w: number; az: number; near: boolean };

function placeTrees(): TreeSpot[] {
  const spots: TreeSpot[] = [];
  const add = (az: number, r: number, h: number, w: number, near: boolean) => {
    spots.push({
      x: Math.sin(az) * r,
      y: -1.32 + h * 0.5,
      z: -Math.cos(az) * r,
      h,
      w,
      az,
      near,
    });
  };
  for (let i = 0; i < 140; i += 1) {
    const az = (i / 140) * Math.PI * 2;
    if (loopNoise(az, 3.4, 21) < 0.62) continue;
    const r = 58 + loopNoise(az, 6.2, 4) * 12;
    const h = 2.1 + loopNoise(az, 8.1, 11) * 2.8;
    add(az, r, h, 0.7 + loopNoise(az, 5, 2) * 0.55, false);
  }
  for (let i = 0; i < 14; i += 1) {
    const az = loopNoise(i, 1.2, 30) * Math.PI * 2;
    const h = 4.2 + loopNoise(az, 3, 6) * 2.4;
    add(az, 46 + (i % 4) * 3.5, h, 1.15 + (i % 3) * 0.2, true);
  }
  return spots;
}

export default function SpaceScene(props: Props) {
  const lst = useMemo(() => localSiderealTime(props.when), [props.when]);
  const opening = useMemo(() => openingLook(props.when, lst), [props.when, lst]);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [hud, setHud] = useState(() => hudText(opening.az, opening.alt, WIDE_FOV, props.when));

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(media.matches);
    const onChange = () => setReduceMotion(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return (
    <>
      <Canvas
        className="space-canvas"
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: "high-performance", alpha: false }}
        camera={{ position: [0, 0, 0], fov: WIDE_FOV, near: 0.08, far: 500 }}
        onCreated={({ gl, camera }) => {
          gl.setClearColor("#07101c", 1);
          gl.toneMapping = THREE.NoToneMapping;
          const dir = altAzToDir(opening.alt, opening.az);
          camera.lookAt(dir[0], dir[1], dir[2]);
        }}
      >
        <SkyClockContext.Provider value={{ when: props.when, lst }}>
          <Planetarium {...props} reduceMotion={reduceMotion} onHud={setHud} />
        </SkyClockContext.Provider>
      </Canvas>
      <div className="sky-reticle" aria-hidden="true" />
      <p className="sky-meta">{hud}</p>
    </>
  );
}

function hudText(az: number, alt: number, fov: number, when: Date) {
  const zoom = WIDE_FOV / fov;
  const zoomLabel = zoom < 1.15 ? "vista amplia" : `más cerca ×${zoom.toFixed(1)}`;
  const clock = when.toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const altDeg = Math.round((alt * 180) / Math.PI);
  return `${cardinalName(az)} · altura ${altDeg}° · ${clock} · ${zoomLabel}`;
}

function Planetarium({
  selectedId,
  onSelect,
  showAsteroids,
  showDebris,
  showConstellations,
  rocks,
  debris,
  overviewToken,
  zoomToken,
  onApproach,
  reduceMotion,
  onHud,
  when,
  aimToken,
}: Props & { reduceMotion: boolean; onHud: (caption: string) => void }) {
  const { lst } = useSkyClock();
  const look = useRef({ az: 0, alt: 0.5, fov: WIDE_FOV });
  const slew = useRef<AltAz | null>(openingLook(when, lst));
  const dragging = useRef(false);

  useEffect(() => {
    const next = openingLook(when, lst);
    look.current.az = next.az;
    look.current.alt = next.alt;
    look.current.fov = WIDE_FOV;
    slew.current = null;
  }, [overviewToken]);

  const lastZoom = useRef(zoomToken);
  useEffect(() => {
    if (zoomToken === lastZoom.current) return;
    const inward = zoomToken > lastZoom.current;
    lastZoom.current = zoomToken;
    const dir = inward ? 0.72 : 1.38;
    look.current.fov = clamp(look.current.fov * dir, MIN_FOV, MAX_FOV);
  }, [zoomToken]);

  const rocksRef = useRef(rocks);
  const debrisRef = useRef(debris);
  rocksRef.current = rocks;
  debrisRef.current = debris;
  useEffect(() => {
    slew.current = targetAltAz(selectedId, rocksRef.current, debrisRef.current, when, lst);
  }, [selectedId, aimToken]);

  return (
    <>
      <Atmosphere />
      <Horizon />
      <Cardinals />
      <StarDome reduceMotion={reduceMotion} fovRef={look} />
      {showConstellations ? (
        <ConstellationLines activeId={selectedId?.startsWith("con-") ? selectedId.slice(4) : null} />
      ) : null}
      {SPACE_BODIES.filter((body) => body.id !== "earth").map((body) => (
        <SkyBody
          key={body.id}
          body={body}
          selected={selectedId === body.id}
          onSelect={onSelect}
          onApproach={onApproach}
        />
      ))}
      {showAsteroids
        ? rocks.map((rock, index) => (
            <SkyRock
              key={rock.id}
              rock={rock}
              index={index}
              selected={selectedId === `neo-${rock.id}`}
              onSelect={onSelect}
              onApproach={onApproach}
              reduceMotion={reduceMotion}
            />
          ))
        : null}
      {showDebris
        ? debris.map((piece, index) => (
            <SkyDebris
              key={piece.id}
              piece={piece}
              index={index}
              selected={selectedId === `deb-${piece.id}`}
              onSelect={onSelect}
              onApproach={onApproach}
              reduceMotion={reduceMotion}
            />
          ))
        : null}
      <LookControls
        look={look}
        slew={slew}
        dragging={dragging}
        reduceMotion={reduceMotion}
        onHud={onHud}
        selectedId={selectedId}
        onApproach={onApproach}
      />
    </>
  );
}

function Atmosphere() {
  const material = useRef<THREE.ShaderMaterial>(null);
  const { when, lst } = useSkyClock();
  const uniforms = useMemo(
    () => ({
      uZenith: { value: new THREE.Color("#070b16") },
      uHorizon: { value: new THREE.Color("#141c30") },
      uWarm: { value: new THREE.Color("#ffb15a") },
      uSun: { value: new THREE.Vector3(0, -0.2, -1) },
      uGlow: { value: 0.2 },
      uLst: { value: 0 },
      uLat: { value: 0 },
      uNight: { value: 0 },
    }),
    [],
  );
  useFrame(() => {
    const live = sunAltAz(when, lst);
    const colors = skyPalette(live.alt);
    const dir = altAzToDir(live.alt, live.az);
    const mat = material.current;
    if (!mat) return;
    mat.uniforms.uZenith.value.copy(colors.zenith);
    mat.uniforms.uHorizon.value.copy(colors.horizon);
    mat.uniforms.uWarm.value.copy(colors.warm);
    mat.uniforms.uSun.value.set(dir[0], dir[1], dir[2]);
    mat.uniforms.uGlow.value = colors.glow;
    mat.uniforms.uLst.value = lst;
    mat.uniforms.uLat.value = observerLatitude();
    mat.uniforms.uNight.value = colors.starOpacity;
  });
  return (
    <mesh raycast={() => null}>
      <sphereGeometry args={[SKY_RADIUS, 48, 32]} />
      <shaderMaterial
        ref={material}
        side={THREE.BackSide}
        vertexShader={SKY_VERT}
        fragmentShader={SKY_FRAG}
        uniforms={uniforms}
        depthWrite={false}
      />
    </mesh>
  );
}

const CERRO_VERT = `
varying vec3 vNormal;
varying vec3 vColor;
varying vec3 vPos;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vColor = color;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPos = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const CERRO_FRAG = `
void main() {
  gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
}
`;

function CerroMesh({ geometry }: { geometry: THREE.BufferGeometry }) {
  return (
    <mesh geometry={geometry} raycast={() => null}>
      <shaderMaterial vertexShader={CERRO_VERT} fragmentShader={CERRO_FRAG} vertexColors side={THREE.DoubleSide} />
    </mesh>
  );
}

function Ground() {
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const { when, lst } = useSkyClock();
  useFrame(() => {
    const mat = material.current;
    if (!mat) return;
    mat.color.copy(skyPalette(sunAltAz(when, lst).alt).ground);
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.35, 0]} raycast={() => null}>
      <circleGeometry args={[168, 64]} />
      <meshBasicMaterial ref={material} color="#1a2402" />
    </mesh>
  );
}

const LEAF_COLORS = ["#2a420c", "#365214", "#223808", "#406018", "#2e4a10"];

type Clump = { x: number; z: number; h: number; w: number; yaw: number; shrub: boolean };

function placeFoliage(): Clump[] {
  const clumps: Clump[] = [];
  for (let i = 0; i < 640; i += 1) {
    const gate = hash01(i * 2.17);
    if (gate < 0.34) continue;
    const az = hash01(i * 1.63) * Math.PI * 2;
    const r = 9 + hash01(i * 4.41) * 66;
    const shrub = gate > 0.86;
    const h = shrub ? 0.85 + hash01(i * 8.2) * 0.7 : 0.22 + hash01(i * 6.1) * 0.48;
    clumps.push({
      x: Math.sin(az) * r,
      z: -Math.cos(az) * r,
      h,
      w: (shrub ? 0.55 : 0.16) + hash01(i * 3.3) * (shrub ? 0.45 : 0.22),
      yaw: az + hash01(i * 9.1) * 0.8,
      shrub,
    });
  }
  return clumps;
}

function Horizon() {
  const geometry = useMemo(() => buildCerros(), []);
  const spots = useMemo(() => placeTrees(), []);
  const clumps = useMemo(() => placeFoliage(), []);

  return (
    <group>
      <Ground />
      <CerroMesh geometry={geometry} />
      <FieldFoliage clumps={clumps} />
      <HorizonTrees spots={spots} />
    </group>
  );
}

function FieldFoliage({ clumps }: { clumps: Clump[] }) {
  const grass = useRef<THREE.InstancedMesh>(null);
  const shrubs = useRef<THREE.InstancedMesh>(null);
  const grassCount = clumps.filter((clump) => !clump.shrub).length;
  const shrubCount = clumps.length - grassCount;

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let grassIndex = 0;
    let shrubIndex = 0;
    clumps.forEach((clump, index) => {
      dummy.rotation.set(0, clump.yaw, 0);
      dummy.updateMatrix();
      color.set(LEAF_COLORS[index % LEAF_COLORS.length]);
      if (clump.shrub) {
        dummy.scale.set(clump.w, clump.h * 0.72, clump.w);
        dummy.position.set(clump.x, -1.32 + clump.h * 0.34, clump.z);
        dummy.updateMatrix();
        shrubs.current?.setMatrixAt(shrubIndex, dummy.matrix);
        shrubs.current?.setColorAt(shrubIndex, color);
        shrubIndex += 1;
      } else {
        dummy.scale.set(clump.w, clump.h, clump.w);
        dummy.position.set(clump.x, -1.3 + clump.h * 0.5, clump.z);
        dummy.updateMatrix();
        grass.current?.setMatrixAt(grassIndex, dummy.matrix);
        grass.current?.setColorAt(grassIndex, color);
        grassIndex += 1;
      }
    });
    if (grass.current) {
      grass.current.instanceMatrix.needsUpdate = true;
      if (grass.current.instanceColor) grass.current.instanceColor.needsUpdate = true;
    }
    if (shrubs.current) {
      shrubs.current.instanceMatrix.needsUpdate = true;
      if (shrubs.current.instanceColor) shrubs.current.instanceColor.needsUpdate = true;
    }
  }, [clumps]);

  return (
    <group>
      <instancedMesh ref={grass} args={[undefined, undefined, grassCount]} raycast={() => null}>
        <coneGeometry args={[1, 1, 5]} />
        <meshBasicMaterial />
      </instancedMesh>
      <instancedMesh ref={shrubs} args={[undefined, undefined, shrubCount]} raycast={() => null}>
        <sphereGeometry args={[1, 6, 5]} />
        <meshBasicMaterial />
      </instancedMesh>
    </group>
  );
}

function HorizonTrees({ spots }: { spots: TreeSpot[] }) {
  const canopy = useRef<THREE.InstancedMesh>(null);
  const puff = useRef<THREE.InstancedMesh>(null);
  const trunks = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    spots.forEach((spot, index) => {
      dummy.rotation.set(0, spot.az, 0);
      dummy.position.set(spot.x, spot.y, spot.z);
      dummy.scale.set(spot.w, spot.h, spot.w);
      dummy.updateMatrix();
      canopy.current?.setMatrixAt(index, dummy.matrix);
      color.set(LEAF_COLORS[index % LEAF_COLORS.length]);
      canopy.current?.setColorAt(index, color);
      dummy.scale.set(spot.w * 1.35, spot.h * 0.58, spot.w * 1.35);
      dummy.position.set(spot.x + Math.cos(spot.az) * spot.w * 0.28, -1.28 + spot.h * 0.46, spot.z);
      dummy.updateMatrix();
      puff.current?.setMatrixAt(index, dummy.matrix);
      color.set(LEAF_COLORS[(index + 2) % LEAF_COLORS.length]);
      puff.current?.setColorAt(index, color);
      dummy.scale.set(spot.w * 0.16, spot.h * 0.38, spot.w * 0.16);
      dummy.position.set(spot.x, -1.2 + spot.h * 0.16, spot.z);
      dummy.updateMatrix();
      trunks.current?.setMatrixAt(index, dummy.matrix);
    });
    for (const mesh of [canopy.current, puff.current]) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    if (trunks.current) trunks.current.instanceMatrix.needsUpdate = true;
  }, [spots]);

  return (
    <group>
      <instancedMesh ref={canopy} args={[undefined, undefined, spots.length]} raycast={() => null}>
        <coneGeometry args={[1, 1, 7]} />
        <meshBasicMaterial />
      </instancedMesh>
      <instancedMesh ref={puff} args={[undefined, undefined, spots.length]} raycast={() => null}>
        <sphereGeometry args={[0.72, 7, 5]} />
        <meshBasicMaterial />
      </instancedMesh>
      <instancedMesh ref={trunks} args={[undefined, undefined, spots.length]} raycast={() => null}>
        <cylinderGeometry args={[1, 1.15, 1, 5]} />
        <meshBasicMaterial color="#101406" />
      </instancedMesh>
    </group>
  );
}

function Cardinals() {
  const marks = [
    { name: "N", az: 0 },
    { name: "E", az: Math.PI / 2 },
    { name: "S", az: Math.PI },
    { name: "O", az: -Math.PI / 2 },
  ];
  return (
    <group>
      {marks.map((mark) => (
        <Billboard key={mark.name} follow position={altAzToDir(0.08, mark.az, 78)}>
          <Text fontSize={3.2} color="#e07070" anchorX="center" anchorY="bottom">
            {mark.name}
          </Text>
        </Billboard>
      ))}
    </group>
  );
}

function StarDome({
  reduceMotion,
  fovRef,
}: {
  reduceMotion: boolean;
  fovRef: { current: { fov: number } };
}) {
  const { when, lst } = useSkyClock();
  const field = useMemo(() => makeStarField(reduceMotion ? 2600 : 4800), [reduceMotion]);
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];
    for (let i = 0; i < field.count; i += 1) {
      const x = field.positions[i * 3] / SKY_RADIUS;
      const y = field.positions[i * 3 + 1] / SKY_RADIUS;
      const z = field.positions[i * 3 + 2] / SKY_RADIUS;
      const ra = Math.atan2(z, x);
      const dec = Math.asin(Math.min(1, Math.max(-1, y)));
      const { alt, az } = raDecToAltAz(ra, dec, lst);
      if (alt < 0.02 || behindCerros(alt, az)) continue;
      const dir = altAzToDir(alt, az, SKY_RADIUS * 0.96);
      positions.push(dir[0], dir[1], dir[2]);
      colors.push(field.colors[i * 3], field.colors[i * 3 + 1], field.colors[i * 3 + 2]);
      sizes.push(field.sizes[i]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    g.setAttribute("size", new THREE.Float32BufferAttribute(sizes, 1));
    return g;
  }, [field, lst]);
  const material = useRef<THREE.ShaderMaterial>(null);
  const night = skyPalette(sunAltAz(when, lst).alt).starOpacity;
  useFrame(() => {
    if (!material.current) return;
    material.current.uniforms.uScale.value = THREE.MathUtils.clamp(70 / fovRef.current.fov, 0.9, 2.2);
    material.current.uniforms.uNight.value = night;
  });
  return (
    <points geometry={geometry} raycast={() => null}>
      <shaderMaterial
        ref={material}
        vertexShader={STAR_VERT}
        fragmentShader={STAR_FRAG}
        transparent
        depthWrite={false}
        uniforms={{ uScale: { value: 1.3 }, uNight: { value: night } }}
      />
    </points>
  );
}

const STAR_VERT = `
  attribute float size;
  attribute vec3 color;
  varying vec3 vColor;
  uniform float uScale;
  void main() {
    vColor = color;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * uScale;
    gl_Position = projectionMatrix * mv;
  }
`;

const STAR_FRAG = `
  varying vec3 vColor;
  uniform float uNight;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float glow = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor, glow * uNight);
  }
`;

function ConstellationLines({ activeId }: { activeId: string | null }) {
  const { lst } = useSkyClock();
  const figures = useMemo(() => {
    return CONSTELLATIONS.map((group) => {
      const stars = group.stars.map((star) => {
        const { alt, az } = raDecToAltAz(star.ra, star.dec, lst);
        const dir = altAzToDir(alt, az, SKY_RADIUS * 0.92);
        const hidden = alt < 0.04 || behindCerros(alt, az);
        return { name: star.name, hidden, pos: new THREE.Vector3(...dir) };
      });
      const pts: [number, number, number][] = [];
      for (const [a, b] of group.lines) {
        if (stars[a].hidden || stars[b].hidden) continue;
        pts.push(stars[a].pos.toArray(), stars[b].pos.toArray());
      }
      const visible = stars.filter((star) => !star.hidden);
      const label = visible.length
        ? visible
            .reduce((acc, star) => acc.add(star.pos.clone()), new THREE.Vector3())
            .multiplyScalar(1 / visible.length)
            .normalize()
            .multiplyScalar(SKY_RADIUS * 0.9)
        : null;
      return { id: group.id, name: group.name, pts, stars: visible, label };
    }).filter((figure) => figure.pts.length > 0);
  }, [lst]);

  return (
    <group>
      {figures.map((figure) => {
        const on = activeId === figure.id;
        return (
          <group key={figure.id}>
            <Line
              points={figure.pts}
              segments
              lineWidth={on ? 7 : 3.2}
              color={on ? "#ffe3a1" : "#7eafd6"}
              transparent
              opacity={on ? 0.34 : 0.18}
              depthWrite={false}
              raycast={() => null}
            />
            <Line
              points={figure.pts}
              segments
              lineWidth={on ? 2.4 : 1.25}
              color={on ? "#fff6dc" : "#e7f3ff"}
              transparent
              opacity={on ? 0.96 : 0.7}
              depthWrite={false}
              raycast={() => null}
            />
            {figure.label ? (
              <Billboard follow position={figure.label}>
                <Text
                  fontSize={on ? 4.4 : 2.7}
                  color={on ? "#ffe7a8" : "#d5eef8"}
                  anchorY="bottom"
                  outlineWidth={0.14}
                  outlineColor="#07101c"
                >
                  {figure.name}
                </Text>
              </Billboard>
            ) : null}
            {on
              ? figure.stars.map((star) => (
                  <group key={star.name}>
                    <mesh position={star.pos} raycast={() => null}>
                      <sphereGeometry args={[1.15, 12, 8]} />
                      <meshBasicMaterial color="#fff4cc" />
                    </mesh>
                    <Billboard follow position={star.pos}>
                      <Text
                        position={[2.4, 1.5, 0]}
                        fontSize={1.8}
                        color="#fff8ea"
                        anchorX="left"
                        outlineWidth={0.08}
                        outlineColor="#07101c"
                      >
                        {star.name}
                      </Text>
                    </Billboard>
                  </group>
                ))
              : null}
          </group>
        );
      })}
    </group>
  );
}

function sunHaloTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (!ctx) return texture;
  const glow = ctx.createRadialGradient(128, 128, 42, 128, 128, 128);
  glow.addColorStop(0, "rgba(255,246,214,0)");
  glow.addColorStop(0.36, "rgba(255,246,214,0)");
  glow.addColorStop(0.48, "rgba(255,214,110,0.95)");
  glow.addColorStop(0.62, "rgba(255,112,18,0.42)");
  glow.addColorStop(0.82, "rgba(255,64,0,0.12)");
  glow.addColorStop(1, "rgba(255,40,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 256, 256);
  texture.needsUpdate = true;
  return texture;
}

let sunHalo: THREE.CanvasTexture | null = null;

function SunCorona({ radius }: { radius: number }) {
  const texture = useMemo(() => {
    sunHalo ??= sunHaloTexture();
    return sunHalo;
  }, []);
  return (
    <sprite scale={[radius * 3.2, radius * 3.2, 1]} raycast={() => null}>
      <spriteMaterial map={texture} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </sprite>
  );
}

const SKY_AIR: Record<string, string> = {
  venus: "#f6e2a8",
  mars: "#f0b2a4",
  jupiter: "#f3d7b4",
  saturn: "#f6e7c6",
  uranus: "#c9fff4",
  neptune: "#7eb6ff",
};

function SkyBody({
  body,
  selected,
  onSelect,
  onApproach,
}: {
  body: SpaceBody;
  selected: boolean;
  onSelect: (id: string) => void;
  onApproach: (id: string) => void;
}) {
  const texture = useMemo(() => bodyTexture(body.id), [body.id]);
  const { when, lst } = useSkyClock();
  const real = bodyAltAz(body, lst, when);
  if (behindCerros(real.alt, real.az)) return null;
  const below = real.alt < 0.02;
  if (below && !selected) return null;
  const alt = below ? 0.045 : real.alt;
  const pos = altAzToDir(alt, real.az, BODY_DISTANCE);
  const radius = angularRadius(bodyAngularDeg(body));
  const hit = Math.max(radius * 2.4, angularRadius(1.1));
  return (
    <group position={pos}>
      <mesh>
        <sphereGeometry args={[radius, body.id === "sun" ? 48 : 24, body.id === "sun" ? 32 : 20]} />
        <meshBasicMaterial map={texture} toneMapped={body.id !== "sun"} />
      </mesh>
      {body.id === "sun" ? <SunCorona radius={radius} /> : null}
      {SKY_AIR[body.id] ? (
        <mesh raycast={() => null} scale={1.18}>
          <sphereGeometry args={[radius, 20, 16]} />
          <meshBasicMaterial color={SKY_AIR[body.id]} transparent opacity={0.22} side={THREE.BackSide} depthWrite={false} />
        </mesh>
      ) : null}
      {body.id === "saturn" ? (
        <group rotation={[1.15, 0.2, 0.4]} raycast={() => null}>
          <mesh raycast={() => null}>
            <ringGeometry args={[radius * 1.45, radius * 2.15, 48]} />
            <meshBasicMaterial color="#ead7b0" transparent opacity={0.85} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ) : null}
      <SkyHit
        radius={hit}
        selected={selected}
        label={below ? `${body.name} · bajo el horizonte` : body.name}
        onSelect={() => onSelect(body.id)}
        onApproach={() => onApproach(body.id)}
      />
    </group>
  );
}

function SkyRock({
  rock,
  index,
  selected,
  onSelect,
  onApproach,
  reduceMotion,
}: {
  rock: NeoRock;
  index: number;
  selected: boolean;
  onSelect: (id: string) => void;
  onApproach: (id: string) => void;
  reduceMotion: boolean;
}) {
  const { lst } = useSkyClock();
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const elapsed = reduceMotion ? 0 : clock.elapsedTime;
    const pos = neoSkyPos(rock, index, lst, elapsed);
    const place = dirToAltAz(pos[0], pos[1], pos[2]);
    if (!ref.current) return;
    ref.current.visible = !behindCerros(place.alt, place.az) && (place.alt > 0.02 || selected);
    ref.current.position.set(pos[0], Math.max(pos[1], angularRadius(2)), pos[2]);
  });
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  return (
    <mesh
      ref={ref}
      onClick={(event) => {
        event.stopPropagation();
        if (selected) onApproach(`neo:${rock.id}`);
        else onSelect(`neo-${rock.id}`);
      }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <sphereGeometry args={[selected ? 0.55 : 0.28, 8, 8]} />
      <meshBasicMaterial color={selected ? "#ffe08a" : "#e7c56a"} />
    </mesh>
  );
}

function SkyDebris({
  piece,
  index,
  selected,
  onSelect,
  onApproach,
  reduceMotion,
}: {
  piece: DebrisPiece;
  index: number;
  selected: boolean;
  onSelect: (id: string) => void;
  onApproach: (id: string) => void;
  reduceMotion: boolean;
}) {
  const { lst } = useSkyClock();
  const ref = useRef<THREE.Group>(null);
  const trail = useRef<THREE.BufferGeometry>(null);
  useFrame(({ clock }) => {
    const elapsed = reduceMotion ? 0 : clock.elapsedTime;
    const pos = debrisSkyPos(piece, index, lst, elapsed);
    const place = dirToAltAz(pos[0], pos[1], pos[2]);
    const hidden = behindCerros(place.alt, place.az);
    if (ref.current) {
      ref.current.visible = !hidden;
      ref.current.position.set(pos[0], pos[1], pos[2]);
    }
    if (!trail.current) return;
    const pts: number[] = [];
    let previous: [number, number, number] | null = null;
    for (let step = 0; step < 14; step += 1) {
      const back = debrisSkyPos(piece, index, lst, elapsed - step * 0.35);
      const backPlace = dirToAltAz(back[0], back[1], back[2]);
      if (backPlace.alt < 0 || behindCerros(backPlace.alt, backPlace.az)) break;
      if (previous) pts.push(...previous, ...back);
      previous = back;
    }
    trail.current.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  });
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  const showName = selected || piece.id === "25544";
  return (
    <group>
      <lineSegments raycast={() => null}>
        <bufferGeometry ref={trail} />
        <lineBasicMaterial color="#7ddea0" transparent opacity={0.8} />
      </lineSegments>
      <group ref={ref}>
        <mesh
          onClick={(event) => {
            event.stopPropagation();
            if (selected) onApproach(`craft:${piece.id}`);
            else onSelect(`deb-${piece.id}`);
          }}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          <sphereGeometry args={[selected ? 0.5 : 0.26, 8, 8]} />
          <meshBasicMaterial color="#f4f7ff" />
        </mesh>
        {showName ? (
          <Billboard follow position={[1.4, 1.1, 0]}>
            <Text fontSize={1.8} color="#d9ffe4" anchorX="left">
              {piece.id === "25544" ? "ISS" : piece.name}
            </Text>
          </Billboard>
        ) : null}
      </group>
    </group>
  );
}

function SkyHit({
  radius,
  selected,
  label,
  onSelect,
  onApproach,
}: {
  radius: number;
  selected: boolean;
  label: string;
  onSelect: () => void;
  onApproach: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  return (
    <>
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          if (selected) onApproach();
          else onSelect();
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          onApproach();
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[radius, 10, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Billboard follow position={[radius * 1.3, radius * 1.1, 0]}>
        <Text fontSize={selected ? 2.3 : 1.7} color={selected ? "#ffe7a3" : "#f7f4ea"} anchorX="left" outlineWidth={0.08} outlineColor="#070b14">
          {label}
        </Text>
      </Billboard>
    </>
  );
}

function LookControls({
  look,
  slew,
  dragging,
  reduceMotion,
  onHud,
  selectedId,
  onApproach,
}: {
  look: { current: { az: number; alt: number; fov: number } };
  slew: { current: AltAz | null };
  dragging: { current: boolean };
  reduceMotion: boolean;
  onHud: (caption: string) => void;
  selectedId: string | null;
  onApproach: (id: string) => void;
}) {
  const { when } = useSkyClock();
  const { camera, gl } = useThree();
  const hudClock = useRef(0);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef(0);
  const approachArmed = useRef(true);

  useEffect(() => {
    const el = gl.domElement;
    const onDown = (event: PointerEvent) => {
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.current.size === 1) dragging.current = true;
      if (pointers.current.size === 2) {
        const pts = [...pointers.current.values()];
        pinch.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        dragging.current = false;
      }
    };
    const onMove = (event: PointerEvent) => {
      if (!pointers.current.has(event.pointerId)) return;
      const prev = pointers.current.get(event.pointerId);
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.current.size === 2) {
        const pts = [...pointers.current.values()];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (pinch.current > 0) look.current.fov = clamp(look.current.fov * (pinch.current / dist), MIN_FOV, MAX_FOV);
        pinch.current = dist;
        slew.current = null;
        return;
      }
      if (!dragging.current || !prev) return;
      const dx = event.clientX - prev.x;
      const dy = event.clientY - prev.y;
      if (Math.hypot(dx, dy) < 0.5) return;
      slew.current = null;
      const k = (look.current.fov / 68) * 0.0052;
      look.current.az = wrap(look.current.az - dx * k);
      look.current.alt = clamp(look.current.alt + dy * k, -0.05, 1.35);
    };
    const onUp = (event: PointerEvent) => {
      pointers.current.delete(event.pointerId);
      if (pointers.current.size === 0) dragging.current = false;
      pinch.current = 0;
    };
    let over = false;
    const onWheel = (event: WheelEvent) => {
      if (!over && event.target !== el && !el.contains(event.target as Node)) return;
      event.preventDefault();
      look.current.fov = clamp(look.current.fov * (event.deltaY > 0 ? 1.08 : 0.92), MIN_FOV, MAX_FOV);
      slew.current = null;
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerenter", () => {
      over = true;
    });
    el.addEventListener("pointerleave", () => {
      over = false;
    });
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("wheel", onWheel);
    };
  }, [dragging, gl, look, slew]);

  useFrame((_, dt) => {
    if (slew.current) {
      const t = reduceMotion ? 1 : 1 - Math.exp(-2.6 * dt);
      look.current.az = lerpAngle(look.current.az, slew.current.az, t);
      look.current.alt = THREE.MathUtils.lerp(look.current.alt, slew.current.alt, t);
      if (Math.abs(wrapDelta(look.current.az, slew.current.az)) < 0.01 && Math.abs(look.current.alt - slew.current.alt) < 0.01) {
        slew.current = null;
      }
    }
    const { az, alt, fov } = look.current;
    const approachTarget = toApproachId(selectedId);
    if (fov <= MIN_FOV + 0.2 && approachTarget && approachArmed.current) {
      approachArmed.current = false;
      const id = approachTarget;
      requestAnimationFrame(() => onApproach(id));
    } else if (fov > MIN_FOV + 2) {
      approachArmed.current = true;
    }
    const persp = camera as THREE.PerspectiveCamera;
    if (Math.abs(persp.fov - fov) > 0.05) {
      persp.fov = fov;
      persp.updateProjectionMatrix();
    }
    persp.position.set(0, 0.4, 0);
    persp.up.set(0, 1, 0);
    const dir = altAzToDir(alt, az);
    persp.lookAt(dir[0], dir[1], dir[2]);
    hudClock.current += dt;
    if (hudClock.current > 0.2) {
      hudClock.current = 0;
      onHud(hudText(az, alt, fov, when));
    }
  });
  return null;
}

function toApproachId(selectedId: string | null): string | null {
  if (!selectedId || selectedId === "earth" || selectedId.startsWith("con-")) return null;
  if (selectedId.startsWith("neo-")) return `neo:${selectedId.slice(4)}`;
  if (selectedId.startsWith("deb-")) return `craft:${selectedId.slice(4)}`;
  return selectedId;
}

function targetAltAz(selectedId: string | null, rocks: NeoRock[], debris: DebrisPiece[], when: Date, lst: number): AltAz | null {
  if (!selectedId || selectedId === "earth") return openingLook(when, lst);
  if (selectedId.startsWith("neo-")) {
    const index = Math.max(rocks.findIndex((rock) => rock.id === selectedId.slice(4)), 0);
    const rock = rocks[index];
    if (!rock) return null;
    const dir = neoSkyPos(rock, index, lst, 0);
    const place = dirToAltAz(dir[0], dir[1], dir[2]);
    return { az: place.az, alt: Math.max(place.alt, 0.12) };
  }
  if (selectedId.startsWith("deb-")) {
    const index = Math.max(debris.findIndex((item) => `deb-${item.id}` === selectedId), 0);
    const piece = debris[index];
    if (!piece) return null;
    const dir = debrisSkyPos(piece, index, lst, 0);
    const place = dirToAltAz(dir[0], dir[1], dir[2]);
    return { az: place.az, alt: Math.max(place.alt, 0.16) };
  }
  if (selectedId.startsWith("con-")) {
    const group = CONSTELLATIONS.find((item) => item.id === selectedId.slice(4));
    if (!group) return null;
    const acc = new THREE.Vector3();
    let count = 0;
    for (const star of group.stars) {
      const { alt, az } = raDecToAltAz(star.ra, star.dec, lst);
      if (alt < 0.04) continue;
      acc.add(new THREE.Vector3(...altAzToDir(alt, az)));
      count += 1;
    }
    if (!count) {
      for (const star of group.stars) {
        const { alt, az } = raDecToAltAz(star.ra, star.dec, lst);
        acc.add(new THREE.Vector3(...altAzToDir(alt, az)));
      }
    }
    const place = dirToAltAz(acc.x, acc.y, acc.z);
    return { az: place.az, alt: place.alt < 0.12 ? 0.16 : Math.min(place.alt, 1.15) };
  }
  const body = SPACE_BODIES.find((item) => item.id === selectedId);
  if (!body) return null;
  const place = bodyAltAz(body, lst, when);
  return { az: place.az, alt: place.alt < 0.08 ? 0.1 : Math.min(place.alt, 1.15) };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function wrap(az: number) {
  const t = Math.PI * 2;
  return ((az % t) + t) % t;
}

function wrapDelta(a: number, b: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function lerpAngle(a: number, b: number, t: number) {
  return wrap(a + wrapDelta(a, b) * t);
}
