---
name: verify-itinerary-contract
description: Teste la route /api/generate-itinerary de VibeTrip et valide que la sortie JSON de Claude respecte le contrat de types/itinerary.ts, indépendamment du front.
---

# Vérifier le contrat JSON de l'itinéraire

Objectif : isoler les problèmes de génération Claude (JSON malformé, coordonnées aberrantes, mauvaise langue) de ceux du front, en testant la route API seule.

1. Le serveur doit tourner (`npm run dev`, voir la skill `run`) et `ANTHROPIC_API_KEY` doit être renseignée dans `.env.local`.
2. Envoyer une requête de test à chacun des 3 modes, par exemple avec `curl` :

   ```bash
   curl -s -X POST http://localhost:3000/api/generate-itinerary \
     -H "Content-Type: application/json" \
     -d '{"budget":50,"ambiance":50,"distance":50,"mode":"tonight","location":{"lat":48.8566,"lng":2.3522}}' | jq
   ```

   Répéter avec `"mode":"weekend"` et `"mode":"trip"`, et une fois avec `"location":{"city":"Lyon"}` pour couvrir le repli manuel.
3. Vérifier la réponse (200) contre le contrat de `types/itinerary.ts` :
   - `itinerary.tripName` et chaque `description`/`placeName` sont en français
   - `itinerary.steps` non vide, `day` commence à 1, `period` ∈ `morning`/`midday`/`evening`
   - chaque `location.lat`/`lng` est plausible : pour `tonight`/`weekend`, à moins de ~30-50 km du point envoyé (cf. `lib/geo.ts`) ; pour `trip`, un rayon plus large est attendu
   - `type` de chaque étape appartient bien à l'enum `PlaceType`
4. Vérifier les cas d'erreur :
   - payload invalide (ex. `mode` absent) → `400 INVALID_INPUT`
   - plus de 5 requêtes en moins d'une heure depuis la même IP → `429 RATE_LIMITED` (cf. `lib/rate-limit.ts`)
5. Si le JSON est malformé après les 2 tentatives internes (voir `lib/claude.ts`), la route renvoie `502 PARSE_ERROR` — dans ce cas, inspecter le prompt (`lib/prompt.ts`) plutôt que de blâmer le parsing, le structured output de Claude devrait déjà garantir un JSON conforme au schéma Zod.
