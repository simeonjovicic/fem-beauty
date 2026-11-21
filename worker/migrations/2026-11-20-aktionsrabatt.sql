-- Aktionsrabatt fuer Gutscheine — einmalig auf der bestehenden Datenbank.
--
-- schema.sql legt neue Datenbanken bereits mit diesen Spalten an. Eine
-- bestehende bekommt sie nur hierueber: CREATE TABLE IF NOT EXISTS laesst
-- eine vorhandene Tabelle unberuehrt.
--
-- Nur hinzufuegen, nichts aendern: bestehende Gutscheine bekommen
-- discount_cents = 0 und sind damit genau das, was sie vorher waren. Der
-- alte Worker-Code schreibt die Spalten nicht und laeuft weiter — die
-- Datei kann also vor dem Deploy des neuen Codes eingespielt werden, und
-- genau so herum muss es sein: der neue Code schreibt in diese Spalten.
--
-- Nicht zweimal ausfuehren — ein zweites ADD COLUMN bricht mit
-- "duplicate column name" ab.
--
--   npx wrangler d1 execute fem-gutscheine --remote --file worker/migrations/2026-11-20-aktionsrabatt.sql
--   npx wrangler d1 execute fem-gutscheine --local  --file worker/migrations/2026-11-20-aktionsrabatt.sql

ALTER TABLE vouchers ADD COLUMN discount_cents INTEGER NOT NULL DEFAULT 0
  CHECK (discount_cents >= 0 AND discount_cents < original_amount_cents);

ALTER TABLE vouchers ADD COLUMN promotion TEXT;

-- Die Black Week 2026, wie Jenny sie ausgeschrieben hat: 23. bis
-- 30. November, nur Wertgutscheine, nur genau diese drei Betraege.
-- Danach ist das Panel die Quelle (Reiter "Aktion") — OR IGNORE, damit
-- ein dort schon gespeicherter Stand nicht ueberschrieben wird.
INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (
  'promotion',
  '{"enabled":true,"name":"Black Week","startDate":"2026-11-23","endDate":"2026-11-30","tiers":[{"payCents":10000,"bonusCents":2000},{"payCents":20000,"bonusCents":5000},{"payCents":30000,"bonusCents":8000}]}',
  '2026-11-20T00:00:00.000Z'
);
