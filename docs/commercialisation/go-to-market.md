# Go-to-market — VibeTrip

*Notes de lancement, angle business. Le détail technique de l'affiliation/premium/paiement est traité séparément dans `docs/conception/roadmap-v2.md` — ce document reste volontairement synthétique sur la monétisation.*

## Objectif de cette phase

Pas de budget pub, pas de nom de domaine ni de présence publique pour l'instant. L'enjeu : valider que le produit résout un vrai problème pour un petit groupe d'utilisateurs francophones, avant tout investissement marketing.

## Canaux envisageables pour les premiers utilisateurs

- **Product Hunt** : bon canal pour une visibilité ponctuelle et du feedback produit qualifié, mais audience très anglophone et "early adopter tech" — utile pour du signal, pas pour valider l'audience cible francophone grand public. À viser une fois le MVP stable, pas en tout premier.
- **TikTok / Instagram Reels — courtes démos** : format le plus adapté au produit lui-même (curseurs → itinéraire en quelques secondes, très visuel, mobile). Angle possible : "je règle 3 curseurs et l'IA me sort un plan de soirée" en écran-cast. C'est probablement le canal le plus prometteur vu le format du produit.
- **Communautés voyage/sortie francophones** : r/voyage, r/france, r/Paris (et équivalents villes : Lyon, Marseille, Bruxelles, Montréal), groupes Facebook "sorties [ville]", Discord de groupes d'amis/expat. Attention à ne pas faire de promo brute — privilégier un post "j'ai construit ce petit outil, dites-moi si ça vous sert" avec démonstration concrète plutôt qu'un lien sec.
- **Bouche-à-oreille dans l'entourage proche** : premier cercle (amis, collègues, famille) pour un test à froid avant tout post public — permet de corriger les frictions évidentes sans exposition publique.
- **Threads/X et LinkedIn "build in public"** : utile en solo-dev pour documenter la construction du produit et créer un petit noyau de curieux qui suivront le lancement. Moins pour l'acquisition directe que pour construire une liste d'attente.

## Idées concrètes pour les tout premiers utilisateurs (sans budget)

1. **Vidéo démo courte (15-30s) filmée à l'écran** montrant le parcours complet : curseurs → génération → carte/timeline. C'est l'asset le plus réutilisable (TikTok, Instagram, Reddit, Product Hunt, futurs posts LinkedIn).
2. **Test "concierge" manuel avant l'outil public** : proposer à 5-10 personnes de l'entourage de dire "j'ai un vendredi soir libre à [ville], budget X" et leur envoyer l'itinéraire généré par l'app en DM — permet de valider la pertinence des itinéraires sans encore exposer l'app elle-même.
3. **Liste d'attente / accès anticipé** : une simple page ou formulaire ("VibeTrip arrive, laisse ton email pour tester en premier") à partager dans les cercles ciblés, pour construire une base avant le lancement public.
4. **Cibler un événement récurrent local** : ex. proposer des "vibes" autour d'un moment précis (rentrée, Saint-Valentin, pont de mai, fêtes de fin d'année) pour avoir un angle de post concret plutôt qu'un lancement générique.
5. **Partenariat informel avec micro-créateurs voyage/lifestyle francophones** : contacter 2-3 créateurs à petite audience (5-20k abonnés) pour un accès gratuit en échange d'un retour honnête ou d'une story — moins cher et plus crédible qu'une pub, à condition de rester sincère sur le stade "MVP".
6. **Réutiliser le mode Tonight comme produit d'appel** : plus simple à démontrer en une vidéo de 15s qu'un voyage complet, et répond à un besoin plus fréquent (tous les vendredis soirs) donc plus de occasions de rebond/partage.

## Pistes de monétisation future (angle business, synthèse)

- **Modèle freemium** : usage gratuit limité (ex. nombre de générations d'itinéraires par mois) puis palier payant pour un usage illimité ou des fonctionnalités avancées (sauvegarde, partage collaboratif, régénération illimitée).
- **Affiliation** sur les éléments réservables de l'itinéraire (hôtels, activités, transport) une fois le produit stabilisé — revenu par transaction plutôt que par abonnement, aligné avec un usage encore irrégulier en phase de lancement.
- **Abonnement Premium** pour les usages collaboratifs (groupe d'amis qui planifie ensemble un week-end/voyage) plutôt que pour l'utilisateur solo — le collaboratif justifie mieux un prix récurrent.
- **Séquencement suggéré** : ne rien monétiser tant que la rétention et la fréquence d'usage organique ne sont pas confirmées sur un noyau d'utilisateurs ; l'affiliation est probablement le premier levier à activer (revenu passif, ne change pas l'expérience gratuite) avant un abonnement premium plus structurant.

*(Le détail des mécanismes techniques d'affiliation/paiement est hors périmètre de ce document — voir `docs/conception/roadmap-v2.md`.)*
