import { SPACE_BODIES, type SpaceBody } from "@/lib/planets";
import { bodyWorldPosition, INCLINATION_DEG } from "@/lib/space3d";
import type { DebrisPiece, NeoRock } from "@/lib/types";

/** Fallback latitude (Madrid). The live sky uses the computer's time zone. */
export const OBSERVER_LAT_RAD = (40.4 * Math.PI) / 180;

/** Latitude that matches the computer clock, so the sky is the local one. */
export function observerLatitude(): number {
  if (typeof window === "undefined") return OBSERVER_LAT_RAD;
  const minutesWest = new Date().getTimezoneOffset();
  if (minutesWest >= 150 && minutesWest <= 210) return (-34.6 * Math.PI) / 180;
  if (minutesWest > 210 && minutesWest <= 420) return (19.4 * Math.PI) / 180;
  if (minutesWest <= 0 && minutesWest >= -180) return (40.4 * Math.PI) / 180;
  return OBSERVER_LAT_RAD;
}

/** Longitude east of Greenwich, matched to the same time zones as the latitude. */
export function observerLongitude(): number {
  if (typeof window === "undefined") return (-3.7 * Math.PI) / 180;
  const minutesWest = new Date().getTimezoneOffset();
  if (minutesWest >= 150 && minutesWest <= 210) return (-58.4 * Math.PI) / 180;
  if (minutesWest > 210 && minutesWest <= 420) return (-99.1 * Math.PI) / 180;
  if (minutesWest <= 0 && minutesWest >= -180) return (-3.7 * Math.PI) / 180;
  return (-3.7 * Math.PI) / 180;
}

/** Sidereal time for the computer clock. Public GMST formula, not taken from a planetarium. */
export function localSiderealTime(now = new Date()): number {
  const jd = now.getTime() / 86_400_000 + 2_440_587.5;
  const d = jd - 2_451_545.0;
  const t = d / 36_525;
  let gmst = 280.46061837 + 360.98564736629 * d + 0.000387933 * t * t - (t * t * t) / 38_710_000;
  gmst = ((gmst % 360) + 360) % 360;
  const lonDeg = (observerLongitude() * 180) / Math.PI;
  return (((gmst + lonDeg) % 360) + 360) % 360 * (Math.PI / 180);
}
export const SKY_RADIUS = 220;
export const BODY_DISTANCE = 90;
export const OBLIQUITY = (23.4393 * Math.PI) / 180;

export type RaDec = { ra: number; dec: number };
export type AltAz = { alt: number; az: number };
export type SkyDir = [number, number, number];

export function hms(h: number, m: number, s = 0): number {
  return (((h + m / 60 + s / 3600) * 15) * Math.PI) / 180;
}

export function dms(d: number, m = 0, s = 0): number {
  const sign = d < 0 || Object.is(d, -0) ? -1 : 1;
  return ((d + sign * (m / 60 + s / 3600)) * Math.PI) / 180;
}

/** Equatorial RA/Dec → unit vector (Y up = north celestial pole). */
export function raDecToEquatorial(ra: number, dec: number): SkyDir {
  const x = Math.cos(dec) * Math.cos(ra);
  const y = Math.sin(dec);
  const z = Math.cos(dec) * Math.sin(ra);
  return [x, y, z];
}

export function cartesianToRaDec(x: number, y: number, z: number): RaDec {
  const r = Math.hypot(x, y, z) || 1;
  // The orbit is drawn 90° before its longitude so the old map faced the camera.
  const lon = Math.atan2(z, x) + Math.PI / 2;
  const lat = Math.asin(y / r);
  const sinDec = Math.sin(lat) * Math.cos(OBLIQUITY) + Math.cos(lat) * Math.sin(OBLIQUITY) * Math.sin(lon);
  const dec = Math.asin(Math.min(1, Math.max(-1, sinDec)));
  const yEq = Math.cos(lat) * Math.cos(OBLIQUITY) * Math.sin(lon) - Math.sin(lat) * Math.sin(OBLIQUITY);
  const xEq = Math.cos(lat) * Math.cos(lon);
  const ra = Math.atan2(yEq, xEq);
  return { ra: (ra + Math.PI * 2) % (Math.PI * 2), dec };
}

