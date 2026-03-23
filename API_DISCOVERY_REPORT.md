# Analisi Progetto Soccorso Digitale — Report API Discovery

> Generato il 2026-03-22 | Versione progetto: v2.0.0

---

## 1. Stato Attuale del Progetto

### Stack Tecnologico

| Layer | Tecnologia | Versione |
|-------|-----------|----------|
| Mobile | React Native + Expo | 0.81.5 / SDK 54 |
| Web | React + React Native Web | 19.1.0 |
| UI | Radix UI + Tailwind CSS | 4.1.18 |
| State | TanStack React Query | 5.90.7 |
| Backend | Express.js + TypeScript | 4.21.2 / 5.9.2 |
| Database | PostgreSQL + Drizzle ORM | 16+ / 0.39.3 |
| Validazione | Zod | 3.24.2 |
| PDF | pdfkit | 0.17.2 |
| Real-time | WebSocket (ws) | 8.18.0 |
| Storage | Google Cloud Storage | 7.19.0 |
| Email | Resend | 4.0.0 |
| Pagamenti | Stripe | 20.3.1 |
| Logging | Pino | 10.3.1 |
| Testing | Vitest + Supertest | 4.1.0 / 7.2.2 |
| Deploy | Docker + Railway | Node 22-alpine |

### Moduli Implementati (44 screen, 655+ endpoint)

| Modulo | Stato | File Principali |
|--------|-------|-----------------|
| **Multi-tenant SaaS** | Completo | organizations, RBAC (5+ ruoli) |
| **Gestione Viaggi** | Completo | CRUD, GPS tracking, firma HMAC-SHA256 |
| **Flotta Veicoli** | Completo | CRUD, manutenzione, costi, NATO naming |
| **Turni & Scheduling** | Completo | Calendario mensile, swap, burnout prevention |
| **Inventario Sanitario** | Completo | QR/barcode GS1, scadenze, 3 livelli |
| **Finanza & Contratti** | Completo | Costi orari, revenue models, carbon footprint |
| **PDF/Report** | Completo | UTIF, autorizzazione device, registro volontari |
| **Audit & Compliance** | Completo | Hash chain, GDPR export/erasure, Art. 17 CTS |
| **Booking Hub** | Completo | Portale pubblico prenotazioni |
| **Dashboard Impatto** | Completo | ESG, carbon footprint pubblico |
| **Health Monitor** | Completo | Uptime, SLA violation detection |
| **Demo System** | Completo | Account demo auto-expire |

### Servizi Esterni in Uso (con costi stimati)

| Servizio | Uso | Costo Stimato/anno |
|----------|-----|-------------------|
| **Google Maps API** | Geocoding, autocomplete, directions, distance | ~€2.400-6.000 (dipende dal volume) |
| **Google Cloud Storage** | Upload PDF, loghi, APK, firme | ~€120-360 |
| **Resend** | Email transazionali (inviti, firme, notifiche) | ~€0-240 (free tier fino a 3K/mese) |
| **Stripe** | Pagamenti, sottoscrizioni, webhook | 1.4%+€0.25 per transazione |
| **Railway** | Hosting server + PostgreSQL | ~€60-240 |
| **OSRM** | Calcolo distanze (già integrato nel cost-calculator) | €0 (self-hosted/public) |
| **Totale stimato** | | **~€2.700-7.000/anno** |

### Gap e Funzionalita Mancanti

| Gap | Impatto | Priorita |
|-----|---------|----------|
| Nessun servizio SMS per emergenze | Critico per notifiche urgenti | P0 |
| Nessun meteo integrato | ETA non considera condizioni stradali | P1 |
| Nessun servizio di traduzione | Pazienti stranieri non supportati | P1 |
| Nessuna autenticazione SPID/CIE | Requisito per PA italiane | P1 |
| Nessun sistema di festivi italiani | Turni non considerano festivita | P2 |
| Nessun monitoraggio traffico italiano | Routing non real-time | P1 |
| Nessuna validazione Codice Fiscale/P.IVA | Fatturazione manuale | P2 |
| Nessun OCR per documenti sanitari | Inserimento manuale schede | P2 |
| Nessuna integrazione PagoPA | Pagamenti PA non supportati | P2 |
| Test coverage < 80% | Rischio regressioni | P0 |
| routes.ts monolitico (33K righe) | Manutenibilita critica | P1 |

