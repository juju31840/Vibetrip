"use client";

/**
 * L'identité : un prénom, un âge, une photo. Gardée **dans le navigateur**, comme tout le reste.
 *
 * Elle ne joue pas le même rôle que les préférences, et il faut le dire franchement : une
 * préférence change les propositions, une identité non. Le produit s'est construit sur la règle
 * qu'on ne demande rien qui ne change rien — mais la règle visait les *questionnaires de goûts*,
 * qui prétendent servir à quelque chose. Un prénom et une photo ne prétendent à rien : ils font
 * qu'un écran cesse d'être un formulaire et devienne un endroit à soi. C'est une autre fonction,
 * assumée comme telle.
 *
 * Aucun compte, aucun serveur : rien de ceci ne quitte l'appareil, pas même la photo.
 */

const CLE = "vibetrip.identity.v1";

export interface Identity {
  name: string;
  /** Vide tant qu'il n'est pas renseigné — `null` plutôt que 0, qui serait un âge. */
  age: number | null;
  /** Image en `data:` URI, déjà réduite à l'enregistrement (voir `reduireImage`). */
  photo: string | null;
}

export const IDENTITE_VIDE: Identity = { name: "", age: null, photo: null };

export function lireIdentite(): Identity {
  if (typeof window === "undefined") return IDENTITE_VIDE;
  try {
    const brut = window.localStorage.getItem(CLE);
    if (!brut) return IDENTITE_VIDE;
    const parsed = JSON.parse(brut) as Partial<Identity>;
    return {
      name: typeof parsed.name === "string" ? parsed.name : "",
      age: typeof parsed.age === "number" ? parsed.age : null,
      photo: typeof parsed.photo === "string" ? parsed.photo : null,
    };
  } catch {
    return IDENTITE_VIDE;
  }
}

export function ecrireIdentite(identity: Identity): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLE, JSON.stringify(identity));
  } catch {
    // Quota dépassé — la photo en est la seule cause plausible. Le reste de l'application
    // fonctionne, et l'écran le signalera plutôt que d'échouer en silence.
  }
}

/** Une identité vaut d'être affichée dès qu'elle porte quelque chose. */
export function identiteRenseignee(identity: Identity): boolean {
  return Boolean(identity.name || identity.photo || identity.age);
}

/** Côté long de la photo enregistrée, en pixels. */
const COTE_MAX = 320;

/**
 * Réduit une photo avant de l'écrire.
 *
 * Indispensable et non cosmétique : `localStorage` plafonne autour de 5 Mo, et une photo de
 * téléphone en `data:` URI en pèse facilement 4 à 8 — elle suffirait à faire échouer
 * l'enregistrement **et** celui des itinéraires et des lieux visités, qui partagent le même
 * quota. À 320 px de côté en JPEG, on tient sous les 30 Ko.
 *
 * Le recadrage est centré et carré : la vignette est carrée à l'écran, et laisser le navigateur
 * étirer une photo verticale déformerait les visages.
 */
export async function reduireImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const cote = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = COTE_MAX;
  canvas.height = COTE_MAX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas indisponible");
  ctx.drawImage(
    bitmap,
    (bitmap.width - cote) / 2,
    (bitmap.height - cote) / 2,
    cote,
    cote,
    0,
    0,
    COTE_MAX,
    COTE_MAX
  );
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}
