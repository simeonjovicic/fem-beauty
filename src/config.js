// Nur für den Browser. Diese Datei darf der Worker nicht importieren.
//
// data.js wird von beiden Seiten gelesen — vom Vite-Build und von
// worker/src/catalog.js — und muss deshalb umgebungsneutral bleiben.
// import.meta.env gibt es nur in Vite; in workerd ist es undefined und
// hat den Worker beim Start umgebracht, als es dort stand.

// Leer, und zwar überall: im Betrieb liefert ein einziger Worker Seite
// und API aus, lokal reicht Vite /api/* an den Worker durch (siehe
// vite.config.js). Damit ist der Pfad immer relativ und es gibt keinen
// Unterschied mehr zwischen Entwicklung, Vorschau und Produktion.
//
// Vorher stand hier eine Fallunterscheidung auf import.meta.env.DEV. Sie
// funktionierte im Dev-Server und brach in der Vorschau: dort ist DEV
// false, der Aufruf ging an den Vorschauserver und lief in ein 404.
export const API_BASE = ''

// Stripe-Gebühren für EWR-Karten, nur zur Anzeige im Panel. Der tatsächlich
// abgezogene Betrag steht in Stripes Abrechnung; hier geht es allein um eine
// Hausnummer neben dem Umsatz.
export const STRIPE_PERCENT = 0.015
export const STRIPE_FIXED_CENTS = 25
