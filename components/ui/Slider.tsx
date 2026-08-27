"use client";

import { LEVEL_COUNT, levelIndex } from "@/lib/prompt";
import { VIBE_STEP } from "@/lib/vibe-labels";

interface SliderProps {
  label: string;
  /** Mot du palier courant — affiché à la place du nombre (voir VibeSliders). */
  valueLabel: string;
  value: number;
  onChange: (value: number) => void;
}

export function Slider({ label, valueLabel, value, onChange }: SliderProps) {
  const index = levelIndex(value);
  const ratio = (index / (LEVEL_COUNT - 1)) * 100;

  return (
    <div className="flex flex-col gap-2 border-b-2 border-ink pb-3">
      <div className="flex items-end justify-between gap-3">
        <span className="text-overline uppercase text-ink-soft">{label}</span>
        {/* Le mot du palier est titré en Anton : c'est le réglage lui-même qui devient l'image,
            plutôt qu'une valeur discrète posée à côté d'une piste. */}
        <span className="font-display text-[1.4rem] uppercase leading-none text-accent">
          {valueLabel}
        </span>
      </div>

      <div className="relative">
        <input
          type="range"
          min={0}
          max={100}
          // Le curseur avance par paliers : chaque position possible correspond exactement à
          // un mot. Un curseur continu laissait glisser longuement sans rien changer à l'écran.
          step={VIBE_STEP}
          value={value}
          aria-label={label}
          aria-valuetext={valueLabel}
          onChange={(event) => onChange(Number(event.target.value))}
          className="vibe-slider relative z-10 w-full cursor-pointer"
          style={{
            background: `linear-gradient(to right, #DD3B2E 0%, #DD3B2E ${ratio}%, #DBD9D2 ${ratio}%, #DBD9D2 100%)`,
          }}
        />

        {/* Repères : ils rendent les paliers visibles avant même de toucher au curseur, donc
            lisible qu'il y a cinq réglages possibles et non une course continue. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-[11px] top-1/2 z-0 flex -translate-y-1/2 justify-between"
        >
          {Array.from({ length: LEVEL_COUNT }, (_, tick) => (
            <span
              key={tick}
              className="h-[7px] w-[2px]"
              style={{ background: tick <= index ? "rgba(231,229,223,0.7)" : "#84828B" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
