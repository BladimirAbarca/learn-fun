"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { CLOSEUPS } from "@/lib/closeup";
import { moonHasOwnModel } from "@/lib/nasaModels";
import { EXPLORE_ORDER, SPACE_BODIES, kindLabel } from "@/lib/planets";
import { CONSTELLATIONS, bodyAltAz, localSiderealTime, raDecToAltAz } from "@/lib/sky";
import SpaceGallery from "@/components/SpaceGallery";

const SpaceScene = dynamic(() => import("@/components/SpaceScene"), {
  ssr: false,
  loading: () => <div className="space-fallback">Abriendo el espacio…</div>,
});

const PlanetCloseup = dynamic(() => import("@/components/PlanetCloseup"), {
  ssr: false,
  loading: () => <div className="space-fallback">Acercando el planeta…</div>,
});
import type { ApodResponse, DebrisResponse, ImagesResponse, NeoResponse } from "@/lib/types";

type Selection =
  | { type: "body"; id: string }
  | { type: "neo"; id: string }
  | { type: "debris"; id: string }
  | { type: "constellation"; id: string };

function formatKm(km: number): string {
  if (km >= 1_000_000) return `${(km / 1_000_000).toFixed(1)} millones de km`;
  if (km >= 1_000) return `${Math.round(km / 1_000)} mil km`;
  return `${Math.round(km)} km`;
}

