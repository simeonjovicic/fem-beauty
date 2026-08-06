// POST /api/checkout — erzeugt eine Stripe Checkout Session.
//
// Der Client schickt eine Absicht, keinen Preis. Betrag und Behandlung
// bestimmt validateOrder serverseitig; was im Request an Zahlen steht,
// wird höchstens als Wunsch gelesen und gegen die Grenzen geprüft.

import { CURRENCY, lineItemName, validateOrder } from './catalog.js'
import { error, json } from './http.js'

/**
 * Die Bestellung reist als Session-Metadaten mit, damit der Webhook den
 * Gutschein daraus bauen kann, ohne eine eigene Tabelle für schwebende
 * Bestellungen zu brauchen.
 *
 * Wichtig: der Betrag steht zwar in den Metadaten, ist aber nicht die
 * Quelle der Wahrheit — der Webhook prüft ihn gegen amount_total der
 * bezahlten Session. Metadaten sind nur Transport.
 */
function toMetadata(order) {
  return {
    kind: order.kind,
    treatment_id: order.treatmentId ?? '',
    treatment_label: order.treatmentLabel ?? '',
    amount_cents: String(order.amountCents),
    vat_rate_bp: String(order.vatRateBp),
    recipient: order.recipient,
    sender: order.sender,
    message: order.message,
    delivery: order.delivery,
    delivery_email: order.deliveryEmail,
  }
}

export async function handleCheckout(request, env, stripe) {
  let body
  try {
    body = await request.json()
  } catch {
    return error('invalid_json')
  }

  const validation = validateOrder(body)
  if (!validation.ok) return error(validation.reason, 400, { field: validation.field })

  const { order } = validation

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    // Stripe blendet ein, was im Land verfügbar ist — in Österreich also
    // auch EPS, ohne dass wir Zahlungsarten hier pflegen müssen.
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          unit_amount: order.amountCents,
          product_data: {
            name: lineItemName(order),
            description: order.recipient ? `Für ${order.recipient}` : undefined,
          },
        },
      },
    ],
    ...(order.buyerEmail ? { customer_email: order.buyerEmail } : {}),
    metadata: toMetadata(order),
    // Damit die Metadaten auch am PaymentIntent hängen — nützlich bei
    // Rückerstattungen, die nur den PaymentIntent referenzieren.
    payment_intent_data: { metadata: toMetadata(order) },
    success_url: `${env.PUBLIC_SITE_URL}/gutschein/danke?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.PUBLIC_SITE_URL}/#vouchers`,
    locale: 'de',
  })

  return json({ url: session.url, sessionId: session.id })
}