---

## 2. Servizi Gia in Uso — Analisi Costo/Beneficio

### Google Maps API — Candidato per Sostituzione Parziale

**Costo attuale:** ~€2.400-6.000/anno
**Endpoint usati:** `/api/address-autocomplete`, `/api/directions`, `/api/distance`, `/api/config/maps`

| Funzione Google Maps | Alternativa Gratuita | Risparmio |
|---------------------|---------------------|-----------|
| Geocoding | **Nominatim** (OSM) — completamente gratis, no API key | ~€800/anno |
| Autocomplete | **Geoapify** — 3.000 req/giorno gratis | ~€400/anno |
| Directions | **OSRM** (gia usato!) + **openrouteservice** | ~€600/anno |
| Distance Matrix | **openrouteservice** — 2.000 req/giorno gratis | ~€400/anno |
| Maps Rendering | **Mapbox** free tier (100K/mese) o **Leaflet+OSM** | ~€200/anno |

**Risparmio potenziale: €1.500-2.400/anno** mantenendo Google Maps come fallback premium.

### Resend — Adeguato ma Limitato

**Attuale:** Solo email. Nessun SMS.
**Raccomandazione:** Aggiungere **Brevo (ex Sendinblue)** per SMS (free tier: 300 email/giorno + SMS) come canale secondario.

---

## 3. NUOVE API Scoperte — Classificazione per Modulo

### 3.1 GEOCODING & MAPPE

#### Nominatim (OpenStreetMap)
- **URL:** https://nominatim.org/release-docs/latest/api/Overview/
- **Gratis:** Si, completamente, nessuna API key
- **Modulo target:** Gestione Viaggi, Booking Hub
- **Problema che risolve:** Riduce costo Google Maps Geocoding; geocoding illimitato per indirizzi italiani
- **Risparmio stimato:** €800-1.200/anno
- **Priorita:** Alta
- **Effort:** 8-12 ore (wrapper con fallback a Google Maps)
- **Rischi:** Rate limit 1 req/sec; self-hosting consigliato per produzione (~€20/mese su Hetzner)

#### openrouteservice
- **URL:** https://openrouteservice.org/
- **Gratis:** Si, 2.000 req/giorno, open source self-hostable
- **Modulo target:** Gestione Viaggi, Dispatching
- **Problema che risolve:** **Isochrone API** (aree raggiungibili in X minuti) — fondamentale per copertura territorio; routing alternativo a Google
- **Risparmio stimato:** €600/anno + funzionalita isocrone non disponibili con Google
- **Priorita:** Alta
- **Effort:** 16-24 ore (isochrone view + routing fallback)

#### What3Words
- **URL:** https://what3words.com
- **Gratis:** Si per servizi di emergenza
- **Modulo target:** Gestione Viaggi, Booking Hub
- **Problema che risolve:** Localizzazione precisa quando il paziente non sa dare un indirizzo (adottato da 112 europeo)
- **Risparmio stimato:** Valore qualitativo — riduce tempo di localizzazione del 40%
- **Priorita:** Media
- **Effort:** 8 ore

#### GeoNames
- **URL:** http://www.geonames.org/export/web-services.html
- **Gratis:** Si, nessuna autenticazione
- **Modulo target:** Anagrafica strutture, Booking Hub
- **Problema che risolve:** Database completo comuni/localita italiane, CAP, province
- **Risparmio stimato:** Tempo dev — elimina necessita di database CAP custom
- **Priorita:** Media
- **Effort:** 4 ore

---

### 3.2 METEO & CONDIZIONI STRADALI

#### Open-Meteo
- **URL:** https://open-meteo.com/
- **Gratis:** Completamente gratuito, nessuna API key necessaria
- **Modulo target:** Gestione Viaggi, Dispatching, ETA Calculator
- **Problema che risolve:** ETA dinamico basato su condizioni meteo; alert per ghiaccio/nebbia/pioggia intensa che impattano trasporti sanitari
- **Risparmio stimato:** Riduzione ritardi del 15-20% = valore per SLA compliance
- **Priorita:** Alta
- **Effort:** 12-16 ore (widget meteo + fattore correttivo ETA)

