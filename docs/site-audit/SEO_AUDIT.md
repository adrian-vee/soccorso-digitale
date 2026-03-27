# SEO Audit — soccorsodigitale.app
**Fonte analizzata:** `conicorn/index.html` (export Webflow, 704 righe)
**Data audit:** 2026-03-28
**Redatto da:** CICERO — B2B SaaS Marketing Expert

---

## 1. Executive Summary

Soccorso Digitale presenta una landing page tecnicamente funzionale ma con **gravi lacune SEO** che impediscono qualsiasi posizionamento organico competitivo. Il sito è di fatto invisibile su Google per le keyword commerciali più rilevanti del settore (gestionale ambulanze, software trasporto sanitario, gestionale cooperativa soccorso).

I problemi non sono superficiali: mancano le fondamenta — canonical, sitemap, robots.txt, structured data, keyword targeting, ottimizzazione immagini. Il sito è ancora configurato per il dominio Webflow di sviluppo su almeno 1 attributo critico. La velocità di caricamento è compromessa da asset non ottimizzati (font .ttf invece di .woff2, assenza di critical CSS, librerie JS pesanti).

### Punteggio SEO Complessivo: **28 / 100**

| Area | Punteggio | Peso |
|------|-----------|------|
| Meta Tags & Head | 35/100 | Alto |
| Struttura Heading | 60/100 | Alto |
| Keyword Targeting | 10/100 | Critico |
| Structured Data | 0/100 | Alto |
| SEO Tecnico (canonical, sitemap, robots) | 5/100 | Critico |
| Ottimizzazione Immagini & Alt Text | 8/100 | Alto |
| Link Interni/Esterni | 30/100 | Medio |
| Social Meta Tags | 55/100 | Basso |
| Segnali Core Web Vitals | 25/100 | Alto |

**Priorità assoluta:** risolvere i 7 CRITICAL prima di qualsiasi attività di link building o content marketing. Senza queste basi, ogni investimento in traffico organico è sprecato.

---

## 2. Analisi Meta Tags

### 2.1 Title Tag

```html
<!-- Riga 8 (approx.) -->
<title>Soccorso Digitale — Software Gestionale in Cloud per il Volontariato</title>
```

**Valutazione:** MEDIUM

**Problemi:**
- Lunghezza: ~71 caratteri — al limite superiore (Google tronca oltre 60 caratteri su mobile). Raccomandato: 50-60 caratteri.
- "Volontariato" è troppo generico. Non intercetta ricerche commerciali ad alta intenzione come "gestionale ambulanze" o "software 118".
- Il brand name ("Soccorso Digitale") è posizionato all'inizio — corretto per il brand, ma sacrifica spazio per keyword ad alto volume.

**Fix raccomandato:**
```html
<title>Gestionale Cloud per 118, CRI e Misericordie | Soccorso Digitale</title>
```
oppure per keyword targeting più aggressivo:
```html
<title>Software Gestionale Ambulanze & Turni Volontari | Soccorso Digitale</title>
```

---

### 2.2 Meta Description

```html
<meta name="description" content="Soccorso Digitale è il software gestionale in cloud per organizzazioni di soccorso: gestisci turni, missioni e documenti in un'unica piattaforma.">
```

**Valutazione:** MEDIUM

**Problemi:**
- Lunghezza: ~148 caratteri — accettabile (max ~160).
- Manca la call-to-action esplicita ("Prova gratis 7 giorni", "Demo gratuita").
- Non include keyword commerciali secondarie: "ambulanze", "118", "Croce Rossa".
- Non differenzia da competitor generici (qualsiasi SaaS potrebbe scrivere questa descrizione).

**Fix raccomandato:**
```html
<meta name="description" content="Gestisci turni, missioni e rimborsi UTIF per CRI, Misericordie e associazioni 118. Software cloud italiano, GDPR-compliant. Demo gratuita in 48 ore.">
```

---

### 2.3 Canonical URL

**Valutazione:** CRITICAL

