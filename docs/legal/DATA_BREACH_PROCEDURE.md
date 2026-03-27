# PROCEDURA DI GESTIONE DELLE VIOLAZIONI DI DATI PERSONALI

**Documento:** DATA_BREACH_PROCEDURE
**Versione:** 1.0
**Data di approvazione:** 27 marzo 2026
**Approvato da:** DPO — Soccorso Digitale S.r.l.
**Prossima revisione:** 27 marzo 2027
**Classificazione:** Riservato — diffusione limitata al personale autorizzato

---

## 1. SCOPO E CAMPO DI APPLICAZIONE

La presente procedura descrive le modalità operative con cui Soccorso Digitale S.r.l. (di seguito "SD") gestisce le violazioni dei dati personali (data breach) in qualità di Responsabile del Trattamento ai sensi dell'art. 28 del Regolamento (UE) 2016/679 (GDPR).

La procedura è redatta in conformità a:

- Artt. 33 e 34 GDPR (obblighi di notifica al Garante e agli interessati);
- Art. 33(2) GDPR (obbligo del Responsabile di notificare al Titolare senza ingiustificato ritardo);
- Linee Guida EDPB 01/2021 sugli esempi relativi alla notifica delle violazioni dei dati personali (adottate il 14 gennaio 2021, versione 2.0);
- Linee Guida WP29/EDPB 250 rev.01 sulla notifica delle violazioni dei dati personali (settembre 2017).

SD, operando come Responsabile del Trattamento per conto delle organizzazioni clienti (Titolari), è tenuta a:

1. Notificare ogni violazione al Titolare del Trattamento **senza ingiustificato ritardo** (art. 33(2) GDPR), e comunque entro **24 ore dalla scoperta**, per consentire al Titolare di rispettare il proprio termine di 72 ore per la notifica al Garante;
2. Fornire al Titolare tutte le informazioni necessarie per valutare la violazione e adempiere ai propri obblighi;
3. Assistere il Titolare nella notifica all'Autorità Garante e agli interessati, se richiesto.

La presente procedura si applica a tutti i dipendenti, consulenti e collaboratori di SD che rilevino o vengano a conoscenza di una possibile violazione dei dati personali.

---

## 2. DEFINIZIONI

### 2.1 Violazione dei dati personali (art. 4(12) GDPR)

Per "violazione dei dati personali" si intende "una violazione di sicurezza che comporta accidentalmente o in modo illecito la distruzione, la perdita, la modifica, la divulgazione non autorizzata o l'accesso ai dati personali trasmessi, conservati o comunque trattati."

La definizione è ampia e comprende:

- **Violazioni di riservatezza (Confidentiality breach)**: divulgazione o accesso non autorizzato a dati personali da parte di soggetti non legittimati. Esempio: un dipendente accede ai dati sanitari di pazienti di un'organizzazione diversa dalla propria.
- **Violazioni di integrità (Integrity breach)**: modifica non autorizzata o accidentale di dati personali. Esempio: un bug di sistema altera i dati di un paziente nel database.
- **Violazioni di disponibilità (Availability breach)**: distruzione o perdita accidentale o non autorizzata dell'accesso ai dati personali. Esempio: un attacco ransomware cifra il database rendendolo inaccessibile.

Una violazione può essere di uno o più tipi contemporaneamente.

### 2.2 Incidente di sicurezza vs. violazione dei dati personali

Non ogni incidente di sicurezza costituisce una violazione dei dati personali. Un incidente di sicurezza che non comporta alcun rischio di accesso, perdita, alterazione o divulgazione di dati personali non è una violazione ai sensi del GDPR (esempio: un attacco DDoS che causa temporanea indisponibilità del servizio senza compromissione dei dati). La distinzione deve essere operata caso per caso in fase di triage.

### 2.3 Notificabile vs. non notificabile

Ai sensi dell'art. 33(1) GDPR, la notifica al Garante è obbligatoria **"a meno che sia improbabile che la violazione dei dati personali presenti un rischio per i diritti e le libertà delle persone fisiche"**.

La notifica agli interessati (art. 34 GDPR) è obbligatoria solo quando la violazione è **"suscettibile di presentare un rischio elevato per i diritti e le libertà delle persone fisiche"**.

La valutazione del rischio tiene conto di: natura dei dati coinvolti, volume, identificabilità degli interessati, probabilità di uso illecito, vulnerabilità della categoria di interessati (pazienti, minori), misure di sicurezza in atto al momento della violazione.

---

## 3. TIPOLOGIE DI INCIDENTE E CLASSIFICAZIONE DEL RISCHIO

La tabella seguente classifica gli scenari di incidente più frequenti per la piattaforma SD, indicando il tipo di violazione (C = Confidentiality/riservatezza, I = Integrity/integrità, D = Availability/disponibilità) e il livello di rischio di default da applicare in assenza di informazioni contrarie.

