-- FEM Gutscheine — D1 (SQLite) Schema
--
-- Grundprinzip: Ein Gutschein hat einen Ursprungsbetrag, der sich nie ändert.
-- Der Restwert ist keine gespeicherte Zahl, sondern die Summe über das
-- Kontobuch in `redemptions`. Dadurch sind "offen", "teilverbraucht" und
-- "eingelöst" Ableitungen statt Zustände, die gepflegt werden müssen, und
-- jede Buchung bleibt nachvollziehbar. Korrigiert wird per Gegenbuchung,
-- niemals durch Ändern oder Löschen einer Zeile.
--
-- Alle Beträge sind Ganzzahlen in Cent. Keine Fließkommazahlen für Geld.
-- Alle Zeitstempel sind ISO-8601 in UTC ("2026-08-06T10:14:42.000Z"),
-- vom Anwendungscode gesetzt — SQLite hat keinen brauchbaren Zeittyp.

PRAGMA foreign_keys = ON;

-- ─────────────────────────────────────────────────────────────────
-- Gutscheine
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vouchers (
  id                    TEXT    PRIMARY KEY,

  -- Zwei getrennte Identifikatoren, absichtlich:
  -- `code` wird von Hand abgetippt (kurz, Crockford-Base32, Prüfzeichen).
  -- `token` steckt in der QR-URL und ist lang genug, um nicht ratbar zu sein.
  -- Der kurze Code darf nie die QR-URL sein.
  code                  TEXT    NOT NULL UNIQUE,
  token                 TEXT    NOT NULL UNIQUE,

  kind                  TEXT    NOT NULL CHECK (kind IN ('value', 'treatment')),
  -- Bei kind='treatment': Referenz und Klartext-Schnappschuss zum Kaufzeitpunkt.
  -- Der Schnappschuss ist wichtig, weil sich Namen und Preise im Angebot
  -- ändern, der verkaufte Gutschein aber bleibt, was er war.
  treatment_id          TEXT,
  treatment_label       TEXT,

  original_amount_cents INTEGER NOT NULL CHECK (original_amount_cents > 0),
  currency              TEXT    NOT NULL DEFAULT 'EUR',

  -- Steuersatz in Basispunkten zum Verkaufszeitpunkt (2000 = 20,00 %).
  -- Schnappschuss, kein Verweis auf eine aktuelle Konfiguration: Sätze
  -- ändern sich, ein Gutschein kann Jahre alt werden.
  vat_rate_bp           INTEGER NOT NULL CHECK (vat_rate_bp >= 0),
  -- Bei einheitlichem Steuersatz ist alles ein Einzweckgutschein und die
  -- USt fällt beim Verkauf an. Spalte bleibt, falls je etwas mit
  -- abweichendem Satz dazukommt.
  tax_point             TEXT    NOT NULL DEFAULT 'sale'
                                CHECK (tax_point IN ('sale', 'redemption')),

  status                TEXT    NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'voided', 'refunded')),

  -- Personalisierung
  recipient_name        TEXT,
  sender_name           TEXT,
  message               TEXT,
  delivery              TEXT    NOT NULL CHECK (delivery IN ('download', 'email')),
  delivery_email        TEXT,

  -- Kauf
  buyer_email           TEXT    NOT NULL,
  stripe_session_id     TEXT    NOT NULL UNIQUE,
  stripe_payment_intent TEXT,

  -- Zustellung
  email_sent_at         TEXT,
  email_last_error      TEXT,

  issued_at             TEXT    NOT NULL,
  -- NULL = kein Verfall. Bewusst der Standard: pauschale kurze
  -- Befristungen auf Gutscheinen sind in Österreich wiederholt gekippt
  -- worden. Wert erst nach Rechtsauskunft setzen.
  expires_at            TEXT,
  voided_at             TEXT,
  void_reason           TEXT,

  -- Behandlungsgutschein braucht eine Behandlung, Wertgutschein nicht.
  CHECK (kind <> 'treatment' OR treatment_id IS NOT NULL),
  -- Zustellung per Mail braucht eine Adresse.
  CHECK (delivery <> 'email' OR delivery_email IS NOT NULL),
  -- Ein stornierter Gutschein muss sagen, wann.
  CHECK (status = 'active' OR voided_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_vouchers_status     ON vouchers (status);
CREATE INDEX IF NOT EXISTS idx_vouchers_issued_at  ON vouchers (issued_at);
CREATE INDEX IF NOT EXISTS idx_vouchers_buyer      ON vouchers (buyer_email);

-- ─────────────────────────────────────────────────────────────────
-- Kontobuch
-- ─────────────────────────────────────────────────────────────────
-- Eine Zeile pro Buchung. Positiv = Abbuchung, negativ = Gegenbuchung.
-- Zeilen werden nie geändert oder gelöscht.
CREATE TABLE IF NOT EXISTS redemptions (
  id              TEXT    PRIMARY KEY,
  voucher_id      TEXT    NOT NULL REFERENCES vouchers (id) ON DELETE RESTRICT,

  amount_cents    INTEGER NOT NULL CHECK (amount_cents <> 0),
  redeemed_at     TEXT    NOT NULL,

  -- Wer gebucht hat. Kommt aus dem von Cloudflare Access verifizierten
  -- Identitäts-Header, nicht aus dem Request-Body.
  staff_id        TEXT    NOT NULL,
  note            TEXT,

  -- Schützt gegen Doppelklick an der Kassa und gegen Wiederholungen.
  -- Der Client erzeugt den Schlüssel einmal pro Einlösevorgang.
  idempotency_key TEXT    NOT NULL,

  -- Bei einer Gegenbuchung: welche Buchung wird zurückgenommen.
  reverses_id     TEXT    REFERENCES redemptions (id) ON DELETE RESTRICT,

  -- Gegenbuchungen sind negativ, normale Abbuchungen positiv.
  CHECK ((reverses_id IS NULL AND amount_cents > 0)
      OR (reverses_id IS NOT NULL AND amount_cents < 0))
);

-- Der eigentliche Idempotenz-Schutz.
CREATE UNIQUE INDEX IF NOT EXISTS idx_redemptions_idem
  ON redemptions (voucher_id, idempotency_key);

-- Jede Buchung darf höchstens einmal zurückgenommen werden.
CREATE UNIQUE INDEX IF NOT EXISTS idx_redemptions_reverses
  ON redemptions (reverses_id) WHERE reverses_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_redemptions_voucher
  ON redemptions (voucher_id, redeemed_at);

-- ─────────────────────────────────────────────────────────────────
-- Saldo-Sicht
-- ─────────────────────────────────────────────────────────────────
-- Bequemlichkeit fürs Panel. Die Wahrheit bleiben die Tabellen; diese
-- View rechnet nur, was ledger.js in JS ebenfalls rechnet.
CREATE VIEW IF NOT EXISTS voucher_balances AS
SELECT
  v.id,
  v.code,
  v.status,
  v.original_amount_cents,
  COALESCE(SUM(r.amount_cents), 0)                             AS redeemed_cents,
  v.original_amount_cents - COALESCE(SUM(r.amount_cents), 0)   AS balance_cents,
  -- Abbuchungen und Stornos getrennt zählen, nicht vermischt: eine
  -- Gegenbuchung ist keine Einlösung. Die Prüfung auf r.id ist nötig,
  -- weil der LEFT JOIN bei Gutscheinen ohne Buchung eine NULL-Zeile
  -- liefert und "NULL IS NULL" sonst als Treffer durchginge.
  COUNT(CASE WHEN r.id IS NOT NULL AND r.reverses_id IS NULL
             THEN 1 END)                                       AS debit_count,
  COUNT(CASE WHEN r.id IS NOT NULL AND r.reverses_id IS NOT NULL
             THEN 1 END)                                       AS reversal_count,
  MAX(r.redeemed_at)                                           AS last_redeemed_at
FROM vouchers v
LEFT JOIN redemptions r ON r.voucher_id = v.id
GROUP BY v.id;