export function raDecToAltAz(ra: number, dec: number, lst: number, lat = observerLatitude()): AltAz {
  const ha = lst - ra;
  const sinAlt = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha);
  const alt = Math.asin(Math.min(1, Math.max(-1, sinAlt)));
  const az = Math.atan2(
    -Math.cos(dec) * Math.sin(ha),
    Math.cos(lat) * Math.sin(dec) - Math.sin(lat) * Math.cos(dec) * Math.cos(ha),
  );
  return { alt, az: (az + Math.PI * 2) % (Math.PI * 2) };
}

/** Local horizon frame: +Y up, +X east, -Z north. */
export function altAzToDir(alt: number, az: number, radius = 1): SkyDir {
  const c = Math.cos(alt);
  return [c * Math.sin(az) * radius, Math.sin(alt) * radius, -c * Math.cos(az) * radius];
}

export function dirToAltAz(x: number, y: number, z: number): AltAz {
  const r = Math.hypot(x, y, z) || 1;
  const alt = Math.asin(Math.min(1, Math.max(-1, y / r)));
  const az = Math.atan2(x, -z);
  return { alt, az: (az + Math.PI * 2) % (Math.PI * 2) };
}

function geocentric(body: SpaceBody, now: Date): SkyDir {
  const earth = SPACE_BODIES.find((item) => item.id === "earth");
  const earthPos = earth ? bodyWorldPosition(earth, now) : ([0, 0, 0] as SkyDir);
  if (body.id === "earth") return [0, 1, 0];
  const pos = body.id === "sun" ? ([0, 0, 0] as SkyDir) : bodyWorldPosition(body, now);
  return [pos[0] - earthPos[0], pos[1] - earthPos[1], pos[2] - earthPos[2]];
}

export function bodyRaDec(body: SpaceBody, now = new Date()): RaDec {
  const [x, y, z] = geocentric(body, now);
  return cartesianToRaDec(x, y, z);
}

/** Evening LST: sun below the horizon, Orion often in the south. */
export function eveningLst(now = new Date()): number {
  const sun = SPACE_BODIES.find((item) => item.id === "sun");
  if (!sun) return hms(5, 30);
  const { ra, dec } = bodyRaDec(sun, now);
  let best = hms(5, 30);
  let bestScore = -1e9;
  for (let hour = 0; hour < 24; hour += 0.2) {
    const lst = (hour * 15 * Math.PI) / 180;
    const { alt } = raDecToAltAz(ra, dec, lst);
    const orionHa = lst - hms(5, 35);
    const orionSouth = Math.cos(orionHa);
    const night = alt < dms(-12) ? 4 : alt < 0 ? 0.5 : -6;
    const deep = alt < dms(-18) && alt > dms(-40) ? 1.5 : 0;
    const score = night + deep + orionSouth * 2;
    if (score > bestScore) {
      bestScore = score;
      best = lst;
    }
  }
  return best;
}

export function bodyAltAz(body: SpaceBody, lst: number, now = new Date()): AltAz {
  if (body.id === "earth") return { alt: Math.PI / 2, az: 0 };
  const { ra, dec } = bodyRaDec(body, now);
  return raDecToAltAz(ra, dec, lst);
}

export function bodySkyPos(body: SpaceBody, lst: number, now = new Date(), radius = BODY_DISTANCE): SkyDir {
  const { alt, az } = bodyAltAz(body, lst, now);
  return altAzToDir(alt, az, radius);
}

/**
 * Real altitude and compass direction.
 * A body under the horizon stays on that same compass line, just above the ground,
 * so it can be found without pretending it is high in the sky.
 */
