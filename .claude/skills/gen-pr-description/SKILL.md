---
name: gen-pr-description
description: Génère une description de pull request en français pour VibeTrip à partir des commits/diff de la branche courante.
---

# Générer une description de PR pour VibeTrip

1. Identifier la base de comparaison (`main` sauf indication contraire) et lister les commits de la branche courante qui n'y sont pas encore (`git log main..HEAD`).
2. Regarder le diff complet (`git diff main...HEAD`), pas seulement les messages de commit, pour ne pas manquer un changement non documenté.
3. Rédiger en français, structuré ainsi :
   - **Résumé** : 1-3 puces sur le "pourquoi" (pas juste la liste des fichiers touchés)
   - **Changements** : regrouper par zone du projet (`app/`, `components/`, `lib/`, `types/`, `docs/`) si plusieurs zones sont touchées
   - **Plan de test** : checklist markdown concrète — si l'app n'est pas exécutable localement (pas de Node.js), renvoyer vers la skill `run` + `check-ui`/`check-mobile-responsive` à faire une fois Node disponible, ou vers StackBlitz
4. Ne jamais inventer un test "effectué" qui n'a pas réellement eu lieu — si la vérification n'a pas pu être faite (contrainte Node.js), le dire explicitement dans le plan de test plutôt que de cocher une case.
5. Ne créer/pousser la PR qu'après confirmation explicite de l'utilisateur (`gh pr create`), jamais de façon proactive.
