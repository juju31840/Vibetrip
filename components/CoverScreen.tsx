"use client";

import { Button } from "@/components/ui/Button";

interface CoverScreenProps {
  onStart: () => void;
}

/**
 * Page de garde — une affiche à deux temps : le nom, puis ce que le produit promet.
 *
 * **Plus de mentions d'édition en haut.** « Édition France · N° 01 » imitait le bandeau d'une
 * revue sans rien dire de vrai : ni l'un ni l'autre n'est une information, et le lecteur le sent.
 * C'était le même défaut que la fiche technique qui occupait auparavant le second registre — du
 * décor tenant lieu de contenu. Le titre est désormais le premier objet de la page, ce qui le
 * sert : rien ne le précède, donc rien ne le concurrence.
 *
 * **Tout est dimensionné en `dvh`, pas en rem fixes**, et c'est ce qui règle le vide. Le blanc
 * entre l'accroche et le bouton — près de 290 px sur un grand téléphone — ne venait pas d'un
 * mauvais placement mais d'un contenu taillé pour le plus petit écran et laissé tel quel sur le
 * plus grand : trois blocs figés dans une page qui, elle, s'étirait. Les tailles et les
 * respirations suivent maintenant la hauteur disponible, si bien que la page se remplit sur un
 * 844 sans jamais déborder sur un 568 — où le contenu, lui, est bien près de tenir tout juste.
 *
 * Deux pièges déjà payés, à ne pas refaire :
 * - **Ne pas centrer pour combler.** Un `justify-center` sur le conteneur souple ne supprime pas
 *   le vide, il le coupe en deux poches symétriques — mesuré à 164/164 px, soit 39 % de la page.
 *   Deux vides égaux se lisent comme un bloc mal calé, ce qui était le reproche d'origine.
 * - **Ne pas étirer un bloc pour absorber le reste.** Essayé sur la fiche technique : ses lignes
 *   cessaient de se tenir et le filet de fermeture venait buter sur le bouton. Ici c'est la
 *   *taille du texte* qui grandit avec la page, pas l'espace entre ses morceaux.
 */
/**
 * Le tracé d'un parcours, aux encres du système — quatre étapes numérotées reliées dans l'ordre,
 * posées sur un fragment de ville.
 *
 * Dessiné en SVG et non importé comme fichier : il doit se recolorer avec la palette (les classes
 * Tailwind portent sur les formes) et rester net à toute taille, ce qu'aucun bitmap ne fait sur
 * une page dont la hauteur varie du simple au double.
 *
 * Il obéit aux règles du système : aucun angle arrondi sur les îlots, aucune ombre, aucun
 * dégradé, filets noirs pleins. Les pastilles gardent le cercle — c'est une convention
 * cartographique, comme les marqueurs de `MapView`, pas un arrondi d'interface. Vermillon pour
 * les étapes, outremer pour le cours d'eau : la même répartition que partout ailleurs, l'accent
 * sur ce qu'on doit suivre et le calme sur le décor.
 *
 * `aria-hidden` : elle redit l'accroche placée juste au-dessus, elle n'ajoute rien à l'oral.
 */
