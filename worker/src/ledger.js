// Kontobuch-Logik. Reine Funktionen, keine Datenbank, kein Framework.
//
// Das ist der Teil, der Geld bewegt, und deshalb der Teil, der isoliert
// testbar bleiben muss. Die Objekte haben absichtlich dieselbe Form wie
// die D1-Zeilen (snake_case), damit zwischen Abfrage und Rechnung keine
// Übersetzungsschicht sitzt, in der sich Fehler verstecken können.

/** @typedef {{ id: string, original_amount_cents: number,
 *              status: 'active'|'voided'|'refunded',
 *              expires_at: string|null }} Voucher */
/** @typedef {{ id: string, voucher_id: string, amount_cents: number,
 *              redeemed_at: string, reverses_id: string|null }} Redemption */

function assertSafeCents(value, label) {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} muss eine Ganzzahl in Cent sein, war: ${value}`)
  }
}

/** Summe aller Buchungen. Gegenbuchungen sind negativ und kürzen sich heraus. */
export function redeemedCents(redemptions) {
  let total = 0
  for (const entry of redemptions) {
    assertSafeCents(entry.amount_cents, 'amount_cents')
    total += entry.amount_cents
  }
  return total
}

/** Restwert = Ursprungsbetrag minus Kontobuch. */
export function balanceCents(voucher, redemptions) {
  assertSafeCents(voucher.original_amount_cents, 'original_amount_cents')
  return voucher.original_amount_cents - redeemedCents(redemptions)
}

function isExpired(voucher, now) {
  if (!voucher.expires_at) return false
  return Date.parse(voucher.expires_at) <= Date.parse(now)
}

/**
 * Der Zustand fürs Panel.
 *
 * Reihenfolge ist bewusst: 'voided'/'refunded' schlagen alles, ein
 * vollständig eingelöster Gutschein gilt als eingelöst und nicht als
 * abgelaufen — sonst würde ein alter, längst verbrauchter Gutschein
 * irreführend in der Abgelaufen-Liste auftauchen.
 *
 * @returns {'voided'|'refunded'|'fully_redeemed'|'expired'|'partially_redeemed'|'open'}
 */
export function voucherState(voucher, redemptions, now) {
  return stateFromBalance(voucher, balanceCents(voucher, redemptions), now)
}

/**
 * Wie voucherState, aber mit bereits bekanntem Saldo.
 *
 * Für Listen: dort liefert die View voucher_balances den Saldo pro Zeile
 * schon mit, und alle Buchungen aller Gutscheine nachzuladen, nur um ihn
 * erneut auszurechnen, wäre Unfug.
 */
export function stateFromBalance(voucher, balance, now) {
  if (voucher.status !== 'active') return voucher.status
  if (balance <= 0) return 'fully_redeemed'
  if (isExpired(voucher, now)) return 'expired'
  if (balance < voucher.original_amount_cents) return 'partially_redeemed'
  return 'open'
}

/**
 * Darf jetzt dieser Betrag abgebucht werden?
 *
 * @returns {{ ok: true, balanceCents: number, remainingAfter: number }
 *         | { ok: false, reason: string, balanceCents: number }}
 */
export function validateRedemption({ voucher, redemptions, amountCents, now }) {
  const balance = balanceCents(voucher, redemptions)
  const fail = (reason) => ({ ok: false, reason, balanceCents: balance })

  if (voucher.status !== 'active') return fail(voucher.status === 'refunded' ? 'refunded' : 'voided')
  if (!Number.isSafeInteger(amountCents)) return fail('amount_not_integer')
  if (amountCents <= 0) return fail('amount_not_positive')
  if (isExpired(voucher, now)) return fail('expired')
  if (balance <= 0) return fail('already_fully_redeemed')
  if (amountCents > balance) return fail('insufficient_balance')

  return { ok: true, balanceCents: balance, remainingAfter: balance - amountCents }
}

/**
 * Baut die einzufügende Zeile. Schreiben tut der Aufrufer — diese Ebene
 * kennt keine Datenbank.
 *
 * Der Unique-Index auf (voucher_id, idempotency_key) ist der eigentliche
 * Schutz gegen Doppelbuchung: bei einem zweiten Versuch mit demselben
 * Schlüssel schlägt das INSERT fehl, statt ein zweites Mal abzuziehen.
 */
export function buildRedemption({ id, voucherId, amountCents, staffId, note, idempotencyKey, now }) {
  assertSafeCents(amountCents, 'amountCents')
  if (amountCents <= 0) throw new RangeError('Abbuchungen müssen positiv sein')
  if (!idempotencyKey) throw new TypeError('idempotencyKey fehlt')
  if (!staffId) throw new TypeError('staffId fehlt')

  return {
    id,
    voucher_id: voucherId,
    amount_cents: amountCents,
    redeemed_at: now,
    staff_id: staffId,
    note: note ?? null,
    idempotency_key: idempotencyKey,
    reverses_id: null,
  }
}

/**
 * Darf diese Buchung zurückgenommen werden?
 *
 * Storniert wird nie durch Löschen, sondern durch eine negative
 * Gegenbuchung — die Historie bleibt damit vollständig lesbar.
 */
export function validateReversal({ voucher, redemptions, targetRedemptionId }) {
  const target = redemptions.find((entry) => entry.id === targetRedemptionId)
  if (!target) return { ok: false, reason: 'target_not_found' }
  if (target.reverses_id) return { ok: false, reason: 'target_is_reversal' }
  if (target.amount_cents <= 0) return { ok: false, reason: 'target_not_a_debit' }

  const already = redemptions.some((entry) => entry.reverses_id === targetRedemptionId)
  if (already) return { ok: false, reason: 'already_reversed' }

  if (voucher.status === 'refunded') return { ok: false, reason: 'refunded' }

  return { ok: true, amountCents: -target.amount_cents }
}

export function buildReversal({ id, voucher, redemptions, targetRedemptionId, staffId, note, idempotencyKey, now }) {
  const check = validateReversal({ voucher, redemptions, targetRedemptionId })
  if (!check.ok) throw new Error(`Gegenbuchung nicht möglich: ${check.reason}`)
  if (!idempotencyKey) throw new TypeError('idempotencyKey fehlt')
  if (!staffId) throw new TypeError('staffId fehlt')

  return {
    id,
    voucher_id: voucher.id,
    amount_cents: check.amountCents,
    redeemed_at: now,
    staff_id: staffId,
    note: note ?? null,
    idempotency_key: idempotencyKey,
    reverses_id: targetRedemptionId,
  }
}

/** Aufbereitete Sicht für Panel und API. */
export function voucherSummary(voucher, redemptions, now) {
  const redeemed = redeemedCents(redemptions)
  return {
    id: voucher.id,
    state: voucherState(voucher, redemptions, now),
    originalCents: voucher.original_amount_cents,
    redeemedCents: redeemed,
    balanceCents: voucher.original_amount_cents - redeemed,
    // Getrennt gezählt, passend zur View voucher_balances — eine
    // Gegenbuchung ist keine Einlösung, darf aber auch nicht verschwinden.
    debitCount: redemptions.filter((entry) => !entry.reverses_id).length,
    reversalCount: redemptions.filter((entry) => entry.reverses_id).length,
    expiresAt: voucher.expires_at ?? null,
  }
}
