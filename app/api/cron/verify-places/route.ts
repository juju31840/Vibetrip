import "server-only";
import { NextResponse } from "next/server";

/**
 * Vérification quotidienne des lieux contre Google Places — la version serveur du script
 * `npm run verify:google`, déclenchée par le cron Vercel (voir `vercel.json`).
 *
 * Elle existe parce qu'une routine locale ne peut pas tenir ce rôle : elle ne tourne que quand
 * l'ordinateur est allumé. Or la question posée — « ce lieu a-t-il fermé ? » — concerne des gens
 * qui partent s'y rendre aujourd'hui.
 *
 * **Budget avant tout.** Le Text Search coûte 32 $ les 1 000 appels avec 5 000 gratuits par mois ;
 * vérifier le socle entier reviendrait à ~18 400 $ par passage. Le lot est donc plafonné à 150,
 * ce qui tient dans le quota gratuit, et la file est ordonnée par ce que les utilisateurs voient
 * réellement : un lieu jamais proposé à personne n'a pas besoin d'être frais.
 *
 * **On stocke un verdict, jamais du contenu Google** — leurs conditions n'autorisent à conserver
 * indéfiniment que le `place_id`.
 */

// 60 s : la limite du plan Hobby. C'est elle qui impose de paralléliser les appels.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const GOOGLE_URL = "https://places.googleapis.com/v1/places:searchText";

/** Au-delà, le résultat est un autre lieu — le même piège que `proximity` chez Mapbox. */
const MAX_DISTANCE_M = 300;

/** Sous cette distance, la géographie lève l'ambiguïté que le nom ne lève pas. */
const PROXIMITE_M = 60;

const LOT = 150;

/** Requêtes simultanées. En séquentiel, 150 lieux demandaient 75 s — au-delà de la limite. */
const CONCURRENCE = 8;

interface Lieu {
  fsq_id: string;
  nom: string;
  adresse: string | null;
  commune: string | null;
  lat: number;
  lng: number;
}

async function sql<T>(query: string): Promise<T[]> {
  const ref = process.env.SUPABASE_PROJECT_REF;
  const jeton = process.env.SUPABASE_ACCESS_TOKEN;
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jeton}`,
      "Content-Type": "application/json",
      // Le pare-feu de Supabase rejette certains User-Agent par un 403 : on en pose un explicite.
      "User-Agent": "vibetrip-cron/1.0",
    },
    body: JSON.stringify({ query }),
  });
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error(data?.message ?? "requête refusée");
  return data as T[];
}

function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const r = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function motsDistinctifs(nom: string): string[] {
  return nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((mot) => mot.length > 2);
}

/** Voir `scripts/verify-google.mjs` : Google met la raison sociale entière dans le nom. */
function memeLieu(nomSocle: string, nomGoogle: string, distance: number): boolean {
  const attendus = motsDistinctifs(nomSocle);
  if (attendus.length === 0) return false;
  const presents = new Set(motsDistinctifs(nomGoogle));
  const tousPresents = attendus.every((mot) => presents.has(mot));
  return tousPresents && distance <= PROXIMITE_M;
}

export async function GET(request: Request) {
  // Vercel signe ses appels de cron ; sans ce contrôle, l'URL serait une dépense publique.
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  }

  const cle = process.env.GOOGLE_PLACES_API_KEY;
  if (!cle) return NextResponse.json({ error: "clé Google absente" }, { status: 500 });

  const file = await sql<Lieu>(`
    select fsq_id, name as nom, address as adresse, locality as commune,
           ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
    from places
    where (google_checked_at is null or google_checked_at < now() - interval '180 days')
      and not coord_douteuse and not est_chaine and not nom_douteux
    order by proposed_count desc, (refreshed_at < date '2022-01-01') desc, google_checked_at nulls first
    limit ${LOT}
  `);

  let ouverts = 0;
  let introuvables = 0;
  const fermes: string[] = [];
  let arrete = false;

  const cleGoogle: string = cle;

  async function traiter(lieu: Lieu) {
    if (arrete) return;
    const requete = [lieu.nom, lieu.adresse, lieu.commune].filter(Boolean).join(" ");
    const reponse = await fetch(GOOGLE_URL, {
      method: "POST",
      headers: {
        "X-Goog-Api-Key": cleGoogle,
        // Masque minimal : demander horaires ou avis reclasse l'appel au tarif supérieur.
        "X-Goog-FieldMask": "places.id,places.location,places.businessStatus,places.displayName",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        textQuery: requete,
        locationBias: { circle: { center: { latitude: lieu.lat, longitude: lieu.lng }, radius: 500 } },
        languageCode: "fr",
        // Cinq candidats : avec un seul, le moteur classe parfois le bon en deuxième.
        maxResultCount: 5,
      }),
    });
    // Quota atteint ou panne : on cesse d'appeler et on reprendra demain, la file est persistante.
    if (!reponse.ok) { arrete = true; return; }

    const data = (await reponse.json()) as {
      places?: {
        id: string;
        location: { latitude: number; longitude: number };
        businessStatus?: string;
        displayName?: { text?: string };
      }[];
    };

    let statut = "not_found";
    let placeId: string | null = null;
    for (const place of data.places ?? []) {
      const d = distanceM(
        { lat: place.location.latitude, lng: place.location.longitude },
        { lat: lieu.lat, lng: lieu.lng }
      );
      if (d > MAX_DISTANCE_M) continue;
      if (!memeLieu(lieu.nom, place.displayName?.text ?? "", d)) continue;
      placeId = place.id;
      statut = place.businessStatus === "CLOSED_PERMANENTLY" ? "closed" : "exists";
      break;
    }

    if (statut === "exists") ouverts += 1;
    else if (statut === "closed") fermes.push(`${lieu.nom} (${lieu.commune ?? "?"})`);
    else introuvables += 1;

    await sql(`
      update places set google_status = '${statut}', google_checked_at = now(),
             google_place_id = ${placeId ? `'${placeId.replace(/'/g, "''")}'` : "null"}
      where fsq_id = '${lieu.fsq_id.replace(/'/g, "''")}'
    `);
  }

  for (let i = 0; i < file.length; i += CONCURRENCE) {
    if (arrete) break;
    await Promise.all(file.slice(i, i + CONCURRENCE).map(traiter));
  }

  return NextResponse.json({ verifies: file.length, ouverts, introuvables, fermes });
}
