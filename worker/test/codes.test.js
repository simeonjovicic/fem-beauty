import assert from 'node:assert/strict'
import test from 'node:test'
import { createCode, generateCode, generateToken, normalizeCode, parseCode } from '../src/codes.js'

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** Deterministische Bytefolge statt echtem Zufall. */
function bytes(...values) {
  return Uint8Array.from(values)
}

function anyValidCode(seed = 1) {
  let n = seed
  return createCode((length) => {
    const out = new Uint8Array(length)
    for (let i = 0; i < length; i += 1) {
      n = (n * 1103515245 + 12345) & 0x7fffffff
      out[i] = (n >>> 16) & 0xff
    }
    return out
  })
}

test('generateCode liefert das Anzeigeformat', () => {
  const code = generateCode(bytes(0, 1, 2, 3, 4, 5, 6, 7, 8))
  assert.match(code, /^FEM-[0-9A-Z]{5}-[0-9A-Z]{5}$/)
})

test('erzeugte Codes überstehen parseCode', () => {
  for (let seed = 1; seed <= 200; seed += 1) {
    const code = anyValidCode(seed)
    const parsed = parseCode(code)
    assert.equal(parsed.ok, true, `${code} sollte gültig sein`)
    assert.equal(parsed.display, code)
  }
})

test('createCode umgeht die Crockford-Sonderzeichen', () => {
  for (let seed = 1; seed <= 300; seed += 1) {
    const code = anyValidCode(seed).replace(/^FEM-/, '').replace('-', '')
    for (const char of code) {
      assert.ok(ALPHABET.includes(char), `${char} gehört nicht ins Alphabet`)
    }
  }
})

test('generateCode meldet null statt ein Sonderzeichen zu drucken', () => {
  // Symbolwerte 31 und 1 auf den Gewichten 1 und 2: 31*1 + 1*2 = 33,
  // und 33 liegt im Crockford-Sonderzeichenbereich (32..36).
  assert.equal(generateCode(bytes(31, 1, 0, 0, 0, 0, 0, 0, 0)), null)
  // Gegenprobe: 31*1 + 0*2 = 31 ist noch im Alphabet.
  assert.equal(generateCode(bytes(31, 0, 0, 0, 0, 0, 0, 0, 0)), 'FEM-Z0000-0000Z')
})

test('normalizeCode löst Verwechslungen und Trenner auf', () => {
  const canonical = normalizeCode('FEM-4K7TQ-9RM2X')
  assert.equal(normalizeCode('fem 4k7tq 9rm2x'), canonical)
  assert.equal(normalizeCode('4K7TQ9RM2X'), canonical)
  // O→0, I→1, L→1
  assert.equal(normalizeCode('O1I'), '011')
  assert.equal(normalizeCode('LOL'), '101')
})

test('normalizeCode weist Zeichen außerhalb des Alphabets ab', () => {
  assert.equal(normalizeCode('FEM-4K7TQ-9RM2!'), null)
  // U ist bei Crockford bewusst nicht vergeben.
  assert.equal(normalizeCode('UUUUUUUUUU'), null)
  assert.equal(normalizeCode(null), null)
  assert.equal(normalizeCode(42), null)
})

test('parseCode unterscheidet Fehlerarten', () => {
  assert.equal(parseCode('FEM-4K7TQ-9RM2').reason, 'length')
  assert.equal(parseCode('FEM-4K7TQ-9RM2XY').reason, 'length')
  assert.equal(parseCode('FEM-4K7TQ-9RM2$').reason, 'malformed')
})

test('jeder Ein-Zeichen-Fehler wird erkannt', () => {
  // Das ist der Grund für Modulo 37: bei einem Primmodulus rutscht keine
  // einzelne Zeichenverwechslung durch. Hier vollständig durchgeprüft.
  let checked = 0
  for (let seed = 1; seed <= 25; seed += 1) {
    const symbols = anyValidCode(seed).replace(/^FEM-/, '').replace('-', '')
    for (let pos = 0; pos < symbols.length; pos += 1) {
      for (const replacement of ALPHABET) {
        if (replacement === symbols[pos]) continue
        const mutated = symbols.slice(0, pos) + replacement + symbols.slice(pos + 1)
        assert.equal(parseCode(mutated).ok, false, `${symbols} → ${mutated} nicht erkannt`)
        checked += 1
      }
    }
  }
  assert.equal(checked, 25 * 10 * 31)
})

test('jede Vertauschung zweier Zeichen wird erkannt', () => {
  let checked = 0
  for (let seed = 1; seed <= 25; seed += 1) {
    const symbols = anyValidCode(seed).replace(/^FEM-/, '').replace('-', '')
    for (let i = 0; i < symbols.length; i += 1) {
      for (let j = i + 1; j < symbols.length; j += 1) {
        if (symbols[i] === symbols[j]) continue
        const chars = [...symbols]
        ;[chars[i], chars[j]] = [chars[j], chars[i]]
        assert.equal(parseCode(chars.join('')).ok, false, `${symbols}: ${i}<->${j} nicht erkannt`)
        checked += 1
      }
    }
  }
  assert.ok(checked > 500, `zu wenige Fälle geprüft: ${checked}`)
})

test('generateToken liefert 32 Zeichen base64url', () => {
  const token = generateToken(new Uint8Array(24).fill(0))
  assert.equal(token.length, 32)
  assert.match(token, /^[A-Za-z0-9_-]{32}$/)
})

test('generateToken bildet unterschiedliche Eingaben unterschiedlich ab', () => {
  const a = generateToken(Uint8Array.from({ length: 24 }, (_, i) => i))
  const b = generateToken(Uint8Array.from({ length: 24 }, (_, i) => i + 1))
  assert.notEqual(a, b)
  assert.match(a, /^[A-Za-z0-9_-]{32}$/)
})

test('zu wenig Zufallsmaterial ist ein Fehler, kein schwacher Code', () => {
  assert.throws(() => generateCode(bytes(1, 2, 3)), /mindestens 9 Bytes/)
  assert.throws(() => generateToken(new Uint8Array(8)), /mindestens 24 Bytes/)
})
