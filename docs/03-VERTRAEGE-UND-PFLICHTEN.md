# Verträge und Pflichten — Privat vs. Gewerbe

Ein Formular für beide Zielgruppen ist bequem, aber nicht überall zulässig. Privatkunden haben Widerrufsrechte, Preisangabenpflichten und Verbraucherschutz. Gewerbekunden haben Verhandlung, Bonität und Lastprofile. Die Plattform trennt beide bereits über `typ = privat | gewerbe`; die Verträge müssen es auch.

## Der Unterschied in einer Tabelle

| Punkt | Privatkunde | Gewerbekunde |
|---|---|---|
| Einordnung | Verbraucher (§ 13 BGB) | Unternehmer (§ 14 BGB) |
| Widerrufsrecht | in der Regel 14 Tage bei Fernabsatz | grundsätzlich nein |
| Preisangaben | PAngV: Endpreis inkl. aller Bestandteile | vertraglich frei, transparent |
| Vertragstyp | Sondervertrag oder Grundversorgung | Sondervertrag / Rahmenvertrag |
| Laufzeit | meist 12–24 Monate | individuell |
| Bonität | selten geprüft | Standard |
| Lastprofil | SLP | SLP oder RLM |
| Kündigung | gesetzlich + vertraglich | vertraglich |
| Streitbeilegung | Schlichtungsstelle Energie | meist Gericht |

## Privatkunden

**Widerrufsrecht.** Bei Fernabsatzverträgen (Online, Telefon) steht Verbrauchern in der Regel ein 14-tägiges Widerrufsrecht zu. Die Belehrung muss vor Vertragsschluss in Textform vorliegen. Wird die Belieferung auf ausdrücklichen Wunsch vor Ablauf der Frist aufgenommen, kann für die bereits erbrachte Leistung ein anteiliger Betrag geschuldet sein. Ob und wie das im konkreten Vertragsmodell gilt, muss die Widerrufsbelehrung korrekt abbilden — `widerruf.html` ist dafür die Vorlage.

**Preisangabenverordnung (PAngV).** Gegenüber Verbrauchern muss der Endpreis alle Preisbestandteile enthalten: Grundpreis, Arbeitspreis, Netzentgelte, Konzessionabgabe, Steuern, Umlagen, Umsatzsteuer. Auf der Website dürfen Beispielrechnungen stehen, wenn sie klar als unverbindlich gekennzeichnet sind. Die Rechner-Ausgabe macht das bereits.

**Grundversorgung vs. Sondervertrag.** Haushaltskunden im Netzgebiet haben Anspruch auf Grundversorgung durch den Grundversorger. E1 liefert in der Regel über einen Sondervertrag mit eigenen Preisen und Laufzeiten. Die Regelungen der StromGVV/GasGVV gelten für die Grundversorgung; Sonderverträge brauchen eigene AGB.

**Preisänderungen.** Nach §§ 41 ff. EnWG müssen Preisänderungen mindestens sechs Wochen vorher in Textform angekündigt werden, mit Grund, Umfang und Voraussetzung. Der Kunde hat ein Sonderkündigungsrecht zum Wirksamkeitsdatum.

**Schlichtungsstelle.** Energieversorger mit Haushaltskunden müssen an der Schlichtungsstelle Energie e.V. teilnehmen (§ 111b EnWG). Die Kontaktdaten gehören ins Impressum und in die AGB.

**Stromkennzeichnung.** Lieferanten müssen die Herkunft und Zusammensetzung der gelieferten Elektrizität ausweisen (§ 42 EnWG). Das betrifft Rechnungen und Werbung.

**Barrierefreiheit.** Das BFSG gilt seit 28.06.2025 für bestimmte Verbraucherprodukte und -dienstleistungen. Ob der eigene Vertriebskanal darunter fällt, ist zu prüfen; unabhängig davon ist eine zugängliche Seite gut für Conversion und SEO.

## Gewerbekunden

**Kein Verbraucherwiderruf.** B2B-Verträge unterliegen nicht dem 14-tägigen Widerrufsrecht. Vertragliche Rücktritts- oder Kündigungsrechte können trotzdem vereinbart werden.

**Bonität.** Bei Gewerbekunden ist eine Bonitätsprüfung üblich. Sicherheiten, Vorauszahlung oder Bankbürgschaft können vertraglich geregelt werden. Die Prüfung braucht eine Rechtsgrundlage und Datenschutzinformation.

**Lastprofil und Preis.** Bei RLM-Kunden hängt der Preis von Lastgang, Leistungspreis und Netzebene ab. Ein Pauschalpreis ist unseriös. Die Plattform rechnet indikativ; das verbindliche Angebot folgt nach Prüfung der Zählpunkte.

