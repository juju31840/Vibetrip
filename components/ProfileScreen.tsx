"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { chipClass } from "@/components/ui/chip";
import { VibeSliders } from "@/components/VibeSliders";
import { ThemePicker } from "@/components/ThemePicker";
import { lireProfil, envieseDeduites, dernierLieu, VISITES_MINIMUM } from "@/lib/taste";
import { listerNotes } from "@/lib/ratings-store";
import { PREFERENCES_NEUTRES, type Preferences } from "@/lib/preferences";
import { reduireImage, type Identity } from "@/lib/identity";
import { matchCities, SUGGESTED_CITIES } from "@/lib/cities";
import type { VisitedPlace } from "@/lib/places-store";
import type { ThemeId } from "@/types/itinerary";

/** Au-delà, ce ne sont plus des villes de référence mais une liste de villes. */
const VILLES_MAX = 4;

interface ProfileScreenProps {
  places: VisitedPlace[];
  /** Envies actuellement retenues au réglage, pour montrer si le profil est déjà appliqué. */
  themes: ThemeId[];
  onApply: (themes: ThemeId[]) => void;
  preferences: Preferences | null;
  onPreferencesChange: (prefs: Preferences) => void;
  identity: Identity;
  onIdentityChange: (identity: Identity) => void;
}

/**
 * Ce que l'application sait de quelqu'un — et ce qu'elle en fait.
 *
 * L'écran tient **trois registres visuels distincts**, et la distinction porte du sens plutôt
 * que du décor. Ils se lisaient d'abord à la suite, séparés par un filet, si bien que les
 * préférences déclarées ressemblaient à une seconde copie de l'écran « Créer » et que les goûts
 * observés en paraissaient la suite. Or ce sont trois natures différentes :
 *
 * 1. **La fiche** — en aplat d'encre, comme une carte imprimée. Ce qu'on est. Elle ne change
 *    aucune proposition et ne le prétend pas ; sa fonction est qu'un écran de réglages devienne
 *    un endroit à soi.
 * 2. **Les préférences** — sur papier assombri et encadrées, le registre du formulaire. Ce qu'on
 *    veut. Elles agissent, par la case « Partir de mes préférences » de l'écran « Créer ».
 * 3. **Ce qu'on a compris** — sur papier nu, précédé d'une bande d'encre pleine largeur. Ce
 *    qu'on fait. Mesuré, jamais déclaré.
 *
 * La bande d'encre est le seul séparateur qui coupe vraiment : un filet, même à 3 px, se lit
 * comme une respiration à l'intérieur d'une même section.
 */
