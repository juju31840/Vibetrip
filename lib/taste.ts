"use client";

import { THEMES } from "./themes";
import { lastVisitTime, type VisitedPlace } from "./places-store";
import type { PlaceType, ThemeId } from "@/types/itinerary";

/**
 * Ce que l'application a compris des goûts de quelqu'un, à partir de ce qu'il a **fait**.
 *
 * Rien n'est demandé : le profil se lit dans les lieux cochés pendant les sorties. Un
 * questionnaire aurait recueilli ce qu'on croit aimer ; les cases cochées disent où l'on est
 * réellement allé, ce qui n'est pas la même chose et vaut mieux.
 *
 * **Le profil doit changer le résultat, sinon il ne sert à rien.** C'était la réserve inscrite
 * de longue date dans les notes du projet : un profil qui n'a aucun effet visible n'est qu'un
 * formulaire décoratif. Les envies déduites ici sont donc proposées à l'écran de réglages, où
 * elles présélectionnent les thèmes — l'utilisateur les voyant cochées, il peut les refuser.
 */

/** En dessous, on n'a pas vu assez de sorties pour prétendre connaître quelqu'un. */
export const VISITES_MINIMUM = 4;

/** Un goût, c'est une préférence marquée — pas la simple présence d'un type dans la liste. */
const PART_MINIMALE = 0.25;

const TYPE_VERS_THEME: Record<PlaceType, ThemeId | null> = {
  restaurant: "eat",
  bar: "drink",
  cafe: "drink",
  museum: "culture",
  park: "outdoor",
  viewpoint: "outdoor",
  shopping: "shopping",
  nightlife: "night",
  activity: null,
  hotel: null,
  transport: null,
  other: null,
};

export interface Gout {
  theme: ThemeId;
  label: string;
  /** Nombre de passages relevant de cette envie. */
  passages: number;
  /** Part du total, entre 0 et 1. */
  part: number;
}

export interface Profil {
  /** Assez de matière pour dire quelque chose ? En dessous, on se tait. */
  etabli: boolean;
  visites: number;
  lieux: number;
  villes: number;
  /** Les envies qui **ressortent** — celles qu'on nomme, et celles qu'on présélectionne. */
  gouts: Gout[];
  /**
   * Tout ce qui a été visité au moins une fois, du plus au moins fréquent.
   *
   * Distinct de `gouts` à dessein : les barres servent à **comparer**, et une barre seule ne
   * compare rien — elle répète la phrase qui la précède en ayant l'air d'un graphique cassé.
   * C'est le même arbitrage que sur la répartition de « Ma carte », pour la même raison.
   */
  repartition: Gout[];
  /** Ce qu'on n'a jamais fait — plus intéressant à dire que ce qu'on répète. */
  jamais: { theme: ThemeId; label: string }[];
  /** Ville la plus fréquentée, quand il y en a une qui domine. */
  villePrincipale: string | null;
}

export function lireProfil(places: VisitedPlace[]): Profil {
  const passagesParTheme = new Map<ThemeId, number>();
  const villes = new Map<string, number>();
  let total = 0;

  for (const place of places) {
    const nb = place.visits.length;
    total += nb;
    const theme = TYPE_VERS_THEME[place.type];
    if (theme) passagesParTheme.set(theme, (passagesParTheme.get(theme) ?? 0) + nb);
    if (place.city) villes.set(place.city, (villes.get(place.city) ?? 0) + nb);
  }

  const tous: Gout[] = THEMES.map((t) => ({
    theme: t.id,
    label: t.label,
    passages: passagesParTheme.get(t.id) ?? 0,
    part: total > 0 ? (passagesParTheme.get(t.id) ?? 0) / total : 0,
  })).sort((a, b) => b.passages - a.passages);

  const repartition = tous.filter((g) => g.passages > 0);
  const gouts = repartition.filter((g) => g.part >= PART_MINIMALE);

  const jamais = THEMES.filter((t) => (passagesParTheme.get(t.id) ?? 0) === 0)
    .map((t) => ({ theme: t.id, label: t.label }));

  const villeTete = [...villes.entries()].sort(([, a], [, b]) => b - a)[0];

  return {
    etabli: total >= VISITES_MINIMUM,
    visites: total,
    lieux: places.length,
    villes: villes.size,
    gouts,
    repartition,
    jamais,
    villePrincipale: villeTete?.[0] ?? null,
  };
}

/**
 * Les envies à présélectionner au réglage. Deux au plus : présélectionner davantage reviendrait
 * à tout cocher, ce qui ne dirige plus rien et retirerait à l'utilisateur le choix qu'on prétend
 * lui faciliter.
 */
export function envieseDeduites(profil: Profil): ThemeId[] {
  if (!profil.etabli) return [];
  return profil.gouts.slice(0, 2).map((g) => g.theme);
}

/** Le dernier lieu visité, pour ouvrir le profil sur quelque chose de concret. */
export function dernierLieu(places: VisitedPlace[]): VisitedPlace | null {
  if (places.length === 0) return null;
  return [...places].sort((a, b) => lastVisitTime(b) - lastVisitTime(a))[0] ?? null;
}
