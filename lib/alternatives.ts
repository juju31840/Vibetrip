import type { Itinerary, ItineraryStep } from "@/types/itinerary";

/**
 * Alternatives proposées pour remplacer une étape.
 *
 * Elles ne sont pas générées : ce sont les étapes des **autres** propositions, prises au même
 * moment de la sortie. C'est délibéré et pas seulement économe — les propositions sont écrites
 * sous des angles différents (incontournables, hors des sentiers battus, autour de la table),
 * si bien que leurs étapes constituent déjà un choix cohérent pour un même créneau. Les faire
 * générer à part coûterait un appel de plus, ferait attendre l'utilisateur au milieu de son
 * choix, et donnerait des lieux moins bien articulés au reste du parcours.
 *
 * Sont écartées : les étapes déjà présentes dans l'itinéraire en cours d'édition (on ne propose
 * pas de remplacer un lieu par lui-même, ni de le mettre deux fois), et les doublons de nom
 * entre propositions.
 */
export function alternativesFor(
  target: ItineraryStep,
  currentSteps: ItineraryStep[],
  proposals: Itinerary[]
): ItineraryStep[] {
  const alreadyUsed = new Set(currentSteps.map((step) => normalize(step.placeName)));
  const seen = new Set<string>();
  const alternatives: ItineraryStep[] = [];

  for (const proposal of proposals) {
    for (const step of proposal.steps) {
      // Même créneau : remplacer un dîner par une visite de musée casserait le déroulé.
      if (step.period !== target.period) continue;
      if (step.day !== target.day) continue;

      const key = normalize(step.placeName);
      if (alreadyUsed.has(key) || seen.has(key)) continue;

      seen.add(key);
      alternatives.push(step);
    }
  }

  return alternatives;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
