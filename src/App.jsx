import { Suspense, lazy } from 'react'
import HomePage from './HomePage'

// Alle drei HTML-Einstiegspunkte laden dasselbe main.jsx. Statisch importiert
// laege damit auch der Gutschein-Konfigurator im Bundle der Startseite, obwohl
// ihn die meisten Besucher nie oeffnen. Per lazy() bekommt jede Unterseite
// einen eigenen Chunk, der erst beim Aufruf geladen wird.
const ImpressumPage = lazy(() => import('./ImpressumPage'))
const GutscheinePage = lazy(() => import('./GutscheinePage'))

export default function App() {
  const { pathname } = window.location

  if (pathname.endsWith('/impressum.html')) {
    return <Suspense fallback={null}><ImpressumPage /></Suspense>
  }

  if (pathname.endsWith('/gutscheine.html')) {
    return <Suspense fallback={null}><GutscheinePage /></Suspense>
  }

  return <HomePage />
}
