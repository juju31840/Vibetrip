import "server-only";
import { haversineDistanceKm } from "./geo";
import type { GeoPoint, PlaceType, ThemeId, TripMode } from "@/types/itinerary";

/**
 * Le socle de lieux réels — l'inversion du pipeline.
 *
 * Jusqu'ici le modèle inventait un itinéraire et on vérifiait après coup : la moitié des étapes
 * échouait (52 % de confirmations mesurées, Paris 0/5, Lyon 0/4). Ici on lui donne d'abord une
 * liste de lieux **qui existent**, et il compose parmi eux. Le taux de confirmation devient élevé
 * par construction, et le modèle n'a plus à produire de la connaissance — seulement de
 * l'agencement, ce qu'il fait bien.
 *
 * Ce que la base garantit et ce qu'elle ne garantit pas, il faut être net là-dessus : elle
 * garantit que le lieu **existe**, à cette adresse, dans cette catégorie. Elle ne dit rien de son
 * intérêt — un Domino's Pizza y côtoie un bouchon lyonnais. C'est précisément le partage retenu :
 * la base fournit les faits, le modèle porte le jugement. D'où une liste large plutôt qu'étroite,
 * pour qu'il ait de quoi écarter.
 *
 * En cas d'indisponibilité (identifiants absents, réseau, base en panne), la fonction rend une
 * liste vide et la génération retombe sur l'ancien comportement. Le socle améliore le produit, il
 * ne doit pas être un point de rupture.
 */

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Mesuré, et c'est le seul arbitrage coûteux de l'inversion : à 90 candidats, la première
 * proposition d'un week-end à Bordeaux tombait à 18,8 s contre 9,8 s sans socle — le modèle passe
 * son temps à lire la liste. À 50, le choix reste largement suffisant (une soirée compte 4 étapes,
 * un week-end 8) et l'attente redevient tenable. Le socle lui-même ne coûte que 0,22 s : tout le
 * surcoût est dans la longueur du prompt.
 */
const CANDIDATS_MAX = 50;

/**
 * Enseignes écartées du vivier. Elles existent, sont correctement référencées, et ne sont jamais
 * une sortie : les proposer ferait douter de tout le reste. Liste volontairement courte — le tri
 * fin reste au modèle, ceci n'écarte que l'indéfendable.
 */
const CHAINES = [
  "mcdonald", "domino", "subway", "starbucks", "burger king", "kfc", "quick",
  "brioche dorée", "paul ", "class'croute", "pizza hut", "o'tacos", "buffalo grill",
  "flunch", "courtepaille", "la mie caline", "columbus caf", "pomme de pain",
];

export interface PlaceCandidate {
  /** Référence courte (« L12 ») que le modèle cite au lieu d'inventer un nom et des coordonnées. */
  ref: string;
  /** Identifiant réel du lieu en base — sert à compter ce qui a été servi. */
  id: string;
  name: string;
  location: GeoPoint;
  address: string | null;
  type: PlaceType;
  themes: ThemeId[];
  distanceM: number;
}

interface LigneRpc {
  ref: string;
  fsq_id: string;
  nom: string;
  lat: number;
  lng: number;
  adresse: string | null;
  type_lieu: string;
  themes: string[];
  distance_m: number;
}

/**
 * Rayon de recherche, aligné sur celui du filtre de plausibilité (`lib/geo.ts`) : proposer des
 * candidats qu'un contrôle ultérieur rejetterait n'aurait pas de sens.
 */
const RAYONS: Record<TripMode, { min: number; max: number }> = {
  tonight: { min: 5, max: 30 },
  weekend: { min: 15, max: 50 },
  trip: { min: 40, max: 180 },
};

export function rayonKm(mode: TripMode, distance: number): number {
  const { min, max } = RAYONS[mode];
  const t = Math.min(100, Math.max(0, distance)) / 100;
  return min + (max - min) * t;
}