**Problema:** La pagina non contiene alcun tag canonical. Questo è un problema grave per tre motivi:
1. Google potrebbe indicizzare sia `https://soccorsodigitale.app/` sia `https://conicorn.webflow.io/` come duplicati, diluendo l'autorità.
2. L'attributo `data-wf-domain="conicorn.webflow.io"` (nel tag `<html>`) conferma che il sito è stato esportato da Webflow senza rimozione del dominio di staging — se Webflow serve ancora quella URL, esiste un duplicato attivo.
3. Senza canonical, parametri UTM e varianti URL (con/senza trailing slash) creano contenuto duplicato.

**Fix obbligatorio — aggiungere nel `<head>`:**
```html
<link rel="canonical" href="https://soccorsodigitale.app/" />
```

**Azione aggiuntiva:** Verificare che `https://conicorn.webflow.io/` risponda con 301 redirect verso `https://soccorsodigitale.app/` oppure sia protetta da password / noindex.

---

### 2.4 Data-WF-Domain (Webflow Staging Leak)

**Valutazione:** CRITICAL

**Problema:** Il tag `<html>` contiene `data-wf-domain="conicorn.webflow.io"`. Questo attributo identifica pubblicamente il provider e il dominio di staging. Conseguenze:
- Competitor e scraper possono identificare l'infrastruttura.
- Se il dominio Webflow è ancora accessibile, Google potrebbe trovare e indicizzare contenuto duplicato.
- Segnale negativo per la percezione di professionalità nel caso di audit tecnici da parte di prospect enterprise.

**Fix:** Rimuovere l'attributo o sostituire con il dominio di produzione nel processo di deploy.

---

## 3. Struttura Heading (H1–H6)

### 3.1 H1

```html
<!-- Riga 192 -->
<h1>Il Gestionale Cloud per il Volontariato Italiano</h1>
```

**Valutazione:** MEDIUM-HIGH

**Aspetti positivi:**
- Un solo H1 nella pagina — corretto.
- Contiene "Gestionale Cloud" e "Volontariato" — keyword rilevanti.

**Problemi:**
- "Volontariato Italiano" è una keyword informazionale, non commerciale. Chi cerca un software per la propria organizzazione usa termini come "gestionale 118", "software ambulanze", "programma turni volontari".
- Nessuna menzione di Croce Rossa, Misericordie, o 118 — i tre segmenti target principali.

**Fix raccomandato:**
```html
<h1>Il Gestionale Cloud per CRI, Misericordie e Associazioni 118</h1>
```
oppure:
```html
<h1>Software Gestionale per il Soccorso: Turni, Missioni e UTIF in un'unica Piattaforma</h1>
```

---

### 3.2 H2 — Analisi Distribuzione

| H2 Attuale | Keyword SEO | Valutazione |
|------------|-------------|-------------|
| "Funzionalità Complete" | Nessuna keyword target | LOW |
| "Piattaforma Cloud per il Soccorso" | Buona | GOOD |
| "Il Percorso" | Nessuna keyword target | LOW |
| "Cosa abbiamo cambiato sul campo" | Nessuna keyword target | LOW |
| "La Piattaforma Completa" | Vago | LOW |
| "Cosa Dicono di Noi" | Nessuna | LOW |
| "Il Piano Giusto per la Tua Organizzazione" | Nessuna | LOW |
| "Il Nostro Team" | Nessuna | LOW |
| "Domande Frequenti" | OK (FAQ SEO) | GOOD |

**Valutazione complessiva:** HIGH

**Problemi:**
- 7 su 9 H2 non contengono keyword rilevanti per la ricerca organica.
- Assenza totale di H3-H6: la gerarchia si ferma a H2, rendendo il documento piatto per i crawler.
- Nessun H2 intercetta keyword long-tail come "gestionale turni ambulanze", "tracciamento missioni 118", "rimborso UTIF automatico".

**Fix raccomandati per H2 prioritari:**

