# VALUTAZIONE D'IMPATTO SULLA PROTEZIONE DEI DATI (DPIA)
## Data Protection Impact Assessment — art. 35 GDPR (Reg. UE 2016/679)

---

| Campo | Valore |
|---|---|
| **Documento** | DPIA — Piattaforma SaaS Soccorso Digitale |
| **Versione** | 1.0 |
| **Data di redazione** | 27 marzo 2026 |
| **Ultima revisione** | 27 marzo 2026 |
| **Prossima revisione obbligatoria** | 27 marzo 2027 |
| **Redatto da** | DPO, Soccorso Digitale S.r.l. |
| **Approvato da** | Legale Rappresentante, Soccorso Digitale S.r.l. |
| **Classificazione** | Riservato — uso interno e regolatorio |

---

## INDICE

1. Premessa e obbligatorietà della DPIA
2. Descrizione sistematica del trattamento
3. Necessità e proporzionalità
4. Privacy by Design e Privacy by Default
5. Valutazione dei rischi per gli interessati
6. Misure di mitigazione adottate
7. Rischio residuo e conclusioni
8. Piano di revisione e monitoraggio
9. Allegati e riferimenti normativi

---

## 1. PREMESSA E OBBLIGATORIETÀ DELLA DPIA

### 1.1 Base normativa

La presente Valutazione d'Impatto sulla Protezione dei Dati (DPIA) è redatta ai sensi dell'art. 35 del Regolamento UE 2016/679 (GDPR) e delle Linee Guida WP248 rev.01 del Gruppo di Lavoro Articolo 29 (adottate dal Comitato Europeo per la Protezione dei Dati, EDPB).

L'obbligo di condurre una DPIA sussiste in presenza di trattamenti che possono presentare un rischio elevato per i diritti e le libertà delle persone fisiche. Il presente trattamento soddisfa almeno tre dei criteri identificati nelle Linee Guida WP248:

- **Dati sensibili o dati di natura altamente personale** (art. 9 GDPR): i dati sul tipo di servizio sanitario di trasporto comportano l'inferenza implicita di informazioni sullo stato di salute del paziente.
- **Trattamento su larga scala**: la piattaforma è destinata a servire molteplici organizzazioni di soccorso su scala nazionale, potenzialmente coprendo tutti i pazienti trasportati dai clienti in Italia.
- **Uso di tecnologie innovative**: geolocalizzazione in tempo reale di veicoli e operatori; architettura multi-tenant SaaS; audit trail crittografico.
- **Profilazione o valutazione di aspetti personali**: i dati operativi (turni, viaggi, performance) riguardano operatori e volontari.
- **Interessati vulnerabili**: i pazienti trasportati sono spesso in condizioni di vulnerabilità fisica, anziani, non autosufficienti o in emergenza.

### 1.2 Soggetti coinvolti

| Ruolo | Soggetto |
|---|---|
| Titolare del trattamento | Organizzazione cliente (es. Croce Europa APS, ALS Soccorso Coop.) |
| Responsabile del trattamento | Soccorso Digitale S.r.l. — C.F./P.IVA da atto costitutivo |
| DPO (Responsabile della Protezione dei Dati) | Nominato internamente da Soccorso Digitale S.r.l. |
| Sub-responsabili | Supabase Inc., Railway Corp., Cloudflare Inc., Stripe Inc., Resend Inc., Sentry Inc., PostHog Inc. |

### 1.3 Consultazione preliminare

Prima dell'avvio del trattamento sono state svolte le seguenti attività:
- Analisi dello schema del database (130+ tabelle) per identificare flussi di dati personali;
- Revisione del codice sorgente per verificare misure tecniche di sicurezza implementate;
- Analisi dei contratti con sub-responsabili del trattamento;
- Consultazione interna del team legale e tecnico.

---

## 2. DESCRIZIONE SISTEMATICA DEL TRATTAMENTO

### 2.1 Natura del trattamento

Soccorso Digitale S.r.l. opera una piattaforma Software-as-a-Service (SaaS) multi-tenant per la gestione integrata dei trasporti sanitari. La piattaforma è erogata come servizio in abbonamento a cooperative, associazioni di volontariato e società che svolgono attività di trasporto sanitario, spesso in regime di convenzionamento con il Servizio Sanitario Nazionale (SSN).

In qualità di Responsabile del trattamento (art. 28 GDPR), Soccorso Digitale S.r.l. tratta dati personali per conto e su istruzione dei Titolari (le organizzazioni clienti), che rimangono i responsabili giuridici del trattamento nei confronti degli interessati.

La piattaforma gestisce i seguenti macro-processi:

