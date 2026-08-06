// Kleine HTTP-Helfer. Kein Router-Paket — bei drei Routen wäre das Ballast.

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extraHeaders },
  })
}

export function error(reason, status = 400, extra = {}) {
  return json({ error: true, reason, ...extra }, status)
}

/**
 * CORS nur für ausdrücklich erlaubte Ursprünge.
 *
 * Im Betrieb laufen Seite und Worker auf derselben Domain, dann greift das
 * hier gar nicht. Gebraucht wird es in der Entwicklung, wo Vite auf :8000
 * und der Worker auf :8787 sitzt. Deshalb eine Allowlist aus der Umgebung
 * statt eines pauschalen Sternchens.
 */
export function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin')
  if (!origin) return null

  const allowlist = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

  return allowlist.includes(origin) ? origin : null
}

export function corsHeaders(origin) {
  if (!origin) return {}
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  }
}

export function withCors(response, origin) {
  if (!origin) return response
  const merged = new Response(response.body, response)
  for (const [key, value] of Object.entries(corsHeaders(origin))) {
    merged.headers.set(key, value)
  }
  return merged
}
