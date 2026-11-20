import { fetchApod } from "@/lib/nasa";
import type { ApodResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const card = await fetchApod();
    const body: ApodResponse = { source: "live", card };
    return Response.json(body);
  } catch {
    const body: ApodResponse = {
      source: "error",
      card: null,
      message: "Hoy no pudimos traer la foto del cielo de NASA. Puedes seguir explorando los planetas.",
    };
    return Response.json(body, { status: 200 });
  }
}
