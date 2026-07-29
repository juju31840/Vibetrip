# Prompt engineering notes — relecture critique de lib/prompt.ts

Document de conception (recommandations textuelles, pas de code). Relit `lib/prompt.ts` au regard
du contrat Zod (`lib/itinerary-schema.ts`), du flux de retry (`lib/claude.ts`) et du filtrage
géographique (`lib/geo.ts`).

---

## 1. Constat général

Le prompt actuel est court, clair, et s'appuie sur le structured output (`zodOutputFormat`) pour
garantir la forme JSON — c'est la bonne approche de base : la génération est *déjà* contrainte au
niveau du schéma, donc `PARSE_ERROR` ne devrait en théorie se produire que dans des cas limites
(refus de répondre, contenu qui ne peut pas être forcé dans le schéma, erreur de structured output
côté SDK). Le prompt actuel se concentre donc sur la *qualité sémantique* du contenu plutôt que sur
sa forme — ce qui est cohérent. Les points ci-dessous visent à réduire le résiduel de
`PARSE_ERROR`/incohérences et à améliorer la qualité perçue sans toucher au schéma Zod lui-même
(sauf mention explicite).

---

## 2. Few-shot examples — absents actuellement

`buildSystemPrompt()` et `buildUserPrompt()` ne contiennent aucun exemple de sortie attendue. Pour
un structured output avec schéma Zod, Claude Sonnet respecte déjà la forme JSON de façon fiable,
mais les few-shot restent utiles pour deux choses que le schéma ne peut pas exprimer :

1. **Le ton/niveau de détail des descriptions** — le schéma impose juste `description: z.string().min(1)`,
   aucune borne de longueur ni de style. Un exemple ancre "1 à 2 phrases, concrètes, pas de blabla
   marketing" mieux qu'une instruction textuelle seule.
