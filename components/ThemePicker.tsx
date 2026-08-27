"use client";

import { chipClass } from "@/components/ui/chip";
import { THEMES } from "@/lib/themes";
import type { ThemeId } from "@/types/itinerary";

interface ThemePickerProps {
  value: ThemeId[];
  onChange: (themes: ThemeId[]) => void;
}

/**
 * Les envies, exprimées **avant** la génération.
 *
 * Ces mêmes thèmes n'existaient jusqu'ici que dans le panneau « Changer » d'une étape : on ne
 * pouvait dire « plutôt de la culture » qu'après coup, en corrigeant une étape qu'on n'avait pas
 * demandée. Les remonter au réglage, c'est laisser exprimer l'envie au moment où on l'a.
 *
 * Facultatif et cumulable, et rien n'est coché par défaut : la promesse du produit est qu'on
 * obtient un programme sans rien construire. Ce réglage ajoute une intention, il n'ajoute pas
 * une obligation — d'où l'étiquette « facultatif » affichée plutôt que sous-entendue.
 */
export function ThemePicker({ value, onChange }: ThemePickerProps) {
  function toggle(id: ThemeId) {
    onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {THEMES.map((theme) => {
        const isActive = value.includes(theme.id);
        return (
          <button
            key={theme.id}
            type="button"
            onClick={() => toggle(theme.id)}
            aria-pressed={isActive}
            className={chipClass(isActive)}
          >
            {theme.label}
          </button>
        );
      })}
    </div>
  );
}