export function shownBodyAltAz(body: SpaceBody, lst: number, now = new Date()): AltAz & { below: boolean } {
  const real = bodyAltAz(body, lst, now);
  const below = body.id !== "earth" && real.alt < 0.02;
  return { ...real, below };
}

export function angularRadius(deg: number, distance = BODY_DISTANCE): number {
  return Math.tan((deg * Math.PI) / 180) * distance;
}

/** Exaggerated a little so kids can find planets, still tiny vs the sky. */
/** Small on the sky, a little larger than real so a child can still find them. */
export function bodyAngularDeg(body: SpaceBody): number {
  if (body.id === "moon") return 1.7;
  if (body.id === "sun") return 1.45;
  if (body.id === "jupiter") return 0.55;
  if (body.id === "saturn") return 0.5;
  if (body.id === "venus") return 0.42;
  if (body.id === "mars") return 0.38;
  return 0.32;
}

/** Brightest-feeling planet or moon that is well above the horizon tonight. */
export function bestEveningPlanet(now = new Date(), lst = eveningLst(now)): string {
  const ids = ["jupiter", "saturn", "mars", "venus", "moon", "mercury"];
  let best = "jupiter";
  let bestAlt = -99;
  for (const id of ids) {
    const body = SPACE_BODIES.find((item) => item.id === id);
    if (!body) continue;
    const { alt } = bodyAltAz(body, lst, now);
    if (alt > bestAlt) {
      bestAlt = alt;
      best = id;
    }
  }
  return bestAlt > 0.18 ? best : "jupiter";
}

export function cardinalName(az: number): string {
  const deg = ((az * 180) / Math.PI + 360) % 360;
  const names = ["Norte", "Noreste", "Este", "Sureste", "Sur", "Suroeste", "Oeste", "Noroeste"];
  return names[Math.round(deg / 45) % 8];
}

export type NamedStar = { name: string; ra: number; dec: number };

/**
 * Bright-star coordinates are public IAU/Hipparcos J2000 positions (hours/degrees),
 * not copied from any planetarium program.
 */
