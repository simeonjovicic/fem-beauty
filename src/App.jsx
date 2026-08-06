import DankePage from './DankePage'
import HomePage from './HomePage'
import ImpressumPage from './ImpressumPage'

const PAGES = [
  ['/impressum.html', ImpressumPage],
  ['/danke.html', DankePage],
]

export default function App() {
  const { pathname } = window.location
  const match = PAGES.find(([suffix]) => pathname.endsWith(suffix))
  const Page = match ? match[1] : HomePage
  return <Page />
}
