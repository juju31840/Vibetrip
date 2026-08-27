"use client";

import type { GeoPoint, ItineraryStep, PlaceType } from "@/types/itinerary";

/**
 * Les lieux où l'utilisateur est réellement allé — la contrepartie du geste « j'y suis allé ».
 *
 * Raison d'être : cocher une étape ne rendait rien. C'était le défaut de la boucle d'usage —
 * régler, choisir, valider, y aller, cocher… et puis plus rien. Une case cochée qui alimente une
 * carte personnelle fait trois choses d'un coup : elle récompense le geste, elle enregistre la
 * sortie sans rien demander à saisir, et elle donne une raison de revenir qui vaut pour les
 * trois modes — Tonight, Weekend et Trip ont des rythmes incompatibles, mais tous trois se
 * déroulent étape par étape et remplissent donc la même carte.
 *
 * Magasin **séparé** des itinéraires, et c'est délibéré : supprimer une sortie de l'historique ne
 * doit pas effacer les lieux où l'on est allé. Une collection qu'on peut perdre en faisant le
 * ménage n'est pas une collection.
 *
 * Comme `ItineraryStore` (lib/storage.ts), tout passe par une interface pour que le basculement
 * vers Supabase soit un changement d'implémentation et non une réécriture des écrans.
 */

const STORAGE_KEY = "vibetrip.places.v1";

export interface PlaceVisit {
  /**
   * `${itineraryId}:${stepId}` — identifie le passage précisément, pour pouvoir le retirer si
   * l'utilisateur décoche l'étape (faute de frappe sur un écran de téléphone, cela arrive).
   */
  ref: string;
  /** ISO 8601, absolu : un « il y a deux jours » figé à l'écriture serait faux à la relecture. */
  at: string;
}

export interface VisitedPlace {
  /** Nom normalisé + coordonnées arrondies : deux passages au même endroit se rejoignent ici. */
  key: string;
  placeName: string;
  location: GeoPoint;
  type: PlaceType;
  /** Adresse du référentiel quand l'étape était confirmée (lib/verify-places.ts). */
  address?: string | null;
  /**
   * Commune, résolue après coup par géocodage inverse (lib/reverse-geocode.ts) et non au moment
   * de cocher : le retour visuel doit être immédiat, pas suspendu à un aller-retour réseau.
   * `undefined` = pas encore résolue, `null` = résolution tentée et échouée (on ne réessaie pas).
   */
  city?: string | null;
  visits: PlaceVisit[];
}

export interface VisitedPlaceStore {
  list(): VisitedPlace[];
  record(itineraryId: string, step: ItineraryStep): void;
  forget(itineraryId: string, stepId: string): void;
  /** Renseigne la commune une fois le géocodage inverse revenu. */
  setCity(key: string, city: string | null): void;
}

function visitRef(itineraryId: string, stepId: string): string {
  return `${itineraryId}:${stepId}`;
}

/**
 * Clé d'identité d'un lieu. Le nom seul ne suffit pas — il y a un « Le Comptoir » dans chaque
 * ville — et les coordonnées seules non plus, puisque le modèle et le référentiel ne posent pas
 * exactement le même point. Trois décimales valent environ 110 m : assez fin pour distinguer
 * deux bars d'une même rue, assez large pour ne pas dédoubler un lieu à cause d'une correction
 * de quelques mètres.
 */
function placeKey(step: ItineraryStep): string {
  const name = step.placeName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return `${name}@${step.location.lat.toFixed(3)},${step.location.lng.toFixed(3)}`;
}

function readAll(): VisitedPlace[] {
  // `localStorage` jette dans plusieurs cas courants (navigation privée, quota, cookies tiers
  // bloqués). Aucun n'est une raison de casser un écran : la carte se contente d'être vide.
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as VisitedPlace[];
  } catch {
    return [];
  }
}

function writeAll(places: VisitedPlace[]): void {
  // Pas de plafond ici, contrairement à l'historique des itinéraires : la valeur de cette liste
  // vient précisément de son accumulation, et une entrée pèse quelques centaines d'octets — on
  // reste très loin du quota même après des années d'usage.
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
  } catch {
    // Stockage indisponible : la carte ne se remplira pas, le reste de l'app fonctionne.
  }
}

export const localVisitedPlaceStore: VisitedPlaceStore = {
  list() {
    if (typeof window === "undefined") return [];
    return readAll();
  },

  record(itineraryId, step) {
    if (typeof window === "undefined") return;

    const key = placeKey(step);
    const ref = visitRef(itineraryId, step.id);
    const places = readAll();
    const existing = places.find((place) => place.key === key);

    if (!existing) {
      writeAll([
        ...places,
        {
          key,
          placeName: step.placeName,
          location: step.location,
          type: step.type,
          address: step.address ?? null,
          visits: [{ ref, at: new Date().toISOString() }],
        },
      ]);
      return;
    }

    // Recocher la même étape ne doit pas compter deux passages : le geste est idempotent.
    if (existing.visits.some((visit) => visit.ref === ref)) return;

    writeAll(
      places.map((place) =>
        place.key === key
          ? { ...place, visits: [...place.visits, { ref, at: new Date().toISOString() }] }
          : place
      )
    );
  },

  setCity(key, city) {
    if (typeof window === "undefined") return;
    writeAll(readAll().map((place) => (place.key === key ? { ...place, city } : place)));
  },

  forget(itineraryId, stepId) {
    if (typeof window === "undefined") return;

    const ref = visitRef(itineraryId, stepId);
    writeAll(
      readAll()
        .map((place) => ({
          ...place,
          visits: place.visits.filter((visit) => visit.ref !== ref),
        }))
        // Un lieu dont on a retiré le dernier passage n'a plus rien à faire sur la carte.
        .filter((place) => place.visits.length > 0)
    );
  },
};

/** Date du dernier passage, en millisecondes — pour trier du plus récent au plus ancien. */
export function lastVisitTime(place: VisitedPlace): number {
  return place.visits.reduce((latest, visit) => {
    const time = new Date(visit.at).getTime();
    return Number.isNaN(time) ? latest : Math.max(latest, time);
  }, 0);
}
