import { Footer, Header } from './components/Chrome'

export default function ImpressumPage() {
  return (
    <>
      <Header />
      <main>
        <section className="imp-hero">
          <span className="tag">Rechtliches</span>
          <h1>Impressum</h1>
          <div className="line" />
        </section>

        <section className="imp-content">
          <h2>Medieninhaber & Betreiberin</h2>
          <p><strong>FEM Beauty</strong><br />Zhenyi Cai<br />Ramperstorffergasse 51<br />1050 Wien, Österreich</p>

          <h2>Kontakt</h2>
          <p>
            Telefon: <a href="tel:+436608866068">+43 660 886 60 68</a><br />
            E-Mail: <a href="mailto:beauty@fembeauty.at">beauty@fembeauty.at</a><br />
            Instagram: <a href="https://instagram.com/fem.vienna" target="_blank" rel="noopener noreferrer">@fem.vienna</a>
          </p>

          <h2>Unternehmensgegenstand</h2>
          <p>Kosmetikdienstleistungen — Gesichtsbehandlungen, japanische Head Spa, Maniküre, Pediküre, Waxing, Laser-Haarentfernung, Wimpernlifting & Augenbrauen-Styling.</p>

          <h2>Gewerberechtliche Angaben</h2>
          <p>
            Gewerbeberechtigung: Kosmetik (Schönheitspflege)<br />
            Gewerbebehörde: Magistratisches Bezirksamt für den 5. Bezirk, Wien<br />
            Anwendbare Gewerbeordnung: <a href="https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10007517" target="_blank" rel="noopener noreferrer">Gewerbeordnung 1994 (GewO)</a><br />
            Mitglied der: Wirtschaftskammer Wien, Landesinnung der Fußpfleger, Kosmetiker und Masseure
          </p>

          <h2>UID-Nummer</h2>
          <p>ATU79243846</p>

          <h2>Informationspflicht laut § 5 ECG</h2>
          <p>Angaben gemäß § 5 E-Commerce-Gesetz (ECG), § 14 Unternehmensgesetzbuch (UGB) und § 25 Mediengesetz (MedienG).</p>

          <h2>Online-Streitbeilegung</h2>
          <p>Verbraucher haben die Möglichkeit, Beschwerden an die Online-Streitbeilegungsplattform der EU zu richten: <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer">ec.europa.eu/consumers/odr</a>.</p>
          <p>Wir sind bemüht, allfällige Meinungsverschiedenheiten im direkten Gespräch zu lösen. Sie erreichen uns unter <a href="mailto:beauty@fembeauty.at">beauty@fembeauty.at</a>.</p>

          <h2>Haftungshinweis</h2>
          <p>Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für die Inhalte externer Links. Für den Inhalt verlinkter Seiten sind ausschließlich deren Betreiber verantwortlich. Alle Texte, Bilder und Grafiken auf dieser Website unterliegen dem Urheberrecht. Eine Vervielfältigung oder Verwendung bedarf der ausdrücklichen Zustimmung der Betreiberin.</p>

          <h2>Urheberrecht</h2>
          <p>Die Inhalte dieser Website — insbesondere Texte, Bilder, Fotos und Grafiken — sind urheberrechtlich geschützt. Das Urheberrecht liegt, soweit nicht ausdrücklich anders gekennzeichnet, bei FEM Beauty / Zhenyi Cai. Jede Vervielfältigung, Bearbeitung oder Verbreitung bedarf der schriftlichen Zustimmung.</p>

          <h2>Bildnachweis</h2>
          <p>Alle Fotos auf dieser Website sind Eigentum von FEM Beauty Wien oder wurden mit Zustimmung der abgebildeten Personen veröffentlicht.</p>

          <a href="/" className="imp-back">← Zurück zur Startseite</a>
        </section>
      </main>
      <Footer />
    </>
  )
}