export function ProfileScreen({
  places,
  themes,
  onApply,
  preferences,
  onPreferencesChange,
  identity,
  onIdentityChange,
}: ProfileScreenProps) {
  const prefs = preferences ?? PREFERENCES_NEUTRES;
  const profil = lireProfil(places);
  const deduites = envieseDeduites(profil);
  const dernier = dernierLieu(places);
  const notes = listerNotes();
  const dejaApplique = deduites.length > 0 && deduites.every((t) => themes.includes(t));

  return (
    <div className="flex flex-1 flex-col overflow-y-auto pb-6">
      <div className="flex flex-col gap-5 px-6 pt-10">
        <div className="flex items-end justify-between border-b-3 border-ink pb-2">
          <h1 className="font-display text-[2.6rem] uppercase leading-[0.85] tracking-[-0.015em] text-ink">
            Profil
          </h1>
        </div>

        <FicheIdentite identity={identity} onChange={onIdentityChange} villes={prefs.cities} />

        <Preferencier prefs={prefs} onChange={onPreferencesChange} />
      </div>

      {/* La coupure. Pleine largeur et en aplat, donc `-mx` annulé par l'absence de padding sur
          le conteneur : c'est ce qui la fait lire comme un changement de chapitre et non comme
          une ligne de plus dans la même page. */}
      <div className="mt-7 flex items-baseline justify-between border-y-3 border-ink bg-ink px-6 py-2.5">
        <h2 className="font-display text-[1.35rem] uppercase leading-[0.9] tracking-[-0.01em] text-paper">
          Ce qu&apos;on a compris
        </h2>
        <span className="text-[0.625rem] font-bold uppercase tracking-[0.14em] text-paper/60">
          observé
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-6 px-6 pt-5">
        {!profil.etabli ? (
          <NePasEncoreSavoir visites={profil.visites} />
        ) : (
          <>
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

            {/* Masquée tant qu'un seul type est visité : une barre seule ne compare rien et
                répète la phrase du dessus en ayant l'air d'un graphique cassé. */}
            {profil.repartition.length > 1 && (
              <section className="flex flex-col gap-2.5">
                <h3 className="text-overline uppercase text-ink-soft">
                  Sur tes {profil.visites} passages
                </h3>
                <ul className="flex flex-col gap-2.5">
                  {profil.repartition.map((g) => (
                    <li key={g.theme} className="flex flex-col gap-1">
                      {/* Le libellé occupe sa propre ligne. Placé à gauche de la barre, il était
                          tronqué dès « Boire un verre ». */}
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

            {profil.jamais.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="text-overline uppercase text-ink-soft">Jamais essayé</h3>
                <div className="flex flex-wrap gap-1.5">
                  {profil.jamais.map((j) => (
                    <span key={j.theme} className={chipClass(false, "cursor-default")}>
                      {j.label}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {notes.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="text-overline uppercase text-ink-soft">Ce que tu as noté</h3>
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

            {/* Repli, et seulement cela : dès qu'il y a des notes, elles nomment déjà des lieux. */}
            {notes.length === 0 && dernier && (
              <p className="text-body text-ink-soft">
                Dernier lieu coché&nbsp;: <span className="text-ink">{dernier.placeName}</span>
                {dernier.city ? `, ${dernier.city}` : ""}.
              </p>
            )}

            {/* Ancré en bas du flux, et non collant : le bandeau collant masquait un tiers de la
                hauteur depuis que la fiche et les préférences ont allongé l'écran. */}
            <div className="mt-auto flex flex-col gap-2 border-t-3 border-ink pt-4">
              <p className="text-body text-ink-soft [text-wrap:pretty]">
                {dejaApplique
                  ? "Tes réglages suivent déjà tes habitudes. Tu peux les décocher à tout moment."
                  : "Ce sont tes habitudes, pas tes préférences : on peut les reporter dans les réglages de ta prochaine sortie."}
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
    </div>
  );
}

/**
 * La fiche — en aplat d'encre, le registre de la carte imprimée.
 *
 * C'est le seul bloc de l'application entièrement en encre pleine hors de la barre d'onglets, et
 * c'est délibéré : il ne se confond avec aucun autre écran, ce qui était le reproche fait à la
 * première version où les préférences ressemblaient à une copie de « Créer ».
 *
 * Elle se remplit **par touches** : rien n'est obligatoire, et un champ laissé vide n'affiche pas
 * de trou mais son intitulé en réserve. Un formulaire qui exige avant de servir n'aurait pas sa
 * place dans un produit dont la promesse est qu'on obtient un programme sans rien construire.
 */
function FicheIdentite({
  identity,
  onChange,
  villes,
}: {
  identity: Identity;
  onChange: (identity: Identity) => void;
  villes: string[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function choisirPhoto(file: File | undefined) {
    if (!file) return;
    setErreur(null);
    try {
      onChange({ ...identity, photo: await reduireImage(file) });
    } catch {
      // Format non décodable (HEIC sur certains navigateurs) : le dire, plutôt que de ne rien
      // faire — un bouton qui ne réagit pas passe pour une panne de l'application.
      setErreur("Cette image n'a pas pu être lue. Essaie une photo JPEG ou PNG.");
    }
  }

  return (
    <section className="flex flex-col gap-3 border-2 border-ink bg-ink p-4 shadow-print">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label={identity.photo ? "Changer la photo" : "Ajouter une photo"}
          className="relative h-[72px] w-[72px] shrink-0 overflow-hidden border-2 border-paper bg-paper/10"
        >
          {identity.photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- data: URI local, pas d'origine à optimiser
            <img src={identity.photo} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[0.5625rem] font-bold uppercase leading-tight tracking-[0.1em] text-paper/70">
              Photo
            </span>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void choisirPhoto(e.target.files?.[0])}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <input
            value={identity.name}
            onChange={(e) => onChange({ ...identity, name: e.target.value.slice(0, 24) })}
            placeholder="Ton prénom"
            aria-label="Ton prénom"
            className="w-full border-b-2 border-paper/40 bg-transparent pb-1 font-display text-[1.6rem] uppercase leading-[0.95] tracking-[-0.01em] text-paper placeholder:text-paper/40 focus:border-paper focus:outline-none"
          />
          <label className="flex items-center gap-2 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-paper/60">
            Âge
            <input
              type="number"
              inputMode="numeric"
              min={10}
              max={120}
              value={identity.age ?? ""}
              onChange={(e) =>
                onChange({ ...identity, age: e.target.value ? Number(e.target.value) : null })
              }
              placeholder="—"
              aria-label="Ton âge"
              className="w-14 border-b-2 border-paper/40 bg-transparent pb-0.5 text-[0.8125rem] tabular-nums text-paper placeholder:text-paper/40 focus:border-paper focus:outline-none"
            />
          </label>
        </div>
      </div>

      {villes.length > 0 && (
        <p className="border-t-2 border-paper/25 pt-2.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-paper/70">
          Sort à {villes.join(" · ")}
        </p>
      )}

      {erreur && <p className="text-caption text-paper/80">{erreur}</p>}
    </section>
  );
}

/**
 * Les préférences — sur papier assombri et encadrées, le registre du formulaire.
 *
 * Elles portent les mêmes contrôles que l'écran « Créer », et c'est inévitable : ce sont les
 * mêmes réglages. Ce qui les distingue est donc le fond et le cadre, plus une phrase qui dit à
 * quoi elles servent — sans quoi on croyait avoir ouvert « Créer » par erreur.
 */
function Preferencier({
  prefs,
  onChange,
}: {
  prefs: Preferences;
  onChange: (prefs: Preferences) => void;
}) {
  return (
    <section className="flex flex-col gap-4 border-2 border-ink bg-paper-2 p-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-[1.35rem] uppercase leading-[0.9] tracking-[-0.01em] text-ink">
          Tes préférences
        </h2>
        <p className="text-body text-ink-soft [text-wrap:pretty]">
          Le point de départ de tes sorties. Coche «&nbsp;Partir de mes préférences&nbsp;» au
          moment de créer pour les appliquer.
        </p>
      </div>

      <VibeSliders value={prefs.vibe} onChange={(vibe) => onChange({ ...prefs, vibe })} />

      <div className="flex flex-col gap-2">
        <h3 className="text-overline uppercase text-ink-soft">
          Envies <span className="text-ink-mute">— facultatif</span>
        </h3>
        <ThemePicker value={prefs.themes} onChange={(t) => onChange({ ...prefs, themes: t })} />
      </div>

      <VillesPreferees
        villes={prefs.cities}
        onChange={(cities) => onChange({ ...prefs, cities })}
      />
    </section>
  );
}

/**
 * Les villes de référence.
 *
 * Le champ de départ propose d'emblée les six communes les plus peuplées de France — c'est-à-dire
 * les villes de tout le monde et de personne. Quelqu'un qui sort à Tours et à Angers n'a que
 * faire de Marseille en un geste. Renseignées ici, ses villes prennent la place de ces
 * raccourcis génériques.
 *
 * Quatre au plus : au-delà, ce n'est plus une référence mais une liste, et les raccourcis
 * reprendraient deux lignes sous le champ.
 */
function VillesPreferees({
  villes,
  onChange,
}: {
  villes: string[];
  onChange: (villes: string[]) => void;
}) {
  const [saisie, setSaisie] = useState("");
  const complet = villes.length >= VILLES_MAX;
  const suggestions = (saisie ? matchCities(saisie, 4) : SUGGESTED_CITIES).filter(
    (v) => !villes.includes(v)
  );

  function ajouter(ville: string) {
    if (complet || villes.includes(ville)) return;
    onChange([...villes, ville]);
    setSaisie("");
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-overline uppercase text-ink-soft">
        Tes villes <span className="text-ink-mute">— facultatif</span>
      </h3>

      {villes.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {villes.map((ville) => (
            <li key={ville}>
              <button
                type="button"
                onClick={() => onChange(villes.filter((v) => v !== ville))}
                aria-label={`Retirer ${ville}`}
                className="flex items-center gap-1.5 border-2 border-ink bg-accent px-2.5 py-1 text-[0.6875rem] font-bold uppercase tracking-[0.06em] text-paper"
              >
                {ville}
                <span aria-hidden className="text-[0.8125rem] leading-none">
                  ×
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!complet && (
        <>
          <input
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              // La saisie libre est acceptée telle quelle : la liste des villes est un raccourci,
              // jamais une restriction — la génération marche pour toute commune géocodable.
              const valeur = suggestions[0] ?? saisie.trim();
              if (valeur) ajouter(valeur);
            }}
            placeholder="Ajouter une ville"
            aria-label="Ajouter une ville de référence"
            className="h-11 w-full border-2 border-ink bg-paper px-3 text-body text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-ink"
          />
          <ul className="flex flex-wrap gap-1.5">
            {suggestions.slice(0, 4).map((ville) => (
              <li key={ville}>
                <button type="button" onClick={() => ajouter(ville)} className={chipClass(false)}>
                  {ville}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/**
 * L'état d'attente dit **combien il en manque**, et non « pas encore de données » : un profil
 * qui se tait sans dire pourquoi laisse croire qu'il est cassé, alors que ce nombre est
 * atteignable en une seule sortie.
 */
function NePasEncoreSavoir({ visites }: { visites: number }) {
  const restants = Math.max(0, VISITES_MINIMUM - visites);
  return (
    <div className="border-2 border-dashed border-ink-mute px-5 py-10">
      <p className="text-body text-ink-soft [text-wrap:pretty]">
        {visites === 0
          ? "On ne sait encore rien de tes habitudes, et on préfère le dire plutôt que d'inventer. Coche les étapes où tu vas pendant tes sorties : au bout de quelques-unes, on saura ce que tu aimes vraiment."
          : /* « étapes » et non « lieux » : le compte porte sur les passages, et deux passages
               au même endroit ne font qu'un lieu — la phrase aurait été fausse. */
            `Encore ${restants} étape${restants > 1 ? "s" : ""} cochée${restants > 1 ? "s" : ""} et on pourra dire quelque chose de juste sur tes goûts. En dessous, on se tromperait.`}
      </p>
    </div>
  );
}
