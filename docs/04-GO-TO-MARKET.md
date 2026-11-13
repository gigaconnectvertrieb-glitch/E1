# Go-to-Market — wie Kunden tatsächlich reinkommen

Eine Plattform bringt keine Kunden. Sie verwandelt Aufmerksamkeit in Leads. „Passiv“ heißt: der Kunde kommt über einen Kanal zu dir, nicht über Kaltakquise. Dafür müssen drei Dinge stimmen — Reichweite, Angebot, Übergabe.

## Der Funnel

```
Impression → Klick → Rechner/Seite → Lead → qualifiziert → Abschluss → Kunde
```

Jede Stufe hat eine Rate. Die Plattform beeinflusst die mittleren Stufen; die oberen kommen aus Marketing, die untere aus Vertrieb.

**Beispielrechnung (Setz deine eigenen Zahlen ein):**

| Stufe | Rate | Menge bei 10.000 Besuchern |
|---|---|---|
| Besucher | — | 10.000 |
| Rechner genutzt | 35 % | 3.500 |
| Lead abgeschickt | 6 % der Besucher | 600 |
| qualifiziert | 60 % der Leads | 360 |
| gewonnen | 15 % der Leads | 90 Kunden |

**Kosten pro Kunde:**

```
CPC 1,20 € × 10.000 Besucher = 12.000 € Werbebudget
Kosten pro Lead = 12.000 € / 600 = 20 €
CAC = 12.000 € / 90 = 133 €
```

Bei einer Provision von 80 € pro Abschluss ist das Verlustgeschäft. Bei 150 € plus Folgeprovision pro Jahr trägt es sich. Deshalb: **organische und Partner-Kanäle zuerst**, bezahlte Anzeigen erst, wenn CAC und Marge bekannt sind.

## Kanäle im Vergleich

| Kanal | Intent | Geschwindigkeit | Kosten | Skalierung | Bemerkung |
|---|---|---|---|---|---|
| Google Search Ads | hoch | sofort | hoch | gut | „stromanbieter wechseln“, „gewerbestrom“ |
| SEO / Content | mittel–hoch | 3–9 Monate | niedrig | sehr gut | Rechner, Ratgeber, lokale Seiten |
| Google Business / Maps | hoch lokal | Tage | niedrig | mittel | für lokale Gewerbekunden |
| Meta / Instagram / TikTok | niedrig | sofort | mittel | gut | braucht starke Creatives |
| Vergleichsportale | sehr hoch | sofort | Provision | gut | Marke unsichtbar, Marge gedrückt |
| Partner / Empfehlung | hoch | 1–3 Monate | Provision | sehr gut | beste CAC |
| E-Mail / Bestandskunden | hoch | sofort | niedrig | gut | Reaktivierung, Wechselerinnerung |
| B2B-Netzwerk / LinkedIn | mittel | Wochen | niedrig | mittel | Gewerbe, mehrere Standorte |

## Was zuerst

1. **SEO-Grundlage**: Eine Seite pro Produkt und Zielgruppe, klare Titel, Rechner oben, Ladezeit, mobile Darstellung. Die vorhandene Struktur ist die Basis; jede Stadt- oder Branchenseite kommt später dazu.
2. **Google Search Ads** mit kleinem Budget auf die drei besten Keywords, Conversion = Lead. Nach 2–4 Wochen CAC messen.
3. **Partnerprogramm** für Immobilienverwaltungen, Makler, Hausverwaltungen, Gastro-Verbände, Handwerksbetriebe. Provision pro vermitteltem Vertrag, klare Abwicklung.
4. **Empfehlungsmechanik**: Jeder gewonnene Kunde erhält einen persönlichen Link; bei Abschluss eine Prämie. Das ist der günstigste Kanal.

## Conversion auf der Seite

Die Seite ist gebaut, um zu konvertieren:

