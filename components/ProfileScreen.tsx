"use client";

import clsx from "clsx";
import { chipClass } from "@/components/ui/chip";
import { lireProfil, envieseDeduites, dernierLieu, VISITES_MINIMUM } from "@/lib/taste";
import { listerNotes } from "@/lib/ratings-store";
import type { VisitedPlace } from "@/lib/places-store";
import type { ThemeId } from "@/types/itinerary";

interface ProfileScreenProps {
  places: VisitedPlace[];
  /** Envies actuellement retenues au réglage, pour montrer si le profil est déjà appliqué. */
  themes: ThemeId[];
  onApply: (themes: ThemeId[]) => void;
}

/**
 * Ce que l'application a compris de quelqu'un — et ce qu'elle en fait.
 *
 * L'onglet est resté vide longtemps, à raison : un profil qui ne change pas le résultat n'est
 * qu'un formulaire décoratif, et il n'y avait rien à en dire tant que personne n'avait rien
 * coché. Il ouvre aujourd'hui sur des faits — les lieux réellement visités — et sur un geste
 * qui a un effet : appliquer ses goûts aux prochaines propositions.
 *
 * **Rien n'est demandé, tout est observé.** Un questionnaire aurait recueilli ce qu'on croit
 * aimer ; les cases cochées pendant les sorties disent où l'on est allé, ce qui n'est pas la
 * même chose.
 *
 * **Il se tait tant qu'il ne sait pas.** En dessous de quelques sorties, prétendre connaître
 * quelqu'un serait faux, et un profil qui se trompe sur vous est pire qu'un profil vide.
 */
