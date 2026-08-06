import { useCallback, useEffect, useRef, useState } from 'react'
import {
  VOUCHER_MAX_AMOUNT,
  VOUCHER_MAX_MESSAGE_LENGTH,
  VOUCHER_MIN_AMOUNT,
  voucherTreatments,
} from '../data'
import { useBodyLock } from '../hooks'

const PRESET_AMOUNTS = [50, 100, 150, 200]
const MIN_AMOUNT = VOUCHER_MIN_AMOUNT
const MAX_AMOUNT = VOUCHER_MAX_AMOUNT
const MAX_MESSAGE_LENGTH = VOUCHER_MAX_MESSAGE_LENGTH
const DEFAULT_TREATMENT_ID = voucherTreatments[0].id

const currencyFormatter = new Intl.NumberFormat('de-AT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

function formatCurrency(value) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0)
}

function getTreatment(treatmentId) {
  return voucherTreatments.find(({ id }) => id === treatmentId) ?? voucherTreatments[0]
}

function Icon({ name }) {
  const commonProps = {
    width: '1em',
    height: '1em',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.5',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  if (name === 'gift') {
    return (
      <svg {...commonProps}>
        <path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13" />
        <path d="M12 7H8.7C6 7 5.2 3.2 7.8 3.1 10.1 3 12 7 12 7ZM12 7h3.3C18 7 18.8 3.2 16.2 3.1 13.9 3 12 7 12 7Z" />
      </svg>
    )
  }

  if (name === 'mail') {
    return (
      <svg {...commonProps}>
        <rect x="3" y="5" width="18" height="14" rx="1.5" />
        <path d="m4 7 8 6 8-6" />
      </svg>
    )
  }

  if (name === 'download') {
    return (
      <svg {...commonProps}>
        <path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M4 20h16" />
      </svg>
    )
  }

  if (name === 'lock') {
    return (
      <svg {...commonProps}>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
      </svg>
    )
  }

  if (name === 'check') {
    return (
      <svg {...commonProps}>
        <path d="m5 12.5 4.2 4.2L19 7" />
      </svg>
    )
  }

  if (name === 'arrow') {
    return (
      <svg {...commonProps}>
        <path d="M5 12h14M14 7l5 5-5 5" />
      </svg>
    )
  }

  if (name === 'treatment') {
    return (
      <svg {...commonProps}>
        <path d="M12 21s7-3.6 7-10.2A3.8 3.8 0 0 0 12 8.7a3.8 3.8 0 0 0-7 2.1C5 17.4 12 21 12 21Z" />
        <path d="M12 3.2c.4 2.3 1.6 3.5 3.9 3.9C13.6 7.5 12.4 8.7 12 11c-.4-2.3-1.6-3.5-3.9-3.9 2.3-.4 3.5-1.6 3.9-3.9Z" />
      </svg>
    )
  }

  return (
    <svg {...commonProps}>
      <path d="M12 2.8c.7 4.2 2.9 6.4 7.2 7.2-4.3.8-6.5 3-7.2 7.2-.7-4.2-2.9-6.4-7.2-7.2 4.3-.8 6.5-3 7.2-7.2Z" />
      <path d="M18.4 15.3c.3 1.9 1.3 2.9 3.2 3.2-1.9.3-2.9 1.3-3.2 3.2-.3-1.9-1.3-2.9-3.2-3.2 1.9-.3 2.9-1.3 3.2-3.2Z" />
    </svg>
  )
}

function useAmountSelection(initialAmount = 100) {
  const startsAsPreset = PRESET_AMOUNTS.includes(initialAmount)
  const [presetAmount, setPresetAmount] = useState(startsAsPreset ? initialAmount : null)
  const [customAmount, setCustomAmount] = useState(startsAsPreset ? '' : String(initialAmount))

  const parsedCustomAmount = Number(customAmount.replace(',', '.'))
  const amount = presetAmount ?? (Number.isFinite(parsedCustomAmount) ? parsedCustomAmount : 0)
  const isValid = amount >= MIN_AMOUNT && amount <= MAX_AMOUNT

  const selectPreset = (value) => {
    setPresetAmount(value)
    setCustomAmount('')
  }

  const selectCustom = (value) => {
    setPresetAmount(null)
    setCustomAmount(value.replace(/\D/g, ''))
  }

  const setAmount = (value) => {
    if (PRESET_AMOUNTS.includes(value)) selectPreset(value)
    else {
      setPresetAmount(null)
      setCustomAmount(String(value))
    }
  }

  return {
    amount,
    customAmount,
    isValid,
    presetAmount,
    selectCustom,
    selectPreset,
    setAmount,
  }
}

