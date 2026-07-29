# CLAUDE.md — VibeTrip

Ce fichier est chargé automatiquement par Claude Code à l'ouverture de ce projet. Il résume l'état
du travail au moment où il a été écrit (29/07/2026, sur une machine sans Node.js installé) pour que
la reprise sur un autre ordinateur soit rapide.

## Contexte produit

MVP webapp mobile-first : l'utilisateur règle 3 curseurs (Budget/Ambiance/Distance) + choisit un
mode (Tonight/Weekend/Trip) → Claude génère un itinéraire structuré (JSON) → affiché sur une carte
Mapbox + une bottom sheet draggable listant les étapes. Brief original complet : `brief.md`.

## État réel du code — point critique

Tout le scaffold (types, schémas Zod, prompt, géo/géocodage, client Anthropic, route API, tous les
composants UI, hooks) a été **écrit intégralement sans jamais être exécuté** : la machine d'origine
n'avait pas Node.js. Une seule vérification a eu lieu, sur StackBlitz (l'app compile et tourne), mais
**aucune vérification approfondie n'a suivi les derniers correctifs**. Ne pas supposer que le code
fonctionne juste parce qu'il a été écrit avec soin — le traiter comme du code non testé.

Corrections déjà appliquées (mais non validées en exécution réelle) :
- Filtrage de plausibilité géographique couplé au curseur Distance (`lib/geo.ts`)
- Géocodage des villes texte pour activer ce filtre même sans GPS (`lib/geocode.ts`)
- Gestion explicite du cas "0 étape plausible après filtrage" (`IMPLAUSIBLE_LOCATIONS`)
- Messages d'erreur en français (plus de messages Zod bruts exposés au client)
- Durée du mode Trip déterministe, indexée sur le curseur Distance (`totalDaysForMode`)
- Contraste texte/dégradé sur les boutons et cartes actives

## Premières actions sur cette machine

1. Recréer `.env.local` (jamais commité, voir `.env.local.example`) avec de vraies clés
   `ANTHROPIC_API_KEY` et `NEXT_PUBLIC_MAPBOX_TOKEN`.
2. `npm install`, puis `npm run dev` (voir la skill `run`).
3. Exécuter dans l'ordre les skills de vérification : `run` → `check-ui` →
   `check-mobile-responsive` → `check-mapbox-perf` → `verify-itinerary-contract`. Tout bug trouvé à
   ce stade est normal, pas une régression — c'est la première vraie exécution de ce code.
4. Si besoin, redemander de remettre Claude Code en français (réglage global
   `~/.claude/settings.json`, propre à la machine, pas versionné dans ce repo).

## Travail documenté mais pas encore appliqué

- `docs/conception/prompt-engineering-notes.md` §8 : brouillon de prompt révisé (system prompt,
  bornes de distance chiffrées, liste de types, few-shot par mode), prêt à copier dans
  `lib/prompt.ts` — volontairement laissé de côté tant que ce n'était pas testable.
- `docs/conception/seo-programmatique-plan.md` + `docs/commercialisation/seo-content-pilote.md` :
  plan + copy réelle (intros, FAQ) pour 30 pages SEO pilotes (Paris, Lyon, Bordeaux, Bruxelles,
  Montréal). Reste à faire : générer les timelines réelles via `lib/claude.ts`, les relire
  humainement (ne jamais publier de lieux inventés), implémenter les pages Next.js.
- `docs/conception/roadmap-v2.md` : specs des 4 points hors-scope (réservation/affiliation,
  premium/collaboratif, SEO, paiement) — l'auth + persistance utilisateur est le prérequis commun
  identifié à 3 des 4 points, à considérer avant de s'y attaquer.
- `docs/conception/user-flows.md` §5.1 : point UX ouvert — aucun message explicite n'informe
  l'utilisateur pourquoi le champ ville apparaît après un refus de géolocalisation.

## MCP et skills déjà configurés (`.mcp.json`, `.claude/skills/`)

`context7`, `exa` (besoin `EXA_API_KEY`), `chrome-devtools`, `playwright`, `github` (besoin
`GITHUB_PERSONAL_ACCESS_TOKEN`), `vercel`/`sentry`/`linear` (OAuth au premier usage via `/mcp`),
`figma` (nécessite l'app Figma desktop en local, pas encore utile sans maquette Figma réelle),
`supabase`/`notion` (besoin token, pertinents seulement si la persistance V2 démarre).

## Autres projets sur la machine d'origine (hors de ce repo)

`garage-martin` et `world-clock` sont deux autres projets Claude Code de l'utilisateur, chacun avec
son propre repo GitHub (`juju31840/garage-martin`, `juju31840/world-clock`), synchronisés sans
commit local en attente au 29/07/2026. Aucun contexte détaillé n'est disponible ici — se référer à
leur propre historique/`CLAUDE.md` une fois clonés.
