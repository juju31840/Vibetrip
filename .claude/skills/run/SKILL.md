---
name: run
description: Lance le serveur de dev Next.js de VibeTrip et l'ouvre pour vérification visuelle.
---

# Lancer VibeTrip

1. Vérifier que `.env.local` existe et contient `ANTHROPIC_API_KEY` et `NEXT_PUBLIC_MAPBOX_TOKEN` (copier `.env.local.example` sinon). Sans ces clés, l'écran d'accueil fonctionne mais la génération d'itinéraire et la carte échoueront silencieusement ou avec une erreur `CLAUDE_ERROR` / carte vide.
2. Si `node_modules/` est absent, lancer `npm install` avant toute chose.
3. Démarrer le serveur avec `npm run dev` (Next.js 14, port 3000 par défaut) en tâche de fond.
4. Attendre la ligne `✓ Ready` dans la sortie avant d'ouvrir l'app — ne pas sonder avant.
5. Ouvrir `http://localhost:3000` — idéalement via le MCP `chrome-devtools` (voir la skill `check-ui`) pour vérifier le rendu mobile-first plutôt qu'un simple curl.
6. Pour tester une régénération de code (API route, composants), pas besoin de relancer le serveur : Next.js recharge à chaud. Un changement dans `next.config.mjs`, `tailwind.config.ts` ou `.env.local` nécessite un redémarrage.