2. **La cohérence day/period entre étapes** — rien n'empêche Claude de mettre deux étapes `day: 1,
   period: "evening"` et zéro étape `morning`/`midday`, ou de dupliquer les périodes. Un exemple
   complet pour un mode donné (ex. un mini-itinéraire "weekend" à 2 jours × 3 périodes) illustre la
   structure attendue bien plus efficacement qu'une phrase comme "au moins une étape par période
   pertinente" (formulation actuelle, ligne 63, qui est d'ailleurs elle-même ambiguë : que veut dire
   "pertinente" ? un jour de weekend sans étape *evening* est-il valide ?).

**Recommandation concrète** : ajouter, dans `buildUserPrompt`, un court exemple *par mode* (pas un
mega-exemple générique) sous la forme d'un extrait JSON minimal (2-3 étapes) précédé de "Exemple de
structure attendue (contenu fictif, à adapter à la demande réelle) :". Garder l'exemple très court
pour ne pas gonfler inutilement le prompt ni biaiser le contenu généré vers l'exemple lui-même
(risque connu du few-shot : Claude peut recopier des noms de lieux de l'exemple si celui-ci est trop
proche du cas réel — donc utiliser une ville fictive ou clairement différente de toutes les villes
réelles plausibles, ex. "Ville-Exemple").

---

## 3. Sémantique de "Distance" — imprécise et sans lien avec le filtrage serveur

C'est le point le plus important identifié. `DISTANCE_HINTS` (lignes 9-16) donne une description
qualitative par mode, mais :

- Elle ne fixe **aucune borne numérique explicite** ("quelques kilomètres", "plusieurs dizaines de
  kilomètres", "plusieurs villes/régions" — tout est laissé à l'interprétation de Claude).
- Elle est totalement déconnectée du rayon de plausibilité réellement appliqué côté serveur
  (`PLAUSIBILITY_RADIUS_KM` dans `lib/geo.ts` : 30/50/400 km selon le mode, **fixe, indépendant du
  curseur Distance**). Concrètement : un utilisateur qui met Distance à 0 en mode Tonight ("à pied")
  peut recevoir une proposition à 25 km (parce que rien dans le prompt n'interdit à Claude de
  proposer loin même si le curseur dit "proche"), et cette proposition à 25 km passera le filtre
  serveur sans problème puisque le filtre ne regarde que le mode, pas le curseur.

**Recommandation concrète** : donner des bornes numériques explicites et cohérentes avec
`PLAUSIBILITY_RADIUS_KM`, par exemple :

> Tonight : "0 = tout à pied (moins de 1,5 km du point de départ), 50 = quelques stations de
> transport (jusqu'à 8 km), 100 = jusqu'à 20 km en transport. Ne dépasse jamais 25 km."
>
> Weekend : "0 = rester dans le même quartier/ville (moins de 5 km), 50 = excursions à 15-25 km,
> 100 = jusqu'à 45 km. Ne dépasse jamais 45 km."
>
> Trip : "0 = une seule ville (rayon 10 km), 50 = une région (jusqu'à 150 km entre étapes), 100 =
> plusieurs villes/régions (jusqu'à 350 km entre étapes). Ne dépasse jamais 380 km."

Les bornes hautes proposées restent **strictement sous** le rayon de plausibilité serveur (30/50/400)
avec une marge de sécurité, pour que le prompt guide Claude à rester naturellement dans une zone que
le filtre post-génération ne rejettera pas — réduisant ainsi le risque du point ouvert #1 du document
`user-flows.md` (0 étape plausible après filtrage). C'est un exemple de "défense en profondeur" :
le prompt vise une cible plus stricte que le filtre serveur, pour absorber la marge d'erreur de
Claude sans jamais dépendre uniquement du filtre.

De plus, faire varier le rayon de plausibilité serveur *en fonction du curseur Distance lui-même*
(et pas seulement du mode) serait cohérent à évaluer côté implémentation future — mais cela dépasse
le périmètre "prompt uniquement" de ce document ; à noter comme piste croisée avec `lib/geo.ts`.

---

## 4. Renforcement de la contrainte de langue française

Actuel : une seule phrase dans le system prompt, "Toutes les chaînes de caractères (tripName,
description, placeName) doivent être rédigées en français." C'est correct mais fragile sur deux
points :

1. **Les noms de lieux réels** (`placeName`) posent un cas ambigu : un lieu réel s'appelle souvent
   dans sa langue d'origine (ex. "Sagrada Família" à Barcelone, "British Museum" à Londres). La
   consigne actuelle pourrait pousser Claude à traduire artificiellement des noms propres réels
   ("Musée Britannique" au lieu de "British Museum"), ce qui serait une erreur factuelle gênante.
   **Recommandation** : préciser explicitement l'exception — "sauf placeName lorsqu'il s'agit du nom
   propre officiel d'un lieu réel existant, qui doit rester dans sa forme originale (ex. 'British
   Museum', pas 'Musée Britannique')."
2. **Renforcement par répétition/positionnement** : les modèles suivent généralement mieux une
   contrainte de langue répétée à la fois en system prompt ET rappelée brièvement dans le user
   prompt (surtout utile si le point de départ est une ville non francophone, ce qui pourrait
   inciter le modèle à "glisser" vers l'anglais pour les descriptions). Ajouter une ligne dans
   `buildUserPrompt` du type "Rappel : réponds uniquement en français, y compris si le point de
   départ est situé dans un pays non francophone."
3. **Cas retry** : le prompt de retry (`lib/claude.ts` ligne 17) ne répète que la consigne de format
   JSON, pas la consigne de langue. Si l'échec de la première tentative venait d'un mélange de
   langues plutôt que d'un JSON malformé (peu probable avec structured output mais possible si le
   contenu textuel dérive), le retry ne le corrigerait pas explicitement. Prévoir de garder la
   consigne de langue dans le prompt de retry également (actuellement elle l'est indirectement car
   `buildSystemPrompt()` de base est concaténé, donc ce point est déjà correctement couvert — à
   vérifier si le prompt de retry est un jour raccourci pour économiser des tokens, ne pas perdre
   cette phrase dans ce cas).

---

## 5. Nombre de jours en mode "trip" — actuellement libre entre 3 et 6, à revoir

Ligne 6 de `lib/prompt.ts` : `"un voyage de plusieurs jours (entre 3 et 6 jours, à toi de choisir
une durée cohérente)"`. Analyse :

- **Problème** : "à toi de choisir une durée cohérente" est une instruction vague — cohérente par
  rapport à quoi ? Rien dans le prompt ne donne à Claude de signal sur lequel baser ce choix (budget ?
  ambiance ? distance ? aucune corrélation logique évidente entre ces curseurs et une durée de séjour).
  En pratique, Claude va probablement choisir une valeur par défaut assez stable (ex. toujours 4 ou 5
  jours) plutôt que de vraiment varier selon la demande — ce qui rend le "entre 3 et 6, à toi de
  choisir" plus un facteur d'aléa non maîtrisé qu'un vrai levier produit.
- **Comparaison avec Tonight/Weekend** : ces deux modes ont une durée *fixe et déterministe* (1 jour,
  2 jours) directement dans le libellé. Le mode Trip est le seul avec une durée non déterministe,
  ce qui casse la prévisibilité du produit (l'utilisateur ne sait pas à l'avance si son "Trip" fera
  3 ou 6 jours avant de voir le résultat) et complique le test/QA (une génération pour les mêmes
  curseurs peut produire des itinéraires de longueurs différentes d'un run à l'autre).
- **Recommandation n°1 (préférée)** : exposer un contrôle explicite à l'utilisateur pour le nombre de
  jours en mode Trip (ex. un sélecteur 3/4/5/6 jours dans `HomeScreen`, à ajouter à
  `GenerateItineraryRequest` — extension mineure du contrat, hors périmètre de cette mission mais à
  noter). Le prompt deviendrait alors déterministe : "un voyage de {N} jours", exactement comme
  Tonight/Weekend. Cela supprime l'aléa et améliore la prévisibilité perçue par l'utilisateur.
