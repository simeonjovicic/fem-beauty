// Verbindliche Preis- und Gültigkeitsprüfung.
//
// Importiert bewusst aus src/data.js — dieselbe Datei, aus der das Frontend
// die Anzeige speist. Eine Quelle statt zweier, die auseinanderdriften.
//
// Dass diese Datei auch an den Browser ausgeliefert wird, ist unkritisch:
// der Worker liest zur Laufzeit seine eigene gebündelte Kopie. Wer im
// Browser Preise manipuliert, ändert nur, was er *sendet* — und genau das
// glaubt der Server ihm nie.

import {
  VOUCHER_MAX_AMOUNT,
  VOUCHER_MAX_MESSAGE_LENGTH,
  VOUCHER_MIN_AMOUNT,
  voucherTreatments,
} from '../../src/data.js'

export const MIN_AMOUNT_CENTS = VOUCHER_MIN_AMOUNT * 100
export const MAX_AMOUNT_CENTS = VOUCHER_MAX_AMOUNT * 100
export const MAX_MESSAGE_LENGTH = VOUCHER_MAX_MESSAGE_LENGTH
export const CURRENCY = 'eur'

// Kosmetikleistungen in Österreich: 20 %. Wird pro Gutschein als
// Schnappschuss gespeichert, nicht zur Laufzeit nachgeschlagen.
export const VAT_RATE_BP = 2000

export function findTreatment(treatmentId) {
  return voucherTreatments.find((treatment) => treatment.id === treatmentId) ?? null
}

/** Behandlungspreis in Cent. Der Client sendet nie einen Preis, nur eine ID. */
export function treatmentPriceCents(treatment) {
  return Math.round(treatment.price * 100)
}

export function treatmentLabel(treatment) {
  return `${treatment.title} · ${treatment.variant}`
}

/**
 * Prüft die Kaufanfrage und bestimmt den Betrag serverseitig.
 *
 * @returns {{ ok: true, order: object } | { ok: false, reason: string, field?: string }}
 */
export function validateOrder(input) {
  const fail = (reason, field) => ({ ok: false, reason, field })

  if (!input || typeof input !== 'object') return fail('invalid_body')

  const kind = input.kind
  if (kind !== 'value' && kind !== 'treatment') return fail('invalid_kind', 'kind')

  let amountCents
  let treatment = null

  if (kind === 'treatment') {
    treatment = findTreatment(input.treatmentId)
    if (!treatment) return fail('unknown_treatment', 'treatmentId')
    amountCents = treatmentPriceCents(treatment)
  } else {
    // Euro-Zahl vom Client, aber nur als Wunsch — Grenzen entscheidet der Server.
    const euros = Number(input.amount)
    if (!Number.isFinite(euros)) return fail('invalid_amount', 'amount')
    amountCents = Math.round(euros * 100)
    if (!Number.isSafeInteger(amountCents)) return fail('invalid_amount', 'amount')
    if (amountCents < MIN_AMOUNT_CENTS) return fail('amount_too_low', 'amount')
    if (amountCents > MAX_AMOUNT_CENTS) return fail('amount_too_high', 'amount')
  }

  const recipient = trimmed(input.recipient)
  if (!recipient) return fail('recipient_required', 'recipient')
  if (recipient.length > 48) return fail('recipient_too_long', 'recipient')

  const sender = trimmed(input.sender)
  if (sender.length > 48) return fail('sender_too_long', 'sender')

  const message = trimmed(input.message)
  if (message.length > MAX_MESSAGE_LENGTH) return fail('message_too_long', 'message')

  const delivery = input.delivery
  if (delivery !== 'download' && delivery !== 'email') return fail('invalid_delivery', 'delivery')

  const deliveryEmail = trimmed(input.deliveryEmail)
  if (delivery === 'email' && !isEmail(deliveryEmail)) {
    return fail('delivery_email_invalid', 'deliveryEmail')
  }

  // Wohin die Kaufbestätigung geht. Stripe erfragt die Adresse ohnehin im
  // Checkout; dieser Wert ist die Vorbelegung und der Fallback.
  const buyerEmail = trimmed(input.buyerEmail)
  if (buyerEmail && !isEmail(buyerEmail)) return fail('buyer_email_invalid', 'buyerEmail')

  return {
    ok: true,
    order: {
      kind,
      treatmentId: treatment?.id ?? null,
      treatmentLabel: treatment ? treatmentLabel(treatment) : null,
      amountCents,
      currency: CURRENCY,
      vatRateBp: VAT_RATE_BP,
      recipient,
      sender,
      message,
      delivery,
      deliveryEmail: delivery === 'email' ? deliveryEmail : '',
      buyerEmail,
    },
  }
}

function trimmed(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)
}

/** Was der Kunde bei Stripe als Position sieht. */
export function lineItemName(order) {
  return order.kind === 'treatment'
    ? `FEM Behandlungsgutschein — ${order.treatmentLabel}`
    : 'FEM Wertgutschein'
}
