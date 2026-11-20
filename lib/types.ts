export type DataSource = "live" | "sample" | "error";

export type SpaceImage = {
  url: string;
  title: string;
  credit: string;
};

export type NeoRock = {
  id: string;
  name: string;
  diameterMinM: number;
  diameterMaxM: number;
  missKm: number;
  missLunar: number;
  speedKmh: number;
  approachDate: string;
  jplUrl: string;
  watchedClosely: boolean;
};

export type DebrisPiece = {
  id: string;
  name: string;
  meanMotion: number;
  inclination: number;
  meanAnomaly: number;
  kind: "station" | "satellite";
  altitudeKm?: number;
};

export type ApodCard = {
  date: string;
  title: string;
  alt: string;
  imageUrl: string;
  credit: string;
  permalink: string;
};

export type NeoResponse = {
  source: DataSource;
  fetchedAt: string;
  rocks: NeoRock[];
  catalog?: "neows" | "jpl";
  message?: string;
};

export type DebrisResponse = {
  source: DataSource;
  fetchedAt: string;
  pieces: DebrisPiece[];
  message?: string;
};

export type ApodResponse = {
  source: DataSource;
  card: ApodCard | null;
  message?: string;
};

export type ImagesResponse = {
  source: DataSource;
  byId: Record<string, SpaceImage>;
  message?: string;
};

export type GalleryImage = {
  id: string;
  title: string;
  url: string;
  credit: string;
  summary: string;
};

export type GalleryResponse = {
  source: DataSource;
  images: GalleryImage[];
  message?: string;
};
