// Gutschein-Aktionen: Bonus auf bestimmte Kaufbetraege, etwa zur Black Week.
//
// Wer 100 € bezahlt, bekommt einen Gutschein ueber 120 €. Buchhalterisch
// ist das kein Guthaben obendrauf, sondern ein Rabatt — so hat es die
// Steuerberaterin vorgegeben: der Gutschein wird mit dem Nennbetrag
// ausgestellt (120 €), bei der Zahlung werden 20 € abgezogen, als Umsatz
// stehen 100 €. Genau so laeuft es auch durch Stripe: die Position kostet
// 120 €, ein Coupon zieht 20 € ab. Der Webhook liest Nennwert und Rabatt
// danach aus Stripes Summen, nicht aus unseren Metadaten.
//
// Die Einstellung liegt als JSON in `settings` unter 'promotion'. Eine
// Aktion zur Zeit genuegt; die naechste ersetzt sie.
//
// Bonus gibt es nur auf Wertgutscheine und nur auf genau die eingestellten
// Betraege. Behandlungen haben feste Preise — ein Bonus machte daraus eine
// Behandlung plus ein Restguthaben, das niemand erwartet.

import { error, json } from './http.js'
import { startOfDay } from './vienna.js'

const KEY = 'promotion'
const MAX_TIERS = 6
const MAX_NAME = 30
// Wie die Obergrenze in catalog.js: ein Kaufbetrag darueber ist ein Tippfehler.
const MAX_PAY_CENTS = 100000

/** 'YYYY-MM-DD' → [Jahr, Monat, Tag], nur fuer Tage, die es gibt. */
function parseDate(text) {
  const treffer = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text ?? '')
  if (!treffer) return null
  const [jahr, monat, tag] = treffer.slice(1).map(Number)
  const probe = new Date(Date.UTC(jahr, monat - 1, tag))
  // Date.UTC rollt den 31.11. still in den Dezember — hier soll er abgelehnt werden.
  if (probe.getUTCMonth() !== monat - 1 || probe.getUTCDate() !== tag) return null
  return [jahr, monat, tag]
}

/**
 * Der Zeitraum als halboffenes Intervall in UTC.
 *
 * Start- und Enddatum sind Kalendertage in Wien, beide ganz eingeschlossen:
 * "23.11. bis 30.11." laeuft vom 23.11. 00:00 bis zum 30.11. 23:59:59 —
 * gerechnet als "bis zum Beginn des 1.12.".
 */
export function promotionWindow(promotion) {
  const [y1, m1, d1] = parseDate(promotion.startDate)
  const [y2, m2, d2] = parseDate(promotion.endDate)
  return { from: startOfDay(y1, m1, d1), to: startOfDay(y2, m2, d2 + 1) }
}

/** @returns {'none'|'off'|'scheduled'|'running'|'ended'} */
export function promotionStatus(promotion, now) {
  if (!promotion) return 'none'
  if (!promotion.enabled) return 'off'
  const { from, to } = promotionWindow(promotion)
  const t = Date.parse(now)
  if (t < Date.parse(from)) return 'scheduled'
  if (t >= Date.parse(to)) return 'ended'
  return 'running'
}

/**
 * Prueft eine Aktion, wie sie aus dem Panel oder aus der Datenbank kommt.
 *
 * Dieselbe Pruefung fuer beide Wege: was schon gespeichert ist, wird beim
 * Laden noch einmal gelesen, als kaeme es von aussen. Eine von Hand in die
 * Tabelle geschriebene Zeile mit einem Bonus groesser als der Kaufbetrag
 * darf nicht deshalb gelten, weil sie am Panel vorbei hineinkam.
 *
 * @returns {{ ok: true, promotion: object } | { ok: false, reason: string, field?: string }}
 */
