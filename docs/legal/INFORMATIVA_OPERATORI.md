# INFORMATIVA SUL TRATTAMENTO DEI DATI PERSONALI
## Per operatori, autisti, barellieri e volontari
### ex art. 13 Regolamento (UE) 2016/679 (GDPR)

**Versione**: 1.0
**Data di ultima modifica**: Marzo 2026
**Classificazione**: Documento da consegnare all'operatore al momento dell'attivazione dell'account sulla piattaforma

---

## 1. CHI TRATTA I TUOI DATI PERSONALI

### 1.1 Il Titolare del trattamento

Il soggetto che decide le finalità e le modalità del trattamento dei tuoi dati personali nell'ambito del rapporto di lavoro o di volontariato è l'organizzazione con cui hai un rapporto attivo.

Il **Titolare del trattamento** è:

**[NOME ORGANIZZAZIONE CLIENTE]**
Sede legale: [Indirizzo completo]
Codice Fiscale / P.IVA: [numero]
Email privacy: privacy@[organizzazione].it
Telefono: [numero]
Responsabile della protezione dei dati (DPO) / Referente privacy: [Nome Cognome]
Email DPO: [dpo@organizzazione.it]

Tutte le richieste relative ai tuoi dati personali (accesso, rettifica, cancellazione, opposizione al trattamento GPS, ecc.) devono essere indirizzate al Titolare del trattamento ai recapiti sopra indicati.

### 1.2 Il Responsabile del trattamento

Il Titolare utilizza i servizi di **Soccorso Digitale S.r.l.** come **Responsabile del trattamento** ai sensi dell'art. 28 GDPR, per la gestione tecnica della piattaforma informatica attraverso cui vengono organizzati i servizi operativi, i turni, la flotta e le comunicazioni interne.

**Soccorso Digitale S.r.l.**
P.IVA: 02663420236
Email: privacy@soccorsodigitale.app

Soccorso Digitale S.r.l. tratta i tuoi dati esclusivamente su istruzione documentata del Titolare e nel rispetto di uno specifico Accordo sul Trattamento dei Dati (DPA) conforme all'art. 28 GDPR. Non utilizza i tuoi dati per finalità proprie.

---

## 2. QUALI DATI PERSONALI RACCOGLIAMO

Nell'ambito del tuo rapporto di lavoro o di volontariato e dell'utilizzo della piattaforma, trattiamo le seguenti categorie di dati personali che ti riguardano:

### 2.1 Dati anagrafici e identificativi

