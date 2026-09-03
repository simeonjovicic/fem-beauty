# Gutschein-PDF — zwei Fassungen zur Auswahl

Vier Dateien, zwei Layouts × zwei Gutscheinarten. Zum Ansehen und
Weiterschicken, nicht zum Einlösen.

| Fassung | Kennzeichen |
| --- | --- |
| **A — Karte** | Dunkle Karte als Blickfang, drei Schritte erklären das Einlösen, Code und QR in einem eigenen Feld |
| **B — schlicht** | Keine Karte, alles zentriert, keine Anleitung, Code neben dem QR |

Beide nutzen dieselben Schriften wie die Website (Playfair Display und
Outfit, eingebettet) und dieselbe Wortmarke. Beide stehen auf demselben
Papierton `#fdfbf8`.

## Wozu das hier liegt

Die Entscheidung, welche Fassung bleibt, steht noch aus. Sobald sie
gefallen ist, kann dieser Ordner weg — die Dateien lassen sich jederzeit
neu erzeugen:

```
# Fassung A
/api/voucher/<token>/pdf

# Fassung B
/api/voucher/<token>/pdf?variante=simple
```

Der Parameter `?variante=simple` existiert nur für diese Auswahl und
fällt mit der Entscheidung ebenfalls weg.

## Zu den QR-Codes

Sie zeigen auf `https://fembeauty.at/v/…` und sind mit einem Decoder
geprüft (lesbar von 72 bis 300 dpi). Das Ziel gibt es aber noch nicht —
der Worker ist nicht deployed. Die Codes sind also echt aufgebaut, führen
derzeit jedoch ins Leere.

Die Gutscheindaten stammen aus lokalen Testkäufen. **Keine echten
Kundendaten**, und die Codes gehören zu keinem gültigen Gutschein.