| # | Scenario | Tipo | Rischio default | Note specifiche per SD |
|---|----------|------|----------------|------------------------|
| 1 | Accesso non autorizzato al database PostgreSQL (Supabase EU) da parte di soggetto esterno | C | **CRITICO** | Potenziale esposizione di dati sanitari art. 9 GDPR di interi tenant. Notifica Garante obbligatoria. |
| 2 | Attacco ransomware con cifratura del database o dei backup | D + C | **CRITICO** | Perdita di disponibilità e possibile esfiltrazione. Piano di ripristino da backup attivato immediatamente. |
| 3 | Perdita o furto di dispositivo di un dipendente SD con accesso a dati personali | C | **ALTO** | Se il dispositivo era cifrato e protetto da PIN: rischio ridotto a MEDIO. Revoca immediata accessi. |
| 4 | Phishing riuscito su credenziali di un amministratore di un'organizzazione cliente | C | **ALTO** | Possibile accesso a dati del tenant dell'organizzazione coinvolta. Revoca token e sessioni attive. |
| 5 | Invio di email transazionale a destinatario errato contenente dati personali | C | **MEDIO** | Se il messaggio contiene dati sanitari: rischio ALTO. Richiesta immediata di cancellazione al destinatario. |
| 6 | Invio di email transazionale a destinatario errato contenente dati sanitari paziente | C | **ALTO** | Dato art. 9 GDPR. Notifica al Titolare obbligatoria. Valutare notifica al Garante. |
| 7 | SQL injection con accesso o esfiltrazione di dati dal database | C + I | **CRITICO** | Dipende dall'estensione: se multi-tenant, rischio CRITICO per tutti i tenant. Chiusura endpoint. |
| 8 | Bug di isolamento multi-tenant: tenant A accede ai dati del tenant B | C | **CRITICO** | Violazione strutturale. Sospensione del servizio e audit completo necessari. |
| 9 | Compromissione dell'account Supabase (accesso alla console di amministrazione) | C + I + D | **CRITICO** | Accesso potenziale a tutti i dati di tutti i tenant. Escalation immediata a Supabase. |
| 10 | Esfiltrazione di dati tramite API (abuso di token valido o token rubato) | C | **ALTO / CRITICO** | Critico se coinvolge dati sanitari. Revoca token, audit dei log API per quantificare l'esfiltrazione. |
| 11 | Insider threat: dipendente SD accede a dati personali senza autorizzazione | C | **ALTO** | Coinvolge anche profili disciplinari e penali. DPO e legale coinvolti immediatamente. |
| 12 | Perdita o corruzione irreversibile di backup | D | **MEDIO / ALTO** | Se comporta perdita definitiva di dati sanitari: ALTO. Verifica della possibilità di ripristino da snapshot mensile. |
| 13 | DDoS con downtime prolungato (> 4 ore) senza compromissione dei dati | D | **BASSO** | Violazione di disponibilità. Se non vi è accesso ai dati: probabilmente non notificabile. Valutare impatto su servizi critici (trasporti sanitari in emergenza). |
| 14 | Divulgazione accidentale di dati personali in log pubblici o repository Git | C | **ALTO** | Se il repository è pubblico: CRITICO. Rimozione immediata e audit della storia Git. |
| 15 | Violazione della catena HMAC dell'audit trail (trip_integrity.ts) | I | **ALTO** | Compromissione dell'integrità dei record dei trasporti sanitari. Impatto legale sulla validità documentale. |
| 16 | Accesso non autorizzato a credenziali SMTP cifrate con AES-256 | C | **MEDIO** | Se la chiave AES è separata dal database cifrato: rischio contenuto. Rotazione immediata delle credenziali. |
| 17 | Configurazione errata che espone endpoint API senza autenticazione | C | **ALTO / CRITICO** | Dipende dai dati accessibili. Chiusura immediata dell'endpoint. Audit dei log per quantificare gli accessi. |

---

## 4. PROCESSO DI GESTIONE — FASI

### FASE 1: RILEVAMENTO E TRIAGE (0–4 ore dalla scoperta)

#### 4.1.1 Canali di rilevamento

La violazione può essere rilevata attraverso i seguenti canali:

- **Alert automatici Sentry**: notifiche di errori anomali, spike di eccezioni, pattern inusuali;
- **Alert UptimeRobot**: indisponibilità del servizio, tempi di risposta anomali;
- **Alert Railway**: utilizzo anomalo di risorse CPU/memoria, log di errori critici;
- **Alert Supabase**: tentativi di accesso anomali, query inusuali al database;
- **Segnalazione interna**: dipendente SD che rileva comportamento anomalo del sistema o accesso non autorizzato;
- **Segnalazione esterna**: organizzazione cliente che segnala comportamento anomalo, segnalazione di un interessato, segnalazione da parte di ricercatori di sicurezza (responsible disclosure);
- **Rilevamento proattivo**: audit di sicurezza, penetration test, analisi dei log.

#### 4.1.2 Responsabile del triage

