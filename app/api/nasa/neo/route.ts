import { fetchNeos, SAMPLE_NEOS } from "@/lib/nasa";
import type { NeoResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { rocks, catalog } = await fetchNeos();
    const body: NeoResponse = {
      source: "live",
      fetchedAt: new Date().toISOString(),
      rocks,
      catalog,
    };
    return Response.json(body);
  } catch {
    const body: NeoResponse = {
      source: "sample",
      fetchedAt: new Date().toISOString(),
      rocks: SAMPLE_NEOS,
      message:
        "NASA no contestó ahora. Mostramos una lista guardada de asteroides cercanos (NeoWs, 19 nov 2026).",
    };
    return Response.json(body, { status: 200 });
  }
}
