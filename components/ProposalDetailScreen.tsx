"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { chipClass } from "@/components/ui/chip";
import { ArrowLeftIcon, CheckIcon } from "@/components/ui/icons";
import { THEMES, findNearby, themeForType, type ThemeId } from "@/lib/nearby-places";
import { trajetDepuis, formatTrajet } from "@/lib/walking";
import type { Itinerary, ItineraryStep } from "@/types/itinerary";

const MapView = dynamic(() => import("@/components/MapView").then((mod) => mod.MapView), {
  ssr: false,
});

const PERIOD_LABELS: Record<ItineraryStep["period"], string> = {
  morning: "Matin",
  midday: "Midi",
  evening: "Soir",
};

interface ProposalDetailScreenProps {
  proposal: Itinerary;
  onValidate: (itinerary: Itinerary) => void;
  onBack: () => void;
}

/**
 * Détail d'une proposition, et **atelier de retouche**.
 *
 * L'itinéraire arrive pré-composé — c'est tout l'intérêt du produit, et on ne demande jamais à
 * l'utilisateur de le construire. Mais chaque étape peut être échangée contre une autre du même
 * créneau, et l'ensemble revient à sa version d'origine d'un geste. Automatique par défaut,
 * modifiable si on le souhaite.
 *
 * Hauteur en `dvh` et non `vh` : `100vh` compte la zone recouverte par la barre du navigateur
 * mobile, ce qui poussait le bouton de validation hors de l'écran visible.
 */
