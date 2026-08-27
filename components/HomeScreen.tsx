"use client";

import { VibeSliders } from "@/components/VibeSliders";
import { ModeSelector } from "@/components/ModeSelector";
import { LocationInput } from "@/components/LocationInput";
import { ThemePicker } from "@/components/ThemePicker";
import { Button } from "@/components/ui/Button";
import { ArrowRightIcon } from "@/components/ui/icons";
import type {
  GenerateItineraryRequest,
  LocationInput as LocationValue,
  ThemeId,
  TripMode,
  VibeSettings,
} from "@/types/itinerary";

/**
 * Les réglages en cours de saisie.
 *
 * Ils vivent dans `app/page.tsx` et non dans cet écran : la coque à onglets démonte « Créer »
 * dès qu'on passe sur « Mes sorties » ou « Ma carte », et un état local repartait donc de zéro
 * à chaque aller-retour — on perdait ses curseurs, son mode et sa ville pour être allé jeter un
 * œil ailleurs. Le défaut existait avant le troisième onglet ; il est devenu voyant avec lui.
 */
export interface HomeDraft {
  vibe: VibeSettings;
  mode: TripMode;
  location: LocationValue | null;
  /** Texte du champ ville, distinct de `location` qui reste null tant que la saisie est vide. */
  cityText: string;
  /** Envies cochées. Vide par défaut : ne rien cocher est un usage normal, pas un oubli. */
  themes: ThemeId[];
}

/**
 * Un mode est sélectionné d'emblée, et c'est « Ce soir ». Aucun ne l'était auparavant, alors que
 * le bouton annonçait déjà « Trouver ma soirée » : on croyait le mode choisi, le bouton restait
 * inactif, et rien ne disait pourquoi. « Ce soir » est aussi le mode le plus répétable des trois,
 * donc le bon défaut.
 */
export const INITIAL_DRAFT: HomeDraft = {
  vibe: { budget: 50, ambiance: 50, distance: 50 },
  mode: "tonight",
  location: null,
  cityText: "",
  themes: [],
};

/** Le libellé suit le mode — il promettait « ma soirée » même en week-end ou en voyage. */
const CTA_LABELS: Record<TripMode, string> = {
  tonight: "Trouver ma soirée",
  weekend: "Trouver mon week-end",
  trip: "Trouver mon voyage",
};

interface HomeScreenProps {
  draft: HomeDraft;
  onDraftChange: (draft: HomeDraft) => void;
  onGenerate: (request: GenerateItineraryRequest) => void;
}

export function HomeScreen({ draft, onDraftChange, onGenerate }: HomeScreenProps) {
  const canGenerate = draft.location !== null;

  function handleSubmit() {
    if (!draft.location) return;
    onGenerate({
      ...draft.vibe,
      mode: draft.mode,
      location: draft.location,
      themes: draft.themes,
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 pb-6 pt-10">
      <div className="flex items-end justify-between border-b-3 border-ink pb-2">
        <h1 className="font-display text-[2.6rem] uppercase leading-[0.85] tracking-[-0.015em] text-ink">
          Vibetrip
        </h1>
      </div>

      <VibeSliders value={draft.vibe} onChange={(vibe) => onDraftChange({ ...draft, vibe })} />

      <section className="flex flex-col gap-2">
        {/* Placées avec les curseurs et non près du bouton : c'est un réglage de goût, il se
            décide au même moment que le budget et l'ambiance. */}
        <h2 className="text-overline uppercase text-ink-soft">
          Envies <span className="text-ink-mute">— facultatif</span>
        </h2>
        <ThemePicker
          value={draft.themes}
          onChange={(themes) => onDraftChange({ ...draft, themes })}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-overline uppercase text-ink-soft">Quand</h2>
        <ModeSelector value={draft.mode} onChange={(mode) => onDraftChange({ ...draft, mode })} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-overline uppercase text-ink-soft">Au départ de</h2>
        <LocationInput
          value={draft.location}
          cityText={draft.cityText}
          onChange={({ value, cityText }) => onDraftChange({ ...draft, location: value, cityText })}
        />
      </section>

      <Button
        variant="primary"
        disabled={!canGenerate}
        onClick={handleSubmit}
        className="mt-auto flex h-14 w-full items-center justify-between px-5 text-[1rem]"
      >
        <span>{CTA_LABELS[draft.mode]}</span>
        <ArrowRightIcon className="h-[18px] w-[18px]" />
      </Button>
    </div>
  );
}
