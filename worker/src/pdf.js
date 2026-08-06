// Gutschein als PDF.
//
// Zwei Eigenheiten der Umgebung bestimmen den Aufbau:
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

import qrcode from 'qrcode-generator'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const WARM = rgb(0.290, 0.247, 0.220)
const SAND = rgb(0.788, 0.600, 0.369)
const SAND_LT = rgb(0.863, 0.769, 0.627)
const CREAM = rgb(0.961, 0.941, 0.918)
const PAPER = rgb(0.992, 0.984, 0.973)
const WHITE = rgb(1, 1, 1)
const MUTED = rgb(0.588, 0.541, 0.502)

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

  const serif = await doc.embedFont(StandardFonts.TimesRoman)
  const serifItalic = await doc.embedFont(StandardFonts.TimesRomanItalic)
  const sans = await doc.embedFont(StandardFonts.Helvetica)
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const [W, H] = A4
  const page = doc.addPage(A4)
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER })

  const margin = 56
  const inner = W - margin * 2
  const pad = 34
  const isTreatment = voucher.kind === 'treatment'

  // ── Karte ──────────────────────────────────────────────
  const cardH = 268
  const cardY = H - margin - cardH
  page.drawRectangle({ x: margin, y: cardY, width: inner, height: cardH, color: WARM })
  page.drawRectangle({
    x: margin + 13, y: cardY + 13, width: inner - 26, height: cardH - 26,
    borderColor: SAND_LT, borderWidth: 0.6, opacity: 0,
  })

  page.drawText('Fem', { x: margin + pad, y: cardY + cardH - 50, size: 25, font: serifItalic, color: WHITE })
  const edition = isTreatment ? 'TREATMENT EDITION · VIENNA' : 'GIFT EDITION · VIENNA'
  page.drawText(winAnsi(edition), {
    x: W - margin - pad - sans.widthOfTextAtSize(winAnsi(edition), 7.5),
    y: cardY + cardH - 44, size: 7.5, font: sans, color: SAND_LT,
  })

  page.drawText(isTreatment ? 'BEHANDLUNGSGUTSCHEIN' : 'WERTGUTSCHEIN', {
    x: margin + pad, y: cardY + 146, size: 8, font: sans, color: SAND_LT,
  })

  if (isTreatment) {
    const title = winAnsi(voucher.treatment_label || 'Behandlung')
    wrap(title, serif, 24, inner - pad * 2).slice(0, 2).forEach((line, index) => {
      page.drawText(line, { x: margin + pad, y: cardY + 112 - index * 28, size: 24, font: serif, color: WHITE })
    })
    page.drawText(`Gutscheinwert ${money(voucher.original_amount_cents)}`, {
      x: margin + pad, y: cardY + 66, size: 11, font: sans, color: SAND_LT,
    })
  } else {
    page.drawText(money(voucher.original_amount_cents), {
      x: margin + pad, y: cardY + 92, size: 44, font: serif, color: WHITE,
    })
  }

  const recipient = winAnsi(voucher.recipient_name)
  page.drawText(recipient ? `Für ${recipient}` : 'Für einen besonderen Menschen', {
    x: margin + pad, y: cardY + 42, size: 12, font: serifItalic, color: SAND_LT,
  })

  const sender = winAnsi(voucher.sender_name)
  if (sender) {
    const label = `Von ${sender}`
    page.drawText(label, {
      x: W - margin - pad - sans.widthOfTextAtSize(label, 9),
      y: cardY + 44, size: 9, font: sans, color: SAND_LT,
    })
  }

  // ── Nachricht ──────────────────────────────────────────
  let y = cardY - 42
  const message = winAnsi(voucher.message)
  if (message) {
    // Deutsche Anführungszeichen nur setzen, wenn die Nachricht nicht
    // schon selbst welche mitbringt — sonst steht Zitat im Zitat.
    const quoted = /^[„“"']/.test(message) ? message : `„${message}“`
    for (const line of wrap(quoted, serifItalic, 13, inner).slice(0, 4)) {
      page.drawText(line, { x: margin, y, size: 13, font: serifItalic, color: WARM })
      y -= 19
    }
    y -= 14
  }

  // ── Code und QR ────────────────────────────────────────
  const boxH = 130
  const boxY = y - boxH
  page.drawRectangle({ x: margin, y: boxY, width: inner, height: boxH, color: CREAM })

  page.drawText('GUTSCHEINCODE', { x: margin + 26, y: boxY + boxH - 32, size: 8, font: sans, color: MUTED })
  page.drawText(voucher.code, { x: margin + 26, y: boxY + boxH - 66, size: 21, font: sansBold, color: WARM })
  page.drawText('Im Salon vorzeigen oder den Code nennen.', {
    x: margin + 26, y: boxY + 28, size: 9, font: sans, color: MUTED,
  })

  const qrSize = 94
  drawQr(page, { url: qrUrl, x: W - margin - 24 - qrSize, y: boxY + (boxH - qrSize) / 2, size: qrSize })

  // ── Fußzeile ───────────────────────────────────────────
  let footY = boxY - 40
  const footer = [
    ['FEM Beauty Wien · Ramperstorffergasse 51, 1050 Wien', sansBold, 9.5, WARM],
    ['Termin unter +43 660 8866068 oder beauty@fembeauty.at', sans, 9, MUTED],
    ['', sans, 9, MUTED],
    [voucher.expires_at
      ? `Einlösbar bis ${new Date(voucher.expires_at).toLocaleDateString('de-AT')}.`
      : 'Ohne Ablaufdatum. Restbeträge bleiben erhalten und können später eingelöst werden.',
      sans, 8.5, MUTED],
    ['Teileinlösung möglich. Keine Barauszahlung.', sans, 8.5, MUTED],
  ]
  for (const [text, font, size, color] of footer) {
    if (text) page.drawText(winAnsi(text), { x: margin, y: footY, size, font, color })
    footY -= size + 5
  }

  page.drawRectangle({ x: margin, y: footY - 6, width: 44, height: 0.8, color: SAND })

  return doc.save()
}
