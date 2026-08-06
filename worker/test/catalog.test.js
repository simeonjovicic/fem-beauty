import assert from 'node:assert/strict'
import test from 'node:test'
import { voucherTreatments } from '../../src/data.js'
import {
  MAX_AMOUNT_CENTS,
  MIN_AMOUNT_CENTS,
  treatmentPriceCents,
  validateOrder,
} from '../src/catalog.js'

const base = { recipient: 'Anna', delivery: 'download' }
const value = (extra = {}) => validateOrder({ kind: 'value', amount: 100, ...base, ...extra })

// ── Preishoheit ──────────────────────────────────────────────────

test('der Client kann den Behandlungspreis nicht diktieren', () => {
  // Genau der Angriff: gültige Behandlung, mitgeschickter Wunschpreis.
  const result = validateOrder({
    kind: 'treatment',
    treatmentId: 'japanische-manikuere',
    amount: 1,
    amountCents: 1,
    price: 1,
    ...base,
  })
  assert.equal(result.ok, true)
  assert.equal(result.order.amountCents, 3800)
})

test('erfundene Behandlungen werden abgewiesen', () => {
  const result = validateOrder({ kind: 'treatment', treatmentId: 'gratis-hack', ...base })
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'unknown_treatment')
})

test('jeder Katalogpreis ergibt ganze Cent', () => {
  for (const treatment of voucherTreatments) {
    const cents = treatmentPriceCents(treatment)
    assert.ok(Number.isSafeInteger(cents), `${treatment.id}: ${cents}`)
    assert.equal(cents, treatment.price * 100)
    assert.ok(cents > 0)
  }
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
  assert.equal(validateOrder({ kind: 'gratis', ...base }).reason, 'invalid_kind')
  assert.equal(value({ delivery: 'brieftaube' }).reason, 'invalid_delivery')
})

test('kaputte Rümpfe stürzen nicht ab', () => {
  for (const body of [null, undefined, 'text', 42, []]) {
    const result = validateOrder(body)
    assert.equal(result.ok, false)
  }
})

test('der Steuersatz wird als Schnappschuss mitgegeben', () => {
  assert.equal(value().order.vatRateBp, 2000)
  assert.equal(value().order.currency, 'eur')
})