1. **Gestione viaggi e trasporti sanitari**: registrazione di ogni servizio di trasporto con dati del paziente, origine, destinazione, equipaggio, chilometraggio, firma crittografica HMAC-SHA256 del record.
2. **Prenotazioni hub**: portale self-service per la prenotazione di trasporti da parte di pazienti o strutture sanitarie.
3. **Gestione operatori e volontari**: turni, formazione, documenti abilitativi, attestati.
4. **GPS tracking**: geolocalizzazione in tempo reale di veicoli e operatori durante i servizi.
5. **Fatturazione e billing**: gestione abbonamenti SaaS, fatturazione verso i clienti organizzazioni.
6. **CRM e prospecting**: gestione dei potenziali clienti (organizzazioni) nel ciclo di vendita.
7. **Comunicazioni email**: notifiche transazionali verso operatori e clienti tramite Resend.
8. **Monitoraggio applicativo**: log di errori via Sentry, analytics di utilizzo via PostHog.
9. **Audit trail**: catena di hash crittografica per garantire l'immodificabilità dei record di servizio.
10. **Backup e disaster recovery**: backup automatici su infrastruttura Railway EU.

### 2.2 Portata del trattamento

| Dimensione | Stima |
|---|---|
| Numero di organizzazioni clienti (Titolari) | Da 1 a diverse decine su scala nazionale |
| Pazienti trasportati (interessati principali) | Potenzialmente decine di migliaia all'anno per organizzazione |
| Operatori/volontari (interessati secondari) | Decine/centinaia per organizzazione |
| Frequenza del trattamento | Continua, 24/7/365 |
| Copertura geografica | Italia, con possibilità di espansione UE |
| Volume di dati stimato | Milioni di record nel corso del ciclo di vita della piattaforma |

### 2.3 Contesto del trattamento

Le organizzazioni clienti operano tipicamente come:
- **Associazioni di promozione sociale (APS)** o **Organizzazioni di volontariato (ODV)**: in convenzione con ASL regionali per il trasporto in emergenza o programmato.
- **Cooperative sociali**: che erogano trasporti sanitari come attività produttiva in regime di contratto con SSN o privato.
- **Imprese private di trasporto sanitario**: con autorizzazioni ministeriali ex D.M. 553/1987 e D.M. 487/1997.

Il trasporto sanitario è un'attività soggetta a obblighi normativi specifici: tenuta del "libro delle uscite" (registro dei servizi), comunicazioni periodiche alle ASL, conservazione decennale dei registri. La piattaforma è progettata per supportare tale compliance normativa.

### 2.4 Finalità del trattamento

| Finalità | Base giuridica ex art. 6 GDPR | Note |
|---|---|---|
| Gestione operativa dei trasporti sanitari | Art. 6(1)(b): esecuzione di contratto con il Titolare | Il Titolare tratta dati del paziente in adempimento di obblighi contrattuali e istituzionali |
| Adempimento obblighi normativi ASL/SSN | Art. 6(1)(c): obbligo legale | Conservazione registro servizi, comunicazioni ASL |
| Sicurezza e anti-frode | Art. 6(1)(f): interesse legittimo | Audit trail crittografico, integrità record |
| Fatturazione del servizio SaaS | Art. 6(1)(b): esecuzione contratto | Solo dati delle organizzazioni clienti |
| Miglioramento della piattaforma (analytics aggregati) | Art. 6(1)(f): interesse legittimo | PostHog con dati anonimizzati/pseudonimizzati |

### 2.5 Categorie di dati trattati

#### Dati relativi ai pazienti (art. 9 GDPR — categorie particolari)

| Categoria | Dato specifico | Qualificazione art. 9 |
|---|---|---|
| Anagrafica paziente | Nome, cognome, codice fiscale, data di nascita, indirizzo, telefono | Dato personale comune (art. 6) |
| Dati sanitari impliciti | Tipo di servizio (emergenza, dialisi, dimissione oncologica, ecc.) | **Art. 9 — dato sulla salute** |
| Dati sanitari impliciti | Struttura di destinazione/origine (ospedale oncologico, dialisi, psichiatria) | **Art. 9 — dato sulla salute** |
| Stato fisico | Anno di nascita, genere (per registro ASL) | Dato personale comune |

**Nota critica**: il tipo di servizio di trasporto sanitario costituisce, per costante orientamento del Garante Privacy italiano e dell'EDPB, un dato idoneo a rivelare informazioni sullo stato di salute del paziente ai sensi dell'art. 9 GDPR. Un trasporto verso un centro di radioterapia, un centro dialisi o un reparto psichiatrico rivela implicitamente la patologia del paziente. Pertanto **tutti i dati dei pazienti connessi ai viaggi sono trattati come dati di categoria particolare ex art. 9 GDPR**.

#### Dati relativi agli operatori/volontari

| Categoria | Dato specifico | Note |
|---|---|---|
| Anagrafica | Nome, cognome, codice fiscale, data di nascita | |
| Contatti | Email, telefono | |
| Professionale | Ruolo, qualifiche, attestati, patente, documenti abilitativi | |
| Operativo | Turni assegnati, servizi effettuati, chilometraggio | |
| Geolocalizzazione | Posizione GPS durante i servizi | Dati di localizzazione — trattamento sensibile |
| Sicurezza | Hash password (bcrypt), token JWT, IP di accesso | |

#### Dati relativi alle organizzazioni clienti

| Categoria | Dato specifico |
|---|---|
| Anagrafica societaria | Ragione sociale, P.IVA, C.F., sede legale |
| Contatti amministrativi | Email, telefono, referenti |
| Billing | Dati di pagamento (tokenizzati su Stripe), storico fatture |
| Contrattuale | Piano abbonamento, data attivazione, SLA |

