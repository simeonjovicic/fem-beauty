// CSV-Export fuer die Buchhaltung.
//
// Ziel ist die Steuerberaterin, nicht die Weiterverarbeitung in einem
// Skript. Deshalb Semikolon statt Komma und ein BOM vorweg: Excel in der
// deutschen Einstellung liest eine kommagetrennte Datei als eine einzige
// Spalte, und ohne BOM werden aus Umlauten Fragezeichen.

import { error } from '../http.js'

const SEP = ';'
const BOM = '\uFEFF'

// Wien, nicht UTC. Ein Gutschein, der am 1. Oktober um 00:30 verkauft wird,
// steht in der Datenbank als 30. September, 22:30 UTC. Liefe die
// Monatsgrenze auf UTC, fiele dieser Verkauf in den September — also in
// einen Monat, der womoeglich schon abgeschlossen beim Steuerberater liegt.
const ZONE = 'Europe/Vienna'

const PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONE,
  hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
})

/** Verschiebung Wiens gegenueber UTC zu einem Zeitpunkt, in Millisekunden. */
function zoneOffset(ms) {
  const parts = {}
  for (const part of PARTS.formatToParts(new Date(ms))) parts[part.type] = part.value
  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  )
  return asUtc - ms
}

/**
 * Der Augenblick, in dem in Wien ein bestimmter Monat beginnt.
 *
 * Zweimal gerechnet, weil die Verschiebung selbst vom Zeitpunkt abhaengt:
 * die erste Naeherung kann noch in der falschen Haelfte der Zeitumstellung
 * liegen, die zweite korrigiert sie. Ein dritter Durchgang aendert nichts.
 */
function startOfMonth(year, month) {
  const naiv = Date.UTC(year, month - 1, 1)
  const einmal = naiv - zoneOffset(naiv)
  return new Date(naiv - zoneOffset(einmal)).toISOString()
}

/**
 * "2026-09" in die beiden ISO-Zeitpunkte, zwischen denen der Monat liegt.
 * Halboffen: from eingeschlossen, to ausgeschlossen — sonst zaehlte ein
 * Verkauf genau um Mitternacht in zwei Monaten.
 */
export function monthBounds(month) {
  const treffer = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month ?? '')
  if (!treffer) return null

  const jahr = Number(treffer[1])
  const nr = Number(treffer[2])
  return {
    from: startOfMonth(jahr, nr),
    to: startOfMonth(nr === 12 ? jahr + 1 : jahr, nr === 12 ? 1 : nr + 1),
  }
}

/**
 * Ein Textfeld fuer die Datei.
 *
 * Zwei getrennte Aufgaben. Erstens maskieren: ein Name mit Semikolon
 * zerrisse sonst die Zeile. Zweitens entschaerfen — ein Wert, der mit =, +,
 * - oder @ beginnt, bekommt ein Apostroph davor, weil Excel ihn sonst als
 * Formel ausfuehrt. Namen und Nachrichten tippt die Kaeuferin, das ist
 * Fremdtext, und Fremdtext, der beim Oeffnen einer Datei ausgefuehrt wird,
 * ist genau die Luecke, die man nicht haben will.
 */
