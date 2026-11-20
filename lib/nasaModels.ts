/** NASA Solar System Exploration glTF pages: https://solarsystem.nasa.gov/gltf_embed/<id>/ */
export const NASA_EMBEDS: Record<string, number> = {
  sun: 2352,
  mercury: 2369,
  venus: 2343,
  earth: 2393,
  moon: 2366,
  mars: 2372,
  ceres: 2400,
  jupiter: 2375,
  saturn: 2355,
  uranus: 2344,
  neptune: 2364,
  pluto: 2357,
  phobos: 2358,
  deimos: 2434,
  io: 2379,
  europa: 2388,
  ganymede: 2385,
  callisto: 2402,
  enceladus: 2391,
  titan: 2349,
  triton: 2346,
  charon: 2399,
  iss: 2378,
  hubble: 2383,
  bennu: 2403,
};

/** Spanish moon name → NASA model. Names without their own scan use a similar NASA moon. */
const MOON_MODEL: Record<string, string> = {
  Luna: "moon",
  Fobos: "phobos",
  Deimos: "deimos",
  Ío: "io",
  Europa: "europa",
  Ganímedes: "ganymede",
  Calisto: "callisto",
  Encélado: "enceladus",
  Dione: "enceladus",
  Rea: "enceladus",
  Titán: "titan",
  Miranda: "enceladus",
  Ariel: "enceladus",
  Titania: "enceladus",
  Oberón: "enceladus",
  Proteo: "moon",
  Tritón: "triton",
  Caronte: "charon",
  Nix: "moon",
  Hidra: "moon",
};

const OWN_MOON = new Set([
  "Luna",
  "Fobos",
  "Deimos",
  "Ío",
  "Europa",
  "Ganímedes",
  "Calisto",
  "Encélado",
  "Titán",
  "Tritón",
  "Caronte",
]);

export function moonModelKey(name: string): string {
  return MOON_MODEL[name] ?? "moon";
}

export function moonHasOwnModel(name: string): boolean {
  return OWN_MOON.has(name);
}

export function craftModelKey(id: string): "iss" | "hubble" | "satellite" {
  if (id === "25544") return "iss";
  if (id === "20580") return "hubble";
  return "satellite";
}

export function modelApiPath(key: string): string {
  return `/api/nasa-model/${key}`;
}
