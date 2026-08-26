import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// Bewusst dieselben Funktionen wie im Worker, nicht nachgebaute. Saldo und
// Zustand sind Ableitungen, und wenn die Kassa anders ableitet als der
// Server, streiten zwei Wahrheiten ueber Geld. Beide Dateien sind reines
// ESM ohne Worker-Abhaengigkeiten und laufen im Browser unveraendert.
import {
  balanceCents,
  stateFromBalance,
  validateRedemption,
  validateReversal,
} from '../worker/src/ledger.js'
import { parseCode } from '../worker/src/codes.js'

import {
  ApiError,
  fetchMe,
  fetchRedemptions,
  fetchVouchers,
  redeemVoucher,
  reverseRedemption,
} from './admin/api'
import { STRIPE_FIXED_CENTS, STRIPE_PERCENT } from './config'
import {
  date,
  dateTime,
  euro,
  euroSigned,
  reasonText,
  stateLabel,
  stateTone,
} from './admin/format'
import PricesTab from './admin/PricesTab'
import TemplatesTab from './admin/TemplatesTab'

// Erst hier importiert, nicht in main.jsx: die Seite haengt an einem
// lazy()-Import, damit das Panel-CSS nicht im Bundle der Startseite landet.
import './admin.css'

// Drei Bereiche, weil drei verschiedene Anlässe: an der Kassa wird
// eingelöst, am Schreibtisch werden Preise gepflegt, und die Vorlagen sieht
// man sich einmal an, bevor sie rausgehen.
const TABS = [
  ['vouchers', 'Gutscheine'],
  ['prices', 'Preise'],
  ['templates', 'Vorlagen'],
]

const TAB_TITLES = {
  vouchers: 'Gutschein-Übersicht',
  prices: 'Preise & Behandlungen',
  templates: 'E-Mail & PDF',
}

// Der Bereich steht im Fragment, damit ein Neuladen nicht zurueck auf die
// Gutscheinliste wirft — beim Pflegen von Preisen laedt man oefter neu, als
// einem lieb ist. Fragment und nicht Pfad: die Seite wird statisch
// ausgeliefert und kennt keine Unterrouten.
const TAB_HASH = { vouchers: '', prices: '#preise', templates: '#vorlagen' }

function tabFromHash() {
  const entry = Object.entries(TAB_HASH)
    .find(([, hash]) => hash && hash === window.location.hash)
  return entry ? entry[0] : 'vouchers'
}

const FILTERS = [
  ['all', 'Alle'],
  ['open', 'Offen'],
  ['partial', 'Teilweise'],
  ['redeemed', 'Eingelöst'],
  ['inactive', 'Storniert'],
]

function matchesFilter(row, filter) {
  if (filter === 'all') return true
  if (filter === 'inactive') return row.voucher.status !== 'active'
  if (filter === 'open') return row.state === 'open'
  if (filter === 'partial') return row.state === 'partially_redeemed'
  if (filter === 'redeemed') return row.state === 'fully_redeemed'
  return true
}

/**
 * Suche wie in admin/api.js: der Code wird normalisiert, damit
 * "fem 3bx91 bxs0y" genauso trifft wie "FEM-3BX91-BXS0Y". Namen und
 * E-Mail bleiben Teilsuche.
 */
function matchesQuery(row, query) {
  if (!query) return true
  const needle = query.trim().toLowerCase()
  const parsed = parseCode(query)
  if (parsed.ok) return row.voucher.code === parsed.display

  return [
    row.voucher.code,
    row.voucher.recipient_name,
    row.voucher.sender_name,
    row.voucher.buyer_email,
    row.voucher.treatment_label,
  ].some((field) => field && field.toLowerCase().includes(needle))
}

/** Monatsgrenzen fuer die Kennzahlen — lokale Zeit, wie sie die Inhaberin liest. */
function monthRange(now, offset = 0) {
  const d = new Date(now)
  const start = new Date(d.getFullYear(), d.getMonth() + offset, 1)
  const end = new Date(d.getFullYear(), d.getMonth() + offset + 1, 1)
  return [start, end]
}

