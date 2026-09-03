// Bytes → base64.
//
// Eigene Datei, nicht im mailer: der laedt ueber pdf.js die Schriftdateien
// nach, die nur der Worker-Bundler versteht. Ein Test, der diesen Helfer
// pruefen will, koennte den mailer deshalb gar nicht erst importieren.
//
// Ohne Buffer, den es in Workers nicht gibt.

export function toBase64(bytes) {
  let binary = ''
  // In Bloecken, weil String.fromCharCode(...) bei einigen zehntausend
  // Argumenten den Aufrufstapel sprengt — ein Gutschein-PDF liegt bei
  // rund 60 kB und damit deutlich darueber.
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}