### 2.6 Flussi di dati e sub-responsabili

```
[Interessato / Paziente]
        |
        v
[Organizzazione Cliente — Titolare]
        |
        v
[Piattaforma Soccorso Digitale]
        |
        |-----> [Supabase EU Frankfurt] — Database PostgreSQL + Auth JWT
        |-----> [Railway EU] — Backend Express.js TypeScript
        |-----> [Stripe EU] — Pagamenti (dati billing organizzazioni)
        |-----> [Resend EU] — Email transazionali
        |-----> [Cloudflare USA-DPF] — CDN/DNS (no dati personali in chiaro)
        |-----> [Sentry USA-DPF] — Error monitoring (stack trace pseudonimizzati)
        |-----> [PostHog EU] — Analytics utilizzo piattaforma (dati aggregati)
```

**Trasferimenti extra-UE**: Cloudflare Inc. (USA) e Sentry Inc. (USA) operano sotto il Data Privacy Framework UE-USA (DPF), meccanismo di garanzia adeguato ai sensi dell'art. 45 GDPR a seguito della Decisione di Adeguatezza della Commissione Europea del 10 luglio 2023. Stripe Inc. utilizza Clausole Contrattuali Standard (SCC) per i trasferimenti extra-UE.

---

## 3. NECESSITÀ E PROPORZIONALITÀ

### 3.1 Necessità di ogni categoria di dati

| Dato | Necessità | Alternativa più limitata valutata |
|---|---|---|
| Nome e CF paziente | Necessario per identificazione univoca richiesta da ASL e per fatturazione SSN | Non applicabile — obbligo normativo |
| Tipo servizio (dialisi, oncologia, ecc.) | Necessario per tariffazione SSN e rendicontazione ASL | Non applicabile — obbligo normativo |
| Indirizzo di prelievo/destinazione | Necessario per routing e documentazione viaggio | Non possibile ridurre: obbligatorio per registro ASL |
| Anno di nascita paziente (non data completa) | Ridotto rispetto alla data completa — solo anno per statistica ASL | Adottata misura di minimizzazione: si raccoglie solo l'anno |
| Genere paziente | Obbligatorio per registro ASL | Non applicabile |
| GPS operatore | Necessario per sicurezza operatori e coordinamento | Limitato ai soli orari di servizio attivo |
| GPS veicolo | Necessario per coordinamento e sicurezza | Limitato ai soli orari di servizio attivo |
| IP di accesso | Necessario per sicurezza e audit di accesso | Conservato per 90 giorni e poi eliminato |
| User-agent browser | Necessario per sicurezza sessione | Conservato per 90 giorni e poi eliminato |
| Stack trace errori (Sentry) | Necessario per manutenzione applicativo | Configurato con before-send scrubbing dati personali |
| Analytics utilizzo (PostHog) | Utile per miglioramento UX, non necessario per il servizio core | Dati aggregati e pseudonimizzati; opt-out disponibile |

### 3.2 Minimizzazione dei dati

Le seguenti misure di minimizzazione sono implementate a livello di schema del database e logica applicativa:

1. **Anno di nascita, non data completa**: il campo `patientBirthYear` raccoglie solo l'anno di nascita del paziente (richiesto per registro ASL), non la data completa, riducendo la possibilità di re-identificazione.

2. **Dati GPS limitati al servizio**: i dati di geolocalizzazione sono raccolti e conservati solo per la durata del servizio attivo. Non esiste tracking permanente degli operatori al di fuori del turno.

3. **Pseudonimizzazione nei log**: i log applicativi (Sentry) sono configurati con regole di scrubbing che rimuovono dati personali identificativi prima dell'invio. Gli stack trace non contengono nome, CF o dati sanitari del paziente.

4. **Separazione billing da dati operativi**: i dati di fatturazione (Stripe) sono completamente separati dai dati operativi sui pazienti. Stripe non riceve mai dati sanitari.

5. **Multi-tenant isolation**: ogni organizzazione cliente può accedere esclusivamente ai propri dati. Il campo `organization_id` è presente su tutte le 130+ tabelle e la Row Level Security (RLS) di Supabase garantisce l'isolamento a livello di database.

### 3.3 Limitazione delle finalità

I dati raccolti per la gestione operativa dei viaggi non vengono utilizzati per finalità incompatibili. In particolare:
- I dati dei pazienti **non vengono utilizzati** per marketing, profilazione commerciale o analisi epidemiologiche non richieste.
- I dati degli operatori **non vengono** condivisi con terze parti non autorizzate.
- I log applicativi **non vengono** incrociati con dati anagrafici per profilazione.
- I dati di analytics (PostHog) sono **aggregati e privi di identificatori personali**.

### 3.4 Periodo di conservazione

