export type MoonModel = {
  name: string;
  color: string;
  /** Distance from the planet center, in planet radii. Compressed so the moons fit on screen. */
  distance: number;
  /** Radius relative to the planet. Enlarged so a child can see the moon. */
  scale: number;
  /** Seconds for one visual orbit. Much faster than the real period. */
  period: number;
  /** Degrees above the planet's equator. Exaggerated so the path rises and falls. */
  inclination: number;
  /** 0–1, makes the distance breathe in and out. */
  eccentricity: number;
  /** Starting angle in radians, so moons don't pile up. */
  phase: number;
  retrograde?: boolean;
};

export type RingModel = {
  inner: number;
  outer: number;
  color: string;
  opacity: number;
};

export type CloseupModel = {
  /** Axial tilt in degrees. Uranus is on its side. */
  tilt: number;
  /** Seconds per visual spin. Negative means it rotates backwards. */
  spinSeconds: number;
  roughness: number;
  summary: string;
  rings?: RingModel[];
  moons: MoonModel[];
};

export const CLOSEUPS: Record<string, CloseupModel> = {
  sun: {
    tilt: 7,
    spinSeconds: 18,
    roughness: 1,
    summary: "El Sol gira sobre sí mismo. No tiene lunas: es una estrella.",
    moons: [],
  },
  mercury: {
    tilt: 0.1,
    spinSeconds: 20,
    roughness: 0.95,
    summary: "Mercurio gira despacio. No tiene lunas.",
    moons: [],
  },
  venus: {
    tilt: 3,
    spinSeconds: -24,
    roughness: 0.55,
    summary: "Venus gira al revés que la Tierra. No tiene lunas.",
    moons: [],
  },
  earth: {
    tilt: 23.4,
    spinSeconds: 12,
    roughness: 0.72,
    summary: "La Tierra gira. La Luna sube y baja en su órbita alrededor.",
    moons: [
      {
        name: "Luna",
        color: "#d9d3c5",
        distance: 2.75,
        scale: 0.27,
        period: 11,
        inclination: 8,
        eccentricity: 0.06,
        phase: 0.4,
      },
    ],
  },
  moon: {
    tilt: 6.7,
    spinSeconds: 18,
    roughness: 1,
    summary: "La Luna gira despacio. No tiene lunas propias.",
    moons: [],
  },
  mars: {
    tilt: 25.2,
    spinSeconds: 12.5,
    roughness: 0.9,
    summary: "Marte gira. Fobos da vueltas muy cerca y Deimos un poco más lejos.",
    moons: [
      {
        name: "Fobos",
        color: "#b7a090",
        distance: 1.7,
        scale: 0.09,
        period: 3.4,
        inclination: 6,
        eccentricity: 0.08,
        phase: 0.2,
      },
      {
        name: "Deimos",
        color: "#c4b2a4",
        distance: 2.45,
        scale: 0.07,
        period: 7.5,
        inclination: 12,
        eccentricity: 0.1,
        phase: 2.1,
      },
    ],
  },
  ceres: {
    tilt: 4,
    spinSeconds: 15,
    roughness: 0.95,
    summary: "Ceres gira. No tiene lunas grandes.",
    moons: [],
  },
  jupiter: {
    tilt: 3.1,
    spinSeconds: 6,
    roughness: 0.58,
    summary: "Júpiter gira rápido. Ío, Europa, Ganímedes y Calisto orbitan a su alrededor.",
    moons: [
      {
        name: "Ío",
        color: "#e6c36a",
        distance: 1.75,
        scale: 0.16,
        period: 5.2,
        inclination: 5,
        eccentricity: 0.05,
        phase: 0.3,
      },
      {
        name: "Europa",
        color: "#f3efe4",
        distance: 2.2,
        scale: 0.15,
        period: 7.4,
        inclination: 8,
        eccentricity: 0.04,
        phase: 1.6,
      },
      {
        name: "Ganímedes",
        color: "#c8b49a",
        distance: 2.75,
        scale: 0.2,
        period: 10,
        inclination: 4,
        eccentricity: 0.06,
        phase: 3.1,
      },
      {
        name: "Calisto",
        color: "#8d7b68",
        distance: 3.4,
        scale: 0.17,
        period: 14,
        inclination: 11,
        eccentricity: 0.09,
        phase: 4.4,
      },
    ],
  },
  saturn: {
    tilt: 26.7,
    spinSeconds: 8,
    roughness: 0.55,
    summary: "Saturno gira con sus anillos. Titán y otras lunas orbitan por fuera.",
    rings: [
      { inner: 1.28, outer: 1.72, color: "#e7d7a8", opacity: 0.88 },
      { inner: 1.82, outer: 2.18, color: "#cbb98a", opacity: 0.72 },
    ],
    moons: [
      {
        name: "Encélado",
        color: "#f4f7fb",
        distance: 2.55,
        scale: 0.07,
        period: 6.5,
        inclination: 6,
        eccentricity: 0.05,
        phase: 0.8,
      },
      {
        name: "Dione",
        color: "#e7e2d6",
        distance: 2.95,
        scale: 0.08,
        period: 8.5,
        inclination: 9,
        eccentricity: 0.06,
        phase: 2.4,
      },
      {
        name: "Rea",
        color: "#d9d3c4",
        distance: 3.35,
        scale: 0.09,
        period: 11,
        inclination: 5,
        eccentricity: 0.05,
        phase: 4,
      },
      {
        name: "Titán",
        color: "#e0a85a",
        distance: 4.05,
        scale: 0.22,
        period: 15,
        inclination: 12,
        eccentricity: 0.07,
        phase: 5.2,
      },
    ],
  },
  uranus: {
    tilt: 90,
    spinSeconds: 11,
    roughness: 0.5,
    summary: "Urano está tumbado de lado. Sus lunas giran en ese mismo plano.",
    rings: [{ inner: 1.42, outer: 1.78, color: "#d5eef2", opacity: 0.55 }],
    moons: [
      {
        name: "Miranda",
        color: "#d5d0c8",
        distance: 2.05,
        scale: 0.07,
        period: 5,
        inclination: 7,
        eccentricity: 0.08,
        phase: 0.5,
      },
      {
        name: "Ariel",
        color: "#e4e0d8",
        distance: 2.5,
        scale: 0.08,
        period: 7.2,
        inclination: 4,
        eccentricity: 0.05,
        phase: 1.8,
      },
      {
        name: "Titania",
        color: "#cfc6b8",
        distance: 3.05,
        scale: 0.09,
        period: 10.5,
        inclination: 6,
        eccentricity: 0.06,
        phase: 3.3,
      },
      {
        name: "Oberón",
        color: "#b7aa9c",
        distance: 3.6,
        scale: 0.09,
        period: 13.5,
        inclination: 10,
        eccentricity: 0.07,
        phase: 4.7,
      },
    ],
  },
  neptune: {
    tilt: 28.3,
    spinSeconds: 10,
    roughness: 0.52,
    summary: "Neptuno gira. Tritón da vueltas al revés que la mayoría de las lunas.",
    moons: [
      {
        name: "Proteo",
        color: "#b7b3ae",
        distance: 1.85,
        scale: 0.07,
        period: 4.8,
        inclination: 5,
        eccentricity: 0.06,
        phase: 1,
      },
      {
        name: "Tritón",
        color: "#d5dde8",
        distance: 2.7,
        scale: 0.18,
        period: 9,
        inclination: 18,
        eccentricity: 0.04,
        phase: 2.6,
        retrograde: true,
      },
    ],
  },
  pluto: {
    tilt: 28,
    spinSeconds: 16,
    roughness: 0.88,
    summary: "Plutón gira. Caronte es enorme: casi forman una pareja.",
    moons: [
      {
        name: "Caronte",
        color: "#b7a89a",
        distance: 2.2,
        scale: 0.5,
        period: 10,
        inclination: 6,
        eccentricity: 0.03,
        phase: 0.6,
      },
      {
        name: "Nix",
        color: "#d9d0c4",
        distance: 3.15,
        scale: 0.07,
        period: 13,
        inclination: 10,
        eccentricity: 0.1,
        phase: 2.2,
      },
      {
        name: "Hidra",
        color: "#cfc4b6",
        distance: 3.7,
        scale: 0.07,
        period: 16,
        inclination: 14,
        eccentricity: 0.12,
        phase: 4.1,
      },
    ],
  },
};
