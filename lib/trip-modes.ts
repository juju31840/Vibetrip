import type { TripMode } from "@/types/itinerary";

/**
 * Comment se nomme une sortie **déjà faite**, partout où on la relit : « Mes sorties » et les
 * sorties rattachées à une ville dans « Ma carte ». Une seule définition, parce que les deux
 * listes montrent les mêmes objets et qu'un mode nommé de deux façons ferait croire à deux
 * natures différentes.
 *
 * Volontairement distinct des libellés du sélecteur (`components/ModeSelector.tsx`), qui parlent
 * au futur d'une sortie à venir — on choisit « Ce soir », on relit « Soirée ».
 */
export const MODE_LABELS: Record<TripMode, string> = {
  tonight: "Soirée",
  weekend: "Week-end",
  trip: "Voyage",
};
