# User flows — VibeTrip MVP

Document de conception (pas de code). Basé sur l'implémentation actuelle de `app/page.tsx`,
`hooks/useGenerateItinerary.ts`, `components/HomeScreen.tsx`, `components/LocationInput.tsx`,
`app/api/generate-itinerary/route.ts`, `lib/claude.ts` et `lib/geo.ts`.

État machine global observé dans `app/page.tsx` : `idle → loading → success | error`, avec un
seul niveau d'erreur (message texte affiché par `ErrorState`, bouton "Réessayer" qui fait un
`reset()` vers `idle` — **pas** un retry automatique de la même requête).

---

## 0. Écran d'accueil commun aux 3 modes

1. L'utilisateur règle 3 curseurs (Budget/Ambiance/Distance, 0-100, valeur initiale 50).
2. Il choisit un mode (Tonight/Weekend/Trip) — un seul actif à la fois, aucun défaut sélectionné.
3. Il fournit une localisation :
   - soit "Utiliser ma position" (géolocalisation navigateur),
   - soit une ville tapée en texte libre.
4. Le bouton "Générer mon itinéraire" reste désactivé (`canGenerate = mode !== null && location !== null`)
   tant que mode ET localisation ne sont pas renseignés. Les curseurs seuls ne bloquent jamais l'envoi
   (ils ont toujours une valeur, même par défaut).

Point important déjà en place : **le mode fait partie du payload envoyé**, donc le prompt et le
filtrage géographique (`PLAUSIBILITY_RADIUS_KM`) changent de comportement selon Tonight/Weekend/Trip
même si l'écran de curseurs est visuellement identique dans les 3 cas.

---

## 1. Mode Tonight — chemin nominal

1. Utilisateur sélectionne "Tonight", règle les curseurs, fournit sa position (idéalement GPS).
2. Requête `POST /api/generate-itinerary` avec `mode: "tonight"`.
3. Prompt généré : "une soirée (aujourd'hui, en une seule journée)", rayon de plausibilité 30 km
   (`PLAUSIBILITY_RADIUS_KM.tonight`).
4. Claude retourne un itinéraire à `totalDays: 1`, périodes morning/midday/evening plausibles pour
   une soirée (probablement evening dominant, mais rien n'impose ça côté schéma — voir notes prompt).
5. Filtrage géo (uniquement si la localisation est un point GPS, voir §5.2) : étapes > 30 km du point
   de départ supprimées.
6. Affichage carte + bottom sheet (`ResultScreen`).

### Cas limites spécifiques à Tonight
- Curseur Distance à 0 : le prompt indique "0 = à pied" — Claude n'a aucune contrainte numérique dure
  (pas de rayon en mètres imposé dans le prompt), le rayon de plausibilité reste 30 km côté serveur
  quel que soit le curseur. Incohérence potentielle : un curseur à 0 ("à pied") pourrait quand même
  recevoir une étape à 25 km que le filtre laissera passer car le filtre ne dépend que du *mode*, pas
  du curseur Distance lui-même. À documenter comme point ouvert (voir doc prompt-engineering).
- Utilisateur lance "Tonight" en pleine journée ou tôt le matin : rien dans le prompt ne mentionne
  l'heure actuelle réelle. Claude ne sait pas si "ce soir" a déjà commencé. Point ouvert produit :
  faut-il injecter l'heure locale actuelle dans le prompt pour éviter de proposer un brunch à 23h ?

---

## 2. Mode Weekend — chemin nominal

1. `mode: "weekend"` → prompt "un week-end (2 jours)", rayon de plausibilité 50 km.
2. Claude doit structurer les étapes sur `day: 1` et `day: 2`, périodes morning/midday/evening par jour.
3. `totalDays` attendu = 2, mais **rien ne force `totalDays === 2`** dans `itinerarySchema` (juste
   `min(1)`) ni de cohérence entre `totalDays` et le `day` max réellement présent dans `steps`.

### Cas limites spécifiques à Weekend
- Claude renvoie `totalDays: 3` ou des étapes uniquement sur `day: 1` (week-end "creux") : accepté
  par le schéma Zod actuel, aucune validation croisée. Le front afficherait un week-end incomplet
  sans erreur. Point ouvert : ajouter une validation `totalDays === max(steps.map(s => s.day))` et/ou
  imposer `totalDays` par mode côté schéma plutôt que de le laisser au texte du prompt.
- Distance à 100 ("excursions à plusieurs dizaines de kilomètres") vs rayon de plausibilité fixe de
  50 km : une "excursion à 60 km" demandée implicitement par un curseur à 100 pourrait être filtrée
  comme invraisemblable. Même remarque que Tonight : le rayon de plausibilité ne varie pas avec le
  curseur Distance, seulement avec le mode.

---

## 3. Mode Trip — chemin nominal

1. `mode: "trip"` → prompt "voyage de plusieurs jours (entre 3 et 6 jours, à toi de choisir une
   durée cohérente)", rayon de plausibilité 400 km.
