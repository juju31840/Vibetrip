"use client";

/**
 * Ce qu'on a déjà noté — mémorisé **dans le navigateur**, et nulle part ailleurs.
 *
 * La base n'enregistre qu'une somme et un nombre : elle ne sait donc pas qui a noté quoi, et
 * c'est délibéré. Mais l'application, elle, doit s'en souvenir pour ne pas redemander sans fin
 * son avis sur le même endroit. Ce registre reste donc sur l'appareil : il rend le service sans
 * qu'aucun avis nominatif ne quitte le téléphone.
 *
 * **Il retient désormais la note elle-même, et le nom du lieu.** Il ne gardait que le fait
 * d'avoir noté — si bien qu'on donnait une appréciation qu'on ne revoyait jamais. C'est très
 * exactement le défaut qui avait motivé « Ma carte » : un geste qui ne rend rien finit par ne
 * plus être fait. Le profil peut maintenant rendre ces notes à qui les a données.
 *
 * Conséquence assumée : vider son stockage remet le compteur à zéro et l'application pourra
 * redemander. C'est le prix d'une base qui ne tient aucun registre de personnes.
 */

const CLE = "vibetrip.rated.v1";

export interface NoteDonnee {
  /** `${itineraryId}:${stepId}` — la même forme de référence que les passages. */
  ref: string;
  placeName: string;
  /** 1 à 5. */
  note: number;
  /** ISO 8601, absolu. */
  at: string;
}

function ref(itineraryId: string, stepId: string): string {
  return `${itineraryId}:${stepId}`;
}

/**
 * Lit le registre en tolérant l'ancien format.
 *
 * Les premières notes ont été enregistrées comme de simples chaînes de référence, sans valeur ni
 * nom. Les jeter aurait fait redemander son avis à quelqu'un qui l'a déjà donné ; on les garde
 * donc, avec `note: 0`, ce qui les rend invisibles aux classements sans les effacer.
 */
function lire(): NoteDonnee[] {
  try {
    const brut = window.localStorage.getItem(CLE);
    if (!brut) return [];
    const parsed: unknown = JSON.parse(brut);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entree) =>
      typeof entree === "string"
        ? { ref: entree, placeName: "", note: 0, at: "" }
        : (entree as NoteDonnee)
    );
  } catch {
    return [];
  }
}

export function estNote(itineraryId: string, stepId: string): boolean {
  if (typeof window === "undefined") return false;
  return lire().some((entree) => entree.ref === ref(itineraryId, stepId));
}

export function marquerNote(
  itineraryId: string,
  stepId: string,
  placeName: string,
  note: number
): void {
  if (typeof window === "undefined") return;
  const cle = ref(itineraryId, stepId);
  const deja = lire();
  if (deja.some((entree) => entree.ref === cle)) return;
  try {
    window.localStorage.setItem(
      CLE,
      JSON.stringify([...deja, { ref: cle, placeName, note, at: new Date().toISOString() }])
    );
  } catch {
    // Stockage indisponible : l'application redemandera, ce qui est sans gravité.
  }
}

/** Les notes portant une valeur, de la plus récente à la plus ancienne. */
export function listerNotes(): NoteDonnee[] {
  if (typeof window === "undefined") return [];
  return lire()
    .filter((entree) => entree.note > 0 && entree.placeName)
    .sort((a, b) => b.at.localeCompare(a.at));
}
