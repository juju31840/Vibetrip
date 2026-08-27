"use client";

import type { SavedItinerary } from "@/lib/storage";
import { MODE_LABELS } from "@/lib/trip-modes";

interface SavedScreenProps {
  items: SavedItinerary[];
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
}

export function SavedScreen({ items, onOpen, onRemove }: SavedScreenProps) {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-6 pb-6 pt-10">
      {/* Masthead : le titre et son filet, **rien à droite**. Les trois onglets portaient trois
          coins droits différents — « N° 01 » sur Créer, un « 3 » nu ici, un « 4 » nu sur Ma carte
          — dont aucun ne disait ce qu'il comptait. Et les comptes étaient déjà donnés deux fois
          ailleurs, mieux nommés : par le badge de l'onglet dans la barre du bas, et pour Ma carte
          par son bloc de statistiques. Un même nombre à trois endroits n'informe pas, il fait
          douter qu'il compte la même chose. */}
      <div className="flex items-end justify-between border-b-3 border-ink pb-2">
        {/* Même interlignage que les mastheads de « Créer » et « Ma carte », et c'est la seule
            chose qui compte ici : les trois onglets partagent ce bandeau, et un interlignage
            différent déplaçait les capitales de 4 px au-dessus du filet — le titre sautait au
            changement d'onglet. `0.85` plutôt que `1.04` parce que le piège Anton ne concerne
            que les titres qui reviennent à la ligne : les trois sont des chaînes fixes, et le
            plus long, « MES SORTIES », mesure 199 px pour 225 px disponibles à 320 px de large. */}
        <h1 className="font-display text-[2.6rem] uppercase leading-[0.85] tracking-[-0.015em] text-ink">
          Mes sorties
        </h1>
      </div>

      {/* `mt-5` : la même rupture titre → contenu que sur l'écran des propositions, pour que les
          deux écrans se lisent comme la même affiche plutôt que comme deux gabarits différents. */}
      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <SavedList items={items} onOpen={onOpen} onRemove={onRemove} />
      )}
    </div>
  );
}

/**
 * L'état vide dit quel geste va le remplir, plutôt que « aucun résultat ». Il a été récrit quand
 * l'enregistrement automatique a été abandonné : il promettait une liste qui se remplit seule,
 * ce qui n'est plus vrai depuis que c'est la validation d'une proposition qui range la sortie ici.
 */
function EmptyState() {
  return (
    <div className="mt-5 border-2 border-dashed border-ink-mute px-5 py-10">
      <p className="text-body text-ink-soft [text-wrap:pretty]">
        Choisis une idée, valide-la, et elle se range ici.
      </p>
    </div>
  );
}

function SavedList({ items, onOpen, onRemove }: SavedScreenProps) {
  return (
    <ul className="mt-5 flex flex-col">
      {items.map((item) => {
        const total = item.itinerary.steps.length;
        const done = item.doneStepIds.length;
        return (
          <li key={item.id} className="flex items-stretch gap-2 border-b-2 border-ink">
            <button
              type="button"
              onClick={() => onOpen(item.id)}
              className="flex min-w-0 flex-1 flex-col py-3.5 text-left"
            >
              <span className="truncate font-display text-[1.4rem] uppercase leading-none tracking-[-0.01em] text-ink">
                {item.itinerary.tripName}
              </span>
              <span className="mt-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-ink-mute">
                {MODE_LABELS[item.itinerary.mode]} · {formatSavedAt(item.savedAt)}
                {done > 0 && (
                  <span className="text-blue">{` · ${done}/${total} faites`}</span>
                )}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              aria-label={`Supprimer ${item.itinerary.tripName}`}
              className="shrink-0 self-center border-2 border-ink px-2.5 py-1 text-[0.625rem] font-bold uppercase tracking-[0.08em] text-ink-soft transition-colors hover:bg-danger hover:text-paper"
            >
              Suppr.
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** « Aujourd'hui » tant que c'est le cas, sinon une date courte — plus lisible qu'un horodatage. */
function formatSavedAt(savedAt: string): string {
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();
  const sameDay =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
  if (sameDay) return "aujourd'hui";

  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(date);
}
