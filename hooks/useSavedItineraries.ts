"use client";

import { useCallback, useEffect, useState } from "react";
import { localItineraryStore, type SavedItinerary } from "@/lib/storage";
import type { Itinerary } from "@/types/itinerary";

/**
 * État React au-dessus du store d'itinéraires. La lecture initiale est faite dans un effet et
 * non au premier rendu : `localStorage` n'existe pas au rendu serveur, et lire directement
 * produirait une hydratation divergente entre le HTML envoyé et le premier rendu client.
 */
export function useSavedItineraries() {
  const [saved, setSaved] = useState<SavedItinerary[]>([]);

  useEffect(() => {
    setSaved(localItineraryStore.list());
  }, []);

  const save = useCallback((itinerary: Itinerary): SavedItinerary => {
    const entry = localItineraryStore.save(itinerary);
    setSaved(localItineraryStore.list());
    return entry;
  }, []);

  const remove = useCallback((id: string) => {
    localItineraryStore.remove(id);
    setSaved(localItineraryStore.list());
  }, []);

  const toggleStepDone = useCallback((id: string, stepId: string) => {
    localItineraryStore.toggleStepDone(id, stepId);
    setSaved(localItineraryStore.list());
  }, []);

  return { saved, save, remove, toggleStepDone };
}
