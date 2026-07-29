# Roadmap v2 — mini-specs conceptuelles des points hors scope du brief

Document de conception (pas de code). Formalise les 4 points explicitement listés "hors scope pour
l'instant" dans `brief.md` : Réservation/affiliation (Booking, Trainline), Mode Premium/Collaboratif,
SEO programmatique, Paiement. Pour chacun : données/APIs supplémentaires nécessaires, impact sur
`types/itinerary.ts`, complexité/priorité relative.

Contrat actuel rappelé (`types/itinerary.ts`) : `Itinerary { tripName, mode, totalDays, steps[] }`,
`ItineraryStep { id, day, period, placeName, description, location, type }`, aucune notion de prix,
d'utilisateur, de compte, de disponibilité, ou de contenu statique/SEO — le MVP est 100% éphémère et
sans état persistant (pas de base de données visible dans le code lu, tout vit en mémoire process ou
dans le state React côté client).

---

## 1. Réservation / affiliation (Booking, Trainline)

### Concept
Permettre à l'utilisateur de réserver directement un hébergement (Booking) ou un trajet (Trainline)
depuis une étape de l'itinéraire (typiquement `type: "hotel"` ou `type: "transport"`), via des liens
d'affiliation ou une intégration API, générant potentiellement une commission.

### Données/APIs supplémentaires nécessaires
- **Booking.com Affiliate/Demand API** (ou Partner API) : recherche d'hébergements par
  coordonnées/dates, retour de prix, disponibilité, lien de réservation trackable (affiliate ID).
- **Trainline Partner API** (ou équivalent SNCF Connect/Rail Europe selon marché cible) : recherche
  d'horaires/trajets entre deux points, prix indicatif, lien de réservation trackable.
- **Dates réelles de séjour** : le contrat actuel n'a que `day: number` (jour relatif 1, 2, 3...),
  pas de date calendaire absolue. Impossible d'interroger une API de réservation (hôtel/train) sans
  dates réelles (check-in/check-out, date de départ du train) — c'est un prérequis bloquant, pas un
  détail.
- **Devise/localisation** : prix affichés nécessitent une devise (déduite du marché/pays, pas
  présente dans le contrat actuel).
- **Gestion de clés API partenaires supplémentaires** : `.env.local` déjà utilisé pour
  Anthropic/Mapbox (cf. `brief.md` contraintes), pattern à étendre avec `BOOKING_API_KEY`,
  `TRAINLINE_API_KEY` etc., et gestion de leurs quotas/rate limits propres (distincts de
  `lib/rate-limit.ts` qui protège aujourd'hui uniquement `generate-itinerary`).

### Impact sur le contrat de données (`types/itinerary.ts`)
- Ajout d'un **champ de date calendaire réelle** au niveau `Itinerary` (ex. `startDate: string`
  ISO 8601) pour dériver la date de chaque `day`. Actuellement `day: number` seul est insuffisant.
- Extension de `ItineraryStep` avec un bloc optionnel de type `BookingInfo` :
  ```
  interface BookingInfo {
    provider: "booking" | "trainline";
    price?: { amount: number; currency: string };
    deepLink: string; // lien d'affiliation trackable
    available: boolean;
  }
  ```
  À ajouter comme champ optionnel `booking?: BookingInfo` sur `ItineraryStep`, pertinent uniquement
  pour `type: "hotel"` et `type: "transport"` (les autres types n'ont pas vocation à être réservables
  dans un premier temps).
- Cela introduit une **dépendance temporelle** : le lookup de prix/dispo doit se faire soit au moment
  de la génération (risque de latence supplémentaire sur `POST /api/generate-itinerary`, déjà
  contraint par un timeout Claude non négligeable), soit en lazy-loading après affichage (nouvel
  endpoint `GET /api/steps/:id/booking` appelé à la demande depuis `ItineraryBottomSheet`/`StepCard`) —
  cette deuxième approche est préférable pour ne pas dégrader le temps de génération initial, et
  correspond mieux à l'architecture actuelle où `ResultScreen` affiche déjà l'itinéraire avant toute
  info de réservation.
- Le schéma Zod (`itinerary-schema.ts`) devrait rester strict côté `claudeItinerarySchema` (Claude ne
  doit *jamais* halluciner un prix ou une disponibilité — ces données viennent exclusivement des APIs
  partenaires, jamais du LLM). Le champ `booking` ne doit donc pas faire partie du schéma envoyé à
  Claude en structured output, seulement du schéma de réponse API final assemblé côté serveur après
  génération — distinction importante à documenter pour ne pas mélanger "ce que Claude génère" et "ce
  que le backend enrichit après coup".