- **Primario**: CTO (reperibile 24/7 per incidenti critici)
- **Backup**: Lead Engineer (in assenza del CTO)
- **Escalation**: DPO (da coinvolgere entro 2 ore per incidenti ALTO e CRITICO)

#### 4.1.3 Azioni immediate (entro 1 ora dalla segnalazione)

1. **Conferma dell'incidente**: determinare se si tratta di un vero positivo (incidente reale) o un falso positivo (alert errato, malfunzionamento tecnico non legato a dati). In caso di dubbio, procedere come se fosse un vero positivo.

2. **Contenimento immediato**:
   - Blocco degli accessi sospetti (revoca token JWT, invalidazione sessioni Supabase, blocco IP);
   - Isolamento del sistema o del componente compromesso se necessario per prevenire la propagazione;
   - Sospensione temporanea dell'endpoint o del servizio interessato se il rischio di ulteriore esposizione è immediato;
   - Conservazione delle evidenze forensi (log, dump di memoria, screenshot) prima di qualsiasi operazione di ripristino.

3. **Apertura del ticket di incidente**: apertura di un ticket nel sistema di tracking interno con:
   - Timestamp preciso di scoperta (non di accadimento, che potrà essere determinato in seguito);
   - Canale di rilevamento;
   - Prima descrizione dell'incidente;
   - Azioni di contenimento già adottate;
   - Assegnazione a CTO/Lead Engineer.

4. **Prima valutazione del tipo di violazione**: classificazione preliminare secondo lo schema C/I/D e stima del livello di rischio (BASSO / MEDIO / ALTO / CRITICO) sulla base della tabella di cui alla Sezione 3.

5. **Notifica interna**: il CTO notifica il DPO entro 2 ore dalla conferma per incidenti ALTO e CRITICO; entro 4 ore per incidenti MEDIO. Per incidenti BASSO, il DPO è informato nel report giornaliero.

---

### FASE 2: VALUTAZIONE (4–8 ore dalla scoperta)

#### 4.2.1 Determinazione della portata

Il team (CTO + DPO) determina con la massima precisione possibile:

- **Quali dati sono stati coinvolti**: categorie (comuni, particolari ex art. 9, giudiziari ex art. 10), natura specifica (dati sanitari, GPS, credenziali, ecc.);
- **Quanti record sono stati coinvolti**: numero approssimativo di record e di interessati distinti;
- **Quali tenant/organizzazioni sono state coinvolte**: uno o più tenant; impatto localizzato o sistemico;
- **Periodo temporale della violazione**: da quando a quando i dati erano esposti o compromessi;
- **Se i dati hanno lasciato il perimetro controllato** (esfiltrazione confermata, sospettata o esclusa).

#### 4.2.2 Matrice di valutazione del rischio

Il livello di rischio è determinato combinando la gravità dell'impatto potenziale sugli interessati con la probabilità che tale impatto si verifichi:

| | Gravità BASSA (dati non sensibili, misure di sicurezza efficaci) | Gravità MEDIA (dati sensibili, misure parzialmente efficaci) | Gravità ALTA (dati art. 9, minori, misure assenti o compromesse) |
|---|---|---|---|
| **Probabilità BASSA** | BASSO | MEDIO | ALTO |
| **Probabilità MEDIA** | MEDIO | ALTO | CRITICO |
| **Probabilità ALTA** | ALTO | CRITICO | CRITICO |

**Criteri di gravità**:
- BASSA: dati comuni, volume limitato, dati già pubblicamente disponibili, misure crittografiche intatte;
- MEDIA: dati comuni in volume significativo, pseudonimizzati, probabilità limitata di uso illecito;
- ALTA: dati art. 9 (sanitari, biometrici), minori, dati finanziari, volume elevato, misure compromesse.

**Criteri di probabilità**:
- BASSA: esfiltrazione non confermata, accesso limitato nel tempo, attaccante senza contesto per sfruttare i dati;
- MEDIA: accesso confermato ma utilizzo illecito incerto;
- ALTA: esfiltrazione confermata, dati già pubblicati o venduti, attaccante con chiaro movente.

#### 4.2.3 Decisioni di notifica

**Notifica ai Titolari (organizzazioni clienti)**:
- **SEMPRE**, indipendentemente dal livello di rischio, entro 24 ore dalla scoperta;
- In presenza di dati art. 9 coinvolti: notifica immediata (entro 4 ore) per le organizzazioni impattate.

**Notifica al Garante (tramite il Titolare)**:
- **Obbligatoria** se il rischio è MEDIO, ALTO o CRITICO;
- **Non obbligatoria** se il rischio è BASSO e la valutazione è documentata;
- La notifica al Garante compete al **Titolare del Trattamento** (organizzazione cliente); SD fornisce supporto tecnico completo.

**Notifica agli interessati (art. 34 GDPR)**:
- **Obbligatoria** se il rischio è ALTO o CRITICO;
- Facoltativa (ma raccomandata) per rischio MEDIO;
- Non applicabile per rischio BASSO.

