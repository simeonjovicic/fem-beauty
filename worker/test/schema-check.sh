#!/usr/bin/env bash
# Prüft, dass die Constraints in schema.sql tatsächlich greifen.
set -u

DB="$(mktemp -d)/gutscheine.db"
SCHEMA="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/schema.sql"
PASS=0
FAIL=0

run() { sqlite3 "$DB" "PRAGMA foreign_keys=ON; $1" 2>&1; }

# erwartet Erfolg
ok() {
  local label="$1" sql="$2" out
  out="$(run "$sql")"
  if [ $? -eq 0 ]; then PASS=$((PASS+1)); printf '  OK    %s\n' "$label"
  else FAIL=$((FAIL+1)); printf '  FAIL  %s -> %s\n' "$label" "$out"; fi
}

# erwartet Ablehnung durch die Datenbank
rejects() {
  local label="$1" sql="$2" out
  out="$(run "$sql")"
  if [ $? -ne 0 ]; then PASS=$((PASS+1)); printf '  OK    %s (abgelehnt: %s)\n' "$label" "$(echo "$out" | head -1)"
  else FAIL=$((FAIL+1)); printf '  FAIL  %s wurde NICHT abgelehnt\n' "$label"; fi
}

eq() {
  local label="$1" sql="$2" want="$3" got
  got="$(run "$sql")"
  if [ "$got" = "$want" ]; then PASS=$((PASS+1)); printf '  OK    %s = %s\n' "$label" "$got"
  else FAIL=$((FAIL+1)); printf '  FAIL  %s: erwartet %s, war %s\n' "$label" "$want" "$got"; fi
}

echo "── Schema anlegen ──"
if sqlite3 "$DB" < "$SCHEMA" 2>&1; then
  echo "  OK    schema.sql angewendet"; PASS=$((PASS+1))
else
  echo "  FAIL  schema.sql fehlerhaft"; exit 1
fi

VALID="INSERT INTO vouchers (id,code,token,kind,original_amount_cents,vat_rate_bp,delivery,buyer_email,stripe_session_id,issued_at)
       VALUES ('v1','FEM-4K7TQ-9RM2X','tok_1','value',10000,2000,'download','kaufer@example.at','cs_1','2026-08-06T10:00:00.000Z');"

echo
echo "── Gutschein ──"
ok      "gültiger Wertgutschein"        "$VALID"
rejects "doppelter Code"                "INSERT INTO vouchers (id,code,token,kind,original_amount_cents,vat_rate_bp,delivery,buyer_email,stripe_session_id,issued_at) VALUES ('v2','FEM-4K7TQ-9RM2X','tok_2','value',5000,2000,'download','a@b.at','cs_2','2026-08-06T10:00:00.000Z');"
rejects "doppelte Stripe-Session"       "INSERT INTO vouchers (id,code,token,kind,original_amount_cents,vat_rate_bp,delivery,buyer_email,stripe_session_id,issued_at) VALUES ('v3','FEM-AAAAA-AAAAA','tok_3','value',5000,2000,'download','a@b.at','cs_1','2026-08-06T10:00:00.000Z');"
rejects "Betrag 0"                      "INSERT INTO vouchers (id,code,token,kind,original_amount_cents,vat_rate_bp,delivery,buyer_email,stripe_session_id,issued_at) VALUES ('v4','FEM-BBBBB-BBBBB','tok_4','value',0,2000,'download','a@b.at','cs_4','2026-08-06T10:00:00.000Z');"
rejects "negativer Betrag"              "INSERT INTO vouchers (id,code,token,kind,original_amount_cents,vat_rate_bp,delivery,buyer_email,stripe_session_id,issued_at) VALUES ('v5','FEM-CCCCC-CCCCC','tok_5','value',-100,2000,'download','a@b.at','cs_5','2026-08-06T10:00:00.000Z');"
rejects "Behandlung ohne treatment_id"  "INSERT INTO vouchers (id,code,token,kind,original_amount_cents,vat_rate_bp,delivery,buyer_email,stripe_session_id,issued_at) VALUES ('v6','FEM-DDDDD-DDDDD','tok_6','treatment',10500,2000,'download','a@b.at','cs_6','2026-08-06T10:00:00.000Z');"
rejects "E-Mail-Zustellung ohne Adresse" "INSERT INTO vouchers (id,code,token,kind,original_amount_cents,vat_rate_bp,delivery,buyer_email,stripe_session_id,issued_at) VALUES ('v7','FEM-EEEEE-EEEEE','tok_7','value',10000,2000,'email','a@b.at','cs_7','2026-08-06T10:00:00.000Z');"
rejects "unbekannte Gutscheinart"       "INSERT INTO vouchers (id,code,token,kind,original_amount_cents,vat_rate_bp,delivery,buyer_email,stripe_session_id,issued_at) VALUES ('v8','FEM-FFFFF-FFFFF','tok_8','geschenk',10000,2000,'download','a@b.at','cs_8','2026-08-06T10:00:00.000Z');"
rejects "storniert ohne voided_at"      "INSERT INTO vouchers (id,code,token,kind,original_amount_cents,vat_rate_bp,delivery,buyer_email,stripe_session_id,issued_at,status) VALUES ('v9','FEM-GGGGG-GGGGG','tok_9','value',10000,2000,'download','a@b.at','cs_9','2026-08-06T10:00:00.000Z','voided');"

