# Betrieb — Leads, SLA, Backup, Skalierung

Die Plattform ist ein einzelner Node-Prozess. Das ist Absicht: wenig Teile, wenig Ausfallfläche. Diese Datei beschreibt, wie der Betrieb aussieht, wenn echte Leads reinkommen.

## Lead-Bearbeitung

**SLA (Service Level Agreement) — Vorschlag:**

| Lead-Typ | Erstreaktion | Angebot |
|---|---|---|
| Gewerbe | 4 Geschäftsstunden | 1 Werktag |
| Privat, vollständige Daten | 24 Stunden | 1–2 Werktage |
| Privat, unvollständig | 24 Stunden (Rückfrage) | nach Daten |

Jeder Lead startet auf `neu`. Nach der ersten Kontaktaufnahme auf `kontaktiert`, nach Angebot auf `angebot`, nach Abschluss auf `gewonnen` oder `verloren`. Notizen im Lead festhalten — nicht im Kopf.

**Tagesroutine:**

1. Morgens: alle `neu` durchgehen, priorisieren (Gewerbe zuerst).
2. Zählernummer und MaLo prüfen, fehlende Daten nachfordern.
3. Angebot erstellen, Status setzen, Wiedervorlage notieren.
4. Abends: `kontaktiert` ohne Reaktion nachfassen.

**Deduplizierung:** gleiche E-Mail oder gleiche MaLo nicht doppelt bearbeiten. Bei doppeltem Lead den neueren zusammenführen und notieren.

## Daten und Backup

**Mit Postgres (empfohlen):** Neon/Supabase bietet Point-in-Time-Recovery bzw. tägliche Backups je nach Plan. Zusätzlich wöchentlich CSV exportieren (`/api/leads.csv`) und außerhalb des Servers ablegen.

**Mit SQLite:** `data/leads.db` ist die einzige Quelle. Auf Render Free ist die Disk ephemer — Daten gehen bei Deploy/Neustart verloren. Nur für Tests verwenden.

**Backup-Routine:**

- Täglich: automatisches Postgres-Backup des Anbieters prüfen.
- Wöchentlich: CSV-Export herunterladen, in einen Cloud-Ordner legen.
- Monatlich: Restore einmal testen — ein Backup, das nie zurückgespielt wurde, ist kein Backup.

**Aufbewahrung:** Leads ohne Vertrag nach 6 Monaten löschen; Vertragsdaten nach gesetzlichen Fristen (6–10 Jahre). Löschroutine dokumentieren.

## Monitoring

- **Health Check**: `GET /healthz` → `ok`. Render nutzt ihn für den Service.
- **Uptime**: kostenloser Monitor (z. B. UptimeRobot) auf `/` und `/healthz`, Alarm per E-Mail.
- **Logs**: Render-Dashboard, `console.log`/`console.error` im Prozess. Bei Fehlern zuerst Logs, dann Reproduktion.
- **Fehlerbilder**: 500 = Serverfehler (Log prüfen), 429 = Rate-Limit (IP), 401 = Session abgelaufen.

## Sicherheit im Betrieb

- **Admin-Token** min. 16 Zeichen, nur über Env, nicht im Repo. Bei Verdacht rotieren: neuen Wert setzen, neu deployen; alte Sessions laufen nach 8 h aus.
- **Render/GitHub-Konten** mit 2FA schützen. Wer Repo-Zugriff hat, kann deployen.
- **Least Privilege**: keine zusätzlichen Env-Secrets im Frontend.
- **HTTPS**: Render erzwingt es; Cookie wird mit `Secure` gesetzt, wenn `X-Forwarded-Proto: https`.
- **Rate-Limits** sind pro IP; bei Proxy/CDN die `X-Forwarded-For`-Kette beachten.
- **Updates**: Node-Version aktuell halten, `npm audit` regelmäßig laufen lassen.

## Skalierung

**Was heute geht:** ein Prozess, hunderte Leads pro Tag, problemlos.

**Grenzen:**

- Sessions liegen im Speicher. Bei mehreren Instanzen braucht es einen gemeinsamen Store (Redis/Postgres) oder Sticky Sessions.
- Rate-Limits liegen im Speicher; bei mehreren Instanzen pro Instanz, nicht global.
- SQLite verträgt keinen Multi-Instance-Betrieb. Postgres schon.

**Wenn es wächst:**

1. Postgres statt SQLite.
2. Zwei Instanzen hinter Render-Loadbalancer, Session-Store auslagern.
3. Lead-Verarbeitung asynchron (Queue) für Webhooks und E-Mails.
4. E-Mail-Versand über einen Transaktionsdienst (Resend, Postmark, Brevo) statt manuell.
5. CRM-Anbindung (HubSpot, Pipedrive, eigenes Tool) per Webhook oder API.

## Kosten (Orientierung)

| Posten | Free | Sinnvoll ab |
|---|---|---|
| Render Web Service | 0 € (Cold Start, ephemer) | 7 $/Monat (immer an) |
| Postgres | Neon Free | 19 $/Monat (Neon Launch) |
| Domain | — | 10–15 €/Jahr |
| E-Mail | — | 0–20 €/Monat |
| Monitoring | UptimeRobot Free | 0–10 €/Monat |

Der Free-Plan schläft nach Inaktivität ein; der erste Aufruf dauert 30–60 Sekunden. Für echten Vertrieb ist der Starter-Plan die 7 $ wert.

## Incident-Kurzleitfaden

1. **Seite down**: Render-Status prüfen, Logs prüfen, Health Check aufrufen.
2. **Leads kommen nicht an**: `/api/leads` testen, Postgres-Verbindung prüfen, Rate-Limit prüfen.
3. **Admin-Login kaputt**: Env-Token prüfen, Session-Cookie im Browser, Neustart.
4. **Datenverlust**: letztes Backup einspielen, Ursache dokumentieren, Disk/DB prüfen.

## Wartungskalender

- **Wöchentlich**: Leads exportieren, offene Leads prüfen, Logs überfliegen.
- **Monatlich**: Tarife gegen Partnerpreise abgleichen, `npm audit`, Backup-Restore testen.
- **Quartalsweise**: Rechtstexte prüfen, Tracking/Consent prüfen, Conversion-Daten auswerten.
