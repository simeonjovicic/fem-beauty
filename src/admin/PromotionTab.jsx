// Gutschein-Aktion einstellen — etwa Black Week: 100 € zahlen, 120 € schenken.
//
// Die Frage dahinter kam von der Inhaberin: wie stelle ich das im Shop ein?
// Und von der Steuerberaterin die Bedingung, wie es verbucht wird: Gutschein
// mit dem Nennbetrag, Rabatt bei der Zahlung, Umsatz ist der Rest. Beides
// steht hier sichtbar, damit niemand den Bonus fuer Guthaben "obendrauf" haelt.
//
// Eine Aktion zur Zeit. Die naechste — Weihnachten, Muttertag — ersetzt sie.
// Gespeichert wird erst mit dem Knopf; eingeschaltet legt der Worker dabei
// die Rabatte bei Stripe an und lehnt ab, wenn Stripe das nicht zulaesst.

import { useCallback, useEffect, useMemo, useState } from 'react'

import { ApiError, fetchPromotion, savePromotion } from './api'
import { euro, toCents, toInput } from './format'
import { MoneyInput } from './PricesTab'

const STATUS = {
  none: ['Keine Aktion', 'muted'],
  off: ['Ausgeschaltet', 'muted'],
  scheduled: ['Geplant', 'partial'],
  running: ['Läuft', 'open'],
  ended: ['Beendet', 'muted'],
}

/** "2026-11-30" → "30.11.2026" */
function longDate(isoDate) {
  const [year, month, day] = isoDate.split('-')
  return `${day}.${month}.${year}`
}

function statusText(status, promotion) {
  if (status === 'none') return 'Noch keine Aktion eingestellt. Der Shop verkauft zu normalen Preisen.'
  if (status === 'off') return 'Ausgeschaltet. Der Shop verkauft zu normalen Preisen.'
  if (status === 'scheduled') return `Startet am ${longDate(promotion.startDate)} um 00:00 Uhr.`
  if (status === 'running') return `Läuft bis ${longDate(promotion.endDate)}, 23:59 Uhr.`
  return `Am ${longDate(promotion.endDate)} zu Ende gegangen.`
}

function stripeText(stripe) {
  if (!stripe) return null
  if (stripe.ready) return { ok: true, text: 'Die Rabatte sind bei Stripe angelegt.' }
  if (stripe.reason === 'missing') {
    return { ok: false, text: 'Die Rabatte fehlen noch bei Stripe. „Speichern“ legt sie an.' }
  }
  return { ok: false, text: `Stripe meldet einen Fehler: ${stripe.message}` }
}

function draftFrom(promotion) {
  if (!promotion) {
    return { enabled: false, name: '', startDate: '', endDate: '', tiers: [{ pay: '', bonus: '' }] }
  }
  return {
    enabled: promotion.enabled,
    name: promotion.name,
    startDate: promotion.startDate,
    endDate: promotion.endDate,
    tiers: promotion.tiers.map((tier) => ({ pay: toInput(tier.payCents), bonus: toInput(tier.bonusCents) })),
  }
}

/** Was im Formular noch nicht stimmt — die verbindliche Pruefung macht der Worker. */
function problemsOf(draft) {
  const problems = []
  if (!draft.name.trim()) problems.push('Name fehlt.')
  if (!draft.startDate || !draft.endDate) problems.push('Zeitraum fehlt.')
  else if (draft.endDate < draft.startDate) problems.push('Das Ende liegt vor dem Start.')
  draft.tiers.forEach((tier, index) => {
    const pay = toCents(tier.pay)
    const bonus = toCents(tier.bonus)
    if (!pay || !bonus) problems.push(`Stufe ${index + 1}: Kaufbetrag und Bonus eintragen.`)
    else if (bonus >= pay) problems.push(`Stufe ${index + 1}: Der Bonus muss unter dem Kaufbetrag liegen.`)
  })
  return problems
}