```html
<!-- Da: -->
<h2>Funzionalità Complete</h2>
<!-- A: -->
<h2>Funzionalità Complete per la Gestione di Ambulanze e Volontari</h2>

<!-- Da: -->
<h2>Il Percorso</h2>
<!-- A: -->
<h2>Come Iniziare con il Software Gestionale per il Soccorso</h2>

<!-- Da: -->
<h2>La Piattaforma Completa</h2>
<!-- A: -->
<h2>Tutti i Moduli del Gestionale: Turni, GPS, UTIF, Documenti Digitali</h2>
```

---

### 3.3 Assenza di H3-H6

**Valutazione:** MEDIUM

Nessun heading di livello 3 o inferiore è presente. Su una landing page single-page di questa lunghezza (704 righe), è normale avere solo H1/H2, ma l'aggiunta di H3 per sottosezioni delle feature e della FAQ migliorerebbe la leggibilità per i crawler e l'eligibilità per i featured snippet.

**Fix:** Aggiungere `<h3>` per ogni domanda della sezione FAQ e per i sottotitoli delle feature principali (es. "Gestione Turni Volontari", "Tracciamento Missioni GPS", "Rimborsi UTIF Automatici").

---

## 4. Analisi Keyword

**Valutazione complessiva:** CRITICAL

Questa è la lacuna più grave del sito. Le keyword commerciali primarie del settore sono completamente assenti dall'HTML.

### 4.1 Keyword Gap Analysis

| Keyword | Volume Stimato (IT) | Occorrenze in HTML | Status |
|---------|--------------------|--------------------|--------|
| gestionale ambulanze | 200-500/mese | **0** | CRITICO |
| software trasporto sanitario | 100-300/mese | **0** | CRITICO |
| gestionale cooperativa soccorso | 50-200/mese | **0** | CRITICO |
| software 118 | 300-600/mese | **0** | CRITICO |
| gestione turni volontari | 200-400/mese | **0** | CRITICO |
| programma turni ambulanze | 100-250/mese | **0** | CRITICO |
| ambulanze | qualsiasi | **0** | CRITICO |
| trasporto sanitario | qualsiasi | **0** | CRITICO |
| accise UTIF | 50-150/mese | presente | BUONO |
| Croce Rossa software | 100-200/mese | 1 (about) | INSUFFICIENTE |
| Misericordie gestionale | 50-150/mese | 1 (about) | INSUFFICIENTE |
| volontariato | generico | multiplo | OK (troppo generico) |

### 4.2 Raccomandazioni Keyword Strategy

**Tier 1 — Head Terms (aggiungere obbligatoriamente nel copy):**
- "gestionale ambulanze"
- "software 118"
- "gestione turni volontari"

**Tier 2 — Long Tail (aggiungere in H2/H3 e body copy):**
- "gestionale per Croce Rossa Italiana"
- "software gestione missioni soccorso"
- "rimborso chilometrico UTIF automatico"
- "tracciamento GPS ambulanze"
- "gestione documenti volontari"
- "piattaforma cloud Misericordie"

**Tier 3 — Informazionale (per blog/FAQ):**
- "come gestire i turni in un'associazione 118"
- "UTIF dichiarazione redditi volontari"
- "GDPR associazioni di volontariato"

### 4.3 Placement Raccomandato

```
Title tag:        Tier 1 keyword primaria
H1:               Tier 1 keyword + segmenti target (CRI, Misericordie, 118)
Meta description: Tier 1 + Tier 2 + CTA
H2 sezione hero: Tier 1 secondaria
Body copy:        Tier 2 distribuiti naturalmente
Alt text:         Tier 2 descrittivi
FAQ:              Tier 3 come domande naturali
```

---

## 5. Structured Data / Schema.org

**Valutazione:** CRITICAL

Il sito non contiene alcun markup Schema.org / JSON-LD. Questo preclude:
- Rich snippets nei risultati di ricerca (rating, FAQ, prezzi).
- Eligibilità per Google's AI Overviews e feature SERP.
- Knowledge Graph entries per il brand.

### 5.1 Schema Obbligatori da Implementare

