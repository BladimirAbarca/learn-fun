import { fetchDebris } from "@/lib/nasa";
import type { DebrisResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const pieces = await fetchDebris();
    const body: DebrisResponse = {
      source: "live",
      fetchedAt: new Date().toISOString(),
      pieces,
    };
    return Response.json(body);
  } catch {
    const body: DebrisResponse = {
      source: "error",
      fetchedAt: new Date().toISOString(),
      pieces: [],
      message:
        "No pudimos cargar la lista de objetos cerca de la Tierra. Los planetas y asteroides siguen disponibles.",
    };
    return Response.json(body, { status: 200 });
  }
}
