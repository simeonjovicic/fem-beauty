// Der Preiskatalog — eine Quelle für Shop und Panel.
//
// Bisher las der Gutschein-Konfigurator die Preise direkt aus data.js. Damit
// war eine Preisänderung ein Commit. Diese Datei schiebt eine Schicht
// dazwischen: die Preise aus data.js sind ab jetzt der *Ausgangsstand*, und
// darüber liegt, was im Panel geändert wurde.
//
// Im Entwurf ist dieses „darüber" der localStorage des Browsers. Später ist
// es eine Tabelle `treatments` und ein GET auf /api/admin/treatments — für
// die Komponenten ändert sich dabei nichts, weil sie ohnehin nur
// useCatalog() aufrufen und nie selbst wissen, woher der Preis kommt.
//
// Zwei Entscheidungen, die den Unterschied machen:
//
// 1. Gespeichert werden nur die *Abweichungen*, nicht der ganze Katalog.
//    Ein voller Schnappschuss im Browser würde eine später in data.js
//    ergänzte Behandlung dauerhaft verdecken — sie stünde nicht im
//    Schnappschuss und tauchte deshalb nie auf.
//
//    Neu angelegte Behandlungen sind die Ausnahme: sie stehen in keiner
//    Datei und müssen deshalb vollständig gespeichert werden. `treatments`
//    hält die Änderungen an Bekanntem, `added` die Neuen — zwei Felder
//    statt einem, weil es zwei verschiedene Dinge sind.
//
// 2. Gelesen wird über useSyncExternalStore statt über einen Kontext. Der
//    localStorage ist ein Zustand außerhalb von React, und zwei Tabs — das
//    Panel im einen, der Shop im anderen — sind hier der Normalfall und
//    nicht die Ausnahme. Das 'storage'-Ereignis feuert genau dort.
//
// WICHTIG: das ist eine Vorschau im Browser. Der Worker prüft weiterhin
// gegen seine eigene Kopie aus data.js (worker/src/catalog.js). Ein hier
// geänderter Preis ändert also *nicht*, was Stripe abbucht — dafür braucht
// es den Umbau auf die Datenbank.

import { useSyncExternalStore } from 'react'

import {
  VOUCHER_MAX_AMOUNT,
  VOUCHER_MIN_AMOUNT,
  headSpaTreatments,
  voucherTreatments,
} from './data'

const STORAGE_KEY = 'fem-katalog-entwurf-v1'

// Eigenes Ereignis neben 'storage': das feuert der Browser nur in den
// *anderen* Tabs. Ohne dieses hier bliebe ausgerechnet das Panel, das die
// Änderung ausgelöst hat, auf dem alten Stand.
const CHANGE_EVENT = 'fem:katalog'

const inShop = new Set(voucherTreatments.map((treatment) => treatment.id))

// Alle bekannten Behandlungen, nicht nur die im Shop sichtbaren — sonst
// ließe sich eine ausgeschaltete Variante nie wieder einschalten.
const baseTreatments = [...headSpaTreatments, ...voucherTreatments]
  .filter((treatment, index, list) => list.findIndex((t) => t.id === treatment.id) === index)
  .map((treatment) => ({
    id: treatment.id,
    category: treatment.category,
    title: treatment.title,
    variant: treatment.variant,
    duration: treatment.duration,
    // Cent, nicht Euro: sobald Preise bearbeitbar sind, entstehen Beträge
    // wie 89,50 — und Fließkomma-Euro ist die Stelle, an der später ein
    // Cent fehlt.
    priceCents: Math.round(treatment.price * 100),
    shopVisible: inShop.has(treatment.id),
  }))

export const defaultCatalog = Object.freeze({
  treatments: baseTreatments,
  minCents: VOUCHER_MIN_AMOUNT * 100,
  maxCents: VOUCHER_MAX_AMOUNT * 100,
  presetsCents: [5000, 10000, 15000, 20000],
})

/** localStorage kann werfen — Safari im privaten Modus, gesperrte Cookies. */
function rawOverrides() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function parseOverrides(raw) {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    // Kaputter Eintrag ist kein Grund, den Shop lahmzulegen — dann eben
    // die Ausgangspreise.
    return null
  }
}

