# Tariffario Nazionale — Trasporto Sanitario Italia

> Documentazione per uso interno Soccorso Digitale — dev team, sales, account management.
> Autore: ASCLEPIUS — Domain Expert EMS. Aggiornamento: marzo 2026.
>
> **AVVERTENZA CRITICA**: I tariffari regionali cambiano con delibere che possono essere emesse in qualsiasi momento dell'anno. I valori indicati in questo documento sono riferiti alle delibere note al momento della redazione. **Verificare sempre l'aggiornamento con l'ASL/ULSS/ASP di competenza prima di qualsiasi preventivazione o configurazione della piattaforma SD per un cliente specifico.** I valori in Euro sono indicativi e possono differire anche significativamente dalla delibera in vigore al momento della lettura.

---

## Componenti Standard della Tariffa

Il trasporto sanitario italiano è tariffato con logiche che variano per regione, ma le componenti economiche sottostanti sono universalmente le stesse. SD deve gestirle tutte in piattaforma.

### Componenti di Costo di un Servizio

| Componente | Descrizione | Impatto sulla tariffa |
|-----------|-------------|----------------------|
| **Quota fissa per servizio** | Copre attivazione del mezzo, disponibilità dell'equipaggio, primo accesso al paziente, documentazione. Indipendente dalla distanza | Voce base in tutti i tariffari regionali |
| **Quota chilometrica** | Costo per km percorso (andata + ritorno, o solo percorso paziente a bordo — varia per regione) | Voce variabile, a volte calcolata sul percorso totale, a volte solo sul percorso "a carico" |
| **Costo equipaggio** | Autista (sempre), soccorritore/TSSA/infermiere (variabile per tipologia servizio). Costo orario del personale addizionale | In alcuni tariffari esplicitato, in altri incluso nella quota fissa |
| **Dotazione mezzo** | Quota di ammortamento e manutenzione del veicolo e delle attrezzature a bordo (defibrillatore, O2, carrozzella, barella, ecc.) | Incluso nella quota fissa nella maggior parte dei tariffari |
| **Carburante** | Costo effettivo del carburante. Alcune regioni prevedono adeguamento automatico con variazione >15% indice ISTAT | Di solito incluso nella quota km; alcune regioni prevedono voce separata |
| **Maggiorazioni** | Notturna, festiva, urgenza, disagio (zone montane) | Percentuali additive sulle voci base |

### Differenze per Tipo di Mezzo

| Tipo Mezzo | Normativa | Equipaggio minimo | Tipico utilizzo | Costo base relativo |
|-----------|-----------|-------------------|-----------------|---------------------|
| **Ambulanza tipo A** (emergenza) | DM 553/1987 tipo A | Autista + 1 soccorritore (+ medico/infermiere per BLS/ALS) | 118, trasporto urgente | Più alto |
| **Ambulanza tipo B** (trasporto) | DM 553/1987 tipo B | Autista + 1 soccorritore | Trasporto programmato, dialisi barellati | Medio-alto |
| **Auto sanitaria** | Veicolo attrezzato per trasporto non urgente | Solo autista (con qualifica) | Dialisi deambulanti, visite, dimissioni | Medio |
| **Pulmino attrezzato** | Veicolo ad uso promiscuo trasporto disabili/sanitario | Autista + accompagnatore | Dialisi seduti, trasporti collettivi | Medio-basso |
| **Barella + ambulanza A** | Configurazione speciale per pazienti allettati critici | Autista + 2 soccorritori | BLSD, trasferimenti inter-ospedalieri | Il più alto |

### Come SD Implementa i Calcoli Tariffari

La piattaforma Soccorso Digitale deve supportare i seguenti modelli di tariffazione, configurabili per cliente/regione:

1. **Modello a servizio**: tariffa fissa per tipologia di servizio (es. "dialisi andata €X, dialisi ritorno €Y"). Nessun calcolo km. Usato in alcune zone urbane dove le distanze sono standardizzate
2. **Modello misto quota fissa + km**: quota fissa di attivazione + tariffa per ogni km percorso. Il più comune in Italia. Richiede integrazione con sistema di calcolo km (Google Maps API o HERE Maps con routing stradale reale, non distanza aerea)
3. **Modello mensile per paziente (dialisi)**: importo fisso mensile concordato per singolo paziente dializzato, indipendentemente dal numero di sedute nel mese. Previsto esplicitamente in Veneto (DGR 2034/2015) e in alcune ULSS lombarde
4. **Modello a forfait annuale**: contratto pluriennale a importo fisso annuale per un pacchetto di servizi. Tipico delle grandi cooperative con contratti ASST lombarde
5. **Modello ibrido**: combinazione dei modelli sopra. SD deve permettere la configurazione di regole per paziente, per tipo servizio, per percorso

