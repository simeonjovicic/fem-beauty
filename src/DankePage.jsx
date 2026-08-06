import { useCallback, useEffect, useRef, useState } from 'react'
import { Footer, Header } from './components/Chrome'
import { API_BASE } from './config'
import { BOOKING_URL } from './data'

const currency = new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' })

// Der Gutschein entsteht im Stripe-Webhook, und der trifft in aller Regel
// binnen einer Sekunde ein — aber eben nicht garantiert vor der
// Weiterleitung. Deshalb wird nachgefragt statt einmal geladen.
const POLL_INTERVAL_MS = 1500
const MAX_ATTEMPTS = 12

function CheckIcon() {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.2 4.2L19 7" />
    </svg>
  )
}

function useVoucherStatus(sessionId) {
  const [state, setState] = useState(sessionId ? { status: 'loading' } : { status: 'no_session' })
  const timerRef = useRef(null)

  useEffect(() => {
    if (!sessionId) return undefined

    let cancelled = false
    let attempts = 0

    const poll = async () => {
      attempts += 1
      try {
        const response = await fetch(`${API_BASE}/api/voucher/by-session/${encodeURIComponent(sessionId)}`)
        const data = await response.json()
        if (cancelled) return

        if (data.status === 'ready') {
          setState({ status: 'ready', voucher: data.voucher })
          return
        }
        if (data.status === 'unpaid') {
          setState({ status: 'unpaid' })
          return
        }
        // pending: der Webhook hängt noch. Nach genug Versuchen nicht
        // ewig weiterdrehen lassen — die Zahlung ist ja durch.
        if (attempts >= MAX_ATTEMPTS) {
          setState({ status: 'slow' })
          return
        }
        setState({ status: 'pending' })
        timerRef.current = window.setTimeout(poll, POLL_INTERVAL_MS)
      } catch {
        if (cancelled) return
        if (attempts >= MAX_ATTEMPTS) {
          setState({ status: 'error' })
          return
        }
        timerRef.current = window.setTimeout(poll, POLL_INTERVAL_MS)
      }
    }

    poll()
    return () => {
      cancelled = true
      window.clearTimeout(timerRef.current)
    }
  }, [sessionId])

  return state
}

function VoucherReady({ voucher }) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(voucher.code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }, [voucher.code])

  return (
    <>
      <span className="danke-icon" aria-hidden="true"><CheckIcon /></span>
      <span className="tag">Bezahlung erfolgreich</span>
      <h1>Dein Gutschein<br /><em>ist fertig.</em></h1>
      <div className="line" />
      <p className="danke-lead">
        {voucher.recipient
          ? <>Für <strong>{voucher.recipient}</strong> über <strong>{currency.format(voucher.amountCents / 100)}</strong>.</>
          : <>Über <strong>{currency.format(voucher.amountCents / 100)}</strong>.</>}
        {voucher.kind === 'treatment' && voucher.treatmentLabel && <> — {voucher.treatmentLabel}.</>}
      </p>

      <div className="danke-code">
        <span>Gutscheincode</span>
        <strong>{voucher.code}</strong>
        <button type="button" onClick={copy}>{copied ? 'Kopiert' : 'Kopieren'}</button>
      </div>

      <div className="danke-actions">
        <a className="btn-p" href={`${API_BASE}/api/voucher/${encodeURIComponent(voucher.token)}/pdf`} target="_blank" rel="noopener noreferrer">
          Gutschein als PDF öffnen
        </a>
        <a className="link-arrow" href="/">Zurück zur Seite</a>
      </div>

      <p className="danke-note">
        Bewahre den Code gut auf — er ist der Gutschein. Eingelöst wird er direkt im
        Salon, auch in Teilbeträgen.
      </p>
    </>
  )
}

function Waiting({ slow }) {
  return (
    <>
      <span className="danke-icon danke-icon-wait" aria-hidden="true" />
      <span className="tag">Bezahlung erhalten</span>
      <h1>Einen Moment,<br /><em>bitte.</em></h1>
      <div className="line" />
      <p className="danke-lead">
        {slow
          ? 'Deine Zahlung ist eingegangen, die Erstellung dauert gerade etwas länger. Der Gutschein wird gleich erzeugt — du kannst diese Seite in einer Minute neu laden.'
          : 'Deine Zahlung ist durch. Wir erstellen gerade deinen Gutschein …'}
      </p>
      {slow && (
        <div className="danke-actions">
          <button type="button" className="btn-p" onClick={() => window.location.reload()}>Neu laden</button>
        </div>
      )}
    </>
  )
}

function Problem({ title, text }) {
  return (
    <>
      <span className="tag">Hinweis</span>
      <h1>{title}</h1>
      <div className="line" />
      <p className="danke-lead">{text}</p>
      <div className="danke-actions">
        <a className="btn-p" href="/gutscheine.html">Zurück zum Gutschein</a>
        <a className="link-arrow" href={BOOKING_URL} target="_blank" rel="noopener noreferrer">Termin buchen →</a>
      </div>
      <p className="danke-note">
        Bei Fragen: <a href="mailto:beauty@fembeauty.at">beauty@fembeauty.at</a> oder
        {' '}<a href="tel:+436608866068">+43 660 8866068</a>.
      </p>
    </>
  )
}

export default function DankePage() {
  const sessionId = new URLSearchParams(window.location.search).get('session_id')
  const state = useVoucherStatus(sessionId)

  return (
    <>
      <Header />
      <main>
        <section className="danke">
          <div className="danke-inner">
            {state.status === 'ready' && <VoucherReady voucher={state.voucher} />}
            {(state.status === 'loading' || state.status === 'pending') && <Waiting />}
            {state.status === 'slow' && <Waiting slow />}
            {state.status === 'unpaid' && (
              <Problem
                title={<>Die Zahlung wurde<br /><em>nicht abgeschlossen.</em></>}
                text="Es wurde nichts abgebucht. Du kannst den Gutschein jederzeit neu bestellen."
              />
            )}
            {state.status === 'no_session' && (
              <Problem
                title={<>Kein Gutschein<br /><em>gefunden.</em></>}
                text="Dieser Seite fehlt der Bezug zu einem Kauf. Wenn du gerade bezahlt hast, prüfe bitte deine E-Mails."
              />
            )}
            {state.status === 'error' && (
              <Problem
                title={<>Da ist etwas<br /><em>schiefgelaufen.</em></>}
                text="Deine Zahlung ist davon nicht betroffen. Melde dich kurz bei uns, wir schicken dir den Gutschein zu."
              />
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
