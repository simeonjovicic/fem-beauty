import HomePage from './HomePage'
import ImpressumPage from './ImpressumPage'

export default function App() {
  const isImpressum = window.location.pathname.endsWith('/impressum.html')
  return isImpressum ? <ImpressumPage /> : <HomePage />
}
