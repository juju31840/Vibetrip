---
name: check-mobile-responsive
description: Vérifie le comportement de VibeTrip à plusieurs largeurs d'écran mobile (pas seulement un viewport unique) via chrome-devtools ou playwright.
---

# Vérifier le responsive mobile de VibeTrip

Complète la skill `check-ui` (qui teste un seul viewport) en balayant plusieurs tailles réelles — le brief impose mobile-first mais l'app doit rester correcte sur toute la plage de téléphones, pas seulement l'iPhone de référence.

1. Le serveur doit tourner (voir la skill `run`).
2. Tester successivement ces viewports (via chrome-devtools ou playwright MCP) :
   - 360x780 (petit Android, ex. Galaxy A)
   - 390x844 (iPhone 12/13, référence de `check-ui`)
   - 428x926 (iPhone Pro Max)
3. À chaque taille, vérifier :
   - aucun débordement horizontal (pas de scroll-x sur `HomeScreen` ni `ResultScreen`)
   - les 3 curseurs (`VibeSliders`) restent utilisables au doigt (zone de touch suffisante, pas de chevauchement)
   - la bottom sheet `vaul` respecte ses 3 snap points (0.2/0.55/0.92) sans que le contenu ne soit coupé en position basse
   - les safe-areas (encoche/barre de gestes) ne masquent pas le CTA principal en bas d'écran
4. Signaler tout écart avec un viewport précis en repro (ex. "à 360px, le bouton Générer déborde de 8px").