- **Rechner über dem Fold** — der Besucher sieht sofort einen Preis.
- **Ein Ziel pro Seite** — Anfrage, nicht „mehr erfahren“.
- **Klare Sprache** — keine Energie-Floskeln, konkrete Zahlen.
- **Vertrauen** — ein Ansprechpartner, digitaler Ablauf, transparente Preise.
- **Kurzes Formular** — Pflichtfelder minimiert; Zählernummer optional, wird später nachgefasst.
- **Mobile zuerst** — der Rechner und das Formular funktionieren einhändig.
- **Kein Tracking ohne Consent** — sobald Pixel dazukommen, Consent-Banner.

**Was die Conversion hebt:**

- Ersparnis in Euro statt in Prozent.
- Vergleich zum „Durchschnittspreis“ klar als Beispiel kennzeichnen.
- Antwortzeit nennen („Angebot innerhalb eines Werktags“).
- Echte Kundenstimmen, sobald vorhanden — keine erfundenen Bewertungen.
- Wiedervorlage per E-Mail bei abgebrochenem Formular (nur mit Einwilligung).

## B2B-Kanal

Gewerbekunden kommen selten über Ads. Sie kommen über:

- **Empfehlungen** von Steuerberatern, Hausverwaltungen, Maklern.
- **Verbände und Innungen** (Gastronomie, Handwerk, Einzelhandel).
- **LinkedIn** und lokale Unternehmernetzwerke.
- **Direktansprache** vor Ort, aber rechtlich sauber: Kaltakquise am Telefon ist auch im B2B nur mit mutmaßlicher Einwilligung zulässig; ein persönlicher Besuch mit Termin ist der sichere Weg.
- **Energie-Audit als Türöffner**: Lastprofil prüfen, Einsparpotenzial zeigen, dann Angebot.

## Messen

Jeder Lead braucht eine Quelle. Die Plattform speichert `quelle`; setze sie über einen Query-Parameter oder ein Hidden-Field pro Kampagne (z. B. `?src=google-ads-strom`).

**Kennzahlen:**

- Besucher, Rechner-Nutzung, Lead-Rate
- Kosten pro Lead (CPL), Kosten pro gewonnenem Kunden (CAC)
- Lead → qualifiziert → gewonnen (Conversion je Quelle)
- Deckungsbeitrag pro Kunde, Payback-Zeit
- Stornoquote (bei Provisionen entscheidend)

Ohne diese Zahlen ist Marketing Glücksspiel.

## 90-Tage-Plan

**Woche 1–2**

- Tarife und Rechtstexte finalisieren.
- Domain und Render-Deploy live.
- Postgres anbinden, Admin-Token sichern.
- Google Search Console und Analytics (mit Consent) vorbereiten.

**Woche 3–4**

- Google Ads: drei Kampagnen (Strom privat, Gas privat, Gewerbe), kleines Budget.
- Erste SEO-Seiten: „Strom wechseln“, „Gewerbestrom“, „Gaspreise vergleichen“.
- Partnerliste: 20 lokale Hausverwaltungen und Makler ansprechen.

**Woche 5–8**

- Wöchentliche Auswertung: CPL, Lead-Qualität, Abschlussrate.
- Zwei Partner unter Vertrag nehmen.
- Empfehlungsprogramm starten.
- Formular A/B: Feldreihenfolge, Rechner-Presets.

**Woche 9–12**

- Kanäle mit positivem CAC skalieren, negative abschalten.
- B2B-Pilot mit fünf Betrieben.
- Case Study aus ersten Abschlüssen.
- Entscheidung: Route B/C ausbauen oder Route A prüfen.

## Die harte Wahrheit

Die Plattform ist der Trichter, nicht der Wasserhahn. Ohne Reichweite bleibt der Trichter leer. Der schnellste Weg zu den ersten Kunden ist **ein Partner mit bestehendem Kundenstamm**, nicht die perfekte Landingpage. Die Seite ist dafür gebaut, den Partner-Traffic sauber zu konvertieren.