- **Nome e cognome**: per identificarti univocamente nel sistema e nella documentazione operativa;
- **Codice fiscale**: per gli adempimenti normativi relativi al registro del personale e gli obblighi di rendicontazione verso il SSN;
- **Data di nascita**: per la corretta gestione del rapporto di lavoro o volontariato e la verifica dei requisiti di età;
- **Indirizzo di residenza**: per la gestione amministrativa del rapporto;
- **Numero di telefono**: per le comunicazioni operative (assegnazione turni, alert di servizio, emergenze);
- **Indirizzo email istituzionale o personale**: per le comunicazioni di servizio, l'autenticazione alla piattaforma e le notifiche operative;
- **Fotografia del profilo** (se caricata volontariamente dall'operatore).

### 2.2 Dati di autenticazione e sicurezza

- **Credenziali di accesso**: email e password (conservata esclusivamente in forma di hash bcrypt irreversibile — la password in chiaro non viene mai conservata);
- **Token di autenticazione** (JWT): generati al momento del login, non conservati in chiaro;
- **Dispositivi registrati**: identificativi del dispositivo mobile utilizzato per accedere all'applicazione (app React Native);
- **Log di accesso**: data, ora, indirizzo IP sorgente e dispositivo di ogni accesso alla piattaforma.

### 2.3 Qualifiche, certificazioni e idoneità

- **Tipologia di patente di guida** (es. B, C, D) con numero, data di rilascio e scadenza;
- **Certificazioni e qualifiche professionali** (es. primo soccorso, BLS-D, ACLS, patente CRI, abilitazione al trasporto pazienti critici);
- **Eventuale qualifica professionale sanitaria** (es. infermiere, soccorritore, medico) con numero di iscrizione all'albo professionale;
- **Data di scadenza delle certificazioni**, per la gestione automatica dei promemoria di rinnovo;
- **Idoneità psicofisica attestata dal medico del lavoro** (per i dipendenti): solo la data e l'esito (idoneo / idoneo con limitazioni / non idoneo), non il referto medico completo.

### 2.4 Dati operativi — Turni e disponibilità

- **Calendario delle disponibilità**: giorni e fasce orarie in cui sei disponibile a prestare servizio;
- **Turni assegnati**: data, orario, ruolo (es. autista, barelliere, capo equipaggio), mezzo assegnato;
- **Storico dei servizi effettuati**: elenco dei trasporti eseguiti con data, mezzo, ruolo e colleghi di equipaggio;
- **Presenze e assenze**: registrazione delle presenze ai turni;
- **Rimborsi chilometrici** (per i volontari): dati relativi ai rimborsi calcolati sulla base dei servizi effettuati.

### 2.5 Dati di geolocalizzazione GPS

**Il trattamento dei dati GPS è disciplinato in dettaglio al paragrafo 6 della presente informativa.**

In sintesi:
- La posizione GPS del veicolo e/o del dispositivo mobile viene rilevata **esclusivamente durante i servizi di trasporto attivi**;
- Il tracciamento GPS è attivo solo quando l'app registra un servizio come "in corso";
- Il tracciamento GPS non avviene in background quando l'app non è in uso o quando non è attivo alcun servizio;
- I dati GPS vengono utilizzati per la sicurezza operativa, la pianificazione dei percorsi e la verifica della rendicontazione.

### 2.6 Log di attività sulla piattaforma

- **Log delle azioni eseguite**: ogni operazione significativa eseguita sulla piattaforma (creazione/modifica di un viaggio, check-in/check-out da un turno, accesso ai dati dei pazienti, azioni amministrative) viene registrata con marca temporale e identità dell'utente;
- **Questi log sono part dell'audit trail crittografico della piattaforma** e non possono essere modificati o cancellati dagli utenti operativi.

### 2.7 Comunicazioni interne

- **Messaggi nella chat interna** della piattaforma (se disponibile), limitati alle comunicazioni operative tra operatori dello stesso turno o tra operatori e centrali operative;
- **Notifiche push** ricevute sull'app mobile.

---

## 3. PERCHÉ TRATTIAMO I TUOI DATI — FINALITÀ DEL TRATTAMENTO

I tuoi dati personali sono trattati per le seguenti finalità specifiche:

### 3.1 Gestione del rapporto di lavoro o volontariato

Trattiamo i tuoi dati anagrafici, le qualifiche e i dati operativi per:
- Registrarti come operatore o volontario nel sistema informativo del Titolare;
- Verificare il possesso dei requisiti necessari per svolgere le mansioni assegnate (patente, certificazioni, idoneità);
- Assegnarti i turni di servizio in base alla tua disponibilità e alle necessità operative;
- Calcolare e gestire i rimborsi chilometrici o altre forme di compensazione;
- Gestire le presenze, le assenze e le sostituzioni;
- Adempiere agli obblighi contributivi, previdenziali e fiscali connessi al rapporto di lavoro o volontariato.

### 3.2 Gestione operativa dei servizi di trasporto

Trattiamo i tuoi dati operativi per:
- Assegnarti ai servizi di trasporto in base alle tue qualifiche, disponibilità e posizione geografica;
- Comunicarti le informazioni necessarie per svolgere il servizio (luogo di partenza, destinazione, dati essenziali del paziente);
- Tracciare lo svolgimento del servizio per garantire la corretta rendicontazione verso gli enti committenti (ASL, SUEM, ospedali);
- Documentare l'equipaggio di ogni trasporto nel registro obbligatorio dei trasporti sanitari.

### 3.3 Sicurezza operativa degli operatori (GPS)

Il tracciamento GPS durante i servizi attivi viene effettuato per:
- Garantire la tua sicurezza durante i trasporti, consentendo alla centrale operativa di monitorare la posizione dell'equipaggio;
- Permettere un intervento rapido in caso di emergenza, incidente o necessità di assistenza;
- Ottimizzare la pianificazione dei percorsi e la gestione della flotta;
- Verificare la corretta rendicontazione dei percorsi effettuati.

### 3.4 Adempimenti normativi — Registro del personale

Siamo obbligati dalla normativa vigente a tenere un registro del personale e dei volontari impiegati nell'erogazione di servizi sanitari, comprensivo di qualifiche, certificazioni e turni effettuati, soggetto a controlli delle autorità sanitarie competenti.

### 3.5 Formazione e sviluppo professionale

Utilizziamo i dati relativi alle tue certificazioni e alla loro scadenza per:
- Inviarti promemoria automatici di rinnovo delle certificazioni obbligatorie;
- Pianificare le sessioni di formazione periodica;
- Documentare la tua partecipazione ai corsi di aggiornamento.

### 3.6 Sicurezza informatica e integrità della piattaforma

I log di accesso e di attività sulla piattaforma vengono conservati per:
- Garantire l'integrità dei dati registrati (audit trail);
- Rilevare e gestire eventuali incidenti di sicurezza;
- Consentire indagini forensi in caso di violazione dei dati o utilizzo non autorizzato del sistema.

### 3.7 Comunicazioni operative

Utilizziamo i tuoi dati di contatto per:
- Inviarti notifiche relative ai turni assegnati, alle modifiche di servizio e agli alert operativi;
- Comunicarti informazioni rilevanti per lo svolgimento del tuo ruolo;
- Contattarti in caso di emergenza durante o prima di un servizio.

---

## 4. BASE GIURIDICA DEL TRATTAMENTO

Il trattamento dei tuoi dati si fonda sulle seguenti basi giuridiche:

### 4.1 Esecuzione del contratto di lavoro o volontariato — art. 6(1)(b) GDPR

Il trattamento dei tuoi dati anagrafici, di qualifica e operativi (turni, servizi, rimborsi) è necessario per l'esecuzione del contratto di lavoro subordinato, parasubordinato o del rapporto di volontariato di cui sei parte. Senza questi dati non sarebbe possibile gestire operativamente il tuo rapporto con l'organizzazione.

### 4.2 Obbligo legale — art. 6(1)(c) GDPR

Il trattamento dei tuoi dati per la tenuta del registro del personale sanitario e per la rendicontazione verso le autorità sanitarie e previdenziali è necessario per adempiere a obblighi legali che gravano sul Titolare (D.Lgs. 81/2008 — sicurezza sul lavoro; normativa previdenziale; normativa regionale sul trasporto sanitario).

### 4.3 Interesse legittimo — art. 6(1)(f) GDPR

Il tracciamento GPS della tua posizione durante i servizi attivi è effettuato sulla base dell'**interesse legittimo** del Titolare (e tuo stesso) alla sicurezza operativa. Questo trattamento è necessario per garantire la tua incolumità durante i servizi e per consentire un intervento rapido in caso di emergenza.

Il bilanciamento degli interessi su cui si fonda questa base giuridica è stato verificato tenendo conto che:
- Il tracciamento è limitato ai soli periodi di servizio attivo (non avviene in background o fuori servizio);
- Ti è stato informato preventivamente di questo trattamento con la presente informativa;
- I dati GPS vengono conservati per un periodo limitato (1 anno) e non per finalità di sorveglianza generale del lavoratore;
- Il trattamento persegue uno scopo legittimo di sicurezza che tutela anche i tuoi diritti.

Hai il diritto di opporti a questo trattamento ai sensi dell'art. 21 GDPR (vedi paragrafo 8.6).

### 4.4 Obbligo legale in materia di sicurezza sul lavoro — art. 6(1)(c) GDPR

Il trattamento dei dati relativi all'idoneità psicofisica del lavoratore (solo esito del giudizio medico del lavoro, non il referto completo) è necessario per adempiere agli obblighi di cui al D.Lgs. 81/2008 in materia di sicurezza sul lavoro.

---

## 5. BASE GIURIDICA PER LE CATEGORIE PARTICOLARI DI DATI

I dati relativi alla tua **idoneità psicofisica** (esito del giudizio del medico del lavoro) rientrano nelle categorie particolari ai sensi dell'art. 9 GDPR (dati sulla salute). Il loro trattamento è effettuato sulla base:

- **Art. 9(2)(b) GDPR**: trattamento necessario per assolvere gli obblighi ed esercitare i diritti specifici del titolare del trattamento o dell'interessato in materia di diritto del lavoro e della sicurezza sociale e protezione sociale, nella misura in cui sia autorizzato dal diritto dell'Unione o degli Stati membri (D.Lgs. 81/2008);
- **Art. 9(2)(h) GDPR**: per le finalità di medicina del lavoro.

Trattiamo esclusivamente il **giudizio sintetico** del medico del lavoro (idoneo / idoneo con limitazioni / non idoneo), non il referto medico completo, nel rispetto del principio di minimizzazione dei dati.

---

## 6. IL TRACCIAMENTO GPS — SEZIONE DEDICATA

### 6.1 Cosa tracciamo e quando

La piattaforma raccoglie la posizione geografica (latitudine, longitudine, precisione, velocità) del tuo dispositivo mobile o del veicolo assegnato nelle seguenti sole circostanze:

- Quando l'applicazione mobile è aperta e attiva in primo piano (foreground);
- Quando un servizio di trasporto è registrato come "in corso" nel sistema;
- Quando la funzionalità di tracciamento è esplicitamente attivata dalla centrale operativa per il servizio in corso.

### 6.2 Cosa NON facciamo con il GPS

Il tracciamento GPS **non avviene**:
- Quando l'applicazione è chiusa o in background e non è attivo alcun servizio;
- Al di fuori dell'orario di servizio registrato nel sistema;
- Per monitorare le tue attività al di fuori del contesto lavorativo/di volontariato.

La configurazione tecnica dell'applicazione non consente il tracciamento GPS silenzioso (senza che tu possa rendertene conto dall'interfaccia utente).

