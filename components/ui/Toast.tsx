"use client";

interface ToastProps {
  message: string;
  /**
   * Invite à noter le lieu qu'on vient de cocher. Fournie seulement dans ce cas — une
   * confirmation ordinaire ne demande rien.
   */
  onRate?: (note: number) => void;
}

/**
 * Confirmation brève, affichée après une action dont le résultat n'est pas visible à l'écran.
 *
 * `role="status"` avec `aria-live="polite"` plutôt qu'une alerte : le message est annoncé aux
 * lecteurs d'écran sans interrompre ce que l'utilisateur est en train de faire. Il n'y a
 * volontairement aucun bouton de fermeture — un message qui disparaît seul en deux secondes
 * n'a pas à demander qu'on s'en occupe.
 *
 * **La note se donne ici, et c'est un déplacement voulu.** Les étoiles vivaient sous l'étape
 * cochée, dans la bottom sheet : à l'ouverture, celle-ci n'est dépliée qu'au premier cran, et
 * elles se trouvaient donc sous la ligne de flottaison. Il fallait faire glisser la feuille pour
 * les découvrir — personne ne le fait, et de fait personne ne les a vues.
 *
 * Le moment est le bon : on vient de dire qu'on y était, la question « c'était comment ? » suit
 * naturellement. Un rappel différé aurait demandé un service worker, une permission de
 * notification et un serveur d'envoi, pour un accord qu'on refuse neuf fois sur dix — beaucoup
 * d'infrastructure pour arriver moins bien à propos.
 *
 * `pointer-events-none` sur l'enveloppe, `auto` sur le contenu : le message ne bloque jamais ce
 * qu'il recouvre, mais ses étoiles restent cliquables.
 */
export function Toast({ message, onRate }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-5"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}
    >
      <div className="animate-toast-in pointer-events-auto flex max-w-full flex-col gap-2 border-2 border-ink bg-blue px-3.5 py-2.5 shadow-print">
        <span className="flex items-center gap-2.5">
          <span aria-hidden className="font-display text-[1.1rem] leading-none text-paper">
            ✓
          </span>
          <span className="truncate text-caption font-bold uppercase tracking-[0.08em] text-paper">
            {message}
          </span>
        </span>

        {onRate && (
          <span className="flex items-center gap-2 border-t border-paper/25 pt-2">
            <span className="text-[0.625rem] font-bold uppercase tracking-[0.1em] text-paper/75">
              C&apos;était comment&nbsp;?
            </span>
            <span className="flex">
              {[1, 2, 3, 4, 5].map((valeur) => (
                <button
                  key={valeur}
                  type="button"
                  aria-label={`Noter ${valeur} sur 5`}
                  onClick={() => onRate(valeur)}
                  className="px-[3px] text-[1.125rem] leading-none text-paper/45 transition-colors hover:text-paper"
                >
                  ★
                </button>
              ))}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
