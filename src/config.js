// Nur für den Browser. Diese Datei darf der Worker nicht importieren.
//
// data.js wird von beiden Seiten gelesen — vom Vite-Build und von
// worker/src/catalog.js — und muss deshalb umgebungsneutral bleiben.
// import.meta.env gibt es nur in Vite; in workerd ist es undefined und
// hat den Worker beim Start umgebracht, als es dort stand.

// In der Entwicklung läuft Vite auf :8000 und der Worker auf :8787.
// Im Betrieb bedient derselbe Ursprung beides, dann bleibt der Pfad relativ.
export const API_BASE = import.meta.env.DEV ? 'http://localhost:8787' : ''

// Stripe-Gebühren für EWR-Karten, nur zur Anzeige im Panel. Der tatsächlich
// abgezogene Betrag steht in Stripes Abrechnung; hier geht es allein um eine
// Hausnummer neben dem Umsatz.
export const STRIPE_PERCENT = 0.015
export const STRIPE_FIXED_CENTS = 25