#### RainViewer
- **URL:** https://www.rainviewer.com/api.html
- **Gratis:** Si, nessuna autenticazione
- **Modulo target:** Dispatching, Mappa flotta
- **Problema che risolve:** Overlay radar pioggia in tempo reale sulla mappa di dispatching
- **Risparmio stimato:** Valore operativo — dispatcher vede pioggia in arrivo
- **Priorita:** Media
- **Effort:** 6 ore (overlay su mappa esistente)

#### AQICN (Air Quality)
- **URL:** https://aqicn.org/api/
- **Gratis:** Si con API key gratuita
- **Modulo target:** Gestione Viaggi (pazienti respiratori)
- **Problema che risolve:** Alert qualita aria per trasporti di pazienti con patologie respiratorie
- **Risparmio stimato:** Valore clinico/compliance
- **Priorita:** Bassa
- **Effort:** 4 ore

---

### 3.3 TRAFFICO ITALIANO IN TEMPO REALE

#### CCISS Viaggiare Informati
- **URL:** https://www.cciss.it/
- **Gratis:** Si, dati pubblici
- **Modulo target:** Dispatching, Routing
- **Problema che risolve:** Stato traffico autostrade e strade statali italiane; chiusure, incidenti, cantieri
- **Risparmio stimato:** Riduzione tempi percorrenza del 10-15%
- **Priorita:** Alta
- **Effort:** 16 ore (scraping strutturato + cache)

#### HERE Maps (Traffic)
- **URL:** https://developer.here.com
- **Gratis:** Free tier 250K transazioni/mese
- **Modulo target:** Routing, ETA Calculator
- **Problema che risolve:** Routing traffic-aware specifico per strade italiane; migliore delle alternative per traffico urbano
- **Risparmio stimato:** €0 (free tier generoso) + migliore ETA
- **Priorita:** Alta
- **Effort:** 12 ore (integrazione come provider routing alternativo)

---

### 3.4 SANITA & DATI CLINICI

#### Portale SSN — Lista Strutture Sanitarie
- **URL:** https://www.salute.gov.it/portale/documentazione/p6_2_8.jsp
- **Gratis:** Si, open data
- **Modulo target:** Anagrafica Strutture, Departments
- **Problema che risolve:** Registry completo ospedali, cliniche, RSA, ASL italiane con indirizzi e reparti
- **Risparmio stimato:** Elimina inserimento manuale strutture — 40+ ore dev risparmiate
- **Priorita:** Alta
- **Effort:** 8 ore (import script + sync periodico)

#### Infermedica
- **URL:** https://developer.infermedica.com/docs/
- **Gratis:** Free tier disponibile
- **Modulo target:** Booking Hub, Triage
- **Problema che risolve:** Pre-triage automatico: sintomi in input → classificazione urgenza
- **Risparmio stimato:** Riduzione chiamate non urgenti del 20%
- **Priorita:** Media
- **Effort:** 24 ore

#### openFDA
- **URL:** https://open.fda.gov
- **Gratis:** Si con API key gratuita
- **Modulo target:** Inventario Sanitario
- **Problema che risolve:** Database farmaci e dispositivi medici; cross-reference con inventario ambulanza
- **Risparmio stimato:** Valore compliance — verifica automatica materiale sanitario
- **Priorita:** Bassa
- **Effort:** 8 ore

---

### 3.5 DATI ISTITUZIONALI ITALIANI

#### ISTAT API
- **URL:** https://esploradati.istat.it/databrowser/
- **Gratis:** Si, completamente
- **Modulo target:** Analytics, Pianificazione Flotta
- **Problema che risolve:** Dati demografici per previsione domanda trasporti; densita popolazione per posizionamento mezzi
- **Risparmio stimato:** Valore strategico — decisioni data-driven su espansione servizio
- **Priorita:** Media
- **Effort:** 16 ore (dashboard analytics)

#### Protezione Civile Open Data
- **URL:** https://github.com/pcm-dpc
- **Gratis:** Si, GitHub repos con JSON/CSV
- **Modulo target:** Dispatching, Alert System
- **Problema che risolve:** Alert emergenze (terremoti, alluvioni, incendi) che impattano routing e operativita
- **Risparmio stimato:** Valore critico in caso di emergenza
- **Priorita:** Alta
- **Effort:** 12 ore (webhook + banner alert)

