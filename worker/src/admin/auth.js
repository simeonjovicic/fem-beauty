// Zugangsschutz für /admin und /api/admin.
//
// Im Betrieb sitzt Cloudflare Access davor und legt ein signiertes JWT in
// den Header Cf-Access-Jwt-Assertion. Diesem Header einfach zu glauben
// wäre falsch: wer den Worker direkt erreicht — etwa über die
// workers.dev-Adresse — könnte ihn frei setzen und damit Gutscheine
// leerbuchen. Deshalb wird die Signatur gegen Cloudflares öffentliche
// Schlüssel geprüft und die Zielgruppe (aud) gegen die eigene Anwendung.

const JWKS_TTL_MS = 60 * 60 * 1000
let jwksCache = { url: null, keys: null, fetchedAt: 0 }

function base64UrlToBytes(input) {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function base64UrlToJson(input) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(input)))
}

async function loadKeys(teamDomain) {
  const url = `https://${teamDomain}/cdn-cgi/access/certs`
  const fresh = jwksCache.url === url && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS
  if (fresh && jwksCache.keys) return jwksCache.keys

  const response = await fetch(url)
  if (!response.ok) throw new Error(`Access-Zertifikate nicht abrufbar: ${response.status}`)

  const { keys } = await response.json()
  jwksCache = { url, keys, fetchedAt: Date.now() }
  return keys
}

/**
 * Prüft das Access-JWT und gibt die verifizierte Identität zurück.
 *
 * @returns {{ ok: true, email: string } | { ok: false, reason: string }}
 */
async function verifyAccessJwt(token, env) {
  const parts = token.split('.')
  if (parts.length !== 3) return { ok: false, reason: 'malformed_token' }

  const [rawHeader, rawPayload, rawSignature] = parts

  let header
  let payload
  try {
    header = base64UrlToJson(rawHeader)
    payload = base64UrlToJson(rawPayload)
  } catch {
    return { ok: false, reason: 'undecodable_token' }
  }

  if (header.alg !== 'RS256') return { ok: false, reason: 'unexpected_algorithm' }

  const now = Math.floor(Date.now() / 1000)
  if (typeof payload.exp !== 'number' || payload.exp < now) return { ok: false, reason: 'expired' }
  if (typeof payload.nbf === 'number' && payload.nbf > now + 60) return { ok: false, reason: 'not_yet_valid' }

  // Ohne aud-Prüfung würde ein gültiges Token einer *anderen* Access-Anwendung
  // desselben Teams hier ebenfalls durchkommen.
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
  if (!audiences.includes(env.ACCESS_AUD)) return { ok: false, reason: 'wrong_audience' }

  const keys = await loadKeys(env.ACCESS_TEAM_DOMAIN)
  const jwk = keys.find((key) => key.kid === header.kid)
  if (!jwk) return { ok: false, reason: 'unknown_key' }

  const publicKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )

  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    base64UrlToBytes(rawSignature),
    new TextEncoder().encode(`${rawHeader}.${rawPayload}`),
  )
  if (!valid) return { ok: false, reason: 'bad_signature' }

  const email = payload.email || payload.common_name
  if (!email) return { ok: false, reason: 'no_identity' }

  return { ok: true, email }
}

/**
 * Ermittelt, wer die Anfrage stellt.
 *
 * Der Entwicklungsmodus ist bewusst an eine eigene Variable gebunden und
 * nicht daran, ob ein Header fehlt — sonst würde ein Konfigurationsfehler
 * in der Cloud stillschweigend zu offenem Zugang führen.
 */
export async function authenticate(request, env) {
  if (env.ADMIN_AUTH_MODE === 'dev') {
    console.warn('admin: Entwicklungsmodus — kein echter Zugangsschutz')
    return { ok: true, email: env.ADMIN_DEV_EMAIL || 'dev@localhost', dev: true }
  }

  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
    console.error('admin: ACCESS_TEAM_DOMAIN oder ACCESS_AUD fehlt — Zugang gesperrt')
    return { ok: false, reason: 'not_configured' }
  }

  const token = request.headers.get('Cf-Access-Jwt-Assertion')
  if (!token) return { ok: false, reason: 'missing_token' }

  try {
    return await verifyAccessJwt(token, env)
  } catch (err) {
    console.error('admin: JWT-Prüfung fehlgeschlagen —', err.message)
    return { ok: false, reason: 'verification_failed' }
  }
}