### 6.3 Finalità del tracciamento GPS

I dati di geolocalizzazione raccolti durante i servizi vengono utilizzati per:
1. **Sicurezza operativa**: consentire alla centrale operativa di conoscere la posizione dell'equipaggio per interventi di supporto in caso di emergenza;
2. **Ottimizzazione percorsi**: pianificazione del percorso più efficiente verso il paziente o la struttura di destinazione;
3. **Verifica rendicontazione**: confronto tra il percorso registrato e il percorso dichiarato nella rendicontazione verso gli enti committenti;
4. **Ricostruzione eventi**: in caso di incidente o reclamo, possibilità di ricostruire il percorso effettivo.

### 6.4 Conservazione dei dati GPS

I dati di geolocalizzazione GPS vengono conservati per un periodo massimo di **1 anno** dalla data del servizio, al termine del quale vengono cancellati automaticamente. Non è prevista una conservazione indefinita dei dati GPS.

### 6.5 Accesso ai dati GPS

I dati GPS relativi ai servizi effettuati sono accessibili a:
- Il personale della centrale operativa del Titolare durante il servizio in corso;
- I responsabili operativi del Titolare per la verifica della rendicontazione;
- Il personale tecnico di Soccorso Digitale S.r.l. per la manutenzione della piattaforma, limitatamente ai dati tecnici necessari.

