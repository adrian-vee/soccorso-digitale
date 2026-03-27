# REGISTRO DELLE ATTIVITÀ DI TRATTAMENTO
## ex art. 30, par. 2, Regolamento UE 2016/679 (GDPR)
### Registro del Responsabile del Trattamento

---

| Campo | Valore |
|---|---|
| **Documento** | Registro Attività di Trattamento — Responsabile del Trattamento |
| **Versione** | 1.0 |
| **Data di redazione** | 27 marzo 2026 |
| **Ultima revisione** | 27 marzo 2026 |
| **Prossima revisione obbligatoria** | 27 marzo 2027 |
| **Responsabile del trattamento** | Soccorso Digitale S.r.l. |
| **Sede legale** | [sede legale da atto costitutivo] |
| **C.F./P.IVA** | [C.F./P.IVA da atto costitutivo] |
| **DPO** | Nominato ai sensi dell'art. 37 GDPR — contatto: privacy@soccorsodigitale.it |
| **Classificazione** | Riservato — uso interno e regolatorio |

---

## PREMESSA

Il presente documento costituisce il Registro delle Attività di Trattamento tenuto da **Soccorso Digitale S.r.l.** nella sua qualità di **Responsabile del Trattamento** ai sensi dell'art. 28 GDPR, in conformità con l'obbligo di cui all'art. 30, par. 2, GDPR.

Soccorso Digitale S.r.l. opera una piattaforma Software-as-a-Service (SaaS) multi-tenant per la gestione dei trasporti sanitari, erogata a favore di cooperative, associazioni di volontariato e altre organizzazioni del settore del soccorso (di seguito: "organizzazioni clienti" o "Titolari"). Ogni organizzazione cliente è Titolare del trattamento nei confronti dei propri interessati (pazienti, operatori, volontari); Soccorso Digitale S.r.l. agisce esclusivamente come Responsabile, trattando dati personali per conto e su istruzione scritta dei Titolari.

Il presente registro è distinto dal registro eventualmente tenuto da Soccorso Digitale S.r.l. nella propria qualità di Titolare (per i trattamenti che la riguardano direttamente, come la gestione del personale dipendente, la contabilità interna e il CRM dei propri prospect commerciali).

**Nota sull'architettura multi-tenant**: la piattaforma è progettata in modo che ogni organizzazione cliente operi in un ambiente logicamente isolato. Tutti i dati sono contrassegnati da un identificatore di organizzazione (`organization_id`) e l'accesso ai dati è limitato, sia a livello applicativo che a livello di database (Row Level Security Supabase), alla sola organizzazione autenticata.

---

## INDICE DEI TRATTAMENTI

| N. | Denominazione trattamento | Presenza art. 9 | Pagina |
|---|---|---|---|
| T01 | Gestione viaggi e trasporti sanitari | SI | § 1 |
| T02 | Prenotazioni hub — portale pazienti | SI | § 2 |
| T03 | Gestione operatori e volontari | NO (parziale) | § 3 |
| T04 | GPS tracking veicoli e operatori | NO | § 4 |
| T05 | Fatturazione e billing organizzazioni clienti | NO | § 5 |
| T06 | CRM prospect e clienti (organizzazioni) | NO | § 6 |
| T07 | Comunicazioni email transazionali | NO | § 7 |
| T08 | Log applicativi e monitoraggio (Sentry, PostHog) | NO | § 8 |
| T09 | Audit trail viaggi (HMAC-SHA256) | SI (indiretto) | § 9 |
| T10 | Backup e disaster recovery | SI (indiretto) | § 10 |

---

## T01 — GESTIONE VIAGGI E TRASPORTI SANITARI

### Identificazione

| Campo | Valore |
|---|---|
| **Codice trattamento** | T01 |
| **Denominazione** | Gestione viaggi e trasporti sanitari |
| **Data di avvio** | Data di attivazione della singola organizzazione cliente |
| **Status** | Attivo |

### Parti del trattamento

| Ruolo | Soggetto |
|---|---|
| **Titolare del trattamento** | Organizzazione cliente (es. Croce Europa APS, ALS Soccorso Coop. Sociale, o altra organizzazione aderente) |
| **Responsabile del trattamento** | Soccorso Digitale S.r.l. |
| **Incaricati del trattamento lato Responsabile** | Personale tecnico di Soccorso Digitale S.r.l. con accesso all'infrastruttura (limitato, con principio del minimo privilegio) |

### Categorie di interessati

- Pazienti trasportati dai servizi di soccorso dell'organizzazione cliente
- Operatori sanitari/volontari dell'equipaggio (nella misura in cui i loro dati sono inclusi nel record del viaggio)

### Categorie di dati personali

**Dati del paziente:**
| Dato | Categoria | Qualificazione GDPR |
|---|---|---|
| Nome e cognome | Anagrafica | Art. 6 — dato comune |
| Codice Fiscale | Anagrafica | Art. 6 — dato comune |
| Anno di nascita | Anagrafica | Art. 6 — dato comune |
| Genere | Anagrafica | Art. 6 — dato comune |
| Indirizzo di prelievo | Localizzazione | Art. 6 — dato comune |
| Indirizzo di destinazione | Localizzazione | Art. 6 — dato comune |
| Tipo di servizio (emergenza, dialisi, trasporto oncologico, dimissione, ecc.) | **Sanitario** | **Art. 9 GDPR — categoria particolare** |
| Struttura sanitaria di origine (ospedale, centro dialisi, reparto, ecc.) | **Sanitario (indiretto)** | **Art. 9 GDPR — categoria particolare** |
| Struttura sanitaria di destinazione | **Sanitario (indiretto)** | **Art. 9 GDPR — categoria particolare** |
| Note cliniche/operative sul trasporto | **Sanitario** | **Art. 9 GDPR — categoria particolare** |
| Numero progressivo del servizio | Operativo | Art. 6 — dato comune |