### Complexité / priorité
- **Complexité : élevée.** Nécessite négociation/inscription à deux programmes d'affiliation
  distincts (délais admin hors du contrôle de l'équipe produit), gestion de deux nouvelles clés API
  et de leurs erreurs propres (indisponibilité, quotas), introduction de la notion de date calendaire
  absolue (changement structurant du contrat), et potentiellement un flux de tracking de conversion
  (combien de réservations effectives via VibeTrip) pour mesurer le ROI de l'intégration.
- **Priorité relative : la plus directement monétisable des 4**, et probablement celle qui a le plus
  de valeur produit immédiate (un itinéraire "actionnable" plutôt que juste informatif) — mais sa
  complexité technique/business la rend risquée à lancer en premier sans traction utilisateur déjà
  prouvée sur le MVP actuel. Recommandation : **prioriser après avoir validé l'usage organique du
  MVP** (pas en premier absolu), car investir dans des partenariats d'affiliation avant d'avoir du
  trafic réel est un pari risqué.

---

## 2. Mode Premium / Collaboratif

### Concept
Deux sous-fonctionnalités probablement liées mais distinctes à clarifier avec le produit :
- **Premium** : fonctionnalités payantes (plus de générations/jour au-delà du rate limit actuel,
  itinéraires plus détaillés/plus longs, export PDF, historique des itinéraires sauvegardés, etc.).
- **Collaboratif** : plusieurs utilisateurs contribuent/votent sur un même itinéraire (ex. un groupe
  d'amis qui prépare un weekend ensemble), avec partage de lien et édition partagée.

### Données/APIs supplémentaires nécessaires
- **Authentification utilisateur** : aucun système de compte n'existe dans le code actuel (pas de
  session, pas de user ID observé). Nécessite un provider auth (ex. NextAuth/Clerk/Auth.js) — c'est
  un prérequis fondamental pour les deux sous-fonctionnalités (impossible de faire "premium" ou
  "collaboratif" sans identifier qui est qui).
- **Base de données persistante** : le MVP actuel n'a aucune persistance (rate limit en mémoire
  process, aucun itinéraire sauvegardé après fermeture de la page — `state` de
  `useGenerateItinerary` est perdu au refresh). Le mode Collaboratif nécessite à minima une table
  `itineraries` (avec propriétaire, éventuellement plusieurs contributeurs) et une table
  `itinerary_shares`/`itinerary_collaborators`.
- **Temps réel ou polling** pour le mode Collaboratif (ex. voir les modifications d'un autre
  participant en direct) : WebSocket/Pusher/Supabase Realtime ou simple polling REST selon le niveau
  d'ambition temps réel visé.
- **Système de facturation** pour Premium (voir aussi section Paiement ci-dessous — ces deux points
  hors scope sont en réalité fortement couplés : Premium sans Paiement n'a pas de sens économique).

### Impact sur le contrat de données (`types/itinerary.ts`)
- `Itinerary` doit gagner une notion d'**identité et de propriété** : `id: string`, `ownerId: string`,
  `createdAt: string`, et pour le collaboratif `collaboratorIds?: string[]` ou une sous-structure de
  permissions.
- `GenerateItineraryRequest` doit être associable à un utilisateur authentifié (`userId` implicite
  via session plutôt que dans le payload, pour éviter la falsification côté client) — impact sur
  `app/api/generate-itinerary/route.ts` qui devient un endpoint authentifié, changeant la nature du
  rate limiting actuel (`checkRateLimit` par IP dans `lib/rate-limit.ts`) qui devrait alors basculer
  vers un rate limit par compte utilisateur (avec des quotas différenciés Free/Premium).
- Pour le collaboratif, les `ItineraryStep` pourraient avoir besoin d'un champ `votes` ou
  `addedBy: string` si plusieurs personnes proposent des étapes concurrentes/alternatives — cela
  dépasse largement la forme actuelle "un seul JSON généré en un seul appel" et se rapproche plutôt
  d'un document éditable collaborativement (modèle plus proche d'un CRDT/document partagé que d'une
  génération one-shot).
- Le mode Premium seul (sans collaboratif) est nettement plus simple : un champ `plan: "free" |
  "premium"` sur l'utilisateur suffit, avec des limites différentes injectées dans
  `checkRateLimit`/`MAX_TOKENS` (ex. plus de tokens Claude autorisés pour des itinéraires plus
  détaillés en Premium).

### Complexité / priorité
- **Complexité : élevée pour le Collaboratif** (auth + DB + synchronisation multi-utilisateur +
  gestion de conflits d'édition), **moyenne pour le Premium seul** (auth + DB + quotas différenciés,
  sans les problèmes de concurrence temps réel).