#### SPID/CIE (Identita Digitale)
- **URL:** https://developers.italia.it/it/spid/
- **Gratis:** Si per service provider accreditati
- **Modulo target:** Autenticazione
- **Problema che risolve:** Requisito obbligatorio per servizi PA; autenticazione forte per operatori sanitari
- **Risparmio stimato:** Prerequisito per vendita a PA — potenziale revenue €50K+/anno
- **Priorita:** Alta (per mercato PA)
- **Effort:** 40-60 ore (accreditamento AgID + integrazione SAML)

#### PagoPA
- **URL:** https://developer.pagopa.it/
- **Gratis:** Si per integrazione (commissioni standard su transazioni)
- **Modulo target:** Billing, Fatturazione
- **Problema che risolve:** Pagamenti digitali PA; incasso ticket moderatore; fatturazione ASL/ULSS
- **Risparmio stimato:** Prerequisito per PA — sblocca mercato pubblico
- **Priorita:** Alta (per mercato PA)
- **Effort:** 60-80 ore (accreditamento PSP + integrazione)

---

### 3.6 NOTIFICHE & COMUNICAZIONE

#### Brevo (ex Sendinblue) — SMS + Email
- **URL:** https://developers.sendinblue.com/docs
- **Gratis:** Free tier 300 email/giorno + SMS a consumo (basso)
- **Modulo target:** Notifiche, Alert Emergenze
- **Problema che risolve:** Canale SMS mancante per notifiche urgenti (ritardi, emergenze, conferme)
- **Risparmio stimato:** €0 (free tier) + valore operativo critico
- **Priorita:** Critica
- **Effort:** 8-12 ore

#### Telegram Bot API
- **URL:** https://core.telegram.org/bots/api
- **Gratis:** Completamente gratuito
- **Modulo target:** Notifiche Equipaggio
- **Problema che risolve:** Alert real-time a equipaggi via Telegram (diffusissimo in Italia); gruppo per turno
- **Risparmio stimato:** €0 + riduzione tempo comunicazione del 50%
- **Priorita:** Media
- **Effort:** 12 ore

#### Numverify
- **URL:** https://numverify.com
- **Gratis:** Free tier con API key
- **Modulo target:** Anagrafica Utenti, Pazienti
- **Problema che risolve:** Validazione numeri telefono italiani (+39) prima dell'invio SMS
- **Risparmio stimato:** Riduce SMS falliti del 15%
- **Priorita:** Bassa
- **Effort:** 2 ore

---

### 3.7 DOCUMENTI & PDF

#### CraftMyPDF
- **URL:** https://craftmypdf.com
- **Gratis:** Free tier 100 PDF/mese
- **Modulo target:** Report UTIF, Documenti
- **Problema che risolve:** Template PDF visuali (drag & drop) per report piu complessi; alternativa a pdfkit per template ricorrenti
- **Risparmio stimato:** 20+ ore dev per template complessi
- **Priorita:** Bassa (pdfkit gia integrato e funzionante)
- **Effort:** 8 ore

#### LibreTranslate
- **URL:** https://libretranslate.com/docs
- **Gratis:** Si, self-hostable, open source
- **Modulo target:** Booking Hub, Schede Viaggio
- **Problema che risolve:** Traduzione automatica per pazienti non italofoni (turisti, migranti); self-hostable per GDPR
- **Risparmio stimato:** Valore inclusivita + compliance
- **Priorita:** Media
- **Effort:** 8 ore (self-hosted Docker)

---

### 3.8 CALENDARIO & FESTIVITA

#### Nager.Date
- **URL:** https://date.nager.at
- **Gratis:** Completamente gratuito, nessuna API key
- **Modulo target:** Turni & Scheduling
- **Problema che risolve:** Festivita italiane nazionali per pianificazione turni (maggiorazione festivi, domanda aumentata)
- **Risparmio stimato:** Elimina errori pianificazione turni festivi
- **Priorita:** Alta
- **Effort:** 4 ore

#### Calendarific
- **URL:** https://calendarific.com/
- **Gratis:** Free tier 1.000 req/mese
- **Modulo target:** Turni & Scheduling
- **Problema che risolve:** Festivita regionali italiane (santi patroni) — variano per comune
- **Risparmio stimato:** Valore operativo per sedi multi-regionali
- **Priorita:** Media
- **Effort:** 4 ore

---