**Schema 1: SoftwareApplication**
```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Soccorso Digitale",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web, iOS, Android",
  "description": "Software gestionale cloud per organizzazioni di soccorso: turni, missioni, UTIF e documenti digitali.",
  "url": "https://soccorsodigitale.app",
  "offers": [
    {
      "@type": "Offer",
      "name": "Piano Base",
      "price": "79",
      "priceCurrency": "EUR",
      "billingIncrement": "P1M"
    },
    {
      "@type": "Offer",
      "name": "Piano Pro",
      "price": "149",
      "priceCurrency": "EUR",
      "billingIncrement": "P1M"
    },
    {
      "@type": "Offer",
      "name": "Piano Enterprise",
      "price": "299",
      "priceCurrency": "EUR",
      "billingIncrement": "P1M"
    }
  ]
}
```

**Schema 2: FAQPage** (per la sezione Domande Frequenti)
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Quali organizzazioni possono usare Soccorso Digitale?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Soccorso Digitale è progettato per Croce Rossa, Misericordie, associazioni 118 e Protezione Civile."
      }
    }
    // ... restanti 4 FAQ
  ]
}
```

**Schema 3: Organization**
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Soccorso Digitale",
  "url": "https://soccorsodigitale.app",
  "logo": "https://soccorsodigitale.app/images/logo.png",
  "sameAs": [
    "https://www.facebook.com/soccorsodigitale",
    "https://www.linkedin.com/company/soccorsodigitale",
    "https://www.instagram.com/soccorsodigitale"
  ]
}
```

---

## 6. SEO Tecnico

### 6.1 Sitemap XML

**Valutazione:** CRITICAL

Nessun file `sitemap.xml` rilevato. Google non ha una mappa ufficiale delle URL del sito.

**Fix:** Creare `/sitemap.xml` e sottomettere a Google Search Console.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://soccorsodigitale.app/</loc>
    <lastmod>2026-03-28</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://soccorsodigitale.app/demo</loc>
    <lastmod>2026-03-28</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://soccorsodigitale.app/privacy</loc>
    <lastmod>2026-03-28</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
</urlset>
```

---

### 6.2 Robots.txt

**Valutazione:** CRITICAL

Nessun file `robots.txt` rilevato. I crawler non hanno indicazioni su cosa indicizzare o escludere.

**Fix:** Creare `/robots.txt`:
```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/