**Dati dell'equipaggio:**
| Dato | Categoria |
|---|---|
| Nome e cognome degli operatori a bordo | Anagrafica — art. 6 |
| Ruolo nell'equipaggio (autista, soccorritore, medico) | Professionale — art. 6 |
| Veicolo utilizzato (targa, codice) | Operativo — art. 6 |
| Chilometri percorsi (iniziali, finali, totali) | Operativo — art. 6 |
| Orario di partenza e rientro | Operativo — art. 6 |
| Firma crittografica HMAC-SHA256 del record | Sicurezza/integrità |

### Finalità del trattamento

1. Registrazione e documentazione di ogni servizio di trasporto sanitario effettuato.
2. Adempimento degli obblighi di rendicontazione verso le Aziende Sanitarie Locali (ASL) e il Servizio Sanitario Nazionale (SSN).
3. Tenuta del "libro delle uscite" (registro dei servizi) richiesto dalla normativa di settore.
4. Coordinamento operativo in tempo reale (assegnazione equipaggio, veicolo, percorso).
5. Generazione di report statistici aggregati per la gestione interna dell'organizzazione cliente.
6. Garanzia dell'integrità medicolegale dei record tramite firma crittografica.

### Base giuridica

| Interessato | Base giuridica ex art. 6 GDPR | Base per dati art. 9 |
|---|---|---|
| Paziente | Art. 6(1)(c): adempimento obbligo legale (normativa ASL/SSN) + art. 6(1)(b): esecuzione contratto con l'organizzazione | Art. 9(2)(h): finalità di medicina preventiva o medicina del lavoro, diagnosi medica, assistenza sanitaria — in combinato con art. 9(3) GDPR e art. 2-sexies D.Lgs. 196/2003 |
| Operatori/equipaggio | Art. 6(1)(b): esecuzione del contratto di lavoro/associazione | N/A (nessun dato sanitario degli operatori nel record di viaggio) |

**Nota**: il trattamento di dati sanitari (art. 9) dei pazienti è giustificato dall'art. 9(2)(h) GDPR in quanto il trasporto sanitario rientra nella nozione di "assistenza sanitaria" in senso ampio. Il Responsabile del trattamento agisce esclusivamente su istruzione del Titolare, il quale ha la responsabilità primaria di verificare la sussistenza della base giuridica adeguata nel proprio specifico contesto operativo.

### Periodo di conservazione

| Dato | Periodo | Base normativa |
|---|---|---|
| Record completo del viaggio (compreso CF paziente) | 10 anni dalla data del servizio | D.M. 553/1987; prassi ASL consolidata; art. 2220 c.c. |
| Dati anagrafici paziente (separati dal record se richiesto art. 17) | 10 anni (necessario per il registro) | Stesso |
| Log operativi accessori non richiesti da ASL | 5 anni | Principio di limitazione conservazione |

### Destinatari e sub-responsabili

| Destinatario | Ruolo | Categoria dati | Misure di garanzia |
|---|---|---|---|
| Supabase Inc. (EU Frankfurt) | Sub-responsabile — Database PostgreSQL + Auth | Tutti i dati del record di viaggio | DPA ex art. 28; hosting in UE; SOC 2 Type II |
| Railway Corp. (EU) | Sub-responsabile — Backend application server | Elaborazione in memoria durante le richieste API | DPA ex art. 28; hosting in UE |
| Cloudflare Inc. (USA) | Sub-responsabile — CDN/DNS | Solo header HTTP, non payload dati personali | DPA ex art. 28; Data Privacy Framework UE-USA |

### Trasferimenti extra-UE

| Sub-responsabile | Paese | Meccanismo di garanzia |
|---|---|---|
| Cloudflare Inc. | USA | Data Privacy Framework UE-USA (Decisione di adeguatezza CE del 10/07/2023) |

Nessun dato sanitario dei pazienti viene trasferito a destinatari extra-UE. Cloudflare gestisce esclusivamente il traffico di rete (CDN/DNS) senza accesso al payload applicativo contenente dati personali in chiaro.

### Misure di sicurezza specifiche

- Firma crittografica HMAC-SHA256 di ogni record chiuso (tamper-evident).
- Row Level Security Supabase: un'organizzazione non può accedere ai record di un'altra.
- Crittografia TLS 1.3 in transit.
- Audit trail di ogni accesso e modifica al record.
- Rate limiting API.

---

## T02 — PRENOTAZIONI HUB — PORTALE PAZIENTI

### Identificazione

| Campo | Valore |
|---|---|
| **Codice trattamento** | T02 |
| **Denominazione** | Prenotazioni hub — portale self-service pazienti |
| **Status** | Attivo |

### Parti del trattamento

| Ruolo | Soggetto |
|---|---|
| **Titolare del trattamento** | Organizzazione cliente che attiva il modulo hub |
| **Responsabile del trattamento** | Soccorso Digitale S.r.l. |

### Categorie di interessati

- Pazienti o loro familiari/caregiver che effettuano prenotazioni di trasporto sanitario tramite il portale web.
- Strutture sanitarie che prenotano trasporti per conto dei pazienti.

### Categorie di dati personali

| Dato | Categoria | Qualificazione GDPR |
|---|---|---|
| Nome e cognome paziente | Anagrafica | Art. 6 — dato comune |
| Codice Fiscale | Anagrafica | Art. 6 — dato comune |
| Data di nascita | Anagrafica | Art. 6 — dato comune |
| Indirizzo di prelievo | Localizzazione | Art. 6 — dato comune |
| Indirizzo di destinazione | Localizzazione | Art. 6 — dato comune |
| Struttura sanitaria di destinazione | **Sanitario (indiretto)** | **Art. 9 GDPR** |
| Tipo di trasporto richiesto | **Sanitario** | **Art. 9 GDPR** |
| Numero di telefono del prenotante | Contatti | Art. 6 — dato comune |
| Email del prenotante | Contatti | Art. 6 — dato comune |
| Note cliniche per l'equipaggio | **Sanitario** | **Art. 9 GDPR** |
| Data e ora richiesta | Operativo | Art. 6 — dato comune |
| IP address del prenotante | Sicurezza | Art. 6 — dato comune |