### 3.9 SICUREZZA & COMPLIANCE

#### HaveIBeenPwned
- **URL:** https://haveibeenpwned.com/API/v3
- **Gratis:** Free tier con API key
- **Modulo target:** Autenticazione, Security
- **Problema che risolve:** Verifica che password operatori non siano in database di breach noti; compliance GDPR per protezione credenziali
- **Risparmio stimato:** Valore sicurezza — previene accessi non autorizzati
- **Priorita:** Media
- **Effort:** 4 ore (check su registrazione + cambio password)

#### Mozilla HTTP Observatory
- **URL:** https://github.com/mozilla/http-observatory
- **Gratis:** Si, completamente
- **Modulo target:** Infrastruttura
- **Problema che risolve:** Scan automatico security headers del server; verifica configurazione Helmet.js
- **Risparmio stimato:** Valore audit — report sicurezza automatico
- **Priorita:** Bassa
- **Effort:** 2 ore (script CI/CD)

#### GitGuardian
- **URL:** https://api.gitguardian.com/doc
- **Gratis:** Free tier
- **Modulo target:** CI/CD, Repository
- **Problema che risolve:** Scan automatico per secret accidentalmente committati (API key, password)
- **Risparmio stimato:** Previene data breach
- **Priorita:** Alta
- **Effort:** 2 ore (GitHub Action)

---

### 3.10 VALIDAZIONE DATI

#### VATComply
- **URL:** https://www.vatcomply.com/documentation
- **Gratis:** Si, nessuna autenticazione
- **Modulo target:** Billing, Contratti
- **Problema che risolve:** Validazione Partita IVA italiana/europea per fatturazione B2B a strutture sanitarie
- **Risparmio stimato:** Elimina errori fatturazione — 10+ ore/mese di correzioni manuali
- **Priorita:** Media
- **Effort:** 4 ore

#### Agenzia delle Entrate — Validazione CF
- **URL:** Algoritmo locale (nessuna API necessaria — libreria `codicefiscale` npm)
- **Gratis:** Si
- **Modulo target:** Anagrafica Pazienti/Operatori
- **Problema che risolve:** Validazione codice fiscale alla registrazione
- **Risparmio stimato:** Elimina errori anagrafici
- **Priorita:** Alta
- **Effort:** 2 ore

---

### 3.11 QR CODE & CHECK-IN

#### QRCode (libreria gia installata: qrcode npm)
- **URL:** Gia in `package.json`
- **Gratis:** Si
- **Modulo target:** Veicoli, Check-in Autisti
- **Problema che risolve:** Check-in rapido autista su veicolo via QR; verifica inventario pre-turno
- **Risparmio stimato:** 5 min/turno risparmiati = ~150 ore/anno per 10 veicoli
- **Priorita:** Media
- **Effort:** 8 ore (screen scanner + backend)

---

### 3.12 ANALYTICS & ML

#### Keen IO
- **URL:** https://keen.io/
- **Gratis:** Free tier
- **Modulo target:** Analytics, Dashboard Direttore
- **Problema che risolve:** Analytics avanzate su KPI operativi (tempi risposta, utilizzo flotta, costi per viaggio)
- **Risparmio stimato:** Valore decisionale — ottimizzazione flotta del 10-15%
- **Priorita:** Media
- **Effort:** 16 ore

#### Time Door / Unplugg
- **URL:** https://timedoor.io / https://unplu.gg
- **Gratis:** Free tier
- **Modulo target:** Dispatching, Pianificazione
- **Problema che risolve:** Previsione domanda trasporti per fascia oraria/giorno; ottimizzazione turni predittiva
- **Risparmio stimato:** Riduzione overtime del 20% = ~€5.000/anno per cooperativa media
- **Priorita:** Media
- **Effort:** 24 ore

---

## 4. Piano di Integrazione

### Fase 1 — Quick Wins (1-2 settimane, ~60 ore)

