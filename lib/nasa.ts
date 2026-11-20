import type { ApodCard, DebrisPiece, GalleryImage, NeoRock, SpaceImage } from "./types";
import { SPACE_BODIES } from "./planets";

const NASA_KEY = process.env.NASA_API_KEY?.trim() || "DEMO_KEY";

type CacheEntry<T> = { expires: number; value: T };
const cache = new Map<string, CacheEntry<unknown>>();

function readCache<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit || hit.expires < Date.now()) return null;
  return hit.value as T;
}

function writeCache<T>(key: string, value: T, ttlMs: number) {
  cache.set(key, { expires: Date.now() + ttlMs, value });
}

async function getJson(url: string, timeoutMs = 8000): Promise<unknown> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

function isoDate(offsetDays = 0): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function cleanText(value: unknown): string {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

type NeoApi = {
  near_earth_objects?: Record<
    string,
    Array<{
      id?: string;
      name?: string;
      nasa_jpl_url?: string;
      is_potentially_hazardous_asteroid?: boolean;
      estimated_diameter?: { meters?: { estimated_diameter_min?: number; estimated_diameter_max?: number } };
      close_approach_data?: Array<{
        close_approach_date?: string;
        miss_distance?: { kilometers?: string; lunar?: string };
        relative_velocity?: { kilometers_per_hour?: string };
      }>;
    }>
  >;
};

const AU_KM = 149_597_870.7;
const LUNAR_KM = 384_400;
const CAD_MONTHS: Record<string, string> = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
};

export async function fetchNeos(): Promise<{ rocks: NeoRock[]; live: boolean; catalog: "neows" | "jpl" }> {
  const key = "neo";
  const cached = readCache<{ rocks: NeoRock[]; live: boolean; catalog: "neows" | "jpl" }>(key);
  if (cached) return cached;

  try {
    const rocks = await fetchNeows();
    if (rocks.length) {
      const result = { rocks, live: true, catalog: "neows" as const };
      writeCache(key, result, 10 * 60_000);
      return result;
    }
  } catch {
    // Demo key is often rate-limited. JPL publishes the same kind of list without a key.
  }

  const rocks = await fetchJplApproaches();
  const result = { rocks, live: true, catalog: "jpl" as const };
  writeCache(key, result, 10 * 60_000);
  return result;
}

async function fetchNeows(): Promise<NeoRock[]> {
  const url = `https://api.nasa.gov/neo/rest/v1/feed?start_date=${isoDate(0)}&end_date=${isoDate(6)}&api_key=${encodeURIComponent(NASA_KEY)}`;
  const json = (await getJson(url)) as NeoApi;
  const rocks: NeoRock[] = [];

  for (const day of Object.values(json.near_earth_objects ?? {})) {
    for (const item of day) {
      const approach = item.close_approach_data?.[0];
      const missKm = Number(approach?.miss_distance?.kilometers);
      const missLunar = Number(approach?.miss_distance?.lunar);
      const speed = Number(approach?.relative_velocity?.kilometers_per_hour);
      if (!item.id || !Number.isFinite(missKm)) continue;
      rocks.push({
        id: item.id,
        name: cleanText(item.name).replace(/[()]/g, ""),
        diameterMinM: Number(item.estimated_diameter?.meters?.estimated_diameter_min) || 0,
        diameterMaxM: Number(item.estimated_diameter?.meters?.estimated_diameter_max) || 0,
        missKm,
        missLunar: Number.isFinite(missLunar) ? missLunar : missKm / LUNAR_KM,
        speedKmh: Number.isFinite(speed) ? speed : 0,
        approachDate: cleanText(approach?.close_approach_date),
        jplUrl: cleanText(item.nasa_jpl_url),
        watchedClosely: Boolean(item.is_potentially_hazardous_asteroid),
      });
    }
  }

  rocks.sort((a, b) => a.missKm - b.missKm);
  return rocks.slice(0, 40);
}

