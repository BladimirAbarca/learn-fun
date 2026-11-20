import { SPACE_BODIES } from "@/lib/planets";
import { bodyWorldPosition } from "@/lib/space3d";
import * as THREE from "three";

const cache = new Map<string, THREE.CanvasTexture>();

function rand(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function limb(ctx: CanvasRenderingContext2D, size: number, strength: number) {
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.2, size / 2, size / 2, size * 0.5);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
}

function speckles(ctx: CanvasRenderingContext2D, size: number, seed: number, count: number, color: string, radius: number) {
  const next = rand(seed);
  ctx.fillStyle = color;
  for (let i = 0; i < count; i += 1) {
    const a = next() * Math.PI * 2;
    const d = Math.sqrt(next()) * size * 0.46;
    const x = size / 2 + Math.cos(a) * d;
    const y = size / 2 + Math.sin(a) * d;
    ctx.beginPath();
    ctx.arc(x, y, radius * (0.4 + next()), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** How much of the Moon is lit, from the same simple orbit used in the sky. 1 = full. */
function moonLitFraction(): number {
  const earth = SPACE_BODIES.find((body) => body.id === "earth");
  const moon = SPACE_BODIES.find((body) => body.id === "moon");
  if (!earth || !moon) return 0.5;
  const e = bodyWorldPosition(earth);
  const m = bodyWorldPosition(moon);
  const mx = m[0] - e[0];
  const my = m[1] - e[1];
  const mz = m[2] - e[2];
  const sx = -e[0];
  const sy = -e[1];
  const sz = -e[2];
  const md = Math.hypot(mx, my, mz) || 1;
  const sd = Math.hypot(sx, sy, sz) || 1;
  const cos = (mx * sx + my * sy + mz * sz) / (md * sd);
  return (1 + Math.min(1, Math.max(-1, cos))) / 2;
}

function paint(id: string, ctx: CanvasRenderingContext2D, size: number) {
  if (id === "sun") {
    const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.02, size / 2, size / 2, size * 0.5);
    g.addColorStop(0, "#fff4c2");
    g.addColorStop(0.42, "#ffb423");
    g.addColorStop(0.78, "#f06a12");
    g.addColorStop(1, "#c43200");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const next = rand(11);
    for (let i = 0; i < 700; i += 1) {
      const a = next() * Math.PI * 2;
      const d = Math.sqrt(next()) * size * 0.46;
      const x = size / 2 + Math.cos(a) * d;
      const y = size / 2 + Math.sin(a) * d;
      const cell = 1.4 + next() * 2.8;
      ctx.fillStyle = next() > 0.55 ? "rgba(255,236,170,0.45)" : "rgba(196,72,8,0.28)";
      ctx.beginPath();
      ctx.ellipse(x, y, cell * (0.7 + next()), cell * (0.45 + next() * 0.4), next() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (id === "mercury" || id === "ceres" || id === "pluto") {
    ctx.fillStyle = id === "pluto" ? "#c4b6a6" : id === "ceres" ? "#b7aa9a" : "#a39890";
    ctx.fillRect(0, 0, size, size);
    speckles(ctx, size, id === "pluto" ? 7 : 3, 90, "rgba(40,32,28,0.55)", 5);
    speckles(ctx, size, 8, 40, "rgba(255,244,230,0.25)", 3);
    limb(ctx, size, 0.5);
    return;
  }
  if (id === "venus") {
    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, "#f3e2b0");
    g.addColorStop(0.5, "#e7d2a0");
    g.addColorStop(1, "#c9b07a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 0.35;
    for (let y = 0; y < size; y += 7) {
      ctx.fillStyle = y % 14 === 0 ? "#fff6d8" : "#c8ad78";
      ctx.fillRect(0, y, size, 3);
    }
    ctx.globalAlpha = 1;
    limb(ctx, size, 0.35);
    return;
  }
  if (id === "earth") {
    ctx.fillStyle = "#1a4f92";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#f7f9fc";
    ctx.fillRect(0, 0, size, size * 0.07);
    ctx.fillRect(0, size * 0.91, size, size * 0.09);
    ctx.fillStyle = "#3f8f4e";
    const lands: [number, number, number, number, number][] = [
      [0.24, 0.4, 0.11, 0.14, 0.5],
      [0.36, 0.46, 0.05, 0.13, 0.2],
      [0.52, 0.34, 0.13, 0.09, -0.4],
      [0.7, 0.58, 0.09, 0.12, 0.6],
      [0.46, 0.66, 0.08, 0.1, 0.3],
    ];
    for (const [x, y, rx, ry, rot] of lands) {
      ctx.beginPath();
      ctx.ellipse(x * size, y * size, rx * size, ry * size, rot, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#c6a56d";
    ctx.beginPath();
    ctx.ellipse(size * 0.57, size * 0.46, size * 0.055, size * 0.035, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.32)";
    ctx.beginPath();
    ctx.ellipse(size * 0.3, size * 0.32, size * 0.1, size * 0.03, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(size * 0.62, size * 0.7, size * 0.12, size * 0.028, -0.3, 0, Math.PI * 2);
    ctx.fill();
    limb(ctx, size, 0.38);
    return;
  }
  if (id === "moon") {
    ctx.fillStyle = "#c5c1b8";
    ctx.fillRect(0, 0, size, size);
    speckles(ctx, size, 4, 70, "rgba(70,68,64,0.7)", 7);
    speckles(ctx, size, 15, 140, "rgba(90,86,80,0.45)", 3);
    const lit = moonLitFraction();
    const shadow = Math.round((1 - lit) * size);
    ctx.fillStyle = "rgba(8,10,16,0.82)";
    ctx.fillRect(0, 0, shadow, size);
    limb(ctx, size, 0.4);
    return;
  }
  if (id === "mars") {
    ctx.fillStyle = "#c4653a";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#8d3b28";
    ctx.beginPath();
    ctx.ellipse(size * 0.42, size * 0.48, size * 0.16, size * 0.1, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f2efe6";
    ctx.fillRect(0, size * 0.08, size, size * 0.07);
    ctx.fillRect(0, size * 0.86, size, size * 0.08);
    speckles(ctx, size, 21, 30, "rgba(60,20,10,0.35)", 2);
    limb(ctx, size, 0.42);
    return;
  }
  if (id === "jupiter") {
    const bands = ["#e6d2b0", "#c9a27a", "#f0e2c8", "#b88862", "#dfc7a4", "#a86b48", "#ead8bc"];
    for (let i = 0; i < bands.length; i += 1) {
      ctx.fillStyle = bands[i];
      ctx.fillRect(0, (size / bands.length) * i, size, size / bands.length + 1);
    }
    ctx.fillStyle = "#c44b3a";
    ctx.beginPath();
    ctx.ellipse(size * 0.62, size * 0.58, size * 0.07, size * 0.045, 0.2, 0, Math.PI * 2);
    ctx.fill();
    limb(ctx, size, 0.38);
    return;
  }
  if (id === "saturn") {
    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, "#f0e2b8");
    g.addColorStop(0.5, "#e4d0a0");
    g.addColorStop(1, "#cbb88a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#b89a6a";
    ctx.fillRect(0, size * 0.35, size, size * 0.06);
    ctx.fillRect(0, size * 0.62, size, size * 0.05);
    ctx.globalAlpha = 1;
    limb(ctx, size, 0.36);
    return;
  }
  if (id === "uranus" || id === "neptune") {
    const g = ctx.createRadialGradient(size * 0.4, size * 0.4, size * 0.1, size / 2, size / 2, size * 0.5);
    g.addColorStop(0, id === "uranus" ? "#d7fff4" : "#8ec4ff");
    g.addColorStop(1, id === "uranus" ? "#6fd0c8" : "#1d4e9a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    limb(ctx, size, 0.4);
    return;
  }
  ctx.fillStyle = "#d9d3c7";
  ctx.fillRect(0, 0, size, size);
  limb(ctx, size, 0.4);
}

export function bodyTexture(id: string): THREE.CanvasTexture {
  const hit = cache.get(id);
  if (hit) return hit;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) paint(id, ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  cache.set(id, texture);
  return texture;
}
