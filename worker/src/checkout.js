// POST /api/checkout — erzeugt eine Stripe Checkout Session.
//
// Der Client schickt eine Absicht, keinen Preis. Betrag und Behandlung
// bestimmt validateOrder serverseitig; was im Request an Zahlen steht,
// wird höchstens als Wunsch gelesen und gegen die Grenzen geprüft.

import { CURRENCY, lineItemName, listTreatments, loadLimits, validateOrder } from './catalog.js'
import { error, json } from './http.js'
import { bonusFor, ensureCoupon, loadPromotion } from './promotion.js'

/**
 * Die Bestellung reist als Session-Metadaten mit, damit der Webhook den
 * Gutschein daraus bauen kann, ohne eine eigene Tabelle für schwebende
 * Bestellungen zu brauchen.
 *
 * Wichtig: der Betrag steht zwar in den Metadaten, ist aber nicht die
 * Quelle der Wahrheit — der Webhook prüft ihn gegen amount_total der
 * bezahlten Session. Metadaten sind nur Transport.
 *
 * amount_cents ist der Nennwert des Gutscheins, also inklusive Bonus.
 * Bezahlt wird er abzüglich discount_cents.
 */
function toMetadata(order, bonus) {
  return {
    kind: order.kind,
    treatment_id: order.treatmentId ?? '',
    treatment_label: order.treatmentLabel ?? '',
    amount_cents: String(order.amountCents + (bonus?.bonusCents ?? 0)),
    discount_cents: String(bonus?.bonusCents ?? 0),
    promotion: bonus?.name ?? '',
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

  // Nur die im Shop sichtbaren Behandlungen. Eine ausgeblendete zu
  // kaufen darf auch dann nicht gehen, wenn jemand ihre Kennung noch aus
  // einem alten Seitenaufbau hat.
  const [treatments, limits, promotion] = await Promise.all([
    listTreatments(env.DB, 'shop'),
    loadLimits(env.DB),
    loadPromotion(env.DB),
  ])

  const validation = validateOrder(body, treatments, limits)
  if (!validation.ok) return error(validation.reason, 400, { field: validation.field })

  const { order } = validation

  // Den Bonus bestimmt der Server, nicht der Shop. Der Shop sagt nur mit,
  // welchen er angezeigt hat: war die Aktion inzwischen vorbei — ein Tab,
  // der seit gestern Abend offen steht —, soll die Kundin das hier
  // erfahren und nicht erst an der fehlenden Zeile bei Stripe.
  //
  // Die Gegenrichtung ist kein Fehler: zeigte der Shop keinen Bonus, weil
  // die Aktion erst seit einer Minute läuft, bekommt die Kundin ihn trotzdem.
  const bonus = bonusFor(promotion, order, new Date().toISOString())
  const expected = Number(body?.bonusCents) || 0
  if (expected > 0 && expected !== (bonus?.bonusCents ?? 0)) {
    return error('promotion_changed', 409)
  }

  // Nennwert als Preis, der Bonus als Rabatt darauf: Stripe zeigt dann
  // 120 € − 20 € = 100 €, genau die Buchung, die die Steuerberaterin
  // verlangt. Ein Preis von 100 € mit "Wert 120 €" im Namen käme beim
  // Umsatz aufs selbe, aber der Beleg würde etwas anderes erzählen.
  const coupon = bonus ? await ensureCoupon(stripe, promotion, bonus.bonusCents) : null
  const metadata = toMetadata(order, bonus)

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    // Stripe blendet ein, was im Land verfügbar ist — in Österreich also
    // auch EPS, ohne dass wir Zahlungsarten hier pflegen müssen.
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          unit_amount: order.amountCents + (bonus?.bonusCents ?? 0),
          product_data: {
            name: lineItemName(order),
            description: order.recipient ? `Für ${order.recipient}` : undefined,
          },
        },
      },
    ],
    ...(coupon ? { discounts: [{ coupon }] } : {}),
    ...(order.buyerEmail ? { customer_email: order.buyerEmail } : {}),
    metadata,
    // Damit die Metadaten auch am PaymentIntent hängen — nützlich bei
    // Rückerstattungen, die nur den PaymentIntent referenzieren.
    payment_intent_data: { metadata },
    success_url: `${env.PUBLIC_SITE_URL}/danke.html?session_id={CHECKOUT_SESSION_ID}`,
    // Zurück zum Konfigurator, nicht zum Teaser-Band auf der Startseite —
    // wer abbricht, will dort weitermachen, wo er war.
    cancel_url: `${env.PUBLIC_SITE_URL}/gutscheine.html`,
    locale: 'de',
  })

  return json({ url: session.url, sessionId: session.id })
}
