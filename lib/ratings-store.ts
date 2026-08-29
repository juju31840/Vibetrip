"use client";

/**
 * Ce qu'on a déjà noté — mémorisé **dans le navigateur**, et nulle part ailleurs.
 *
 * La base n'enregistre qu'une somme et un nombre : elle ne sait donc pas qui a noté quoi, et
 * c'est délibéré. Mais l'application, elle, doit s'en souvenir pour ne pas redemander sans fin
 * son avis sur le même endroit. Ce registre reste donc sur l'appareil : il rend le service sans
 * qu'aucun avis nominatif ne quitte le téléphone.
 *
 * Conséquence assumée : vider son stockage remet le compteur à zéro et l'application pourra
 * redemander. C'est le prix d'une base qui ne tient aucun registre de personnes.
 */

const CLE = "vibetrip.rated.v1";

/** `${itineraryId}:${stepId}` — la même forme de référence que les passages. */
function ref(itineraryId: string, stepId: string): string {
  return `${itineraryId}:${stepId}`;
}

function lire(): string[] {
  try {
    const brut = window.localStorage.getItem(CLE);
    if (!brut) return [];
    const parsed: unknown = JSON.parse(brut);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export function estNote(itineraryId: string, stepId: string): boolean {
  if (typeof window === "undefined") return false;
  return lire().includes(ref(itineraryId, stepId));
}

export function marquerNote(itineraryId: string, stepId: string): void {
  if (typeof window === "undefined") return;
  const cle = ref(itineraryId, stepId);
  const deja = lire();
  if (deja.includes(cle)) return;
  try {
    window.localStorage.setItem(CLE, JSON.stringify([...deja, cle]));
  } catch {
    // Stockage indisponible : l'application redemandera, ce qui est sans gravité.
  }
}