- **Recommandation : découpler explicitement les deux.** Le brief les regroupe sous un même point
  "hors scope", mais ce sont deux fonctionnalités de complexité très différente. Premium seul (sans
  collaboratif) est un candidat raisonnable pour une v1.5 une fois l'auth en place ; Collaboratif est
  une v2+ à part entière.
- **Priorité relative : la plus dépendante d'un prérequis transverse (auth + DB)** qui n'existe pas du
  tout dans le MVP actuel — c'est probablement la fondation technique la plus lourde des 4 points,
  mais aussi celle qui débloque le plus d'autres fonctionnalités futures (favoris, historique, etc.),
  donc à considérer comme un investissement d'infrastructure plutôt qu'une simple feature isolée.

---

## 3. SEO programmatique

### Concept
Générer automatiquement des pages publiques statiques/indexables pour capter du trafic organique —
typiquement des pages du type "Weekend à Lisbonne pour 200 euros" ou "Soirée branchée à Paris",
pré-générées à partir de combinaisons ville × mode × budget, potentiellement des exemples
d'itinéraires réels ou représentatifs générés à l'avance.

### Données/APIs supplémentaires nécessaires
- **Un corpus de destinations** (liste de villes cibles, avec métadonnées : pays, points d'intérêt
  connus, éventuellement données de popularité/volume de recherche pour prioriser les pages à créer).
- **Génération et stockage d'itinéraires "exemples" pré-calculés**, potentiellement rafraîchis
  périodiquement (via un job cron appelant `generateItinerary` en batch, hors du flux temps réel
  utilisateur) — nécessite une queue/scheduler (ex. Vercel Cron, ou un worker séparé) qui n'existe pas
  dans l'architecture actuelle (100% request/response synchrone).
- **Stockage de contenu statique/CDN** pour servir ces pages rapidement et de façon indexable (SSG/ISR
  Next.js, ce qui est nativement supporté par le framework déjà en place — c'est le point le plus
  "gratuit" en termes d'infrastructure puisque Next.js 14 gère déjà l'App Router avec `generateStaticParams`).
- **Métadonnées SEO** (title, description, Open Graph, JSON-LD structured data type `TouristTrip` ou
  `Trip` schema.org) — nouveau besoin non couvert du tout par le contrat actuel qui ne pense qu'en
  termes d'affichage interactif (carte + bottom sheet), pas de rendu texte/HTML indexable.
- **Analytics de trafic organique** (Google Search Console à minima) pour mesurer l'efficacité, hors
  du périmètre technique actuel.

### Impact sur le contrat de données (`types/itinerary.ts`)
- Le contrat actuel (`Itinerary`, `ItineraryStep`) peut rester quasiment inchangé pour représenter le
  contenu ; l'impact principal est l'ajout d'une couche au-dessus :
  ```
  interface SeoItineraryPage {
    slug: string;              // ex. "weekend-lisbonne-budget-modere"
    itinerary: Itinerary;      // réutilise le contrat existant tel quel
    seoTitle: string;
    seoDescription: string;
    publishedAt: string;
    isEvergreen: boolean;      // pré-généré vs itinéraire utilisateur éphémère
  }
  ```
- Point de vigilance important : les itinéraires générés pour le SEO ne doivent **pas** contenir de
  coordonnées GPS hallucinées non vérifiées, puisqu'ils seraient publics et indexés durablement (une
  erreur factuelle visible publiquement est plus grave qu'une erreur dans un itinéraire éphémère
  généré à la demande pour un seul utilisateur). Cela suggère un besoin de **validation humaine ou
  d'une vérification automatique renforcée** (ex. géocodage croisé via une API tierce type
  Nominatim/Google Places) avant publication — un niveau de rigueur au-delà du simple filtrage de
  plausibilité actuel (`lib/geo.ts`), qui n'élimine que les cas grossiers (distance excessive), pas les
  lieux inexistants ou mal orthographiés.
- `mode` reste utilisable tel quel pour catégoriser les pages (page "Tonight à Lyon", "Weekend à
  Lisbonne", "Trip en Provence").

### Complexité / priorité
- **Complexité : moyenne.** L'essentiel de la mécanique de génération existe déjà (`lib/claude.ts`,
  `lib/prompt.ts`) et Next.js gère nativement le SSG. Le travail principal est la couche de curation/
  validation de contenu (pour éviter de publier des hallucinations) et la mise en place d'un pipeline
  de génération batch + scheduler, qui est un ajout d'infrastructure mais pas conceptuellement complexe.