async function fetchJplApproaches(): Promise<NeoRock[]> {
  const json = (await getJson(
    "https://ssd-api.jpl.nasa.gov/cad.api?dist-max=0.2&date-min=now&date-max=%2B7&sort=dist&limit=40",
    12000,
  )) as {
    fields?: string[];
    data?: string[][];
  };
  const fields = json.fields ?? [];
  const index = (name: string) => fields.indexOf(name);
  const desAt = index("des");
  const cdAt = index("cd");
  const distAt = index("dist");
  const speedAt = index("v_rel");
  if (desAt < 0 || distAt < 0) throw new Error("Bad JPL feed");

  const rocks: NeoRock[] = [];
  for (const row of json.data ?? []) {
    const name = cleanText(row[desAt]);
    const distAu = Number(row[distAt]);
    if (!name || !Number.isFinite(distAu)) continue;
    const missKm = distAu * AU_KM;
    const speed = Number(row[speedAt]);
    const rawDate = cleanText(row[cdAt]).split(" ")[0] ?? "";
    const [year, month, day] = rawDate.split("-");
    rocks.push({
      id: name.replace(/\s+/g, ""),
      name,
      diameterMinM: 0,
      diameterMaxM: 0,
      missKm,
      missLunar: missKm / LUNAR_KM,
      speedKmh: Number.isFinite(speed) ? speed * 3600 : 0,
      approachDate: CAD_MONTHS[month] ? `${year}-${CAD_MONTHS[month]}-${day}` : rawDate,
      jplUrl: `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${encodeURIComponent(name)}`,
      watchedClosely: false,
    });
  }
  if (!rocks.length) throw new Error("No JPL approaches");
  return rocks;
}

type ApodApiItem = {
  date?: string;
  title?: string;
  alt?: string;
  hdurl?: string;
  url?: string;
  credit?: string;
  permalink?: string;
  media_type?: string;
};

export async function fetchApod(): Promise<ApodCard> {
  const key = "apod";
  const cached = readCache<ApodCard>(key);
  if (cached) return cached;

  const json = (await getJson(
    `https://science.nasa.gov/wp-json/wp/v2/apod-basic/?api_key=${encodeURIComponent(NASA_KEY)}`,
  )) as ApodApiItem[] | ApodApiItem;

  const items = Array.isArray(json) ? json : [json];
  const photo = items.find((item) => (item.media_type ?? "image") === "image" && (item.hdurl || item.url));
  if (!photo) throw new Error("No APOD image");

  const imageUrl = cleanText(photo.hdurl || photo.url);
  if (!imageUrl.startsWith("https://")) throw new Error("Bad APOD url");

  const card: ApodCard = {
    date: cleanText(photo.date),
    title: cleanText(photo.title) || "Foto del cielo",
    alt: cleanText(photo.alt),
    imageUrl,
    credit: cleanText(photo.credit) || "NASA",
    permalink: cleanText(photo.permalink),
  };
  writeCache(key, card, 30 * 60_000);
  return card;
}

type ImageSearch = {
  collection?: {
    items?: Array<{
      data?: Array<{
        title?: string;
        nasa_id?: string;
        description?: string;
        photographer?: string;
        secondary_creator?: string;
        center?: string;
      }>;
      links?: Array<{ href?: string; rel?: string }>;
    }>;
  };
};

const NASA_CENTERS = new Set(["GSFC", "JPL", "JSC", "KSC", "MSFC", "ARC", "LARC", "GRC", "HQ", "NSSC", "AFRC", "WFF"]);
const RESTRICTED_IMAGE = /all rights reserved|permission required|may not be reproduced|copyright holder/i;
const NOT_A_PLANET_PHOTO =
  /illustration|artist'?s? concept|artwork|rendering|diagram|drawing|simulation|visualization|schematic|logo|poster|\bpatch\b|briefing|clean room|at jpl|engineers?|technicians?|press conference|model of|test version|ellipse|sneak preview|comparison|by the numbers|flying over|infographic|\bgraph\b|\bchart\b/i;

