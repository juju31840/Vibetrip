# SEO programmatique — plan d'exécution

Prolonge `roadmap-v2.md` §3 (concept initial) en plan concret et séquencé. Objectif : capter du
trafic organique francophone sur des requêtes longue traîne type "weekend à lyon pas cher" ou
"soirée branchée à bordeaux", via des pages statiques pré-générées qui réutilisent tel quel le
contrat `Itinerary`/`ItineraryStep` existant — aucun changement de `types/itinerary.ts` requis pour
démarrer.

---

## 1. Pourquoi ce point en premier (rappel de la priorisation)

D'après `roadmap-v2.md` §5, c'est le seul des 4 points hors-scope **sans prérequis transverse
manquant** : pas d'auth, pas de DB, pas de partenariat externe. Next.js gère nativement le SSG
(`generateStaticParams`), et la génération elle-même réutilise `lib/claude.ts` tel quel. C'est donc
le candidat le plus autonome à lancer une fois le MVP interactif stabilisé.

---

## 2. Corpus de villes — vague pilote avant scale

Ne pas générer des dizaines de villes d'un coup sans savoir ce qui convertit. Cohérent avec la
cible "jeunes actifs urbains francophones 25-40 ans" de `positioning.md`, la vague pilote doit
couvrir la France mais aussi tester la portée francophone hors France (Belgique, Suisse, Québec) :

**5 villes pilotes suggérées** : Paris, Lyon, Bordeaux, Bruxelles, Montréal.

Deuxième vague (après mesure de trafic sur la première) : Marseille, Lille, Nantes, Strasbourg,
Toulouse, Montpellier, Nice, Rennes, Annecy, Genève.

---

## 3. Matrice de combinaisons — quoi générer en premier

- **Modes prioritaires** : `tonight` et `weekend` d'abord — les requêtes "ce soir"/"ce week-end"
  ont un volume de longue traîne plus stable que "trip", et leur durée est déterministe (1 et 2
  jours, cf. `lib/prompt.ts`), ce qui rend le contenu plus prévisible à curer et republier.
- **`trip` reporté à une phase ultérieure** : le nombre de jours dépend désormais du curseur
  Distance (`totalDaysForMode`), donc une page statique "Trip à Lyon" devrait figer un choix de
  distance arbitraire pour rester reproductible — à trancher seulement une fois le pilote
  Tonight/Weekend validé.
- **Budget** : générer les 3 niveaux (petit/modéré/confortable) par ville dès le départ — c'est la
  variable la plus lisible dans une requête de recherche ("weekend à lyon pas cher" vs "... romantique").
