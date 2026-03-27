# Site Redesign Priorities — soccorsodigitale.app
**Prospettiva:** APHRODITE (UX Lead) dirige ATHENA (Implementazione)
**Data:** 2026-03-28
**Fonte:** HTML `conicorn/index.html` (704 righe, Webflow export), analisi UX_SITE_AUDIT.md, CONVERSION_OPTIMIZATION.md
**Versione:** 1.0

---

> Questo documento è il piano d'azione operativo che deriva da UX_SITE_AUDIT.md e CONVERSION_OPTIMIZATION.md.
> Gli item sono ordinati per impatto su business / urgenza assoluta.
> ATHENA implementa. APHRODITE approva prima del deploy.

---

## CRITICI — Fix Prima di Qualsiasi Lancio Commerciale (questa settimana)

Questi cinque problemi rendono il sito inutilizzabile o attivamente dannoso come strumento di acquisizione clienti. Nessun'attività di marketing, SEO, advertising o outreach dovrebbe essere avviata finché tutti e cinque non sono risolti.

---

### CRIT-01 — CTA Primaria Punta a webflow.com/templates

**Problema specifico (riferimento linee HTML):**
`conicorn/index.html` — Tutti i bottoni "Richiedi una Demo" nella navbar sticky e nella hero section hanno `href="https://webflow.com/templates"`. Questo è il link di default del template Webflow Conicorn non sostituito.

Ogni visitatore che clicca la CTA principale — l'azione che il sito è costruito per generare — viene portato alla galleria template di Webflow. Non è un errore di analytics o di tracking. È una perdita immediata e totale del lead.

**Cosa cambiare esattamente:**
1. Identificare tutti i bottoni con testo "Richiedi una Demo" / "Richiedi Demo" nell'HTML
2. Sostituire `href="https://webflow.com/templates"` con l'URL di destinazione corretto:
   - **Opzione A (consigliata):** Link a un'istanza Calendly configurata per demo di 20 minuti — `https://calendly.com/[team]/demo-soccorso-digitale`
   - **Opzione B:** Link a una pagina `/demo` dedicata con form di prenotazione
   - **Opzione C (temporanea):** Anchor alla sezione form finale della pagina (`#contact-section`)
3. Verificare che il link sia aggiornato in tutte le occorrenze: navbar, hero, qualsiasi altra sezione
4. Verificare anche le CTA nelle card del pricing (stessa fonte di errore probabile)

**Perché è critico:**
Conversion rate attuale sulla CTA primaria = 0. Qualsiasi visitatore motivato che clicca esce dal sito. Non importa quanto sia buono il resto del sito — se la porta principale è murata, nessuno entra.

**Impatto stimato su conversion:** Da 0% a baseline del settore (0.8-2%). Letteralmente incalcolabile in termini relativi — è un incremento da zero a qualsiasi numero positivo.

**Effort stimato:** 30-60 minuti (HTML edit + test su tutti i viewport)

---

### CRIT-02 — Quattro Testimonial Fake da Template Webflow

**Problema specifico:**
`conicorn/index.html` — Section 007 (testimonials slider) contiene 7 testimonianze. Di queste, 4 sono i placeholder standard del template Webflow "Conicorn" mai sostituiti:

| Nome | Organizzazione (template) | Perché è fatale |
|------|--------------------------|-----------------|
| Sarah Mitchell | BrightPath SaaS | Azienda SaaS generica, non esiste nel volontariato italiano |
| Jonathan Reed | Nexora Digital Agency | Agenzia digitale, cliente impossibile per un gestionale di soccorso |
| Michael Tran | Skyline Realty | Immobiliare — nessuna correlazione con il settore |
| Laura Martinez | Elevate Commerce | E-commerce — settore incompatibile |

Il testo di queste testimonianze parla di "streamlining client onboarding", "improving team productivity in our agency", "managing property listings" — contenuto che non ha alcun senso nel contesto di un gestionale per organizzazioni di soccorso.

