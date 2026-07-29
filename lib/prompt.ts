import type { GenerateItineraryRequest } from "@/types/itinerary";

const MODE_LABELS: Record<GenerateItineraryRequest["mode"], string> = {
  tonight: "une soirée (aujourd'hui, en une seule journée)",
  weekend: "un week-end (2 jours)",
  trip: "un voyage de plusieurs jours (entre 3 et 6 jours, à toi de choisir une durée cohérente)",
};

const DISTANCE_HINTS: Record<GenerateItineraryRequest["mode"], string> = {
  tonight:
    "Le curseur Distance représente un rayon de marche/court trajet autour du point de départ (0 = à pied, 100 = quelques kilomètres en transport).",
  weekend:
    "Le curseur Distance représente le rayon d'exploration autour du point de départ (0 = quartier proche, 100 = excursions à plusieurs dizaines de kilomètres).",
  trip:
    "Le curseur Distance représente l'étendue géographique du voyage (0 = une seule ville, 100 = plusieurs villes/régions).",
};

function describeLevel(value: number, low: string, mid: string, high: string): string {
  if (value < 33) return low;
  if (value < 66) return mid;
  return high;
}

function describeLocation(location: GenerateItineraryRequest["location"]): string {
  if ("city" in location) {
    return `la ville de ${location.city}`;
  }
  return `les coordonnées GPS approximatives (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})`;
}

export function buildSystemPrompt(): string {
  return [
    "Tu es un générateur d'itinéraires de voyage/sortie pour l'application VibeTrip.",
    "Tu dois répondre UNIQUEMENT avec un objet JSON conforme au schéma structuré fourni, sans texte additionnel.",
    "Toutes les chaînes de caractères (tripName, description, placeName) doivent être rédigées en français.",
    "Les descriptions doivent être courtes (1 à 2 phrases).",
    "Les coordonnées GPS (lat/lng) doivent rester réalistes et cohérentes avec le point de départ fourni par l'utilisateur — ne place jamais une étape à des centaines de kilomètres sans que cela soit justifié par le mode 'trip'.",
  ].join(" ");
}

export function buildUserPrompt(request: GenerateItineraryRequest): string {
  const { budget, ambiance, distance, mode, location } = request;

  const budgetLabel = describeLevel(
    budget,
    "petit budget, privilégier des options peu coûteuses voire gratuites",
    "budget modéré",
    "budget confortable, options plus haut de gamme acceptées"
  );
  const ambianceLabel = describeLevel(
    ambiance,
    "ambiance calme et posée",
    "ambiance conviviale et animée sans excès",
    "ambiance festive et énergique"
  );

  return [
    `Génère un itinéraire pour ${MODE_LABELS[mode]}.`,
    `Point de départ : ${describeLocation(location)}.`,
    `Budget souhaité (0-100=${budget}) : ${budgetLabel}.`,
    `Ambiance souhaitée (0-100=${ambiance}) : ${ambianceLabel}.`,
    `Distance souhaitée (0-100=${distance}). ${DISTANCE_HINTS[mode]}`,
    "Structure les étapes par jour (day, à partir de 1) et par période (morning/midday/evening), avec au moins une étape par période pertinente.",
    "Choisis un type (`type`) cohérent pour chaque étape parmi la liste imposée par le schéma.",
  ].join("\n");
}
