// Preise pflegen.
//
// Die Frage dahinter war: kann die Inhaberin die Preise selbst ändern, und
// ändert sich damit auch, was ein Gutschein kostet? Ja — aber nur, wenn
// zwei Dinge getrennt bleiben, und genau das versucht diese Oberfläche
// sichtbar zu machen:
//
//   Der Katalogpreis gilt für den *nächsten* Kauf.
//   Ein verkaufter Gutschein behält seinen Betrag für immer.
//
// Deshalb steht neben jeder Änderung, was sie im Shop bewirkt, und darunter
// der Satz, dass bereits verkaufte Gutscheine unberührt bleiben. Ohne diese
// Zusicherung wäre die naheliegende Sorge berechtigt, dass eine
// Preiserhöhung alten Gutscheinen Guthaben wegnimmt.
//
// Alles — Preis, Sichtbarkeit, neue Behandlung, entfernte Behandlung —
// sammelt sich erst im Entwurf und wird mit einem Knopf übernommen. Ein
// „Hinzufügen", das sofort im Shop landet, während der Preis daneben noch
// auf Bestätigung wartet, wären zwei Regeln in derselben Maske.

import { useMemo, useState } from 'react'

import {
  categoriesOf,
  saveCatalog,
  useAdminCatalog,
} from '../voucherCatalog'
import { euro } from './format'

// Ein Behandlungspreis über 2.000 € ist im Studio kein Preis, sondern ein
// Tippfehler mit einer Null zu viel. Lieber hier abfangen als im Checkout.
const MAX_PRICE_CENTS = 200000
const MIN_PRICE_CENTS = 100

/**
 * Euro-Eingabe zu Cent.
 *
 * Nimmt Komma wie Punkt: auf einer österreichischen Tastatur wird „89,50"
 * getippt, aus einer Kalkulationstabelle kopiert kommt „89.50".
 *
 * @returns {number|null} null, wenn die Eingabe keine Zahl ist
 */
function toCents(text) {
  const cleaned = String(text).trim().replace(/\s|€/g, '').replace(',', '.')
  if (!cleaned || !/^\d+(\.\d{0,2})?$/.test(cleaned)) return null
  return Math.round(Number(cleaned) * 100)
}

