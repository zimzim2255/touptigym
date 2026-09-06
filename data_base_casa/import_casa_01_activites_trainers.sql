-- ============================================================
-- TOUPTI GYM CASA - DATA IMPORT - FILE 1 OF 8
-- ACTIVITÉS (groups table) + TRAINERS
-- ============================================================

-- Run this FIRST in the Supabase SQL Editor
-- https://supabase.com/dashboard/project/atvdorphwnpzhobvfmtz/sql/new
-- ============================================================

INSERT INTO groups (name, description) VALUES
  ('NATATION', '["CANARDS", "CYCLE DE NATATION", "GRENOUILLES", "SUPER TÊTARDS", "TÊTARDS"]'),
  ('GYMNASTIQUE 1', '["P''TITES CANAILLES", "P''TITES FRIPOUILLES", "P''TITS FILOUS", "TOUP''TI POUSS/MOUSS"]'),
  ('FOOTBALL', '["GUÊPARDS", "LIONS"]'),
  ('BASKETBALL', '["KANGOUROUS"]'),
  ('ARTS MARTIAUX', '["DRAGONS", "KOALAS", "TIGRES"]'),
  ('GYMNASTIQUE 2', '["GRANDS MALINS", "MALINS", "VOLTIGEURS DÉBUTANT"]'),
  ('KICK-BOXING', '["OURS", "TAUREAUX"]'),
  ('NATATION 2', '["BALEINES", "CORADIONS JUNIOR", "CORADIONS SENIOR", "CYCLE DE NATATION", "DAUPHINS", "REQUINS"]'),
  ('DANSE CLASSIQUE', '["COCCINELLES", "PAPILLONS"]'),
  ('KUNG FU', '[]'),
  ('SPORTS BALLONS', '[]'),
  ('STAFF', '["STAFF"]'),
  ('BABY SPA', '["RDV EN BINÔME", "RDV INDIVIDUEL"]'),
  ('ABSENCES', '["PISCINE 1", "PISCINE 2"]'),
  ('SELF-DEFENSE', '["7 - 14 ANS"]'),
  ('STAGE DE NATATION P1', '["3-6 ANS"]'),
  ('STAGE NATATION P2', '["7-14 ANS"]');

INSERT INTO trainers (name) VALUES
  ('ABDELMALEK CHAKIR'),
  ('ANAS BOULGANA'),
  ('YOUSSEF KENZEDDINE'),
  ('SOUFIANE EL HADDAD'),
  ('ABDELHAMID SAADEDDINE'),
  ('KAMAL SLAOUI'),
  ('YOUNES EL HASSANI'),
  ('AZIZ TOUMI'),
  ('IRYNA MUZYKA'),
  ('RIDA MOURAK');

-- ============================================================
-- FILE 1 DONE! ✅ Run FILE 2 next.
-- ============================================================
