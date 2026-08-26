import Stripe from 'stripe'
import {
  getStats,
  getVoucher,
  listRedemptions,
  listVouchers,
  redeemVoucher,
  reverseRedemption,
} from './admin/api.js'
import { authenticate } from './admin/auth.js'
import { handleCheckout } from './checkout.js'
import { allowedOrigin, corsHeaders, error, json, withCors } from './http.js'
import { getBySession, getPdf } from './public.js'
import {
  createTreatment,
  getAdminTreatments,
  getPublicTreatments,
  hideTreatment,
  updateTreatment,
} from './treatments.js'
import { handleWebhook } from './webhook.js'

function createStripe(env) {
  return new Stripe(env.STRIPE_API_KEY, {
    // In Workers gibt es kein Node-http — Stripe liefert dafür einen
    // fetch-basierten Client mit.
    httpClient: Stripe.createFetchHttpClient(),
  })
}

async function handleAdmin(request, env, url) {
  const identity = await authenticate(request, env)
  if (!identity.ok) {
    return error(identity.reason, identity.reason === 'not_configured' ? 500 : 401)
  }

  const path = url.pathname

  // Wer bin ich? Kommt aus dem von Access verifizierten Token, nicht aus
  // einer Konstante im Frontend — sonst stünde im Panel ein Name, der mit
  // dem, was bei einer Buchung als staff_id landet, nichts zu tun hat.
  if (path === '/api/admin/me' && request.method === 'GET') {
    return json({ email: identity.email, dev: Boolean(identity.dev) })
  }

  if (path === '/api/admin/stats' && request.method === 'GET') {
    return getStats(env)
  }

  if (path === '/api/admin/vouchers' && request.method === 'GET') {
    return listVouchers(request, env)
  }

  if (path === '/api/admin/redemptions' && request.method === 'GET') {
    return listRedemptions(request, env)
  }

  if (path === '/api/admin/treatments') {
    if (request.method === 'GET') return getAdminTreatments(env)
    if (request.method === 'POST') return createTreatment(request, env)
    return error('method_not_allowed', 405)
  }

  const treatment = path.match(/^\/api\/admin\/treatments\/([^/]+)$/)
  if (treatment) {
    const id = decodeURIComponent(treatment[1])
    if (request.method === 'PATCH') return updateTreatment(request, env, id)
    if (request.method === 'DELETE') return hideTreatment(env, id)
    return error('method_not_allowed', 405)
  }

  const detail = path.match(/^\/api\/admin\/vouchers\/([^/]+)$/)
  if (detail && request.method === 'GET') {
    return getVoucher(env, { code: decodeURIComponent(detail[1]) })
  }

  const byToken = path.match(/^\/api\/admin\/by-token\/([^/]+)$/)
  if (byToken && request.method === 'GET') {
    return getVoucher(env, { token: decodeURIComponent(byToken[1]) })
  }

  const redeem = path.match(/^\/api\/admin\/vouchers\/([^/]+)\/redeem$/)
  if (redeem && request.method === 'POST') {
    return redeemVoucher(request, env, identity, decodeURIComponent(redeem[1]))
  }

  const reverse = path.match(/^\/api\/admin\/redemptions\/([^/]+)\/reverse$/)
  if (reverse && request.method === 'POST') {
    return reverseRedemption(request, env, identity, decodeURIComponent(reverse[1]))
  }

  return error('not_found', 404)
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const origin = allowedOrigin(request, env)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }

    // Der Webhook bleibt außerhalb von CORS: er kommt von Stripe, nicht
    // aus einem Browser, und authentifiziert sich über die Signatur.
    if (url.pathname === '/api/stripe/webhook') {
      if (request.method !== 'POST') return error('method_not_allowed', 405)
      return handleWebhook(request, env, createStripe(env))
    }

    // Ziel des QR-Codes. Führt nur zum Panel — eingelöst wird dort per
    // Klick, nie durch das Scannen allein. Sonst könnte sich jeder mit
    // dem eigenen Gutschein selbst leerbuchen.
    const qr = url.pathname.match(/^\/v\/([^/]+)$/)
    if (qr) {
      return Response.redirect(`${url.origin}/admin?token=${encodeURIComponent(qr[1])}`, 302)
    }

    // Nur noch die API. Die Panel-Oberflaeche liefert die React-App als
    // statische Seite aus; geschuetzt wird sie durch dieselbe
    // Access-Anwendung, die auch diese Endpunkte abdeckt.
    if (url.pathname.startsWith('/api/admin/')) {
      // Mit CORS: im Betrieb liegen Panel und API gleichursprünglich, aber
      // in der Entwicklung sitzt das Panel auf :8000 und der Worker auf
      // :8787. Ohne diese Kopfzeilen weist der Browser jeden Aufruf ab.
      // Die Allowlist entscheidet weiterhin, wer fragen darf.
      try {
        return withCors(await handleAdmin(request, env, url), origin)
      } catch (err) {
        console.error('admin fehlgeschlagen —', err.stack ?? err.message)
        return withCors(error('admin_failed', 500), origin)
      }
    }

    // Status nach dem Bezahlen, für die Danke-Seite.
    const bySession = url.pathname.match(/^\/api\/voucher\/by-session\/([^/]+)$/)
    if (bySession && request.method === 'GET') {
      try {
        return withCors(
          await getBySession(env, createStripe(env), decodeURIComponent(bySession[1])),
          origin,
        )
      } catch (err) {
        console.error('by-session fehlgeschlagen —', err.stack ?? err.message)
        return withCors(error('lookup_failed', 500), origin)
      }
    }

    // PDF-Download. Bewusst ohne CORS-Kopfzeilen: das ist ein direkter
    // Link oder Download, kein fetch aus einer anderen Seite heraus.
    const pdf = url.pathname.match(/^\/api\/voucher\/([^/]+)\/pdf$/)
    if (pdf && request.method === 'GET') {
      try {
        return await getPdf(request, env, decodeURIComponent(pdf[1]))
      } catch (err) {
        console.error('PDF fehlgeschlagen —', err.stack ?? err.message)
        return error('pdf_failed', 500)
      }
    }

    // Preise fuer den Shop. Oeffentlich, weil der Konfigurator sie
    // anzeigen muss — geaendert werden koennen sie nur unter /api/admin.
    if (url.pathname === '/api/treatments' && request.method === 'GET') {
      try {
        return withCors(await getPublicTreatments(env), origin)
      } catch (err) {
        console.error('treatments fehlgeschlagen —', err.stack ?? err.message)
        return withCors(error('treatments_failed', 500), origin)
      }
    }

    if (url.pathname === '/api/checkout') {
      if (request.method !== 'POST') return withCors(error('method_not_allowed', 405), origin)
      try {
        return withCors(await handleCheckout(request, env, createStripe(env)), origin)
      } catch (err) {
        console.error('checkout fehlgeschlagen —', err.stack ?? err.message)
        return withCors(error('checkout_failed', 502), origin)
      }
    }

    if (url.pathname === '/api/health') {
      return withCors(json({ ok: true, time: new Date().toISOString() }), origin)
    }

    return withCors(error('not_found', 404), origin)
  },
}
