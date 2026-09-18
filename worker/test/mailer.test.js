import assert from 'node:assert/strict'
import test from 'node:test'
import { buildVoucherEmail, emailPlan, STUDIO_EMAIL } from '../src/email.js'
import { toBase64 } from '../src/base64.js'

// ── Wer bekommt welche Mail ──────────────────────────────────────
//
// Der Transport selbst braucht Netz und einen Schluessel; geprueft wird
// hier die Entscheidung davor, denn die kann still falsch sein: eine Mail
// zu viel geht an eine echte Kundin, eine zu wenig faellt niemandem auf.

const base = {
  id: 'v1',
  code: 'FEM-2AVXV-66VYY',
  buyer_email: 'kaeuferin@example.at',
}

test('PDF-Zustellung: nur die Bestaetigung an die Kaeuferin', () => {
  const plan = emailPlan({ ...base, delivery: 'download', delivery_email: null })
  assert.equal(plan.length, 1)
  assert.equal(plan[0].variant, 'receipt')
  assert.equal(plan[0].to, 'kaeuferin@example.at')
})

test('Geschenk per Mail: zwei Mails an zwei Adressen', () => {
  const plan = emailPlan({
    ...base, delivery: 'email', delivery_email: 'beschenkte@example.at',
  })
  assert.equal(plan.length, 2)
  assert.deepEqual(plan.map((p) => p.variant), ['gift', 'receipt'])
  assert.equal(plan[0].to, 'beschenkte@example.at')
  assert.equal(plan[1].to, 'kaeuferin@example.at')
})

test('Kauf fuer sich selbst: keine Dublette im eigenen Posteingang', () => {
  // Dieselbe Adresse fuer Kauf und Zustellung — die Geschenkmail waere
  // eine zweite Mail mit demselben Anhang an dieselbe Person.
  const plan = emailPlan({
    ...base, delivery: 'email', delivery_email: 'kaeuferin@example.at',
  })
  assert.equal(plan.length, 1)
  assert.equal(plan[0].variant, 'receipt')
})

test('Grossschreibung macht daraus keine zweite Person', () => {
  const plan = emailPlan({
    ...base, delivery: 'email', delivery_email: 'Kaeuferin@Example.at',
  })
  assert.equal(plan.length, 1)
})

// ── Verkaufsmeldung ans Studio ───────────────────────────────────
//
// Sie haengt nicht am Gutschein, sondern an MAIL_NOTIFY: sie geht bei jedem
// Kauf raus. Geprueft wird deshalb der Inhalt — eine Meldung ohne Betrag
// oder Code zwingt zum Nachschlagen und waere ihren Zweck los.

const verkauf = {
  ...base,
  kind: 'value',
  original_amount_cents: 12000,
  vat_rate_bp: 2000,
  delivery: 'email',
  delivery_email: 'beschenkte@example.at',
  recipient_name: 'Anna',
  sender_name: 'Bernd',
  issued_at: '2026-09-18T08:30:00.000Z',
  stripe_payment_intent: 'pi_123',
}

test('Verkaufsmeldung geht an die eingestellte Adresse', () => {
  const mail = buildVoucherEmail(verkauf, {
    variant: 'studio', notifyEmail: 'beauty@fembeauty.at',
  })
  assert.equal(mail.to, 'beauty@fembeauty.at')
})

test('ohne eingestellte Adresse faellt die Meldung auf das Studio zurueck', () => {
  const mail = buildVoucherEmail(verkauf, { variant: 'studio' })
  assert.equal(mail.to, STUDIO_EMAIL)
})

test('der Betreff traegt Betrag und Code', () => {
  const { subject } = buildVoucherEmail(verkauf, { variant: 'studio' })
  assert.match(subject, /120,00/)
  assert.ok(subject.includes(verkauf.code))
})

test('die Meldung nennt Kaeuferin, Beschenkte und Zustellweg', () => {
  const { html, text } = buildVoucherEmail(verkauf, { variant: 'studio' })
  for (const fassung of [html, text]) {
    assert.ok(fassung.includes('kaeuferin@example.at'), 'Kaeuferin fehlt')
    assert.ok(fassung.includes('beschenkte@example.at'), 'Zustelladresse fehlt')
    assert.ok(fassung.includes('Anna'), 'Beschenkte fehlt')
    assert.ok(fassung.includes('Bernd'), 'Schenkende fehlt')
  }
})

test('die Uhrzeit steht in Wiener Zeit, nicht in UTC', () => {
  // 08:30 UTC im September ist 10:30 in Wien. Workers laufen in UTC —
  // ohne timeZone stuende hier die falsche Stunde und im Grenzfall der
  // falsche Tag.
  const { text } = buildVoucherEmail(verkauf, { variant: 'studio' })
  assert.match(text, /18\.09\.2026, 10:30/)
})

test('die Widmung wird uebernommen und maskiert', () => {
  const { html, text } = buildVoucherEmail(
    { ...verkauf, message: 'Alles Liebe <3 & bis bald' },
    { variant: 'studio' },
  )
  assert.ok(text.includes('Alles Liebe <3 & bis bald'))
  assert.ok(html.includes('Alles Liebe &lt;3 &amp; bis bald'))
  assert.ok(!html.includes('Liebe <3'), 'roher Winkel im HTML')
})

test('ohne Widmung bleibt der Block weg', () => {
  const { html } = buildVoucherEmail({ ...verkauf, message: null }, { variant: 'studio' })
  assert.ok(!html.includes('WIDMUNG'))
})

test('Kauf fuer sich selbst meldet den Zustellweg richtig', () => {
  const { text } = buildVoucherEmail(
    { ...verkauf, delivery: 'download', delivery_email: null },
    { variant: 'studio' },
  )
  assert.ok(text.includes('als PDF an die Käuferin'))
})

// ── Base64 fuer den Anhang ───────────────────────────────────────

test('grosse Anhaenge sprengen den Aufrufstapel nicht', () => {
  // String.fromCharCode(...bytes) wirft bei einigen zehntausend Argumenten
  // ein RangeError. Ein Gutschein-PDF liegt bei rund 60 kB, also deutlich
  // darueber — deshalb blockweise. Hier mit 300 kB gegengeprueft.
  const gross = new Uint8Array(300_000).map((_, i) => i % 256)
  const kodiert = toBase64(gross)
  assert.equal(typeof kodiert, 'string')
  // base64 waechst um genau ein Drittel, plus Auffuellung.
  assert.equal(kodiert.length, Math.ceil(300_000 / 3) * 4)
})

test('base64 stimmt mit der Referenz ueberein', () => {
  const bytes = new TextEncoder().encode('Gutschein für Anna — 100,00 €')
  assert.equal(toBase64(bytes), Buffer.from(bytes).toString('base64'))
})
