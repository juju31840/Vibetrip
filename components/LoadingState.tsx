import { RouteIcon } from "@/components/ui/icons";

/**
 * Écran d'attente — retour utilisateur (27/08/2026) : « c'est mal écrit, les écritures se
 * superposent [...] écrit trop petit et du coup c'est mal réparti sur la page ».
 *
 * Deux défauts distincts, deux corrections distinctes :
 * 1. Le titre mordait sur lui-même. Cause exacte : `leading-[0.85]`, qui n'est juste que sur un
 *    titre tenant sur une seule ligne (voir le piège Anton documenté dans CLAUDE.md, déjà rencontré
 *    sur d'autres écrans). Passé à `leading-[1.04]` puisque ce titre revient toujours à la ligne.
 * 2. Tout était massé au centre vertical — un `justify-center` qui laisse l'écran paraître vide
 *    en haut et en bas dès que l'écran est un peu grand. Repris en trois blocs façon affiche :
 *    un bandeau haut (comme sur `CoverScreen`), le titre qui occupe vraiment le haut de l'écran,
 *    et un bloc bas sous filet pour le statut — plutôt qu'un empilement flottant au centre.
 *
 * Le point 2 a dû être repris une seconde fois : déplacer le `justify-center` du `main` vers un
 * conteneur `flex-1` ne l'avait pas résolu, il l'avait seulement rétréci. Voir le commentaire de
 * ce conteneur, et le même correctif sur `CoverScreen` — les deux écrans avaient le même défaut.
 */
export function LoadingState() {
  return (
    <main className="flex h-[100dvh] flex-col px-6 pb-10 pt-12">
      {/* Bandeau haut : reprend le filet de `CoverScreen` pour que l'écran d'attente se lise
          comme la suite de la même affiche, pas comme un écran technique isolé. L'icône remplace
          le spinner rond qu'un système sans cercle ne peut pas se permettre. */}
      <div className="flex shrink-0 items-center justify-between border-b-2 border-ink pb-2">
        <span className="text-overline uppercase text-ink-soft">Composition en cours</span>
        <RouteIcon className="h-3.5 w-3.5 text-ink-soft motion-safe:animate-pulse" />
      </div>

      {/* Le titre est **posé sous le bandeau**, pas centré. `justify-center` laissait deux vides
          d'égale hauteur au-dessus et au-dessous — mesurés à 141 px chacun sur un écran de 568,
          soit la moitié de la page en deux poches symétriques : le titre paraissait flotter, ce
          qui était précisément le reproche (« mal réparti sur la page »). Ancré en haut, il tient
          le premier tiers, et toute la respiration se rassemble au-dessus du filet du bas. */}
      <div className="flex flex-1 flex-col justify-start pt-6">
        <p className="font-display text-[clamp(2.5rem,12vw,4rem)] uppercase leading-[1.04] tracking-[-0.02em] text-accent">
          On te
          <br />
          compose ça
        </p>
      </div>

      {/* Bloc bas, posé sous un filet plutôt qu'un simple espacement : c'est ce filet qui donne
          à la page sa lecture en deux temps (promesse en haut, statut en bas) et qui l'ancre au
          bord de l'écran au lieu de la laisser dériver au centre. */}
      <div className="flex shrink-0 flex-col gap-4 border-t-2 border-ink pt-5">
        {/* Trois blocs qui se remplissent : ils disent que plusieurs idées arrivent, et lesquelles
            manquent encore. Neutralisés sous `prefers-reduced-motion`. */}
        <div aria-hidden className="flex gap-1.5">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="h-2.5 flex-1 border-2 border-ink bg-paper-2 motion-safe:animate-pulse"
              style={{ animationDelay: `${index * 220}ms` }}
            />
          ))}
        </div>
        <p className="max-w-[20rem] text-body text-ink-soft [text-wrap:pretty]">
          La première idée s&apos;affiche dès qu&apos;elle est prête, sans attendre les autres.
        </p>
      </div>
    </main>
  );
}