export function ProfileScreen({ places, themes, onApply }: ProfileScreenProps) {
  const profil = lireProfil(places);
  const deduites = envieseDeduites(profil);
  const dernier = dernierLieu(places);
  const notes = listerNotes();
  const dejaApplique =
    deduites.length > 0 && deduites.every((t) => themes.includes(t));

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 pb-6 pt-10">
      <div className="flex items-end justify-between border-b-3 border-ink pb-2">
        <h1 className="font-display text-[2.6rem] uppercase leading-[0.85] tracking-[-0.015em] text-ink">
          Profil
        </h1>
      </div>

      {!profil.etabli ? (
        <NePasEncoreSavoir visites={profil.visites} />
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="text-overline uppercase text-ink-soft">Ce qu&apos;on a compris</h2>
            {/* Une phrase, pas un tableau de bord : « Ma carte » compte déjà les lieux et les
                villes. Ce qui manquait, c'est ce que ces chiffres disent. */}
            <p className="font-display text-[1.5rem] uppercase leading-[1.06] tracking-[-0.01em] text-ink">
              Tu prends surtout{" "}
              <span className="text-accent">
                {profil.gouts.map((g) => g.label.toLowerCase()).join(" et ")}
              </span>
              {profil.villePrincipale ? (
                <>
                  , le plus souvent à <span className="text-blue">{profil.villePrincipale}</span>.
                </>
              ) : (
                "."
              )}
            </p>
          </section>

          {/* Masquée tant qu'un seul type est visité : une barre seule ne compare rien et
              répète la phrase du dessus en ayant l'air d'un graphique cassé. Même règle que
              sur la répartition de « Ma carte ». */}
          {profil.repartition.length > 1 && (
            <section className="flex flex-col gap-2.5">
              <h2 className="text-overline uppercase text-ink-soft">
                Sur tes {profil.visites} passages
              </h2>
              <ul className="flex flex-col gap-2.5">
                {profil.repartition.map((g) => (
                  <li key={g.theme} className="flex flex-col gap-1">
                    {/* Le libellé occupe sa propre ligne. Placé à gauche de la barre, il était
                        tronqué dès « Boire un verre » — et un libellé coupé ne se lit pas. */}
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-ink">
                        {g.label}
                      </span>
                      <span className="shrink-0 text-caption font-bold tabular-nums text-ink-soft">
                        {g.passages} · {Math.round(g.part * 100)}%
                      </span>
                    </span>
                    <span className="block h-3 border-2 border-ink">
                      <span
                        className="block h-full bg-blue"
                        style={{ width: `${Math.round(g.part * 100)}%` }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Ce qu'on n'a jamais fait dit plus que ce qu'on répète : c'est là qu'il reste
              quelque chose à découvrir, et c'est la seule ligne du profil qui puisse surprendre. */}
          {profil.jamais.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-overline uppercase text-ink-soft">Jamais essayé</h2>
              <div className="flex flex-wrap gap-1.5">
                {profil.jamais.map((j) => (
                  <span key={j.theme} className={chipClass(false, "cursor-default")}>
                    {j.label}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Les notes rendues à qui les a données. Elles ne servaient jusqu'ici qu'aux autres :
              on donnait un avis et on ne le revoyait jamais — le même défaut que cocher une étape
              sans que rien n'apparaisse nulle part, et un geste qui ne rend rien cesse d'être
              fait. Les quatre dernières suffisent : c'est un rappel, pas un journal. */}
          {notes.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-overline uppercase text-ink-soft">Ce que tu as noté</h2>
              <ul className="flex flex-col border-2 border-ink">
                {notes.slice(0, 4).map((n) => (
                  <li
                    key={n.ref}
                    className="flex items-center justify-between gap-3 border-b-2 border-ink px-3 py-2 last:border-b-0"
                  >
                    <span className="truncate text-body text-ink">{n.placeName}</span>
                    <span
                      aria-label={`${n.note} sur 5`}
                      className="shrink-0 text-[0.9rem] leading-none tracking-[0.08em] text-accent"
                    >
                      {"★".repeat(n.note)}
                      <span className="text-paper-3">{"★".repeat(5 - n.note)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Repli, et seulement cela : dès qu'il y a des notes, elles nomment déjà des lieux —
              afficher les deux faisait apparaître le même endroit à deux lignes d'intervalle. */}
          {notes.length === 0 && dernier && (
            <p className="text-body text-ink-soft">
              Dernier lieu coché&nbsp;: <span className="text-ink">{dernier.placeName}</span>
              {dernier.city ? `, ${dernier.city}` : ""}.
            </p>
          )}

          {/* Le geste qui rend le profil utile. Sans lui, tout ce qui précède ne serait qu'un
              miroir — et un miroir n'a jamais amélioré une soirée. */}
          {/* `sticky` et non `mt-auto` : celui-ci ne pousse en bas que tant qu'il reste de la
              place, et le bouton s'est retrouvé coupé par la barre d'onglets dès que la liste
              des notes a rempli l'écran. C'est le même piège que le « Valider » passé sous la
              ligne de flottaison — l'action doit rester atteignable sans avoir à chercher.
              `-mx-6 px-6` pour que l'aplat de papier couvre toute la largeur en défilant. */}
          <div className="sticky bottom-0 -mx-6 mt-auto flex flex-col gap-2 border-t-3 border-ink bg-paper px-6 pb-1 pt-4">
            <p className="text-body text-ink-soft [text-wrap:pretty]">
              {dejaApplique
                ? "Tes envies sont réglées sur tes habitudes. Tu peux les décocher à tout moment."
                : "On peut partir de ces habitudes pour la prochaine sortie."}
            </p>
            <button
              type="button"
              disabled={dejaApplique}
              onClick={() => onApply(deduites)}
              className={clsx(
                "flex h-12 w-full items-center justify-between border-2 border-ink px-4 text-[0.9375rem] font-bold uppercase tracking-[0.06em] transition-colors",
                dejaApplique
                  ? "cursor-default bg-paper-2 text-ink-mute"
                  : "bg-accent text-paper shadow-print hover:bg-accent-deep"
              )}
            >
              <span>{dejaApplique ? "Déjà appliqué" : "Appliquer à mes réglages"}</span>
              {!dejaApplique && (
                <span aria-hidden className="font-display text-[1.25rem] leading-none">
                  →
                </span>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * L'état d'attente dit **combien il en manque**, et non « pas encore de données ».
 *
 * Un profil qui se tait sans dire pourquoi laisse croire qu'il est cassé ; en annonçant le
 * nombre de passages requis, il transforme le vide en objectif — et ce nombre est atteignable
 * en une seule sortie.
 */
function NePasEncoreSavoir({ visites }: { visites: number }) {
  const restants = Math.max(0, VISITES_MINIMUM - visites);
  return (
    <div className="border-2 border-dashed border-ink-mute px-5 py-10">
      <p className="text-body text-ink-soft [text-wrap:pretty]">
        {visites === 0
          ? "On ne sait encore rien de toi, et on préfère le dire plutôt que d'inventer. Coche les étapes où tu vas pendant tes sorties : au bout de quelques-unes, on saura ce que tu aimes."
          : /* « étapes » et non « lieux » : le compte porte sur les passages, et deux passages
               au même endroit ne font qu'un lieu — la phrase aurait été fausse. */
            `Encore ${restants} étape${restants > 1 ? "s" : ""} cochée${restants > 1 ? "s" : ""} et on pourra dire quelque chose de juste sur tes goûts. En dessous, on se tromperait.`}
      </p>
    </div>
  );
}
