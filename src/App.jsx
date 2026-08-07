import { Suspense, lazy } from 'react'
import HomePage from './HomePage'

// Alle vier HTML-Einstiegspunkte laden dasselbe main.jsx. Statisch importiert
// laege damit auch der Gutschein-Konfigurator im Bundle der Startseite, obwohl
// ihn die meisten Besucher nie oeffnen. Per lazy() bekommt jede Unterseite
// einen eigenen Chunk, der erst beim Aufruf geladen wird.
const ImpressumPage = lazy(() => import('./ImpressumPage'))
const GutscheinePage = lazy(() => import('./GutscheinePage'))
const DankePage = lazy(() => import('./DankePage'))

const PAGES = {
  impressum: ImpressumPage,
  gutscheine: GutscheinePage,
  danke: DankePage,
}

// Ohne Endung abgleichen: Cloudflare Pages leitet /seite.html per 308 auf
// /seite um. Ein Abgleich auf ".html" schlug danach fehl, und die App zeigte
// die Startseite, obwohl der Server die richtige Datei ausgeliefert hatte.
// Deckt /gutscheine.html, /gutscheine und /gutscheine/ gleichermassen ab.
export default function App() {
  const slug = window.location.pathname
    .replace(/\/+$/, '')
    .split('/')
    .pop()
    .replace(/\.html$/, '')

  const Page = PAGES[slug]
  if (!Page) return <HomePage />

  return <Suspense fallback={null}><Page /></Suspense>
}
