/**
 * Contrôle de bout en bout de la production, en un appel.
 *
 * Raison d'être : pendant un test entre proches, une panne est **silencieuse**. Le crédit
 * Anthropic s'épuise, les testeurs voient « Erreur lors de la génération », et personne ne
 * prévient personne — on ne l'apprend qu'en demandant. Ce script pose la seule question qui
 * compte : est-ce qu'un inconnu qui ouvre l'URL maintenant obtient un itinéraire ?
 *
 *   npm run check:prod
 */
const URL_PROD = process.env.VIBETRIP_URL ?? "https://vibetrip-schuft.vercel.app";

const ok = (m) => console.log(`  ✓ ${m}`);
const ko = (m) => { console.log(`  ✗ ${m}`); process.exitCode = 1; };

console.log(`Contrôle de ${URL_PROD}\n`);

// 1. La page se charge.
const page = await fetch(URL_PROD);
page.ok ? ok(`page d'accueil (${page.status})`) : ko(`page d'accueil : ${page.status}`);

// 2. L'URL du cron reste fermée. Sans ce contrôle, une régression de CRON_SECRET ouvrirait
//    150 appels Google facturés à quiconque connaît le chemin.
const cron = await fetch(`${URL_PROD}/api/cron/verify-places`);
cron.status === 401 ? ok("URL du cron protégée (401)") : ko(`URL du cron : ${cron.status}, 401 attendu`);

// 3. Une vraie génération. C'est le seul test qui prouve que la chaîne complète tient.
const t0 = Date.now();
const res = await fetch(`${URL_PROD}/api/generate-itinerary`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    budget: 50, ambiance: 50, distance: 50, mode: "tonight",
    location: { lat: 45.764, lng: 4.8357 },
  }),
});

if (!res.ok) {
  ko(`génération : HTTP ${res.status}`);
} else {
  const texte = await res.text();
  let props = 0, total = 0, confirmes = 0, erreur = null;
  for (const ligne of texte.split("\n").filter(Boolean)) {
    let ev;
    try { ev = JSON.parse(ligne); } catch { continue; }
    if (ev.type === "error") erreur = `${ev.error?.code} — ${ev.error?.message}`;
    if (ev.type !== "proposal") continue;
    props += 1;
    for (const s of ev.itinerary.steps) { total += 1; if (s.verified === true) confirmes += 1; }
  }
  const secondes = ((Date.now() - t0) / 1000).toFixed(1);

  if (erreur) {
    ko(`génération refusée : ${erreur}`);
    if (/CLAUDE_ERROR/.test(erreur)) {
      console.log("\n  → Cause la plus fréquente : crédit Anthropic épuisé.");
      console.log("    Vérifier le solde sur console.anthropic.com → Plans & Billing.");
    }
  } else if (props === 0) {
    ko("génération : aucune proposition rendue");
  } else {
    ok(`génération : ${props} propositions en ${secondes} s`);
    const taux = total ? Math.round((100 * confirmes) / total) : 0;
    // En dessous, le socle ne joue plus son rôle : identifiants Supabase absents en production,
    // ou base injoignable. La génération marche toujours, mais on est retombé aux 52 % d'avant.
    taux >= 70
      ? ok(`adresses confirmées : ${confirmes}/${total} (${taux} %)`)
      : ko(`adresses confirmées : ${confirmes}/${total} (${taux} %) — le socle ne répond pas`);
  }
}