Configurazione minima richiesta in SD per ogni cliente:
- Quota fissa per tipo di missione (UERG, UTRGZ, DIALISI, DIM, etc.)
- Tariffa km (con possibilità di escludere il percorso a vuoto "andata al paziente")
- Maggiorazione notturna (%): orario inizio/fine configurabile (default 22:00-06:00)
- Maggiorazione festiva (%): giorni configurabili (domeniche + festività nazionali + festività regionali)
- Maggiorazione urgenza/emergenza (%): attivabile per singola missione
- CAP o zona per tariffe differenziate (es. zona montana vs pianura)

---

## Tariffari Regionali

### 1. Lombardia

**Modello tariffario**: misto — quota fissa + quota km per le gare strutturate; contratti pluriennali a forfait per le cooperative grandi con ASST

**Riferimento normativo**: DGR X/6375 del 20/02/2017 (accreditamento e tariffe massimali); DGR XII/1381 del 2023 (aggiornamento post-inflazione); Regole di Sistema annuali DG Welfare

**Quota fissa** (per servizio, valore indicativo DGR 2023): €22,00-€28,00 (verificare aggiornamento con ASST competente)

**Quota/km** (valore indicativo): €1,30-€1,70/km (a seconda del tipo di mezzo e del contratto)

**Maggiorazione notturna** (22:00-06:00): +25-30% sulla quota fissa; la quota km rimane invariata in molti contratti

**Maggiorazione festiva**: +15-20% sulla quota fissa

**Maggiorazione urgenza**: non standardizzata regionalmente; negoziata contratto per contratto tra cooperative e ASST

**Dialisi — modello specifico**: quota mensile per paziente nelle ASST che hanno adottato il modello veneto; quota fissa + km per le ASST rimaste al modello tradizionale. Fortissima eterogeneità tra ASST diverse

**Dialisi — range**: €200-€320/mese per paziente dializzato (quota mensile, dove applicato); €8-€18 per servizio singolo (quota fissa + km calcolato)

**Range generale**: €25-€80 per servizio tipico (trasporto programmato, esclusa dialisi)

**Note**: Le Regole di Sistema annuali (da monitorare ogni dicembre) possono modificare le tariffe massimali. Le cooperative grandi negoziano in deroga ai massimali con accordi privati con le ASST. AREU-NET deve essere integrato per i servizi 118 (tariffe 118 separate e non incluse nel tariffario programmato).

---

### 2. Piemonte

**Modello tariffario**: misto — quota fissa + quota km

**Riferimento normativo**: DGR 64-9681 del 07/12/2012 e successivi aggiornamenti deliberati da ciascuna ASL. Verificare con ASL competente la delibera più recente

**Quota fissa** (per servizio): €18,00-€25,00 (valore indicativo, variabile per ASL)

**Quota/km**: €1,20-€1,50/km

**Maggiorazione notturna** (22:00-06:00): +20-25%

**Maggiorazione festiva**: +15%

**Maggiorazione urgenza**: non standardizzata; varia per accordo con ASL

**Dialisi — modello specifico**: quota fissa + km per singolo trasporto (andata o ritorno); alcune ASL adottano la quota mensile per paziente

**Dialisi — range**: €5-€12 per singolo trasporto dialisi (quota fissa ridotta per dialisi + km); oppure €160-€240/mese per paziente (dove adottato)

**Range generale**: €20-€60 per servizio standard

**Note**: Le ASL piemontesi hanno autonomia significativa nell'interpretare il tariffario regionale. Verificare con ogni ASL la delibera vigente. L'ASL Città di Torino ha il volume maggiore e le tariffe più strutturate.

---

### 3. Liguria

**Modello tariffario**: misto — quota fissa + quota km, con tariffe tra le più alte del Nord-Ovest

**Riferimento normativo**: DGR regionale (verificare numero e anno aggiornati con ALISA o singola ASL)

**Quota fissa** (per servizio): €20,00-€28,00

**Quota/km**: €1,40-€1,80/km

**Maggiorazione notturna** (22:00-06:00): +25-30%

**Maggiorazione festiva**: +15-20%

**Maggiorazione urgenza**: +30% (dove previsto da accordo)

**Dialisi — modello specifico**: quota fissa + km per trasporto singolo

**Dialisi — range**: €6-€14 per singolo trasporto

**Range generale**: €25-€70 per servizio tipico

**Note**: La Liguria non ha un tariffario organico aggiornato. Alcune ASL applicano tariffe negoziate bilateralmente con gli operatori storici. I picchi estivi nelle zone costiere non sono normalmente maggiorati ma creano problemi di copertura che gli operatori recuperano con tariffe fuori contratto per servizi non SSN.

---

### 4. Valle d'Aosta

**Modello tariffario**: a servizio / forfettario — la USL gestisce internamente o con accordi diretti