export async function fetchCandidates(options: {
  origin: GeoPoint;
  mode: TripMode;
  distance: number;
  themes?: ThemeId[];
  /** Différencie les propositions parallèles : sans elle, les trois angles piochent les mêmes lieux. */
  seed: string;
}): Promise<PlaceCandidate[]> {
  if (!URL_BASE || !CLE) return [];

  const { origin, mode, distance, themes, seed } = options;
  // Assez large pour que chaque période de chaque jour ait le choix, sans noyer le prompt.
  const parTheme = themes && themes.length > 0 ? Math.ceil(CANDIDATS_MAX / themes.length) : 9;

  try {
    const response = await fetch(`${URL_BASE}/rest/v1/rpc/candidats_autour`, {
      method: "POST",
      headers: { apikey: CLE, Authorization: `Bearer ${CLE}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_lat: origin.lat,
        p_lng: origin.lng,
        p_rayon_km: rayonKm(mode, distance),
        p_themes: themes && themes.length > 0 ? themes : null,
        p_par_theme: parTheme,
        p_graine: seed,
      }),
    });
    if (!response.ok) return [];

    const lignes = (await response.json()) as LigneRpc[];
    return lignes
      .filter((l) => !estUneChaine(l.nom))
      .slice(0, CANDIDATS_MAX)
      .map((l) => ({
        ref: l.ref,
        id: l.fsq_id,
        name: l.nom,
        location: { lat: l.lat, lng: l.lng },
        address: l.adresse,
        type: l.type_lieu as PlaceType,
        themes: l.themes as ThemeId[],
        distanceM: l.distance_m,
      }));
  } catch {
    // Socle indisponible : on ne casse pas la génération, elle repart comme avant.
    return [];
  }
}

function estUneChaine(nom: string): boolean {
  const n = nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  return CHAINES.some((chaine) => n.includes(chaine));
}

/**
 * Retrouve le candidat cité par le modèle. La référence prime, mais un modèle peut la déformer
 * (« L12 » écrit « l12 », « L 12 ») : on rattrape par le nom, puis on exige que la coordonnée
 * proposée soit proche, faute de quoi on considère que le modèle parlait d'autre chose.
 */
export function resolveCandidate(
  ref: string | null | undefined,
  placeName: string,
  candidates: PlaceCandidate[]
): PlaceCandidate | null {
  if (candidates.length === 0) return null;

  if (ref) {
    const cle = ref.replace(/\s+/g, "").toUpperCase();
    const exact = candidates.find((c) => c.ref.toUpperCase() === cle);
    if (exact) return exact;
  }

  const cherche = normaliser(placeName);
  return candidates.find((c) => normaliser(c.name) === cherche) ?? null;
}

/** Distance entre ce que le modèle a écrit et le lieu réel — sert à repérer une confusion. */
export function ecartKm(candidat: PlaceCandidate, propose: GeoPoint): number {
  return haversineDistanceKm(candidat.location, propose);
}

function normaliser(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Compte les lieux réellement servis à un utilisateur.
 *
 * Sans ce compteur, `proposed_count` resterait à zéro et la file de vérification Google
 * prioriserait au hasard — or son principe est justement de vérifier d'abord ce que les gens
 * voient. C'est la seule écriture que l'application fait dans le socle, et elle ne touche qu'un
 * entier : la clé publiable n'a pas le droit d'écrire dans `places`, l'incrément passe donc par
 * une fonction dédiée.
 *
 * Volontairement sans `await` côté appelant : un échec de comptage ne doit jamais retarder ni
 * faire échouer une génération.
 */
export async function notePropositions(ids: string[]): Promise<void> {
  if (!URL_BASE || !CLE || ids.length === 0) return;

  try {
    await fetch(`${URL_BASE}/rest/v1/rpc/noter_propositions`, {
      method: "POST",
      headers: { apikey: CLE, Authorization: `Bearer ${CLE}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_ids: [...new Set(ids)] }),
    });
  } catch {
    // Statistique d'usage : son échec n'a aucune conséquence pour l'utilisateur.
  }
}
