"use client";

import type { ThemeId, VibeSettings } from "@/types/itinerary";

/**
 * Les préférences que l'utilisateur **déclare** — distinctes des goûts qu'on observe.
 *
 * Les deux coexistent, et il ne faut surtout pas les confondre : `lib/taste.ts` dit ce qu'on
 * fait, ce fichier dit ce qu'on veut. Les fondre en une seule valeur ferait perdre l'information
 * la plus intéressante, l'écart entre les deux — quelqu'un qui déclare aimer la culture et ne
 * coche que des bars n'est pas mal renseigné, c'est un fait sur lui.
 *
 * C'est aussi ce qui comble le trou du profil observé : il ne sait rien tant qu'on n'a pas coché
 * quatre étapes, c'est-à-dire pendant toute la première sortie — précisément le moment où l'on
 * aurait le plus besoin d'être orienté. Une préférence déclarée agit dès la première génération.
 *
 * `null` signifie **jamais renseignées**, ce qui n'est pas la même chose que « tout à zéro » :
 * sans cette distinction, l'écran de réglages proposerait de partir de préférences vides.
 */

const CLE = "vibetrip.preferences.v1";

export interface Preferences {
  vibe: VibeSettings;
  themes: ThemeId[];
}

/** Le milieu de course sur les trois axes : la valeur d'un curseur auquel on n'a pas touché. */
export const PREFERENCES_NEUTRES: Preferences = {
  vibe: { budget: 50, ambiance: 50, distance: 50 },
  themes: [],
};

export function lirePreferences(): Preferences | null {
  if (typeof window === "undefined") return null;
  try {
    const brut = window.localStorage.getItem(CLE);
    if (!brut) return null;
    const parsed = JSON.parse(brut) as Partial<Preferences>;
    if (!parsed?.vibe) return null;
    return { vibe: parsed.vibe, themes: Array.isArray(parsed.themes) ? parsed.themes : [] };
  } catch {
    return null;
  }
}

export function ecrirePreferences(prefs: Preferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLE, JSON.stringify(prefs));
  } catch {
    // Stockage indisponible : les préférences valent pour la session, ce qui reste utile.
  }
}

export function effacerPreferences(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CLE);
  } catch {
    /* rien à faire */
  }
}

/**
 * Des préférences « renseignées » ne sont pas des préférences **neutres**.
 *
 * Ouvrir le profil, effleurer un curseur et le remettre où il était écrirait un enregistrement
 * qui ne dit rien. L'écran de réglages proposerait alors de partir de préférences identiques à
 * ses valeurs par défaut — une case à cocher sans effet, ce qui est pire qu'une case absente.
 */
export function preferencesUtiles(prefs: Preferences | null): boolean {
  if (!prefs) return false;
  const { budget, ambiance, distance } = prefs.vibe;
  return (
    prefs.themes.length > 0 || budget !== 50 || ambiance !== 50 || distance !== 50
  );
}

/** Le brouillon suit-il déjà les préférences ? Sert à afficher la case cochée, sans mentir. */
export function draftSuitPreferences(
  draft: { vibe: VibeSettings; themes: ThemeId[] },
  prefs: Preferences
): boolean {
  const memeVibe =
    draft.vibe.budget === prefs.vibe.budget &&
    draft.vibe.ambiance === prefs.vibe.ambiance &&
    draft.vibe.distance === prefs.vibe.distance;
  const memesThemes =
    draft.themes.length === prefs.themes.length &&
    prefs.themes.every((t) => draft.themes.includes(t));
  return memeVibe && memesThemes;
}