**Riferimento normativo**: deliberazioni CDA USL Valle d'Aosta (verificare direttamente con USL Aosta)

**Quota fissa**: non standardizzata pubblicamente — accordo diretto con USL

**Quota/km**: variabile per accordo

**Maggiorazione notturna**: +20-30% (da accordo)

**Maggiorazione festiva**: +15%

**Dialisi — modello specifico**: accordo diretto USL con operatore unico o due operatori locali

**Dialisi — range**: verificare con USL Aosta

**Range generale**: servizi tipici €30-€80 (zone montane, distanze superiori alla media)

**Note**: Micro-mercato. Qualunque offerta SD in Valle d'Aosta deve passare dall'accordo diretto con la USL. La documentazione in francese è raccomandata per qualsiasi interfaccia pubblica.

---

### 5. Veneto

**Modello tariffario**: misto — quota fissa + quota km, con modello mensile per paziente per la dialisi. IL tariffario più dettagliato d'Italia

**Riferimento normativo**: DGR 2034/2015 del 15/12/2015 — "Approvazione del tariffario regionale per il trasporto sanitario". Da verificare con aggiornamenti DGR successivi della Direzione Salute Regione Veneto

**Quota fissa** (per servizio, valore indicativo DGR 2034/2015, da aggiornare):
- Trasporto urgente ambulanza tipo A: €25,68 (valore DGR 2015, aggiornare con rivalutazione)
- Trasporto programmato ambulanza tipo B: €18,50
- Auto sanitaria: €12,00-€15,00

**Quota/km** (valore indicativo DGR 2034/2015):
- Ambulanza tipo A: €1,54/km
- Ambulanza tipo B: €1,28/km
- Auto sanitaria: €0,85/km

**Maggiorazione notturna** (22:00-06:00): +25% su quota fissa e quota km

**Maggiorazione festiva** (domeniche e festività): +15% su quota fissa e quota km

**Maggiorazione urgenza** (richiesta urgente entro 30 minuti): +25%

**Dialisi — modello specifico**: quota mensile per paziente (DGR 2034/2015, art. specifico). Il paziente dializzato è tariffato con un importo mensile fisso che include tutte le sedute del mese (tipicamente 3 sedute/settimana = 12-13 sedute/mese)

**Dialisi — range**: €195-€260/mese per paziente (valore indicativo DGR 2015, da aggiornare con rivalutazione post-2020). Il range varia in base alla distanza media del bacino di pazienti di ogni centro dialisi rispetto al domicilio

**Range generale**: €30-€90 per servizio standard non-dialisi

**Note**: SD deve implementare la DGR 2034/2015 come modello base del modulo tariffario. Quando si configura un cliente veneto: (1) verificare se la ULSS ha recepito aggiornamenti alla DGR 2034/2015; (2) per la dialisi, impostare il modello "mensile per paziente" con importo concordato con la ULSS specifica; (3) inserire le tariffe corrette per tipo di mezzo. La FVS (Federazione Veneta del Soccorso) pubblica periodicamente aggiornamenti sul tariffario — consultare il sito FVS prima di configurare un cliente veneto.

---

### 6. Friuli-Venezia Giulia

**Modello tariffario**: misto — quota fissa + quota km; coordinato da ARCS

**Riferimento normativo**: delibere ARCS e delle singole aziende (ASUFC, ASUGI, ASFO). Verificare con ARCS FVG

**Quota fissa** (per servizio): €16,00-€22,00 (indicativo)

**Quota/km**: €1,15-€1,40/km

**Maggiorazione notturna**: +20-25%

**Maggiorazione festiva**: +15%

**Maggiorazione urgenza**: +20% (dove previsto)

**Dialisi — modello specifico**: quota fissa + km per singolo trasporto

**Dialisi — range**: €5-€12 per singolo trasporto

**Range generale**: €20-€55 per servizio standard

**Note**: SORES FVG centralizza il dispaccio — qualunque integrazione tecnica deve passare per Insiel/SORES. Trieste ha tariffe leggermente superiori rispetto al resto della regione per il costo della vita più alto.

---

### 7. Trentino-Alto Adige

**Modello tariffario**: due sistemi separati

**PAT (Trento)**:
- Riferimento: Regolamento APSS 2018 e aggiornamenti
- Quota fissa: €22,00-€30,00
- Quota/km: €1,45-€1,70/km
- Maggiorazione notturna: +25%
- Maggiorazione festiva: +20%

**PAB (Bolzano)**:
- Riferimento: accordo specifico PAB-Croce Bianca (pluriennale). Non un tariffario pubblico ma un contratto privato tra PAB e Weißes Kreuz
- Tariffe globalmente più alte del Trentino (+10-20% stimato) per costo della vita superiore
- Dialisi: gestita in esclusiva da Croce Bianca in base all'accordo PAB

