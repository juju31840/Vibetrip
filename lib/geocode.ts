import "server-only";
import type { GeoPoint } from "@/types/itinerary";

interface MapboxGeocodingResponse {
  features?: { center: [number, number] }[];
}

/**
 * Résout une ville saisie manuellement en coordonnées via l'API Geocoding Mapbox,
 * pour que `filterPlausibleSteps` (lib/geo.ts) puisse s'appliquer même quand
 * l'utilisateur n'a pas partagé sa position GPS. Retourne `null` en cas d'échec
 * (ville introuvable, token absent, erreur réseau) plutôt que de faire échouer
 * toute la génération — le filtre de plausibilité est alors simplement désactivé,
 * comme c'était déjà le cas avant cette fonction.
 */
export async function geocodeCity(city: string): Promise<GeoPoint | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    city
  )}.json?access_token=${token}&limit=1&types=place`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = (await response.json()) as MapboxGeocodingResponse;
    const feature = data.features?.[0];
    if (!feature) return null;

    const [lng, lat] = feature.center;
    return { lat, lng };
  } catch {
    return null;
  }
}
