/**
 * Rejoue la correspondance de noms (lib/place-match.ts) sur des cas **réels**, contre l'API
 * Mapbox, et compare la décision à ce qu'on attend.
 *
 * Pourquoi ce banc existe : cette fonction décide si l'on affiche « adresse confirmée » à
 * quelqu'un qui va s'y rendre. Un faux positif y est bien plus grave qu'un lieu laissé « à
 * confirmer ». Chaque cas ci-dessous a été observé en production, pas imaginé.
 *
 *   npm run check:match
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const SEARCH_URL = "https://api.mapbox.com/search/searchbox/v1/forward";
const MAX_MATCH_DISTANCE_KM = 5;
const EARTH_RADIUS_KM = 6371;

/** `attendu` : "rejet" = aucun candidat ne doit être confirmé ; "accept" = un vrai lieu attendu. */
const CASES = [
  // — Faux positifs constatés, ou pièges connus —
  { q: "Marché des Capucins", lat: 44.8320, lng: -0.5700, attendu: "rejet",
    note: "confirmé à tort par une annonce de location (27/08/2026)" },
  { q: "Le Baron", lat: 48.8656, lng: 2.3212, attendu: "rejet",
    limiteConnue: "le référentiel contient un POI nommé exactement « Le Baron » à moins de 5 km : aucune comparaison de noms ne peut distinguer l'établissement fermé d'un homonyme ouvert. Il faudrait une donnée d'ouverture, que l'API de recherche ne fournit pas.",
    note: "fermé en 2018" },
  { q: "Chez Marcel", lat: 45.7640, lng: 4.8357, attendu: "rejet", note: "inventé ; un bouchon existe à 20 km" },
  { q: "Le Bar Fleuri", lat: 45.7640, lng: 4.8357, attendu: "rejet", note: "un vrai homonyme à Paris, 390 km" },
  { q: "Club Pigalle Nights", lat: 48.8820, lng: 2.3376, attendu: "rejet", note: "inventé ; le quartier Pigalle matchait" },
  { q: "Café de la Place Colette", lat: 48.8637, lng: 2.3365, attendu: "rejet", note: "inventé ; s'appelle Le Nemours" },
  { q: "Place des Terreaux", lat: 45.7673, lng: 4.8332, attendu: "rejet", note: "réel mais absent ; « Constantine Terreaux - Entire Place » matchait" },

  // — Vrais lieux : ils doivent rester confirmés —
  { q: "Musée d'Aquitaine", lat: 44.8340, lng: -0.5730, attendu: "accept" },
  { q: "La Cité du Vin", lat: 44.8628, lng: -0.5504, attendu: "accept" },
  { q: "Le Chapon Fin", lat: 44.8443, lng: -0.5760, attendu: "accept" },
  { q: "Basilique Notre-Dame de Fourvière", lat: 45.7622, lng: 4.8226, attendu: "accept" },
  { q: "Le Bouchon des Filles", lat: 45.7688, lng: 4.8331, attendu: "accept" },
  { q: "Le Café du Peintre", lat: 45.7740, lng: 4.8322, attendu: "accept" },
  { q: "Place de la Bourse", lat: 44.8412, lng: -0.5697, attendu: "accept" },
];

function haversineKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Compile le module TypeScript pur pour l'exécuter tel quel — jamais une copie de sa logique. */
async function loadMatcher() {
  const out = mkdtempSync(join(tmpdir(), "vibetrip-match-"));
  // `--typeRoots` sur un dossier vide et `--skipLibCheck` : sans eux, tsc charge les typages
  // Node/React du projet et échoue sur des dépendances qui ne concernent en rien ce module,
  // qui est pur et sans aucun import.
  execFileSync(
    "npx",
    ["tsc", "lib/place-match.ts", "--outDir", out, "--target", "es2020", "--module", "es2020",
     "--skipLibCheck", "--typeRoots", out],
    { stdio: "inherit" }
  );
  return import(pathToFileURL(join(out, "place-match.js")).href);
}

function readToken() {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const [key, ...rest] = line.split("=");
    if (key?.trim() === "NEXT_PUBLIC_MAPBOX_TOKEN") return rest.join("=").trim();
  }
  return null;
}

const { namesMatch, MIN_QUERY_TOKEN_COVERAGE, AREA_TOKEN_COVERAGE } = await loadMatcher();
const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? readToken();
if (!token) {
  console.error("NEXT_PUBLIC_MAPBOX_TOKEN introuvable (.env.local).");
  process.exit(1);
}

let failures = 0;
let limites = 0;

for (const testCase of CASES) {
  const url =
    `${SEARCH_URL}?q=${encodeURIComponent(testCase.q)}` +
    `&proximity=${testCase.lng},${testCase.lat}` +
    `&limit=5&types=poi,street,neighborhood&language=fr&access_token=${token}`;

  const response = await fetch(url);
  const data = response.ok ? await response.json() : { features: [] };

  let accepted = null;
  const examined = [];

  for (const feature of data.features ?? []) {
    const name = feature.properties?.name;
    if (!name) continue;
    const [lng, lat] = feature.geometry.coordinates;
    const km = haversineKm({ lat, lng }, testCase);
    if (km > MAX_MATCH_DISTANCE_KM) {
      examined.push(`${name} — écarté (${km.toFixed(1)} km)`);
      continue;
    }
    const coverage =
      feature.properties.feature_type === "poi" ? MIN_QUERY_TOKEN_COVERAGE : AREA_TOKEN_COVERAGE;
    const ok = namesMatch(testCase.q, name, coverage);
    examined.push(`${name} — ${ok ? "RETENU" : "écarté (nom)"}`);
    if (ok) {
      accepted = name;
      break;
    }
  }

  const verdict = accepted ? "accept" : "rejet";
  const pass = verdict === testCase.attendu;

  // Un cas marqué « limite connue » échoue pour une raison hors de portée de ce module : on
  // l'affiche sans le compter comme régression, plutôt que d'ajuster l'attente pour faire vert.
  if (!pass && testCase.limiteConnue) {
    limites += 1;
    console.log(`LIMITE ${testCase.q}`);
    console.log(`        obtenu ${verdict}${accepted ? ` → « ${accepted} »` : ""} — ${testCase.limiteConnue}`);
    continue;
  }
  if (!pass) failures += 1;

  console.log(`${pass ? "  ok " : "ÉCHEC"}  ${testCase.q}`);
  console.log(`        attendu ${testCase.attendu}, obtenu ${verdict}${accepted ? ` → « ${accepted} »` : ""}`);
  if (testCase.note) console.log(`        ${testCase.note}`);
  if (!pass) for (const line of examined) console.log(`          · ${line}`);
}

const conformes = CASES.length - failures - limites;
console.log(`\n${conformes}/${CASES.length - limites} cas conformes` +
  (limites ? ` · ${limites} limite(s) connue(s), hors portée de la comparaison de noms.` : "."));
process.exit(failures === 0 ? 0 : 1);
