import type { PlaceType, ThemeId } from "@/types/itinerary";

/**
 * Les envies proposées à l'utilisateur — la même liste des deux côtés du produit.
 *
 * Elle ne servait d'abord qu'au panneau « Changer » d'une étape (lib/nearby-places.ts), où elle
 * interroge le référentiel par catégorie. Elle sert désormais aussi **au moment du réglage**, pour
 * dire ce qu'on a envie de faire avant même la génération : le reproche était juste, on ne pouvait
 * exprimer une envie qu'après coup, en corrigeant une étape qu'on n'avait pas demandée.
 *
 * D'où ce module neutre, sans `"use client"` : la liste doit être lisible par l'écran de réglages
 * *et* par la construction du prompt, qui tourne côté serveur.
 *
 * La liste est volontairement courte et testée : `sports` et `fitness_center` ont été essayés puis
 * **écartés** — ils renvoient des événements et des commerces sans rapport (« Coca-Cola Music
 * Tour » pour une salle de sport). Proposer un thème qui rend n'importe quoi est pire que ne pas
 * le proposer. « Plein air » les remplace, et fonctionne.
 */
export const THEMES = [
  { id: "eat", label: "Manger", prompt: "manger", categories: ["restaurant"], type: "restaurant" },
  { id: "drink", label: "Boire un verre", prompt: "boire un verre", categories: ["bar", "cafe"], type: "bar" },
  { id: "culture", label: "Culture", prompt: "des visites culturelles", categories: ["museum", "theater"], type: "museum" },
  { id: "outdoor", label: "Plein air", prompt: "du plein air", categories: ["park", "outdoors", "viewpoint"], type: "park" },
  { id: "night", label: "Sortir", prompt: "sortir le soir", categories: ["nightclub"], type: "nightlife" },
  { id: "shopping", label: "Boutiques", prompt: "des boutiques", categories: ["shopping"], type: "shopping" },
] as const satisfies readonly {
  id: ThemeId;
  label: string;
  /** Formulation envoyée au modèle — « des visites culturelles » se lit mieux que « culture ». */
  prompt: string;
  categories: readonly string[];
  type: PlaceType;
}[];

/** Thème le plus proche du type d'une étape, pour ouvrir le panneau « Changer » sur le bon onglet. */
export function themeForType(type: PlaceType): ThemeId {
  switch (type) {
    case "restaurant":
      return "eat";
    case "bar":
    case "cafe":
      return "drink";
    case "museum":
      return "culture";
    case "park":
    case "viewpoint":
      return "outdoor";
    case "nightlife":
      return "night";
    case "shopping":
      return "shopping";
    default:
      return "culture";
  }
}
