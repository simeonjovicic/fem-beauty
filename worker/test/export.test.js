import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildRedemptionsCsv,
  buildSalesCsv,
  csvAmount,
  csvText,
  monthBounds,
} from '../src/admin/export.js'

test('Monatsgrenzen liegen auf Wiener Mitternacht, nicht auf UTC', () => {
  // September 2026 liegt ganz in der Sommerzeit: +02:00.
  assert.deepEqual(monthBounds('2026-09'), {
    from: '2026-08-31T22:00:00.000Z',
    to: '2026-09-30T22:00:00.000Z',
  })
})

test('die Zeitumstellung verschiebt nur das Ende des Monats', () => {
  // Im Oktober wird zurueckgestellt: der Monat beginnt in der Sommerzeit
  // (+02:00) und endet in der Winterzeit (+01:00). Eine Grenze, die beide
  // Enden gleich behandelt, ist an einem davon um eine Stunde daneben.
  assert.deepEqual(monthBounds('2026-10'), {
    from: '2026-09-30T22:00:00.000Z',
    to: '2026-10-31T23:00:00.000Z',
  })
})

test('der Dezember findet ueber den Jahreswechsel hinaus sein Ende', () => {
  assert.deepEqual(monthBounds('2026-12'), {
    from: '2026-11-30T23:00:00.000Z',
    to: '2026-12-31T23:00:00.000Z',
  })
})

test('unbrauchbare Monatsangaben liefern nichts', () => {
  for (const eingabe of ['', null, undefined, '2026-13', '2026-00', '26-09', '2026-9', 'abc']) {
    assert.equal(monthBounds(eingabe), null, `${eingabe} haette abgelehnt werden muessen`)
  }
})

test('Semikolon, Anfuehrungszeichen und Zeilenumbruch zerreissen die Zeile nicht', () => {
  assert.equal(csvText('Mayr; Anna'), '"Mayr; Anna"')
  assert.equal(csvText('sie sagte "ja"'), '"sie sagte ""ja"""')
  assert.equal(csvText('erste\nzweite'), '"erste\nzweite"')
  assert.equal(csvText('harmlos'), 'harmlos')
  assert.equal(csvText(null), '')
})

test('Fremdtext wird nicht als Excel-Formel ausgefuehrt', () => {
  // Die Nachricht auf dem Gutschein tippt die Kaeuferin.
  assert.equal(csvText('=1+1'), "'=1+1")
  assert.equal(csvText('@SUM(A1)'), "'@SUM(A1)")
  assert.equal(csvText('+43 660 1234567'), "'+43 660 1234567")
})

test('Betraege behalten ihr Vorzeichen und bekommen ein Komma', () => {
  assert.equal(csvAmount(10500), '105,00')
  assert.equal(csvAmount(100), '1,00')
  // Eine Gegenbuchung ist negativ. Ein Apostroph davor machte daraus Text,
  // mit dem keine Summenzeile mehr rechnet.
  assert.equal(csvAmount(-5000), '-50,00')
  assert.doesNotMatch(csvAmount(-5000), /'/)
})

const verkauf = {
  issued_at: '2026-09-12T13:19:48.973Z',
  code: 'FEM-2ZQ4N-35406',
  kind: 'treatment',
  treatment_label: 'The Head Spa · Pure Balance',
  original_amount_cents: 10500,
  vat_rate_bp: 2000,
  status: 'active',
  delivery: 'download',
  buyer_email: 'kundin@example.com',
  redeemed_cents: 0,
  balance_cents: 10500,
  stripe_session_id: 'cs_live_a1Jy',
}

test('die Verkaufsdatei teilt Brutto in Netto und USt auf', () => {
  const [kopf, zeile] = buildSalesCsv([verkauf]).split('\r\n')

  assert.match(kopf, /^Datum;Code;Art;Behandlung;Brutto EUR/)

  const felder = zeile.split(';')
  assert.equal(felder[0], '12.09.2026')
  assert.equal(felder[4], '105,00')  // brutto
  assert.equal(felder[5], '20,00')   // satz
  assert.equal(felder[6], '17,50')   // ust
  assert.equal(felder[7], '87,50')   // netto
})

test('Netto und USt ergeben zusammen wieder den bezahlten Betrag', () => {
  // Auch dort, wo die Division nicht aufgeht: 1,00 EUR bei 20 % sind
  // 0,83 netto und 0,17 Steuer — nicht 0,84 und 0,17.
  for (const brutto of [100, 101, 999, 4999, 10500, 12345]) {
    const felder = buildSalesCsv([{ ...verkauf, original_amount_cents: brutto, balance_cents: brutto }])
      .split('\r\n')[1].split(';')

    const ust = Number(felder[6].replace(',', '.'))
    const netto = Number(felder[7].replace(',', '.'))
    assert.equal(Math.round((ust + netto) * 100), brutto, `${brutto} geht nicht auf`)
  }
})

test('ein Feld mit Semikolon verschiebt die Spalten nicht', () => {
  const zeile = buildSalesCsv([{ ...verkauf, treatment_label: 'Spa; lang' }]).split('\r\n')[1]

  // Naiv gespalten waere eine Spalte zu viel da — in Anfuehrungszeichen
  // gesetzt bleibt es ein Feld.
  assert.match(zeile, /;"Spa; lang";/)
})

test('die Buchungsdatei unterscheidet Abbuchung und Storno', () => {
  const zeilen = buildRedemptionsCsv([
    {
      redeemed_at: '2026-09-14T08:30:00.000Z',
      code: 'FEM-AZ717-WSVRK',
      amount_cents: 3000,
      reverses_id: null,
      staff_id: 'beauty@fembeauty.at',
      note: null,
    },
    {
      redeemed_at: '2026-09-14T08:35:00.000Z',
      code: 'FEM-AZ717-WSVRK',
      amount_cents: -3000,
      reverses_id: 'r1',
      staff_id: 'beauty@fembeauty.at',
      note: 'vertippt',
    },
  ]).split('\r\n')

  assert.equal(zeilen[1], '14.09.2026;10:30;FEM-AZ717-WSVRK;30,00;Abbuchung;beauty@fembeauty.at;')
  assert.equal(zeilen[2], '14.09.2026;10:35;FEM-AZ717-WSVRK;-30,00;Storno;beauty@fembeauty.at;vertippt')
})

test('ein Monat ohne Verkaeufe liefert die Kopfzeile, nicht nichts', () => {
  // Eine leere Datei sieht aus wie ein Fehler. Eine Datei mit Spalten und
  // ohne Zeilen sagt: es gab in diesem Monat keinen Verkauf.
  const inhalt = buildSalesCsv([])
  assert.equal(inhalt.split('\r\n').length, 1)
  assert.match(inhalt, /^Datum;Code;/)
})
