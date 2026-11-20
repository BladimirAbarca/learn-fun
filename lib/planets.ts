export type BodyKind = "star" | "planet" | "dwarf" | "moon";

export type SpaceBody = {
  id: string;
  name: string;
  kind: BodyKind;
  color: string;
  au: number;
  periodDays: number;
  longitudeJ2000: number;
  visualSize: number;
  diameterKm: number;
  moons?: string;
  imageQuery: string;
  kidFact: string;
  details: string[];
  parentId?: string;
};

/** NASA NSSDC Planetary Fact Sheet numbers, simplified for children. */
export const SPACE_BODIES: SpaceBody[] = [
  {
    id: "sun",
    name: "Sol",
    kind: "star",
    color: "#ffd166",
    au: 0,
    periodDays: 0,
    longitudeJ2000: 0,
    visualSize: 58,
    diameterKm: 1_392_700,
    imageQuery: "SDO full disk sun NASA",
    kidFact: "Es una estrella. Toda la luz y el calor de nuestro sistema salen de aquí.",
    details: [
      "El Sol es una estrella, no un planeta.",
      "Su diámetro es de unos 1.392.700 km (NASA).",
      "La superficie está a unos 5.500 °C.",
      "Los planetas giran a su alrededor por la gravedad.",
    ],
  },
  {
    id: "mercury",
    name: "Mercurio",
    kind: "planet",
    color: "#c9b8a6",
    au: 0.387,
    periodDays: 88.0,
    longitudeJ2000: 252.25,
    visualSize: 12,
    diameterKm: 4_879,
    moons: "0",
    imageQuery: "Mercury planet MESSENGER",
    kidFact: "El más cercano al Sol. Un año suyo dura 88 días terrestres.",
    details: [
      "Distancia media al Sol: 57,9 millones de km.",
      "No tiene lunas.",
      "De día hace mucho calor y de noche mucho frío, porque casi no tiene atmósfera.",
      "NASA lo visitó con las misiones Mariner 10 y MESSENGER.",
    ],
  },
  {
    id: "venus",
    name: "Venus",
    kind: "planet",
    color: "#e8c07a",
    periodDays: 224.7,
    longitudeJ2000: 181.98,
    au: 0.723,
    visualSize: 16,
    diameterKm: 12_104,
    moons: "0",
    imageQuery: "Venus planet Magellan",
    kidFact: "Está cubierto de nubes densas. Es el planeta más caliente.",
    details: [
      "Distancia media al Sol: 108,2 millones de km.",
      "Un año en Venus dura unos 225 días terrestres.",
      "Su atmósfera es muy espesa y atrapa el calor: unos 464 °C.",
      "Gira al revés que la Tierra. No tiene lunas.",
    ],
  },
  {
    id: "earth",
    name: "Tierra",
    kind: "planet",
    color: "#6db3f2",
    au: 1,
    periodDays: 365.2,
    longitudeJ2000: 100.46,
    visualSize: 17,
    diameterKm: 12_756,
    moons: "1 (la Luna)",
    imageQuery: "Earth from space NASA Blue Marble",
    kidFact: "Nuestro hogar. Tiene agua líquida, aire y una luna.",
    details: [
      "Distancia media al Sol: 149,6 millones de km. Eso se llama 1 unidad astronómica (UA).",
      "Un año: 365,2 días. Un día: 24 horas.",
      "Es el único planeta conocido con vida.",
      "Alrededor de la Tierra orbitan satélites y también trozos viejos de cohetes: la basura espacial.",
    ],
  },
  {
    id: "moon",
    name: "Luna",
    kind: "moon",
    color: "#d9d3c5",
    au: 1,
    periodDays: 27.3217,
    longitudeJ2000: 218.316,
    visualSize: 8,
    diameterKm: 3_475,
    parentId: "earth",
    imageQuery: "Moon NASA Apollo",
    kidFact: "La compañera de la Tierra. Apolo 11 llegó allí en 1969.",
    details: [
      "Está a unos 384.400 km de la Tierra.",
      "Tarda 27,3 días en dar una vuelta alrededor de nuestro planeta.",
      "No tiene aire para respirar.",
      "Su gravedad es más suave: en la Luna pesarías menos.",
    ],
  },
  {
    id: "mars",
    name: "Marte",
    kind: "planet",
    color: "#d37a5b",
    au: 1.524,
    periodDays: 687.0,
    longitudeJ2000: 355.45,
    visualSize: 13,
    diameterKm: 6_792,
    moons: "2 (Fobos y Deimos)",
    imageQuery: "Mars planet Curiosity",
    kidFact: "El planeta rojo. Tiene el volcán más alto del sistema solar.",
    details: [
      "Distancia media al Sol: 227,9 millones de km.",
      "Un año marciano dura 687 días terrestres.",
      "Olympus Mons es un volcán de unos 22 km de alto.",
      "NASA explora Marte con robots como Curiosity y Perseverance.",
    ],
  },
  {
    id: "ceres",
    name: "Ceres",
    kind: "dwarf",
    color: "#b7a99a",
    au: 2.77,
    periodDays: 1_680,
    longitudeJ2000: 0,
    visualSize: 9,
    diameterKm: 946,
    moons: "0",
    imageQuery: "Ceres dwarf planet Dawn",
    kidFact: "Un planeta enano en el cinturón de asteroides, entre Marte y Júpiter.",
    details: [
      "Ceres es el objeto más grande del cinturón de asteroides.",
      "NASA lo visitó con la misión Dawn.",
      "Mide unos 946 km de diámetro.",
      "Es un planeta enano, como Plutón: redondo, pero no es uno de los 8 planetas.",
    ],
  },
  {
    id: "jupiter",
    name: "Júpiter",
    kind: "planet",
    color: "#d9b07c",
    au: 5.203,
    periodDays: 4_331,
    longitudeJ2000: 34.4,
    visualSize: 34,
    diameterKm: 142_984,
    moons: "más de 90",
    imageQuery: "Jupiter planet Juno NASA",
    kidFact: "El más grande. Su Gran Mancha Roja es una tormenta más ancha que la Tierra.",
    details: [
      "Distancia media al Sol: 778,6 millones de km.",
      "Un año: unos 12 años terrestres.",
      "Es un gigante de gas: no tiene suelo sólido como el nuestro.",
      "NASA lo estudia con Juno. Tiene muchas lunas; las más famosas son Ío, Europa, Ganímedes y Calisto.",
    ],
  },
  {
    id: "saturn",
    name: "Saturno",
    kind: "planet",
    color: "#e6d09a",
    au: 9.537,
    periodDays: 10_747,
    longitudeJ2000: 50.08,
    visualSize: 30,
    diameterKm: 120_536,
    moons: "más de 140",
    imageQuery: "Saturn rings Cassini NASA",
    kidFact: "Sus anillos son de hielo y roca. Se ven muy bien en las fotos de NASA.",
    details: [
      "Distancia media al Sol: 1.434 millones de km.",
      "Un año: unos 29 años terrestres.",
      "Los anillos tienen miles de km de ancho, pero son muy finos.",
      "La misión Cassini de NASA orbitó Saturno durante 13 años.",
    ],
  },
  {
    id: "uranus",
    name: "Urano",
    kind: "planet",
    color: "#9fd6de",
    au: 19.191,
    periodDays: 30_589,
    longitudeJ2000: 314.05,
    visualSize: 22,
    diameterKm: 51_118,
    moons: "28",
    imageQuery: "Uranus Voyager NASA",
    kidFact: "Gira de lado, como una pelota rodando. Es de un azul verdoso suave.",
    details: [
      "Distancia media al Sol: 2.873 millones de km.",
      "Un año: unos 84 años terrestres.",
      "Su eje está muy inclinado: parece tumbarse al girar.",
      "Voyager 2 de NASA es la única nave que lo ha visitado de cerca.",
    ],
  },
  {
    id: "neptune",
    name: "Neptuno",
    kind: "planet",
    color: "#5b7fd6",
    au: 30.069,
    periodDays: 59_800,
    longitudeJ2000: 304.35,
    visualSize: 21,
    diameterKm: 49_528,
    moons: "16",
    imageQuery: "Neptune Voyager NASA",
    kidFact: "El más lejano de los 8 planetas. Allí el viento sopla muy rápido.",
    details: [
      "Distancia media al Sol: 4.495 millones de km.",
      "Un año: unos 165 años terrestres.",
      "Es un gigante de hielo, de color azul.",
      "También lo visitó Voyager 2, en 1989.",
    ],
  },
  {
    id: "pluto",
    name: "Plutón",
    kind: "dwarf",
    color: "#c4a394",
    au: 39.482,
    periodDays: 90_560,
    longitudeJ2000: 238.93,
    visualSize: 9,
    diameterKm: 2_377,
    moons: "5",
    imageQuery: "Pluto New Horizons NASA",
    kidFact: "Un planeta enano. NASA lo fotografió de cerca con New Horizons.",
    details: [
      "Está más lejos que Neptuno la mayor parte del tiempo.",
      "En 2006 los astrónomos lo clasificaron como planeta enano.",
      "Tiene un corazón de hielo famoso en las fotos de New Horizons (2015).",
      "Su luna más grande se llama Caronte.",
    ],
  },
];