- **Recommandation n°2 (sans toucher au contrat de données)** : si on préfère garder le choix "intelligent"
  côté IA pour le MVP, au moins **corréler explicitement la durée à un des curseurs existants** plutôt
  que de la laisser arbitraire — par exemple indexer la durée sur le curseur Distance ("Distance
  faible → privilégie un trip court de 3 jours en une seule ville ; Distance élevée → un trip de 5-6
  jours pour couvrir plusieurs villes"). Ça donne un sens produit au choix et rend le comportement
  reproductible/explicable, sans ajouter de champ au formulaire.
- Dans les deux cas, il faudrait aussi supprimer l'ambiguïté du texte "à toi de choisir une durée
  cohérente" qui n'apporte aucun signal actionnable au modèle en l'état.

---

## 6. Réduire le taux d'échec de parsing en amont plutôt que compter sur le retry

Le retry actuel (`lib/claude.ts`) est un filet de sécurité binaire : une tentative, un retry
identique (avec juste une phrase ajoutée au system prompt), puis abandon (`PARSE_ERROR`, 502). Pistes
pour réduire le besoin de ce filet plutôt que d'en dépendre :

1. **Contraintes de longueur explicites dans le prompt**, même si le schéma Zod ne les impose pas
   (`description: z.string().min(1)` n'a pas de max). Une description sans limite haute augmente le
   risque que Claude génère un texte très long, plus product-unfriendly (mauvais dans une bottom
   sheet mobile) sans que ce soit un problème de *parsing* au sens strict — mais ça reste un problème
   de qualité qu'un prompt plus précis peut prévenir. Suggestion : "1 à 2 phrases, 25 mots maximum
   par description."
2. **Nommer explicitement les valeurs interdites/pièges** pour `type` (`placeType`) : le prompt dit
   juste "Choisis un type cohérent... parmi la liste imposée par le schéma" (ligne 64) sans lister
   les 12 valeurs possibles dans le prompt lui-même. Avec le structured output, Claude a accès au
   schéma de toute façon (contrainte au niveau de l'API), donc ce n'est pas un risque de parsing —
   mais lister les types dans le texte humain du prompt aide Claude à mieux choisir sémantiquement
   (ex. n'utiliser `"other"` qu'en dernier recours), ce qui est un problème de qualité, pas de forme.
3. **Prompt de retry plus spécifique que "corrige et renvoie le JSON"** : actuellement le retry ne
   dit pas *ce qui a échoué*. Si l'erreur de structured output remontait un message (à vérifier côté
   SDK Anthropic si `response.parsed_output` vide s'accompagne d'un message d'erreur exploitable), on
   pourrait l'injecter dans le prompt de retry pour un feedback ciblé plutôt qu'une simple répétition
   de la demande initiale. À creuser techniquement (dépend de ce qu'expose
   `@anthropic-ai/sdk/helpers/zod` en cas d'échec de parse) — piste, pas une certitude d'implémentation.
4. **Réduire la surface d'erreur du côté "location"** : `describeLocation` (ligne 24-29) formatte
   soit une ville, soit des coordonnées avec 4 décimales. Rien à changer ici a priori — ce n'est pas
   une source de parsing error, mais une source potentielle d'hallucination géographique. **Mis à
   jour** : `route.ts` géocode désormais la ville via `lib/geocode.ts` avant filtrage, donc le
   `referencePoint` numérique existe aussi pour ce chemin (voir `user-flows.md` §5.1) — le filtre
   serveur peut donc vérifier ce cas quand le géocodage réussit. Reste une piste liée au prompt :
   demander explicitement à Claude de rester cohérent avec la ville nommée, en complément du
   filtrage serveur plutôt qu'à sa place.
5. **Monitoring qualitatif** : ce document ne peut pas mesurer un "taux d'échec de parsing" réel (pas
   d'exécution possible sur cette machine), mais recommande d'instrumenter `ItineraryParseError` (ex.
   compteur/log structuré côté serveur) dès que l'environnement de test sera disponible, pour
   objectiver si les recommandations ci-dessus réduisent effectivement la fréquence de retry/échec.

---

## 7. Autres remarques mineures

- `describeLevel` (ligne 18-22) traite Budget/Ambiance avec les mêmes seuils (33/66) que
  potentiellement Distance si elle passait par la même fonction — actuellement Distance n'utilise
  pas `describeLevel` du tout (elle passe juste la valeur brute + `DISTANCE_HINTS`), ce qui est une
  incohérence de traitement entre les 3 curseurs dans le code (Budget/Ambiance sont qualifiés via
  `describeLevel`, Distance ne l'est pas). Ce n'est pas un bug, mais une incohérence stylistique dans
  le prompt final envoyé à Claude — à uniformiser si on ajoute des bornes numériques à Distance (§3),
  ce qui rendrait de toute façon `describeLevel` obsolète pour ce curseur.
- Le system prompt (ligne 37) mentionne déjà "sans que cela soit justifié par le mode 'trip'" pour la
  cohérence géographique — bon réflexe déjà présent, cohérent avec la recommandation du §3 de fixer
  des bornes chiffrées.
