// Erzeugung und Prüfung der beiden Gutschein-Identifikatoren.
//
// `code`  — wird an der Kassa abgetippt oder vorgelesen. Kurz, ohne
//           verwechselbare Zeichen, mit Prüfzeichen. Beispiel: FEM-4K7TQ-9RM2X
// `token` — steckt in der QR-URL. Lang und zufällig; der kurze Code darf
//           dort nie stehen, weil er zu kurz ist, um Raten standzuhalten.
//
// Beide Funktionen nehmen die Zufallsbytes als Argument entgegen, statt
// selbst crypto aufzurufen. Das macht sie deterministisch testbar und
// funktioniert in Workers wie in Node gleichermaßen.

// Crockford-Base32: ohne I, L, O und U — die vier Zeichen, die beim
// Abtippen und Vorlesen die Fehler produzieren.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

const PREFIX = 'FEM'
const DATA_SYMBOLS = 9
const TOTAL_SYMBOLS = DATA_SYMBOLS + 1 // + Prüfzeichen

// Crockford erlaubt beim Lesen Verwechslungen aufzulösen.
const ALIASES = { I: '1', L: '1', O: '0' }

// Crockford rechnet die Prüfsumme modulo 37. Der Wert ist entscheidend:
// 37 ist prim, deshalb wird *jeder* Ein-Zeichen-Fehler und *jede*
// Vertauschung erkannt. Modulo 32 kann das nicht — bei geraden Gewichten
// heben sich Differenzen von 16 gegen den Modulus auf und rutschen durch.
const CHECK_MODULUS = 37

/**
 * Gewichtete Prüfsumme über die Symbolwerte, modulo 37.
 *
 * Die Positionsgewichtung fängt zusätzlich Vertauschungen ab ("4K7" vs
 * "K47"), die eine einfache Quersumme durchlassen würde.
 */
function checkValue(values) {
  let sum = 0
  for (let i = 0; i < values.length; i += 1) sum += values[i] * (i + 1)
  return sum % CHECK_MODULUS
}

/**
 * Bringt Nutzereingaben auf die kanonische Form: Großbuchstaben, ohne
 * Trenner, mit aufgelösten Verwechslungen. Gibt null, wenn ein Zeichen
 * nicht ins Alphabet gehört.
 */
export function normalizeCode(input) {
  if (typeof input !== 'string') return null

  const raw = input.toUpperCase().replace(/[\s\-_.]/g, '')
  const body = raw.startsWith(PREFIX) ? raw.slice(PREFIX.length) : raw

  let out = ''
  for (const char of body) {
    const mapped = ALIASES[char] ?? char
    if (!ALPHABET.includes(mapped)) return null
    out += mapped
  }
  return out
}

/** Fügt die Gruppierung für die Anzeige hinzu: FEM-XXXXX-XXXXX */
export function formatCode(symbols) {
  return `${PREFIX}-${symbols.slice(0, 5)}-${symbols.slice(5)}`
}

/**
 * Erzeugt einen Code aus 9 Zufallsbytes — oder null.
 *
 * 256 ist durch 32 teilbar, `byte % 32` ist also gleichverteilt: kein
 * Modulo-Bias bei den Datenzeichen.
 *
 * null kommt zurück, wenn die Prüfsumme in den Bereich 32..36 fällt, für
 * den Crockford die Sonderzeichen *~$=U vorsieht. Statt die auf einen
 * gedruckten Gutschein zu lassen, wird neu gewürfelt — das kostet rund
 * 13 % der Versuche und behält die Stärke des Primmodulus bei einem
 * Alphabet, das man sauber vorlesen kann. Siehe createCode.
 */
export function generateCode(randomBytes) {
  if (!randomBytes || randomBytes.length < DATA_SYMBOLS) {
    throw new Error(`generateCode braucht mindestens ${DATA_SYMBOLS} Bytes`)
  }

  const values = []
  for (let i = 0; i < DATA_SYMBOLS; i += 1) values.push(randomBytes[i] % ALPHABET.length)

  const check = checkValue(values)
  if (check >= ALPHABET.length) return null

  return formatCode(values.map((v) => ALPHABET[v]).join('') + ALPHABET[check])
}

/**
 * Würfelt so lange, bis ein Code ohne Sonderzeichen herauskommt.
 *
 * @param {(length: number) => Uint8Array} getRandomBytes
 *        In Workers und Node: (n) => crypto.getRandomValues(new Uint8Array(n))
 */
export function createCode(getRandomBytes, maxAttempts = 20) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = generateCode(getRandomBytes(DATA_SYMBOLS))
    if (code !== null) return code
  }
  // Bei sauberer Zufallsquelle ist das ~13%^20, also praktisch unmöglich.
  throw new Error('createCode: keine gültige Prüfsumme nach mehreren Versuchen')
}

/**
 * Prüft eine Eingabe und gibt die kanonische Form zurück.
 * Fängt Tippfehler ab, bevor die Datenbank überhaupt gefragt wird.
 *
 * @returns {{ ok: true, code: string, display: string }
 *         | { ok: false, reason: 'malformed' | 'length' | 'checksum' }}
 */
export function parseCode(input) {
  const normalized = normalizeCode(input)
  if (normalized === null) return { ok: false, reason: 'malformed' }
  if (normalized.length !== TOTAL_SYMBOLS) return { ok: false, reason: 'length' }

  const values = [...normalized.slice(0, DATA_SYMBOLS)].map((c) => ALPHABET.indexOf(c))
  const check = checkValue(values)
  // Fällt die erwartete Prüfsumme in den Sonderzeichenbereich, kann kein
  // gültiger Code vorliegen — createCode erzeugt solche gar nicht erst.
  if (check >= ALPHABET.length || ALPHABET[check] !== normalized[DATA_SYMBOLS]) {
    return { ok: false, reason: 'checksum' }
  }

  return { ok: true, code: normalized, display: formatCode(normalized) }
}

const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

/**
 * QR-Token aus 24 Zufallsbytes (192 Bit) → 32 Zeichen base64url,
 * ohne Padding. Eigene Implementierung statt btoa, damit der Code in
 * Workers und Node identisch läuft.
 */
export function generateToken(randomBytes) {
  if (!randomBytes || randomBytes.length < 24) {
    throw new Error('generateToken braucht mindestens 24 Bytes')
  }

  let out = ''
  for (let i = 0; i < 24; i += 3) {
    const chunk = (randomBytes[i] << 16) | (randomBytes[i + 1] << 8) | randomBytes[i + 2]
    out += B64URL[(chunk >> 18) & 63] + B64URL[(chunk >> 12) & 63]
      + B64URL[(chunk >> 6) & 63] + B64URL[chunk & 63]
  }
  return out
}
