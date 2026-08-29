# CLAUDE.md — VibeTrip

Ce fichier est chargé automatiquement par Claude Code à l'ouverture de ce projet. Il résume l'état
du travail pour que la reprise soit rapide. Dernière mise à jour : 26/08/2026 (soir).

## Contexte produit

MVP webapp mobile-first : l'utilisateur règle 3 curseurs (Budget/Ambiance/Distance) + choisit un
mode (Tonight/Weekend/Trip) → Claude génère un itinéraire structuré (JSON) → affiché sur une carte
Mapbox + une bottom sheet draggable listant les étapes. Brief original complet : `brief.md`.

## Cadrage produit (décidé le 25/08/2026)

Méthode suivie : core function → core loop → features → surface area check → retention hook.

- **Ambition** : vrai produit, vrais utilisateurs.
- **Boucle d'usage** : les trois modes sont gardés à égalité par décision explicite. Coût assumé :
  la surface à designer est triplée (Tonight tient sur un écran, Trip demande une navigation
  multi-jours) et le retention hook devient difficile — les trois modes ont trois rythmes
  incompatibles (hebdo / mensuel / 2-3 fois par an). Recommandation non retenue : centrer sur
  Tonight.
- **Fin de boucle** : l'utilisateur **s'y rend vraiment**. Conséquence directe : l'exactitude des
  lieux est existentielle, et chaque étape doit être ouvrable dans Maps.

Ordre de travail retenu : (1) valider la fonction centrale → (2) fiabiliser les lieux →
(3) fermer la boucle (Maps) → (4) design system → (5) persistance Supabase + retention hook.

## Crédit API

Rechargé le 25/08/2026. `VIBETRIP_MOCK` est **vide** dans `.env.local` : les vrais appels passent.
Remettre `VIBETRIP_MOCK=1` pour itérer sur l'UI sans consommer de crédit (`lib/mock-itinerary.ts`,
lu par `lib/claude.ts` qui teste `=== "1"`).

## Fonction centrale : validée, avec un défaut identifié

Premier passage réel de la génération Claude le 25/08/2026 via `npm run eval -- --out rapport.md`
(7 scénarios, 52 étapes, 3 modes, GPS et ville texte). Résultat dans `rapport.md`.

**Contrat : 7/7, zéro anomalie.** Jours, périodes, types, `totalDays`, rayons de plausibilité,
français naturel. Le pipeline technique est validé. Latence 6-22 s selon le mode.

**Qualité : défaut réel, dont la loi est connue.** Deux modes de défaillance, tous deux vérifiés
en source :
- *Lieu réel mais fermé* — « Le Baron » (Paris) : nom et coordonnées exacts, fermé depuis fin 2018.
- *Lieu inventé à partir d'un vrai décor* — « Café de la Place Colette » n'existe pas (le café de
  cette place est **Le Nemours**) ; « Chez Marcel » aux Terreaux non plus (il existe **Chez
  Marcelle**, rue du Bœuf, autre quartier).

Le défaut ne dépend ni de la ville, ni du mode, ni des curseurs, mais de **la notoriété du lieu** :
Toulouse 0/9, Marseille 0/7, Lille 0/18 lieux douteux (que des monuments et institutions) contre
Paris 2/3, Lyon 3/4, Bordeaux 2/6 (petits bars et cafés de quartier). Le mode le plus répétable
— Tonight — est donc le plus fragile.

Défauts secondaires : budget ignoré (Le Petit Nice Passédat, 3 étoiles, proposé à budget 70/100) ;
horaires ignorés (Musée d'Aquitaine en étape « Soir ») ; types incohérents (Place du Capitole en
`cafe`) ; coordonnée placeholder `51.5000, 4.5000` non détectée par le filtre de plausibilité.

## Vérification des lieux (étape 2)

Le remède n'est pas un meilleur prompt mais une vérification contre une base réelle. Point de
conception **critique**, mesuré en réel sur l'API Mapbox Search Box : **la recherche renvoie
toujours un résultat**, et `proximity` n'est qu'un biais, pas un filtre. Une vérification naïve
serait pire que rien — elle validerait les inventions en leur substituant des lieux réels sans
rapport :

- « Le Baron » → renvoie « Baronne », autre adresse à 1,5 km
- « Chez Marcel » (Lyon) → renvoie un bouchon à Les Chères, 20 km
- « Le Bar Fleuri » (Lyon) → renvoie un vrai « Le Bar Fleuri »… à Paris 19e, 390 km
- « Place des Terreaux » → renvoie « Constantine Terreaux - Entire Place » (annonce de location)

D'où trois verrous cumulatifs dans `lib/verify-places.ts`, validés sur 11 cas réels sans faux
positif : distance ≤ 5 km de la coordonnée proposée ; le premier mot distinctif du résultat doit
figurer dans la requête ; au moins la moitié des mots distinctifs de la requête doivent se
retrouver dans le résultat.

Un lieu non vérifié n'est **pas supprimé** (cela viderait les itinéraires) mais marqué comme tel,
et son lien Maps devient une recherche par nom plutôt qu'un point sur une coordonnée douteuse.

### Resserrage du 27/08/2026, et le banc qui va avec

La comparaison de noms est sortie dans `lib/place-match.ts` — module **pur, sans `server-only`**,
précisément pour être rejouable hors de Next : `npm run check:match` fait passer une quinzaine de
cas réels contre la vraie API Mapbox et compare la décision à ce qu'on attend. C'est la partie la
plus risquée du produit (elle décide d'afficher « adresse confirmée » à quelqu'un qui va s'y
rendre), elle ne pouvait pas rester non testée.

Le banc a immédiatement révélé **trois faux positifs**, dont deux inconnus :
- « Marché des Capucins » confirmé par « Marché des Capucins - Calme - Lumineux - Garage - Entire
  Place », une annonce de location — repéré à la lecture d'un rapport de génération ;
