"use client";

import { themeForType as themeOf } from "./themes";
import type { ItineraryStep, ThemeId } from "@/types/itinerary";

/**
 * Lieux réels situés autour d'une étape, cherchés par envie dans le socle de lieux.
 *
 * Deux problèmes résolus d'un coup à l'origine. D'abord le nombre : les alternatives tirées des
 * autres propositions se comptaient sur les doigts d'une main — pour un créneau donné il n'en
 * existait souvent qu'une seule. Ensuite le choix : on ne pouvait pas demander « plutôt quelque
 * chose de culturel ».
 *
 * **Passé du référentiel Mapbox au socle Supabase le 27/08/2026.** L'incohérence sautait aux
 * yeux une fois la génération ancrée : les étapes venaient d'une source et leurs remplaçantes
 * d'une autre, avec des couvertures et des catégories différentes. Le socle est plus fourni,
 * n'est pas facturé à l'appel, applique les mêmes exclusions que la génération (coordonnées de
 * repli, enseignes de chaîne, lieux fermés), et supprime une dépendance externe côté navigateur.
 *
 * Aucun appel au modèle : la réponse arrive en quelques centaines de millisecondes.
 */

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Le panneau propose des alternatives *à proximité* : au-delà, ce n'est plus la même sortie. */
const RAYON_KM = 2;

export { THEMES, themeForType } from "./themes";
export type { ThemeId } from "@/types/itinerary";

interface LigneRpc {
  fsq_id: string;
  nom: string;
  lat: number;
  lng: number;
  adresse: string | null;
  type_lieu: string;
  distance_m: number;
}

/**
 * Cherche des lieux de l'envie demandée autour d'une étape et les renvoie sous la forme d'étapes
 * prêtes à remplacer l'originale (même jour, même créneau — seul le lieu change).
 *
 * `excludeNames` évite de proposer ce qui est déjà dans l'itinéraire.
 */
export async function findNearby(
  theme: ThemeId,
  origin: ItineraryStep,
  excludeNames: string[],
  limit = 8
): Promise<ItineraryStep[]> {
  if (!URL_BASE || !CLE) return [];

  let lignes: LigneRpc[];
  try {
    const response = await fetch(`${URL_BASE}/rest/v1/rpc/lieux_par_theme`, {
      method: "POST",
      headers: { apikey: CLE, Authorization: `Bearer ${CLE}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_lat: origin.location.lat,
        p_lng: origin.location.lng,
        p_theme: theme,
        p_rayon_km: RAYON_KM,
        // On demande plus que nécessaire : une partie sera écartée comme déjà présente.
        p_limite: limit * 3,
      }),
    });
    if (!response.ok) return [];
    lignes = (await response.json()) as LigneRpc[];
  } catch {
    // Socle indisponible : le panneau se contente des alternatives des autres propositions.
    return [];
  }

  const exclus = new Set(excludeNames.map(normalize));
  const vus = new Set<string>();
  const resultats: ItineraryStep[] = [];

  for (const ligne of lignes) {
    const cle = normalize(ligne.nom);
    if (exclus.has(cle) || vus.has(cle)) continue;
    vus.add(cle);

    resultats.push({
      id: `nearby-${ligne.fsq_id}`,
      day: origin.day,
      period: origin.period,
      placeName: ligne.nom,
      description: descriptionCourte(ligne),
      location: { lat: ligne.lat, lng: ligne.lng },
      type: ligne.type_lieu as ItineraryStep["type"],
      // Le lieu sort du socle : son existence et son adresse sont acquises, il n'y a rien à
      // confirmer sur place, contrairement à ce que le modèle propose de lui-même.
      verified: true,
      address: ligne.adresse,
    });
    if (resultats.length >= limit) break;
  }

  return resultats;
}

/**
 * Une ligne de contexte, pas une description rédigée : ces alternatives ne passent par aucun
 * modèle, et inventer une phrase d'ambiance serait exactement ce qu'on s'interdit ailleurs.
 * La distance est l'information utile — c'est elle qui dit si le remplacement tient la route.
 */
function descriptionCourte(ligne: LigneRpc): string {
  const distance =
    ligne.distance_m < 1000
      ? `à ${ligne.distance_m} m`
      : `à ${(ligne.distance_m / 1000).toFixed(1)} km`.replace(".", ",");
  return ligne.adresse ? `${ligne.adresse} — ${distance}` : `${distance} de l'étape remplacée`;
}

/** Réexporté pour les appelants qui ouvrent le panneau sur l'onglet correspondant à l'étape. */
export const themeForStepType = themeOf;

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
