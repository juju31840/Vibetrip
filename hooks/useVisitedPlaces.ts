"use client";

import { useCallback, useEffect, useState } from "react";
import { localVisitedPlaceStore, type VisitedPlace } from "@/lib/places-store";
import { reverseGeocodeCity } from "@/lib/reverse-geocode";
import type { ItineraryStep } from "@/types/itinerary";

/**
 * État React au-dessus du magasin de lieux visités. La lecture initiale est faite dans un effet
 * et non au premier rendu : `localStorage` n'existe pas au rendu serveur, et lire directement
 * produirait une hydratation divergente entre le HTML envoyé et le premier rendu client.
 */
export function useVisitedPlaces() {
  const [places, setPlaces] = useState<VisitedPlace[]>([]);

  useEffect(() => {
    setPlaces(localVisitedPlaceStore.list());
  }, []);

  /**
   * Résout la commune des lieux qui n'en ont pas encore — les nouveaux comme ceux enregistrés
   * avant que la ville n'existe dans le modèle. Un échec est écrit comme `null` et non laissé
   * en `undefined` : sans cela l'effet retenterait indéfiniment le même appel qui échoue.
   */
  useEffect(() => {
    const pending = places.filter((place) => place.city === undefined);
    if (pending.length === 0) return;

    let cancelled = false;
    (async () => {
      for (const place of pending) {
        const city = await reverseGeocodeCity(place.location);
        if (cancelled) return;
        localVisitedPlaceStore.setCity(place.key, city);
      }
      if (!cancelled) setPlaces(localVisitedPlaceStore.list());
    })();

    return () => {
      cancelled = true;
    };
  }, [places]);

  const recordVisit = useCallback((itineraryId: string, step: ItineraryStep) => {
    localVisitedPlaceStore.record(itineraryId, step);
    setPlaces(localVisitedPlaceStore.list());
  }, []);

  const forgetVisit = useCallback((itineraryId: string, stepId: string) => {
    localVisitedPlaceStore.forget(itineraryId, stepId);
    setPlaces(localVisitedPlaceStore.list());
  }, []);

  return { places, recordVisit, forgetVisit };
}
