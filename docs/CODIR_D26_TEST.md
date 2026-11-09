# DEOS TEST — D26 CODIR

Version publiée uniquement dans le dépôt TEST. La base Supabase reste partagée avec PROD et sert uniquement de source en lecture.

Au premier chargement authentifié, les sept collections distantes sont lues intégralement, les collections complémentaires locales et les documents de transport Priorités/Journal sont repris. Les 13 dossiers deviennent six dossiers CODIR ; sept dossiers thématiques deviennent des projets. Les 47 affectations connues sont conservées par identifiant métier. Un nouveau projet est accepté uniquement si son dossier permet une affectation univoque. Une incohérence arrête la copie sans modifier la source.

La sauvegarde source et la copie migrée restent privées dans le navigateur. Un enregistrement atomique rend la copie utilisable seulement après validation complète. Les éditions TEST suivantes sont conservées au rechargement, sans réimport automatique. Tous les accès métier au stockage passent par la copie indépendante. Les files de synchronisation anciennes ne sont pas réutilisées. Les pilotes cloud ne peuvent ni remplacer la copie ni écrire en base ; le garde réseau bloque également les anciens chemins REST/RPC d’écriture.

Cette copie TEST est propre au navigateur : elle ne synchronise pas les éditions entre PC et iPad. Aucune donnée métier ni export privé n’est publié dans GitHub. Aucun changement de PROD.

Vérifications : `npm ci --ignore-scripts && npm test`. Tests de migration, intégrité des liens, archives, historique, réexécution, nouveaux projets, concurrence au démarrage, quota, absence de modification source et navigation de l’application complète dans un DOM de test.

## Correctif D26.2

D26 pouvait présenter une copie vide si une lecture distante échouait avant l’import. La copie complète et la sauvegarde pouvaient également dépasser le quota localStorage. D26.2 charge d’abord le cache d’origine intact, puis réorganise cette copie avant l’authentification distante. Les données de travail et leur sauvegarde sont conservées dans une transaction IndexedDB, sans dupliquer les gros imports dans localStorage. Le lanceur attend que le stockage soit prêt avant de démarrer les dépôts synchrones de l’application.

Régressions testées : ancien espace D26 vide mais non validé, toutes les lectures distantes en échec, quota localStorage simulé, copie supérieure à 6 Mo, persistance au rechargement et ordre de démarrage du lanceur. Validation locale supplémentaire sur une copie privée de la sauvegarde de travail, absente du dépôt public.
