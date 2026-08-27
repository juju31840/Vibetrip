import { levelIndex } from "./prompt";

/**
 * Mots affichés sous chaque curseur, un par palier. Ils sont indexés par la même fonction que
 * les consignes envoyées au modèle (`levelIndex`), de sorte que le mot lu par l'utilisateur et
 * l'instruction reçue par le modèle désignent toujours le même palier — un décalage entre les
 * deux rendrait les curseurs mensongers.
 */
const BUDGET_LABELS = ["Fauché", "Serré", "Raisonnable", "Confortable", "Sans compter"] as const;
const AMBIANCE_LABELS = ["Très calme", "Tranquille", "Conviviale", "Animée", "Festive"] as const;
const DISTANCE_LABELS = ["À pied", "Le quartier", "Toute la ville", "Les environs", "Loin"] as const;

export const VIBE_LABELS = {
  budget: BUDGET_LABELS,
  ambiance: AMBIANCE_LABELS,
  distance: DISTANCE_LABELS,
} as const;

export type VibeKey = keyof typeof VIBE_LABELS;

export function vibeLabel(key: VibeKey, value: number): string {
  const labels = VIBE_LABELS[key];
  return labels[levelIndex(value)] ?? labels[labels.length - 1]!;
}

/** Pas du curseur : 5 paliers sur 0-100. Le contrat de l'API reste une valeur 0-100. */
export const VIBE_STEP = 25;
