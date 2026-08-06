// Anlegen und Nachschlagen von Gutscheinen. Alles, was in die Datenbank
// schreibt, lebt hier — ledger.js bleibt frei von D1.

import { createCode, generateToken } from './codes.js'

function randomBytes(length) {
  return crypto.getRandomValues(new Uint8Array(length))
}

function isUniqueViolation(error) {
  return /UNIQUE constraint failed/i.test(String(error?.message ?? error))
}

export function findVoucherBySession(db, stripeSessionId) {
  return db
    .prepare('SELECT * FROM vouchers WHERE stripe_session_id = ?')
    .bind(stripeSessionId)
    .first()
}

export function findVoucherByCode(db, code) {
  return db.prepare('SELECT * FROM vouchers WHERE code = ?').bind(code).first()
}

export function findVoucherByToken(db, token) {
  return db.prepare('SELECT * FROM vouchers WHERE token = ?').bind(token).first()
}

export function listRedemptions(db, voucherId) {
  return db
    .prepare('SELECT * FROM redemptions WHERE voucher_id = ? ORDER BY redeemed_at ASC')
    .bind(voucherId)
    .all()
    .then((result) => result.results ?? [])
}

/**
 * Legt den Gutschein zu einer bezahlten Checkout-Session an.
 *
 * Idempotent in zwei Stufen: erst die Vorabprüfung, dann der Unique-Index
 * auf stripe_session_id als Absicherung gegen zwei gleichzeitig
 * eintreffende Webhook-Zustellungen. Stripe wiederholt Webhooks, das ist
 * kein Randfall.
 *
 * @returns {{ created: boolean, voucher: object }}
 */
export async function createVoucherForSession(db, { sessionId, paymentIntentId, order, now }) {
  const existing = await findVoucherBySession(db, sessionId)
  if (existing) return { created: false, voucher: existing }

  const maxAttempts = 5
  let lastError

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const voucher = {
      id: crypto.randomUUID(),
      code: createCode(randomBytes),
      token: generateToken(randomBytes(24)),
      kind: order.kind,
      treatment_id: order.treatmentId,
      treatment_label: order.treatmentLabel,
      original_amount_cents: order.amountCents,
      currency: order.currency.toUpperCase(),
      vat_rate_bp: order.vatRateBp,
      tax_point: 'sale',
      status: 'active',
      recipient_name: order.recipient || null,
      sender_name: order.sender || null,
      message: order.message || null,
      delivery: order.delivery,
      delivery_email: order.delivery === 'email' ? order.deliveryEmail : null,
      buyer_email: order.buyerEmail,
      stripe_session_id: sessionId,
      stripe_payment_intent: paymentIntentId ?? null,
      issued_at: now,
      // Kein Verfall, bis die Rechtsauskunft etwas anderes sagt.
      expires_at: null,
    }

    try {
      await db
        .prepare(
          `INSERT INTO vouchers (
             id, code, token, kind, treatment_id, treatment_label,
             original_amount_cents, currency, vat_rate_bp, tax_point, status,
             recipient_name, sender_name, message, delivery, delivery_email,
             buyer_email, stripe_session_id, stripe_payment_intent,
             issued_at, expires_at
           ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .bind(
          voucher.id, voucher.code, voucher.token, voucher.kind,
          voucher.treatment_id, voucher.treatment_label,
          voucher.original_amount_cents, voucher.currency, voucher.vat_rate_bp,
          voucher.tax_point, voucher.status,
          voucher.recipient_name, voucher.sender_name, voucher.message,
          voucher.delivery, voucher.delivery_email,
          voucher.buyer_email, voucher.stripe_session_id, voucher.stripe_payment_intent,
          voucher.issued_at, voucher.expires_at,
        )
        .run()

      return { created: true, voucher }
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
      lastError = error

      // Zwei mögliche Ursachen, und sie verlangen Gegenteiliges: eine
      // parallele Webhook-Zustellung (fertig) oder eine Code-Kollision
      // (neu würfeln). Die Session entscheidet, welche es war.
      const raced = await findVoucherBySession(db, sessionId)
      if (raced) return { created: false, voucher: raced }
    }
  }

  throw new Error(`Gutschein konnte nicht angelegt werden: ${lastError?.message}`)
}

/** Storniert einen Gutschein, etwa nach einer Rückerstattung bei Stripe. */
export async function voidVoucher(db, { stripeSessionId, paymentIntentId, reason, now }) {
  const result = await db
    .prepare(
      `UPDATE vouchers
          SET status = 'refunded', voided_at = ?, void_reason = ?
        WHERE (stripe_session_id = ? OR stripe_payment_intent = ?)
          AND status = 'active'`,
    )
    .bind(now, reason, stripeSessionId ?? '', paymentIntentId ?? '')
    .run()

  return result.meta?.changes ?? 0
}