### Finalità del trattamento

1. Ricezione e gestione delle richieste di prenotazione di trasporto sanitario.
2. Assegnazione della prenotazione all'equipaggio disponibile.
3. Comunicazione di conferma al prenotante.
4. Integrazione con il modulo di gestione viaggi (T01) per la creazione del record di servizio.

### Base giuridica

- **Art. 6(1)(b)**: esecuzione di misure precontrattuali su richiesta dell'interessato (prenotazione del trasporto).
- **Art. 9(2)(h)**: assistenza sanitaria, per i dati di categoria particolare.

### Periodo di conservazione

| Dato | Periodo |
|---|---|
| Prenotazione confermata (convertita in viaggio) | 10 anni (confluisce in T01) |
| Prenotazione annullata | 12 mesi dalla data di annullamento |
| Prenotazione pendente non evasa | 90 giorni, poi cancellazione automatica |
| IP address di prenotazione | 90 giorni |

### Destinatari e sub-responsabili

Gli stessi di T01 (Supabase EU, Railway EU). Il portale di prenotazione è servito tramite Cloudflare CDN (USA-DPF) per la sola componente di rete.

### Trasferimenti extra-UE

Medesime condizioni di T01. Nessun dato sanitario trasferito extra-UE.

### Misure di sicurezza specifiche

- Captcha/rate limiting sul form di prenotazione (max 5 prenotazioni/ora per IP) per prevenire abusi.
- Validazione di tutti i campi di input prima dell'elaborazione.
- Comunicazione di conferma inviata tramite Resend (EU) all'indirizzo email fornito.

---

## T03 — GESTIONE OPERATORI E VOLONTARI

### Identificazione

| Campo | Valore |
|---|---|
| **Codice trattamento** | T03 |
| **Denominazione** | Gestione operatori, dipendenti e volontari dell'organizzazione cliente |
| **Status** | Attivo |

### Parti del trattamento

| Ruolo | Soggetto |
|---|---|
| **Titolare del trattamento** | Organizzazione cliente |
| **Responsabile del trattamento** | Soccorso Digitale S.r.l. |

### Categorie di interessati

- Dipendenti, collaboratori e volontari dell'organizzazione cliente che utilizzano la piattaforma per la gestione operativa.

### Categorie di dati personali

