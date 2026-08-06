// POST /api/stripe/webhook
//
// Hier entsteht der Gutschein — nicht auf der Erfolgsseite. Die kann der
// Kunde schließen, neu laden oder nie erreichen. Der Webhook kommt trotzdem,
// und er kommt notfalls mehrfach: Stripe wiederholt bei jedem Nicht-2xx.
// Deshalb ist jeder Pfad hier idempotent.

import { CURRENCY, VAT_RATE_BP } from './catalog.js'
import { json } from './http.js'
import { createVoucherForSession, voidVoucher } from './vouchers.js'

/**
 * Baut die Bestellung aus den Session-Metadaten zurück.
 *
 * Der Betrag kommt dabei ausdrücklich NICHT aus den Metadaten, sondern aus
 * amount_total — also aus dem, was tatsächlich bezahlt wurde. Ein Gutschein
 * über den bezahlten Betrag ist immer richtig, egal was im Transport stand.
 */
function orderFromSession(session) {
  const meta = session.metadata ?? {}
  return {
    kind: meta.kind === 'treatment' ? 'treatment' : 'value',
    treatmentId: meta.treatment_id || null,
    treatmentLabel: meta.treatment_label || null,
    amountCents: session.amount_total,
    currency: session.currency ?? 'eur',
    vatRateBp: Number(meta.vat_rate_bp) || VAT_RATE_BP,
    recipient: meta.recipient ?? '',
    sender: meta.sender ?? '',
    message: meta.message ?? '',
    delivery: meta.delivery === 'email' ? 'email' : 'download',
    deliveryEmail: meta.delivery_email ?? '',
    buyerEmail: session.customer_details?.email || session.customer_email || meta.delivery_email || '',
  }
}

async function issueVoucher(env, session, now) {
  const order = orderFromSession(session)

  if (!Number.isSafeInteger(order.amountCents) || order.amountCents <= 0) {
    // Kein Retry-Grund — wiederholen würde nichts ändern.
    console.error('webhook: unbrauchbarer amount_total', session.id, session.amount_total)
    return { skipped: 'invalid_amount' }
  }

  // Das Kontobuch kennt keine Währungsumrechnung: original_amount_cents
  // und jede Abbuchung sind implizit dieselbe Währung. Käme hier etwas
  // anderes als Euro an, entstünde ein Gutschein, dessen Betrag stillschweigend
  // falsch interpretiert wird. Unser Checkout erzeugt ausschließlich EUR —
  // alles andere ist ein Fehler und darf keinen Gutschein erzeugen.
  if (order.currency?.toLowerCase() !== CURRENCY) {
    console.error(
      `webhook: ${session.id} in ${order.currency} statt ${CURRENCY} — kein Gutschein angelegt`,
    )
    return { skipped: 'unexpected_currency', currency: order.currency }
  }

  // Abweichung ist kein Abbruchgrund (bezahlt ist bezahlt), aber sie muss
  // sichtbar sein: sie bedeutet, dass Session-Erzeugung und Zahlung
  // auseinanderliefen.
  const declared = Number(session.metadata?.amount_cents)
  if (Number.isFinite(declared) && declared !== order.amountCents) {
    console.warn(
      `webhook: Betrag weicht ab für ${session.id} — Metadaten ${declared}, bezahlt ${order.amountCents}`,
    )
  }

  if (!order.buyerEmail) {
    console.warn('webhook: keine Käufer-E-Mail an', session.id)
  }

  const { created, voucher } = await createVoucherForSession(env.DB, {
    sessionId: session.id,
    paymentIntentId: typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id ?? null,
    order: { ...order, buyerEmail: order.buyerEmail || 'unbekannt@fembeauty.at' },
    now,
  })

  console.log(
    created
      ? `webhook: Gutschein ${voucher.code} angelegt (${order.amountCents} Cent)`
      : `webhook: ${session.id} war bereits verarbeitet — ${voucher.code}`,
  )

  // TODO(Schritt 3): PDF erzeugen und per Resend versenden.
  return { created, code: voucher.code }
}

export async function handleWebhook(request, env, stripe) {
  const signature = request.headers.get('stripe-signature')
  if (!signature) return json({ error: 'missing_signature' }, 400)
  if (!env.STRIPE_WEBHOOK_SECRET) {
    console.error('webhook: STRIPE_WEBHOOK_SECRET ist nicht gesetzt')
    return json({ error: 'not_configured' }, 500)
  }

  // Der Rohtext muss unverändert in die Signaturprüfung — nicht erst
  // parsen und wieder serialisieren, das ändert Whitespace und Reihenfolge.
  const payload = await request.text()

  let event
  try {
    event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    )
  } catch (err) {
    // Ungültige Signatur: nicht wiederholen lassen, 400 ist endgültig.
    console.error('webhook: Signatur ungültig —', err.message)
    return json({ error: 'invalid_signature' }, 400)
  }

  const now = new Date().toISOString()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        // Bei asynchronen Zahlungsarten (SEPA-Lastschrift, Klarna) ist hier
        // noch nichts eingegangen. Dann kommt später async_payment_succeeded.
        if (session.payment_status !== 'paid') {
          console.log(`webhook: ${session.id} noch nicht bezahlt (${session.payment_status})`)
          return json({ received: true, pending: true })
        }
        return json({ received: true, ...(await issueVoucher(env, session, now)) })
      }

      case 'checkout.session.async_payment_succeeded':
        return json({ received: true, ...(await issueVoucher(env, event.data.object, now)) })

      case 'checkout.session.async_payment_failed':
        console.log('webhook: asynchrone Zahlung fehlgeschlagen', event.data.object.id)
        return json({ received: true })

      case 'charge.refunded': {
        const charge = event.data.object
        const changed = await voidVoucher(env.DB, {
          paymentIntentId: typeof charge.payment_intent === 'string'
            ? charge.payment_intent
            : charge.payment_intent?.id ?? null,
          reason: 'Stripe-Rückerstattung',
          now,
        })
        console.log(`webhook: Rückerstattung — ${changed} Gutschein(e) storniert`)
        return json({ received: true, voided: changed })
      }

      default:
        return json({ received: true, ignored: event.type })
    }
  } catch (err) {
    // 500 heißt: Stripe soll es nochmal versuchen. Richtig bei einem
    // Datenbankausfall, und dank Idempotenz harmlos.
    console.error(`webhook: ${event.type} fehlgeschlagen —`, err.stack ?? err.message)
    return json({ error: 'handler_failed' }, 500)
  }
}
