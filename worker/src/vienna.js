// Kalendergrenzen in Wiener Zeit.
//
// Workers laufen in UTC, das Studio nicht. Ein Monat im Export und ein
// Aktionszeitraum beginnen beide um Mitternacht in Wien — im Winter eine,
// im Sommer zwei Stunden vor Mitternacht UTC. Diese Rechnung steht hier
// einmal, statt in jedem Modul neu.

export const ZONE = 'Europe/Vienna'

const PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONE,
  hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
})

/** Verschiebung Wiens gegenueber UTC zu einem Zeitpunkt, in Millisekunden. */
function zoneOffset(ms) {
  const parts = {}
  for (const part of PARTS.formatToParts(new Date(ms))) parts[part.type] = part.value
  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  )
  return asUtc - ms
}

/**
 * Der Augenblick, in dem in Wien ein bestimmter Tag beginnt, als ISO in UTC.
 *
 * Zweimal gerechnet, weil die Verschiebung selbst vom Zeitpunkt abhaengt:
 * die erste Naeherung kann noch in der falschen Haelfte der Zeitumstellung
 * liegen, die zweite korrigiert sie. Ein dritter Durchgang aendert nichts.
 *
 * Ein Tag jenseits des Monatsendes rollt weiter wie bei Date.UTC — der
 * 31. November ist der 1. Dezember. Das nutzt das Ende eines Zeitraums,
 * das als "Beginn des Folgetags" gerechnet wird.
 */
export function startOfDay(year, month, day) {
  const naiv = Date.UTC(year, month - 1, day)
  const einmal = naiv - zoneOffset(naiv)
  return new Date(naiv - zoneOffset(einmal)).toISOString()
}