| Categoria | Periodo | Base normativa |
|---|---|---|
| Registri viaggi (libro delle uscite) | 10 anni | D.M. 553/1987; prassi ASL |
| Dati anagrafici operatori | Durata rapporto + 5 anni | Art. 2220 c.c.; normativa giuslavoristica |
| Dati anagrafici pazienti | 10 anni (collegati ai viaggi) | Stessa base dei registri viaggi |
| Log di accesso e audit trail | 5 anni | Art. 32 GDPR; linee guida Garante |
| Log applicativi (Sentry) | 90 giorni | Minimizzazione |
| Analytics (PostHog) | 12 mesi aggregati | Minimizzazione |
| Consensi GDPR | 10 anni dalla revoca | Onere probatorio |
| Richieste di accesso/cancellazione | 5 anni | Onere probatorio |
| Dati billing organizzazioni | 10 anni | Art. 2220 c.c.; normativa fiscale |
| Credenziali (hash bcrypt) | Durata account | N/A — gestione sicurezza |

---

## 4. PRIVACY BY DESIGN E PRIVACY BY DEFAULT

### 4.1 Privacy by Design — misure tecniche integrate

La piattaforma implementa i principi di privacy by design ai sensi dell'art. 25 GDPR attraverso le seguenti misure tecniche integrate nell'architettura:

**Isolamento multi-tenant (organization_id)**
Ogni tabella del database (130+) include il campo `organization_id`. La Row Level Security (RLS) di Supabase è configurata per garantire che ogni query restituisca esclusivamente i dati dell'organizzazione autenticata. Non è possibile, a livello di database, che un tenant acceda ai dati di un altro tenant.

**Crittografia dei dati in transit e at rest**
- TLS 1.3 su tutti i canali di comunicazione (client-server, server-database).
- Le credenziali SMTP (configurazioni email delle organizzazioni) sono cifrate con AES-256 prima della memorizzazione nel database.
- Le password degli utenti sono hashate con bcrypt (fattore di lavoro adeguato) prima della memorizzazione.

**Audit trail crittografico HMAC-SHA256**
Ogni record di viaggio, al momento della chiusura, viene firmato crittograficamente con HMAC-SHA256 (file `server/trip-integrity.ts`). Il sistema:
- Canonicalizza il payload del viaggio in modo deterministico.
- Calcola il digest HMAC utilizzando una chiave segreta (`TRIP_INTEGRITY_SECRET`) mai esposta in codice sorgente.
- Memorizza il digest insieme al timestamp di firma.
- Verifica automaticamente l'integrità ad ogni accesso al record.
- In caso di modifica post-firma, imposta lo status `BROKEN` e genera un alert nell'audit trail.
Questo meccanismo è conforme ai requisiti ISO 27001 e garantisce la non ripudiabilità dei record di servizio.

**Separazione degli ambienti**
- Ambiente di produzione separato da ambienti di sviluppo/staging.
- Dati reali mai accessibili in ambienti non di produzione.
- Banner di staging visibile per prevenire confusioni operative.

**Gestione del consenso GDPR**
Il modulo GDPR (`server/gdpr.ts`) implementa:
- Raccolta e tracciamento del consenso per tipo (privacy policy, termini, marketing, analytics, location tracking).
- Versioning delle privacy policy con hash SHA-256 del contenuto.
- Esercizio del diritto di accesso (art. 15): export JSON completo dei dati dell'utente in ≤ 30 giorni.
- Esercizio del diritto alla cancellazione (art. 17): anonimizzazione (non cancellazione, per mantenere integrità audit trail) con conservazione solo dei dati per i quali vige obbligo normativo.
- Revoca del consenso: immediatamente operativa.

### 4.2 Privacy by Default — configurazioni predefinite

- **Dati GPS**: disattivati per default; attivabili solo durante il servizio attivo.
- **Marketing**: opt-out per default; il consenso al marketing deve essere espresso esplicitamente.
- **Analytics tracking**: configurabile per organizzazione; disattivato per default per gli utenti finali (pazienti).
- **Condivisione dati con terze parti**: nessuna condivisione automatica; richiede configurazione esplicita da parte dell'amministratore dell'organizzazione.
- **Visibilità dati tra organizzazioni**: impossibile per design (RLS); nessuna configurazione necessaria.
- **Sessioni JWT**: durata limitata con rotazione obbligatoria; nessuna sessione permanente.

---

## 5. VALUTAZIONE DEI RISCHI PER GLI INTERESSATI

### 5.1 Metodologia di valutazione

La valutazione dei rischi segue la metodologia EBIOS Risk Manager (ANSSI) adattata al contesto GDPR, con scala:
- **Probabilità**: 1 (Rara) — 2 (Possibile) — 3 (Probabile) — 4 (Quasi certa)
- **Gravità**: 1 (Trascurabile) — 2 (Limitata) — 3 (Significativa) — 4 (Massima)
- **Livello di rischio**: Probabilità × Gravità → Basso (1-4) / Medio (5-8) / Alto (9-12) / Critico (13-16)

### 5.2 Tabella dei rischi identificati

