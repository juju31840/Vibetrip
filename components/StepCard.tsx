"use client";

import clsx from "clsx";
import type { ItineraryStep } from "@/types/itinerary";

const PERIOD_LABELS: Record<ItineraryStep["period"], string> = {
  morning: "Matin",
  midday: "Midi",
  evening: "Soir",
};

interface StepCardProps {
  step: ItineraryStep;
  isActive: boolean;
  onSelect: (stepId: string) => void;
}

export function StepCard({ step, isActive, onSelect }: StepCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(step.id)}
      className={clsx(
        "flex w-full flex-col gap-1 rounded-2xl border px-4 py-3 text-left transition-colors",
        isActive ? "border-transparent bg-brand-gradient" : "border-border bg-surface"
      )}
    >
      <span className="text-xs uppercase tracking-wide text-text-secondary">
        {PERIOD_LABELS[step.period]}
      </span>
      <span className="text-base font-medium text-text-primary">{step.placeName}</span>
      <span className="text-sm text-text-secondary">{step.description}</span>
    </button>
  );
}