- « Le Baron » confirmé par **« Le Baron Rouge »**, c'est-à-dire par un autre bar ;
- « Café de la Place Colette » (inventé, c'est Le Nemours) confirmé par **« Place Colette »**, la
  place elle-même : une fois les mots génériques retirés des deux côtés, il ne restait que
  « colette » de part et d'autre et tous les verrous tombaient.

D'où deux verrous supplémentaires, qui portent chacun sur une de ces familles :
- **Plafond gradué de mots ajoutés** (`allowedExtraTokens`) : un résultat peut ajouter au plus
  `nombre de mots distinctifs de la requête − 2` mots, plafonné à 2. Gradué et non fixe, parce que
  plus la requête est distinctive, plus une addition est anodine — « Basilique Notre-Dame de
  Fourvière » supporte « | Lyon », « Le Baron » ne supporte rien. Un plafond fixe de 2 laissait
  passer « Le Baron Rouge ».
- **Accord sur la sorte de lieu** (`VENUE_TOKENS`) : si la requête dit café, musée, marché…, le
  résultat doit le dire aussi. Ces mots sont filtrés pour comparer les noms — deux cafés ne se
  ressemblent pas parce qu'ils sont des cafés — mais ils portent une information qu'on ne peut
  pas jeter : une place n'est pas le café qui porte son nom.

**Coût mesuré : nul.** A/B à entrées identiques sur 45 étapes réellement générées (mêmes noms,
mêmes coordonnées, ancienne règle contre nouvelle) : **33 confirmées des deux côtés, 73 %, aucune
perte**. La première mesure semblait montrer une chute de 78 % à 52 % — elle comparait deux
générations différentes, donc des lieux différents. Piège à ne pas refaire.

**Limite assumée et affichée comme telle** : « Le Baron » reste confirmé, parce que le référentiel
contient un POI portant exactement ce nom à moins de 5 km. Aucune comparaison de noms ne peut
distinguer l'établissement fermé d'un homonyme ouvert ; il faudrait une donnée d'ouverture que
l'API de recherche ne fournit pas. Le banc le signale « LIMITE » et ne le compte pas comme
régression — plutôt que d'ajuster l'attente pour faire vert.

## Fermeture de la boucle (étape 3)

Chaque étape porte un lien « Y aller » vers Maps (`lib/maps.ts`). La forme du lien dépend du
statut de vérification, et c'est délibéré : un lieu confirmé ouvre sa fiche via nom + adresse
réelle, un lieu non confirmé ouvre une **recherche** centrée sur le quartier (`/@lat,lng,15z`)
plutôt qu'un point précis — poser un repère qui fait autorité sur une coordonnée douteuse
enverrait l'utilisateur avec assurance à une adresse potentiellement inventée.

## Design system (étape 4) — direction « Carnet »

Trois directions ont été maquettées et comparées le 26/08/2026 ; l'utilisateur a retenu
**Carnet**. Plan de travail : https://claude.ai/code/artifact/7ec83294-fc5f-441a-9a49-2b420956dded
(sources dans `design-canvas/`, non versionné — rejouer `seed-canvas.mjs` pour le mettre à jour).

Le diagnostic de départ était précis : « ça fait IA » ne venait pas d'un vague manque de finition
mais de trois causes nommables — le **fond noir avec dégradé indigo→violet** (signature par défaut
de tous les produits d'IA depuis 2023), l'**absence totale d'iconographie**, et l'**absence de
barre de navigation**, qui laissait l'ensemble se lire comme une page web.

Carnet répond aux trois : fond papier `#FBF7F0`, encre chaude, accent terracotta, vert profond
pour le sémantique. **Plus aucun dégradé nulle part.** Titres en Instrument Serif, texte en Work
Sans — c'est ce contraste serif/sans qui donne le registre éditorial. Icônes en SVG tracé
(`components/ui/icons.tsx`) et non en emojis : un emoji change de dessin selon l'OS, ne se
recolore pas et rend mal en petit.

Décisions de conception à connaître :
- Les curseurs affichent **un mot, pas un nombre** (« serré », « animée », « à pied »). Les seuils
  répliquent exactement ceux de `lib/prompt.ts` pour que l'étiquette lue soit la consigne envoyée.
- Le CTA est en **encre pleine** et non en terracotta : sur fond papier c'est le contraste le plus
  fort (14:1), et ça laisse l'accent libre de signaler la sélection.
- La carte Mapbox est passée en `light-v11`, et les marqueurs ne sont **plus colorés par type** —
  douze couleurs donnaient un semis illisible. Ils portent le numéro d'ordre.
- Barre d'onglets, absente de l'écran résultat. Elle n'a d'abord eu que **deux entrées** (Créer /
  Mes sorties) : la troisième de la maquette, « Profil », n'aurait ouvert sur rien tant qu'il n'y
  a ni compte ni réglages, et un onglet vide se remarque plus qu'un onglet absent. Elle en a
  **trois** depuis « Ma carte » (26/08/2026), qui lui donne un contenu.
- **Page de garde** avant l'application, comme demandé : l'écran de réglages ouvrait directement
  sur trois curseurs sans jamais dire ce que fait le produit.

**Curseurs : on reste à trois.** Un axe « connu / confidentiel » a été envisagé puis écarté — il
pousserait vers les petites adresses de quartier, précisément celles que le référentiel ne sait
pas confirmer, et ferait donc monter le taux de « à confirmer ». Un réglage qui dégrade le produit.

**Affichage de la vérification.** Environ la moitié des étapes ne sont pas confirmées : les
signaler toutes en rouge ferait passer un produit qui fonctionne pour un produit cassé. L'accent
est donc mis sur ce qui **est** confirmé (coche verte + adresse réelle) et le doute est formulé
comme un conseil — « adresse à confirmer sur place », en ocre sourd. Quand `verified` vaut `null`,
on n'affiche **rien** : prétendre un doute non mesuré serait aussi trompeur qu'une fausse certitude.

## Propositions et validation (26/08/2026)

**Choix en deux temps** : `ProposalsScreen` liste les propositions (titre, angle, nombre
d'étapes, adresses confirmées) sans carte ni détail ; `ProposalDetailScreen` ouvre celle qu'on
veut examiner, avec la carte et les adresses, et c'est là seulement qu'on valide. La version
précédente dépliait tout dans une seule page : on comparait trois programmes complets sur un
écran de téléphone.

L'application ne rend plus **un** itinéraire mais **plusieurs propositions**, parmi lesquelles
l'utilisateur choisit avant de valider. Motif : imposer un seul résultat ne laissait d'autre
choix que l'accepter ou tout relancer, donc repayer une génération.

**Trois appels en parallèle, un par angle** (`PROPOSAL_ANGLES` dans `lib/prompt.ts` :
incontournables / hors des sentiers battus / autour de la table). Deux choses ont été mesurées
et ont renversé l'intuition de départ :
- *Un seul appel produisant les trois itinéraires* : bonne diversité, mais **2 min 10** sur un
  week-end — au-delà de la limite d'exécution. Écarté.
- *Trois appels parallèles* : week-end **12 s**, soirée **11 s**. La diversité est obtenue par
  l'angle imposé, sans quoi trois générations libres convergent vers les mêmes lieux célèbres.
- La vérification des lieux est elle aussi parallélisée entre propositions (elle était
  séquentielle : c'est ce qui coûtait 50 s sur la première mesure du week-end).

`proposalCountForMode` (`lib/itinerary-schema.ts`) renvoie **2 en mode voyage**, 3 sinon : six
jours × trois propositions mesuraient 56 s, trop près des 60 s de `maxDuration`.

`Promise.allSettled` et non `all` : une proposition qui échoue n'emporte pas les autres.

**L'enregistrement n'est plus automatique.** Il a lieu à la validation. C'est un renversement
assumé du choix précédent : la sauvegarde automatique garantissait de ne rien perdre, mais elle
remplissait « Mes sorties » de tout ce qui avait été généré, y compris ce qui n'avait pas été
retenu. Contrepartie à connaître : quitter l'écran de propositions sans valider perd la
génération (déjà payée).

**Bug vaul — `pointer-events: none` sur `<body>`.** Tant que la bottom sheet est ouverte, vaul
rend inerte tout ce qui est en dehors d'elle, même avec `modal={false}` : la flèche de retour et
la carte restaient parfaitement visibles mais ne répondaient plus. D'où `pointer-events-auto`
explicite sur l'en-tête et sur le conteneur de carte de `ResultScreen`.

**Leçon de méthode** : ce bug avait échappé aux vérifications précédentes parce qu'un clic
programmatique (`element.click()`) ignore le test de survol. Il faut cliquer *pour de vrai*
(Playwright `click`, qui fait le hit-test) ou interroger `document.elementFromPoint`.

**Hauteurs en `dvh`, jamais `vh`.** `100vh` compte la zone recouverte par la barre du navigateur
mobile : le bouton « Valider » se retrouvait *sous* l'écran visible, et l'utilisateur ne pouvait
littéralement jamais valider. Tous les écrans plein écran utilisent `h-[100dvh]`.

**Rechute de la même règle, corrigée le 27/08/2026** : le `<body>` était resté en `min-h-screen`,
c'est-à-dire `100vh`. Conséquence signalée par l'utilisateur — *« la flèche pour revenir en arrière
est cachée par la barre d'adresse »* : le corps de page étant plus haut que la zone visible, la
page devenait scrollable, et l'en-tête de l'écran de résultat, posé en **absolu** et non en fixe,
disparaissait sous la barre au moindre défilement. Passé en `min-h-[100dvh]`. Les commandes
ancrées en haut respectent en plus `env(safe-area-inset-top)`, pour l'encoche.
Leçon : cette règle vaut aussi pour le `<body>`, pas seulement pour les écrans.

**Curseurs à cinq paliers** (`lib/vibe-labels.ts` + `levelIndex` dans `lib/prompt.ts`), pas de
25 sur 0-100. Avec trois paliers, le mot central couvrait un tiers de la course : on déplaçait
le curseur sans que l'affichage change. Les mots affichés et les consignes envoyées au modèle
sont indexés par la **même** fonction — un décalage rendrait les curseurs mensongers.

**Confirmation à la validation** (`components/ui/Toast.tsx`) : « Ajouté à tes sorties », deux
secondes et demie, `role="status"` + `aria-live="polite"`, sans bouton de fermeture. L'écran
d'arrivée ressemblant beaucoup à celui qu'on quitte, rien n'indiquait sinon que l'itinéraire
avait été rangé quelque part. L'animation est neutralisée sous `prefers-reduced-motion`.

**Envies au réglage** (`lib/themes.ts`, `components/ThemePicker.tsx`) — ajouté le 27/08/2026.
Les six thèmes (Manger, Boire un verre, Culture, Plein air, Sortir, Boutiques) n'existaient que
dans le panneau « Changer » d'une étape : on ne pouvait dire « plutôt de la culture » qu'**après
coup**, en corrigeant une étape qu'on n'avait pas demandée. Ils sont désormais aussi sur l'écran
de réglages, facultatifs et cumulables, rien de coché par défaut — la promesse du produit reste
qu'on obtient un programme sans rien construire.

La liste a déménagé dans `lib/themes.ts`, **sans `"use client"`** : elle doit être lisible par
l'écran de réglages *et* par `lib/prompt.ts`, qui tourne côté serveur. `lib/nearby-places.ts` la
ré-exporte pour ses appelants existants. L'union `ThemeId` est déclarée dans `types/itinerary.ts`
et c'est la liste qui s'y conforme, pour que la couche des types ne dépende de rien.

La consigne envoyée au modèle dit « principalement » et « au moins la moitié », jamais
l'exclusivité : cocher « Manger » sur un voyage de six jours ne doit pas produire dix-huit
restaurants. L'envie oriente la sélection, elle ne remplace pas la composition d'un parcours.

**Alternatives par thème** (`lib/nearby-places.ts`) : le panneau « Changer » interroge le
référentiel Mapbox **par catégorie** autour de l'étape et rend une dizaine de lieux réels,
confirmés par construction. C'est ce qui répond au reproche « une seule proposition de
remplacement » : les étapes des autres propositions n'offraient souvent qu'un candidat par
créneau. Aucun appel au modèle, réponse en quelques centaines de millisecondes.

Deux pièges rencontrés, à ne pas refaire :
- le paramètre `radius` de l'API catégorie est **en kilomètres** (max 10) ; écrit en mètres il
  renvoie `400` et le panneau affiche « rien à proximité » sans autre signe ;
- les catégories `sports`, `fitness_center`, `tourist_attraction` et `historic` ont été testées
  et **écartées** : elles renvoient des événements et des commerces sans rapport (« Coca-Cola
  Music Tour » pour une salle de sport). D'où l'absence de thème « sport », remplacé par
  « Plein air ». Proposer un thème qui rend n'importe quoi est pire que ne pas le proposer.

**Retouche manuelle de l'itinéraire** (`lib/alternatives.ts` + `ProposalDetailScreen`) : chaque
étape peut être échangée contre une autre du même jour et du même créneau, et « Rétablir la
proposition d'origine » revient à la version automatique. Les alternatives ne sont **pas
générées** — ce sont les étapes des autres propositions, écrites sous des angles différents,
donc déjà pertinentes pour le même créneau. Aucun appel supplémentaire, aucune attente.
L'itinéraire reste composé automatiquement par défaut : on ne demande jamais à l'utilisateur
de le construire.

**Retour explicite** en haut à gauche de l'écran de résultat et de l'écran de propositions —
leur absence était le premier reproche fait à l'interface.

## Persistance et rétention (étape 5)

**Étage local uniquement** — Supabase est bloqué (voir « Reste à faire »).

`lib/storage.ts` expose une interface `ItineraryStore` implémentée par `localStorage`. Tous les
écrans passent par elle, donc le basculement vers Supabase sera un changement d'implémentation et
non une réécriture — c'est aussi ce qui rendra possible le partage par URL.

Deux choix de conception :
- **L'enregistrement est automatique**, sans bouton « Enregistrer » : la sauvegarde doit être
  acquise avant que l'utilisateur ne parte, or c'est le moment où il ne pensera pas à appuyer.
  **Ce choix a été renversé le 26/08/2026** au profit d'une validation explicite (voir plus haut).
- **Le hook de rétention est « j'y suis allé »** : cocher une étape sur place donne une raison de
  rouvrir l'app *pendant* la sortie. C'est le seul hook qui fonctionne malgré les trois rythmes
  incompatibles des trois modes, puisque tous trois se déroulent étape par étape.

Un échec de `localStorage` (navigation privée, quota) ne fait jamais perdre l'itinéraire :
l'écran de résultat retombe sur la copie en mémoire.

### « Ma carte » — la contrepartie du geste (26/08/2026)

Le défaut de la boucle était nommable : **cocher ne rendait rien**. L'utilisateur donnait une
information et n'obtenait aucun retour — c'est exactement le « simulating reward » qui manquait.

Chaque étape cochée pose désormais un point sur une carte personnelle qui ne se vide jamais
(`lib/places-store.ts`, `components/MyMapScreen.tsx`, onglet « Ma carte »). Après trois sorties
c'est une carte de son quartier, après un an une carte de ses voyages. C'est simultanément la
récompense, le journal (la donnée s'enregistre sans rien demander à saisir) et le hook de
rétention — et c'est le seul qui vaille pour les trois modes à la fois, puisque tous trois
remplissent la même carte.

Décisions à connaître :
- **Magasin séparé de celui des itinéraires**, et c'est le point important : supprimer une sortie
  de « Mes sorties » ne doit pas effacer les lieux où l'on est allé. Vérifié en réel — la sortie
  supprimée, le lieu reste sur la carte.
- **Décocher retire le passage** (faute de frappe sur un écran de téléphone, cela arrive) ;
  recocher la même étape ne compte pas deux fois. Le geste est idempotent.
- **Clé d'identité** = nom normalisé + coordonnées à 3 décimales (~110 m). Le nom seul ne suffit
  pas — il y a un « Le Comptoir » par ville — et les coordonnées seules non plus, le modèle et le
  référentiel ne posant pas exactement le même point.
- **La confirmation nomme le lieu** (« Bar à vins du Marché — ajouté à ta carte ») : le geste se
  fait depuis la bottom sheet alors que la carte est dans un autre onglet, donc sans un mot on
  reprendrait une information sans rien rendre.
- **Marqueurs non numérotés** sur cette carte (`numbered={false}` sur `MapView`) : les lieux
  visités sont une collection, pas un trajet — les numéroter suggérerait un ordre qui n'existe pas.
- **Rangée par ville** (26/08/2026, après retour utilisateur). La première version montrait tout
  sur une seule carte : avec des sorties à Tours et à Marseille on obtenait une vue de la France
  où chaque ville est un point, illisible. La commune est résolue par géocodage inverse
  (`lib/reverse-geocode.ts`) **après coup** et non au moment de cocher — le retour visuel ne doit
  pas être suspendu à un aller-retour réseau. `city` vaut `undefined` tant que non résolue et
  `null` en cas d'échec : sans cette distinction l'effet de résolution retenterait indéfiniment.
  Onglets de ville, **défaut sur la vue France** (choix de l'utilisateur, 26/08/2026) : c'est la
  vue qui donne la mesure de la collection — combien de villes, où l'on n'est jamais allé. Sur
  cette vue, **un marqueur par ville portant son nombre de lieux**, cliquable pour y entrer :
  superposer les points d'une même ville à l'échelle du pays produirait une tache. « X villes »
  devient au passage la mesure de collection la plus parlante.
- **Bug corrigé au passage — `shrink-0` sur le conteneur de carte.** Dans une colonne flex, une
  hauteur en `dvh` reste compressible : la carte était écrasée à une centaine de pixels dès que la
  liste s'allongeait. Même piège que sur `ProposalDetailScreen`, où le `shrink-0` était déjà là.
- **Répartition masquée quand il n'y a rien à comparer** : trois types à un passage chacun
  donnaient trois barres pleines identiques — un affichage qui semble cassé.
- **Répartition par type en barres d'une seule couleur**, pas une par type : douze couleurs
  seraient la même erreur que celle déjà corrigée sur les marqueurs. Elle est masquée tant qu'un
  seul type est visité — un graphique à une barre n'apprend rien.
- **Pas de plafond d'entrées**, contrairement à l'historique des itinéraires : la valeur de cette
  liste vient précisément de son accumulation, et une entrée pèse quelques centaines d'octets.

`MapView` a été généralisé pour l'occasion : il prend des `points: MapPoint[]` (id, nom,
coordonnées) au lieu d'étapes d'itinéraire, et `computeBounds` accepte n'importe quel porteur de
`location`. `ItineraryStep` reste un sur-ensemble de `MapPoint`, donc les écrans existants n'ont
changé que de noms de props.

### Cliquer une ville rend ses sorties (27/08/2026)

Défaut nommé par l'utilisateur : la carte ne rendait que des **points isolés**. On retrouvait le
nom d'un bar sans jamais pouvoir revenir à la soirée dont il faisait partie — or c'est le parcours
qu'on garde en tête, pas la coordonnée. Sous un onglet de ville, une section « Tes sorties à
Lyon » liste désormais les sorties rattachées ; chaque ligne rouvre l'itinéraire en plein écran,
avec ses étapes et ses cases à cocher. La boucle se referme donc dans les deux sens : la sortie
remplit la carte, la carte ramène à la sortie.

`lib/city-itineraries.ts` — module **pur**, il ne fait que croiser deux listes qu'on lui donne.
Aucun `Itinerary` ne porte de champ « ville » : le rattachement se déduit, par deux voies dont
l'ordre compte.
- **Les passages** (`visits[].ref` = `itineraryId:stepId`) : preuve directe, aucune heuristique.
- **La proximité** (≤ 25 km d'un lieu visité de la ville), en second seulement — pour les sorties
  enregistrées mais jamais entamées. N'ayant posé aucun point, la première voie ne peut pas les
  voir, et ce sont pourtant exactement celles qu'on veut retrouver (« j'avais gardé un week-end
  à Lyon »). Comparaison aux **lieux** et non à leur centroïde : deux ou trois points ne font pas
  un centre-ville, et un centroïde tiré entre deux quartiers opposés tombe là où l'on n'est
  jamais allé. « Ailleurs » (commune non résolue) en est exclu — ses points sont dispersés dans
  tout le pays, une distance entre eux ne veut rien dire.

Le suivi est **une barre et un compte**, pas seulement un compte : « 3/8 » demande à être lu, une
barre se voit. En outremer, l'encre du factuel — une progression constate, elle n'appelle pas à
agir. Une sortie jamais entamée est marquée « pas encore faite » et non « 0/8 » : un zéro sur une
barre vide se lit comme un échec alors que c'est un programme en attente, et c'est aussi la seule
qu'on rattache par proximité — le dire évite d'affirmer un passage qui n'a pas eu lieu.

**Rechute de la règle de l'état remonté, trouvée en cliquant pour de vrai.** Ouvrir une sortie
depuis la carte démonte la coque à onglets : la ville sélectionnée, gardée dans `MyMapScreen`,
était perdue et le retour renvoyait sur la vue France — il fallait re-cliquer Lyon à chaque
aller-retour. Même correctif que pour les réglages de « Créer » : `mapZone` remonté dans
`app/page.tsx`, `MyMapScreen` devient contrôlé (`zone` / `onZoneChange`). Avec en plus un repli
calculé — une ville dont on a décoché le dernier lieu disparaît de la liste, et l'onglet
survivant au démontage pointerait sur un ensemble vide. **Leçon** : tout état d'écran qui doit
survivre à l'ouverture d'un plein écran vit au-dessus de la coque, pas dedans.

`MODE_LABELS` a été sorti dans `lib/trip-modes.ts` : « Mes sorties » et les sorties d'une ville
montrent les mêmes objets, et un mode nommé de deux façons ferait croire à deux natures. Reste
distinct des libellés du sélecteur, qui parlent au futur — on choisit « Ce soir », on relit
« Soirée ».

## Vérifié et fonctionnel

- `tsc --noEmit`, `next lint` et `next build` passent sans erreur ni avertissement
- Validation Zod → `400 INVALID_INPUT` ; rate limit → `429` à la 6ᵉ requête valide
- Token Mapbox valide : géocodage et style `dark-v11`
- Écran d'accueil, écran d'erreur, carte cadrée, bottom sheet, sélection d'étape

Bugs trouvés à l'exécution et corrigés le 25/08/2026 :
- `ResultScreen` présélectionnait la 1ʳᵉ étape, dont le `flyTo` écrasait le `fitBounds` initial
- `fitBounds` perdu au montage : désormais aussi déclenché par `onLoad` de la carte
- Bottom sheet en `max-h-[92vh]` : vaul calcule ses snap points en fraction de la **fenêtre**,
  la sheet ne montrait qu'un liseré de 77 px. Corrigé en `h-screen`
- Snap initial à 0.55 impossible avec vaul 0.9.9 → la sheet s'ouvre sur l'aperçu, `dismissible={false}`
- Logo Mapbox (`z-index: 2`) par-dessus la sheet → `z-20` sur `Drawer.Content`

## Reste à faire

**Supabase — bloqué.** Le serveur MCP répond `Unauthorized` et la référence de projet vaut
`${SUPABASE_PROJECT_REF}`, non résolue : aucun projet n'est rattaché. Il faut créer le projet et
fournir un `SUPABASE_ACCESS_TOKEN`. Le travail restant est alors circonscrit : écrire un
`supabaseItineraryStore` conforme à l'interface `ItineraryStore` de `lib/storage.ts`, et changer
l'implémentation injectée dans `hooks/useSavedItineraries.ts`. Les écrans ne bougent pas.

**Taux de confirmation des lieux.** Mesuré à 52 % sur 31 étapes (Bordeaux 5/6, Toulouse 7/9,
Marseille 4/7, mais Paris 0/5 et Lyon 0/4). Deux causes se mélangent : de vraies inventions
(« Club Pigalle Nights ») et des lieux réels absents du référentiel Mapbox (Le Perchoir, Place des
Terreaux). Élargir les types de recherche a été testé puis **écarté** : le quartier « Pigalle »
validerait « Club Pigalle Nights ». La piste sérieuse est un second référentiel (Google Places,
mieux fourni sur les bars et restaurants français), pas un assouplissement des verrous.

**Latence : c'est le modèle, pas le pipeline.** Mesuré en production sur une soirée à Lyon :
**modèle 8 547 ms, vérification des lieux 481 ms**. 94 % de l'attente est passée à écrire —
optimiser la vérification ne donnerait presque rien.

**Livraison progressive : faite** (26/08/2026). La route ne rend plus un objet unique mais un flux
**NDJSON** (`GenerationEvent` dans `types/itinerary.ts`) : `start` annonce le nombre de
propositions attendues, puis chaque `proposal` part dès qu'elle est vérifiée. `generateProposals`
(`lib/claude.ts`) rend les promesses **sans les attendre**, c'est ce qui rend la chose possible.
L'écran de choix s'ouvre sur la première idée, les autres s'ajoutent sous des emplacements
d'attente réservés d'avance.

Le gain mesuré est réel mais **inégal, et il faut le savoir** : il vaut l'écart entre la
génération la plus rapide et la plus lente, qui croît avec le volume produit.
- soirée à Lyon : première idée **7,6 s**, dernière 8,3 s → **0,7 s** gagnée
- week-end à Bordeaux : première **9,8 s**, dernière 13,2 s → **3,4 s** gagnées (26 %)

Autrement dit le mode le plus utilisé, Tonight, est celui qui en profite le moins. Pour lui, le
plancher des ~7 s est le temps d'écriture du modèle.

**Haiku : mesuré, et écarté** (26/08/2026). `VIBETRIP_MODEL` (`lib/claude.ts`) permet de comparer
deux modèles à code identique ; deux serveurs de production, mêmes scénarios, lancés **en série**
(en parallèle les mesures se contaminent — première tentative à jeter).

| Scénario | Sonnet 1ʳᵉ / dern. | Haiku 1ʳᵉ / dern. | confirmées Sonnet | Haiku |
|---|---|---|---|---|
| Lyon · soirée | 6,0 / 7,5 s | 6,0 / 6,0 s | 50 % | 40 % |
| Paris · soirée | 6,6 / 12,5 s | 3,8 / 5,5 s | 90 % | 85 % |
| Bordeaux · week-end | 10,1 / 15,9 s | 5,6 / 6,4 s | 78 % | 56 % |

Haiku est bien **deux fois plus rapide** sur les modes lourds. Il est écarté quand même, sur deux
défauts rédhibitoires, tous deux vérifiés :

1. **Il perd des propositions entières.** Sur quatre générations « Lyon · ce soir », il en a rendu
   1, 2, 3 puis 2 sur les 3 demandées. Aucune exception côté serveur : les propositions manquantes
   sont vidées par le filtre de plausibilité, donc leurs coordonnées sont fausses. On paie trois
   générations pour en afficher deux.
2. **Il ne respecte pas le contrat des périodes.** En mode « ce soir », Sonnet produit `evening`
   seul dans 6 cas sur 6 ; Haiku glisse du `morning` et du `midday` dans 3 cas sur 4 — soit
   proposer d'aller à Fourvière « à midi » à quelqu'un qui ouvre l'app à 20 h.

Le taux de confirmation baisse aussi sur le mode long (56 % contre 78 %). **Décision : on reste
sur Sonnet.** Troisième levier, mineur et non tenté : raccourcir les descriptions.

**Défaut de vérification repéré au passage** : « Marché des Capucins » confirmé par une annonce
de location. **Corrigé le 27/08/2026** — voir « Resserrage » dans la section vérification des
lieux, qui documente aussi les deux autres faux positifs que le banc a fait apparaître.

Deux pièges de mise en œuvre à ne pas refaire :
- l'en-tête `X-Accel-Buffering: no` est indispensable — sans lui un proxy ou un CDN peut mettre
  le flux en tampon et le livrer d'un bloc à la fin, ce qui annule exactement le bénéfice ;
- dès que le flux commence, la réponse est un **200** : seules la validation Zod et le quota
  peuvent encore porter un vrai statut HTTP, tout le reste passe par un événement `error`. Et un
  `error` n'est émis que si **aucune** proposition n'a abouti — une panne partielle laisse deux
  itinéraires à l'écran plutôt qu'un message d'erreur.

**Latence du mode voyage** : 56 s mesurées avec 3 propositions, d'où le repli à 2. Le flux ne
change rien à ce plafond — c'est la limite d'exécution de 60 s qui commande.

**Défauts de génération non traités** : budget ignoré sur le haut de gamme, horaires d'ouverture
ignorés (musée en étape « Soir »), types parfois incohérents. Le prompt n'a pas encore été révisé
à la lumière du banc d'essai.

**Onglet Profil : fait** (29/08/2026). Voir la section dédiée plus bas.

**Coaching à partir de la carte** : « tu n'as jamais rien fait rive droite », « tu prends toujours
des bars ». N'a de sens qu'une fois quelques dizaines de points posés — donc après, pas avant.

**Surface area check : premier passage fait** (29/08/2026), au moment d'ajouter le profil — et il
a immédiatement servi. Il a fait apparaître un doublon que l'ajout venait de créer : « Ma carte »
portait des barres « Ce que tu fais » par **type**, le profil des barres par **thème** — deux
découpages du même fait, au même dessin, dans deux onglets voisins. Le bloc de « Ma carte » est
retiré : le profil dit la même chose dans l'unité qui **agit** sur les propositions, et
l'accompagne d'un geste. La carte redit ce qu'elle est — où l'on est allé, et combien.

Mesure de la concentration : `ProposalDetailScreen` porte **12 contrôles**, contre 6 pour
« Ma carte » et « Mes sorties », 4 pour les propositions, 2 ailleurs. C'est bien là que la surface
s'est accumulée (retour, rétablir l'origine, valider, sélection d'étape, « Changer » par étape,
six thèmes, choix d'un lieu). Chaque élément se justifie isolément ; le prochain retrait à
examiner est là, pas ailleurs.

## Design system (étape 4bis) — direction « Riso », en place

**Retenue par l'utilisateur le 26/08/2026 et appliquée à toute l'application.** Elle remplace
« Carnet » (voir la section suivante pour le diagnostic qui a conduit à l'abandonner).

Registre : l'affiche sérigraphiée. Papier journal **gris-froid** `#E7E5DF` avec trame de points
(classe `.grain`, `app/globals.css`) — surtout pas un crème chaud. **Deux encres**, saturées mais
non fluorescentes (le rose fluo de la maquette a été écarté à la demande de l'utilisateur) :
vermillon `#DD3B2E` et outremer `#2B44A8`, plus le noir d'impression `#17161A` et une couleur de
surimpression `#7A2E63`. Titres en **Anton**, texte en **Archivo** (`app/layout.tsx`).

Règles à respecter, elles portent du sens :
- **Aucun angle arrondi, aucune ombre diffuse, aucune carte flottante.** Des filets noirs de 2 px
  (3 px pour les séparations majeures) et des aplats d'encre. `card`, `sheet` et `pill` restent
  définis à 0 dans la config Tailwind pour qu'une classe oubliée rende un angle droit plutôt qu'un
  arrondi orphelin. Seul relief conservé : `shadow-print`, un décalage net de 3 px.
- **Vermillon = l'action et la sélection.** Jamais décoratif.
- **Outremer = le factuel et le confirmé.** Une adresse vérifiée est une information calme.
- **Un lieu non confirmé ne reçoit aucune encre** — capitales grises soulignées d'un pointillé.
  C'est la même règle que dans « Carnet » et pour la même raison : la moitié des étapes sont dans
  ce cas, les colorer en rouge ferait passer un produit qui marche pour un produit cassé.
- Les marqueurs de carte gardent le cercle : c'est une convention cartographique, pas un arrondi
  d'interface.

**Piège rencontré deux fois — Anton et l'interlignage.** `leading-[0.95]` est juste sur un titre
d'une ligne et fait mordre les lignes dès qu'un titre passe à la ligne (« … AUTOUR DE / LYON »).
Les titres susceptibles de revenir à la ligne sont à `leading-[1.04]`.

**Revue d'assemblage (27/08/2026).** Cinq lots faits en parallèle et à l'aveugle ont été montés
puis regardés à l'écran, à 390×844, 390×667 et 320×568. Trois arbitrages en sont sortis :

- **Les étiquettes cliquables ont une définition unique** (`components/ui/chip.ts`). Elles
  existaient en quatre métriques dans quatre fichiers, et surtout en **deux encres** : le panneau
  « Changer » marquait en noir les six thèmes que l'écran de réglages marque en vermillon — les
  mêmes six mots, deux dessins. L'encre retenue est le vermillon, comme le veut la règle du
  système. Le noir plein reste au seul `ModeSelector`, qui n'est pas une étiquette mais une bande
  jointive à choix unique et obligatoire.
- **Les trois mastheads d'onglet sont à `leading-[0.85]`**, pas `1.04`. Le piège Anton ne vaut que
  pour les titres qui reviennent à la ligne : « Vibetrip », « Mes sorties » et « Ma carte » sont
  des chaînes fixes, et la plus longue mesure 192 px pour ~225 px disponibles à 320 px de large.
  Un interlignage différent déplaçait les capitales de 4 px au-dessus du filet : le titre sautait
  au changement d'onglet.
- **Deux vides égaux ne valent pas mieux qu'un vide mal placé.** `CoverScreen` et `LoadingState`
  avaient tous deux remplacé un `justify-center` sur le `main` par un `justify-center` sur un
  conteneur `flex-1` — ce qui rétrécit le vide sans le supprimer et en produit **deux, symétriques**
  (mesuré : 164/164 px sur 844, 141/141 px sur 568, soit 40 à 50 % de la page). Les deux écrans
  sont passés en `justify-start` : le contenu forme un bloc continu ancré en haut, la respiration
  se rassemble au-dessus du bloc bas, et l'action retrouve la place qu'elle occupe partout
  ailleurs. **Leçon** : mesurer le vide obtenu, pas celui qu'on croit avoir supprimé.

Piège de méthode rencontré pendant cette revue : `h1.getBoundingClientRect().width` rend la
largeur du **bloc**, pas celle du texte — un titre paraît alors occuper toute la ligne alors qu'il
en occupe la moitié. Pour juger un risque de retour à la ligne, mesurer avec un `Range` sur le
contenu. Une première correction a été faite puis annulée sur la foi de cette mesure fausse.

**Piège rencontré trois fois — la compression flex.** Dans une colonne `flex`, une hauteur en
`dvh` ou une rangée sans hauteur fixe restent **compressibles** : la carte de « Ma carte » se
réduisait à un bandeau, puis la rangée d'onglets de ville à un liseré. `shrink-0` sur tout bloc
de hauteur voulue à l'intérieur d'une colonne flex.

Quatre couples d'encres comparés sur le même écran, pour un changement ultérieur éventuel (quatre
valeurs dans `tailwind.config.ts`) : https://claude.ai/code/artifact/2182291d-d92e-4a4b-ae45-f3ab200ebc3b

## Design — pourquoi « Carnet » a été abandonnée (26/08/2026)

Retour utilisateur après démonstration à des proches : « le style Claude est trop présent ».
**Le reproche est fondé, et la cause est nommable** : crème chaud (`#FBF7F0`) + terracotta
(`#C2603E`) est, à quelques points près, la palette de Claude (`#F0EEE6` / `#CC785C`). S'y ajoutent
le serif de titrage, les cartes blanches arrondies et la faible densité — les trois traits qui
forment aujourd'hui la signature par défaut de l'interface générée.

Trois directions maquettées, écran de réglages + écran d'itinéraire, avec de vrais itinéraires
produits par l'app : https://claude.ai/code/artifact/5c9ab663-fa33-42cf-8c59-c30c5b49f8e6
(source : `scratchpad/ligne-riso-releve.html`). **L'utilisateur a retenu « Riso »** — la
recommandation était « Ligne », elle n'a pas été suivie et c'est son choix.

- **Ligne** — signalétique de réseau (plaques émaillées, fiches horaires). Bleu émail en aplat,
  aucun angle rond, le parcours tracé comme une ligne à stations. Recommandée : elle tient à
  dix-huit étapes et fait apparaître horaires et distances, qui manquent aujourd'hui.
- **Riso** — affiche sérigraphiée, rose fluo + bleu d'imprimerie sur papier journal, Anton en très
  grand. La plus mémorable, la plus fatigante sur les longues listes du mode voyage.
- **Relevé** — carte topographique IGN : courbes de niveau, condensé + chasse fixe, symboles de
  légende, coordonnées. C'est celle qui rend enfin *visible* la vérification des adresses.

« Ligne » et « Relevé » restent en réserve, maquettées et non appliquées.

### Page de garde — le vide, et la fin des mentions d'édition (27/08/2026, soir)

Deux reproches de l'utilisateur, tous deux fondés.

**« Édition France · N° 01 » : supprimé.** Le bandeau imitait le masthead d'une revue sans rien
dire de vrai — ni l'un ni l'autre n'est une information. C'était le même défaut que la fiche
technique qui occupait le second registre avant l'accroche : du décor tenant lieu de contenu. Le
titre est désormais le premier objet de la page, ce qui le sert — rien ne le précède, donc rien
ne le concurrence. Le `pt` du `main` intègre `env(safe-area-inset-top)`, sans quoi il passerait
sous l'encoche.

**Le vide entre l'accroche et le bouton : 200 px → ~80 px.** Trois choses ont été essayées, et
l'ordre dans lequel elles ont échoué est instructif :

1. *Tout dimensionner en `dvh`* (titre, accroche, respirations). Nécessaire mais insuffisant :
   le vide ne venait pas d'un mauvais placement mais d'un contenu taillé pour le plus petit écran
   et laissé tel quel sur le plus grand. Gain réel, ~90 px.
2. *Agrandir encore l'accroche.* **Contre-productif au-delà d'un seuil** : à 57 px elle occupait
   *moins* de hauteur qu'à 52 px, étant passée de cinq lignes à quatre. Agrandir retire des
   lignes autant que ça les épaissit. À retenir avant de retenter le coup.
3. *Répartir ce qui reste* de part et d'autre du bouton. Ça rétrécissait bien l'écart (200 →
   80 px), mais au prix de décoller le bouton du bas — ce que l'utilisateur voulait garder.
   Abandonné.
4. **Y mettre une image**, et c'est la bonne réponse : il fallait du contenu, pas un réglage.

`RouteSketch` (dans `CoverScreen`) dessine un parcours — quatre étapes numérotées reliées par un
trait interrompu, sur un fragment de ville traversé d'un cours d'eau. Elle montre littéralement ce
que l'accroche vient d'affirmer. En **SVG inline** et non en fichier : elle doit se recolorer avec
la palette (les classes Tailwind portent sur les formes) et rester nette sur une page dont la
hauteur varie du simple au double. Vermillon pour les étapes, outremer pour le décor — la rivière
a été amaigrie de 15 à 10 px après un premier essai où elle emportait le regard, ce qui inversait
la lecture voulue par le système. C'est la seule image de l'application.

Elle est **masquée sous 660 px de hauteur**, seuil mesuré et non deviné : à 568 px il ne restait
que 72 px, soit une vignette de 129 px de large illisible. Ces écrans-là sont de toute façon déjà
pleins (leur vide mesurait 115 px contre 200 sur un grand), donc la retirer n'y ouvre pas de trou.

Mesuré sans débordement à 320×568 (image masquée), 390×667 (image 115 px), 390×844 (199 px) —
le bouton est en bas et entier partout, ce qui est la seule chose non négociable.

**Les `<br>` de l'accroche ont sauté** au passage : réglés pour une taille unique, ils laissaient
« PAS » seul sur sa ligne dès que le texte grandissait. Deux paragraphes qui coulent, le texte se
casse là où la colonne l'impose.

### Page de garde — le titre occupe la colonne (27/08/2026)

Après la recomposition, le nom n'occupait encore que **55 %** de la largeur (187 px mesurés sur
342 à 390 px) : il dominait la page sans occuper la colonne, ce qui laissait le reproche à
moitié traité. Porté de 16vw à 26vw — il vient à ~40 px du bord sur un téléphone courant et à
~23 px sur le plus étroit des formats (320 px), toujours sur une ligne.

**Piste essayée puis annulée** : étirer la fiche technique (`flex-1` + `justify-between`) pour
absorber les ~250 px qui restent au-dessus du bouton. Les trois lignes ne se lisent alors pas
comme le tableau d'une affiche mais comme trois lignes perdues, et le filet de fermeture venait
buter sur le bouton. Un blanc franc en pied de page est une marge ; le même blanc réparti entre
des lignes qui se tenaient est une composition défaite.

**Piège de mesure à connaître** : `getBoundingClientRect()` sur un `<h1>` rend la largeur du
**bloc**, pas celle du texte — il donne donc toujours 100 % de la colonne et fait croire à un
débordement imminent. Mesurer le texte demande un `Range` sur le contenu du nœud. Cette erreur a
déjà fait réduire le titre à tort une fois.

### Les trois mastheads d'onglet (27/08/2026, soir)

Reproche de l'utilisateur : « dans le menu de l'appli en haut à droite je comprends pas les
numéros ». Fondé, et le défaut était double.

Les trois onglets portaient trois coins droits **différents** — « N° 01 » sur Créer (la même
mention d'édition creuse que celle retirée de la page de garde), un « 3 » nu sur Mes sorties, un
« 4 » nu sur Ma carte — dont aucun ne disait ce qu'il comptait. Et ces comptes étaient déjà donnés
ailleurs, mieux nommés : par le **badge de l'onglet** dans la barre du bas, et pour Ma carte par
son **bloc de statistiques** (« 4 lieux · 4 passages · 2 villes »). Le même nombre paraissait donc
jusqu'à trois fois sur un écran.

Leur donner leur mot (« 3 sorties ») était exclu par la place : « MES SORTIES » occupe 199 px des
225 disponibles à 320 px de large. Les trois coins droits sont donc **supprimés** — le masthead
est le titre et son filet, identique sur les trois onglets. Un nombre à trois endroits n'informe
pas, il fait douter qu'il compte la même chose.

## Socle de lieux — Supabase (27/08/2026)

Dossier de décision complet, avec toutes les mesures :
https://claude.ai/code/artifact/80c2f427-b505-4339-ae14-3c9efbfb9e3b

**Google Places est écarté comme base, pour raison contractuelle et non technique.** Ses
*Service Specific Terms* n'autorisent à conserver indéfiniment que le `place_id` ; les coordonnées
sont cachables 30 jours, le reste doit être demandé en direct. C'était la piste inscrite ici
jusqu'au 27/08 — elle ne tenait pas. Google reste bon pour la vérification à la volée.

**Le socle est Foursquare OS Places** (Apache 2.0, usage commercial, actualisation mensuelle),
chargé dans Supabase (projet `tcqpkstrakpamzketbxe`, PostgreSQL 17.6, PostGIS 3.3.7).

Mesure de validation avant tout engagement, sur 14 cas tous issus de mesures antérieures :
**14/14 conformes**. Les trois inventions du modèle sont absentes du référentiel — il ne les
valide pas, ce qui est exactement ce qu'on lui demande. Et « Le Baron » est marqué fermé au
6 avenue Marceau : l'information qui manquait depuis le début.

Les homonymes se départagent **par proximité** à la coordonnée proposée (3/3 justes). Il y a deux
« Le Baron » à Paris, l'un fermé l'autre ouvert, à 400 m l'un de l'autre — c'est la coordonnée qui
tranche, jamais le nom seul.

### Ce qui a été appris en construisant

- **Liste blanche, pas liste noire.** Le premier filtrage laissait entrer 24 612 villes et
  villages, 15 962 « Structure », 9 440 parkings, et un `Retail%` qui ratissait supermarchés,
  garages et matériaux de construction. Le référentiel compte des centaines de sous-catégories
  dont la plupart ne sont pas des sorties : énumérer ce qu'on veut est vérifiable, exclure ce
  qu'on ne veut pas ne l'est jamais.
- **La fraîcheur n'est pas un critère d'exclusion.** Un seuil « rafraîchi depuis 2022 » faisait
  disparaître **Chez Marcelle**, vrai bouchon lyonnais toujours ouvert dont la fiche n'a pas bougé
  depuis 2019. Le filtre jetait exactement les petites adresses de quartier qui font la valeur du
  produit — celles que Mapbox ne sait déjà pas confirmer. L'ancienneté est donc devenue une
  **priorité de re-vérification** (colonne `refreshed_at`, 65 % des lieux concernés), et le volume
  est passé de 188 984 à 575 206 lieux.
- **Piège d'accès, une heure perdue** : depuis Python, l'API de gestion Supabase répond
  `403 Forbidden` à cause du `User-Agent` par défaut (`Python-urllib/3.x`). Le symptôme fait
  chercher du côté du SQL ou de la taille des lots — ce n'est ni l'un ni l'autre. Poser un
  `User-Agent` explicite suffit. Le même SQL passait par `curl` au même instant.

### Le partage qui gouverne l'architecture

Les **faits** (le lieu existe, ses coordonnées, son adresse, s'il est ouvert) ne sont jamais
produits par un modèle. Le **jugement** (est-ce intéressant, pour quelle envie, comment le décrire)
l'est, mais toujours à partir d'une fiche factuelle. Un lieu inventé écrit en base serait pire
qu'un lieu inventé à la volée : il aurait l'autorité d'une donnée stockée, et plus personne ne le
remettrait en question.

### Le champ « commune » n'est pas exploitable brut

Le référentiel écrit **« Paris » sous 7 casses** et **« Aix-en-Provence » sous 10 orthographes**
(« Aix en Provence », « aix-en-provence »…). Sur le champ brut, Paris paraît compter 46 088 lieux
au lieu de 50 687, et Aix 744 au lieu de 1 868 — une recherche produit raterait plus de la moitié
d'une ville. D'où la colonne générée `locality_norm` (sans accents, minuscules, séparateurs
unifiés) et son index. **Toute requête par ville passe par elle.**

`unaccent` n'étant pas `IMMUTABLE`, elle est inutilisable telle quelle dans une colonne générée :
il faut le wrapper `vt_unaccent`, déclaré `immutable strict parallel safe`.

**Piège de méthode, rencontré trois fois dans la même session** : les fausses alertes venaient du
script de contrôle, jamais des données. Une normalisation qui découpait les noms caractère par
caractère ; une règle de choix qui ignorait la coordonnée ; puis un regroupement Python sur clé
normalisée qui **écrasait** les variantes au lieu de les additionner, affichant « Paris : 1 lieu ».
Avant de conclure à une régression des données, vérifier l'outil de mesure — c'est plus souvent
lui.

### Vérification régulière — deux skills

- **`/check-places-db`** — cohérence interne, gratuit. Vue `base_sante` et table `sante_journal`
  (une ligne par mesure, pour voir la dérive). Seuil le plus utile : si `sans_theme` dépasse 5 %,
  la correspondance des catégories a cessé de fonctionner, et le symptôme côté utilisateur est un
  panneau « Changer » vide **sans message d'erreur**. Le skill vérifie aussi nommément que
  Chez Marcelle et Le Nemours sont là, et que les inventions du modèle n'y sont pas.
La mesure s'inscrit **seule** chaque nuit à 3 h (`pg_cron`, tâche `sante-quotidienne`) : le
journal se remplit sans qu'aucune session soit ouverte. Une routine Claude locale ne pouvait pas
tenir ce rôle — elle ne tourne que quand l'ordinateur est allumé, et le jeton n'est pas versionné
donc pas disponible dans un environnement cloud. Les skills lisent et interprètent, `pg_cron`
collecte.

- **`/verify-places-google`** — existence réelle, payant, budgété. Le Text Search coûte 32 $ les
  1 000 appels : vérifier tout le socle coûterait ~18 400 $ par passage. La vérification
  exhaustive est donc exclue définitivement. File priorisée par `proposed_count` puis par
  ancienneté de fiche, 150 lieux par passage pour tenir dans le quota gratuit. **On stocke un
  verdict (`google_status`), jamais du contenu Google** — c'est ce qui rend la chose licite.

### L'inversion du pipeline — faite et mesurée (27/08/2026)

C'était le but de tout le socle, et c'est fait. Le modèle ne produit plus de lieux : il reçoit
une liste de lieux **réels** tirés de la base autour du point de départ, et compose parmi eux.

Chaîne : `lib/places-db.ts` interroge la fonction SQL `candidats_autour` (PostGIS, rayon aligné
sur le filtre de plausibilité) → `lib/prompt.ts` injecte la liste dans le prompt, une ligne par
lieu → le modèle renvoie une **référence** (`ref: "L12"`) par étape → `lib/claude.ts` remplace nom,
coordonnées et adresse par ceux du socle et marque l'étape vérifiée.

**Banc d'essai du 29/08/2026 : 7/7 scénarios, 122 étapes, `100 %` d'adresses confirmées.**

Le passage de 89 % à 100 % tient à **un seul défaut, introduit par la vérification elle-même**.
`dejaAncree` déduisait l'ancrage de la présence d'une adresse — or **21 % des lieux du socle n'en
ont pas** (123 170 sur 575 206). Ces étapes, pourtant tirées de la base, repassaient par le
référentiel Mapbox qui les rejetait, et s'affichaient « à confirmer » : « Club Zik » et
« Prohibition's » à Toulouse existent bel et bien. Le drapeau `anchored` est désormais posé
explicitement et lu tel quel, jamais déduit.

Ce que la recherche du défaut a appris, et qui vaut plus que le correctif : le taux du mode
voyage (80-85 %) semblait venir d'un décrochage du modèle sur dix-huit étapes. Une trace posée
sur les échecs d'ancrage a montré **zéro décrochage** — le modèle suivait parfaitement le socle,
et la perte se produisait en aval. Sans cette trace, on aurait ajusté le prompt sans fin.

**Mesure précédente du 27/08 (7 scénarios, 128 étapes) : 89 %**, contre 52 % avant l'inversion.

| Scénario | Étapes | Confirmées |
|---|---|---|
| Paris · soirée · fauché & calme | 11 | **100 %** |
| Paris · soirée · large & festif | 12 | 92 % |
| Lyon · soirée · milieu de gamme | 9 | 89 % |
| Bordeaux · week-end · calme | 18 | 94 % |
| Marseille · week-end · festif | 22 | 95 % |
| Toulouse · voyage · court | 20 | 80 % |
| Lille · voyage · étendu | 36 | 83 % |
| **Ensemble** | **128** | **89 %** |

Paris et Lyon, qui mesuraient 0/5 et 0/4 avant, sont désormais au niveau des autres. Le mode
voyage, tombé à 22 % lors du premier passage avec socle, tient maintenant 80-83 %.

**Mesures intermédiaires, à scénarios identiques :**

| Scénario | Avant | Après |
|---|---|---|
| Lyon · soirée | 0/4 | **91 %** (stable sur 3 passages) |
| Paris · soirée | 0/5 | **100 %** |
| Bordeaux · week-end | 78 % | **89-97 %** |
| Toulouse · ville saisie | 78 % | **83 %** |
| Nantes · ville saisie | — | **92 %** |

Le taux global passe de **52 % à ~90 %**. Coût en latence : **+0,6 s** sur la première proposition
à Lyon (7,6 s → 8,2 s de moyenne sur trois passages). La requête au socle ne pèse que **0,22 s** —
tout le surcoût est la longueur du prompt.

Décisions à connaître :

- **50 candidats, pas 90.** À 90, la première proposition d'un week-end à Bordeaux tombait à
  18,8 s contre 9,8 s sans socle : le modèle passe son temps à lire la liste. À 50, le choix
  reste large (une soirée compte 4 étapes) et l'attente redevient tenable.
- **Une graine par proposition** (`p1`, `p2`, `p3`) dans `candidats_autour` : sans elle, les trois
  angles piochent exactement les mêmes adresses et le choix offert n'en est plus un.
- **Le géocodage de la ville passe avant la génération**, alors que le filtre de plausibilité le
  fait en parallèle. C'est indispensable : la géolocalisation exige un contexte sécurisé, donc
  elle est indisponible dès qu'on teste sur un téléphone en réseau local. Sans cela le socle ne
  servirait presque jamais. Le point est résolu **une seule fois** et partagé entre les trois
  propositions.
- **Le modèle garde son `type`**, mais pas son nom ni ses coordonnées. Et si la coordonnée qu'il
  écrit s'éloigne de plus de 2 km du lieu qu'il dit avoir choisi, **on ne substitue pas** : il
  parlait d'autre chose, mieux vaut une étape « à confirmer » qu'une fausse certitude.
- **Le socle ne juge pas.** Il garantit qu'un lieu existe, pas qu'il vaille le détour — un
  Domino's y côtoie un bouchon. Le prompt le dit explicitement au modèle (« cette liste n'est pas
  un classement »), et une courte liste d'enseignes est écartée en amont. Le tri fin est du
  ressort du modèle : c'est le partage faits/jugement appliqué.
- **Repli silencieux** : socle indisponible, pas de coordonnées, mode mock → liste vide et la
  génération repart exactement comme avant. Le socle améliore le produit, il n'en est pas un
  point de rupture.

**Bug évité de justesse, à ne jamais réintroduire** : `verifySteps` réécrivait `verified` et
`address` pour **toutes** les étapes, et sans token Mapbox remettait `verified: null` — ce qui
effaçait purement et simplement l'ancrage. Les étapes déjà ancrées ne repassent plus par la
vérification (`dejaAncree`), ce qui supprime au passage autant d'allers-retours réseau.

**Contrôle de qualité fait à l'œil** sur une soirée à Lyon : de vrais bouchons et bars de la
Presqu'île, rue Mercière, rue Longue, Place Antoine Rivoire, avec leurs adresses réelles, et trois
propositions bien distinctes. La crainte d'un parcours « plat » ne s'est pas vérifiée. Piège de
lecture rencontré : « La Panière » classée en sortie de nuit paraissait absurde — c'est en réalité
une **salle de concert** lyonnaise, homonyme de la chaîne de boulangeries. Le socle avait raison.

### Ce que la journée du 27/08 a encore appris

**Haiku redevient le modèle par défaut.** Ses deux défauts rédhibitoires sont tombés avec
l'inversion : il perdait des propositions entières parce que ses coordonnées fausses étaient
vidées par le filtre de plausibilité (l'ancrage les remplace), et il ne respectait pas les
périodes (le schéma s'en charge — et la mesure a montré que **Sonnet l'enfreignait aussi**).
Reste l'écart de vitesse, mesuré à contrat et socle identiques : un week-end à Bordeaux livre
ses trois propositions en **7,7 s contre 19,6 s**, à taux de confirmation équivalent.

**Contraindre vaut mieux que demander.** Le contrat des périodes était une consigne du prompt,
que les deux modèles négligeaient. Passé dans le schéma (`claudeItinerarySchemaFor`), il devient
impossible à enfreindre. Même logique pour les références : `z.enum` sur les refs réellement
proposées, ce qui interdit au modèle de décrocher de la liste.

**Trois familles de bruit dans le référentiel**, toutes marginales en volume et toutes
surreprésentées en tête de résultats parce que **posées en centre-ville** :
- 2 880 **coordonnées de repli** (centroïde de la commune) — quatre bars de quatre
  arrondissements lyonnais au même point, quatre des six premiers résultats d'une recherche ;
- 4 691 **enseignes de chaîne**, marquées en base et non filtrées côté application, pour que la
  règle vaille aussi bien à la génération qu'au panneau « Changer » ;
- 586 **noms qui n'en sont pas** — la commune elle-même (« Париж »), ou aucun caractère latin.

**Le champ commune cumule trois pièges** : « Paris » sous 9 casses, « Aix-en-Provence » sous 12
orthographes, et 2 629 lieux écrits « Ville, France » formant 817 communes fantômes — dont un
`lille-france` distinct de `lille`. D'où `locality_norm`, qui retire aussi le suffixe de pays.
**Toute requête par ville passe par elle.**

**Un voyage se cherche dans des villes, pas dans un rayon.** Le banc donnait 4 étapes confirmées
sur 18. Trois causes empilées : la requête dépassait le délai d'exécution *par intermittence* sur
150 km (échec silencieux → le modèle compose sans socle → taux bimodal, 87 % ou 20 %) ; les
villes étaient triées par proximité, ce qui ne remontait que les banlieues ; et la ville de
départ tombait à 11 lieux sur 130, d'où des rues en guise d'étapes et deux fois la même gare.
Corrigé par l'agrégat `communes` (0,2-0,9 s), un tri par richesse, et un plafond plus élevé au
départ. Lille passe de 22 % à 77 %.

**Deux erreurs à ne pas refaire, les miennes** :
- **RLS activée sans policy = table invisible, sans erreur.** `communes` était lue par une
  fonction `stable` s'exécutant avec les droits de l'appelant : elle rendait 0 candidat, code 200.
  C'est l'échec le plus difficile à voir, parce qu'il ressemble à un résultat.
- **Vérifier le solde API avant de suspecter le code.** Une série de mesures à 0 % m'a fait
  soupçonner la requête ; le crédit Anthropic était épuisé. C'est écrit dans les notes du projet
  depuis le 25/08, et je l'ai quand même cherché ailleurs.

### La chaîne de fiabilité est complète (27/08/2026, soir)

Trois étages, chacun répondant à une question que les autres ne savent pas traiter :

1. **Foursquare** dit qu'un lieu **a existé** et où — 575 206 lieux, chargés une fois.
2. **Le modèle** compose parmi eux et **juge** lesquels valent le détour. Il ne produit plus
   aucun fait.
3. **Google Places** dit qu'un lieu **existe encore aujourd'hui** — `npm run verify:google`, ou le
   cron `/api/cron/verify-places` chaque nuit sur 150 lieux.

Dix fermetures détectées sur les 92 premiers lieux vérifiés, dont **« Autour d'Un Verre » à
Lyon** — un lieu que le socle proposait encore dans un itinéraire une heure plus tôt. Vérifié :
un lieu marqué `closed` disparaît immédiatement de la génération **et** du panneau « Changer ».

**Deux réglages propres à Google, différents de ceux de Mapbox** :
- **Cinq candidats, pas un** — « Place Gambetta » et « Théâtre du Capitole » étaient déclarés
  introuvables, le moteur les classant deuxième. La leçon était déjà écrite pour Mapbox.
- **Un verrou de proximité en plus du verrou de noms.** `place-match` est calibré contre
  « Le Baron » / « Le Baron Rouge » ; Google met la raison sociale entière dans le nom
  (« Horace » y devient « HORACE café.cuisine.canons »), ce qui rejetait 62 % de lieux réels.
  Sous 60 m, la géographie lève l'ambiguïté que le nom ne lève pas — sans laisser passer une
  reprise sous autre enseigne (« Codebar » devenu « Buster », à 8 m : rejeté).

### Ce que la vérification Google trouve réellement (28/08/2026)

Sur **144 lieux vérifiés** : 34 % confirmés ouverts, **13 % fermés**, 53 % sans correspondance.

**13 % de fermetures** est le chiffre à retenir, et il est cohérent avec la fraîcheur du socle
— figé à février 2025, et les trois quarts des fiches n'ont pas bougé depuis 2022. Rapporté aux
575 206 lieux, l'ordre de grandeur est de plusieurs dizaines de milliers d'adresses mortes. C'est
la mesure de ce que Google apporte, et de ce que le socle seul ne peut pas savoir.

**Les 53 % « sans correspondance » ne sont pas un échec mais une abstention.** Ce sont des lieux
dont Google ne remonte aucun candidat au même nom à moins de 300 m : soit ils ont fermé et été
remplacés (« Pavillon Noir » à Narbonne, où l'on trouve « La Cantine d'Anatole » à 46 m), soit
leur nom a changé. On ne peut pas les déclarer fermés sans risquer de retirer un lieu qui existe
— d'où `not_found`, qui les laisse proposables. La règle de proximité rattrape ce qui peut l'être
sans deviner : **« Le Triskell » retrouvé sous « Crêperie Bretonne Restaurant Le Triskell »** à
9 m, et bien fermé.

Le gain de cette règle est réel mais modeste sur le volume — 57 % d'abstention contre 62 % — et
sa valeur est ailleurs : elle décide **sur des cas que le verrou strict laissait passer**, et
chacun de ces cas est un utilisateur envoyé devant une porte close.

### Surface area check — enfin fait

Le panneau « Changer » empilait **deux sources d'alternatives**. « Dans les autres idées » (les
étapes des autres propositions) datait d'avant la recherche par thème et ne rendait souvent qu'un
candidat par créneau — c'est précisément ce qui avait motivé la seconde. Le socle en rend huit à
douze, tous réels, sans chaînes ni lieux fermés. Section supprimée, `lib/alternatives.ts` avec
elle, et la prop `allProposals` qui traversait deux niveaux de composants.

### En production depuis le 28/08/2026

**https://vibetrip-schuft.vercel.app** — vérifié en production : 11 étapes sur 11 confirmées,
10 s pour trois propositions, quota écrit en base, URL du cron protégée (401 sans jeton).

Deux pièges au déploiement, consignés dans `DEPLOIEMENT.md` : `vibetrip.vercel.app` **appartient
à quelqu'un d'autre** (les sous-domaines `.vercel.app` sont globaux — c'est un site espagnol),
et Vercel **protège par défaut toutes les URLs** par une authentification, API comprise. Le site
répondait 302 vers une page de connexion et paraissait cassé.

**Le quota est passé en base, et ce n'était pas un raffinement** : en mémoire de processus, chaque
instance froide serverless repart avec un compteur neuf — soit aucune limite dès que
l'application est publique. Sur un poste de développement la faiblesse restait théorique ;
exposée avec une clé API derrière, elle offrait le crédit au premier venu.

**Ce que le déploiement débloque, au-delà de la mise en ligne** : la **géolocalisation**, qui
exige un contexte sécurisé et était donc *impossible* en HTTP sur le réseau local — les testeurs
saisissaient forcément leur ville à la main.

### Routine mensuelle du socle (28/08/2026)

`scripts/routine-places.sh`, installée dans launchd — **le 1er de chaque mois à 9 h**. Journal
dans `~/Library/Logs/vibetrip-places.log` ; désinstallation par `launchctl unload`.

Elle vérifie l'accès au catalogue, **alerte quand le jeton expire dans moins de 8 jours** (avec
une notification macOS, un avertissement dans un journal que personne n'ouvre n'avertit
personne), recharge dès que le jeu de données est disponible, puis contrôle la base.

**Ce qu'elle ne peut pas faire, et il faut le savoir** : régénérer le jeton. Le portail n'en
délivre que d'un mois, par une page authentifiée. Sans l'alerte, la routine échouerait
silencieusement au bout de trente jours et le socle vieillirait sans que personne ne le remarque
— c'est exactement le genre de panne qu'on ne découvre que le jour où elle compte.

**En local et non sur un serveur, délibérément** : le rechargement lit 2,4 Go de Parquet et écrit
575 000 lignes, soit quarante minutes — hors de portée d'une fonction serverless. Une tâche de
maintenance de données peut glisser de quelques jours ; ce n'est pas un service utilisateur, et
c'est ce qui distingue ce cas du cron de vérification Google, lui hébergé sur Vercel.

`scripts/ingest-places.py` porte le pipeline complet, qui **vivait jusqu'ici dans un dossier
temporaire** et aurait été perdu. Il est paramétrable par source (miroir public ou catalogue) et
son `on conflict do update` rafraîchit les fiches existantes **sans toucher aux colonnes
`google_*` ni à `proposed_count`** : celles-là nous appartiennent et ne viennent pas du
référentiel.

### Rechargement Foursquare — bloqué côté compte (28/08/2026)

`npm run refresh:places` interroge le catalogue et diagnostique. L'accès **fonctionne** — jeton
accepté, catalogue joignable — mais ses trois espaces de noms (`datasets`, `attribute_packs`,
`plugins`) sont **vides** : le jeu OS Places n'est pas rattaché au compte. À ajouter depuis le
Places Portal ; rien dans le code n'y changera quoi que ce soit.

**L'endpoint ne se trouve que dans le portail** : `catalog.h3-hub.foursquare.com/iceberg`, avec
le préfixe `places` imposé par `GET /v1/config?warehouse=places`. `data.foursquare.com/iceberg`,
deviné au premier essai, n'existe pas — et la documentation publique ne donne pas le snippet.

**Le jeton expire au bout d'un mois**, maximum accordé par le portail. Le rechargement ne peut
donc pas être entièrement automatique : il faut en régénérer un à chaque fois. Une routine qui le
supposerait permanent échouerait silencieusement au bout de trente jours.

**Rien d'urgent** : le miroir public s'arrête à la version du 6 février 2025, qui est déjà celle
en base. Il n'y a donc rien à gagner à recharger tant que le catalogue reste fermé. Et c'est la
vérification Google qui porte l'essentiel de la fraîcheur — 13 % de fermetures détectées, ce que
le rechargement d'un référentiel ne donnerait pas.

### Deux manques comblés avant les tests (28/08/2026)

**Un lieu fermé est signalé dans les itinéraires déjà enregistrés.** C'était le dernier trou de
la promesse : un lieu marqué `closed` disparaît des nouvelles générations, mais un itinéraire
sauvegardé la veille gardait le sien — quelqu'un s'y rendait et trouvait porte close. Or la fin
de la boucle est qu'il **s'y rende vraiment**, ce qui a justifié tout le socle.

Les itinéraires vivent dans le navigateur et ne portent que nom et coordonnée, jamais
d'identifiant — le socle est arrivé après eux. La correspondance se refait donc en base
(`statut_etapes`), par proximité et par nom. **150 m et non 300** comme pour Google : ici on ne
cherche pas à identifier un lieu mais à confirmer qu'une étape est bien celle qu'on croit. Un
faux positif annoncerait une fermeture à quelqu'un dont le lieu est ouvert, et lui ferait annuler
une sortie qui tenait debout — plus grave qu'une fermeture manquée.

**Seul endroit où le vermillon sort de son rôle d'action**, et c'est assumé. La règle veut qu'on
ne crie pas à l'erreur pour un lieu non confirmé — ils sont la moitié, les colorer ferait passer
un produit qui marche pour un produit cassé. Un lieu fermé est l'inverse : rare (13 % des lieux
vérifiés) et sans appel. Ne pas le distinguer reviendrait à laisser partir quelqu'un devant une
porte close pour préserver une règle graphique.

**Le quota compte par appareil, plus seulement par adresse.** Trois amis derrière la même box
saturaient un quota de quinze en cinq essais chacun — c'est-à-dire exactement la situation d'un
test entre proches. L'appareil envoie un identifiant tiré au sort et gardé dans son navigateur
(`x-vibetrip-client`) ; il est contournable, et ce n'est pas grave : **le quota protège une
dépense, il ne garde pas une porte**. Le garde-fou contre le contournement est le second
compteur, par adresse, quatre fois plus large. Vérifié : deux appareils sur une même IP gardent
des quotas distincts.

### Ce que le premier test a révélé (29/08/2026)

Retour après essai par des proches : aucun bug, mais **« temps de chargement long » et « design
encore trop IA »**. Les deux avaient la même cause, et ce n'était pas le graphisme.

**C'était la prose.** Mesuré sur onze descriptions d'un même itinéraire : « ambiance » cinq fois,
« convivial » trois, « parfait » trois, « atmosphère » trois — et toujours le même moule, type
puis deux adjectifs puis « idéal pour » puis moment de la soirée. Des adjectifs interchangeables
ne décrivent aucun lieu : on ne lit plus une adresse, on reconnaît un gabarit. C'est ce que
l'utilisateur appelait « on dirait des carrés », et il notait justement que seuls des gens du
métier le repèrent.

La consigne porte désormais sur le fond — une phrase de moins de quinze mots disant un fait — avec
une liste explicite de mots interdits. « Restaurant convivial aux ambiances variées, parfait pour
un dîner sans prétention dans une atmosphère chaleureuse » est devenu « Tartares frais, viandes
sélectionnées, cuisine simple et généreuse ». L'interdiction vaut aussi pour le `summary`, qui y
échappait : « conviviale » y revenait aussitôt.

**Le même changement a réglé la latence** : Lyon de 7,6 s à **4,5 s**, Bordeaux week-end de
15-19 s à **5,1 s**. Moins de texte à écrire, moins de temps d'attente.

### Les images : ce qui a été essayé, et pourquoi la carte

La référence apportée par l'utilisateur était une application de voyage où **la photographie
occupe 60 à 70 % de l'écran**. C'est ce qui la sauve — le reste (angles arrondis, bleu marine,
icônes rondes pastel) est le canon générique du genre depuis 2018, c'est-à-dire ce qui avait fait
abandonner « Carnet ».

**Il n'existe pas de source gratuite de photos de bars et de restaurants**, et les deux pistes ont
été mesurées :
- *Wikimedia par géolocalisation* : rend des images du **voisinage**, pas du lieu — pour « La cave
  d'à côté », le portrait d'une écrivaine au festival Quais du polar. Les afficher serait un
  mensonge visuel, pire que pas d'image.
- *Wikimedia par nom*, filtre strict : **8 lieux sur 18**, et seulement parmi les monuments. Un
  itinéraire étant surtout fait de bars, cela donnerait une photo pour quatre étapes — pas une
  interface photographique, une incohérence.
- *Google Places Photos* : exactes, mais **six fois le coût du modèle** par génération (0,084 $
  contre 0,014 $). Écarté par l'utilisateur.

D'où **la carte du parcours comme image de chaque proposition** : vraie, gratuite dans le quota
Mapbox, et elle dit ce qu'une photo ne dirait pas — un parcours de quartier et un parcours qui
traverse la ville ne se ressemblent pas, et c'est souvent ce qui décide. Le titre est posé
**sur** l'image en bandeau d'encre : c'est le seul geste retenu de la référence.

Trois calages n'ont été trouvés qu'à l'écran : une marge trop large ou un cadre trop plat et
l'aperçu dézoome jusqu'à empiler les marqueurs en un tas sur « Bordeaux » ; la marge basse doit
être plus grande que les autres, sans quoi le bandeau masque un marqueur sur écran étroit ; et
l'emplacement d'attente doit avoir **la forme exacte** d'une carte remplie, sinon la liste saute
au moment où l'utilisateur y pose le doigt.

### Le signal maison remplace les notes

Cocher « j'y suis allé » incrémente un compteur sur le lieu, et les lieux visités passent devant
dans leur thème. **Aucune trace individuelle** — ni identifiant, ni date : on cherche à savoir
qu'un endroit marche, pas qui y va.

Le classement est **binaire** (visité ou non) et non proportionnel : avec des compteurs à zéro ou
à un, un tri par valeur ne trierait rien, et figerait les mêmes lieux en tête dès qu'ils
décollent. Sa valeur est différée et assumée — à zéro visite partout il ne change rien, mais
commencer à compter aujourd'hui, c'est avoir de quoi classer dans un mois.

### L'écran de réglages suit enfin l'ordre de la décision

Il demandait le budget et l'ambiance **avant** de savoir s'il s'agissait d'une soirée ou d'un
voyage de six jours — or « budget serré » ne veut pas dire la même chose dans les deux cas, et le
libellé du bouton dépend lui-même du mode. L'ordre est maintenant : quand, où, un filet 3 px,
puis les nuances (curseurs, envies). Les cinq blocs avaient jusqu'ici le même poids et le même
intervalle : rien ne disait que les deux premiers déterminent la sortie.

**Le bouton est passé en pied fixe.** Mesuré : 947 px de réglages pour 767 px visibles — l'action
principale se trouvait sous la ligne de flottaison et rien ne disait qu'il fallait défiler pour
l'atteindre.

### Reste à faire

- **Inverser le pipeline** : composer parmi des candidats réels de la base au lieu d'inventer puis
  vérifier. `lib/nearby-places.ts` fait déjà cela pour le panneau « Changer ». C'est le vrai gain
  du socle, et il se mesure avec le banc d'essai existant (52 % de confirmations aujourd'hui,
  Paris 0/5, Lyon 0/4).
- **Clé Google Places** à fournir dans `.claude/settings.local.json` pour activer
  `/verify-places-google`.
- **Cron serveur** (`pg_cron` ou Vercel Cron) pour consommer la file de vérification. Une routine
  Claude ne peut pas être l'infrastructure d'un service : si la base ne se met à jour que quand
  l'ordinateur est allumé, ce n'est pas un produit.

## Onglet Profil (29/08/2026)

Le dernier point ouvert des notes, et le plus longtemps différé — à raison : la réserve inscrite
ici de longue date était qu'**un profil qui ne change pas visiblement le résultat n'est qu'un
formulaire décoratif**. Il n'a été ouvert qu'une fois qu'il avait de quoi dire quelque chose de
vrai (les lieux cochés) *et* de quoi agir (les envies, qui pèsent déjà sur la génération).

**Rien n'est demandé, tout est observé** (`lib/taste.ts`). Un questionnaire aurait recueilli ce
qu'on croit aimer ; les cases cochées pendant les sorties disent où l'on est allé, ce qui n'est
pas la même chose et vaut mieux. Aucune saisie, aucun champ, aucun compte.

**Il se tait tant qu'il ne sait pas.** En dessous de 4 passages (`VISITES_MINIMUM`), il n'affiche
aucun goût — un profil qui se trompe sur vous est pire qu'un profil vide. L'état d'attente dit
**combien il en manque** plutôt que « pas encore de données » : le vide devient un objectif
atteignable en une sortie. Il compte des « étapes » et non des « lieux », le compte portant sur
les passages — deux passages au même endroit ne font qu'un lieu.

**Le geste qui le justifie** : « Appliquer à mes réglages » dépose les deux envies dominantes dans
l'écran de réglages, et bascule dessus. Il les **dépose** au lieu de les appliquer en sous-main —
un profil qui infléchirait les propositions sans le montrer serait pire que décoratif, on ne
saurait plus pourquoi on obtient ça. Deux au plus : présélectionner davantage revient à tout
cocher, ce qui ne dirige plus rien.

**Les notes sont enfin rendues à qui les a données** (`lib/ratings-store.ts`). Le registre ne
gardait que le *fait* d'avoir noté, pas la valeur ni le nom : on donnait un avis qu'on ne revoyait
jamais — le même défaut que cocher une étape sans que rien n'apparaisse nulle part, et un geste
qui ne rend rien cesse d'être fait. La lecture tolère l'ancien format (chaînes nues, `note: 0`),
qui reste invisible aux classements sans être effacé : les jeter aurait fait redemander son avis
à quelqu'un qui l'a déjà donné.

Défauts trouvés **à l'écran** et corrigés (aucun n'était visible dans le code) :
- *Libellé tronqué* — « BOIRE UN VE… » : placé à gauche de la barre, il tenait dans 96 px. Il
  occupe désormais sa propre ligne, avec le compte à droite.
- *Une barre seule ne compare rien.* Le premier jet ne montrait que les goûts au-dessus de 25 %,
  soit une seule barre à 73 % — qui répète la phrase du dessus en ayant l'air d'un graphique
  cassé. D'où deux listes distinctes : `gouts` (≥ 25 %, ce qu'on nomme et ce qu'on présélectionne)
  et `repartition` (tout ce qui a été visité, pour les barres), la section étant masquée en
  dessous de deux entrées. Même règle que sur la répartition de « Ma carte ».
- *Le bouton passait sous la barre d'onglets* dès que la liste des notes remplissait l'écran :
  `mt-auto` ne pousse en bas que **tant qu'il reste de la place**. Passé en `sticky bottom-0`.
  C'est la troisième occurrence du piège « l'action principale se retrouve hors de vue ».
- *Le même lieu deux fois* — « dernier lieu coché » redisait ce que la liste des notes nommait
  déjà. Gardé en repli, affiché seulement quand il n'y a aucune note.
- *Le geste ne se voyait pas.* Appliquer ses envies basculait sur « Créer »… où les cases cochées
  se trouvaient sous la ligne de flottaison : l'écran paraissait inchangé, et un geste dont on ne
  voit pas l'effet ne se distingue pas d'un geste sans effet. `HomeScreen` prend un
  `revealThemes` qui amène la section à la vue. Deux détails qui comptent : un **compteur** et non
  un booléen (appliquer deux fois de suite doit défiler les deux fois, or un drapeau déjà à `true`
  ne redéclenche rien), et un désarmement au changement d'onglet manuel — sinon l'écran défilait
  vers les envies à *chaque* retour sur « Créer ».

**Quatre onglets, et les libellés ont été choisis pour ça** : 80 px par colonne à 320 px de large.
« Profil » et non « Mon profil », « Sorties » et non « Mes sorties » — « Ma carte » garde son
possessif parce qu'il la distingue de la carte d'un itinéraire. Vérifié à 320×568 : aucun libellé
tronqué, et le bouton d'action atteignable au test de survol réel (`elementFromPoint`, pas un
clic programmatique — leçon déjà payée sur le bug vaul).

### Préférences déclarées, à côté des goûts observés (29/08/2026)

Demande de l'utilisateur, et elle comble un trou que l'observation seule ne pouvait pas combler :
**le profil observé est muet tant qu'on n'a pas coché quatre étapes**, c'est-à-dire pendant toute
la première sortie — précisément le moment où l'on aurait le plus besoin d'être orienté. Une
préférence déclarée agit dès la première génération.

Les deux coexistent et ne sont **jamais fondues** (`lib/preferences.ts` face à `lib/taste.ts`) :
l'une dit ce qu'on veut, l'autre ce qu'on fait. Les mélanger perdrait l'information la plus
intéressante, l'écart entre les deux — quelqu'un qui déclare aimer la culture et ne coche que des
bars n'est pas mal renseigné, c'est un fait sur lui. Le profil les présente donc sous deux titres
(« Tes préférences » / « Ce qu'on a compris »), et le bouton d'application dit explicitement
lesquelles il reporte.

**La case « Partir de mes préférences » vit dans « Créer »**, comme demandé, et non en application
automatique. Trois décisions portent du sens :
- **Son état est déduit du brouillon, jamais gardé à part** (`draftSuitPreferences`) : toucher un
  curseur la décoche d'elle-même, parce que le réglage a cessé de suivre les préférences. Une
  case qui resterait cochée en mentant serait pire que pas de case.
- **Décocher revient au réglage neutre**, ce qui la rend symétrique et réversible. Un bouton
  n'aurait laissé aucun moyen de revenir en arrière.
- **Elle n'apparaît pas tant qu'aucune préférence n'est utile** (`preferencesUtiles`) : des
  préférences *renseignées* ne sont pas des préférences *neutres* — effleurer un curseur et le
  remettre en place écrirait un enregistrement qui ne dit rien, et proposerait d'appliquer des
  valeurs identiques aux défauts. Même règle que l'onglet resté fermé tant qu'il était vide.

**Le bloc d'action du profil est repassé en flux** (il avait été mis en `sticky` le matin même) :
les préférences ont allongé l'écran, et le bandeau collant masquait dès lors un tiers de la
hauteur en permanence. Une page manifestement longue se défile — c'est une page qui *semble*
complète qui cache son action. Le correctif juste dépend donc de la longueur de la page, pas du
composant.

### Trois registres, et une fiche (29/08/2026, soir)

Reproche de l'utilisateur, fondé : les préférences déclarées ressemblaient à **une seconde copie
de l'écran « Créer »**, et « Ce qu'on a compris » en paraissait la suite — un filet, même à 3 px,
se lit comme une respiration à l'intérieur d'une même section, jamais comme un changement de
chapitre. L'écran tient désormais trois registres visuels, et la distinction porte du sens :

1. **La fiche** — aplat d'encre, seul bloc entièrement en encre pleine hors de la barre d'onglets.
   Ce qu'on **est**. Photo, prénom, âge, et la ligne « Sort à Lyon · Tours ».
2. **Les préférences** — papier assombri, encadrées : le registre du formulaire. Ce qu'on **veut**.
   Elles portent forcément les mêmes contrôles que « Créer » puisque ce sont les mêmes réglages ;
   ce qui les distingue est donc le fond, le cadre, et une phrase qui dit à quoi elles servent.
3. **Ce qu'on a compris** — papier nu, précédé d'une **bande d'encre pleine largeur** portant le
   titre en réserve. Ce qu'on **fait**, mesuré et jamais déclaré.

**L'identité ne change aucune proposition, et c'est assumé** (`lib/identity.ts`). La règle du
projet — ne rien demander qui ne change rien — visait les *questionnaires de goûts*, qui
prétendent servir à quelque chose. Un prénom et une photo ne prétendent à rien : ils font qu'un
écran de réglages devienne un endroit à soi. L'âge n'est aujourd'hui branché sur rien non plus.

**La photo est réduite avant d'être écrite** (320 px, JPEG 0,82, ~25 Ko). Ce n'est pas cosmétique :
`localStorage` plafonne vers 5 Mo et une photo de téléphone en `data:` URI en pèse 4 à 8 — elle
ferait échouer non seulement son propre enregistrement mais **celui des itinéraires et des lieux
visités**, qui partagent le même quota. Recadrage centré carré, sinon les visages s'étirent.

**Les villes de référence remplacent les raccourcis du champ de départ.** Celui-ci proposait les
six communes les plus peuplées de France, c'est-à-dire les villes de tout le monde et de
personne : qui sort à Tours et à Angers n'a que faire de Marseille en un geste. Quatre au plus —
au-delà ce n'est plus une référence mais une liste, et les raccourcis prendraient deux lignes.

**La case est passée au-dessus du champ de départ** (29/08/2026, soir), sur remarque de
l'utilisateur : à sa place initiale — après les curseurs — la ville semblait exclue de « mes
préférences » alors qu'elle en fait partie. Le déplacement l'a **obligée à devenir vraie sur ce
point** : elle renseigne désormais aussi la ville (la première déclarée), faute de quoi elle
surplomberait un champ qu'elle ne touche pas. Elle laisse en revanche le mode — « ce soir » ou
« voyage » tient à l'occasion, pas à un goût. Effet secondaire correct : demander sa position GPS
la décoche, puisqu'on ne part alors plus de ses préférences.

**Deux retouches de composition faites au même moment**, toutes deux signalées à l'œil :
- le sous-titre des préférences était **collé au titre** — Anton posé à `leading-[0.9]` laisse
  très peu d'air sous ses capitales, et l'interlignage serré, juste pour le titre lui-même, ne
  vaut pas pour l'écart au bloc suivant (`gap-1` → `gap-2.5`) ;
- la mention « observé » à droite de la bande d'encre est **supprimée**. Elle ne disait rien que
  le titre ne dise déjà, et un coin droit qui n'informe pas est exactement ce qui avait fait
  retirer les numéros des trois mastheads d'onglet. Pas de pictogramme en remplacement : la bande
  suffit à marquer le changement de chapitre, et le système bannit les emojis.

**Défaut trouvé à l'écran et corrigé** : la case « Partir de mes préférences » s'affichait **déjà
cochée** devant quelqu'un qui n'avait réglé que ses villes. Elle ne mentait pas — le brouillon
suivait bien des préférences par ailleurs neutres — mais elle avait l'air d'un état actif que
cocher ou décocher ne changeait pas. Les villes sont donc sorties de `preferencesUtiles` : elles
sont une préférence, mais elles agissent **ailleurs et toutes seules**, sur les raccourcis. Ce que
la case peut appliquer et ce qui est une préférence ne sont pas la même liste.

**Reste ouvert** : le coaching (« tu n'as jamais rien fait rive droite ») demande quelques dizaines
de points, donc plus tard. Et les goûts n'entrent dans le prompt que par le levier des envies
existant — aucune pondération propre n'a été ajoutée, précisément pour que l'effet reste lisible.

## Points ouverts (non bloquants)

- Fichier vide parasite `CLAUDE` : **supprimé** (27/08/2026)
- Favicon : **fait** (27/08/2026). `app/icon.svg`, aux encres du système — un point de départ et
  un point d'arrivée reliés. Déclaré aussi en `apple` dans les metadata, l'écran d'accueil iOS
  ignorant le SVG
- Le rate limit est en mémoire process : remis à zéro à chaque instance froide en serverless
- Sans proxy devant, toutes les requêtes du réseau local partagent la clé `unknown` : le quota
  est commun au téléphone et au poste de dev. Réglable par `VIBETRIP_RATE_LIMIT` (30 en local)
- La géolocalisation est impossible hors `https`/`localhost` (contexte sécurisé exigé par les
  navigateurs). `LocationInput` le dit explicitement au lieu de rester muet
- **Ne jamais lancer `npm run build` pendant que `next dev` tourne** : le build écrase `.next` et
  le serveur de dev répond alors `missing required error components` sur toutes les requêtes.
  Correctif : `rm -rf .next` puis relancer `npm run dev`
- Le serveur servi au téléphone est désormais la **production** (`npm run build && npm start`),
  pas `next dev` : le mode dev recompile chaque écran à la première visite (15 s mesurées), ce
  qui donnait une impression de lenteur générale. Penser à rebuilder après chaque modification
- Le banc d'essai `scripts/eval-itineraries.mjs` utilise une IP distincte par scénario pour ne pas
  déclencher le rate limit (5/h) — à garder en tête si le quota change. **Adapté au flux NDJSON et
  au multi-propositions le 27/08/2026** : il lisait encore `body.itinerary` au singulier, hérité
  d'avant les propositions multiples. Il reporte désormais le statut de vérification de chaque
  étape, ce qui permet de relire l'effet d'un resserrage des verrous
- Les deux défauts d'écran de réglages relevés le 26/08/2026 sont **corrigés** : les réglages
  survivent au changement d'onglet (`HomeDraft` remonté dans `app/page.tsx`, `HomeScreen` et
  `LocationInput` deviennent contrôlés), et « Ce soir » est présélectionné, le libellé du bouton
  suivant désormais le mode (« Trouver mon week-end », « Trouver mon voyage »)
