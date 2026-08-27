---
name: verify-places-google
description: Vérifie contre Google Places qu'un lot de lieux du socle existe toujours, et écrit le verdict en base. Budgété — la vérification exhaustive coûterait plus de 10 000 $ par passage. À lancer quotidiennement sur une file priorisée.
---

# Vérifier les lieux contre Google

Objectif : détecter les lieux **fermés**, ce qu'aucune source interne ne sait dire. C'est le défaut
qui a motivé tout le socle : « Le Baron » avait des coordonnées exactes, un nom exact, et avait
fermé depuis des années — Mapbox le confirmait sans hésiter.

## Deux règles non négociables

**1. On stocke un verdict, jamais du contenu.** Les conditions d'utilisation de Google Places
n'autorisent à conserver indéfiniment que le `place_id`. Le nom, l'adresse, les horaires et la note
doivent être demandés en direct et ne peuvent pas être mis en base. Les colonnes autorisées sont
donc exactement celles-ci, et aucune autre ne doit être ajoutée :

- `google_place_id` — l'identifiant, stockable sans limite
- `google_checked_at` — la date de notre vérification
- `google_status` — notre conclusion : `exists`, `closed` ou `not_found`

Écrire un nom ou une adresse venus de Google dans `places` serait un manquement contractuel, pas
une approximation.

**2. Le budget commande le volume.** Le Text Search coûte **32 $ pour 1 000 appels**, avec
**5 000 appels gratuits par mois**. Vérifier les 575 206 lieux du socle coûterait environ
**18 400 $ par passage**. La vérification exhaustive est donc exclue, définitivement, et aucune
optimisation ne la rendra possible.

| Rythme | Appels / mois | Coût mensuel |
|---|---|---|
| 150 lieux / jour | 4 500 | **0 $** — dans le quota gratuit |
| 500 lieux / jour | 15 000 | ~320 $ |
| 1 000 lieux / jour | 30 000 | ~800 $ |

Sauf instruction contraire, **s'en tenir à 150 par passage**.

## La file : quoi vérifier en premier

Un lieu que personne ne s'est vu proposer n'a pas besoin d'être frais. L'ordre est donc :

```sql
select fsq_id, name, address, locality,
       ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
from places
where google_checked_at is null
   or google_checked_at < now() - interval '180 days'
order by proposed_count desc,                       -- ce qui est réellement servi d'abord
         (refreshed_at < date '2022-01-01') desc,    -- puis les fiches les plus douteuses
         google_checked_at nulls first
limit 150;
```

## Interroger Google

Text Search (New), en limitant le masque de champs au strict nécessaire — demander les horaires ou
les avis reclasse l'appel en tarif supérieur :

```bash
curl -s -X POST 'https://places.googleapis.com/v1/places:searchText' \
  -H "X-Goog-Api-Key: $GOOGLE_PLACES_API_KEY" \
  -H 'X-Goog-FieldMask: places.id,places.location,places.businessStatus' \
  -H 'Content-Type: application/json' \
  -d '{"textQuery":"<nom> <adresse>","locationBias":{"circle":{"center":{"latitude":<lat>,"longitude":<lng>},"radius":500.0}},"languageCode":"fr","maxResultCount":1}'
```

## Décider

`locationBias` est un **biais, pas un filtre** — c'est exactement le piège déjà payé sur Mapbox, où
« Le Bar Fleuri » cherché à Lyon renvoyait un vrai Bar Fleuri à Paris, à 390 km. Google renvoie
presque toujours quelque chose. La décision se prend donc comme dans `lib/place-match.ts` :

1. **Distance** — le résultat doit être à moins de **300 m** du point stocké. Au-delà, `not_found`.
2. **Nom** — réutiliser `lib/place-match.ts`, module pur et testé, plutôt que de réécrire une
   comparaison approximative. Il porte cinq verrous établis sur des faux positifs réels.
3. **Statut** — `businessStatus` valant `CLOSED_PERMANENTLY` donne `closed`. `OPERATIONAL` donne
   `exists`.

Puis écrire le verdict, en un seul aller-retour :

```sql
update places set google_place_id = v.gid, google_status = v.st, google_checked_at = now()
from (values ('<fsq_id>', '<place_id>', 'exists')) as v(id, gid, st)
where places.fsq_id = v.id;
```

Rappel du piège d'accès : depuis Python, poser un `User-Agent` explicite sur les appels à l'API de
gestion Supabase, sinon le pare-feu répond `403 Forbidden` sur des requêtes pourtant valides.

## Le script

`npm run verify:google -- [--lot 150] [--sec]` — `--sec` liste la file et le coût sans appeler.
`TRACE=1` affiche la décision candidat par candidat, ce qui est la seule façon rapide de
comprendre un taux de rejet anormal.

**Deux réglages appris en le mettant au point :**

- **Cinq candidats, pas un.** Avec un seul résultat, « Place Gambetta » et « Théâtre du Capitole »
  étaient déclarés introuvables — le moteur les classait deuxième. C'est la leçon déjà consignée
  pour Mapbox. Le tarif est à l'appel, pas au résultat.
- **Un verrou de proximité en plus du verrou de noms.** `place-match` est calibré pour Mapbox, où
  le danger est de confirmer « Le Baron » par « Le Baron Rouge ». Google met la raison sociale
  complète dans le nom — « Horace » devient « HORACE café.cuisine.canons » — et le verrou strict
  rejetait 62 % de lieux pourtant réels. En dessous de **60 m**, il suffit donc que tous les mots
  distinctifs du nom d'origine se retrouvent dans le nom Google : la géographie lève l'ambiguïté
  que le nom ne lève pas. Ce qui écarte toujours une reprise sous une autre enseigne
  (« Codebar » devenu « Buster », à 8 m : rejeté).

## Rendre compte

Trois nombres — vérifiés, confirmés ouverts, détectés fermés — puis **la liste nominative des
lieux passés à `closed`**. C'est la seule partie du rapport qui demande une action : ces lieux sont
peut-être déjà dans des itinéraires enregistrés, et quelqu'un peut être en train de s'y rendre.

Ne pas supprimer un lieu fermé : le marquer suffit. La suppression ferait disparaître son historique
et il reviendrait au prochain chargement du référentiel.
