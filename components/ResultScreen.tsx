"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ItineraryBottomSheet } from "@/components/ItineraryBottomSheet";
import { ArrowLeftIcon } from "@/components/ui/icons";
import type { Itinerary } from "@/types/itinerary";

const MapView = dynamic(() => import("@/components/MapView").then((mod) => mod.MapView), {
  ssr: false,
});

interface ResultScreenProps {
  itinerary: Itinerary;
  doneStepIds: string[];
  onToggleStepDone: (stepId: string) => void;
  onBack: () => void;
}

export function ResultScreen({
  itinerary,
  doneStepIds,
  onToggleStepDone,
  onBack,
}: ResultScreenProps) {
  // Volontairement null au montage : sélectionner une étape d'emblée déclencherait le
  // `flyTo` de MapView, qui écraserait le `fitBounds` initial et masquerait les autres
  // étapes. La vue d'ensemble d'abord, le zoom seulement sur action de l'utilisateur.
  const [activeStepId, setActiveStepId] = useState<string | null>(null);

  return (
    <main className="relative h-[100dvh] overflow-hidden">
      {/* `pointer-events-auto` indispensable : vaul pose `pointer-events: none` sur <body>
          tant que la sheet est ouverte, ce qui rendait la carte impossible à déplacer et la
          flèche de retour impossible à presser — alors que les deux restaient parfaitement
          visibles. Le bug ne se voyait pas en test automatisé, où un clic programmatique
          ignore ce test de survol. */}
      <div className="pointer-events-auto absolute inset-0">
        <MapView
          points={itinerary.steps}
          activeId={activeStepId}
          onMarkerClick={setActiveStepId}
        />
      </div>

      {/* Pas de barre d'onglets ici : l'écran de résultat est une vue de détail immersive et la
          bottom sheet occupe déjà le bas de l'écran. Le retour est donc explicite, en haut à
          gauche — un écran sans sortie visible est le premier reproche qu'on lui a fait. */}
      <div
        className="grain pointer-events-auto absolute left-3 right-3 z-30 flex items-center gap-2 border-2 border-ink px-2 py-2 shadow-print"
        // L'encoche et les barres système ne sont pas comptées dans la zone de mise en page :
        // sans cet écart, la flèche se retrouve sous elles sur les téléphones récents.
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Revenir à mes itinéraires"
          className="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-ink text-ink transition-colors hover:bg-ink hover:text-paper"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <span className="min-w-0 flex-1 truncate font-display text-[1.3rem] uppercase leading-none tracking-[-0.01em] text-ink">
          {itinerary.tripName}
        </span>
      </div>

      <ItineraryBottomSheet
        steps={itinerary.steps}
        activeStepId={activeStepId}
        doneStepIds={doneStepIds}
        onSelectStep={setActiveStepId}
        onToggleStepDone={onToggleStepDone}
      />
    </main>
  );
}
