// Gutschein als PDF.
//
// Drei Eigenheiten der Umgebung bestimmen den Aufbau:
//
// 1. Workers haben kein Canvas. Übliche QR-Bibliotheken zeichnen auf eines.
//    Deshalb erzeugt qrcode-generator hier nur die Modulmatrix, und die
//    wird als Rechtecke ins PDF gezeichnet — bleibt dabei vektoriell und
//    druckt in jeder Auflösung scharf. Gegengeprüft mit einem Decoder:
//    lesbar von 72 bis 300 dpi.
//
// 2. Schriften und Logo müssen mitgebündelt werden. Das PDF entsteht zur
//    Laufzeit im Worker, es kann also nichts nachladen. Playfair Display
//    und Outfit liegen als TTF in worker/fonts, die Wortmarke als PNG in
//    worker/assets; wrangler.jsonc bindet beide als Binärdaten ein.
//
//    Vorher standen hier Times und Helvetica, die eingebauten
//    PDF-Standardschriften. Sie brauchten keine Datei, sahen aber nach
//    Textverarbeitung aus statt nach der Marke.
//
// 3. Nicht jedes Zeichen hat eine Entsprechung in der Schrift. Ein Emoji
//    in der Grußnachricht — bei einem Geschenkgutschein alles andere als
//    unwahrscheinlich — würde als Leerkasten erscheinen. Deshalb geht
//    jeder Text durch sanitize(). Umlaute, ß, deutsche Anführungszeichen
//    und Gedankenstrich bleiben dabei erhalten; nur was die Schrift nicht
//    kennt, fällt weg.

import qrcode from 'qrcode-generator'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb } from 'pdf-lib'

import playfairRegular from '../fonts/Playfair-Regular.ttf'
import playfairMedium from '../fonts/Playfair-Medium.ttf'
import playfairItalic from '../fonts/Playfair-Italic.ttf'
import outfitRegular from '../fonts/Outfit-Regular.ttf'
import outfitMedium from '../fonts/Outfit-Medium.ttf'
import logoPng from '../assets/logo.png'

// Dieselben Werte wie :root in style.css. Das PDF erfindet keine Farben.
const WARM = rgb(0.290, 0.247, 0.220)   // #4a3f38
const WARM_LT = rgb(0.420, 0.373, 0.333) // #6b5f55
const SAND = rgb(0.788, 0.600, 0.369)   // #c9995e
const SAND_LT = rgb(0.863, 0.769, 0.627) // #dcc4a0
const CREAM = rgb(0.961, 0.941, 0.918)  // #f5f0ea
const PAPER = rgb(0.992, 0.984, 0.973)  // #fdfbf8
const WHITE = rgb(1, 1, 1)
const MUTED = rgb(0.588, 0.541, 0.502)  // #968a80

// Grund der Karte. Aufgehelltes --warm, kein anderer Braunton — sonst
// passte der Sandton der Wortmarke darauf nicht mehr, die ja direkt
// darauf sitzt.
const CARD = rgb(0.490, 0.435, 0.392)  // #7d6f64

// Beschriftung auf der Karte. Auf dem helleren Grund traegt der Sandton
// nicht mehr: --sand-lt kommt dort auf 2,9:1, und das bei 7-Punkt-Labels.
// Ein blasseres Sand half nicht — selbst #f7f0e6 blieb unter 4,5:1, die
// Karte ist dafuer schlicht zu hell. Gebrochenes Weiss loest es (7,4:1)
// und nimmt der Karte nichts: den Sandcharakter tragen Wortmarke, Linie
// und der Akzentstrich.
const CARD_LABEL = rgb(0.965, 0.949, 0.929)  // #f6f2ed

const A4 = [595.28, 841.89]

const NBSP = String.fromCharCode(0xa0)
const REPLACEMENTS = [
  [/‹/g, '‘'],
  [/›/g, '’'],
  [/«/g, '„'],
  [/»/g, '“'],
  [/−/g, '–'],
  [/•/g, '·'],
  [new RegExp(NBSP, 'g'), ' '],
]