| # | Rischio | Probabilità | Gravità | Livello | Categoria GDPR |
|---|---|---|---|---|---|
| R01 | Accesso non autorizzato ai dati sanitari dei pazienti da parte di soggetti terzi (data breach esterno) | 2 | 4 | **8 — Medio-Alto** | Riservatezza |
| R02 | Violazione dell'isolamento multi-tenant: un tenant accede ai dati di un altro tenant | 1 | 4 | **4 — Basso** | Riservatezza |
| R03 | Perdita o corruzione dei dati (failure infrastrutturale, ransomware) | 2 | 3 | **6 — Medio** | Disponibilità / Integrità |
| R04 | Trasferimento extra-UE non conforme di dati sanitari a sub-responsabili non adeguati | 1 | 4 | **4 — Basso** | Conformità normativa |
| R05 | Profilazione non autorizzata dei pazienti attraverso dati aggregati di viaggio | 1 | 3 | **3 — Basso** | Finalità limitata |
| R06 | Re-identificazione di pazienti da dati pseudonimizzati o anonimizzati | 2 | 3 | **6 — Medio** | Riservatezza |
| R07 | Accesso illecito da parte di dipendente/amministratore interno (insider threat) | 2 | 4 | **8 — Medio-Alto** | Riservatezza |
| R08 | Intercettazione delle comunicazioni in transit (man-in-the-middle) | 1 | 4 | **4 — Basso** | Riservatezza |
| R09 | Manipolazione dei record di viaggio post-firma (alterazione dati medicolegali) | 1 | 4 | **4 — Basso** | Integrità |
| R10 | Brute-force o credential stuffing sugli account degli operatori | 2 | 3 | **6 — Medio** | Riservatezza |
| R11 | Esposizione di dati personali in log applicativi o error monitoring | 2 | 2 | **4 — Basso** | Riservatezza |
| R12 | Mancato esercizio dei diritti degli interessati entro i termini (30 giorni) | 2 | 2 | **4 — Basso** | Conformità normativa |
| R13 | Conservazione eccessiva dei dati oltre i periodi stabiliti | 2 | 2 | **4 — Basso** | Limitazione conservazione |
| R14 | Continuità operativa: indisponibilità della piattaforma in caso di emergenza sanitaria | 2 | 3 | **6 — Medio** | Disponibilità |
| R15 | Violazione della confidenzialità dei dati GPS degli operatori (profilazione dei movimenti) | 2 | 3 | **6 — Medio** | Riservatezza |
| R16 | Subappalto non autorizzato o mancato controllo dei sub-responsabili | 1 | 3 | **3 — Basso** | Conformità normativa |

### 5.3 Descrizione analitica dei rischi principali

#### R01 — Accesso non autorizzato ai dati sanitari (data breach esterno)

**Scenario**: un attaccante esterno sfrutta vulnerabilità applicative (SQL injection, IDOR, API endpoint non protetti) o credenziali compromesse per accedere al database contenente dati sanitari dei pazienti.

**Impatto sugli interessati**: i pazienti subirebbero la divulgazione di informazioni sulla loro condizione di salute (tipo di patologia inferibile dal tipo di trasporto), con possibili conseguenze discriminatorie, danni reputazionali, ricatti. La gravità è **massima** per la natura dei dati sanitari.

**Impatto normativo**: obbligo di notifica al Garante entro 72 ore (art. 33 GDPR) e agli interessati se il rischio è elevato (art. 34 GDPR). Potenziali sanzioni ex art. 83 GDPR fino al 4% del fatturato globale.

#### R02 — Violazione isolamento multi-tenant

**Scenario**: un bug nell'applicazione o nella configurazione RLS di Supabase consente a un'organizzazione autenticata di accedere ai dati di un'altra organizzazione. Potrebbe avvenire tramite manipolazione del token JWT o di parametri API.

**Impatto sugli interessati**: esposizione di dati sanitari a soggetti non autorizzati. Impatto **critico** se i dati raggiungono competitor o soggetti non legittimati.

#### R07 — Insider threat

**Scenario**: un dipendente di Soccorso Digitale S.r.l. con accesso privilegiato all'infrastruttura accede abusivamente ai dati di produzione (database, backup, log) esfiltrando dati dei pazienti.

**Impatto**: particolarmente grave per la natura aggregata dei dati (tutti i pazienti di tutte le organizzazioni clienti). Il danno potrebbe essere vendita di dati a terzi, ricatto verso organizzazioni, accesso a dati su personalità note.

#### R06 — Re-identificazione

**Scenario**: la combinazione di anno di nascita + genere + tipo di servizio + struttura di origine/destinazione + data potrebbe consentire la re-identificazione di un paziente in un dataset formalmente anonimizzato, specialmente in contesti geografici ristretti (piccoli comuni, strutture specializzate rare).

**Impatto**: la re-identificazione vanifica le misure di anonimizzazione adottate, esponendo i pazienti. Il rischio è **medio** nella generalità ma può diventare alto in contesti specifici.

---

## 6. MISURE DI MITIGAZIONE ADOTTATE

### 6.1 Tabella delle misure per rischio

