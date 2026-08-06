import assert from 'node:assert/strict'
import test from 'node:test'
import {
  balanceCents,
  buildRedemption,
  buildReversal,
  validateRedemption,
  validateReversal,
  voucherState,
  voucherSummary,
} from '../src/ledger.js'

const NOW = '2026-08-06T10:00:00.000Z'

function voucher(overrides = {}) {
  return {
    id: 'v1',
    original_amount_cents: 10000, // 100,00 €
    status: 'active',
    expires_at: null,
    ...overrides,
  }
}

function debit(id, amountCents, at = NOW) {
  return { id, voucher_id: 'v1', amount_cents: amountCents, redeemed_at: at, reverses_id: null }
}

function credit(id, amountCents, reversesId, at = NOW) {
  return { id, voucher_id: 'v1', amount_cents: amountCents, redeemed_at: at, reverses_id: reversesId }
}

// ── Saldo ────────────────────────────────────────────────────────

test('unbenutzter Gutschein hat den vollen Betrag', () => {
  assert.equal(balanceCents(voucher(), []), 10000)
  assert.equal(voucherState(voucher(), [], NOW), 'open')
})

test('Teileinlösungen summieren sich', () => {
  const entries = [debit('r1', 3000), debit('r2', 2500)]
  assert.equal(balanceCents(voucher(), entries), 4500)
  assert.equal(voucherState(voucher(), entries, NOW), 'partially_redeemed')
})

test('exakte Vollausschöpfung landet auf null', () => {
  const entries = [debit('r1', 4000), debit('r2', 6000)]
  assert.equal(balanceCents(voucher(), entries), 0)
  assert.equal(voucherState(voucher(), entries, NOW), 'fully_redeemed')
})

// ── Abbuchen ─────────────────────────────────────────────────────

test('Abbuchung bis exakt zum Restwert ist erlaubt', () => {
  const entries = [debit('r1', 7000)]
  const result = validateRedemption({ voucher: voucher(), redemptions: entries, amountCents: 3000, now: NOW })
  assert.equal(result.ok, true)
  assert.equal(result.remainingAfter, 0)
})

test('Überziehen wird abgelehnt — auch um einen Cent', () => {
  const entries = [debit('r1', 7000)]
  const result = validateRedemption({ voucher: voucher(), redemptions: entries, amountCents: 3001, now: NOW })
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'insufficient_balance')
  assert.equal(result.balanceCents, 3000)
})

test('null und negative Beträge werden abgelehnt', () => {
  for (const amountCents of [0, -1, -5000]) {
    const result = validateRedemption({ voucher: voucher(), redemptions: [], amountCents, now: NOW })
    assert.equal(result.ok, false)
    assert.equal(result.reason, 'amount_not_positive')
  }
})

test('Nachkommastellen werden abgelehnt statt gerundet', () => {
  const result = validateRedemption({ voucher: voucher(), redemptions: [], amountCents: 10.5, now: NOW })
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'amount_not_integer')
})

test('bereits ausgeschöpfter Gutschein lässt nichts mehr zu', () => {
  const entries = [debit('r1', 10000)]
  const result = validateRedemption({ voucher: voucher(), redemptions: entries, amountCents: 100, now: NOW })
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'already_fully_redeemed')
})

test('stornierter und rückerstatteter Gutschein sind gesperrt', () => {
  for (const [status, reason] of [['voided', 'voided'], ['refunded', 'refunded']]) {
    const v = voucher({ status, voided_at: NOW })
    const result = validateRedemption({ voucher: v, redemptions: [], amountCents: 1000, now: NOW })
    assert.equal(result.ok, false)
    assert.equal(result.reason, reason)
    assert.equal(voucherState(v, [], NOW), status)
  }
})

// ── Verfall ──────────────────────────────────────────────────────

test('abgelaufener Gutschein lässt nichts mehr zu', () => {
  const v = voucher({ expires_at: '2026-08-06T09:59:59.000Z' })
  const result = validateRedemption({ voucher: v, redemptions: [], amountCents: 1000, now: NOW })
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'expired')
  assert.equal(voucherState(v, [], NOW), 'expired')
})

test('expires_at = null bedeutet kein Verfall', () => {
  const v = voucher({ expires_at: null })
  const inTenYears = '2036-08-06T10:00:00.000Z'
  assert.equal(voucherState(v, [], inTenYears), 'open')
  assert.equal(validateRedemption({ voucher: v, redemptions: [], amountCents: 1000, now: inTenYears }).ok, true)
})