**Maggiorazione urgenza**: +20-30% (Trento); inclusa nell'accordo globale (Bolzano)

**Dialisi — range**: €230-€300/mese per paziente (PAT); da accordo PAB-Croce Bianca (PAB)

**Range generale**: €35-€100 per servizio standard — le tariffe più alte d'Italia per il servizio base

**Note**: In Alto Adige, le tariffe non sono pubblicamente disponibili per la natura privata dell'accordo PAB-Croce Bianca. SD deve negoziare direttamente con Croce Bianca per l'implementazione del modulo tariffario in quella provincia. In Trentino, APSS è aperta a fornire i dati tariffari ufficiali.

---

### 8. Emilia-Romagna

**Modello tariffario**: misto — quota fissa + quota km; con recente aggiornamento DGR 2022 che ha introdotto revisioni post-pandemia

**Riferimento normativo**: DGR 2011/2015 e DGR di aggiornamento 2022 (verificare numero esatto su Intercent-ER e Regione ER). SATER pubblica i capitolati di gara che specificano le tariffe

**Quota fissa** (per servizio):
- Ambulanza tipo B: €20,00-€26,00
- Auto sanitaria: €13,00-€17,00

**Quota/km**:
- Ambulanza tipo B: €1,30-€1,55/km
- Auto sanitaria: €0,90-€1,10/km

**Maggiorazione notturna** (22:00-06:00): +25%

**Maggiorazione festiva**: +15%

**Maggiorazione urgenza**: +20-25%

**Dialisi — modello specifico**: generalmente quota mensile per paziente nelle AUSL che hanno adottato il modello centralizzato AVEC; quota fissa + km in altre AUSL

**Dialisi — range**: €190-€260/mese per paziente (AVEC); €5-€12 per singolo trasporto (AUSL in autonomia)

**Range generale**: €25-€70 per servizio standard

**Note**: Intercent-ER pubblica i capitolati di gara con le tariffe massimali sul sistema SATER. SD deve essere in grado di importare e confrontare automaticamente le proprie tariffe con i massimali SATER per ogni nuova gara. Le AUSL Romagna (Ravenna, Forlì, Cesena, Rimini) operano spesso con tariffe aggregate post-accorpamento.

---

### 9. Toscana

**Modello tariffario**: tariffe ESTAR con base DPCM LEA; struttura misto quota fissa + km

**Riferimento normativo**: delibere ESTAR (Ente di Supporto Tecnico-Amministrativo Regionale) aggiornate periodicamente. Verificare su estar.toscana.it. DGR 1235/2012 come base di accreditamento

**Quota fissa** (per servizio):
- Ambulanza tipo B: €18,00-€24,00
- Auto sanitaria: €12,00-€16,00

**Quota/km**:
- Ambulanza tipo B: €1,25-€1,50/km
- Auto sanitaria: €0,80-€1,05/km

**Maggiorazione notturna** (22:00-06:00): +20-25%

**Maggiorazione festiva**: +15%

**Maggiorazione urgenza**: +20%

**Dialisi — modello specifico**: misto — le Misericordie spesso applicano quota mensile per paziente concordata con ASL; le cooperative usano quota fissa + km

**Dialisi — range**: €180-€250/mese per paziente (Misericordie con accordo mensile); €5-€11 per singolo trasporto

**Range generale**: €22-€65 per servizio standard

**Note**: Le Misericordie toscane hanno una tradizione di rendicontare al "forfait mensile per paziente dializzato" negoziato direttamente con l'ASL di riferimento. SD deve supportare sia il modello mensile che quello a servizio per la Toscana. ESTAR è la piattaforma centralizzata per le gare: le tariffe pubblicate da ESTAR sono i massimali; le Misericordie spesso negoziano accordi bilaterali con l'ASL in deroga o in complemento al tariffario ESTAR.

---

### 10. Lazio

**Modello tariffario**: quota fissa + km; tariffe in revisione periodica ma spesso ferme per anni