// ASCII, Latin-1 und die gebraeuchlichen typografischen Zeichen. Playfair
// und Outfit koennen mehr, aber diese Auswahl deckt Deutsch vollstaendig ab
// und laesst zuverlaessig alles weg, wofuer eine Textschrift keine Zeichen
// hat — Emoji vor allem.
//
// Als Escapes geschrieben: die Klasse enthaelt sonst ein literales
// geschuetztes Leerzeichen, das im Editor unsichtbar ist.
const ERLAUBT = new RegExp(
  '[^\\u0020-\\u007E\\u00A0-\\u00FF'
  + '\\u20AC\\u201A\\u0192\\u201E\\u2026\\u2020\\u2021\\u02C6\\u2030\\u0160\\u2039\\u0152\\u017D'
  + '\\u2018\\u2019\\u201C\\u201D\\u2022\\u2013\\u2014\\u02DC\\u2122\\u0161\\u203A\\u0153\\u017E\\u0178]',
  'g',
)

/** Entfernt, was die eingebetteten Schriften nicht darstellen können. */
export function sanitize(value) {
  let text = String(value ?? '')
  for (const [pattern, replacement] of REPLACEMENTS) text = text.replace(pattern, replacement)
  return text.replace(ERLAUBT, '').replace(/\s+/g, ' ').trim()
}

const euro = new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' })
const money = (cents) => sanitize(euro.format(cents / 100))

