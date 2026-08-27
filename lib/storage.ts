"use client";

import type { Itinerary } from "@/types/itinerary";

/**
 * Persistance des itinéraires — étage « Local » de la progression API → Local → Cloud.
 *
 * Toute la couche passe par `ItineraryStore` pour que le basculement vers Supabase soit un
 * changement d'implémentation et non une réécriture des écrans : la même interface, servie par
 * des requêtes réseau au lieu de `localStorage`. C'est aussi ce qui rendra possible le partage
 * d'un itinéraire par URL, impossible tant que les données ne quittent pas l'appareil.
 */

const STORAGE_KEY = "vibetrip.itineraries.v1";

/** Au-delà, l'historique devient une liste qu'on ne relit plus — on garde les plus récents. */
const MAX_ENTRIES = 20;

export interface SavedItinerary {
  id: string;
  itinerary: Itinerary;
  /** ISO 8601. Stocké en absolu : un « il y a 2 jours » calculé à l'écriture serait faux à la relecture. */
  savedAt: string;
  /**
   * Étapes que l'utilisateur a marquées comme faites. C'est le hook de rétention : il donne une
   * raison de rouvrir l'app *pendant* la sortie, indépendamment du mode — Tonight, Weekend et
   * Trip ont des rythmes incompatibles, mais tous trois se déroulent étape par étape.
   */
  doneStepIds: string[];
}

export interface ItineraryStore {
  list(): SavedItinerary[];
  save(itinerary: Itinerary): SavedItinerary;
  remove(id: string): void;
  toggleStepDone(id: string, stepId: string): void;
}

function readAll(): SavedItinerary[] {
  // `localStorage` jette dans plusieurs cas courants (navigation privée Safari, cookies
  // tiers bloqués, quota atteint). Aucun n'est une raison de casser l'écran de résultat :
  // la persistance est un confort, pas une dépendance de la fonction centrale.
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SavedItinerary[];
  } catch {
    return [];
  }
}

function writeAll(entries: SavedItinerary[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // Quota dépassé ou stockage indisponible : l'itinéraire reste utilisable en mémoire.
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `it-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const localItineraryStore: ItineraryStore = {
  list() {
    if (typeof window === "undefined") return [];
    return readAll();
  },

  save(itinerary) {
    const entry: SavedItinerary = {
      id: newId(),
      itinerary,
      savedAt: new Date().toISOString(),
      doneStepIds: [],
    };
    if (typeof window === "undefined") return entry;
    writeAll([entry, ...readAll()]);
    return entry;
  },

  remove(id) {
    if (typeof window === "undefined") return;
    writeAll(readAll().filter((entry) => entry.id !== id));
  },

  toggleStepDone(id, stepId) {
    if (typeof window === "undefined") return;
    writeAll(
      readAll().map((entry) => {
        if (entry.id !== id) return entry;
        const done = entry.doneStepIds.includes(stepId)
          ? entry.doneStepIds.filter((value) => value !== stepId)
          : [...entry.doneStepIds, stepId];
        return { ...entry, doneStepIds: done };
      })
    );
  },
};
