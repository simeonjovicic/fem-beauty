// Zugriff auf die Panel-Endpunkte des Workers.
//
// Die Antworten kommen als rohe Datenbankzeilen (snake_case) — genau die
// Form, die ledger.js erwartet. Hier wird deshalb bewusst nichts
// umbenannt: eine Umwandlung erzeugte nur eine zweite Gestalt derselben
// Daten, die vor jeder Rechnung wieder zurückgedreht werden müsste.

import { API_BASE } from '../config'

class ApiError extends Error {
  constructor(reason, status, payload) {
    super(MESSAGES[reason] ?? reason ?? 'Unbekannter Fehler')
    this.name = 'ApiError'
    this.reason = reason
    this.status = status
    this.payload = payload
  }
}

// Die Gründe kommen englisch und knapp aus dem Worker. Für die Anzeige an
// der Kassa taugt das nicht.
const MESSAGES = {
  not_found: 'Gutschein nicht gefunden.',
  invalid_code: 'Dieser Code ist ungültig — bitte prüfen.',
  insufficient_balance: 'Der Betrag übersteigt den Restwert.',
  already_fully_redeemed: 'Dieser Gutschein ist bereits vollständig eingelöst.',
  amount_not_positive: 'Bitte einen Betrag größer als null eingeben.',
  amount_not_integer: 'Ungültiger Betrag.',
  expired: 'Dieser Gutschein ist abgelaufen.',
  voided: 'Dieser Gutschein wurde storniert.',
  refunded: 'Dieser Gutschein wurde rückerstattet.',
  already_reversed: 'Diese Buchung wurde bereits zurückgenommen.',
  target_is_reversal: 'Eine Gegenbuchung lässt sich nicht zurücknehmen.',
  concurrent_modification: 'Jemand anderes hat gerade gebucht — bitte neu laden.',
  missing_token: 'Nicht angemeldet.',
  not_configured: 'Zugangsschutz ist nicht eingerichtet.',
}

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { 'content-type': 'application/json' },
      // Access setzt ein Cookie; ohne dieses käme das Panel nie durch.
      credentials: 'include',
      ...options,
    })
  } catch {
    throw new ApiError('network', 0, null)
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(payload.reason, response.status, payload)
  return payload
}

export function fetchMe() {
  return request('/api/admin/me')
}

export function fetchStats() {
  return request('/api/admin/stats')
}

/** Alle Buchungen — das Panel leitet Kennzahlen und Verlauf selbst daraus ab. */
export function fetchRedemptions() {
  return request('/api/admin/redemptions')
}

export function fetchVouchers({ status = '', query = '', limit, offset } = {}) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (query) params.set('q', query)
  if (limit) params.set('limit', String(limit))
  if (offset) params.set('offset', String(offset))
  const suffix = params.toString() ? `?${params}` : ''
  return request(`/api/admin/vouchers${suffix}`)
}

/** Einzelner Gutschein samt Buchungshistorie — per Code oder QR-Token. */
export function fetchVoucher({ code, token }) {
  return token
    ? request(`/api/admin/by-token/${encodeURIComponent(token)}`)
    : request(`/api/admin/vouchers/${encodeURIComponent(code)}`)
}

/**
 * Abbuchen.
 *
 * Der Idempotenzschlüssel wird vom Aufrufer vorgegeben und nicht hier
 * erzeugt: er muss über einen Wiederholungsversuch hinweg derselbe
 * bleiben, sonst schützt er gegen nichts.
 */
export function redeemVoucher(voucherId, { amountCents, note, idempotencyKey }) {
  return request(`/api/admin/vouchers/${encodeURIComponent(voucherId)}/redeem`, {
    method: 'POST',
    body: JSON.stringify({ amountCents, note, idempotencyKey }),
  })
}

export function reverseRedemption(redemptionId, { note, idempotencyKey }) {
  return request(`/api/admin/redemptions/${encodeURIComponent(redemptionId)}/reverse`, {
    method: 'POST',
    body: JSON.stringify({ note, idempotencyKey }),
  })
}

export { ApiError }