const baseIds = new Set(baseTreatments.map((treatment) => treatment.id))

const asText = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '')

/**
 * Eine selbst angelegte Behandlung aus dem Speicher zurücklesen.
 *
 * Der localStorage ist von außen beschreibbar. Was hier zurückkommt, muss
 * dieselbe Form haben wie eine Zeile aus data.js — sonst greift irgendwo
 * weiter oben eine Komponente auf ein Feld zu, das es nicht gibt.
 *
 * @returns {object|null} null, wenn der Eintrag unbrauchbar ist
 */
function readAdded(entry) {
  if (!entry || typeof entry !== 'object') return null

  const id = asText(entry.id, 64)
  const title = asText(entry.title, 60)
  // Eine ID aus data.js darf nicht überschrieben werden: sonst könnte ein
  // Eintrag im Speicher eine echte Behandlung verdrängen.
  if (!id || !title || baseIds.has(id)) return null
  if (!Number.isSafeInteger(entry.priceCents) || entry.priceCents <= 0) return null

  return {
    id,
    category: asText(entry.category, 32) || 'Weitere',
    title,
    variant: asText(entry.variant, 60),
    duration: asText(entry.duration, 24),
    priceCents: entry.priceCents,
    shopVisible: entry.shopVisible !== false,
    // Das Panel unterscheidet daran, was gelöscht werden darf: was aus
    // data.js kommt, lässt sich nur ausblenden, nicht entfernen.
    custom: true,
  }
}

/**
 * Nach Kategorie gruppieren, ohne die Reihenfolge zu erfinden.
 *
 * Die Kategorien behalten die Reihenfolge ihres ersten Auftretens. Ohne das
 * hinge eine neue „Gesicht"-Behandlung im Shop hinten dran, während sie im
 * Panel unter Gesicht steht — dieselbe Liste in zwei Reihenfolgen.
 */
function groupByCategory(treatments) {
  const order = []
  const groups = new Map()

  for (const treatment of treatments) {
    if (!groups.has(treatment.category)) {
      groups.set(treatment.category, [])
      order.push(treatment.category)
    }
    groups.get(treatment.category).push(treatment)
  }

  return order.flatMap((category) => groups.get(category))
}

/**
 * Abweichungen über den Ausgangsstand legen.
 *
 * Jeder Wert wird geprüft, bevor er übernommen wird. Der localStorage ist
 * von außen beschreibbar, und ein `priceCents: "gratis"` darf höchstens
 * ignoriert werden, nicht die Seite zerlegen.
 */
function applyOverrides(overrides) {
  if (!overrides) return defaultCatalog

  const perTreatment = overrides.treatments ?? {}
  const int = (value, fallback) => (Number.isSafeInteger(value) && value > 0 ? value : fallback)

  const patched = defaultCatalog.treatments.map((treatment) => {
    const patch = perTreatment[treatment.id]
    if (!patch || typeof patch !== 'object') return treatment
    return {
      ...treatment,
      priceCents: int(patch.priceCents, treatment.priceCents),
      shopVisible: typeof patch.shopVisible === 'boolean'
        ? patch.shopVisible
        : treatment.shopVisible,
    }
  })

  const seen = new Set(baseIds)
  const added = (Array.isArray(overrides.added) ? overrides.added : [])
    .map(readAdded)
    .filter((treatment) => {
      // Doppelte IDs wären ein Gutschein, der auf zwei Behandlungen zeigt.
      if (!treatment || seen.has(treatment.id)) return false
      seen.add(treatment.id)
      return true
    })

  return {
    ...defaultCatalog,
    minCents: int(overrides.minCents, defaultCatalog.minCents),
    maxCents: int(overrides.maxCents, defaultCatalog.maxCents),
    treatments: groupByCategory([...patched, ...added]),
  }
}

/** Kategorien, die es schon gibt — als Vorschlagsliste im Panel. */
export function categoriesOf(catalog) {
  return [...new Set(catalog.treatments.map((treatment) => treatment.category))]
}

