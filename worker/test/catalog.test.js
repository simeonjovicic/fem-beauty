import assert from 'node:assert/strict'
import test from 'node:test'
import { MAX_AMOUNT_CENTS, MIN_AMOUNT_CENTS, validateOrder } from '../src/catalog.js'

// Behandlungen kommen jetzt aus der Datenbank. Die Pruefung selbst bleibt
// eine reine Funktion und bekommt sie uebergeben — deshalb reichen hier
// Zeilen in der Form, die D1 liefert, ohne Datenbank im Test.
const treatments = [
  {
    id: 'japanische-manikuere',
    category: 'Naegel',
    title: 'Japanische Manikuere',
    variant: 'Natuerlicher Glanz',
    duration: '45 Min.',
    price_cents: 3800,
    shop_visible: 1,
  },
  {
    id: 'head-spa-glow-flow',
    category: 'Head Spa',
    title: 'The Head Spa',
    variant: 'Glow & Flow',
    duration: '100 Min.',
    price_cents: 15500,
    shop_visible: 1,
  },
]

const base = { recipient: 'Anna', delivery: 'download' }
const value = (extra = {}) => validateOrder({ kind: 'value', amount: 100, ...base, ...extra }, treatments)

// ── Preishoheit ──────────────────────────────────────────────────

test('der Client kann den Behandlungspreis nicht diktieren', () => {
  // Genau der Angriff: gültige Behandlung, mitgeschickter Wunschpreis.
  const result = validateOrder({
    kind: 'treatment',
    treatmentId: 'japanische-manikuere',
    amount: 1,
    amountCents: 1,
    price: 1,
    priceCents: 1,
    ...base,
  }, treatments)
  assert.equal(result.ok, true)
  assert.equal(result.order.amountCents, 3800)
})

test('der Preis kommt aus der Datenbank, nicht aus data.js', () => {
  // Dieselbe Kennung, anderer Preis in der Tabelle: massgeblich ist die Zeile.
  const geaendert = [{ ...treatments[0], price_cents: 4200 }]
  const result = validateOrder(
    { kind: 'treatment', treatmentId: 'japanische-manikuere', ...base }, geaendert,
  )
  assert.equal(result.order.amountCents, 4200)
})

test('eine nicht uebergebene Behandlung ist unbekannt', () => {
  // listTreatments liefert im Checkout nur shop_visible = 1. Eine
  // ausgeblendete Behandlung darf deshalb nicht kaufbar sein, auch wenn
  // jemand ihre Kennung noch kennt.
  const result = validateOrder(
    { kind: 'treatment', treatmentId: 'head-spa-glow-flow', ...base }, [treatments[0]],
  )
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'unknown_treatment')
})

test('erfundene Behandlungen werden abgewiesen', () => {
  const result = validateOrder({ kind: 'treatment', treatmentId: 'gratis-hack', ...base }, treatments)
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'unknown_treatment')
})

test('ein unbrauchbarer Preis in der Tabelle fuehrt nicht zu einem Gutschein', () => {
  for (const kaputt of [0, -100, 89.5, Number.NaN]) {
    const result = validateOrder(
      { kind: 'treatment', treatmentId: 'japanische-manikuere', ...base },
      [{ ...treatments[0], price_cents: kaputt }],
    )
    assert.equal(result.ok, false, `${kaputt} durchgelassen`)
    assert.equal(result.reason, 'invalid_treatment_price')
  }
})

test('der Behandlungsname wird als Schnappschuss uebernommen', () => {
  const result = validateOrder(
    { kind: 'treatment', treatmentId: 'head-spa-glow-flow', ...base }, treatments,
  )
  assert.equal(result.order.treatmentLabel, 'The Head Spa \u00b7 Glow & Flow')
})

// ── Betragsgrenzen ───────────────────────────────────────────────

test('Grenzen sind einschließend', () => {
  assert.equal(value({ amount: MIN_AMOUNT_CENTS / 100 }).ok, true)
  assert.equal(value({ amount: MAX_AMOUNT_CENTS / 100 }).ok, true)
})

test('knapp daneben ist abgelehnt', () => {
  assert.equal(value({ amount: MIN_AMOUNT_CENTS / 100 - 0.01 }).reason, 'amount_too_low')
  assert.equal(value({ amount: MAX_AMOUNT_CENTS / 100 + 0.01 }).reason, 'amount_too_high')
})

test('Unfug als Betrag fliegt raus', () => {
  for (const amount of ['abc', null, undefined, Number.NaN, Infinity, {}, []]) {
    const result = value({ amount })
    assert.equal(result.ok, false, `${JSON.stringify(amount)} durchgelassen`)
  }
})

test('negative Beträge werden nicht zu Guthaben', () => {
  assert.equal(value({ amount: -100 }).reason, 'amount_too_low')
})

test('Euro-Nachkommastellen werden zu Cent gerundet', () => {
  assert.equal(value({ amount: 99.99 }).order.amountCents, 9999)
  assert.equal(value({ amount: 50.005 }).order.amountCents, 5001)
})

// ── Pflichtfelder ────────────────────────────────────────────────

test('Empfänger ist Pflicht und wird beschnitten', () => {
  assert.equal(value({ recipient: '   ' }).reason, 'recipient_required')
  assert.equal(value({ recipient: '  Anna  ' }).order.recipient, 'Anna')
  assert.equal(value({ recipient: 'x'.repeat(49) }).reason, 'recipient_too_long')
})

test('E-Mail-Zustellung verlangt eine plausible Adresse', () => {
  assert.equal(value({ delivery: 'email' }).reason, 'delivery_email_invalid')
  assert.equal(value({ delivery: 'email', deliveryEmail: 'keine-mail' }).reason, 'delivery_email_invalid')
  assert.equal(value({ delivery: 'email', deliveryEmail: 'a@b.at' }).ok, true)
})

test('PDF-Zustellung verwirft eine mitgeschickte Adresse', () => {
  // Sonst landet eine Adresse im Datensatz, der niemand zugestimmt hat.
  const result = value({ delivery: 'download', deliveryEmail: 'a@b.at' })
  assert.equal(result.order.deliveryEmail, '')
})

test('unbekannte Gutschein- und Zustellarten werden abgewiesen', () => {
  assert.equal(validateOrder({ kind: 'gratis', ...base }, treatments).reason, 'invalid_kind')
  assert.equal(value({ delivery: 'brieftaube' }).reason, 'invalid_delivery')
})

test('kaputte Rümpfe stürzen nicht ab', () => {
  for (const body of [null, undefined, 'text', 42, []]) {
    const result = validateOrder(body, treatments)
    assert.equal(result.ok, false)
  }
})

test('der Steuersatz wird als Schnappschuss mitgegeben', () => {
  assert.equal(value().order.vatRateBp, 2000)
  assert.equal(value().order.currency, 'eur')
})
