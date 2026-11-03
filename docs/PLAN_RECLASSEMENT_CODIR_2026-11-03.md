# DEOS — Plan de reclassement CODIR (proposition, sans migration de données)
Date : 2026-11-03. Source : captures d'écran PROD communiquées par l'utilisateur.
Statut : préparation uniquement ; aucun dossier, projet, action ou décision n'a été modifié.
Attention : TEST et PROD utilisent le même projet Supabase ; ne pas automatiser de mutation avant sauvegarde exportée et inventaire des identifiants/rattachements.

## Six dossiers durables cibles
- Direction — stratégie, CODIR, projets transversaux, relations institutionnelles.
- Exploitation — réception, préparation, expédition, organisation opérationnelle, performance.
- RH — effectifs, recrutement, absentéisme, relations sociales, formation.
- RMPQ — méthodes, processus, amélioration continue, qualité opérationnelle, sécurité alimentaire.
- RAMSES / Moyens généraux — infrastructures, maintenance, équipements, prestataires, sécurité/sûreté du site.
- Contrôle de gestion — budgets, coûts, GPO, IPO, heures indirectes et analyses économiques.

## Correspondance initiale (à valider par inventaire des éléments réels)
| Dossier actuel | Cible proposée | Nature | Remarques |
|---|---|---|---|
| Adaptation des effectifs et recours à l'intérim | RH | Projet transversal RH/Exploitation | Conserver responsable opérationnel et sous-actions. |
| IPO | Direction | Projet de performance transversal | Contrôle de gestion contributeur ; rattachement final selon porteur. |
| Productivité | Exploitation | Programme / projet | RMPQ contributeur méthodes. |
| Qualité | RMPQ | Domaine / regroupement | Ne pas supprimer tant que les 5 éléments ne sont pas reclassés. |
| Contrôle Gestion | Contrôle de gestion | Dossier permanent | Normaliser la casse du titre seulement. |
| Exploitation | Exploitation | Dossier permanent | Conserver 33 éléments et leurs relations. |
| Infrastructure | RAMSES / Moyens généraux | Domaine / projet(s) | Examiner les 9 éléments avant conversion. |
| DE | Direction | Dossier permanent | Conserver 4 éléments. |
| Réduction des heures de polyvalence | Exploitation | Projet | Trois éléments à préserver ; RH et contrôle de gestion contributeurs. |
| RH | RH | Dossier permanent | Conserver 5 éléments. |
| Gestion des pointages 099 et des temps improductifs | Exploitation | Projet | Contrôle de gestion contributeur. |
| Réduction casse / non-livrés / litiges magasins | RMPQ | Projet | Exploitation contributeur. |
| Mise en place de tables rondes | Direction | Projet court ou action | Déterminer après lecture des 4 éléments. |

## Procédure de migration sûre (non exécutée)
1. Exporter une sauvegarde complète des données métier et des métadonnées de synchronisation, avec date, identifiants et relations ; ne pas se contenter d'une sauvegarde du code GitHub.
2. Inventorier les dossiers et enfants réels par identifiant, y compris projets, actions, décisions, documents, historiques et liens ; vérifier les doublons.
3. Produire une table de correspondance ID source -> ID cible et un rapport d'impact par élément ; résoudre les cas ambigus.
4. Effectuer un essai sur une copie isolée des données, jamais sur la base Supabase partagée TEST/PROD.
5. Vérifier nombre d'objets avant/après, intégrité des références et absence de suppression ; prévoir un retour arrière vérifié.
6. Appliquer en production uniquement après contrôle et validation explicite du plan de reclassement des données réelles.

## Interface
La barre latérale TEST est déjà ordonnée : Dossiers, Projets, Actions, Décisions. Publication PROD distincte et non effectuée.