2. Claude choisit librement `totalDays` entre 3 et 6 (aucune contrainte Zod sur la borne haute/basse
   du nombre de jours — `itinerarySchema.totalDays` accepte n'importe quel entier ≥ 1).
3. Distance à 100 = "plusieurs villes/régions" : cohérent avec le rayon large de 400 km.

### Cas limites spécifiques à Trip
- Claude pourrait renvoyer `totalDays: 1` ou `totalDays: 12` : rien ne l'empêche techniquement côté
  Zod. Le prompt est la seule garde-fou (texte, pas contrainte structurée). Voir doc prompt-engineering
  pour la recommandation (contraindre `totalDays` via un `min/max` explicite par mode, ou fournir un
  paramètre serveur plutôt que de laisser le choix à Claude).
- Rayon de 400 km pour un "trip" avec curseur Distance à 0 ("une seule ville") : le filtrage
  n'éliminera quasiment rien (tout est probablement < 400 km même en zone urbaine étendue), donc le
  curseur Distance à 0 en mode Trip n'a aujourd'hui aucun effet réel sur la plausibilité géographique
  — seulement sur le texte envoyé à Claude. Risque : Claude propose 3 villes différentes alors que
  l'utilisateur voulait rester dans une seule ville, et rien ne bloque ce résultat.

---

## 4. Curseurs à valeurs extrêmes (0 ou 100) — transverse aux 3 modes

- `describeLevel(value, low, mid, high)` : `< 33` → low, `< 66` → mid, sinon high. Donc 0 et 100
  tombent proprement dans "low"/"high", pas de cas limite de calcul (pas de division par zéro, pas
  d'index hors bornes). Le schéma Zod contraint déjà `min(0).max(100)` donc des valeurs hors bornes
  sont rejetées en 400 avant d'atteindre Claude.
- Cas non couvert par le code actuel : curseurs tous à une valeur "incohérente" avec le mode (ex.
  Budget à 0 + mode Trip 6 jours = un voyage de plusieurs jours "gratuit ou presque"). Le prompt ne
  signale pas ce genre de tension à Claude ; il reste libre d'halluciner un compromis. Pas un bug,
  mais un point produit à surveiller côté qualité perçue de l'itinéraire.
- UI : `components/ui/Slider.tsx` n'a pas été audité ligne à ligne ici, mais `VibeSliders` transmet
  directement `value.budget/ambiance/distance` sans clamp local — la garde-fou réelle est le schéma
  serveur, pas le client. Si un futur changement d'UI permet de sortir de 0-100 (ex. drag au clavier
  buggé), la requête serait rejetée en 400 avec un message Zod peu convivial pour l'utilisateur final
  (`parsedRequest.error.issues[0]?.message`) — à reformuler côté front avant affichage si on veut un
  message plus produit.

---

## 5. Cas d'erreur et cas limites — transverses

### 5.1 Géolocalisation refusée / indisponible
Géré dans `LocationInput.tsx` :
- `navigator.geolocation` absent → `status: "denied"` immédiatement.
- Timeout 8000 ms ou refus utilisateur → callback d'erreur → `status: "denied"`.
- Dans les deux cas, le champ "ville" texte libre réapparaît (`status === "denied" || !hasGeoLocation`)
  comme repli. L'utilisateur peut alors taper une ville manuellement.
- Point ouvert : aucun message explicite n'informe l'utilisateur *pourquoi* on lui demande une ville
  (pas de texte "Localisation refusée, entre une ville manuellement") — le champ apparaît juste
  silencieusement. À clarifier pour l'UX (surtout après un refus explicite vs un simple timeout, qui
  sont actuellement traités de façon identique).
- **Corrigé** : quand la localisation est une ville (`{ city }`), `route.ts` résout désormais la ville
  en coordonnées via `lib/geocode.ts` (API Geocoding Mapbox) avant de filtrer, donc
  `filterPlausibleSteps` s'applique aussi sur ce chemin. Si la ville est introuvable ou l'appel
  échoue, le filtrage est simplement désactivé pour cette requête (comportement de repli, pas une
  erreur bloquante) — le filtrage géo n'est donc garanti actif que quand le géocodage réussit.

### 5.2 Payload invalide (400 `INVALID_INPUT`)
- Corps JSON malformé (`request.json()` throw) → 400 immédiat, message générique "Corps de requête
  JSON invalide."