### 6.6 Diritto di opposizione al trattamento GPS

Hai il diritto di opporti al tracciamento GPS ai sensi dell'art. 21 GDPR, presentando una richiesta motivata al Titolare del trattamento. Il Titolare valuterà la richiesta tenendo conto delle esigenze di sicurezza operativa e delle previsioni normative applicabili. Qualora l'opposizione sia accolta, l'assegnazione a servizi che richiedano il tracciamento GPS potrà non essere possibile.

---

## 7. PER QUANTO TEMPO CONSERVIAMO I TUOI DATI

I tuoi dati personali vengono conservati per i seguenti periodi, differenziati per categoria:

| Categoria di dati | Periodo di conservazione | Base normativa / motivazione |
|-------------------|--------------------------|------------------------------|
| **Dati anagrafici e di identità** (registro del personale) | **10 anni** dalla cessazione del rapporto | Normativa SSN; registro del personale sanitario; D.Lgs. 196/2003 |
| **Storico dei servizi effettuati** (registro trasporti, equipaggio) | **10 anni** dalla data del servizio | Normativa SSN; obblighi di rendicontazione |
| **Certificazioni e qualifiche** | **10 anni** dalla scadenza del rapporto | Verifica requisiti per eventuali contestazioni; normativa sanitaria |
| **Dati di geolocalizzazione GPS** | **1 anno** dalla data del servizio | Minimizzazione dati; proporzionalità al fine |
| **Log di accesso alla piattaforma** | **2 anni** dalla data di accesso | Sicurezza informatica; audit trail |
| **Log di audit sulle azioni operazionali** | **5 anni** | Integrità dell'audit trail; normativa sicurezza |
| **Dati di rimborso (volontari)** | **10 anni** | Normativa fiscale e previdenziale |
| **Documenti contabili e fiscali** | **10 anni** | Art. 2220 c.c.; D.P.R. 633/1972 |
| **Comunicazioni chat operativa** | **1 anno** | Minimizzazione dati; proporzionalità |
| **Credenziali di autenticazione (hash)** | **Fino alla cessazione dell'account + 30 giorni** | Continuità del servizio durante il periodo di transizione |

