---
name: gen-changelog
description: Génère une entrée de changelog en français pour VibeTrip à partir de l'historique de commits depuis la dernière entrée.
---

# Générer un changelog pour VibeTrip

1. Repérer le dernier point de repère connu (dernière entrée de `CHANGELOG.md` si le fichier existe, sinon tout l'historique `git log`).
2. Lister les commits depuis ce point (`git log <ref>..HEAD --oneline`) et lire leur diff si le message seul est ambigu.
3. Classer chaque commit en catégories claires : Ajouts, Corrections, Documentation, Interne (refacto/config) — ignorer les catégories vides.
4. Rédiger des entrées orientées utilisateur/lecteur du projet (ce qui a changé et pourquoi ça compte), pas une paraphrase du message de commit.
5. Proposer l'entrée à l'utilisateur avant de créer ou modifier `CHANGELOG.md` — ne jamais écrire ce fichier sans validation, et ne jamais commit/push de façon proactive.
