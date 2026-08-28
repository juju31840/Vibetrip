# Déployer VibeTrip

**En ligne depuis le 28/08/2026 : https://vibetrip-schuft.vercel.app**

Tout est prêt côté code. Il reste trois commandes et un réglage, dans cet ordre.

## 1. Se connecter

```bash
npx vercel login
```

Ouvre le navigateur. Une seule fois.

## 2. Déclarer les secrets

L'application ne démarrera pas sans eux. **Aucun n'est dans le dépôt**, c'est voulu : ils vivent
dans `.env.local` et `.claude/settings.local.json`, tous deux ignorés par git.

```bash
# Le modèle. Sans lui, aucune génération.
npx vercel env add ANTHROPIC_API_KEY production

# Le fond de carte et le géocodage des villes saisies en toutes lettres.
npx vercel env add NEXT_PUBLIC_MAPBOX_TOKEN production

# Le socle de lieux. Sans lui la génération fonctionne, mais sans ancrage :
# on retombe sur « le modèle propose, on vérifie après coup », soit 52 % au lieu de 89 %.
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production

# Le cron de détection des fermetures (voir plus bas).
npx vercel env add SUPABASE_PROJECT_REF production
npx vercel env add SUPABASE_ACCESS_TOKEN production
npx vercel env add GOOGLE_PLACES_API_KEY production

# Protège l'URL du cron. Sans lui, n'importe qui peut déclencher 150 appels Google facturés.
# Valeur : une chaîne aléatoire, par exemple `openssl rand -hex 32`.
npx vercel env add CRON_SECRET production

# Quota de génération par IP et par heure. 5 par défaut, ce qui est bas pour un
# test entre proches ; 15 est un compromis raisonnable.
npx vercel env add VIBETRIP_RATE_LIMIT production
```

## 3. Déployer

```bash
npx vercel --prod
```

## L'adresse publique n'est pas celle qu'on croit

`vibetrip.vercel.app` **appartient à quelqu'un d'autre** — les sous-domaines `.vercel.app` sont
globaux et celui-ci était pris (un site espagnol). L'adresse du projet est
`vibetrip-schuft.vercel.app`, suffixée du nom d'équipe.

Et par défaut, **Vercel protège toutes les URLs par une authentification** : le site répondait
302 vers une page de connexion, y compris pour l'API. Désactivé dans
*Settings → Deployment Protection → Vercel Authentication*, sans quoi personne d'autre que le
titulaire du compte ne peut ouvrir le site.

## 4. Vérifier

- **La géolocalisation fonctionne enfin.** C'est le gain le plus visible : elle exige un contexte
  sécurisé, donc elle était impossible en HTTP sur le réseau local. Les testeurs devaient saisir
  leur ville à la main.
- **Le cron** apparaît dans *Project → Settings → Cron Jobs*. Il tourne chaque nuit à 4 h sur
  150 lieux (`vercel.json`). Sur le plan Hobby, l'heure exacte n'est pas garantie et un seul cron
  par jour est permis — ce qui suffit.
- **Le quota** s'écrit dans la table `quotas` de Supabase. Vérifier après quelques essais :
  `select cle, jetons from quotas order by recharge_a desc limit 5;`

## Ce à quoi il faut penser

- **Le plan Hobby limite les fonctions à 60 s.** Le mode voyage a été mesuré entre 15 et 25 s,
  donc la marge existe, mais elle n'est pas immense — c'est ce qui a fait passer les propositions
  du mode voyage de 3 à 2.
- **L'application sera publique.** Le plan Hobby n'offre pas de protection par mot de passe.
  Le quota par IP est la seule barrière, d'où son passage en base : en mémoire, chaque instance
  froide repartait à zéro, ce qui revenait à n'avoir aucune limite.
- **Le crédit Anthropic se consomme.** Environ 1,5 centime par soirée générée, 3 pour un voyage.
