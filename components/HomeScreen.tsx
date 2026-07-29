"use client";

import { useState } from "react";
import { VibeSliders } from "@/components/VibeSliders";
import { ModeSelector } from "@/components/ModeSelector";
import { LocationInput } from "@/components/LocationInput";
import { Button } from "@/components/ui/Button";
import type {
  GenerateItineraryRequest,
  LocationInput as LocationValue,
  TripMode,
  VibeSettings,
} from "@/types/itinerary";

interface HomeScreenProps {
  onGenerate: (request: GenerateItineraryRequest) => void;
}

export function HomeScreen({ onGenerate }: HomeScreenProps) {
  const [vibe, setVibe] = useState<VibeSettings>({ budget: 50, ambiance: 50, distance: 50 });
  const [mode, setMode] = useState<TripMode | null>(null);
  const [location, setLocation] = useState<LocationValue | null>(null);

  const canGenerate = mode !== null && location !== null;

  function handleSubmit() {
    if (!mode || !location) return;
    onGenerate({ ...vibe, mode, location });
  }

  return (
    <main className="flex min-h-screen flex-col justify-between gap-8 px-6 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-text-primary">VibeTrip</h1>
        <p className="text-sm text-text-secondary">
          Règle ta vibe, choisis un mode, laisse l&apos;IA construire l&apos;itinéraire.
        </p>
      </div>

      <div className="flex flex-col gap-8">
        <VibeSliders value={vibe} onChange={setVibe} />
        <ModeSelector value={mode} onChange={setMode} />
        <LocationInput value={location} onChange={setLocation} />
      </div>

      <Button variant="primary" disabled={!canGenerate} onClick={handleSubmit} className="w-full">
        Générer mon itinéraire
      </Button>
    </main>
  );
}