export const CONSTELLATIONS: {
  id: string;
  name: string;
  stars: NamedStar[];
  lines: [number, number][];
}[] = [
  {
    id: "orion",
    name: "Orión",
    stars: [
      { name: "Betelgeuse", ra: hms(5, 55, 10), dec: dms(7, 24) },
      { name: "Bellatrix", ra: hms(5, 25, 8), dec: dms(6, 21) },
      { name: "Mintaka", ra: hms(5, 32, 0), dec: dms(-0.3) },
      { name: "Alnilam", ra: hms(5, 36, 13), dec: dms(-1, 12) },
      { name: "Alnitak", ra: hms(5, 40, 46), dec: dms(-1, 57) },
      { name: "Saiph", ra: hms(5, 47, 45), dec: dms(-9, 40) },
      { name: "Rigel", ra: hms(5, 14, 32), dec: dms(-8, 12) },
      { name: "Meissa", ra: hms(5, 35, 8), dec: dms(9, 56) },
    ],
    lines: [
      [7, 0],
      [7, 1],
      [0, 1],
      [0, 4],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [2, 6],
      [6, 5],
    ],
  },
  {
    id: "uma",
    name: "Osa Mayor",
    stars: [
      { name: "Dubhe", ra: hms(11, 3, 44), dec: dms(61, 45) },
      { name: "Merak", ra: hms(11, 1, 50), dec: dms(56, 23) },
      { name: "Phecda", ra: hms(11, 53, 50), dec: dms(53, 42) },
      { name: "Megrez", ra: hms(12, 15, 26), dec: dms(57, 2) },
      { name: "Alioth", ra: hms(12, 54, 2), dec: dms(55, 57) },
      { name: "Mizar", ra: hms(13, 23, 56), dec: dms(54, 55) },
      { name: "Alkaid", ra: hms(13, 47, 32), dec: dms(49, 19) },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [3, 4],
      [4, 5],
      [5, 6],
    ],
  },
  {
    id: "cas",
    name: "Casiopea",
    stars: [
      { name: "Caph", ra: hms(0, 9, 11), dec: dms(59, 9) },
      { name: "Schedar", ra: hms(0, 40, 30), dec: dms(56, 32) },
      { name: "Navi", ra: hms(0, 56, 42), dec: dms(60, 43) },
      { name: "Ruchbah", ra: hms(1, 25, 49), dec: dms(60, 14) },
      { name: "Segin", ra: hms(1, 54, 24), dec: dms(63, 40) },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ],
  },
  {
    id: "cru",
    name: "Cruz del Sur",
    stars: [
      { name: "Acrux", ra: hms(12, 26, 36), dec: dms(-63, 6) },
      { name: "Mimosa", ra: hms(12, 47, 43), dec: dms(-59, 41) },
      { name: "Gacrux", ra: hms(12, 31, 10), dec: dms(-57, 7) },
      { name: "Imai", ra: hms(12, 15, 9), dec: dms(-58, 45) },
      { name: "Ginan", ra: hms(12, 21, 21), dec: dms(-60, 24) },
    ],
    lines: [
      [0, 2],
      [1, 3],
    ],
  },
  {
    id: "cma",
    name: "Can Mayor",
    stars: [
      { name: "Sirio", ra: hms(6, 45, 9), dec: dms(-16, 43) },
      { name: "Mirzam", ra: hms(6, 22, 42), dec: dms(-17, 57) },
      { name: "Wezen", ra: hms(7, 8, 23), dec: dms(-26, 24) },
      { name: "Adhara", ra: hms(6, 58, 38), dec: dms(-28, 58) },
      { name: "Aludra", ra: hms(7, 24, 6), dec: dms(-29, 18) },
    ],
    lines: [
      [1, 0],
      [0, 2],
      [2, 3],
      [2, 4],
    ],
  },
  {
    id: "cmi",
    name: "Can Menor",
    stars: [
      { name: "Procyon", ra: hms(7, 39, 18), dec: dms(5, 13) },
      { name: "Gomeisa", ra: hms(7, 27, 9), dec: dms(8, 17) },
    ],
    lines: [[0, 1]],
  },
  {
    id: "tau",
    name: "Tauro",
    stars: [
      { name: "Aldebarán", ra: hms(4, 35, 55), dec: dms(16, 31) },
      { name: "Elnath", ra: hms(5, 26, 17), dec: dms(28, 36) },
      { name: "Ain", ra: hms(4, 28, 37), dec: dms(19, 11) },
      { name: "Hyadum", ra: hms(4, 19, 47), dec: dms(15, 37) },
    ],
    lines: [
      [0, 1],
      [0, 2],
      [2, 3],
    ],
  },
  {
    id: "gem",
    name: "Géminis",
    stars: [
      { name: "Cástor", ra: hms(7, 34, 36), dec: dms(31, 53) },
      { name: "Pólux", ra: hms(7, 45, 19), dec: dms(28, 2) },
      { name: "Alhena", ra: hms(6, 37, 43), dec: dms(16, 24) },
      { name: "Mebsuta", ra: hms(6, 43, 55), dec: dms(25, 8) },
    ],
    lines: [
      [0, 1],
      [0, 3],
      [1, 2],
    ],
  },
  {
    id: "leo",
    name: "Leo",
    stars: [
      { name: "Regulus", ra: hms(10, 8, 22), dec: dms(11, 58) },
      { name: "Algieba", ra: hms(10, 19, 58), dec: dms(19, 50) },
      { name: "Zosma", ra: hms(11, 14, 6), dec: dms(20, 31) },
      { name: "Denebola", ra: hms(11, 49, 4), dec: dms(14, 34) },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
    ],
  },
  {
    id: "sco",
    name: "Escorpio",
    stars: [
      { name: "Antares", ra: hms(16, 29, 24), dec: dms(-26, 26) },
      { name: "Acrab", ra: hms(16, 5, 26), dec: dms(-19, 48) },
      { name: "Dschubba", ra: hms(16, 0, 20), dec: dms(-22, 37) },
      { name: "Larawag", ra: hms(16, 50, 10), dec: dms(-34, 17) },
      { name: "Sargas", ra: hms(17, 37, 19), dec: dms(-42, 60) },
      { name: "Shaula", ra: hms(17, 33, 36), dec: dms(-37, 6) },
      { name: "Lesath", ra: hms(17, 30, 45), dec: dms(-37, 18) },
    ],
    lines: [
      [1, 2],
      [2, 0],
      [0, 3],
      [3, 4],
      [4, 5],
      [5, 6],
    ],
  },
  {
    id: "cen",
    name: "Centauro",
    stars: [
      { name: "Alfa Centauri", ra: hms(14, 39, 36), dec: dms(-60, 50) },
      { name: "Hadar", ra: hms(14, 3, 49), dec: dms(-60, 22) },
      { name: "Menkent", ra: hms(14, 6, 41), dec: dms(-36, 22) },
      { name: "Épsilon", ra: hms(13, 39, 53), dec: dms(-53, 28) },
    ],
    lines: [
      [0, 1],
      [1, 3],
      [3, 2],
    ],
  },
  {
    id: "tra",
    name: "Triángulo Austral",
    stars: [
      { name: "Atria", ra: hms(16, 48, 40), dec: dms(-69, 2) },
      { name: "Betria", ra: hms(15, 55, 9), dec: dms(-63, 26) },
      { name: "Gamria", ra: hms(15, 18, 55), dec: dms(-68, 41) },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 0],
    ],
  },
  {
    id: "sgr",
    name: "Sagitario",
    stars: [
      { name: "Kaus Australis", ra: hms(18, 24, 10), dec: dms(-34, 23) },
      { name: "Kaus Media", ra: hms(18, 20, 59), dec: dms(-29, 50) },
      { name: "Kaus Borealis", ra: hms(18, 27, 58), dec: dms(-25, 25) },
      { name: "Nunki", ra: hms(18, 55, 16), dec: dms(-26, 18) },
      { name: "Ascella", ra: hms(19, 2, 37), dec: dms(-29, 53) },
    ],
    lines: [
      [2, 1],
      [1, 0],
      [0, 4],
      [4, 3],
      [3, 2],
    ],
  },
  {
    id: "cyg",
    name: "Cisne",
    stars: [
      { name: "Deneb", ra: hms(20, 41, 26), dec: dms(45, 17) },
      { name: "Sadr", ra: hms(20, 22, 14), dec: dms(40, 15) },
      { name: "Albireo", ra: hms(19, 30, 43), dec: dms(27, 58) },
      { name: "Gienah", ra: hms(20, 46, 12), dec: dms(33, 58) },
      { name: "Fawaris", ra: hms(19, 44, 58), dec: dms(45, 8) },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [3, 1],
      [1, 4],
    ],
  },
  {
    id: "lyr",
    name: "Lira",
    stars: [
      { name: "Vega", ra: hms(18, 36, 56), dec: dms(38, 47) },
      { name: "Sheliak", ra: hms(18, 50, 5), dec: dms(33, 22) },
      { name: "Sulafat", ra: hms(18, 58, 56), dec: dms(32, 41) },
    ],
    lines: [
      [0, 1],
      [1, 2],
    ],
  },
  {
    id: "aql",
    name: "Águila",
    stars: [
      { name: "Altair", ra: hms(19, 50, 47), dec: dms(8, 52) },
      { name: "Tarazed", ra: hms(19, 46, 15), dec: dms(10, 37) },
      { name: "Alshain", ra: hms(19, 55, 18), dec: dms(6, 24) },
    ],
    lines: [
      [1, 0],
      [0, 2],
    ],
  },
  {
    id: "peg",
    name: "Pegaso",
    stars: [
      { name: "Markab", ra: hms(23, 4, 46), dec: dms(15, 12) },
      { name: "Scheat", ra: hms(23, 3, 46), dec: dms(28, 5) },
      { name: "Alpheratz", ra: hms(0, 8, 23), dec: dms(29, 5) },
      { name: "Algenib", ra: hms(0, 13, 14), dec: dms(15, 11) },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
    ],
  },
];

