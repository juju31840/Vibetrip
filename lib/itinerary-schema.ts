import { z } from "zod/v4";

export const tripModeSchema = z.enum(["tonight", "weekend", "trip"]);

export const periodSchema = z.enum(["morning", "midday", "evening"]);

export const placeTypeSchema = z.enum([
  "restaurant",
  "bar",
  "cafe",
  "museum",
  "park",
  "viewpoint",
  "activity",
  "shopping",
  "nightlife",
  "hotel",
  "transport",
  "other",
]);

export const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const itineraryStepSchema = z.object({
  id: z.string().min(1),
  day: z.number().int().min(1),
  period: periodSchema,
  placeName: z.string().min(1),
  description: z.string().min(1),
  location: geoPointSchema,
  type: placeTypeSchema,
});

export const itinerarySchema = z.object({
  id: z.string().min(1),
  tripName: z.string().min(1),
  summary: z.string().min(1),
  mode: tripModeSchema,
  totalDays: z.number().int().min(1),
  steps: z.array(itineraryStepSchema).min(1),
});

/**
 * Schéma envoyé à Claude en structured output — pas d'id ici, généré côté serveur après coup.
 *
 * `ref` est la référence d'un lieu du socle (« L12 »), que le modèle **cite** au lieu d'inventer
 * un nom et des coordonnées. C'est tout le principe de l'inversion : le lieu vient de la base, le
 * modèle ne fournit que le choix, l'ordre et la description. Le champ reste facultatif — sans
 * socle disponible, ou pour un lieu que le modèle tient à proposer hors liste, la génération
 * fonctionne comme avant et l'étape repasse par la vérification habituelle.
 */
export const claudeItineraryStepSchema = itineraryStepSchema.omit({ id: true }).extend({
  ref: z.string().nullable().optional(),
});

export const claudeItinerarySchema = itinerarySchema.omit({ id: true }).extend({
  steps: z.array(claudeItineraryStepSchema).min(1),
});

/**
 * Nombre de propositions présentées à l'utilisateur, par mode.
 *
 * Trois partout, sauf en « voyage » : mesuré en réel, six jours × trois propositions demandent
 * 56 s, soit trop près de la limite d'exécution de 60 s pour être sûr. Deux propositions
 * ramènent ce mode sous les 40 s — et comparer deux programmes de dix-huit étapes est déjà un
 * effort de lecture considérable pour l'utilisateur.
 */
export function proposalCountForMode(mode: z.infer<typeof tripModeSchema>): number {
  return mode === "trip" ? 2 : 3;
}

export const locationInputSchema = z.union([
  geoPointSchema,
  z.object({ city: z.string().min(1) }),
]);

export const themeIdSchema = z.enum([
  "eat",
  "drink",
  "culture",
  "outdoor",
  "night",
  "shopping",
]);

export const generateItineraryRequestSchema = z.object({
  budget: z.number().min(0).max(100),
  ambiance: z.number().min(0).max(100),
  distance: z.number().min(0).max(100),
  mode: tripModeSchema,
  location: locationInputSchema,
  // Facultatives, et par défaut vides : ne rien cocher doit rester un usage normal, pas une
  // requête incomplète. Le doublon est écarté côté schéma plutôt que côté écran.
  themes: z.array(themeIdSchema).max(6).optional(),
});