**Cosa cambiare esattamente:**
1. Rimuovere dall'HTML tutti i blocchi testimonial relativi ai 4 nomi sopra elencati
2. Se si hanno 3+ testimonianze reali: mantenere il slider con solo quelle reali
3. Se si hanno meno di 3 testimonianze reali verificabili: rimuovere interamente la sezione slider e sostituire con una delle seguenti alternative:
   - Sezione "Cosa dicono le organizzazioni che ci usano" con una singola quote molto curata e nome/ruolo/organizzazione reale
   - Sezione "I nostri clienti" con loghi di 5-8 organizzazioni reali (senza quote)
   - Sezione rimossa e spazio recuperato con dati aggregati anonimi ("In media le organizzazioni che usano SD..."

**Perché è critico:**
Un professionista del volontariato italiano che vede "BrightPath SaaS" tra i clienti di un gestionale per la Misericordia capisce in 2 secondi che il sito non è curato. La fiducia nel prodotto crolla prima ancora di leggere il prezzo. Questo è un trust killer irreversibile nella sessione.

**Impatto stimato su conversion:** +20-35% sulla fiducia generale; riduzione del bounce rate nella sezione testimonial stimata del 15-25%.

**Effort stimato:** 1-3 ore (rimozione HTML dei 4 blocchi + eventuale sostituzione con contenuto reale)

---

### CRIT-03 — Incongruenza Prezzo FAQ (€74) vs Pricing Section (€79)

**Problema specifico:**
`conicorn/index.html` — Section 010 (FAQ) contiene una domanda sulle opzioni di prezzo che cita il "Piano Base da €74/mese". La Section 008 (Pricing) mostra il piano base a **€79/mese**.

Differenza: €5/mese. Irrilevante economicamente. Devastante come segnale di affidabilità.

Un prospect che sta valutando se affidare la gestione dei turni e dei dati sensibili dei propri volontari a questa piattaforma e trova un'incongruenza di prezzo nella stessa pagina pensa immediatamente: "se non sanno nemmeno il loro prezzo, come possono gestire i miei dati?"

**Cosa cambiare esattamente:**
1. Aprire `conicorn/index.html`
2. Localizzare il blocco FAQ (Section 010) — la domanda relativa al prezzo
3. Verificare quale dei due valori è corretto consultando il team pricing
4. Aggiornare il valore sbagliato (presumibilmente il €74 in FAQ) al valore corretto e definitivo
5. Effettuare una ricerca full-text su tutto il codebase per "74" e "79" per verificare che non esistano altre occorrenze inconsistenti (file CSS, altri HTML, email template, documentazione)

**Perché è critico:**
Inconsistenza di prezzo nella stessa pagina = segnale di mancanza di attenzione al dettaglio. In un prodotto B2B che gestisce dati operativi critici, questo è un red flag professionale.

**Impatto stimato su conversion:** +5-10% sulla fiducia percepita; riduzione delle obiezioni pricing durante le demo.

**Effort stimato:** 15-30 minuti

---

### CRIT-04 — OG Image con Path Relativo (Social Sharing Rotto)

**Problema specifico:**
`conicorn/index.html`, riga 1 (head section):

```html
<meta content="images/69b2a43213e2ea5b45e38723_Open%20Graph.png" property="og:image">
```

Il percorso dell'immagine Open Graph è **relativo**, non assoluto. Quando qualcuno condivide il link `soccorsodigitale.app` su LinkedIn, WhatsApp, Telegram o qualsiasi altra piattaforma social, il crawler della piattaforma non riesce a risolvere l'immagine OG e il link viene condiviso **senza anteprima visuale**.

Per un prodotto B2B che si affida al passaparola tra coordinatori di volontariato (canale di acquisition primario in questo mercato), la condivisione senza preview riduce drasticamente il CTR sui link condivisi.

**Cosa cambiare esattamente:**
1. Sostituire il valore del meta tag `og:image` con l'URL assoluto completo:
   ```html
   <meta content="https://soccorsodigitale.app/images/69b2a43213e2ea5b45e38723_Open%20Graph.png" property="og:image">
   ```
2. Verificare anche i meta tag Twitter Card (`twitter:image`) per la stessa problematica
3. Assicurarsi che l'immagine OG rispetti le dimensioni raccomandate: 1200x630px
4. Testare con lo Sharing Debugger di Facebook (`developers.facebook.com/tools/debug/`) e con `cards-dev.twitter.com/validator`

**Perché è critico:**
Il volontariato italiano comunica principalmente via WhatsApp e Telegram tra i coordinatori. Se qualcuno condivide il link in un gruppo di coordinatori regionali e non appare l'anteprima, il CTR si riduce del 40-60% rispetto a un link con preview visuale.

**Impatto stimato su conversion:** +5-10% CTR da condivisioni social/messaging; impatto su reach organico.

**Effort stimato:** 30 minuti (edit HTML + test con debugger)

---

### CRIT-05 — `data-wf-domain` Punta a conicorn.webflow.io + Assenza Canonical URL

**Problema specifico:**
`conicorn/index.html`, riga 1:

```html
<html data-wf-domain="conicorn.webflow.io" ...>
```

L'attributo `data-wf-domain` è ancora impostato al dominio del template Webflow originale. Questo attributo viene letto da Webflow.js per gestire le interazioni del sito — se il dominio non corrisponde a quello di produzione (`soccorsodigitale.app`), alcune funzionalità Webflow (form, interazioni, CMS) possono comportarsi in modo imprevedibile o fallire silenziosamente.

Contestualmente, l'head non contiene un tag canonical:

```html
<!-- ASSENTE: <link rel="canonical" href="https://soccorsodigitale.app/"> -->
```

**Cosa cambiare esattamente:**
1. Aggiornare `data-wf-domain="conicorn.webflow.io"` a `data-wf-domain="soccorsodigitale.app"`
2. Aggiornare contestualmente `data-wf-site` e `data-wf-page` se necessario (verificare con il pannello Webflow)
3. Aggiungere nel `<head>`:
   ```html
   <link rel="canonical" href="https://soccorsodigitale.app/">
   ```
4. Rimuovere o aggiornare anche eventuali riferimenti al dominio `conicorn.webflow.io` nel footer o in altri link interni

**Perché è critico:**
Il `data-wf-domain` errato può causare malfunzionamenti silenti nelle interazioni Webflow (il form finale potrebbe non submitarsi correttamente). Il canonical URL mancante causa frammentazione del PageRank se il sito è raggiungibile da più URL (con/senza www, Webflow subdomain, dominio produzione).

**Impatto stimato su conversion:** Tecnico/SEO primario. Previene perdita di lead da form non funzionanti. +3-8% SEO organic traffic nel lungo termine.

**Effort stimato:** 30-45 minuti (HTML edit + verifica Webflow dashboard)

---

## HIGH — Entro 30 Giorni

---

### HIGH-01 — Navigazione Desktop: Rimuovere Hamburger-Only

**Problema:** La navbar mostra hamburger su tutti i viewport incluso 1440px desktop. 10 link di navigazione sono invisibili finché l'utente non apre il menu.

**Cosa cambiare esattamente:**
1. In Webflow Designer (o via CSS override): configurare la navbar per mostrare i link orizzontalmente su viewport >1024px
2. Selezionare i 5-6 anchor link più strategici da mostrare sempre visibili desktop: Funzionalità, Come Funziona, Prezzi, FAQ, Chi Siamo
3. Spostare i restanti 4-5 link in un dropdown "Altro" o nel footer
4. Mantenere hamburger su viewport <768px (mobile — corretto)
5. Verificare che il click su ogni anchor link funzioni correttamente e che lo scroll sia smooth

**Perché è high priority:**
Ogni visitatore desktop (probabilmente 40-60% del traffico per un prodotto B2B) non vede la struttura del sito. La navigabilità percepita è quella di un sito a pagina singola senza logica. I prospect B2B si aspettano una navbar funzionale.

**Impatto stimato su conversion:** +10-15% scopribilità sezioni strategiche; +5-8% engagement general.

**Effort:** 3-6 ore (Webflow CSS + test su viewport multipli)

---

### HIGH-02 — Pricing: Badge "Più Popolare" + Anchoring Visivo

**Problema:** Il piano centrale (€149/mese) non è evidenziato rispetto agli altri due. Senza guida visiva, i visitatori tendono a scegliere il piano più economico o ad abbandonare senza scegliere.

**Cosa cambiare esattamente:**
1. Aggiungere al piano centrale (€149/mese) un badge visivo: "Più Popolare" o "Raccomandato"
2. Stilizzare il piano centrale con:
   - Border: 2px solid #5EB0BB (teal light)
   - Background leggermente più scuro o con sfumatura
   - Dimensione leggermente maggiore delle card laterali (effetto elevazione)
3. Assicurarsi che la CTA del piano centrale sia più prominente delle altre
4. Aggiungere sotto ogni piano una riga di trust micro-copy (es. "Cancellazione gratuita in qualsiasi momento")

**Perché è high priority:**
Il badge "Più Popolare" è il più documentato pattern di anchoring nel pricing SaaS. Studi HubSpot, ChartMogul e Reforge concordano su un incremento del 25-35% nelle conversioni sul piano medio con questa sola modifica.

**Impatto stimato su conversion:** +25-35% su conversioni piano Pro (€149); impatto positivo su revenue medio per cliente.

**Effort:** 2-4 ore

---

### HIGH-03 — Hero: Aggiungere Screenshot Prodotto

**Problema:** La hero attuale ha solo video background generico. Il visitatore non vede il prodotto above the fold.

**Cosa cambiare esattamente:**
1. Selezionare 1-2 screenshot reali del prodotto che mostrano:
   - Dashboard principale con turni/missioni
   - Vista calendario volontari
2. Ottimizzare le immagini: formato WebP, max 200KB
3. Modificare il layout hero da full-width video a due colonne:
   - Sinistra (55%): testo (chip, H1, subtext, CTAs, trust strip)
   - Destra (45%): screenshot prodotto con effetto mockup (bordo sottile, leggero shadow)
4. Su mobile: colonna singola, screenshot sotto le CTA o rimosso (per non appesantire)
5. Rimuovere o ridimensionare il video hero (o usarlo come background solo su desktop)

**Perché è high priority:**
"Show don't tell" è il principio fondamentale della landing page SaaS. Ogni benchmark (Linear, Notion, Airtable, Monday.com) mostra il prodotto nella hero. Un visitatore che vede l'interfaccia above the fold ha una comprensione immediata del valore — senza dover scrollare fino alla Section 003.

**Impatto stimato su conversion:** +15-25% scroll depth; +10-20% time on page.

**Effort:** 3-5 giorni (include scelta screenshot, ottimizzazione, redesign hero)

---

### HIGH-04 — Testimonial: Sostituzione con Contenuto Reale

**Problema:** Dopo la rimozione dei 4 fake (CRIT-02), la sezione testimonial ha 3 voci o meno. La sezione deve essere ricostruita con prove sociali reali e verificabili.

**Cosa cambiare esattamente:**
1. Raccogliere da clienti reali: nome, ruolo, organizzazione, foto o logo, quote (minimo 30 parole), con autorizzazione scritta all'utilizzo
2. Per ogni testimonial, aggiungere un dato quantitativo specifico ("Abbiamo ridotto i tempi di pianificazione del turni del 60%")
3. Redesignare il componente testimonial per includere:
   - Foto o avatar (reale, non stock)
   - Nome + ruolo + organizzazione + città
   - Quote in grassetto (la parte più forte)
   - Eventuale logo organizzazione
4. Se non si dispone di 3+ testimonial verificati: sostituire l'intera sezione con una singola case study in formato narrativo breve (300 parole, nome cliente reale con autorizzazione)

**Perché è high priority:**
La sezione testimonial è il momento di massima verificabilità del claims del sito. Dopo CRIT-02 (rimozione fake), il vuoto deve essere colmato con contenuto reale per non lasciare un buco visivo nella pagina.

**Impatto stimato su conversion:** +20-35% fiducia generale; effetto composto con tutti gli altri trust signal.

**Effort:** 3-7 giorni (dipende dalla disponibilità dei clienti per le quote)

---

### HIGH-05 — Performance: Font WOFF2 + Ottimizzazione Asset Mobile

**Problema:** Font Geist caricato come `.ttf` (~90KB), video hero 1.5MB. Su mobile (3G/4G lento), il sito può impiegare 8-12 secondi al caricamento completo.

**Cosa cambiare esattamente:**
1. **Font:** Convertire Geist da .ttf a .woff2 usando tool come `font-converter.net` o `cloudconvert.com`. Aggiornare la reference nel CSS. Aggiungere `font-display: swap` per evitare FOIT (Flash of Invisible Text).
2. **Hero video:** Aggiungere attributo `loading="lazy"` se supportato, oppure implementare intersection observer per caricare il video solo quando visibile. Alternativa: versione compressa del video a 400-500KB per mobile (media query).
3. **Immagini Cap1-Cap5 (Section 003):** Convertire in WebP con qualità 80. Aggiungere attributi `width` e `height` per ridurre CLS.
4. **30 loghi integrations:** Usare sprite sheet o lazy loading per il grid di loghi
5. **CSS 131KB:** Valutare purge delle classi Webflow non utilizzate con PurgeCSS (riduzione stimata 30-50%)

**Perché è high priority:**
LCP >4 secondi su mobile è classificato "Poor" da Google Core Web Vitals e influenza il ranking organico. Il target demografico (coordinatori di volontariato) opera frequentemente da mobile in contesti con connessione non ottimale.

**Impatto stimato su conversion:** +15-25% conversione mobile; +8-12% organic traffic SEO nel medio termine.

**Effort:** 1-2 giorni (conversione asset + test performance con Lighthouse)

---

## MEDIUM — Backlog (60-90 Giorni)

---

### MED-01 — Semplificare Section 006: Da 40+ Pills a Feature Grid Strutturato

**Problema:** La sezione "feature grid" presenta 40+ badge/pill di funzionalità in una lista scrolling. Non c'è gerarchia, grouping per categoria, o indicazione di quali siano le 5 funzionalità core vs quelle accessorie.

**Cosa cambiare:**
1. Raggruppare le funzionalità in 5-6 categorie (es. Gestione Volontari, Missioni, Documenti, Reporting, Integrazioni)
2. Selezionare le 12-15 funzionalità più strategiche (quelle che differenziano SD dalla concorrenza)
3. Visualizzare con icona + titolo + descrizione breve (1 riga) per ciascuna
4. Aggiungere una CTA alla fine della sezione

**Impatto:** +15% leggibilità sezione; riduzione cognitive overload; maggior comprensione del prodotto.

**Effort:** 2-3 giorni (content strategy + implementazione)

---

### MED-02 — Aggiungere Sticky CTA Bar

**Problema:** Non esiste nessun elemento fisso che ricordi all'utente l'azione principale mentre scorre le 15+ sezioni della pagina.

**Cosa cambiare:**
1. Implementare una barra sticky che appare dopo il 30% di scroll (JavaScript scroll listener)
2. Desktop: barra full-width con testo breve + CTA button
3. Mobile: floating action button angolo inferiore destro
4. Contenuto: "Richiedi una Demo Gratuita" + eventuale social proof mini ("47 organizzazioni già attive")
5. Includere X per chiuderla (rispetto UX)

**Impatto:** +8-12% lead capture totale.

**Effort:** 4-8 ore

---

### MED-03 — Sezione FAQ: Aggiornamento Contenuto + Aggiunta Obiezioni Chiave

**Problema:** Le 5 FAQ attuali non coprono le obiezioni più frequenti nel ciclo di vendita B2B verticale per questo settore. Mancano: domande su GDPR/sicurezza dati, integrazione con sistemi esistenti, costo di migrazione/onboarding, SLA uptime.

**Cosa cambiare:**
1. Condurre una review delle obiezioni più frequenti nelle demo attuali (chiedere al sales team)
2. Sostituire/integrare le 5 FAQ con 8-10 domande che coprono:
   - "I miei dati sono sicuri? Siete GDPR compliant?"
   - "Possiamo importare i dati dai nostri fogli Excel?"
   - "Quanto tempo richiede il setup iniziale?"
   - "Cosa succede se cancello l'abbonamento?"
   - "Avete un SLA di uptime garantito?"
3. Assicurarsi che il prezzo citato nelle FAQ sia allineato con la sezione pricing (fix già incluso in CRIT-03)

**Impatto:** +10-15% riduzione obiezioni in fase demo; +5-8% conversion rate post-demo.

**Effort:** 1-2 giorni (content + implementazione)

---

### MED-04 — Aggiungere Sezione "Piano Enterprise / Grandi Organizzazioni"

**Problema:** Il piano massimo è €299/mese. Per organizzazioni come Croce Rossa regionale o Misericordie con 500+ volontari, questo piano potrebbe essere sia percepito come insufficiente (funzionalità) che come un segnale che il prodotto non scala. Manca un percorso enterprise.

**Cosa cambiare:**
1. Aggiungere una quarta opzione pricing: "Enterprise — Contattaci"
2. Lista 3-5 benefici enterprise: SLA dedicato, onboarding personalizzato, integrazione custom, account manager dedicato
3. CTA: "Parla con il nostro team" → form dedicato o Calendly slot enterprise
4. Eventualmente aggiungere una sezione separata "Per le Grandi Organizzazioni" tra case studies e pricing

**Impatto:** Apre canale enterprise con deal size 3-10x; elimina il segnale di "prodotto piccolo" per org grandi.

**Effort:** 2-4 giorni (design + dev + content)

---

### MED-05 — Exit Intent Popup con Lead Magnet

**Problema:** Non esiste nessun meccanismo di recupero per i visitatori che stanno per abbandonare il sito senza convertire. Stimato: 85%+ dei visitatori abbandona senza lasciare contatti.

**Cosa cambiare:**
1. Creare un lead magnet ad alto valore per il target: "Guida alla digitalizzazione del volontariato italiano — Come ridurre la burocrazia del 70%" (PDF, 8-12 pagine)
2. Implementare exit intent detection: on desktop, rilevamento cursore verso barra URL; su mobile, scroll inverso rapido
3. Popup con: titolo dell'offerta + campo email + campo "Nome organizzazione" + button "Scarica gratis"
4. Sequenza email automatizzata post-download: 3 email in 7 giorni (day 1: PDF, day 3: case study, day 7: invito demo)
5. Tool consigliati: Hotjar Surveys, Wisepops, o implementazione custom con Intersection Observer API

**Impatto:** +3-5% lead capture da visitatori che altrimenti si perdono; lead nurturing via email.

**Effort:** 1-2 settimane (include creazione contenuto PDF + setup automation)

---

## Note di Governance per ATHENA

**Prima di ogni deploy di modifica:**
1. Test su tre viewport: 375px (mobile), 768px (tablet), 1440px (desktop)
2. Test su browser: Chrome, Firefox, Safari (iOS per mobile)
3. Verifica con Lighthouse per non peggiorare i Performance/Accessibility score
4. APHRODITE approva il design prima del deploy in produzione
5. Per modifiche alle CTA: verifica manuale che ogni link funzioni e raggiunga la destinazione corretta

**Ordine di deploy raccomandato:**
```
Settimana 1: CRIT-01 → CRIT-02 → CRIT-03 → CRIT-04 → CRIT-05
Settimane 2-4: HIGH-01 → HIGH-02 → HIGH-03
Mese 2: HIGH-04 → HIGH-05
Mese 3: MED-01 → MED-02 → MED-03 → MED-04 → MED-05
```

**Metriche da monitorare (setup prima del deploy CRIT-01):**
- Google Analytics 4: conversion rate, scroll depth, CTA click rate
- Hotjar (o equivalente): heatmap hero e pricing section, session recording
- Search Console: CTR organico, impression per keyword target
- Calendly analytics: demo booked, show rate

---

*Documento prodotto da APHRODITE — UX Lead*
*Implementazione: ATHENA*
*Revisione raccomandata: post-completamento fase CRITICI (settimana 2)*
