import type { GeoPoint, ItineraryStep, TripMode } from "@/types/itinerary";

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

/** Rayon de plausibilité maximal (km) autour du point de référence, selon le mode. */
const PLAUSIBILITY_RADIUS_KM: Record<TripMode, number> = {
  tonight: 30,
  weekend: 50,
  trip: 400,
};

export function isPlausibleStepLocation(
  stepLocation: GeoPoint,
  referencePoint: GeoPoint,
  mode: TripMode
): boolean {
  return haversineDistanceKm(stepLocation, referencePoint) <= PLAUSIBILITY_RADIUS_KM[mode];
}

/** Filtre les étapes dont les coordonnées sont trop éloignées du point de référence pour être crédibles. */
export function filterPlausibleSteps<T extends { location: GeoPoint }>(
  steps: T[],
  referencePoint: GeoPoint,
  mode: TripMode
): T[] {
  return steps.filter((step) => isPlausibleStepLocation(step.location, referencePoint, mode));
}

export interface MapBounds {
  southwest: GeoPoint;
  northeast: GeoPoint;
}

/** Bounds englobant toutes les étapes, avec une marge, pour un fitBounds initial. */
export function computeBounds(steps: ItineraryStep[], paddingDegrees = 0.02): MapBounds | null {
  if (steps.length === 0) return null;

  let minLat = steps[0]!.location.lat;
  let maxLat = steps[0]!.location.lat;
  let minLng = steps[0]!.location.lng;
  let maxLng = steps[0]!.location.lng;

  for (const step of steps) {
    minLat = Math.min(minLat, step.location.lat);
    maxLat = Math.max(maxLat, step.location.lat);
    minLng = Math.min(minLng, step.location.lng);
    maxLng = Math.max(maxLng, step.location.lng);
  }

  return {
    southwest: { lat: minLat - paddingDegrees, lng: minLng - paddingDegrees },
    northeast: { lat: maxLat + paddingDegrees, lng: maxLng + paddingDegrees },
  };
}
