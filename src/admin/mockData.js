// Testdaten fuer das Panel-Frontend.
//
// Die Zeilen haben absichtlich exakt die Form der D1-Tabellen (snake_case,
// Betraege in Cent, Zeitstempel als ISO-8601 in UTC). Dadurch laesst sich
// diese Datei spaeter ersatzlos gegen einen fetch auf /api/admin/* tauschen,
// ohne dass eine einzige Komponente angefasst werden muss.
//
// Ebenso bewusst: hier steht *kein* Saldo und *kein* Status. Beides leitet
// die Oberflaeche mit denselben Funktionen aus worker/src/ledger.js ab, die
// auch der Worker benutzt. Eine gepflegte Zweitwahrheit koennte abweichen,
// eine abgeleitete nicht.

export const STAFF = {
  email: 'jenny@fembeauty.at',
  name: 'Jenny',
  role: 'Inhaberin',
}

// Stripe rechnet europaeische Karten mit 1,5 % + 0,25 € ab. Das hier ist
// eine Schaetzung fuer die Kachel — die verbindliche Zahl steht in der
// balance_transaction des jeweiligen Zahlungsvorgangs und muss spaeter von
// dort kommen, nicht aus dieser Formel.
export const STRIPE_PERCENT = 0.015
export const STRIPE_FIXED_CENTS = 25

