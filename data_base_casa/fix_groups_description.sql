-- ============================================================
-- TOUPTI GYM CASA - FIX: groups.description (Groupes in "Créer un Abonnement")
-- ============================================================
-- PROBLEM
--   In "Créer un Abonnement" → "3. Activités, Groupes & Cours",
--   activités show but Groupes/Cours do NOT, because groups.description
--   (a JSON array of the group names for each activité) was never filled
--   by the original import.
-- SOLUTION
--   This script sets groups.description for every imported activité.
--   It matches by name and is safe to re-run.
-- ============================================================

UPDATE groups SET description = '["PISCINE 1", "PISCINE 2"]' WHERE name = 'ABSENCES';
UPDATE groups SET description = '["DRAGONS", "KOALAS", "TIGRES"]' WHERE name = 'ARTS MARTIAUX';
UPDATE groups SET description = '["RDV EN BINÔME", "RDV INDIVIDUEL"]' WHERE name = 'BABY SPA';
UPDATE groups SET description = '["KANGOUROUS"]' WHERE name = 'BASKETBALL';
UPDATE groups SET description = '["COCCINELLES", "PAPILLONS"]' WHERE name = 'DANSE CLASSIQUE';
UPDATE groups SET description = '["GUÊPARDS", "LIONS"]' WHERE name = 'FOOTBALL';
UPDATE groups SET description = '["P''TITES CANAILLES", "P''TITES FRIPOUILLES", "P''TITS FILOUS", "TOUP''TI POUSS/MOUSS"]' WHERE name = 'GYMNASTIQUE 1';
UPDATE groups SET description = '["GRANDS MALINS", "MALINS", "VOLTIGEURS DÉBUTANT"]' WHERE name = 'GYMNASTIQUE 2';
UPDATE groups SET description = '["OURS", "TAUREAUX"]' WHERE name = 'KICK-BOXING';
UPDATE groups SET description = '[]' WHERE name = 'KUNG FU';
UPDATE groups SET description = '["CANARDS", "CYCLE DE NATATION", "GRENOUILLES", "SUPER TÊTARDS", "TÊTARDS"]' WHERE name = 'NATATION';
UPDATE groups SET description = '["BALEINES", "CORADIONS JUNIOR", "CORADIONS SENIOR", "CYCLE DE NATATION", "DAUPHINS", "REQUINS"]' WHERE name = 'NATATION 2';
UPDATE groups SET description = '["7 - 14 ANS"]' WHERE name = 'SELF-DEFENSE';
UPDATE groups SET description = '[]' WHERE name = 'SPORTS BALLONS';
UPDATE groups SET description = '["STAFF"]' WHERE name = 'STAFF';
UPDATE groups SET description = '["3-6 ANS"]' WHERE name = 'STAGE DE NATATION P1';
UPDATE groups SET description = '["7-14 ANS"]' WHERE name = 'STAGE NATATION P2';

-- DONE! Refresh the Créer un Abonnement page.
