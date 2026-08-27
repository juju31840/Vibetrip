"use client";

import { Slider } from "@/components/ui/Slider";
import { vibeLabel } from "@/lib/vibe-labels";
import type { VibeSettings } from "@/types/itinerary";

/**
 * Les curseurs affichent un mot, pas un nombre : « 72 » ne veut rien dire pour l'utilisateur et
 * donne au réglage un air de paramètre technique. Les mots viennent de `lib/vibe-labels.ts`,
 * indexés par la même fonction que les consignes envoyées au modèle — ce qui est lu à l'écran
 * est donc exactement ce qui est demandé à la génération.
 *
 * Plus de panneau autour d'eux : trois rangées séparées par des filets noirs. Le cadre blanc
 * arrondi appartenait à la direction précédente et faisait à lui seul une bonne part du « ça
 * fait IA ».
 */
interface VibeSlidersProps {
  value: VibeSettings;
  onChange: (value: VibeSettings) => void;
}

export function VibeSliders({ value, onChange }: VibeSlidersProps) {
  return (
    <div className="flex flex-col gap-3.5">
      <Slider
        label="Budget"
        valueLabel={vibeLabel("budget", value.budget)}
        value={value.budget}
        onChange={(budget) => onChange({ ...value, budget })}
      />
      <Slider
        label="Ambiance"
        valueLabel={vibeLabel("ambiance", value.ambiance)}
        value={value.ambiance}
        onChange={(ambiance) => onChange({ ...value, ambiance })}
      />
      <Slider
        label="Distance"
        valueLabel={vibeLabel("distance", value.distance)}
        value={value.distance}
        onChange={(distance) => onChange({ ...value, distance })}
      />
    </div>
  );
}