export default function SpaceExplorer() {
  const [selection, setSelection] = useState<Selection>({ type: "body", id: "earth" });
  const [picked, setPicked] = useState(false);
  const [showAsteroids, setShowAsteroids] = useState(true);
  const [showDebris, setShowDebris] = useState(true);
  const [showConstellations, setShowConstellations] = useState(true);
  const [neo, setNeo] = useState<NeoResponse | null>(null);
  const [debris, setDebris] = useState<DebrisResponse | null>(null);
  const [apod, setApod] = useState<ApodResponse | null>(null);
  const [images, setImages] = useState<ImagesResponse | null>(null);
  const [overviewToken, setOverviewToken] = useState(0);
  const [zoomToken, setZoomToken] = useState(0);
  const [closeupId, setCloseupId] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [belowHorizon, setBelowHorizon] = useState(false);
  const [when, setWhen] = useState(() => new Date());
  const [playing, setPlaying] = useState(false);
  const [aimToken, setAimToken] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [neoRes, debrisRes, apodRes] = await Promise.all([
          fetch("/api/nasa/neo").then((r) => r.json()) as Promise<NeoResponse>,
          fetch("/api/space/debris").then((r) => r.json()) as Promise<DebrisResponse>,
          fetch("/api/nasa/apod").then((r) => r.json()) as Promise<ApodResponse>,
        ]);
        if (cancelled) return;
        setNeo(neoRes);
        setDebris(debrisRes);
        setApod(apodRes);
        fetch("/api/nasa/images")
          .then((r) => r.json() as Promise<ImagesResponse>)
          .then((imageRes) => {
            if (!cancelled) setImages(imageRes);
          })
          .catch(() => {
            if (!cancelled) {
              setImages({
                source: "error",
                byId: {},
                message: "Las fotos de NASA no cargaron. Los planetas siguen aquí con sus datos.",
              });
            }
          });
      } catch {
        if (!cancelled) {
          setNeo({
            source: "error",
            fetchedAt: new Date().toISOString(),
            rocks: [],
            message: "No pudimos hablar con NASA ahora. Los planetas siguen aquí.",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedId = useMemo(() => {
    if (selection.type === "body") return selection.id;
    if (selection.type === "neo") return `neo-${selection.id}`;
    if (selection.type === "constellation") return `con-${selection.id}`;
    return `deb-${selection.id}`;
  }, [selection]);

  const cycle = useCallback(
    (dir: 1 | -1) => {
      const ids = EXPLORE_ORDER;
      const index = ids.indexOf(selection.type === "body" ? selection.id : "earth");
      const next = ids[(index + dir + ids.length) % ids.length];
      setPicked(true);
      setSelection({ type: "body", id: next });
      setCloseupId((current) => (current && CLOSEUPS[current] ? next : current));
    },
    [selection],
  );

  const approach = useCallback((id: string) => {
    setPicked(true);
    if (id.startsWith("neo:")) {
      setSelection({ type: "neo", id: id.slice(4) });
      setCloseupId(id);
      return;
    }
    if (id.startsWith("craft:")) {
      setSelection({ type: "debris", id: id.slice(6) });
      setCloseupId(id);
      return;
    }
    setSelection({ type: "body", id });
    setCloseupId(id);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (galleryOpen) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        cycle(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        cycle(-1);
      } else if (event.key === "Escape") {
        if (galleryOpen) {
          event.preventDefault();
          setGalleryOpen(false);
          return;
        }
        if (closeupId) {
          event.preventDefault();
          setCloseupId(null);
          return;
        }
        router.push("/");
      } else if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        setCloseupId(null);
        setOverviewToken((n) => n + 1);
      } else if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        setZoomToken((n) => n + 1);
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        setZoomToken((n) => n - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cycle, closeupId, galleryOpen, router]);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.5, (now - last) / 1000);
      last = now;
      setWhen((current) => new Date(current.getTime() + dt * 5 * 60 * 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, [playing]);

  useEffect(() => {
    if (!closeupId) return;
    if (closeupId.startsWith("neo:")) {
      if (selection.type !== "neo" || `neo:${selection.id}` !== closeupId) setCloseupId(null);
      return;
    }
    if (closeupId.startsWith("craft:")) {
      if (selection.type !== "debris" || `craft:${selection.id}` !== closeupId) setCloseupId(null);
      return;
    }
    if (selection.type !== "body" || selection.id !== closeupId) setCloseupId(null);
  }, [selection, closeupId]);

  const body = SPACE_BODIES.find((item) => item.id === (selection.type === "body" ? selection.id : ""));
  const constellation = CONSTELLATIONS.find((item) => selection.type === "constellation" && item.id === selection.id);
  const constellationBelow = constellation
    ? constellation.stars.every((star) => raDecToAltAz(star.ra, star.dec, localSiderealTime(when)).alt < 0.04)
    : false;

  useEffect(() => {
    if (!body || body.id === "earth") {
      setBelowHorizon(false);
      return;
    }
    setBelowHorizon(bodyAltAz(body, localSiderealTime(when), when).alt < 0.02);
  }, [body, when]);

  useEffect(() => {
    setGalleryOpen(false);
  }, [selection.type, selection.type === "body" ? selection.id : ""]);
  const rock = neo?.rocks.find((item) => selection.type === "neo" && item.id === selection.id);
  const piece = debris?.pieces.find((item) => selection.type === "debris" && item.id === selection.id);
  const photo = body ? images?.byId[body.id] : undefined;

  function selectMapId(id: string) {
    setPicked(true);
    if (id.startsWith("neo-")) {
      setSelection({ type: "neo", id: id.slice(4) });
      return;
    }
    if (id.startsWith("deb-")) {
      setSelection({ type: "debris", id: id.slice(4) });
      return;
    }
    setSelection({ type: "body", id });
  }

  return (
    <main className="hub space-app" id="contenido">
      <div className="stars" aria-hidden="true" />
      <div className="space-app-inner">
        <div className="space-top">
          <Link className="back" href="/">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 3.2 3 11h2.2v8.2h5.1v-5.1h3.4v5.1h5.1V11H21L12 3.2Z"
              />
            </svg>
            Volver al inicio
          </Link>
          <div>
            <p className="kicker">Mundo abierto</p>
            <h1>El cielo</h1>
            <p className="help space-help">
              {closeupId
                ? "Arrastra para mirar alrededor. Rueda o pellizca para acercarte. Flechas: otro mundo. Esc: volver a la vista."
                : "Miras el cielo desde el suelo. Elige una hora con los botones: el cielo empieza a avanzar desde ahí."}
            </p>
          </div>
        </div>

        {neo?.message ? <div className="banner">{neo.message}</div> : null}
        {debris?.message ? <div className="banner">{debris.message}</div> : null}
        {images?.message ? <div className="banner">{images.message}</div> : null}

        <div className="space-stage">
          <div className="map-wrap immersive">
            {closeupId ? (
              <PlanetCloseup key={closeupId} target={closeupId} zoomToken={zoomToken} />
            ) : (
              <SpaceScene
                selectedId={selectedId}
                onSelect={selectMapId}
                onApproach={approach}
                showAsteroids={showAsteroids}
                showDebris={showDebris}
                showConstellations={showConstellations}
                rocks={neo?.rocks ?? []}
                debris={debris?.pieces ?? []}
                overviewToken={overviewToken}
                zoomToken={zoomToken}
                when={when}
                aimToken={aimToken}
              />
            )}
            <SkyFilters
              bodies={SPACE_BODIES}
              rocks={neo?.rocks ?? []}
              debris={debris?.pieces ?? []}
              selected={picked ? selection : { type: "body", id: "" }}
              showLayers={!closeupId}
              showConstellations={showConstellations}
              showAsteroids={showAsteroids}
              showDebris={showDebris}
              onToggleConstellations={() => setShowConstellations((value) => !value)}
              onToggleAsteroids={() => setShowAsteroids((value) => !value)}
              onToggleDebris={() => setShowDebris((value) => !value)}
              onBody={(id) => {
                setPicked(true);
                setSelection({ type: "body", id });
              }}
              onRock={(id) => {
                setPicked(true);
                setShowAsteroids(true);
                setSelection({ type: "neo", id });
              }}
              onDebris={(id) => {
                setPicked(true);
                setShowDebris(true);
                setSelection({ type: "debris", id });
              }}
              onConstellation={(id) => {
                setPicked(true);
                setCloseupId(null);
                setShowConstellations(true);
                setAimToken((n) => n + 1);
                setSelection({ type: "constellation", id });
              }}
            />
            <div className="space-hud">
              {!closeupId ? (
                <SkyClockControl
                  when={when}
                  playing={playing}
                  onShift={(ms) => {
                    setPlaying(true);
                    setAimToken((n) => n + 1);
                    setWhen((current) => new Date(current.getTime() + ms));
                  }}
                  onNow={() => {
                    setPlaying(false);
                    setAimToken((n) => n + 1);
                    setWhen(new Date());
                  }}
                  onToggle={() => setPlaying((value) => !value)}
                />
              ) : null}
              <div className="legend">
                {closeupId ? (
                  <button type="button" className="chip accent" onClick={() => setCloseupId(null)}>
                    Volver a la vista
                  </button>
                ) : null}
                {picked && (body || rock || piece) && !closeupId ? (
                  <button
                    type="button"
                    className="chip accent"
                    onClick={() => {
                      if (body) approach(body.id);
                      else if (rock) approach(`neo:${rock.id}`);
                      else if (piece) approach(`craft:${piece.id}`);
                    }}
                  >
                    Ver de cerca
                  </button>
                ) : null}
                <button type="button" className="earth-home" aria-label="Ver la Tierra" onClick={() => approach("earth")} />
              </div>
              <p className="credit hud-credit">
                {closeupId
                  ? "Modelo 3D de NASA. El giro y las órbitas van más rápido que en la realidad, y las lunas se ven más grandes para notar cómo suben y bajan."
                  : "Cielo desde donde estás. Toca el planeta para salir del suelo y ver la Tierra."}
              </p>
            </div>
          </div>

          <aside className="panel" aria-live="polite">
            {loading && !neo ? <p>Cargando datos de NASA…</p> : null}

            {!picked ? <p>Elige un astro de la lista para ver su ficha.</p> : null}

            {picked && body ? (
              <>
                {photo ? (
                  // NASA CDN URLs from images-api.nasa.gov
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo.url} alt={photo.title} />
                ) : (
                  <div
                    style={{
                      height: 180,
                      borderRadius: 18,
                      background: body.color,
                    }}
                    aria-hidden="true"
                  />
                )}
                <p className="kind">{kindLabel(body.kind)}</p>
                <h2>{body.name}</h2>
                <div className="panel-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => (closeupId === body.id ? setCloseupId(null) : approach(body.id))}
                  >
                    {closeupId === body.id ? "Volver a la vista" : "Ver de cerca en 3D"}
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-pressed={galleryOpen}
                    onClick={() => setGalleryOpen((open) => !open)}
                  >
                    Galería
                  </button>
                </div>
                {closeupId === body.id ? (
                  <>
                    <p>{CLOSEUPS[body.id]?.summary}</p>
                    {CLOSEUPS[body.id]?.moons.length ? (
                      <ul>
                        {CLOSEUPS[body.id].moons.map((moon) => (
                          <li key={moon.name}>{moon.name} orbita alrededor, subiendo y bajando.</li>
                        ))}
                      </ul>
                    ) : (
                      <p>No tiene lunas grandes. Igual puedes ver cómo gira.</p>
                    )}
                    {CLOSEUPS[body.id]?.moons.some((moon) => !moonHasOwnModel(moon.name)) ? (
                      <p>
                        Las lunas pequeñas que NASA no publicó por separado usan el modelo de una luna
                        parecida, de hielo o de roca.
                      </p>
                    ) : null}
                  </>
                ) : null}
                {belowHorizon ? (
                  <p>Ahora está bajo el horizonte. En el cielo queda marcado en esa dirección, justo sobre el suelo.</p>
                ) : null}
                <p>{body.kidFact}</p>
                <ul>
                  {body.details.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                {photo ? <p className="credit">Foto: {photo.credit}. NASA Image Library.</p> : null}
                <p className="credit">
                  Hechos: NASA Planetary Fact Sheet (NSSDC). Modelo 3D: NASA Solar System Exploration.
                </p>
              </>
            ) : null}

            {picked && constellation ? (
              <>
                <p className="kind">Constelación</p>
                <h2>{constellation.name}</h2>
                <p>
                  Las líneas unen estrellas brillantes para reconocer la figura. No son un camino real en el cielo.
                </p>
                {constellationBelow ? (
                  <p>Ahora esa figura está bajo el horizonte. Cambia la hora para buscarla.</p>
                ) : (
                  <p>Las estrellas que están sobre el horizonte aparecen con su nombre.</p>
                )}
                <ul>
                  {constellation.stars.map((star) => (
                    <li key={star.name}>{star.name}</li>
                  ))}
                </ul>
                <p className="credit">
                  Posiciones de las estrellas: coordenadas J2000 publicadas. Sirve para reconocer la figura, no para
                  apuntar un telescopio al minuto.
                </p>
              </>
            ) : null}

            {picked && rock ? (
              <>
                <p className="kind">Asteroide cercano</p>
                <h2>{rock.name}</h2>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() =>
                    closeupId === `neo:${rock.id}` ? setCloseupId(null) : approach(`neo:${rock.id}`)
                  }
                >
                  {closeupId === `neo:${rock.id}` ? "Volver a la vista" : "Ver de cerca en 3D"}
                </button>
                {closeupId === `neo:${rock.id}` ? (
                  <p>
                    La forma es el asteroide Bennu, medido por OSIRIS-REx de NASA. El nombre y los
                    números son de esta roca.
                  </p>
                ) : null}
                <p>
                  NASA vigila esta roca porque se acerca a la Tierra. Pasa muy lejos de nosotros: a{" "}
                  {rock.missLunar.toFixed(0)} veces la distancia a la Luna ({formatKm(rock.missKm)}).
                </p>
                <ul>
                  {rock.diameterMaxM > 0 ? (
                    <li>
                      Tamaño estimado: {Math.round(rock.diameterMinM)} a {Math.round(rock.diameterMaxM)}{" "}
                      metros.
                    </li>
                  ) : (
                    <li>JPL publicó la distancia y la velocidad. En esta lista no viene un tamaño medido.</li>
                  )}
                  <li>Velocidad: {Math.round(rock.speedKmh).toLocaleString("es")} km/h.</li>
                  <li>Fecha de paso cercano: {rock.approachDate}.</li>
                  {rock.watchedClosely ? (
                    <li>NASA la observa con más atención porque su camino pasa más cerca que otras.</li>
                  ) : null}
                </ul>
                <p className="credit">
                  {neo?.catalog === "jpl"
                    ? "Fuente: NASA/JPL Close Approach Data. No hay peligro para ti en casa."
                    : "Fuente: NASA NeoWs. No hay peligro para ti en casa."}
                </p>
              </>
            ) : null}

            {picked && piece ? (
              <>
                <p className="kind">
                  {piece.kind === "station" ? "Estación espacial" : "Satélite cerca de la Tierra"}
                </p>
                <h2>{piece.name}</h2>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() =>
                    closeupId === `craft:${piece.id}` ? setCloseupId(null) : approach(`craft:${piece.id}`)
                  }
                >
                  {closeupId === `craft:${piece.id}` ? "Volver a la vista" : "Ver de cerca en 3D"}
                </button>
                {closeupId === `craft:${piece.id}` && piece.id !== "25544" && piece.id !== "20580" ? (
                  <p>
                    NASA no publicó un modelo 3D de este satélite en esa galería. Se muestra una nave
                    con paneles, para ver cómo es un satélite de cerca.
                  </p>
                ) : null}
                <p>
                  {piece.kind === "station"
                    ? "Es una estación real que orbita la Tierra. En el cielo se mueve para que la veas."
                    : "Es un satélite real. En el cielo se mueve con su ritmo de órbita publicado, para verlo, no en el punto exacto de este minuto."}
                </p>
                <ul>
                  <li>Vueltas al día (aprox.): {piece.meanMotion.toFixed(1)}.</li>
                  <li>Inclinación de la órbita: {piece.inclination.toFixed(0)}°.</li>
                  {piece.altitudeKm ? (
                    <li>Altura ahora: unos {Math.round(piece.altitudeKm)} km sobre la Tierra.</li>
                  ) : null}
                </ul>
                <p className="credit">
                  {piece.id === "25544"
                    ? "Altura de ahora: Where The ISS At. Catálogo NORAD 25544."
                    : `Catálogo NORAD ${piece.id}. El ritmo de órbita es el publicado, no el punto exacto de este minuto.`}
                </p>
              </>
            ) : null}

            <div className="apod">
              <p className="kind">Foto del cielo de hoy</p>
              {apod?.card ? (
                <>
                  {/* NASA APOD CDN */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={apod.card.imageUrl} alt={apod.card.alt || apod.card.title} />
                  <h2 style={{ fontSize: "1.2rem" }}>{apod.card.title}</h2>
                  <p>Una foto real que NASA eligió para hoy. {apod.card.alt}</p>
                  <p className="credit">
                    {apod.card.credit} · NASA APOD · {apod.card.date}
                  </p>
                </>
              ) : (
                <p>{apod?.message || "Buscando la foto de NASA…"}</p>
              )}
            </div>
          </aside>
          {galleryOpen && body ? (
            <SpaceGallery bodyId={body.id} bodyName={body.name} onClose={() => setGalleryOpen(false)} />
          ) : null}
        </div>
      </div>
    </main>
  );
}

function SkyClockControl({
  when,
  playing,
  onShift,
  onNow,
  onToggle,
}: {
  when: Date;
  playing: boolean;
  onShift: (ms: number) => void;
  onNow: () => void;
  onToggle: () => void;
}) {
  const hour = when.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  const day = when.toLocaleDateString("es", { day: "2-digit", month: "short" });
  return (
    <div className="sky-clock">
      <span>Hora del cielo</span>
      <div className="sky-clock-row">
        <button type="button" onClick={() => onShift(-24 * 60 * 60 * 1000)}>
          −1 día
        </button>
        <button type="button" onClick={() => onShift(-60 * 60 * 1000)}>
          −1 h
        </button>
        <button type="button" onClick={() => onShift(-10 * 60 * 1000)}>
          −10 min
        </button>
        <strong>
          {day}
          <br />
          {hour}
        </strong>
        <button type="button" onClick={() => onShift(10 * 60 * 1000)}>
          +10 min
        </button>
        <button type="button" onClick={() => onShift(60 * 60 * 1000)}>
          +1 h
        </button>
        <button type="button" onClick={() => onShift(24 * 60 * 60 * 1000)}>
          +1 día
        </button>
      </div>
      <div className="sky-clock-row">
        <button type="button" onClick={onNow}>
          Ahora
        </button>
        <button type="button" className="chip accent" onClick={onToggle}>
          {playing ? "Pausa" : "Mover"}
        </button>
      </div>
      <span>{playing ? "El cielo avanza desde esta hora." : "Elige una hora y el cielo se mueve solo."}</span>
    </div>
  );
}

function AccordionSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="sky-acc">
      <button type="button" className="sky-acc-head" aria-expanded={open} onClick={onToggle}>
        <span>{title}</span>
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open ? children : null}
    </div>
  );
}

