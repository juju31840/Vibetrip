/**
 * Vérifie contre Google Places qu'un lot de lieux du socle existe toujours, et écrit le verdict.
 *
 * C'est la dernière brique de la chaîne de fiabilité. Le socle Foursquare dit qu'un lieu **a
 * existé** et où ; seul Google dit qu'il **existe encore aujourd'hui**. C'est le cas « Le Baron » :
 * nom exact, coordonnées exactes, fermé depuis des années, et aucune comparaison de noms ne
 * pouvait le savoir.
 *
 * Deux règles non négociables, détaillées dans .claude/skills/verify-places-google/SKILL.md :
 *   1. On stocke un VERDICT, jamais du contenu Google. Les conditions d'utilisation n'autorisent
 *      à conserver indéfiniment que le place_id.
 *   2. Le budget commande le volume : 32 $ les 1 000 appels, 5 000 gratuits par mois. Vérifier
 *      tout le socle coûterait ~18 400 $ par passage. D'où un lot par défaut de 150.
 *
 *   npm run verify:google -- [--lot 150] [--sec]   (--sec = à sec, aucun appel facturé)
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOOGLE_URL = "https://places.googleapis.com/v1/places:searchText";

/** Au-delà, le résultat est un autre lieu — même piège que `proximity` chez Mapbox. */
const MAX_DISTANCE_M = 300;

const args = process.argv.slice(2);
const LOT = Number(args[args.indexOf("--lot") + 1]) || 150;
const A_SEC = args.includes("--sec");

function reglage(cle) {
  const cfg = JSON.parse(readFileSync(".claude/settings.local.json", "utf8"));
  return cfg.env?.[cle] ?? process.env[cle] ?? null;
}

