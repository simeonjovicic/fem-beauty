// Gutschein als PDF.
//
// Drei Eigenheiten der Umgebung bestimmen den Aufbau:
//
// 1. Workers haben kein Canvas. Übliche QR-Bibliotheken zeichnen auf eines.
//    Deshalb erzeugt qrcode-generator hier nur die Modulmatrix, und die
//    wird als Rechtecke ins PDF gezeichnet — bleibt dabei vektoriell und
//    druckt in jeder Auflösung scharf.
//
// 2. Die eingebauten PDF-Standardschriften können nur WinAnsi. Ein Emoji
//    in der Grußnachricht — bei einem Geschenkgutschein alles andere als
//    unwahrscheinlich — würde die Erzeugung sonst mit einer Ausnahme
//    abbrechen. Deshalb geht jeder Text durch winAnsi().
//
//    WinAnsi kann allerdings mehr, als man annimmt: Umlaute, ß, deutsche
//    Anführungszeichen und Gedankenstrich sind enthalten. Nur was
//    wirklich fehlt, wird ersetzt — alles andere bliebe sonst ohne Not
//    Fernschreiber-Typografie.
//
// 3. Ohne eingebettete Schriftdatei bleiben Times und Helvetica. Die
//    Sperrung der Kleinversalien, die auf der Website die Ruhe erzeugt,
//    kennt drawText nicht — deshalb drawTracked(), das Zeichen für
//    Zeichen setzt. Nur für kurze Labels, nicht für Fließtext.

import qrcode from 'qrcode-generator'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

// Dieselben Werte wie :root in style.css. Das PDF erfindet keine Farben.
const WARM = rgb(0.290, 0.247, 0.220)   // #4a3f38
const WARM_LT = rgb(0.420, 0.373, 0.333) // #6b5f55
const SAND = rgb(0.788, 0.600, 0.369)   // #c9995e
const SAND_LT = rgb(0.863, 0.769, 0.627) // #dcc4a0
const SAND_PALE = rgb(0.929, 0.878, 0.816) // #ede0d0
const CREAM = rgb(0.961, 0.941, 0.918)  // #f5f0ea
const PAPER = rgb(0.992, 0.984, 0.973)  // #fdfbf8
const WHITE = rgb(1, 1, 1)
const MUTED = rgb(0.588, 0.541, 0.502)  // #968a80

const A4 = [595.28, 841.89]

// Das Vier-Punkt-Funkeln aus dem Icon-Satz der Website, als SVG-Pfad im
// 24er-Raster. drawSvgPath rechnet in SVG-Koordinaten (y nach unten) —
// der übergebene Punkt ist also die *obere* linke Ecke, nicht die untere.
const SPARKLE = 'M12 2.8c.7 4.2 2.9 6.4 7.2 7.2-4.3.8-6.5 3-7.2 7.2'
  + '-.7-4.2-2.9-6.4-7.2-7.2 4.3-.8 6.5-3 7.2-7.2Z'

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

// ASCII, Latin-1 und die WinAnsi-Sonderzeichen. Alles andere fliegt raus.
// Als Escapes geschrieben: die Klasse enthaelt sonst ein literales
// geschuetztes Leerzeichen, das im Editor unsichtbar ist.
const WIN_ANSI = new RegExp(
  '[^\\u0020-\\u007E\\u00A0-\\u00FF'
  + '\\u20AC\\u201A\\u0192\\u201E\\u2026\\u2020\\u2021\\u02C6\\u2030\\u0160\\u2039\\u0152\\u017D'
  + '\\u2018\\u2019\\u201C\\u201D\\u2022\\u2013\\u2014\\u02DC\\u2122\\u0161\\u203A\\u0153\\u017E\\u0178]',
  'g',
)

/** Macht beliebigen Nutzertext für die Standardschriften ungefährlich. */
export function winAnsi(value) {
  let text = String(value ?? '')
  for (const [pattern, replacement] of REPLACEMENTS) text = text.replace(pattern, replacement)
  return text.replace(WIN_ANSI, '').replace(/\s+/g, ' ').trim()
}

