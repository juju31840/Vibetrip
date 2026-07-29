---
name: check-ui
description: Vérifie visuellement l'UI mobile-first sombre de VibeTrip (écran d'accueil, résultat, carte) via le MCP chrome-devtools.
---

# Vérifier l'UI de VibeTrip (mobile-first, thème sombre)

Utiliser le MCP `chrome-devtools` pour piloter Chrome plutôt que de se fier au code seul — la carte Mapbox et la bottom sheet `vaul` ne se valident qu'au rendu réel.

1. S'assurer que le serveur tourne (voir la skill `run`) sur `http://localhost:3000`.
2. Ouvrir la page avec le MCP chrome-devtools en émulant un viewport mobile (ex. 390x844, iPhone 12/13) — le brief exige un design mobile-first, ne pas tester en desktop large.
3. **Écran d'accueil** : vérifier
   - fond noir (`#0B0B12`), pas de flash blanc au chargement
   - les 3 curseurs Budget/Ambiance/Distance réagissent au drag
   - les 3 boutons de mode (Tonight/Weekend/Trip) : le bouton actif a le dégradé bleu/violet, les inactifs sont en contour
   - le CTA "Générer mon itinéraire" est désactivé tant que mode + localisation ne sont pas renseignés
   - le bouton "Utiliser ma position" déclenche une demande de permission géoloc du navigateur ; en cas de refus, le champ ville de repli apparaît
4. **Écran résultat** (après génération) :
   - la carte Mapbox occupe le fond en plein écran avec le style sombre `dark-v11`
   - les markers apparaissent aux coordonnées des étapes, colorés par type
   - la bottom sheet `vaul` est draggable (tester un swipe) entre ses 3 snap points (20%/55%/92%)
   - cliquer une étape dans la liste doit faire un `flyTo` de la carte vers son marker, et le mettre en surbrillance
5. Faire une capture d'écran à chaque étape clé et signaler tout écart avec le brief (fond noir, dégradé bleu/violet sur les boutons clés).
6. Si la carte reste vide/grise : vérifier `NEXT_PUBLIC_MAPBOX_TOKEN` dans `.env.local` et la console navigateur (erreur 401 Mapbox = token invalide/absent).
