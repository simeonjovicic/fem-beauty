// Die beiden E-Mails rund um einen Gutscheinkauf.
//
// Zwei Varianten, weil zwei verschiedene Menschen zwei verschiedene Dinge
// brauchen:
//
//   'gift'    geht an die beschenkte Person. Sie will kein Beleg-Layout
//             sehen, sondern ein Geschenk. Kein Preis, keine USt, keine
//             Zahlungsart — nur Widmung, Code und wie man einen Termin
//             bekommt.
//
//   'receipt' geht an die Käuferin. Sie will das Gegenteil: was wurde
//             gekauft, was hat es gekostet, wohin ist es gegangen.
//
// Beide hängen dasselbe PDF an. Bei delivery='download' entfällt 'gift'
// und die Käuferin bekommt den Gutschein selbst.
//
// Warum das Layout so altmodisch aussieht: E-Mail-Clients sind kein
// Browser. Outlook rendert mit Word, Gmail entfernt <style> in manchen
// Ansichten, kaum ein Client kann Flexbox oder Grid verlässlich. Deshalb
// verschachtelte Tabellen, Breiten als Attribut *und* im style, jede
// Farbe inline. Der <style>-Block ganz oben ist reine Zugabe für Clients,
// die ihn behalten — ohne ihn muss die Mail vollständig funktionieren.

const BRAND = {
  paper: '#fdfbf8',
  cream: '#f5f0ea',
  white: '#ffffff',
  sand: '#c9995e',
  sandLt: '#dcc4a0',
  sandPale: '#ede0d0',
  warm: '#4a3f38',
  warmLt: '#6b5f55',
  taupe: '#968a80',
  line: '#eadfd2',
}

const SERIF = "Georgia, 'Times New Roman', Times, serif"
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif"

const STUDIO = {
  name: 'FEM Beauty Wien',
  street: 'Ramperstorffergasse 51',
  city: '1050 Wien',
  phone: '+43 660 8866068',
  email: 'beauty@fembeauty.at',
  site: 'https://fembeauty.at',
}

const euroFormat = new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' })
const money = (cents) => euroFormat.format(cents / 100)

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Der Code in Vierergruppen bleibt am Telefon lesbar und beim Abtippen ruhig. */
function spacedCode(code) {
  return esc(code).replace(/-/g, '&#8209;')
}

