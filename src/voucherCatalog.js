// Der Preiskatalog — eine Quelle für Shop und Panel.
//
// Bis zuletzt lagen die Preise im localStorage des Browsers: eine Änderung
// im Panel war für den Server unsichtbar, der Shop konnte also einen Preis
// anzeigen, den Stripe nicht abbucht. Jetzt kommen sie aus der Tabelle
// `treatments` — dieselbe, gegen die worker/src/catalog.js beim Checkout
// prüft.
//
// Zwei Sichten auf dieselben Daten:
//
//   useCatalog()       für den Shop. Öffentlicher Endpunkt, nur was
//                      sichtbar ist, ohne Verwaltungsfelder.
//   useAdminCatalog()  fürs Panel. Hinter Access, auch die ausgeblendeten
//                      Behandlungen — sonst ließe sich eine pausierte
//                      Variante nie wieder einschalten.
//
// Beide liefern zusätzlich `loading` und `error`. Ein Ladefehler darf im
// Shop nicht als leere Auswahl erscheinen: „keine Behandlungen" und
// „Server nicht erreichbar" sehen sonst gleich aus.

import { useCallback, useEffect, useMemo, useState } from 'react'

import { API_BASE } from './config'

// Betragsgrenzen, falls die API nicht antwortet. Bewusst nicht großzügig:
// im Zweifel lieber zu eng als ein Betrag, den der Server ablehnt.
const FALLBACK_LIMITS = { minCents: 2500, maxCents: 50000 }

export const PRESETS_CENTS = [5000, 10000, 15000, 20000]

async function get(path) {
  const response = await fetch(`${API_BASE}${path}`, { credentials: 'include' })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.reason ?? 'Katalog nicht geladen')
  return data
}

/** Rohe Zeile aus der Datenbank → die Form, die die Komponenten nutzen. */
function fromRow(row) {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    variant: row.variant ?? '',
    duration: row.duration ?? '',
    priceCents: row.price_cents ?? row.priceCents,
    shopVisible: row.shop_visible === undefined ? true : Boolean(row.shop_visible),
  }
}

function useCatalogFrom(path) {
  const [treatments, setTreatments] = useState([])
  const [limits, setLimits] = useState(FALLBACK_LIMITS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    try {
      const data = await get(path)
      setTreatments((data.treatments ?? []).map(fromRow))
      setLimits(data.limits ?? FALLBACK_LIMITS)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [path])

  useEffect(() => {
    // Die Regel warnt vor setState synchron im Effektkoerper; hier laufen
    // alle Zustandsaenderungen erst nach einem await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload()
  }, [reload])

  return useMemo(() => ({
    treatments,
    minCents: limits.minCents,
    maxCents: limits.maxCents,
    presetsCents: PRESETS_CENTS.filter(
      (cents) => cents >= limits.minCents && cents <= limits.maxCents,
    ),
    loading,
    error,
    reload,
  }), [treatments, limits, loading, error, reload])
}

/** Der Katalog für den Shop. */
export function useCatalog() {
  return useCatalogFrom('/api/treatments')
}

/** Der Katalog fürs Panel, inklusive ausgeblendeter Behandlungen. */
export function useAdminCatalog() {
  return useCatalogFrom('/api/admin/treatments')
}

/**
 * Was im Shop zur Auswahl steht.
 *
 * Der öffentliche Endpunkt filtert bereits; die Prüfung bleibt trotzdem,
 * weil dieselbe Funktion auch auf den Panel-Katalog angewendet wird.
 */
export function shopTreatments(catalog) {
  return catalog.treatments.filter((treatment) => treatment.shopVisible)
}

export function categoriesOf(catalog) {
  return [...new Set(catalog.treatments.map((treatment) => treatment.category))]
}

// ── Schreiben (nur Panel) ────────────────────────────────────────

async function send(path, method, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.reason ?? `${method} fehlgeschlagen`)
  return data
}

/**
 * Übernimmt einen bearbeiteten Katalog.
 *
 * Vergleicht gegen den geladenen Stand und schickt nur, was sich geändert
 * hat — die API arbeitet je Behandlung, das Panel denkt in ganzen Listen.
 * Ein voller Durchlauf über alle Zeilen wäre einfacher zu schreiben, würde
 * aber `updated_at` bei jedem Speichern auf allen Behandlungen anfassen
 * und damit unbrauchbar machen.
 *
 * @returns {Promise<number>} Anzahl der tatsächlich geschriebenen Änderungen
 */
export async function saveCatalog(next, current) {
  const before = new Map(current.treatments.map((treatment) => [treatment.id, treatment]))
  let written = 0

  for (const treatment of next.treatments) {
    const old = before.get(treatment.id)

    if (!old) {
      await send('/api/admin/treatments', 'POST', {
        category: treatment.category,
        title: treatment.title,
        variant: treatment.variant,
        duration: treatment.duration,
        priceCents: treatment.priceCents,
        shopVisible: treatment.shopVisible,
      })
      written += 1
      continue
    }

    const changes = {}
    if (treatment.priceCents !== old.priceCents) changes.priceCents = treatment.priceCents
    if (treatment.shopVisible !== old.shopVisible) changes.shopVisible = treatment.shopVisible
    if (treatment.title !== old.title) changes.title = treatment.title
    if (treatment.variant !== old.variant) changes.variant = treatment.variant
    if (treatment.duration !== old.duration) changes.duration = treatment.duration
    if (treatment.category !== old.category) changes.category = treatment.category

    if (Object.keys(changes).length) {
      await send(`/api/admin/treatments/${encodeURIComponent(treatment.id)}`, 'PATCH', changes)
      written += 1
    }
  }

  // Aus der Liste entfernt heißt ausblenden, nicht löschen — die Zeile
  // bleibt, damit sie wieder einschaltbar ist.
  const kept = new Set(next.treatments.map((treatment) => treatment.id))
  for (const treatment of current.treatments) {
    if (kept.has(treatment.id) || !treatment.shopVisible) continue
    await send(`/api/admin/treatments/${encodeURIComponent(treatment.id)}`, 'DELETE')
    written += 1
  }

  if (next.minCents !== current.minCents || next.maxCents !== current.maxCents) {
    await send('/api/admin/limits', 'PATCH', {
      minCents: next.minCents,
      maxCents: next.maxCents,
    })
    written += 1
  }

  return written
}
