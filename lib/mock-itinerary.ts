import "server-only";
import { geocodeCity } from "./geocode";
import { totalDaysForMode } from "./prompt";
import { proposalCountForMode } from "./itinerary-schema";
import type { GenerateItineraryRequest, Itinerary, ItineraryStep, Period, PlaceType } from "@/types/itinerary";

/**
 * Itinéraire factice pour le développement, activé par `VIBETRIP_MOCK=1` dans `.env.local`.
 *
 * Raison d'être : chaque génération réelle consomme du crédit API Anthropic. Itérer sur la
 * carte, la bottom sheet ou le filtrage géographique n'a pas besoin d'un vrai appel — ce mock
 * traverse exactement le même pipeline (mêmes types, même filtrage de plausibilité, mêmes
 * bornes de rayon) mais sans réseau ni coût.
 *
 * Les coordonnées sont volontairement placées **dans** le rayon de plausibilité de `lib/geo.ts`
 * pour le mode et le curseur Distance demandés : le mock doit passer le filtre, pas le contourner.
 */

const PARIS = { lat: 48.8566, lng: 2.3522 };

/** Rayon (km) dans lequel disperser les étapes — la moitié du rayon de plausibilité du mode. */
const SPREAD_KM: Record<GenerateItineraryRequest["mode"], number> = {
  tonight: 3,
  weekend: 8,
  trip: 50,
};

interface MockPlace {
  placeName: string;
  description: string;
  type: PlaceType;
}

const PLACES_BY_PERIOD: Record<Period, MockPlace[]> = {
  morning: [
    { placeName: "Café des Petites Écuries", description: "Un café de quartier pour démarrer la journée en douceur, torréfaction maison.", type: "cafe" },
    { placeName: "Marché couvert", description: "Étals de producteurs et flânerie matinale entre les allées.", type: "shopping" },
    { placeName: "Jardin botanique", description: "Une boucle tranquille dans les serres avant l'affluence.", type: "park" },
  ],
  midday: [
    { placeName: "Table du Passage", description: "Petite salle sans prétention, cuisine du jour à l'ardoise.", type: "restaurant" },
    { placeName: "Musée d'art moderne", description: "Collection permanente à parcourir en une heure et demie.", type: "museum" },
    { placeName: "Belvédère de la colline", description: "Point de vue dégagé sur toute la ville, idéal en début d'après-midi.", type: "viewpoint" },
  ],
  evening: [
    { placeName: "Bar à vins du Marché", description: "Une trentaine de références au verre et des planches à partager.", type: "bar" },
    { placeName: "Cantine du Soir", description: "Adresse conviviale et animée, réservation conseillée le week-end.", type: "restaurant" },
    { placeName: "Club de la Halle", description: "Programmation électro dans une ancienne halle industrielle.", type: "nightlife" },
  ],
};

/** Décale un point de `km` kilomètres selon un angle, en degrés lat/lng. */
function offsetPoint(origin: { lat: number; lng: number }, km: number, angleRad: number) {
  const dLat = (km * Math.cos(angleRad)) / 111;
  const dLng = (km * Math.sin(angleRad)) / (111 * Math.cos((origin.lat * Math.PI) / 180));
  return { lat: origin.lat + dLat, lng: origin.lng + dLng };
}

async function buildMockItinerary(
  request: GenerateItineraryRequest,
  variant: number
): Promise<Itinerary> {
  const { mode, location, distance } = request;

  const origin =
    "lat" in location ? location : (await geocodeCity(location.city)) ?? PARIS;

  const totalDays = totalDaysForMode(mode, distance);
  // "tonight" est une soirée : trois étapes du soir plutôt qu'une journée complète.
  const periods: Period[] = mode === "tonight" ? ["evening", "evening", "evening"] : ["morning", "midday", "evening"];

  const steps: ItineraryStep[] = [];
  for (let day = 1; day <= totalDays; day += 1) {
    periods.forEach((period, indexInDay) => {
      const globalIndex = steps.length;
      const place =
        PLACES_BY_PERIOD[period][
          (day - 1 + indexInDay + variant) % PLACES_BY_PERIOD[period].length
        ]!;
      const spread = SPREAD_KM[mode] * (0.3 + 0.7 * ((globalIndex % 4) / 3));
      steps.push({
        id: `p${variant + 1}-step-${globalIndex + 1}`,
        day,
        period,
        placeName: mode === "tonight" ? place.placeName : `${place.placeName} — jour ${day}`,
        description: place.description,
        location: offsetPoint(origin, spread, (globalIndex * 2 * Math.PI) / 7),
        type: place.type,
      });
    });
  }

  const label = "city" in location ? location.city : "ta position";
  return {
    id: `proposal-${variant + 1}`,
    tripName: `[MOCK] Escapade ${MOCK_ANGLES[variant]?.name ?? variant + 1} autour de ${label}`,
    summary: MOCK_ANGLES[variant]?.summary ?? "Variante de démonstration.",
    mode,
    totalDays,
    steps,
  };
}

const MOCK_ANGLES = [
  { name: "classique", summary: "Les incontournables, sans détour." },
  { name: "gourmande", summary: "Centrée sur la table et les bonnes adresses." },
  { name: "buissonnière", summary: "À l'écart du centre, plus confidentielle." },
];

/**
 * Le mock renvoie autant de propositions que la vraie génération, et volontairement décalées
 * les unes des autres : une interface de choix testée sur trois itinéraires identiques ne
 * révélerait aucun des problèmes de lisibilité qu'elle doit justement faire apparaître.
 */
export async function buildMockItineraries(
  request: GenerateItineraryRequest
): Promise<Itinerary[]> {
  return Promise.all(
    Array.from({ length: proposalCountForMode(request.mode) }, (_, variant) =>
      buildMockItinerary(request, variant)
    )
  );
}
