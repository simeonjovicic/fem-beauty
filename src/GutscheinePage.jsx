import { Footer, Header } from './components/Chrome'
import VoucherShop from './components/VoucherShop'

// Eigene Seite statt Sektion auf der Startseite: der Gutschein ist das
// einzige Angebot, nach dem gezielt gesucht und das direkt verlinkt wird
// (Flyer, QR, Weihnachtspost). Dafuer braucht es eine eigene URL.
export default function GutscheinePage() {
  return (
    <>
      <Header />
      <main>
        {/* Traegt das h1 der Seite — VoucherShop selbst beginnt mit h2. */}
        <section className="gutscheine-hero">
          <span className="tag">FEM Gutscheine</span>
          <h1>Zeit verschenken.</h1>
          <div className="line" />
          <p>
            Ein Wertgutschein zur freien Auswahl oder eine ganz bestimmte
            Behandlung — persönlich gestaltet und sofort digital bereit.
          </p>
        </section>

        <VoucherShop />
      </main>
      <Footer />
    </>
  )
}
