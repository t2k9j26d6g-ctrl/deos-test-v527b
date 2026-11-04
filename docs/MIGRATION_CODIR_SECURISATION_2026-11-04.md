# Migration CODIR — garde-fous et validation (04/11/2026)

Statut : **préparation uniquement, AUCUNE écriture métier**. Branche isolée du TEST. TEST et PROD partagent Supabase : ne jamais exécuter une mutation distante depuis TEST.

## Source et résultat de simulation
- Sauvegarde locale DEOS du 04/11/2026 13:38:18Z (à conserver hors GitHub ; données internes).
- 13 dossiers => 6 ; 47 projets => 54 ; 21 actions et 7 décisions inchangées.
- 7 dossiers thématiques convertis en projets, identifiants des 6 dossiers conservés inchangés.
- La simulation est NON IMPORTABLE. Aucun import direct.

## Préconditions bloquantes
1. Inventorier les données **distantes** actuelles, pas seulement le localStorage exporté.
2. Sauvegarder les tables distantes et leurs relations, horodatage et identifiants, avec restauration testée.
3. Comparer les versions et compter les enregistrements ; stopper en cas de divergence.
4. Examiner la logique réelle de synchronisation, les suppressions et les références croisées.
5. Construire une migration transactionnelle et idempotente, sans suppression destructive, avec journal et rollback.
6. Réaliser un dry-run isolé sans connexion d'écriture à Supabase, puis un test en environnement distinct.
7. Demander une confirmation explicite avant mutation PROD ; contrôler les compteurs après migration.

## Organisation cible
Direction ; Exploitation ; RH ; RMPQ (méthodes, processus, qualité et sécurité alimentaire) ; RAMSES / Moyens généraux ; Contrôle de gestion.

## Règles
- Ne pas exposer ni committer l'export métier dans un dépôt.
- Ne pas changer la configuration Supabase en PROD.
- Ne pas utiliser le bouton de restauration de l'application pour appliquer la simulation.
- Aucun test destructif sur TEST tant que le backend reste partagé.