- Corps JSON valide mais qui ne respecte pas `generateItineraryRequestSchema` (curseur hors 0-100,
  mode inconnu, `location` ni GeoPoint ni `{city}`) → 400 avec le premier message d'erreur Zod brut.
- Front : `useGenerateItinerary` affiche `data.error.message` tel quel dans `ErrorState`. Comme ce
  message peut être un message Zod technique en anglais (ex. "Number must be greater than or equal to 0"),
  il y a un risque d'incohérence de langue/ton avec le reste de l'app (qui est en français). Point
  ouvert UX : mapper les codes Zod vers des messages français conviviaux avant affichage, plutôt que
  de propager `issues[0].message` brut.
- En pratique, ce cas ne devrait jamais être déclenché par l'UI actuelle (le bouton "Générer" est
  désactivé tant que mode/location sont absents, et les curseurs sont bornés par construction) — il
  protège surtout contre un appel direct à l'API ou un futur bug front.

### 5.3 Rate limit atteint (429 `RATE_LIMITED`)
- Deux origines distinctes renvoient le même code/status côté client, mais avec des messages différents :
  1. Rate limit interne (`lib/rate-limit.ts`, 5 générations/heure/IP en mémoire process) → message
     "Trop de générations récentes, réessaie dans un instant."
  2. Rate limit renvoyé par l'API Anthropic elle-même (`Anthropic.RateLimitError`) → message
     "Le service de génération est temporairement surchargé."
