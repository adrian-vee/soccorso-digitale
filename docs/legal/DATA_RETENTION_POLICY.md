# POLICY DI CONSERVAZIONE E CANCELLAZIONE DEI DATI PERSONALI

**Documento:** DATA_RETENTION_POLICY
**Versione:** 1.0
**Data di approvazione:** 27 marzo 2026
**Approvato da:** DPO — Soccorso Digitale S.r.l.
**Prossima revisione:** 27 marzo 2027
**Classificazione:** Documento interno — uso esterno su richiesta autorizzata

---

## 1. SCOPO E AMBITO DI APPLICAZIONE

### 1.1 Scopo

La presente Policy di Conservazione e Cancellazione dei Dati Personali (di seguito "Policy") definisce i periodi di conservazione applicabili a ciascuna categoria di dato personale trattato da Soccorso Digitale S.r.l. (di seguito "SD" o "Responsabile del Trattamento") nell'ambito dell'erogazione dei propri servizi SaaS per la gestione di trasporti sanitari.

La Policy è adottata in conformità al principio di limitazione della conservazione sancito dall'art. 5(1)(e) del Regolamento (UE) 2016/679 (GDPR), che impone che i dati personali siano conservati in una forma che consenta l'identificazione degli interessati per un arco di tempo non superiore al conseguimento delle finalità per le quali sono trattati.

### 1.2 Ambito soggettivo

La presente Policy si applica a:

- **Soccorso Digitale S.r.l.** in qualità di Responsabile del Trattamento ex art. 28 GDPR, per i dati trattati per conto delle organizzazioni clienti;
- **Organizzazioni clienti** (cooperative di soccorso, associazioni, enti convenzionati con il SSN) in qualità di Titolari del Trattamento, le quali sono tenute ad adottare proprie policy di conservazione coerenti con i periodi minimi indicati nel presente documento e nei relativi Accordi di Responsabilità del Trattamento (DPA).

### 1.3 Ambito oggettivo

La Policy disciplina la conservazione e la successiva eliminazione sicura di tutti i dati personali trattati mediante la piattaforma SD, inclusi:

- Dati anagrafici e sanitari di pazienti trasportati;
- Dati di operatori sanitari, volontari e dipendenti delle organizzazioni clienti;
- Dati contrattuali e di fatturazione delle organizzazioni clienti;
- Log tecnici, audit trail e dati di monitoraggio;
- Comunicazioni e-mail transazionali;
- Dati di consenso e registri GDPR.

### 1.4 Esclusioni

La presente Policy non disciplina i dati trattati da SD esclusivamente per finalità proprie (es. gestione del personale dipendente di SD), per i quali si rimanda alla Policy interna HR.

---

## 2. PRINCIPI FONDAMENTALI

### 2.1 Limitazione della conservazione (art. 5(1)(e) GDPR)

I dati personali devono essere conservati in una forma che consenta l'identificazione degli interessati per un arco di tempo non superiore al conseguimento delle finalità per le quali sono trattati. Scaduto tale termine, i dati devono essere cancellati in modo sicuro, anonimizzati o pseudonimizzati in modo irreversibile.

### 2.2 Minimizzazione dei dati (art. 5(1)(c) GDPR)

SD adotta il principio di minimizzazione in fase di raccolta e durante l'intero ciclo di vita del dato. I dati raccolti devono essere adeguati, pertinenti e limitati a quanto necessario rispetto alle finalità per le quali sono trattati. Questo principio informa anche le decisioni sui periodi di conservazione: laddove esistano più opzioni conformi, si applica quella che prevede il periodo più breve.

### 2.3 Gerarchia delle fonti per la determinazione dei periodi

Nella determinazione del periodo di conservazione applicabile, la seguente gerarchia è vincolante e non derogabile:

