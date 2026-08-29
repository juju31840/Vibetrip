"use client";

import { useState } from "react";
import { Drawer } from "vaul";
import { StepCard } from "@/components/StepCard";
import { trajetDepuis, formatTrajet } from "@/lib/walking";
import type { ItineraryStep } from "@/types/itinerary";

interface ItineraryBottomSheetProps {
  steps: ItineraryStep[];
  activeStepId: string | null;
  doneStepIds: string[];
  /** Nom d'étape → date de fermeture constatée (lib/closed-places.ts). */
  closedSteps?: Map<string, string | null>;
  onSelectStep: (stepId: string) => void;
  onToggleStepDone: (stepId: string) => void;
}

function groupStepsByDay(steps: ItineraryStep[]): [number, ItineraryStep[]][] {
  const groups = new Map<number, ItineraryStep[]>();
  for (const step of steps) {
    const dayGroup = groups.get(step.day) ?? [];
    dayGroup.push(step);
    groups.set(step.day, dayGroup);
  }
  return [...groups.entries()].sort(([dayA], [dayB]) => dayA - dayB);
}

const SNAP_POINTS: (number | string)[] = [0.2, 0.55, 0.92];

export function ItineraryBottomSheet({
  steps,
  activeStepId,
  doneStepIds,
  closedSteps,
  onSelectStep,
  onToggleStepDone,
}: ItineraryBottomSheetProps) {
  // La sheet s'ouvre sur le premier snap point, et pas sur un autre : au premier rendu
  // vaul n'a pas encore mesuré la fenêtre, tous ses offsets valent 0, et son
  // `snapToPoint(0)` se termine par `setActiveSnapPoint(snapPoints[0])` — qui écrase toute
  // valeur initiale différente puisque le composant est contrôlé. Ouvrir sur l'aperçu
  // convient de toute façon à une app centrée carte : l'itinéraire se déplie au glissement.
  const [snap, setSnap] = useState<number | string | null>(SNAP_POINTS[0]!);
  const dayGroups = groupStepsByDay(steps);
  const doneCount = steps.filter((step) => doneStepIds.includes(step.id)).length;

  return (
    <Drawer.Root
      open
      onOpenChange={() => {}}
      modal={false}
      // La sheet fait partie de l'écran de résultat : la faire glisser vers le bas doit
      // la replier sur l'aperçu, jamais la fermer (elle n'a aucun moyen d'être rouverte).
      dismissible={false}
      snapPoints={SNAP_POINTS}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
    >
      <Drawer.Portal>
        {/* Pleine hauteur (et non `max-h-[92vh]`) : vaul traduit la sheet de
            (1 - snap) × hauteur de fenêtre. Le calcul ne donne « snap % visibles » que si
            l'élément fait toute la hauteur de la fenêtre — sinon le décalage est appliqué à
            un élément plus court ancré en bas et la sheet ne montre qu'un liseré. */}
        {/* `z-20` indispensable : les contrôles Mapbox (logo, attribution) sont en
            `z-index: 2`, et sans niveau explicite ils passent par-dessus la sheet. */}
        <Drawer.Content className="grain fixed bottom-0 left-0 right-0 z-20 flex h-screen flex-col border-t-3 border-ink">
          <div className="mx-auto mt-2.5 h-1 w-12 bg-ink" />

          {/* Visible dès l'aperçu replié : c'est l'information qui donne envie de rouvrir
              l'app pendant la sortie plutôt qu'une fois rentré. */}
          <div className="flex items-center justify-between px-5 pb-1 pt-3">
            <span className="text-overline uppercase text-ink-soft">Itinéraire</span>
            <span className="text-overline uppercase text-blue">
              {doneCount}/{steps.length} faites
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-10 pt-2">
            {dayGroups.map(([day, daySteps]) => (
              <div key={day} className="mb-6 flex flex-col">
                <h2 className="mt-3 pb-1.5 font-display text-[1.6rem] uppercase leading-none tracking-[-0.01em] text-ink">
                  Jour {day}
                </h2>
                {daySteps.map((step, index) => {
                  const precedente = index > 0 ? daySteps[index - 1] : undefined;
                  const trajet = precedente ? trajetDepuis(precedente, step) : null;
                  return (
                  <StepCard
                    key={step.id}
                    step={step}
                    trajet={trajet ? formatTrajet(trajet) : null}
                    closedOn={closedSteps?.get(step.placeName)}
                    isActive={step.id === activeStepId}
                    isDone={doneStepIds.includes(step.id)}
                    onSelect={onSelectStep}
                    onToggleDone={onToggleStepDone}
                  />
                  );
                })}
              </div>
            ))}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
