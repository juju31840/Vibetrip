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
  tripName: z.string().min(1),
  mode: tripModeSchema,
  totalDays: z.number().int().min(1),
  steps: z.array(itineraryStepSchema).min(1),
});

/** Schéma envoyé à Claude en structured output — pas d'id ici, généré côté serveur après coup. */
export const claudeItineraryStepSchema = itineraryStepSchema.omit({ id: true });

export const claudeItinerarySchema = itinerarySchema.extend({
  steps: z.array(claudeItineraryStepSchema).min(1),
});

export const locationInputSchema = z.union([
  geoPointSchema,
  z.object({ city: z.string().min(1) }),
]);

export const generateItineraryRequestSchema = z.object({
  budget: z.number().min(0).max(100),
  ambiance: z.number().min(0).max(100),
  distance: z.number().min(0).max(100),
  mode: tripModeSchema,
  location: locationInputSchema,
});
