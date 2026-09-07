import assert from 'node:assert/strict'
import test from 'node:test'
import { authenticate } from '../src/admin/auth.js'

// Die Zugangspruefung ist die Stelle, an der ein Fehler nicht auffaellt,
// sondern das Panel oeffnet. Geprueft wird hier vor allem, dass jeder
// unklare Zustand SPERRT statt durchzulassen.

const echtesToken = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IngifQ.eyJlbWFpbCI6ImFAYi5hdCJ9.sig'

function anfrage(headers = {}) {
  return { headers: { get: (name) => headers[name.toLowerCase()] ?? null } }
}

test('Entwicklungsmodus laesst durch — aber nur wenn er ausdruecklich gesetzt ist', async () => {
  const r = await authenticate(anfrage(), { ADMIN_AUTH_MODE: 'dev', ADMIN_DEV_EMAIL: 'x@y.at' })
  assert.equal(r.ok, true)
  assert.equal(r.email, 'x@y.at')
  assert.equal(r.dev, true)
})

test('ohne ADMIN_AUTH_MODE gilt nicht der Entwicklungsmodus', async () => {
  // Der gefaehrlichste denkbare Fehler: eine fehlende Variable, die als
  // "offen" ausgelegt wird. Sie muss sperren.
  const r = await authenticate(anfrage(), {})
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'not_configured')
})

test('Access-Modus ohne Konfiguration sperrt', async () => {
  for (const env of [
    { ADMIN_AUTH_MODE: 'access' },
    { ADMIN_AUTH_MODE: 'access', ACCESS_AUD: 'abc' },
    { ADMIN_AUTH_MODE: 'access', ACCESS_TEAM_DOMAIN: 'x.cloudflareaccess.com' },
  ]) {
    const r = await authenticate(anfrage(), env)
    assert.equal(r.ok, false)
    assert.equal(r.reason, 'not_configured')
  }
})

test('ohne Token kein Zugang', async () => {
  const r = await authenticate(anfrage(), {
    ADMIN_AUTH_MODE: 'access', ACCESS_AUD: 'abc', ACCESS_TEAM_DOMAIN: 'x.cloudflareaccess.com',
  })
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'missing_token')
})

test('unbrauchbare Token werden abgewiesen, nicht durchgereicht', async () => {
  const env = {
    ADMIN_AUTH_MODE: 'access', ACCESS_AUD: 'abc', ACCESS_TEAM_DOMAIN: 'x.cloudflareaccess.com',
  }
  for (const token of ['', 'kein.jwt', 'a.b', 'a.b.c.d', '!!!.###.$$$']) {
    const r = await authenticate(anfrage({ 'cf-access-jwt-assertion': token }), env)
    assert.equal(r.ok, false, `${token} durchgelassen`)
  }
})

// ── Mehrere Kennungen ────────────────────────────────────────────
//
// /admin und /api/admin teilen keinen Pfad, es braucht also womoeglich
// zwei Access-Anwendungen. Das Token traegt dann je nachdem die eine oder
// die andere Kennung.

function tokenMit(payload, alg = 'RS256') {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg, kid: 'x' })}.${b64(payload)}.signatur`
}

const inZukunft = Math.floor(Date.now() / 1000) + 3600
const basisEnv = { ADMIN_AUTH_MODE: 'access', ACCESS_TEAM_DOMAIN: 'x.cloudflareaccess.com' }

test('eine von mehreren erlaubten Kennungen genuegt', async () => {
  const env = { ...basisEnv, ACCESS_AUD: 'aud-panel, aud-api' }
  // Beide kommen bis zur Signaturpruefung — die scheitert hier mangels
  // erreichbarer Zertifikate, aber eben NICHT an der Zielgruppe.
  for (const aud of ['aud-panel', 'aud-api']) {
    const r = await authenticate(
      anfrage({ 'cf-access-jwt-assertion': tokenMit({ email: 'a@b.at', exp: inZukunft, aud }) }),
      env,
    )
    assert.notEqual(r.reason, 'wrong_audience', `${aud} wurde als falsche Zielgruppe abgewiesen`)
  }
})

test('eine fremde Kennung wird weiterhin abgewiesen', async () => {
  const env = { ...basisEnv, ACCESS_AUD: 'aud-panel, aud-api' }
  const r = await authenticate(
    anfrage({ 'cf-access-jwt-assertion': tokenMit({ email: 'a@b.at', exp: inZukunft, aud: 'fremde-app' }) }),
    env,
  )
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'wrong_audience')
})

test('abgelaufene Token werden abgewiesen', async () => {
  const env = { ...basisEnv, ACCESS_AUD: 'aud-api' }
  const r = await authenticate(
    anfrage({ 'cf-access-jwt-assertion': tokenMit({ email: 'a@b.at', exp: 1000000000, aud: 'aud-api' }) }),
    env,
  )
  assert.equal(r.reason, 'expired')
})

test('alg=none wird abgewiesen', async () => {
  // Der klassische Angriff: Signatur weglassen und behaupten, das sei so
  // gemeint.
  const env = { ...basisEnv, ACCESS_AUD: 'aud-api' }
  const r = await authenticate(
    anfrage({ 'cf-access-jwt-assertion': tokenMit({ email: 'a@b.at', exp: inZukunft, aud: 'aud-api' }, 'none') }),
    env,
  )
  assert.equal(r.reason, 'unexpected_algorithm')
})

test('ein Token ohne Kennung kommt nicht durch', async () => {
  const env = { ...basisEnv, ACCESS_AUD: 'aud-api' }
  const r = await authenticate(
    anfrage({ 'cf-access-jwt-assertion': tokenMit({ email: 'a@b.at', exp: inZukunft }) }),
    env,
  )
  assert.equal(r.reason, 'wrong_audience')
})

test('echtes Token, aber ACCESS_AUD leer → gesperrt', async () => {
  const r = await authenticate(
    anfrage({ 'cf-access-jwt-assertion': echtesToken }),
    { ...basisEnv, ACCESS_AUD: '   ,  ' },
  )
  assert.equal(r.ok, false)
})
