import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Im Betrieb liefert ein einziger Cloudflare Worker beides aus: die
// gebauten Seiten als statische Dateien und /api/* aus seinem Code. Die
// Aufrufe sind dort also gleichursprünglich.
//
// Lokal lief das auseinander — Seite auf 8000, Worker auf 8787 —, und
// genau daran ist die Vorschau gescheitert: der gebaute Stand setzt
// API_BASE auf leer, der Aufruf ging an den Vorschauserver und lief in
// ein 404. Statt API_BASE weiter mit Sonderfällen zu füttern, stellt der
// Durchreicher lokal dieselbe Lage her wie in der Produktion.
//
// Nebeneffekt: CORS wird lokal gar nicht mehr gebraucht. Die Kopfzeilen
// im Worker bleiben trotzdem — sie kosten nichts und fangen den Fall ab,
// dass jemand doch einmal direkt auf 8787 zugreift.
const apiProxy = {
  '/api': {
    target: 'http://localhost:8787',
    changeOrigin: true,
  },
  // Ziel des QR-Codes: leitet auf /admin weiter.
  '/v': {
    target: 'http://localhost:8787',
    changeOrigin: true,
  },
}

export default defineConfig({
  plugins: [react()],
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        impressum: fileURLToPath(new URL('./impressum.html', import.meta.url)),
        gutscheine: fileURLToPath(new URL('./gutscheine.html', import.meta.url)),
        danke: fileURLToPath(new URL('./danke.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin.html', import.meta.url)),
      },
    },
  },
})
