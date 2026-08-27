import type { GeoPoint, TripMode } from "@/types/itinerary";

const EARTH_RADIUS_KM = 6371;

/** Distance à vol d'oiseau entre deux points, en kilomètres. */
export function haversineDistanceKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Bornes du rayon de plausibilité (km) selon le mode — le curseur « distance » (0-100)
 * interpole entre min et max, pour que ce réglage ait un effet réel côté serveur et
 * pas seulement dans le texte envoyé à Claude.
 *
 * Le mode « voyage » plafonnait à 400 km, ce qui autorisait des itinéraires absurdes :
 * Lyon → Paris fait 392 km, Lille → Amsterdam 232 km. Un séjour censé explorer une région se
 * retrouvait à traverser le pays. À 180 km, Lyon atteint Annecy (101 km) ou Grenoble mais
 * pas Avignon (202 km) ni Paris — on reste dans une région, ce qui est le sens du mode.
 */
const PLAUSIBILITY_RADIUS_KM: Record<TripMode, { min: number; max: number }> = {
  tonight: { min: 5, max: 30 },
  weekend: { min: 15, max: 50 },
  trip: { min: 40, max: 180 },
};

function plausibilityRadiusKm(mode: TripMode, distance: number): number {
  const { min, max } = PLAUSIBILITY_RADIUS_KM[mode];
  const t = Math.min(100, Math.max(0, distance)) / 100;
  return min + (max - min) * t;
}

export function isPlausibleStepLocation(
  stepLocation: GeoPoint,
  referencePoint: GeoPoint,
  mode: TripMode,
  distance: number
): boolean {
  return haversineDistanceKm(stepLocation, referencePoint) <= plausibilityRadiusKm(mode, distance);
}

/** Filtre les étapes dont les coordonnées sont trop éloignées du point de référence pour être crédibles. */
export function filterPlausibleSteps<T extends { location: GeoPoint }>(
  steps: T[],
  referencePoint: GeoPoint,
  mode: TripMode,
  distance: number
): T[] {
  return steps.filter((step) =>
    isPlausibleStepLocation(step.location, referencePoint, mode, distance)
  );
}

export interface MapBounds {
  southwest: GeoPoint;
  northeast: GeoPoint;
}

/**
 * Bounds englobant tous les points, avec une marge, pour un fitBounds initial.
 *
 * Générique sur le point et non lié à `ItineraryStep` : la carte personnelle cadre des lieux
 * visités, qui n'ont ni jour ni période.
 */
export function computeBounds(
  points: { location: GeoPoint }[],
  paddingDegrees = 0.02
): MapBounds | null {
  if (points.length === 0) return null;

  let minLat = points[0]!.location.lat;
  let maxLat = points[0]!.location.lat;
  let minLng = points[0]!.location.lng;
  let maxLng = points[0]!.location.lng;

  for (const point of points) {
    minLat = Math.min(minLat, point.location.lat);
    maxLat = Math.max(maxLat, point.location.lat);
    minLng = Math.min(minLng, point.location.lng);
    maxLng = Math.max(maxLng, point.location.lng);
  }

  return {
    southwest: { lat: minLat - paddingDegrees, lng: minLng - paddingDegrees },
    northeast: { lat: maxLat + paddingDegrees, lng: maxLng + paddingDegrees },
  };
}