Alla cessazione definitiva del tuo rapporto con l'organizzazione, il tuo account viene disattivato immediatamente e i dati vengono conservati per i soli periodi indicati, con accesso strettamente limitato al personale amministrativo autorizzato.

---

## 8. CON CHI CONDIVIDIAMO I TUOI DATI

I tuoi dati personali possono essere condivisi con le seguenti categorie di destinatari:

### 8.1 Personale autorizzato dell'organizzazione (Titolare)

I tuoi dati sono accessibili, nei limiti strettamente necessari per le rispettive funzioni, a:
- Responsabili operativi e coordinatori per la gestione dei turni e l'assegnazione ai servizi;
- Personale della centrale operativa per la gestione in tempo reale dei servizi;
- Colleghi di equipaggio, limitatamente ai dati di contatto e al ruolo assegnato per il servizio in comune;
- Personale amministrativo per la gestione di rimborsi, turni e adempimenti normativi;
- Responsabili della sicurezza per gli adempimenti di cui al D.Lgs. 81/2008.

### 8.2 Soccorso Digitale S.r.l. — Responsabile del trattamento

Come descritto al paragrafo 1.2, gestisce tecnicamente la piattaforma su istruzione del Titolare.

### 8.3 Sub-responsabili tecnici

La piattaforma utilizza i seguenti fornitori tecnici:

| Fornitore | Servizio | Ubicazione dati |
|-----------|----------|-----------------|
| Supabase | Database e autenticazione | EU Frankfurt (Germania) |
| Railway | Infrastruttura server backend | UE |
| Resend | Email operative (notifiche turni, alert) | UE |
| Cloudflare | Protezione sicurezza rete | USA (con garanzie DPF) |
| Sentry | Monitoraggio errori tecnici | USA (con garanzie DPF) |
| PostHog | Analytics aggregati sull'uso dell'app | EU Frankfurt |

### 8.4 Autorità pubbliche e terzi per obbligo di legge

I tuoi dati possono essere comunicati a:
- **ASL, SUEM, Aziende Ospedaliere**: per la rendicontazione dei servizi di trasporto sanitari effettuati per loro conto;
- **INPS, INAIL**: per gli adempimenti previdenziali relativi ai dipendenti;
- **Agenzia delle Entrate**: per gli adempimenti fiscali;
- **Autorità giudiziaria e di polizia**: in caso di richiesta formale o in adempimento di obblighi di legge;
- **Autorità sanitarie regionali**: in caso di ispezione o controllo sul registro del personale sanitario;
- **Medico del lavoro**: per gli accertamenti sanitari di cui al D.Lgs. 81/2008 (solo i dati strettamente necessari).

### 8.5 Divieto di vendita

I tuoi dati personali non vengono mai venduti, ceduti o comunicati a soggetti terzi per finalità commerciali o di marketing.

---

## 9. TRASFERIMENTI DI DATI VERSO PAESI EXTRA-UE

Come indicato per i pazienti, la maggior parte dei tuoi dati è conservata ed elaborata all'interno dell'Unione Europea.

Per i fornitori con sede negli USA (Cloudflare, Sentry) sono operative le garanzie del **Data Privacy Framework UE-USA** (decisione di adeguatezza della Commissione europea, 10 luglio 2023). Per Stripe, eventuali trasferimenti avvengono sulla base di **Clausole Contrattuali Standard** approvate dalla Commissione europea.

Non vengono effettuati trasferimenti verso paesi terzi privi di garanzie appropriate ai sensi degli artt. 45-46 GDPR.

---

## 10. I TUOI DIRITTI IN MATERIA DI PROTEZIONE DEI DATI PERSONALI

Il GDPR ti riconosce i seguenti diritti in relazione al trattamento dei tuoi dati personali:

### 10.1 Diritto di accesso (art. 15 GDPR)

Hai il diritto di ottenere conferma che siano o meno in corso trattamenti di dati che ti riguardano e di ricevere una copia dei dati trattati, incluse informazioni su finalità, categorie di dati, destinatari, periodo di conservazione e trasferimenti extra-UE.

