// Versand über Resend.
//
// Der Inhalt steht in email.js, das PDF in pdf.js — hier liegt nur der
// Transport. Getrennt, weil beim Ausprobieren eines Textes niemand einen
// Mailversand auslösen können soll und umgekehrt.
//
// Eine Regel bestimmt fast alles hier: **ein Fehler beim Versand darf den
// Webhook nicht scheitern lassen.** Der Gutschein existiert an diesem
// Punkt bereits. Ein 500 brächte Stripe dazu, es erneut zu versuchen; der
// zweite Lauf legte dank Idempotenz keinen neuen Gutschein an, wuerde aber
// erneut eine Mail schicken — und eine zweite Mail an dieselbe Kundin ist
// kein harmloser Doppelklick.

import { toBase64 } from './base64.js'
import { buildVoucherEmail, emailPlan } from './email.js'
import { buildVoucherPdf } from './pdf.js'

const ENDPOINT = 'https://api.resend.com/emails'

async function sendOne(env, { to, subject, html, text, attachment, idempotencyKey }) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
      // Schützt gegen doppelten Versand, wenn dieser Aufruf wiederholt
      // wird — etwa weil die Antwort verloren ging, die Mail aber raus war.
      'idempotency-key': idempotencyKey,
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      reply_to: env.MAIL_REPLY_TO || undefined,
      to,
      subject,
      html,
      text,
      attachments: attachment ? [attachment] : undefined,
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(`Resend ${response.status}: ${payload.message ?? 'unbekannter Fehler'}`)
  }
  return payload.id
}

/**
 * Verschickt die Mails zu einem frisch angelegten Gutschein.
 *
 * Wirft nie. Was schiefging, landet in `email_last_error`; was gelang, in
 * `email_sent_at`. Beide Spalten stehen seit dem ersten Schema bereit.
 *
 * @returns {Promise<{sent: number, error: string|null}>}
 */
export async function sendVoucherEmails(env, voucher) {
  const now = new Date().toISOString()
  let sent = 0
  let error = null

  try {
    // Fehlt die Einrichtung, ist das kein Sonderfall, sondern ein Grund
    // wie jeder andere — er gehoert in email_last_error, damit im Panel
    // steht, warum diese Kundin nichts bekommen hat. Ein frueher return
    // vor der Aktualisierung liess die Spalte leer und den Gutschein
    // aussehen, als sei nie ein Versand versucht worden.
    if (!env.RESEND_API_KEY || !env.MAIL_FROM) {
      throw new Error('nicht eingerichtet: RESEND_API_KEY oder MAIL_FROM fehlt')
    }

    // Einmal erzeugt, an beide Mails gehängt: das PDF ist für Käuferin und
    // Beschenkte dasselbe Dokument.
    const base = (env.PUBLIC_SITE_URL || 'https://fembeauty.at').replace(/\/+$/, '')
    const pdf = await buildVoucherPdf(voucher, `${base}/v/${voucher.token}`)
    const attachment = {
      filename: `Gutschein-${voucher.code}.pdf`,
      content: toBase64(pdf),
      content_type: 'application/pdf',
    }

    for (const { variant } of emailPlan(voucher)) {
      const mail = buildVoucherEmail(voucher, { variant, bookingUrl: env.BOOKING_URL })
      if (!mail.to) continue

      await sendOne(env, {
        ...mail,
        attachment,
        // Aus Gutschein und Art gebildet, nicht zufällig: ein zweiter
        // Aufruf für denselben Gutschein soll denselben Schlüssel tragen.
        idempotencyKey: `voucher-${voucher.id}-${variant}`,
      })
      sent += 1
    }
  } catch (err) {
    error = err.message
    console.error('mail: Versand fehlgeschlagen —', err.message)
  }

  // Auch ein Teilerfolg wird festgehalten: ging die Geschenkmail raus und
  // die Bestätigung nicht, ist das etwas anderes als "nichts versendet".
  try {
    await env.DB.prepare(
      'UPDATE vouchers SET email_sent_at = ?, email_last_error = ? WHERE id = ?',
    ).bind(sent > 0 ? now : null, error, voucher.id).run()
  } catch (err) {
    console.error('mail: Zustand nicht gespeichert —', err.message)
  }

  return { sent, error }
}
