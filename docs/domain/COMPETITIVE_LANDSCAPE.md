# Competitive Landscape — Mercato Software Gestionale EMS Italia

> Documento strategico interno — Soccorso Digitale
> Classificazione: RISERVATO — Solo uso interno
> Versione: 1.0 — Marzo 2026
> A cura di: Area Strategy & Business Development

---

## 1. PANORAMICA DEL MERCATO

### 1.1 Dimensione e struttura del mercato italiano

Il mercato italiano degli operatori di trasporto sanitario organizzato comprende:

- Circa **900+ organizzazioni ANPAS** (Pubbliche Assistenze), distribuite prevalentemente nel Centro-Nord
- Circa **700+ confraternite delle Misericordie**, prevalentemente Centro-Sud
- Circa **150-200 comitati CRI** con attività significativa nel trasporto sanitario
- **200-400 cooperative sociali di tipo A** che gestiscono trasporto sanitario in modo professionale
- **50-100 operatori privati** (SRL, SpA) prevalentemente in grandi aree metropolitane

Stima totale: **1.800-2.200 organizzazioni** con qualche attività di trasporto sanitario organizzato in Italia.

Di queste, il sottoinsieme realisticamente adressable per un software gestionale dedicato è **700-1.000 organizzazioni**: quelle con un volume di servizi sufficiente a giustificare un costo di software (indicativamente: >500 servizi/anno, >3 mezzi in flotta, >15 operatori attivi).

### 1.2 Penetrazione digitale attuale

La stima più realistica (basata su conversazioni con operatori del settore, dati ANPAS e osservazione diretta) è:

- **<15-20%** delle organizzazioni usa un software gestionale dedicato al trasporto sanitario
- **~55-60%** usa Excel/Google Sheets come strumento principale
- **~20-25%** usa sistemi misti (Excel + fogli carta + WhatsApp per la coordinazione)
- **<5%** ha un sistema sviluppato internamente (in-house o su commissione)

La penetrazione è fortemente correlata alla dimensione organizzativa:
- Organizzazioni >10 mezzi: penetrazione digitale stimata ~35-40%
- Organizzazioni 5-10 mezzi: ~15-20%
- Organizzazioni <5 mezzi: <5%

### 1.3 Driver di adozione

**Fattori che accelerano l'adozione di software gestionale:**

1. **Requisiti di rendicontazione digitale nelle convenzioni ASL** — Crescente numero di ASL/ULSS richiede la trasmissione elettronica dei dati di rendicontazione. Chi non si adegua perde ore/uomo nel preprocessing manuale dei dati.

2. **Gare d'appalto con requisiti di tracciabilità** — Le gare OEPV premiano le organizzazioni che possono dimostrare KPI operativi (puntualità, copertura, qualità). Serve un software per avere questi dati.

3. **Crescita delle organizzazioni** — Le cooperative che crescono oltre i 10 mezzi trovano Excel non più scalabile per la pianificazione.

4. **Normativa GDPR** — Il trattamento dei dati sanitari su fogli Excel condivisi su Drive non è conforme al GDPR (mancano controllo accessi, audit trail, DPA). Il rischio sanzionatorio sta diventando percepito.

5. **Ricambio generazionale nei direttori operativi** — La generazione che ha costruito i sistemi Excel sta cedendo il passo a profili più giovani e digitalmente nativi.

**Fattori che frenano l'adozione:**

1. **Cultura del volontariato** — Resistenza alla "burocratizzazione" del servizio. "Noi salviamo vite, non compiliamo software."
2. **Budget limitati** — Molte ODV hanno margini operativi minimi e faticano a vedere il ROI del software.
3. **Inerzia da Excel** — Chi conosce bene Excel percepisce il cambio come rischio operativo.
4. **Frammentazione decisionale** — Nelle ODV il consiglio direttivo decide, ma il direttore operativo usa lo strumento. Divergenza di priorità.

### 1.4 Segmentazione del mercato