In particolare, puoi richiedere:
- L'elenco dei servizi di trasporto a cui hai partecipato;
- I tuoi dati anagrafici e di qualifica registrati nel sistema;
- I log di accesso alla piattaforma con il tuo account;
- Le comunicazioni ricevute tramite la piattaforma.

### 10.2 Diritto di rettifica (art. 16 GDPR)

Hai il diritto di richiedere la correzione di dati inesatti (es. errore nel numero di patente, nella data di scadenza di una certificazione) o l'integrazione di dati incompleti. Ti invitiamo a segnalare tempestivamente qualsiasi inesattezza.

### 10.3 Diritto alla cancellazione (art. 17 GDPR)

Hai il diritto di richiedere la cancellazione dei tuoi dati quando non siano più necessari per le finalità per cui sono stati raccolti, fatto salvo il rispetto degli obblighi di conservazione normativi indicati al paragrafo 7 (registro del personale sanitario 10 anni, documenti fiscali 10 anni, ecc.).

### 10.4 Diritto di limitazione del trattamento (art. 18 GDPR)

Hai il diritto di richiedere la limitazione del trattamento (sospensione dell'uso dei dati fermo restando la loro conservazione) nei casi previsti dall'art. 18 GDPR (dati inesatti in verifica, trattamento illecito con richiesta di limitazione invece della cancellazione, ecc.).

### 10.5 Diritto alla portabilità (art. 20 GDPR)

Hai il diritto di ricevere i dati che ti riguardano in un formato strutturato e leggibile da dispositivo automatico (JSON, CSV) e di trasmetterli a un altro titolare. La piattaforma implementa funzionalità di esportazione dei dati a supporto di questo diritto.

### 10.6 Diritto di opposizione — in particolare al tracciamento GPS (art. 21 GDPR)

Hai il diritto di opporti, per motivi connessi alla tua situazione particolare, al trattamento dei tuoi dati basato sull'interesse legittimo del Titolare, incluso il **tracciamento GPS** durante i servizi.

**Per esercitare il diritto di opposizione al tracciamento GPS**, invia una richiesta scritta motivata al Titolare agli indirizzi indicati al paragrafo 1.1. Il Titolare risponderà entro 30 giorni comunicandoti se l'opposizione è stata accolta e quali sono le eventuali conseguenze operative (es. limitazione nell'assegnazione a servizi che richiedono il tracciamento).

Il Titolare può non accogliere l'opposizione se dimostra l'esistenza di motivi legittimi cogenti che prevalgono sui tuoi interessi (es. obbligo normativo di monitoraggio degli equipaggi sanitari, esigenze di sicurezza inderogabili).

### 10.7 Diritto di reclamo al Garante

Se ritieni che il trattamento dei tuoi dati personali violi il GDPR, o che le tue richieste non siano state adeguatamente gestite, hai il diritto di proporre reclamo all'**Autorità Garante per la protezione dei dati personali**:

**Garante per la protezione dei dati personali**
Piazza Venezia, 11 — 00187 Roma
Sito web: www.gpdp.it
Email: garante@gpdp.it
PEC: protocollo@pec.gpdp.it
Telefono: (+39) 06.696771

### 10.8 Diritto di non essere sottoposto a decisioni automatizzate

La piattaforma non utilizza sistemi di profilazione automatizzata per adottare decisioni che producano effetti giuridici sugli operatori (es. assegnazione automatica a turni senza possibilità di intervento umano, valutazione delle performance con ricadute sul rapporto di lavoro). L'assegnazione ai turni e ai servizi avviene sotto la supervisione e la responsabilità del coordinatore operativo.

---

## 11. COME ESERCITARE I TUOI DIRITTI

### 11.1 Modalità di invio della richiesta

Per esercitare uno qualsiasi dei diritti elencati al paragrafo 10, invia una richiesta scritta al Titolare del trattamento:

- **Via email**: all'indirizzo privacy dell'organizzazione (vedi paragrafo 1.1);
- **Via posta raccomandata A/R**: alla sede legale dell'organizzazione;
- **Di persona**: presso la sede dell'organizzazione, previa identificazione.

Nella richiesta indica:
- Nome, cognome e identificativo utente sulla piattaforma (se applicabile);
- Il diritto specifico che intendi esercitare;
- I dati specifici a cui si riferisce la richiesta;
- Un recapito per la risposta.

### 11.2 Tempistica

