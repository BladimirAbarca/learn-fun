import { SPACE_BODIES, bodyAngleDeg, orbitRadius, type SpaceBody } from "@/lib/planets";
import type { DebrisPiece, NeoRock } from "@/lib/types";

export const WORLD_SCALE = 28;

/** Real orbital inclinations (NASA fact sheet, degrees), used for 3D tilt. */
export const INCLINATION_DEG: Record<string, number> = {
  sun: 0,
  mercury: 7.0,
  venus: 3.4,
  earth: 0,
  moon: 5.1,
  mars: 1.85,
  ceres: 10.6,
  jupiter: 1.3,
  saturn: 2.49,
  uranus: 0.77,
  neptune: 1.77,
  pluto: 17.16,
};

export function worldRadius(au: number): number {
  return orbitRadius(au) / WORLD_SCALE;
}

export function worldSize(visualSize: number): number {
  return Math.max(visualSize / 40, 0.11);
}

function polarOnOrbit(radius: number, deg: number, inclinationDeg: number): [number, number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  const inc = (inclinationDeg * Math.PI) / 180;
  const x = radius * Math.cos(a);
  const z = radius * Math.sin(a) * Math.cos(inc);
  const y = radius * Math.sin(a) * Math.sin(inc);
  return [x, y, z];
}

export function bodyWorldPosition(
  body: SpaceBody,
  now = new Date(),
  moonAngleExtra = 0,
): [number, number, number] {
  if (body.id === "sun") return [0, 0, 0];
  if (body.parentId === "earth") {
    const earth = SPACE_BODIES.find((item) => item.id === "earth");
    const origin = earth ? bodyWorldPosition(earth, now) : ([0, 0, 0] as [number, number, number]);
    const moonR = worldSize(17) * 2.6;
    const ang = bodyAngleDeg(body, now) + moonAngleExtra;
    const offset = polarOnOrbit(moonR, ang, INCLINATION_DEG.moon);
    return [origin[0] + offset[0], origin[1] + offset[1], origin[2] + offset[2]];
  }
  return polarOnOrbit(worldRadius(body.au), bodyAngleDeg(body, now), INCLINATION_DEG[body.id] ?? 0);
}

export function neoWorldPosition(rock: NeoRock, index: number, elapsed: number): [number, number, number] {
  const radius = worldRadius(1) * (0.82 + Math.min(rock.missLunar, 50) / 220);
  const ang = index * 0.82 + elapsed * (0.12 + index * 0.008);
  const inc = ((index % 5) - 2) * 0.09;
  return [radius * Math.cos(ang), Math.sin(ang) * radius * inc * 0.35, radius * Math.sin(ang)];
}

export function debrisWorldPosition(
  piece: DebrisPiece,
  index: number,
  elapsed: number,
  earth: [number, number, number],
): [number, number, number] {
  const radius = worldSize(17) * (2.1 + (index % 4) * 0.38);
  const speed = Math.max(piece.meanMotion, 8) * 0.035;
  const ang = (piece.meanAnomaly * Math.PI) / 180 + elapsed * speed;
  const inc = ((piece.inclination * Math.PI) / 180) * 0.12;
  return [
    earth[0] + radius * Math.cos(ang),
    earth[1] + Math.sin(inc) * radius * Math.sin(ang),
    earth[2] + radius * Math.sin(ang) * Math.cos(inc),
  ];
}