| # | API/Servizio | Effort | Risparmio/Valore | Note |
|---|-------------|--------|------------------|------|
| 1 | **Brevo SMS** | 12h | Critico — notifiche urgenti | Canale mancante piu grave |
| 2 | **Nager.Date** (festivita) | 4h | Turni accurati | Zero-config, no API key |
| 3 | **Open-Meteo** | 12h | ETA +15% accuratezza | Zero-config, no API key |
| 4 | **GitGuardian** (CI/CD) | 2h | Sicurezza repository | GitHub Action |
| 5 | **Nominatim** (geocoding fallback) | 12h | €800-1.200/anno | Fallback a Google Maps |
| 6 | **Codice Fiscale** (validazione) | 2h | Elimina errori anagrafici | Libreria npm locale |
| 7 | **VATComply** (P.IVA) | 4h | Fatturazione corretta | No API key necessaria |
| 8 | **HaveIBeenPwned** | 4h | Sicurezza credenziali | Check su registrazione |
| 9 | **Protezione Civile Alert** | 8h | Sicurezza operativa | GitHub JSON feed |
| **Totale Fase 1** | | **~60h** | **€2.000+/anno + valore operativo critico** | |

### Fase 2 — Core Infrastructure (1 mese, ~120 ore)

| # | API/Servizio | Effort | Risparmio/Valore | Note |
|---|-------------|--------|------------------|------|
| 1 | **openrouteservice** (isocrone) | 24h | Copertura territorio visualizzata | Killer feature per dispatching |
| 2 | **HERE Maps** (traffico) | 12h | ETA real-time | Free tier 250K/mese |
| 3 | **CCISS** (traffico IT) | 16h | Routing italiano ottimizzato | Scraping strutturato |
| 4 | **SSN Strutture** (import) | 8h | Elimina data entry strutture | Import una-tantum + sync |
| 5 | **ISTAT API** (demographics) | 16h | Decisioni data-driven | Dashboard analytics |
| 6 | **Telegram Bot** (crew alerts) | 12h | Comunicazione -50% tempi | Molto diffuso in Italia |
| 7 | **LibreTranslate** (traduzioni) | 8h | Inclusivita pazienti stranieri | Self-hosted per GDPR |
| 8 | **QR Check-in** (autisti) | 8h | -5 min/turno | qrcode gia in package.json |
| 9 | **RainViewer** (radar pioggia) | 6h | Overlay mappa dispatching | No API key |
| 10 | **What3Words** | 8h | Localizzazione emergenze | Gratis per EMS |
| **Totale Fase 2** | | **~120h** | **€1.500+/anno + features competitive** | |

### Fase 3 — Innovazione & Mercato PA (2-3 mesi, ~200 ore)

| # | API/Servizio | Effort | Risparmio/Valore | Note |
|---|-------------|--------|------------------|------|
| 1 | **SPID/CIE** | 60h | Sblocca mercato PA (€50K+/anno) | Accreditamento AgID |
| 2 | **PagoPA** | 80h | Pagamenti PA automatizzati | Accreditamento PSP |
| 3 | **Infermedica** (triage) | 24h | -20% chiamate non urgenti | Pre-triage Booking Hub |
| 4 | **Demand Forecasting** (ML) | 24h | -20% overtime (€5K/anno) | Time Door + dati storici |
| 5 | **FSE** (Fascicolo Sanitario) | * | Accesso storia clinica paziente | Richiede convenzione regionale |
| **Totale Fase 3** | | **~200h** | **€55K+/anno revenue potenziale** | |

---

## 5. Risparmio Totale Stimato

### Costi Attuali vs Costi con API Gratuite

| Voce | Attuale (€/anno) | Con API gratuite (€/anno) | Risparmio |
|------|------------------|--------------------------|-----------|
| Google Maps API | 2.400-6.000 | 600-1.200 (solo premium features) | **€1.800-4.800** |
| Email (Resend) | 0-240 | 0 (Brevo free tier) | €0-240 |
| SMS | Non disponibile | 0-120 (Brevo SMS) | **Nuova funzionalita** |
| Meteo | Non disponibile | 0 (Open-Meteo) | **Nuova funzionalita** |
| Traffico IT | Non disponibile | 0 (CCISS + HERE free) | **Nuova funzionalita** |
| Hosting | 60-240 | 60-240 (invariato) | €0 |
| **Subtotale infrastruttura** | **€2.700-7.000** | **€660-1.560** | **€2.000-5.400** |

### ROI dell'Integrazione

