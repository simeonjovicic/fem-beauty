// Öffentliche Endpunkte für die Käuferin — ohne Anmeldung, aber nur mit
// Kenntnis einer unerratbaren Kennung (Stripe-Session oder Gutschein-Token).

import { error, json } from './http.js'
import { buildVoucherPdf } from './pdf.js'
import { findVoucherBySession, findVoucherByToken } from './vouchers.js'

/** Nur, was die Käuferin sehen soll. Interne Felder bleiben drin. */
function publicView(voucher) {
  return {
    code: voucher.code,
    token: voucher.token,
    kind: voucher.kind,
    treatmentLabel: voucher.treatment_label,
    amountCents: voucher.original_amount_cents,
    recipient: voucher.recipient_name,
    sender: voucher.sender_name,
    message: voucher.message,
    delivery: voucher.delivery,
    issuedAt: voucher.issued_at,
  }
}

/**
 * Status nach dem Bezahlen.
 *
 * Der Gutschein entsteht im Webhook, und der kann ein paar Sekunden nach
 * der Weiterleitung eintreffen. Deshalb drei mögliche Antworten statt
 * einer 404: fertig, kommt gleich, oder gar nicht bezahlt. Ohne die
 * Rückfrage bei Stripe könnte die Seite den letzten Fall nicht vom
 * zweiten unterscheiden und würde ewig weiterdrehen.
 */
export async function getBySession(env, stripe, sessionId) {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return error('invalid_session', 400)

  const voucher = await findVoucherBySession(env.DB, sessionId)
  if (voucher) return json({ status: 'ready', voucher: publicView(voucher) })

  let session
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId)
  } catch {
    return error('not_found', 404)
  }

  if (session.payment_status === 'paid') {
    return json({ status: 'pending' })
  }
  return json({ status: 'unpaid', paymentStatus: session.payment_status })
}

/**
 * PDF-Download.
 *
 * Über das Token, nicht über den kurzen Code: der Code ist kurz genug,
 * um ihn zu erraten, das Token nicht. Wer das Token hat, hat ohnehin den
 * Gutschein — es steht als QR auf dem PDF selbst.
 */
export async function getPdf(request, env, token) {
  const voucher = await findVoucherByToken(env.DB, token)
  if (!voucher) return error('not_found', 404)

  const url = new URL(request.url)
  // Das QR-Ziel haengt an PUBLIC_SITE_URL, nicht an der aufgerufenen
  // Adresse. Sonst traegt ein PDF, das ueber die workers.dev-Adresse oder
  // eine Vorschau-URL erzeugt wurde, dauerhaft die falsche Domain — und
  // ein gedruckter Gutschein laesst sich nicht nachtraeglich korrigieren.
  const base = (env.PUBLIC_SITE_URL || url.origin).replace(/\/+$/, '')
  const qrUrl = `${base}/v/${voucher.token}`
  const bytes = await buildVoucherPdf(voucher, qrUrl)

  return new Response(bytes, {
    headers: {
      'content-type': 'application/pdf',
      // attachment statt inline: der Gutschein soll auf dem Geraet landen,
      // nicht in einem Tab, den man versehentlich schliesst. Auf dem
      // Telefon ist der Unterschied deutlich — inline oeffnet je nach
      // Browser eine Vorschau ohne sichtbaren Weg zum Speichern.
      'content-disposition': `attachment; filename="Gutschein-${voucher.code}.pdf"`,
      // Der Inhalt ist stabil, aber personenbezogen — kein geteilter Cache.
      'cache-control': 'private, max-age=300',
      'x-robots-tag': 'noindex, nofollow',
    },
  })
}