/** Bright stars that are not part of a drawn figure. Same public J2000 positions. */
export const LONE_BRIGHT: NamedStar[] = [
  { name: "Canopus", ra: hms(6, 23, 57), dec: dms(-52, 42) },
  { name: "Achernar", ra: hms(1, 37, 43), dec: dms(-57, 14) },
  { name: "Fomalhaut", ra: hms(22, 57, 39), dec: dms(-29, 37) },
  { name: "Arcturus", ra: hms(14, 15, 40), dec: dms(19, 11) },
  { name: "Espiga", ra: hms(13, 25, 12), dec: dms(-11, 10) },
];

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export type StarField = {
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  count: number;
};

const WARM_STARS = new Set(["Betelgeuse", "Antares", "Aldebarán", "Arcturus", "Pólux", "Gacrux"]);
const BLUE_STARS = new Set(["Rigel", "Espiga", "Achernar", "Mimosa", "Acrux", "Hadar", "Vega"]);
const GIANT_STARS = new Set(["Sirio", "Canopus", "Arcturus", "Vega", "Alfa Centauri", "Rigel", "Achernar"]);

function catalogTint(name: string): [number, number, number] {
  if (WARM_STARS.has(name)) return [1, 0.72, 0.45];
  if (BLUE_STARS.has(name)) return [0.75, 0.86, 1];
  return [0.96, 0.97, 1];
}