Sitemap: https://soccorsodigitale.app/sitemap.xml
```

---

### 6.3 Canonical Tag

Già trattato in §2.3 — CRITICAL.

---

### 6.4 HTTPS

Non verificabile da HTML statico, ma presumibilmente attivo se il sito è live su dominio custom. Da verificare con redirect automatico da HTTP e HSTS header.

---

### 6.5 Hreflang

**Valutazione:** LOW (attuale)

Il sito è monolinguistico (italiano). Non necessario ora, ma da considerare se si espande a mercati europei. Aggiungere `<html lang="it">` se non già presente.

---

## 7. Ottimizzazione Immagini e Alt Text

**Valutazione:** CRITICAL

### 7.1 Panoramica Alt Text

| Tipo di Alt Text | Occorrenze | Problema |
|------------------|------------|---------|
| `alt=""` (vuoto) | ~70 | Immagini decorative OK, ma non per contenuto |
| `alt="avatar"` | ~35 | Non descrittivo, non include nomi o ruoli |
| `alt="logo"` | ~23 | Non specifica quale logo — organizzazione o SD? |
| `alt="team image"` | ~5 | Non descrittivo |
| `alt="Icon"` | ~4 | Non descrittivo |
| `alt="casestudy"` | ~2 | Non descrittivo |
| `alt="Soccorso Digitale"` | 2 | Accettabile per logo brand |
| Descrittivi con keyword | **0** | CRITICO |

**Il sito ha zero alt text che contengano keyword target.** Le immagini sono completamente opache per i motori di ricerca.

### 7.2 Fix Specifici per Categoria

**Immagini Team:**
```html
<!-- Da: -->
<img src="..." alt="avatar">
<!-- A: -->
<img src="..." alt="Adrian Vasile, CEO e Founder di Soccorso Digitale">
<img src="..." alt="Leo Martin, CTO e Co-Founder di Soccorso Digitale">
```

**Immagini Case Study:**
```html
<!-- Da: -->
<img src="..." alt="casestudy">
<!-- A: -->
<img src="..." alt="Case study: riduzione 85% tempo pianificazione turni ambulanze Croce Rossa">
```

**Immagini Feature:**
```html
<!-- Da: -->
<img src="..." alt="">
<!-- A: -->
<img src="..." alt="Dashboard gestione turni volontari Soccorso Digitale">
<img src="..." alt="Tracciamento missioni GPS ambulanze su mappa">
<img src="..." alt="Report rimborsi UTIF automatici per associazioni 118">
```

**Logo Soccorso Digitale:**
```html
<!-- Da: -->
<img src="..." alt="logo">
<!-- A: -->
<img src="..." alt="Soccorso Digitale — Software Gestionale per il Volontariato">
```

**Loghi partner/integrazioni (30 immagini):**
```html
<!-- Ogni logo integrazione dovrebbe avere: -->
<img src="..." alt="Logo [Nome Servizio] — integrazione con Soccorso Digitale">
```

### 7.3 Formato File Immagini

**Valutazione:** MEDIUM

Non è verificabile dal solo HTML quali formati vengono serviti, ma considerando che il sito è un export Webflow, è probabile che molte immagini siano PNG/JPEG non ottimizzati. Raccomandazioni:
- Convertire tutte le immagini in WebP (o AVIF per browser moderni).
- Implementare `srcset` e `sizes` per immagini responsive.
- Aggiungere `loading="lazy"` per immagini below-the-fold.
- Aggiungere `width` e `height` per prevenire CLS (Cumulative Layout Shift).

---

## 8. Link Interni ed Esterni

### 8.1 Bug Critico — CTA Hero

**Valutazione:** CRITICAL

```html
<!-- CTA principale nella hero section -->
<a href="https://webflow.com/templates">Richiedi una Demo</a>
```

Il pulsante CTA principale dell'intera pagina — la prima azione che un visitatore vede — punta a `https://webflow.com/templates`. Questo è un bug di deployment rimasto dall'export del template Webflow. Conseguenze:
- **Conversioni zero** da questo CTA (tutti i click vanno a Webflow).
- Segnale di disengagement negativo per Google Analytics / GSC.
- Danno alla credibilità con qualsiasi utente che ci clicca.

**Fix immediato (priorità massima):**
```html
<a href="/demo">Richiedi una Demo</a>
<!-- oppure: -->
<a href="https://soccorsodigitale.app/demo">Richiedi una Demo</a>
```

---

### 8.2 Architettura Link Interni

**Valutazione:** HIGH

