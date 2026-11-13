# E1 EnergyOne — Direktvertriebsplattform

Lead- und Angebotsplattform für Strom und Gas. Privat- und Gewerbekunden, Preisrechner, Anfrage-Engine, Admin-Dashboard, CSV-Export. Kein Framework, kein Build-Schritt, ein Node-Prozess.

## Was drin ist

- **Landingpage** mit Live-Preisrechner (Strom/Gas), Presets, Ersparnis-Anzeige
- **Gewerbeseite** mit B2B-Rechner und erweitertem Anfrageformular
- **Lead-Engine**: zweistufiges Formular, PDF-Upload der letzten Rechnung, Validierung, Honeypot, Rate-Limit, SQLite oder Postgres
- **Admin** unter `/admin`: Login per Token, Filter, Status-Pipeline, Notizen, CSV-Export
- **Rechtstexte** als Muster: Impressum, Datenschutz, AGB, Widerruf
- **Doku** zu Marktrollen, Lieferantenwechsel, Vertragspflichten, Go-to-Market, Betrieb

## Schnellstart lokal

```bash
npm install        # nur für den optionalen Postgres-Treiber nötig
npm start
```

- Website: http://127.0.0.1:8787
- Admin: http://127.0.0.1:8787/admin
- Token: `data/admin-token.txt` (wird beim ersten Start erzeugt) oder `E1_ADMIN_TOKEN`

Ohne `DATABASE_URL` läuft eine SQLite-Datei unter `data/leads.db`. Node **22.13+** ist Pflicht, empfohlen **24** (Render ist auf 24 gepinnt). PDFs werden als Blob in derselben Datenbank gespeichert — mit Postgres überleben sie Deploys, mit SQLite nicht.

## Konfiguration

### Tarife

`config/tariffs.json` — Grundpreis, Arbeitspreis, Referenzpreis und Verbrauchs-Presets je Produkt. Die Werte sind **Platzhalter** und müssen vor dem Livegang durch die echten E1-Tarifblätter ersetzt werden.

### Umgebungsvariablen

| Variable | Zweck |
|---|---|
| `PORT` | Port, Default `8787` |
| `HOST` | Bind-Adresse, lokal `127.0.0.1`, auf Render `0.0.0.0` |
| `E1_ADMIN_TOKEN` | Admin-Token, min. 16 Zeichen |
| `DATABASE_URL` | Postgres-Connection-String; ohne Wert SQLite |
| `DATABASE_SSL` | `false` deaktiviert SSL (z. B. lokaler Postgres) |
| `E1_LEAD_WEBHOOK` | optionaler POST bei jedem neuen Lead |

## Deploy auf Render (Free)

### Variante A: Blueprint

1. Repo zu Render verbinden.
2. **New → Blueprint**, Repo `gigaconnectvertrieb-glitch/E1` wählen.
3. `render.yaml` wird erkannt. Service anlegen.
4. Im Dashboard den generierten `E1_ADMIN_TOKEN` kopieren.
5. Optional `DATABASE_URL` ergänzen (siehe unten).

### Variante B: manuell

1. **New → Web Service**, Repo verbinden.
2. Runtime: Node. Build: `npm install`. Start: `node server.mjs`.
3. Plan: Free. Health Check: `/healthz`.
4. Env: `NODE_VERSION=24`, `HOST=0.0.0.0`, `E1_ADMIN_TOKEN=<zufällig>`.

### Falls der Service auf Docker steht

Der Fehler `failed to read dockerfile: open Dockerfile: no such file or directory` bedeutet: Render hat den Service als **Docker** angelegt. Das Repo enthält jetzt einen `Dockerfile` — ein Redeploy baut damit automatisch. Alternativ im Dashboard unter **Settings → Environment** auf `Node` stellen; dann gelten `npm install` und `node server.mjs`.

### Wichtig: Free-Disk ist ephemer

Der Free-Plan hat keine persistente Platte. SQLite-Daten (Leads, Token) gehen bei jedem Deploy und Neustart verloren. Für echte Leads **Postgres** verwenden.

**Neon (kostenlos, persistent):**

1. https://neon.tech → Projekt anlegen.
2. Connection String kopieren (Pooled).
3. Auf Render als `DATABASE_URL` setzen.
4. Neu deployen. Die Tabelle wird automatisch angelegt.

