// Erzeugt das Saat-SQL für die Behandlungstabelle aus src/data.js.
//
// Einmalig beim Aufsetzen einer Datenbank gedacht, danach ist das Panel
// die Quelle. Deshalb INSERT OR IGNORE: ein zweiter Lauf ändert nichts an
// dem, was inzwischen im Panel gepflegt wurde.
//
//   node worker/seed-treatments.mjs > /tmp/treatments.sql
//   wrangler d1 execute fem-gutscheine --local  --file /tmp/treatments.sql
//   wrangler d1 execute fem-gutscheine --remote --file /tmp/treatments.sql

import { headSpaTreatments, voucherTreatments } from '../src/data.js'

const now = new Date().toISOString()
const quote = (value) => (value == null ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`)

// Alle bekannten Behandlungen, nicht nur die im Shop sichtbaren — sonst
// ließe sich eine ausgeblendete Variante später nie wieder einschalten.
const inShop = new Set(voucherTreatments.map((treatment) => treatment.id))
const all = [...headSpaTreatments, ...voucherTreatments]
  .filter((treatment, index, list) => list.findIndex((t) => t.id === treatment.id) === index)

const rows = all.map((treatment, index) => {
  // Cent, nicht Euro: sobald Preise bearbeitbar sind, entstehen Beträge
  // wie 89,50 — und Fließkomma-Euro ist die Stelle, an der später ein
  // Cent fehlt.
  const cents = Math.round(treatment.price * 100)
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new Error(`${treatment.id}: unbrauchbarer Preis ${treatment.price}`)
  }

  return `INSERT OR IGNORE INTO treatments
  (id, category, title, variant, duration, price_cents, shop_visible, sort_order, created_at, updated_at)
  VALUES (${quote(treatment.id)}, ${quote(treatment.category)}, ${quote(treatment.title)},
          ${quote(treatment.variant)}, ${quote(treatment.duration)}, ${cents},
          ${inShop.has(treatment.id) ? 1 : 0}, ${index * 10}, ${quote(now)}, ${quote(now)});`
})

console.log(rows.join('\n'))
