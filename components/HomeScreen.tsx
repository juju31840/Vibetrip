"use client";

import { useEffect, useRef } from "react";
import clsx from "clsx";
import { VibeSliders } from "@/components/VibeSliders";
import { ModeSelector } from "@/components/ModeSelector";
import { LocationInput } from "@/components/LocationInput";
import { ThemePicker } from "@/components/ThemePicker";
import { CheckIcon } from "@/components/ui/icons";
import { draftSuitPreferences, type Preferences } from "@/lib/preferences";
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
  /**
   * Amène la section « Envies » à la vue au montage. Le profil dépose des envies dans les
   * réglages puis bascule ici : sans cela on arrivait sur un écran d'apparence inchangée, les
   * cases cochées se trouvant sous la ligne de flottaison. Un geste dont on ne voit pas l'effet
   * ne se distingue pas d'un geste sans effet.
   */
  revealThemes?: boolean;
  /**
   * Préférences déclarées dans le profil. `null` quand il n'y en a pas : la case n'est alors pas
   * affichée du tout — un contrôle qui n'aurait rien à appliquer se remarque plus qu'un contrôle
   * absent, c'est la même règle qui avait tenu l'onglet « Profil » fermé tant qu'il était vide.
   */
  preferences?: Preferences | null;
  onDraftChange: (draft: HomeDraft) => void;
  onGenerate: (request: GenerateItineraryRequest) => void;
}

export function HomeScreen({
  draft,
  onDraftChange,
  onGenerate,
  revealThemes = false,
  preferences = null,
}: HomeScreenProps) {
  const canGenerate = draft.location !== null;
  const themesRef = useRef<HTMLElement>(null);
  const suitPreferences = preferences ? draftSuitPreferences(draft, preferences) : false;

  // `block: "center"` plutôt que `"start"` : la section est la dernière de la page, l'aligner en
  // haut la collerait au pied fixe. Le défilement est neutralisé sous `prefers-reduced-motion`,
  // comme partout ailleurs dans l'application.
  useEffect(() => {
    if (!revealThemes) return;
    const doux = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    themesRef.current?.scrollIntoView({ behavior: doux ? "smooth" : "auto", block: "center" });
  }, [revealThemes]);

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
    // Le contenu défile, l'action reste. Mesuré : 947 px de réglages pour 767 px visibles —
    // le bouton se trouvait sous la ligne de flottaison et rien ne disait qu'il fallait
    // défiler pour l'atteindre. L'action principale d'un écran ne se cherche pas.
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 pb-6 pt-10">
      <div className="flex items-end justify-between border-b-3 border-ink pb-2">
        <h1 className="font-display text-[2.6rem] uppercase leading-[0.85] tracking-[-0.015em] text-ink">
          Vibetrip
        </h1>
      </div>

      {/* L'ordre suit celui de la décision, et c'est un changement de fond, pas de mise en page.
          L'écran demandait le budget et l'ambiance **avant** de savoir s'il s'agissait d'une
          soirée ou d'un voyage de six jours — or « budget serré » ne veut pas dire la même chose
          dans les deux cas, et le libellé du bouton lui-même dépend du mode. On décide d'abord
          quand et d'où, ensuite comment. */}
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

      {/* Une vraie coupure, et non un simple écart. Les cinq blocs avaient jusqu'ici le même
          poids et le même intervalle : rien ne disait que les deux premiers déterminent la
          sortie et que les suivants la nuancent. Un filet 3 px, ceux qui séparent les registres
          ailleurs dans le produit. */}
      <div className="border-t-3 border-ink" />

      {/* La case porte sur tout ce qui la suit — curseurs et envies — donc elle les précède.
          Cocher applique, décocher revient au réglage neutre : symétrique et réversible, alors
          qu'un bouton n'aurait laissé aucun moyen de revenir en arrière. Et son état n'est pas
          gardé à part mais **déduit** du brouillon : toucher un curseur la décoche d'elle-même,
          parce que le réglage a cessé de suivre les préférences. Une case qui resterait cochée
          en mentant serait pire que pas de case. */}
      {preferences && (
        <button
          type="button"
          role="checkbox"
          aria-checked={suitPreferences}
          onClick={() =>
            onDraftChange(
              suitPreferences
                ? { ...draft, vibe: INITIAL_DRAFT.vibe, themes: [] }
                : { ...draft, vibe: preferences.vibe, themes: preferences.themes }
            )
          }
          className="flex items-center gap-3 border-2 border-ink px-3.5 py-3 text-left transition-colors hover:bg-paper-2"
        >
          <span
            aria-hidden
            className={clsx(
              "flex h-5 w-5 shrink-0 items-center justify-center border-2 border-ink",
              suitPreferences ? "bg-accent text-paper" : "bg-paper"
            )}
          >
            {suitPreferences && <CheckIcon className="h-3.5 w-3.5" />}
          </span>
          <span className="text-[0.9375rem] font-bold uppercase tracking-[0.04em] text-ink">
            Partir de mes préférences
          </span>
        </button>
      )}

      <VibeSliders value={draft.vibe} onChange={(vibe) => onDraftChange({ ...draft, vibe })} />

      <section ref={themesRef} className="flex flex-col gap-2">
        {/* Facultatif et placé en dernier : ne rien cocher est un usage normal, et la promesse du
            produit reste qu'on obtient un programme sans rien construire. */}
        <h2 className="text-overline uppercase text-ink-soft">
          Envies <span className="text-ink-mute">— facultatif</span>
        </h2>
        <ThemePicker
          value={draft.themes}
          onChange={(themes) => onDraftChange({ ...draft, themes })}
        />
      </section>

      </div>

      {/* Pied fixe, comme sur l'écran de détail d'une proposition : les deux écrans se terminent
          par une action unique et engageante, ils doivent la présenter de la même façon. */}
      <div className="grain shrink-0 border-t-3 border-ink px-6 pb-3 pt-3">
        <Button
          variant="primary"
          disabled={!canGenerate}
          onClick={handleSubmit}
          className="flex h-14 w-full items-center justify-between px-5 text-[1rem]"
        >
          <span>{CTA_LABELS[draft.mode]}</span>
          <ArrowRightIcon className="h-[18px] w-[18px]" />
        </Button>
      </div>
    </div>
  );
}