**Riferimento normativo**: DGR Regione Lazio (verificare la DGR aggiornata su regione.lazio.it/atti — le DGR tariffarie laziali vengono spesso emesse con ritardo rispetto all'adeguamento ISTAT). ARES 118 emette delibere separate per i soggetti convenzionati nel 118

**Quota fissa** (per servizio, indicativo):
- Ambulanza tipo B: €18,00-€24,00
- Auto sanitaria: €11,00-€15,00

**Quota/km**: €1,20-€1,45/km

**Maggiorazione notturna** (22:00-06:00): +20-25%

**Maggiorazione festiva**: +15%

**Maggiorazione urgenza**: +20% (ARES 118; trasporto programmato: da accordo)

**Dialisi — modello specifico**: quota fissa + km per trasporto singolo

**Dialisi — range**: €5-€12 per singolo trasporto

**Range generale**: €20-€60 per servizio standard

**Note**: Le tariffe laziali sono tra le più problematiche da gestire: spesso ferme a delibere di anni precedenti, poi aggiornate retroattivamente. ARES 118 ha un sistema di tariffe separato per l'emergenza. Roma ha ASL con tariffe leggermente differenti tra loro (ASL Roma 1-6 applicano la stessa DGR regionale ma con contratti diversi). Attenzione: i tempi di pagamento lunghi (120-240 giorni) devono essere configurabili in SD come parametro di monitoraggio del credito.

---

### 11. Umbria

**Modello tariffario**: quota fissa + km

**Riferimento normativo**: DGR Regione Umbria (verificare su regione.umbria.it)

**Quota fissa**: €16,00-€22,00

**Quota/km**: €1,15-€1,40/km

**Maggiorazione notturna**: +20%

**Maggiorazione festiva**: +15%

**Dialisi — modello specifico**: quota fissa + km o mensile per paziente (da accordo con USL)

**Dialisi — range**: €5-€11 per singolo trasporto; €160-€230/mese per paziente (dove adottato)

**Range generale**: €20-€55 per servizio standard

**Note**: Tariffe in linea con la media nazionale. Perugia ha più volume (USL Umbria 1 copre il 65% della popolazione). Le Misericordie umbre spesso concordano il mensile per paziente dializzato analogamente alle cugine toscane.

---

### 12. Marche

**Modello tariffario**: quota fissa + km; in revisione per la transizione ASUR→AST

**Riferimento normativo**: DGR Regione Marche precedenti e nuove delibere AST 2023-2024 (verificare con singola AST per aggiornamenti post-riforma)

**Quota fissa**: €17,00-€23,00

**Quota/km**: €1,20-€1,45/km

**Maggiorazione notturna**: +20-25%

**Maggiorazione festiva**: +15%

**Dialisi — modello specifico**: quota fissa + km

**Dialisi — range**: €5-€11 per singolo trasporto

**Range generale**: €20-€60 per servizio standard

**Note**: La transizione ASUR→AST crea un periodo di instabilità normativa. Le AST stanno emettendo nuove delibere proprie: verificare con ogni AST separatamente. Ancona (AST Ancona) è la committenza principale per volume.

---

### 13. Campania

**Modello tariffario**: So.Re.Sa. fissa tariffe massimali regionali; applicazione misto quota fissa + km

**Riferimento normativo**: delibere So.Re.Sa. Campania (soresa.it) per i massimali. DGR Regione Campania per i criteri generali. Verificare le delibere più aggiornate

**Quota fissa** (per servizio, indicativo):
- Ambulanza tipo B: €15,00-€20,00
- Auto sanitaria: €10,00-€14,00

**Quota/km**: €1,00-€1,30/km (tariffe tra le più basse del Nord-Sud)

**Maggiorazione notturna** (22:00-06:00): +20-25%

**Maggiorazione festiva**: +15%

**Maggiorazione urgenza**: +20-25%

**Dialisi — modello specifico**: quota fissa + km; alcune ASL napoletane stanno sperimentando il mensile per paziente

**Dialisi — range**: €4-€10 per singolo trasporto; €140-€210/mese per paziente (dove sperimentato)

**Range generale**: €18-€50 per servizio standard

**Note**: Le tariffe campane sono mediamente inferiori del 15-25% rispetto al Nord. Il volume compensa i margini più bassi. So.Re.Sa. è il gatekeeper: le gare di importo superiore a €40.000 passano per So.Re.Sa. SD deve configurare un modulo di monitoraggio del credito per i clienti campani (rischio di ritardi di pagamento significativi).

---

### 14. Puglia

**Modello tariffario**: misto — quota fissa + km; aggiornamento DGR 2022

**Riferimento normativo**: DGR Regione Puglia 2022 (verificare numero esatto su regione.puglia.it). empulia.it pubblica i capitolati di gara con tariffe

**Quota fissa**: €17,00-€23,00

**Quota/km**: €1,15-€1,40/km

**Maggiorazione notturna**: +20-25%

**Maggiorazione festiva**: +15%

**Maggiorazione urgenza**: +20%

**Dialisi — modello specifico**: quota fissa + km per singolo trasporto

**Dialisi — range**: €4-€11 per singolo trasporto

**Range generale**: €20-€55 per servizio standard

**Note**: empulia.it pubblica i capitolati: SD deve verificare la compatibilità con i formati richiesti dalla piattaforma per le offerte in gara. Le ASL pugliesi tendono ad aggiornare i contratti con cadenza biennale.

---

### 15. Basilicata

**Modello tariffario**: quota fissa + km; accordi diretti ASP/ASM

**Riferimento normativo**: deliberazioni ASP Basilicata e ASM Matera; ARCAL per le gare centralizzate (quando attiva)

**Quota fissa**: €16,00-€21,00

**Quota/km**: €1,10-€1,35/km

**Maggiorazione notturna**: +20%

**Maggiorazione festiva**: +15%

**Dialisi — modello specifico**: quota fissa + km

**Dialisi — range**: €4-€10 per singolo trasporto

**Range generale**: €18-€50 per servizio standard

**Note**: Micro-mercato. Le distanze sono spesso significative per il territorio montuoso (alcune tratte dialisi superano i 40 km/viaggio). Questo aumenta il peso della quota km.

---

### 16. Calabria

**Modello tariffario**: quota fissa + km; tariffe tra le più basse d'Italia

**Riferimento normativo**: delibere ASP (non uniformi tra le 5 province); struttura commissariale. Verificare con ogni ASP

**Quota fissa**: €13,00-€18,00

**Quota/km**: €0,90-€1,20/km

**Maggiorazione notturna**: +20%

**Maggiorazione festiva**: +15%

**Dialisi — modello specifico**: quota fissa + km

**Dialisi — range**: €3-€9 per singolo trasporto

**Range generale**: €15-€40 per servizio standard

**Note**: Tariffe più basse d'Italia insieme alla Sicilia (alcune zone). Il territorio montuoso aumenta i km percorsi. Pagamenti molto lenti. SD deve configurare per i clienti calabresi un sistema di allerta quando il credito scaduto supera 90 giorni.

---

### 17. Molise

**Modello tariffario**: quota fissa + km; accordi diretti ASREM

**Riferimento normativo**: deliberazioni ASREM. Verificare direttamente con ASREM Campobasso

**Quota fissa**: €15,00-€20,00

**Quota/km**: €1,05-€1,30/km

**Maggiorazione notturna**: +20%

**Maggiorazione festiva**: +15%

**Dialisi — modello specifico**: quota fissa + km

**Dialisi — range**: €4-€10 per singolo trasporto

**Range generale**: €18-€45 per servizio standard

**Note**: Un solo interlocutore (ASREM). Qualunque configurazione SD per il Molise va concordata con ASREM.

---

### 18. Sicilia

**Modello tariffario**: quota fissa + km; DGR 2021 (aggiornamento tariffe)

**Riferimento normativo**: DGR Regione Siciliana 2021 (Assessorato della Salute — verificare numero delibera su regione.sicilia.it/salute). Le 9 ASP possono applicare con leggere variazioni locali

**Quota fissa**: €14,00-€20,00 (inferiore alla media nazionale)

**Quota/km**: €1,00-€1,30/km

**Maggiorazione notturna** (22:00-06:00): +20-25%

**Maggiorazione festiva**: +15%

**Maggiorazione urgenza**: +20%

**Dialisi — modello specifico**: quota fissa + km per singolo trasporto

**Dialisi — range**: €4-€11 per singolo trasporto

**Range generale**: €18-€50 per servizio standard

**Note**: Le 9 ASP hanno autonomia nell'applicazione: verificare con ogni ASP la delibera di recepimento della DGR 2021. Palermo e Catania hanno i volumi maggiori. Le isole minori (Pantelleria, Lampedusa, Eolie) hanno problematiche logistiche specifiche con tariffe speciali concordate direttamente.

---

### 19. Sardegna

**Modello tariffario**: misto — quota fissa + km; delibere ATS 2021-2022

**Riferimento normativo**: delibere ATS Sardegna 2021-2022 (verificare su ats.sardegna.it). AREUS per i servizi 118

**Quota fissa**: €16,00-€22,00

**Quota/km**: €1,15-€1,40/km

**Maggiorazione notturna**: +20-25%

**Maggiorazione festiva**: +15%

**Maggiorazione urgenza**: +20-25% (AREUS)

**Dialisi — modello specifico**: quota fissa + km per singolo trasporto; alcune ASSL stanno sperimentando il mensile per paziente

**Dialisi — range**: €5-€13 per singolo trasporto (le distanze sarde sono spesso superiori alla media)

**Range generale**: €20-€60 per servizio standard

**Note**: L'isolarità aumenta i km percorsi e il costo reale del servizio. Le zone interne (Nuoro, Ogliastra, Barbagia) hanno tratte lunghe con pochi pazienti → economia di scala bassa e tariffa reale per km superiore alla media. SardegnaCAT è la piattaforma di gara obbligatoria.

---

### 20. Abruzzo

**Modello tariffario**: misto — quota fissa + km

**Riferimento normativo**: DGR Regione Abruzzo (verificare su regione.abruzzo.it — la normativa abruzzese è aggiornata frequentemente)

**Quota fissa**: €17,00-€23,00

**Quota/km**: €1,20-€1,45/km

**Maggiorazione notturna** (22:00-06:00): +20-25%

**Maggiorazione festiva**: +15%

**Maggiorazione urgenza**: +20%

**Dialisi — modello specifico**: quota fissa + km per singolo trasporto

**Dialisi — range**: €5-€12 per singolo trasporto

**Range generale**: €20-€60 per servizio standard

**Note**: Le 4 ASL hanno autonomia nelle gare locali. La zona montagna (L'Aquila, Sulmona) ha distanze superiori alla media. ASL 3 Pescara ha il volume maggiore e le procedure più strutturate.

---

## Tabella Comparativa Nazionale

> Tutti i valori sono indicativi. Verificare DGR aggiornata con la ASL/ULSS/ASP di competenza prima di preventivare.

| Regione | Quota Fissa (€) | €/km | Magg. Notturna | Magg. Festiva | Modello Dialisi | Livello Tariffario |
|---------|----------------|------|---------------|--------------|-----------------|---------------------|
| Lombardia | 22-28 | 1,30-1,70 | +25-30% | +15-20% | Mensile/km (misto) | **Alto** |
| Piemonte | 18-25 | 1,20-1,50 | +20-25% | +15% | km o mensile | Medio-Alto |
| Liguria | 20-28 | 1,40-1,80 | +25-30% | +15-20% | km | **Alto** |
| Valle d'Aosta | n.d. (accordo) | n.d. | +20-30% | +15% | Accordo diretto | **Alto** |
| Veneto | 18-26 (per tipo) | 0,85-1,54 | +25% | +15% | **Mensile per paziente** | Medio-Alto |
| Friuli-VG | 16-22 | 1,15-1,40 | +20-25% | +15% | km | Medio |
| Trentino-AA | 22-30 | 1,45-1,70 | +25% | +20% | Mensile/accordo | **Alto** |
| Emilia-Romagna | 20-26 | 1,30-1,55 | +25% | +15% | Mensile/km (misto) | Medio-Alto |
| Toscana | 18-24 | 1,25-1,50 | +20-25% | +15% | Mensile/km (misto) | Medio |
| Lazio | 18-24 | 1,20-1,45 | +20-25% | +15% | km | Medio |
| Umbria | 16-22 | 1,15-1,40 | +20% | +15% | km o mensile | Medio |
| Marche | 17-23 | 1,20-1,45 | +20-25% | +15% | km | Medio |
| Campania | 15-20 | 1,00-1,30 | +20-25% | +15% | km | **Basso** |
| Puglia | 17-23 | 1,15-1,40 | +20-25% | +15% | km | Medio-Basso |
| Basilicata | 16-21 | 1,10-1,35 | +20% | +15% | km | Medio-Basso |
| Calabria | 13-18 | 0,90-1,20 | +20% | +15% | km | **Basso** |
| Molise | 15-20 | 1,05-1,30 | +20% | +15% | km | Basso |
| Sicilia | 14-20 | 1,00-1,30 | +20-25% | +15% | km | **Basso** |
| Sardegna | 16-22 | 1,15-1,40 | +20-25% | +15% | km o mensile | Medio |
| Abruzzo | 17-23 | 1,20-1,45 | +20-25% | +15% | km | Medio |

---

## Casi Particolari con Tariffe Dedicate

### UTIF — Unità di Terapia Intensiva Fetale / STEN — Servizio Trasporto Emergenza Neonatale

Il trasporto neonatale di emergenza è classificato a sé in tutti i tariffari regionali. Non esiste una tariffa standard nazionale: ogni regione definisce autonomamente la remunerazione. Le caratteristiche comuni:

- **Mezzo dedicato**: ambulanza tipo A con incubatrice da trasporto (Ohmeda, Draeger o equivalenti), monitor multiparametrico neonatale, pompe infusionali di precisione
- **Equipaggio dedicato**: autista + neonatologo (o pediatra d'urgenza) + infermiere di neonatologia. Il costo orario del medico specialista è la voce di costo principale
- **Tariffa media per trasferimento STEN**: €300-€800 per trasferimento (valore molto indicativo, altamente variabile per distanza e complessità)
- **Come SD gestisce STEN**: scheda missione con campi aggiuntivi obbligatori (peso neonato, settimane gestazionali, diagnosi di accesso, Apgar score se disponibile, STEN origine e destinazione). Tariffazione fuori dal modulo standard, campo "importo concordato" a inserimento manuale
- **Riferimento normativo**: DM 70/2015 (definisce le UTIN e i requisiti di trasferimento); delibere regionali specifiche per ogni rete STEN (Lombardia: AREU gestisce il STEN regionale; Lazio: ARES 118 gestisce STEN; Veneto: SUEM 118 coordina con ULSS)

### Trasporto Psichiatrico (TSO — Trattamento Sanitario Obbligatorio)

Il trasporto per TSO è regolato dalla Legge 833/1978 (art. 34-35) e dalle ordinanze del Sindaco. Ha caratteristiche operative molto specifiche:

- **Disposizione dell'autorità sanitaria e del Sindaco**: il TSO è un atto amministrativo; l'operatore trasporta su mandato, non su richiesta del paziente
- **Equipaggio**: autista + almeno un soccorritore/infermiere. In alcune regioni è richiesta la presenza del medico o dell'assistente sociale
- **Contenzione**: l'uso di mezzi di contenzione fisica è regolamentato (DM 05/02/1992 e successive linee guida regionali). L'operatore deve documentare qualsiasi misura di contenzione nel referto di trasporto
- **Tariffa**: solitamente fuori dal tariffario standard SSN. Il costo è a carico del Comune (che ha emesso l'ordinanza) o dell'ASL/DSM (Dipartimento Salute Mentale). Range: €80-€200 per trasporto TSO, variabile per regione e durata
- **Come SD gestisce TSO**: scheda missione con campo "TSO sì/no", riferimento ordinanza sindacale, orario di presa in carico, eventuale contenzione (sì/no + tipo), DSM di destinazione. Tariffazione separata con fatturazione verso soggetto istituzionale (Comune o ASL/DSM)

### Trasporto Bariatrico

Pazienti con peso superiore ai 150-180 kg richiedono mezzi e attrezzature speciali (barella bariatrica, sollevatore elettrico, ambulanza con portellone rinforzato). Nessun tariffario regionale standard prevede esplicitamente una voce "bariatrico" — la prassi è negoziare una maggiorazione del 20-50% rispetto alla tariffa standard con l'ASL o direttamente con il presidio ospedaliero.

### Trasporto Inter-Ospedaliero Critico (TIOC)

I trasferimenti di pazienti critici tra ospedali (es. politraumatizzato da DEA di I livello a DEA di II livello) rientrano nella sfera del 118 in emergenza ma in quella del trasporto programmato "urgente" per i trasferimenti programmati (es. paziente stabilizzato in UTI da ospedale spoke a hub). La tariffa TIOC è normalmente la più alta del tariffario, con mezzo tipo A e infermiere/medico obbligatorio:

- Range: €80-€200 per trasferimento, più quota km (dipende dalla distanza)
- In SD: scheda missione specifica con: diagnosi principale, Glasgow Coma Scale se neurologico, parametri vitali di partenza, accessi venosi/CVC/SNG/catetere, ventilazione meccanica sì/no, farmaci in infusione continua. Fondamentale per la continuità clinica e la tutela legale dell'operatore

---

## Note per il Dev Team di Soccorso Digitale

### Priorità di Implementazione nel Modulo Tariffario

1. **Implementare subito**: modello misto quota fissa + km (copre il 70% dei clienti italiani)
2. **Implementare subito**: modello mensile per paziente (indispensabile per clienti veneti e toscani)
3. **Implementare nella seconda fase**: gestione maggiorazioni configurabili per fascia oraria e giorno
4. **Implementare nella seconda fase**: integrazione con SINTEL (Lombardia), SATER/Intercent-ER (ER), empulia.it (Puglia), SardegnaCAT (Sardegna) per export dei dati di fatturazione
5. **Implementare nella terza fase**: modulo TSO con campi specifici, modulo STEN con campi neonatali, modulo TIOC con parametri vitali

### Calcolo Chilometrico

Raccomandazione tecnica: usare il **percorso reale stradale** (Google Maps Distance Matrix API o HERE Routing API), non la distanza aerea. Il percorso reale è quello applicato dai tariffari regionali e quello che gli operatori usano per rendicontare alle ASL. La differenza tra percorso reale e distanza aerea può essere del 30-60% in zone montane — usando la distanza aerea si sottostima sistematicamente il corrispettivo spettante all'operatore.

Configurazione raccomandata per il calcolo km:
- Partenza: sede operativa dell'organizzazione (o punto di presa in carico del paziente — configurabile)
- Percorso: sede → paziente → destinazione → ritorno sede (percorso completo)
- Alcune regioni ammettono il rimborso solo del percorso "a paziente a bordo" (sede → paziente NON conteggiato). Verificare con ogni regione e rendere configurabile in piattaforma

### Gestione degli Aggiornamenti Tariffari

Problema critico: i tariffari cambiano con delibere emesse in qualsiasi momento. SD deve:
1. Mantenere un registro interno degli ultimi riferimenti normativi per ogni regione (questo documento + tracciamento degli aggiornamenti)
2. Notificare il cliente (account manager SD) quando viene rilevato un potenziale aggiornamento tariffario nella propria regione
3. Permettere all'operatore di aggiornare la tariffa in piattaforma senza contattare il supporto SD (self-service con data di decorrenza)
4. Mantenere storico delle tariffe applicate per ogni periodo, fondamentale per le verifiche contabili e le contestazioni ASL
