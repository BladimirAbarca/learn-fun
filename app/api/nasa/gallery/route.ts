import { fetchBodyGallery, galleryBodyName } from "@/lib/nasa";
import type { GalleryResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const bodyId = new URL(request.url).searchParams.get("body") ?? "";
  const name = galleryBodyName(bodyId);
  if (!name) {
    const missing: GalleryResponse = {
      source: "error",
      images: [],
      message: "Elige un planeta, el Sol o la Luna para ver sus fotos.",
    };
    return Response.json(missing, { status: 200 });
  }
  try {
    const images = await fetchBodyGallery(bodyId);
    const body: GalleryResponse = { source: "live", images };
    return Response.json(body);
  } catch {
    const body: GalleryResponse = {
      source: "error",
      images: [],
      message: `Ahora no hay fotos reales de ${name} en la biblioteca de NASA. Puedes volver a intentar.`,
    };
    return Response.json(body, { status: 200 });
  }
}
