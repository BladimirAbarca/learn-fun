import { NASA_EMBEDS } from "@/lib/nasaModels";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function glbUrl(html: string): string | null {
  const match = html.match(
    /https:\/\/solarsystem\.nasa\.gov\/rails\/active_storage\/blobs\/redirect\/[^"'\\\s>]+\.glb[^"'\\\s>]*/,
  );
  return match ? match[0] : null;
}

export async function GET(_request: Request, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;
  const embed = NASA_EMBEDS[key];
  if (!embed) {
    return Response.json({ message: "Ese modelo no está en la galería de NASA." }, { status: 404 });
  }

  try {
    const page = await fetch(`https://solarsystem.nasa.gov/gltf_embed/${embed}/`, {
      redirect: "follow",
      headers: { "User-Agent": "learn-fun" },
    });
    if (!page.ok) throw new Error(`NASA respondió ${page.status}`);
    const src = glbUrl(await page.text());
    if (!src) throw new Error("NASA no publicó el archivo 3D");

    const glb = await fetch(src, { redirect: "follow", headers: { "User-Agent": "learn-fun" } });
    if (!glb.ok || !glb.body) throw new Error(`El modelo no se pudo bajar (${glb.status})`);

    const headers = new Headers({
      "Content-Type": "model/gltf-binary",
      "Cache-Control": "public, max-age=86400",
    });
    const length = glb.headers.get("content-length");
    if (length) headers.set("Content-Length", length);
    return new Response(glb.body, { headers });
  } catch {
    return Response.json(
      { message: "No se pudo cargar el modelo 3D de NASA. Revisa la conexión." },
      { status: 502 },
    );
  }
}