Alternativen: Supabase (Free), Render Postgres (Free, zeitlich begrenzt). Der Server erkennt Postgres automatisch am gesetzten `DATABASE_URL`.

## Admin

- Login mit `E1_ADMIN_TOKEN`.
- Status-Pipeline: `neu → kontaktiert → angebot → gewonnen / verloren` (plus `spam`).
- Notizen pro Lead, Filter nach Status/Typ/Produkt, Suche, CSV-Export mit BOM (Excel-kompatibel).
- Session-Cookie: HttpOnly, SameSite=Strict, Secure bei HTTPS, 8 h TTL.

## Projektstruktur

```
E1-Direktvertrieb/
├─ server.mjs              # HTTP-Server, API, Auth, Storage
├─ config/tariffs.json     # Preis- und Rechenparameter
├─ public/
│  ├─ index.html           # Landingpage + Rechner + Privatkundenformular
│  ├─ business.html        # Gewerbe + B2B-Formular
│  ├─ danke.html           # Success-Seite
│  ├─ admin.html           # Lead-Dashboard
│  ├─ impressum.html
│  ├─ datenschutz.html
│  ├─ agb.html
│  ├─ widerruf.html
│  └─ assets/              # styles.css, app.js, admin.js, favicon
├─ docs/                   # Markt, Wechsel, Verträge, GTM, Betrieb
├─ data/                   # SQLite + Token (gitignored)
├─ render.yaml
└─ .env.example
```

## API

| Methode | Pfad | Auth | Zweck |
|---|---|---|---|
| GET | `/api/tariffs` | – | Tarifdaten für den Rechner |
| POST | `/api/leads` | – | Lead anlegen (rate-limited, Honeypot) |
| POST | `/api/admin/login` | Token | Session setzen |
| GET | `/api/admin/session` | Cookie | Session prüfen |
| GET | `/api/leads` | Cookie | Leads + Status-Counts |
| PATCH | `/api/leads/:id` | Cookie | Status/Notiz ändern |
| GET | `/api/leads.csv` | Cookie | CSV-Export |
| POST | `/api/admin/logout` | Cookie | Session löschen |
| GET | `/healthz` | – | Health Check |

## Sicherheit

- JSON-Body-Limit 64 KB, Längenlimits je Feld, E-Mail-/PLZ-Validierung
- Rate-Limit: 5 Leads / 10 min / IP, 10 Logins / 10 min / IP
- Honeypot-Feld `website`
- Session-Token (32 Byte) statt Token im Cookie, Constant-Time-Vergleich
- Origin-Check für mutierende Admin-Requests (CSRF)
- CSP, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy
- IP wird nur als gesalzener SHA-256-Hash gespeichert, nie im Klartext

## Vor dem Livegang

1. `config/tariffs.json` mit echten Preisen füllen.
2. Anschrift, Telefon und E-Mail in den Rechtstexten ergänzen, sobald sie feststehen.
3. AGB/Widerruf an das Versorgungsmodell anpassen (eigener Versorger vs. Vermittlung) und rechtlich prüfen lassen.
4. `DATABASE_URL` setzen, damit Leads persistent sind.
5. `E1_ADMIN_TOKEN` sicher aufbewahren.
6. Impressum-Pflichtangaben, Schlichtungsstelle und ggf. BNetzA-Anzeige klären.
7. Domain verbinden, HTTPS aktivieren (Render macht das automatisch).
8. Tracking nur mit Consent einsetzen (TDDDG), siehe `docs/05-BETRIEB.md`.

Die fachlichen Grundlagen stehen in `docs/`:

- `01-MARKT-UND-REGULIERUNG.md` — Versorger, Vermittler, Pflichten, Kosten
- `02-LIEFERANTENWECHSEL.md` — Prozess, Marktkommunikation, Timing
- `03-VERTRAEGE-UND-PFLICHTEN.md` — Privat vs. Gewerbe, Pflichtdokumente
- `04-GO-TO-MARKET.md` — wie Kunden tatsächlich reinkommen (Inbound, Ads, Partner)
- `05-BETRIEB.md` — Lead-Bearbeitung, SLAs, Backup, Skalierung
