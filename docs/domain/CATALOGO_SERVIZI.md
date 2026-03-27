# CATALOGO SERVIZI — Soccorso Digitale
**Versione**: 1.0
**Autore**: ASCLEPIUS — Domain Expert EMS
**Data**: 2026-03-27
**Destinatari**: Dev Team, Sales Team, Operatori di validazione

---

## INDICE

1. [DIALISI — CUT (Corsa Unica Trasporto)](#1-dialisi--cut-corsa-unica-trasporto)
2. [VISITE SPECIALISTICHE](#2-visite-specialistiche)
3. [DIMISSIONI OSPEDALIERE](#3-dimissioni-ospedaliere)
4. [TRASFERIMENTI INTER-OSPEDALIERI](#4-trasferimenti-inter-ospedalieri)
5. [TRASPORTO DISABILI (L. 104/1992)](#5-trasporto-disabili-l-1041992)
6. [TRASPORTO SANGUE, ORGANI E CAMPIONI BIOLOGICI](#6-trasporto-sangue-organi-e-campioni-biologici)
7. [ASSISTENZA EVENTI E MANIFESTAZIONI](#7-assistenza-eventi-e-manifestazioni)
8. [TRASPORTO NEONATALE — STEN/STAM](#8-trasporto-neonatale--stenstam)
9. [TRASPORTO PSICHIATRICO — TSO/ASO](#9-trasporto-psichiatrico--tsoaso)
10. [TRASPORTO BARIATRICO](#10-trasporto-bariatrico)
11. [GUARDIA MEDICA E VISITE DOMICILIARI](#11-guardia-medica-e-visite-domiciliari)
12. [TRASPORTO ONCOLOGICO](#12-trasporto-oncologico)

---

## 1. DIALISI — CUT (Corsa Unica Trasporto)

**Codice interno SD**: `DIAL`
**Nome ufficiale**: Trasporto sanitario per emodialisi / Corsa Unica Trasporto dializzati
**Frequenza tipica**: 3 servizi/settimana per paziente (lunedì-mercoledì-venerdì o martedì-giovedì-sabato), 52 settimane/anno = 156 corse/anno per paziente per singola tratta; il doppio se si conta andata e ritorno.

### Descrizione operativa

Il trasporto dialisi è la spina dorsale economica di qualsiasi cooperativa di trasporto sanitario in Italia. Un singolo centro dialisi con 40 pazienti genera circa 12.480 corse/anno solo per l'andata — il ritorno raddoppia. I centri dialisi operano su 3 turni giornalieri: primo turno ore 6:00-12:00, secondo turno ore 12:00-18:00, terzo turno ore 18:00-24:00 (in alcune strutture esiste anche il turno notturno).

Il paziente dializzato è quasi sempre anziano (65-85 anni nella maggior parte dei casi), con pluricomorbilità, con accesso vascolare permanente — fistola arterovenosa al braccio o catetere venoso centrale. Dopo la seduta dialitica il paziente è ipoteso, affaticato, a volte somnolente. Il ritorno è operativamente più delicato dell'andata.

Il processo reale funziona così: la cooperativa firma una convenzione con il centro dialisi (a volte con la ASL che finanzia il servizio), con un elenco nominativo di pazienti da trasportare. I pazienti sono assegnati a turni fissi. Il servizio gira ogni settimana con le stesse corse, salvo sostituzioni per ospedalizzazione, vacanza, variazione turno.

La tariffa è quasi sempre concordata a livello mensile/annuale per paziente, non per singola corsa. Il calcolo avviene in base alla distanza media casa-centro, con fasce chilometriche. Alcune ASL (Veneto in particolare) usano il nomenclatore tariffario regionale a corsa singola.

### Tipi di mezzo ammesso

- **Ambulanza di Tipo A (trasporto)**: standard per il 90% dei pazienti dialisi; il paziente può stare seduto o disteso, l'ambulanza A1/A2 è sufficiente.
- **Ambulanza di Tipo B (soccorso)**: richiesta quando il paziente ha ossigeno-terapia domiciliare, instabilità emodinamica nota, o è allettato permanente.
- **Auto sanitaria MSA**: ammessa in alcune convenzioni regionali per pazienti deambulanti con minima assistenza; raramente usata per dialisi.
- **Pulmino attrezzato**: ammesso solo per pazienti dializzati deambulanti senza necessità di lettiga; alcune cooperative abbassano i costi usando pulmini per piccoli gruppi sullo stesso percorso.
- **Veicolo privato autorizzato**: non ammesso per dialisi convenzionata con SSN.

### Composizione equipaggio minimo

- **Autista-soccorritore**: obbligatorio su ambulanza, qualifica TSSA o equivalente regionale.
- **Secondo soccorritore**: obbligatorio se il paziente è in lettiga (ambulanza tipo A disteso); facoltativo se il paziente è seduto e sale/scende autonomamente.
- **Infermiere a bordo**: non richiesto di routine per dialisi stabile; obbligatorio se il paziente ha accesso vascolare con problemi attivi, ossigeno-dipendenza severa, o su prescrizione medica specifica.

### Documentazione obbligatoria

- **Foglio viaggio (o registro corse)**: compilato dall'autista per ogni singola corsa; contiene orario partenza, orario arrivo, km percorsi, firma paziente o del centro dialisi all'arrivo. SD lo genera automaticamente e l'autista lo firma digitalmente via app.
- **Scheda paziente dialisi**: documento di competenza della cooperativa; raccoglie le esigenze specifiche del paziente (posizione in ambulanza, ossigeno, ausili, note di accesso all'abitazione, codice portone, piano). SD la memorizza come profilo paziente ricorrente.
- **Modulo ASL/ULSS di autorizzazione al trasporto**: in molte regioni la ASL emette una autorizzazione periodica (trimestrale o annuale) che legittima il rimborso. SD archivia il documento con data scadenza e alert.
- **Documento di identità paziente**: copia in atti; in SD è allegato al profilo anagrafica paziente.

### Workflow tipo

1. **Setup iniziale** — La cooperativa riceve l'elenco pazienti dal centro dialisi o dalla ASL → inserimento in SD come "pazienti abituali" con profilo completo, indirizzo, esigenze, turno assegnato.
2. **Generazione automatica corse** — SD genera automaticamente le corse ricorrenti per l'intera settimana (o il mese) in base al calendario turni del centro dialisi. Ogni paziente ha la sua corsa di andata e la sua corsa di ritorno.
3. **Assegnazione mezzi** — Il responsabile operativo assegna il mezzo e l'equipaggio alle corse (manuale o con supporto logistico SD). Le corse abituali tendono ad avere l'assegnazione fissa settimana per settimana.
4. **Notifica equipaggio** — L'autista riceve il turno sull'app SD con elenco pazienti, indirizzi, note specifiche, ordine di raccolta (se su un unico mezzo ci sono più pazienti).
5. **Esecuzione corsa** — L'autista parte, arriva a casa del paziente, lo carica, porta al centro dialisi, ottiene firma (o conferma digitale) dell'arrivo.
6. **Conferma in tempo reale** — SD aggiorna lo stato corsa: "in esecuzione" → "paziente ritirato" → "consegnato a centro dialisi".
7. **Ritorno** — Dopo X ore (dipende dalla durata della seduta, tipicamente 4 ore), l'autista torna al centro dialisi, raccoglie il paziente, lo riporta a casa. La corsa di ritorno è un servizio separato in SD ma collegata all'andata.
8. **Chiusura e firma** — A fine corsa, l'autista chiude il servizio in app: conferma km, orario reale, eventuali anomalie.
9. **Rendicontazione mensile** — SD genera il riepilogo mensile per paziente (corse effettuate, km, eventuali assenze) da inviare alla ASL o al centro dialisi per il rimborso.

### Gestione in SD

- **Creazione servizio**: il paziente dialisi viene inserito come "paziente ricorrente" con profilo completo. La tipologia servizio è `DIAL`. Le corse ricorrenti vengono generate da un template settimanale.
- **Assegnazione**: il sistema propone l'assegnazione in base alla disponibilità del mezzo e alla storicità (stesso mezzo, stesso autista per continuità relazionale con il paziente anziano).
- **Esecuzione**: l'autista vede in app l'elenco dei pazienti del turno, l'indirizzo, le note di accesso, le esigenze specifiche (ossigeno, lettiga, ausili). Può registrare il pick-up con timestamp GPS.
- **Chiusura**: form di chiusura servizio con km effettivi, orario reale partenza/arrivo, eventuali note (paziente non trovato, rifiuto trasporto, complicanze cliniche minori).
- **Fatturazione**: la tariffa viene calcolata in base al contratto associato al paziente (fascia km, quota mensile, o nomenclatore regionale). SD calcola automaticamente l'importo mensile aggregato per ASL/centro dialisi.

### Criticità operative frequenti

- **Paziente non pronto all'orario** — Comune con anziani: non è pronto, ha dimenticato, non ha sentito il campanello. L'autista attende X minuti (configurabile, default 10 min), poi avvisa la centrale. SD permette di registrare l'"attesa non prevista" con impatto su km e orario del turno successivo.
- **Paziente ospedalizzato senza preavviso** — Il centro dialisi non avvisa la cooperativa. L'autista arriva a casa e il paziente non c'è. SD gestisce la "corsa non effettuata per assenza paziente" con motivazione, distinguendo da inadempimento.
- **Paziente con complicanza post-dialitica** — Paziente ipoteso al punto da non riuscire a camminare, sincope. L'autista deve decidere se gestire autonomamente o attivare il 118. SD ha un bottone emergenza che notifica immediatamente la centrale.
- **Mezzo in avaria durante il turno** — L'autista segnala il guasto in app. La centrale deve trovare un mezzo sostitutivo. SD mostra i mezzi disponibili in tempo reale e permette il reindirizzamento della corsa.
- **Variazione turno dialisi** — Il centro dialisi sposta il paziente da turno 1 a turno 2. Se non viene comunicato per tempo, genera disservizi. SD permette la modifica della ricorrenza senza impattare le corse già chiuse.
- **Accesso difficile all'abitazione** — Scala senza ascensore, portone con codice cambiato, cancello automatico. Le note di accesso nel profilo paziente devono essere sempre aggiornate.

### Note per il calcolo tariffa

- **Quota mensile per paziente** (più comune per convenzioni ASL): calcolata su fascia km casa-centro. SD aggrega tutte le corse del mese e verifica coerenza con la quota contrattuale.
- **Tariffa a corsa** (nomenclatori regionali): il sistema applica la tariffa per km o per corsa in base alla tabella tariffaria ASL importata in SD.
- **Maggiorazione notturna**: il terzo turno (18:00-24:00) prevede maggiorazione in molte convenzioni. SD applica la maggiorazione automaticamente in base all'orario di inizio servizio.
- **Penali per servizi non effettuati**: alcune convenzioni prevedono penali se la cooperativa non garantisce il servizio. SD tiene traccia delle corse non effettuate con motivazione per la rendicontazione contrattuale.

---

## 2. VISITE SPECIALISTICHE

**Codice interno SD**: `VISI`
**Nome ufficiale**: Trasporto sanitario per visita specialistica ambulatoriale / Day Hospital
**Frequenza tipica**: Episodica, da 1 a 4 volte al mese per paziente cronico; sporadica per acuto.

### Descrizione operativa

Il trasporto per visita specialistica è strutturalmente diverso dalla dialisi: ogni corsa ha caratteristiche proprie. Il paziente ha una prenotazione CUP (Centro Unico Prenotazione) per un ambulatorio, un day hospital, un esame diagnostico. La sfida operativa principale è che il paziente spesso non conosce esattamente dove deve andare all'interno dell'ospedale o del poliambulatorio, e il tempo di attesa al CUP è imprevedibile.

Il servizio si compone di due parti: l'andata (casa → struttura sanitaria) e il ritorno (struttura sanitaria → casa). Tra le due può esserci una attesa che va da 30 minuti a 4-5 ore. La scelta operativa è: il mezzo aspetta sul posto (più costoso ma più sicuro), oppure il mezzo viene richiamato dal paziente al termine della visita (più economico ma richiede coordinamento).

In entrambi i casi il sistema deve gestire la finestra temporale e avvisare l'equipaggio con congruo anticipo.

### Tipi di mezzo ammesso

- **Ambulanza di Tipo A**: per pazienti non deambulanti o con necessità di assistenza durante il trasporto.
- **Auto sanitaria MSA**: per pazienti deambulanti con minima assistenza; molto usata per questo tipo di servizio.
- **Pulmino attrezzato**: ammesso se il paziente è deambulante e non richiede assistenza clinica.
- **Ambulanza di Tipo B**: solo se il paziente ha condizioni cliniche che lo richiedono (ossigeno, monitoraggio).
- **Veicolo privato autorizzato**: in alcune convenzioni comunali per utenti autosufficienti con difficoltà di mobilità.

### Composizione equipaggio minimo

- **Autista-soccorritore**: obbligatorio.
- **Secondo soccorritore/accompagnatore**: necessario se il paziente non è autonomo nello spostamento all'interno della struttura sanitaria (es. non sa orientarsi, ha deficit cognitivi, è in carrozzina).
- **Infermiere**: solo su prescrizione medica o se il trasporto richiede monitoraggio clinico attivo.

### Documentazione obbligatoria

- **Impegnativa medica (ricetta SSN)**: il documento che legittima il trasporto a carico del SSN. In SD viene registrato il numero di impegnativa e la struttura di destinazione.
- **Foglio viaggio**: come per tutti i servizi.
- **Modulo ASL/ULSS di autorizzazione trasporto**: in alcune regioni (Veneto, Lombardia) è necessaria una autorizzazione preventiva della ASL per ogni trasporto su mezzi SSN. SD archivia il modulo per la rendicontazione.
- **CUP — riferimento prenotazione**: numero di prenotazione e ambulatorio di destinazione, fondamentale per orientare il paziente all'arrivo.

### Workflow tipo

1. **Richiesta servizio** — Può arrivare dal paziente direttamente, dal medico di base, dal reparto ospedaliero, dal familiare. Viene inserita in SD con data visita, struttura, ambulatorio (se noto), ora appuntamento CUP.
2. **Calcolo orario partenza** — SD calcola l'ora di partenza da casa in base alla distanza e al buffer standard (di default 30 minuti di anticipo rispetto all'appuntamento).
3. **Assegnazione mezzo** — In base alla tipologia di paziente e al mezzo disponibile in quella finestra oraria.
4. **Conferma equipaggio** — L'autista riceve dettagli in app: indirizzo paziente, struttura di destinazione, orario appuntamento CUP, note paziente, indicazione se aspettare o tornare.
5. **Esecuzione andata** — Raccolta paziente, trasferimento, consegna al punto di accettazione della struttura.
6. **Gestione attesa** — Se il mezzo aspetta: l'autista registra l'"inizio attesa" in app. Se il mezzo torna: l'operatore di centrale monitora la finestra temporale e riassegna il mezzo per il ritorno quando il paziente avvisa.
7. **Esecuzione ritorno** — Raccolta paziente alla struttura sanitaria, ritorno a casa.
8. **Chiusura servizio** — Firma digitale, km totali, orari reali, note.

### Gestione in SD

- **Creazione servizio**: tipo `VISI`, con collegamento tra servizio andata e servizio ritorno. Campo "tempo attesa stimato" (default 120 minuti, modificabile). Campo "struttura di destinazione" con selezione da rubrica strutture sanitarie.
- **Assegnazione**: la finestra temporale occupata dal mezzo include andata + attesa + ritorno. SD blocca il mezzo per l'intera finestra se il mezzo aspetta.
- **Esecuzione**: l'equipaggio vede in app se deve aspettare o tornare. Se deve tornare, riceve una notifica quando il paziente segnala la fine della visita (via SMS o chiamata gestita dalla centrale).
- **Chiusura**: il sistema chiede di specificare se il ritorno è stato effettuato e in che orario, per la rendicontazione corretta.
- **Fatturazione**: tariffa a corsa, con separazione andata/ritorno. Se il mezzo ha atteso, il tempo di attesa può essere tariffato separatamente in base al contratto.

### Criticità operative frequenti

- **Paziente non sa dove andare** — Il paziente arriva all'ospedale e non trova l'ambulatorio. L'autista deve accompagnarlo all'interno. Se c'è solo un autista senza secondo soccorritore, questo è un problema: il mezzo rimane incustodito in zona ospedaliera.
- **Visita annullata all'ultimo momento** — Il CUP ha spostato l'appuntamento o la struttura ha avvisato il paziente ma non la cooperativa. SD deve gestire la "corsa non effettuata per disdetta CUP" come voce distinta dalla inadempienza.
- **Attesa molto più lunga del previsto** — Stima 2 ore, reale 5 ore. Il mezzo è bloccato e non può fare altri servizi. La centrale deve gestire il reindirizzamento degli altri servizi programmati.
- **Paziente che non vuole tornare** — Decide di fermarsi dalla figlia, di prendere il taxi, ecc. La centrale deve essere avvisata e il ritorno annullato formalmente in SD.
- **Paziente che peggiora durante l'attesa** — Si sente male in sala d'attesa. L'autista è responsabile fino alla consegna formale alla struttura. Procedura: avvisare il personale della struttura e la centrale SD.

### Note per il calcolo tariffa

- **Tariffa base a corsa**: andata e ritorno sono due corse distinte con tariffa per km.
- **Attesa a carico**: alcune convenzioni prevedono un rimborso per le ore di attesa (tariffa oraria). SD distingue km-servizio da ore-attesa nel calcolo.
- **Maggiorazione urgenza**: se la visita viene prenotata con meno di 24 ore di anticipo, può applicarsi una maggiorazione.
- **Rimborso chilometrico vs tariffa flat**: in alcuni contratti la tariffa è flat per fascia di distanza, non a km effettivi.

---

## 3. DIMISSIONI OSPEDALIERE

**Codice interno SD**: `DIMI`
**Nome ufficiale**: Trasporto sanitario per dimissione ospedaliera
**Frequenza tipica**: Urgente/episodica; non programmabile con anticipo superiore alle 24-48 ore.

### Descrizione operativa

La dimissione è operativamente il servizio più stressante dal punto di vista della pianificazione. La corsia chiama la cooperativa (spesso nel tardo pomeriggio), comunicando che il paziente è pronto per essere dimesso e che il letto deve liberarsi — se possibile entro la mattinata successiva, a volte nelle prossime ore. Non esiste una programmazione a lungo termine.

Il medico di reparto ha già firmato la lettera di dimissione. Il paziente ha la sua terapia domiciliare. Ha bisogno di essere accompagnato a casa, oppure in una RSA, o in una struttura riabilitativa — in quest'ultimo caso si tratta tecnicamente di un trasferimento inter-ospedaliero (vedi TRAS).

La cooperativa deve rispondere entro tempi brevi. Il servizio viene inserito in SD come priorità alta, con alert immediato al responsabile operativo e al mezzo disponibile più vicino alla struttura ospedaliera.

### Tipi di mezzo ammesso

- **Ambulanza di Tipo A**: per la maggior parte delle dimissioni ospedaliere ordinarie.
- **Ambulanza di Tipo B**: quando il paziente è dimesso con monitoraggio attivo (ossigeno domiciliare, tracheo, PEG, lesioni non stabilizzate).
- **Auto sanitaria MSA**: solo per pazienti deambulanti con minima assistenza.
- **Pulmino**: non appropriato per dimissione — il paziente dimesso è spesso fragile e non garantisce il contenimento necessario.

### Composizione equipaggio minimo

- **Autista-soccorritore**: obbligatorio.
- **Secondo soccorritore**: necessario per lettiga; fortemente raccomandato per qualsiasi dimissione data la fragilità tipica del paziente.
- **Infermiere**: richiesto se il paziente viene dimesso con dispositivi attivi (CVC, drenaggi, infusioni in corso).

### Documentazione obbligatoria

- **Lettera di dimissione**: rilasciata dal reparto; in SD viene registrato il numero documento e la struttura mittente. L'autista non la custodisce — rimane al paziente — ma SD traccia che è stata consegnata.
- **Foglio viaggio**: standard.
- **Eventuale prescrizione ossigeno-terapia domiciliare**: se il paziente viene dimesso con O2, l'autista deve sapere che il paziente viaggia con bombola e che a casa è atteso il fornitore.
- **Modulo di presa in carico RSA/struttura riabilitativa** (se non va a casa): in questo caso il servizio diventa un trasferimento e richiede documentazione aggiuntiva.

### Workflow tipo

1. **Richiesta dalla corsia** — Il medico o l'infermiere caposala chiama la cooperativa (o usa il portale SD se la struttura è integrata). Inserisce in SD: reparto, paziente, destinazione, urgenza, note cliniche sintetiche.
2. **Valutazione priorità** — Il responsabile operativo valuta la richiesta in SD e la classifica come urgente/programmata. Una dimissione con letto bloccato è quasi sempre urgente.
3. **Assegnazione mezzo** — SD mostra i mezzi disponibili con distanza dalla struttura. Il responsabile assegna il più vicino e compatibile con il tipo paziente.
4. **Notifica equipaggio** — L'autista riceve in app: ospedale, reparto, nome paziente, destinazione, note cliniche, tipo mezzo richiesto.
5. **Arrivo in ospedale** — L'autista si presenta al reparto, ritira il paziente, verifica che la lettera di dimissione sia stata consegnata al paziente o al familiare.
6. **Trasferimento a destinazione** — Casa, RSA, o struttura riabilitativa.
7. **Chiusura** — Firma a destinazione, km, orari.

### Gestione in SD

- **Creazione servizio**: tipo `DIMI`, flag "urgente" attivato per default. Campo "struttura mittente" (reparto e ospedale), campo "destinazione" (indirizzo casa o nome struttura ricevente).
- **Assegnazione**: SD mostra i mezzi liberi con georeferenziazione. Alert push al responsabile operativo e all'autista del mezzo selezionato.
- **Esecuzione**: l'autista ha in app le note cliniche sintetiche per gestire il trasporto in sicurezza.
- **Chiusura**: form con conferma consegna, firma destinatario (familiare o struttura ricevente), km.
- **Fatturazione**: tariffa urgenza applicata se il servizio viene richiesto con meno di 2 ore di anticipo (configurabile). In convenzione ASL, la dimissione è spesso tariffata come corsa singola con eventuale maggiorazione urgenza.

### Criticità operative frequenti

- **Paziente non pronto al momento dell'arrivo del mezzo** — La corsia dice "è pronto" ma il paziente sta ancora aspettando la terapia dalla farmacia. L'autista aspetta 15-20 minuti poi avvisa la centrale. SD gestisce il ritardo come "attesa struttura".
- **Destinazione cambia all'ultimo momento** — Il paziente doveva andare a casa, ma il familiare chiede di portarlo dalla figlia che abita in altra città. La centrale deve valutare se il contratto copre la nuova destinazione.
- **Paziente non vuole andare via** — Psicologicamente non accetta la dimissione. Non è un TSO ma richiede pazienza e coordinamento con il reparto.
- **Mezzo inadeguato alla complessità clinica** — La corsia sottostima la gravità del paziente. L'autista arriva con ambulanza tipo A e il paziente ha un drenaggio toracico attivo. Deve chiedere l'invio di un mezzo più attrezzato. SD permette l'"upgrade richiesta" con nuovo tipo mezzo.

### Note per il calcolo tariffa

- **Tariffa a corsa singola**: la dimissione è sempre un servizio monodirezione (non ha ritorno).
- **Maggiorazione urgenza**: applicabile se la richiesta arriva con meno di 2 ore di anticipo.
- **Km effettivi vs km autorizzati**: in convenzioni ASL, il percorso autorizzato è quello più breve. SD calcola il percorso ottimale e lo confronta con quello effettivo.
- **Costo attesa in struttura**: se l'attesa supera una soglia (es. 30 minuti), alcune convenzioni prevedono il rimborso del tempo di attesa.

---

## 4. TRASFERIMENTI INTER-OSPEDALIERI

**Codice interno SD**: `TRAS`
**Nome ufficiale**: Trasporto sanitario inter-ospedaliero / Trasferimento secondario
**Frequenza tipica**: Episodica, spesso urgente; volume variabile in base alla tipologia di struttura cliente.

### Descrizione operativa

Il trasferimento inter-ospedaliero è il servizio con il più alto profilo clinico tra i trasporti programmati. Il paziente viene spostato da una struttura ospedaliera ad un'altra — o a una RSA, una struttura riabilitativa, un hospice — con una continuità assistenziale che deve essere garantita durante il trasporto.

Il medico mittente compila la "scheda di trasporto" con la sintesi clinica e le indicazioni per il trasporto. Il medico ricevente deve aver già accettato il paziente. Questo coordinamento avviene prima che la cooperativa intervenga.

La richiesta arriva quasi sempre dalla centrale operativa dell'ospedale o dalla segreteria del reparto. In alcuni casi (pazienti critici) il trasferimento è gestito dal 118 con mezzi ALS — in questo caso la cooperativa non è coinvolta. La cooperativa interviene per i trasferimenti secondari di pazienti stabili o semi-stabili.

### Tipi di mezzo ammesso

- **Ambulanza di Tipo B**: è il mezzo di riferimento per i trasferimenti inter-ospedalieri; garantisce monitoraggio base e attrezzatura di soccorso.
- **Ambulanza di Tipo A**: ammessa per pazienti stabili, allettati, senza dispositivi attivi.
- **MSA (Mezzo di Soccorso Avanzato) / MSI**: richiesto se il paziente ha bisogno di monitoraggio avanzato o infusione attiva durante il trasporto.
- **Auto sanitaria**: non appropriata per trasferimenti inter-ospedalieri.

### Composizione equipaggio minimo

- **Autista-soccorritore**: obbligatorio.
- **Secondo soccorritore**: obbligatorio per tutti i trasferimenti inter-ospedalieri su ambulanza.
- **Infermiere**: obbligatorio se il paziente ha CVC, drenaggi, ossigeno ad alto flusso, infusioni, monitoraggio ECG in corso.
- **Medico**: richiesto (da capitolato o prescrizione) per trasferimenti di pazienti critici sub-ALS.

### Documentazione obbligatoria

- **Scheda di trasporto inter-ospedaliero**: compilata dal medico mittente con diagnosi principale, terapie in atto, dispositivi, note per il trasporto. In SD viene allegata come PDF o inserita nel campo note cliniche strutturate.
- **Cartella clinica di trasferimento** (o lettera di trasferimento): documento clinico-amministrativo. La cooperativa non la compila — la riceve e la consegna alla struttura ricevente.
- **Foglio viaggio**: standard.
- **Modulo di accettazione struttura ricevente**: alcune strutture richiedono che l'autista ottenga una firma di accettazione all'arrivo. SD genera il modulo.
- **Scheda infermieristica di trasporto**: se c'è infermiere a bordo, compila un documento di passaggio delle consegne.

### Workflow tipo

1. **Richiesta struttura mittente** — Reparto ospedaliero o segreteria contatta la cooperativa via portale SD, email, o telefono. Viene inserita la richiesta in SD con: struttura mittente, reparto, paziente, struttura ricevente, reparto ricevente, data/ora richiesta, tipo paziente (stabile/semi-stabile), dispositivi attivi.
2. **Valutazione clinica della richiesta** — Il responsabile operativo valuta se il tipo di mezzo richiesto è adeguato alla complessità clinica descritta. Se c'è discrepanza, contatta il reparto.
3. **Conferma disponibilità** — SD mostra i mezzi disponibili. Assegnazione mezzo e equipaggio.
4. **Briefing equipaggio** — L'autista e il secondo soccorritore (e l'eventuale infermiere) ricevono in app la scheda clinica sintetica, le note per il trasporto, la struttura ricevente con reparto.
5. **Partenza** — L'equipaggio si presenta alla struttura mittente, riceve la cartella clinica, prende in carico il paziente, firma il modulo di presa in carico.
6. **Trasporto** — Il secondo soccorritore/infermiere monitora il paziente durante il trasporto. Eventuali anomalie cliniche → attivazione 118 se necessario.
7. **Consegna** — Arrivo alla struttura ricevente, consegna fisica del paziente al reparto ricevente, firma del personale ricevente sul foglio viaggio.
8. **Chiusura** — Compilazione form fine servizio in SD: km, orari, eventuali eventi durante il trasporto.

### Gestione in SD

- **Creazione servizio**: tipo `TRAS`, con flag "trasferimento inter-ospedaliero". Campi aggiuntivi: struttura mittente (con reparto), struttura ricevente (con reparto), medico responsabile mittente, note cliniche sintetiche, dispositivi attivi (selezione multipla: ossigeno, CVC, SNG, catetere, drenaggio, ecc.).
- **Allegati**: SD permette di caricare PDF della scheda di trasporto direttamente nella scheda servizio.
- **Assegnazione**: filtro per tipo mezzo (solo ambulanze B o superiori), disponibilità in fascia oraria richiesta.
- **Esecuzione**: l'equipaggio vede in app la scheda clinica completa, il nome del medico di riferimento, il numero di reparto della struttura ricevente.
- **Chiusura**: oltre al form standard, il sistema richiede la conferma dell'avvenuta consegna con firma della struttura ricevente.
- **Fatturazione**: tariffa trasferimento (generalmente superiore alla corsa standard), con possibilità di aggiungere il compenso per l'infermiere a bordo se non è dipendente della cooperativa.

### Criticità operative frequenti

- **Il reparto ricevente non è pronto** — Il paziente arriva e il letto non è ancora disponibile. L'equipaggio attende in pronto soccorso o corridoio. SD registra l'attesa struttura. Oltre X minuti (configurabile) scatta un alert alla centrale.
- **Paziente si destabilizza durante il trasporto** — L'infermiere/soccorritore rileva un deterioramento. Procedura: stop mezzo, valutazione, eventuale deviazione al pronto soccorso più vicino, attivazione 118. SD permette di registrare l'"evento clinico durante trasporto" con timestamp e GPS.
- **Struttura ricevente cambia all'ultimo momento** — Il reparto ricevente è pieno, il paziente viene dirottato ad un altro ospedale. La centrale deve aggiornare la destinazione in SD in tempo reale, notificando l'equipaggio via app.
- **Documenti clinici incompleti** — La cartella non è pronta. L'equipaggio attende. Se supera il tempo di tolleranza, la centrale contatta il reparto.

### Note per il calcolo tariffa

- **Tariffa per km con minimo garantito**: i trasferimenti inter-ospedalieri hanno quasi sempre un minimo fatturabile (es. 30 km anche se la struttura dista 5 km).
- **Maggiorazione per equipaggio con infermiere**: aggiunta di voce tariffaria per la presenza dell'infermiere.
- **Tariffa oraria per attesa**: se l'equipaggio attende più di 30 minuti per il ritiro o la consegna.
- **Notturno e festivo**: maggiorazioni standard su tutta la tariffa base.

---

## 5. TRASPORTO DISABILI (L. 104/1992)

**Codice interno SD**: `DIS104`
**Nome ufficiale**: Trasporto di persone con disabilità certificata L. 104/1992
**Frequenza tipica**: Quotidiana o plurisettimanale; altamente ricorrente con calendario fisso.

### Descrizione operativa

Il trasporto disabili è strutturalmente simile alla dialisi per quanto riguarda la ricorrenza: gli utenti hanno un piano di trasporto definito (giorni, orari, destinazione) che si ripete per mesi o anni. La differenza fondamentale è che la destinazione può cambiare più frequentemente (anno scolastico vs vacanze estive, festività, periodi di sospensione del centro diurno) e che spesso su un unico pulmino viaggiano più utenti con destinazioni diverse.

I servizi sono quasi sempre finanziati da Comuni, ULSS, o enti gestori dei servizi sociali, attraverso convenzioni o appalti pubblici. La cooperativa gestisce un "lotto" di utenti su una determinata area geografica.

Il mezzo tipico è il pulmino con pedana idraulica o sollevatore per carrozzina, con ancoraggi per le carrozzine. Alcuni utenti sono in carrozzina, altri deambulano con difficoltà. La lista utenti per ogni mezzo è una vera e propria "rotta" ottimizzata per minimizzare i km e rispettare gli orari di inizio attività.

### Tipi di mezzo ammesso

- **Pulmino attrezzato con pedana/sollevatore**: mezzo principale per questo servizio; deve avere certificazione di idoneità per il trasporto di persone con disabilità.
- **Ambulanza di Tipo A**: usata quando l'utente ha comorbilità sanitarie che richiedono sorveglianza durante il trasporto.
- **Auto sanitaria**: per utenti con disabilità motoria lieve che necessitano solo di assistenza alla salita/discesa.
- **Veicolo privato autorizzato**: in alcune convenzioni comunali, veicoli privati autorizzati con allestimento specifico.

### Composizione equipaggio minimo

- **Autista con patente D o CQC** (per pulmini >8 posti): obbligatorio. Su pulmini ≤8 posti basta patente B se il peso totale è ≤3.500 kg.
- **Accompagnatore/assistente**: obbligatorio quando gli utenti non sono autonomi; su pulmini con più utenti diversamente abili spesso è richiesto un operatore socio-sanitario (OSS) in aggiunta all'autista.
- **OSS o educatore**: richiesto da alcune convenzioni comunali per garantire l'assistenza educativa durante il trasporto (es. utenti con disabilità intellettiva).

### Documentazione obbligatoria

- **Certificazione L. 104/1992** (art. 3, comma 1 o comma 3): il documento che certifica la disabilità dell'utente. In SD allegato al profilo utente con data e livello di gravità.
- **Piano di trasporto individualizzato (PTI)**: documento elaborato dall'ente erogatore (Comune/ULSS) che definisce orari, destinazione, tipologia di assistenza. In SD è il template della ricorrenza.
- **Modulo di servizio giornaliero**: compilato dall'autista con firma dell'ente destinatario (es. direttore del centro diurno). SD lo genera automaticamente.
- **Registro presenza utenti**: alcune convenzioni richiedono un registro mensile con i giorni di trasporto effettivo per ogni utente, per la rendicontazione.

### Workflow tipo

1. **Acquisizione commessa** — La cooperativa vince un appalto o firma una convenzione. L'ente fornisce l'elenco utenti con indirizzi, orari, destinazioni, esigenze specifiche.
2. **Configurazione rotte** — Il responsabile operativo configura in SD le rotte: ordine di raccolta utenti, orari stimati per ogni fermata, destinazione.
3. **Assegnazione pulmino e autista** — Il mezzo e l'autista vengono assegnati alla rotta. La continuità autista-utente è importante per gli utenti con disabilità intellettiva.
4. **Generazione corse ricorrenti** — SD genera automaticamente le corse per tutto il periodo della convenzione, rispettando il calendario scolastico/del centro diurno.
5. **Esecuzione giornaliera** — L'autista riceve la lista utenti con indirizzo e ordine di raccolta. Raccoglie gli utenti, li porta al centro, ottiene firma.
6. **Gestione assenze** — Il familiare o l'ente comunica l'assenza dell'utente (malattia, vacanza). L'operatore in SD marca l'utente come assente per quella giornata. Il mezzo salta la fermata.
7. **Ritorno** — A fine attività (es. 16:00 per i centri diurni), il mezzo raccoglie gli utenti e li riporta a casa nell'ordine inverso o in rotta ottimizzata.
8. **Rendicontazione mensile** — SD genera il registro mensile per ogni utente (giorni effettuati vs assenze) da inviare all'ente committente per la liquidazione.

### Gestione in SD

- **Creazione servizio**: tipo `DIS104`, con gestione rotta multi-utente. SD permette di definire una rotta con N fermate e N utenti, con orari stimati per ogni fermata.
- **Calendario integrato**: SD importa (o permette di configurare manualmente) le chiusure dei centri diurni, il calendario scolastico regionale, le festività. Le corse vengono automaticamente sospese nei giorni di chiusura.
- **Assenze utenti**: flag "assente" per singolo utente su singola data, con motivazione (malattia, vacanza, sospensione servizio). Il sistema ricalcola automaticamente la rotta senza quella fermata.
- **Esecuzione**: l'autista vede in app la lista utenti nell'ordine di raccolta, con note specifiche per ogni utente (carrozzina, ausili, codice portone, note comportamentali rilevanti).
- **Chiusura**: conferma raccolta/consegna per ogni utente. Il centro diurno firma digitalmente la presenza.
- **Fatturazione**: rendicontazione per utente/mese. SD calcola i giorni effettuati moltiplicati per la tariffa giornaliera contrattuale.

### Criticità operative frequenti

- **Utente non pronto all'orario** — Comune con utenti con disabilità intellettiva; l'autista deve aspettare ma non può sforare troppo altrimenti ritarda tutti gli altri. Procedura definita: X minuti di attesa, poi contatto familiare tramite la centrale.
- **Variazioni di calendario non comunicate tempestivamente** — Il centro diurno chiude per assemblea e avvisa solo il giorno prima. L'autista si presenta inutilmente. SD può integrare comunicazioni dal centro diurno via email/API.
- **Utente in crisi durante il trasporto** — Crisi comportamentale, agitazione, crisi epilettica. L'autista deve fermarsi, chiamare la centrale, attendere indicazioni. SD ha il bottone emergenza e la scheda paziente con la procedura specifica per quell'utente (farmaci rescue, contatto di emergenza).
- **Pedana/sollevatore guasto** — Il pulmino non può caricare l'utente in carrozzina. La centrale deve inviare un mezzo sostitutivo o trovare una soluzione alternativa. SD segnala immediatamente il mezzo come indisponibile per quel tipo di utente.
- **Cambio indirizzo temporaneo** — L'utente è temporaneamente a casa di un familiare. La variazione deve essere gestita solo per quella giornata senza impattare la ricorrenza permanente.

### Note per il calcolo tariffa

- **Tariffa giornaliera per utente**: la forma più comune nelle convenzioni comunali. SD calcola automaticamente i giorni effettuati per ogni utente.
- **Tariffa mensile forfettaria per rotta**: in alcune convenzioni si paga la rotta indipendentemente dal numero di utenti effettivamente trasportati quel giorno.
- **Decurtazione per assenze prolungate**: alcune convenzioni prevedono una decurtazione se l'utente è assente per più di X giorni consecutivi.
- **Km aggiuntivi per variazioni di percorso**: se un utente viene spostato temporaneamente ad un indirizzo molto distante dalla rotta standard, i km aggiuntivi sono fatturabili separatamente.

---

## 6. TRASPORTO SANGUE, ORGANI E CAMPIONI BIOLOGICI

**Codice interno SD**: `BIO`
**Nome ufficiale**: Trasporto di materiale biologico / Trasporto emotrasfusionale / Trasporto per trapianto
**Frequenza tipica**: Quotidiana per campioni biologici; episodica/urgente per sangue e organi.

### Descrizione operativa

Questa tipologia si differenzia fondamentalmente da tutte le altre: non c'è un paziente a bordo. Il mezzo trasporta materiale biologico che deve rispettare requisiti di temperatura, integrità e catena di custodia.

**Campioni biologici** (da ambulatori/poliambulatori/MMG a laboratori di analisi): servizio quotidiano, non urgente, con fasce orarie rigide legate agli orari di accettazione dei laboratori. Spesso gestito con auto sanitaria o veicolo autorizzato.

**Sangue e plasma** (da centri trasfusionali a ospedali, o tra ospedali): può essere urgente (necessità trasfusionale in atto) o programmato (scorte di reparto). Richiede contenitore isotermico certificato e catena del freddo documentata.

**Organi per trapianto** (tra ospedali, anche in coordinamento interregionale o internazionale): massima urgenza, spesso con scorta delle forze dell'ordine, con coordinamento NITp (Nord Italia Transplant) o CNT (Centro Nazionale Trapianti). Le cooperative raramente gestiscono direttamente il trasporto organi — più spesso vengono coinvolte per trasporti di équipe chirurgiche o per logistica secondaria.

### Tipi di mezzo ammesso

- **Auto sanitaria o veicolo autorizzato**: per campioni biologici di routine.
- **Ambulanza di qualsiasi tipo**: quando il trasporto biologico è associato a una urgenza clinica.
- **Veicolo veloce dedicato**: per trasporti urgenti di sangue; alcune cooperative hanno veicoli dedicati al trasporto biologico urgente.

### Composizione equipaggio minimo

- **Autista solo**: sufficiente per campioni biologici di routine e per sangue/plasma programmato, se non c'è paziente a bordo.
- **Autista + secondo operatore**: raccomandato per trasporti urgenti di sangue, per gestire la comunicazione con la centrale mentre si guida.
- **Personale infermieristico**: richiesto per organi o per sangue in condizioni particolari.

### Documentazione obbligatoria

- **Bolla di consegna campioni biologici**: documento standard del laboratorio con elenco campioni, tipo di esame, provenienza. In SD registrata come allegato al servizio.
- **Modulo trasfusionale (SIMT)**: per il trasporto emotrasfusionale — documenta il gruppo sanguigno, le unità, la struttura di provenienza e di destinazione, la temperatura di trasporto. Obbligatorio per legge (D.Lgs. 207/2007 e ss.).
- **Registro di temperatura**: per sangue e plasma, il contenitore isotermico deve avere un data-logger. Il log di temperatura è parte integrante della catena di custodia. SD archivia il file del data-logger come allegato.
- **Catena di custodia per organi**: documentazione rigida con timestamp di prelievo organo, partenza, arrivo. Ogni passaggio di mano è firmato.
- **Foglio viaggio**: standard, con nota che non c'è paziente a bordo.

### Workflow tipo

1. **Richiesta servizio** — Laboratorio, centro trasfusionale, o struttura ospedaliera richiede il trasporto. In SD viene creato un servizio di tipo `BIO` con specificazione del sottotipo (campioni/sangue/organo).
2. **Preparazione materiale** — La struttura mittente prepara il materiale con la documentazione. Il corriere/autista si presenta con il contenitore appropriato.
3. **Presa in carico con firma** — L'autista firma il modulo di presa in carico del materiale. Timestamp registrato in SD.
4. **Trasporto** — Il materiale viaggia nelle condizioni prescritte (temperatura, posizione). Per campioni biologici, massima stabilità della posizione.
5. **Consegna con firma** — Il laboratorio/ospedale ricevente firma la ricezione. Timestamp registrato in SD.
6. **Chiusura** — Conferma consegna, km, orari.

### Gestione in SD

- **Creazione servizio**: tipo `BIO` con sottotipo (campioni/sangue/plasma/organo). Campi specifici: tipo materiale biologico, temperatura di trasporto richiesta (refrigerato 2-8°C, temperatura ambiente, congelato), struttura mittente, struttura ricevente.
- **Assegnazione**: per sangue urgente, SD filtra i mezzi disponibili per prossimità e invia alert prioritario.
- **Esecuzione**: l'autista registra in app la firma di presa in carico con timestamp. Campo note per eventuali anomalie (contenitore danneggiato, temperatura fuori range).
- **Chiusura**: firma digitale del ricevente in app. Possibilità di allegare foto del data-logger o del modulo cartaceo.
- **Fatturazione**: tariffa a corsa per campioni; tariffa urgenza per sangue; tariffario specifico per organi (quasi sempre gestito con contratto separato).

### Criticità operative frequenti

- **Campione biologico non trovato all'arrivo** — Il laboratorio non ha il campione pronto. L'autista aspetta X minuti, poi segnala alla centrale. SD registra il ritardo come "attesa struttura mittente".
- **Rottura della catena del freddo** — Il data-logger registra temperature fuori range. Il laboratorio può rifiutare il materiale. SD deve registrare l'evento con tutti i dettagli per la gestione della responsabilità.
- **Urgenza sangue fuori orario** — Le richieste urgenti di sangue arrivano spesso di notte o nei festivi. SD gestisce la reperibilità notturna con alert push ai reperibili di turno.
- **Documentazione incompleta** — Il modulo trasfusionale manca di una firma o ha un errore. Il laboratorio ricevente non può accettare. Procedura: ritorno alla struttura mittente per completare la documentazione.

### Note per il calcolo tariffa

- **Tariffa forfettaria per giro raccolta campioni**: per i giri giornalieri con più prelievi diversi ambulatori, si usa spesso una tariffa forfettaria per giro, non per singolo prelievo.
- **Tariffa urgenza sangue**: maggiorazione significativa, spesso 2-3x la tariffa base, per trasporti emotrasfusionali urgenti notturni o festivi.
- **Contratto dedicato organi**: quasi sempre gestito separatamente con tariffario specifico concordato con il coordinamento trapianti regionale.

---

## 7. ASSISTENZA EVENTI E MANIFESTAZIONI

**Codice interno SD**: `EVENT`
**Nome ufficiale**: Presidio sanitario fisso per eventi / Assistenza sanitaria a manifestazioni
**Frequenza tipica**: Episodica; concentrata nei fine settimana e nei mesi estivi.

### Descrizione operativa

Il presidio eventi è strutturalmente diverso da tutti gli altri servizi: il mezzo e l'equipaggio sono in standby su una postazione fissa per tutta la durata dell'evento, pronti ad intervenire se accade qualcosa. Non c'è un paziente da trasportare a priori — il trasporto avviene solo se qualcuno si fa male o si sente male durante l'evento.

Gli eventi che richiedono presidio sanitario sono regolamentati dalla Circolare Ministeriale n. 24/1999 (e successive integrazioni regionali): eventi sportivi con pubblico superiore a determinate soglie, concerti, sagre e manifestazioni con pubblico superiore a 1.000-5.000 persone (la soglia varia per regione).

L'organizzatore (privato, comune, associazione sportiva) contatta la cooperativa, che fornisce un preventivo basato sul numero di ore, il tipo di equipaggio richiesto (solo autista-soccorritore, o con infermiere, o con medico), e il tipo di mezzo. La fattura va all'organizzatore privato — non alla ASL.

### Tipi di mezzo ammesso

- **Ambulanza di Tipo A o B**: standard per presidi di piccola entità.
- **Ambulanza di Tipo C (MSA/MSI)**: richiesta per eventi di grandi dimensioni o con elevato rischio (concerti, eventi sportivi professionistici, rally, motocross).
- **Postazione medicalizzata**: per grandi eventi, può essere richiesta una postazione con medico + infermiere + ambulanza attrezzata.

### Composizione equipaggio minimo

- **Autista-soccorritore + secondo soccorritore**: minimo per presidi di base.
- **Infermiere**: richiesto per eventi di media entità (>5.000 persone) o per eventi sportivi con rischio traumatologico elevato.
- **Medico**: richiesto per grandi eventi (>10.000 persone) o per eventi sportivi professionistici (partite di serie A/B, gare motoristiche).

### Documentazione obbligatoria

- **Contratto con organizzatore**: documento civilistico che definisce durata, tipo di servizio, equipaggio, corrispettivo. SD genera il contratto da template.
- **Foglio presenze/rapporto evento**: documento firmato dall'organizzatore all'inizio e alla fine dell'evento che attesta l'orario di inizio e di fine presidio. Fondamentale per la fatturazione a ore.
- **Rapporto eventi clinici**: se durante l'evento ci sono stati interventi (un malore, un trauma), vengono documentati nel sistema. Il report evento include tutti gli interventi effettuati.
- **Autorizzazione sanitaria dell'evento** (dove richiesta): in alcune regioni l'organizzatore deve ottenere una autorizzazione sanitaria dall'ASL. La cooperativa può supportare questo processo.

### Workflow tipo

1. **Richiesta preventivo** — L'organizzatore contatta la cooperativa. SD permette di generare un preventivo inserendo: data, tipo evento, numero stimato di partecipanti, durata, luogo.
2. **Accettazione e contratto** — L'organizzatore accetta il preventivo. SD genera il contratto da firmare digitalmente.
3. **Pianificazione** — Il servizio viene inserito nel calendario SD come "presidio evento". Vengono assegnati mezzo e equipaggio.
4. **Briefing pre-evento** — L'equipaggio riceve in app: indirizzo esatto della postazione, nome del referente organizzatore, numero contatto, durata prevista, tipo evento, rischi specifici stimati.
5. **Inizio presidio** — L'equipaggio si posiziona nella postazione stabilita. Registra l'inizio in app con timestamp e GPS.
6. **Durante l'evento** — Standby attivo. Se c'è un intervento, viene registrato come "evento clinico" nel servizio con dettaglio dell'intervento.
7. **Fine presidio** — L'organizzatore firma il foglio presenze. L'equipaggio registra la fine in app.
8. **Chiusura e fatturazione** — SD calcola le ore effettive di presidio, applica la tariffa oraria contrattuale, genera la fattura per l'organizzatore privato.

### Gestione in SD

- **Creazione servizio**: tipo `EVENT`, con sottotipo (evento sportivo/concerto/sagra/altro). Campi specifici: durata stimata in ore, numero stimato partecipanti, tipo evento, nome organizzatore, referente on-site.
- **Assegnazione**: mezzo e equipaggio assegnati per l'intera finestra oraria. Il mezzo è bloccato e non disponibile per altri servizi.
- **Esecuzione**: l'equipaggio registra l'inizio presidio e ogni intervento effettuato. Il contatore ore è visibile in app.
- **Chiusura**: ore effettive di presidio, firma organizzatore, riepilogo interventi effettuati.
- **Fatturazione**: fattura a privato (non a SSN). Tariffa oraria per tipo equipaggio. IVA applicata (servizi a privati non esenti IVA, a differenza dei servizi SSN).

### Criticità operative frequenti

- **Organizzatore non si presenta / evento annullato** — L'equipaggio arriva e l'evento è stato annullato senza preavviso. Contratto deve prevedere penale per disdetta tardiva.
- **Evento si prolunga oltre il previsto** — Il concerto finisce 3 ore dopo il previsto. Il costo aggiuntivo deve essere concordato in tempo reale con l'organizzatore. SD permette di estendere il servizio con aggiornamento automatico del preventivo.
- **Intervento clinico grave durante l'evento** — Un partecipante ha un arresto cardiaco. L'equipaggio interviene e attiva il 118. SD registra l'intervento come evento clinico con timestamp e protocollo attivato.
- **Posizione postazione inadeguata** — L'organizzatore ha posizionato il mezzo in un posto non accessibile al pubblico. L'equipaggio deve negoziare la posizione on-site.

### Note per il calcolo tariffa

- **Tariffa oraria per tipo equipaggio**: la voce principale. L'autista-soccorritore ha una tariffa/ora, l'infermiere un'altra, il medico un'altra ancora. SD calcola la tariffa aggregata.
- **Maggiorazione notturna e festiva**: le ore notturne (generalmente dopo le 22:00) e le ore festive hanno una maggiorazione.
- **Costo mezzo**: separato dalla tariffa equipaggio in molti contratti.
- **Rimborso km** (se il presidio è lontano dalla sede): alcune cooperative aggiungono una voce per il trasferimento mezzo da/a sede.

---

## 8. TRASPORTO NEONATALE — STEN/STAM

**Codice interno SD**: `STEN`
**Nome ufficiale**: Sistema Trasporto Emergenza Neonatale / Sistema Trasporto Attivo Materno
**Frequenza tipica**: Episodica/urgente; gestito prevalentemente da reti ospedaliere pubbliche.

### Descrizione operativa

Lo STEN (Sistema Trasporto Emergenza Neonatale) è il sistema che trasporta i neonati critici — prematuri, neonati con patologie gravi — dalle strutture periferiche alle Unità di Terapia Intensiva Neonatale (UTIN) di II o III livello. Lo STAM (Sistema Trasporto Attivo Materno) trasporta le madri ad alto rischio prima del parto verso strutture di livello adeguato, evitando così la nascita in una struttura non attrezzata.

Entrambi i sistemi richiedono altissima specializzazione: per lo STEN, il neonato viaggia in incubatrice da trasporto con ventilatore neonatale e monitoraggio continuo. Il personale è composto da neonatologo o intensivista neonatale + infermiere UTIN specializzato.

Le cooperative di trasporto sanitario raramente gestiscono direttamente lo STEN come operatori clinici — il personale specializzato è quasi sempre di estrazione ospedaliera pubblica (ARES 118, AREU). Tuttavia SD deve supportare questi trasporti perché:
- Alcune reti regionali integrano le cooperative per la logistica (guida dell'ambulanza attrezzata STEN con personale ospedaliero a bordo).
- SD viene adottato da reti ospedaliere che vogliono tracciare anche questi trasporti.
- La piattaforma deve gestire il tipo servizio per avere un catalogo completo.

### Tipi di mezzo ammesso

- **Ambulanza di Tipo C con allestimento STEN**: mezzo specifico con attacchi per incubatrice da trasporto, ventilatore neonatale, pompe infusionali neonatali, monitor multi-parametrico.
- **Elicottero sanitario**: per trasporti urgenti a lunga distanza. Non gestito direttamente da cooperative.

### Composizione equipaggio minimo

- **Autista-soccorritore**: guida del mezzo, qualifica standard.
- **Neonatologo o medico intensivista neonatale**: obbligatorio per STEN.
- **Infermiere UTIN**: obbligatorio.

### Documentazione obbligatoria

- **Scheda STEN**: documento clinico specifico con parametri vitali del neonato, EG (età gestazionale), peso, patologia, terapie in atto durante il trasporto.
- **Modulo di trasferimento neonatale**: compilato dall'UTIN mittente e ricevente.
- **Foglio viaggio**: standard.

### Gestione in SD

- **Creazione servizio**: tipo `STEN`, con campi specifici: EG del neonato, peso, patologia principale, dotazioni obbligatorie (selezione: incubatrice da trasporto, ventilatore neonatale, pompe infusionali), struttura UTIN di destinazione.
- **Assegnazione**: solo mezzi con allestimento STEN certificato. Filtro automatico per dotazioni.
- **Esecuzione**: checklist dotazioni obbligatorie da verificare prima della partenza. Alert se manca una dotazione critica.
- **Chiusura**: parametri vitali all'arrivo, eventuali eventi durante il trasporto.

### Criticità operative frequenti

- **Incubatrice da trasporto con batteria scarica** — La checklist pre-servizio deve verificare il livello di carica. SD include questa voce nella checklist digitale.
- **Struttura UTIN di destinazione non ha letto disponibile** — Deve essere trovata una UTIN alternativa prima della partenza. Il coordinamento avviene tra i medici, non tramite SD — ma SD deve permettere di aggiornare la destinazione in corsa.

### Note per il calcolo tariffa

- Quasi sempre gestito in regime pubblico SSN, con tariffario specifico STEN concordato a livello regionale.
- Se la cooperativa fornisce solo il mezzo e l'autista (personale clinico da ospedale), la tariffa è per la sola prestazione logistica.

---

## 9. TRASPORTO PSICHIATRICO — TSO/ASO

**Codice interno SD**: `TSO`
**Nome ufficiale**: Trasporto per Trattamento Sanitario Obbligatorio / Accertamento Sanitario Obbligatorio
**Frequenza tipica**: Episodica; urgente o semiurgente.

### Descrizione operativa

Il TSO (Trattamento Sanitario Obbligatorio) è il ricovero coatto di una persona con disturbo mentale che rifiuta le cure, disposto con ordinanza sindacale ai sensi dell'art. 34 della Legge 833/1978. È uno dei servizi più delicati e giuridicamente rilevanti che una cooperativa possa gestire.

Il processo è rigidamente regolamentato: due medici devono firmare la proposta di TSO, il sindaco del comune emette l'ordinanza, il 118 o la cooperativa esegue il trasporto verso il SPDC (Servizio Psichiatrico di Diagnosi e Cura) dell'ospedale. Le forze dell'ordine (Polizia o Carabinieri) sono obbligatoriamente presenti.

L'ASO (Accertamento Sanitario Obbligatorio) è meno invasivo: è una visita psichiatrica obbligatoria senza ricovero. Richiede anch'essa la presenza delle forze dell'ordine ma ha un profilo giuridico diverso.

Il personale che esegue TSO deve avere una formazione specifica in de-escalation e gestione dei pazienti psichiatrici agitati. Non tutti i soccorritori possono o devono essere assegnati a questi servizi.

### Tipi di mezzo ammesso

- **Ambulanza di Tipo A o B**: con abitacolo separato dal vano guida (partizione). La separazione è importante per la gestione del paziente agitato.
- **Ambulanza di Tipo B**: preferita per via delle attrezzature di contenzione e monitoraggio.

### Composizione equipaggio minimo

- **Autista-soccorritore**: con formazione specifica TSO.
- **Secondo soccorritore**: obbligatorio per TSO; fortemente raccomandato per ASO.
- **Infermiere o medico**: richiesto in alcuni protocolli regionali (in Lombardia e Veneto, ad esempio, è spesso richiesta la presenza dell'infermiere).
- **Forze dell'ordine**: obbligatorie per TSO; presenti con mezzo proprio, affiancano l'ambulanza.

### Documentazione obbligatoria

- **Ordinanza sindacale (TSO)**: deve essere presente sull'ambulanza durante il trasporto. Il Comune la trasmette alla cooperativa via fax o email prima della partenza.
- **Proposte TSO dei due medici**: documenti di supporto all'ordinanza.
- **Verbale del Pronto Soccorso** (se il paziente transita da PS prima del SPDC): allegato alla documentazione.
- **Modulo ASL/DSM**: il Dipartimento di Salute Mentale ha spesso un modulo specifico di presa in carico.
- **Foglio viaggio**: con nota specifica "TSO" e riferimento all'ordinanza sindacale.

### Workflow tipo

1. **Attivazione** — Il 118 o il DSM contatta la cooperativa. Viene comunicata l'ordinanza TSO, l'indirizzo, le note sul paziente, il punto di incontro con le forze dell'ordine.
2. **Verifica personale** — Il responsabile operativo verifica che l'equipaggio da inviare abbia la formazione TSO. SD filtra automaticamente gli operatori certificati TSO.
3. **Briefing equipaggio** — L'autista e il secondo soccorritore ricevono in app: indirizzo, note sul paziente, numero ordinanza sindacale, forze dell'ordine di riferimento.
4. **Raggiungimento scena** — L'ambulanza si avvicina coordinandosi con le forze dell'ordine. Non si entra prima che le forze dell'ordine abbiano garantito la sicurezza della scena.
5. **Presa in carico paziente** — Con le forze dell'ordine presenti, il paziente viene accompagnato (o contenuto se necessario) sull'ambulanza. Contenzione fisica solo se necessaria, secondo protocollo.
6. **Trasporto al SPDC** — Il paziente viene trasportato al Servizio Psichiatrico dell'ospedale indicato nell'ordinanza.
7. **Consegna al SPDC** — L'infermiere del SPDC firma la presa in carico. L'ordinanza sindacale viene consegnata al SPDC.
8. **Chiusura** — Km, orari, note su eventuali criticità durante il trasporto. Il sistema registra il numero di ordinanza per la tracciabilità.

### Gestione in SD

- **Creazione servizio**: tipo `TSO` con flag "forze dell'ordine coinvolte". Campo numero ordinanza sindacale, campo Comune emittente, campo SPDC di destinazione.
- **Assegnazione**: SD filtra solo gli operatori con certificazione TSO attiva. Alert se non ci sono operatori certificati disponibili.
- **Esecuzione**: l'autista ha in app le note sul paziente e il numero di contatto delle forze dell'ordine coordinanti.
- **Chiusura**: campo obbligatorio "esito TSO" (paziente ricoverato / paziente non trovato / rifiuto con forze dell'ordine / altro).
- **Fatturazione**: tariffa TSO separata dalla tariffa trasporto ordinario, spesso concordata con ASL/DSM.

### Criticità operative frequenti

- **Paziente non in casa all'arrivo** — Il paziente si è spostato. Le forze dell'ordine gestiscono la situazione. L'ambulanza aspetta nelle vicinanze.
- **Paziente molto agitato con resistenza fisica** — L'equipaggio non deve mai procedere senza le forze dell'ordine. Il rischio fisico per i soccorritori è reale.
- **Ordinanza non arriva prima della partenza** — L'ambulanza non deve partire senza l'ordinanza. SD include un check "ordinanza ricevuta" come condizione per chiudere la fase di preparazione del servizio.
- **SPDC rifiuta il ricovero** — In rari casi il SPDC dice di non avere posti. Il medico del DSM deve essere contattato immediatamente. L'ambulanza non può tornare a casa con il paziente.

### Note per il calcolo tariffa

- **Tariffa TSO specifica**: quasi sempre superiore alla tariffa standard, data la complessità e il rischio.
- **Rimborso ore di attesa** (scene e SPDC): i tempi di attesa alle scene e al SPDC sono spesso lunghi. Il contratto con la ASL deve prevedere il rimborso delle ore di attesa.

---

## 10. TRASPORTO BARIATRICO

**Codice interno SD**: `BARI`
**Nome ufficiale**: Trasporto sanitario per paziente con obesità grave / Trasporto bariatrico
**Frequenza tipica**: Episodica; in aumento per la crescente prevalenza di obesità grave.

### Descrizione operativa

Il trasporto bariatrico riguarda pazienti con peso superiore ai 150-180 kg, che è il limite strutturale degli allestimenti standard delle ambulanze. Una lettiga standard reggeva fino a 160 kg nelle versioni più recenti, ma il limite operativo reale include anche la manovrabilità: un paziente di 200 kg non si gestisce con due soccorritori standard.

L'attrezzatura bariatrica richiede: lettiga rinforzata (portata 350-450 kg), alzapersone o sollevatore idraulico, carrozzina bariatrica, teli di scorrimento, eventuale supporto di personale aggiuntivo (quattro soccorritori invece di due per le manovre di carico/scarico).

I mezzi bariatrici in ogni flotta sono pochi — spesso uno o due per cooperativa di medie dimensioni. Questo crea una criticità di pianificazione: se il mezzo bariatrico è impegnato, non ne esistono altri disponibili.

### Tipi di mezzo ammesso

- **Ambulanza bariatrica (allestimento specifico)**: unico mezzo ammesso per pazienti oltre i 180 kg.
- **Ambulanza di Tipo A o B con attrezzatura bariatrica a bordo**: ammessa se il mezzo è stato omologato con le attrezzature bariatriche specifiche.

### Composizione equipaggio minimo

- **Autista-soccorritore**: obbligatorio.
- **Secondo soccorritore**: obbligatorio.
- **Terzo e quarto soccorritore**: fortemente raccomandato (e spesso necessario in pratica) per le manovre di carico/scarico di pazienti oltre i 200 kg.
- **Infermiere**: se richiesto dalla condizione clinica del paziente.

### Documentazione obbligatoria

- **Stessa documentazione del servizio base** (foglio viaggio, eventuale modulo ASL).
- **Nota peso paziente**: la scheda paziente in SD deve riportare il peso stimato o noto, necessario per la pianificazione del mezzo e dell'equipaggio.

### Workflow tipo

1. **Identificazione paziente bariatrico** — Il profilo paziente in SD ha il flag "bariatrico" attivo con il peso (se noto). Quando viene richiesto un servizio per quel paziente, il sistema avvisa automaticamente che è necessario il mezzo bariatrico.
2. **Verifica disponibilità mezzo bariatrico** — SD filtra i mezzi disponibili mostrando solo quelli con allestimento bariatrico nella finestra oraria richiesta.
3. **Assegnazione equipaggio rinforzato** — Il sistema avvisa che per questo servizio è raccomandato un equipaggio di 3-4 persone.
4. **Esecuzione** — L'equipaggio porta l'attrezzatura specifica (alzapersone se necessario), esegue la movimentazione in sicurezza, carica il paziente.
5. **Chiusura** — Standard.

### Gestione in SD

- **Creazione servizio**: il flag "bariatrico" sul profilo paziente si propaga automaticamente al servizio. Se non c'è un mezzo bariatrico disponibile, SD avvisa immediatamente il responsabile operativo.
- **Assegnazione**: filtro automatico — solo mezzi con flag "attrezzatura bariatrica" possono essere assegnati a servizi bariatrici.
- **Esecuzione**: l'equipaggio vede in app le note specifiche sul paziente (peso, tipo di ausili necessari, note di accesso all'abitazione per valutare spazio di manovra).

### Criticità operative frequenti

- **Mezzo bariatrico già impegnato** — La cooperativa ha un solo mezzo bariatrico e viene richiesto contemporaneamente da due strutture. SD deve gestire la lista d'attesa e avvisare immediatamente la struttura richiedente del ritardo.
- **Accesso all'abitazione incompatibile** — Scale strette, porte troppo piccole, ascensore insufficiente. Il sopralluogo preventivo (anche solo telefonico con il familiare) è essenziale.
- **Paziente bariatrico con urgenza** — La dialisi bariatrica, o la dimissione bariatrica urgente, non può aspettare che il mezzo torni disponibile. Valutare accordi con cooperative vicine per il sub-appalto del servizio.

### Note per il calcolo tariffa

- **Tariffa bariatrica maggiorata**: rispetto alla tariffa standard, il trasporto bariatrico prevede una maggiorazione (tipicamente +30-50%) per il mezzo specializzato e l'equipaggio rinforzato.
- **Costo attrezzatura specifica**: alcune convenzioni prevedono un rimborso separato per l'uso dell'alzapersone o di attrezzature speciali.

---

## 11. GUARDIA MEDICA E VISITE DOMICILIARI

**Codice interno SD**: `GMD`
**Nome ufficiale**: Trasporto medico per continuità assistenziale / Servizio di guardia medica
**Frequenza tipica**: Quotidiana/notturna; tipicamente in servizio di reperibilità.

### Descrizione operativa

Questo servizio è l'inverso di tutti gli altri: non si trasporta il paziente, si trasporta il medico. Il medico di guardia medica (oggi formalmente "Continuità Assistenziale") deve raggiungere il domicilio del paziente che ha richiesto una visita urgente ma non da pronto soccorso.

La cooperativa può gestire il trasporto del medico fornendo un autista con auto sanitaria o veicolo dedicato. In alcune realtà il medico guida autonomamente la sua auto — in altre, per motivi di sicurezza (turni notturni, zone difficili) o per ottimizzare la logistica, è la cooperativa a fornire il trasporto.

La variante "visite domiciliari" riguarda anche medici di medicina generale che fanno giri di visite a domicilio o servizi di ADI (Assistenza Domiciliare Integrata) dove il medico/infermiere deve essere trasportato in sequenza presso più pazienti.

### Tipi di mezzo ammesso

- **Auto sanitaria**: mezzo tipico per questo servizio.
- **Veicolo privato autorizzato**: in alcune convenzioni.

### Composizione equipaggio minimo

- **Autista**: qualifica base, non necessariamente soccorritore.
- **Medico/infermiere**: è il "cliente" del trasporto, non parte dell'equipaggio sanitario.

### Gestione in SD

- **Creazione servizio**: tipo `GMD`. L'utente assegnato al servizio è di tipo "medico/professionista sanitario", non "paziente". La destinazione è l'indirizzo del paziente da visitare.
- **Rotta multi-fermata**: per il giro di visite domiciliari ADI, SD permette di pianificare una rotta con N visite in sequenza, con orari stimati.
- **Fatturazione**: alla ASL o alla struttura che gestisce il servizio di guardia medica, non al paziente.

---

## 12. TRASPORTO ONCOLOGICO

**Codice interno SD**: `ONCO`
**Nome ufficiale**: Trasporto sanitario per pazienti in trattamento oncologico
**Frequenza tipica**: 1-5 volte a settimana per paziente in chemioterapia o radioterapia; altamente ricorrente.

### Descrizione operativa

Il trasporto oncologico è per frequenza il secondo tipo dopo la dialisi nelle cooperative che gestiscono grandi volumi di pazienti cronici. Un paziente in chemioterapia può avere cicli da 1 a 5 giorni consecutivi ogni 2-4 settimane; un paziente in radioterapia può avere sessioni quotidiane per 5-7 settimane consecutive (25-35 sedute totali).

La fragilità oncologica è diversa dalla fragilità del dializzato: nausea post-infusionale, fatigue cronica, immunosoppressione (il paziente è molto sensibile alle infezioni), alopecia (impatto psicologico, il paziente può volersi coprire). Alcuni pazienti sono in terapia palliativa — la delicatezza relazionale dell'autista è fondamentale.

Operativamente la gestione è analoga alla dialisi: pazienti ricorrenti, corse pianificate su base settimanale, andata al centro di oncologia e ritorno a casa. A differenza della dialisi, la durata della seduta è più variabile (la chemio può durare da 2 a 8 ore), il che rende la gestione del ritorno più complessa.

### Tipi di mezzo ammesso

- **Ambulanza di Tipo A**: standard per la maggior parte dei pazienti oncologici.
- **Auto sanitaria**: per pazienti deambulanti in buone condizioni generali.
- **Ambulanza di Tipo B**: per pazienti con catetere venoso centrale (CVC), pompa infusionale portatile attiva, o condizioni cliniche instabili.

### Composizione equipaggio minimo

- **Autista-soccorritore**: obbligatorio.
- **Secondo soccorritore**: necessario se il paziente non è autonomo o è in lettiga.

### Documentazione obbligatoria

- **Foglio viaggio**: standard.
- **Autorizzazione ASL al trasporto**: come per la dialisi, molte ASL richiedono una autorizzazione periodica.
- **Piano di trattamento oncologico** (non portato dall'autista ma registrato in SD): permette di pianificare in anticipo le corse per l'intera durata del ciclo di trattamento.

### Gestione in SD

- **Creazione servizio**: tipo `ONCO`. Il paziente viene configurato come "ricorrente" con il piano di trattamento: numero di sedute, frequenza settimanale, durata stimata della seduta, centro oncologico di riferimento.
- **Generazione automatica corse**: SD genera tutte le corse del ciclo in anticipo, permettendo di pianificare le risorse.
- **Gestione variazioni ciclo**: il piano terapeutico può cambiare — sedute saltate per neutropenia, cambio protocollo. SD permette di modificare il calendario senza impattare le corse già chiuse.
- **Gestione ritorno flessibile**: il centro oncologico avvisa la centrale quando il paziente è pronto per il ritorno. SD permette di gestire l'orario di ritorno come "da confermare" con notifica push all'autista quando scatta la conferma.
- **Storico trattamento**: SD tiene traccia di tutti i trasporti effettuati per quel paziente, utile per la rendicontazione ASL alla fine del ciclo.

### Criticità operative frequenti

- **Paziente con nausea intensa post-chemio** — Non sempre il paziente riesce a stare in ambulanza senza star male. L'autista deve avere sacchetti, teli, e sapere come gestire la situazione.
- **Seduta molto più lunga del previsto** — La chemio viene sospesa e riavviata per reazione avversa. La durata si allunga di ore. Il mezzo non può aspettare tutta la giornata. La centrale deve organizzare un ritorno alternativo.
- **Paziente terminale in condizioni rapidamente peggioranti** — Nel corso dei mesi di trattamento, il paziente può deteriorarsi. Le corse diventano più delicate clinicamente. SD deve permettere di aggiornare il profilo paziente con le nuove esigenze.
- **Cambio centro oncologico** — Il paziente viene preso in carico da un centro diverso (secondo parere, trial clinico). Il profilo in SD deve essere aggiornato con la nuova destinazione.

### Note per il calcolo tariffa

- **Gestione identica alla dialisi** per la rendicontazione: quota mensile per paziente, o tariffa per corsa secondo nomenclatore.
- **Durata seduta variabile**: se il ritorno è "a chiamata", alcune cooperative tariffano anche il servizio di reperibilità del mezzo in attesa.
- **Fine ciclo e rinnovo**: quando termina un ciclo di chemio e ne inizia uno nuovo, la documentazione ASL deve essere rinnovata. SD segnala la scadenza dell'autorizzazione.

---

*Fine catalogo — versione 1.0 — ASCLEPIUS / Soccorso Digitale*
