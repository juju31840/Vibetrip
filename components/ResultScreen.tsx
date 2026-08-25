"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ItineraryBottomSheet } from "@/components/ItineraryBottomSheet";
import { Button } from "@/components/ui/Button";
import type { Itinerary } from "@/types/itinerary";

const MapView = dynamic(() => import("@/components/MapView").then((mod) => mod.MapView), {
  ssr: false,
});

interface ResultScreenProps {
  itinerary: Itinerary;
  onRestart: () => void;
}

export function ResultScreen({ itinerary, onRestart }: ResultScreenProps) {
  // Volontairement null au montage : sélectionner une étape d'emblée déclencherait le
  // `flyTo` de MapView, qui écraserait le `fitBounds` initial et masquerait les autres
  // étapes. La vue d'ensemble d'abord, le zoom seulement sur action de l'utilisateur.
  const [activeStepId, setActiveStepId] = useState<string | null>(null);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0">
        <MapView
          steps={itinerary.steps}
          activeStepId={activeStepId}
          onMarkerClick={setActiveStepId}
        />
      </div>

      <div className="absolute left-4 right-4 top-4 flex items-center justify-between rounded-2xl bg-surface/90 px-4 py-3 backdrop-blur">
        <span className="truncate text-sm font-medium text-text-primary">
          {itinerary.tripName}
        </span>
        <Button variant="ghost" onClick={onRestart} className="px-3 py-1 text-xs">
          Nouveau
        </Button>
      </div>

      <ItineraryBottomSheet
        steps={itinerary.steps}
        activeStepId={activeStepId}
        onSelectStep={setActiveStepId}
      />
    </main>
  );
}
