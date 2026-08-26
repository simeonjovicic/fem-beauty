# Schriften für das Gutschein-PDF

Playfair Display und Outfit — dieselben Schriften, die auch die Website
verwendet. Sie liegen hier als TTF, weil das PDF zur Laufzeit im Worker
entsteht und dabei nichts nachladen kann.

Statische Schnitte, keine variablen: pdf-lib bettet bei einer variablen
Schrift die Standardinstanz ein, und die ist bei Outfit *Thin* — auf einem
Gutschein kaum lesbar.

Bezogen über die Google-Fonts-CSS-API mit einer Android-4-Kennung; nur die
liefert TrueType statt WOFF2 (das fontkit nicht lesen kann) oder EOT.

Beide stehen unter der SIL Open Font License 1.1, siehe OFL.txt.
