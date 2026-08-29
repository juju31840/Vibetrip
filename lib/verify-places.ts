import "server-only";
import { haversineDistanceKm } from "./geo";
import {
  AREA_TOKEN_COVERAGE,
  MIN_QUERY_TOKEN_COVERAGE,
  namesMatch,
} from "./place-match";
import type { GeoPoint, ItineraryStep } from "@/types/itinerary";

/**
 * Vérifie chaque étape générée contre un vrai référentiel de lieux (Mapbox Search Box).
 *
 * Raison d'être : le banc d'essai du 25/08/2026 a montré que Claude produit deux sortes de
 * lieux faux — des lieux réels mais fermés (« Le Baron », fermé en 2018) et des lieux inventés
 * à partir d'un vrai décor (« Café de la Place Colette », qui s'appelle en réalité Le Nemours).
 * Comme l'utilisateur se rend réellement sur place, les deux sont rédhibitoires.
 *
 * Piège central, mesuré en réel : la recherche Mapbox renvoie TOUJOURS un résultat, et
 * `proximity` n'est qu'un biais de tri, pas un filtre. Chercher « Le Bar Fleuri » près de Lyon
 * renvoie un vrai bar de ce nom à Paris 19e, à 390 km. Accepter le premier résultat serait donc
 * pire que ne rien vérifier : on remplacerait une invention par un lieu réel sans aucun rapport,
 * en donnant à l'utilisateur une fausse confiance. D'où les verrous cumulatifs : la distance ici,
 * la correspondance des noms dans `lib/place-match.ts` — isolée pour être rejouable sur des cas
 * réels (`npm run check:match`).
 */

const SEARCH_URL = "https://api.mapbox.com/search/searchbox/v1/forward";

/** Un résultat plus éloigné que ça de la coordonnée proposée est un autre lieu, pas une correction. */
const MAX_MATCH_DISTANCE_KM = 5;

/**
 * Types de lieux interrogés. Les rues et quartiers sont inclus parce que beaucoup d'étapes
 * légitimes en sont (« Rue Saint-Rome », « Le Marais ») et que le référentiel ne les indexe pas
 * comme POI, mais ils sont soumis à l'exigence renforcée `AREA_TOKEN_COVERAGE`.
 */
const SEARCH_TYPES = "poi,street,neighborhood";

/**
 * Nombre de candidats examinés par étape. Avec un seul, on rate les lieux réels que Mapbox
 * classe deuxième derrière un homonyme : chercher « Le Perchoir » remonte d'abord un
 * restaurant voisin. Examiner les premiers résultats et retenir le premier qui franchit les
 * verrous augmente le rappel sans rien relâcher sur l'exigence.
 */
const CANDIDATES = 5;

/** Requêtes Mapbox simultanées — un « trip » peut compter 18 étapes. */
const CONCURRENCY = 6;

interface SearchBoxResponse {
  features?: {
    geometry: { coordinates: [number, number] };
    properties: {
      name?: string;
      full_address?: string;
      place_formatted?: string;
      feature_type?: string;
    };
  }[];
}

export interface PlaceVerification {
  /** `null` quand la vérification n'a pas pu être tentée (token absent, réseau indisponible). */
  verified: boolean | null;
  placeName: string;
  location: GeoPoint;
  address: string | null;
}

async function verifyOne(
  placeName: string,
  location: GeoPoint,
  token: string
): Promise<PlaceVerification> {
  const url =
    `${SEARCH_URL}?q=${encodeURIComponent(placeName)}` +
    `&proximity=${location.lng},${location.lat}` +
    `&limit=${CANDIDATES}&types=${SEARCH_TYPES}&language=fr&access_token=${token}`;

  let data: SearchBoxResponse;
  try {
    const response = await fetch(url);
    // Un échec côté Mapbox ne doit pas se traduire par « lieu inexistant » : on ne sait pas.
    if (!response.ok) return { verified: null, placeName, location, address: null };
    data = (await response.json()) as SearchBoxResponse;
  } catch {
    return { verified: null, placeName, location, address: null };
  }

  for (const feature of data.features ?? []) {
    const name = feature.properties.name;
    if (!name) continue;

    const [lng, lat] = feature.geometry.coordinates;
    const found = { lat, lng };

    if (haversineDistanceKm(found, location) > MAX_MATCH_DISTANCE_KM) continue;

    const coverage =
      feature.properties.feature_type === "poi" ? MIN_QUERY_TOKEN_COVERAGE : AREA_TOKEN_COVERAGE;
    if (!namesMatch(placeName, name, coverage)) continue;

    // Vérifié : on adopte le nom canonique, l'adresse et les coordonnées réelles du référentiel,
    // plus fiables que ceux produits par le modèle (écart constaté : 0,1 à 1 km sur un lieu réel).
    return {
      verified: true,
      placeName: name,
      location: found,
      address: feature.properties.full_address ?? feature.properties.place_formatted ?? null,
    };
  }

  // Aucun candidat n'a franchi les deux verrous. C'est le cas voulu pour un lieu inventé, mais
  // aussi pour un lieu réel absent du référentiel — d'où « à vérifier » côté interface, et non
  // « ce lieu n'existe pas », qu'on ne serait pas en mesure d'affirmer.
  return { verified: false, placeName, location, address: null };
}

/** Applique la vérification à toutes les étapes, par petits lots pour ne pas saturer l'API. */
/**
 * Une étape déjà ancrée sur le socle de lieux (`lib/places-db.ts`) : son nom et sa coordonnée
 * viennent d'un référentiel, pas du modèle. Il n'y a rien à vérifier.
 *
 * Le drapeau est lu tel quel, jamais déduit. Il l'était auparavant de la présence d'une adresse,
 * ce qui écartait à tort **21 % des lieux du socle** — ceux qui n'en ont pas. Ces étapes,
 * pourtant ancrées, repassaient par le référentiel Mapbox qui les rejetait, et s'affichaient
 * « à confirmer » alors qu'elles venaient d'une base de lieux réels.
 */
function dejaAncree(step: ItineraryStep): boolean {
  return step.anchored === true;
}

export async function verifySteps(steps: ItineraryStep[]): Promise<ItineraryStep[]> {
  // Les étapes ancrées ne repassent jamais ici, et c'est **indispensable** : cette fonction
  // réécrit `verified` et `address` pour toutes les étapes qu'elle traite, et sans token Mapbox
  // elle remettait `verified: null` — ce qui effaçait purement et simplement l'ancrage.
  // Bénéfice second, non négligeable : autant d'allers-retours réseau en moins.
  const aVerifier = steps.filter((step) => !dejaAncree(step));
  if (aVerifier.length === 0) return steps;

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    return steps.map((step) =>
      dejaAncree(step) ? step : { ...step, verified: null, address: null }
    );
  }

  const resolues = new Map<string, ItineraryStep>();
  for (let i = 0; i < aVerifier.length; i += CONCURRENCY) {
    const batch = aVerifier.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((step) => verifyOne(step.placeName, step.location, token))
    );
    batch.forEach((step, index) => {
      const result = results[index]!;
      resolues.set(step.id, {
        ...step,
        placeName: result.placeName,
        location: result.location,
        verified: result.verified,
        address: result.address,
      });
    });
  }

  // L'ordre des étapes est celui de l'itinéraire : il ne doit pas dépendre de ce qui a été vérifié.
  return steps.map((step) => resolues.get(step.id) ?? step);
}