| Rischio | Misure di mitigazione | Responsabile |
|---|---|---|
| R01 | TLS 1.3; autenticazione JWT Supabase; rate limiting anti-bruteforce; validazione input; SQL parametrizzato (ORM Drizzle); OWASP Top 10 review | Dev team + DPO |
| R02 | Row Level Security Supabase su tutte le tabelle; organization_id su 130+ tabelle; test di penetrazione isolamento tenant | Dev team |
| R03 | Backup automatici Railway EU; recovery point objective < 24h; recovery time objective < 4h; test di restore periodici | DevOps |
| R04 | DPF per Cloudflare e Sentry (USA); SCC per Stripe; Supabase/Railway/Resend/PostHog in EU; DPA con tutti i sub-responsabili | DPO + Legale |
| R05 | Separazione database operativo da analytics; PostHog configurato senza identificatori personali; nessuna API di profilazione paziente | Dev team |
| R06 | Raccolta solo anno nascita (non data completa); nessun campo altamente discriminante non necessario; policy di minimizzazione | DPO + Dev team |
| R07 | Principio del minimo privilegio per accessi interni; audit trail HMAC di tutte le operazioni; accessi al DB di produzione tracciati e limitati; NDA per tutti i dipendenti | Management + DPO |
| R08 | TLS 1.3 obbligatorio; HSTS header; certificate pinning ove applicabile; nessun fallback a HTTP | Dev team |
| R09 | Firma HMAC-SHA256 di ogni record di viaggio chiuso; status BROKEN automatico ad ogni modifica post-firma; audit log immutabile | Dev team |
| R10 | Rate limiting login (10 tentativi/15 min); bcrypt password; JWT con scadenza breve; monitoraggio tentativi falliti | Dev team |
| R11 | Sentry before-send scrubbing di dati personali; PostHog senza PII; log applicativi senza dati sanitari | Dev team |
| R12 | Sistema automatizzato di gestione richieste GDPR (tabelle `gdprDataExports`, `gdprErasureRequests`); alerting su scadenze 30 giorni | DPO + Dev team |
| R13 | Politica di retention documentata; procedure automatizzate di eliminazione dati scaduti (da implementare nel piano di sviluppo) | DPO |
| R14 | Architettura multi-AZ Railway; Supabase EU Frankfurt ad alta disponibilità; SLA 99.9% | DevOps |
| R15 | GPS attivo solo durante servizio; dati GPS non conservati oltre la durata del viaggio; accesso ai dati GPS limitato a ruoli autorizzati | Dev team |
| R16 | DPA firmati con tutti i sub-responsabili; audit annuale dei sub-responsabili; clausole di subappalto vietato senza autorizzazione | DPO + Legale |

### 6.2 Dettaglio misure tecniche

#### 6.2.1 Isolamento multi-tenant

L'isolamento multi-tenant è implementato a due livelli:

**Livello applicativo**: ogni query al database include il filtro `organization_id` derivato dal JWT dell'utente autenticato. Il middleware `auth-middleware.ts` verifica il token JWT e inietta il contesto dell'organizzazione in ogni richiesta.

**Livello database (Row Level Security)**: Supabase PostgreSQL ha le policy RLS configurate su tutte le tabelle che contengono dati multi-tenant. Le policy garantiscono che:
- `SELECT`: restituisce solo righe dove `organization_id = auth.jwt()->>'organization_id'`
- `INSERT`: consente inserimento solo con `organization_id` corrispondente al contesto autenticato
- `UPDATE/DELETE`: consentiti solo su righe della propria organizzazione

Questo doppio livello garantisce che anche in caso di bug applicativo, il database non restituisce dati di altri tenant.

#### 6.2.2 Crittografia e hashing

| Dato | Algoritmo | Note |
|---|---|---|
| Password utenti | bcrypt (cost factor ≥ 12) | Hash one-way, non reversibile |
| Credenziali SMTP organizzazioni | AES-256-CBC | Chiave in variabile d'ambiente `SMTP_ENCRYPTION_KEY` |
| Firma integrità viaggi | HMAC-SHA256 | Chiave in variabile d'ambiente `TRIP_INTEGRITY_SECRET` |
| Hash contenuto privacy policy | SHA-256 | Per verifica immutabilità testo |
| Hash consenso utente | SHA-256 | Per verifica integrità testo consenso |
| Token di download export GDPR | CSPRNG 32 bytes hex | Scadenza 7 giorni |
| Chiavi non presenti in codice sorgente | Tutte le chiavi crittografiche | Gestite esclusivamente tramite variabili d'ambiente |

#### 6.2.3 Rate limiting

Il sistema implementa rate limiting differenziato per tipologia di endpoint:

| Limiter | Window | Max requests | Endpoint |
|---|---|---|---|
| globalLimiter | 15 min | 1.000 | Tutte le API |
| loginLimiter | 15 min | 10 | `/api/auth/login` |
| authSensitiveLimiter | 15 min | 10 | `/api/auth/register`, `/api/auth/reset-password` |
| publicApiLimiter | 1 min | 30 | API pubbliche |
| publicFormLimiter | 1 ora | 5 | Form trial, demo, contatti |

#### 6.2.4 Audit trail

Il sistema di audit trail (`server/audit.ts`) implementa:
- Log di tutte le operazioni CRUD su dati sensibili.
- Hash chain crittografica: ogni entry dell'audit log include il hash dell'entry precedente, rendendo impossibile l'alterazione di entries storiche senza rompere la catena.
- Campi tracciati per ogni entry: actorId, actorType, actorEmail, ipAddress, userAgent, entityType, entityId, action, previousValue, newValue, timestamp.
- Le entry dell'audit trail sono contrassegnate `isCompliance: true` per quelle rilevanti ai fini normativi, e `isSensitive: true` per quelle relative a dati di categoria particolare.
- **Immutabilità**: le entry dell'audit log non possono essere modificate o cancellate dall'applicazione (solo insert). La cancellazione fisica richiede accesso diretto al database, tracciata a livello infrastrutturale.