test('ausgeschöpft schlägt abgelaufen — sonst landet er in der falschen Liste', () => {
  const v = voucher({ expires_at: '2026-01-01T00:00:00.000Z' })
  assert.equal(voucherState(v, [debit('r1', 10000)], NOW), 'fully_redeemed')
})

// ── Gegenbuchung ─────────────────────────────────────────────────

test('Gegenbuchung stellt den Restwert wieder her', () => {
  const entries = [debit('r1', 3000)]
  const reversal = buildReversal({
    id: 'r2',
    voucher: voucher(),
    redemptions: entries,
    targetRedemptionId: 'r1',
    staffId: 'jenny@fembeauty.at',
    idempotencyKey: 'k-2',
    now: NOW,
  })
  assert.equal(reversal.amount_cents, -3000)
  assert.equal(reversal.reverses_id, 'r1')
  assert.equal(balanceCents(voucher(), [...entries, reversal]), 10000)
  assert.equal(voucherState(voucher(), [...entries, reversal], NOW), 'open')
})

test('dieselbe Buchung lässt sich nicht zweimal zurücknehmen', () => {
  const entries = [debit('r1', 3000), credit('r2', -3000, 'r1')]
  const result = validateReversal({ voucher: voucher(), redemptions: entries, targetRedemptionId: 'r1' })
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'already_reversed')
})

test('eine Gegenbuchung selbst kann nicht zurückgenommen werden', () => {
  const entries = [debit('r1', 3000), credit('r2', -3000, 'r1')]
  const result = validateReversal({ voucher: voucher(), redemptions: entries, targetRedemptionId: 'r2' })
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'target_is_reversal')
})

test('unbekannte Buchung wird abgelehnt', () => {
  const result = validateReversal({ voucher: voucher(), redemptions: [], targetRedemptionId: 'gibtsnicht' })
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'target_not_found')
})

// ── Zeilenbau ────────────────────────────────────────────────────

test('buildRedemption verlangt Personal und Idempotenzschlüssel', () => {
  const base = { id: 'r1', voucherId: 'v1', amountCents: 1000, now: NOW }
  assert.throws(() => buildRedemption({ ...base, staffId: 'a' }), /idempotencyKey/)
  assert.throws(() => buildRedemption({ ...base, idempotencyKey: 'k' }), /staffId/)
  assert.throws(
    () => buildRedemption({ ...base, amountCents: -5, staffId: 'a', idempotencyKey: 'k' }),
    /positiv/,
  )
})

test('buildRedemption erzeugt eine einfügbare Zeile', () => {
  const row = buildRedemption({
    id: 'r1',
    voucherId: 'v1',
    amountCents: 2500,
    staffId: 'jenny@fembeauty.at',
    note: 'Head Spa',
    idempotencyKey: 'k-1',
    now: NOW,
  })
  assert.deepEqual(row, {
    id: 'r1',
    voucher_id: 'v1',
    amount_cents: 2500,
    redeemed_at: NOW,
    staff_id: 'jenny@fembeauty.at',
    note: 'Head Spa',
    idempotency_key: 'k-1',
    reverses_id: null,
  })
})

// ── Panel-Sicht ──────────────────────────────────────────────────

test('voucherSummary zählt Gegenbuchungen nicht als Einlösung', () => {
  const entries = [debit('r1', 3000), debit('r2', 2000), credit('r3', -3000, 'r1')]
  const summary = voucherSummary(voucher(), entries, NOW)
  assert.equal(summary.balanceCents, 8000)
  assert.equal(summary.redeemedCents, 2000)
  // Muss mit der View voucher_balances übereinstimmen — siehe schema-check.
  assert.equal(summary.debitCount, 2)
  assert.equal(summary.reversalCount, 1)
  assert.equal(summary.state, 'partially_redeemed')
})

test('unbenutzter Gutschein zählt nichts — auch nicht versehentlich eins', () => {
  const summary = voucherSummary(voucher(), [], NOW)
  assert.equal(summary.debitCount, 0)
  assert.equal(summary.reversalCount, 0)
  assert.equal(summary.balanceCents, 10000)
})

test('kaputte Beträge fliegen auf, statt still falsch zu rechnen', () => {
  assert.throws(() => balanceCents(voucher({ original_amount_cents: 1.5 }), []), TypeError)
  assert.throws(() => balanceCents(voucher(), [debit('r1', Number.NaN)]), TypeError)
})