- Le front ne distingue pas les deux cas (même `ErrorState`, bouton "Réessayer" générique). Le
  bouton "Réessayer" ramène juste à `idle`, donc à l'écran d'accueil — l'utilisateur doit ré-régler
  ses curseurs/mode/localisation avant de relancer (aucune mémorisation de la dernière requête dans
  l'état actuel). Point ouvert produit : garder en mémoire la dernière requête pour permettre un vrai
  "réessayer" sans tout reconfigurer, surtout gênant après un rate limit où l'utilisateur veut souvent
  juste patienter puis relancer à l'identique.
- Le rate limit interne étant en mémoire process (non distribué), il est remis à zéro à chaque
  redéploiement / cold start serverless — comportement documenté dans le commentaire du fichier, pas
  un bug mais une limite connue du MVP.

### 5.4 JSON malformé après retry (502 `PARSE_ERROR`)
- `lib/claude.ts` : une tentative initiale + une seule tentative de retry si `parsed_output` est
  vide/invalide. Si les deux échouent → `ItineraryParseError` → 502.
- Front : message affiché = celui de l'erreur (`"Claude n'a pas retourné un itinéraire au format
  attendu après deux tentatives."`), correctement en français ici (contrairement au cas 400 Zod brut).
- Point ouvert : aucune télémétrie/logging mentionné dans le code lu — en prod, un taux de PARSE_ERROR
  significatif ne serait visible qu'en observant les erreurs utilisateurs, pas de métrique dédiée.
  Voir `docs/conception/prompt-engineering-notes.md` pour des pistes de réduction en amont.

### 5.5 Erreur Claude générique (502 `CLAUDE_ERROR`)
- Toute `Anthropic.APIError` qui n'est ni parse error, ni connexion, ni rate limit → 502 générique
  "Erreur lors de la génération de l'itinéraire." Idem pour toute exception non-Anthropic non prévue
  (`catch` final générique) → même code 502 mais message "Erreur inattendue...".
- Ces deux messages sont suffisamment proches pour qu'un utilisateur ne fasse pas la différence ;
  c'est acceptable pour un MVP mais mériterait des codes internes distincts en télémétrie (pas
  forcément exposés à l'utilisateur) pour le debug futur.

### 5.6 Timeout (504 `TIMEOUT`)
- Déclenché uniquement sur `Anthropic.APIConnectionError`. Attention : ce n'est *pas* nécessairement
  un vrai timeout réseau — la SDK Anthropic peut lever cette classe pour divers problèmes de
  connexion bas niveau, pas seulement un dépassement de délai. Le message affiché ("Le service de
  génération n'a pas répondu à temps.") suppose spécifiquement un timeout ; à vérifier/ajuster si la
  SDK distingue plus finement les causes dans une version future.
- Aucun timeout explicite n'est configuré côté `client.messages.parse(...)` dans `lib/claude.ts` (pas
  de paramètre `timeout` visible) ni côté `fetch` du hook front. Le comportement dépend donc des
  valeurs par défaut de la SDK / du navigateur. Point ouvert : décider une valeur de timeout produit
  explicite (ex. 20-30s) plutôt que de subir la valeur par défaut, en particulier pour le mode
  "loading" qui n'a aucune limite de temps affichée à l'utilisateur (`LoadingState` tourne indéfiniment
  tant que la promesse ne se résout pas).

### 5.7 Filtrage géographique élimine TOUTES les étapes (0 étape plausible restante) — POINT OUVERT CRITIQUE
C'est le cas le plus important non géré explicitement, à documenter clairement :

- `filterPlausibleSteps` peut renvoyer un tableau vide si Claude a halluciné des coordonnées toutes
  hors du rayon de plausibilité du mode (30/50/400 km). Rien dans `route.ts` ne vérifie
  `steps.length === 0` après filtrage : la réponse `{ itinerary: { ...itinerary, steps: [] } }` part
  quand même en 200 OK.
- Côté front, `ResultScreen` reçoit un `itinerary.steps` vide :
  - `activeStepId = itinerary.steps[0]?.id ?? null` → `null`, pas de crash immédiat.
  - `MapView` recevrait `steps: []` → `computeBounds` (`lib/geo.ts`) renvoie `null` pour un tableau
    vide → comportement de `MapView` sur des bounds `null` non vérifié ici sans relire le composant en
    détail, mais le risque est une carte vide sans message, ou une carte centrée sur une position par
    défaut arbitraire (ex. 0,0) selon l'implémentation Mapbox.
  - `ItineraryBottomSheet` avec `steps: []` afficherait probablement une bottom sheet vide, sans
    message d'erreur ni invite à réessayer — du point de vue utilisateur, ça ressemble à un bug ("ça a
    chargé mais il n'y a rien").
- **Recommandation produit (à trancher, pas encore implémentée)** :
  1. Traiter ce cas comme une erreur applicative dédiée plutôt qu'un succès vide — par exemple un
     nouveau code d'erreur `ApiErrorCode` (ex. `"NO_PLAUSIBLE_STEPS"`) renvoyé en 502/422 avec un
     message du type "L'itinéraire généré ne correspond pas à ta position, réessaie." Cela nécessite
     une petite extension de `types/itinerary.ts` (ajout d'une valeur à `ApiErrorCode`) — hors scope
     de cette mission (pas de modification de code), mais à noter comme évolution mineure du contrat.
  2. Alternative sans toucher au contrat d'erreur : garder un succès 200 mais avec `steps: []`, et
     gérer ce cas explicitement côté `ResultScreen`/`app/page.tsx` (état "itinéraire vide" avec CTA
     "Réessayer" plutôt que carte/bottom sheet vides) — plus simple à livrer mais mélange sémantique
     succès/échec.
  3. Alternative plus robuste en amont : au lieu de filtrer puis potentiellement tout jeter, ne
     déclencher le retry Claude (`lib/claude.ts`) que lorsque le filtrage post-génération élimine trop
     d'étapes — actuellement le retry ne couvre que l'échec de parsing JSON, pas l'échec de
     plausibilité géographique. Ceci mélangerait la logique retry entre `lib/claude.ts` (ne connaît pas
     `filterPlausibleSteps`) et `route.ts` (ne fait pas de retry) — à concevoir avant implémentation.
- Ce cas est plus probable que ce qu'il paraît en mode Tonight/Weekend (rayons serrés de 30/50 km) si
  Claude place une étape "hors ville" par erreur, surtout en zone rurale ou frontalière où la ville la
  plus intéressante à proposer peut légitimement dépasser le rayon — un faux positif du filtre, pas
  seulement une hallucination Claude.

---

## Résumé des points ouverts identifiés (à trancher par le produit)

| # | Point ouvert | Sévérité |
|---|---|---|
| 1 | 0 étape plausible restante après filtrage géo → succès 200 avec `steps: []`, non géré côté UI | Élevée |
| 2 | Filtrage géo inactif quand la localisation est une ville texte (pas de `referencePoint`) | Élevée |
| 3 | Curseur Distance sans effet réel sur le rayon de plausibilité (seul le mode compte) | Moyenne |
| 4 | `totalDays` non contraint/validé vs le nombre de jours réellement présents dans `steps` | Moyenne |
| 5 | Messages d'erreur Zod bruts (400) potentiellement en anglais, propagés tels quels à l'utilisateur | Moyenne |
| 6 | Pas de timeout explicite configuré ; `LoadingState` sans limite de temps affichée | Faible/Moyenne |
| 7 | Refus géoloc vs timeout géoloc traités identiquement, sans message explicatif à l'utilisateur | Faible |
| 8 | Aucune mémorisation de la dernière requête pour un vrai "réessayer" après erreur | Faible |
| 9 | Heure locale actuelle non injectée dans le prompt "Tonight" (risque de proposer un brunch à 23h) | Faible |