| Fase | Investimento (ore dev) | Valore Generato (anno 1) | ROI |
|------|----------------------|--------------------------|-----|
| Fase 1 — Quick Wins | 60h (~€3.000) | €2.000 risparmio + ops critical | 67% + valore qualitativo |
| Fase 2 — Core | 120h (~€6.000) | €1.500 risparmio + competitive advantage | 25% + strategic value |
| Fase 3 — PA Market | 200h (~€10.000) | €55.000+ revenue potenziale | **450%** |
| **Totale** | **380h (~€19.000)** | **€58.500+** | **208%** |

*Stime basate su costo sviluppatore €50/ora e cooperative con 10-20 veicoli.*

---

## 6. Architettura Consigliata

### Pattern di Integrazione

```
                          ┌─────────────────────────────────────┐
                          │         API Gateway Layer           │
                          │   (rate limiting, caching, retry)   │
                          └──────────┬──────────────────────────┘
                                     │
            ┌────────────────────────┼────────────────────────┐
            │                        │                        │
   ┌────────▼────────┐    ┌────────▼────────┐    ┌─────────▼────────┐
   │  Geo Provider    │    │  Weather Provider│    │  Notification    │
   │  Manager         │    │  Manager         │    │  Manager         │
   │                  │    │                  │    │                  │
   │ Primary:         │    │ Primary:         │    │ Primary:         │
   │  Nominatim/ORS   │    │  Open-Meteo      │    │  Brevo (SMS)     │
   │                  │    │                  │    │  Resend (Email)   │
   │ Fallback:        │    │ Fallback:        │    │  Telegram (Chat)  │
   │  Google Maps     │    │  OpenWeatherMap  │    │                  │
   │                  │    │                  │    │ Fallback:        │
   │ Premium:         │    │ Enrichment:      │    │  (degraded mode) │
   │  HERE (traffic)  │    │  AQICN, CCISS    │    │                  │
   └──────────────────┘    └──────────────────┘    └──────────────────┘

   ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
   │  Data Provider    │    │  Auth Provider    │    │  Compliance      │
   │  Manager         │    │  Manager          │    │  Manager         │
   │                  │    │                  │    │                  │
   │ - ISTAT          │    │ Current:         │    │ - GDPR (gia ok)  │
   │ - SSN Strutture  │    │  Session/Token   │    │ - HaveIBeenPwned │
   │ - Prot. Civile   │    │                  │    │ - GitGuardian    │
   │ - Nager.Date     │    │ Future:          │    │ - CF Validation  │
   │ - VATComply      │    │  SPID/CIE (PA)   │    │ - P.IVA Validate │
   │ - GeoNames       │    │                  │    │                  │
   └──────────────────┘    └──────────────────┘    └──────────────────┘
```

### Pattern Raccomandati

1. **Provider Manager Pattern** — Ogni categoria di servizio esterno ha un manager con:
   - Provider primario (gratuito)
   - Fallback (premium/alternativo)
   - Cache Redis/in-memory (TTL per tipo dato)
   - Circuit breaker (evita cascading failures)

2. **Cache Strategy:**
   - Geocoding: cache 30 giorni (indirizzi cambiano raramente)
   - Meteo: cache 30 minuti
   - Traffico: cache 5 minuti
   - Festivita: cache 1 anno
   - Strutture SSN: cache 7 giorni

3. **Multi-Tenant API Key Management:**
   - API key globali per servizi gratuiti
   - API key per-tenant per servizi premium (Google Maps, HERE)
   - Billing pass-through per servizi a consumo

4. **Struttura File Consigliata:**
```
server/
├── providers/
│   ├── geo/
│   │   ├── nominatim.ts
│   │   ├── openrouteservice.ts
│   │   ├── google-maps.ts
│   │   ├── here.ts
│   │   └── index.ts          # GeoProviderManager
│   ├── weather/
│   │   ├── open-meteo.ts
│   │   ├── rainviewer.ts
│   │   └── index.ts          # WeatherProviderManager
│   ├── notifications/
│   │   ├── brevo.ts
│   │   ├── telegram.ts
│   │   └── index.ts          # NotificationManager
│   ├── data/
│   │   ├── istat.ts
│   │   ├── ssn-structures.ts
│   │   ├── protezione-civile.ts
│   │   ├── nager-date.ts
│   │   └── index.ts          # DataProviderManager
│   └── validation/
│       ├── codice-fiscale.ts
│       ├── partita-iva.ts
│       └── index.ts          # ValidationManager
```

---

