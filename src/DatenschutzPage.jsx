import { Footer, Header } from './components/Chrome'

// Beschreibt, was die Seite tatsaechlich tut — nicht, was eine Vorlage
// vermutet. Jeder Abschnitt hier hat eine Entsprechung im Code:
//
//   Gutscheinkauf   worker/src/checkout.js, vouchers.js, schema.sql
//   Zahlung         Stripe, worker/src/checkout.js
//   E-Mail          Resend, worker/src/mailer.js
//   Schriften       index.html und die anderen Einstiegspunkte
//   Karte           HomePage.jsx, der Google-Maps-iframe
//
// Aendert sich einer dieser Punkte, gehoert der Abschnitt mitgeaendert.

export default function DatenschutzPage() {
  return (
    <>
      <Header />
      <main>
        <section className="imp-hero">
          <span className="tag">Rechtliches</span>
          <h1>Datenschutz</h1>
          <div className="line" />
        </section>

        <section className="imp-content">
          <p>
            Diese Erklärung beschreibt, welche personenbezogenen Daten beim Besuch
            dieser Website und beim Kauf eines Gutscheins verarbeitet werden.
            Grundlage ist die Datenschutz-Grundverordnung (DSGVO).
          </p>

          <h2>Verantwortliche</h2>
          <p>
            <strong>FEM Beauty</strong><br />
            Zhenyi Cai<br />
            Ramperstorffergasse 51<br />
            1050 Wien, Österreich<br />
            <a href="mailto:beauty@fembeauty.at">beauty@fembeauty.at</a><br />
            <a href="tel:+436608866068">+43 660 886 60 68</a>
          </p>

          <h2>Aufruf der Website</h2>
          <p>
            Die Website wird über Cloudflare bereitgestellt. Beim Aufruf verarbeitet
            Cloudflare technisch notwendige Verbindungsdaten wie IP-Adresse,
            Zeitpunkt, aufgerufene Adresse und Browserkennung, um die Seite
            auszuliefern und vor Angriffen zu schützen.
          </p>
          <p>
            Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO — unser berechtigtes
            Interesse an einem sicheren und funktionierenden Betrieb. Mit Cloudflare
            besteht ein Auftragsverarbeitungsvertrag.
          </p>

          <h2>Gutscheinkauf</h2>
          <p>
            Beim Kauf eines Gutscheins werden die Angaben gespeichert, die für
            Ausstellung und spätere Einlösung nötig sind:
          </p>
          <ul>
            <li>Name der beschenkten Person</li>
            <li>Name der schenkenden Person, sofern angegeben</li>
            <li>persönliche Nachricht, sofern angegeben</li>
            <li>E-Mail-Adresse der Käuferin und, bei Zustellung per E-Mail, der
              beschenkten Person</li>
            <li>Betrag, Gutscheincode, Kaufzeitpunkt und die Zahlungsreferenz</li>
          </ul>
          <p>
            Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO — die Daten sind zur
            Erfüllung des Kaufvertrags erforderlich. Wird der Gutschein später im
            Salon eingelöst, wird zusätzlich festgehalten, wann, in welcher Höhe und
            durch wen. Das ist zur Abrechnung erforderlich und nachvollziehbar, wenn
            es Rückfragen zum Guthaben gibt.
          </p>
          <p>
            Die Daten werden in einer Datenbank innerhalb der Europäischen Union
            gespeichert (Cloudflare D1, Region Osteuropa).
          </p>

          <h2>Zahlung</h2>
          <p>
            Die Zahlung wickelt <strong>Stripe Payments Europe, Ltd.</strong>, Dublin,
            Irland ab. Beim Bezahlen wechseln Sie auf eine Seite von Stripe.
            Zahlungsdaten wie Kartennummern werden ausschließlich dort verarbeitet
            und erreichen uns zu keinem Zeitpunkt. Wir erhalten von Stripe die
            Bestätigung, dass bezahlt wurde, den Betrag und die E-Mail-Adresse.
          </p>
          <p>
            Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO. Einzelheiten unter{' '}
            <a href="https://stripe.com/at/privacy" target="_blank" rel="noopener noreferrer">
              stripe.com/at/privacy
            </a>.
          </p>

          <h2>E-Mail-Versand</h2>
          <p>
            Gutschein und Kaufbestätigung versenden wir über{' '}
            <strong>Resend</strong> (Plus Five Five, Inc.). Für den Versand werden
            die E-Mail-Adresse und der Inhalt der Nachricht samt Gutschein-PDF
            übermittelt. Der Versand erfolgt über Server in der Europäischen Union
            (Region Irland).
          </p>
          <p>
            Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO. Wir setzen keine
            Öffnungs- oder Klickmessung ein.
          </p>

          <h2>Schriftarten</h2>
          <p>
            Diese Website lädt Schriftarten von Google Fonts (Google Ireland
            Limited). Dabei wird Ihre IP-Adresse an Google übertragen.
            Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO — unser berechtigtes
            Interesse an einer einheitlichen Darstellung.
          </p>

          <h2>Karte</h2>
          <p>
            Auf der Startseite ist eine Karte von Google Maps (Google Ireland
            Limited) eingebunden. Beim Laden der Seite wird Ihre IP-Adresse an
            Google übertragen, und Google kann Cookies setzen. Rechtsgrundlage ist
            Art. 6 Abs. 1 lit. f DSGVO. Einzelheiten unter{' '}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
              policies.google.com/privacy
            </a>.
          </p>

          <h2>Terminbuchung</h2>
          <p>
            Für Terminbuchungen verlinken wir auf Treatwell. Dort gelten die
            Datenschutzbestimmungen des Anbieters; wir erhalten keine Buchungsdaten
            über diese Website.
          </p>

          <h2>Speicherdauer</h2>
          <p>
            Gutscheindaten bewahren wir auf, solange der Gutschein einlösbar ist,
            und darüber hinaus so lange, wie es steuer- und handelsrechtliche
            Aufbewahrungsfristen verlangen — in Österreich sieben Jahre nach Ablauf
            des Kalenderjahres, in dem der Kauf stattfand.
          </p>

          <h2>Ihre Rechte</h2>
          <p>
            Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung
            der Verarbeitung, Datenübertragbarkeit und Widerspruch. Wenden Sie sich
            dafür an <a href="mailto:beauty@fembeauty.at">beauty@fembeauty.at</a>.
          </p>
          <p>
            Wenn Sie glauben, dass die Verarbeitung Ihrer Daten gegen das
            Datenschutzrecht verstößt, können Sie sich bei der österreichischen
            Datenschutzbehörde beschweren:{' '}
            <a href="https://www.dsb.gv.at" target="_blank" rel="noopener noreferrer">
              dsb.gv.at
            </a>.
          </p>

          <h2>Stand</h2>
          <p>
            Diese Erklärung wird angepasst, wenn sich die beschriebenen Vorgänge
            ändern.
          </p>

          <a href="/" className="imp-back">← Zurück zur Startseite</a>
        </section>
      </main>
      <Footer />
    </>
  )
}
