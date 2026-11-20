"use client";

import { useEffect, useState } from "react";
import type { GalleryImage, GalleryResponse } from "@/lib/types";

type Props = {
  bodyId: string;
  bodyName: string;
  onClose: () => void;
};

function spokenName(bodyId: string, bodyName: string): string {
  if (bodyId === "earth") return "la Tierra";
  if (bodyId === "moon") return "la Luna";
  if (bodyId === "sun") return "el Sol";
  return bodyName;
}

export default function SpaceGallery({ bodyId, bodyName, onClose }: Props) {
  const name = spokenName(bodyId, bodyName);
  const [images, setImages] = useState<GalleryImage[] | null>(null);
  const [message, setMessage] = useState("");
  const [picked, setPicked] = useState<GalleryImage | null>(null);

  const list = images ?? [];
  const index = picked ? list.findIndex((image) => image.id === picked.id) : -1;

  function showStep(delta: number) {
    if (list.length < 2 || index < 0) return;
    const next = (index + delta + list.length) % list.length;
    setPicked(list[next]);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (picked) setPicked(null);
        else onClose();
        return;
      }
      if (!picked || !images || images.length < 2) return;
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      const current = images.findIndex((image) => image.id === picked.id);
      if (current < 0) return;
      const delta = event.key === "ArrowRight" ? 1 : -1;
      setPicked(images[(current + delta + images.length) % images.length]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images, onClose, picked]);

  useEffect(() => {
    let cancelled = false;
    setImages(null);
    setPicked(null);
    setMessage("");
    fetch(`/api/nasa/gallery?body=${encodeURIComponent(bodyId)}`)
      .then((response) => response.json() as Promise<GalleryResponse>)
      .then((body) => {
        if (cancelled) return;
        setImages(body.images);
        setMessage(body.message ?? "");
      })
      .catch(() => {
        if (!cancelled) {
          setImages([]);
          setMessage(`Las fotos de ${name} no cargaron ahora. Puedes volver a intentar.`);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [bodyId, name]);

  return (
    <div className="sky-gallery" role="dialog" aria-label={`Fotos reales de ${name}`}>
      <div className="sky-gallery-bar">
        <div>
          <h2>Fotos de {name}</h2>
          <p>
            Solo fotos reales de {name}, de la biblioteca de NASA. No hay dibujos. En la escuela se
            pueden mirar si dices que son de NASA.
          </p>
        </div>
        <button type="button" className="chip accent" onClick={onClose}>
          Cerrar
        </button>
      </div>
      {images === null ? <p className="sky-gallery-note">Buscando fotos de NASA…</p> : null}
      {message ? <p className="sky-gallery-note">{message}</p> : null}
      <div className="sky-gallery-grid">
        {(images ?? []).map((image) => (
          <button key={image.id} type="button" onClick={() => setPicked(image)}>
            {/* NASA Image Library, images-assets.nasa.gov */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt={image.summary || image.title} />
            <span>{image.summary}</span>
          </button>
        ))}
      </div>
      {picked ? (
        <div className="sky-lightbox" role="dialog" aria-label={picked.title}>
          <div className="sky-lightbox-nav">
            <button type="button" className="chip" onClick={() => showStep(-1)} disabled={list.length < 2}>
              Anterior
            </button>
            <button type="button" className="chip accent" onClick={() => setPicked(null)}>
              Volver a la galería
            </button>
            <button type="button" className="chip" onClick={() => showStep(1)} disabled={list.length < 2}>
              Siguiente
            </button>
          </div>
          <p className="sky-lightbox-count">
            Foto {index + 1} de {list.length}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={picked.url} alt={picked.summary || picked.title} />
          <h3>{picked.summary}</h3>
          <p>Nombre en la biblioteca de NASA: {picked.title}</p>
          <p>Crédito: {picked.credit}. Biblioteca de imágenes de NASA.</p>
        </div>
      ) : null}
    </div>
  );
}
