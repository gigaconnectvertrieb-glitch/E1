# Lieferantenwechsel — Prozess, Daten, Timing

Der Wechsel ist der Moment, in dem aus einem Lead ein Kunde wird. Er läuft standardisiert über die Marktkommunikation, nicht über Telefon und Fax. Wer den Prozess kennt, verliert keine Leads an Formfehler.

## Was der Kunde liefert

| Feld | Woher | Wofür |
|---|---|---|
| Zählernummer | letzte Rechnung | Identifikation der Messstelle |
| Marktlokations-ID (MaLo) | Rechnung oder Netzbetreiber | eindeutige Lokation im Markt |
| Zählpunktbezeichnung | Rechnung | technische Zuordnung |
| Jahresverbrauch | Rechnung | Preis und Bilanzierung |
| Lieferadresse | Kunde | Netzgebiet, Zuordnung |
| aktueller Anbieter | Kunde | Kündigung, Wechselprozess |
| Vertragsnummer alt | Rechnung | Kündigung |
| Bei Gewerbe: Lastprofil / RLM | Netzbetreiber, Messstellenbetreiber | Preis und Fahrplan |

Die Zählernummer ist die häufigste Fehlerquelle. Fehlt sie, ist der Lead nicht abschließbar — dann als „unvollständig“ markieren statt zu raten.

## Ablauf Strom (GPKE)

1. **Kunde beauftragt E1** (bzw. den Partner). Vertrag und Vollmacht zur Kündigung liegen vor.
2. **Datenprüfung**: MaLo, Zählpunkt, Netzgebiet, Verbrauch, Vertragsstatus beim alten Anbieter.
3. **Kündigung beim Altanbieter** zum nächstmöglichen Termin, sofern beauftragt.
4. **Anmeldung beim Netzbetreiber** per UTILMD (Lieferantenwechsel). Der neue Lieferant meldet den Zählpunkt an.
5. **Netzbetreiber prüft** und bestätigt oder lehnt ab (APERAK/CONTRL bei Formatfehlern).
6. **Altanbieter wird informiert** und bestätigt das Lieferende.
7. **Bestätigung an den Kunden**: Lieferbeginn, Preis, Abschlag.
8. **Lieferbeginn** zum vereinbarten Datum, in der Regel zum Monatsende.
9. **Erste Rechnung** nach Lieferbeginn, Abschläge ab erstem Liefertag.

**Typische Dauer:** 4–6 Wochen ab vollständiger Anmeldung, abhängig von Netzbetreiber und Restlaufzeit des Altvertrags. Die Versorgung ist durchgehend gesichert; es gibt keine Versorgungslücke.

## Ablauf Gas (GaBi/GPKE-Gas)

Analog, mit eigenen Formaten und Marktgebietslogik:

1. Kunde beauftragt, Datenprüfung.
2. Anmeldung beim Netzbetreiber (Lieferantenwechsel Gas).
3. Bestätigung, Lieferbeginn.
4. Bilanzierung über den Marktgebietsverantwortlichen.

Bei Gas kommen Messstellenbetrieb und Brennwert-/Zustandszahl hinzu; die Abrechnung ist daher stärker von Messwerten abhängig.

## Marktkommunikation — die Formate

| Format | Zweck |
|---|---|
| UTILMD | Stammdaten, Lieferantenwechsel, Zählpunktanmeldung |
| MSCONS | Messwerte |
| INVOIC | Rechnungen (Netznutzung, Messstellenbetrieb) |
| ORDERS / ORDRSP | Bestellungen und Bestätigungen |
| PRICAT | Preislisten |
| APERAK | Anwendungsfehler / Bestätigung |
| CONTRL | Syntax- und Formatprüfung |

Wer Route A (eigener Versorger) geht, braucht eine Marktkommunikationslösung oder einen Dienstleister. Wer Route B/C geht, übergibt den Kunden an den Versorger; der Prozess liegt dort.

## Gewerbekunden — Besonderheiten

- **SLP** (Standardlastprofil) für kleine Verbräuche, **RLM** (registrierende Leistungsmessung) ab typischerweise 100.000 kWh/Jahr oder auf Wunsch.
- Bei RLM: Lastgang, Leistungspreis, Netzebene, Messentgelte.
- Mehrere Standorte: jede MaLo einzeln anmelden, vertraglich bündeln.
- Bonitätsprüfung ist bei Gewerbe Standard; Zahlungsziel und Sicherheiten vertraglich regeln.
- Preisgleitklausel an einen nachvollziehbaren Index binden und die Formel im Vertrag nennen.

## Fehlerfälle und Gegenmaßnahmen

| Fehler | Folge | Gegenmaßnahme |
|---|---|---|
| Falsche Zählernummer | Anmeldung scheitert | Beim Kunden nachfordern, Lead nicht schließen |
| Altvertrag mit langer Laufzeit | Wechsel erst später | Termin transparent nennen, Erinnerung setzen |
| Umzug während des Wechsels | Neue MaLo nötig | Prozess neu starten, Kunde informieren |
| Gesperrte Messstelle | Keine Belieferung möglich | Entsperrung klären, Zahlungsnachweis |
| Gewerbe ohne Lastprofil | Preis nicht kalkulierbar | Netzbetreiber anfragen, Angebot nachreichen |
| Doppelter Auftrag | Zwei Anmeldungen | Lead-Deduplizierung per E-Mail + MaLo |

## Was die Plattform abbilden muss

1. **Pflichtfelder** je Kundentyp (privat/gewerbe) erzwingen.
2. **Lead-Status** entlang des Prozesses: neu → kontaktiert → angebot → gewonnen → verloren.
3. **Übergabe** an CRM oder Versorger (Webhook, CSV, später API).
4. **Deduplizierung**: gleiche E-Mail oder gleiche MaLo nicht doppelt bearbeiten.
5. **Wiedervorlage**: Datum für Nachfassen, besonders bei Laufzeitverträgen.
6. **Dokumentation**: Notiz pro Lead mit Gespräch, Angebot, nächstem Schritt.

## Checkliste für den ersten Wechsel

- [ ] Partner/Versorger und Provisionsmodell geklärt
- [ ] Preisblatt und AGB des Versorgers liegen vor
- [ ] Zählernummer, MaLo und Verbrauch im Lead erfasst
- [ ] Kündigungsvollmacht des Kunden dokumentiert
- [ ] Anmeldung beim Netzbetreiber bestätigt
- [ ] Lieferbeginn schriftlich bestätigt
- [ ] Erste Rechnung geprüft
- [ ] Lead auf „gewonnen“ gesetzt, Provision angestoßen
