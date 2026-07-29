"use client";

import clsx from "clsx";
import type { TripMode } from "@/types/itinerary";

const MODES: { value: TripMode; label: string }[] = [
  { value: "tonight", label: "Tonight" },
  { value: "weekend", label: "Weekend" },
  { value: "trip", label: "Trip" },
];

interface ModeSelectorProps {
  value: TripMode | null;
  onChange: (mode: TripMode) => void;
}

export function ModeSelector({ value, onChange }: ModeSelectorProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {MODES.map((mode) => {
        const isActive = value === mode.value;
        return (
          <button
            key={mode.value}
            type="button"
            onClick={() => onChange(mode.value)}
            className={clsx(
              "rounded-2xl border px-4 py-3 text-sm font-medium transition-colors",
              isActive
                ? "border-transparent bg-brand-gradient text-text-primary font-semibold [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]"
                : "border-border bg-surface text-text-secondary"
            )}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
