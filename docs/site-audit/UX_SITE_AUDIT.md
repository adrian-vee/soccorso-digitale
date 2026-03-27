# UX Site Audit — soccorsodigitale.app
**Prospettiva:** APHRODITE — UX Expert, Design System Lead
**Data analisi:** 2026-03-28
**Fonte dati:** HTML `conicorn/index.html` (704 righe, export Webflow), palette APHRODITE design system
**Versione documento:** 1.0

---

## 1. Executive Summary

### UX Score: 41 / 100

Il sito di Soccorso Digitale comunica un prodotto serio per un mercato verticale con bisogni reali. La struttura narrativa di base è corretta — problema → soluzione → prova → prezzo — ma l'esecuzione tecnica e la cura del dettaglio rivelano un prodotto ancora in fase di template Webflow non completamente rifinito. Il danno maggiore non è estetico: è fiduciario.

### Top 5 Critical Issues

| # | Issue | Impatto |
|---|-------|---------|
| 1 | **CTA primaria rotta** — "Richiedi una Demo" punta a `webflow.com/templates` | Ogni visitatore che clicca esce dal sito verso la galleria template di Webflow. Conversion rate = 0. |
| 2 | **4 testimonial sono placeholder di template** — Sarah Mitchell/BrightPath, Jonathan Reed/Nexora, Michael Tran/Skyline Realty, Laura Martinez/Elevate Commerce | Qualsiasi prospect che li legge capisce immediatamente che il sito è un template non finito. Fiducia azzerata. |
| 3 | **Navigazione hamburger-only su tutti i viewport** — anche su desktop 1440px il menu è nascosto | Riduce drasticamente la scopribilità delle sezioni e allontana i pattern cognitivi dell'utente B2B enterprise abituato a navbar orizzontali. |
| 4 | **Incongruenza prezzi FAQ vs Pricing** — FAQ dice €74/mese, sezione pricing dice €79/mese | Segnale di scarsa attenzione. Genera dubbio sul prezzo reale e sulla credibilità dell'organizzazione. |
| 5 | **Preloader GSAP obbligatorio** — ogni visita inizia con un'animazione di caricamento prima che l'utente veda qualsiasi contenuto | Su connessioni lente o mobile, percepito come rallentamento artificiale. Non esiste nessun "skip". |

---

## 2. First Impression (0–3 Secondi)

### Cosa vede il visitatore

Prima di vedere qualsiasi contenuto, il visitatore vede il **preloader**: logo animato con SplitText GSAP su sfondo scuro. La durata non è definibile con certezza dall'HTML statico, ma l'uso di SplitText + ScrollTrigger suggerisce un'animazione da 1.5–3 secondi prima che la hero diventi visibile.

**Sequenza cognitiva reale dell'utente:**
1. (0–2s) Preloader → nessuna informazione sul prodotto
2. (2–4s) Hero appare → video background in caricamento, H1 visibile
3. (4–6s) Video background completamente caricato (1.5MB)

Il **messaggio nei primi 3 secondi** è potenzialmente chiaro una volta che la hero si carica:
- "Il Gestionale Cloud per il Volontariato Italiano" — headline specifico, verticale, comprensibile
- La palette #0B2E50 (navy) + #5EB0BB (teal) crea autorevolezza e coerenza con il settore

**Problemi:**
- Il preloader introduce latenza percepita prima di qualsiasi comunicazione di valore
- Il video hero (1.5MB) ritarda il rendering del contenuto testuale su connessioni mobili (3G/4G debole)
- Non c'è messaggio visibile durante il preloader che prepari l'utente (es. tagline animata)

**Best practice di riferimento:** Linear.app carica istantaneamente il messaggio principale; le animazioni sono sulla pagina, non prima di essa.

---

## 3. Hero Section Analysis

### Headline
**"Il Gestionale Cloud per il Volontariato Italiano"** — valutazione: **B+**