/**
 * Kennung für eine neu angelegte Behandlung.
 *
 * Wird einmal beim Anlegen vergeben und danach nie wieder berechnet. Sie
 * landet als `treatment_id` auf jedem verkauften Gutschein — würde sie sich
 * beim Umbenennen ändern, zeigten alte Gutscheine ins Leere.
 */
export function makeTreatmentId(title, variant, taken) {
  const base = slug(`${title} ${variant}`) || 'behandlung'
  if (!taken.has(base)) return base

  let suffix = 2
  while (taken.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}

function slug(text) {
  return text
    .toLowerCase()
    // Vor der Normalisierung, nicht danach: aus „Maniküre" soll
    // „manikuere" werden und nicht „manikure".
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

// useSyncExternalStore ruft getSnapshot bei jedem Rendern auf und vergleicht
// mit ===. Würde hier jedes Mal ein frisches Objekt entstehen, hielte React
// das für eine Änderung und renderte endlos. Deshalb der Cache auf dem
// Rohtext: gleicher Text, gleiches Objekt.
let cachedRaw
let cachedCatalog = defaultCatalog

export function readCatalog() {
  const raw = rawOverrides()
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedCatalog = applyOverrides(parseOverrides(raw))
  }
  return cachedCatalog
}

function subscribe(onStoreChange) {
  window.addEventListener('storage', onStoreChange)
  window.addEventListener(CHANGE_EVENT, onStoreChange)
  return () => {
    window.removeEventListener('storage', onStoreChange)
    window.removeEventListener(CHANGE_EVENT, onStoreChange)
  }
}

/** Der Katalog, wie er gerade gilt. Aktualisiert sich auch aus einem anderen Tab. */
export function useCatalog() {
  return useSyncExternalStore(subscribe, readCatalog, () => defaultCatalog)
}

/** Was im Shop zur Auswahl steht. */
export function shopTreatments(catalog) {
  return catalog.treatments.filter((treatment) => treatment.shopVisible)
}

/** Liegt überhaupt eine Abweichung vor — für den Zurücksetzen-Knopf im Panel. */
export function hasOverrides() {
  return rawOverrides() !== null
}

/**
 * Speichern.
 *
 * Reduziert auf die Abweichungen und wirft den Eintrag ganz weg, sobald
 * alles wieder auf dem Ausgangsstand steht. Ein leeres `{}` im Speicher
 * wäre sonst ein Katalog „mit Änderungen", der keine hat.
 */
export function saveCatalog(next) {
  const treatments = {}
  const added = []

  for (const treatment of next.treatments) {
    const base = defaultCatalog.treatments.find((entry) => entry.id === treatment.id)

    // Keine Entsprechung in data.js: selbst angelegt, also vollständig
    // speichern statt einen Unterschied zu etwas zu bilden, das es
    // nirgends gibt.
    if (!base) {
      added.push({
        id: treatment.id,
        category: treatment.category,
        title: treatment.title,
        variant: treatment.variant,
        duration: treatment.duration,
        priceCents: treatment.priceCents,
        shopVisible: treatment.shopVisible,
      })
      continue
    }

    const patch = {}
    if (treatment.priceCents !== base.priceCents) patch.priceCents = treatment.priceCents
    if (treatment.shopVisible !== base.shopVisible) patch.shopVisible = treatment.shopVisible
    if (Object.keys(patch).length > 0) treatments[treatment.id] = patch
  }

  const overrides = {}
  if (Object.keys(treatments).length > 0) overrides.treatments = treatments
  if (added.length > 0) overrides.added = added
  if (next.minCents !== defaultCatalog.minCents) overrides.minCents = next.minCents
  if (next.maxCents !== defaultCatalog.maxCents) overrides.maxCents = next.maxCents

  write(Object.keys(overrides).length > 0 ? JSON.stringify(overrides) : null)
}

/** Zurück auf die Preise aus data.js. */
export function resetCatalog() {
  write(null)
}

function write(raw) {
  try {
    if (raw === null) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, raw)
  } catch {
    // Kein Speicher verfügbar: die Änderung gilt dann nur bis zum Neuladen.
    // Das Ereignis trotzdem feuern, damit die Oberfläche nicht einfriert.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}
