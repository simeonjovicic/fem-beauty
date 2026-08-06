import Stripe from 'stripe'
import panelHtml from './admin/panel.html'
import { getStats, getVoucher, listVouchers, redeemVoucher, reverseRedemption } from './admin/api.js'
import { authenticate } from './admin/auth.js'
import { handleCheckout } from './checkout.js'
import { allowedOrigin, corsHeaders, error, json, withCors } from './http.js'
import { handleWebhook } from './webhook.js'

function createStripe(env) {
  return new Stripe(env.STRIPE_API_KEY, {
    // In Workers gibt es kein Node-http — Stripe liefert dafür einen
    // fetch-basierten Client mit.
    httpClient: Stripe.createFetchHttpClient(),
  })
}

const HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  // Das Panel zeigt Kundendaten — nichts davon gehört in einen Index.
  'x-robots-tag': 'noindex, nofollow',
  'referrer-policy': 'same-origin',
  'x-content-type-options': 'nosniff',
}

async function handleAdmin(request, env, url) {
  const identity = await authenticate(request, env)
  if (!identity.ok) {
    return error(identity.reason, identity.reason === 'not_configured' ? 500 : 401)
  }

  const path = url.pathname

  if (path === '/admin' || path === '/admin/') {
    return new Response(panelHtml, { headers: HTML_HEADERS })
  }

  if (path === '/api/admin/stats' && request.method === 'GET') {
    return getStats(env)
  }

  if (path === '/api/admin/vouchers' && request.method === 'GET') {
    return listVouchers(request, env)
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

    if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')
        || url.pathname.startsWith('/api/admin/')) {
      try {
        return await handleAdmin(request, env, url)
      } catch (err) {
        console.error('admin fehlgeschlagen —', err.stack ?? err.message)
        return error('admin_failed', 500)
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