const REF = reglage("SUPABASE_PROJECT_REF");
const JETON = reglage("SUPABASE_ACCESS_TOKEN");
const CLE_GOOGLE = reglage("GOOGLE_PLACES_API_KEY");

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${JETON}`,
      "Content-Type": "application/json",
      // Indispensable : le pare-feu de Supabase rejette le User-Agent par défaut par un 403.
      "User-Agent": "vibetrip-verify/1.0",
    },
    body: JSON.stringify({ query }),
  });
  const d = await r.json();
  if (!Array.isArray(d)) throw new Error(d?.message ?? "requête refusée");
  return d;
}

/** Compile le module TypeScript pur pour l'exécuter tel quel — jamais une copie de sa logique. */
async function chargerMatcher() {
  const out = mkdtempSync(join(tmpdir(), "vibetrip-match-"));
  execFileSync("npx", ["tsc", "lib/place-match.ts", "--outDir", out, "--target", "es2020",
    "--module", "es2020", "--skipLibCheck", "--typeRoots", out], { stdio: "inherit" });
  return import(pathToFileURL(join(out, "place-match.js")).href);
}

function distanceM(a, b) {
  const R = 6371000, r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function interrogerGoogle(lieu) {
  const requete = [lieu.nom, lieu.adresse, lieu.commune].filter(Boolean).join(" ");
  const r = await fetch(GOOGLE_URL, {
    method: "POST",
    headers: {
      "X-Goog-Api-Key": CLE_GOOGLE,
      // Masque minimal : demander les horaires ou les avis reclasse l'appel au tarif supérieur.
      "X-Goog-FieldMask": "places.id,places.location,places.businessStatus,places.displayName",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      textQuery: requete,
      locationBias: { circle: { center: { latitude: lieu.lat, longitude: lieu.lng }, radius: 500 } },
      languageCode: "fr",
      // Cinq candidats et non un seul : la leçon est déjà consignée pour Mapbox
      // (lib/verify-places.ts) — avec un seul résultat on rate les lieux réels que le moteur
      // classe deuxième derrière un homonyme. Mesuré ici aussi : « Place Gambetta » et
      // « Théâtre du Capitole » étaient déclarés introuvables. Le tarif est à l'appel, pas au
      // résultat : examiner cinq candidats ne coûte rien de plus.
      maxResultCount: 5,
    }),
  });
  if (!r.ok) return { erreur: `HTTP ${r.status}` };
  const d = await r.json();
  return { places: d.places ?? [] };
}

const main = async () => {
  if (!REF || !JETON) { console.error("Identifiants Supabase absents."); process.exit(1); }
  if (!CLE_GOOGLE || CLE_GOOGLE.startsWith("<")) {
    console.error("GOOGLE_PLACES_API_KEY absente de .claude/settings.local.json."); process.exit(1);
  }

  const { namesMatch, significantTokens, MIN_QUERY_TOKEN_COVERAGE } = await chargerMatcher();

  /**
   * Le même lieu, à quelques mètres près.
   *
   * Le verrou de `place-match` est calibré pour Mapbox, où le danger est de confirmer « Le Baron »
   * par « Le Baron Rouge » : il plafonne donc les mots ajoutés. Google met en revanche la raison
   * sociale complète dans le nom — « Horace » y devient « HORACE café.cuisine.canons », à 4 m —
   * et le verrou strict rejetait ainsi 62 % des lieux, tous réels.
   *
   * La question posée n'est d'ailleurs pas la même : on ne cherche pas à *confirmer une adresse*,
   * le socle l'a déjà fait, mais à savoir si **ce lieu-ci**, à cette coordonnée, a fermé. À moins
   * de 60 m, c'est la géographie qui lève l'ambiguïté que le nom ne lève pas — à condition que
   * tous les mots distinctifs du nom d'origine s'y retrouvent, ce qui écarte le cas d'une reprise
   * sous une autre enseigne (« Codebar » devenu « Buster », à 8 m : rejeté).
   */
  function memeLieu(nomSocle, nomGoogle, distance) {
    if (namesMatch(nomSocle, nomGoogle, MIN_QUERY_TOKEN_COVERAGE)) return true;
    if (distance > 60) return false;

    const attendus = significantTokens(nomSocle);
    if (attendus.length === 0) return false;
    const presents = new Set(significantTokens(nomGoogle));
    return attendus.every((mot) => presents.has(mot));
  }

  // La file : ce qui est réellement servi d'abord, puis les fiches les plus douteuses. Un lieu
  // que personne ne s'est vu proposer n'a pas besoin d'être frais.
  const file = await sql(`
    select fsq_id, name as nom, address as adresse, locality as commune,
           ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
    from places
    where (google_checked_at is null or google_checked_at < now() - interval '180 days')
      and not coord_douteuse and not est_chaine and not nom_douteux
    order by proposed_count desc, (refreshed_at < date '2022-01-01') desc, google_checked_at nulls first
    limit ${LOT}
  `);

  console.log(`${file.length} lieux à vérifier${A_SEC ? " (à sec, aucun appel)" : ""}\n`);
  if (A_SEC) {
    for (const l of file.slice(0, 10)) console.log(`  ${l.nom} — ${l.commune ?? "?"}`);
    console.log(`\nCoût si lancé pour de vrai : ~${(file.length * 0.032).toFixed(2)} $`);
    return;
  }

  const verdicts = [];
  let ouverts = 0, fermes = 0, introuvables = 0, erreurs = 0;

  for (const lieu of file) {
    const { places, erreur } = await interrogerGoogle(lieu);
    if (erreur) { erreurs++; continue; }

    let statut = "not_found", placeId = null;
    if (process.env.TRACE) console.log(`\n  ${lieu.nom} (${lieu.commune}) — ${places?.length ?? 0} candidat(s)`);
    for (const place of places ?? []) {
      const trouve = { lat: place.location.latitude, lng: place.location.longitude };
      const d = distanceM(trouve, { lat: lieu.lat, lng: lieu.lng });
      const nomOk = memeLieu(lieu.nom, place.displayName?.text ?? "", d);
      if (process.env.TRACE) console.log(`     « ${place.displayName?.text} » ${Math.round(d)} m · nom=${nomOk} · ${place.businessStatus}`);
      if (d > MAX_DISTANCE_M) continue;
      // Les mêmes verrous que la vérification Mapbox : Google renvoie presque toujours quelque
      // chose, et un résultat proche mais d'un autre nom est un autre lieu, pas une correction.
      if (!nomOk) continue;

      placeId = place.id;
      statut = place.businessStatus === "CLOSED_PERMANENTLY" ? "closed" : "exists";
      break;
    }
    if (statut === "exists") ouverts++;
    else if (statut === "closed") { fermes++; verdicts.push(`  FERMÉ — ${lieu.nom} (${lieu.commune ?? "?"})`); }
    else introuvables++;

    await sql(`
      update places set google_status = '${statut}', google_checked_at = now(),
             google_place_id = ${placeId ? `'${placeId.replace(/'/g, "''")}'` : "null"}
      where fsq_id = '${lieu.fsq_id.replace(/'/g, "''")}'
    `);
  }

  console.log(`${ouverts} confirmés ouverts · ${fermes} fermés · ${introuvables} sans correspondance`
    + (erreurs ? ` · ${erreurs} erreurs` : ""));
  console.log(`Coût de ce passage : ~${(file.length * 0.032).toFixed(2)} $\n`);

  // La seule partie du rapport qui appelle une action : ces lieux sont peut-être déjà dans des
  // itinéraires enregistrés, et quelqu'un peut être en train de s'y rendre.
  if (verdicts.length) {
    console.log("Lieux passés à « fermé » :");
    verdicts.forEach((v) => console.log(v));
  }
};

main().catch((e) => { console.error(e.message); process.exit(1); });