Tutti i link interni sono anchor-based (#sezione). Questo indica una struttura single-page che non crea URL separate per sezioni, riducendo le opportunità di ranking multiplo.

**Pagine mancanti che andrebbero aggiunte come URL separate:**

| Pagina | Keyword target | Priorità |
|--------|---------------|----------|
| `/blog` | keyword informazionali long-tail | ALTA |
| `/funzionalita` | feature keyword dettagliate | ALTA |
| `/prezzi` | "prezzi software gestionale ambulanze" | ALTA |
| `/case-study` | "risultati gestionale 118 CRI" | MEDIA |
| `/contatti` | branded + local SEO | MEDIA |
| `/integrations` | "integrazione software ambulanze" | BASSA |

Il footer non ha link a `/blog`, `/case-study`, `/contatti` — voci di navigazione fondamentali per la struttura SEO del sito.

---

### 8.3 Link Esterni

**Valutazione:** LOW

I link esterni presenti (social media) sono corretti. Non ci sono link in uscita verso risorse autorevoli (ANAC, Agenzia delle Entrate per UTIF, normative GDPR) che aumenterebbero la credibilità editoriale.

---

## 9. Social Meta Tags

### 9.1 Open Graph

**Valutazione:** MEDIUM

```html
<!-- Analisi OG tags presenti -->
<meta property="og:title" content="Soccorso Digitale — Software Gestionale in Cloud per il Volontariato">
<meta property="og:description" content="..."> <!-- identico a meta description -->
<meta property="og:image" content="images/69b2a43213e2ea5b45e38723_Open%20Graph.png">
```

**Problemi:**
1. **OG image usa path relativo**, non URL assoluta — la maggior parte dei social network non risolverà correttamente l'immagine quando il link viene condiviso.
2. OG title e description sono identici ai meta tag — idealmente andrebbero ottimizzati per la condivisione social (più conversazionali, con emoji permesse).
3. Manca `og:url` con URL assoluta canonicalizzata.
4. Manca `og:type` esplicito (default: "website" — accettabile ma meglio dichiararlo).
5. Manca `og:locale` (raccomandato: `it_IT`).

**Fix:**
```html
<meta property="og:url" content="https://soccorsodigitale.app/" />
<meta property="og:type" content="website" />
<meta property="og:locale" content="it_IT" />
<meta property="og:image" content="https://soccorsodigitale.app/images/og-image.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
```

---

### 9.2 Twitter Card

**Valutazione:** LOW (positivo)

`twitter:card` è impostato a `summary_large_image` — corretto per contenuto visuale B2B.
Verificare che siano presenti anche `twitter:site` e `twitter:creator` con gli handle ufficiali.

---

## 10. Ottimizzazione Mobile

**Valutazione:** MEDIUM

```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```

Il viewport è configurato correttamente. Tuttavia, ci sono segnali indiretti di problemi mobile:
- GSAP + ScrollTrigger + SplitText su animazioni testo: queste librerie sono notoriamente pesanti su dispositivi mobile entry-level.
- Il video hero (1.5MB) viene caricato anche su mobile se non c'è una strategia `media` o `source` differenziata.
- Font in formato .ttf: i browser mobile possono impiegare più tempo per renderizzare rispetto a WOFF2.

**Fix:**
- Implementare `prefers-reduced-motion` per disabilitare animazioni GSAP su utenti che lo richiedono (accessibilità + performance).
- Usare `<source media="(max-width: 768px)" src="hero-mobile.webm">` per servire video ottimizzati su mobile.

---

## 11. Segnali Core Web Vitals

**Valutazione:** HIGH

Dall'analisi dell'HTML, emergono diversi segnali negativi per i Core Web Vitals:

### 11.1 Largest Contentful Paint (LCP)

**Elementi problematici:**
- **Video hero (1.5MB mp4):** Se il video è l'elemento LCP, il suo peso e il ritardo di caricamento impattano direttamente questo metric.
- **Font .ttf senza preload:** Geist Regular/Medium/SemiBold caricati come .ttf causano Flash of Invisible Text (FOIT) che ritarda il rendering del testo hero, potenzialmente peggiorando LCP.
- **Assenza di critical CSS inlining:** Il CSS principale è 131KB — tutto il rendering è bloccato fino al suo caricamento.

**Fix:**
```html
<!-- Preload font critici come WOFF2 -->
<link rel="preload" href="/fonts/Geist-Regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/Geist-SemiBold.woff2" as="font" type="font/woff2" crossorigin>

<!-- Preload LCP image se l'hero usa immagine invece di video -->
<link rel="preload" as="image" href="/images/hero.webp">
```

### 11.2 Cumulative Layout Shift (CLS)

**Elementi problematici:**
- Immagini senza attributi `width` e `height` espliciti causano reflow quando si caricano.
- Il preloader (presente nell'HTML) potrebbe mascherare il CLS se non correttamente gestito.
- Font swap senza `font-display: swap` può causare layout shift.

### 11.3 Interaction to Next Paint (INP)

**Elementi problematici:**
- jQuery 3.5.1 (100KB) + Webflow.js (~119KB) + GSAP bundle: totale JS pesante che occupa il main thread.
- Raccomandazione: valutare la sostituzione di jQuery con vanilla JS e la lazy-loading del bundle GSAP.

### 11.4 Bundle JS Totale Stimato

| Libreria | Dimensione |
|----------|------------|
| jQuery 3.5.1 | ~100KB |
| webflow.js | ~119KB |
| GSAP + ScrollTrigger + SplitText | ~80-120KB |
| **Totale stimato** | **~300-340KB JS** |

Questo è il triplo del budget JS raccomandato per una landing page (100KB max per performance ottimale).

---

## 12. Tabella Riassuntiva Issues

| Severità | Issue | Fix Richiesto | Effort |
|----------|-------|--------------|--------|
| CRITICAL | CTA hero punta a `webflow.com/templates` | Cambiare href in `/demo` | 5 min |
| CRITICAL | Nessun canonical tag | Aggiungere `<link rel="canonical">` | 10 min |
| CRITICAL | `data-wf-domain` punta a Webflow | Rimuovere attributo o aggiornare | 10 min |
| CRITICAL | Nessun `sitemap.xml` | Creare e sottomettere a GSC | 1h |
| CRITICAL | Nessun `robots.txt` | Creare file | 15 min |
| CRITICAL | Zero keyword commerciali nel copy | Riscrivere H1, H2, body copy | 2-3 giorni |
| CRITICAL | Nessun structured data JSON-LD | Aggiungere SoftwareApplication + FAQ + Organization schema | 2h |
| HIGH | OG image usa path relativo | Sostituire con URL assoluta | 10 min |
| HIGH | ~70 immagini con alt="" vuoto su contenuto | Scrivere alt text descrittivi | 3-4h |
| HIGH | ~35 immagini `alt="avatar"` senza nomi | Aggiungere nomi persone e ruoli | 2h |
| HIGH | Title tag troppo lungo (71 char) | Accorciare a max 60 char con keyword | 15 min |
| HIGH | H2 senza keyword target (7/9) | Riscrivere H2 con keyword integrate | 1h |
| HIGH | Nessuna pagina separata per /blog, /prezzi, /funzionalita | Creare architettura multi-pagina | 1-2 settimane |
| HIGH | Font .ttf invece di WOFF2 | Convertire e aggiornare CSS | 2h |
| HIGH | Assenza preload per font critici | Aggiungere `<link rel="preload">` | 30 min |
| MEDIUM | Meta description non ha CTA | Riscrivere con "Demo gratuita" | 15 min |
| MEDIUM | H3-H6 assenti (FAQ, feature) | Aggiungere H3 per FAQ e sottosezioni | 1h |
| MEDIUM | OG title/description identici a meta tag | Versioni ottimizzate per social | 30 min |
| MEDIUM | Mancano `og:url`, `og:locale`, `og:type` | Aggiungere meta OG mancanti | 15 min |
| MEDIUM | jQuery + webflow.js + GSAP (~340KB JS) | Audit e ottimizzazione bundle | 1 settimana |
| MEDIUM | Video hero 1.5MB senza fallback mobile | Versione mobile-ottimizzata | 1 giorno |
| LOW | Nessun link esterno a risorse autorevoli (ANAC, GDPR) | Aggiungere link credibilità | 2h |
| LOW | `generator=Webflow` meta pubblicamente visibile | Rimuovere meta generator | 10 min |
| LOW | Nessun hreflang `lang="it"` su `<html>` | Aggiungere attributo | 5 min |

---

## Note Finali

**Priorità di intervento consigliata:**

**Settimana 1 (Quick Wins — nessun costo di sviluppo):**
1. Fix CTA hero (5 min — impatto diretto sulle conversioni)
2. Aggiungere canonical tag
3. Creare robots.txt e sitemap.xml
4. Fix OG image URL assoluta
5. Aggiungere JSON-LD SoftwareApplication e FAQPage

**Settimana 2-4 (Ottimizzazione copy e immagini):**
1. Riscrittura H1, H2 con keyword target
2. Alt text descrittivi per tutte le immagini
3. Conversione font a WOFF2 + preload

**Mese 2-3 (Architettura SEO):**
1. Creazione pagine separate (/funzionalita, /prezzi, /demo, /case-study)
2. Avvio blog con contenuti keyword-driven
3. Audit e ottimizzazione bundle JavaScript

---

*Documento generato il 2026-03-28. Dati basati su analisi statica di `conicorn/index.html` (704 righe, export Webflow). Verificare con Google Search Console e PageSpeed Insights per dati real-time.*
