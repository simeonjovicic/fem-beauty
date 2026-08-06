import { Suspense, lazy } from 'react'
import HomePage from './HomePage'

// Alle vier HTML-Einstiegspunkte laden dasselbe main.jsx. Statisch importiert
// laege damit auch der Gutschein-Konfigurator im Bundle der Startseite, obwohl
// ihn die meisten Besucher nie oeffnen. Per lazy() bekommt jede Unterseite
// einen eigenen Chunk, der erst beim Aufruf geladen wird.
const ImpressumPage = lazy(() => import('./ImpressumPage'))
const GutscheinePage = lazy(() => import('./GutscheinePage'))
const DankePage = lazy(() => import('./DankePage'))

const PAGES = [
  ['/impressum.html', ImpressumPage],
  ['/gutscheine.html', GutscheinePage],
  ['/danke.html', DankePage],
]

export default function App() {
  const { pathname } = window.location
  const match = PAGES.find(([suffix]) => pathname.endsWith(suffix))
  if (!match) return <HomePage />

  const Page = match[1]
  return <Suspense fallback={null}><Page /></Suspense>
}
