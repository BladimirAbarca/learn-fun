"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

type Door = {
  id: string;
  title: string;
  blurb: string;
  className: string;
  href?: string;
  open: boolean;
};

const DOORS: Door[] = [
  {
    id: "space",
    title: "Espacio",
    blurb: "Planetas, asteroides y el cielo de verdad.",
    className: "space",
    href: "/espacio",
    open: true,
  },
  {
    id: "ocean",
    title: "Océano",
    blurb: "El mar profundo y sus criaturas.",
    className: "ocean",
    open: false,
  },
  {
    id: "forest",
    title: "Bosque",
    blurb: "Árboles, animales y caminos verdes.",
    className: "forest",
    open: false,
  },
  {
    id: "numbers",
    title: "Números",
    blurb: "Juegos suaves para contar y comparar.",
    className: "numbers",
    open: false,
  },
  {
    id: "stories",
    title: "Cuentos",
    blurb: "Historias cortas para leer juntos.",
    className: "stories",
    open: false,
  },
];

export default function Hub() {
  const router = useRouter();
  const [locked, setLocked] = useState<Door | null>(null);
  const [entering, setEntering] = useState<Door | null>(null);
  const [phase, setPhase] = useState<"shut" | "swing" | "through" | "blocked">("shut");
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!locked) return;
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setLocked(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked]);

  useEffect(() => {
    if (!entering) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      if (entering.open && entering.href) router.push(entering.href);
      else setLocked(entering);
      setEntering(null);
      return;
    }
    const opens = Boolean(entering.open && entering.href);
    setPhase(opens ? "shut" : "blocked");
    const start = window.requestAnimationFrame(() => {
      if (opens) window.requestAnimationFrame(() => setPhase("swing"));
    });
    const openTimer = window.setTimeout(() => {
      if (opens) setPhase("through");
    }, 720);
    const doneTimer = window.setTimeout(() => {
      if (opens && entering.href) router.push(entering.href);
      else {
        setLocked(entering);
        setEntering(null);
      }
    }, opens ? 1450 : 700);
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !entering.open) {
        setEntering(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(start);
      window.clearTimeout(openTimer);
      window.clearTimeout(doneTimer);
      window.removeEventListener("keydown", onKey);
    };
  }, [entering, router]);

  function enter(door: Door) {
    if (entering) return;
    setLocked(null);
    setEntering(door);
  }

  return (
    <main className="hub" id="contenido">
      <div className="stars" aria-hidden="true" />
      <div className="hub-inner">
        <p className="kicker">Aprende y Juega</p>
        <h1>Elige una puerta y entra a un mundo</h1>
        <p className="lead">
          Hoy puedes visitar el espacio, con datos reales de NASA. Las otras puertas se están
          decorando: pronto se abrirán.
        </p>
        <p className="help">Toca una puerta, o usa Tab y Enter. Las flechas también sirven.</p>

        <div
          className="doors"
          role="list"
          onKeyDown={(event) => {
            const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button.door-control"));
            const index = items.indexOf(document.activeElement as HTMLElement);
            if (index < 0) return;
            if (event.key === "ArrowRight" || event.key === "ArrowDown") {
              event.preventDefault();
              items[(index + 1) % items.length]?.focus();
            }
            if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
              event.preventDefault();
              items[(index - 1 + items.length) % items.length]?.focus();
            }
          }}
        >
          {DOORS.map((door) => (
            <div key={door.id} role="listitem" className="door-slot">
              <button
                type="button"
                className={`door-control ${door.className}${door.open ? "" : " locked"}`}
                aria-haspopup={door.open ? undefined : "dialog"}
                onClick={() => enter(door)}
              >
                <Doorway name={door.id} className={door.className} />
                <span className="sr-only">{door.open ? `Entrar a ${door.title}` : `${door.title}, aún cerrado`}</span>
              </button>
              <div className="door-caption">
                <span className={`badge${door.open ? " play" : ""}`}>{door.open ? "Jugar" : "Pronto"}</span>
                <h2>{door.title}</h2>
                <p>{door.blurb}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="footnote">Hecho para niños. Sin cuentas y sin miedo: solo curiosidad.</p>
      </div>

      {entering ? (
        <div className={`enter-stage ${phase} ${entering.className}`} aria-hidden="true">
          <div className={`enter-world ${entering.className}`}>
            <DoorScene name={entering.id} />
          </div>
          <div className="enter-frame">
            <Doorway name={entering.id} className={entering.className} leafClass="enter-leaf" />
          </div>
        </div>
      ) : null}

      {locked ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setLocked(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={titleId}>{locked.title} aún está cerrado</h2>
            <p>
              Esta puerta se ve bonita a propósito: hay más mundos por desbloquear. Por ahora, entra
              a Espacio. ¡Ahí sí se puede jugar!
            </p>
            <button ref={closeRef} className="icon-btn" type="button" onClick={() => setLocked(null)}>
              Entendido
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Doorway({ name, className, leafClass = "" }: { name: string; className: string; leafClass?: string }) {
  return (
    <span className={`door-frame ${className}`} aria-hidden="true">
      <span className={`door-leaf ${leafClass}`}>
        <span className="door-window">
          <DoorScene name={name} />
        </span>
        <span className="door-panels" aria-hidden="true">
          <span />
          <span />
        </span>
        <span className="door-knob" aria-hidden="true" />
      </span>
    </span>
  );
}

function DoorScene({ name }: { name: string }) {
  return <span className={`door-scene ${name}`}>{name === "numbers" ? <b>123</b> : null}</span>;
}
