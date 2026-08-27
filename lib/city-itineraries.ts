import { haversineDistanceKm } from "@/lib/geo";
import type { VisitedPlace } from "@/lib/places-store";
import type { SavedItinerary } from "@/lib/storage";

/**
 * Rattache les sorties enregistrées à une ville de « Ma carte ».
 *
 * Raison d'être : la carte personnelle montrait des points sans jamais dire *d'où* ils venaient.
 * Or un point posé est le reste d'un parcours — cliquer sur Lyon doit rendre les sorties qu'on y
 * a faites, pas seulement une poignée de marqueurs. C'est ce qui referme la boucle dans l'autre
 * sens : la sortie mène à la carte, la carte ramène à la sortie.
 *
 * Module **pur** (aucun accès `localStorage`, aucun `"use client"`) : il ne fait que croiser deux
 * listes qu'on lui donne. C'est ce qui le rendra rejouable hors de React et inchangé le jour où
 * les deux magasins passeront sur Supabase.
 *
 * Aucun champ « ville » n'existe sur un `Itinerary` — le rattachement se déduit donc, par deux
 * voies dont l'ordre compte :
 *
 * 1. **Les passages** (`visits[].ref`, de la forme `itineraryId:stepId`). C'est une preuve
 *    directe : cette sortie a réellement posé ce point-là dans cette ville. Aucune heuristique.
 * 2. **La proximité**, en second seulement, pour les sorties enregistrées mais jamais entamées —
 *    elles n'ont posé aucun point, donc la voie 1 ne peut pas les voir, et ce sont pourtant
 *    exactement celles qu'on veut retrouver (« j'avais gardé un week-end à Lyon »).
 */

/**
 * Rayon de rattachement géographique. Comparé aux **lieux visités** de la ville et non à leur
 * centroïde : deux ou trois points ne font pas un centre-ville, et un centroïde tiré entre deux
 * quartiers opposés tombe là où l'on n'est jamais allé. 25 km couvre une agglomération et sa
 * périphérie proche sans avaler la ville voisine — c'est l'ordre de grandeur du rayon de
 * plausibilité d'un week-end (lib/geo.ts).
 */
const NEAR_KM = 25;

export interface CityItinerary {
  entry: SavedItinerary;
  /** Étapes cochées, sur le total — le suivi de la sortie. */
  done: number;
  total: number;
  /**
   * `true` = au moins une étape a été cochée ici (rattachement certain), `false` = sortie
   * enregistrée et rattachée par proximité seulement. L'écran ne présente pas les deux pareil :
   * annoncer « tu es allé là » sur la foi d'une distance serait une affirmation non tenue.
   */
  walked: boolean;
}

/** L'identifiant d'itinéraire est la partie de la référence qui précède le premier `:`. */
function itineraryIdOf(ref: string): string {
  const cut = ref.indexOf(":");
  return cut === -1 ? ref : ref.slice(0, cut);
}

/**
 * @param saved   l'historique complet des sorties
 * @param places  les lieux visités **de cette ville seulement** (déjà filtrés par l'appelant)
 * @param geographic  autoriser la voie 2. Faux pour le groupe « Ailleurs », qui rassemble des
 *   lieux dont la commune n'a pas pu être résolue : ils sont dispersés dans tout le pays, et une
 *   distance entre eux ne veut rien dire.
 */
export function itinerariesForCity(
  saved: SavedItinerary[],
  places: VisitedPlace[],
  geographic = true
): CityItinerary[] {
  const walkedIds = new Set<string>();
  for (const place of places) {
    for (const visit of place.visits) walkedIds.add(itineraryIdOf(visit.ref));
  }

  const matched: CityItinerary[] = [];
  for (const entry of saved) {
    const walked = walkedIds.has(entry.id);
    if (!walked) {
      if (!geographic || !isNearby(entry, places)) continue;
    }
    matched.push({
      entry,
      done: entry.doneStepIds.length,
      total: entry.itinerary.steps.length,
      walked,
    });
  }

  // Du plus récemment enregistré au plus ancien, comme « Mes sorties » : deux listes des mêmes
  // objets rangées différemment feraient douter qu'il s'agisse des mêmes.
  return matched.sort((a, b) => timeOf(b.entry.savedAt) - timeOf(a.entry.savedAt));
}

function isNearby(entry: SavedItinerary, places: VisitedPlace[]): boolean {
  return entry.itinerary.steps.some((step) =>
    places.some((place) => haversineDistanceKm(step.location, place.location) <= NEAR_KM)
  );
}

function timeOf(iso: string): number {
  const time = new Date(iso).getTime();
  return Number.isNaN(time) ? 0 : time;
}
