# Validation D25P — points bloquants (05/11/2026)

Analyse hors ligne de la sauvegarde du 04/11 et du code D25P (normalisation des projets). **Aucune écriture Supabase.**

La simulation 13 dossiers → 6 et 47 projets → 54 ne suffit pas pour la mise en production.

## Anomalies identifiées
- 13 anomalies de schéma ou de liens dans le résultat simulé (dont doublons de linkedFolders et champs de dossiers non transposés).
- 8 avertissements sémantiques : remplacer le lien à un ancien dossier thématique par un lien au dossier CODIR fait perdre l'association explicite au thème initial.
- Certains champs d'un dossier source (notamment expectedResults, tags, directorNotes et category) ne sont pas transposés en champs projet valides.
- Le code D25P normalise les projets avec objective, owner, linkedManagers, linkedFolders, milestones, linkedActions, linkedDecisions, linkedDocuments, events, directorNotes ; il faut respecter les types attendus.

## Suite technique obligatoire
1. Modèle de conversion sans perte : conserver la fiche source et ses attributs métier dans un champ/objet de provenance ; préserver l'association thématique par relation explicite vers le projet converti.
2. Dédupliquer les identifiants de dossiers après remappage.
3. Valider les relations de toutes les collections et les types de champs.
4. Comparer les données actuelles de Supabase avec l'export local ; disposer d'une sauvegarde distante et d'un rollback testé.
5. Tester sur une base réellement séparée ; TEST et PROD actuels partagent le même backend.

**Décision : migration en ligne BLOQUÉE tant que ces prérequis ne sont pas satisfaits.** Ne pas importer la simulation locale.
