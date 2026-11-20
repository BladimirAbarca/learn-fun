import { fetchBodyImages } from "@/lib/nasa";
import type { ImagesResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const byId = await fetchBodyImages();
    const body: ImagesResponse = {
      source: Object.keys(byId).length ? "live" : "error",
      byId,
      message: Object.keys(byId).length
        ? undefined
        : "Las fotos de NASA no cargaron. Los planetas siguen aquí con sus datos.",
    };
    return Response.json(body);
  } catch {
    const body: ImagesResponse = {
      source: "error",
      byId: {},
      message: "Las fotos de NASA no cargaron. Los planetas siguen aquí con sus datos.",
    };
    return Response.json(body, { status: 200 });
  }
}