#### 6.2.5 Gestione dei diritti degli interessati

Il sistema implementa nativamente:

- **Art. 15 — Diritto di accesso**: endpoint per richiesta export dei propri dati; generazione di file JSON strutturato contenente tutti i dati personali associati all'utente; scadenza entro 30 giorni con alerting automatico; token di download sicuro con scadenza 7 giorni.

- **Art. 17 — Diritto alla cancellazione**: procedura di anonimizzazione (non hard delete, per preservare integrità audit trail e conformità normativa). I dati anagrafici vengono sostituiti con identificatori anonimi (`ANON_[random]`); i record operativi (viaggi) vengono conservati senza riferimenti identificativi per obbligo normativo ASL (10 anni).

- **Art. 7 — Revoca del consenso**: immediata, con effetto su tutte le future elaborazioni; non retroattiva su trattamenti già effettuati in base a consenso.

- **Art. 20 — Portabilità dei dati**: l'export in formato JSON strutturato è compatibile con i requisiti di portabilità.

### 6.3 Misure organizzative

1. **Accordo di trattamento dati (DPA) ex art. 28 GDPR**: stipulato con ogni organizzazione cliente prima dell'attivazione del servizio. Il DPA definisce: finalità e mezzi del trattamento, categorie di dati, misure tecniche e organizzative, obblighi di notifica in caso di data breach, diritti del Titolare sul Responsabile.

2. **Accordi con sub-responsabili**: DPA o equivalente stipulato con ogni sub-responsabile (Supabase, Railway, Cloudflare, Stripe, Resend, Sentry, PostHog). Verifica annuale del rispetto degli accordi.

3. **Formazione del personale**: formazione GDPR obbligatoria per tutti i dipendenti con accesso a dati personali. Aggiornamento annuale.

4. **Procedura di data breach**: procedura documentata per rilevazione, valutazione e notifica del data breach. Notifica al Garante entro 72 ore; notifica agli interessati se rischio elevato.

5. **Nomina del DPO**: DPO nominato ai sensi dell'art. 37 GDPR (il trattamento riguarda dati sanitari su larga scala come attività principale).

---

## 7. RISCHIO RESIDUO E CONCLUSIONI

### 7.1 Tabella rischio residuo post-mitigazione

| # | Rischio | Livello iniziale | Misure adottate | Livello residuo | Accettabilità |
|---|---|---|---|---|---|
| R01 | Accesso non autorizzato esterno | 8 — Medio-Alto | TLS, JWT, rate limiting, input validation, ORM | 3 — Basso | Accettabile |
| R02 | Violazione isolamento multi-tenant | 4 — Basso | RLS Supabase + doppio filtro applicativo | 1 — Minimo | Accettabile |
| R03 | Perdita/corruzione dati | 6 — Medio | Backup Railway EU, alta disponibilità, test restore | 2 — Basso | Accettabile |
| R04 | Trasferimento extra-UE non conforme | 4 — Basso | DPF (Cloudflare, Sentry), SCC (Stripe), EU-first | 1 — Minimo | Accettabile |
| R05 | Profilazione non autorizzata | 3 — Basso | Separazione dati, PostHog senza PII | 1 — Minimo | Accettabile |
| R06 | Re-identificazione | 6 — Medio | Minimizzazione (anno nascita), separazione contesti | 3 — Basso | Accettabile |
| R07 | Insider threat | 8 — Medio-Alto | Audit trail HMAC, principio minimo privilegio, NDA | 4 — Basso | Accettabile |
| R08 | Intercettazione in transit | 4 — Basso | TLS 1.3, HSTS | 1 — Minimo | Accettabile |
| R09 | Manipolazione record post-firma | 4 — Basso | HMAC-SHA256 + status BROKEN automatico | 1 — Minimo | Accettabile |
| R10 | Brute-force credential stuffing | 6 — Medio | Rate limiting, bcrypt, JWT scadente | 2 — Basso | Accettabile |
| R11 | PII in log applicativi | 4 — Basso | Scrubbing Sentry, PostHog senza PII | 1 — Minimo | Accettabile |
| R12 | Mancata risposta a richieste GDPR | 4 — Basso | Sistema automatizzato + alerting scadenze | 2 — Basso | Accettabile |
| R13 | Conservazione eccessiva | 4 — Basso | Policy documentata; procedure automatizzate da implementare | 3 — Basso | Accettabile (monitorare) |
| R14 | Indisponibilità piattaforma | 6 — Medio | Multi-AZ, SLA 99.9%, backup | 3 — Basso | Accettabile |
| R15 | Profilazione movimenti operatori | 6 — Medio | GPS limitato al servizio, accesso ristretto | 2 — Basso | Accettabile |
| R16 | Sub-responsabili non conformi | 3 — Basso | DPA firmati, audit annuale | 1 — Minimo | Accettabile |

### 7.2 Rischi residui non ancora completamente mitigati