const euro = new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' })
const money = (cents) => winAnsi(euro.format(cents / 100))

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

  const serif = await doc.embedFont(StandardFonts.TimesRoman)
  const serifItalic = await doc.embedFont(StandardFonts.TimesRomanItalic)
  const sans = await doc.embedFont(StandardFonts.Helvetica)
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const [W, H] = A4
  const page = doc.addPage(A4)
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER })

  const margin = 48
  const inner = W - margin * 2
  const right = W - margin
  const isTreatment = voucher.kind === 'treatment'

  // ── Kopf ───────────────────────────────────────────────
  // Wortmarke links, Gattung rechts. Beides auf einer Grundlinie, damit
  // der Blick oben nicht zweimal ansetzen muss.
  page.drawText('Fem', {
    x: margin, y: H - 74, size: 27, font: serifItalic, color: WARM,
  })

  const kicker = 'BEAUTY & SPA'
  drawTracked(page, kicker, {
    x: margin + 62, y: H - 68, size: 7.5, font: sans, color: SAND, tracking: 2,
  })

  const gattung = winAnsi(isTreatment ? 'BEHANDLUNGSGUTSCHEIN' : 'WERTGUTSCHEIN')
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

  page.drawRectangle({ x: margin, y: cardY, width: inner, height: cardH, color: WARM })
  page.drawRectangle({
    x: margin + 12, y: cardY + 12, width: inner - 24, height: cardH - 24,
    borderColor: SAND, borderWidth: 0.5, borderOpacity: 0.45, opacity: 0,
  })

  // Wasserzeichen: groß genug, um Fläche zu geben, blass genug, um den
  // Text nicht zu stören. Beide bleiben oberhalb von cardY + 66 — darunter
  // steht rechts der Absendername, und ein Funkeln hinter einem Namen
  // sieht nicht nach Absicht aus, sondern nach Unfall.
  page.drawSvgPath(SPARKLE, {
    x: right - pad - 90, y: cardY + 150, scale: 3.3, color: SAND, opacity: 0.09,
  })
  page.drawSvgPath(SPARKLE, {
    x: right - pad - 130, y: cardY + 104, scale: 1.4, color: SAND, opacity: 0.13,
  })

  page.drawText('Fem', {
    x: margin + pad, y: cardY + cardH - 54, size: 24, font: serifItalic, color: WHITE,
  })

  const edition = winAnsi(isTreatment ? 'TREATMENT EDITION' : 'GIFT EDITION')
  drawTracked(page, edition, {
    x: right - pad - trackedWidth(edition, sans, 7, 2),
    y: cardY + cardH - 47, size: 7, font: sans, color: SAND_LT, tracking: 2,
  })

  rule(page, {
    x: margin + pad, y: cardY + cardH - 74, width: inner - pad * 2,
    color: SAND_LT, opacity: 0.3,
  })

  const label = winAnsi(isTreatment ? 'BEHANDLUNG' : 'GUTSCHEIN ÜBER')
  drawTracked(page, label, {
    x: margin + pad, y: cardY + 158, size: 7, font: sans, color: SAND_LT, tracking: 2,
  })

  if (isTreatment) {
    // Beim Behandlungsgutschein trägt der Name der Behandlung, nicht der
    // Betrag — der steht klein darunter, weil er für die Einlösung zählt.
    //
    // Der Betrag sitzt fest auf cardY + 92, nicht relativ zur Zeilenzahl:
    // ein zweizeiliger Titel schöbe ihn sonst in die Linie darunter.
    const title = winAnsi(voucher.treatment_label || 'Behandlung')
    const lines = wrap(title, serif, 25, inner - pad * 2 - 100).slice(0, 2)
    const top = lines.length === 2 ? cardY + 146 : cardY + 128

    lines.forEach((line, index) => {
      page.drawText(line, {
        x: margin + pad, y: top - index * 30, size: 25, font: serif, color: WHITE,
      })
    })
    page.drawText(money(voucher.original_amount_cents), {
      x: margin + pad, y: cardY + 92, size: 13, font: sans, color: SAND_LT,
    })
  } else {
    drawAmount(page, voucher.original_amount_cents, {
      x: margin + pad, y: cardY + 100, size: 50, font: serif, color: WHITE,
    })
  }

  rule(page, {
    x: margin + pad, y: cardY + 74, width: 44, color: SAND, thickness: 1,
  })

  const recipient = winAnsi(voucher.recipient_name)
  page.drawText(recipient ? `Für ${recipient}` : 'Für einen besonderen Menschen', {
    x: margin + pad, y: cardY + 44, size: 14, font: serifItalic, color: SAND_PALE,
  })

  const sender = winAnsi(voucher.sender_name)
  if (sender) {
    const from = `Von ${sender}`
    page.drawText(from, {
      x: right - pad - sans.widthOfTextAtSize(from, 9.5),
      y: cardY + 47, size: 9.5, font: sans, color: SAND_LT,
    })
  }

  // ── Widmung ────────────────────────────────────────────
  // Mit Randbalken statt Anführungszeichen-Ornament: der Balken markiert
  // das Zitat auch dann, wenn die Nachricht selbst schon Zeichen mitbringt.
  let y = cardY - 46
  const message = winAnsi(voucher.message)
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
    x: margin + 28, y: boxY + boxH - 66, size: 20, font: sansBold, color: WARM, tracking: 1.2,
  })
  page.drawText(winAnsi('Im Studio vorzeigen oder bei der Buchung nennen.'), {
    x: margin + 28, y: boxY + 26, size: 9, font: sans, color: MUTED,
  })

  const qrSize = 86
  const qrX = right - 26 - qrSize
  drawQr(page, { url: qrUrl, x: qrX, y: boxY + (boxH - qrSize) / 2, size: qrSize })
  const scanHint = winAnsi('Guthaben prüfen')
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
    page.drawText(winAnsi(title), {
      x: x + 22, y: stepsY, size: 9.5, font: sansBold, color: WARM,
    })
    wrap(winAnsi(hint), sans, 8.5, colW - 34).slice(0, 2).forEach((line, row) => {
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

  page.drawText(winAnsi('FEM Beauty Wien'), {
    x: margin, y: footTop - 22, size: 10, font: sansBold, color: WARM,
  })
  page.drawText(winAnsi('Ramperstorffergasse 51 · 1050 Wien'), {
    x: margin, y: footTop - 36, size: 8.5, font: sans, color: MUTED,
  })
  page.drawText(winAnsi('+43 660 8866068 · beauty@fembeauty.at · fembeauty.at'), {
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
    const text = winAnsi(line)
    page.drawText(text, {
      x: right - sans.widthOfTextAtSize(text, 8),
      y: footTop - 22 - index * 12, size: 8, font: sans, color: MUTED,
    })
  })

  return doc.save()
}