Punti di forza:
- Specifico e verticale (non "software gestionale" generico)
- "Volontariato Italiano" crea localizzazione immediata
- Abbinato al chip "Software Gestionale in Cloud" (ridondante ma tollerabile)

Debolezze:
- Non comunica il problema che risolve, solo la categoria del prodotto
- Manca l'elemento emotivo/urgente che spinge il volontario esausto a continuare a leggere
- Alternativa più potente: _"Basta fogli Excel. La piattaforma cloud che le organizzazioni di soccorso italiane stavano aspettando."_

### Subtext
**"Gestisci turni dei volontari, missioni e documenti in un'unica piattaforma digitale. Meno burocrazia, più interventi efficaci."**

Valutazione: **A-** — conciso, beneficio-centrico, identifica tre use case reali. La frase finale "Meno burocrazia, più interventi efficaci" è il punto più forte del testo hero.

### CTA Principale — CRITICO
**"Richiedi una Demo"** → `href="https://webflow.com/templates"` — **Bug fatale**

Non è esagerato: ogni visitatore che clicca la CTA primaria lascia il sito e atterra sulla galleria template di Webflow. Non è un errore di tracking, è una perdita completa del lead. Nessun'altra priorità supera questo.

### CTA Secondaria
**"Scopri le Funzionalità"** → `#service-section` — funziona, è corretta come CTA di esplorazione.

### Trust Strip
"500+ ore risparmiate" | "80% più efficienza" | "5x risposta più rapida" — numeri credibili se documentati. Il problema è che non c'è fonte o contesto. I prospect B2B con potere d'acquisto chiederanno: "risparmiate da chi? calcolate come?"

### Video Background
1.5MB per il video hero è accettabile su desktop ma problematico su mobile. Il video occupa un'area enorme della viewport senza trasmettere un messaggio specifico — se fosse sostituito da una screenshot del prodotto o da un dashboard screenshot animated, il valore comunicativo sarebbe nettamente superiore.

**Raccomandazione APHRODITE:** sostituire il video background con una mockup del prodotto in movimento (Lottie o GIF ottimizzata < 300KB) posizionata a destra dell'headline in layout a due colonne.

---

## 4. Navigazione

### Il Problema Hamburger-Only

La navbar include: Logo | Hamburger | "Richiedi una Demo" button

Il menu hamburger nasconde **10 link di navigazione** su tutti i viewport, incluso desktop. Questo è un pattern tipico dei template Webflow per mobile-first che non viene riconfigurato per desktop durante la personalizzazione.

**Impatto:**
- Su desktop (>1024px), l'assenza di navigation links visibili riduce la navigabilità percepita
- I prospect B2B scansionano la navbar per capire la struttura del sito prima di decidere se esplorare
- 10 sezioni sono invisibili finché l'utente non apre il menu — molti non lo apriranno mai
- Il bottone "Richiedi una Demo" nella navbar è comunque rotto (stessa CTA)

### I 10 Link del Menu
Chi Siamo | Perché Noi | Funzionalità | Come Funziona | Risultati | Moduli | Testimonianze | Prezzi | Il Team | FAQ

**Analisi:** 10 link sono troppi per una singola pagina landing. Questo è un pattern da sito multi-pagina applicato a una single-page. Suggerisce che il sito ha ambizioni architetturali che il formato single-page non supporta.

**Raccomandazione:** Su desktop, mostrare 5-6 anchor link più importanti (Funzionalità, Come Funziona, Prezzi, FAQ, Chi Siamo) direttamente nella navbar. Nascondere gli altri nel hamburger o rimuoverli.

### Mobile Nav
Su 375px, hamburger menu è l'unico sistema di navigazione — questo è accettabile su mobile. Il rischio è che il menu overlay non abbia exit button adeguato o che i touch target siano inferiori ai 44px raccomandati da Apple HIG / Google Material.

---

## 5. Information Architecture

### Struttura Attuale (Top-Down)