**R13 — Conservazione eccessiva**: la policy di retention è documentata ma le procedure automatizzate di eliminazione dei dati scaduti non sono ancora completamente implementate. Si raccomanda l'implementazione di job automatici di pulizia dati entro il prossimo ciclo di sviluppo (Q2 2026). **Il rischio è accettabile nel breve termine** ma richiede attenzione continuativa.

### 7.3 Conclusione

Sulla base della presente valutazione d'impatto:

1. Il trattamento descritto è **necessario e proporzionato** alle finalità perseguite, in quanto strettamente connesso all'erogazione di servizi di trasporto sanitario in conformità con obblighi normativi nazionali.

2. Le misure tecniche e organizzative adottate sono **adeguate e proporzionate** al livello di rischio identificato, in conformità con il principio di accountability ex art. 5(2) GDPR.

3. Il rischio residuo per i diritti e le libertà degli interessati è **basso e accettabile** alla luce delle misure di mitigazione implementate.

4. Il trattamento può **proseguire e avviarsi** nel rispetto delle condizioni descritte nella presente DPIA.

5. **Non è necessaria la consultazione preventiva del Garante** ai sensi dell'art. 36 GDPR, in quanto il rischio residuo non è elevato dopo l'applicazione delle misure di mitigazione.

---

## 8. PIANO DI REVISIONE E MONITORAGGIO

### 8.1 Revisione periodica

La presente DPIA è soggetta a revisione obbligatoria:
- **Annualmente**: revisione completa entro il 27 marzo di ogni anno.
- **Al verificarsi di data breach**: ri-valutazione entro 30 giorni dalla notifica.

### 8.2 Trigger di ri-valutazione anticipata

La DPIA deve essere ri-valutata anticipatamente al verificarsi di uno dei seguenti eventi:

| Trigger | Tempistica |
|---|---|
| Introduzione di nuove categorie di dati personali | Prima dell'avvio del nuovo trattamento |
| Nuovi sub-responsabili o cambio di sub-responsabili | Prima dell'attivazione |
| Modifica dell'architettura di hosting (cambio provider, cambio paese) | Prima della migrazione |
| Nuovo modulo funzionale con impatto sulla privacy | Prima del rilascio in produzione |
| Data breach significativo | Entro 30 giorni dalla notifica al Garante |
| Nuove Linee Guida EDPB rilevanti | Entro 90 giorni dalla pubblicazione |
| Modifica della base giuridica di un trattamento | Prima dell'applicazione |
| Richiesta del Garante o ispezione | Immediatamente |
| Superamento di soglie di volume dati significative (es. 100.000 pazienti) | Al superamento della soglia |

### 8.3 Indicatori di monitoraggio continuativo

| Indicatore | Frequenza | Responsabile |
|---|---|---|
| Numero di data breach (anche minori) | Mensile | DPO |
| Numero di richieste GDPR non evase entro 30 giorni | Mensile | DPO |
| Esito test di penetrazione isolamento tenant | Semestrale | Dev team |
| Verifica conformità sub-responsabili | Annuale | DPO + Legale |
| Audit del principio di minimo privilegio | Semestrale | Management + DPO |
| Verifica integrità backup e procedure di restore | Trimestrale | DevOps |
| Review della policy di retention e dati da eliminare | Trimestrale | DPO |

---

## 9. ALLEGATI E RIFERIMENTI NORMATIVI

### 9.1 Normativa di riferimento

- Regolamento UE 2016/679 (GDPR), in particolare: art. 5, 6, 9, 25, 28, 30, 32, 33, 34, 35, 36, 37
- D.Lgs. 196/2003 (Codice Privacy italiano) come modificato dal D.Lgs. 101/2018
- Linee Guida WP248 rev.01 — EDPB: Data Protection Impact Assessment
- Linee Guida EDPB 07/2020 sul concetto di dati sanitari
- Linee Guida EDPB 05/2022 sull'uso dei dati di localizzazione
- Linee Guida EDPB 01/2021 sulle clausole contrattuali standard
- Provvedimento Garante Privacy n. 186 del 7 marzo 2019 (misure di sicurezza nel settore sanitario)
- D.M. 553/1987 — Standard minimi per il servizio di emergenza sanitaria
- D.M. 487/1997 — Criteri e requisiti per l'autorizzazione al trasporto sanitario

### 9.2 Documenti interni correlati

- Contratto di trattamento dati (DPA) ex art. 28 GDPR — template standard
- Registro delle attività di trattamento ex art. 30 GDPR (documento separato)
- Procedura di gestione data breach
- Procedura di risposta alle richieste degli interessati
- Policy di conservazione e cancellazione dei dati
- Piano di formazione GDPR del personale
- Accordi con sub-responsabili (Supabase, Railway, Cloudflare, Stripe, Resend, Sentry, PostHog)

---

**Firma DPO**: _________________________ | **Data**: 27 marzo 2026

**Firma Legale Rappresentante**: _________________________ | **Data**: 27 marzo 2026

**Revisione successiva programmata**: 27 marzo 2027

---

*Documento riservato — uso interno e regolatorio. Non distribuire senza autorizzazione del DPO di Soccorso Digitale S.r.l.*
