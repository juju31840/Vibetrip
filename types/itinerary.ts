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
}

export interface Itinerary {
  tripName: string;
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
}

export interface GenerateItineraryResponse {
  itinerary: Itinerary;
}

export type ApiErrorCode =
  | "INVALID_INPUT"
  | "RATE_LIMITED"
  | "PARSE_ERROR"
  | "CLAUDE_ERROR"
  | "TIMEOUT";

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
  };
}