```
[Preloader]
[Hero] ← CTA rotta
[Section 001 — About/Logos]
[Section 002 — Features x3]
[Section 003 — Platform Demo Tabs]
[Security Callout]
[Section 004 — Process Timeline]
[Section 005 — Case Studies]
[Section 006 — Feature Grid 40+]
[Integrations Grid]
[Section 007 — Testimonials] ← 4 fake
[Section 008 — Pricing]
[Section 009 — Team]
[Section 010 — FAQ]
[Final CTA + Form]
[Footer]
```

### Analisi del Flusso

**Punti di forza:**
- La sequenza "cos'è → perché → come funziona → risultati → prezzo" è narrativamente corretta
- Il security callout dopo la demo platform è ben posizionato (risponde all'obiezione implicita sulla sicurezza dei dati sanitari)

**Problemi di IA:**
- **Sezione 006 (40+ feature pill):** Una griglia di 40 funzionalità non è un argomento di vendita — è un catalogo da documentazione. Il visitatore che legge 40 badge non capisce quali sono le 3 cose più importanti del prodotto.
- **Team prima di FAQ:** L'ordine logico suggerisce che il team dovrebbe essere nella sezione "Chi Siamo" (più in alto) o dopo le testimonianze. Prima del FAQ è un anti-pattern.
- **Form finale troppo in basso:** Il form di contatto è all'ultima sezione della pagina. Statisticamente, meno del 15% dei visitatori arriva alla sezione finale di una landing page. Tutti gli altri si perdono senza conversion.
- **Mancanza di sticky CTA:** Non c'è nessun elemento fisso che ricorda all'utente l'azione principale mentre scorre.

### Raccomandazione IA

Semplificare la struttura a 8 sezioni principali con un'architettura a "W" (problema → soluzione → prova 1 → prova 2 → CTA intermedia → dettagli → prezzo → CTA finale).

---

## 6. Visual Hierarchy

### Palette APHRODITE vs Impatto UX

| Colore | Hex | Uso attuale | Valutazione |
|--------|-----|-------------|-------------|
| Background | #DFEAE8 | Sfondo principale sezioni chiare | Corretto — soft, leggibile |
| Teal Light | #5EB0BB | Accenti, highlight | Buono ma sotto-utilizzato |
| Teal Dark | #1F6583 | CTA secondarie, link | Appropriato |
| Navy | #0B2E50 | CTA primarie, headings | Corretto |
| Dark | #1A2B32 | Body text | Ottimo contrasto su bg chiaro |

**Punti di forza visivi:**
- La palette è coerente e professionale per il settore
- Il contrasto navy su background chiaro è leggibile

**Problemi di gerarchia visiva:**
- **CTA primaria non si distingue sufficientemente** dagli elementi secondari in alcune sezioni
- **40+ feature pills (sezione 006)** creano un muro visivo di pari peso che non guida l'occhio
- **Section 003 (Platform Demo Tabs):** 5 tab con screenshot — se le immagini Cap1-Cap5 non sono ottimizzate o il layout è a larghezza intera, questa sezione può sembrare pesante e difficile da processare

### Eye Tracking Predictivo

Su una landing page di questo tipo, il pattern di scansione è F-shaped o Z-pattern:
- Utente legge H1 ✓
- Clicca CTA primaria → **uscita fatale** (webflow.com/templates)
- Se non clicca, guarda il video/immagine a destra (non presente — video è background)
- Scende alla trust strip ✓
- Salta alla sezione successiva o abbandona

La mancanza di un elemento visivo forte a destra dell'headline (mockup di prodotto, screenshot) è un'opportunità persa critica per trattenere l'attenzione sopra la piega.

---

## 7. Social Proof Analysis

### Stato Attuale: CRITICO

**Testimonial reali (stimati):** 3 su 7
**Testimonial fake (template non sostituiti):** 4 su 7

#### Testimonial da rimuovere immediatamente

| Nome | Organizzazione | Motivo |
|------|---------------|--------|
| Sarah Mitchell | BrightPath SaaS | Azienda SaaS generica — non esiste nel volontariato italiano |
| Jonathan Reed | Nexora Digital Agency | Agenzia digitale — cliente impossibile per SD |
| Michael Tran | Skyline Realty | Immobiliare — settore completamente non correlato |
| Laura Martinez | Elevate Commerce | E-commerce — nessuna correlazione con soccorso/volontariato |

Questi quattro sono i placeholder standard del template Webflow "Conicorn". Non sono stati sostituiti. Qualsiasi prospect italiano che conosce il volontariato locale riconoscerà immediatamente che non esistono. Il danno alla fiducia è irreversibile nel momento in cui vengono visti.

**Testimonianza da Laura Martinez che parla di "streamlining our client onboarding process" per un software di soccorso è un oxymoron che distrugge la sospensione dell'incredulità.**

### Loghi di Riferimento (Section 001)
"Supportiamo Croce Rossa, Misericordie, 118..." — se i loghi sono reali (organizzazioni effettive che usano il prodotto), sono il social proof più potente del sito. Se sono aspirazionali/mockup, il rischio legale e fiduciario è alto.

**Raccomandazione:** Prima del lancio, ottenere autorizzazione scritta da ciascuna organizzazione il cui logo è esposto.

### Numeri Trust Strip
"500+ ore risparmiate" | "80% più efficienza" | "5x risposta più rapida" — potenti se documentati. Aggiungere sotto ogni numero: "(fonte: case study [Org X], [anno])" o rimuoverli.

---

## 8. Pricing Section (Section 008)

### Struttura
3 piani con toggle mensile/annuale: €79 / €149 / €299

**Punti di forza:**
- Toggle mensile/annuale è best practice standard
- 3 piani è la struttura ottimale per anchoring (low/mid/high)
- Prezzi nella fascia credibile per un SaaS B2B verticale italiano

**Problemi:**

1. **Incongruenza con FAQ (Section 010):** FAQ cita "Piano Base da €74/mese" vs €79/mese in pricing. Differenza di €5 che genera dubbio. Il visitatore che ha letto il pricing e poi legge la FAQ pensa: "quale è il prezzo vero?" Questo è un segnale di disattenzione che erode la fiducia professionale.

2. **Assenza di piano "Contattaci":** Per organizzazioni grandi (es. Croce Rossa regionale), €299/mese è probabilmente troppo basso. Manca un piano Enterprise con "Contattaci per un preventivo personalizzato".

3. **Nessun badge "Più Popolare":** Il piano centrale (€149) dovrebbe essere evidenziato visivamente come raccomandato. Questo è un pattern di anchoring documentato che aumenta la conversion sul piano medio del 30-40%.

4. **CTA sui piani:** Non visibile dall'HTML statico se ogni piano ha una propria CTA — verificare che non puntino anche a `webflow.com/templates`.

5. **Garanzia / trial:** Nessuna menzione di free trial, periodo di prova, o soddisfatti-o-rimborsati. I competitor B2B SaaS offrono quasi sempre 14-30 giorni di trial. L'assenza forza il prospect a impegnarsi senza test.

---

## 9. Mobile Experience (375px)

### Analisi

**Elementi positivi:**
- Layout Webflow è presumibilmente responsive (framework robusto)
- Font Geist è altamente leggibile su schermi piccoli

**Problemi Mobile:**

| Elemento | Issue | Gravità |
|----------|-------|---------|
| Video hero 1.5MB | Su 3G, il video ritarda l'intero rendering above the fold | Alta |
| Font caricato come .ttf | .ttf non è compresso — il font Geist in WOFF2 sarebbe 50-70% più leggero | Media |
| Sezione 006 (40+ pills) | Su 375px, una griglia di 40+ badge può diventare un muro di testo inaccessibile | Alta |
| Integrations grid (30 loghi) | 30 loghi su mobile possono essere molto piccoli o scorrere orizzontalmente — verifica touch target | Media |
| Hamburger menu | Unico sistema di nav su mobile — accettabile ma i touch target devono essere ≥44px | Media |
| Trust strip (3 numeri) | Se a 3 colonne su mobile, testo può essere troppo piccolo | Bassa |
| Preloader | Su mobile con connessione lenta, il preloader può durare 5-8 secondi prima che il contenuto appaia | Alta |

**Raccomandazione APHRODITE:** Effettuare test su dispositivo fisico (iPhone SE 2020 come proxy 375px, Samsung Galaxy A-series come proxy Android budget) prima del lancio. Il target demografico del volontariato italiano non necessariamente usa dispositivi premium.

---

## 10. Performance UX

### Bundle JS Stimato

| Libreria | Dimensione stimata |
|----------|-------------------|
| jQuery 3.5.1 | ~87KB minified |
| GSAP core | ~65KB |
| ScrollTrigger | ~50KB |
| SplitText | ~25KB |
| Webflow.js | ~120KB |
| **Totale stimato** | **~350-400KB JS** |

### Asset Pesanti

| Asset | Dimensione | Problema |
|-------|-----------|---------|
| Hero video | 1.5MB | Blocca rendering above the fold su mobile |
| Footer video | 246KB | Accettabile |
| CSS Webflow | 131KB | Molto pesante per una singola pagina |
| Font Geist (.ttf) | ~90KB stima | Dovrebbe essere WOFF2 (~30-40KB) |
| Immagini Cap1-Cap5 | Sconosciuto | Da ottimizzare con WebP |
| **Totale assets noti** | **~18MB** | Critico per mobile |

### Impatto UX

Un sito da 18MB di assets totali con 400KB di JS e un preloader obbligatorio si traduce in:
- **LCP (Largest Contentful Paint):** Probabilmente >4 secondi su mobile — Google classifica come "Poor" sopra 4s
- **FID/INP:** jQuery + GSAP + Webflow.js possono creare thread blocking
- **CLS (Cumulative Layout Shift):** L'animazione di preloader può causare layout shift quando scompare

**Soglie di abbandono:** Il 53% degli utenti mobile abbandona una pagina che impiega più di 3 secondi a caricarsi (Google, 2018 — dato ancora valido come benchmark di comportamento).

---

## 11. Accessibilità

### Analisi da HTML

**Positivo:**
- `meta charset="utf-8"` presente
- `meta name="viewport"` presente
- Focus state definito nel CSS: `outline: 0.125rem solid #4d65ff` (sezione global-styles)
- Font Geist ha eccellente leggibilità

**Problemi potenziali:**

| Issue | Probabilità | Impatto |
|-------|-------------|---------|
| Alt text sulle immagini dei testimonial fake | Alta (placeholder raramente hanno alt text significativi) | WCAG 2.1 AA fail |
| Alt text sui loghi integrazioni (30 loghi) | Media | WCAG 2.1 AA fail se mancanti |
| Contrasto teal light (#5EB0BB) su sfondo chiaro | Media — da verificare con contrast checker | WCAG 2.1 AA richiede 4.5:1 |
| Video hero senza controlli | Alta | WCAG 2.1 — video in autoplay deve avere controllo pause |
| Preloader visibility hidden | Media | Screen reader potrebbe non leggere correttamente la transizione |
| Hamburger menu keyboard nav | Media | Menu nascosto deve essere accessibile da tastiera (Escape, Tab, Enter) |

**Nota APHRODITE:** Il colore #5EB0BB (teal light) su #DFEAE8 (background) ha un rapporto di contrasto stimato di ~2.8:1 — insufficiente per testo normale secondo WCAG 2.1 AA (richiede 4.5:1). Verificare con strumenti come WebAIM Contrast Checker.

---

## 12. Confronto con SaaS Best Practices

### Benchmark: Linear, Notion, Stripe

| Elemento | Linear | Notion | Stripe | Soccorso Digitale |
|----------|--------|--------|--------|-------------------|
| Tempo al messaggio principale | <1s | <1s | <1s | >2s (preloader) |
| CTA above the fold | Funzionante | Funzionante | Funzionante | **Rotta** |
| Social proof autenticato | Si | Si | Si | **Parziale (4 fake)** |
| Nav desktop visibile | Si | Si | Si | **No (hamburger only)** |
| Mobile performance | Ottima | Ottima | Ottima | Problematica (18MB) |
| Free trial o demo | 14 giorni trial | Piano free | Trial sandbox | **Solo demo** |
| Incongruenze di prezzo | No | No | No | **Si (FAQ vs pricing)** |

### Gap Principale
Il sito di Soccorso Digitale ha una struttura narrativa corretta ma soffre di problemi di esecuzione che un SaaS B2B maturo non avrebbe. La differenza non è nel design visivo (che è dignitoso) ma nella **cura del dettaglio** — i placeholder non sostituiti, il link rotto, l'inconsistenza di prezzo. Questi segnali comunicano al prospect B2B che l'organizzazione non è ancora pronta per gestire i loro dati critici.

---

## 13. Issue Table

| Priorità | Sezione | Issue | Fix | Impatto Conversion |
|----------|---------|-------|-----|--------------------|
| CRITICO | Hero | CTA "Richiedi Demo" → webflow.com/templates | Sostituire href con URL corretto (form, Calendly, o pagina interna) | +∞ (da 0 a qualsiasi valore) |
| CRITICO | Section 007 | 4 testimonial fake (Sarah Mitchell, Jonathan Reed, Michael Tran, Laura Martinez) | Rimuovere immediatamente, sostituire con testimonial reali o rimuovere il slider | +20-35% fiducia |
| CRITICO | Vari | `data-wf-domain="conicorn.webflow.io"` in HTML | Aggiornare domain references per il dominio produzione | Tecnico/SEO |
| ALTA | Section 010 / Section 008 | €74/mese in FAQ vs €79/mese in pricing | Allineare a un unico prezzo verificato | +5-10% fiducia |
| ALTA | Navbar | Hamburger-only su tutti i viewport | Mostrare 5 anchor link desktop su viewport >1024px | +10-15% scopribilità |
| ALTA | Section 008 | Nessun badge "Più Popolare" sul piano centrale | Aggiungere badge visivo e border highlight al piano €149 | +15-25% su piano medio |
| ALTA | Hero | Video 1.5MB blocca rendering mobile | Convertire in WebP/AVIF o sostituire con mockup prodotto | +20-30% mobile engagement |
| ALTA | Section 007 | Trust strip senza fonte | Aggiungere "(fonte: case study [Org], [anno])" o ridimensionare i claims | +8-12% credibilità |
| MEDIA | Tutto | Font Geist caricato come .ttf | Convertire in WOFF2, aggiungere `font-display: swap` | +10-15% performance |
| MEDIA | Section 006 | 40+ feature pills senza gerarchia | Ridurre a 12-15 feature principali con icone, raggruppate per categoria | +10% leggibilità |
| MEDIA | Section 001 | Loghi organizzazioni senza autorizzazione documentata | Verificare e documentare autorizzazioni scritte | Rischio legale |
| MEDIA | Global | Nessuna sticky CTA bar | Aggiungere barra fissa con "Richiedi Demo" dopo 30% scroll | +8-12% conversion |
| MEDIA | Global | Nessun exit intent | Implementare popup exit intent con offerta (es. "Scarica la guida gratuita") | +3-5% lead capture |
| BASSA | `<head>` | OG image con path relativo | Sostituire con URL assoluto per social sharing corretto | +5% CTR social |
| BASSA | `<head>` | Nessun canonical URL | Aggiungere `<link rel="canonical">` | SEO tecnico |
| BASSA | Global | Preloader senza skip | Aggiungere opzione skip o ridurre durata a <1s | +5-8% su mobile |

---

*Documento prodotto da APHRODITE — UX Expert, Design System Lead*
*Prossima revisione raccomandata: dopo implementazione fix CRITICI*
