# Projet : VibeTrip (MVP technique)

Webapp mobile-first : l'utilisateur choisit une "vibe" (curseurs Budget / Ambiance / Distance) et un mode (Tonight / Weekend / Trip). L'IA génère un itinéraire (JSON) affiché sur une carte avec une timeline.

## Stack technique
- Frontend : Next.js 14, Tailwind CSS
- Map : React-Leaflet ou Mapbox GL
- Backend : Next.js API Routes
- IA : API Claude (Sonnet) pour générer l'itinéraire

## Scope MVP (dans cet ordre, rien d'autre pour l'instant)
1. Écran d'accueil : curseurs Budget/Ambiance/Distance + 3 boutons de mode (Tonight/Weekend/Trip)
2. Appel API vers Claude, qui retourne un JSON structuré : nom du voyage, étapes (matin/midi/soir), chaque étape avec nom du lieu, description courte, coordonnées GPS approximatives, type
3. Affichage : carte en haut/fond + liste des étapes en bas (bottom sheet)

## Hors scope pour l'instant (à ne pas coder maintenant)
- Réservation/affiliation (Booking, Trainline)
- Mode Premium/Collaboratif
- SEO programmatique
- Paiement

## Contraintes
- Clés API (Anthropic, Mapbox) via variables d'environnement (.env.local), JAMAIS commitées
- Mobile-first, design sombre et épuré (fond noir, dégradé bleu/violet sur les boutons clés)