/** Bricht Text auf eine Breite um — pdf-lib bringt keinen Umbruch mit. */
function wrap(text, font, size, maxWidth) {
  const lines = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate
    } else {
      if (line) lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

function trackedWidth(text, font, size, tracking) {
  if (!text) return 0
  let width = -tracking
  for (const ch of text) width += font.widthOfTextAtSize(ch, size) + tracking
  return width
}

/** Gesperrte Schrift. drawText kann kein letter-spacing, also Zeichen für Zeichen. */
function drawTracked(page, text, { x, y, size, font, color, tracking = 1.6 }) {
  let cursor = x
  for (const ch of text) {
    page.drawText(ch, { x: cursor, y, size, font, color })
    cursor += font.widthOfTextAtSize(ch, size) + tracking
  }
}

/**
 * Betrag als Blickfang.
 *
 * de-AT setzt das Zeichen voran und trennt es mit einem geschützten
 * Leerzeichen: „€ 150,00". Bei 50pt reißt diese Lücke ein Loch mitten in
 * die wichtigste Zahl der Seite. Deshalb wird das Zeichen kleiner, höher
 * und enger gesetzt — wie auf einer Preistafel.
 */
function drawAmount(page, cents, { x, y, size, font, color }) {
  const text = money(cents)
  const gap = text.indexOf(' ')
  if (gap < 0) {
    page.drawText(text, { x, y, size, font, color })
    return
  }

  const symbol = text.slice(0, gap)
  const number = text.slice(gap + 1)
  const symbolSize = size * 0.58

  page.drawText(symbol, { x, y: y + size * 0.13, size: symbolSize, font, color })
  page.drawText(number, {
    x: x + font.widthOfTextAtSize(symbol, symbolSize) + size * 0.13,
    y, size, font, color,
  })
}

/** Haarlinie. drawLine wäre auch möglich, aber Rechtecke rastern sauberer. */
function rule(page, { x, y, width, color = SAND_LT, thickness = 0.6, opacity = 1 }) {
  page.drawRectangle({ x, y, width, height: thickness, color, opacity })
}

function drawQr(page, { url, x, y, size, dark = WARM }) {
  const qr = qrcode(0, 'M')
  qr.addData(url)
  qr.make()

  const modules = qr.getModuleCount()
  // Ruhezone: der Standard verlangt vier Module Rand, sonst finden
  // manche Scanner den Code nicht.
  const quiet = 4
  const unit = size / (modules + quiet * 2)

  page.drawRectangle({ x, y, width: size, height: size, color: WHITE })

  for (let row = 0; row < modules; row += 1) {
    for (let col = 0; col < modules; col += 1) {
      if (!qr.isDark(row, col)) continue
      page.drawRectangle({
        x: x + (col + quiet) * unit,
        // PDF zählt y von unten, die Matrix von oben.
        y: y + size - (row + quiet + 1) * unit,
        width: unit,
        height: unit,
        color: dark,
      })
    }
  }
}

/**
 * @param {object} voucher  Zeile aus `vouchers`
 * @param {string} qrUrl    Ziel des QR-Codes (führt ins Panel, löst nichts ein)
 * @returns {Promise<Uint8Array>}
 */
export async function buildVoucherPdf(voucher, qrUrl) {
  const doc = await PDFDocument.create()
  doc.setTitle(`FEM Gutschein ${voucher.code}`)
  doc.setAuthor('FEM Beauty Wien')
  doc.setSubject('Gutschein')
  doc.setCreator('fembeauty.at')

  doc.registerFontkit(fontkit)

  // subset: true bettet nur die tatsächlich benutzten Zeichen ein. Ohne
  // das trüge jedes PDF rund 450 kB Schriftdaten mit sich herum.
  const embed = (bytes) => doc.embedFont(bytes, { subset: true })
  const [serif, serifMedium, serifItalic, sans, sansMedium] = await Promise.all([
    embed(playfairRegular), embed(playfairMedium), embed(playfairItalic),
    embed(outfitRegular), embed(outfitMedium),
  ])
  const logo = await doc.embedPng(logoPng)

  const [W, H] = A4
  const page = doc.addPage(A4)
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER })

  const margin = 48
  const inner = W - margin * 2
  const right = W - margin
  const isTreatment = voucher.kind === 'treatment'

  // ── Kopf ───────────────────────────────────────────────
  // Hier gesetzt, nicht als Bild: das Logo ist sandfarben und stuende auf
  // dem hellen Papier fast unsichtbar. Die Website macht es in der
  // Navigation genauso — Schriftzug auf Hell, Bildmarke auf Dunkel.
  page.drawText('Fem', {
    x: margin, y: H - 74, size: 28, font: serifItalic, color: WARM,
  })

  const kicker = 'BEAUTY & SPA'
  drawTracked(page, kicker, {
    x: margin + serifItalic.widthOfTextAtSize('Fem', 28) + 12,
    y: H - 68, size: 7.5, font: sans, color: SAND, tracking: 2,
  })

  const gattung = sanitize(isTreatment ? 'BEHANDLUNGSGUTSCHEIN' : 'WERTGUTSCHEIN')
  drawTracked(page, gattung, {
    x: right - trackedWidth(gattung, sans, 8, 2),
    y: H - 68, size: 8, font: sans, color: MUTED, tracking: 2,
  })

  rule(page, { x: margin, y: H - 92, width: inner, color: SAND, opacity: 0.28 })

  // ── Karte ──────────────────────────────────────────────
  // Das eigentliche Geschenk. Alles darunter ist Beiwerk, deshalb bekommt
  // die Karte als einzige Fläche die dunkle Farbe und den meisten Platz.
  const cardH = 272
  const cardY = H - 116 - cardH
  const pad = 36

  page.drawRectangle({ x: margin, y: cardY, width: inner, height: cardH, color: CARD })
  page.drawRectangle({
    x: margin + 12, y: cardY + 12, width: inner - 24, height: cardH - 24,
    borderColor: SAND, borderWidth: 0.5, borderOpacity: 0.45, opacity: 0,
  })

  // Dieselbe Marke auf der Karte. Der Sandton des Logos steht auf dem
  // dunklen Grund von selbst — eine weisse Fassung braucht es nicht.
  const cardLogoW = 104
  const cardLogoH = cardLogoW * (logo.height / logo.width)
  page.drawImage(logo, {
    x: margin + pad, y: cardY + cardH - 30 - cardLogoH,
    width: cardLogoW, height: cardLogoH,
  })

  const edition = sanitize(isTreatment ? 'TREATMENT EDITION' : 'GIFT EDITION')
  drawTracked(page, edition, {
    x: right - pad - trackedWidth(edition, sans, 7, 2),
    y: cardY + cardH - 47, size: 7, font: sans, color: CARD_LABEL, tracking: 2,
  })

  rule(page, {
    x: margin + pad, y: cardY + cardH - 74, width: inner - pad * 2,
    color: CARD_LABEL, opacity: 0.35,
  })

  // Alles Folgende haengt an dieser Grundlinie. Vorher stand das Label auf
  // cardY + 158 und der zweizeilige Titel begann auf 146 — bei 25pt Schrift
  // ragten dessen Oberlaengen in das Label hinein.
  const labelY = cardY + cardH - 104

  const label = sanitize(isTreatment ? 'BEHANDLUNG' : 'GUTSCHEIN ÜBER')
  drawTracked(page, label, {
    x: margin + pad, y: labelY, size: 7, font: sans, color: CARD_LABEL, tracking: 2,
  })

  if (isTreatment) {
    // Beim Behandlungsgutschein trägt der Name der Behandlung, nicht der
    // Betrag — der steht klein darunter, weil er für die Einlösung zählt.
    //
    // Der Betrag sitzt fest auf cardY + 92, nicht relativ zur Zeilenzahl:
    // ein zweizeiliger Titel schöbe ihn sonst in die Linie darunter.
    const title = sanitize(voucher.treatment_label || 'Behandlung')
    const lines = wrap(title, serif, 25, inner - pad * 2 - 100).slice(0, 2)
    // Eine Zeile sitzt tiefer als die erste von zweien, damit der Block in
    // beiden Faellen ungefaehr gleich weit unter dem Label endet.
    const top = lines.length === 2 ? labelY - 34 : labelY - 44

    lines.forEach((line, index) => {
      page.drawText(line, {
        x: margin + pad, y: top - index * 30, size: 25, font: serif, color: WHITE,
      })
    })
    page.drawText(money(voucher.original_amount_cents), {
      x: margin + pad, y: cardY + 86, size: 13, font: sans, color: CARD_LABEL,
    })
  } else {
    drawAmount(page, voucher.original_amount_cents, {
      x: margin + pad, y: cardY + 96, size: 50, font: serifMedium, color: WHITE,
    })
  }

  rule(page, {
    x: margin + pad, y: cardY + 66, width: 44, color: SAND, thickness: 1,
  })

  const recipient = sanitize(voucher.recipient_name)
  page.drawText(recipient ? `Für ${recipient}` : 'Für einen besonderen Menschen', {
    x: margin + pad, y: cardY + 38, size: 14, font: serifItalic, color: CARD_LABEL,
  })

  const sender = sanitize(voucher.sender_name)
  if (sender) {
    const from = `Von ${sender}`
    page.drawText(from, {
      x: right - pad - sans.widthOfTextAtSize(from, 9.5),
      y: cardY + 47, size: 9.5, font: sans, color: CARD_LABEL,
    })
  }

  // ── Widmung ────────────────────────────────────────────
  // Mit Randbalken statt Anführungszeichen-Ornament: der Balken markiert
  // das Zitat auch dann, wenn die Nachricht selbst schon Zeichen mitbringt.
  let y = cardY - 46
  const message = sanitize(voucher.message)
  if (message) {
    const quoted = /^[„“"']/.test(message) ? message : `„${message}“`
    const lines = wrap(quoted, serifItalic, 14, inner - 22).slice(0, 3)
    const blockH = lines.length * 21

    page.drawRectangle({
      x: margin, y: y - blockH + 12, width: 1.6, height: blockH, color: SAND, opacity: 0.5,
    })
    lines.forEach((line, index) => {
      page.drawText(line, {
        x: margin + 18, y: y - index * 21, size: 14, font: serifItalic, color: WARM_LT,
      })
    })
    y -= blockH + 22
  }

  // ── Code und QR ────────────────────────────────────────
  const boxH = 122
  const boxY = y - boxH
  page.drawRectangle({ x: margin, y: boxY, width: inner, height: boxH, color: CREAM })
  rule(page, { x: margin, y: boxY + boxH - 0.6, width: inner, color: SAND, opacity: 0.35 })

  drawTracked(page, 'GUTSCHEINCODE', {
    x: margin + 28, y: boxY + boxH - 34, size: 7, font: sans, color: MUTED, tracking: 2,
  })
  drawTracked(page, voucher.code, {
    x: margin + 28, y: boxY + boxH - 66, size: 20, font: sansMedium, color: WARM, tracking: 1.2,
  })
  page.drawText(sanitize('Im Studio vorzeigen oder bei der Buchung nennen.'), {
    x: margin + 28, y: boxY + 26, size: 9, font: sans, color: MUTED,
  })

  const qrSize = 86
  const qrX = right - 26 - qrSize
  drawQr(page, { url: qrUrl, x: qrX, y: boxY + (boxH - qrSize) / 2, size: qrSize })
  const scanHint = sanitize('Guthaben prüfen')
  page.drawText(scanHint, {
    x: qrX + (qrSize - sans.widthOfTextAtSize(scanHint, 6.5)) / 2,
    y: boxY + (boxH - qrSize) / 2 - 11, size: 6.5, font: sans, color: MUTED,
  })

  // ── Einlösen in drei Schritten ─────────────────────────
  // Erspart die Rückfrage am Telefon. Drei Spalten statt einer Liste,
  // damit der Block flach bleibt und die Fußzeile nicht verdrängt.
  const stepsY = boxY - 42
  const colW = inner / 3
  const steps = [
    ['01', 'Termin vereinbaren', 'Online, telefonisch oder im Studio.'],
    ['02', 'Gutschein nennen', 'Am besten gleich bei der Buchung.'],
    ['03', 'Genießen', 'Der Betrag wird bei der Behandlung abgezogen.'],
  ]

  steps.forEach(([num, title, hint], index) => {
    const x = margin + colW * index
    page.drawText(num, { x, y: stepsY, size: 13, font: serif, color: SAND })
    page.drawText(sanitize(title), {
      x: x + 22, y: stepsY, size: 9.5, font: sansMedium, color: WARM,
    })
    wrap(sanitize(hint), sans, 8.5, colW - 34).slice(0, 2).forEach((line, row) => {
      page.drawText(line, {
        x: x + 22, y: stepsY - 14 - row * 11, size: 8.5, font: sans, color: MUTED,
      })
    })
  })

  // ── Fußzeile ───────────────────────────────────────────
  // Am unteren Rand verankert statt an den Inhalt gehängt: eine lange
  // Widmung darf den Block sonst über die Seitenkante schieben.
  const footTop = margin + 74
  rule(page, { x: margin, y: footTop, width: inner, color: SAND, opacity: 0.28 })

  page.drawText(sanitize('FEM Beauty Wien'), {
    x: margin, y: footTop - 22, size: 10, font: sansMedium, color: WARM,
  })
  page.drawText(sanitize('Ramperstorffergasse 51 · 1050 Wien'), {
    x: margin, y: footTop - 36, size: 8.5, font: sans, color: MUTED,
  })
  page.drawText(sanitize('+43 660 8866068 · beauty@fembeauty.at · fembeauty.at'), {
    x: margin, y: footTop - 49, size: 8.5, font: sans, color: MUTED,
  })

  const legal = [
    voucher.expires_at
      ? `Einlösbar bis ${new Date(voucher.expires_at).toLocaleDateString('de-AT')}.`
      : 'Ohne Ablaufdatum.',
    'Teileinlösung möglich, Restbeträge bleiben erhalten.',
    'Keine Barauszahlung. Nicht mit anderen Aktionen kombinierbar.',
  ]
  legal.forEach((line, index) => {
    const text = sanitize(line)
    page.drawText(text, {
      x: right - sans.widthOfTextAtSize(text, 8),
      y: footTop - 22 - index * 12, size: 8, font: sans, color: MUTED,
    })
  })

  return doc.save()
}