/** Cent zurück ins Eingabefeld — ohne Währungszeichen, das tippt niemand mit. */
function toInput(cents) {
  return (cents / 100).toLocaleString('de-AT', {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

function label(treatment) {
  return [treatment.title, treatment.variant].filter(Boolean).join(' · ')
}

function initialDraft(catalog) {
  return {
    prices: Object.fromEntries(catalog.treatments.map((t) => [t.id, toInput(t.priceCents)])),
    visible: Object.fromEntries(catalog.treatments.map((t) => [t.id, t.shopVisible])),
    min: toInput(catalog.minCents),
    max: toInput(catalog.maxCents),
    // Noch nicht übernommene Neuzugänge, in der Form einer Katalogzeile.
    added: [],
    // IDs, die beim Speichern verschwinden. Nur selbst angelegte —
    // was aus data.js kommt, lässt sich ausblenden, aber nicht löschen.
    removed: [],
  }
}

/**
 * Die Liste, wie sie gerade angezeigt wird: gespeicherter Stand, ohne die
 * zum Entfernen vorgemerkten, plus die noch nicht übernommenen Neuen.
 */
function rowsOf(draft, catalog) {
  const kept = catalog.treatments.filter((t) => !draft.removed.includes(t.id))
  return [...kept, ...draft.added]
}

/** Was gegenüber dem gespeicherten Stand anders ist — die Grundlage für alles Weitere. */
function diffOf(draft, catalog) {
  const saved = new Map(catalog.treatments.map((t) => [t.id, t]))
  const changed = []

  for (const row of rowsOf(draft, catalog)) {
    const base = saved.get(row.id)
    const next = toCents(draft.prices[row.id])
    const visibleNow = draft.visible[row.id]

    if (!base) {
      changed.push({ type: 'added', row, to: next, visibleNow })
      continue
    }

    const priceChanged = next !== null && next !== base.priceCents
    const visibilityChanged = visibleNow !== base.shopVisible
    if (!priceChanged && !visibilityChanged) continue

    changed.push({
      type: 'changed',
      row: base,
      from: base.priceCents,
      to: next,
      priceChanged,
      visibilityChanged,
      visibleNow,
    })
  }

  for (const id of draft.removed) {
    const base = saved.get(id)
    if (base) changed.push({ type: 'removed', row: base })
  }

  const min = toCents(draft.min)
  const max = toCents(draft.max)
  const minChanged = min !== null && min !== catalog.minCents
  const maxChanged = max !== null && max !== catalog.maxCents

  return {
    changed,
    minChanged,
    maxChanged,
    min,
    max,
    count: changed.length + (minChanged ? 1 : 0) + (maxChanged ? 1 : 0),
  }
}

/** Alles, was das Speichern verhindert. Leer heißt: darf raus. */
function problemsOf(draft, catalog) {
  const problems = []

  for (const row of rowsOf(draft, catalog)) {
    const cents = toCents(draft.prices[row.id])
    const name = label(row)
    if (cents === null) problems.push(`${name}: kein gültiger Preis.`)
    else if (cents < MIN_PRICE_CENTS) problems.push(`${name}: mindestens ${euro(MIN_PRICE_CENTS)}.`)
    else if (cents > MAX_PRICE_CENTS) problems.push(`${name}: höchstens ${euro(MAX_PRICE_CENTS)}.`)
  }

  const min = toCents(draft.min)
  const max = toCents(draft.max)
  if (min === null || max === null) problems.push('Wertgutschein: Grenzen sind keine gültigen Beträge.')
  else if (min < MIN_PRICE_CENTS) problems.push(`Wertgutschein: Mindestbetrag ab ${euro(MIN_PRICE_CENTS)}.`)
  else if (min >= max) problems.push('Wertgutschein: Mindestbetrag muss unter dem Höchstbetrag liegen.')

  return problems
}

/**
 * Laedt den Katalog und uebergibt ihn.
 *
 * Der `key` sorgt dafuer, dass der Editor seinen Entwurf neu aus den Daten
 * aufbaut, sobald sie sich geaendert haben — nach dem Laden und nach jedem
 * Speichern. Das ist der Weg, Zustand an Daten zu binden, ohne ihn in
 * einem Effekt nachtraeglich zu ueberschreiben.
 */
export default function PricesTab() {
  const catalog = useAdminCatalog()

  if (catalog.loading) return <p className="adm-empty">Preise werden geladen …</p>

  // Ein Ladefehler darf nicht als leerer Katalog erscheinen: „keine
  // Behandlungen" und „Server nicht erreichbar" saehen sonst gleich aus.
  if (catalog.error) {
    return (
      <div className="adm-mock" role="alert">
        <strong>Nicht geladen</strong>
        <span>
          {catalog.error}{' '}
          <button type="button" className="adm-undo" onClick={catalog.reload}>
            Erneut versuchen
          </button>
        </span>
      </div>
    )
  }

  const version = catalog.treatments
    .map((treatment) => `${treatment.id}:${treatment.priceCents}:${treatment.shopVisible}`)
    .join('|')

  return <PricesEditor key={`${version}|${catalog.minCents}|${catalog.maxCents}`} catalog={catalog} />
}

function PricesEditor({ catalog }) {
  const [draft, setDraft] = useState(() => initialDraft(catalog))
  const [flash, setFlash] = useState(null)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)

  // Alles Folgende wird aus draft und catalog abgeleitet, nicht nebenher
  // gepflegt. Ein zweiter useState für „hat Änderungen" wäre eine zweite
  // Wahrheit, die beim Zurücksetzen eines Feldes auf den alten Wert falsch
  // stünde.
  const rows = useMemo(() => rowsOf(draft, catalog), [draft, catalog])
  const diff = useMemo(() => diffOf(draft, catalog), [draft, catalog])
  const problems = useMemo(() => problemsOf(draft, catalog), [draft, catalog])

  const groups = useMemo(() => {
    const byCategory = new Map()
    for (const treatment of rows) {
      const list = byCategory.get(treatment.category) ?? []
      list.push(treatment)
      byCategory.set(treatment.category, list)
    }
    return [...byCategory]
  }, [rows])

  const categories = useMemo(() => categoriesOf(catalog), [catalog])

  const setPrice = (id, value) => {
    setFlash(null)
    setDraft((prev) => ({ ...prev, prices: { ...prev.prices, [id]: value } }))
  }

  const toggleVisible = (id) => {
    setFlash(null)
    setDraft((prev) => ({ ...prev, visible: { ...prev.visible, [id]: !prev.visible[id] } }))
  }

  const setLimit = (key, value) => {
    setFlash(null)
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const addTreatment = (entry) => {
    setFlash(null)
    setAdding(false)
    setDraft((prev) => ({
      ...prev,
      added: [...prev.added, entry],
      prices: { ...prev.prices, [entry.id]: toInput(entry.priceCents) },
      visible: { ...prev.visible, [entry.id]: entry.shopVisible },
    }))
  }

  /**
   * Entfernen.
   *
   * Ein noch nicht übernommener Neuzugang verschwindet einfach — es gibt
   * nichts, was gespeichert wäre. Eine bereits gespeicherte Behandlung wird
   * nur vorgemerkt, damit sie mit „Verwerfen" zurückkommt.
   */
  const removeTreatment = (id) => {
    setFlash(null)
    setDraft((prev) => (prev.added.some((entry) => entry.id === id)
      ? { ...prev, added: prev.added.filter((entry) => entry.id !== id) }
      : { ...prev, removed: [...prev.removed, id] }))
  }

  const undoRemove = (id) => {
    setFlash(null)
    setDraft((prev) => ({ ...prev, removed: prev.removed.filter((entry) => entry !== id) }))
  }

  const discard = () => {
    setDraft(initialDraft(catalog))
    setAdding(false)
    setFlash(null)
  }

  const save = async () => {
    if (problems.length > 0 || saving) return

    const next = {
      treatments: rows.map((treatment) => ({
        ...treatment,
        priceCents: toCents(draft.prices[treatment.id]) ?? treatment.priceCents,
        shopVisible: draft.visible[treatment.id],
      })),
      minCents: diff.min,
      maxCents: diff.max,
    }
    setSaving(true)
    try {
      const count = await saveCatalog(next, catalog)
      // Kein setDraft hier: das Neuladen aendert den `key` der Komponente,
      // und damit baut sich der Entwurf ohnehin aus den frischen Daten auf.
      await catalog.reload()
      setFlash({
        ok: true,
        message: `${count} ${count === 1 ? 'Änderung' : 'Änderungen'} übernommen. `
          + 'Der Gutschein-Shop rechnet ab sofort mit den neuen Preisen.',
      })
    } catch (err) {
      setFlash({ ok: false, message: err.message || 'Speichern fehlgeschlagen.' })
    } finally {
      setSaving(false)
    }
  }

  const shopCount = rows.filter((treatment) => draft.visible[treatment.id]).length

  return (
    <div className="adm-prices">
      {/* Ohne eigene Ueberschrift: die steht bereits als h1 ueber der Seite,
          und zweimal dasselbe Wort untereinander liest sich wie ein Fehler. */}
      <section className="adm-card adm-explain">
        <p>
          Was hier steht, bestimmt den Preis im Gutschein-Shop. Eine Änderung
          gilt ab dem nächsten Kauf.
        </p>
        <p className="adm-note">
          <strong>Bereits verkaufte Gutscheine bleiben unberührt.</strong> Jeder
          Gutschein speichert Betrag und Behandlungsname so, wie sie beim Kauf
          waren — eine Preiserhöhung nimmt niemandem Guthaben weg, eine Senkung
          gibt keines dazu.
        </p>

        <p className="adm-explain-links">
          <a className="adm-ghost" href="/gutscheine" target="_blank" rel="noreferrer">
            Gutschein-Shop öffnen ↗
          </a>
          <span>
            Gespeicherte Preise erscheinen dort sofort — auch in einem
            Fenster, das schon offen ist.
          </span>
        </p>

      </section>

      <section className="adm-card">
        <h2>Wertgutschein</h2>
        <p className="adm-sub">
          Der frei wählbare Betrag. Die Kundin gibt ihn selbst ein, diese
          Grenzen halten ihn im sinnvollen Bereich.
        </p>

        <div className="adm-limit-row">
          <label className="adm-money-field">
            <span>Mindestbetrag</span>
            <MoneyInput value={draft.min} onChange={(value) => setLimit('min', value)} />
          </label>
          <label className="adm-money-field">
            <span>Höchstbetrag</span>
            <MoneyInput value={draft.max} onChange={(value) => setLimit('max', value)} />
          </label>
          <p className="adm-limit-hint">
            Schnellwahl im Shop:{' '}
            {catalog.presetsCents.map((cents) => euro(cents)).join(' · ')}
          </p>
        </div>
      </section>

      <section className="adm-card adm-catalog">
        <div className="adm-catalog-head">
          <h2>Behandlungsgutscheine</h2>
          <span className="adm-count">{shopCount} von {rows.length} im Shop</span>
        </div>
        <p className="adm-sub">
          Der Preis ist zugleich der Gutscheinwert — wer diese Behandlung
          verschenkt, zahlt genau diesen Betrag.
        </p>

        {groups.map(([category, treatments]) => (
          <div className="adm-cat" key={category}>
            <h3>{category}</h3>
            {treatments.map((treatment) => (
              <TreatmentRow
                key={treatment.id}
                treatment={treatment}
                value={draft.prices[treatment.id]}
                visible={draft.visible[treatment.id]}
                isNew={draft.added.some((entry) => entry.id === treatment.id)}
                onPrice={setPrice}
                onToggle={toggleVisible}
                onRemove={removeTreatment}
              />
            ))}
          </div>
        ))}

        {/* Zum Entfernen vorgemerkte Zeilen bleiben sichtbar, durchgestrichen
            und mit Rückweg. Ein Eintrag, der beim Klick verschwindet, lässt
            einen raten, ob man den richtigen erwischt hat. */}
        {draft.removed.length > 0 ? (
          <div className="adm-cat adm-removed">
            <h3>Wird beim Speichern entfernt</h3>
            {draft.removed.map((id) => {
              const treatment = catalog.treatments.find((entry) => entry.id === id)
              if (!treatment) return null
              return (
                <div className="adm-price-row is-removed" key={id}>
                  <div className="adm-price-name">
                    <strong>{treatment.title}</strong>
                    <small>
                      {[treatment.variant, treatment.duration].filter(Boolean).join(' · ')}
                    </small>
                  </div>
                  <button type="button" className="adm-ghost" onClick={() => undoRemove(id)}>
                    Doch behalten
                  </button>
                </div>
              )
            })}
          </div>
        ) : null}

        {adding ? (
          <AddTreatmentForm
            categories={categories}
            onAdd={addTreatment}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <p className="adm-add-row">
            <button type="button" className="adm-ghost" onClick={() => setAdding(true)}>
              + Behandlung hinzufügen
            </button>
            <span>Erscheint nach dem Speichern im Gutschein-Shop.</span>
          </p>
        )}
      </section>

      {diff.count > 0 ? (
        <ChangeSummary diff={diff} catalog={catalog} problems={problems} />
      ) : null}

      {flash ? (
        <p className={`adm-flash ${flash.ok ? 'ok' : 'bad'}`} role="status">{flash.message}</p>
      ) : null}

      {/* Die Leiste bleibt am unteren Rand stehen, solange etwas offen ist.
          Der Katalog ist länger als ein Bildschirm; ein Speichern-Knopf ganz
          unten wäre nach der dritten Änderung außer Sicht. */}
      {diff.count > 0 ? (
        <div className="adm-savebar" role="region" aria-label="Ungespeicherte Änderungen">
          <span>
            <strong>{diff.count}</strong>{' '}
            {diff.count === 1 ? 'offene Änderung' : 'offene Änderungen'}
          </span>
          <div>
            <button type="button" className="adm-ghost" onClick={discard}>Verwerfen</button>
            <button
              type="button"
              className="adm-submit"
              disabled={problems.length > 0}
              onClick={save}
            >
              Speichern
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MoneyInput({ value, onChange, id }) {
  return (
    <span className="adm-money">
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
        spellCheck="false"
      />
      <i aria-hidden="true">€</i>
    </span>
  )
}

/**
 * Neue Behandlung anlegen.
 *
 * Eigener Zustand statt Feldern im Entwurf: solange nicht auf „Hinzufügen"
 * geklickt wurde, ist das hier keine Änderung am Katalog, und die
 * Speicherleiste soll deswegen nicht aufwachen.
 */
function AddTreatmentForm({ categories, onAdd, onCancel }) {
  const [category, setCategory] = useState(categories[0] ?? '')
  const [title, setTitle] = useState('')
  const [variant, setVariant] = useState('')
  const [duration, setDuration] = useState('')
  const [price, setPrice] = useState('')
  const [error, setError] = useState('')

  function submit(event) {
    event.preventDefault()

    const cents = toCents(price)
    if (!title.trim()) return setError('Bitte einen Namen für die Behandlung eingeben.')
    if (!category.trim()) return setError('Bitte eine Kategorie wählen oder eintragen.')
    if (cents === null) return setError('Der Preis ist keine gültige Zahl.')
    if (cents < MIN_PRICE_CENTS) return setError(`Mindestens ${euro(MIN_PRICE_CENTS)}.`)
    if (cents > MAX_PRICE_CENTS) return setError(`Höchstens ${euro(MAX_PRICE_CENTS)}.`)

    return onAdd({
      category: category.trim(),
      title: title.trim(),
      variant: variant.trim(),
      duration: duration.trim(),
      priceCents: cents,
      shopVisible: true,
      custom: true,
    })
  }

  return (
    <form className="adm-add" onSubmit={submit}>
      <h3>Neue Behandlung</h3>

      <div className="adm-add-grid">
        <label className="adm-text-field">
          <span>Kategorie</span>
          {/* list statt select: eine bestehende Kategorie wählen *oder* eine
              neue tippen, ohne dafür einen zweiten Bedienweg zu bauen. */}
          <input
            value={category}
            list="adm-categories"
            onChange={(event) => setCategory(event.target.value)}
            placeholder="z. B. Gesicht"
            maxLength={32}
            autoComplete="off"
          />
          <datalist id="adm-categories">
            {categories.map((entry) => <option value={entry} key={entry} />)}
          </datalist>
        </label>

        <label className="adm-text-field">
          <span>Behandlung</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="z. B. Carbon Laser"
            maxLength={60}
            autoComplete="off"
          />
        </label>

        <label className="adm-text-field">
          <span>Variante <i>(optional)</i></span>
          <input
            value={variant}
            onChange={(event) => setVariant(event.target.value)}
            placeholder="z. B. Glow Peel"
            maxLength={60}
            autoComplete="off"
          />
        </label>

        <label className="adm-text-field">
          <span>Dauer <i>(optional)</i></span>
          <input
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
            placeholder="z. B. 60 Min."
            maxLength={24}
            autoComplete="off"
          />
        </label>

        <label className="adm-text-field adm-text-field-price">
          <span>Preis</span>
          <MoneyInput value={price} onChange={setPrice} />
        </label>
      </div>

      {error ? <p className="adm-flash bad" role="alert">{error}</p> : null}

      <div className="adm-add-actions">
        <button type="button" className="adm-ghost" onClick={onCancel}>Abbrechen</button>
        <button type="submit" className="adm-submit">Hinzufügen</button>
      </div>

      <p className="adm-note">
        Die Behandlung wird beim Speichern übernommen und steht danach im
        Gutschein-Shop zur Auswahl.
      </p>
    </form>
  )
}

function TreatmentRow({ treatment, value, visible, isNew, onPrice, onToggle, onRemove }) {
  const cents = toCents(value)
  const changed = cents !== null && cents !== treatment.priceCents
  const invalid = cents === null || cents < MIN_PRICE_CENTS || cents > MAX_PRICE_CENTS

  return (
    <div className={`adm-price-row${visible ? '' : ' is-hidden'}`}>
      <button
        type="button"
        className="adm-toggle"
        role="switch"
        aria-checked={visible}
        aria-label={`${label(treatment)} im Shop anzeigen`}
        onClick={() => onToggle(treatment.id)}
      >
        <span aria-hidden="true" />
      </button>

      <div className="adm-price-name">
        <strong>{treatment.title}</strong>
        <small>{[treatment.variant, treatment.duration].filter(Boolean).join(' · ')}</small>
      </div>

      <div className="adm-price-edit">
        {changed && !isNew ? <s aria-label="bisher">{euro(treatment.priceCents)}</s> : null}
        <MoneyInput
          id={`price-${treatment.id}`}
          value={value}
          onChange={(next) => onPrice(treatment.id, next)}
        />
      </div>

      <span className="adm-price-flag">
        {invalid ? <em className="adm-bad">ungültig</em> : null}
        {!invalid && isNew ? <em>neu</em> : null}
        {!invalid && !isNew && changed ? <em>geändert</em> : null}
        {!visible ? <em className="adm-muted">nicht im Shop</em> : null}

        {/* Nur selbst angelegte lassen sich löschen. Eine Behandlung aus
            data.js zu entfernen hieße, den Ausgangsstand zu verlieren —
            der Schalter blendet sie stattdessen aus. */}
        {treatment.custom ? (
          <button
            type="button"
            className="adm-remove"
            onClick={() => onRemove(treatment.id)}
            aria-label={`${label(treatment)} entfernen`}
          >
            Entfernen
          </button>
        ) : null}
      </span>
    </div>
  )
}

function ChangeSummary({ diff, catalog, problems }) {
  return (
    <section className="adm-card adm-summary">
      <h2>Was sich ändert</h2>

      <ul className="adm-changes">
        {diff.changed.map((entry) => (
          <li key={`${entry.type}-${entry.row.id}`}>
            <b>{label(entry.row)}</b>

            {entry.type === 'added' ? (
              <span>
                <em className="adm-tag">neu</em> <strong>{euro(entry.to)}</strong>
                {entry.visibleNow ? null : <small> · zunächst nicht im Shop</small>}
              </span>
            ) : null}

            {entry.type === 'removed' ? (
              <span className="adm-bad">wird entfernt</span>
            ) : null}

            {entry.type === 'changed' && entry.priceChanged ? (
              <span>
                <s>{euro(entry.from)}</s> → <strong>{euro(entry.to)}</strong>
                {' '}<small>({entry.to > entry.from ? '+' : '−'}{euro(Math.abs(entry.to - entry.from))})</small>
              </span>
            ) : null}

            {entry.type === 'changed' && entry.visibilityChanged ? (
              <span className="adm-muted">
                {entry.visibleNow ? 'wird im Shop angezeigt' : 'wird aus dem Shop genommen'}
              </span>
            ) : null}
          </li>
        ))}

        {diff.minChanged ? (
          <li>
            <b>Wertgutschein · Mindestbetrag</b>
            <span><s>{euro(catalog.minCents)}</s> → <strong>{euro(diff.min)}</strong></span>
          </li>
        ) : null}
        {diff.maxChanged ? (
          <li>
            <b>Wertgutschein · Höchstbetrag</b>
            <span><s>{euro(catalog.maxCents)}</s> → <strong>{euro(diff.max)}</strong></span>
          </li>
        ) : null}
      </ul>

      {problems.length > 0 ? (
        <div className="adm-problems" role="alert">
          <strong>Noch nicht speicherbar:</strong>
          <ul>{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>
        </div>
      ) : (
        <p className="adm-note">
          Nach dem Speichern zahlt eine Kundin für diese Behandlungsgutscheine
          den neuen Preis. Offene Gutscheine und laufende Einlösungen ändern
          sich nicht.
        </p>
      )}
    </section>
  )
}