**Rahmenvertrag.** Mehrere Standorte werden oft in einem Rahmenvertrag gebündelt, mit Anlagen pro MaLo. Kündigung, Laufzeit und Preisgleitklausel müssen auch für Nachträge funktionieren.

**Preisgleitklausel.** Wenn der Arbeitspreis an einen Index gekoppelt wird, müssen Index, Formel, Bezugszeitraum und Anpassungsmechanik im Vertrag stehen. Eine Klausel ohne nachvollziehbare Formel ist angreifbar.

## Pflichtdokumente — Matrix

| Dokument | Privat | Gewerbe | Wo |
|---|---|---|---|
| Impressum (§ 5 DDG) | ja | ja | `impressum.html` |
| Datenschutzerklärung | ja | ja | `datenschutz.html` |
| AGB | ja | ja | `agb.html` |
| Widerrufsbelehrung + Formular | ja (Fernabsatz) | nein | `widerruf.html` |
| Preisblatt / Tarifinformation | ja | ja | `config/tariffs.json` + Angebot |
| Stromkennzeichnung | ja (Lieferant) | ja (Lieferant) | Rechnung |
| Schlichtungsstelle-Hinweis | ja (Versorger) | empfohlen | Impressum/AGB |
| Auftragsverarbeitungsvertrag | bei Dienstleistern | bei Dienstleistern | mit CRM/E-Mail/Hosting |
| Cookie-/Tracking-Hinweis | ja, falls Tracking | ja, falls Tracking | Consent-Banner |

## Lead-Generierung — die eigenen Pflichten

Die Plattform erzeugt Leads. Auch das ist reguliert.

**Einwilligung.** Das Formular holt eine ausdrückliche Einwilligung zur Verarbeitung der Anfrage ein. Für Werbe-E-Mails an den Lead ist zusätzlich eine separate Einwilligung nötig, idealerweise per Double-Opt-in. Die Checkbox im Formular deckt die Anfragebearbeitung, nicht automatisch Newsletter.

**Keine Kaltakquise ohne Consent.** Telefonwerbung gegenüber Verbrauchern ohne vorherige ausdrückliche Einwilligung ist nach § 7 UWG unzulässig. Inbound-Leads, die selbst anfragen, sind der saubere Weg. Wer Leads einkauft, muss die Einwilligungskette lückenlos nachweisen können.

**Lead-Weitergabe.** Wenn Leads an einen Versorger oder Partner gehen, muss der Kunde darüber informiert sein (Datenschutzerklärung, Einwilligung). Ein Lead, der ohne Rechtsgrundlage weiterverkauft wird, ist ein Datenschutzverstoß.

**Cookies und Tracking.** Analyse- und Marketing-Cookies brauchen nach § 25 TDDDG eine Einwilligung, bevor sie gesetzt werden. Technisch notwendige Cookies (Admin-Session) sind davon ausgenommen. Die aktuelle Seite setzt kein Tracking; sobald Google Ads, Meta Pixel oder Analytics dazukommen, braucht es einen Consent-Banner und eine aktualisierte Datenschutzerklärung.

**Double-Opt-in.** Für E-Mail-Marketing: Bestätigungslink, Nachweis der Einwilligung, Widerrufsmöglichkeit in jeder Mail.

**Speicherdauer.** Leads ohne Vertrag nach angemessener Frist löschen (z. B. 6 Monate). Vertragsdaten unterliegen handels- und steuerrechtlichen Aufbewahrungsfristen.

## Was in den Vorlagen noch fehlt (FILL)

- Firmenname, Rechtsform, Anschrift, Vertretungsberechtigte
- USt-IdNr., Handelsregister
- Telefon, E-Mail, verantwortliche Person nach § 18 MStV
- Datenschutzbeauftragter (falls bestellt)
- Hosting-, E-Mail- und CRM-Dienstleister in der Datenschutzerklärung
- Laufzeit, Kündigungsfrist, Zahlungsfrist, Gerichtsstand in den AGB
- Schlichtungsstelle und ggf. BNetzA-Aktenzeichen
- Datum des Stands

## Checkliste vor dem ersten Vertrag

- [ ] Versorgungsmodell entschieden (eigener Versorger / Vermittler / White-Label)
- [ ] AGB an das Modell angepasst und geprüft
- [ ] Widerrufsbelehrung korrekt für Fernabsatz
- [ ] Preisblatt mit allen Bestandteilen
- [ ] Impressum vollständig
- [ ] Datenschutzerklärung mit allen Dienstleistern
- [ ] Einwilligungstext im Formular rechtlich geprüft
- [ ] Double-Opt-in für E-Mail-Marketing vorbereitet
- [ ] Consent-Banner bereit, sobald Tracking dazukommt
- [ ] Aufbewahrungs- und Löschfristen definiert