- **Priorité relative : la plus autonome des 4** — ne dépend d'aucun autre point hors-scope (pas
  besoin d'auth, de paiement, ni de réservation pour démarrer), et peut apporter du trafic gratuit tôt.
  C'est probablement le meilleur candidat pour un "quick win" une fois le MVP stabilisé, à condition
  d'accepter le coût de curation de contenu pour la qualité/fiabilité SEO.

---

## 4. Paiement

### Concept
Encaisser de l'argent pour les fonctionnalités Premium (voir §2) et/ou capter une commission sur les
réservations (voir §1). Ce point est transverse aux deux autres plutôt qu'une fonctionnalité isolée :
il n'a de sens produit qu'en support de Premium ou de l'affiliation.

### Données/APIs supplémentaires nécessaires
- **Provider de paiement** (Stripe étant le choix par défaut le plus courant pour ce type de stack
  Next.js) : gestion des abonnements récurrents (Premium), webhooks de confirmation de paiement,
  gestion des échecs de paiement/renouvellement.
- **Comptes utilisateurs** : prérequis strict, partagé avec le point Premium/Collaboratif (§2) —
  impossible de facturer un utilisateur anonyme sans identité persistante.
- **Conformité** : mentions légales, CGV, gestion de la TVA selon les pays (si Premium est vendu
  au-delà d'un seul marché), politique de remboursement — aspects non techniques mais bloquants pour
  un lancement commercial réel.
- **Webhooks et état asynchrone** : Stripe (ou équivalent) fonctionne par webhooks, ce qui introduit
  pour la première fois une notion d'**état persistant asynchrone** dans une architecture qui est
  aujourd'hui 100% synchrone (une requête HTTP = une réponse, pas de traitement en arrière-plan) — un
  changement d'architecture non négligeable.

### Impact sur le contrat de données (`types/itinerary.ts`)
- Aucun impact direct sur `Itinerary`/`ItineraryStep` eux-mêmes — le paiement concerne l'utilisateur/
  le compte, pas la structure d'un itinéraire. L'impact se ferait plutôt sur un futur type
  `UserAccount { id, plan: "free" | "premium", stripeCustomerId, subscriptionStatus, ... }`, extérieur
  au fichier `types/itinerary.ts` actuel (probablement un nouveau `types/user.ts`).
- Effet indirect sur `GenerateItineraryRequest`/le rate limiting : le plan de l'utilisateur
  deviendrait un paramètre implicite de `checkRateLimit` (quota différent selon `plan`), et
  potentiellement un paramètre explicite affectant `buildUserPrompt`/`MAX_TOKENS` dans `lib/claude.ts`
  si le Premium débloque des itinéraires plus riches (plus de tokens = réponses plus détaillées).

### Complexité / priorité
- **Complexité : moyenne à élevée**, mais surtout **non autonome** : le paiement seul n'a aucune
  valeur sans au moins un des deux autres points (Premium ou Réservation) à monétiser. C'est un
  point qui ne devrait jamais être priorisé isolément — sa complexité réelle dépend entièrement de
  quel autre point hors-scope il vient supporter en premier.
- **Priorité relative : dernière en date d'implémentation logique**, à activer seulement une fois que
  Premium (§2) ou Réservation/affiliation (§1) est fonctionnellement prêt et qu'il y a une raison
  concrète de facturer quelque chose.

---

## 5. Synthèse comparative

| Point hors scope | Prérequis transverse manquant | Complexité | Autonomie | Priorité suggérée |
|---|---|---|---|---|
| SEO programmatique | Aucun (Next.js SSG déjà en place) | Moyenne | Totalement autonome | 1 — quick win possible tôt |
| Réservation/affiliation | Dates calendaires réelles + partenariats externes | Élevée | Autonome mais risquée sans traction | 2 — après validation du MVP |
| Mode Premium (sans collaboratif) | Auth + DB (inexistants) | Moyenne | Dépend de l'auth | 3 — fondation à poser ensuite |
| Mode Collaboratif | Auth + DB + synchronisation temps réel | Élevée | Dépend de l'auth + Premium | 4 — v2+ |
| Paiement | Auth + DB + (Premium ou Réservation) | Moyenne/Élevée | Jamais autonome | Couplé à #2 ou #3, jamais en premier |

Le fil conducteur : **l'authentification/persistance utilisateur (absente à 100% du MVP actuel) est
le prérequis technique commun à 3 des 4 points** (Premium, Collaboratif, Paiement) — c'est
probablement la première brique d'infrastructure à considérer sérieusement dès que l'équipe voudra
avancer au-delà de la génération éphémère actuelle, plutôt que de traiter les 4 points comme des
silos indépendants.
