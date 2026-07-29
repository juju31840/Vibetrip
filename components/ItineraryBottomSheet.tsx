"use client";

import { useState } from "react";
import { Drawer } from "vaul";
import { StepCard } from "@/components/StepCard";
import type { ItineraryStep } from "@/types/itinerary";

interface ItineraryBottomSheetProps {
  steps: ItineraryStep[];
  activeStepId: string | null;
  onSelectStep: (stepId: string) => void;
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

const SNAP_POINTS = [0.2, 0.55, 0.92];

export function ItineraryBottomSheet({
  steps,
  activeStepId,
  onSelectStep,
}: ItineraryBottomSheetProps) {
  const [snap, setSnap] = useState<number | string | null>(SNAP_POINTS[1]);
  const dayGroups = groupStepsByDay(steps);

  return (
    <Drawer.Root
      open
      onOpenChange={() => {}}
      modal={false}
      snapPoints={SNAP_POINTS}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
    >
      <Drawer.Portal>
        <Drawer.Content className="fixed bottom-0 left-0 right-0 flex max-h-[92vh] flex-col rounded-t-sheet border-t border-border bg-surface">
          <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-border" />
          <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
            {dayGroups.map(([day, daySteps]) => (
              <div key={day} className="mb-6 flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-text-secondary">Jour {day}</h2>
                {daySteps.map((step) => (
                  <StepCard
                    key={step.id}
                    step={step}
                    isActive={step.id === activeStepId}
                    onSelect={onSelectStep}
                  />
                ))}
              </div>
            ))}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
