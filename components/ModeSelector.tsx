"use client";

import clsx from "clsx";
import { CalendarIcon, LuggageIcon, MoonIcon } from "@/components/ui/icons";
import type { TripMode } from "@/types/itinerary";

// Libellés en français : « Tonight / Weekend / Trip » dans une application française sonnait
// comme un gabarit non traduit — un des détails qui lui donnaient un air de produit générique.
const MODES: { value: TripMode; label: string; Icon: (props: { className?: string }) => JSX.Element }[] = [
  { value: "tonight", label: "Ce soir", Icon: MoonIcon },
  { value: "weekend", label: "Week-end", Icon: CalendarIcon },
  { value: "trip", label: "Voyage", Icon: LuggageIcon },
];

interface ModeSelectorProps {
  /** Jamais null : un mode est toujours sélectionné, « Ce soir » par défaut (voir HomeScreen). */
  value: TripMode;
  onChange: (mode: TripMode) => void;
}

/**
 * Trois pavés jointifs, cernés d'un seul filet — la bande d'un imprimé, pas trois boutons posés.
 * Le mode retenu est un aplat d'encre noire : c'est le contraste le plus fort du système, donc
 * la sélection se lit à un mètre.
 */
export function ModeSelector({ value, onChange }: ModeSelectorProps) {
  return (
    <div className="grid grid-cols-3 border-2 border-ink">
      {MODES.map(({ value: mode, label, Icon }, index) => {
        const isActive = value === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            aria-pressed={isActive}
            className={clsx(
              "flex flex-col items-center gap-1.5 py-3 transition-colors",
              index > 0 && "border-l-2 border-ink",
              isActive ? "bg-ink text-paper" : "bg-transparent text-ink-soft hover:bg-paper-2"
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[0.6875rem] font-bold uppercase tracking-[0.1em]">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