Il Titolare risponde entro **30 giorni** dalla ricezione della richiesta. In caso di richieste complesse, il termine può essere esteso di ulteriori 60 giorni, con comunicazione motivata entro il primo mese.

### 11.3 Gratuità

L'esercizio dei diritti è gratuito, salvo richieste manifestamente infondate o eccessive (art. 12(5) GDPR), per le quali il Titolare può addebitare un contributo spese ragionevole o rifiutare di dare seguito alla richiesta, con motivazione scritta.

---

## 12. SICUREZZA DEI TUOI DATI

Il Titolare e il Responsabile del trattamento adottano le seguenti misure tecniche e organizzative per proteggere i tuoi dati:

**Misure tecniche:**
- TLS 1.2/1.3 per tutte le comunicazioni tra app e server;
- Hash bcrypt per le password (non conservate in chiaro);
- Autenticazione JWT con scadenza e meccanismi di revoca;
- MFA (autenticazione a due fattori) disponibile e raccomandata;
- Separazione dei dati per organizzazione (isolamento multi-tenant);
- Audit trail crittografico HMAC-SHA256 immutabile;
- Monitoraggio 24/7 dell'infrastruttura.

**Misure organizzative:**
- Accesso ai tuoi dati riservato al personale strettamente necessario;
- Formazione periodica del personale in materia di protezione dei dati;
- Procedura documentata per la gestione dei data breach.

---

## 13. INFORMAZIONI SUL RESPONSABILE DEL TRATTAMENTO

**Soccorso Digitale S.r.l.**
P.IVA: 02663420236
Email: privacy@soccorsodigitale.app

Per questioni di natura tecnica relative alla piattaforma (es. problemi di accesso all'app, richieste di esportazione dati tecnici), puoi contattare Soccorso Digitale S.r.l. all'indirizzo indicato. Per tutte le questioni relative ai tuoi diritti e al trattamento dei tuoi dati nell'ambito del rapporto con l'organizzazione, il riferimento principale rimane il Titolare (paragrafo 1.1).

---

## 14. AGGIORNAMENTI ALLA PRESENTE INFORMATIVA

La presente informativa può essere aggiornata in seguito a:
- Modifiche normative o provvedimenti del Garante;
- Modifiche rilevanti alle funzionalità della piattaforma (es. introduzione di nuove funzionalità di tracciamento);
- Modifiche alle finalità del trattamento o all'elenco dei sub-responsabili;
- Risultanze di audit sulla protezione dei dati.

Le modifiche sostanziali sono comunicate agli operatori con un preavviso di almeno **30 giorni** tramite notifica sull'app, email o comunicazione diretta del responsabile operativo, prima della loro entrata in vigore.

Il rifiuto di accettare le modifiche non comporta automaticamente la cessazione del rapporto di lavoro o di volontariato; le implicazioni di tale rifiuto verranno valutate caso per caso dal Titolare in base alla normativa applicabile.

**Cronologia delle versioni:**

| Versione | Data | Descrizione modifiche |
|----------|------|-----------------------|
| 1.0 | Marzo 2026 | Prima emissione |

---

## DICHIARAZIONE DI RICEZIONE DELL'INFORMATIVA

*Da compilare e conservare agli atti dell'organizzazione*

Il/La sottoscritto/a _____________________________________, nato/a a _______________ il _______________, Codice Fiscale _______________________, nella qualità di [ ] dipendente / [ ] volontario / [ ] collaboratore dell'organizzazione [NOME ORGANIZZAZIONE], dichiara di aver ricevuto, letto e compreso la presente Informativa sul trattamento dei dati personali (versione 1.0, marzo 2026) prima dell'attivazione del proprio account sulla piattaforma Soccorso Digitale.

**Presa visione del tracciamento GPS:** [ ] Dichiaro di aver letto e compreso le modalità e le finalità del tracciamento GPS durante i servizi, descritte al paragrafo 6 della presente informativa.

*Luogo e data:* ___________________________________

*Firma:* _________________________________________

---

*Fine documento — INFORMATIVA_OPERATORI.md — Versione 1.0 — Marzo 2026*
*Questo documento è stato predisposto da Soccorso Digitale S.r.l. come modello per le organizzazioni clienti. Ogni organizzazione deve personalizzarlo inserendo i propri dati identificativi, quelli del proprio DPO/referente privacy e, ove applicabile, le specificità del contratto collettivo di lavoro applicato, prima di distribuirlo agli operatori.*