export function csvText(value) {
  if (value == null) return ''

  let text = String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /["\n\r;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/**
 * Ein Betrag als Zahl.
 *
 * Bewusst nicht durch csvText: eine Gegenbuchung ist negativ, und ein
 * Apostroph vor dem Minus machte aus der Zahl einen Text, mit dem keine
 * Summenzeile mehr rechnet.
 */
export function csvAmount(cents) {
  return (cents / 100).toFixed(2).replace('.', ',')
}

const DATUM = new Intl.DateTimeFormat('de-AT', {
  timeZone: ZONE, day: '2-digit', month: '2-digit', year: 'numeric',
})
const UHRZEIT = new Intl.DateTimeFormat('de-AT', {
  timeZone: ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

const ART = { value: 'Wertgutschein', treatment: 'Behandlung' }
const ZUSTAND = { active: 'Aktiv', voided: 'Storniert', refunded: 'Erstattet' }
const ZUSTELLUNG = { download: 'Download', email: 'E-Mail' }

function zeile(felder) {
  return felder.join(SEP)
}

/**
 * Die Verkaeufe eines Monats.
 *
 * Netto und USt stehen ausgerechnet daneben, obwohl in der Datenbank nur
 * der Bruttobetrag und der Satz liegen. Der Gutschein ist ein
 * Einzweckgutschein, die Steuer faellt also beim Verkauf an — und die
 * Aufteilung von Hand nachzurechnen ist genau die Arbeit, die dieser
 * Export abnehmen soll.
 *
 * Empfaengerin, Absender und Nachricht fehlen absichtlich: fuer die
 * Buchhaltung braucht es sie nicht, und was nicht exportiert wird, kann
 * auch nicht in einem Mailanhang verloren gehen.
 */
export function buildSalesCsv(rows) {
  const kopf = [
    'Datum', 'Code', 'Art', 'Behandlung', 'Brutto EUR', 'USt-Satz %',
    'USt EUR', 'Netto EUR', 'Status', 'Zustellung', 'Käufer-E-Mail',
    'Eingelöst EUR', 'Restwert EUR', 'Stripe-Session',
  ]

  const zeilen = rows.map((row) => {
    const brutto = row.original_amount_cents
    const netto = Math.round(brutto / (1 + row.vat_rate_bp / 10000))

    return zeile([
      csvText(DATUM.format(new Date(row.issued_at))),
      csvText(row.code),
      csvText(ART[row.kind] ?? row.kind),
      csvText(row.treatment_label ?? ''),
      csvAmount(brutto),
      // Basispunkte verhalten sich zum Prozent wie Cent zum Euro: 2000 bp
      // sind 20,00 %. Deshalb dieselbe Formatierung, ohne Vorwegteilung —
      // die war der Fehler, den der Test gefunden hat (0,20 statt 20,00).
      csvAmount(row.vat_rate_bp),
      csvAmount(brutto - netto),
      csvAmount(netto),
      csvText(ZUSTAND[row.status] ?? row.status),
      csvText(ZUSTELLUNG[row.delivery] ?? row.delivery),
      csvText(row.buyer_email),
      csvAmount(row.redeemed_cents),
      csvAmount(row.balance_cents),
      csvText(row.stripe_session_id),
    ])
  })

  return [zeile(kopf), ...zeilen].join('\r\n')
}

/**
 * Die Buchungen eines Monats.
 *
 * Abbuchung und Gegenbuchung stehen beide drin, die Gegenbuchung mit
 * negativem Betrag. Zusammengefasst waeren sie eine Zahl weniger, aber
 * auch eine Korrektur weniger, die jemand nachvollziehen kann.
 */
export function buildRedemptionsCsv(rows) {
  const kopf = ['Datum', 'Uhrzeit', 'Code', 'Betrag EUR', 'Art', 'Mitarbeiter', 'Notiz']

  const zeilen = rows.map((row) => zeile([
    csvText(DATUM.format(new Date(row.redeemed_at))),
    csvText(UHRZEIT.format(new Date(row.redeemed_at))),
    csvText(row.code),
    csvAmount(row.amount_cents),
    csvText(row.reverses_id ? 'Storno' : 'Abbuchung'),
    csvText(row.staff_id),
    csvText(row.note ?? ''),
  ]))

  return [zeile(kopf), ...zeilen].join('\r\n')
}

/** GET /api/admin/export?month=YYYY-MM&type=sales|redemptions */
export async function exportCsv(request, env) {
  const url = new URL(request.url)

  const grenzen = monthBounds(url.searchParams.get('month'))
  if (!grenzen) return error('invalid_month')

  const einloesungen = url.searchParams.get('type') === 'redemptions'

  const { results } = einloesungen
    ? await env.DB.prepare(
      `SELECT r.*, v.code
         FROM redemptions r
         JOIN vouchers v ON v.id = r.voucher_id
        WHERE r.redeemed_at >= ? AND r.redeemed_at < ?
        ORDER BY r.redeemed_at`,
    ).bind(grenzen.from, grenzen.to).all()
    : await env.DB.prepare(
      `SELECT v.*, b.redeemed_cents, b.balance_cents
         FROM vouchers v
         JOIN voucher_balances b ON b.id = v.id
        WHERE v.issued_at >= ? AND v.issued_at < ?
        ORDER BY v.issued_at`,
    ).bind(grenzen.from, grenzen.to).all()

  const inhalt = einloesungen
    ? buildRedemptionsCsv(results ?? [])
    : buildSalesCsv(results ?? [])

  const name = `fem-${einloesungen ? 'einloesungen' : 'verkauf'}-${url.searchParams.get('month')}.csv`

  return new Response(BOM + inhalt, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${name}"`,
      // Der Export enthaelt Kundendaten und gehoert in keinen Cache.
      'cache-control': 'no-store',
    },
  })
}
