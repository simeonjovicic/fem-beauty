import assert from 'node:assert/strict'
import test from 'node:test'
import { emailPlan } from '../src/email.js'
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
