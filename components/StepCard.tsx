"use client";

import clsx from "clsx";
import { CheckIcon, PinIcon } from "@/components/ui/icons";
import { buildMapsUrl } from "@/lib/maps";
import type { ItineraryStep } from "@/types/itinerary";

const PERIOD_LABELS: Record<ItineraryStep["period"], string> = {
  morning: "Matin",
  midday: "Midi",
  evening: "Soir",
};

interface StepCardProps {
  step: ItineraryStep;
  /** Trajet depuis l'étape précédente du même jour — calculé, jamais généré. */
  trajet?: string | null;
  /** Le lieu a fermé depuis l'enregistrement de l'itinéraire (lib/closed-places.ts). */
  closedOn?: string | null;
  isActive: boolean;
  isDone: boolean;
  onSelect: (stepId: string) => void;
  onToggleDone: (stepId: string) => void;
}

/**
 * Une étape se lit comme une ligne de programme d'affiche : un filet au-dessus, le créneau en
 * petites capitales, le nom en grasse condensée. Plus de carte blanche arrondie — c'était l'un
 * des trois traits qui faisaient reconnaître l'interface comme générée.
 */
export function StepCard({ step, closedOn, trajet, isActive, isDone, onSelect, onToggleDone }: StepCardProps) {
  return (
    <>
      {/* Le trajet depuis l'étape précédente. Posé entre deux étapes plutôt que dans l'une
          d'elles, parce que c'est ce qu'il est : un entre-deux. C'est aussi la seule ligne de
          l'écran que le modèle n'a pas écrite — elle sort des coordonnées, donc elle ne peut
          pas sonner comme un gabarit. */}
      {trajet && (
        <span className="flex items-center gap-2 pl-9 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-ink-mute">
          <span aria-hidden className="h-3 w-px bg-ink-mute" />
          {trajet}
        </span>
      )}
      <div
        className={clsx(
          "flex gap-3 border-t-2 border-ink px-1 py-3 transition-colors",
          isActive && "bg-paper-2"
        )}
      >
      {/* Hook de rétention : cocher une étape sur place donne une raison de rouvrir l'app
          pendant la sortie, et pas seulement au moment de la générer. Elle alimente aussi la
          carte personnelle (lib/places-store.ts), qui est la contrepartie du geste. */}
      <button
        type="button"
        onClick={() => onToggleDone(step.id)}
        aria-pressed={isDone}
        aria-label={isDone ? "Marquer comme non fait" : "J'y suis allé"}
        className={clsx(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border-2 border-ink transition-colors",
          isDone ? "bg-blue text-paper" : "bg-transparent text-transparent hover:bg-paper-3"
        )}
      >
        <CheckIcon className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        onClick={() => onSelect(step.id)}
        className="flex min-w-0 flex-1 flex-col text-left"
      >
        <span className="text-overline uppercase text-ink-soft">{PERIOD_LABELS[step.period]}</span>
        <span
          className={clsx(
            "mt-0.5 font-display text-[1.35rem] uppercase leading-[1.04] tracking-[-0.01em]",
            isDone ? "text-ink-mute line-through decoration-2" : "text-ink"
          )}
        >
          {step.placeName}
        </span>
        <span className="mt-1 text-body text-ink-soft">{step.description}</span>
        <VerificationNote step={step} closedOn={closedOn} />
      </button>

      {/* Fermeture de la boucle : l'utilisateur se rend réellement sur place. Ouvert dans un
          nouvel onglet pour ne pas quitter l'itinéraire en cours de sortie. */}
      <a
        href={buildMapsUrl(step)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-0.5 flex h-8 shrink-0 items-center gap-1.5 self-start border-2 border-ink px-2.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-ink transition-colors hover:bg-ink hover:text-paper"
      >
        <PinIcon className="h-3.5 w-3.5" />
        Y aller
      </a>
    </div>
    </>
  );
}

/**
 * L'accent est mis sur ce qui EST confirmé, et le doute est formulé comme un conseil de prudence
 * plutôt que comme une erreur. C'est un choix de conception, pas une coquetterie : environ la
 * moitié des étapes ne sont pas confirmées (beaucoup sont pourtant réelles mais absentes du
 * référentiel), et les signaler toutes en rouge ferait passer un produit qui fonctionne pour un
 * produit cassé.
 *
 * En direction « Riso » cela se traduit ainsi : l'adresse confirmée prend l'encre bleue, la
 * mention de prudence ne prend **aucune encre** — capitales grises soulignées d'un pointillé.
 * Le vermillon reste réservé à l'action ; l'employer ici crierait à l'erreur.
 *
 * Quand la vérification n'a pas pu avoir lieu (`null`), on n'affiche rien : prétendre un doute
 * qu'on n'a pas mesuré serait aussi trompeur que prétendre une certitude.
 */
function VerificationNote({
  step,
  closedOn,
}: {
  step: ItineraryStep;
  closedOn?: string | null;
}) {
  // La fermeture prime sur tout le reste : une adresse confirmée qui a fermé reste une porte
  // close, et c'est la seule information qui doive faire renoncer à l'étape.
  //
  // **Seul cas où le vermillon sort de son rôle d'action**, et c'est assumé. La règle du système
  // veut qu'on ne crie pas à l'erreur pour un lieu simplement non confirmé — ils sont la moitié,
  // les colorer ferait passer un produit qui marche pour un produit cassé. Un lieu fermé est
  // l'exact inverse : rare (13 % des lieux vérifiés) et sans appel. Ne pas le distinguer
  // reviendrait à laisser quelqu'un partir devant une porte close pour préserver une règle
  // graphique.
  if (closedOn !== undefined && closedOn !== null) {
    return (
      <span className="mt-1.5 inline-flex w-fit items-center gap-1.5 border-2 border-danger px-1.5 py-0.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-danger">
        Ce lieu a fermé
      </span>
    );
  }

  if (step.verified === null || step.verified === undefined) return null;

  if (step.verified) {
    return (
      <span className="mt-1.5 inline-flex items-center gap-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-blue">
        <CheckIcon className="h-3 w-3" />
        {step.address ?? "Adresse confirmée"}
      </span>
    );
  }

  return (
    <span className="mt-1.5 w-fit border-b border-dotted border-ink-mute pb-0.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-ink-mute">
      Adresse à confirmer sur place
    </span>
  );
}
