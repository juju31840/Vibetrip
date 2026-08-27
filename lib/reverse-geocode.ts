"use client";

import type { GeoPoint } from "@/types/itinerary";

interface MapboxReverseResponse {
  features?: { text?: string; place_name?: string }[];
}

/**
 * Nom de la commune correspondant à un point — utilisé pour ranger les lieux visités par ville
 * sur « Ma carte ».
 *
 * Pourquoi le résoudre et ne pas s'en passer : une collection qui mêle Tours et Marseille sur une
 * seule carte donne une vue de la France où chaque ville est un point, illisible et sans intérêt.
 * Regrouper par ville est la structure naturelle d'un carnet de sorties — et « 7 villes » est en
 * soi une bonne mesure de collection.
 *
 * Un appel par lieu nouvellement coché, jamais en rafale. Retourne `null` en cas d'échec
 * (token absent, réseau) : le lieu est alors rangé sous « Ailleurs » plutôt que perdu.
 */
export async function reverseGeocodeCity(point: GeoPoint): Promise<string | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;

  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${point.lng},${point.lat}.json` +
    `?access_token=${token}&types=place&limit=1&language=fr`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = (await response.json()) as MapboxReverseResponse;
    return data.features?.[0]?.text ?? null;
  } catch {
    return null;
  }
}
