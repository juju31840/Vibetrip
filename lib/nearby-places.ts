"use client";

import { THEMES as THEME_LIST } from "./themes";
import type { ItineraryStep, ThemeId } from "@/types/itinerary";

/**
 * Lieux réels situés autour d'une étape, cherchés par thème dans le référentiel Mapbox.
 *
 * Deux problèmes résolus d'un coup. D'abord le nombre : les alternatives tirées des autres
 * propositions se comptaient sur les doigts d'une main — pour un créneau donné il n'en existait
 * souvent qu'une seule. Ensuite le choix : on ne pouvait pas demander « plutôt quelque chose de
 * culturel ». Ici chaque thème interroge le référentiel autour du point, ce qui donne des
 * dizaines de possibilités, **toutes réelles par construction** — elles viennent de la base, pas
 * du modèle, donc la question « ce lieu existe-t-il ? » ne se pose pas.
 *
 * Aucun appel au modèle : la réponse arrive en quelques centaines de millisecondes.
 */

const SEARCH_URL = "https://api.mapbox.com/search/searchbox/v1/category";

/**
 * Rayon de recherche, **en kilomètres** — l'API le refuse au-delà de 10 et répond 400. Écrit
 * en mètres au premier essai, il produisait une erreur silencieuse côté interface : le panneau
 * affichait « rien dans les environs » alors que la requête était simplement invalide.
 */
const RADIUS_KM = 2;

export { THEMES, themeForType } from "./themes";
export type { ThemeId } from "@/types/itinerary";


interface CategoryResponse {
  features?: {
    geometry: { coordinates: [number, number] };
    properties: {
      mapbox_id?: string;
      name?: string;
      full_address?: string;
      place_formatted?: string;
    };
  }[];
}

/**
 * Cherche des lieux du thème demandé autour d'une étape et les renvoie sous la forme d'étapes
 * prêtes à remplacer l'originale (même jour, même créneau — seul le lieu change).
 *
 * `excludeNames` évite de proposer ce qui est déjà dans l'itinéraire.
 */
export async function findNearby(
  theme: ThemeId,
  origin: ItineraryStep,
  excludeNames: string[],
  limit = 8
): Promise<ItineraryStep[]> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const definition = THEME_LIST.find((item) => item.id === theme);
  if (!token || !definition) return [];

  const excluded = new Set(excludeNames.map(normalize));
  const seen = new Set<string>();
  const results: ItineraryStep[] = [];

  // Les catégories d'un même thème sont interrogées en parallèle : « Boire un verre » couvre
  // les bars et les cafés, les enchaîner doublerait l'attente pour rien.
  const responses = await Promise.all(
    definition.categories.map((category) => fetchCategory(category, origin, token))
  );

  for (const features of responses) {
    for (const feature of features) {
      const name = feature.properties.name;
      if (!name) continue;

      const key = normalize(name);
      if (excluded.has(key) || seen.has(key)) continue;
      seen.add(key);

      const [lng, lat] = feature.geometry.coordinates;
      results.push({
        id: `nearby-${feature.properties.mapbox_id ?? key}`,
        day: origin.day,
        period: origin.period,
        placeName: name,
        description: definition.label,
        location: { lat, lng },
        type: definition.type,
        // Le lieu sort du référentiel : son existence et son adresse sont acquises, il n'y a
        // rien à confirmer sur place, contrairement à ce que le modèle propose.
        verified: true,
        address: feature.properties.full_address ?? feature.properties.place_formatted ?? null,
      });
    }
  }

  return results.slice(0, limit);
}

async function fetchCategory(
  category: string,
  origin: ItineraryStep,
  token: string
): Promise<NonNullable<CategoryResponse["features"]>> {
  const url =
    `${SEARCH_URL}/${encodeURIComponent(category)}` +
    `?proximity=${origin.location.lng},${origin.location.lat}` +
    `&radius=${RADIUS_KM}&limit=10&language=fr&access_token=${token}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = (await response.json()) as CategoryResponse;
    return data.features ?? [];
  } catch {
    // Une catégorie indisponible ne doit pas vider tout le panneau : les autres répondront.
    return [];
  }
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
