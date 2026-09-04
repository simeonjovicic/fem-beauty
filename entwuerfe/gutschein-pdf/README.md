# Gutschein-PDF — aktueller Stand

Zwei Dateien, je eine pro Gutscheinart. Zum Ansehen und Weiterschicken,
nicht zum Einlösen.

Schriften wie auf der Website (Playfair Display und Outfit, eingebettet),
die echte Wortmarke, Papierton `#fdfbf8`. Der Kartengrund ist `#7d6f64` —
aufgehelltes `--warm`, kein anderer Braunton: der Sandton der Wortmarke
sitzt direkt darauf und würde auf einem anderen Ton nicht mehr passen.

Auf dem helleren Grund trägt `--sand-lt` die kleinen Labels nicht mehr
(2,9:1 bei 7 Punkt). Sie stehen deshalb in gebrochenem Weiß `#f6f2ed` —
4,4:1. Den Sandcharakter tragen weiterhin Wortmarke, Trennlinie und der
Akzentstrich.

## Neu erzeugen

```
/api/voucher/<token>/pdf
```

Das QR-Ziel kommt aus `PUBLIC_SITE_URL`, nicht aus der aufgerufenen
Adresse — sonst trüge ein PDF aus der lokalen Entwicklung dauerhaft
`localhost`, und ein gedruckter Gutschein lässt sich nicht nachträglich
korrigieren.

## Zu den QR-Codes

Sie zeigen auf `https://fembeauty.at/v/…` und sind mit einem Decoder
geprüft, lesbar ab 72 dpi. Das Ziel existiert aber noch nicht — der Worker
ist nicht deployed.

Die Gutscheindaten stammen aus lokalen Testkäufen. **Keine echten
Kundendaten**, und die Codes gehören zu keinem gültigen Gutschein.
