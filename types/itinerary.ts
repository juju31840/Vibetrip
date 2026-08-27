export type TripMode = "tonight" | "weekend" | "trip";

export type Period = "morning" | "midday" | "evening";

export type PlaceType =
  | "restaurant"
  | "bar"
  | "cafe"
  | "museum"
  | "park"
  | "viewpoint"
  | "activity"
  | "shopping"
  | "nightlife"
  | "hotel"
  | "transport"
  | "other";

/**
 * Envies exprimées au réglage, et onglets du panneau « Changer ». Déclarées ici plutôt que dans
 * `lib/themes.ts` pour que la couche des types ne dépende de rien — c'est la liste de `lib/themes.ts`
 * qui doit se conformer à cette union, et non l'inverse.
 */
export type ThemeId = "eat" | "drink" | "culture" | "outdoor" | "night" | "shopping";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export type LocationInput = GeoPoint | { city: string };

export interface ItineraryStep {
  id: string;
  day: number;
  period: Period;
  placeName: string;
  description: string;
  location: GeoPoint;
  type: PlaceType;
  /**
   * Résultat de la confrontation au référentiel de lieux (lib/verify-places.ts) :
   * `true` = lieu confirmé, nom/coordonnées/adresse remplacés par ceux du référentiel ;
   * `false` = introuvable ou correspondance rejetée, à signaler à l'utilisateur ;
   * `null` = vérification impossible (token absent, Mapbox indisponible) — on ne sait pas.
   * Absent sur un itinéraire qui n'est pas passé par la vérification (mock, tests).
   */
  verified?: boolean | null;
  /** Adresse réelle issue du référentiel, uniquement quand `verified` vaut `true`. */
  address?: string | null;
}

export interface Itinerary {
  /** Identifiant de la proposition, attribué côté serveur — sert à la sélection avant validation. */
  id: string;
  tripName: string;
  /** Une phrase disant ce qui distingue cette proposition des autres (« plutôt gastronomique »). */
  summary: string;
  mode: TripMode;
  totalDays: number;
  steps: ItineraryStep[];
}

export interface VibeSettings {
  budget: number;
  ambiance: number;
  distance: number;
}

export interface GenerateItineraryRequest extends VibeSettings {
  mode: TripMode;
  location: LocationInput;
  /**
   * Envies de l'utilisateur. Facultatives et cumulables : vide = aucune contrainte, on laisse le
   * modèle composer librement. Elles orientent la génération sans la dicter — voir `lib/prompt.ts`.
   */
  themes?: ThemeId[];
}

/**
 * Un point posé sur la carte. Volontairement plus pauvre qu'une étape : la carte personnelle
 * affiche des lieux visités, qui n'ont ni jour, ni période, ni ordre de passage.
 * `ItineraryStep` en est un sur-ensemble, donc utilisable tel quel.
 */
export interface MapPoint {
  id: string;
  placeName: string;
  location: GeoPoint;
  /**
   * Texte porté par le marqueur. Sert à agréger : sur la vue France de « Ma carte », un marqueur
   * par ville portant le nombre de lieux, plutôt qu'une grappe de points superposés.
   */
  label?: string;
}

/**
 * Événements du flux de génération (NDJSON, une ligne = un événement).
 *
 * La réponse n'est plus un objet unique livré à la fin : 94 % du temps d'attente mesuré est
 * passé dans le modèle (8 547 ms contre 481 ms de vérification), et les propositions étant
 * déjà générées en parallèle, attendre la plus lente pour toutes les montrer faisait payer à
 * l'utilisateur le pire des trois appels au lieu du meilleur. Chaque proposition part donc
 * dès qu'elle est prête.
 *
 * Plusieurs propositions, et non une seule : imposer un unique itinéraire ne laisse d'autre
 * choix que de l'accepter ou de tout relancer. L'utilisateur en compare quelques-unes, en
 * choisit une, puis la valide — c'est la validation qui l'enregistre dans « Mes sorties ».
 */
export type GenerationEvent =
  /** Envoyé en premier : dit combien de propositions sont en route, pour annoncer l'attente. */
  | { type: "start"; expected: number }
  | { type: "proposal"; itinerary: Itinerary }
  /**
   * Émis seulement si *aucune* proposition n'a abouti. Une panne partielle ne produit pas
   * d'erreur : deux itinéraires valent mieux qu'un écran d'erreur.
   */
  | { type: "error"; error: ApiErrorResponse["error"] };

export type ApiErrorCode =
  | "INVALID_INPUT"
  | "RATE_LIMITED"
  | "PARSE_ERROR"
  | "CLAUDE_ERROR"
  | "TIMEOUT"
  | "IMPLAUSIBLE_LOCATIONS";

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
  };
}