export default function PromotionTab() {
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(null)
  // Hier und nicht im Editor: der baut sich nach dem Speichern neu auf und
  // verloere eine eigene Erfolgsmeldung im selben Moment.
  const [saved, setSaved] = useState(false)

  const onSaved = useCallback((result) => {
    setData(result)
    setSaved(true)
  }, [])

  const load = useCallback(async () => {
    try {
      setData(await fetchPromotion())
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Aktion konnte nicht geladen werden.')
    }
  }, [])

  useEffect(() => {
    // Wie im Katalog: alle Zustandsaenderungen laufen erst nach einem await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  if (loadError) {
    return (
      <div className="adm-mock" role="alert">
        <strong>Nicht geladen</strong>
        <span>
          {loadError}{' '}
          <button type="button" className="adm-undo" onClick={load}>Erneut versuchen</button>
        </span>
      </div>
    )
  }

  if (!data) return <p className="adm-empty">Aktion wird geladen …</p>

  // key wie im Preise-Reiter: nach dem Speichern baut sich der Entwurf aus
  // den frischen Daten neu auf, statt in einem Effekt ueberschrieben zu werden.
  return (
    <>
      {saved && (
        <p className="adm-flash ok" role="status">
          Gespeichert. Der Gutschein-Shop zeigt die Änderung spätestens nach einer Minute.
        </p>
      )}
      <PromotionEditor
        key={JSON.stringify(data.promotion)}
        data={data}
        onSaved={onSaved}
        onChange={() => setSaved(false)}
      />
    </>
  )
}

function PromotionEditor({ data, onSaved, onChange }) {
  const [draft, setDraft] = useState(() => draftFrom(data.promotion))
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState(null)

  const problems = useMemo(() => problemsOf(draft), [draft])
  const [statusLabel, statusTone] = STATUS[data.status] ?? STATUS.none
  const stripe = stripeText(data.stripe)

  const change = (patch) => {
    setFlash(null)
    onChange()
    setDraft((prev) => ({ ...prev, ...patch }))
  }

  const changeTier = (index, patch) => {
    setFlash(null)
    onChange()
    setDraft((prev) => ({
      ...prev,
      tiers: prev.tiers.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)),
    }))
  }

  const save = async () => {
    if (problems.length > 0 || saving) return
    setSaving(true)
    try {
      const result = await savePromotion({
        enabled: draft.enabled,
        name: draft.name,
        startDate: draft.startDate,
        endDate: draft.endDate,
        tiers: draft.tiers.map((tier) => ({ payCents: toCents(tier.pay), bonusCents: toCents(tier.bonus) })),
      })
      onSaved(result)
    } catch (err) {
      const detail = err instanceof ApiError && err.payload?.message ? ` (${err.payload.message})` : ''
      setFlash({ ok: false, message: `${err.message || 'Speichern fehlgeschlagen.'}${detail}` })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="adm-prices adm-promo">
      <section className="adm-card adm-explain">
        <div className="adm-promo-status">
          <span className={`adm-badge adm-badge-${statusTone}`}>{statusLabel}</span>
          <p>{statusText(data.status, data.promotion)}</p>
        </div>

        {stripe && (
          <p className={`adm-note${stripe.ok ? '' : ' adm-note-alert'}`}>{stripe.text}</p>
        )}

        {data.sold && data.sold.count > 0 && (
          <p className="adm-note">
            Bisher {data.sold.count} {data.sold.count === 1 ? 'Gutschein' : 'Gutscheine'} mit
            Bonus verkauft · {euro(data.sold.paidCents)} eingenommen · {euro(data.sold.discountCents)} Bonus
          </p>
        )}

        <p className="adm-note">
          <strong>So wird gebucht:</strong> Der Gutschein lautet auf den vollen Wert
          (z. B. 120 €), bei der Zahlung wird der Bonus als Rabatt abgezogen, als
          Umsatz zählt der bezahlte Betrag (100 €). Kaufbestätigung, Monatsexport und
          Stripe zeigen alle drei Zahlen.
        </p>
      </section>

      <section className="adm-card">
        <h2>Einstellungen</h2>
        <p className="adm-sub">
          Gilt nur für Wertgutscheine und nur für genau die eingetragenen Beträge — wer
          150 € kauft, bekommt keinen Bonus. Bereits verkaufte Gutscheine bleiben unberührt.
        </p>

        <div className="adm-promo-switch">
          <button
            type="button"
            className="adm-toggle"
            role="switch"
            aria-checked={draft.enabled}
            aria-label="Aktion eingeschaltet"
            onClick={() => change({ enabled: !draft.enabled })}
          >
            <span aria-hidden="true" />
          </button>
          <span>{draft.enabled ? 'Eingeschaltet — läuft im eingestellten Zeitraum' : 'Ausgeschaltet'}</span>
        </div>

        <div className="adm-promo-grid">
          <label className="adm-text-field">
            <span>Name <i>— steht im Shop und auf dem Beleg</i></span>
            <input
              value={draft.name}
              maxLength={30}
              placeholder="z. B. Black Week"
              autoComplete="off"
              onChange={(event) => change({ name: event.target.value })}
            />
          </label>
          <label className="adm-text-field">
            <span>Von <i>— ab 00:00 Uhr</i></span>
            <input
              type="date"
              value={draft.startDate}
              onChange={(event) => change({ startDate: event.target.value })}
            />
          </label>
          <label className="adm-text-field">
            <span>Bis <i>— einschließlich, bis 23:59 Uhr</i></span>
            <input
              type="date"
              value={draft.endDate}
              onChange={(event) => change({ endDate: event.target.value })}
            />
          </label>
        </div>

        <h3 className="adm-promo-tiers-title">Stufen</h3>
        <div className="adm-promo-tiers">
          {draft.tiers.map((tier, index) => {
            const pay = toCents(tier.pay)
            const bonus = toCents(tier.bonus)
            return (
              // Index als key: die Stufen haben keine eigene Kennung, und
              // sortiert wird erst beim Speichern.
              <div className="adm-promo-tier" key={index}>
                <label className="adm-money-field">
                  <span>Kunde zahlt</span>
                  <MoneyInput value={tier.pay} onChange={(value) => changeTier(index, { pay: value })} />
                </label>
                <label className="adm-money-field">
                  <span>Bonus</span>
                  <MoneyInput value={tier.bonus} onChange={(value) => changeTier(index, { bonus: value })} />
                </label>
                <p className="adm-promo-result">
                  {pay && bonus ? <>Gutschein über <strong>{euro(pay + bonus)}</strong></> : '—'}
                </p>
                {draft.tiers.length > 1 && (
                  <button
                    type="button"
                    className="adm-remove"
                    onClick={() => change({ tiers: draft.tiers.filter((_, i) => i !== index) })}
                  >
                    Entfernen
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {draft.tiers.length < 6 && (
          <p className="adm-add-row">
            <button
              type="button"
              className="adm-ghost"
              onClick={() => change({ tiers: [...draft.tiers, { pay: '', bonus: '' }] })}
            >
              + Stufe hinzufügen
            </button>
          </p>
        )}

        {problems.length > 0 && (
          <ul className="adm-note adm-note-alert">
            {problems.map((problem) => <li key={problem}>{problem}</li>)}
          </ul>
        )}

        {flash && <p className={`adm-flash ${flash.ok ? 'ok' : 'bad'}`} role="status">{flash.message}</p>}

        <div className="adm-add-actions">
          <button
            type="button"
            className="adm-submit"
            disabled={problems.length > 0 || saving}
            onClick={save}
          >
            {saving ? 'Wird gespeichert …' : 'Speichern'}
          </button>
        </div>
      </section>
    </div>
  )
}