function RouteSketch() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 340 190"
      preserveAspectRatio="xMidYMid meet"
      className="hidden h-full w-full [@media(min-height:660px)]:block"
    >
      {/* Îlots — trame de fond, sans filet : ils situent sans se disputer le regard. */}
      <g className="fill-paper-3">
        <rect x="14" y="24" width="62" height="40" />
        <rect x="96" y="14" width="44" height="30" />
        <rect x="232" y="96" width="70" height="46" />
        <rect x="40" y="150" width="52" height="28" />
      </g>

      {/* Le cours d'eau, en aplat d'outremer : un seul geste, pas un motif. Amaigri de 15 à
          10 px après un premier essai où il emportait le regard — dans ce système l'outremer est
          le décor calme et le vermillon ce qu'on doit suivre ; une rivière plus épaisse que le
          parcours inversait la lecture. */}
      <path
        d="M-12 46 C 70 30, 96 118, 178 132 S 292 152, 352 108"
        fill="none"
        className="stroke-blue"
        strokeWidth="10"
      />

      {/* Le parcours : un trait interrompu, comme sur une carte de randonnée — il dit un chemin
          à suivre sans prétendre au tracé exact d'une rue. */}
      <polyline
        points="46,146 116,92 196,112 282,44"
        fill="none"
        className="stroke-ink"
        strokeWidth="4"
        strokeLinecap="square"
        strokeDasharray="11 8"
      />

      {[
        { x: 46, y: 146, n: "1" },
        { x: 116, y: 92, n: "2" },
        { x: 196, y: 112, n: "3" },
        { x: 282, y: 44, n: "4" },
      ].map((stop) => (
        <g key={stop.n}>
          <circle
            cx={stop.x}
            cy={stop.y}
            r="17"
            className="fill-accent stroke-ink"
            strokeWidth="2.5"
          />
          <text
            x={stop.x}
            y={stop.y + 7}
            textAnchor="middle"
            className="fill-paper font-display text-[19px]"
          >
            {stop.n}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function CoverScreen({ onStart }: CoverScreenProps) {
  return (
    // `pt` inclut `env(safe-area-inset-top)` : le titre étant maintenant le premier élément, il
    // passerait sous l'encoche sans cela.
    <main className="flex h-[100dvh] flex-col overflow-hidden px-6 pb-[clamp(1.25rem,3dvh,2.25rem)] pt-[calc(clamp(1.25rem,4dvh,3rem)+env(safe-area-inset-top))]">
      {/* Registre 1 — identité. `min()` de trois bornes : la largeur commande (Anton est
          condensé, mais huit lettres pleine chasse restent risquées sur un 320), la hauteur
          plafonne (sur un écran court, un titre de 100 px mangerait la place de l'accroche), et
          `7rem` empêche l'emballement sur très grand écran.
          Encre : noir plein, pas vermillon. La règle du système réserve le vermillon à l'action
          et à la sélection ; l'accoler au nom diluerait le seul repère qui doit rester univoque. */}
      <div className="shrink-0">
        <h1 className="font-display text-[min(26vw,13dvh,7rem)] uppercase leading-[0.92] tracking-[-0.02em] text-ink">
          Vibetrip
        </h1>
        <p className="mt-[clamp(0.25rem,0.8dvh,0.6rem)] text-title uppercase tracking-[0.01em] text-ink-soft">
          On sort où&nbsp;?
        </p>
        <div className="mt-[clamp(0.75rem,2.2dvh,1.5rem)] -rotate-[0.6deg] border-2 border-ink bg-ink px-3.5 py-2">
          <span className="text-overline uppercase text-paper">
            Ce soir · Week-end · Voyage
          </span>
        </div>
      </div>

      {/* Registre 2 — l'accroche, et le bloc qui absorbe la hauteur. Ce qu'elle affirme est ce
          qui distingue réellement le produit : ailleurs une liste de suggestions à trier
          soi-même, ici un parcours ordonné dont les adresses sont confrontées à un vrai
          référentiel de lieux (lib/verify-places.ts). Elle ne promet rien que le produit ne
          tienne.

          Sa taille suit la hauteur (`6.2dvh`) : c'est elle qui remplit la page. Le plancher de
          `1.55rem` la garde lisible sur un écran court, où elle repasse sous la taille d'origine
          plutôt que de pousser le bouton hors de l'écran.

          La chute passe en outremer, l'encre que le système réserve au factuel et au confirmé —
          pas en vermillon, qui reste au seul bouton pour qu'il demeure le repère d'action. */}
      <div className="mt-[clamp(1rem,3dvh,2.25rem)] flex shrink-0 flex-col gap-[clamp(0.75rem,2.4dvh,1.75rem)]">
        <div className="shrink-0 border-t-3 border-ink" />
        {/* Deux paragraphes qui coulent, et **aucun `<br>`** : les retours forcés étaient réglés
            pour une taille unique, et à l'échelle où l'accroche remplit maintenant la page ils
            laissaient « PAS » seul sur sa ligne. Le texte se casse là où la colonne l'impose. */}
        <div className="flex shrink-0 flex-col gap-[clamp(0.4rem,1.4dvh,1rem)] font-display text-[clamp(1.5rem,6dvh,3.1rem)] uppercase leading-[1.02] tracking-[-0.01em]">
          <p className="text-ink">On ne te donne pas des idées.</p>
          <p className="text-blue">On te donne un itinéraire.</p>
        </div>
        <div className="shrink-0 border-t-3 border-ink" />
      </div>

      {/* Ce qui reste de hauteur porte une image, et le bouton retrouve le bas de l'écran.
          Le vide n'était pas supprimable par la typographie seule — le titre et l'accroche ne
          remplissent pas 844 px sans devenir grotesques, et agrandir encore le texte lui retire
          des lignes autant que ça les épaissit (mesuré : 57 px donnaient *moins* de hauteur que
          52 px, en passant de cinq lignes à quatre). Il fallait donc du contenu, pas un réglage.

          Une image plutôt qu'un texte de plus : la page en compte déjà deux blocs, et c'est la
          seule de l'application qui puisse en porter une. Elle montre littéralement ce que
          l'accroche vient d'affirmer — un parcours ordonné, pas une liste de points.

          `min-h-0` sur un enfant `flex-1` : sans lui l'image imposerait sa hauteur intrinsèque et
          repousserait le bouton hors de l'écran, la compression flex étant le piège déjà payé
          trois fois ici. Masquée sous 660 px de haut : le seuil a été mesuré, pas
          deviné — à 568 px il ne restait que 72 px de hauteur, soit une vignette de 129 px de
          large qu'on ne lisait plus. Ces écrans-là sont de toute façon déjà pleins (leur vide
          mesurait 115 px contre 200 sur un grand), donc la retirer n'y ouvre pas de trou. */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden py-[clamp(0.5rem,2dvh,1.5rem)]">
        <RouteSketch />
      </div>

      {/* Registre 3 — l'action. */}
      <div className="flex shrink-0 flex-col gap-3">
        <Button
          variant="primary"
          onClick={onStart}
          className="flex h-14 w-full items-center justify-between px-5 text-[1rem]"
        >
          <span>Commencer</span>
          <span aria-hidden className="font-display text-[1.5rem] leading-none">
            →
          </span>
        </Button>
        <p className="text-center text-caption uppercase tracking-[0.12em] text-ink-mute">
          Sans compte, sans installation
        </p>
      </div>

    </main>
  );
}
