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
        isActive
          ? "border-transparent bg-brand-gradient [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]"
          : "border-border bg-surface"
      )}
    >
      <span
        className={clsx(
          "text-xs uppercase tracking-wide",
          isActive ? "text-text-primary/90" : "text-text-secondary"
        )}
      >
        {PERIOD_LABELS[step.period]}
      </span>
      <span className="text-base font-semibold text-text-primary">{step.placeName}</span>
      <span
        className={clsx("text-sm", isActive ? "text-text-primary/90" : "text-text-secondary")}
      >
        {step.description}
      </span>
    </button>
  );
}
