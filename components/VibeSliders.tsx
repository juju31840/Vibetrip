"use client";

import { Slider } from "@/components/ui/Slider";
import type { VibeSettings } from "@/types/itinerary";

interface VibeSlidersProps {
  value: VibeSettings;
  onChange: (value: VibeSettings) => void;
}

export function VibeSliders({ value, onChange }: VibeSlidersProps) {
  return (
    <div className="flex flex-col gap-5">
      <Slider
        label="Budget"
        value={value.budget}
        onChange={(budget) => onChange({ ...value, budget })}
      />
      <Slider
        label="Ambiance"
        value={value.ambiance}
        onChange={(ambiance) => onChange({ ...value, ambiance })}
      />
      <Slider
        label="Distance"
        value={value.distance}
        onChange={(distance) => onChange({ ...value, distance })}
      />
    </div>
  );
}