| Segmento | Caratteristiche | Propensione all'acquisto | Ticket medio annuo |
|----------|----------------|--------------------------|-------------------|
| Cooperative sociali (tipo A) | 10-50 mezzi, dipendenti, rendicontazione complessa | Alta | €1.500-4.000 |
| Pubbliche Assistenze ANPAS medie | 5-20 mezzi, volontari+dipendenti | Media | €800-2.000 |
| Grandi ODV strutturate | >20 mezzi, staff professionale | Alta | €3.000-8.000 |
| Piccole ODV (<5 mezzi) | Volontari, budget zero | Bassa | Non adressable |
| CRI comitati locali | Struttura pubblica, procurement lento | Bassa-Media | €1.500-3.000 |
| Operatori privati profit | 3-30 mezzi, esigenze gestionali simili a coop | Alta | €1.500-5.000 |

---

## 2. COMPETITOR DIRETTI — SOFTWARE GESTIONALI EMS ITALIANI

### 2.1 Gpi S.p.A. — SGES (Sistema Gestione Emergenze Sanitarie)

**Chi sono:** Gpi è una software house trentina (quotata all'AIM nel 2017, poi Euronext Growth Milan) con focus sulla sanità pubblica. Fatturato ~€150M (2024). SGES è il loro modulo per la gestione dell'emergenza sanitaria, pensato per Centrali Operative 118 e aziende sanitarie. Non è un prodotto pensato per le organizzazioni di trasporto.

**Punti di forza:**
- Relazioni consolidate con enti pubblici (ASL, 118) — vendita enterprise con cicli lunghi
- Integrazione con i loro sistemi HIS e LIS già presenti in molti ospedali
- Reputazione di solidità e continuità nel mercato sanitario pubblico
- Team commerciale strutturato con agenti territoriali
- Finanziamenti su bandi PNRR e regionale

**Punti di debolezza:**
- Non è pensato per le cooperative: manca il modulo dialisi CUT, la gestione UTIF, la rendicontazione per paziente verso l'ASL
- Prezzo enterprise incompatibile con i budget delle organizzazioni di volontariato
- Nessun onboarding self-service: implementazione richiede mesi e consulenti on-site
- App mobile assente o rudimentale (pensata per postazioni fisse in centrale)
- Aggiornamenti normativi regionali lenti (cicli di rilascio tipicamente semestrali)
- Non multi-tenant: ogni cliente è un'istanza separata con costi di manutenzione alti

**Prezzo indicativo:** €10.000-50.000/anno per licenza. Implementazione aggiuntiva €5.000-20.000. Manutenzione annua 15-20% del valore licenza.

**Quota di mercato stimata:** Forte nel pubblico (alcune CO 118, grandi ospedali). Quasi assente nelle cooperative e nelle organizzazioni di volontariato.

**Come SD vince contro Gpi SGES:**
- Prezzo 10-50x inferiore
- Cloud SaaS vs installazione on-premise
- Onboarding in 2-3 giorni vs mesi
- App mobile nativa per gli equipaggi
- Funzionalità specifiche TSP (dialisi, UTIF, rendicontazione per paziente)
- Aggiornamenti automatici inclusi

**Quando Gpi vince:**
- Gara pubblica per la Centrale Operativa 118 di una Regione (fuori perimetro SD)
- Cliente ASL che vuole un unico fornitore per HIS + emergenza

---

### 2.2 Zucchetti S.p.A. — Modulo Gestione Flotte Sanitarie

**Chi sono:** Zucchetti è il principale gruppo italiano di software per le imprese (HR, payroll, contabilità, ERP). Sede: Lodi. Fatturato >€1 miliardo (2024). Hanno un modulo "gestione flotte" generico che alcune organizzazioni sanitarie usano.

**Punti di forza:**
- Marca estremamente riconosciuta in Italia — "Zucchetti" è sinonimo di software gestionale per molte PMI
- Integrazione con il gestionale HR/payroll: utile per le cooperative con dipendenti che gestiscono paghe su Zucchetti
- Rete di distributori e rivenditori capillare su tutto il territorio italiano
- Stabilità finanziaria e longevità del prodotto

**Punti di debolezza:**
- Il modulo flotte è generico (autotrasporto, flotte aziendali) — non conosce ambulanze, dialisi, UTIF, codici triage
- Nessuna funzionalità di rendicontazione verso ASL/ULSS nel formato richiesto dalle Regioni
- Nessun modulo per la gestione degli equipaggi e delle certificazioni (BLS-D, TSSA)
- Prezzo orientato al mercato mid-enterprise, sproporzionato per cooperative medie
- Progettazione non mobile-first
- Il venditore Zucchetti locale non conosce il dominio EMS e non riesce a proporre il prodotto efficacemente nel settore

**Prezzo indicativo:** Licenza annuale €3.000-15.000 + implementazione €2.000-8.000. La componente payroll/HR (se adottata) può portare il totale a €5.000-25.000/anno.

**Quota di mercato EMS:** Marginale. Poche grandi cooperative che usano già Zucchetti per le paghe e hanno "aggiunto" il modulo flotte per comodità.

**Come SD vince contro Zucchetti:**
- Specializzazione verticale EMS: SD conosce il dominio, Zucchetti no
- L'interlocutore SD parla di dialisi, UTIF, convenzioni ASL — il venditore Zucchetti parla di "flotte"
- Prezzo competitivo per le funzionalità EMS effettive
- App mobile per equipaggi
- Demo che mostra la rendicontazione ASL funzionante

**Quando Zucchetti vince:**
- Cliente già profondamente integrato su Zucchetti (paghe, contabilità, CRM) che vuole minimizzare i fornitori
- Cooperative di grandi dimensioni con IT department che gestisce già l'ecosistema Zucchetti

---

### 2.3 Alea Solutions — Ambulance Manager

**Chi sono:** Software house italiana specializzata nel settore EMS. Presente nel mercato da oltre 15 anni. Dimensioni piccole (stimato <20 dipendenti). Cliente base: alcune grandi cooperative del Nord-Est e Lombardia.

**Punti di forza:**
- Conoscenza del dominio EMS genuina: il prodotto è stato costruito sul campo con le organizzazioni
- Presente nel settore da lungo tempo — referenze verificabili
- Prezzo più accessibile dei competitor enterprise
- Supporto in italiano da team che conosce il settore

**Punti di debolezza:**
- Architettura client-server desktop (installazione locale): nessun accesso da remoto senza VPN, backup manuale, aggiornamenti manuali
- Interfaccia utente datata (stile anni 2010): esperienza utente che scoraggia l'adozione da parte di personale giovane
- Nessuna app mobile nativa per gli equipaggi: al massimo un'interfaccia web responsive non ottimizzata
- Aggiornamenti lenti: il prodotto segue i ritmi di una software house piccola con risorse limitate
- Integrazione API assente o molto limitata: difficoltà a connettere con sistemi esterni (fatturazione, GPS, ecc.)
- Difficoltà di scalabilità per organizzazioni multi-sede
- Vulnerabilità competitiva: una software house piccola con un prodotto desktop è a rischio di obsolescenza accelerata

**Prezzo indicativo:** Licenza desktop per installazione singola €1.500-3.500 + manutenzione annua €400-800. Aggiornamenti versione major a pagamento.

**Quota di mercato stimata:** Qualche decina di clienti attivi, prevalentemente nel Nord. Penetrazione stimata 2-4% del mercato adressable.

**Come SD vince contro Alea:**
- Cloud-native: accesso da ovunque, nessun server locale, backup automatico
- App mobile nativa per equipaggi: il vantaggio operativo più visibile in demo
- Architettura moderna: API REST, integrazioni GPS, webhook per sistemi esterni
- Aggiornamenti automatici inclusi nel canone mensile
- UX moderna: onboarding rapido per nuovi operatori

**Quando Alea vince:**
- Cliente con IT department che preferisce il controllo on-premise ("i dati devono stare da noi")
- Cliente già esistente con personalizzazioni sviluppate negli anni che ha costo di switching alto
- Area geografica dove Alea ha referenze consolidate e il passaparola è forte

---

### 2.4 Software In-House e Soluzioni Custom

**Chi sono:** Molte cooperative e organizzazioni di media-grande dimensione hanno sviluppato negli anni soluzioni personalizzate: macro Excel complesse, database Access, applicativi web commissionati a freelance, sistemi sviluppati da qualche volontario informatico.

**Punti di forza percepiti dal cliente:**
- "È fatto su misura per noi"
- Nessun costo di licenza ricorrente (costo percepito: zero o una tantum)
- Familiarità con lo strumento (anni di utilizzo)
- Dipendenza da nessun fornitore esterno (percepita)

**Punti di debolezza reali:**
- **Dipendenza da una singola persona**: il "volontario informatico" o il freelance che l'ha creato. Se se ne va, il sistema diventa opaco e non manutenibile.
- **Nessun aggiornamento normativo**: quando cambiano le tariffe regionali, il formato di rendicontazione ULSS, o entra in vigore una nuova normativa, il sistema non si aggiorna automaticamente. Qualcuno deve farlo manualmente — se ci riesce.
- **Zero mobile**: le soluzioni custom rara­mente hanno un'app per gli equipaggi.
- **Nessuna scalabilità**: un database Access che funziona per 5 mezzi crasha con 20.
- **GDPR non conforme**: dati sanitari su Excel condiviso via email o Drive senza audit trail, senza cifratura a riposo, senza log degli accessi. È una non-conformità evidente.
- **Costo nascosto**: il "costo zero" esclude le ore di lavoro del direttore operativo che compila, corregge, rendiconta manualmente. Tipicamente 40-80 ore/mese per organizzazioni medie.

**Come SD vince contro in-house:**
- Il ROI è calcolabile e presentabile: se SD risparmia 50 ore/mese al direttore operativo e un'ora di lavoro vale €25, il risparmio è €1.250/mese vs €100/mese di canone SD.
- La compliance GDPR è un argomento di rischio reale (sanzioni fino a €20M o 4% fatturato globale)
- La migrazione assistita riduce il rischio percepito del passaggio
- La continuità del servizio non dipende da una singola persona

---

### 2.5 Competitor Internazionali — Traumasoft, ESO, ImageTrend

**Chi sono:** I leader mondiali del software EMS, tutti nord-americani.

- **Traumasoft** (Michigan, USA): suite completa per EMS agencies con dispatch, billing, HR, fleet. Leader nel mercato USA con centinaia di clienti.
- **ESO** (Austin, Texas): focus su dati clinici EMS, ePCR (electronic Patient Care Report), analytics. Forte integrazione con ospedali USA.
- **ImageTrend** (Minnesota): suite EMS con forte componente ePCR e Fire department management. Usato da centinaia di dipartimenti USA.

**Punti di forza:**
- Funzionalità avanzatissime costruite su decenni di sviluppo e centinaia di clienti
- App mobili mature e ben progettate
- Analytics e reportistica sofisticate
- Stabilità finanziaria (ESO: >200M$ round, ImageTrend: acquisita da KKR nel 2021)

**Punti di debolezza:**
- **Non localizzati per l'Italia**: la normativa regionale italiana (UTIF, CUT, tariffe ULSS, rendicontazione ASL) non è supportata. I flussi di lavoro sono pensati per il sistema USA (assicurazioni private, Medicare/Medicaid, codici ICD-10 americani).
- **Lingua**: interfaccia solo in inglese. Il personale di base nelle cooperative italiane non legge l'inglese.
- **Prezzo**: $20.000-100.000+/anno, fuori portata per la quasi totalità del mercato italiano.
- **Supporto**: nessun supporto in italiano, fuso orario incompatibile.
- **Compliance**: GDPR europeo non pienamente integrato nella loro architettura USA-centrica.

**Come SD vince:**
- Localizzazione italiana completa (terminologia, normativa, tariffe regionali, formati di rendicontazione)
- Prezzo 20-100x inferiore
- Supporto in italiano con comprensione del contesto operativo
- Conformità GDPR nativa

**Rischio futuro:** Se un operatore internazionale decidesse di acquisire Alea Solutions o un competitor italiano per entrare nel mercato europeo, potrebbe rappresentare una minaccia significativa a medio termine (3-5 anni).

---

## 3. COMPETITOR INDIRETTI

### 3.1 Excel / Google Sheets — Il Vero Competitor Principale

Excel non è un software gestionale EMS. Ma è il competitor con il quale SD compete nell'80% delle trattative di vendita.

**Perché il cliente usa Excel:**
- Costo percepito: zero (è incluso in Microsoft 365 che già pagano)
- Familiarità: tutti sanno usarlo
- Flessibilità: si adatta a qualsiasi esigenza con sufficiente sforzo

**I problemi reali di Excel per il TSP:**

| Problema | Impatto operativo |
|----------|------------------|
| Nessuna app mobile | L'equipaggio aggiorna il servizio solo tornando in sede. Dati sempre in ritardo. |
| Nessun GPS integrato | Nessuna tracciabilità del mezzo in tempo reale. |
| Errori di formula / copia-incolla | Rendicontazioni errate, contestazioni ASL, crediti non pagati. |
| Nessun audit trail | Impossibile ricostruire chi ha modificato cosa e quando. GDPR non conforme. |
| Nessuna scalabilità | Con 20+ mezzi e 50+ operatori, i file Excel diventano ingestibili. |
| Nessun alert / notifica | Le scadenze (collaudo, BLS-D, TSSA) non vengono monitorate automaticamente. |
| Nessuna analytics | Non si può sapere facilmente quali servizi sono redditizi, quali operatori hanno più assenze. |
| Sharing non controllato | I dati sanitari circolano via email tra persone non autorizzate. |

**Strategia di posizionamento contro Excel:**
Non attaccare Excel direttamente (il cliente si sente criticato). Mostrare cosa diventa possibile con SD che non è possibile con Excel: la rendicontazione generata in 10 minuti, l'app dell'equipaggio, il cruscotto budget. Lasciare che la demo venda.

---

### 3.2 WhatsApp Business + Carta

La modalità di coordinamento adottata da organizzazioni molto piccole o con culture molto tradizionali. Il responsabile operativo manda i turni via WhatsApp, gli equipaggi confermano con un pollice su. I fogli di viaggio sono cartacei.

**Dove va bene (onestamente):** Organizzazioni con 1-3 mezzi e 10-20 operatori, dove la comunicazione informale funziona perché tutti si conoscono.

**Dove non va più bene:** Appena l'organizzazione cresce, la rendicontazione diventa un incubo. Le convenzioni ASL richiedono dati strutturati. La GDPR vieta la comunicazione di dati sanitari su app consumer.

**Come SD vince:** SD non compete con WhatsApp per le chiacchiere. SD risolve la rendicontazione, il dispatch strutturato, la tracciabilità. WhatsApp rimane (e va bene così) per le comunicazioni informali.

---

### 3.3 TMS Generici — Software per Trasporti Non Sanitari

Esistono sul mercato italiano numerosi software di Transport Management System (TMS) pensati per corrieri, trasporti merci, noleggio con conducente. Alcune organizzazioni di trasporto sanitario li adottano per mancanza di alternative conosciute.

**Esempio di prodotti in questa categoria:** TeamSystem Transport, B2T Trasporti, Verizon Connect (fleet management), Samsara.

**Il problema:** Non conoscono nulla del dominio sanitario. Mancano: schede paziente, codici nosologici, rendicontazione UTIF/CUT, gestione dialisi ricorrente, tipi di veicolo ambulanza, certificazioni BLS-D degli operatori. Il cliente finisce per usare il TMS solo per il GPS e continua a gestire tutto il resto su Excel.

**Come SD vince:** Verticale end-to-end. Un unico sistema che copre dall'assegnazione del servizio alla rendicontazione all'ASL.

---

### 3.4 Google Calendar / Strumenti di Pianificazione Generici

Per la gestione dei turni: Google Calendar, Microsoft Teams calendario, Trello, Monday.com, Notion. Usati in modo creativo da alcuni direttori operativi.

**Il limite strutturale:** Questi strumenti non sanno cosa è un "servizio di trasporto sanitario". Non collegano il turno dell'operatore con il servizio assegnato, con il mezzo disponibile, con le certificazioni richieste. Sono strumenti di pianificazione generica usati fuori contesto.

**Come SD vince:** Il modulo turni di SD è integrato con il dispatch, la flotta e i profili operatori. L'assegnazione del servizio verifica automaticamente se l'operatore ha il BLS-D valido e se il mezzo ha il collaudo ASL aggiornato.

---

## 4. MATRICE COMPARATIVA

| Funzionalità | SD | Gpi SGES | Zucchetti Flotte | Alea | TI Generici | Excel |
|-------------|----|----|------|------|-------------|-------|
| **Cloud SaaS, nessun server** | SI | NO | Parziale | NO | Parziale | NO |
| **App mobile equipaggi** | SI | NO | NO | NO | NO | NO |
| **GPS real-time integrato** | SI | Parziale | SI | NO | SI | NO |
| **Dispatch automatizzato** | SI | SI (per CO 118) | NO | Parziale | Parziale | NO |
| **Gestione dialisi / CUT** | SI | Parziale | NO | Parziale | NO | Manuale |
| **Rendicontazione UTIF** | SI | SI | NO | NO | NO | Manuale |
| **Gestione ricorrenze (dialisi)** | SI | NO | NO | Parziale | NO | Manuale |
| **Multi-tenant SaaS** | SI | NO | NO | NO | Parziale | N/A |
| **Onboarding self-service** | SI | NO | NO | NO | Parziale | N/A |
| **Trial gratuito** | SI | NO | NO | NO | Parziale | SI (è gratis) |
| **Certificazioni operatori** | SI | NO | Parziale | Parziale | NO | Manuale |
| **Scadenze flotta / collaudo** | SI | NO | SI | Parziale | SI | Manuale |
| **Rendicontazione ASL auto** | SI | Parziale | NO | Parziale | NO | Manuale |
| **Analytics e forecasting** | SI | Parziale | NO | NO | Parziale | NO |
| **API / integrazioni** | SI | Parziale | Parziale | NO | SI | NO |
| **GDPR / DPA ex art. 28** | SI | Parziale | Parziale | NO | Parziale | NO |
| **Modulo gare d'appalto** | SI | NO | NO | NO | NO | NO |
| **Localizzazione italiana** | SI | SI | SI | SI | Parziale | SI |
| **Supporto in italiano** | SI | SI | SI | SI | Parziale | N/A |
| **Aggiornamenti automatici** | SI | A pagamento | A pagamento | A pagamento | A pagamento | NO |
| **Prezzo base indicativo/anno** | €790 | €10.000+ | €3.000+ | €1.500+ | €2.000+ | €0 |

**Note sulla metodologia:** La matrice è basata su analisi delle funzionalità pubblicamente documentate, conversazioni con clienti che hanno valutato più prodotti, e demo dirette dove disponibili. Il dato Alea è stimato da clienti che hanno migrato da Alea a SD. Il dato Gpi è basato su documentazione pubblica e presentazioni a conferenze sanitarie.

---

## 5. POSITIONING MAP — DESCRIZIONE

Il posizionamento dei competitor su due assi chiave:

**Asse X (orizzontale):** Prezzo annuale (basso sinistra → alto destra)
**Asse Y (verticale):** Specializzazione verticale EMS italiana (bassa → alta)

**Quadrante ideale (basso costo + alta specializzazione): SD**
SD occupa il quadrante sud-est: il prodotto più specializzato sul mercato italiano a il prezzo più basso tra i competitor specializzati. È il "value leader" del settore.

**Quadrante enterprise (alto costo + alta specializzazione): Gpi SGES**
Prodotto specializzato (ma per il pubblico, non per le cooperative) a prezzo enterprise. Serve un mercato diverso (CO 118, ASL) che non è il target primario di SD. Non c'è competizione diretta frequente.

**Quadrante generico costoso (alto costo + bassa specializzazione): Zucchetti**
L'area peggiore del posizionamento: si paga tanto per un prodotto che non conosce il dominio EMS. Il cliente Zucchetti che ha anche bisogno di gestionale EMS è un cliente insoddisfatto — e quindi un prospect per SD.

**Quadrante legacy (medio costo + media specializzazione): Alea**
Alea è l'unico competitor diretto con specializzazione EMS vera, ma a prezzo medio e con architettura legacy. È il competitor più frequente nelle trattative SD, soprattutto nel Nord-Est.

**Punto di partenza (zero costo + zero specializzazione): Excel**
Non è un competitor di prodotto ma è il punto di partenza di quasi tutti i prospect. La trattativa SD non è "SD vs Excel" ma "motivi per cui il cliente dovrebbe smettere di usare Excel" — che poi risolve SD.

---

## 6. WIN/LOSS ANALYSIS

### 6.1 Pattern di Vittoria (WINS)

**Scenario #1 — La demo converte:**
Il prospect che arriva alla demo di SD con un problema chiaro (rendicontazione che richiede 3 giorni al mese, impossibilità di sapere dove sono i mezzi, BLS-D scaduti non monitorati) converte ad alto tasso. La demo è il momento della verità. Tasso di conversione post-demo stimato: 55-65%.

**Scenario #2 — Il direttore operativo "stanco":**
Il responsabile operativo che gestisce 15 ambulanze con Excel alle 23:00 è il champion interno più potente. Quando trova SD, capisce immediatamente il valore. Il problema è arrivare a lui prima che si abitui al dolore.

**Scenario #3 — Gara d'appalto imminente:**
L'organizzazione ha una gara in scadenza che richiede di dimostrare sistemi di tracciabilità e rendicontazione digitale. SD diventa lo strumento per qualificarsi. Alta urgenza = ciclo di vendita breve.

**Scenario #4 — Migrazione da Alea:**
Clienti Alea frustrati dall'assenza di app mobile e dagli aggiornamenti lenti. Il confronto diretto (stessa specializzazione EMS, architettura moderna, prezzo simile o inferiore) favorisce SD. Richiede migrazione dati assistita.

**Scenario #5 — Cluster geografico (Veneto, Emilia-Romagna, Toscana):**
Le Regioni con ULSS/AUSL che richiedono rendicontazione digitale strutturata sono terreno fertile. Le organizzazioni in queste Regioni sentono la pressione normativa e cercano soluzioni.

### 6.2 Pattern di Sconfitta (LOSSES)

**Scenario #1 — "Non ho il problema":**
Il prospect che usa Excel e non ha ancora sofferto la complessità non percepisce il dolore. Non compra. Serve un evento scatenante (audit, gara, errore di rendicontazione significativo, cambio di direttore) che lo spinga a cercare una soluzione.

**Scenario #2 — Grande ente pubblico / gara formale:**
Le ASL, le ATS lombarde, le centrali 118 che cercano software lo fanno tramite gara pubblica. SD non è ancora qualificato nei principali accordi quadro regionali. Questo mercato richiede un investimento commerciale e di compliance che va pianificato separatamente.

**Scenario #3 — Budget "zero":**
Piccole ODV con <3 mezzi e budget gestionale nullo. Non è il target. Il tentativo di vendergli SD a €790/anno non porta a nulla e consuma risorse commerciali.

**Scenario #4 — "Il nostro volontario informatico lo fa gratis":**
Resistenza al cambio quando esiste già una soluzione interna, anche se inadeguata. Il champion interno (il volontario informatico) ha interesse a mantenere la propria posizione e ostacola l'acquisto. Serve un champion alternativo (direttore operativo, presidente) che percepisca i rischi della dipendenza da una singola persona.

**Scenario #5 — Zucchetti deeply embedded:**
Cliente dove Zucchetti gestisce paghe, contabilità e HR. Il responsabile IT vuole consolidare su Zucchetti. Difficile vincere senza il champion del direttore operativo che forza la specializzazione.

### 6.3 Indicatori Predittivi del Win

Prospect con maggiore probabilità di conversione:
- Dimensione: 5-50 mezzi
- Regione: Veneto, Emilia-Romagna, Toscana, Lombardia
- Interlocutore: direttore operativo o responsabile IT (non il presidente onorario)
- Trigger: gara in scadenza, nuovo responsabile operativo, errore di rendicontazione
- Contatto: referral da cliente esistente > inbound da contenuto > outbound

---

## 7. UNIQUE SELLING PROPOSITION DI SOCCORSO DIGITALE

Le cinque ragioni strutturali per cui SD vince:

### 7.1 Multi-Tenant Cloud — Nessun Server da Gestire

Ogni cliente ha il proprio spazio isolato in cloud (multi-tenant architecture). I dati sono separati, la sicurezza è garantita, ma l'infrastruttura è condivisa e il costo è distribuito. Il cliente accede da qualsiasi dispositivo con un browser o l'app. Nessuna installazione, nessun backup manuale, nessun aggiornamento da pianificare. Questo è il prerequisito tecnologico che i competitor desktop (Alea) e on-premise (Gpi) non possono replicare senza riscrivere il prodotto da zero.

### 7.2 App Mobile Nativa per gli Equipaggi

L'equipaggio aggiorna il servizio dal proprio smartphone in tempo reale: accetta la missione, firma l'inizio, registra l'arrivo al paziente, completa il foglio di viaggio, raccoglie la firma digitale del paziente. Il dato è disponibile immediatamente in piattaforma. Nessun competitor nella fascia di prezzo SD ha questa funzionalità a questo livello di maturità. La demo dell'app mobile è il momento "wow" più frequente con i prospect.

### 7.3 Verticalizzazione EMS Italiana Completa

SD conosce il dominio. Non è un software di gestione flotte adattato, non è un TMS generico con qualche campo "sanitario" aggiunto. SD è stato costruito conoscendo: i turni di dialisi lunedì-mercoledì-venerdì, la rendicontazione UTIF per la ULSS 9 Scaligera, le tariffe del nomenclatore toscano, le specifiche del collaudo ASL. Nessun competitor internazionale può competere su questo. Nessun competitor generico vuole investire per arrivarci.

### 7.4 Analytics e Intelligenza Operativa

SD fornisce cruscotti che i competitor non hanno: forecasting dei ricavi basato sulle convenzioni attive, analisi della redditività per tipologia di servizio, ottimizzazione dei giri dialisi per ridurre i km, alert preventivi su scadenze di certificazioni e flotta. Per la prima volta, il direttore operativo di una cooperativa ha gli strumenti analitici che prima erano riservati alle grandi aziende con Business Intelligence dedicata.

### 7.5 Compliance Inclusa — Riduzione del Rischio Legale

SD include contratto DPA ex art. 28 GDPR, DPIA pubblicata, cifratura dei dati sanitari a riposo e in transito, log degli accessi, gestione dei consensi. Per una cooperativa che tratta dati sanitari di centinaia di pazienti, la compliance GDPR non è un optional: è un obbligo legale con sanzioni fino a €20M. SD riduce questo rischio senza richiedere al cliente di investire in consulenza legale separata. È un argomento di vendita meno sexy della demo mobile, ma sempre più rilevante man mano che le sanzioni GDPR aumentano.

---

## 8. PRIORITA' DI MERCATO E PROSSIMI PASSI

### 8.1 Segmenti prioritari per la crescita 2026

**Tier 1 — Focus immediato:**
- Cooperative sociali di tipo A, 10-50 mezzi, Veneto e Emilia-Romagna
- Grandi Pubbliche Assistenze ANPAS con rendicontazione dialisi complessa

**Tier 2 — Sviluppo 2026-2027:**
- Operatori privati profit nelle aree metropolitane (Milano, Roma, Torino)
- Misericordie di media dimensione in Toscana e Lazio

**Tier 3 — Non prioritario ora:**
- Piccole ODV <5 mezzi (costo di acquisizione non sostenibile)
- Enti pubblici ASL/ATS (ciclo di vendita troppo lungo, procurement formale)
- Competitor internazionali (mercato US/UK — fuori perimetro attuale)

### 8.2 Mosse competitive da monitorare

- **Gpi:** Possibile sviluppo di un prodotto "lite" per il mercato cooperative. Rischio medio-basso nel breve termine.
- **Acquisizione di Alea:** Se un investor o competitor acquisisce Alea e la porta in cloud, il competitive landscape cambia. Rischio da monitorare.
- **Startup verticali:** Possibile comparsa di nuovi entranti verticali EMS, specialmente post-PNRR con fondi per la digitalizzazione della sanità. Da monitorare.

---

*Fine documento — Competitive Landscape v1.0*

*Aggiornamento previsto: settembre 2026 (post-estate, allineato con ciclo budget clienti)*

*Contatto: strategy@soccorsodigitale.it*