- **Ambiance** : ne pas croiser systématiquement avec Budget dans la vague pilote (explosion
  combinatoire inutile pour 5 villes) — une seule ambiance par défaut ("conviviale, ni trop calme ni
  trop festive") pour la première vague, à décliner plus tard si un pattern de recherche spécifique
  émerge (ex. "weekend romantique à...").

Volume pilote : 5 villes × 2 modes × 3 budgets = **30 pages**, curées une par une.

Schéma de slug : `/weekend-a-lyon-petit-budget`, `/ce-soir-a-bordeaux-budget-confortable`.

---

## 4. Contenu de chaque page

Le rendu interactif (carte Mapbox + bottom sheet `vaul`) n'est pas indexable par les moteurs de
recherche — une page SEO doit donc avoir un **rendu texte/HTML statique en plus** de l'itinéraire
interactif optionnel en aval :

1. **Intro courte** (2-3 phrases) contextualisant la ville et le mode/budget — rédigée à la main ou
   semi-générée mais **relue**, pas un template purement mécanique répété à l'identique d'une ville
   à l'autre (risque de "thin/duplicate content", voir §7).
2. **Timeline en HTML sémantique** (liste structurée jour/période/lieu/description), reprenant le
   contrat `Itinerary` existant tel quel — pas de carte interactive requise pour cette partie,
   juste le texte.
3. **FAQ courte** (2-3 questions type "Combien coûte un week-end à Lyon ?", "Quelle est la meilleure
   période ?") — bon format pour capter des featured snippets, mais **rester descriptif, jamais de
   prix chiffré précis** (le contrat actuel n'a pas de champ prix — inventer un chiffre serait une
   hallucination publique, cf. §5).
4. **CTA vers l'outil réel** : "Personnalisez cet itinéraire avec vos propres curseurs" → renvoie
   vers la home avec la ville pré-remplie dans `LocationInput`.

---

## 5. Fiabilité du contenu — point de vigilance non négociable

Rappel de `roadmap-v2.md` §3 : un itinéraire public et indexé durablement est plus grave à faire
halluciner qu'un itinéraire éphémère généré à la demande pour un seul utilisateur. Pipeline
recommandé, différent du flux temps réel utilisateur :

1. **Génération en batch**, hors du flux `POST /api/generate-itinerary` (script/job séparé, pas de
   nouveau scheduler nécessaire pour 30 pages — un script lancé manuellement suffit pour la vague
   pilote).
2. **Filtrage géographique déjà actif** : `lib/geo.ts` + `lib/geocode.ts` (ville → coordonnées)
   s'appliquent aussi bien ici qu'en temps réel — mais un filtrage automatique ne suffit pas pour du
   contenu public durable.
3. **Relecture humaine systématique** avant publication pour la vague pilote (30 pages, volume
   gérable) — vérifier au moins que les lieux nommés existent réellement (recherche rapide), pas
   seulement que les coordonnées sont dans un rayon plausible.
4. **Republication périodique** (tous les 3-6 mois) pour éviter un contenu obsolète (lieu fermé,
   changement de prix implicite dans le ton "petit budget"/"confortable").
5. **Jamais de prix chiffré précis** dans le texte généré — rester sur des qualificatifs ("option
   accessible", "plus haut de gamme"), cohérent avec l'absence de champ prix dans le contrat actuel.

---

## 6. Métadonnées SEO

- `<title>` et `<meta description>` uniques par page (pas de template répété mot pour mot).
- Open Graph : à minima titre/description ; image OG statique par ville envisageable en v2 (pas
  bloquant pour le pilote).
- JSON-LD `schema.org` type `TouristTrip` (ou `Trip` selon disponibilité du type) pour le balisage
  structuré.
- `sitemap.xml` généré nativement via `generateStaticParams` (Next.js 14 App Router, déjà le
  framework en place — aucun nouvel outil requis).
- Canonical explicite par page pour éviter toute confusion avec l'app interactive (`app/page.tsx`).

---

## 7. Architecture technique (rappel conceptuel, aucun code écrit dans ce document)

- Nouvelle arborescence de pages, séparée du flux interactif existant : ex.
  `app/(seo)/[slug]/page.tsx`, sans toucher à `app/page.tsx` ni à l'API temps réel.
- Réutilise `lib/claude.ts`/`lib/prompt.ts` pour la génération initiale, mais en amont (script de
  build/seed), jamais appelé depuis une requête utilisateur publique.
- Stockage : fichiers JSON statiques commités ou générés au build — **pas de base de données
  nécessaire** pour 30 pages, cohérent avec l'absence totale de persistance dans le MVP actuel.
- Risque de "thin/duplicate content" si la structure est trop répétitive d'une ville à l'autre :
  varier réellement la rédaction de l'intro et de la FAQ, ne pas se contenter d'un mot-clé
  interpolé dans un template figé.
- Risque de cannibalisation avec la home (`app/page.tsx`) si le maillage interne n'est pas clair —
  chaque page SEO doit clairement pointer vers l'outil interactif comme "aller plus loin", pas le
  concurrencer sur les mêmes mots-clés génériques.

---

## 8. Séquencement recommandé

1. Générer et **relire manuellement** les 30 pages pilotes (5 villes × 2 modes × 3 budgets).
2. Publier, attendre l'indexation (Google Search Console — à connecter, hors périmètre technique
   actuel).
3. Mesurer trafic/impressions avant toute extension à la deuxième vague de villes.
4. Automatiser la génération batch (script réutilisable) seulement après validation qualitative du
   pilote — ne pas construire de pipeline complexe avant d'avoir prouvé que le format convertit.
5. Étendre au mode `trip` et à la deuxième vague de villes seulement à ce stade.

Ce plan ne nécessite aucune exécution pour être rédigé — la mise en œuvre réelle (génération batch,
pages Next.js) reste à faire une fois Node.js disponible.
