// Vorschau auf das, was die Kundin bekommt.
//
// Nicht als nachgebautes Bild, sondern aus denselben Modulen, die der
// Worker beim Verkauf aufruft: worker/src/email.js und worker/src/pdf.js.
// Eine nachgezeichnete Vorschau würde beim ersten Textwechsel lügen; diese
// hier kann nur zeigen, was tatsächlich verschickt wird.
//
// pdf.js zieht pdf-lib und qrcode-generator nach — zusammen deutlich mehr
// als die restliche Seite. Deshalb erst beim Klick per import(), nicht oben
// in der Datei: wer nur die Gutscheinliste öffnet, lädt davon nichts.

import { useEffect, useMemo, useRef, useState } from 'react'

import { buildVoucherEmail, emailPlan } from '../../worker/src/email.js'
import { BOOKING_URL } from '../data'
import { vouchers as seedVouchers } from './mockData'
import { euro } from './format'

const VIEWS = [
  ['gift', 'Geschenk-E-Mail', 'An die beschenkte Person'],
  ['receipt', 'Kaufbestätigung', 'An die Käuferin'],
  ['pdf', 'Gutschein-PDF', 'Anhang beider E-Mails'],
]

const WIDTHS = [['desktop', 'Desktop', 640], ['mobile', 'Telefon', 380]]

// Drei Fälle, die sich im Layout unterscheiden — mehr braucht die Vorschau
// nicht. Eine lange Widmung, ein Behandlungsgutschein ohne Widmung und ein
// Kauf ohne Versand an Dritte.
const SAMPLE_IDS = ['v-01', 'v-06', 'v-05']

function sampleLabel(voucher) {
  const what = voucher.kind === 'treatment' ? voucher.treatment_label : 'Wertgutschein'
  return `${what} · ${euro(voucher.original_amount_cents)}`
}

