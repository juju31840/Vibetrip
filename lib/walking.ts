import { haversineDistanceKm } from "./geo";
import type { ItineraryStep } from "@/types/itinerary";

/**
 * Le trajet entre deux étapes — une information **calculée, jamais rédigée**.
 *
 * Elle répond au reproche de fond fait à l'interface : les descriptions générées se ressemblaient
 * toutes parce qu'elles ne disaient rien de vérifiable (« convivial », « chaleureux »,
 * « atmosphère »). Un chiffre issu des coordonnées ne peut pas sonner générique : il est juste ou
 * faux, et il répond à la question qu'on se pose vraiment devant un parcours — est-ce que ça se
 * fait à pied ?
 *
 * À vol d'oiseau, donc optimiste en ville. D'où le seuil de marche volontairement bas : mieux
 * vaut annoncer un trajet en transport qui se révèle marchable que l'inverse.
 */

/** Vitesse de marche en ville, détours et feux compris. */
const KM_PAR_HEURE = 4.2;

/** Au-delà, on ne fait plus le chemin à pied et l'annoncer serait trompeur. */
const MARCHE_MAX_KM = 2.5;

export interface Trajet {
  metres: number;
  minutes: number;
  aPied: boolean;
}

export function trajetDepuis(precedente: ItineraryStep, etape: ItineraryStep): Trajet | null {
  // Deux étapes de jours différents ne s'enchaînent pas : le trajet n'aurait aucun sens.
  if (precedente.day !== etape.day) return null;

  const km = haversineDistanceKm(precedente.location, etape.location);
  // Moins de 60 m : c'est la même adresse à la précision près, ou le lieu d'à côté. L'afficher
  // ferait du bruit pour rien.
  if (km < 0.06) return null;

  return {
    metres: Math.round(km * 1000),
    minutes: Math.max(1, Math.round((km / KM_PAR_HEURE) * 60)),
    aPied: km <= MARCHE_MAX_KM,
  };
}

/** « 8 min à pied », « 1,4 km » — court, et jamais une phrase. */
export function formatTrajet(trajet: Trajet): string {
  if (trajet.aPied) return `${trajet.minutes} min à pied`;
  const km = (trajet.metres / 1000).toFixed(1).replace(".", ",");
  return `${km} km`;
}