---

### FASE 3: NOTIFICA AI TITOLARI DEL TRATTAMENTO (entro 24 ore dalla scoperta)

#### 4.3.1 Obbligo di notifica del Responsabile

L'art. 33(2) GDPR impone al Responsabile del Trattamento di notificare la violazione al Titolare "senza ingiustificato ritardo" dopo esserne venuto a conoscenza. SD fissa il termine interno a **24 ore dalla scoperta** per garantire al Titolare il tempo necessario per adempiere al proprio obbligo di notifica al Garante entro 72 ore.

#### 4.3.2 Template di notifica al Titolare

---

**OGGETTO:** [URGENTE — DATA BREACH] Notifica di violazione dei dati personali — Soccorso Digitale S.r.l. — Incidente #[ID]

Gentile [Nome referente privacy dell'organizzazione cliente],

Soccorso Digitale S.r.l., in qualità di Responsabile del Trattamento ai sensi dell'art. 28 GDPR, La informa che in data **[data e ora scoperta — UTC]** è stata rilevata una violazione dei dati personali che coinvolge i dati trattati per conto della Sua organizzazione.

**1. Natura della violazione**
[Descrizione tecnica della violazione: tipo (riservatezza/integrità/disponibilità), vettore di attacco o causa, sistemi coinvolti, se la violazione è ancora in corso o è stata contenuta.]

**2. Categorie di dati personali coinvolti**
[Elenco delle categorie: es. dati anagrafici pazienti, dati sanitari ex art. 9 GDPR, dati GPS operatori, credenziali, ecc.]

**3. Categorie di interessati coinvolti e numero approssimativo**
[Es. pazienti: circa [N]; operatori: circa [N]; totale stimato: [N]. Se il numero preciso non è ancora determinabile, indicare la stima più conservativa.]

**4. Periodo temporale della violazione**
[Da: [data/ora stimata inizio] — A: [data/ora contenimento] oppure "la violazione è ancora in corso"]

**5. Conseguenze probabili della violazione**
[Descrizione degli impatti potenziali: rischio di uso illecito dei dati, discriminazione, furto d'identità, impatto sulla salute degli interessati, ecc.]

**6. Misure adottate o proposte da Soccorso Digitale S.r.l.**
[Azioni di contenimento già adottate: revoca token, blocco accessi, isolamento sistema, ecc. Misure correttive in fase di implementazione.]

**7. Valutazione del rischio preliminare**
[Livello: BASSO / MEDIO / ALTO / CRITICO — con breve motivazione]

**8. Raccomandazioni per la notifica al Garante**
[Se il livello di rischio è MEDIO, ALTO o CRITICO: "Si raccomanda di notificare la violazione al Garante per la protezione dei dati personali entro 72 ore dalla presente comunicazione, ai sensi dell'art. 33 GDPR. Siamo a disposizione per fornire tutte le informazioni tecniche necessarie."]

**9. Referenti Soccorso Digitale S.r.l.**
- DPO: privacy@soccorsodigitale.app — disponibile immediatamente
- CTO: [email] — reperibile 24/7 per incidenti critici

Restiamo a disposizione per qualsiasi approfondimento e per fornire documentazione tecnica integrativa.

Distinti saluti,
DPO — Soccorso Digitale S.r.l.

---

---

### FASE 4: SUPPORTO ALLA NOTIFICA AL GARANTE (entro 72 ore dalla scoperta)

#### 4.4.1 Responsabilità della notifica

L'obbligo di notifica al Garante per la protezione dei dati personali (art. 33 GDPR) compete al **Titolare del Trattamento** (organizzazione cliente). SD, in quanto Responsabile, non notifica direttamente al Garante ma supporta attivamente il Titolare.

Il termine di 72 ore decorre dal momento in cui il **Titolare** viene a conoscenza della violazione, non dal momento in cui ne viene a conoscenza SD. Tuttavia, data la prassi di notifica di SD entro 24 ore, il Titolare dispone di circa 48 ore per elaborare la notifica al Garante.

#### 4.4.2 Documentazione tecnica fornita da SD al Titolare

SD mette a disposizione del Titolare, entro il termine congruo rispetto alla notifica al Garante:

- **Timeline dettagliata degli eventi**: cronologia precisa dall'accadimento (stimato) alla scoperta al contenimento, con timestamp;
- **Report tecnico della violazione**: sistemi coinvolti, vettore di attacco o causa, dati e record interessati, misure di sicurezza in atto al momento della violazione;
- **Misure di contenimento adottate**: documentazione di tutte le azioni tecniche intraprese con data e ora;
- **Misure correttive pianificate**: roadmap degli interventi per prevenire il ripetersi della violazione;
- **Dati per la compilazione del modulo Garante**: numero di interessati (anche stimato), categorie di dati, periodo di esposizione, impatto probabile.

#### 4.4.3 Riferimenti per la notifica al Garante

- **Portale del Garante per la notifica dei data breach**: [https://www.gpdp.it/web/guest/home/docweb/-/docweb-display/docweb/9128501](https://www.gpdp.it/web/guest/home/docweb/-/docweb-display/docweb/9128501)
- **Modulo di notifica online**: disponibile sul portale del Garante;
- **Centralino Garante**: 06 69677 1;
- **Per notifiche urgenti fuori orario**: il Garante prevede la possibilità di una notifica iniziale incompleta, da integrare entro termini concordati (art. 33(4) GDPR).

#### 4.4.4 Notifica in fasi (art. 33(4) GDPR)

Se al momento della notifica non tutte le informazioni sono disponibili, il Titolare può notificare in fasi successive, indicando il motivo del ritardo nell'acquisizione delle informazioni mancanti. SD supporta il Titolare fornendo aggiornamenti tecnici man mano che l'analisi progredisce.

---

### FASE 5: NOTIFICA AGLI INTERESSATI (se rischio elevato — art. 34 GDPR)

#### 4.5.1 Criteri di attivazione

La notifica agli interessati è attivata quando la violazione "è suscettibile di presentare un rischio elevato per i diritti e le libertà delle persone fisiche" (art. 34(1) GDPR). Tale condizione si realizza tipicamente in presenza di:

- Coinvolgimento di dati sanitari (art. 9 GDPR) di un numero significativo di pazienti;
- Esfiltrazione confermata di dati idonei a consentire furto d'identità o frode;
- Compromissione di credenziali (password, token di autenticazione) in chiaro o facilmente decifrabili;
- Coinvolgimento di soggetti vulnerabili (minori, persone con disabilità).

La notifica agli interessati **non è obbligatoria** se (art. 34(3) GDPR):

- I dati erano cifrati con algoritmo robusto e la chiave non è compromessa;
- SD ha adottato misure tecniche e organizzative che rendono i dati incomprensibili per chiunque non sia autorizzato ad accedervi;
- La notifica richiederebbe sforzi sproporzionati: in tal caso si può ricorrere a una comunicazione pubblica o equivalente.

#### 4.5.2 Template di comunicazione agli interessati

---

**OGGETTO:** Comunicazione importante sulla sicurezza dei tuoi dati personali

Gentile [Nome/Denominazione],

[Nome dell'organizzazione cliente — Titolare del Trattamento], con il supporto del proprio fornitore tecnologico Soccorso Digitale S.r.l., La informa che si è verificata una violazione dei dati personali che potrebbe riguardarLa.

**Cosa è successo**
[Descrizione in linguaggio semplice e chiaro, senza tecnicismi, di cosa è avvenuto, quando e come è stata scoperta la violazione.]

**Quali dati sono stati coinvolti**
[Elenco in linguaggio comune delle categorie di dati: es. "il suo nome e cognome", "il suo codice fiscale", "informazioni relative al trasporto sanitario effettuato in data [data]".]

**Quali rischi può comportare**
[Descrizione onesta e proporzionata dei rischi concreti: es. "I suoi dati potrebbero essere stati visti da persone non autorizzate" — evitare minimizzazioni eccessive o allarmismi ingiustificati.]

**Cosa abbiamo già fatto**
[Misure di contenimento adottate: es. "Abbiamo immediatamente bloccato l'accesso non autorizzato", "Abbiamo ripristinato la sicurezza del sistema", ecc.]

**Cosa può fare Lei**
[Raccomandazioni pratiche: es. "Le raccomandiamo di prestare attenzione a comunicazioni sospette che usino sue informazioni personali", "Se ha utilizzato la stessa password su altri servizi, La invitiamo a cambiarla", ecc.]

**I suoi diritti**
Lei ha il diritto di presentare reclamo al Garante per la protezione dei dati personali (www.gpdp.it) e di esercitare i diritti previsti dagli artt. 15-22 GDPR (accesso, rettifica, cancellazione, opposizione) contattando: [email privacy del Titolare].

**Per ulteriori informazioni**
[Email di contatto dedicata all'incidente, se istituita] — [Numero verde o riferimento telefonico, se disponibile]

Ci scusiamo per il disagio causato e La assicuriamo del massimo impegno per prevenire il ripetersi di situazioni simili.

Cordiali saluti,
[Nome e firma del Titolare del Trattamento]
[Data]

---

#### 4.5.3 Canali di notifica agli interessati

In ordine di preferenza:

1. **Email**: canale primario, tracciabile, documentabile;
2. **SMS**: per urgenze o quando l'email non è disponibile;
3. **Notifica in-app**: tramite la piattaforma SD, se l'interessato ha un account attivo;
4. **Comunicazione pubblica** (es. banner sul sito web): solo se la notifica individuale richiederebbe sforzi sproporzionati (art. 34(3)(c) GDPR), previa autorizzazione del Garante se necessario.

---

### FASE 6: CONTENIMENTO E RIPRISTINO

#### 4.6.1 Checklist tecnica per tipo di incidente

**Per violazioni di riservatezza (accesso non autorizzato)**:
- [ ] Revocare tutti i token JWT attivi dell'account/sistema compromesso;
- [ ] Invalidare le sessioni Supabase attive;
- [ ] Bloccare l'IP sorgente dell'accesso non autorizzato (se identificato);
- [ ] Modificare le credenziali di accesso ai sistemi coinvolti;
- [ ] Ruotare le chiavi API dei servizi terzi coinvolti;
- [ ] Auditare i log di accesso per quantificare l'esposizione;
- [ ] Verificare l'assenza di backdoor o accessi persistenti.

**Per attacchi ransomware o violazioni di disponibilità**:
- [ ] Isolare il sistema compromesso dalla rete;
- [ ] Non pagare il riscatto senza consultare autorità competenti e legale;
- [ ] Verificare l'integrità dei backup prima del ripristino;
- [ ] Ripristinare da backup pulito (snapshot precedente all'incidente);
- [ ] Verificare l'integrità HMAC dell'audit trail dopo il ripristino;
- [ ] Cambiare tutte le credenziali di accesso ai sistemi ripristinati.

**Per violazioni di integrità (alterazione dati)**:
- [ ] Identificare i record alterati tramite confronto con audit trail HMAC;
- [ ] Ripristinare i dati corretti da backup verificato;
- [ ] Documentare ogni record alterato con before/after per fini documentali;
- [ ] Notificare le organizzazioni clienti i cui dati sono stati alterati.

**Per bug di isolamento multi-tenant**:
- [ ] Sospendere temporaneamente il servizio o il componente interessato;
- [ ] Identificare tutti i tenant coinvolti (sia il tenant "espositore" che il tenant "esposto");
- [ ] Quantificare le query cross-tenant avvenute tramite i log del database;
- [ ] Applicare il fix del bug e testare l'isolamento prima della rimessa in produzione;
- [ ] Notificare entrambi i tenant coinvolti.

#### 4.6.2 Verifica dell'integrità dell'audit trail HMAC

Dopo qualsiasi incidente che coinvolga il database dei trasporti, SD esegue una verifica dell'integrità della catena HMAC-SHA256 gestita da `trip_integrity.ts`:

1. Riesecuzione del calcolo degli hash su tutti i record del periodo coinvolto;
2. Confronto con gli hash memorizzati;
3. Identificazione di eventuali discrepanze (che indicano alterazione dei dati);
4. Documentazione dell'esito nel report post-incidente.

L'integrità dell'audit trail è fondamentale per la validità legale della documentazione dei trasporti sanitari.

#### 4.6.3 Procedure di ripristino backup

Il ripristino da backup segue questa sequenza:

1. **Identificazione del punto di ripristino**: selezione del backup più recente precedente all'incidente e privo di compromissione;
2. **Verifica dell'integrità del backup**: hash del file di backup confrontato con il checksum registrato al momento della creazione;
3. **Ripristino in ambiente isolato**: il backup è ripristinato in un ambiente separato e verificato prima della messa in produzione;
4. **Verifica dei dati critici**: controllo campionario dei dati sanitari e dell'audit trail;
5. **Switch alla produzione**: solo dopo validazione completa;
6. **Cancellazione dei dati che erano stati cancellati prima del backup**: i dati cancellati per obbligo normativo o su richiesta dell'interessato e presenti nel backup ripristinato devono essere nuovamente cancellati.

---

### FASE 7: POST-INCIDENT (entro 30 giorni dalla chiusura dell'incidente)

#### 4.7.1 Root cause analysis

Entro 30 giorni dalla chiusura dell'incidente (contenimento completato, dati ripristinati, notifiche effettuate), il CTO redige un report di root cause analysis che include:

- **Causa radice tecnica**: vulnerabilità specifica, errore di configurazione, comportamento anomalo del sistema, fattore umano;
- **Fattori contribuenti**: lacune nei controlli di sicurezza, insufficienza dei monitoraggi, processi carenti;
- **Timeline dettagliata**: dall'accadimento stimato alla scoperta al contenimento al ripristino;
- **Impatto quantificato**: numero definitivo di interessati, categorie di dati, durata dell'esposizione.

#### 4.7.2 Report incidente completo

Il report completo è redatto congiuntamente da CTO e DPO e include:

- Root cause analysis (vedi sopra);
- Valutazione finale del rischio (confermata o aggiornata rispetto alla stima iniziale);
- Misure correttive implementate o pianificate con scadenze e responsabili;
- Verifica dell'adeguatezza delle notifiche effettuate (Titolari, Garante, interessati);
- Raccomandazioni per la prevenzione di incidenti analoghi.

Il report è conservato nel registro delle violazioni (cfr. Sezione 5) per 5 anni.

#### 4.7.3 Aggiornamento della DPIA

Se la violazione evidenzia un rischio non precedentemente identificato o una variazione significativa del rischio per le categorie di interessati coinvolti, il DPO aggiorna la DPIA del trattamento interessato entro 30 giorni dalla chiusura dell'incidente (art. 35 GDPR).

#### 4.7.4 Misure correttive

Le misure correttive sono classificate per urgenza:

- **Immediate (entro 24 ore)**: misure di contenimento già adottate nella Fase 1 e 2;
- **Breve termine (entro 7 giorni)**: fix tecnici critici per eliminare la vulnerabilità sfruttata;
- **Medio termine (entro 30 giorni)**: miglioramenti ai controlli di sicurezza e ai processi;
- **Lungo termine (entro 90 giorni)**: revisioni architetturali, aggiornamenti di policy, formazione del personale.

Ogni misura correttiva è assegnata a un responsabile con scadenza e KPI di completamento. Il DPO verifica il completamento nel report post-incidente.

---

## 5. REGISTRO DELLE VIOLAZIONI

L'art. 33(5) GDPR impone al Titolare del Trattamento di documentare qualsiasi violazione dei dati personali, comprese le circostanze in cui si è verificata, le sue conseguenze e i provvedimenti adottati per porvi rimedio. SD, in quanto Responsabile, mantiene un proprio registro interno delle violazioni che coinvolgono dati trattati per conto dei Titolari.

Il registro è conservato in forma riservata e accessibile esclusivamente a DPO, CTO e al management di SD. È messo a disposizione del Garante su richiesta.

### Modello del Registro Interno delle Violazioni

| Campo | Descrizione |
|-------|-------------|
| **ID incidente** | Identificatore univoco progressivo (es. DB-2026-001) |
| **Data e ora di scoperta** | Timestamp preciso (UTC) del momento in cui SD ha preso conoscenza della violazione |
| **Data e ora di accadimento stimato** | Se determinabile, il momento in cui la violazione ha avuto inizio |
| **Data notifica ai Titolari** | Data e ora dell'invio della notifica ex art. 33(2) GDPR ai Titolari coinvolti |
| **Data notifica al Garante** | Data di notifica al Garante da parte del Titolare (se avvenuta); oppure "Non effettuata — motivazione: [...]" |
| **Data notifica agli interessati** | Data di notifica agli interessati ex art. 34 GDPR; oppure "Non effettuata — motivazione: [...]" |
| **Tipo di violazione** | C (riservatezza) / I (integrità) / D (disponibilità) — può essere multiplo |
| **Descrizione della violazione** | Descrizione sintetica ma completa della natura dell'incidente |
| **Categorie di dati coinvolti** | Elenco delle categorie di dati personali interessati dalla violazione |
| **Categorie di interessati** | Pazienti / operatori / amministratori / clienti — con numero approssimativo per categoria |
| **Numero totale di interessati** | Stima definitiva (o migliore stima disponibile) del numero di persone fisiche coinvolte |
| **Tenant/organizzazioni coinvolte** | Elenco delle organizzazioni clienti i cui dati sono stati coinvolti |
| **Livello di rischio** | BASSO / MEDIO / ALTO / CRITICO (valutazione finale) |
| **Misure di contenimento adottate** | Sintesi delle azioni tecniche e organizzative di contenimento |
| **Misure correttive implementate** | Sintesi degli interventi tecnici per prevenire il ripetersi |
| **Root cause** | Causa principale della violazione (definitiva, dal report post-incidente) |
| **Note** | Qualsiasi informazione rilevante non coperta dalle colonne precedenti |
| **Incidente chiuso** | Sì / No — con data di chiusura |

---

## 6. CONTATTI E ESCALATION

### 6.1 Contatti interni SD

| Ruolo | Contatto | Disponibilità |
|-------|----------|--------------|
| DPO — Soccorso Digitale S.r.l. | privacy@soccorsodigitale.app | Orario lavorativo; urgenze tramite CTO |
| CTO | [email CTO] | 24/7 per incidenti ALTO e CRITICO |
| Lead Engineer (backup CTO) | [email Lead Engineer] | 24/7 per incidenti ALTO e CRITICO |
| CEO / Management | [email CEO] | Da coinvolgere per incidenti CRITICO o con impatto mediatico |

### 6.2 Contatti esterni

| Soggetto | Riferimento | Note |
|----------|-------------|-------|
| **Garante per la protezione dei dati personali** | www.gpdp.it — Tel. 06 69677 1 | Notifica tramite portale online. Indirizzo: Piazza Venezia 11, 00187 Roma |
| **Supabase (sub-processor)** | support@supabase.com | Per violazioni che coinvolgono l'infrastruttura Supabase |
| **Railway (sub-processor)** | team@railway.app | Per violazioni che coinvolgono l'infrastruttura Railway |
| **Sentry (sub-processor)** | security@sentry.io | Per violazioni legate al sistema di error monitoring |
| **Cloudflare (sub-processor)** | security@cloudflare.com | Per violazioni legate a CDN/DNS |
| **Stripe (sub-processor)** | security@stripe.com | Per violazioni legate ai dati di pagamento |
| **CSIRT Italia (AGID)** | csirt@agid.gov.it | Per incidenti che richiedono segnalazione NIS2 (se applicabile) |
| **Polizia Postale** | commissariatodips.it | Per incidenti con profili penali (accesso abusivo, ransomware) |

### 6.3 Matrice di escalation per livello di rischio

| Livello | Coinvolgimento DPO | Coinvolgimento CEO | Notifica Titolari | Notifica Garante (via Titolare) | Notifica Interessati |
|---------|-------------------|-------------------|------------------|--------------------------------|---------------------|
| BASSO | Entro 24 ore (report) | Non necessario | Sì, entro 24 ore | Da valutare | Non necessaria |
| MEDIO | Entro 4 ore | Informato | Sì, entro 12 ore | Sì, raccomandato | Da valutare |
| ALTO | Immediato | Informato entro 4 ore | Sì, entro 4 ore | Sì, obbligatorio | Sì, se rischio elevato |
| CRITICO | Immediato | Coinvolto nella gestione | Sì, entro 2 ore | Sì, urgente | Sì, obbligatorio |

---

## 7. TEST E SIMULAZIONI

### 7.1 Drill annuale

SD effettua almeno un drill annuale di simulazione di data breach, preferibilmente nel mese di ottobre (Cybersecurity Awareness Month). Il drill include:

- **Scenario simulato**: l'incidente è scelto tra quelli della tabella in Sezione 3, con preferenza per gli scenari CRITICO non ancora testati;
- **Attivazione della catena di notifica**: test del flusso di comunicazione interna (rilevamento → CTO → DPO → management) e verso l'esterno (template di notifica al Titolare);
- **Test dei canali di comunicazione**: verifica che i contatti di emergenza siano aggiornati e raggiungibili;
- **Test delle procedure tecniche**: verifica dei backup, della procedura di ripristino, della revoca dei token;
- **Debriefing**: sessione post-drill con identificazione dei gap e delle aree di miglioramento.

### 7.2 Verifiche periodiche

- **Trimestrali**: verifica che i contatti di escalation (Sezione 6) siano aggiornati;
- **Semestrali**: verifica che i template di notifica siano aggiornati rispetto alle ultime indicazioni del Garante e dell'EDPB;
- **Annuali**: aggiornamento della tabella degli scenari (Sezione 3) sulla base di nuove minacce e degli incidenti avvenuti nel corso dell'anno.

### 7.3 Aggiornamento post-incidente

Ogni incidente reale deve tradursi in un aggiornamento della presente procedura entro 30 giorni dalla chiusura dell'incidente, in particolare per:

- Aggiornare la tabella degli scenari con il nuovo scenario (se non già presente) o con le lezioni apprese sullo scenario verificatosi;
- Aggiornare le checklist di contenimento con le azioni risultate efficaci;
- Aggiornare la matrice di rischio se la valutazione default per un determinato scenario è risultata inadeguata.

---

## 8. RIFERIMENTI NORMATIVI

- Regolamento (UE) 2016/679 (GDPR), art. 4(12) (definizione di violazione), art. 33 (notifica al Garante), art. 34 (comunicazione agli interessati), art. 33(2) (obbligo del Responsabile), art. 33(5) (registro delle violazioni), art. 82 (responsabilità e risarcimento del danno)
- D.Lgs. 30 giugno 2003, n. 196 (Codice in materia di protezione dei dati personali), come modificato dal D.Lgs. 101/2018
- EDPB Guidelines 01/2021 on Examples regarding Data Breach Notification (versione 2.0, adottata il 14 gennaio 2021)
- EDPB/WP29 Guidelines on Personal data breach notification under Regulation 2016/679 (WP250 rev.01, ottobre 2017)
- Direttiva (UE) 2022/2555 (NIS2): per infrastrutture critiche nel settore sanitario, valutare l'applicabilità degli obblighi di notifica NIS2 in coordinamento con il CSIRT Italia
- D.Lgs. 18 maggio 2018, n. 65 (attuazione NIS in Italia)
- Provvedimento Garante n. 157 del 21 marzo 2019 (misure di sicurezza nel settore sanitario)
- Art. 615-ter c.p. (accesso abusivo a sistema informatico): rilevante per incidenti con profili penali
- Art. 629 c.p. (estorsione): rilevante per attacchi ransomware

---

## 9. REVISIONE DEL DOCUMENTO

| Versione | Data | Modifiche principali | Approvato da |
|----------|------|----------------------|--------------|
| 1.0 | 27 marzo 2026 | Prima adozione della Procedura | DPO — Soccorso Digitale S.r.l. |

**Prossima revisione ordinaria:** 27 marzo 2027

---

*Documento prodotto da Soccorso Digitale S.r.l. — Responsabile del Trattamento ex art. 28 GDPR.*
*Per informazioni: privacy@soccorsodigitale.app*