/** Title must name this body, so a search does not mix in other worlds. */
const BODY_GALLERY: Record<string, { name: string; queries: string[]; title: RegExp; reject?: RegExp }> = {
  sun: {
    name: "el Sol",
    queries: ["SDO Sun NASA full disk", "Solar Dynamics Observatory sun"],
    title: /\bsun\b|photosphere|sunspot/i,
    reject: /mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto/i,
  },
  mercury: {
    name: "Mercurio",
    queries: ["Mercury planet MESSENGER NASA", "Mercury planet surface NASA"],
    title: /mercury/i,
  },
  venus: {
    name: "Venus",
    queries: ["Venus planet Magellan NASA", "Venus clouds NASA"],
    title: /venus/i,
  },
  earth: {
    name: "la Tierra",
    queries: ["Earth from space NASA Blue Marble", "Earth limb NASA"],
    title: /\bearth\b|blue marble/i,
    reject: /saturn|cassini|jupiter|mars\b|venus|smiled/i,
  },
  moon: {
    name: "la Luna",
    queries: ["Moon NASA Apollo surface", "lunar surface NASA"],
    title: /\bmoon\b|lunar/i,
    reject: /earth from|blue marble/i,
  },
  mars: {
    name: "Marte",
    queries: ["Mars surface HiRISE NASA", "Mars landscape NASA", "Mars planet from orbit NASA"],
    title: /\bmars\b/i,
    reject: /\bjpl\b|drawing|design|wheel|generation|components/i,
  },
  ceres: {
    name: "Ceres",
    queries: ["Ceres dwarf planet Dawn NASA", "Ceres surface Dawn NASA"],
    title: /ceres/i,
  },
  jupiter: {
    name: "Júpiter",
    queries: ["Jupiter planet Juno NASA", "Jupiter Great Red Spot NASA"],
    title: /jupiter/i,
  },
  saturn: {
    name: "Saturno",
    queries: ["Saturn rings Cassini NASA", "Saturn planet Cassini NASA"],
    title: /saturn/i,
    reject: /\bearth\b/i,
  },
  uranus: {
    name: "Urano",
    queries: ["Uranus planet Voyager NASA", "Uranus Hubble NASA"],
    title: /uranus/i,
  },
  neptune: {
    name: "Neptuno",
    queries: ["Neptune planet Voyager NASA", "Neptune Hubble NASA"],
    title: /neptune/i,
  },
  pluto: {
    name: "Plutón",
    queries: ["Pluto New Horizons NASA", "Pluto surface NASA"],
    title: /pluto/i,
  },
};

function spanishSummary(title: string, description: string, bodyId: string): string {
  const spec = BODY_GALLERY[bodyId];
  const name = spec?.name ?? "este mundo";
  const blob = `${title}. ${description}`;
  const extra: string[] = [];
  if (bodyId === "saturn" && /cassini/i.test(blob)) extra.push("La tomó la sonda Cassini.");
  else if (bodyId === "jupiter" && /juno/i.test(blob)) extra.push("La tomó la sonda Juno.");
  else if (bodyId === "moon" && /apollo/i.test(blob)) extra.push("Es de las misiones Apolo.");
  else if (bodyId === "pluto" && /new horizons/i.test(blob)) extra.push("La tomó la sonda New Horizons.");
  else if (bodyId === "sun" && /sdo|solar dynamics/i.test(blob)) extra.push("La tomó el observatorio SDO.");
  else if (bodyId === "mars" && /hirise|crater|landscape|terrain/i.test(blob)) extra.push("Se ve el suelo de Marte.");
  return [`Foto real de ${name}.`, ...extra].join(" ");
}

function galleryImagesFrom(json: ImageSearch, bodyId: string): GalleryImage[] {
  const spec = BODY_GALLERY[bodyId];
  if (!spec) return [];
  const images: GalleryImage[] = [];
  for (const item of json.collection?.items ?? []) {
    const data = item.data?.[0];
    if (!data) continue;
    const title = cleanText(data.title);
    const description = cleanText(data.description);
    const blob = `${title} ${description} ${data.photographer ?? ""} ${data.secondary_creator ?? ""}`;
    if (!title || /video/i.test(title) || RESTRICTED_IMAGE.test(blob) || NOT_A_PLANET_PHOTO.test(blob)) continue;
    if (!spec.title.test(title) || spec.reject?.test(title)) continue;
    const center = cleanText(data.center).toUpperCase();
    if (!/NASA/i.test(blob) && !NASA_CENTERS.has(center)) continue;
    const hrefs = (item.links ?? [])
      .map((link) => link.href ?? "")
      .filter((href) => href.startsWith("https://images-assets.nasa.gov/"));
    const url =
      hrefs.find((href) => href.includes("~large.")) ||
      hrefs.find((href) => href.includes("~medium.")) ||
      hrefs.find((href) => href.includes("~small.")) ||
      "";
    const id = cleanText(data.nasa_id);
    if (!url || !id) continue;
    const credit = shortNasaCredit(description, center);
    images.push({ id, title, url, credit, summary: spanishSummary(title, description, bodyId) });
  }
  return images;
}

