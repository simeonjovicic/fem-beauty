// API des Betreiber-Panels.

import { error, json } from '../http.js'
import {
  buildRedemption,
  buildReversal,
  stateFromBalance,
  validateRedemption,
  validateReversal,
} from '../ledger.js'
import { parseCode } from '../codes.js'

const PAGE_SIZE = 50

function listRow(row, now) {
  return {
    id: row.id,
    code: row.code,
    kind: row.kind,
    treatmentLabel: row.treatment_label,
    recipient: row.recipient_name,
    sender: row.sender_name,
    buyerEmail: row.buyer_email,
    originalCents: row.original_amount_cents,
    balanceCents: row.balance_cents,
    redeemedCents: row.redeemed_cents,
    debitCount: row.debit_count,
    state: stateFromBalance(row, row.balance_cents, now),
    issuedAt: row.issued_at,
    lastRedeemedAt: row.last_redeemed_at,
    expiresAt: row.expires_at,
  }
}

export async function listVouchers(request, env) {
  const url = new URL(request.url)
  const now = new Date().toISOString()
  const limit = Math.min(Number(url.searchParams.get('limit')) || PAGE_SIZE, 200)
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0)
  const search = (url.searchParams.get('q') ?? '').trim()

  const where = []
  const params = []

  if (search) {
    // Der Klartext-Code wird normalisiert, damit "fem 4k7tq 9rm2x" genauso
    // findet wie "FEM-4K7TQ-9RM2X". Name und E-Mail bleiben Teilsuche.
    const parsed = parseCode(search)
    where.push('(v.code = ? OR v.recipient_name LIKE ? OR v.buyer_email LIKE ? OR v.sender_name LIKE ?)')
    params.push(parsed.ok ? parsed.display : search, `%${search}%`, `%${search}%`, `%${search}%`)
  }

  const status = url.searchParams.get('status')
  if (status === 'open') where.push("v.status = 'active' AND b.balance_cents = v.original_amount_cents")
  else if (status === 'partial') where.push("v.status = 'active' AND b.balance_cents > 0 AND b.balance_cents < v.original_amount_cents")
  else if (status === 'redeemed') where.push("v.status = 'active' AND b.balance_cents <= 0")
  else if (status === 'refunded') where.push("v.status <> 'active'")

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const { results } = await env.DB.prepare(
    `SELECT v.*, b.balance_cents, b.redeemed_cents, b.debit_count, b.last_redeemed_at
       FROM vouchers v
       JOIN voucher_balances b ON b.id = v.id
       ${clause}
      ORDER BY v.issued_at DESC
      LIMIT ? OFFSET ?`,
  ).bind(...params, limit, offset).all()

  return json({ vouchers: (results ?? []).map((row) => listRow(row, now)), limit, offset })
}

export async function getStats(env) {
  const row = await env.DB.prepare(
    `SELECT
       COUNT(*)                                                          AS total,
       COALESCE(SUM(original_amount_cents), 0)                           AS sold_cents,
       COALESCE(SUM(CASE WHEN status = 'active' THEN balance_cents END), 0) AS outstanding_cents,
       COALESCE(SUM(CASE WHEN status = 'active' THEN redeemed_cents END), 0) AS redeemed_cents,
       COALESCE(SUM(CASE WHEN status <> 'active' THEN 1 END), 0)         AS refunded_count
     FROM voucher_balances`,
  ).first()

  return json({
    total: row.total,
    soldCents: row.sold_cents,
    outstandingCents: row.outstanding_cents,
    redeemedCents: row.redeemed_cents,
    refundedCount: row.refunded_count,
  })
}

/** Gutschein per Klartext-Code oder QR-Token samt Buchungshistorie. */
export async function getVoucher(env, { code, token }) {
  let voucher
  if (token) {
    voucher = await env.DB.prepare('SELECT * FROM vouchers WHERE token = ?').bind(token).first()
  } else {
    const parsed = parseCode(code)
    if (!parsed.ok) return error('invalid_code', 400, { detail: parsed.reason })
    voucher = await env.DB.prepare('SELECT * FROM vouchers WHERE code = ?').bind(parsed.display).first()
  }

  if (!voucher) return error('not_found', 404)

  const { results } = await env.DB.prepare(
    'SELECT * FROM redemptions WHERE voucher_id = ? ORDER BY redeemed_at ASC',
  ).bind(voucher.id).all()

  const redemptions = results ?? []
  const now = new Date().toISOString()
  const balance = voucher.original_amount_cents
    - redemptions.reduce((sum, entry) => sum + entry.amount_cents, 0)

  return json({
    voucher: {
      ...listRow({ ...voucher, balance_cents: balance }, now),
      message: voucher.message,
      delivery: voucher.delivery,
      deliveryEmail: voucher.delivery_email,
      stripeSessionId: voucher.stripe_session_id,
      voidedAt: voucher.voided_at,
      voidReason: voucher.void_reason,
    },
    redemptions: redemptions.map((entry) => ({
      id: entry.id,
      amountCents: entry.amount_cents,
      redeemedAt: entry.redeemed_at,
      staffId: entry.staff_id,
      note: entry.note,
      reversesId: entry.reverses_id,
    })),
  })
}