// Ein Gutschein ohne Buchung ist ein voller Gutschein. Die Buchungen stehen
// getrennt darunter, damit die Ableitung sichtbar bleibt.
export const vouchers = [
  {
    id: 'v-01', code: 'FEM-3BX91-BXS0Y', token: 'tok-01',
    kind: 'value', treatment_id: null, treatment_label: null,
    original_amount_cents: 10000, currency: 'EUR', vat_rate_bp: 2000, tax_point: 'sale',
    status: 'active',
    recipient_name: 'Anna Huber', sender_name: 'Lisa Bauer',
    message: 'Alles Gute zum Geburtstag!',
    delivery: 'email', delivery_email: 'anna.huber@example.at',
    buyer_email: 'lisa.bauer@example.at', stripe_session_id: 'cs_test_01',
    issued_at: '2026-08-06T09:14:00.000Z', expires_at: null, voided_at: null, void_reason: null,
  },
  {
    id: 'v-02', code: 'FEM-A1DRE-WSM5S', token: 'tok-02',
    kind: 'value', treatment_id: null, treatment_label: null,
    original_amount_cents: 15000, currency: 'EUR', vat_rate_bp: 2000, tax_point: 'sale',
    status: 'active',
    recipient_name: null, sender_name: 'Markus Weber',
    message: null,
    delivery: 'download', delivery_email: null,
    buyer_email: 'markus.weber@example.at', stripe_session_id: 'cs_test_02',
    issued_at: '2026-07-12T12:32:00.000Z', expires_at: null, voided_at: null, void_reason: null,
  },
  {
    id: 'v-03', code: 'FEM-4JFDT-NEA36', token: 'tok-03',
    kind: 'value', treatment_id: null, treatment_label: null,
    original_amount_cents: 5000, currency: 'EUR', vat_rate_bp: 2000, tax_point: 'sale',
    status: 'active',
    recipient_name: 'Julia Schmid', sender_name: 'Petra Schmid',
    message: 'Fuer dich, weil du es dir verdient hast.',
    delivery: 'email', delivery_email: 'julia.schmid@example.at',
    buyer_email: 'petra.schmid@example.at', stripe_session_id: 'cs_test_03',
    issued_at: '2026-08-05T16:48:00.000Z', expires_at: null, voided_at: null, void_reason: null,
  },
  {
    id: 'v-04', code: 'FEM-KZ3RA-Y186Q', token: 'tok-04',
    kind: 'value', treatment_id: null, treatment_label: null,
    original_amount_cents: 20000, currency: 'EUR', vat_rate_bp: 2000, tax_point: 'sale',
    status: 'active',
    recipient_name: 'Sabine Gruber', sender_name: 'Thomas Gruber',
    message: null,
    delivery: 'email', delivery_email: 'sabine.gruber@example.at',
    buyer_email: 'thomas.gruber@example.at', stripe_session_id: 'cs_test_04',
    issued_at: '2026-06-20T10:05:00.000Z', expires_at: null, voided_at: null, void_reason: null,
  },
  {
    id: 'v-05', code: 'FEM-6CTW6-5MZ1B', token: 'tok-05',
    kind: 'value', treatment_id: null, treatment_label: null,
    original_amount_cents: 7500, currency: 'EUR', vat_rate_bp: 2000, tax_point: 'sale',
    status: 'active',
    recipient_name: null, sender_name: 'Elena Kraus',
    message: null,
    delivery: 'download', delivery_email: null,
    buyer_email: 'elena.kraus@example.at', stripe_session_id: 'cs_test_05',
    issued_at: '2026-08-04T18:21:00.000Z', expires_at: null, voided_at: null, void_reason: null,
  },
  {
    id: 'v-06', code: 'FEM-W86NE-AN5RD', token: 'tok-06',
    kind: 'treatment', treatment_id: 'head-spa-glow-flow',
    treatment_label: 'The Head Spa · Glow & Flow',
    original_amount_cents: 15500, currency: 'EUR', vat_rate_bp: 2000, tax_point: 'sale',
    status: 'active',
    recipient_name: 'Carina Mayer', sender_name: 'Sophie Mayer',
    message: 'Endlich mal abschalten.',
    delivery: 'email', delivery_email: 'carina.mayer@example.at',
    buyer_email: 'sophie.mayer@example.at', stripe_session_id: 'cs_test_06',
    issued_at: '2026-08-02T11:02:00.000Z', expires_at: null, voided_at: null, void_reason: null,
  },
  {
    id: 'v-07', code: 'FEM-WPMTW-84QM2', token: 'tok-07',
    kind: 'treatment', treatment_id: 'hydro-glow',
    treatment_label: 'Hydro Glow · High-Tech Facial',
    original_amount_cents: 12000, currency: 'EUR', vat_rate_bp: 2000, tax_point: 'sale',
    status: 'active',
    recipient_name: 'Nina Berger', sender_name: 'Nina Berger',
    message: null,
    delivery: 'download', delivery_email: null,
    buyer_email: 'nina.berger@example.at', stripe_session_id: 'cs_test_07',
    issued_at: '2026-07-28T14:40:00.000Z', expires_at: null, voided_at: null, void_reason: null,
  },
  {
    id: 'v-08', code: 'FEM-XS5TW-PG7G5', token: 'tok-08',
    kind: 'value', treatment_id: null, treatment_label: null,
    original_amount_cents: 30000, currency: 'EUR', vat_rate_bp: 2000, tax_point: 'sale',
    status: 'active',
    recipient_name: 'Familie Novak', sender_name: 'Daniel Novak',
    message: null,
    delivery: 'email', delivery_email: 'daniel.novak@example.at',
    buyer_email: 'daniel.novak@example.at', stripe_session_id: 'cs_test_08',
    issued_at: '2026-07-15T08:55:00.000Z', expires_at: null, voided_at: null, void_reason: null,
  },
  {
    id: 'v-09', code: 'FEM-2VRDB-EB9NW', token: 'tok-09',
    kind: 'value', treatment_id: null, treatment_label: null,
    original_amount_cents: 25000, currency: 'EUR', vat_rate_bp: 2000, tax_point: 'sale',
    // Kunde hat storniert, Betrag ging ueber Stripe zurueck.
    status: 'refunded',
    recipient_name: 'Klara Wolf', sender_name: 'Peter Wolf',
    message: null,
    delivery: 'email', delivery_email: 'klara.wolf@example.at',
    buyer_email: 'peter.wolf@example.at', stripe_session_id: 'cs_test_09',
    issued_at: '2026-07-30T13:12:00.000Z',
    expires_at: null,
    voided_at: '2026-08-01T09:30:00.000Z',
    void_reason: 'Kunde hat widerrufen, Rueckerstattung ueber Stripe',
  },
  {
    id: 'v-10', code: 'FEM-NGZ74-BKKSY', token: 'tok-10',
    kind: 'treatment', treatment_id: 'japanische-manikuere',
    treatment_label: 'Japanische Manikuere · Natuerlicher Glanz',
    original_amount_cents: 3800, currency: 'EUR', vat_rate_bp: 2000, tax_point: 'sale',
    status: 'active',
    recipient_name: 'Marie Fischer', sender_name: 'Eva Fischer',
    message: null,
    delivery: 'email', delivery_email: 'marie.fischer@example.at',
    buyer_email: 'eva.fischer@example.at', stripe_session_id: 'cs_test_10',
    issued_at: '2026-08-07T15:26:00.000Z', expires_at: null, voided_at: null, void_reason: null,
  },
  {
    id: 'v-11', code: 'FEM-C50M1-RS8ZX', token: 'tok-11',
    kind: 'value', treatment_id: null, treatment_label: null,
    original_amount_cents: 50000, currency: 'EUR', vat_rate_bp: 2000, tax_point: 'sale',
    status: 'active',
    recipient_name: 'Hanna Steiner', sender_name: 'Team Ordination Dr. Steiner',
    message: 'Danke fuer ein grossartiges Jahr.',
    delivery: 'email', delivery_email: 'hanna.steiner@example.at',
    buyer_email: 'office@steiner-ordination.at', stripe_session_id: 'cs_test_11',
    issued_at: '2026-05-10T07:44:00.000Z', expires_at: null, voided_at: null, void_reason: null,
  },
  {
    id: 'v-12', code: 'FEM-GF3D9-30704', token: 'tok-12',
    kind: 'treatment', treatment_id: 'head-spa-pure-balance',
    treatment_label: 'The Head Spa · Pure Balance',
    original_amount_cents: 10500, currency: 'EUR', vat_rate_bp: 2000, tax_point: 'sale',
    status: 'active',
    recipient_name: null, sender_name: 'Verena Lang',
    message: null,
    delivery: 'download', delivery_email: null,
    buyer_email: 'verena.lang@example.at', stripe_session_id: 'cs_test_12',
    issued_at: '2026-08-01T10:18:00.000Z', expires_at: null, voided_at: null, void_reason: null,
  },
]