function shortNasaCredit(description: string, center: string): string {
  const match = description.match(/(?:image credit|credit)\s*:\s*(.{3,160})/i);
  let credit = match?.[1] ?? "";
  credit = credit.split(/NASA image use policy/i)[0].replace(/\s+/g, " ").trim().replace(/[.,;:\s]+$/, "");
  if (credit.length > 72) credit = `${credit.slice(0, 69).replace(/\s+\S*$/, "")}…`;
  if (credit && /NASA|ESA/i.test(credit)) return credit;
  return center ? `NASA (${center})` : "NASA";
}

export function galleryBodyName(bodyId: string): string | null {
  return BODY_GALLERY[bodyId]?.name ?? null;
}

/** Real NASA photos whose title names this body. Illustrations are left out. */
export async function fetchBodyGallery(bodyId: string): Promise<GalleryImage[]> {
  const spec = BODY_GALLERY[bodyId];
  if (!spec) return [];
  const key = `gallery-body-${bodyId}-v4`;
  const cached = readCache<GalleryImage[]>(key);
  if (cached) return cached;

  const batches = await Promise.allSettled(
    spec.queries.map((query) =>
      getJson(
        `https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=image&page_size=16`,
        9000,
      ).then((json) => galleryImagesFrom(json as ImageSearch, bodyId)),
    ),
  );

  const images: GalleryImage[] = [];
  const seen = new Set<string>();
  for (const batch of batches) {
    if (batch.status !== "fulfilled") continue;
    for (const image of batch.value) {
      if (seen.has(image.id) || seen.has(image.title)) continue;
      seen.add(image.id);
      seen.add(image.title);
      images.push(image);
      if (images.length >= 12) break;
    }
    if (images.length >= 12) break;
  }
  if (!images.length) throw new Error("No NASA photos for body");
  writeCache(key, images, 6 * 60 * 60_000);
  return images;
}

async function searchNasaImage(query: string): Promise<SpaceImage | null> {
  const json = (await getJson(
    `https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=image&page_size=5`,
    9000,
  )) as ImageSearch;

  for (const item of json.collection?.items ?? []) {
    const title = cleanText(item.data?.[0]?.title);
    if (/video/i.test(title)) continue;
    const preview =
      item.links?.find((link) => link.href?.includes("~medium"))?.href ||
      item.links?.find((link) => link.href?.includes("~small"))?.href ||
      item.links?.find((link) => link.href?.startsWith("https://"))?.href;
    if (!preview) continue;
    const credit =
      cleanText(item.data?.[0]?.photographer) ||
      cleanText(item.data?.[0]?.secondary_creator) ||
      "NASA";
    return { url: preview, title: title || query, credit };
  }
  return null;
}

export async function fetchBodyImages(): Promise<Record<string, SpaceImage>> {
  const key = "images";
  const cached = readCache<Record<string, SpaceImage>>(key);
  if (cached) return cached;

  const entries = await Promise.all(
    SPACE_BODIES.map(async (body) => {
      try {
        const image = await searchNasaImage(body.imageQuery);
        return image ? ([body.id, image] as const) : null;
      } catch {
        return null;
      }
    }),
  );

  const byId: Record<string, SpaceImage> = {};
  for (const entry of entries) {
    if (entry) byId[entry[0]] = entry[1];
  }
  writeCache(key, byId, 6 * 60 * 60_000);
  return byId;
}

