#!/usr/bin/env node
/**
 * Banc d'essai de la fonction centrale : génère une matrice d'itinéraires via la route API
 * et produit un rapport markdown à juger à l'œil.
 *
 * Ce que la machine peut vérifier (contrat de types/itinerary.ts) est vérifié ici :
 * bornes de `day`, valeurs de `period` et `type`, cohérence de `totalDays`, distance de
 * chaque étape au point de départ. Ce qu'elle ne peut pas juger — la qualité et la
 * crédibilité des lieux, le naturel du français — reste à lire dans le rapport : c'est
 * précisément le point de l'étape, aucun test automatique ne remplace ce jugement.
 *
 * Usage :
 *   npm run dev                       # dans un autre terminal, VIBETRIP_MOCK retiré
 *   node scripts/eval-itineraries.mjs
 *   node scripts/eval-itineraries.mjs --out rapport.md
 */

const API = process.env.VIBETRIP_API ?? "http://localhost:3000/api/generate-itinerary";

/**
 * Charge `.env.local` : contrairement à la route API, ce script tourne hors de Next et
 * n'hérite donc pas des variables d'environnement chargées par le serveur de dev. Sans
 * cela, le géocodage échoue silencieusement et les contrôles de distance sont désactivés.
 */
async function loadEnvLocal() {
  if (process.env.NEXT_PUBLIC_MAPBOX_TOKEN) return;
  try {
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of content.split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // Pas de .env.local : le géocodage sera simplement inactif, signalé dans le rapport.
  }
}

const PERIODS = new Set(["morning", "midday", "evening"]);
const PLACE_TYPES = new Set([
  "restaurant", "bar", "cafe", "museum", "park", "viewpoint",
  "activity", "shopping", "nightlife", "hotel", "transport", "other",
]);

// Rayons de plausibilité de lib/geo.ts, répliqués pour pouvoir signaler un dépassement
// même quand le filtrage serveur a déjà écarté des étapes (on veut le savoir).
const PLAUSIBILITY_RADIUS_KM = {
  tonight: { min: 5, max: 30 },
  weekend: { min: 15, max: 50 },
  trip: { min: 100, max: 400 },
};

/** Scénarios choisis pour couvrir les 3 modes, les extrêmes de curseurs, GPS et ville texte. */
const SCENARIOS = [
  { label: "Paris · soirée · fauché & calme", mode: "tonight", budget: 10, ambiance: 15, distance: 20, location: { lat: 48.8566, lng: 2.3522 } },
  { label: "Paris · soirée · large & festif", mode: "tonight", budget: 85, ambiance: 90, distance: 80, location: { lat: 48.8566, lng: 2.3522 } },
  { label: "Lyon · soirée · milieu de gamme", mode: "tonight", budget: 50, ambiance: 50, distance: 50, location: { city: "Lyon" } },
  { label: "Bordeaux · week-end · calme", mode: "weekend", budget: 40, ambiance: 20, distance: 30, location: { city: "Bordeaux" } },
  { label: "Marseille · week-end · festif", mode: "weekend", budget: 70, ambiance: 85, distance: 70, location: { city: "Marseille" } },
  { label: "Toulouse · voyage · court", mode: "trip", budget: 50, ambiance: 50, distance: 10, location: { city: "Toulouse" } },
  { label: "Lille · voyage · étendu", mode: "trip", budget: 75, ambiance: 60, distance: 95, location: { city: "Lille" } },
];

function haversineKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function expectedTotalDays(mode, distance) {
  if (mode === "tonight") return 1;
  if (mode === "weekend") return 2;
  return Math.round(3 + (Math.min(100, Math.max(0, distance)) / 100) * 3);
}

