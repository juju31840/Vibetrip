---
name: check-places-db
description: Contrôle la santé du socle de lieux VibeTrip dans Supabase — volume, couverture par ville, classement en envies, dérive depuis la dernière mesure. À lancer régulièrement, et systématiquement après un rechargement du référentiel Foursquare.
---

# Contrôler le socle de lieux

Objectif : détecter une dégradation de la base **avant** qu'elle n'atteigne les utilisateurs.
La table `places` est le socle factuel du produit : si elle se vide, se déséquilibre ou se remplit
de bruit, les itinéraires se dégradent sans qu'aucun test ne casse.

Ce contrôle porte sur la **cohérence interne** de la base. Il ne dit pas si les lieux existent
encore dans le monde réel — c'est le travail de la vérification Google, qui est un autre sujet et
un autre budget.

## Comment interroger la base

Le serveur MCP Supabase n'est pas toujours disponible (il lit ses identifiants au démarrage de la
session). L'API de gestion fonctionne toujours :

```bash
curl -s -X POST "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"select count(*) from places;"}'
```

**Piège coûteux, déjà payé** : depuis Python, `urllib` et `requests` reçoivent un `403 Forbidden`
du pare-feu de Supabase à cause du `User-Agent` par défaut (`Python-urllib/3.x`). Poser
`"User-Agent": "vibetrip-loader/1.0"` suffit. Le symptôme fait croire à un problème de SQL ou de
taille de requête — ce n'en est pas un.

## La mesure

Elle s'inscrit **toute seule** chaque nuit à 3 h via `pg_cron` (tâche `sante-quotidienne`) : le
journal se remplit même si personne n'ouvre Claude Code, ce qu'une routine locale ne peut pas
garantir. Ce skill sert donc surtout à **lire et interpréter**, pas à collecter.

Vérifier que la tâche tourne toujours :

```sql
select jobname, schedule, active from cron.job;
select status, start_time from cron.job_run_details order by start_time desc limit 3;
```

1. Au besoin, relever les indicateurs et les inscrire au journal, en une requête :

   ```sql
   insert into sante_journal
   select current_date, * from base_sante
   on conflict (mesure_le) do update set
     lieux = excluded.lieux, sans_theme = excluded.sans_theme,
     communes = excluded.communes, jamais_verifies = excluded.jamais_verifies,
     fermes_detectes = excluded.fermes_detectes, fiches_anciennes = excluded.fiches_anciennes;
   ```

2. Comparer à la mesure précédente :

   ```sql
   select * from sante_journal order by mesure_le desc limit 2;
   ```

## Ce qui doit alerter

| Signal | Seuil | Ce que ça veut dire |
|---|---|---|
| `lieux` baisse | plus de 2 % | Un rechargement a échoué à mi-course, ou un filtre s'est resserré par accident |
| `sans_theme` monte | plus de 5 % du total | La correspondance des catégories Foursquare a cessé de fonctionner — le symptôme est un panneau « Changer » vide, sans message d'erreur |
| `communes` baisse | toute baisse | Une région entière a disparu du chargement |
| Une ville de `lib/cities.ts` | moins de 100 lieux | Cette ville rendra des itinéraires pauvres ou répétitifs |
| Un thème | moins de 3 % des lieux d'une grande ville | Le thème est proposé mais ne rend presque rien |

Requête de couverture par ville, à croiser avec `FRENCH_CITIES` :

**Toujours grouper sur `locality_norm`, jamais sur `locality`.** Le référentiel écrit « Paris »
sous 7 casses différentes et « Aix-en-Provence » sous 10 : sur le champ brut, Paris paraît compter
46 088 lieux au lieu de 50 687, et Aix 744 au lieu de 1 868. Et ne pas agréger côté script non
plus — regrouper en Python sur une clé normalisée **écrase** les variantes au lieu de les
additionner, ce qui a fait afficher « Paris : 1 lieu » et déclencher une fausse alerte.

```sql
select locality_norm, count(*) as lieux,
       count(*) filter (where 'eat'    = any(themes)) as manger,
       count(*) filter (where 'drink'  = any(themes)) as boire,
       count(*) filter (where 'culture'= any(themes)) as culture,
       count(*) filter (where 'outdoor'= any(themes)) as plein_air,
       count(*) filter (where 'night'  = any(themes)) as sortir,
       count(*) filter (where 'shopping'= any(themes)) as boutiques
from places where locality_norm <> ''
group by locality_norm having count(*) > 50 order by lieux desc limit 60;
```

## Le contrôle qui compte vraiment

Les chiffres agrégés peuvent tous être bons alors que la base est inutilisable. Vérifier que des
lieux **nommément connus** sont toujours là, et que les inventions du modèle n'y sont toujours pas.
Ces cas viennent tous de mesures réelles, ils ne sont pas décoratifs :

```sql
select 'Chez Marcelle' as cherche, count(*) from places where name = 'Chez Marcelle' and locality = 'Lyon'
union all select 'Le Nemours',        count(*) from places where name = 'Le Nemours' and locality = 'Paris'
union all select 'Place des Terreaux', count(*) from places where name = 'Place des Terreaux' and locality = 'Lyon'
union all select 'Marché des Capucins', count(*) from places where name = 'Marché des Capucins' and locality = 'Bordeaux'
union all select 'INVENTÉ: Café de la Place Colette', count(*) from places where name ilike '%Café de la Place Colette%'
union all select 'INVENTÉ: Club Pigalle Nights',      count(*) from places where name ilike '%Pigalle Nights%';
```

Les quatre premiers doivent rendre au moins 1. Les deux derniers doivent rendre **0** : s'ils
remontent, c'est qu'une écriture non contrôlée a injecté des lieux produits par un modèle dans le
socle factuel, ce que l'architecture interdit.

## Rendre compte

Un tableau des indicateurs, l'écart avec la mesure précédente, et une phrase de conclusion.
Ne signaler que ce qui a bougé : un rapport où tout va bien doit tenir en trois lignes, sinon il
ne sera plus lu, et c'est le jour où il compte qu'on ne le lira pas.