export function ProposalDetailScreen({
  proposal,
  onValidate,
  onBack,
}: ProposalDetailScreenProps) {
  const [steps, setSteps] = useState<ItineraryStep[]>(proposal.steps);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);

  const isEdited = useMemo(
    () =>
      steps.length !== proposal.steps.length ||
      steps.some((step, index) => step.id !== proposal.steps[index]?.id),
    [steps, proposal.steps]
  );

  function replaceStep(targetId: string, replacement: ItineraryStep) {
    setSteps((current) =>
      current.map((step) => (step.id === targetId ? replacement : step))
    );
    setEditingStepId(null);
    setActiveStepId(replacement.id);
  }

  return (
    <main className="flex h-[100dvh] flex-col">
      <div className="relative h-[30dvh] min-h-[190px] shrink-0">
        <MapView points={steps} activeId={activeStepId} onMarkerClick={setActiveStepId} />
        <button
          type="button"
          onClick={onBack}
          aria-label="Revenir aux propositions"
          className="grain absolute left-3 flex h-9 w-9 items-center justify-center border-2 border-ink text-ink shadow-print"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto px-5 pb-6 pt-4">
        <div className="flex flex-col border-b-3 border-ink pb-3">
          <h1 className="font-display text-[2.1rem] uppercase leading-[1.02] tracking-[-0.02em] text-accent">
            {proposal.tripName}
          </h1>
          <p className="mt-2 text-body text-ink-soft [text-wrap:pretty]">{proposal.summary}</p>
        </div>

        {isEdited && (
          <button
            type="button"
            onClick={() => setSteps(proposal.steps)}
            className="mt-3 w-fit border-2 border-ink px-3 py-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-ink-soft transition-colors hover:bg-ink hover:text-paper"
          >
            Rétablir la proposition d&apos;origine
          </button>
        )}

        <ol className="mt-1 flex flex-col">
          {steps.map((step, index) => {
            const precedente = index > 0 ? steps[index - 1] : undefined;
            const trajet = precedente ? trajetDepuis(precedente, step) : null;
            return (
              <li key={step.id} className="flex flex-col">
                {/* Le seul élément de l'écran que le modèle n'a pas écrit : il sort des
                    coordonnées. C'est aussi celui qui répond à la question qu'on se pose
                    vraiment devant un parcours — est-ce que ça se fait à pied ? */}
                {trajet && (
                  <span className="flex items-center gap-2 py-1 pl-8 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-ink-mute">
                    <span aria-hidden className="h-3 w-px bg-ink-mute" />
                    {formatTrajet(trajet)}
                  </span>
                )}
                <StepRow
                  step={step}
                  index={index}
                  showDay={proposal.totalDays > 1}
                  isActive={step.id === activeStepId}
                  isEditing={editingStepId === step.id}
                  onSelect={() => setActiveStepId(step.id)}
                  onToggleEdit={() =>
                    setEditingStepId((current) => (current === step.id ? null : step.id))
                  }
                />
                {editingStepId === step.id && (
                  <AlternativeList
                    step={step}
                    excludeNames={steps.map((item) => item.placeName)}
                    onPick={(replacement) => replaceStep(step.id, replacement)}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="grain shrink-0 border-t-3 border-ink px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <Button
          variant="primary"
          onClick={() => onValidate({ ...proposal, steps })}
          className="flex h-14 w-full items-center justify-between px-5 text-[1rem]"
        >
          <span>Valider cet itinéraire</span>
          <CheckIcon className="h-[18px] w-[18px]" />
        </Button>
      </div>
    </main>
  );
}

function StepRow({
  step,
  index,
  showDay,
  isActive,
  isEditing,
  onSelect,
  onToggleEdit,
}: {
  step: ItineraryStep;
  index: number;
  showDay: boolean;
  isActive: boolean;
  isEditing: boolean;
  onSelect: () => void;
  onToggleEdit: () => void;
}) {
  return (
    <div
      className={clsx(
        "flex gap-3 border-t-2 border-ink py-3 transition-colors",
        isActive && "bg-paper-2"
      )}
    >
      <span className="w-6 shrink-0 pt-0.5 font-display text-[1.4rem] leading-none text-accent">
        {index + 1}
      </span>

      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 flex-col text-left">
        <span className="text-overline uppercase text-ink-soft">
          {showDay && `Jour ${step.day} · `}
          {PERIOD_LABELS[step.period]}
        </span>
        <span className="mt-0.5 font-display text-[1.3rem] uppercase leading-[1.04] tracking-[-0.01em] text-ink">
          {step.placeName}
        </span>
        <span className="mt-1 text-body text-ink-soft">{step.description}</span>
        {/* L'encre bleue dit le confirmé ; le doute ne prend aucune encre — le vermillon est
            réservé à l'action, l'employer ici crierait à l'erreur alors que la moitié des
            étapes sont concernées (voir StepCard). */}
        {step.verified === true && (
          <span className="mt-1.5 inline-flex items-center gap-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-blue">
            <CheckIcon className="h-3 w-3" />
            {step.address ?? "Adresse confirmée"}
          </span>
        )}
        {step.verified === false && (
          <span className="mt-1.5 w-fit border-b border-dotted border-ink-mute pb-0.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-ink-mute">
            Adresse à confirmer sur place
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={onToggleEdit}
        aria-expanded={isEditing}
        className={clsx(
          "h-7 shrink-0 self-start border-2 border-ink px-2 text-[0.625rem] font-bold uppercase tracking-[0.08em] transition-colors",
          isEditing ? "bg-ink text-paper" : "bg-transparent text-ink hover:bg-paper-3"
        )}
      >
        {isEditing ? "Annuler" : "Changer"}
      </button>
    </div>
  );
}

/**
 * Panneau de remplacement. Deux sources, dans cet ordre :
 *
 * 1. les étapes des autres propositions — écrites par le modèle, donc avec une description et
 *    une place réfléchie dans le parcours, mais peu nombreuses (souvent une seule) ;
 * 2. les lieux réels du référentiel autour du point, par thème — nombreux, immédiats, et
 *    confirmés par construction.
 *
 * C'est la seconde qui répond à « pourquoi une seule proposition ? » : elle transforme un choix
 * binaire en un vrai éventail, sans appel au modèle ni attente.
 */
function AlternativeList({
  step,
  excludeNames,
  onPick,
}: {
  step: ItineraryStep;
  excludeNames: string[];
  onPick: (step: ItineraryStep) => void;
}) {
  const [theme, setTheme] = useState<ThemeId>(() => themeForType(step.type));
  const [nearby, setNearby] = useState<ItineraryStep[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setNearby(null);
    findNearby(theme, step, excludeNames).then((results) => {
      // Le thème peut avoir changé pendant la requête : on ignore une réponse périmée plutôt
      // que d'afficher les résultats d'un onglet que l'utilisateur a déjà quitté.
      if (!cancelled) setNearby(results);
    });
    return () => {
      cancelled = true;
    };
    // `excludeNames` change à chaque rendu (nouveau tableau) : l'inclure relancerait la
    // recherche en boucle. Le thème et l'étape suffisent à décrire ce qu'on cherche.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, step.id]);

  return (
    <div className="mb-1 flex flex-col gap-3 border-2 border-dashed border-ink-mute p-3">
      {/* Une seule source d'alternatives depuis le 27/08/2026, et c'est le socle.
          « Dans les autres idées » proposait en plus les étapes des autres propositions. Cette
          section datait d'avant le panneau par thème et n'a plus lieu d'être : elle ne rendait
          souvent qu'un seul candidat — c'est ce qui avait motivé la recherche par thème — là où
          le socle en rend huit à douze, tous réels, sans chaînes ni lieux fermés. Elle coûtait
          une section de plus dans un panneau déjà dense sur un téléphone, et faisait traverser
          `allProposals` sur deux niveaux de composants. */}
      <div className="flex flex-col gap-2">
        <span className="text-overline uppercase text-ink-soft">Autre chose à proximité</span>

        <div className="flex flex-wrap gap-1.5">
          {THEMES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTheme(item.id)}
              aria-pressed={theme === item.id}
              // Mêmes étiquettes que l'écran de réglages, donc même dessin : elles marquaient
              // ici en noir les six thèmes que « Envies » marque en vermillon.
              className={chipClass(theme === item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {nearby === null && <p className="py-2 text-caption text-ink-mute">Recherche…</p>}
        {nearby !== null && nearby.length === 0 && (
          <p className="py-2 text-caption text-ink-mute">
            Rien de ce type dans les environs immédiats.
          </p>
        )}
        {nearby?.map((alternative) => (
          <AlternativeRow key={alternative.id} step={alternative} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}

function AlternativeRow({
  step,
  onPick,
}: {
  step: ItineraryStep;
  onPick: (step: ItineraryStep) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(step)}
      className="flex flex-col gap-1 border-2 border-ink p-2.5 text-left transition-colors hover:bg-paper-2"
    >
      <span className="font-display text-[1.15rem] uppercase leading-none tracking-[-0.01em] text-ink">
        {step.placeName}
      </span>
      <span className="text-body text-ink-soft">{step.description}</span>
      {step.verified === true && (
        <span className="inline-flex items-center gap-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-blue">
          <CheckIcon className="h-3 w-3" />
          {step.address ?? "Adresse confirmée"}
        </span>
      )}
    </button>
  );
}