| Dato | Categoria | Qualificazione GDPR |
|---|---|---|
| Nome e cognome | Anagrafica | Art. 6 — dato comune |
| Codice Fiscale | Anagrafica | Art. 6 — dato comune |
| Data di nascita | Anagrafica | Art. 6 — dato comune |
| Indirizzo di residenza | Anagrafica | Art. 6 — dato comune |
| Email (aziendale/associativa) | Contatti | Art. 6 — dato comune |
| Numero di telefono | Contatti | Art. 6 — dato comune |
| Ruolo/qualifica operativa | Professionale | Art. 6 — dato comune |
| Patente di guida (tipo e scadenza) | Professionale/abilitativo | Art. 6 — dato comune |
| Attestati di formazione (BLS, PBLSD, guida sicura, ecc.) | Professionale/abilitativo | Art. 6 — dato comune |
| Documenti abilitativi (porto d'armi, tesserino associativo, ecc.) | Professionale/abilitativo | Art. 6 — dato comune |
| Turni assegnati e effettuati | Operativo | Art. 6 — dato comune |
| Servizi effettuati (collegato a T01) | Operativo | Art. 6 — dato comune |
| Note e comunicazioni interne | Operativo | Art. 6 — dato comune |
| Hash password (bcrypt) | Sicurezza | Art. 6 — dato comune |
| Token JWT di sessione | Sicurezza | Art. 6 — dato comune |
| Log di accesso (IP, user-agent, timestamp) | Sicurezza/audit | Art. 6 — dato comune |

### Finalità del trattamento

1. Gestione delle credenziali di accesso alla piattaforma.
2. Pianificazione e gestione dei turni operativi.
3. Tenuta del registro delle abilitazioni e dei documenti in scadenza (con alerting).
4. Associazione degli operatori ai servizi di trasporto (equipaggio del viaggio).
5. Comunicazioni operative interne (messaggistica, notifiche).
6. Generazione di report per la gestione delle risorse umane dell'organizzazione cliente.

### Base giuridica

- **Art. 6(1)(b)**: esecuzione del contratto di lavoro, collaborazione o associazione.
- **Art. 6(1)(c)**: adempimento di obblighi legali (verifica abilitazioni obbligatorie per il personale del soccorso).
- **Art. 6(1)(f)**: interesse legittimo del Titolare nella sicurezza operativa e nella gestione della piattaforma (per i log di accesso).

### Periodo di conservazione

| Dato | Periodo |
|---|---|
| Account utente attivo | Durata del rapporto |
| Account utente inattivo (cessato) | 5 anni dalla cessazione del rapporto |
| Attestati abilitativi | Durata rapporto + 5 anni (o fino a scadenza dell'abilitazione, il maggiore) |
| Turni e log operativi | 5 anni |
| Log di accesso (IP, user-agent) | 90 giorni |
| Messaggi chat interni | 2 anni |

### Destinatari e sub-responsabili

| Destinatario | Ruolo | Misure di garanzia |
|---|---|---|
| Supabase Inc. (EU Frankfurt) | Sub-responsabile — Database + Auth JWT | DPA; hosting EU; SOC 2 |
| Railway Corp. (EU) | Sub-responsabile — Backend | DPA; hosting EU |
| Resend Inc. (EU) | Sub-responsabile — Email notifiche | DPA; hosting EU |
| Cloudflare Inc. (USA) | Sub-responsabile — CDN/DNS | DPA; DPF UE-USA |

### Trasferimenti extra-UE

Medesime condizioni di T01. Nessun dato sensibile degli operatori trasferito extra-UE.

---

## T04 — GPS TRACKING VEICOLI E OPERATORI

### Identificazione

| Campo | Valore |
|---|---|
| **Codice trattamento** | T04 |
| **Denominazione** | Geolocalizzazione in tempo reale di veicoli e operatori durante i servizi |
| **Status** | Attivo (solo durante orario di servizio) |

### Parti del trattamento

| Ruolo | Soggetto |
|---|---|
| **Titolare del trattamento** | Organizzazione cliente |
| **Responsabile del trattamento** | Soccorso Digitale S.r.l. |

### Categorie di interessati

- Operatori e volontari dell'organizzazione cliente che utilizzano dispositivi mobili durante i servizi.
- Indirettamente, i pazienti trasportati (la posizione del veicolo riflette la posizione del paziente durante il trasporto).

### Categorie di dati personali

| Dato | Categoria | Qualificazione GDPR |
|---|---|---|
| Posizione GPS dell'operatore/veicolo (lat/long) | Localizzazione | Art. 6 — dato comune (ma trattamento di categoria sensibile per impatto) |
| Timestamp delle posizioni rilevate | Localizzazione | Art. 6 — dato comune |
| Identificativo veicolo | Operativo | Art. 6 — dato comune |
| Identificativo operatore associato alla posizione | Operativo — collegato a T03 | Art. 6 — dato comune |
| Velocità e direzione di marcia | Operativo | Art. 6 — dato comune |

**Nota**: sebbene i dati GPS non rientrino formalmente nelle categorie particolari ex art. 9 GDPR, la geolocalizzazione continuativa degli operatori è trattamento ad alto impatto per i diritti fondamentali. In combinazione con i dati di T01, la posizione GPS del veicolo permette di ricostruire i movimenti del paziente, con potenziale qualificazione come dato sanitario indiretto.

### Finalità del trattamento

1. Coordinamento operativo in tempo reale (dispatch center).
2. Sicurezza degli operatori (localizzazione in caso di emergenza).
3. Ottimizzazione dei percorsi e calcolo automatico dei chilometri percorsi.
4. Monitoraggio della flotta per la manutenzione programmata.

### Base giuridica

- **Art. 6(1)(b)**: esecuzione del contratto con l'organizzazione cliente (coordinamento operativo).
- **Art. 6(1)(f)**: interesse legittimo del Titolare nella sicurezza degli operatori e nell'efficienza operativa.

**Limitazione**: il tracking GPS è limitato all'orario di servizio attivo. Non è consentito il tracking continuativo degli operatori al di fuori dei turni di servizio.

### Informativa agli operatori

Il Titolare ha l'obbligo di informare adeguatamente gli operatori del trattamento GPS ai sensi dell'art. 13 GDPR, specificando le finalità, la durata e le modalità del tracking. Soccorso Digitale S.r.l. fornisce al Titolare la documentazione tecnica necessaria per adempiere a tale obbligo.

### Periodo di conservazione

| Dato | Periodo |
|---|---|
| Dati GPS del viaggio (per calcolo km e documentazione ASL) | 10 anni (confluisce in T01 come dato del registro) |
| Dati GPS in tempo reale (non associati a viaggio chiuso) | 24 ore, poi eliminazione automatica |
| Log tracking fuori servizio (se registrato per errore) | Eliminazione immediata entro 24 ore |

### Destinatari e sub-responsabili

Medesimi di T01. I dati GPS sono processati dal backend Railway EU e memorizzati nel database Supabase EU Frankfurt.

### Trasferimenti extra-UE

Nessun dato GPS trasferito extra-UE in chiaro. Cloudflare gestisce esclusivamente il traffico di rete.

---

## T05 — FATTURAZIONE E BILLING ORGANIZZAZIONI CLIENTI

### Identificazione

| Campo | Valore |
|---|---|
| **Codice trattamento** | T05 |
| **Denominazione** | Fatturazione abbonamenti SaaS e gestione billing delle organizzazioni clienti |
| **Status** | Attivo |

### Parti del trattamento

| Ruolo | Soggetto |
|---|---|
| **Titolare del trattamento** | Soccorso Digitale S.r.l. (in questo specifico trattamento, SD è Titolare, non Responsabile) |
| **Responsabile del trattamento** | N/A — trattamento di SD come Titolare |
| **Sub-responsabile** | Stripe Inc. (EU + SCC per extra-UE) |

**Nota**: il trattamento T05 riguarda i dati delle organizzazioni clienti ai fini della fatturazione del servizio SaaS. In questo caso Soccorso Digitale S.r.l. agisce come **Titolare del trattamento** (non come Responsabile), in quanto tratta dati per proprio conto ai fini della propria attività commerciale. Il trattamento è incluso nel presente registro per completezza, ma è formalmente distinto dai trattamenti in cui SD agisce come Responsabile.

### Categorie di interessati

- Rappresentanti legali e referenti amministrativi delle organizzazioni clienti.

### Categorie di dati personali

| Dato | Categoria |
|---|---|
| Ragione sociale / nome organizzazione | Anagrafica societaria |
| P.IVA e Codice Fiscale organizzazione | Fiscale |
| Nome e cognome del referente billing | Anagrafica personale |
| Email del referente billing | Contatti |
| Indirizzo di fatturazione | Anagrafica |
| Piano di abbonamento e storico pagamenti | Contrattuale/Finanziario |
| Dati di pagamento (tokenizzati — Stripe) | Finanziario — mai memorizzati in chiaro |
| ID cliente Stripe | Tecnico/identificativo |

### Finalità del trattamento

1. Emissione delle fatture per l'abbonamento SaaS.
2. Gestione dei pagamenti ricorrenti tramite Stripe.
3. Adempimento obblighi fiscali e contabili.
4. Gestione di rinnovi, upgrade, downgrade e cessazioni del servizio.

### Base giuridica

- **Art. 6(1)(b)**: esecuzione del contratto di abbonamento SaaS.
- **Art. 6(1)(c)**: adempimento di obblighi legali fiscali e contabili (D.P.R. 633/1972, D.P.R. 917/1986).

### Periodo di conservazione

- Fatture e dati di pagamento: **10 anni** dall'emissione (art. 2220 c.c.; normativa fiscale).
- Dati contrattuali: 10 anni dalla cessazione del contratto.
- Dati della carta di credito: **mai memorizzati** — tokenizzati esclusivamente su Stripe.

### Destinatari

| Destinatario | Ruolo | Misure di garanzia |
|---|---|---|
| Stripe Inc. (EU + extra-UE con SCC) | Processore pagamenti | DPA; PCI-DSS Level 1; SCC per eventuali trasferimenti extra-UE |
| Commercialista / Studio contabile di SD | Destinatario — adempimenti fiscali | DPA o accordo di riservatezza |

### Trasferimenti extra-UE

| Destinatario | Paese | Meccanismo |
|---|---|---|
| Stripe Inc. | USA (alcune operazioni) | Clausole Contrattuali Standard (SCC) approvate dalla Commissione Europea |

---

## T06 — CRM PROSPECT E CLIENTI (ORGANIZZAZIONI)

### Identificazione

| Campo | Valore |
|---|---|
| **Codice trattamento** | T06 |
| **Denominazione** | Customer Relationship Management — prospect e clienti organizzazioni del soccorso |
| **Titolare** | Soccorso Digitale S.r.l. (SD come Titolare) |
| **Status** | Attivo |

**Nota**: anche questo trattamento vede SD come Titolare (non come Responsabile), in quanto riguarda la propria attività commerciale.

### Categorie di interessati

- Rappresentanti di organizzazioni di soccorso potenzialmente interessate alla piattaforma (prospect).
- Referenti delle organizzazioni già clienti ai fini della gestione della relazione commerciale.

### Categorie di dati personali

| Dato | Categoria |
|---|---|
| Nome e cognome del referente | Anagrafica |
| Email professionale | Contatti |
| Numero di telefono | Contatti |
| Nome e tipo dell'organizzazione (onlus, cooperativa, ecc.) | Anagrafica societaria |
| Sede e provincia | Localizzazione |
| Fase del ciclo di vendita | Commerciale |
| Note e interazioni commerciali | Commerciale |
| Fonte di acquisizione del contatto | Marketing |
| Consenso al marketing | Consenso |

### Finalità del trattamento

1. Gestione del ciclo di vendita (pipeline commerciale).
2. Comunicazioni commerciali e invio di materiale informativo (solo con consenso o interesse legittimo b2b).
3. Assistenza post-vendita e account management.

### Base giuridica

- **Art. 6(1)(b)**: esecuzione di misure precontrattuali su richiesta dell'interessato.
- **Art. 6(1)(f)**: interesse legittimo di SD nel contattare professionisti del settore del soccorso per attività B2B (bilanciato con le aspettative ragionevoli degli interessati nel settore specifico).
- **Art. 6(1)(a)**: consenso esplicito per comunicazioni di marketing non strettamente legate al servizio.

### Periodo di conservazione

- Dati di prospect non convertiti: 24 mesi dall'ultimo contatto, poi cancellazione o richiesta di aggiornamento del consenso.
- Dati di clienti attivi: durata del rapporto contrattuale + 5 anni.
- Consensi marketing: 3 anni dalla concessione o fino alla revoca (il prima dei due).

### Destinatari

Dati gestiti internamente. Nessun fornitore terzo di CRM esterno attualmente coinvolto. I dati sono memorizzati nel database operativo (Supabase EU).

---

## T07 — COMUNICAZIONI EMAIL TRANSAZIONALI

### Identificazione

| Campo | Valore |
|---|---|
| **Codice trattamento** | T07 |
| **Denominazione** | Comunicazioni email transazionali verso operatori e pazienti/prenotanti |
| **Status** | Attivo |

### Parti del trattamento

| Ruolo | Soggetto |
|---|---|
| **Titolare del trattamento** | Organizzazione cliente (per email verso i propri operatori e pazienti) |
| **Titolare del trattamento** | Soccorso Digitale S.r.l. (per email verso i referenti delle organizzazioni clienti) |
| **Responsabile del trattamento (lato organizzazioni clienti)** | Soccorso Digitale S.r.l. |
| **Sub-responsabile** | Resend Inc. (EU) |

### Categorie di interessati

- Operatori e volontari delle organizzazioni clienti (destinatari di notifiche operative: assegnazione turni, alerting scadenza documenti, ecc.).
- Pazienti/prenotanti (destinatari di conferme di prenotazione, comunicazioni di servizio).
- Referenti delle organizzazioni clienti (destinatari di comunicazioni amministrative e di servizio da SD).

### Categorie di dati personali trasmesse a Resend

| Dato | Nota |
|---|---|
| Indirizzo email del destinatario | Necessario per la consegna |
| Nome del destinatario (nel corpo dell'email) | Per personalizzazione |
| Timestamp di invio | Tecnico |
| ID messaggio | Tecnico |
| Status di consegna (delivered, bounced, opened) | Tecnico — per monitoring qualità |

**Importante**: il corpo delle email transazionali operative non contiene dati sanitari dei pazienti. Le email di conferma prenotazione contengono solo: data, ora, luogo di prelievo — non il tipo di patologia o la struttura sanitaria di destinazione.

### Finalità del trattamento

1. Notifiche operative agli operatori (turni, scadenze, alerting).
2. Conferme di prenotazione ai pazienti/prenotanti.
3. Comunicazioni di servizio e fatturazione verso le organizzazioni clienti.
4. Email di recupero password e sicurezza account.
5. Alerting sistema (errori, manutenzioni programmate).

### Base giuridica

- **Art. 6(1)(b)**: esecuzione del contratto / necessità operativa del servizio.
- **Art. 6(1)(f)**: interesse legittimo per email di sicurezza account.

### Periodo di conservazione

- Log di invio email (Resend): 30 giorni (politica di Resend).
- Storico comunicazioni rilevanti lato SD: 2 anni.

### Destinatari e sub-responsabili

| Destinatario | Ruolo | Misure di garanzia | Paese |
|---|---|---|---|
| Resend Inc. | Sub-responsabile — servizio di invio email | DPA; SOC 2; hosting EU | EU |

### Trasferimenti extra-UE

Resend Inc. opera con server in EU. Nessun trasferimento extra-UE.

---

## T08 — LOG APPLICATIVI E MONITORAGGIO (SENTRY, POSTHOG, UPTIMEROBOT)

### Identificazione

| Campo | Valore |
|---|---|
| **Codice trattamento** | T08 |
| **Denominazione** | Log applicativi, error monitoring e analytics di utilizzo della piattaforma |
| **Titolare** | Soccorso Digitale S.r.l. (SD come Titolare, per il monitoraggio della propria piattaforma) |
| **Status** | Attivo |

### Categorie di interessati

- Utenti della piattaforma (operatori delle organizzazioni clienti) nella misura in cui generano eventi di log durante l'utilizzo.

### Categorie di dati personali

#### Sentry (error monitoring)

| Dato | Categoria | Note |
|---|---|---|
| Stack trace degli errori | Tecnico | Configurato con scrubbing dei dati personali |
| URL della pagina al momento dell'errore | Tecnico | |
| Browser/sistema operativo | Tecnico | |
| Session ID pseudonimizzato | Tecnico/pseudonimizzato | Non collegato all'identità dell'utente |
| IP address dell'utente | Tecnico | Configurato per anonimizzazione parziale |

**Misura critica**: il client Sentry è configurato con `before-send` hook che rimuove dal payload qualsiasi dato personale identificativo (nome, email, CF, dati sanitari) prima dell'invio a Sentry. Gli stack trace non contengono mai dati di pazienti.

#### PostHog (product analytics)

| Dato | Categoria | Note |
|---|---|---|
| Pagine visitate e funzionalità utilizzate | Comportamentale aggregato | Senza dati identificativi |
| Tipo di evento (click, navigazione, ecc.) | Comportamentale | |
| Tipo di organizzazione (aggregato) | Aggregato | Senza identificatori personali |
| Session ID pseudonimizzato | Tecnico/pseudonimizzato | |

**Misura critica**: PostHog è configurato per non trasmettere: nome utente, email, CF, organization_id, o qualsiasi identificatore diretto. I dati sono usati esclusivamente in forma aggregata per migliorare l'UX della piattaforma.

#### UptimeRobot (monitoring disponibilità)

| Dato | Categoria | Note |
|---|---|---|
| Endpoint monitorati (URL) | Tecnico | Solo URL pubblici, nessun dato personale |
| Timestamp e latenza risposta | Tecnico | |

### Finalità del trattamento

1. Identificazione e risoluzione di errori applicativi (Sentry).
2. Miglioramento dell'esperienza utente attraverso analisi aggregate di utilizzo (PostHog).
3. Monitoraggio della disponibilità del servizio (UptimeRobot).
4. Adempimento degli obblighi di sicurezza ex art. 32 GDPR (rilevazione incidenti).

### Base giuridica

- **Art. 6(1)(f)**: interesse legittimo di Soccorso Digitale S.r.l. nella manutenzione, sicurezza e miglioramento della piattaforma.

### Periodo di conservazione

| Strumento | Periodo |
|---|---|
| Sentry error logs | 90 giorni (policy Sentry) |
| PostHog analytics | 12 mesi aggregati |
| UptimeRobot logs | 30 giorni |

### Destinatari e sub-responsabili

| Destinatario | Ruolo | Paese | Meccanismo di garanzia |
|---|---|---|---|
| Sentry Inc. | Sub-responsabile — error monitoring | USA | Data Privacy Framework UE-USA (DPF) |
| PostHog Inc. | Sub-responsabile — product analytics | EU | DPA; hosting EU |
| UptimeRobot | Sub-responsabile — uptime monitoring | UE/USA | DPA; dati tecnici non personali |

### Trasferimenti extra-UE

| Destinatario | Paese | Meccanismo |
|---|---|---|
| Sentry Inc. | USA | Data Privacy Framework UE-USA (Decisione di adeguatezza CE del 10/07/2023) |

---

## T09 — AUDIT TRAIL VIAGGI (HMAC-SHA256)

### Identificazione

| Campo | Valore |
|---|---|
| **Codice trattamento** | T09 |
| **Denominazione** | Audit trail crittografico dei record di viaggio — firma HMAC-SHA256 |
| **Status** | Attivo |

### Parti del trattamento

| Ruolo | Soggetto |
|---|---|
| **Titolare del trattamento** | Organizzazione cliente |
| **Responsabile del trattamento** | Soccorso Digitale S.r.l. |

### Natura del trattamento

Il sistema di audit trail HMAC-SHA256 implementato in `server/trip-integrity.ts` genera, per ogni record di viaggio chiuso, una firma crittografica che consente la verifica dell'integrità del record. Il sistema:

1. Canonicalizza il payload del viaggio in modo deterministico (ordine fisso dei campi).
2. Calcola il digest HMAC-SHA256 utilizzando una chiave segreta (`TRIP_INTEGRITY_SECRET`) mai esposta.
3. Memorizza il digest, l'algoritmo e il timestamp di firma nel record del viaggio.
4. Ad ogni accesso al record, verifica che il digest calcolato corrisponda a quello memorizzato.
5. In caso di discordanza, imposta lo status `BROKEN` e genera un'entry nell'audit trail applicativo.

Il sistema di audit trail applicativo (`server/audit.ts`) gestisce inoltre una hash chain crittografica dove ogni entry include il digest della entry precedente, rendendo impossibile la manipolazione retroattiva delle entry.

### Categorie di interessati

Medesimi di T01 (pazienti e operatori i cui dati sono contenuti nei record di viaggio firmati).

### Categorie di dati personali

Il trattamento T09 **non aggiunge** nuove categorie di dati personali rispetto a T01. Elabora i dati già presenti nel record di viaggio per generare una firma crittografica. La firma stessa (digest hex) non contiene dati personali leggibili.

### Finalità del trattamento

1. Garantire l'immodificabilità dei record di servizio sanitario a fini medicolegali.
2. Conformità ai requisiti di integrità dei dati ex art. 32 GDPR.
3. Supporto agli obblighi di rendicontazione verso le ASL (registro servizi non alterabile).
4. Conformità alle linee guida ISO 27001 sull'integrità dei dati.

### Base giuridica

- **Art. 6(1)(c)**: adempimento di obblighi legali di conservazione e integrità dei registri sanitari.
- **Art. 6(1)(f)**: interesse legittimo del Titolare e del Responsabile nella sicurezza e integrità dei dati.

### Periodo di conservazione

- I digest HMAC e i log di audit sono conservati per il medesimo periodo dei record di viaggio cui si riferiscono: **10 anni**.
- Le entry dell'audit trail applicativo (log di accesso e modifica) sono conservate per **5 anni**.

### Destinatari e sub-responsabili

Medesimi di T01. La firma crittografica è generata dal backend Railway EU e memorizzata nel database Supabase EU Frankfurt.

### Trasferimenti extra-UE

Nessun dato aggiuntivo trasferito extra-UE rispetto a T01.

### Misure di sicurezza specifiche

- La chiave `TRIP_INTEGRITY_SECRET` è gestita esclusivamente come variabile d'ambiente; mai presente nel codice sorgente o in file di configurazione versionati.
- La rotazione della chiave comporta la ri-firma di tutti i record storici (procedura documentata separatamente).
- L'accesso alla chiave è limitato al processo backend in esecuzione; nessun operatore umano ha accesso diretto in produzione.

---

## T10 — BACKUP E DISASTER RECOVERY

### Identificazione

| Campo | Valore |
|---|---|
| **Codice trattamento** | T10 |
| **Denominazione** | Backup dei dati e procedure di disaster recovery |
| **Status** | Attivo |

### Parti del trattamento

| Ruolo | Soggetto |
|---|---|
| **Titolare del trattamento** | Organizzazione cliente (per i propri dati operativi) e Soccorso Digitale S.r.l. (per i dati della piattaforma) |
| **Responsabile del trattamento** | Soccorso Digitale S.r.l. |
| **Sub-responsabili** | Railway Corp. (EU), Supabase Inc. (EU Frankfurt) |

### Natura del trattamento

Il trattamento di backup consiste nella creazione di copie di sicurezza dell'intero database PostgreSQL (contenente tutte le categorie di dati dei trattamenti T01-T09) e degli asset applicativi, con l'obiettivo di garantire la disponibilità e il ripristino dei dati in caso di incidente (failure hardware, attacco ransomware, errore umano, disastro naturale).

### Categorie di interessati

Tutti gli interessati i cui dati sono presenti nella piattaforma: pazienti (T01, T02), operatori/volontari (T03), referenti organizzazioni (T05, T06).

### Categorie di dati personali

Tutte le categorie di dati personali presenti nel database, compresi i dati di categoria particolare ex art. 9 GDPR (tipo di servizio sanitario, strutture di destinazione/origine dei pazienti).

### Finalità del trattamento

1. Garantire la continuità operativa del servizio (Business Continuity).
2. Ripristino dei dati in caso di incidente informatico.
3. Adempimento degli obblighi di disponibilità e resilienza ex art. 32(1)(c)(d) GDPR.
4. Soddisfacimento dei requisiti contrattuali di SLA verso le organizzazioni clienti.

### Base giuridica

- **Art. 6(1)(c)**: adempimento dell'obbligo di garantire la disponibilità e la resilienza dei sistemi ex art. 32 GDPR.
- **Art. 6(1)(b)**: adempimento degli obblighi contrattuali di SLA verso i Titolari.

### Caratteristiche tecniche del backup

| Parametro | Valore |
|---|---|
| Provider backup | Railway Corp. (EU) + Supabase Point-in-Time Recovery (EU Frankfurt) |
| Frequenza backup | Giornaliero (full) + continuo (WAL per PITR Supabase) |
| Recovery Point Objective (RPO) | < 24 ore (Railway); < 5 minuti (Supabase PITR) |
| Recovery Time Objective (RTO) | < 4 ore |
| Crittografia backup | Cifrati at rest dall'infrastruttura Supabase/Railway |
| Localizzazione geografica backup | Unione Europea (UE/SEE) |
| Retention backup | 30 giorni (backup giornalieri); 7 giorni (backup incrementali) |
| Test di restore | Trimestrale |

### Periodo di conservazione dei backup

- I backup sono conservati per **30 giorni** (rolling). Dopo tale periodo, i backup più vecchi vengono automaticamente eliminati.
- I dati di produzione rimangono soggetti ai periodi di conservazione definiti per ciascun trattamento (T01-T09).

### Destinatari e sub-responsabili

| Destinatario | Ruolo | Paese | Misure di garanzia |
|---|---|---|---|
| Railway Corp. | Sub-responsabile — hosting applicativo + backup | EU | DPA; ISO 27001 |
| Supabase Inc. | Sub-responsabile — database + PITR | EU (Frankfurt) | DPA; SOC 2 Type II; crittografia at rest |

### Trasferimenti extra-UE

I backup sono conservati esclusivamente in infrastrutture EU. Nessun trasferimento extra-UE di dati di backup.

### Misure di sicurezza specifiche

- I backup sono cifrati at rest con le misure standard dell'infrastruttura (Railway e Supabase).
- L'accesso ai backup è limitato al personale DevOps di Soccorso Digitale S.r.l. con necessità operativa (principio del minimo privilegio).
- I test di restore sono documentati con registro delle verifiche.
- In caso di data breach che coinvolga i backup, si applicano le medesime procedure di notifica al Garante ex art. 33 GDPR.

---

## SEZIONE TRASVERSALE: SUB-RESPONSABILI DEL TRATTAMENTO

La tabella seguente riepiloga tutti i sub-responsabili del trattamento coinvolti nella piattaforma Soccorso Digitale, con i relativi meccanismi di garanzia per i trasferimenti extra-UE.

| Sub-responsabile | Paese server | Servizio | Trattamenti coinvolti | Meccanismo garanzia extra-UE | DPA stipulato |
|---|---|---|---|---|---|
| Supabase Inc. | EU (Frankfurt) | Database PostgreSQL + Auth JWT | T01-T10 | N/A (EU) | Sì |
| Railway Corp. | EU | Backend Express.js, hosting | T01-T10 | N/A (EU) | Sì |
| Stripe Inc. | EU + USA | Processore pagamenti | T05 | SCC (Commissione Europea) | Sì |
| Resend Inc. | EU | Servizio email transazionale | T07 | N/A (EU) | Sì |
| Cloudflare Inc. | USA | CDN / DNS | T01-T10 (traffico rete) | Data Privacy Framework UE-USA | Sì |
| Sentry Inc. | USA | Error monitoring | T08 | Data Privacy Framework UE-USA | Sì |
| PostHog Inc. | EU | Product analytics | T08 | N/A (EU) | Sì |

---

## SEZIONE TRASVERSALE: DIRITTI DEGLI INTERESSATI

Per tutti i trattamenti in cui Soccorso Digitale S.r.l. agisce come Responsabile del trattamento, i diritti degli interessati sono esercitabili **nei confronti del Titolare del trattamento** (l'organizzazione cliente). Soccorso Digitale S.r.l. si impegna, tramite i DPA stipulati con i Titolari, a:

- Fornire assistenza tecnica al Titolare per l'evasione delle richieste degli interessati.
- Eseguire le operazioni tecniche necessarie (export dati, anonimizzazione) su richiesta e istruzione del Titolare.
- Rispettare i termini di legge (30 giorni) per l'evasione delle richieste.

Il sistema implementa nativamente il supporto all'esercizio dei seguenti diritti:

| Diritto | Art. GDPR | Implementazione tecnica |
|---|---|---|
| Diritto di accesso | Art. 15 | Export JSON di tutti i dati dell'utente tramite `gdprDataExports` |
| Diritto di rettifica | Art. 16 | Modifica dati tramite interfaccia; tracciata in audit log |
| Diritto alla cancellazione | Art. 17 | Anonimizzazione; conservazione dati per obbligo normativo con nota |
| Diritto alla limitazione | Art. 18 | Sospensione account con conservazione dati |
| Diritto alla portabilità | Art. 20 | Export in formato JSON strutturato e leggibile da macchina |
| Diritto di opposizione | Art. 21 | Revoca consenso marketing; opt-out analytics |
| Revoca del consenso | Art. 7(3) | Immediata tramite interfaccia utente |

---

## SEZIONE TRASVERSALE: MISURE DI SICUREZZA EX ART. 32 GDPR

Le seguenti misure di sicurezza sono applicate trasversalmente a tutti i trattamenti:

### Misure tecniche

| Misura | Implementazione | Trattamenti coperti |
|---|---|---|
| Crittografia in transit | TLS 1.3 obbligatorio su tutti i canali | T01-T10 |
| Crittografia at rest (credenziali SMTP) | AES-256-CBC | T07 |
| Hashing password | bcrypt (cost factor ≥ 12) | T03 |
| Firma crittografica record | HMAC-SHA256 | T01, T09 |
| Isolamento multi-tenant | organization_id + RLS Supabase su 130+ tabelle | T01-T04, T07-T09 |
| Autenticazione a due fattori | JWT Supabase con scadenza breve | T03 |
| Rate limiting anti-bruteforce | 10 tentativi/15 min su login | T03 |
| Rate limiting API globale | 1000 req/15 min | T01-T09 |
| Audit trail immutabile | Hash chain HMAC su ogni entry | T01-T09 |
| Validazione input | Validazione schema su tutti gli endpoint | T01-T09 |
| Privacy by default | GPS disattivato fuori servizio; marketing opt-out; analytics aggregati | T04, T06, T08 |

### Misure organizzative

| Misura | Dettaglio |
|---|---|
| DPA ex art. 28 GDPR | Stipulato con ogni organizzazione cliente prima dell'attivazione |
| DPA con sub-responsabili | Stipulato con tutti i sub-responsabili (tabella sopra) |
| Procedura data breach | Notifica Garante entro 72 ore; notifica interessati se rischio elevato |
| Formazione GDPR personale | Obbligatoria per tutti i dipendenti con accesso a dati personali; aggiornamento annuale |
| Principio del minimo privilegio | Accesso al database di produzione limitato al personale con necessità operativa |
| NDA dipendenti | Accordo di riservatezza per tutti i dipendenti che trattano dati personali |
| DPIA | Redatta e aggiornata annualmente |

---

## FIRMA E APPROVAZIONE

| Campo | Valore |
|---|---|
| **Responsabile della tenuta del registro** | DPO, Soccorso Digitale S.r.l. |
| **Contatto DPO** | privacy@soccorsodigitale.it |
| **Data ultima revisione** | 27 marzo 2026 |
| **Prossima revisione obbligatoria** | 27 marzo 2027 |
| **Trigger di revisione anticipata** | Nuovi trattamenti, nuovi sub-responsabili, data breach, modifiche normative |

**Firma DPO**: _________________________ | **Data**: 27 marzo 2026

**Firma Legale Rappresentante**: _________________________ | **Data**: 27 marzo 2026

---

*Documento riservato — uso interno e regolatorio. Da aggiornare ad ogni variazione dei trattamenti, dei sub-responsabili o della base normativa applicabile. Non distribuire senza autorizzazione del DPO di Soccorso Digitale S.r.l.*