/** Public catalog numbers and published orbit pace. Not a live position, except the station altitude. */
const PUBLISHED_CRAFT: DebrisPiece[] = [
  { id: "25544", name: "Estación Espacial Internacional", meanMotion: 15.5, inclination: 51.6, meanAnomaly: 20, kind: "station" },
  { id: "48274", name: "Tiangong", meanMotion: 15.6, inclination: 41.5, meanAnomaly: 70, kind: "station" },
  { id: "20580", name: "Hubble", meanMotion: 15.1, inclination: 28.5, meanAnomaly: 110, kind: "satellite" },
  { id: "33053", name: "Fermi", meanMotion: 15.25, inclination: 25.6, meanAnomaly: 150, kind: "satellite" },
  { id: "25994", name: "Terra", meanMotion: 14.6, inclination: 98.2, meanAnomaly: 40, kind: "satellite" },
  { id: "27424", name: "Aqua", meanMotion: 14.6, inclination: 98.2, meanAnomaly: 190, kind: "satellite" },
  { id: "39084", name: "Landsat 8", meanMotion: 14.6, inclination: 98.2, meanAnomaly: 230, kind: "satellite" },
  { id: "49260", name: "Landsat 9", meanMotion: 14.6, inclination: 98.2, meanAnomaly: 260, kind: "satellite" },
  { id: "37849", name: "Suomi NPP", meanMotion: 14.2, inclination: 98.8, meanAnomaly: 80, kind: "satellite" },
  { id: "43013", name: "NOAA-20", meanMotion: 14.2, inclination: 98.8, meanAnomaly: 300, kind: "satellite" },
  { id: "33591", name: "NOAA-19", meanMotion: 14.1, inclination: 99, meanAnomaly: 330, kind: "satellite" },
  { id: "28654", name: "NOAA-18", meanMotion: 14.1, inclination: 99, meanAnomaly: 15, kind: "satellite" },
  { id: "41866", name: "GOES-16", meanMotion: 1, inclination: 0.7, meanAnomaly: 200, kind: "satellite" },
];

export async function fetchDebris(): Promise<DebrisPiece[]> {
  const key = "debris";
  const cached = readCache<DebrisPiece[]>(key);
  if (cached) return cached;

  const pieces = PUBLISHED_CRAFT.map((piece) => ({ ...piece }));
  try {
    const iss = (await getJson("https://api.wheretheiss.at/v1/satellites/25544", 6000)) as {
      altitude?: number;
      longitude?: number;
    };
    const station = pieces.find((piece) => piece.id === "25544");
    if (station) {
      const altitude = Number(iss.altitude);
      const longitude = Number(iss.longitude);
      if (Number.isFinite(altitude)) station.altitudeKm = altitude;
      if (Number.isFinite(longitude)) station.meanAnomaly = (longitude + 180 + 360) % 360;
    }
  } catch {
    // The names and orbit pace still come from the published catalog.
  }

  writeCache(key, pieces, 10 * 60_000);
  return pieces;
}

/** Snapshot of NASA NeoWs from 19 Nov 2026, used only if the live feed fails. */
export const SAMPLE_NEOS: NeoRock[] = [
  {
    id: "3825571",
    name: "2018 NE1",
    diameterMinM: 56,
    diameterMaxM: 124,
    missKm: 6_385_660,
    missLunar: 16.6,
    speedKmh: 47_824,
    approachDate: "2026-11-19",
    jplUrl: "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=3825571",
    watchedClosely: false,
  },
  {
    id: "3263448",
    name: "2004 XK14",
    diameterMinM: 86,
    diameterMaxM: 193,
    missKm: 13_132_347,
    missLunar: 34.1,
    speedKmh: 31_401,
    approachDate: "2026-11-19",
    jplUrl: "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=3263448",
    watchedClosely: false,
  },
  {
    id: "3892309",
    name: "2019 VF1",
    diameterMinM: 67,
    diameterMaxM: 149,
    missKm: 8_981_854,
    missLunar: 23.4,
    speedKmh: 71_400,
    approachDate: "2026-11-20",
    jplUrl: "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=3892309",
    watchedClosely: false,
  },
];