export function validatePromotion(input) {
  const fail = (reason, field) => ({ ok: false, reason, field })
  if (!input || typeof input !== 'object') return fail('invalid_body')

  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (!name) return fail('name_required', 'name')
  if (name.length > MAX_NAME) return fail('name_too_long', 'name')

  if (!parseDate(input.startDate)) return fail('start_invalid', 'startDate')
  if (!parseDate(input.endDate)) return fail('end_invalid', 'endDate')
  // Lexikografisch genuegt: beide sind YYYY-MM-DD.
  if (input.endDate < input.startDate) return fail('end_before_start', 'endDate')

  if (!Array.isArray(input.tiers) || input.tiers.length === 0) return fail('tiers_required', 'tiers')
  if (input.tiers.length > MAX_TIERS) return fail('too_many_tiers', 'tiers')

  const tiers = []
  for (const tier of input.tiers) {
    const payCents = Number(tier?.payCents)
    const bonusCents = Number(tier?.bonusCents)
    if (!Number.isSafeInteger(payCents) || payCents <= 0) return fail('pay_invalid', 'tiers')
    if (payCents > MAX_PAY_CENTS) return fail('pay_too_high', 'tiers')
    if (!Number.isSafeInteger(bonusCents) || bonusCents <= 0) return fail('bonus_invalid', 'tiers')
    // Der Rabatt muss unter dem Nennwert bleiben — die Datenbank prueft
    // dasselbe. Hier strenger: unter dem Kaufbetrag. Ein Bonus, der den
    // Kaufpreis erreicht, verdoppelt den Gutschein und ist ein Tippfehler.
    if (bonusCents >= payCents) return fail('bonus_too_high', 'tiers')
    if (tiers.some((other) => other.payCents === payCents)) return fail('pay_duplicate', 'tiers')
    tiers.push({ payCents, bonusCents })
  }
  tiers.sort((a, b) => a.payCents - b.payCents)

  return {
    ok: true,
    promotion: {
      enabled: Boolean(input.enabled),
      name,
      startDate: input.startDate,
      endDate: input.endDate,
      tiers,
    },
  }
}

/**
 * Die gespeicherte Aktion oder null.
 *
 * Eine unlesbare Zeile heisst: keine Aktion. Im Zweifel verkauft der Shop
 * zum normalen Preis, statt einen Rabatt zu geben, den niemand eingestellt hat.
 */
export async function loadPromotion(db) {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(KEY).first()
  if (!row) return null

  let parsed
  try {
    parsed = JSON.parse(row.value)
  } catch {
    console.error('promotion: gespeicherter Wert ist kein JSON')
    return null
  }

  const check = validatePromotion(parsed)
  if (!check.ok) {
    console.error('promotion: gespeicherter Wert ungueltig —', check.reason)
    return null
  }
  return check.promotion
}

/**
 * Der Bonus fuer genau diese Bestellung, oder null.
 *
 * Der Kaufbetrag muss eine Stufe exakt treffen: 100 € bekommen den Bonus,
 * 150 € nicht. So hat es die Inhaberin ausgeschrieben.
 */
export function bonusFor(promotion, order, now) {
  if (order.kind !== 'value') return null
  if (promotionStatus(promotion, now) !== 'running') return null
  const tier = promotion.tiers.find((entry) => entry.payCents === order.amountCents)
  return tier ? { bonusCents: tier.bonusCents, name: promotion.name } : null
}

/** Was der Shop von einer laufenden Aktion wissen muss — sonst null. */
export function publicPromotion(promotion, now) {
  if (promotionStatus(promotion, now) !== 'running') return null
  return { name: promotion.name, endDate: promotion.endDate, tiers: promotion.tiers }
}

// ── Stripe ───────────────────────────────────────────────────────

/**
 * Feste Coupon-Kennung je Aktion und Bonusbetrag.
 *
 * Fest statt zufaellig, damit ein zweiter Aufruf denselben Coupon trifft,
 * statt bei jedem Kauf einen neuen anzulegen. Der Zeitraum steckt mit drin:
 * dieselben 20 € zu Weihnachten sind ein anderer Coupon als zur Black Week,
 * und in Stripes Liste soll man beide auseinanderhalten koennen.
 */
export function couponId(promotion, bonusCents) {
  const slug = promotion.name
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'aktion'
  return `fem-${slug}-${promotion.startDate}-${promotion.endDate}-${bonusCents}`
}

// Was Stripe im Checkout als Abzugszeile zeigt. "Rabatt", nicht "Bonus":
// in einer Zeile mit Minus davor liest sich nur das eine richtig, und auf
// dem Beleg steht dasselbe Wort wie bei der Steuerberaterin.
function couponName(promotion) {
  return `Rabatt ${promotion.name}`.slice(0, 40)
}

