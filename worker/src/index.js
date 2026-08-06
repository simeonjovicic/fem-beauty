import Stripe from 'stripe'
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
