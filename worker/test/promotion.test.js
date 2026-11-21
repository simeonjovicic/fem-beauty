import assert from 'node:assert/strict'
import test from 'node:test'
import {
  bonusFor,
  couponId,
  ensureCoupon,
  promotionStatus,
  promotionWindow,
  publicPromotion,
  validatePromotion,
} from '../src/promotion.js'

// Die Black Week, wie Jenny sie ausgeschrieben hat.
const blackWeek = {
  enabled: true,
  name: 'Black Week',
  startDate: '2026-11-23',
  endDate: '2026-11-30',
  tiers: [
    { payCents: 10000, bonusCents: 2000 },
    { payCents: 20000, bonusCents: 5000 },
    { payCents: 30000, bonusCents: 8000 },
  ],
}

const wert = (euro) => ({ kind: 'value', amountCents: euro * 100 })
const mitten = '2026-11-25T12:00:00.000Z'

test('der Zeitraum laeuft von Wiener Mitternacht bis Wiener Mitternacht', () => {
  // November ist Winterzeit, +01:00. Der 30.11. zaehlt ganz mit.
  assert.deepEqual(promotionWindow(blackWeek), {
    from: '2026-11-22T23:00:00.000Z',
    to: '2026-11-30T23:00:00.000Z',
  })
})

test('der Status kippt genau an den Grenzen', () => {
  assert.equal(promotionStatus(blackWeek, '2026-11-22T22:59:59.999Z'), 'scheduled')
  assert.equal(promotionStatus(blackWeek, '2026-11-22T23:00:00.000Z'), 'running')
  assert.equal(promotionStatus(blackWeek, '2026-11-30T22:59:59.999Z'), 'running')
  assert.equal(promotionStatus(blackWeek, '2026-11-30T23:00:00.000Z'), 'ended')
})

test('abgeschaltet oder nicht vorhanden heisst kein Bonus', () => {
  assert.equal(promotionStatus(null, mitten), 'none')
  assert.equal(promotionStatus({ ...blackWeek, enabled: false }, mitten), 'off')
  assert.equal(bonusFor({ ...blackWeek, enabled: false }, wert(100), mitten), null)
  assert.equal(bonusFor(null, wert(100), mitten), null)
})

test('genau die ausgeschriebenen Betraege bekommen ihren Bonus', () => {
  assert.deepEqual(bonusFor(blackWeek, wert(100), mitten), { bonusCents: 2000, name: 'Black Week' })
  assert.deepEqual(bonusFor(blackWeek, wert(200), mitten), { bonusCents: 5000, name: 'Black Week' })
  assert.deepEqual(bonusFor(blackWeek, wert(300), mitten), { bonusCents: 8000, name: 'Black Week' })
})

test('Betraege dazwischen bekommen keinen Bonus', () => {
  for (const euro of [50, 99, 101, 150, 250, 299, 301, 500]) {
    assert.equal(bonusFor(blackWeek, wert(euro), mitten), null, `${euro} € haette keinen Bonus bekommen duerfen`)
  }
})

test('Behandlungsgutscheine bekommen keinen Bonus, auch nicht zum Stufenbetrag', () => {
  // Hydro Peel kostet genau 100 € — trotzdem kein Bonus.
  assert.equal(bonusFor(blackWeek, { kind: 'treatment', amountCents: 10000 }, mitten), null)
})

test('vor und nach der Aktion gibt es keinen Bonus', () => {
  assert.equal(bonusFor(blackWeek, wert(100), '2026-11-22T22:00:00.000Z'), null)
  assert.equal(bonusFor(blackWeek, wert(100), '2026-12-01T10:00:00.000Z'), null)
})

test('der Shop erfaehrt nur von einer laufenden Aktion', () => {
  assert.deepEqual(publicPromotion(blackWeek, mitten), {
    name: 'Black Week', endDate: '2026-11-30', tiers: blackWeek.tiers,
  })
  assert.equal(publicPromotion(blackWeek, '2026-12-01T10:00:00.000Z'), null)
  assert.equal(publicPromotion({ ...blackWeek, enabled: false }, mitten), null)
})

test('eine gueltige Aktion kommt sortiert und bereinigt zurueck', () => {
  const check = validatePromotion({
    ...blackWeek,
    name: '  Black Week  ',
    tiers: [...blackWeek.tiers].reverse(),
  })
  assert.equal(check.ok, true)
  assert.equal(check.promotion.name, 'Black Week')
  assert.deepEqual(check.promotion.tiers.map((t) => t.payCents), [10000, 20000, 30000])
})

test('unbrauchbare Aktionen werden abgelehnt', () => {
  const faelle = [
    [{ ...blackWeek, name: '' }, 'name_required'],
    [{ ...blackWeek, startDate: '2026-11-31' }, 'start_invalid'],
    [{ ...blackWeek, endDate: '30.11.2026' }, 'end_invalid'],
    [{ ...blackWeek, endDate: '2026-11-22' }, 'end_before_start'],
    [{ ...blackWeek, tiers: [] }, 'tiers_required'],
    [{ ...blackWeek, tiers: [{ payCents: 10000, bonusCents: 10000 }] }, 'bonus_too_high'],
    [{ ...blackWeek, tiers: [{ payCents: 10000, bonusCents: 0 }] }, 'bonus_invalid'],
    [{ ...blackWeek, tiers: [{ payCents: 100.5, bonusCents: 20 }] }, 'pay_invalid'],
    [{ ...blackWeek, tiers: [{ payCents: 10000, bonusCents: 2000 }, { payCents: 10000, bonusCents: 3000 }] }, 'pay_duplicate'],
  ]
  for (const [eingabe, grund] of faelle) {
    assert.equal(validatePromotion(eingabe).reason, grund)
  }
})

test('die Coupon-Kennung ist fest und je Aktion verschieden', () => {
  assert.equal(couponId(blackWeek, 2000), 'fem-black-week-2026-11-23-2026-11-30-2000')
  assert.notEqual(
    couponId(blackWeek, 2000),
    couponId({ ...blackWeek, name: 'Weihnachten', startDate: '2026-12-01', endDate: '2026-12-24' }, 2000),
  )
})

test('ein schon vorhandener Coupon ist kein Fehler', async () => {
  const aufrufe = []
  const stripe = {
    coupons: {
      async create(params) {
        aufrufe.push(params)
        const err = new Error('Coupon already exists.')
        err.code = 'resource_already_exists'
        throw err
      },
    },
  }
  // Eigene Aktion, damit der Merker im Modul nicht von einem anderen Test stammt.
  const aktion = { ...blackWeek, name: 'Probe Vorhanden' }
  const id = await ensureCoupon(stripe, aktion, 2000)
  assert.equal(id, couponId(aktion, 2000))
  assert.equal(aufrufe[0].amount_off, 2000)
  assert.equal(aufrufe[0].currency, 'eur')
  assert.equal(aufrufe[0].name, 'Rabatt Probe Vorhanden')

  // Beim zweiten Mal fragt das Isolat nicht mehr nach.
  await ensureCoupon(stripe, aktion, 2000)
  assert.equal(aufrufe.length, 1)
})

test('fehlende Coupon-Rechte schlagen durch', async () => {
  const stripe = {
    coupons: {
      async create() {
        const err = new Error('The provided key does not have the required permissions')
        err.type = 'StripePermissionError'
        throw err
      },
    },
  }
  await assert.rejects(ensureCoupon(stripe, { ...blackWeek, name: 'Probe Rechte' }, 2000), /permissions/)
})
