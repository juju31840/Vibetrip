"use client";

import type { ItineraryStep } from "@/types/itinerary";

/**
 * Repère les étapes d'un itinéraire **déjà enregistré** dont le lieu a fermé depuis.
 *
 * C'est le seul trou qui restait dans la promesse du produit. Un lieu marqué fermé disparaît des
 * nouvelles générations, mais un itinéraire sauvegardé la veille garde le sien : quelqu'un s'y
 * rend et trouve porte close. Or la fin de la boucle d'usage est précisément qu'il **s'y rende
 * vraiment** — c'est ce qui a justifié tout le socle.
 *
 * Les itinéraires vivent dans le navigateur et ne portent que le nom et la coordonnée d'une
 * étape, jamais son identifiant : le socle est arrivé après eux. La correspondance se refait donc
 * côté base, par proximité (150 m) et par nom normalisé.
 *
 * **150 m, et non les 300 m de la vérification Google.** On ne cherche pas ici à identifier un
 * lieu mais à confirmer qu'une étape est bien celle qu'on croit. Un faux positif annoncerait une
 * fermeture à quelqu'un dont le lieu est ouvert — plus grave qu'une fermeture manquée, puisqu'on
 * lui ferait annuler une sortie qui tenait debout.
 */

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export interface EtapeFermee {
  /** Nom de l'étape, tel qu'il figure dans l'itinéraire enregistré. */
  placeName: string;
  /** Date à laquelle la fermeture a été constatée. */
  closedOn: string | null;
}

interface LigneRpc {
  nom: string;
  statut: string;
  ferme_le: string | null;
}

/**
 * Rend les étapes dont le lieu a fermé. Une liste vide signifie « rien à signaler » — soit que
 * tout soit ouvert, soit que la question n'ait pas pu être posée. On ne distingue pas les deux :
 * en cas de doute, on se tait plutôt que d'inquiéter à tort.
 */
export async function findClosedSteps(steps: ItineraryStep[]): Promise<EtapeFermee[]> {
  if (!URL_BASE || !CLE || steps.length === 0) return [];

  const etapes = steps.map((step) => ({
    nom: step.placeName,
    lat: step.location.lat,
    lng: step.location.lng,
  }));

  try {
    const response = await fetch(`${URL_BASE}/rest/v1/rpc/statut_etapes`, {
      method: "POST",
      headers: { apikey: CLE, Authorization: `Bearer ${CLE}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_etapes: etapes }),
    });
    if (!response.ok) return [];

    const lignes = (await response.json()) as LigneRpc[];
    return lignes
      .filter((l) => l.statut === "closed")
      .map((l) => ({ placeName: l.nom, closedOn: l.ferme_le }));
  } catch {
    // Socle injoignable : on n'affiche rien. Une alerte qu'on ne sait pas justifier est pire
    // que pas d'alerte du tout.
    return [];
  }
}

/**
 * Signale qu'on est allé dans un lieu — le signal maison qui remplace les notes.
 *
 * Il n'enregistre **qu'un compteur par lieu** : ni identifiant, ni date, ni trace individuelle.
 * On cherche à savoir qu'un endroit marche, pas qui y va. C'est aussi ce qui rend le geste
 * acceptable sans rien demander à personne.
 *
 * Sa valeur est différée et assumée : à zéro visite partout, il ne change rien. Il faut du monde
 * pour qu'il classe — mais commencer à compter aujourd'hui, c'est avoir de quoi classer dans un
 * mois. Ne pas compter, c'est n'avoir jamais rien.
 *
 * Jamais attendu par l'appelant : cocher une étape doit rester instantané.
 */
export async function noteVisit(step: { placeName: string; location: { lat: number; lng: number } }): Promise<void> {
  if (!URL_BASE || !CLE) return;
  try {
    await fetch(`${URL_BASE}/rest/v1/rpc/noter_visite`, {
      method: "POST",
      headers: { apikey: CLE, Authorization: `Bearer ${CLE}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_nom: step.placeName,
        p_lat: step.location.lat,
        p_lng: step.location.lng,
      }),
    });
  } catch {
    // Statistique d'usage : son échec n'a aucune conséquence pour l'utilisateur.
  }
}

/**
 * Note un lieu de 1 à 5 — l'actif que ni Google ni TripAdvisor ne possèdent.
 *
 * Une photo, tout le monde l'a ; une note donnée par quelqu'un qui est allé sur place grâce à
 * l'application n'appartient qu'à elle. C'est ce qui fera remonter les bons lieux, et à terme ce
 * qui distinguera ses propositions de celles d'un moteur généraliste.
 *
 * Comme le compteur de visites, rien d'individuel n'est conservé : la base additionne une somme
 * et un nombre, pas des avis signés.
 */
export async function rateStep(
  step: { placeName: string; location: { lat: number; lng: number } },
  note: number
): Promise<void> {
  if (!URL_BASE || !CLE) return;
  try {
    await fetch(`${URL_BASE}/rest/v1/rpc/noter_lieu`, {
      method: "POST",
      headers: { apikey: CLE, Authorization: `Bearer ${CLE}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_nom: step.placeName,
        p_lat: step.location.lat,
        p_lng: step.location.lng,
        p_note: note,
      }),
    });
  } catch {
    // Comme le reste des signaux d'usage : son échec ne regarde pas l'utilisateur.
  }
}