// Pro Isolat gemerkt, welche Coupons es sicher schon gibt. Ein frisch
// gestarteter Worker fragt einmal nach, danach nicht mehr.
const bekannt = new Set()

/**
 * Legt den Coupon an, falls es ihn noch nicht gibt, und gibt seine Kennung.
 *
 * Erst anlegen, dann bei "gibt es schon" einfach weiter: das kostet einen
 * Aufruf, genau wie vorher nachzusehen, und uebersteht zwei gleichzeitige
 * Kaeufe, die beide den ersten Coupon brauchen.
 */
export async function ensureCoupon(stripe, promotion, bonusCents) {
  const id = couponId(promotion, bonusCents)
  if (bekannt.has(id)) return id

  try {
    await stripe.coupons.create({
      id,
      amount_off: bonusCents,
      currency: 'eur',
      duration: 'once',
      name: couponName(promotion),
    })
  } catch (err) {
    if (err?.code !== 'resource_already_exists') throw err
  }

  bekannt.add(id)
  return id
}

/**
 * Stehen die Coupons bei Stripe bereit? Nur nachsehen, nichts anlegen.
 *
 * Fuer das Panel: ein Schluessel ohne Coupon-Rechte soll dort auffallen,
 * bevor die Aktion beginnt — nicht erst am ersten Kauf.
 */
async function couponStatus(stripe, promotion) {
  try {
    for (const tier of promotion.tiers) {
      await stripe.coupons.retrieve(couponId(promotion, tier.bonusCents))
    }
    return { ready: true }
  } catch (err) {
    if (err?.code === 'resource_missing') return { ready: false, reason: 'missing' }
    return { ready: false, reason: 'error', message: err?.message ?? String(err) }
  }
}

// ── Panel ────────────────────────────────────────────────────────

/** Was die Aktion bisher gebracht hat — nur Gutscheine mit Rabatt im Zeitraum. */
async function soldDuring(db, promotion) {
  const { from, to } = promotionWindow(promotion)
  const row = await db.prepare(
    `SELECT COUNT(*)                                      AS count,
            COALESCE(SUM(original_amount_cents - discount_cents), 0) AS paid_cents,
            COALESCE(SUM(discount_cents), 0)              AS discount_cents
       FROM vouchers
      WHERE discount_cents > 0 AND status = 'active'
        AND issued_at >= ? AND issued_at < ?`,
  ).bind(from, to).first()

  return { count: row.count, paidCents: row.paid_cents, discountCents: row.discount_cents }
}

async function adminView(env, stripe, promotion) {
  const now = new Date().toISOString()
  if (!promotion) return { promotion: null, status: 'none', window: null, stripe: null, sold: null }

  return {
    promotion,
    status: promotionStatus(promotion, now),
    window: promotionWindow(promotion),
    // Bei einer abgeschalteten Aktion kein Aufruf bei Stripe: es gibt
    // nichts, was bereitstehen muesste.
    stripe: promotion.enabled ? await couponStatus(stripe, promotion) : null,
    sold: await soldDuring(env.DB, promotion),
  }
}

export async function getAdminPromotion(env, stripe) {
  return json(await adminView(env, stripe, await loadPromotion(env.DB)))
}

/**
 * Aktion speichern.
 *
 * Eingeschaltet wird nur, was Stripe auch abbilden kann: die Coupons werden
 * vor dem Speichern angelegt. Scheitert das — etwa weil der Schluessel keine
 * Coupon-Rechte hat —, bleibt alles beim Alten und das Panel sagt warum.
 * Sonst stuende im Shop ein Bonus, an dem jeder Kauf scheitert.
 */
export async function updatePromotion(request, env, stripe) {
  let body
  try {
    body = await request.json()
  } catch {
    return error('invalid_json')
  }

  const check = validatePromotion(body)
  if (!check.ok) return error(check.reason, 400, { field: check.field })
  const { promotion } = check

  if (promotion.enabled) {
    try {
      for (const tier of promotion.tiers) await ensureCoupon(stripe, promotion, tier.bonusCents)
    } catch (err) {
      console.error('promotion: Coupon nicht angelegt —', err.message)
      return error('stripe_coupon_failed', 502, { message: err.message })
    }
  }

  await env.DB.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).bind(KEY, JSON.stringify(promotion), new Date().toISOString()).run()

  return json({ ok: true, ...(await adminView(env, stripe, promotion)) })
}