async function geocode(city) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(city)}.json?access_token=${token}&limit=1&types=place`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const center = data.features?.[0]?.center;
    return center ? { lat: center[1], lng: center[0] } : null;
  } catch {
    return null;
  }
}

/** Contrôles mécaniques du contrat. Retourne la liste des anomalies trouvées. */
function checkContract(itinerary, scenario, origin) {
  const problems = [];
  const { mode, distance } = scenario;

  const expected = expectedTotalDays(mode, distance);
  if (itinerary.totalDays !== expected) {
    problems.push(`totalDays vaut ${itinerary.totalDays}, attendu ${expected}`);
  }
  if (itinerary.mode !== mode) {
    problems.push(`mode renvoyé "${itinerary.mode}" au lieu de "${mode}"`);
  }
  if (!itinerary.steps?.length) problems.push("aucune étape");

  const radius = PLAUSIBILITY_RADIUS_KM[mode];
  const maxRadius = radius.min + (radius.max - radius.min) * (distance / 100);

  for (const [i, step] of (itinerary.steps ?? []).entries()) {
    const at = `étape ${i + 1} (${step.placeName})`;
    if (!Number.isInteger(step.day) || step.day < 1 || step.day > itinerary.totalDays) {
      problems.push(`${at} : day=${step.day} hors de 1..${itinerary.totalDays}`);
    }
    if (!PERIODS.has(step.period)) problems.push(`${at} : period="${step.period}" invalide`);
    if (!PLACE_TYPES.has(step.type)) problems.push(`${at} : type="${step.type}" hors enum`);
    if (origin) {
      const km = haversineKm(origin, step.location);
      if (km > maxRadius) {
        problems.push(`${at} : ${km.toFixed(1)} km du départ, au-delà du rayon de ${maxRadius.toFixed(0)} km`);
      }
    }
  }
  return problems;
}

function renderScenario(scenario, result) {
  const lines = [`## ${scenario.label}`, ""];
  lines.push(
    `\`${scenario.mode}\` · budget ${scenario.budget} · ambiance ${scenario.ambiance} · distance ${scenario.distance}`,
    ""
  );

  if (result.error) {
    lines.push(`**Échec — HTTP ${result.status}** : \`${result.error.code}\` — ${result.error.message}`, "");
    return lines.join("\n");
  }

  const it = result.itinerary;
  lines.push(`**${it.tripName}** — ${it.totalDays} jour(s), ${it.steps.length} étapes`, "");

  if (result.problems.length) {
    lines.push("**Anomalies de contrat :**", ...result.problems.map((p) => `- ${p}`), "");
  } else {
    lines.push("Contrat respecté (jours, périodes, types, distances).", "");
  }

  let currentDay = null;
  for (const step of it.steps) {
    if (step.day !== currentDay) {
      currentDay = step.day;
      lines.push(`### Jour ${currentDay}`, "");
    }
    const period = { morning: "Matin", midday: "Midi", evening: "Soir" }[step.period] ?? step.period;
    lines.push(
      `- **${period} — ${step.placeName}** *(${step.type})*  `,
      `  ${step.description}  `,
      `  \`${step.location.lat.toFixed(4)}, ${step.location.lng.toFixed(4)}\``
    );
  }
  lines.push("");
  return lines.join("\n");
}

async function run() {
  await loadEnvLocal();
  if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
    process.stderr.write(
      "NEXT_PUBLIC_MAPBOX_TOKEN absent : les contrôles de distance seront ignorés pour les villes saisies en texte.\n"
    );
  }

  const outArg = process.argv.indexOf("--out");
  const outPath = outArg !== -1 ? process.argv[outArg + 1] : null;

  const sections = [
    "# Banc d'essai VibeTrip — qualité des itinéraires",
    "",
    `Généré le ${new Date().toLocaleString("fr-FR")} · ${SCENARIOS.length} scénarios`,
    "",
    "À juger à la lecture : les lieux existent-ils vraiment ? Sont-ils cohérents avec le budget",
    "et l'ambiance demandés ? Le français est-il naturel ? Un même réglage donne-t-il des",
    "résultats stables d'une génération à l'autre ?",
    "",
  ];

  for (const [index, scenario] of SCENARIOS.entries()) {
    process.stderr.write(`[${index + 1}/${SCENARIOS.length}] ${scenario.label}… `);

    const origin =
      "lat" in scenario.location ? scenario.location : await geocode(scenario.location.city);

    let result;
    try {
      // IP distincte par scénario : le rate limit (5/h) bloquerait la matrice sinon.
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": `10.0.0.${index + 1}` },
        body: JSON.stringify(scenario),
      });
      const body = await res.json();
      result = res.ok
        ? { itinerary: body.itinerary, problems: checkContract(body.itinerary, scenario, origin) }
        : { status: res.status, error: body.error ?? { code: "?", message: "réponse illisible" } };
    } catch (error) {
      result = { status: 0, error: { code: "NETWORK", message: String(error) } };
    }

    process.stderr.write(
      result.error ? "échec\n" : `ok (${result.problems.length} anomalie(s))\n`
    );
    sections.push(renderScenario(scenario, result));
  }

  const report = sections.join("\n");
  if (outPath) {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(outPath, report, "utf8");
    process.stderr.write(`\nRapport écrit dans ${outPath}\n`);
  } else {
    process.stdout.write(report);
  }
}

run();