export default function TemplatesTab() {
  const samples = useMemo(
    () => SAMPLE_IDS.map((id) => seedVouchers.find((v) => v.id === id)).filter(Boolean),
    [],
  )

  const [voucherId, setVoucherId] = useState(samples[0].id)
  const [view, setView] = useState('gift')
  const [width, setWidth] = useState('desktop')
  const [pdf, setPdf] = useState({ url: null, busy: false, error: null })

  const voucher = samples.find((sample) => sample.id === voucherId) ?? samples[0]
  const plan = emailPlan(voucher)
  const sent = plan.some((entry) => entry.variant === view)

  // Blob-URLs bleiben am Dokument hängen, bis sie freigegeben werden. Der
  // Ref hält die zuletzt vergebene, damit auch die letzte beim Verlassen
  // der Seite noch aufgeräumt wird.
  const pdfUrlRef = useRef(null)
  useEffect(() => () => {
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current)
  }, [])

  const email = view === 'pdf'
    ? null
    : buildVoucherEmail(voucher, { variant: view, bookingUrl: BOOKING_URL })

  async function makePdf() {
    setPdf({ url: null, busy: true, error: null })
    try {
      const { buildVoucherPdf } = await import('../../worker/src/pdf.js')
      const bytes = await buildVoucherPdf(voucher, `https://fembeauty.at/g/${voucher.token}`)
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))

      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current)
      pdfUrlRef.current = url
      setPdf({ url, busy: false, error: null })
    } catch (err) {
      setPdf({ url: null, busy: false, error: err.message })
    }
  }

  function pick(nextId) {
    setVoucherId(nextId)
    // Das erzeugte PDF gehört zum vorigen Gutschein — stehen lassen hieße,
    // den falschen Code zu zeigen.
    if (pdfUrlRef.current) {
      URL.revokeObjectURL(pdfUrlRef.current)
      pdfUrlRef.current = null
    }
    setPdf({ url: null, busy: false, error: null })
  }

  return (
    <div className="adm-templates">
      <section className="adm-card">
        <h2>Vorlagen</h2>
        <p className="adm-sub">
          Genau das, was nach einem Kauf rausgeht — erzeugt aus denselben
          Dateien wie im Betrieb, nur mit Beispieldaten.
        </p>

        <div className="adm-tpl-controls">
          <label className="adm-select">
            <span>Beispiel</span>
            <select value={voucherId} onChange={(event) => pick(event.target.value)}>
              {samples.map((sample) => (
                <option value={sample.id} key={sample.id}>{sampleLabel(sample)}</option>
              ))}
            </select>
          </label>

          <div className="adm-seg" role="group" aria-label="Vorlage wählen">
            {VIEWS.map(([key, label, hint]) => (
              <button
                type="button"
                key={key}
                title={hint}
                aria-pressed={view === key}
                onClick={() => setView(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {view === 'pdf' ? null : (
            <div className="adm-seg adm-seg-small" role="group" aria-label="Breite">
              {WIDTHS.map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  aria-pressed={width === key}
                  onClick={() => setWidth(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {view === 'pdf' ? (
        <PdfPreview voucher={voucher} pdf={pdf} onBuild={makePdf} />
      ) : (
        <EmailPreview email={email} sent={sent} view={view} voucher={voucher} width={width} />
      )}
    </div>
  )
}

function EmailPreview({ email, sent, view, voucher, width }) {
  const frameWidth = WIDTHS.find(([key]) => key === width)[2]

  return (
    <section className="adm-card adm-preview">
      <dl className="adm-headers">
        <div><dt>An</dt><dd>{email.to || <em>— keine Adresse —</em>}</dd></div>
        <div><dt>Betreff</dt><dd>{email.subject}</dd></div>
        <div><dt>Anhang</dt><dd>FEM-Gutschein-{voucher.code}.pdf</dd></div>
      </dl>

      {sent ? null : (
        <p className="adm-note adm-note-alert">
          {view === 'gift'
            ? 'Wird für diesen Kauf nicht verschickt: der Gutschein wurde als PDF gewählt '
              + '(oder geht an dieselbe Adresse wie die Bestätigung). Die Vorschau zeigt trotzdem, wie sie aussähe.'
            : 'Wird für diesen Kauf nicht verschickt.'}
        </p>
      )}

      {/* sandbox ohne allow-scripts: die Vorlage enthält kein JavaScript,
          und eine Vorschau soll auch keines ausführen können. */}
      <div className="adm-frame" style={{ maxWidth: `${frameWidth}px` }}>
        <iframe
          title={`Vorschau ${view}`}
          srcDoc={email.html}
          sandbox=""
          loading="lazy"
        />
      </div>

      <details className="adm-source">
        <summary>Nur-Text-Fassung</summary>
        <pre>{email.text}</pre>
      </details>
    </section>
  )
}

function PdfPreview({ voucher, pdf, onBuild }) {
  return (
    <section className="adm-card adm-preview">
      <dl className="adm-headers">
        <div><dt>Datei</dt><dd>FEM-Gutschein-{voucher.code}.pdf</dd></div>
        <div><dt>Format</dt><dd>A4 · eine Seite · Vektor</dd></div>
        <div><dt>QR-Ziel</dt><dd>fembeauty.at/g/{voucher.token}</dd></div>
      </dl>

      {pdf.url ? (
        <>
          <div className="adm-frame adm-frame-pdf">
            <iframe title="Gutschein-PDF" src={pdf.url} />
          </div>
          <p className="adm-tpl-actions">
            <a
              className="adm-ghost"
              href={pdf.url}
              download={`FEM-Gutschein-${voucher.code}.pdf`}
            >
              Herunterladen
            </a>
            <button type="button" className="adm-ghost" onClick={onBuild}>Neu erzeugen</button>
          </p>
        </>
      ) : (
        <div className="adm-tpl-empty">
          <button type="button" className="adm-submit" disabled={pdf.busy} onClick={onBuild}>
            {pdf.busy ? 'Wird erzeugt …' : 'PDF erzeugen'}
          </button>
          <p className="adm-note">
            Wird im Browser gebaut, mit demselben Code wie im Worker. Beim
            ersten Klick lädt die PDF-Bibliothek nach.
          </p>
        </div>
      )}

      {pdf.error ? <p className="adm-flash bad" role="alert">{pdf.error}</p> : null}
    </section>
  )
}