1. **Obbligo normativo cogente** (legge, regolamento, provvedimento dell'Autorità): periodo minimo inderogabile, che prevale su qualsiasi altra considerazione;
2. **Esigenza operativa documentata e proporzionata**: periodo giustificato da una legittima finalità aziendale che non può essere soddisfatta da dati anonimi o aggregati;
3. **Convenienza o preferenza commerciale**: non costituisce base sufficiente per prolungare la conservazione oltre i termini stabiliti ai punti precedenti.

### 2.4 Revisione annuale

La presente Policy è soggetta a revisione annuale da parte del DPO, in coordinamento con il CTO. Una revisione straordinaria è obbligatoria al verificarsi di:

- Modifiche rilevanti alla normativa applicabile (GDPR, D.Lgs. 196/2003, normativa sanitaria, fiscale, lavoristica);
- Variazioni significative nell'architettura dei dati o nei servizi offerti;
- Indicazioni dell'Autorità Garante per la protezione dei dati personali o dell'EDPB;
- Incidenti di sicurezza che evidenzino lacune nella gestione del ciclo di vita dei dati.

### 2.5 Responsabilità condivisa

SD, in quanto Responsabile del Trattamento, garantisce che i propri sistemi tecnici supportino il rispetto dei periodi di conservazione definiti. Le organizzazioni clienti (Titolari), in quanto determinano le finalità del trattamento dei dati dei propri utenti, sono responsabili di istruire SD in merito a eventuali periodi di conservazione più restrittivi applicabili in base alla propria specifica normativa locale o settoriale.

---

## 3. PERIODI DI CONSERVAZIONE

### 3.1 Dati sanitari e trasporti

I dati relativi ai trasporti sanitari dei pazienti costituiscono dati appartenenti alle categorie particolari di cui all'art. 9 GDPR, in quanto le informazioni relative al tipo di trasporto effettuato, alla destinazione (struttura sanitaria), alla frequenza delle prestazioni e ai codici di intervento consentono, anche indirettamente, di desumere informazioni sullo stato di salute dell'interessato. Per tali dati si applicano le misure di sicurezza rafforzate di cui all'art. 9(4) GDPR e ai Provvedimenti del Garante in materia sanitaria.

| Categoria dato | Tipo | Base normativa | Periodo di conservazione | Note |
|----------------|------|----------------|--------------------------|------|
| Cartella servizio trasporto (dati paziente, tipo di trasporto, struttura di destinazione, codice intervento, operatori) | Dato sanitario ex art. 9 GDPR | D.Lgs. 502/1992 art. 1; DPR 445/2000; Linee guida Min. Salute documentazione sanitaria; normativa SSN | 10 anni dalla data del trasporto | Termine minimo inderogabile per la documentazione sanitaria. Per pazienti minorenni: 10 anni dal compimento della maggiore età. |
| Dati di prenotazione del trasporto (dati identificativi paziente, data/ora, tipo trasporto richiesto) | Dato sanitario ex art. 9 GDPR | D.Lgs. 502/1992; normativa SSN | 10 anni dalla data della prenotazione | Il dato di prenotazione è inscindibile dalla cartella del servizio di trasporto a cui si riferisce. |
| Report operativi e fatture sanitarie (report di servizio, fatture emesse verso SSN o paziente) | Dato fiscale e sanitario | Art. 2220 c.c.; DPR 633/1972 art. 39 (IVA); D.Lgs. 502/1992 | 10 anni dalla data del documento | Il termine fiscale (10 anni) assorbe il termine civilistico (5 anni ex art. 2947 c.c.) per la prescrizione ordinaria. |
| Dati HMAC audit trail viaggi (hash di integrità su eventi di ogni viaggio, generati da trip_integrity.ts) | Dato tecnico-operativo | Integrità documentale; artt. 5(1)(f), 32 GDPR; normativa sanitaria | 10 anni | L'audit trail garantisce la non-ripudiabilità e l'integrità delle registrazioni dei trasporti sanitari. La catena HMAC-SHA256 non è cancellabile selettivamente senza compromettere l'integrità dell'intera catena. |
| Dati GPS del trasporto (coordinate di partenza, destinazione, percorso del viaggio) | Dato sanitario indiretto | D.Lgs. 502/1992; normativa SSN | 10 anni, collegati alla cartella trasporto | Le coordinate di un trasporto sanitario sono parte integrante della documentazione del servizio erogato. |

### 3.2 Dati operatori e volontari

| Categoria dato | Tipo | Base normativa | Periodo di conservazione | Note |
|----------------|------|----------------|--------------------------|------|
| Dati anagrafici e identificativi operatori/volontari attivi (nome, cognome, CF, data di nascita, recapiti, qualifiche) | Dato comune | D.Lgs. 81/2008 (sicurezza sul lavoro); art. 2220 c.c.; D.Lgs. 196/2003 | Durata del rapporto + 10 anni dalla cessazione | Il termine di 10 anni è determinato dall'obbligo di conservazione dei libri e scritture contabili (art. 2220 c.c.) e dalla prescrizione ordinaria per contestazioni lavoristiche. |
| Dati anagrafici operatori/volontari cessati | Dato comune | Art. 2220 c.c.; normativa previdenziale | 10 anni dalla cessazione del rapporto | Possibile riduzione a 5 anni previa verifica con il consulente del lavoro delle organizzazioni clienti. |
| Turni ed ore lavorate (registro presenze, ore straordinarie, permessi, assenze) | Dato lavoristico | D.Lgs. 66/2003 (orario di lavoro); normativa INPS/INAIL; artt. 4 e 8 L. 300/1970 | 5 anni | Termine determinato dagli adempimenti contributivi INPS (prescrizione quinquennale dei contributi ex art. 3 L. 335/1995). |
| Certificazioni, abilitazioni e formazione (BLSD, guida in emergenza, corsi obbligatori ex D.Lgs. 81/2008) | Dato lavoristico | D.Lgs. 81/2008 artt. 37, 73; DM 15 luglio 2003 (soccorritori) | Durata di validità della certificazione + 2 anni dalla scadenza | I 2 anni post-scadenza coprono il periodo di eventuale contestazione della validità della certificazione. |
| GPS tracking operatori durante i servizi (posizione del dispositivo/veicolo durante lo svolgimento del turno) | Dato di geolocalizzazione | Provvedimento Garante 4 ottobre 2011 (n. 370, sistemi GPS); art. 4 L. 300/1970; Accordo sindacale (se applicabile) | 1 anno dalla registrazione, poi cancellazione automatica | Superato il termine, i dati devono essere cancellati in modo irrecuperabile. È ammessa la conservazione di dati aggregati e non attribuibili al singolo per finalità statistiche. |
| Log accessi all'applicazione (autenticazione operatore: data/ora, IP, dispositivo) | Dato tecnico | Art. 32 GDPR; Linee guida ENISA su logging; normativa sicurezza informatica | 2 anni, poi cancellazione automatica | Necessari per il rilevamento di accessi non autorizzati e la risoluzione di incidenti di sicurezza. |
| Dati biometrici (se raccolti per autenticazione) | Dato biometrico ex art. 9 GDPR | Autorizzazione Garante; art. 9 GDPR | Durata della sessione di autenticazione; non conservati in forma identificabile | SD non raccoglie attualmente dati biometrici. |

### 3.3 Dati organizzazioni clienti (Titolari del Trattamento)

| Categoria dato | Tipo | Base normativa | Periodo di conservazione | Note |
|----------------|------|----------------|--------------------------|------|
| Dati contrattuali (contratti di servizio, DPA, ordini di acquisto, corrispondenza contrattuale) | Dato contrattuale | Art. 2220 c.c.; art. 1469-bis e ss. c.c. | 10 anni dalla scadenza o risoluzione del contratto | Il termine decennale corrisponde alla prescrizione ordinaria dei diritti contrattuali (art. 2946 c.c.). |
| Dati di fatturazione e pagamenti (fatture emesse, pagamenti ricevuti, note di credito, dati Stripe) | Dato fiscale e contabile | Art. 2220 c.c.; DPR 633/1972 art. 39; D.Lgs. 127/2015 (fattura elettronica) | 10 anni dalla data del documento | Obbligo di conservazione delle scritture contabili obbligatorie e dei registri IVA. |
| Log operazioni amministrative (azioni su account organizzazione: creazione utenti, modifica impostazioni, operazioni di sistema) | Dato tecnico-operativo | Art. 32 GDPR; esigenza operativa | 2 anni, poi cancellazione automatica | Necessari per audit interni, supporto tecnico e verifica di utilizzo conforme del servizio. |
| Dati di onboarding e KYC (Know Your Customer: documenti di identità, visura camerale, dati dei referenti legali) | Dato contrattuale e di compliance | D.Lgs. 231/2007 (antiriciclaggio); D.Lgs. 90/2017; normativa AML | Durata del contratto + 5 anni dalla cessazione | Il termine di 5 anni post-cessazione è imposto dalla normativa antiriciclaggio (art. 31 D.Lgs. 231/2007). |
| Dati CRM — clienti attivi (storico interazioni, ticket di supporto, log comunicazioni) | Dato di gestione cliente | Legittimo interesse (art. 6(1)(f) GDPR); esecuzione del contratto | Durata del contratto + 2 anni dalla cessazione | I 2 anni post-cessazione coprono il periodo di garanzia e di contestazione del servizio. |
| Dati CRM — prospect non diventati clienti (lead, dati contatto, storico trattative) | Dato comune | Consenso (art. 6(1)(a) GDPR) o legittimo interesse per fase pre-contrattuale | 3 anni dall'ultimo contatto significativo | Alla scadenza: cancellazione automatica o richiesta di rinnovo del consenso. L'"ultimo contatto significativo" include: risposta a email, visita al sito, richiesta di demo. |
| Dati di accesso e credenziali amministratori (hash password admin, sessioni attive, token API) | Dato di sicurezza | Art. 32 GDPR; esigenza di sicurezza | Password hash: durata dell'account; sessioni: 24 ore (o logout); token API: durata configurata (max 1 anno) | Gli hash bcrypt delle password non vengono cancellati prima della cancellazione dell'account, ma non sono mai conservati in chiaro. |

### 3.4 Log tecnici e monitoraggio

| Categoria dato | Tipo | Base normativa | Periodo di conservazione | Note |
|----------------|------|----------------|--------------------------|------|
| Log applicativi Railway (log del server Express.js: richieste HTTP, errori applicativi, eventi di sistema) | Dato tecnico | Art. 32 GDPR; esigenza operativa di sicurezza | 2 anni | I log sono conservati nella piattaforma Railway nella misura in cui il piano contrattuale lo consente; l'eccedenza è archiviata localmente per completare il biennio. |
| Log accessi API (richieste API con metodo, endpoint, IP sorgente, user agent, timestamp, codice risposta) | Dato tecnico | Art. 32 GDPR; rilevamento intrusioni | 2 anni | I log contengono indirizzi IP che possono costituire dato personale (CGUE, causa C-582/14, Breyer). Trattati con base legittimo interesse per sicurezza. |
| Error log Sentry (stack trace, context delle eccezioni, dati di sessione al momento dell'errore) | Dato tecnico (potenzialmente personale) | Art. 32 GDPR; esigenza operativa | 90 giorni in Sentry (piano attuale), poi archivio locale cifrato per ulteriori 22 mesi (totale 2 anni) | Sentry è sub-processor USA con meccanismo Data Privacy Framework (DPF). I log in Sentry non devono contenere dati sanitari: questo è garantito dalla configurazione di sanitization attiva prima dell'invio. |
| PostHog analytics (eventi di utilizzo della piattaforma, funnel di navigazione, heatmap) | Dato aggregato e pseudonimizzato | Legittimo interesse (art. 6(1)(f) GDPR); Considerando 26 GDPR (dati anonimi/aggregati) | 2 anni, poi eliminazione o anonimizzazione definitiva | PostHog è configurato in modalità EU (server Frankfurt). Gli user ID sono pseudonimizzati. Non sono raccolti dati sanitari tramite PostHog. |
| Backup database completo (snapshot PostgreSQL Supabase EU Frankfurt) | Dato tecnico/operativo | Art. 32 GDPR; continuità operativa | 30 giorni rolling (backup giornalieri, Railway/Supabase) + snapshot mensile per 12 mesi | I backup contengono tutte le categorie di dati presenti nel database principale e sono soggetti alle stesse misure di sicurezza. La cancellazione dei dati nel database principale deve riflettersi anche sui backup al momento della loro sovrascrittura naturale; in caso di richiesta di cancellazione urgente ex art. 17 GDPR per dati ad alto rischio, valutare la cancellazione forzata del backup. |
| Metriche di performance e uptime (CPU, memoria, latenza, disponibilità del servizio — da UptimeRobot e Railway) | Dato tecnico anonimo | Legittimo interesse | 2 anni | Dati non personali. Tuttavia, se correlati con identificatori utente, assumono natura di dato personale e si applicano i termini di conservazione corrispondenti. |

### 3.5 Comunicazioni e-mail

| Categoria dato | Tipo | Base normativa | Periodo di conservazione | Note |
|----------------|------|----------------|--------------------------|------|
| Log e-mail transazionali Resend (log di invio: destinatario, timestamp, stato di consegna, ID messaggio) | Dato tecnico | Esecuzione del contratto; legittimo interesse | 2 anni | Resend è sub-processor EU. I log di invio non contengono il corpo del messaggio (solo metadati). |
| Contenuto di e-mail transazionali senza dati sanitari (es. notifiche di turno, avvisi di sistema, email di onboarding) | Dato comune | Esecuzione del contratto | 2 anni | Il corpo delle email è conservato nei log Resend per il periodo contrattualmente previsto. |
| E-mail contenenti dati sanitari (es. notifiche di servizio trasporto con dati paziente, report con CF paziente) | Dato sanitario ex art. 9 GDPR | D.Lgs. 502/1992; normativa SSN | 10 anni | **Le e-mail contenenti dati sanitari, anche parziali o indiretti, sono trattate come documentazione sanitaria.** SD adotta misure tecniche per minimizzare la presenza di dati sanitari nel corpo delle e-mail transazionali. |
| E-mail di assistenza e supporto tecnico (ticket, corrispondenza con operatori clienti) | Dato comune | Legittimo interesse; esecuzione del contratto | 5 anni dalla chiusura del ticket | Le e-mail di supporto possono contenere dati personali degli operatori clienti; non devono contenere dati sanitari dei pazienti. |

### 3.6 Dati di consenso e registri GDPR

| Categoria dato | Tipo | Base normativa | Periodo di conservazione | Note |
|----------------|------|----------------|--------------------------|------|
| Registro consensi (tabella privacyPolicies: testo policy versionate; tabella userConsents: consensi prestati con timestamp, versione, canale) | Dato di compliance | Art. 7(1) GDPR (onere della prova del consenso); art. 5(2) GDPR (accountability) | Durata del consenso + 5 anni dalla revoca o scadenza | Il periodo post-consenso è necessario per dimostrare la liceità del trattamento effettuato durante la vigenza del consenso, in caso di contestazioni o controlli. |
| Richieste di accesso e portabilità (tabella gdprDataExports: log delle richieste ex artt. 15-20 GDPR, con data, canale, risposta fornita) | Dato di compliance | Art. 5(2) GDPR; artt. 15, 20 GDPR | 5 anni dalla data della risposta | Il registro è necessario per dimostrare il rispetto dei diritti degli interessati. |
| Richieste di cancellazione (tabella gdprErasureRequests: log delle richieste ex art. 17 GDPR, con motivazione, risposta, data di esecuzione) | Dato di compliance | Art. 5(2) GDPR; art. 17 GDPR | 5 anni dalla data di esecuzione o rifiuto motivato | Il registro della cancellazione (incluse le motivazioni di eventuale rifiuto) è necessario per la difesa in sede di reclamo all'Autorità Garante. |
| Registro delle violazioni dei dati (data breach log interno) | Dato di compliance | Art. 33(5) GDPR | 5 anni dalla chiusura dell'incidente | Il GDPR non specifica un termine; 5 anni sono ritenuti congrui dalla dottrina in linea con la prescrizione dell'azione di risarcimento danni ex art. 82 GDPR (in Italia: 5 anni ex art. 2947 c.c., o 10 per danni da reato). |
| Valutazioni d'impatto (DPIA — artt. 35-36 GDPR) | Documento di compliance | Art. 35 GDPR; accountability | Durata del trattamento valutato + 5 anni | Le DPIA devono essere aggiornate in caso di variazioni significative del trattamento. |
| Accordi di Responsabilità del Trattamento (DPA ex art. 28 GDPR) | Documento contrattuale | Art. 28(3) GDPR; art. 2220 c.c. | Durata del contratto + 10 anni | I DPA sono parte integrante dei contratti con le organizzazioni clienti e seguono il regime di conservazione contrattuale. |

---

## 4. PROCEDURE DI CANCELLAZIONE E ANONIMIZZAZIONE

### 4.1 Cancellazione automatica

SD implementa un job schedulato notturno (esecuzione alle 02:00 UTC) che verifica le scadenze di conservazione per le categorie di dati soggette a cancellazione automatica. Il job opera come segue:

1. **Identificazione dei record scaduti**: interrogazione del database con confronto tra la data di scadenza calcolata (data di creazione + periodo di conservazione applicabile) e la data corrente;
2. **Verifica dei blocchi attivi**: prima di procedere alla cancellazione, il sistema verifica l'assenza di blocchi di cancellazione attivi (cfr. Sezione 5);
3. **Cancellazione sicura**: per i dati comuni, cancellazione logica (soft delete) con successiva cancellazione fisica dopo 30 giorni; per i dati sanitari e dati ex art. 9, cancellazione fisica immediata con sovrascrittura;
4. **Log dell'operazione**: ogni cancellazione automatica genera una voce nel log di audit interno con: categoria dato, numero di record cancellati, timestamp, operatore (sistema), esito;
5. **Notifica al DPO**: report settimanale delle cancellazioni automatiche eseguite.

Le categorie soggette a cancellazione automatica sono:

- GPS tracking operatori (scadenza: 1 anno dalla registrazione);
- Log accessi app operatori (scadenza: 2 anni);
- Log applicativi Railway (scadenza: 2 anni);
- Log accessi API (scadenza: 2 anni);
- Dati CRM prospect (scadenza: 3 anni dall'ultimo contatto);
- PostHog analytics (scadenza: 2 anni).

### 4.2 Cancellazione su richiesta dell'interessato (art. 17 GDPR)

Le richieste di cancellazione ("diritto all'oblio") presentate dagli interessati sono gestite secondo la seguente procedura:

1. **Ricezione e registrazione**: la richiesta è registrata nella tabella `gdprErasureRequests` con timestamp e canale di ricezione;
2. **Verifica dell'identità**: l'identità del richiedente è verificata prima di procedere, per prevenire cancellazioni fraudolente;
3. **Valutazione delle eccezioni**: il DPO verifica se si applicano una o più delle eccezioni all'art. 17(3) GDPR (obbligo legale, difesa in giudizio, interesse pubblico);
4. **Risposta all'interessato**: entro 30 giorni dalla ricezione, con possibilità di proroga di 60 giorni per richieste complesse (art. 12(3) GDPR), motivando per iscritto;
5. **Esecuzione della cancellazione**: qualora non si applichi alcuna eccezione, la cancellazione è eseguita entro il termine comunicato all'interessato;
6. **Certificazione**: per dati sanitari (art. 9 GDPR), è rilasciata una certificazione di cancellazione firmata dal DPO.

**Nota importante per dati sanitari**: la cancellazione di dati sanitari di pazienti è soggetta al bilanciamento con l'obbligo di documentazione sanitaria (D.Lgs. 502/1992). In caso di conflitto, l'obbligo normativo prevale e la richiesta di cancellazione è respinta con motivazione scritta, informando l'interessato del suo diritto di reclamo al Garante.

### 4.3 Pseudonimizzazione come alternativa alla cancellazione

Nei casi in cui la cancellazione completa non sia praticabile (es. integrità dell'audit trail HMAC, obblighi di reportistica aggregata), SD adotta la pseudonimizzazione come misura alternativa, a condizione che:

- La chiave di pseudonimizzazione sia conservata separatamente e con accesso ristretto;
- La pseudonimizzazione sia irreversibile ai fini pratici per chiunque non abbia accesso alla chiave;
- I dati pseudonimizzati siano trattati come dati personali a tutti gli effetti del GDPR, finché la chiave esiste.

L'anonimizzazione definitiva (distruzione della chiave di de-pseudonimizzazione) equivale alla cancellazione ai fini del GDPR e deve essere documentata nel registro delle cancellazioni.

### 4.4 Certificazione di cancellazione

Per le seguenti categorie di dati, al termine del periodo di conservazione SD emette una certificazione formale di cancellazione:

- Dati sanitari dei pazienti (art. 9 GDPR);
- Dati ex richiesta di cancellazione dell'interessato (art. 17 GDPR);
- Dati oggetto di data breach, al termine del blocco di conservazione per procedimento.

La certificazione contiene: categoria dato, periodo di conservazione applicato, data di esecuzione della cancellazione, metodo di cancellazione, firma del responsabile tecnico e controfirma del DPO.

---

## 5. ECCEZIONI E BLOCCHI DI CANCELLAZIONE

### 5.1 Contenzioso in corso o ragionevolmente prevedibile

Qualora SD (o un'organizzazione cliente) sia parte in un procedimento giudiziario, arbitrale o stragiudiziale, o qualora tale procedimento sia ragionevolmente prevedibile sulla base di circostanze concrete, i dati potenzialmente rilevanti per la difesa o per la prova dei propri diritti sono soggetti a blocco di cancellazione ("litigation hold") per tutta la durata del procedimento e fino alla definitività della decisione.

Il blocco di cancellazione è attivato per iscritto dal legale responsabile o dal DPO, è registrato nel sistema con data di inizio, motivo e responsabile, e deve essere revocato espressamente al termine delle condizioni che lo hanno determinato.

### 5.2 Indagini di Autorità competenti

In caso di indagini o ispezioni da parte di Autorità competenti (Garante Privacy, Guardia di Finanza, NAS, Autorità giudiziaria), i dati oggetto dell'indagine sono conservati fino a formale risoluzione del procedimento e/o rilascio da parte dell'Autorità. SD collabora con le Autorità nel rispetto della normativa applicabile.

### 5.3 Conflitto con obbligo legale

Qualora il periodo di conservazione stabilito nella presente Policy entri in conflitto con un obbligo legale cogente (es. obbligo di conservazione fiscale, normativa sanitaria, normativa previdenziale), prevale l'obbligo legale nella sua massima estensione. Il DPO documenta il conflitto e la soluzione adottata.

### 5.4 Richiesta del Titolare del Trattamento

Le organizzazioni clienti (Titolari) possono richiedere a SD la conservazione di specifici dati oltre i termini previsti nella presente Policy, a condizione che forniscano una base giuridica idonea per l'estensione. Tale richiesta deve essere formalizzata per iscritto come istruzione al Responsabile del Trattamento ex art. 28(3)(a) GDPR.

### 5.5 Gestione dei blocchi nel sistema

Il database include un campo `retention_hold` e una tabella `retention_holds` che registra i blocchi attivi per singolo record o gruppo di record. Il job di cancellazione automatica esclude automaticamente tutti i record con blocchi attivi. Il DPO riceve un report mensile dei blocchi attivi con indicazione della loro durata.

---

## 6. MISURE TECNICHE DI SICUREZZA NELLA CANCELLAZIONE

### 6.1 Cancellazione sicura dei dati nel database

La cancellazione di dati personali dal database PostgreSQL (Supabase EU Frankfurt) avviene mediante:

- **Cancellazione logica (soft delete)**: per dati comuni non sensibili, impostazione del flag `deleted_at` con successiva cancellazione fisica entro 30 giorni;
- **Cancellazione fisica (`DELETE` con `VACUUM`)**: per dati ex art. 9 GDPR e per dati oggetto di richiesta ex art. 17 GDPR, cancellazione fisica immediata seguita da `VACUUM` PostgreSQL per sovrascrittura delle pagine libere;
- **Cancellazione crittografica**: per dati cifrati (es. credenziali SMTP cifrate con AES-256), distruzione della chiave di cifratura equivale alla cancellazione irreversibile dei dati cifrati.

### 6.2 Gestione dei backup

La cancellazione di dati dal database principale non comporta la cancellazione immediata dai backup esistenti. SD adotta la seguente strategia:

- I backup giornalieri (rolling 30 giorni) sovrascrivono automaticamente i backup più vecchi, garantendo che i dati cancellati dal database principale non siano presenti nei backup dopo il periodo rolling;
- Gli snapshot mensili (conservati 12 mesi) possono contenere dati già cancellati dal database principale. In caso di ripristino da backup, i dati ripristinati che erano stati cancellati dal principale devono essere nuovamente cancellati prima della messa in produzione del sistema ripristinato;
- In caso di richiesta di cancellazione urgente per dati ad alto rischio (data breach, ordine dell'Autorità), il DPO valuta la necessità di cancellazione forzata dai backup, documentando la decisione.

### 6.3 Cancellazione da sistemi dei sub-processor

SD adotta le seguenti misure per garantire la cancellazione dai sistemi dei sub-processor:

- **Sentry**: configurazione di data retention a 90 giorni nella dashboard Sentry; i dati vengono automaticamente eliminati da Sentry al termine del periodo;
- **PostHog**: configurazione di data retention a 2 anni; richiesta di cancellazione via API PostHog per dati specifici su richiesta dell'interessato;
- **Resend**: i log di invio e-mail seguono la policy di retention di Resend; SD mantiene log propri per il biennio previsto;
- **Railway**: i log applicativi sono soggetti alla policy di Railway; SD esporta e archivia localmente i log per garantire la conservazione biennale.

---

## 7. RESPONSABILITÀ

### 7.1 DPO (Data Protection Officer)

- Supervisione dell'attuazione della presente Policy;
- Revisione annuale e aggiornamento in caso di variazioni normative;
- Approvazione delle certificazioni di cancellazione per dati sensibili;
- Audit periodici dei processi di cancellazione automatica;
- Ricezione e gestione delle richieste degli interessati relative alla conservazione;
- Rapporto annuale al management sui KPI di conservazione (dati scaduti, cancellati, in blocco).

**Referente**: privacy@soccorsodigitale.app

### 7.2 CTO / Lead Engineer

- Implementazione e manutenzione dei job automatici di cancellazione;
- Configurazione dei periodi di conservazione nei sistemi tecnici;
- Implementazione delle misure di cancellazione sicura (sovrascrittura, vacuum, distruzione chiavi);
- Configurazione della data retention nei sistemi dei sub-processor (Sentry, PostHog, ecc.);
- Notifica al DPO di eventuali impedimenti tecnici all'esecuzione delle cancellazioni programmate;
- Documentazione tecnica dei processi di cancellazione.

### 7.3 Organizzazioni clienti (Titolari del Trattamento)

Le organizzazioni clienti sono responsabili di:

- Determinare le finalità del trattamento dei dati dei propri utenti/pazienti e comunicarle a SD;
- Definire eventuali periodi di conservazione più restrittivi applicabili in base alla normativa locale;
- Gestire le richieste degli interessati relative ai propri dati (con supporto tecnico di SD);
- Garantire che le istruzioni impartite a SD siano conformi alla normativa applicabile.

### 7.4 Tutti i dipendenti di SD

I dipendenti di SD che accedono a dati personali nell'ambito delle proprie funzioni sono tenuti a:

- Non conservare dati personali al di fuori dei sistemi autorizzati;
- Segnalare immediatamente al DPO qualsiasi trattamento di dati oltre i termini previsti;
- Non effettuare copie non autorizzate di dati personali.

---

## 8. REVISIONE E AGGIORNAMENTO

| Versione | Data | Modifiche principali | Approvato da |
|----------|------|----------------------|--------------|
| 1.0 | 27 marzo 2026 | Prima adozione della Policy | DPO — Soccorso Digitale S.r.l. |

La presente Policy è soggetta a revisione annuale entro il 31 marzo di ciascun anno. Eventuali revisioni straordinarie sono documentate con l'indicazione del motivo che le ha rese necessarie.

**Prossima revisione ordinaria:** 27 marzo 2027

---

## 9. RIFERIMENTI NORMATIVI

- Regolamento (UE) 2016/679 (GDPR), artt. 4(1), 5(1)(c), 5(1)(e), 5(2), 7, 9, 12, 13, 14, 15, 17, 20, 28, 32, 35
- D.Lgs. 30 giugno 2003, n. 196 (Codice in materia di protezione dei dati personali), come modificato dal D.Lgs. 101/2018
- D.Lgs. 30 dicembre 1992, n. 502 (Riordino della disciplina in materia sanitaria)
- DPR 28 dicembre 2000, n. 445 (Testo unico sulla documentazione amministrativa)
- D.Lgs. 9 aprile 2008, n. 81 (Testo unico sulla salute e sicurezza sul lavoro)
- D.Lgs. 8 aprile 2003, n. 66 (Orario di lavoro)
- Legge 20 maggio 1970, n. 300 (Statuto dei Lavoratori), artt. 4 e 8
- Legge 8 agosto 1995, n. 335, art. 3 (prescrizione contributi previdenziali)
- Art. 2220, 2946, 2947 del Codice Civile
- DPR 26 ottobre 1972, n. 633, art. 39 (IVA)
- D.Lgs. 5 agosto 2015, n. 127 (fatturazione elettronica)
- D.Lgs. 25 maggio 2017, n. 90 e D.Lgs. 21 novembre 2007, n. 231 (normativa antiriciclaggio)
- Provvedimento Garante n. 370 del 4 ottobre 2011 (sistemi GPS sui luoghi di lavoro)
- Linee Guida EDPB 5/2020 sul consenso
- Linee Guida ENISA sulla sicurezza dei log (novembre 2021)
- Considerando 26 e 39 del GDPR

---

*Documento prodotto da Soccorso Digitale S.r.l. — Responsabile del Trattamento ex art. 28 GDPR.*
*Per informazioni: privacy@soccorsodigitale.app*
