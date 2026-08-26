// Behandlungen lesen und pflegen.
//
// Lesen ist öffentlich — der Gutschein-Shop braucht die Preise, um sie
// anzuzeigen. Schreiben liegt unter /api/admin und damit hinter Access.
//
// Bei einer Preisänderung gilt: bereits verkaufte Gutscheine bleiben
// unberührt. `vouchers` hält Betrag und Namen als Schnappschuss und
// verweist nicht per Fremdschlüssel hierher.

import { listTreatments, treatmentLabel } from './catalog.js'
import { error, json } from './http.js'

const MAX_PRICE_CENTS = 100000 // 1.000 € — eine Behandlung darüber ist ein Tippfehler.

/** Öffentliche Sicht für den Shop: nur was sichtbar ist, ohne Verwaltungsfelder. */
export async function getPublicTreatments(env) {
  const rows = await listTreatments(env.DB, 'shop')
  return json({
    treatments: rows.map((row) => ({
      id: row.id,
      category: row.category,
      title: row.title,
      variant: row.variant,
      duration: row.duration,
      priceCents: row.price_cents,
      label: treatmentLabel(row),
    })),
  }, 200, {
    // Preise ändern sich selten, aber wenn, soll die Änderung nicht
    // minutenlang hängen. Eine Minute nimmt die Last und bleibt frisch.
    'cache-control': 'public, max-age=60',
  })
}

/** Panel-Sicht: alle Zeilen roh, auch die ausgeblendeten. */
export async function getAdminTreatments(env) {
  return json({ treatments: await listTreatments(env.DB, 'all') })
}

function validateInput(body, { partial = false } = {}) {
  const fail = (reason, field) => ({ ok: false, reason, field })
  if (!body || typeof body !== 'object') return fail('invalid_body')

  const out = {}

  for (const field of ['category', 'title']) {
    if (body[field] === undefined && partial) continue
    const value = typeof body[field] === 'string' ? body[field].trim() : ''
    if (!value) return fail(`${field}_required`, field)
    if (value.length > 80) return fail(`${field}_too_long`, field)
    out[field] = value
  }

  for (const field of ['variant', 'duration']) {
    if (body[field] === undefined && partial) continue
    const value = typeof body[field] === 'string' ? body[field].trim() : ''
    if (value.length > 80) return fail(`${field}_too_long`, field)
    out[field] = value || null
  }

  if (body.priceCents !== undefined || !partial) {
    const cents = Number(body.priceCents)
    // Ganzzahlig verlangt, nicht gerundet: ein Preis, der als 89.5 Cent
    // ankommt, ist ein Fehler des Aufrufers und keine Rundungsfrage.
    if (!Number.isSafeInteger(cents)) return fail('price_not_integer', 'priceCents')
    if (cents <= 0) return fail('price_not_positive', 'priceCents')
    if (cents > MAX_PRICE_CENTS) return fail('price_too_high', 'priceCents')
    out.price_cents = cents
  }

  if (body.shopVisible !== undefined) out.shop_visible = body.shopVisible ? 1 : 0
  if (body.sortOrder !== undefined) {
    const order = Number(body.sortOrder)
    if (!Number.isSafeInteger(order)) return fail('sort_order_invalid', 'sortOrder')
    out.sort_order = order
  }

  return { ok: true, values: out }
}

/** Kennung aus dem Titel — lesbar in der URL und im Panel wiedererkennbar. */
function slugify(title, variant) {
  const base = [title, variant].filter(Boolean).join(' ')
  return base
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

export async function createTreatment(request, env) {
  let body
  try {
    body = await request.json()
  } catch {
    return error('invalid_json')
  }

  const check = validateInput(body)
  if (!check.ok) return error(check.reason, 400, { field: check.field })

  const now = new Date().toISOString()
  const values = check.values
  const base = slugify(values.title, values.variant) || 'behandlung'

  // Bei gleichem Namen eine Ziffer anhängen, statt den bestehenden Eintrag
  // zu überschreiben.
  let id = base
  for (let suffix = 2; suffix < 50; suffix += 1) {
    const taken = await env.DB.prepare('SELECT 1 FROM treatments WHERE id = ?').bind(id).first()
    if (!taken) break
    id = `${base}-${suffix}`
  }

  await env.DB.prepare(
    `INSERT INTO treatments
       (id, category, title, variant, duration, price_cents, shop_visible, sort_order, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
  ).bind(
    id, values.category, values.title, values.variant ?? null, values.duration ?? null,
    values.price_cents, values.shop_visible ?? 1, values.sort_order ?? 999, now, now,
  ).run()

  const created = await env.DB.prepare('SELECT * FROM treatments WHERE id = ?').bind(id).first()
  return json({ ok: true, treatment: created }, 201)
}

export async function updateTreatment(request, env, id) {
  let body
  try {
    body = await request.json()
  } catch {
    return error('invalid_json')
  }

  const check = validateInput(body, { partial: true })
  if (!check.ok) return error(check.reason, 400, { field: check.field })

  const values = check.values
  const columns = Object.keys(values)
  if (!columns.length) return error('nothing_to_update')

  const existing = await env.DB.prepare('SELECT 1 FROM treatments WHERE id = ?').bind(id).first()
  if (!existing) return error('not_found', 404)

  const assignments = columns.map((column) => `${column} = ?`).join(', ')
  await env.DB.prepare(
    `UPDATE treatments SET ${assignments}, updated_at = ? WHERE id = ?`,
  ).bind(...columns.map((column) => values[column]), new Date().toISOString(), id).run()

  const updated = await env.DB.prepare('SELECT * FROM treatments WHERE id = ?').bind(id).first()
  return json({ ok: true, treatment: updated })
}

/**
 * Ausblenden statt löschen.
 *
 * Eine gelöschte Zeile nähme dem Panel die Möglichkeit, sie wieder
 * einzuschalten — und bei einer Behandlung, die saisonal pausiert, wäre
 * genau das der Normalfall.
 */
export async function hideTreatment(env, id) {
  const result = await env.DB.prepare(
    'UPDATE treatments SET shop_visible = 0, updated_at = ? WHERE id = ?',
  ).bind(new Date().toISOString(), id).run()

  if ((result.meta?.changes ?? 0) === 0) return error('not_found', 404)
  return json({ ok: true })
}