/** Procedural catalog (not a copied star database). Named stars use published positions. */
export function makeStarField(count: number, seed = 2026): StarField {
  const rand = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  // Galactic plane ~ 60° to equatorial, RA of node ~ 282° — public galactic coordinates.
  const tilt = dms(60);
  const node = (282 * Math.PI) / 180;
  const placed: number[] = [];
  const cells = new Map<string, number[]>();
  const minSep = 0.02;
  const minSep2 = minSep * minSep;
  const cellSize = 0.06;
  const cellKey = (x: number, y: number, z: number) =>
    `${Math.round(x / cellSize)},${Math.round(y / cellSize)},${Math.round(z / cellSize)}`;
  const blocked = (x: number, y: number, z: number) => {
    const ix = Math.round(x / cellSize);
    const iy = Math.round(y / cellSize);
    const iz = Math.round(z / cellSize);
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dz = -1; dz <= 1; dz += 1) {
          const list = cells.get(`${ix + dx},${iy + dy},${iz + dz}`);
          if (!list) continue;
          for (const j of list) {
            const ox = placed[j * 3] - x;
            const oy = placed[j * 3 + 1] - y;
            const oz = placed[j * 3 + 2] - z;
            if (ox * ox + oy * oy + oz * oz < minSep2) return true;
          }
        }
      }
    }
    return false;
  };
  const catalog = [
    ...CONSTELLATIONS.flatMap((group) => group.stars),
    ...LONE_BRIGHT,
  ];
  let i = 0;
  for (const star of catalog) {
    if (i >= count) break;
    const [ex, ey, ez] = raDecToEquatorial(star.ra, star.dec);
    const slot = placed.length / 3;
    placed.push(ex, ey, ez);
    const list = cells.get(cellKey(ex, ey, ez)) ?? [];
    list.push(slot);
    cells.set(cellKey(ex, ey, ez), list);
    positions[i * 3] = ex * SKY_RADIUS;
    positions[i * 3 + 1] = ey * SKY_RADIUS;
    positions[i * 3 + 2] = ez * SKY_RADIUS;
    const [r, g, b] = catalogTint(star.name);
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
    sizes[i] = GIANT_STARS.has(star.name) ? 4.4 : 3.1;
    i += 1;
  }
  let attempts = 0;
  while (i < count && attempts < count * 8) {
    attempts += 1;
    let ra: number;
    let dec: number;
    if (rand() < 0.58) {
      const lon = rand() * Math.PI * 2;
      const lat = (rand() - 0.5) * 0.55;
      const x = Math.cos(lat) * Math.cos(lon);
      const y = Math.sin(lat);
      const z = Math.cos(lat) * Math.sin(lon);
      const y2 = y * Math.cos(tilt) - z * Math.sin(tilt);
      const z2 = y * Math.sin(tilt) + z * Math.cos(tilt);
      const x3 = x * Math.cos(node) - z2 * Math.sin(node);
      const z3 = x * Math.sin(node) + z2 * Math.cos(node);
      ra = Math.atan2(z3, x3);
      dec = Math.asin(Math.min(1, Math.max(-1, y2)));
    } else {
      ra = rand() * Math.PI * 2;
      dec = Math.asin(rand() * 2 - 1);
    }
    const [ex, ey, ez] = raDecToEquatorial(ra, dec);
    if (blocked(ex, ey, ez)) continue;
    const slot = placed.length / 3;
    placed.push(ex, ey, ez);
    const list = cells.get(cellKey(ex, ey, ez)) ?? [];
    list.push(slot);
    cells.set(cellKey(ex, ey, ez), list);
    positions[i * 3] = ex * SKY_RADIUS;
    positions[i * 3 + 1] = ey * SKY_RADIUS;
    positions[i * 3 + 2] = ez * SKY_RADIUS;
    const mag = Math.pow(rand(), 0.45);
    const temp = rand();
    let r = 1;
    let g = 0.96;
    let b = 0.92;
    if (temp < 0.12) {
      r = 0.72;
      g = 0.82;
      b = 1;
    } else if (temp < 0.35) {
      r = 0.85;
      g = 0.9;
      b = 1;
    } else if (temp > 0.88) {
      r = 1;
      g = 0.78;
      b = 0.55;
    } else if (temp > 0.72) {
      r = 1;
      g = 0.9;
      b = 0.72;
    }
    const bright = 0.28 + mag * 0.72;
    colors[i * 3] = r * bright;
    colors[i * 3 + 1] = g * bright;
    colors[i * 3 + 2] = b * bright;
    sizes[i] = 0.7 + mag * 2.2;
    i += 1;
  }
  return { positions: positions.slice(0, i * 3), colors: colors.slice(0, i * 3), sizes: sizes.slice(0, i), count: i };
}

