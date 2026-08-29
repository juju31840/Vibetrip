"use client";

import { ArrowLeftIcon, CheckIcon } from "@/components/ui/icons";
import { routeThumbnail } from "@/lib/route-thumbnail";
import type { Itinerary } from "@/types/itinerary";

interface ProposalsScreenProps {
  proposals: Itinerary[];
  /** Propositions encore en cours de génération, affichées en attente sous celles déjà arrivées. */
  pending?: number;
  onOpen: (itinerary: Itinerary) => void;
  onBack: () => void;
}

const COUNT_WORDS = ["Aucune idée", "Une idée", "Deux idées", "Trois idées"];

/**
 * Première page du choix : la liste des propositions, et rien d'autre.
 *
 * La version précédente dépliait les étapes de la proposition sélectionnée à même la liste et
 * plaçait la validation au même endroit : on se retrouvait à comparer trois programmes complets
 * sur un écran de téléphone, et le bouton de validation partait sous la ligne de flottaison.
 * Ici on décide d'abord de la direction — sur le titre, l'angle et le nombre d'étapes — puis on
 * ouvre celle qui intéresse pour en voir le détail.
 *
 * L'écran s'ouvre sur la **première** proposition arrivée, les autres s'y ajoutant ensuite :
 * l'attente passe de « la plus lente des trois » à « la plus rapide », et surtout elle devient
 * occupée — on lit déjà une idée pendant que les suivantes s'écrivent.
 */
export function ProposalsScreen({ proposals, pending = 0, onOpen, onBack }: ProposalsScreenProps) {
  const total = proposals.length + pending;

  return (
    <main className="flex h-[100dvh] flex-col">
      <header className="flex items-center gap-3 border-b-2 border-ink px-5 pb-2.5 pt-6">
        <button
          type="button"
          onClick={onBack}
          aria-label="Revenir aux réglages"
          className="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-ink text-ink transition-colors hover:bg-ink hover:text-paper"
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </button>
        <span className="text-overline uppercase text-ink-soft">Propositions</span>
      </header>

      <div className="flex flex-1 flex-col overflow-y-auto px-5 pb-8">
        <div className="flex flex-col pt-5">
          {/* `leading-[0.85]` n'est juste que sur un titre d'une ligne (piège Anton documenté
              dans CLAUDE.md et déjà rencontré sur `LoadingState`) : ce titre-ci revient
              *toujours* à la ligne via le `<br />`, il lui faut donc le plancher `1.04`, sans
              quoi « TROIS IDÉES » mord sur « POUR TOI ». */}
          <h1 className="font-display text-[3rem] uppercase leading-[1.04] tracking-[-0.02em] text-accent">
            {COUNT_WORDS[total] ?? `${total} idées`}
            <br />
            <span className="text-ink">pour toi</span>
          </h1>
          {/* Écart porté à `mt-5` : un titre en Anton à 3rem pèse visuellement lourd, un `mt-3`
              le collait à l'accroche alors que les deux disent des choses différentes (le
              nombre de propositions, puis ce qu'on attend de l'utilisateur). */}
          <p
            className="mt-5 text-body text-ink-soft [text-wrap:pretty]"
            // Le compteur change pendant la génération : annoncé une fois posé, pas à chaque mot.
            aria-live="polite"
          >
            {pending > 0
              ? "Ouvre celle-ci pendant qu'on écrit la suite."
              : "Ouvre celle qui te tente pour voir les adresses, tu valideras ensuite."}
          </p>
        </div>

        {/* `mt-7` plutôt que `mt-5` : ce bloc bascule du texte d'intro à la liste elle-même,
            une rupture plus nette que celle entre le titre et son accroche — elle mérite un
            écart plus grand, pas le même. */}
        <div className="mt-7 flex flex-col">
          {proposals.map((proposal, index) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              index={index}
              onOpen={() => onOpen(proposal)}
            />
          ))}

          {/* Emplacements en attente : la place que prendront les propositions restantes est
              réservée d'avance, pour que leur arrivée n'escamote pas la liste sous le doigt. */}
          {Array.from({ length: pending }, (_, index) => (
            <PendingCard key={`pending-${index}`} index={proposals.length + index} />
          ))}
        </div>
      </div>
    </main>
  );
}