echo
echo "── Kontobuch ──"
ok      "erste Abbuchung 30,00"   "INSERT INTO redemptions (id,voucher_id,amount_cents,redeemed_at,staff_id,idempotency_key) VALUES ('r1','v1',3000,'2026-08-06T11:00:00.000Z','jenny@fem.at','k-1');"
ok      "zweite Abbuchung 25,00"  "INSERT INTO redemptions (id,voucher_id,amount_cents,redeemed_at,staff_id,idempotency_key) VALUES ('r2','v1',2500,'2026-08-06T12:00:00.000Z','vicky@fem.at','k-2');"
rejects "Doppelklick (gleicher Idempotenzschlüssel)" "INSERT INTO redemptions (id,voucher_id,amount_cents,redeemed_at,staff_id,idempotency_key) VALUES ('r3','v1',2500,'2026-08-06T12:00:01.000Z','vicky@fem.at','k-2');"
rejects "Buchung über 0"          "INSERT INTO redemptions (id,voucher_id,amount_cents,redeemed_at,staff_id,idempotency_key) VALUES ('r4','v1',0,'2026-08-06T12:00:00.000Z','a@b.at','k-4');"
rejects "negativ ohne reverses_id" "INSERT INTO redemptions (id,voucher_id,amount_cents,redeemed_at,staff_id,idempotency_key) VALUES ('r5','v1',-500,'2026-08-06T12:00:00.000Z','a@b.at','k-5');"
rejects "unbekannter Gutschein"   "INSERT INTO redemptions (id,voucher_id,amount_cents,redeemed_at,staff_id,idempotency_key) VALUES ('r6','gibtsnicht',500,'2026-08-06T12:00:00.000Z','a@b.at','k-6');"

echo
echo "── Gegenbuchung ──"
ok      "Storno von r1"           "INSERT INTO redemptions (id,voucher_id,amount_cents,redeemed_at,staff_id,idempotency_key,reverses_id) VALUES ('r7','v1',-3000,'2026-08-06T13:00:00.000Z','jenny@fem.at','k-7','r1');"
rejects "zweites Storno von r1"   "INSERT INTO redemptions (id,voucher_id,amount_cents,redeemed_at,staff_id,idempotency_key,reverses_id) VALUES ('r8','v1',-3000,'2026-08-06T13:00:01.000Z','jenny@fem.at','k-8','r1');"
rejects "positives Storno"        "INSERT INTO redemptions (id,voucher_id,amount_cents,redeemed_at,staff_id,idempotency_key,reverses_id) VALUES ('r9','v1',3000,'2026-08-06T13:00:00.000Z','a@b.at','k-9','r2');"
rejects "Gutschein mit Buchungen löschen" "DELETE FROM vouchers WHERE id='v1';"

echo
echo "── Saldo-View ──"
# 10000 - (3000 + 2500 - 3000) = 7500
eq "balance_cents"   "SELECT balance_cents FROM voucher_balances WHERE id='v1';"   "7500"
eq "redeemed_cents"  "SELECT redeemed_cents FROM voucher_balances WHERE id='v1';"  "2500"
eq "debit_count"     "SELECT debit_count FROM voucher_balances WHERE id='v1';"     "2"
eq "reversal_count"  "SELECT reversal_count FROM voucher_balances WHERE id='v1';"  "1"

# Der LEFT JOIN liefert bei Gutscheinen ohne Buchung eine NULL-Zeile.
# Ohne die Prüfung auf r.id würden hier faelschlich 1en stehen.
run "INSERT INTO vouchers (id,code,token,kind,original_amount_cents,vat_rate_bp,delivery,buyer_email,stripe_session_id,issued_at)
     VALUES ('v-leer','FEM-HHHHH-HHHHH','tok_leer','value',5000,2000,'download','a@b.at','cs_leer','2026-08-06T10:00:00.000Z');" >/dev/null
eq "debit_count (ohne Buchungen)"    "SELECT debit_count FROM voucher_balances WHERE id='v-leer';"    "0"
eq "reversal_count (ohne Buchungen)" "SELECT reversal_count FROM voucher_balances WHERE id='v-leer';" "0"
eq "balance_cents (ohne Buchungen)"  "SELECT balance_cents FROM voucher_balances WHERE id='v-leer';"  "5000"

echo
echo "═══════════════════════════"
printf 'bestanden: %d   fehlgeschlagen: %d\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