export function neoSkyPos(rock: NeoRock, index: number, lst: number, elapsed: number): SkyDir {
  const earth = SPACE_BODIES.find((item) => item.id === "earth");
  if (!earth) return altAzToDir(0.3, index, BODY_DISTANCE);
  const [ex, ey, ez] = bodyWorldPosition(earth);
  const radius = 1.1 + Math.min(rock.missLunar, 40) / 80;
  const ang = index * 0.7 + elapsed * 0.015;
  const inc = ((index % 5) - 2) * 0.04;
  const x = ex + radius * Math.cos(ang);
  const y = ey + radius * inc;
  const z = ez + radius * Math.sin(ang);
  const { ra, dec } = cartesianToRaDec(x - ex, y - ey, z - ez);
  const { alt, az } = raDecToAltAz(ra, dec, lst);
  return altAzToDir(alt, az, BODY_DISTANCE);
}

export function debrisSkyPos(piece: DebrisPiece, index: number, lst: number, elapsed: number): SkyDir {
  const speed = Math.max(piece.meanMotion, 8) * 0.012;
  const az = ((piece.meanAnomaly * Math.PI) / 180 + elapsed * speed + index * 0.4) % (Math.PI * 2);
  const alt = 0.18 + ((piece.inclination % 80) / 80) * 0.7;
  return altAzToDir(alt, az, BODY_DISTANCE * 0.92);
}

export { INCLINATION_DEG };