function inRange(iso, [start, end]) {
  const t = new Date(iso)
  return t >= start && t < end
}

export default function AdminPage() {
  // Einmal beim Laden festgehalten. Ein bei jedem Render neu erzeugtes "jetzt"
  // wuerde Ableitungen unruhig machen, die von Ablaufdaten abhaengen.
  const now = useMemo(() => new Date().toISOString(), [])

  const [tab, setTab] = useState(tabFromHash)
  const [vouchers, setVouchers] = useState([])
  const [ledger, setLedger] = useState([])
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [flash, setFlash] = useState(null)

  const searchRef = useRef(null)

  // Gutscheine und Buchungen kommen roh und vollstaendig; abgeleitet wird
  // hier. Fuer einen Salon sind das einige hundert Zeilen — dafuer je Ansicht
  // einen eigenen Endpunkt zu bauen, waere Aufwand ohne Gegenwert.
  const reload = useCallback(async () => {
    try {
      const [voucherPage, ledgerPage] = await Promise.all([
        fetchVouchers({ limit: 200 }),
        fetchRedemptions(),
      ])
      const loaded = voucherPage.vouchers ?? []
      setVouchers(loaded)
      setLedger(ledgerPage.redemptions ?? [])
      setLoadError(null)

      // Aus dem QR-Code kommend: ?token=… oeffnet den Gutschein direkt.
      // Bewusst hier und nicht in einem eigenen Effekt — dort waere es ein
      // setState im Effektkoerper, also eine zweite Renderrunde nach jedem
      // Laden. Der Token wird einmal beim Ankommen aufgeloest.
      const token = new URLSearchParams(window.location.search).get('token')
      if (token) {
        const hit = loaded.find((voucher) => voucher.token === token)
        if (hit) setSelectedId(hit.id)
      }
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Daten konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Laden beim Ankommen.
  useEffect(() => {
    fetchMe().then(setMe).catch(() => setMe(null))
    // Die Regel warnt vor setState *synchron* im Effektkoerper. Hier laufen
    // alle Zustandsaenderungen erst nach einem await, also in genau dem
    // Rueckruf, den die Regel selbst als richtigen Ort beschreibt — durch
    // die async-Funktion hindurch kann sie das nur nicht sehen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload()
  }, [reload])

  const rows = useMemo(() => vouchers.map((voucher) => {
    const entries = ledger
      .filter((entry) => entry.voucher_id === voucher.id)
      .sort((a, b) => a.redeemed_at.localeCompare(b.redeemed_at))
    const balance = balanceCents(voucher, entries)
    return { voucher, entries, balance, state: stateFromBalance(voucher, balance, now) }
  }), [vouchers, ledger, now])

  const visible = useMemo(
    () => rows
      .filter((row) => matchesFilter(row, filter) && matchesQuery(row, query))
      .sort((a, b) => b.voucher.issued_at.localeCompare(a.voucher.issued_at)),
    [rows, filter, query],
  )

  const selected = rows.find((row) => row.voucher.id === selectedId) ?? null

  // Beide Wechsel springen nach oben. Auf dem Telefon steht die Liste sonst
  // noch auf der angetippten Zeile, und das Detail oeffnet mitten im Verlauf.
  // Bewusst 'instant': bei einer langen Liste laeuft 'smooth' sekundenlang.
  const openDetail = useCallback((id) => {
    setSelectedId(id)
    setFlash(null)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  const closeDetail = useCallback(() => {
    setSelectedId(null)
    setFlash(null)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  // Ein Wechsel des Bereichs schliesst das offene Detail. Sonst stuende
  // beim Zurueckkommen ein Gutschein offen, den niemand mehr erwartet.
  const changeTab = useCallback((next) => {
    setTab(next)
    setSelectedId(null)
    setFlash(null)
    // replaceState statt location.hash: ein Sprung zwischen den Reitern soll
    // keinen Eintrag im Verlauf hinterlassen, den man einzeln zurueckgehen muss.
    window.history.replaceState(null, '', TAB_HASH[next] || window.location.pathname)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  // Fragment von aussen geaendert — getippt, aus einem Lesezeichen, oder per
  // Zurueck-Knopf. changeTab() selbst loest das nicht aus: replaceState
  // feuert kein hashchange.
  useEffect(() => {
    const onHashChange = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Tastatur: "/" springt in die Suche, Escape schliesst die Detailansicht.
  // An der Kassa wird mit einer Hand getippt, da zaehlt jeder Griff zur Maus.
  useEffect(() => {
    if (tab !== 'vouchers') return undefined

    function onKey(event) {
      if (event.key === 'Escape' && selectedId) closeDetail()
      if (event.key === '/' && !selectedId && document.activeElement?.tagName !== 'INPUT') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tab, selectedId, closeDetail])

  /**
   * Abbuchen.
   *
   * Die Pruefung hier ist Komfort — sie erspart einen Netzaufruf fuer einen
   * Fehler, der schon lokal erkennbar ist, und liefert sofort einen Satz auf
   * Deutsch. Entschieden wird trotzdem am Server: dessen INSERT traegt seine
   * eigene Bedingung, damit zwei Geraete nicht denselben Restwert zweimal
   * abbuchen koennen.
   */
  async function redeem(row, amountCents, note) {
    const check = validateRedemption({
      voucher: row.voucher, redemptions: row.entries, amountCents, now: new Date().toISOString(),
    })
    if (!check.ok) return { ok: false, message: reasonText(check.reason) }

    try {
      const result = await redeemVoucher(row.voucher.id, {
        amountCents,
        note: note || null,
        // Einer pro Versuch, nicht pro Klick: schickt der Browser dieselbe
        // Buchung erneut, weist die Datenbank sie ab statt doppelt abzuziehen.
        idempotencyKey: crypto.randomUUID(),
      })
      await reload()
      return result.duplicate
        ? { ok: true, message: 'Diese Buchung lag bereits vor — nichts doppelt abgezogen.' }
        : { ok: true, message: `${euro(amountCents)} abgebucht — ${euro(result.balanceCents)} bleiben offen.` }
    } catch (err) {
      await reload()
      return { ok: false, message: err instanceof ApiError ? err.message : 'Abbuchen fehlgeschlagen.' }
    }
  }

  /** Gegenbuchung. Korrigiert, ohne die Historie zu verlieren. */
  async function reverse(row, targetId) {
    const check = validateReversal({
      voucher: row.voucher, redemptions: row.entries, targetRedemptionId: targetId,
    })
    if (!check.ok) return { ok: false, message: reasonText(check.reason) }

    try {
      await reverseRedemption(targetId, { note: 'Storno', idempotencyKey: crypto.randomUUID() })
      await reload()
      return { ok: true, message: `Buchung über ${euro(-check.amountCents)} storniert.` }
    } catch (err) {
      await reload()
      return { ok: false, message: err instanceof ApiError ? err.message : 'Storno fehlgeschlagen.' }
    }
  }

  return (
    <div className="adm">
      <MockBanner tab={tab} dev={me?.dev} />

      <div className="adm-wrap">
        <header className="adm-head">
          <div>
            <h1>{selected ? 'Gutschein' : TAB_TITLES[tab]}</h1>
            {selected && (
              <button type="button" className="adm-back" onClick={closeDetail}>
                ← Zurück zur Übersicht
              </button>
            )}
          </div>
          {/* Die Kennung aus dem Access-Token — und genau die landet auch als
              staff_id an jeder Buchung. */}
          <p className="adm-who">
            {me
              ? <>Angemeldet als <strong>{me.email}</strong></>
              : <span>Nicht angemeldet</span>}
          </p>
        </header>

        <nav className="adm-tabs" aria-label="Bereiche">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-current={tab === key ? 'page' : undefined}
              onClick={() => changeTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === 'prices' ? <PricesTab /> : null}
        {tab === 'templates' ? <TemplatesTab /> : null}

        {/* Ein Ladefehler darf nicht als leere Liste erscheinen — „keine
            Gutscheine" und „Server nicht erreichbar" sehen sonst gleich aus,
            und an der Kassa wird das Erste geglaubt. */}
        {tab === 'vouchers' && loadError && (
          <div className="adm-mock" role="alert">
            <strong>Nicht geladen</strong>
            <span>
              {loadError}{' '}
              <button type="button" className="adm-undo" onClick={reload}>Erneut versuchen</button>
            </span>
          </div>
        )}

        {tab === 'vouchers' && !loadError && loading && (
          <p className="adm-empty">Gutscheine werden geladen …</p>
        )}

        {tab === 'vouchers' && !loadError && !loading && (selected ? (
          <VoucherDetail
            row={selected}
            flash={flash}
            setFlash={setFlash}
            onRedeem={redeem}
            onReverse={reverse}
          />
        ) : (
          <>
            <StatCards rows={rows} now={now} />
            <ListToolbar
              query={query}
              setQuery={setQuery}
              filter={filter}
              setFilter={setFilter}
              searchRef={searchRef}
              count={visible.length}
            />
            <VoucherTable rows={visible} onSelect={openDetail} />
          </>
        ))}
      </div>
    </div>
  )
}

// Der Hinweis muss stimmen, sonst richtet er Schaden an. Gebuchte Betraege
// verschwinden beim Neuladen — gespeicherte Preise nicht, die liegen im
// localStorage und wirken im Shop. Ein Banner, das beides gleich beschreibt,
// waere an einer der beiden Stellen eine Falschaussage.
/**
 * Warnbalken. Zeigt nur noch an, was tatsaechlich noch nicht echt ist.
 *
 * Gutscheine und Buchungen kommen inzwischen aus der Datenbank — was hier
 * frueher stand ("alle Zahlen erfunden") waere jetzt falsch und damit
 * schlimmer als kein Hinweis. Uebrig bleiben zwei echte Vorbehalte.
 */
function MockBanner({ tab, dev }) {
  if (tab === 'prices') {
    return (
      <div className="adm-mock" role="status">
        <strong>Entwurf</strong>
        <span>
          Preise wirken sofort im Gutschein-Shop und bleiben in diesem Browser
          gespeichert. Was Stripe abbucht, ändern sie noch nicht.
        </span>
      </div>
    )
  }

  if (!dev) return null

  return (
    <div className="adm-mock" role="status">
      <strong>Ohne Zugangsschutz</strong>
      <span>
        Dieses Panel läuft im Entwicklungsmodus — jeder mit der Adresse käme
        hier herein. Vor dem Livegang muss ADMIN_AUTH_MODE auf „access" stehen.
      </span>
    </div>
  )
}

function StatCards({ rows, now }) {
  const stats = useMemo(() => {
    const thisMonth = monthRange(now, 0)
    const lastMonth = monthRange(now, -1)

    const soldIn = (range) => rows
      .filter((row) => row.voucher.status === 'active' && inRange(row.voucher.issued_at, range))
      .reduce((sum, row) => sum + row.voucher.original_amount_cents, 0)

    const soldCount = rows.filter(
      (row) => row.voucher.status === 'active' && inRange(row.voucher.issued_at, thisMonth),
    ).length

    const sold = soldIn(thisMonth)
    const prev = soldIn(lastMonth)

    // Netto: eine Gegenbuchung im selben Monat hebt die Abbuchung wieder auf.
    const redeemed = rows
      .flatMap((row) => row.entries)
      .filter((entry) => inRange(entry.redeemed_at, thisMonth))
      .reduce((sum, entry) => sum + entry.amount_cents, 0)

    // Die eigentlich wichtige Zahl: was schuldet der Salon seinen Kundinnen
    // noch an Leistung. Periodenunabhaengig, deshalb ohne Monatsbezug.
    const outstandingRows = rows.filter(
      (row) => row.voucher.status === 'active' && row.balance > 0,
    )
    const outstanding = outstandingRows.reduce((sum, row) => sum + row.balance, 0)

    const fee = Math.round(sold * STRIPE_PERCENT) + soldCount * STRIPE_FIXED_CENTS

    return {
      sold,
      soldCount,
      trend: prev > 0 ? Math.round(((sold - prev) / prev) * 100) : null,
      redeemed,
      outstanding,
      outstandingCount: outstandingRows.length,
      fee,
      feeRate: sold > 0 ? (fee / sold) * 100 : 0,
      month: new Date(now).toLocaleDateString('de-AT', { month: 'long' }),
    }
  }, [rows, now])

  return (
    <div className="adm-stats">
      <article className="adm-stat adm-stat-lead">
        <span className="adm-stat-key">Verkauf {stats.month}</span>
        <b>{euro(stats.sold)}</b>
        <small>
          {stats.soldCount} {stats.soldCount === 1 ? 'Gutschein' : 'Gutscheine'}
          {stats.trend !== null && ` · ${stats.trend >= 0 ? '+' : ''}${stats.trend}% ggü. Vormonat`}
        </small>
      </article>

      <article className="adm-stat">
        <span className="adm-stat-key">Eingelöst {stats.month}</span>
        <b>{euro(stats.redeemed)}</b>
        <small>USt fiel bereits beim Verkauf an</small>
      </article>

      <article className="adm-stat">
        <span className="adm-stat-key">Offene Gutscheine</span>
        <b>{euro(stats.outstanding)}</b>
        <small>{stats.outstandingCount} Stück · noch einzulösen</small>
      </article>

      <article className="adm-stat">
        <span className="adm-stat-key">Stripe-Gebühr {stats.month}</span>
        <b>{euro(stats.fee)}</b>
        <small>geschätzt · {stats.feeRate.toFixed(2).replace('.', ',')}% im Schnitt</small>
      </article>
    </div>
  )
}

function ListToolbar({ query, setQuery, filter, setFilter, searchRef, count }) {
  // Sieht die Eingabe nach einem Code aus, aber die Pruefsumme passt nicht,
  // ist das fast immer ein Tippfehler. Das gleich sagen, statt eine leere
  // Trefferliste zu zeigen.
  const looksLikeCode = query.trim().toUpperCase().replace(/[\s-]/g, '').startsWith('FEM')
  const parsed = parseCode(query)
  const codeHint = looksLikeCode && !parsed.ok && query.trim().length > 6
    ? { length: 'Code ist unvollständig.', checksum: 'Prüfzeichen stimmt nicht — bitte nochmal ansehen.' }[parsed.reason]
      ?? 'Dieser Code enthält ungültige Zeichen.'
    : null

  return (
    <section className="adm-tools" aria-label="Gutscheine filtern">
      <div className="adm-tools-row">
        <h2>Letzte Gutscheine</h2>
        <div className="adm-search">
          <label className="adm-sr" htmlFor="adm-q">Code, Name oder E-Mail suchen</label>
          <input
            id="adm-q"
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Code, Name oder E-Mail …"
            autoComplete="off"
            spellCheck="false"
          />
          <kbd aria-hidden="true">/</kbd>
        </div>
      </div>

      <div className="adm-filters" role="group" aria-label="Nach Zustand filtern">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
        <span className="adm-count" aria-live="polite">
          {count} {count === 1 ? 'Treffer' : 'Treffer'}
        </span>
      </div>

      {codeHint && <p className="adm-hint">{codeHint}</p>}
    </section>
  )
}

function VoucherTable({ rows, onSelect }) {
  if (rows.length === 0) {
    return (
      <p className="adm-empty">
        Kein Gutschein passt zu dieser Suche.
      </p>
    )
  }

  return (
    <div className="adm-table" role="table" aria-label="Gutscheine">
      <div className="adm-tr adm-th" role="row">
        <span role="columnheader">Code</span>
        <span role="columnheader">Käufer</span>
        <span role="columnheader">Empfänger</span>
        <span role="columnheader" className="adm-num">Wert</span>
        <span role="columnheader" className="adm-num">Rest</span>
        <span role="columnheader">Status</span>
      </div>

      {rows.map((row) => (
        <button
          key={row.voucher.id}
          type="button"
          role="row"
          className="adm-tr adm-row"
          onClick={() => onSelect(row.voucher.id)}
        >
          <span role="cell" className="adm-code adm-c-code">
            {row.voucher.code}
            {row.voucher.kind === 'treatment' && (
              <em title={row.voucher.treatment_label}>{row.voucher.treatment_label}</em>
            )}
          </span>
          <span role="cell" data-key="Käufer" className="adm-c-buyer">
            {row.voucher.sender_name ?? '—'}
          </span>
          <span role="cell" data-key="Empfänger" className="adm-c-recipient">
            {row.voucher.recipient_name ?? 'Selbst'}
          </span>
          <span role="cell" data-key="Wert" className="adm-num adm-c-worth">
            {euro(row.voucher.original_amount_cents)}
          </span>
          <span role="cell" data-key="Rest" className="adm-num adm-c-rest">
            {row.balance === row.voucher.original_amount_cents
              ? euro(row.balance)
              : <strong>{euro(Math.max(row.balance, 0))}</strong>}
          </span>
          <span role="cell" className="adm-c-state">
            <Badge state={row.state} />
          </span>
        </button>
      ))}
    </div>
  )
}

function Badge({ state }) {
  return <span className={`adm-badge adm-badge-${stateTone(state)}`}>{stateLabel(state)}</span>
}

function VoucherDetail({ row, flash, setFlash, onRedeem, onReverse }) {
  const { voucher, entries, balance, state } = row
  const redeemable = state === 'open' || state === 'partially_redeemed'

  return (
    <div className="adm-detail">
      <RedeemCard
        row={row}
        redeemable={redeemable}
        flash={flash}
        setFlash={setFlash}
        onRedeem={onRedeem}
      />

      <section className="adm-card adm-history">
        <h2>Verlauf</h2>

        <ol className="adm-timeline">
          <li>
            <div>
              <b>Gutschein gekauft</b>
              <small>{dateTime(voucher.issued_at)} · Stripe</small>
            </div>
            <span className="adm-plus">{euroSigned(voucher.original_amount_cents)}</span>
          </li>

          {entries.map((entry) => {
            const isReversal = Boolean(entry.reverses_id)
            const reversed = entries.some((other) => other.reverses_id === entry.id)
            return (
              <li key={entry.id} className={reversed ? 'adm-struck' : undefined}>
                <div>
                  <b>
                    {isReversal ? 'Storno' : 'Einlösung'}
                    {entry.note && !isReversal && ` · ${entry.note}`}
                  </b>
                  <small>{dateTime(entry.redeemed_at)} · {entry.staff_id}</small>
                  {!isReversal && !reversed && (
                    <button
                      type="button"
                      className="adm-undo"
                      onClick={async () => setFlash(await onReverse(row, entry.id))}
                    >
                      Stornieren
                    </button>
                  )}
                </div>
                {/* Im Kontobuch ist eine Abbuchung positiv. Fuer die Lesende
                    ist sie ein Abgang — deshalb hier gedreht. */}
                <span className={entry.amount_cents > 0 ? 'adm-minus' : 'adm-plus'}>
                  {euroSigned(-entry.amount_cents)}
                </span>
              </li>
            )
          })}
        </ol>

        <div className="adm-sum">
          <span>Verfügbar</span>
          <b>{euro(Math.max(balance, 0))}</b>
        </div>

        <p className="adm-note">
          Jede Buchung wird mit Zeitstempel und Mitarbeiterin protokolliert.
          Korrigiert wird per Gegenbuchung — Zeilen werden nie gelöscht,
          der Verlauf bleibt vollständig.
        </p>

        {voucher.void_reason && (
          <p className="adm-note adm-note-alert">
            Storniert am {date(voucher.voided_at)}: {voucher.void_reason}
          </p>
        )}
      </section>
    </div>
  )
}

function RedeemCard({ row, redeemable, flash, setFlash, onRedeem }) {
  const { voucher, balance, state } = row
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  // Schnellwahl: gaengige Betraege, die noch ins Guthaben passen, plus der
  // Rest. Doppelte fallen raus, damit nicht zweimal derselbe Knopf steht.
  const quick = useMemo(() => {
    const half = Math.round(balance / 2 / 500) * 500
    const candidates = [2000, 5000, half].filter((c) => c > 0 && c < balance)
    return [...new Set(candidates)].sort((a, b) => a - b).slice(0, 3)
  }, [balance])

  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    const parsed = Number.parseFloat(String(amount).replace(',', '.'))
    if (!Number.isFinite(parsed)) {
      setFlash({ ok: false, message: 'Bitte einen Betrag eingeben.' })
      return
    }
    // Gesperrt, solange die Buchung laeuft. Der Idempotenzschluessel faengt
    // einen Doppelklick zwar ab, aber gar nicht erst zweimal zu senden ist
    // ehrlicher — und die Rueckmeldung bleibt eindeutig.
    setBusy(true)
    try {
      // Erst in Cent, dann rechnen. Aus 0.1 + 0.2 wird sonst 0.30000000000000004.
      const result = await onRedeem(row, Math.round(parsed * 100), note)
      setFlash(result)
      if (result.ok) {
        setAmount('')
        setNote('')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="adm-card">
      <h2>{redeemable ? 'Gutschein einlösen' : 'Gutschein'}</h2>

      <div className="adm-codebox">
        <p className="adm-code-lg">{voucher.code}</p>
        <p>
          {voucher.sender_name ?? '—'}
          <span> · gekauft {date(voucher.issued_at)}</span>
        </p>
        {voucher.treatment_label && <p className="adm-treat">{voucher.treatment_label}</p>}
        {voucher.message && <p className="adm-msg">„{voucher.message}"</p>}
      </div>

      <div className="adm-balance">
        <span className="adm-stat-key">Verfügbares Guthaben</span>
        <b aria-live="polite">{euro(Math.max(balance, 0))}</b>
        {balance !== voucher.original_amount_cents && (
          <small>von ursprünglich {euro(voucher.original_amount_cents)}</small>
        )}
      </div>

      {redeemable ? (
        <form onSubmit={submit} className="adm-form">
          <label htmlFor="adm-amount">Betrag einlösen</label>
          <input
            id="adm-amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0,00"
            autoComplete="off"
          />

          <div className="adm-quick">
            {quick.map((cents) => (
              <button key={cents} type="button" onClick={() => setAmount(String(cents / 100))}>
                {euro(cents)}
              </button>
            ))}
            <button type="button" onClick={() => setAmount(String(balance / 100))}>
              Kompletter Rest
            </button>
          </div>

          <label htmlFor="adm-note">Notiz <span>(optional)</span></label>
          <input
            id="adm-note"
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="z. B. Head Spa · Glow & Flow"
            maxLength={200}
            autoComplete="off"
          />

          <button type="submit" className="adm-submit">Einlösen</button>
        </form>
      ) : (
        <p className="adm-closed">
          <Badge state={state} /> Für diesen Gutschein sind keine Buchungen mehr möglich.
        </p>
      )}

      {flash && (
        <p className={`adm-flash ${flash.ok ? 'ok' : 'bad'}`} role="status">
          {flash.message}
        </p>
      )}

      <p className="adm-note">
        In helloCash danach die Rechnung mit Zahlungsart „Gutschein" erfassen.
      </p>
    </section>
  )
}
