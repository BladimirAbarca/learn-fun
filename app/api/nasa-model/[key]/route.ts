import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { NASA_EMBEDS } from "@/lib/nasaModels";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const cacheDir = path.join(process.cwd(), ".cache", "nasa-models");
const inflight = new Map<string, Promise<string>>();

function glbUrl(html: string): string | null {
  const match = html.match(
    /https:\/\/solarsystem\.nasa\.gov\/rails\/active_storage\/blobs\/redirect\/[^"'\\\s>]+\.glb[^"'\\\s>]*/,
  );
  return match ? match[0] : null;
}

async function download(key: string): Promise<string> {
  const embed = NASA_EMBEDS[key];
  const page = await fetch(`https://solarsystem.nasa.gov/gltf_embed/${embed}/`, {
    redirect: "follow",
    headers: { "User-Agent": "learn-fun" },
  });
  if (!page.ok) throw new Error(`NASA respondió ${page.status}`);
  const html = await page.text();
  const src = glbUrl(html);
  if (!src) throw new Error("NASA no publicó el archivo 3D");

  const glb = await fetch(src, { redirect: "follow", headers: { "User-Agent": "learn-fun" } });
  if (!glb.ok || !glb.body) throw new Error(`El modelo no se pudo bajar (${glb.status})`);

  await mkdir(cacheDir, { recursive: true });
  const file = path.join(cacheDir, `${key}.glb`);
  const partial = `${file}.part`;
  await pipeline(
    Readable.fromWeb(glb.body as import("node:stream/web").ReadableStream),
    createWriteStream(partial),
  );
  await rename(partial, file);
  return file;
}

async function ensure(key: string): Promise<string> {
  const file = path.join(cacheDir, `${key}.glb`);
  try {
    const info = await stat(file);
    if (info.size > 1000) return file;
  } catch {
    // Not cached yet.
  }
  const pending = inflight.get(key);
  if (pending) return pending;
  const job = download(key).finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

export async function GET(_request: Request, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;
  if (!NASA_EMBEDS[key]) {
    return Response.json({ message: "Ese modelo no está en la galería de NASA." }, { status: 404 });
  }

  try {
    const file = await ensure(key);
    const info = await stat(file);
    const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
    return new Response(stream, {
      headers: {
        "Content-Type": "model/gltf-binary",
        "Content-Length": String(info.size),
        "Cache-Control": "public, max-age=604800",
      },
    });
  } catch {
    return Response.json(
      { message: "No se pudo cargar el modelo 3D de NASA. Revisa la conexión." },
      { status: 502 },
    );
  }
}