function SkyFilters({
  bodies,
  rocks,
  debris,
  onBody,
  onRock,
  onDebris,
  onConstellation,
  selected,
  showLayers,
  showConstellations,
  showAsteroids,
  showDebris,
  onToggleConstellations,
  onToggleAsteroids,
  onToggleDebris,
}: {
  bodies: { id: string; name: string }[];
  rocks: NeoResponse["rocks"];
  debris: DebrisResponse["pieces"];
  onBody: (id: string) => void;
  onRock: (id: string) => void;
  onDebris: (id: string) => void;
  onConstellation: (id: string) => void;
  selected: Selection;
  showLayers: boolean;
  showConstellations: boolean;
  showAsteroids: boolean;
  showDebris: boolean;
  onToggleConstellations: () => void;
  onToggleAsteroids: () => void;
  onToggleDebris: () => void;
}) {
  const [sections, setSections] = useState({
    layers: false,
    constellations: false,
    planets: false,
    rocks: false,
    craft: false,
  });

  function toggleSection(key: keyof typeof sections) {
    setSections((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <aside className="sky-filters" aria-label="Rocas y objetos que se mueven">
      <h2 className="sky-filters-title">Rocas y objetos que se mueven</h2>
      <p className="sky-filters-note">
        Toca un grupo para guardarlo. Toca un nombre para mirarlo en el cielo.
      </p>
      <div className="sky-filter-scroll">
        {showLayers ? (
          <AccordionSection title="Ver en el cielo" open={sections.layers} onToggle={() => toggleSection("layers")}>
            <button
              type="button"
              className="sky-filter"
              aria-pressed={showConstellations}
              onClick={onToggleConstellations}
            >
              Constelaciones
            </button>
            <button type="button" className="sky-filter" aria-pressed={showAsteroids} onClick={onToggleAsteroids}>
              Asteroides NASA
            </button>
            <button type="button" className="sky-filter" aria-pressed={showDebris} onClick={onToggleDebris}>
              Cerca de la Tierra
            </button>
          </AccordionSection>
        ) : null}
        <AccordionSection title="Constelaciones" open={sections.constellations} onToggle={() => toggleSection("constellations")}>
          {CONSTELLATIONS.map((group) => (
            <button
              key={group.id}
              type="button"
              className="sky-filter constellation"
              aria-pressed={selected.type === "constellation" && selected.id === group.id}
              onClick={() => onConstellation(group.id)}
            >
              {group.name}
            </button>
          ))}
        </AccordionSection>
        <AccordionSection title="Planetas y el Sol" open={sections.planets} onToggle={() => toggleSection("planets")}>
          {bodies.map((body) => (
            <button
              key={body.id}
              type="button"
              className="sky-filter planet"
              aria-pressed={selected.type === "body" && selected.id === body.id}
              onClick={() => onBody(body.id)}
            >
              {body.name}
            </button>
          ))}
        </AccordionSection>
        <AccordionSection title="Asteroides" open={sections.rocks} onToggle={() => toggleSection("rocks")}>
          {rocks.length === 0 ? (
            <p className="sky-filters-note">
              Si no ves nombres, espera un momento. Los planetas no necesitan internet.
            </p>
          ) : (
            rocks.map((rock) => (
              <button
                key={rock.id}
                type="button"
                className="sky-filter rock"
                aria-pressed={selected.type === "neo" && selected.id === rock.id}
                onClick={() => onRock(rock.id)}
              >
                {rock.name}
              </button>
            ))
          )}
        </AccordionSection>
        <AccordionSection title="Cerca de la Tierra" open={sections.craft} onToggle={() => toggleSection("craft")}>
          {debris.map((piece) => (
            <button
              key={piece.id}
              type="button"
              className="sky-filter craft"
              aria-pressed={selected.type === "debris" && selected.id === piece.id}
              onClick={() => onDebris(piece.id)}
            >
              {piece.name}
            </button>
          ))}
        </AccordionSection>
      </div>
    </aside>
  );
}