function ProposalCard({
  proposal,
  index,
  onOpen,
}: {
  proposal: Itinerary;
  index: number;
  onOpen: () => void;
}) {
  const confirmed = proposal.steps.filter((step) => step.verified === true).length;
  const vignette = routeThumbnail(proposal.steps);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col border-t-2 border-ink py-3.5 text-left transition-colors hover:bg-paper-2"
    >
      {/* La forme du parcours, avant les mots. Trois propositions se lisaient jusqu'ici comme
          trois blocs de texte de même gabarit : on les comparait en lisant, ce qui est
          exactement l'effort qu'on voulait épargner. Un parcours de quartier et un parcours qui
          traverse la ville ne se ressemblent pas, et c'est souvent ce qui décide.

          Pas de `loading="lazy"` : les trois vignettes sont visibles d'emblée, et les charger
          en différé ne ferait que les faire apparaître par à-coups. */}
      {vignette && (
        <span className="mb-3 block w-full overflow-hidden border-2 border-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={vignette}
            alt=""
            width={400}
            height={168}
            className="block h-[168px] w-full object-cover"
          />
        </span>
      )}
      <span className="flex gap-3">
      <span className="w-7 shrink-0 pt-1 font-display text-[1.5rem] leading-none text-ink-mute">
        {index + 1}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-display text-[1.5rem] uppercase leading-[1.04] tracking-[-0.01em] text-ink">
          {proposal.tripName}
        </span>
        <span className="mt-1.5 text-body text-ink-soft [text-wrap:pretty]">{proposal.summary}</span>
        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-ink-mute">
          <span>{proposal.steps.length} étapes</span>
          {proposal.totalDays > 1 && <span>{proposal.totalDays} jours</span>}
          {/* Le nombre d'adresses confirmées est une information de choix : à parcours égal,
              autant retenir celui dont on est le plus sûr qu'il existe. */}
          {confirmed > 0 && (
            <span className="inline-flex items-center gap-1 text-blue">
              <CheckIcon className="h-3 w-3" />
              {confirmed} confirmée{confirmed > 1 ? "s" : ""}
            </span>
          )}
        </span>
      </span>
      <span aria-hidden className="self-center font-display text-[1.5rem] leading-none text-ink">
        →
      </span>
      </span>
    </button>
  );
}

/**
 * Une ligne d'attente plutôt qu'un spinner : elle occupe la hauteur réelle d'une proposition,
 * donc la liste ne saute pas quand l'idée arrive. Neutralisée sous `prefers-reduced-motion` —
 * une animation permanente en bas d'écran fatigue vite.
 */
function PendingCard({ index }: { index: number }) {
  return (
    <div className="flex gap-3 border-t-2 border-dashed border-ink-mute py-4" aria-hidden>
      {/* Le numéro et sa gouttière sont ceux d'une vraie carte, et c'est le point : les barres
          d'attente partaient sinon du bord gauche alors que le titre qu'elles annoncent commence
          après cette colonne. Un emplacement réservé qui n'a pas la forme de ce qu'il réserve
          fait justement sauter la liste qu'il était censé stabiliser. */}
      <span className="w-7 shrink-0 pt-1 font-display text-[1.5rem] leading-none text-paper-3">
        {index + 1}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="h-5 w-4/5 bg-paper-3 motion-safe:animate-pulse" />
        <div className="h-3 w-3/5 bg-paper-2 motion-safe:animate-pulse" />
        <div className="h-3 w-1/4 bg-paper-2 motion-safe:animate-pulse" />
      </div>
    </div>
  );
}
