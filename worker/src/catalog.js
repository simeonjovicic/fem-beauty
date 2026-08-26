// Verbindliche Preis- und Gültigkeitsprüfung.
//
// Die Preise kommen aus der Tabelle `treatments`, nicht mehr aus
// src/data.js. Vorher war eine Preisänderung ein Commit, und was im Panel
// bearbeitet wurde, lag im localStorage des Browsers — der Server sah es
// nie. Damit konnte der Shop einen Preis anzeigen, den Stripe nicht
// abbucht.
//
// Betragsgrenzen und Steuersatz bleiben im Code: sie gehören nicht zu
// einer einzelnen Behandlung, und ihre Änderung ist eine Entscheidung,
// die einen Commit verdient.
//
// validateOrder bekommt die Behandlungen übergeben, statt sie selbst zu
// laden. So bleibt die Prüfung eine reine Funktion — testbar ohne
// Datenbank, und der Aufrufer macht genau eine Abfrage.

import {
  VOUCHER_MAX_AMOUNT,
  VOUCHER_MAX_MESSAGE_LENGTH,
  VOUCHER_MIN_AMOUNT,
} from '../../src/data.js'

export const MIN_AMOUNT_CENTS = VOUCHER_MIN_AMOUNT * 100
export const MAX_AMOUNT_CENTS = VOUCHER_MAX_AMOUNT * 100
export const MAX_MESSAGE_LENGTH = VOUCHER_MAX_MESSAGE_LENGTH
export const CURRENCY = 'eur'

// Kosmetikleistungen in Österreich: 20 %. Wird pro Gutschein als
// Schnappschuss gespeichert, nicht zur Laufzeit nachgeschlagen.
export const VAT_RATE_BP = 2000

/**
 * Behandlungen aus der Datenbank.
 *
 * @param {'shop'|'all'} scope  'shop' liefert nur, was im Konfigurator
 *   zur Auswahl steht; 'all' zusätzlich die ausgeblendeten, damit das
 *   Panel sie wieder einschalten kann.
 */
export function listTreatments(db, scope = 'shop') {
  const where = scope === 'all' ? '' : 'WHERE shop_visible = 1'
  return db
    .prepare(`SELECT * FROM treatments ${where} ORDER BY sort_order ASC, title ASC`)
    .all()
    .then((result) => result.results ?? [])
}

export function findTreatment(treatments, treatmentId) {
  return treatments.find((treatment) => treatment.id === treatmentId) ?? null
}

export function treatmentLabel(treatment) {
  return treatment.variant ? `${treatment.title} · ${treatment.variant}` : treatment.title
}

/**
 * Prüft die Kaufanfrage und bestimmt den Betrag serverseitig.
 *
 * @param {object} input       was der Client geschickt hat
 * @param {object[]} treatments  die im Shop wählbaren Behandlungen
 * @returns {{ ok: true, order: object } | { ok: false, reason: string, field?: string }}
 */
export function validateOrder(input, treatments = []) {
  const fail = (reason, field) => ({ ok: false, reason, field })

  if (!input || typeof input !== 'object') return fail('invalid_body')

  const kind = input.kind
  if (kind !== 'value' && kind !== 'treatment') return fail('invalid_kind', 'kind')

  let amountCents
  let treatment = null

  if (kind === 'treatment') {
    treatment = findTreatment(treatments, input.treatmentId)
    if (!treatment) return fail('unknown_treatment', 'treatmentId')
    amountCents = treatment.price_cents
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
      return fail('invalid_treatment_price', 'treatmentId')
    }
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
      // Schnappschuss: der Gutschein soll den Namen tragen, der beim Kauf
      // galt — auch wenn die Behandlung später umbenannt wird.
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
