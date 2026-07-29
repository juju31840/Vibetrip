---
name: check-mapbox-perf
description: Audite les performances et fuites potentielles de MapView.tsx (Mapbox GL) dans VibeTrip.
---

# Auditer les performances Mapbox de VibeTrip

`MapView.tsx` est chargé en `dynamic(..., { ssr: false })` et recrée des markers à chaque génération d'itinéraire — cette skill vérifie que ça reste propre sur la durée d'une session (plusieurs générations successives sans recharger la page).

1. Lire `components/MapView.tsx` et vérifier :
   - chaque `useEffect` qui crée des markers/listeners a bien un cleanup qui les détruit (`marker.remove()`, `map.off(...)`) — sinon fuite mémoire à chaque nouvelle génération
   - le nombre de markers créés correspond exactement à `steps.length`, pas d'accumulation d'anciens markers d'une génération précédente
   - `flyTo` n'est déclenché que sur changement réel de `activeStepId`, pas à chaque re-render du composant parent
2. Avec le MCP `chrome-devtools` (onglet Performance/Memory) :
   - générer un itinéraire, changer d'étape active plusieurs fois, régénérer un nouvel itinéraire 3-4 fois de suite
   - vérifier que le nombre de listeners/objets Mapbox (heap snapshot) ne croît pas de façon linéaire avec le nombre de générations
3. Vérifier qu'il n'y a qu'une seule instance de carte Mapbox montée à la fois (pas de double montage en dev mode React Strict Mode qui laisserait une carte fantôme).
4. Si un problème est trouvé, le documenter précisément (quel effect, quelle ligne) plutôt que de proposer un refactor complet — corriger le cleanup manquant suffit en général.
