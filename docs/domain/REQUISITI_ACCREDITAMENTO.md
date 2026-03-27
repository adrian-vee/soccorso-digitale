# REQUISITI DI ACCREDITAMENTO — Trasporto Sanitario in Italia
**Versione**: 1.0
**Autore**: ASCLEPIUS — Domain Expert EMS
**Data**: 2026-03-27
**Destinatari**: Dev Team (compliance features), Sales Team (onboarding clienti), Operatori (validazione)

---

## INDICE

1. [Requisiti Nazionali Trasversali](#1-requisiti-nazionali-trasversali)
2. [Requisiti Veicoli](#2-requisiti-veicoli)
3. [Requisiti Personale](#3-requisiti-personale)
4. [Requisiti Regionali Specifici](#4-requisiti-regionali-specifici)
5. [Come SD Supporta la Compliance](#5-come-sd-supporta-la-compliance)

---

## 1. REQUISITI NAZIONALI TRASVERSALI

### 1.1 Autorizzazione Sanitaria all'Esercizio

**Base normativa principale**:
- D.Lgs. 30 dicembre 1992 n. 502 "Riordino della disciplina in materia sanitaria" e s.m.i.
- D.Lgs. 19 giugno 1999 n. 229 (integrazione al 502)
- Normative regionali di recepimento (ogni regione ha il proprio atto di recepimento)

**Chi rilascia**: La ASL (o ULSS in Veneto, ASP in Sicilia e Calabria, ATS in Lombardia, AUSL in Emilia-Romagna) territorialmente competente rispetto alla sede operativa principale dell'organizzazione. Se la cooperativa ha sedi operative in più province, può essere necessaria l'autorizzazione di ogni singola ASL.

**Cosa richiede la ASL per il rilascio dell'autorizzazione**:

1. **Iscrizione alla Camera di Commercio (CCIAA)** con oggetto sociale che includa esplicitamente il trasporto sanitario. La dicitura generica "servizi" non è sufficiente in molte regioni — è necessario "trasporto di persone inferme e inabili" o formulazioni equivalenti. Per le associazioni di volontariato, l'iscrizione RUNTS sostituisce o integra il requisito CCIAA.

2. **Sede operativa** adeguata: deve avere spazi per il rimessaggio dei mezzi (o accordo con rimessaggio esterno documentato), spazi per la sanificazione dei mezzi, spazio per gli operatori (spogliatoi, area pausa). Alcune ASL effettuano un sopralluogo prima del rilascio.

3. **Dotazione minima di mezzi**: varia per regione, ma il minimo tipico è 1-2 ambulanze omologate e in regola con tutte le verifiche. La ASL vuole vedere i veicoli al momento dell'ispezione.

4. **Personale minimo**: almeno il direttore sanitario responsabile (obbligatorio in alcune regioni — un medico iscritto all'OMCeO che si assume la responsabilità sanitaria dell'organizzazione) e un numero minimo di soccorritori qualificati.

5. **Polizza assicurativa RC**: copertura RC per il trasporto di persone e per i rischi specifici del soccorso. L'importo minimo varia per regione, ma difficilmente si scende sotto i 5.000.000 € per sinistro.

6. **Documento di valutazione dei rischi (DVR)**: obbligatorio ai sensi del D.Lgs. 81/2008 per qualsiasi datore di lavoro. Per le ambulanze ci sono rischi specifici (biologici, chimici, ergonomici, da movimentazione carichi, stradale).

**Rinnovo**: varia per regione. In Veneto l'autorizzazione viene richiesta ogni 3 anni. In Lombardia il regime è di accreditamento con verifica periodica. In molte ASL del Sud Italia il rinnovo è formalmente annuale ma nella pratica si rinnova solo se cambiano i requisiti (nuovi mezzi, nuova sede, variazione del personale).

**Impatto su SD**: ogni organizzazione cliente ha una scheda "accreditamento" in SD con: numero autorizzazione ASL, data rilascio, data scadenza, ASL competente, tipo di servizi autorizzati (urgenza/programmato). Alert 90 giorni prima della scadenza.

---

### 1.2 Iscrizione all'Albo/Registro dei Trasportatori Sanitari

Non esiste un albo nazionale unico per il trasporto sanitario programmato. Ogni regione ha il proprio registro, con denominazioni diverse:

- **Registro Regionale degli Enti di Trasporto Sanitario** (Veneto — DGR 962/2013)
- **Albo dei Soggetti Erogatori di Trasporto Sanitario** (Lombardia)
- **Elenco Regionale Trasportatori Sanitari** (Emilia-Romagna)
- In molte regioni del Sud il "registro" è di fatto l'autorizzazione ASL stessa, senza un registro regionale separato.

**Differenza fondamentale tra trasporto d'urgenza e trasporto programmato**:

- **Trasporto d'urgenza (118/SEM)**: l'iscrizione o abilitazione è molto più stringente. Richiede standard operativi alti, protocolli clinici approvati, mezzi ALS/BLS qualificati, personale con certificazioni avanzate (BLSD obbligatorio, PHTLS/ITLS spesso richiesto). La selezione avviene tramite gara pubblica e contratto di servizio con la centrale operativa 118.
- **Trasporto programmato**: requisiti più accessibili. L'iscrizione al registro regionale abilita a partecipare ai bandi pubblici per il trasporto programmato (dialisi, disabili, visite specialistiche).

**Prerequisito per gare d'appalto pubbliche**: senza l'iscrizione al registro/albo regionale, non si può partecipare ai bandi. Questo vale anche per i subappalti — una cooperativa che subappalta da un'altra deve avere la propria iscrizione.

**Impatto su SD**: campo "iscrizioni albi regionali" con possibilità di registrare più iscrizioni (se la cooperativa opera in più regioni). Ogni iscrizione ha: regione, numero iscrizione, data, scadenza.

---

### 1.3 Forma Giuridica: Tipi Ammessi e Implicazioni

Il trasporto sanitario in Italia è storicamente dominato da enti del terzo settore (Croce Rossa, Misericordie, ANPAS/Croce Verde/Croce Bianca, AVIS locali), ma dal 2000 in poi le società commerciali hanno conquistato quote di mercato significative, soprattutto nel trasporto programmato.

**Forme giuridiche ammesse**:

**A. Cooperativa Sociale (L. 381/1991)**
- Tipo A: erogazione servizi socio-sanitari ed educativi. La forma più comune nel trasporto sanitario.
- Tipo B: inserimento lavorativo di persone svantaggiate. Alcune hanno attività di trasporto come attività principale.
- Vantaggio fiscale: esenzione IRES se i requisiti mutualistici sono rispettati.
- Partecipazione gare: ammessa. In molti bandi pubblici le cooperative hanno punteggi preferenziali.
- Obbligo di iscrizione all'Albo delle Cooperative del Ministero delle Imprese.

**B. Associazione di Volontariato (ODV — Organizzazione di Volontariato)**
- Regolata dal D.Lgs. 117/2017 (Codice del Terzo Settore).
- Personale quasi tutto volontario; possono avere dipendenti ma in numero limitato rispetto ai volontari.
- Vantaggi fiscali significativi: esenzione IVA su servizi resi a enti pubblici, agevolazioni IRES.
- Obbligo di iscrizione al RUNTS (Registro Unico Nazionale Terzo Settore).
- Ammesse alle gare pubbliche; in molti capitolati il prezzo è il fattore determinante e le ODV hanno un vantaggio strutturale sul costo del lavoro (volontari).

**C. Associazione di Promozione Sociale (APS)**
- Simile alla ODV ma con più ampia possibilità di svolgere attività anche per i propri soci.
- Meno diffusa nel trasporto sanitario rispetto alla ODV.

**D. Ente del Terzo Settore generico (ETS)**
- Ombrello del D.Lgs. 117/2017 che include ODV, APS, ONLUS, imprese sociali.

**E. ONLUS (Organizzazione Non Lucrativa di Utilità Sociale)**
- Regime transitorio: le ONLUS iscritte all'anagrafe ONLUS prima del 2017 mantengono il regime fino alla piena operatività del RUNTS (termine più volte prorogato — al 2026 il regime transitorio è ancora in fase di completamento).
- Non si possono costituire nuove ONLUS.

**F. Società di capitali (SRL, SPA, SAS)**
- Ammesse nella maggior parte delle regioni per il trasporto programmato.
- Non hanno vantaggi fiscali del terzo settore.
- Partecipazione alle gare pubbliche: ammessa, ma in alcuni capitolati i requisiti di fatturato e solidità economica possono escludere le società di nuova costituzione.

**G. Impresa Sociale (D.Lgs. 112/2017)**
- Società commerciale con vincolo di destinazione dell'utile. Ibrido tra forma commerciale e terzo settore.
- Può iscriversi al RUNTS.

**Impatto su SD**: il profilo organizzazione ha il campo "forma giuridica" con le opzioni sopra descritte. La forma giuridica determina il regime IVA applicato nelle fatture generate da SD (es. le ODV per servizi SSN non addebitano IVA; le SRL sì).

---

### 1.4 RUNTS — Registro Unico Nazionale Terzo Settore

Il RUNTS è stato istituito dal D.Lgs. 117/2017 (Codice del Terzo Settore) e ha sostituito i precedenti registri regionali delle organizzazioni di volontariato e delle APS. È operativo dal 23 novembre 2021.

**Chi deve iscriversi**: ODV, APS, ETS diversi, imprese sociali. Non le cooperative sociali (hanno il proprio Albo ministeriale).

**Sezioni del RUNTS** (7 sezioni, la cooperativa deve sapere a quale appartiene il suo cliente):
1. Organizzazioni di volontariato (ODV)
2. Associazioni di promozione sociale (APS)
3. Enti filantropici
4. Imprese sociali (incluse le cooperative sociali)
5. Reti associative
6. Società di mutuo soccorso
7. Altri ETS

**Implicazioni operative per SD**:
- Le organizzazioni nel RUNTS hanno obblighi di rendicontazione e trasparenza (bilancio sociale, pubblicazione sul RUNTS degli atti fondamentali).
- SD può supportare la rendicontazione: il numero di trasporti effettuati, il valore economico dei servizi, la tipologia di utenti serviti sono dati che le ODV usano nel bilancio sociale.
- Per ricevere contributi pubblici e 5x1000, l'ente deve essere nel RUNTS. SD non gestisce questo processo ma può esportare i dati necessari alla rendicontazione.

**Impatto su SD**: nel profilo organizzazione, campo "iscrizione RUNTS" con numero di iscrizione e sezione. Alert se l'ente non è iscritto ma la forma giuridica richiederebbe l'iscrizione.

---

## 2. REQUISITI VEICOLI

### 2.1 Classificazione Europea Ambulanze (UNI EN 1789:2020)

La norma UNI EN 1789 è lo standard europeo di riferimento per la classificazione e le dotazioni delle ambulanze. In Italia è recepita integralmente. La versione vigente è del 2020 (sostituisce la 2007 e la 2014).

**Tipo A — Ambulanza per trasporto pazienti**:
- **A1**: per 1 paziente disteso. Allestimento base: lettiga, sedile accompagnatore, attrezzature di base.
- **A2**: per 2 pazienti distesi (o 1 disteso + 2 seduti). Meno diffusa in Italia.
- Non è progettata per la terapia d'urgenza sul posto — solo per il trasporto stabile.
- Mezzo principale del trasporto programmato (dialisi, dimissioni, visite).

**Tipo B — Ambulanza per soccorso e trasporto**:
- Per pazienti che possono richiedere assistenza sanitaria durante il trasporto.
- Dotazioni più complete: DAE, ossigeno, aspiratore, monitor ECG, materiale per BLS avanzato.
- Standard minimo richiesto per i servizi di urgenza e per i trasferimenti inter-ospedalieri.

**Tipo C — Ambulanza di terapia intensiva mobile**:
- Per pazienti critici in ventilazione artificiale o con monitoraggio avanzato continuo.
- Dotazioni complete: ventilatore da trasporto, monitor multi-parametrico completo, pompe infusionali, defibrillatore manuale.
- Anche definita MSA (Mezzo di Soccorso Avanzato) quando ha medico a bordo, o MSI (Mezzo di Soccorso Infermieristico) quando l'equipaggio avanzato è formato da infermieri.

**MSB (Mezzo di Soccorso di Base)**: termine italiano per ambulanza B senza personale avanzato — solo soccorritori.

**Pulmino sanitario attrezzato**: non è classificato nella EN 1789. Rientra nella categoria veicoli speciali per trasporto persone con disabilità. La normativa di riferimento è il Codice della Strada (art. 82) e le normative regionali sull'allestimento.

---

### 2.2 Collaudo e Revisioni Obbligatorie

**Revisione Ministeriale (MCTC — Motorizzazione Civile)**:
- Ambulanze ≤3,5 t: ogni anno (stesso ciclo dei veicoli privati).
- Ambulanze >3,5 t: ogni anno, presso officina autorizzata o MCTC.
- Senza revisione in regola: il mezzo non può circolare. SD segnala la scadenza revisione 30 giorni prima.

**Collaudo Sanitario ASL**:
- Obbligatorio in quasi tutte le regioni per mantenere l'autorizzazione all'esercizio del trasporto sanitario.
- L'ASL invia i propri tecnici (medico competente o personale tecnico delegato) a verificare:
  - Stato dell'allestimento sanitario
  - Completezza e validità delle dotazioni
  - Pulizia e sanificazione del vano sanitario
  - Documentazione del mezzo (libretto, autorizzazione ASL specifica per quel mezzo)
- **Frequenza**: annuale nella maggior parte delle regioni (Veneto, Lombardia, Emilia-Romagna). Alcune ASL fanno ispezioni a campione biennali.
- **Esito del collaudo**: il mezzo riceve un timbro/attestazione di idoneità. Senza idoneità ASL, il mezzo non può essere utilizzato per servizi convenzionati SSN.

**Impatto su SD**:
- Per ogni mezzo: data ultima revisione MCTC, data prossima revisione, data ultimo collaudo ASL, data prossimo collaudo ASL.
- Alert a 30 giorni dalla scadenza revisione MCTC.
- Alert a 60 giorni dalla scadenza collaudo ASL (serve prenotare l'ispezione con anticipo).
- Se un mezzo ha collaudo scaduto, SD lo segnala come "non disponibile per servizi SSN" e impedisce l'assegnazione a servizi convenzionati.

---

### 2.3 Dotazioni Obbligatorie Minime per Tipo Ambulanza

**Base normativa**: DM 2 aprile 2008 "Definizione degli standard dell'assistenza sanitaria d'urgenza" e la UNI EN 1789:2020. Alcune regioni hanno normative locali più stringenti.

**Dotazioni comuni a tutti i tipi di ambulanza**:

| Dotazione | Norma | Note SD |
|-----------|-------|---------|
| DAE (Defibrillatore Automatico Esterno) | L. 116/2021 (obbligo su tutte le ambulanze dal 2019) | Data scadenza elettrodi e batterie in SD |
| Ossigeno medicale (bombola + riduttore + maschere) | DM 2008 | Volume bombola, data ultima verifica |
| Aspiratore elettrico per secreti | DM 2008 | |
| Piano spinale (backboard) | DM 2008 | |
| Collare cervicale (set misure: small, medium, large, XL) | DM 2008 | |
| Materassino a depressione (vacuum mattress) | DM 2008 | |
| Lettiga principale | DM 2008 | Portata certificata |
| Seggiolino portantina | DM 2008 | Per scale strette |
| Borsa primo intervento (con tourniquet, bendaggi, garze, kit trauma) | DM 2008 | |
| Saturimetro (pulsossimetro) | DM 2008 | |
| Glucometro + strisce | DM 2008 | Scadenza strisce |
| Termometro | DM 2008 | |
| Sfigmomanometro | DM 2008 | |
| Guanti monouso (varie misure) | DM 2008 / D.Lgs. 81/2008 | DPI obbligatori |
| Mascherine FFP2 | D.Lgs. 81/2008 | DPI |
| Teli monouso e coperte isotermiche | DM 2008 | |

**Dotazioni aggiuntive per Tipo B**:
- Monitor ECG/defibrillatore manuale (bifasico)
- Ventilatore da trasporto manuale (ambu) e dispositivi avanzati per le vie aeree (laringoscopi, tubi endotracheali)
- Farmaci base (in regioni dove l'infermiere è abilitato alla somministrazione sul mezzo)
- Set per accesso venoso

**Dotazioni aggiuntive per Tipo C**:
- Ventilatore da trasporto automatico
- Monitor multi-parametrico (ECG, SpO2, etCO2, NIBP, temperatura)
- Pompe infusionali
- Defibrillatore bifasico con possibilità di pacing esterno
- Gas medicali (O2 + aria compressa) con autonomia minima 4 ore

**Dotazioni specifiche allestimento STEN**:
- Incubatrice da trasporto certificata per il trasporto su strada
- Ventilatore neonatale da trasporto
- Pompe infusionali neonatali (almeno 2)
- Monitor neonatale
- Riscaldatore per fluidi
- Aspiratore mucosità neonatale

**Dotazioni specifiche allestimento Bariatrico**:
- Lettiga bariatrica rinforzata (portata minima 350 kg, ideale 450 kg)
- Alzapersone o sollevatore idraulico certificato
- Cinghie di ancoraggio bariatriche
- Carrozzina bariatrica (se trasporto a sedere)
- Teli di scorrimento antifrizionali

**Checklist pre-servizio in SD**:
La checklist digitale che l'autista compila prima di ogni servizio include la verifica delle dotazioni obbligatorie. Il sistema confronta la checklist con le dotazioni attese per quel tipo di mezzo. Se manca una dotazione critica (es. DAE non presente), il servizio non può essere avviato senza approvazione esplicita del responsabile.

---

### 2.4 Sanificazione e Pulizia dei Veicoli

**Base normativa**: circolari ministeriali, linee guida ISS, normative regionali specifiche post-COVID.

**Sanificazione standard dopo ogni servizio**:
- Superfici vano sanitario (pareti, pavimento, attrezzature) con disinfettante certificato.
- Lettiga e cuscino (se non monouso).
- Maniglie interne e esterne.

**Sanificazione straordinaria** dopo:
- Trasporto paziente con malattia infettiva nota.
- Contatto con materiale biologico.
- TSO con eventuale resistenza fisica.

**Documentazione in SD**: registro sanificazioni per ogni mezzo. L'autista compila il registro in app dopo ogni sanificazione. Il responsabile può vedere l'ultima sanificazione e l'operatore che l'ha effettuata.

---

## 3. REQUISITI PERSONALE

### 3.1 Formazione Base Obbligatoria per Tutti gli Operatori

**Patente di guida**:
- Patente B: per auto sanitarie e ambulanze leggere (massa totale ≤3.500 kg).
- Patente C: per ambulanze pesanti (massa totale >3.500 kg) — quasi tutte le ambulanze standard superano questo limite a pieno carico.
- **CQC (Certificato di Qualificazione del Conducente)**: obbligatorio per autisti professionisti di veicoli superiori a 3.500 kg (D.Lgs. 286/2005). Rinnovo ogni 5 anni con formazione continua (35 ore ogni 5 anni).
- Patente D + CQC persone: obbligatoria per chi guida pulmini con più di 8 posti (oltre al conducente) adibiti al trasporto di persone in modo non occasionale.

**BLS-D (Basic Life Support con Defibrillazione)**:
- Obbligatorio per tutti gli operatori che salgono sui mezzi di soccorso.
- Include: RCP (rianimazione cardiopolmonare) adulto e pediatrico, uso del DAE, ostruzione vie aeree.
- Rinnovo: ogni 2 anni (la norma varia leggermente per regione, ma il biennio è lo standard prevalente).
- Erogato da centri formatori accreditati (spesso le stesse cooperative o enti terzi certificati IRC, ERC, o AHA).
- Certificato: deve riportare il nome del corsista, la data, l'ente formatore, la firma del docente.

**TSSA (Trasporto Sanitario Semplice con Accompagnamento)** o equivalente regionale:
- Il corso base per l'esercizio del trasporto sanitario programmato.
- Durata tipica: 40-60 ore tra teoria e pratica.
- Contenuti standard: anatomia e fisiologia di base, tecniche di movimentazione del paziente, uso delle attrezzature ambulanza, procedure di comunicazione con la centrale, aspetti legali e deontologici.
- Ogni regione ha il proprio percorso formativo riconosciuto:
  - Veneto: corso TSSA riconosciuto dalla Regione Veneto, 60 ore.
  - Lombardia: corso di formazione per soccorritore, conforme alle Linee Guida ATS.
  - Emilia-Romagna: corso di abilitazione per trasporto sanitario semplice.
  - Toscana: corso regionale soccorritore BLSD.
  - Le certificazioni non sono sempre reciprocamente riconosciute tra regioni — un operatore certificato in Veneto che si trasferisce in Lombardia potrebbe dover ripetere il corso.

**Corso guida sicura / guida su veicoli di soccorso**:
- Non obbligatorio per legge in tutte le regioni, ma richiesto in molti capitolati di gara.
- Veneto: obbligatorio per chi esegue trasporti d'urgenza 118.
- Alcune cooperative lo erogano internamente a tutti i nuovi autisti.

---

### 3.2 Formazione Specifica per Ruolo

**Autista-Soccorritore** (la figura più diffusa nel trasporto programmato):
- Patente C + CQC (o patente B per mezzi leggeri).
- BLS-D valido.
- TSSA o equivalente regionale valido.
- Formazione ECM (Educazione Continua in Medicina): non obbligatoria per i soccorritori non sanitari in senso stretto, ma alcune regioni la richiedono per i soccorritori che operano con infermieri.

**Soccorritore avanzato / Operatore di Soccorso**:
- BLS-D + corsi avanzati: PBLS (pediatrico), BLSD pediatrico, PHTLS (Pre-Hospital Trauma Life Support), ITLS (International Trauma Life Support), AMLS (Advanced Medical Life Support).
- In alcune regioni: corso specifico per soccorritore avanzato (es. "soccorritore 118" in Veneto, "soccorritore di base" in Lombardia con attestato ATS).

**Infermiere**:
- Laurea in Infermieristica (L-SNT/1).
- Iscrizione all'OPI (Ordine delle Professioni Infermieristiche) del territorio — è un requisito legale per esercitare. Senza iscrizione OPI l'infermiere non può operare.
- BLS-D valido.
- ECM: 50 crediti ogni 3 anni (obbligo di legge per tutti i professionisti sanitari).
- Formazione specifica EMS: non obbligatoria per legge ma necessaria per operare efficacemente su ambulanza (protocolli di emergenza preospedaliera, uso delle attrezzature di emergenza).
- ACLS (Advanced Cardiac Life Support): fortemente raccomandato, richiesto in molti capitolati per infermieri su MSI/MSA.

**Medico**:
- Laurea in Medicina e Chirurgia + Abilitazione.
- Iscrizione all'OMCeO (Ordine dei Medici Chirurghi e degli Odontoiatri).
- BLS-D + ACLS validi.
- ECM: 150 crediti ogni 5 anni (obbligo di legge).
- Specializzazione in Medicina d'Emergenza-Urgenza (MEAU): non obbligatoria per operare su ambulanza, ma richiesta in molte strutture e capitolati per il ruolo di medico d'emergenza.
- ATLS (Advanced Trauma Life Support): per chi opera in contesti traumatologici.

**Operatore Socio-Sanitario (OSS)** (per trasporto disabili):
- Qualifica OSS rilasciata da istituto formativo regionale riconosciuto (corso di 1.000 ore totali, di cui 450 di tirocinio).
- Non ha la qualifica di soccorritore ma è abilitato all'assistenza alla persona.
- BLS-D: non sempre obbligatorio per legge ma richiesto in molti contratti per OSS su ambulanza.

---

### 3.3 Certificazioni Periodiche: Scadenze e Rinnovi

Questa tabella riassume le principali certificazioni con le scadenze di rinnovo. SD gestisce automaticamente il tracciamento e gli alert.

| Certificazione | Periodicità rinnovo | Modalità rinnovo | Alert SD |
|---------------|---------------------|------------------|----------|
| BLS-D adulto | 2 anni | Corso di rinnovo (4-6 ore) + prova pratica | 60 gg prima |
| BLSD pediatrico (PBLS) | 2 anni | Corso rinnovo specifico | 60 gg prima |
| CQC (Conducente Professionale) | 5 anni | 35 ore formazione continua | 90 gg prima |
| Patente medica (idoneità alla guida professionale) | Variabile per età | Visita medica MCTC | 60 gg prima |
| ECM Infermiere | 3 anni (50 crediti) | Corsi ECM accreditati | Monitoraggio crediti |
| ECM Medico | 5 anni (150 crediti) | Corsi ECM accreditati | Monitoraggio crediti |
| Iscrizione OPI | Annuale (quota) | Rinnovo iscrizione | 30 gg prima |
| Iscrizione OMCeO | Annuale (quota) | Rinnovo iscrizione | 30 gg prima |
| ACLS/PALS | 2 anni | Corso rinnovo | 60 gg prima |
| PHTLS/ITLS | 2 anni | Corso rinnovo | 60 gg prima |
| Certificazione TSO | Variabile per regione | Corso specifico | 60 gg prima |
| Idoneità lavorativa (visita medica D.Lgs. 81/2008) | 1-5 anni (secondo rischio) | Medico competente aziendale | 30 gg prima |

**Gestione blocco automatico in SD**: il responsabile dell'organizzazione può attivare in SD la regola per cui un operatore con una certificazione scaduta viene automaticamente segnalato come "non assegnabile" ai servizi che richiedono quella certificazione. Il sistema non blocca fisicamente la finestra di lavoro dell'operatore, ma mostra un alert rosso nell'interfaccia di assegnazione e richiede una conferma esplicita del responsabile per procedere.

---

### 3.4 Formazioni Specialistiche Aggiuntive

**Corso TSO (Trattamento Sanitario Obbligatorio)**:
- Non c'è un corso nazionale standardizzato — ogni regione ha il proprio percorso o indica i contenuti minimi.
- I contenuti includono: quadro normativo (L. 833/1978, art. 33-35), aspetti relazionali con il paziente psichiatrico agitato, tecniche di de-escalation verbale, contenzione fisica sicura (solo se necessaria e secondo protocollo), coordinamento con forze dell'ordine.
- Durata tipica: 8-16 ore.
- Non tutti gli operatori devono avere questa certificazione — è necessaria solo per chi viene assegnato a questi servizi.

**BLSD Pediatrico (PBLS)**:
- Richiesto in alcune regioni per tutti gli operatori che possono essere chiamati ad intervenire su bambini.
- Obbligatorio per chi opera in contesti neonatali o pediatrici.

**Movimentazione paziente bariatrico**:
- Corso specifico sulla gestione del paziente con obesità grave: tecniche di sollevamento, uso dell'alzapersone, movimentazione in sicurezza con più operatori.
- Non è un requisito normativo esplicito ma è richiesto dai capitolati che prevedono il trasporto bariatrico.

**HAZMAT (Materiali Pericolosi)**:
- Per il trasporto di materiali biologici con rischio infettivo elevato (es. pazienti con patologie infettive trasmissibili per via respiratoria o ematica).
- Conoscenza ADR (Accordo Europeo per il Trasporto di Merci Pericolose su Strada): obbligatoria per chi trasporta campioni biologici classificati come "materia biologica — categoria A o B" secondo ADR 2023.

---

## 4. REQUISITI REGIONALI SPECIFICI

### 4.1 Panoramica per Regione

Le norme nazionali definiscono il minimo; ogni regione aggiunge i propri requisiti specifici. Di seguito i dettagli per le principali regioni.

---

**LOMBARDIA**

Ente autorizzante: ATS (Agenzie di Tutela della Salute) — hanno sostituito le ASL nel 2016.

**Accreditamento ATS**:
- Distinzione netta tra operatori del 118 (AREU — Azienda Regionale Emergenza Urgenza) e trasportatori programmati.
- Per il trasporto programmato: accreditamento specifico per categoria di servizio (dialisi, dimissioni, disabili, ecc.).
- L'accreditamento richiede il superamento di una verifica documentale e, per alcuni servizi, un audit on-site.

**DCRB (Documento Criteri Requisiti Base)**:
- Il documento di riferimento per i requisiti strutturali e organizzativi delle strutture socio-sanitarie, inclusi i trasportatori.
- Definisce: requisiti strutturali (sede), tecnologici (mezzi), organizzativi (personale, procedure), di qualità.
- La verifica DCRB è periodica (ogni 3 anni).

**Requisiti aggiuntivi Lombardia**:
- Presenza di un Direttore Sanitario: obbligatoria per le organizzazioni che erogano servizi sanitari avanzati.
- Protocolli operativi scritti: l'ATS verifica la presenza di procedure scritte per i principali scenari operativi.
- Registro informatico dei servizi: la Lombardia tende a richiedere sistemi di rendicontazione digitali. SD è già conforme.

**Gare d'appalto**:
- Le gare per il trasporto sanitario programmato in Lombardia sono gestite dalle ATS o dalle ASST (Aziende Socio-Sanitarie Territoriali).
- Il criterio di aggiudicazione è quasi sempre economicamente più vantaggioso (qualità + prezzo).

---

**VENETO**

Ente autorizzante: ULSS (Unità Locale Socio-Sanitaria) — 9 ULSS che coprono l'intero territorio regionale.

**DGR 962/2013 — Registro Regionale Trasportatori**:
- Requisito fondamentale per qualsiasi operatore di trasporto sanitario in Veneto.
- Il registro è tenuto dalla Regione Veneto e suddiviso per categoria: urgenza/emergenza (articolazione SUEM 118), trasporto programmato, trasporto neonatale.
- Iscrizione condizionata a: autorizzazione ASL, dotazione minima mezzi, personale qualificato, polizza RC adeguata.

**Requisiti aggiuntivi Veneto**:
- Corso guida su veicoli di soccorso: obbligatorio per autisti di ambulanza (anche trasporto programmato, in alcune ULSS).
- Nomenclatore tariffario regionale: il Veneto ha un proprio nomenclatore per il trasporto sanitario programmato, con tariffe per km per tipo di mezzo. SD deve importarlo e applicarlo correttamente per le fatture alle ULSS venete.
- Sistema informatico: la Regione Veneto sta progressivamente richiedendo l'integrazione con il proprio sistema informativo sanitario (INSIEL) per la rendicontazione digitale dei servizi.

---

**EMILIA-ROMAGNA**

Ente autorizzante: AUSL (Aziende Unità Sanitarie Locali) — 8 AUSL.

**Accreditamento regionale con profilo qualità**:
- L'Emilia-Romagna ha sviluppato un sistema di accreditamento con "profili di qualità" — gli enti che superano la verifica ricevono un accreditamento che abilita alla stipula di accordi contrattuali con le AUSL.
- ISO 9001: non è obbligatoria per legge ma è un requisito frequente nei capitolati emiliani. Le cooperative certificate ISO 9001 hanno vantaggi nelle gare.

**ESTAR (Ente di Supporto Tecnico Amministrativo Regionale)**: in Toscana (vedi sotto), ma in Emilia-Romagna la centralizzazione degli acquisti avviene tramite INTERCENTER (centrale acquisti regionale).

---

**TOSCANA**

Ente autorizzante: ASL Toscana (4 ASL dopo la riorganizzazione del 2016: Area Vasta Nord-Ovest, Centro, Sud-Est, Grossetana).

**ESTAR (Ente di Supporto Tecnico Amministrativo Regionale)**:
- ESTAR gestisce le gare d'appalto per conto delle ASL toscane.
- Chi vuole lavorare con le ASL toscane deve essere qualificato sul portale ESTAR.
- Requisiti ESTAR: documentazione amministrativa completa, fatturato minimo, assenza di condanne per reati gravi (antimafia e antimafia rafforzata per determinati servizi).

**Requisiti aggiuntivi Toscana**:
- Carta dei servizi: le organizzazioni che operano in Toscana devono avere una carta dei servizi pubblicata e accessibile agli utenti.
- Sistema di monitoraggio qualità: la Toscana ha implementato sistemi di monitoraggio della soddisfazione degli utenti. Le cooperative devono raccogliere e rendicontare feedback.

---

**LAZIO**

Ente autorizzante: ASL (12 ASL nel Lazio).

**ARES 118**:
- ARES (Azienda Regionale Emergenza Sanitaria) gestisce il 118 nel Lazio.
- Le cooperative che vogliono operare nel sistema d'urgenza devono avere un accreditamento specifico ARES, separato dall'autorizzazione ASL per il trasporto programmato.
- Per il trasporto programmato, l'autorizzazione ASL territoriale è sufficiente.

**Roma Capitale**:
- Il Comune di Roma ha propri requisiti per i servizi di trasporto disabili e per i servizi sociali.
- Il Municipio competente (15 Municipi) può avere requisiti ulteriori.

---

**CAMPANIA**

Ente autorizzante: ASL (7 ASL in Campania).

**So.Re.Sa. (Società Regionale per la Sanità)**:
- So.Re.Sa. è la centrale acquisti della Regione Campania per i prodotti e i servizi sanitari.
- Per operare con le strutture sanitarie pubbliche campane, l'iscrizione al portale So.Re.Sa. è praticamente necessaria.
- Requisiti So.Re.Sa.: documentazione antimafia completa (attestazione prefettizia), DURC regolare, visura camerale, dichiarazioni sostitutive varie.

**Antimafia rafforzata**:
- In Campania (e più in generale nel Sud Italia), le verifiche antimafia sono più stringenti rispetto al Nord.
- Certificazione antimafia (comunicazione antimafia o informazione antimafia a seconda dell'importo del contratto) obbligatoria per qualsiasi appalto pubblico.
- SD deve supportare la gestione e l'archiviazione di questi documenti.

---

**SICILIA**

Ente autorizzante: ASP (Aziende Sanitarie Provinciali) — 9 ASP.

**Assessorato Salute Regionale**:
- In Sicilia, per alcune tipologie di servizi (in particolare l'urgenza), l'autorizzazione dell'Assessorato Regionale della Salute si aggiunge a quella dell'ASP.
- Il percorso autorizzativo è più lungo e può richiedere mesi.

**SEUS (Sicilia Emergenza Urgenza Sanitaria)**:
- La società in-house regionale che gestisce il 118 in Sicilia.
- Per operare nel sistema 118 siciliano, le cooperative devono avere un accordo con SEUS.

---

**SARDEGNA**

Ente autorizzante: ATS Sardegna (Azienda per la Tutela della Salute — unica ASL regionale dal 2017).

**AREUS (Azienda Regionale Emergenza Urgenza Sardegna)**:
- Gestisce il 118 in Sardegna.
- Requisiti specifici per operatori del sistema d'emergenza.

**Particolarità geografica**:
- La Sardegna ha problemi logistici specifici (zone interne poco servite, isole minori).
- Alcune convenzioni prevedono servizi in zone molto remote con costi di percorrenza elevatissimi.
- SD deve gestire correttamente i km nelle zone sarde con percorsi montagnosi e strade tortuose (il percorso stradale può essere 2-3 volte la distanza in linea d'aria).

---

### 4.2 Tabella Riassuntiva Requisiti Regionali

| Regione | Ente Autorizzante | Registro Specifico | Requisiti Aggiuntivi Chiave | Centrale Acquisti |
|---------|------------------|--------------------|-----------------------------|-------------------|
| Lombardia | ATS | Albo erogatori ATS | DCRB, Dir. Sanitario, audit periodico | ARIA SpA |
| Veneto | ULSS | Registro DGR 962/2013 | Corso guida, nomenclatore tariffario | - |
| Emilia-Romagna | AUSL | Elenco accreditati | ISO 9001 preferenziale, INTERCENTER | INTERCENTER |
| Toscana | ASL Area Vasta | Qualifica ESTAR | Carta dei servizi, monitoraggio qualità | ESTAR |
| Lazio | ASL | Accreditamento ARES (per urgenza) | Separazione urgenza/programmato | Lazio Crea |
| Campania | ASL | Iscrizione So.Re.Sa. | Antimafia rafforzata, DURC continuo | So.Re.Sa. |
| Sicilia | ASP + Assessorato | Autorizzazione doppia | SEUS per urgenza, iter lungo | - |
| Sardegna | ATS Sardegna | Autorizzazione unica | AREUS per urgenza, gestione zone remote | SARDEGNA CAT |
| Piemonte | ASL/AO | Registro regionale | Accordi AREU piemontese | SCR Piemonte |
| Liguria | ASL | Elenco ASL | Alisa (autorità sanitaria ligure) | Liguria Digitale |

---

## 5. COME SD SUPPORTA LA COMPLIANCE

### 5.1 Dashboard Compliance Organizzazione

La dashboard compliance in SD è la vista centrale per il responsabile dell'organizzazione (o per il referente compliance). Mostra in un'unica schermata lo stato di tutti i requisiti.

**Sezioni della dashboard**:

**Stato Accreditamento**:
- Autorizzazione ASL: numero, data scadenza, stato (valida / in scadenza / scaduta / in rinnovo).
- Iscrizione albo/registro regionale: stato per ogni regione di operatività.
- Iscrizione RUNTS (se applicabile): numero di iscrizione, sezione, data iscrizione.
- ISO 9001 (se applicabile): ente certificatore, data scadenza, prossimo audit.

**Stato Flotta** (semaforo per ogni mezzo):
- Verde: tutti i documenti in regola, prossima scadenza > 60 giorni.
- Giallo: una o più scadenze tra 30 e 60 giorni.
- Arancione: una o più scadenze tra 1 e 30 giorni.
- Rosso: documento scaduto — mezzo bloccato per servizi convenzionati SSN.

**Stato Operatori** (semaforo per ogni operatore):
- Verde: tutte le certificazioni valide.
- Giallo: una o più certificazioni in scadenza a breve.
- Rosso: certificazione scaduta — alert per non assegnare a servizi che richiedono quella certificazione.

**Scadenze prossime** (lista ordinata per urgenza):
- Ogni voce mostra: tipo scadenza, soggetto (mezzo o operatore), data scadenza, giorni mancanti, azione richiesta.

---

### 5.2 Alert Automatici e Notifiche

SD gestisce un sistema di alert a più livelli per ogni tipo di scadenza. Le soglie sono configurabili dal responsabile organizzazione.

**Alert standard predefiniti**:

| Tipo Scadenza | Alert 1 | Alert 2 | Alert 3 | Alert Rosso |
|--------------|---------|---------|---------|-------------|
| Revisione MCTC | 60 gg | 30 gg | 7 gg | Scaduta |
| Collaudo ASL | 90 gg | 60 gg | 30 gg | Scaduto |
| Autorizzazione ASL | 120 gg | 90 gg | 30 gg | Scaduta |
| BLS-D operatore | 60 gg | 30 gg | 7 gg | Scaduto |
| CQC autista | 90 gg | 60 gg | 30 gg | Scaduto |
| Iscrizione OPI/OMCeO | 60 gg | 30 gg | 7 gg | Scaduta |
| Polizza RC | 60 gg | 30 gg | 7 gg | Scaduta |

**Canali di notifica**:
- **Email**: al responsabile compliance e al responsabile operativo.
- **Notifica push in-app**: visibile nella dashboard SD.
- **SMS** (opzionale, configurabile): per alert critici (scadenza 7 giorni o scaduta).
- **Report settimanale**: email automatica ogni lunedì con riepilogo di tutte le scadenze entro 90 giorni.

---

### 5.3 Gestione Documentale

**Archiviazione digitale certificazioni**:
- Per ogni operatore: upload PDF di ogni certificazione. Il sistema verifica che la data di scadenza inserita corrisponda al documento.
- Per ogni mezzo: libretto di circolazione, certificato di collaudo ASL, attestazione revisione MCTC, polizza RC del mezzo.
- Per l'organizzazione: autorizzazione ASL, iscrizioni agli albi, polizza RC organizzazione, DVR, atti fondamentali (statuto, atto costitutivo).

**Controllo accessi ai documenti**:
- Il responsabile compliance vede tutto.
- L'operatore vede solo le proprie certificazioni.
- Il cliente (es. ASL) può avere accesso in sola lettura ai documenti che riguardano i servizi che lo coinvolgono (funzionalità opzionale, configurabile per singolo cliente).

**Immutabilità dei documenti**:
- I documenti caricati non possono essere eliminati — solo sostituiti con versione più recente.
- Ogni versione del documento è tracciata con timestamp e utente che l'ha caricata.
- Il log delle operazioni sui documenti è immutabile (HMAC firmato), per garantire la prova dell'avvenuta custodia documentale in caso di ispezione ASL.

---

### 5.4 Report per Audit e Ispezioni

**Report Audit ASL**:
Quando la ASL annuncia un'ispezione, il responsabile può generare in SD il report di audit che include:
- Elenco dei servizi effettuati nel periodo (con km, orari, operatori).
- Stato delle certificazioni di tutti gli operatori attivi nel periodo.
- Stato dei collaudi e delle revisioni di tutti i mezzi usati nel periodo.
- Registro sanificazioni dei mezzi.
- Log degli accessi al sistema (chi ha fatto cosa e quando).
- Eventuali non conformità rilevate e le azioni correttive intraprese.

**Report per gara d'appalto**:
Quando la cooperativa partecipa a un bando, deve produrre documentazione della propria capacità operativa. SD genera:
- Riepilogo servizi effettuati negli ultimi 12/24/36 mesi (numero corse, km totali, tipologie servizi).
- Elenco operatori attivi con qualifiche.
- Elenco mezzi con tipo e anno immatricolazione.
- Attestazione di regolarità documentale (auto-certificazione supportata dai dati SD).

**Report ECM per professionisti sanitari**:
Per gli infermieri e i medici, SD tiene traccia dei crediti ECM acquisiti (integrazione con sistema Cogeaps opzionale). Il report mostra i crediti accumulati nel triennio/quinquennio e quanti ne mancano per completare l'obbligo.

---

### 5.5 Checklist Pre-Operatività per Nuovi Clienti

Quando si onboarda una nuova organizzazione cliente in SD, il responsabile account verifica i seguenti requisiti prima dell'attivazione completa della piattaforma:

**Livello 1 — Requisiti minimi per attivazione**:
- [ ] Forma giuridica verificata e compatibile con il tipo di servizi da gestire.
- [ ] Autorizzazione ASL presente e valida.
- [ ] Almeno 1 mezzo inserito in sistema con dati completi (targa, tipo, revisione, collaudo).
- [ ] Almeno 1 operatore con BLS-D valido.
- [ ] Polizza RC presente con massimale adeguato.

**Livello 2 — Requisiti per funzionalità complete**:
- [ ] Iscrizione albo/registro regionale (se previsto nella regione di operatività).
- [ ] Tutti gli operatori inseriti con tutte le certificazioni.
- [ ] Profilo tariffario configurato (nomenclatore regionale o tariffario privato).
- [ ] Clienti/enti convenzionanti inseriti (ASL, ULSS, Comuni).
- [ ] Strutture sanitarie di destinazione inserite nella rubrica.

**Livello 3 — Raccomandato per compliance ottimale**:
- [ ] ISO 9001 caricata (se disponibile).
- [ ] DVR caricato.
- [ ] Procedure operative scritte caricate (protocolli interni).
- [ ] Contatti referenti ASL inseriti per notifiche automatiche.
- [ ] Integrazione email/SMS alert attiva.

---

*Fine documento — versione 1.0 — ASCLEPIUS / Soccorso Digitale*