function longDate(iso) {
  return new Date(iso).toLocaleDateString('de-AT', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

// ────────────────────────────────────────────────────────────
// Bausteine
// ────────────────────────────────────────────────────────────

/**
 * Der Gutschein als Bild-loses Rechteck.
 *
 * Bewusst ohne Grafik: Bilder sind in den meisten Clients standardmäßig
 * blockiert, und dann stünde an der wichtigsten Stelle der Mail ein
 * kaputtes Platzhalter-Icon. Alles hier ist Text auf Hintergrundfarbe und
 * damit immer sichtbar.
 */
function voucherCard(voucher) {
  const isTreatment = voucher.kind === 'treatment'
  const edition = isTreatment ? 'TREATMENT EDITION' : 'GIFT EDITION'

  const headline = isTreatment
    ? `<div style="margin:0;font-family:${SERIF};font-size:26px;line-height:1.25;color:${BRAND.white};">
         ${esc(voucher.treatment_label || 'Behandlung')}
       </div>
       <div style="margin:10px 0 0;font-family:${SANS};font-size:13px;color:${BRAND.sandLt};">
         Gutscheinwert ${money(voucher.original_amount_cents)}
       </div>`
    : `<div style="margin:0;font-family:${SERIF};font-size:46px;line-height:1;color:${BRAND.white};">
         ${money(voucher.original_amount_cents)}
       </div>`

  const sender = voucher.sender_name
    ? `<td align="right" style="font-family:${SANS};font-size:12px;color:${BRAND.sandLt};">
         Von ${esc(voucher.sender_name)}
       </td>`
    : '<td></td>'

  return `
  <tr>
    <td style="padding:0 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="background-color:${BRAND.warm};border-radius:2px;">
        <tr>
          <td style="padding:30px 30px 34px;">

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-family:${SERIF};font-style:italic;font-size:24px;color:${BRAND.white};">Fem</td>
                <td align="right" style="font-family:${SANS};font-size:10px;letter-spacing:1.5px;color:${BRAND.sandLt};">
                  ${edition}
                </td>
              </tr>
            </table>

            <!-- Haarlinie als 1px-Tabellenzeile: <hr> rendert in Outlook
                 als dicker 3D-Balken und ignoriert die Farbe. -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td height="1" style="height:1px;line-height:1px;font-size:0;
                  background-color:${BRAND.warmLt};padding:0;">&nbsp;</td></tr>
            </table>

            <div style="padding:26px 0 0;font-family:${SANS};font-size:10px;letter-spacing:1.5px;color:${BRAND.sandLt};">
              ${isTreatment ? 'BEHANDLUNGSGUTSCHEIN' : 'WERTGUTSCHEIN'}
            </div>
            <div style="padding:12px 0 22px;">${headline}</div>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-family:${SERIF};font-style:italic;font-size:15px;color:${BRAND.sandPale};">
                  ${voucher.recipient_name ? `Für ${esc(voucher.recipient_name)}` : 'Für einen besonderen Menschen'}
                </td>
                ${sender}
              </tr>
            </table>

          </td>
        </tr>
      </table>
    </td>
  </tr>`
}

function messageBlock(voucher) {
  if (!voucher.message) return ''
  const text = String(voucher.message).trim()
  const quoted = /^[„“"']/.test(text) ? esc(text) : `„${esc(text)}“`
  return `
  <tr>
    <td style="padding:30px 34px 6px;">
      <div style="font-family:${SERIF};font-style:italic;font-size:17px;line-height:1.6;color:${BRAND.warm};">
        ${quoted}
      </div>
    </td>
  </tr>`
}

function codeBlock(voucher) {
  return `
  <tr>
    <td style="padding:26px 24px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="background-color:${BRAND.cream};border-radius:2px;">
        <tr>
          <td align="center" style="padding:24px 20px 26px;">
            <div style="font-family:${SANS};font-size:10px;letter-spacing:1.5px;color:${BRAND.taupe};">
              GUTSCHEINCODE
            </div>
            <!-- Nicht als <code>: einige Clients ersetzen Monospace durch
                 eine eigene Schrift und die Sperrung geht verloren. -->
            <div style="padding-top:10px;font-family:${SANS};font-size:24px;font-weight:bold;
                        letter-spacing:2px;color:${BRAND.warm};white-space:nowrap;">
              ${spacedCode(voucher.code)}
            </div>
            <div style="padding-top:12px;font-family:${SANS};font-size:12px;line-height:1.5;color:${BRAND.warmLt};">
              Im Studio vorzeigen oder bei der Terminvereinbarung nennen.
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>`
}

/** Knopf als Tabelle statt <a> mit Padding — sonst ist in Outlook nur der Text klickbar. */
function button(label, href) {
  return `
  <tr>
    <td align="center" style="padding:30px 24px 6px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center" bgcolor="${BRAND.warm}" style="border-radius:2px;">
            <a href="${esc(href)}"
               style="display:inline-block;padding:15px 34px;font-family:${SANS};font-size:14px;
                      letter-spacing:0.5px;color:${BRAND.white};text-decoration:none;">
              ${esc(label)}
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>`
}

function steps() {
  const items = [
    ['01', 'Termin vereinbaren', 'Online, telefonisch oder direkt im Studio.'],
    ['02', 'Gutschein erwähnen', 'Am besten gleich bei der Buchung.'],
    ['03', 'Genießen', 'Der Betrag wird bei der Behandlung abgezogen.'],
  ]

  const rows = items.map(([num, title, hint]) => `
    <tr>
      <td width="34" valign="top" style="padding:11px 0;font-family:${SERIF};font-size:14px;color:${BRAND.sand};">
        ${num}
      </td>
      <td valign="top" style="padding:11px 0;font-family:${SANS};font-size:13px;line-height:1.5;color:${BRAND.warm};">
        <strong style="font-weight:600;">${title}</strong><br>
        <span style="color:${BRAND.taupe};">${hint}</span>
      </td>
    </tr>`).join('')

  return `
  <tr>
    <td style="padding:30px 34px 0;">
      <div style="font-family:${SANS};font-size:10px;letter-spacing:1.5px;color:${BRAND.taupe};padding-bottom:4px;">
        SO LÖST DU EIN
      </div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
    </td>
  </tr>`
}

function footer(extraLines = []) {
  const extra = extraLines
    .map((line) => `<div style="padding-top:8px;">${line}</div>`)
    .join('')

  return `
  <tr>
    <td style="padding:34px 34px 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td height="1" style="height:1px;line-height:1px;font-size:0;
            background-color:${BRAND.line};padding:0;">&nbsp;</td></tr>
      </table>
      <div style="padding-top:22px;font-family:${SANS};font-size:13px;line-height:1.6;color:${BRAND.warm};">
        <strong style="font-weight:600;">${STUDIO.name}</strong><br>
        ${STUDIO.street} · ${STUDIO.city}<br>
        <a href="tel:${STUDIO.phone.replace(/\s/g, '')}" style="color:${BRAND.sand};text-decoration:none;">${STUDIO.phone}</a>
        &nbsp;·&nbsp;
        <a href="mailto:${STUDIO.email}" style="color:${BRAND.sand};text-decoration:none;">${STUDIO.email}</a>
      </div>
      <div style="padding-top:18px;font-family:${SANS};font-size:11px;line-height:1.6;color:${BRAND.taupe};">
        Teileinlösung möglich, Restbeträge bleiben erhalten. Keine Barauszahlung.
        ${extra}
      </div>
    </td>
  </tr>`
}

/**
 * Rahmen um alles.
 *
 * Der Preheader ist der Text, den Posteingänge neben dem Betreff anzeigen.
 * Ohne ihn nehmen sie die erste Zeile des Inhalts — bei uns also „Fem".
 * Die Leerzeichen dahinter schieben weg, was der Client sonst noch
 * hinterherzieht.
 */
function shell({ title, preheader, body }) {
  return `<!doctype html>
<html lang="de" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${esc(title)}</title>
<style>
  /* Nur Verbesserung, nie Voraussetzung — viele Clients werfen das weg. */
  @media only screen and (max-width:620px) {
    .fem-shell { width:100% !important; }
    .fem-pad   { padding-left:20px !important; padding-right:20px !important; }
    .fem-pad-s { padding-left:12px !important; padding-right:12px !important; }
    .fem-value { font-size:38px !important; }
    .fem-code  { font-size:19px !important; letter-spacing:1px !important; }
  }
  a[x-apple-data-detectors] { color:inherit !important; text-decoration:none !important; }
</style>
</head>
<body style="margin:0;padding:0;width:100%;background-color:${BRAND.paper};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
  ${esc(preheader)}${'&#847;&zwnj;&nbsp;'.repeat(60)}
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background-color:${BRAND.paper};">
  <tr>
    <td align="center" style="padding:28px 12px 48px;">
      <table role="presentation" class="fem-shell" width="600" cellpadding="0" cellspacing="0" border="0"
             style="width:600px;max-width:600px;background-color:${BRAND.white};
                    border:1px solid ${BRAND.line};border-radius:2px;">
        ${body}
      </table>

      <div style="padding-top:20px;font-family:${SANS};font-size:11px;color:${BRAND.taupe};">
        <a href="${STUDIO.site}/impressum" style="color:${BRAND.taupe};">Impressum</a>
        &nbsp;·&nbsp;
        <a href="${STUDIO.site}" style="color:${BRAND.taupe};">fembeauty.at</a>
      </div>
    </td>
  </tr>
</table>
</body>
</html>`
}

function header(kicker) {
  return `
  <tr>
    <td align="center" style="padding:36px 24px 26px;">
      <div style="font-family:${SERIF};font-style:italic;font-size:30px;color:${BRAND.warm};">Fem</div>
      <div style="padding-top:8px;font-family:${SANS};font-size:10px;letter-spacing:2px;color:${BRAND.sand};">
        ${esc(kicker)}
      </div>
    </td>
  </tr>`
}

// ────────────────────────────────────────────────────────────
// Die zwei Mails
// ────────────────────────────────────────────────────────────

function giftEmail(voucher, { bookingUrl }) {
  const from = voucher.sender_name ? esc(voucher.sender_name) : 'jemandem, der dich mag'
  const name = voucher.recipient_name ? esc(voucher.recipient_name) : 'Hallo'

  const body = `
    ${header('BEAUTY & SPA · WIEN')}
    <tr>
      <td align="center" style="padding:0 34px 30px;" class="fem-pad">
        <div style="font-family:${SERIF};font-size:24px;line-height:1.35;color:${BRAND.warm};">
          ${name}, du wurdest beschenkt.
        </div>
        <div style="padding-top:12px;font-family:${SANS};font-size:14px;line-height:1.65;color:${BRAND.warmLt};">
          ${from} schenkt dir eine Auszeit bei FEM.
          Den Gutschein findest du hier und noch einmal als PDF im Anhang.
        </div>
      </td>
    </tr>
    ${voucherCard(voucher)}
    ${messageBlock(voucher)}
    ${codeBlock(voucher)}
    ${button('Termin vereinbaren', bookingUrl)}
    ${steps()}
    ${footer([
      voucher.expires_at
        ? `Einlösbar bis ${longDate(voucher.expires_at)}.`
        : 'Ohne Ablaufdatum.',
    ])}`

  const subject = voucher.sender_name
    ? `${voucher.sender_name} schenkt dir eine Auszeit bei FEM`
    : 'Ein Gutschein für dich von FEM Beauty Wien'

  return {
    subject,
    html: shell({
      title: subject,
      preheader: `Dein Gutschein ${voucher.code} — im Studio vorzeigen oder bei der Buchung nennen.`,
      body,
    }),
    text: giftText(voucher, bookingUrl),
  }
}

function receiptEmail(voucher, { bookingUrl, selfPurchase }) {
  const rate = (voucher.vat_rate_bp ?? 2000) / 10000
  const net = Math.round(voucher.original_amount_cents / (1 + rate))
  const vat = voucher.original_amount_cents - net

  const rows = [
    ['Gutscheinart', voucher.kind === 'treatment' ? 'Behandlungsgutschein' : 'Wertgutschein'],
    voucher.kind === 'treatment' ? ['Behandlung', esc(voucher.treatment_label)] : null,
    ['Für', voucher.recipient_name ? esc(voucher.recipient_name) : 'Dich selbst'],
    ['Gekauft am', longDate(voucher.issued_at)],
    ['Zustellung', voucher.delivery === 'email'
      ? `Per E-Mail an ${esc(voucher.delivery_email)}`
      : 'Als PDF in dieser E-Mail'],
    ['Code', spacedCode(voucher.code)],
  ].filter(Boolean).map(([key, value]) => `
    <tr>
      <td style="padding:9px 0;font-family:${SANS};font-size:13px;color:${BRAND.taupe};">${key}</td>
      <td align="right" style="padding:9px 0;font-family:${SANS};font-size:13px;color:${BRAND.warm};">${value}</td>
    </tr>`).join('')

  const summary = `
  <tr>
    <td style="padding:22px 34px 0;" class="fem-pad">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${rows}
        <tr><td colspan="2" height="1" style="height:1px;line-height:1px;font-size:0;
            background-color:${BRAND.line};padding:0;">&nbsp;</td></tr>
        <tr>
          <td style="padding:16px 0 0;font-family:${SANS};font-size:16px;color:${BRAND.warm};">
            <strong style="font-weight:600;">Bezahlt</strong>
          </td>
          <td align="right" style="padding:16px 0 0;font-family:${SANS};font-size:16px;color:${BRAND.warm};">
            <strong style="font-weight:600;">${money(voucher.original_amount_cents)}</strong>
          </td>
        </tr>
        <tr>
          <td colspan="2" align="right" style="padding:4px 0 0;font-family:${SANS};font-size:11px;color:${BRAND.taupe};">
            enthält ${money(vat)} USt (${(rate * 100).toFixed(0)} %) · netto ${money(net)}
          </td>
        </tr>
      </table>
    </td>
  </tr>`

  // Ist der Gutschein schon an die beschenkte Person unterwegs, wäre der
  // Terminknopf hier falsch — die Käuferin bucht ja nicht.
  const cta = voucher.delivery === 'email' && !selfPurchase
    ? ''
    : button('Termin vereinbaren', bookingUrl)

  const body = `
    ${header('KAUFBESTÄTIGUNG')}
    <tr>
      <td align="center" style="padding:0 34px 30px;" class="fem-pad">
        <div style="font-family:${SERIF};font-size:24px;line-height:1.35;color:${BRAND.warm};">
          Danke für deinen Einkauf.
        </div>
        <div style="padding-top:12px;font-family:${SANS};font-size:14px;line-height:1.65;color:${BRAND.warmLt};">
          ${voucher.delivery === 'email'
            ? `Der Gutschein ist an <strong style="color:${BRAND.warm};">${esc(voucher.delivery_email)}</strong> unterwegs. Eine Kopie liegt dieser E-Mail als PDF bei.`
            : 'Der Gutschein liegt dieser E-Mail als PDF bei — zum Ausdrucken oder Weiterleiten.'}
        </div>
      </td>
    </tr>
    ${voucherCard(voucher)}
    ${summary}
    ${cta}
    ${footer([
      'Diese E-Mail ist deine Kaufbestätigung. Eine Rechnung mit Steuerausweis senden wir auf Anfrage.',
      voucher.expires_at ? `Einlösbar bis ${longDate(voucher.expires_at)}.` : 'Ohne Ablaufdatum.',
    ])}`

  const subject = `Deine FEM Gutschein-Bestätigung · ${voucher.code}`

  return {
    subject,
    html: shell({
      title: subject,
      preheader: `${money(voucher.original_amount_cents)} · ${voucher.code} · PDF im Anhang.`,
      body,
    }),
    text: receiptText(voucher, { net, vat, rate }),
  }
}

// ────────────────────────────────────────────────────────────
// Nur-Text
// ────────────────────────────────────────────────────────────
// Kein Zierrat: diese Fassung liest, wer HTML abgeschaltet hat oder einen
// Screenreader benutzt. Sie muss dieselben Angaben enthalten, nicht
// denselben Ton. Ohne sie steigt außerdem die Spam-Bewertung.

const contactLines = [
  '',
  `${STUDIO.name}`,
  `${STUDIO.street}, ${STUDIO.city}`,
  `${STUDIO.phone} · ${STUDIO.email}`,
  STUDIO.site,
]

function giftText(voucher, bookingUrl) {
  const what = voucher.kind === 'treatment'
    ? `${voucher.treatment_label} (Wert ${money(voucher.original_amount_cents)})`
    : `Wertgutschein über ${money(voucher.original_amount_cents)}`

  // Die Widmung wird eingespreizt statt bedingt eingesetzt. Ein
  // `bedingung ? zeile : ''` müsste hinterher weggefiltert werden — und ein
  // Filter auf leere Zeilen räumt zwangsläufig auch die Leerzeilen weg, die
  // den Text überhaupt erst gliedern.
  return [
    voucher.sender_name
      ? `${voucher.sender_name} schenkt dir eine Auszeit bei FEM.`
      : 'Du hast einen Gutschein für FEM Beauty Wien bekommen.',
    '',
    what,
    ...(voucher.message ? ['', `„${voucher.message}"`] : []),
    '',
    `Gutscheincode: ${voucher.code}`,
    '',
    `Termin vereinbaren: ${bookingUrl}`,
    'Den Code bei der Buchung nennen oder im Studio vorzeigen.',
    'Der Gutschein liegt dieser E-Mail auch als PDF bei.',
    '',
    'Teileinlösung möglich, Restbeträge bleiben erhalten. Keine Barauszahlung.',
    voucher.expires_at ? `Einlösbar bis ${longDate(voucher.expires_at)}.` : 'Ohne Ablaufdatum.',
    ...contactLines,
  ].join('\n')
}

function receiptText(voucher, { net, vat, rate }) {
  return [
    'Danke für deinen Einkauf.',
    '',
    voucher.kind === 'treatment'
      ? `Behandlungsgutschein: ${voucher.treatment_label}`
      : 'Wertgutschein',
    `Betrag: ${money(voucher.original_amount_cents)}`,
    `enthält ${money(vat)} USt (${(rate * 100).toFixed(0)} %), netto ${money(net)}`,
    `Code: ${voucher.code}`,
    `Gekauft am: ${longDate(voucher.issued_at)}`,
    voucher.delivery === 'email'
      ? `Zustellung: per E-Mail an ${voucher.delivery_email}`
      : 'Zustellung: als PDF in dieser E-Mail',
    '',
    'Der Gutschein liegt dieser E-Mail als PDF bei.',
    'Diese E-Mail ist deine Kaufbestätigung.',
    ...contactLines,
  ].join('\n')
}

// ────────────────────────────────────────────────────────────

export const EMAIL_VARIANTS = ['gift', 'receipt']

/**
 * @param {object} voucher   Zeile aus `vouchers`
 * @param {object} options
 * @param {'gift'|'receipt'} options.variant
 * @param {string} options.bookingUrl
 * @returns {{ to: string, subject: string, html: string, text: string }}
 */
export function buildVoucherEmail(voucher, { variant, bookingUrl }) {
  const selfPurchase = Boolean(
    voucher.delivery_email && voucher.buyer_email
    && voucher.delivery_email.toLowerCase() === voucher.buyer_email.toLowerCase(),
  )

  const built = variant === 'gift'
    ? giftEmail(voucher, { bookingUrl })
    : receiptEmail(voucher, { bookingUrl, selfPurchase })

  return {
    to: variant === 'gift' ? voucher.delivery_email : voucher.buyer_email,
    ...built,
  }
}

/**
 * Welche Mails ein Kauf auslöst.
 *
 * Kauft jemand für sich selbst und lässt sich das PDF an dieselbe Adresse
 * schicken, wäre die Geschenkmail eine Dublette im eigenen Posteingang.
 */
export function emailPlan(voucher) {
  const plan = [{ variant: 'receipt', to: voucher.buyer_email }]

  if (voucher.delivery === 'email' && voucher.delivery_email
      && voucher.delivery_email.toLowerCase() !== voucher.buyer_email?.toLowerCase()) {
    plan.unshift({ variant: 'gift', to: voucher.delivery_email })
  }

  return plan
}