## 7. Rischi e Mitigazioni

| Rischio | Impatto | Mitigazione |
|---------|---------|-------------|
| Rate limit Nominatim (1 req/sec) | Lentezza geocoding | Cache aggressiva + fallback Google Maps |
| CCISS non ha API ufficiale | Scraping fragile | Parsing resiliente + fallback HERE traffic |
| SPID accreditamento lungo (3-6 mesi) | Ritardo mercato PA | Iniziare processo subito, non blocca Fase 1-2 |
| Open-Meteo downtime | ETA senza meteo | Fallback a OpenWeatherMap (free tier) |
| Brevo SMS costi variabili | Budget imprevedibile | Cap mensile + alert soglia |
| GDPR per API esterne | Rischio compliance | Preferire API self-hostable (Nominatim, LibreTranslate) |
| Vendor lock-in HERE/Google | Dipendenza fornitore | Provider Manager con switch trasparente |
| Multi-tenant API quotas | Esaurimento quota condivisa | Rate limiting per-tenant + quota monitoring |

---

## 8. Tabella Riepilogativa Completa

| # | API | Gratis | Modulo | Priorita | Effort | Risparmio/Valore |
|---|-----|--------|--------|----------|--------|-----------------|
| 1 | Brevo SMS | Free tier | Notifiche | Critica | 12h | Canale mancante |
| 2 | Open-Meteo | Si, no key | ETA/Meteo | Alta | 12h | +15% ETA accuracy |
| 3 | Nominatim | Si, no key | Geocoding | Alta | 12h | €800-1.200/anno |
| 4 | openrouteservice | 2K/giorno | Isocrone/Routing | Alta | 24h | Feature unica |
| 5 | Nager.Date | Si, no key | Turni | Alta | 4h | Turni accurati |
| 6 | GitGuardian | Free tier | CI/CD | Alta | 2h | Sicurezza repo |
| 7 | Protezione Civile | Si, open | Alert | Alta | 8h | Sicurezza ops |
| 8 | SSN Strutture | Si, open | Strutture | Alta | 8h | -40h data entry |
| 9 | Codice Fiscale | npm locale | Validazione | Alta | 2h | Zero errori CF |
| 10 | HERE Maps | 250K/mese | Traffico | Alta | 12h | ETA real-time |
| 11 | SPID/CIE | Si (PA) | Auth | Alta (PA) | 60h | €50K+/anno revenue |
| 12 | PagoPA | Si (PA) | Billing | Alta (PA) | 80h | Mercato PA |
| 13 | CCISS | Si, pubblico | Traffico IT | Alta | 16h | Routing IT |
| 14 | VATComply | Si, no key | Fatturazione | Media | 4h | -10h/mese errori |
| 15 | Telegram Bot | Si, gratis | Crew alerts | Media | 12h | -50% tempi comm. |
| 16 | LibreTranslate | Si, self-host | Traduzioni | Media | 8h | Inclusivita |
| 17 | What3Words | Si (EMS) | Emergenze | Media | 8h | -40% tempo loc. |
| 18 | RainViewer | Si, no key | Dispatching | Media | 6h | Radar pioggia |
| 19 | ISTAT | Si, open | Analytics | Media | 16h | Data-driven |
| 20 | HaveIBeenPwned | Free tier | Security | Media | 4h | Breach check |
| 21 | QR Check-in | In package | Veicoli | Media | 8h | -5min/turno |
| 22 | Calendarific | 1K/mese | Turni regionali | Media | 4h | Santi patroni |
| 23 | GeoNames | Si, no key | CAP/Comuni | Media | 4h | DB comuni IT |
| 24 | Infermedica | Free tier | Triage | Media | 24h | -20% non urgenti |
| 25 | Demand Forecast | Free tier | Planning | Media | 24h | -20% overtime |
| 26 | AQICN | Free key | Qualita aria | Bassa | 4h | Pazienti resp. |
| 27 | CraftMyPDF | 100/mese | PDF template | Bassa | 8h | Template visual |
| 28 | openFDA | Free key | Inventario | Bassa | 8h | DB farmaci |
| 29 | Mozilla Observatory | Si, gratis | Security scan | Bassa | 2h | Audit auto |

---

*Report generato automaticamente dall'analisi del codebase Soccorso Digitale v2.0.0 e del repository public-apis.*
