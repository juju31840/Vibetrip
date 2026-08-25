# CLAUDE.md — VibeTrip

Ce fichier est chargé automatiquement par Claude Code à l'ouverture de ce projet. Il résume l'état
du travail pour que la reprise soit rapide. Dernière mise à jour : 25/08/2026.

## Contexte produit

MVP webapp mobile-first : l'utilisateur règle 3 curseurs (Budget/Ambiance/Distance) + choisit un
mode (Tonight/Weekend/Trip) → Claude génère un itinéraire structuré (JSON) → affiché sur une carte
Mapbox + une bottom sheet draggable listant les étapes. Brief original complet : `brief.md`.

## État du code

Le scaffold avait été écrit intégralement sans jamais être exécuté (machine d'origine sans Node.js).
Ce n'est plus le cas : le 25/08/2026, l'ensemble a été lancé et vérifié en exécution réelle.

Vérifié et fonctionnel :
- `tsc --noEmit`, `next lint` et `next build` passent sans erreur ni avertissement
- Validation Zod → `400 INVALID_INPUT` (payload incomplet comme JSON malformé)
- Rate limit → `429` à la 6ᵉ requête valide, les requêtes invalides ne consomment plus le quota
- Token Mapbox valide : géocodage (`Lyon` → 45.766 / 4.833) et style `dark-v11`
- Filtrage de plausibilité : aucune étape écartée à tort sur les 3 modes
- Écran d'accueil, écran d'erreur, carte cadrée sur l'itinéraire, bottom sheet, sélection d'étape

Bugs trouvés à l'exécution et corrigés le 25/08/2026 :
- `ResultScreen` présélectionnait la 1ʳᵉ étape, dont le `flyTo` écrasait le `fitBounds` initial
- `fitBounds` perdu au montage : désormais aussi déclenché par `onLoad` de la carte
- Bottom sheet en `max-h-[92vh]` : vaul calcule ses snap points en fraction de la **fenêtre**,
  la sheet ne montrait qu'un liseré de 77 px. Corrigé en `h-screen`
- Snap initial à 0.55 impossible avec vaul 0.9.9 (il réécrit l'état contrôlé vers `snapPoints[0]`
  tant que la fenêtre n'est pas mesurée) → la sheet s'ouvre sur l'aperçu, `dismissible={false}`
- Logo Mapbox (`z-index: 2`) par-dessus la sheet → `z-20` sur `Drawer.Content`

## Crédit API Anthropic — bloquant

La clé `ANTHROPIC_API_KEY` de `.env.local` est valide mais le compte n'a **plus de crédit** :
toute génération réelle renvoie `502 CLAUDE_ERROR` (`Your credit balance is too low`). C'est un
problème de facturation, pas de code — l'abonnement Claude Code est distinct de la facturation
API à l'usage.

En attendant, `VIBETRIP_MOCK=1` dans `.env.local` renvoie un itinéraire factice
(`lib/mock-itinerary.ts`) qui traverse exactement le même pipeline — mêmes types, même filtrage
de plausibilité — sans réseau ni coût. Le retirer pour tester la vraie génération.

## Reste à vérifier

La génération Claude elle-même n'a jamais tourné : qualité du prompt, respect du schéma Zod par la
sortie réelle, langue française des `placeName`/`description`, plausibilité des coordonnées
produites. Tout cela attend du crédit API. Voir la skill `verify-itinerary-contract`.

## Points ouverts (non bloquants)

- Fichier vide parasite `CLAUDE` (sans extension) à la racine, à supprimer
- Le rate limit est en mémoire process : remis à zéro à chaque instance froide en serverless