function VoucherKindSwitch({ value, onChange, compact = false }) {
  const options = [
    ['value', 'gift', 'Wertgutschein', 'Frei einlösbar'],
    ['treatment', 'treatment', 'Behandlung schenken', 'Preis automatisch'],
  ]

  return (
    <div className={`voucher-kind-switch${compact ? ' voucher-kind-switch-compact' : ''}`} role="group" aria-label="Gutscheinart auswählen">
      {options.map(([optionValue, icon, title, description]) => (
        <button
          type="button"
          className={value === optionValue ? 'selected' : undefined}
          aria-pressed={value === optionValue}
          onClick={() => onChange(optionValue)}
          key={optionValue}
        >
          <span className="voucher-kind-icon"><Icon name={icon} /></span>
          <span className="voucher-kind-copy"><strong>{title}</strong><small>{description}</small></span>
          <span className="voucher-kind-check" aria-hidden="true"><Icon name="check" /></span>
        </button>
      ))}
    </div>
  )
}

function AmountPicker({ selection, idPrefix, compact = false }) {
  return (
    <fieldset className={`voucher-amount-picker${compact ? ' voucher-amount-picker-compact' : ''}`}>
      <legend>Gutscheinwert auswählen</legend>
      <div className="voucher-amount-options">
        {PRESET_AMOUNTS.map((value) => (
          <button
            type="button"
            className={selection.presetAmount === value ? 'selected' : undefined}
            aria-pressed={selection.presetAmount === value}
            onClick={() => selection.selectPreset(value)}
            key={value}
          >
            <strong>{value}</strong><span>€</span>
          </button>
        ))}
      </div>
      <div className={`voucher-custom-value${selection.presetAmount === null ? ' active' : ''}`}>
        <label htmlFor={`${idPrefix}-custom-amount`}>Eigener Betrag</label>
        <div className="voucher-custom-input">
          <input
            id={`${idPrefix}-custom-amount`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={selection.customAmount}
            placeholder="z. B. 75"
            aria-describedby={`${idPrefix}-amount-hint`}
            onFocus={() => {
              if (selection.presetAmount !== null) selection.selectCustom('')
            }}
            onChange={(event) => selection.selectCustom(event.target.value)}
          />
          <span aria-hidden="true">€</span>
        </div>
      </div>
      <p id={`${idPrefix}-amount-hint`} className={`voucher-amount-hint${selection.isValid || selection.amount === 0 ? '' : ' error'}`}>
        {selection.isValid || selection.amount === 0
          ? `Frei wählbar zwischen ${MIN_AMOUNT} € und ${MAX_AMOUNT} €.`
          : `Bitte einen Betrag zwischen ${MIN_AMOUNT} € und ${MAX_AMOUNT} € wählen.`}
      </p>
    </fieldset>
  )
}

function TreatmentPicker({ selectedId, onSelect, compact = false }) {
  return (
    <fieldset className={`voucher-treatment-picker${compact ? ' voucher-treatment-picker-compact' : ''}`}>
      <legend>Behandlung auswählen</legend>
      <div className="voucher-treatment-options">
        {voucherTreatments.map((treatment) => (
          <button
            type="button"
            className={selectedId === treatment.id ? 'selected' : undefined}
            aria-pressed={selectedId === treatment.id}
            aria-label={`${treatment.title}, ${treatment.variant}, ${treatment.duration}, ${formatCurrency(treatment.price)}`}
            onClick={() => onSelect(treatment.id)}
            key={treatment.id}
          >
            <span className="voucher-treatment-category">{treatment.category}</span>
            <strong>{treatment.title}</strong>
            <small>{treatment.variant} · {treatment.duration}</small>
            <span className="voucher-treatment-price">{formatCurrency(treatment.price)}</span>
            <i aria-hidden="true"><Icon name="check" /></i>
          </button>
        ))}
      </div>
      <p className="voucher-treatment-hint"><Icon name="check" /> Behandlung und Gutscheinwert sind fest miteinander verbunden.</p>
    </fieldset>
  )
}

function VoucherArtwork({ amount, recipient, sender, kind = 'value', treatment, compact = false }) {
  const recipientLine = recipient.trim() ? `Für ${recipient.trim()}` : 'Für einen besonderen Menschen'
  const isTreatment = kind === 'treatment'
  const cardLabel = isTreatment
    ? `FEM Behandlungsgutschein für ${treatment.title}, ${treatment.variant}, im Wert von ${formatCurrency(amount)}`
    : `FEM Wertgutschein über ${formatCurrency(amount)}`

  return (
    <article
      className={`voucher-artwork${isTreatment ? ' voucher-artwork-treatment' : ''}${compact ? ' voucher-artwork-compact' : ''}`}
      aria-label={cardLabel}
    >
      <span className="voucher-artwork-sheen" aria-hidden="true" />
      <span className="voucher-artwork-edge" aria-hidden="true" />
      <div className="voucher-artwork-frame" />
      <div className="voucher-artwork-orbit" aria-hidden="true" />
      <div className="voucher-artwork-top">
        <span className="voucher-artwork-brand">Fem</span>
        <span className="voucher-artwork-edition">{isTreatment ? 'Treatment Edition' : 'Gift Edition'} · Vienna</span>
      </div>
      <div className="voucher-artwork-center" aria-live="polite">
        {isTreatment ? (
          <>
            <span className="voucher-artwork-kicker">Behandlungsgutschein</span>
            <strong className="voucher-artwork-treatment-title">{treatment.title}</strong>
            <span className="voucher-artwork-treatment-variant">{treatment.variant} · {treatment.duration}</span>
            <span className="voucher-artwork-treatment-value">Gutscheinwert {formatCurrency(amount)}</span>
          </>
        ) : (
          <>
            <span className="voucher-artwork-kicker">Wertgutschein</span>
            <strong className="voucher-artwork-value">{formatCurrency(amount)}</strong>
          </>
        )}
        <span className="voucher-artwork-recipient">{recipientLine}</span>
      </div>
      <div className="voucher-artwork-bottom">
        <span>{sender.trim() ? `Von ${sender.trim()}` : 'Beauty · Head Spa · Self Care'}</span>
        <span>{isTreatment ? treatment.category : 'Wien 1050'}</span>
      </div>
      <span className="voucher-artwork-seal" aria-hidden="true">F</span>
    </article>
  )
}

function VoucherModal({ initialAmount, initialKind, initialTreatmentId, onSelectionChange, onClose }) {
  const amountSelection = useAmountSelection(initialAmount)
  const [kind, setKind] = useState(initialKind)
  const [treatmentId, setTreatmentId] = useState(initialTreatmentId || DEFAULT_TREATMENT_ID)
  const [step, setStep] = useState(0)
  const [recipient, setRecipient] = useState('')
  const [sender, setSender] = useState('')
  const [message, setMessage] = useState('')
  const [delivery, setDelivery] = useState('download')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)
  const dialogRef = useRef(null)
  const closeButtonRef = useRef(null)
  const stepHeadingRef = useRef(null)
  const checkoutTimerRef = useRef(null)
  const selectedTreatment = getTreatment(treatmentId)
  const effectiveAmount = kind === 'treatment' ? selectedTreatment.price : amountSelection.amount

  useBodyLock(true)

  useEffect(() => {
    const previouslyFocused = document.activeElement
    const dialog = dialogRef.current

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (event.key !== 'Tab' || !dialog) return
      const focusable = [...dialog.querySelectorAll('button, input, textarea, [href], [tabindex]:not([tabindex="-1"])')]
        .filter((element) => !element.disabled && element.getAttribute('aria-hidden') !== 'true')
      if (!focusable.length) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus())

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      window.cancelAnimationFrame(focusFrame)
      window.clearTimeout(checkoutTimerRef.current)
      previouslyFocused?.focus?.()
    }
  }, [onClose])

  useEffect(() => {
    if (step === 0) return
    const focusFrame = window.requestAnimationFrame(() => stepHeadingRef.current?.focus())
    return () => window.cancelAnimationFrame(focusFrame)
  }, [step])

  const syncSelection = () => {
    onSelectionChange({
      kind,
      treatmentId,
      valueAmount: amountSelection.amount,
    })
  }

  const changeKind = (nextKind) => {
    setKind(nextKind)
    setError('')
  }

  const goNext = () => {
    setError('')

    if (step === 0) {
      if (kind === 'value' && !amountSelection.isValid) {
        setError(`Bitte wähle einen Gutscheinwert zwischen ${MIN_AMOUNT} € und ${MAX_AMOUNT} €.`)
        return
      }
      syncSelection()
      setStep(1)
      return
    }

    if (step === 1) {
      if (!recipient.trim()) {
        setError('Bitte trage den Namen der beschenkten Person ein.')
        return
      }
      if (delivery === 'email' && !/^\S+@\S+\.\S+$/.test(email)) {
        setError('Bitte trage eine gültige E-Mail-Adresse ein.')
        return
      }
      setStep(2)
    }
  }

  const goBack = () => {
    setError('')
    setStep((currentStep) => Math.max(0, currentStep - 1))
  }

  const simulateCheckout = () => {
    if (processing) return
    setProcessing(true)
    syncSelection()
    checkoutTimerRef.current = window.setTimeout(() => {
      setProcessing(false)
      setStep(3)
    }, 900)
  }

  const stepTitles = [
    ['Auswahl', 'Was möchtest du schenken?'],
    ['Persönlich', 'Mach es zu deinem Geschenk.'],
    ['Übersicht', 'Alles bereit zum Verschenken.'],
  ]

  return (
    <div
      className="voucher-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div ref={dialogRef} className="voucher-modal" role="dialog" aria-modal="true" aria-labelledby="voucher-modal-title">
        <button ref={closeButtonRef} type="button" className="voucher-modal-close" aria-label="Gutscheinshop schließen" onClick={onClose}>×</button>

        <aside className="voucher-modal-visual" aria-label="Live-Vorschau des Gutscheins">
          <div className="voucher-modal-visual-top">
            <span>FEM Gift Studio</span>
            <span>Live Preview</span>
          </div>
          <div className="voucher-modal-artwork-wrap">
            <VoucherArtwork
              amount={effectiveAmount}
              recipient={recipient}
              sender={sender}
              kind={kind}
              treatment={selectedTreatment}
              compact
            />
          </div>
          <p>{kind === 'treatment' ? 'Treatment, Dauer und Preis erscheinen direkt auf der Karte.' : 'Deine Angaben erscheinen direkt auf der Karte.'}</p>
        </aside>

        <div className="voucher-modal-panel">
          {step < 3 ? (
            <>
              <header className="voucher-modal-header">
                <ol className="voucher-steps" aria-label="Fortschritt">
                  {stepTitles.map(([label], index) => (
                    <li className={`${index === step ? 'active' : ''}${index < step ? ' complete' : ''}`} aria-current={index === step ? 'step' : undefined} key={label}>
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <strong>{label}</strong>
                    </li>
                  ))}
                </ol>
              </header>

              <div className="voucher-modal-body">
                <span className="voucher-step-kicker">Schritt {step + 1} von 3</span>
                <h2 ref={stepHeadingRef} id="voucher-modal-title" tabIndex="-1">{stepTitles[step][1]}</h2>

                {step === 0 && (
                  <div className="voucher-step-content">
                    <p className="voucher-step-intro">Wähle einen flexiblen Betrag oder verschenke ein bestimmtes FEM Treatment zum exakt passenden Wert.</p>
                    <VoucherKindSwitch value={kind} onChange={changeKind} compact />
                    {kind === 'value' ? (
                      <AmountPicker selection={amountSelection} idPrefix="voucher-modal" compact />
                    ) : (
                      <TreatmentPicker selectedId={treatmentId} onSelect={setTreatmentId} compact />
                    )}
                  </div>
                )}

                {step === 1 && (
                  <div className="voucher-step-content">
                    <p className="voucher-step-intro">Ein Name und ein paar persönliche Worte machen aus dem Gutschein ein echtes Geschenk.</p>
                    <div className="voucher-form-grid">
                      <label className="voucher-field">
                        <span>Für wen? <i>*</i></span>
                        <input value={recipient} maxLength="48" autoComplete="name" placeholder="Name der beschenkten Person" onChange={(event) => setRecipient(event.target.value)} />
                      </label>
                      <label className="voucher-field">
                        <span>Von wem?</span>
                        <input value={sender} maxLength="48" autoComplete="name" placeholder="Dein Name (optional)" onChange={(event) => setSender(event.target.value)} />
                      </label>
                    </div>
                    <label className="voucher-field voucher-message-field">
                      <span>Persönliche Nachricht <small>{message.length}/{MAX_MESSAGE_LENGTH}</small></span>
                      <textarea
                        value={message}
                        maxLength={MAX_MESSAGE_LENGTH}
                        rows="4"
                        placeholder="Ich wünsche dir eine wunderschöne Auszeit bei FEM …"
                        onChange={(event) => setMessage(event.target.value)}
                      />
                    </label>
                    <fieldset className="voucher-delivery-options">
                      <legend>Wie möchtest du ihn verschenken?</legend>
                      <button type="button" className={delivery === 'download' ? 'selected' : undefined} aria-pressed={delivery === 'download'} onClick={() => setDelivery('download')}>
                        <Icon name="download" />
                        <span><strong>PDF erhalten</strong><small>Selbst ausdrucken oder weiterleiten</small></span>
                        <i aria-hidden="true"><Icon name="check" /></i>
                      </button>
                      <button type="button" className={delivery === 'email' ? 'selected' : undefined} aria-pressed={delivery === 'email'} onClick={() => setDelivery('email')}>
                        <Icon name="mail" />
                        <span><strong>Direkt per E-Mail</strong><small>Nach dem Kauf automatisch senden</small></span>
                        <i aria-hidden="true"><Icon name="check" /></i>
                      </button>
                    </fieldset>
                    {delivery === 'email' && (
                      <label className="voucher-field voucher-email-field">
                        <span>E-Mail der beschenkten Person <i>*</i></span>
                        <input type="email" value={email} autoComplete="email" placeholder="name@beispiel.at" onChange={(event) => setEmail(event.target.value)} />
                      </label>
                    )}
                  </div>
                )}

                {step === 2 && (
                  <div className="voucher-step-content voucher-review-step">
                    <p className="voucher-step-intro">Prüfe deine Auswahl. Im echten Shop folgt danach die sichere Bezahlung über Stripe.</p>
                    <div className="voucher-review-card">
                      <div><span>Gutscheinart</span><strong>{kind === 'treatment' ? 'Behandlungsgutschein' : 'Wertgutschein'}</strong></div>
                      {kind === 'treatment' && <div><span>Behandlung</span><strong>{selectedTreatment.title} · {selectedTreatment.variant}</strong></div>}
                      <div><span>Gutscheinwert</span><strong>{formatCurrency(effectiveAmount)}</strong></div>
                      <div><span>Für</span><strong>{recipient}</strong></div>
                      <div><span>Von</span><strong>{sender || 'Nicht angegeben'}</strong></div>
                      <div><span>Zustellung</span><strong>{delivery === 'email' ? `E-Mail an ${email}` : 'PDF zum Ausdrucken'}</strong></div>
                      {message && <div className="voucher-review-message"><span>Nachricht</span><p>„{message}“</p></div>}
                    </div>
                    <div className="voucher-total">
                      <div><span>Digitale Zustellung</span><span>Kostenlos</span></div>
                      <div><strong>Gesamt</strong><strong>{formatCurrency(effectiveAmount)}</strong></div>
                    </div>
                    <p className="voucher-demo-disclaimer"><Icon name="lock" /> Frontend-Vorschau – es wird keine echte Zahlung ausgelöst.</p>
                  </div>
                )}

                {error && <p className="voucher-form-error" role="alert">{error}</p>}
              </div>

              <footer className="voucher-modal-actions">
                {step > 0 ? <button type="button" className="voucher-back-button" onClick={goBack}>Zurück</button> : <span />}
                {step < 2 ? (
                  <button type="button" className="voucher-next-button" onClick={goNext}>Weiter <Icon name="arrow" /></button>
                ) : (
                  <button type="button" className="voucher-next-button" disabled={processing} onClick={simulateCheckout}>
                    {processing ? 'Wird vorbereitet …' : 'Zur sicheren Zahlung'} {!processing && <Icon name="lock" />}
                  </button>
                )}
              </footer>
            </>
          ) : (
            <div className="voucher-complete">
              <span className="voucher-complete-icon"><Icon name="check" /></span>
              <span className="voucher-step-kicker">Frontend-Demo abgeschlossen</span>
              <h2 ref={stepHeadingRef} id="voucher-modal-title" tabIndex="-1">Dein Gutschein ist bereit.</h2>
              <p>Im produktiven Shop würde jetzt Stripe Checkout öffnen. Nach erfolgreicher Zahlung werden Gutschein-Code und PDF automatisch erzeugt und versendet.</p>
              <div className="voucher-complete-receipt">
                <span>{kind === 'treatment' ? `${selectedTreatment.title} · ${selectedTreatment.variant}` : 'Wertgutschein'}</span>
                <strong>{formatCurrency(effectiveAmount)}</strong>
                <small>FEM–GIFT–PREVIEW</small>
              </div>
              <button type="button" className="voucher-next-button" onClick={onClose}>Vorschau schließen</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function VoucherShop() {
  const amountSelection = useAmountSelection(100)
  const [kind, setKind] = useState('value')
  const [treatmentId, setTreatmentId] = useState(DEFAULT_TREATMENT_ID)
  const [modalOpen, setModalOpen] = useState(false)
  const sectionRef = useRef(null)
  const closeModal = useCallback(() => setModalOpen(false), [])
  const selectedTreatment = getTreatment(treatmentId)
  const effectiveAmount = kind === 'treatment' ? selectedTreatment.price : amountSelection.amount
  const selectionIsValid = kind === 'treatment' || amountSelection.isValid

  const applyModalSelection = ({ kind: nextKind, treatmentId: nextTreatmentId, valueAmount }) => {
    setKind(nextKind)
    setTreatmentId(nextTreatmentId)
    amountSelection.setAmount(valueAmount)
  }

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return undefined

    const observer = new IntersectionObserver(
      ([entry]) => document.body.classList.toggle('voucher-shop-visible', entry.isIntersecting),
      { threshold: 0.08 },
    )
    observer.observe(section)

    return () => {
      observer.disconnect()
      document.body.classList.remove('voucher-shop-visible')
    }
  }, [])

  return (
    <>
      <section ref={sectionRef} className="voucher-shop" id="vouchers">
        <div className="voucher-shop-inner">
          <div className="voucher-showcase">
            <div className="voucher-showcase-top">
              <span>FEM Gift Edition</span>
              <span>Wien · 1050</span>
            </div>
            <div className="voucher-preview-stage">
              <VoucherArtwork
                amount={effectiveAmount}
                recipient=""
                sender=""
                kind={kind}
                treatment={selectedTreatment}
              />
            </div>
            <div className="voucher-showcase-footer">
              <span>{kind === 'treatment' ? 'Lieblingsbehandlung. Liebevoll verschenkt.' : 'Ein Geschenk, das nachwirkt.'}</span>
              <span>Digital · Persönlich · Besonders</span>
            </div>
          </div>

          <div className="voucher-config rv">
            <span className="tag">FEM Gutscheine</span>
            <h2>Zeit für dich.<br /><em>Zum Verschenken.</em></h2>
            <p className="voucher-config-copy">Verschenke freie Auswahl oder ein ganz bestimmtes Beauty-Erlebnis – persönlich gestaltet und sofort bereit.</p>

            <VoucherKindSwitch value={kind} onChange={setKind} />

            {kind === 'value' ? (
              <AmountPicker selection={amountSelection} idPrefix="voucher-shop" />
            ) : (
              <TreatmentPicker selectedId={treatmentId} onSelect={setTreatmentId} />
            )}

            <button
              type="button"
              className="voucher-open-button"
              disabled={!selectionIsValid}
              onClick={() => setModalOpen(true)}
            >
              <span>{kind === 'treatment' ? 'Behandlung personalisieren' : 'Gutschein gestalten'}</span>
              <strong>{formatCurrency(effectiveAmount)}</strong>
              <Icon name="arrow" />
            </button>

            <ul className="voucher-benefits" aria-label="Vorteile des Gutscheins">
              <li><Icon name="sparkle" /><span>Persönlich gestaltbar</span></li>
              <li><Icon name="download" /><span>Digital oder druckbereit</span></li>
              <li><Icon name={kind === 'treatment' ? 'check' : 'gift'} /><span>{kind === 'treatment' ? 'Treatmentpreis inklusive' : 'Flexibel einlösbar'}</span></li>
            </ul>
          </div>
        </div>
      </section>

      {modalOpen && (
        <VoucherModal
          initialAmount={amountSelection.amount}
          initialKind={kind}
          initialTreatmentId={treatmentId}
          onSelectionChange={applyModalSelection}
          onClose={closeModal}
        />
      )}
    </>
  )
}
