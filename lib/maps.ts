import type { ItineraryStep } from "@/types/itinerary";

const MAPS_SEARCH = "https://www.google.com/maps/search/";

/**
 * Lien d'ouverture d'une étape dans Maps — c'est ce qui ferme la boucle d'usage, puisque
 * l'utilisateur se rend réellement sur place. La forme du lien dépend de ce qu'on sait du lieu,
 * et c'est volontaire : poser un point précis sur une coordonnée qu'on n'a pas pu confirmer
 * enverrait l'utilisateur avec assurance à une adresse potentiellement inventée.
 *
 * - Lieu vérifié : recherche sur le nom canonique et l'adresse réelle du référentiel, ce qui
 *   ouvre la fiche du lieu (horaires, avis, itinéraire) plutôt qu'un simple point.
 * - Lieu non vérifié : recherche sur le nom, centrée sur le quartier attendu. L'utilisateur voit
 *   ce que Maps trouve réellement à proximité au lieu d'un point qui fait autorité à tort.
 * - Vérification indisponible : on retombe sur les coordonnées, seule information dont on dispose.
 */
export function buildMapsUrl(step: ItineraryStep): string {
  const { lat, lng } = step.location;

  if (step.verified === true) {
    const query = step.address ? `${step.placeName}, ${step.address}` : step.placeName;
    return `${MAPS_SEARCH}?api=1&query=${encodeURIComponent(query)}`;
  }

  if (step.verified === false) {
    // Le suffixe @lat,lng,15z centre la recherche sur le quartier attendu sans affirmer
    // que le lieu s'y trouve — Maps affiche alors ses propres résultats aux alentours.
    return `${MAPS_SEARCH}${encodeURIComponent(step.placeName)}/@${lat},${lng},15z`;
  }

  return `${MAPS_SEARCH}?api=1&query=${lat},${lng}`;
}
