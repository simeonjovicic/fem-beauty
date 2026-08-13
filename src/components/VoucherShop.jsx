import { useEffect, useRef, useState } from 'react'
import {
  VOUCHER_MAX_AMOUNT,
  VOUCHER_MAX_MESSAGE_LENGTH,
  VOUCHER_MIN_AMOUNT,
  voucherTreatments,
} from '../data'

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
        <path d="M12 19.5c-2.4-2.8-2.4-6.2 0-9 2.4 2.8 2.4 6.2 0 9Z" />
        <path d="M11.6 18.8c-3.1-.8-5.2-3-5.6-6.4 2.8.2 4.8 1.5 6 3.8" />
        <path d="M12.4 18.8c3.1-.8 5.2-3 5.6-6.4-2.8.2-4.8 1.5-6 3.8" />
        <path d="M6.4 16.1c-1.4-.2-2.6-.1-3.6.3 1.4 3 4.5 4.7 9.2 4.7s7.8-1.7 9.2-4.7c-1-.4-2.2-.5-3.6-.3" />
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
        <label htmlFor={`${idPrefix}-custom-amount`}>Oder eigener Betrag</label>
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

const DELIVERY_OPTIONS = [
  ['download', 'download', 'PDF erhalten', 'Selbst ausdrucken oder weiterleiten'],
  ['email', 'mail', 'Direkt per E-Mail', 'Nach dem Kauf automatisch senden'],
]

const STEPS = [
  ['Auswahl', 'Was möchtest du schenken?'],
  ['Für wen', 'Für wen ist der Gutschein?'],
  ['Übersicht', 'Alles bereit zum Verschenken.'],
]