export const EXPLORE_ORDER = SPACE_BODIES.map((body) => body.id);

const J2000_MS = Date.UTC(2000, 0, 1, 12);

export function daysSinceJ2000(now = new Date()): number {
  return (now.getTime() - J2000_MS) / 86_400_000;
}

export function bodyAngleDeg(body: SpaceBody, now = new Date()): number {
  if (body.periodDays <= 0) return 0;
  const days = daysSinceJ2000(now);
  return ((body.longitudeJ2000 + (360 * days) / body.periodDays) % 360 + 360) % 360;
}

/** Visual orbit radius. Not to scale — inner worlds need room, outer worlds must stay on the map. */
export function orbitRadius(au: number): number {
  if (au <= 0) return 0;
  const visual: Record<number, number> = {
    0.387: 86,
    0.723: 118,
    1: 152,
    1.524: 188,
    2.77: 228,
    5.203: 272,
    9.537: 318,
    19.191: 358,
    30.069: 396,
    39.482: 434,
  };
  if (visual[au]) return visual[au];
  return 70 + Math.sqrt(au / 40) * 360;
}

export function polarPoint(cx: number, cy: number, radius: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

export function kindLabel(kind: BodyKind): string {
  if (kind === "star") return "Estrella";
  if (kind === "planet") return "Planeta";
  if (kind === "dwarf") return "Planeta enano";
  return "Luna";
}