/**
 * Abbuchen.
 *
 * Die Prüfung in JS liefert die verständliche Begründung, aber sie
 * entscheidet nicht: das INSERT trägt seine eigene Bedingung. Zwei
 * gleichzeitige Abbuchungen an zwei Geräten könnten sonst beide einen
 * Saldo von 50 lesen und je 50 abziehen. SQLite führt ein einzelnes
 * Statement atomar aus, also gehören Prüfung und Schreiben in eines.
 */
export async function redeemVoucher(request, env, identity, voucherId) {
  let body
  try {
    body = await request.json()
  } catch {
    return error('invalid_json')
  }

  const amountCents = Number(body.amountCents)
  const idempotencyKey = String(body.idempotencyKey ?? '').trim()
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) : null
  if (!idempotencyKey) return error('idempotency_key_required')

  const voucher = await env.DB.prepare('SELECT * FROM vouchers WHERE id = ?').bind(voucherId).first()
  if (!voucher) return error('not_found', 404)

  const { results } = await env.DB.prepare(
    'SELECT * FROM redemptions WHERE voucher_id = ?',
  ).bind(voucherId).all()
  const redemptions = results ?? []
  const now = new Date().toISOString()

  const check = validateRedemption({ voucher, redemptions, amountCents, now })
  if (!check.ok) return error(check.reason, 409, { balanceCents: check.balanceCents })

  const row = buildRedemption({
    id: crypto.randomUUID(),
    voucherId,
    amountCents,
    staffId: identity.email,
    note,
    idempotencyKey,
    now,
  })

  let result
  try {
    result = await env.DB.prepare(
      `INSERT INTO redemptions
         (id, voucher_id, amount_cents, redeemed_at, staff_id, note, idempotency_key, reverses_id)
       SELECT ?, ?, ?, ?, ?, ?, ?, NULL
         FROM vouchers v
        WHERE v.id = ?
          AND v.status = 'active'
          AND (v.expires_at IS NULL OR v.expires_at > ?)
          AND v.original_amount_cents
              - COALESCE((SELECT SUM(amount_cents) FROM redemptions WHERE voucher_id = ?), 0) >= ?`,
    ).bind(
      row.id, row.voucher_id, row.amount_cents, row.redeemed_at,
      row.staff_id, row.note, row.idempotency_key,
      voucherId, now, voucherId, amountCents,
    ).run()
  } catch (err) {
    if (/UNIQUE constraint failed/i.test(String(err.message))) {
      // Derselbe Vorgang ein zweites Mal — Doppelklick oder Wiederholung.
      // Kein Fehler, der Zustand stimmt bereits.
      return json({ ok: true, duplicate: true, balanceCents: check.balanceCents })
    }
    throw err
  }

  if ((result.meta?.changes ?? 0) === 0) {
    // JS sagte ja, die Datenbank nein: dazwischen hat jemand anderes gebucht.
    return error('concurrent_modification', 409)
  }

  return json({
    ok: true,
    redemptionId: row.id,
    amountCents,
    balanceCents: check.remainingAfter,
    staffId: identity.email,
  })
}

/** Gegenbuchung — korrigiert eine Fehleingabe, ohne die Historie zu verlieren. */
export async function reverseRedemption(request, env, identity, redemptionId) {
  let body
  try {
    body = await request.json()
  } catch {
    return error('invalid_json')
  }

  const idempotencyKey = String(body.idempotencyKey ?? '').trim()
  if (!idempotencyKey) return error('idempotency_key_required')

  const target = await env.DB.prepare('SELECT * FROM redemptions WHERE id = ?')
    .bind(redemptionId).first()
  if (!target) return error('not_found', 404)

  const voucher = await env.DB.prepare('SELECT * FROM vouchers WHERE id = ?')
    .bind(target.voucher_id).first()
  const { results } = await env.DB.prepare('SELECT * FROM redemptions WHERE voucher_id = ?')
    .bind(target.voucher_id).all()

  const check = validateReversal({ voucher, redemptions: results ?? [], targetRedemptionId: redemptionId })
  if (!check.ok) return error(check.reason, 409)

  const now = new Date().toISOString()
  const row = buildReversal({
    id: crypto.randomUUID(),
    voucher,
    redemptions: results ?? [],
    targetRedemptionId: redemptionId,
    staffId: identity.email,
    note: typeof body.note === 'string' ? body.note.trim().slice(0, 200) : null,
    idempotencyKey,
    now,
  })

  try {
    await env.DB.prepare(
      `INSERT INTO redemptions
         (id, voucher_id, amount_cents, redeemed_at, staff_id, note, idempotency_key, reverses_id)
       VALUES (?,?,?,?,?,?,?,?)`,
    ).bind(
      row.id, row.voucher_id, row.amount_cents, row.redeemed_at,
      row.staff_id, row.note, row.idempotency_key, row.reverses_id,
    ).run()
  } catch (err) {
    if (/UNIQUE constraint failed/i.test(String(err.message))) {
      return json({ ok: true, duplicate: true })
    }
    throw err
  }

  return json({ ok: true, reversalId: row.id, amountCents: row.amount_cents })
}
