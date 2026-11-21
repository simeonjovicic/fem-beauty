// Darstellung von Geld, Zeit und Zustaenden im Panel.
//
// Gerechnet wird ueberall in Cent, formatiert wird ausschliesslich hier.
// Sobald eine Komponente selbst durch 100 teilt, faengt das Runden an
// verschiedenen Stellen an zu leben — und genau da entstehen die Cent, die
// in der Kassa dann fehlen.

/**
 * Betrag als Euro. Nachkommastellen nur, wenn es welche gibt: an der Kassa
 * liest sich "€100" schneller als "€100,00", aber "€25,55" darf nie zu
 * "€26" werden.
 */
export function euro(cents) {
  const value = Math.abs(cents) / 100
  const sign = cents < 0 ? '−' : ''
  const digits = Number.isInteger(value) ? 0 : 2
  return `${sign}€${value.toLocaleString('de-AT', {
    minimumFractionDigits: digits,
    maximumFractionDigits: 2,
  })}`
}

/**
 * Euro-Eingabe zu Cent.
 *
 * Nimmt Komma wie Punkt: auf einer österreichischen Tastatur wird „89,50"
 * getippt, aus einer Kalkulationstabelle kopiert kommt „89.50".
 *
 * @returns {number|null} null, wenn die Eingabe keine Zahl ist
 */
export function toCents(text) {
  const cleaned = String(text).trim().replace(/\s|€/g, '').replace(',', '.')
  if (!cleaned || !/^\d+(\.\d{0,2})?$/.test(cleaned)) return null
  return Math.round(Number(cleaned) * 100)
}

/** Cent zurück ins Eingabefeld — ohne Währungszeichen, das tippt niemand mit. */
export function toInput(cents) {
  return (cents / 100).toLocaleString('de-AT', {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

/** Wie euro(), aber mit sichtbarem Plus — fuer den Verlauf. */
export function euroSigned(cents) {
  return cents > 0 ? `+${euro(cents)}` : euro(cents)
}

export function date(iso) {
  return new Date(iso).toLocaleDateString('de-AT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

export function dateTime(iso) {
  const d = new Date(iso)
  return `${date(iso)} · ${d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}`
}

// Die sechs Zustaende aus ledger.js. 'expired' bleibt hier gelistet, obwohl
// derzeit kein Gutschein verfaellt (expires_at ist ueberall NULL) — faellt
// die Entscheidung spaeter anders, ist die Anzeige schon da.
const STATES = {
  open: { label: 'Offen', tone: 'open' },
  partially_redeemed: { label: 'Teilweise', tone: 'partial' },
  fully_redeemed: { label: 'Eingelöst', tone: 'done' },
  expired: { label: 'Abgelaufen', tone: 'muted' },
  voided: { label: 'Storniert', tone: 'alert' },
  refunded: { label: 'Erstattet', tone: 'alert' },
}

export function stateLabel(state) {
  return STATES[state]?.label ?? state
}

export function stateTone(state) {
  return STATES[state]?.tone ?? 'muted'
}

/** Fehlergruende aus ledger.js in Klartext fuer die Kassa. */
const REASONS = {
  voided: 'Dieser Gutschein wurde storniert.',
  refunded: 'Dieser Gutschein wurde bereits rückerstattet.',
  expired: 'Dieser Gutschein ist abgelaufen.',
  already_fully_redeemed: 'Dieser Gutschein ist bereits vollständig eingelöst.',
  insufficient_balance: 'Der Betrag ist höher als das verfügbare Guthaben.',
  amount_not_positive: 'Bitte einen Betrag größer als null eingeben.',
  amount_not_integer: 'Der Betrag konnte nicht als Cent-Wert gelesen werden.',
  target_not_found: 'Die zu stornierende Buchung wurde nicht gefunden.',
  target_is_reversal: 'Eine Gegenbuchung kann nicht storniert werden.',
  already_reversed: 'Diese Buchung wurde bereits storniert.',
}

export function reasonText(reason) {
  return REASONS[reason] ?? `Nicht möglich (${reason}).`
}
