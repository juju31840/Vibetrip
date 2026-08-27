"use client";

interface ToastProps {
  message: string;
}

/**
 * Confirmation brève, affichée après une action dont le résultat n'est pas visible à l'écran.
 *
 * `role="status"` avec `aria-live="polite"` plutôt qu'une alerte : le message est annoncé aux
 * lecteurs d'écran sans interrompre ce que l'utilisateur est en train de faire. Il n'y a
 * volontairement aucun bouton de fermeture — un message qui disparaît seul en deux secondes
 * n'a pas à demander qu'on s'en occupe.
 */
export function Toast({ message }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-5"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}
    >
      <div className="animate-toast-in flex max-w-full items-center gap-2.5 border-2 border-ink bg-blue px-3.5 py-2.5 shadow-print">
        <span aria-hidden className="font-display text-[1.1rem] leading-none text-paper">
          ✓
        </span>
        <span className="truncate text-caption font-bold uppercase tracking-[0.08em] text-paper">
          {message}
        </span>
      </div>
    </div>
  );
}