// Drei Schritte statt einer langen Seite: alles gleichzeitig zu zeigen war
// unuebersichtlich. Der Ablauf bleibt auf der Seite — kein Modal, keine
// zweite Spalte, die um Aufmerksamkeit konkurriert.
export default function VoucherShop() {
  const amountSelection = useAmountSelection(100)
  const [step, setStep] = useState(0)
  const [kind, setKind] = useState('value')
  const [treatmentId, setTreatmentId] = useState(DEFAULT_TREATMENT_ID)
  const [recipient, setRecipient] = useState('')
  const [sender, setSender] = useState('')
  const [message, setMessage] = useState('')
  const [delivery, setDelivery] = useState('download')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)
  const [done, setDone] = useState(false)
  const errorRef = useRef(null)
  const headingRef = useRef(null)
  const timerRef = useRef(null)
  const stepRef = useRef(0)

  const selectedTreatment = getTreatment(treatmentId)
  const effectiveAmount = kind === 'treatment' ? selectedTreatment.price : amountSelection.amount

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  // Beim Schrittwechsel auf die Ueberschrift fokussieren, damit Screenreader
  // den neuen Abschnitt ansagen. Nicht beim ersten Aufbau — sonst springt die
  // Seite direkt nach dem Laden.
  useEffect(() => {
    if (stepRef.current === step) return
    stepRef.current = step
    headingRef.current?.focus({ preventScroll: true })
  }, [step])

  const changeKind = (nextKind) => {
    setKind(nextKind)
    setError('')
  }

  const problemAt = (index) => {
    if (index === 0 && kind === 'value' && !amountSelection.isValid) {
      return `Bitte wähle einen Gutscheinwert zwischen ${MIN_AMOUNT} € und ${MAX_AMOUNT} €.`
    }
    if (index === 1) {
      if (!recipient.trim()) return 'Bitte trage den Namen der beschenkten Person ein.'
      if (delivery === 'email' && !/^\S+@\S+\.\S+$/.test(email)) {
        return 'Bitte trage eine gültige E-Mail-Adresse ein.'
      }
    }
    return ''
  }

  const goNext = () => {
    const problem = problemAt(step)
    setError(problem)
    if (problem) {
      window.requestAnimationFrame(() => errorRef.current?.focus({ preventScroll: true }))
      return
    }
    setStep((current) => current + 1)
  }

  const goBack = () => {
    setError('')
    setStep((current) => Math.max(0, current - 1))
  }

  const submit = () => {
    if (processing) return
    setProcessing(true)
    timerRef.current = window.setTimeout(() => {
      setProcessing(false)
      setDone(true)
    }, 900)
  }

  if (done) {
    return (
      <section className="voucher-shop" id="vouchers">
        <div className="vshop-done">
          <span className="vshop-done-icon"><Icon name="check" /></span>
          <h2>Dein Gutschein ist bereit.</h2>
          <p>
            Im produktiven Shop öffnet sich jetzt Stripe Checkout. Nach erfolgreicher
            Zahlung werden Gutschein-Code und PDF automatisch erzeugt und versendet.
          </p>
          <div className="vshop-receipt">
            <span>{kind === 'treatment' ? `${selectedTreatment.title} · ${selectedTreatment.variant}` : 'Wertgutschein'}</span>
            <strong>{formatCurrency(effectiveAmount)}</strong>
            <small>FEM–GIFT–PREVIEW</small>
          </div>
          <button type="button" className="vshop-submit" onClick={() => { setDone(false); setStep(0) }}>
            Zurück zum Gutschein
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="voucher-shop" id="vouchers">
      <div className="vshop">
        <ol className="vshop-steps">
          {STEPS.map(([label], index) => (
            <li
              key={label}
              className={index === step ? 'current' : (index < step ? 'done' : undefined)}
              aria-current={index === step ? 'step' : undefined}
            >
              <span className="vshop-step-num">
                {index < step ? <Icon name="check" /> : `0${index + 1}`}
              </span>
              <span className="vshop-step-label">{label}</span>
            </li>
          ))}
        </ol>

        <div className="vshop-panel">
          <h2 className="vshop-heading" ref={headingRef} tabIndex="-1">{STEPS[step][1]}</h2>

          {step === 0 && (
            <>
              <div className="vshop-field-group">
                <span className="vshop-label">Gutscheinart</span>
                <VoucherKindSwitch value={kind} onChange={changeKind} />
              </div>
              <div className="vshop-field-group">
                {kind === 'value' ? (
                  <AmountPicker selection={amountSelection} idPrefix="vshop" />
                ) : (
                  <TreatmentPicker selectedId={treatmentId} onSelect={setTreatmentId} />
                )}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="voucher-form-grid">
                <label className="voucher-field">
                  <span>Für wen? <i>*</i></span>
                  <input
                    value={recipient}
                    maxLength="48"
                    autoComplete="name"
                    placeholder="Name der beschenkten Person"
                    onChange={(event) => setRecipient(event.target.value)}
                  />
                </label>
                <label className="voucher-field">
                  <span>Von wem?</span>
                  <input
                    value={sender}
                    maxLength="48"
                    autoComplete="name"
                    placeholder="Dein Name (optional)"
                    onChange={(event) => setSender(event.target.value)}
                  />
                </label>
              </div>

              <label className="voucher-field voucher-message-field">
                <span>Persönliche Widmung <small>{message.length}/{MAX_MESSAGE_LENGTH}</small></span>
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
                {DELIVERY_OPTIONS.map(([value, icon, title, hint]) => (
                  <button
                    type="button"
                    key={value}
                    className={delivery === value ? 'selected' : undefined}
                    aria-pressed={delivery === value}
                    onClick={() => { setDelivery(value); setError('') }}
                  >
                    <Icon name={icon} />
                    <span><strong>{title}</strong><small>{hint}</small></span>
                    <i aria-hidden="true"><Icon name="check" /></i>
                  </button>
                ))}
              </fieldset>

              {delivery === 'email' && (
                <label className="voucher-field voucher-email-field">
                  <span>E-Mail der beschenkten Person <i>*</i></span>
                  <input
                    type="email"
                    value={email}
                    autoComplete="email"
                    placeholder="name@beispiel.at"
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>
              )}
            </>
          )}

          {step === 2 && (
            <div className="vshop-review">
              <div className="vshop-row">
                <span>Gutscheinart</span>
                <span>{kind === 'treatment' ? 'Behandlungsgutschein' : 'Wertgutschein'}</span>
              </div>
              {kind === 'treatment' && (
                <div className="vshop-row">
                  <span>Behandlung</span>
                  <span>{selectedTreatment.title} · {selectedTreatment.variant}</span>
                </div>
              )}
              <div className="vshop-row">
                <span>Für</span>
                <span>{recipient}</span>
              </div>
              <div className="vshop-row">
                <span>Von</span>
                <span>{sender || 'Nicht angegeben'}</span>
              </div>
              <div className="vshop-row">
                <span>Zustellung</span>
                <span>{delivery === 'email' ? `E-Mail an ${email}` : 'PDF zum Ausdrucken'}</span>
              </div>
              {message && (
                <div className="vshop-row vshop-row-message">
                  <span>Widmung</span>
                  <span>„{message}“</span>
                </div>
              )}
              <div className="vshop-row vshop-total">
                <strong>Zu zahlen</strong>
                <strong>{formatCurrency(effectiveAmount)}</strong>
              </div>
              <p className="vshop-trust"><Icon name="lock" /> Sichere Zahlung über Stripe</p>
              <p className="vshop-demo">Frontend-Vorschau — es wird keine echte Zahlung ausgelöst.</p>
            </div>
          )}

          {error && (
            <p className="voucher-form-error" role="alert" tabIndex="-1" ref={errorRef}>{error}</p>
          )}
        </div>

        <div className={`vshop-nav${step > 0 ? ' has-back' : ''}`}>
          {step > 0 ? (
            <button type="button" className="vshop-back" onClick={goBack}>
              <Icon name="arrow" /><span>Zurück</span>
            </button>
          ) : null}

          {/* Betrag unter dem Knopf statt daneben: nebeneinander lasen sich
              Angabe und Handlung wie zwei gleichrangige Elemente. */}
          <div className="vshop-nav-end">
            {step < 2 ? (
              <button type="button" className="vshop-submit" onClick={goNext}>
                <span>Weiter</span><Icon name="arrow" />
              </button>
            ) : (
              <button type="button" className="vshop-submit" disabled={processing} onClick={submit}>
                <span>{processing ? 'Wird vorbereitet …' : 'Weiter zur Zahlung'}</span>
                {!processing && <Icon name="lock" />}
              </button>
            )}
            <span className="vshop-running">
              <span>{step < 2 ? 'Zwischensumme' : 'Gesamt'}</span>
              <strong>{formatCurrency(effectiveAmount)}</strong>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