// Kontobuch. Positiv = Abbuchung, negativ = Gegenbuchung. Eine Gegenbuchung
// traegt in reverses_id die Buchung, die sie zuruecknimmt.
export const redemptions = [
  // v-02 — der Fall aus dem Entwurf: 150 gekauft, 60 verbraucht, 90 offen.
  {
    id: 'r-01', voucher_id: 'v-02', amount_cents: 6000,
    redeemed_at: '2026-07-19T08:15:00.000Z',
    staff_id: 'jenny@fembeauty.at', note: 'Gesichtsbehandlung',
    idempotency_key: 'seed-01', reverses_id: null,
  },

  // v-04 — in zwei Schritten vollstaendig verbraucht.
  {
    id: 'r-02', voucher_id: 'v-04', amount_cents: 12000,
    redeemed_at: '2026-07-02T09:40:00.000Z',
    staff_id: 'jenny@fembeauty.at', note: 'Hydro Glow',
    idempotency_key: 'seed-02', reverses_id: null,
  },
  {
    id: 'r-03', voucher_id: 'v-04', amount_cents: 8000,
    redeemed_at: '2026-08-03T11:20:00.000Z',
    staff_id: 'jenny@fembeauty.at', note: 'Manikuere plus Produkt',
    idempotency_key: 'seed-03', reverses_id: null,
  },

  // v-07 — Behandlungsgutschein eingeloest.
  {
    id: 'r-04', voucher_id: 'v-07', amount_cents: 12000,
    redeemed_at: '2026-08-05T13:05:00.000Z',
    staff_id: 'jenny@fembeauty.at', note: 'Hydro Glow eingeloest',
    idempotency_key: 'seed-04', reverses_id: null,
  },

  // v-08 — teilweise verbraucht.
  {
    id: 'r-05', voucher_id: 'v-08', amount_cents: 12000,
    redeemed_at: '2026-08-01T15:30:00.000Z',
    staff_id: 'jenny@fembeauty.at', note: 'Head Spa Glow & Flow',
    idempotency_key: 'seed-05', reverses_id: null,
  },

  // v-11 — zeigt eine Korrektur: 80 falsch gebucht, per Gegenbuchung
  // zurueckgenommen, danach der richtige Betrag. Der Verlauf bleibt
  // vollstaendig lesbar, die Zeile wird nie geloescht.
  {
    id: 'r-06', voucher_id: 'v-11', amount_cents: 8000,
    redeemed_at: '2026-06-02T10:00:00.000Z',
    staff_id: 'jenny@fembeauty.at', note: 'Tippfehler — falscher Betrag',
    idempotency_key: 'seed-06', reverses_id: null,
  },
  {
    id: 'r-07', voucher_id: 'v-11', amount_cents: -8000,
    redeemed_at: '2026-06-02T10:04:00.000Z',
    staff_id: 'jenny@fembeauty.at', note: 'Storno der Fehlbuchung',
    idempotency_key: 'seed-07', reverses_id: 'r-06',
  },
  {
    id: 'r-08', voucher_id: 'v-11', amount_cents: 20000,
    redeemed_at: '2026-07-03T16:12:00.000Z',
    staff_id: 'jenny@fembeauty.at', note: 'Head Spa und Gesichtsbehandlung',
    idempotency_key: 'seed-08', reverses_id: null,
  },
]
