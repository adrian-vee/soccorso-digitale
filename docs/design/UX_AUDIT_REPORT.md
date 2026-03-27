# UX Audit Report — Soccorso Digitale Admin Dashboard
**Agente:** APHRODITE — UI/UX Designer
**Data:** 2026-03-27
**Versione analizzata:** admin/public/ (index.html 12.205 righe, styles.css 36.114 righe, app.js 42.485 righe)
**Scope:** Dashboard admin — login, sidebar, dashboard KPI, navigazione, accessibilità

---

## Score UX Globale

| Dimensione | Score | Note |
|---|---|---|
| Coerenza visiva | 42/100 | Doppio sistema di colori, 2 CSS deprecati ancora caricati |
| Navigabilità | 51/100 | Sidebar con 46+ voci, sezioni duplicate |
| Accessibilità | 38/100 | WCAG AA fallisce su più combinazioni |
| Performance percepita | 30/100 | 90.804 righe in 3 file monolitici |
| Feedback e stati | 55/100 | Skeleton assenti, stati error incompleti |
| Appropriatezza per l'utente | 48/100 | Emoji in contesto operativo, linguaggio tecnico |

**Score Globale: 44/100**

> Nota: la piattaforma ha buone fondamenta strutturali (sidebar collassabile, search funzionante, ARIA parziale) ma soffre di debito tecnico CSS accumulato e di una navigazione che ha superato la soglia di usabilità per l'utente target "Direttore cooperativa".

---

## Issue per Severity

### CRITICAL — Bloccano l'utente

---

#### C-01: Doppio sistema di colori in conflitto
**File:** `styles.css:1-30`, `css/theme.css` (tutto il file)
**Problema:**
`styles.css` definisce `--primary: #0066CC` (blu cereo) come variabile radice.
`theme.css` sovrascrive tutto con `#1E3A8A` (Navy Nordic Rescue) usando `!important` su ogni regola.
`org-admin/index.html` ridichiarla inline nel `<style>` con `--primary: #0066CC`.
Risultato: lo stesso bottone "Accedi" può renderizzare in colori diversi a seconda del contesto di caricamento del CSS.

**Impatto utente:** Il Direttore cooperativa (50-65 anni) non sa quale sia il "colore del sistema". Non riconosce la piattaforma come un prodotto coerente — segnale psicologico di inaffidabilità.

**Fix:** Eliminare `--primary: #0066CC` da `styles.css` e `org-admin/index.html`. Adottare esclusivamente la palette Nordic Rescue con token CSS in un unico file `tokens.css` caricato prima di tutto.

---

#### C-02: Due file CSS deprecati ancora caricati in produzione
**File:** `index.html:10-11`, `org-admin/index.html:9-11`
**Problema:**
```html
<link rel="stylesheet" href="/admin/dashboard-redesign.css?v=20260324sb2">
<link rel="stylesheet" href="/admin/css/nordic-rescue.css?v=1">
```
Entrambi i file iniziano con `/* DEPRECATED — replaced by admin/public/css/theme.css */` e contengono 0 regole CSS (solo il commento).
Ogni utente scarica 2 richieste HTTP aggiuntive inutili.

**Impatto utente:** +150-300ms di caricamento su connessione mobile/3G delle ambulanze. Su Railway con cold start, il ritardo è amplificato.

**Fix:** Rimuovere i 2 `<link>` tag da entrambi gli HTML. Eliminare i 2 file fisici dal repository.

---

#### C-03: Dark mode toggle non funzionante (feature rotta visibile)
**File:** `index.html:692-696`
**Problema:**
```html
<!-- Dark/Light mode toggle — cosmetic only, no logic -->
<button id="ds-theme-toggle" ...>
  <svg id="ds-icon-moon" style="display:none">...</svg>  ← sempre nascosto
  <svg id="ds-icon-sun">...</svg>
</button>
```
Il pulsante è visibile in header ma non fa nulla. Il commento "cosmetic only, no logic" conferma che è un placeholder mai implementato.

**Impatto utente:** Il Coordinatore operativo (35-50 anni) che lavora in ambulanza di notte vede il pulsante, lo clicca, non succede nulla. Genera confusione e percezione di bug. Erode la fiducia nella piattaforma.

**Fix (breve termine):** Nascondere il bottone con `display:none` fino a implementazione completa.
**Fix (lungo termine):** Implementare dark mode con `data-theme` su `<html>` e CSS variables o rimuovere definitivamente il bottone.

---

#### C-04: Monolite CSS/JS — Performance catastrofica
**File:** `styles.css` (664KB, 36.114 righe), `app.js` (42.485 righe), `index.html` (841KB, 12.205 righe)
**Problema:**
Tutto il codice della piattaforma è in 3 file. Nessun code splitting. Nessun lazy loading. L'utente scarica l'intera applicazione al primo accesso, incluse le sezioni ESG, CRM, SPID che il Direttore non userà mai.

**Impatto utente:** Su connessione 3G (comune in zone rurali dove operano le cooperative), il caricamento iniziale può superare i 30 secondi. Il Direttore abbandona prima del login.

**Fix:** Code splitting per modulo (Webpack/Vite). CSS purging (PurgeCSS). Target: bundle iniziale < 200KB gzipped.

---

### HIGH — Confondono l'utente

---

#### H-01: Sidebar con 46+ voci — Cognitive overload estremo
**File:** `index.html:162-646`
**Problema:**
La sidebar operativa contiene 10 sezioni collassabili con 46 voci di navigazione:
- Operativo: 9 voci
- Personale: 4 voci
- Turni: 5 voci
- Inventario e Sede: 6 voci
- Territorio e Sicurezza: 5 voci
- Governance: 2 voci
- Report: 4 voci
- Sostenibilità: 4 voci
- Sistema: 6 voci
- Marketplace: 1 voce

La piattaforma nav (superadmin) aggiunge ulteriori 16 voci.

**Impatto utente:** Il Direttore cooperativa (50-65 anni) si trova davanti a una lista di 46 funzioni. La ricerca cognitiva per trovare "Programma Giornaliero" supera la capacità di memoria di lavoro (Miller's Law: 7±2 elementi). L'utente è disorientato e chiede aiuto al supporto.

**Fix:** Progressive disclosure reale. Dashboard role-based: il Direttore vede 5-7 voci. Il Coordinatore vede 10-12. L'Admin IT vede tutto. Implementare con `userRole` nella sidebar config.

---

#### H-02: Doppia voce "Impostazioni" nella sidebar Sistema
**File:** `index.html:442-464`
**Problema:**
Nella sezione Sistema (nav operativa) esistono due `<button class="nav-item" data-page="settings">`:
1. Riga 442: standalone, `data-section="standalone-settings-nav"` — condizionalmente visibile
2. Riga 461: dentro `nav-section-settings` — sempre presente

Entrambi puntano a `data-page="settings"` — stesso contenuto.

**Impatto utente:** L'Admin IT vede "Impostazioni" due volte nel menu. Confonde. Fa pensare che siano due sezioni diverse con configurazioni diverse.

**Fix:** Rimuovere il nodo `nav-section-standalone-settings` o consolidarlo con la logica di visibilità di `nav-section-settings`.

---

#### H-03: Premium features con indicatore invisibile (lock icon opacity 0.45)
**File:** `index.html:253`, `index.html:282`
**Problema:**
Le voci premium ("Rimborsi Volontari", "Pianificazione Turni") mostrano un'icona lucchetto con `opacity:0.45` — quasi invisibile, specialmente su schermi non calibrati.
Nessun tooltip, nessun badge "PRO" visibile, nessuna spiegazione.

**Impatto utente:** Il Coordinatore clicca su "Pianificazione Turni", non capisce perché non funziona o mostra una pagina diversa. Pensa a un bug. Non capisce che è una feature premium che deve acquistare.

**Fix:** Badge PRO visibile con colore amber (#F59E0B), tooltip "Funzione PRO — Aggiorna il piano", link diretto alla pagina billing. Opacity del lucchetto: 1.0.

---

#### H-04: Sezione "Intelligence" nella platform nav è vuota
**File:** `index.html:568-579`
**Problema:**
```html
<div class="nav-section-body open">
  <!-- VUOTO — nessun nav-item -->
</div>
```
La sezione "Intelligence" nella platform nav (superadmin) è completamente vuota ma visibile.

**Impatto utente:** Il Superadmin vede una sezione collassabile senza contenuto. Confonde. Fa pensare a un bug di caricamento.

**Fix:** Nascondere la sezione con `style="display:none"` fino a quando non ha contenuto. Oppure mostrare un placeholder "Coming soon" con estimated release.

---

#### H-05: Link morti nella pagina di login
**File:** `index.html:110`, `index.html:113-120`
**Problema:**
- `<a href="#" class="lp-forgot">Password dimenticata?</a>` — nessun handler, nessuna funzionalità
- Footer: Termini di Servizio, Privacy Policy, Supporto — tutti `href="#"`

**Impatto utente:** Il Direttore (che dimentica spesso la password) clicca "Password dimenticata?" e non succede nulla. Deve chiamare il supporto. Frustrazione immediata.

**Fix prioritario:** Implementare `onclick="showPasswordResetFlow()"` con form email → link reset via Resend. I link footer devono puntare a URL reali.

---

#### H-06: Emoji come icone di widget in contesto operativo sanitario
**File:** `index.html:763`, `index.html:784`, `index.html:797`, `index.html:823`
**Problema:**
```html
<span class="env-widget-icon">🌤</span>   <!-- Weather -->
<span class="env-widget-icon">⚠️</span>   <!-- Alert -->
<span class="env-widget-icon">📊</span>   <!-- ETA -->
<span class="env-widget-icon">📈</span>   <!-- Demand -->
```
Le emoji hanno rendering inconsistente tra browser (Chrome vs Firefox vs Safari) e sistemi operativi (Windows vs macOS vs Linux). Su Windows 10 le emoji del meteo cambiano completamente aspetto. Non scalano correttamente a DPI elevati.

**Impatto utente:** Su PC aziendale Windows 7/10 del Coordinatore operativo, le emoji appaiono in stile diverso — non professionale. In un contesto sanitario/emergenziale, iconografia inconsistente riduce la velocità di scansione visiva.

**Fix:** Sostituire tutte le emoji con SVG inline dalla stessa libreria (Lucide) già usata nel resto della sidebar.

---

#### H-07: Testo "last-update" in header non contestuale
**File:** `index.html:671`
**Problema:**
```html
<span class="last-update" id="last-update">Ultimo aggiornamento: --</span>
```
Inizia sempre con "--" e non è chiaro cosa si stia aggiornando (la pagina? I dati? Il singolo KPI?).

**Impatto utente:** Il Coordinatore operativo non sa se i dati della flotta sono in tempo reale o di 20 minuti fa. In un contesto di emergenza, questo è critico.

**Fix:** Timestamping per-widget (ogni KPI card mostra il proprio last-update). Header mostra "Dati in tempo reale" con indicatore verde se polling attivo.

---

### MEDIUM — Incoerenza visiva

---

#### M-01: Conflitto font-family (Inter vs DM Sans)
**File:** `styles.css:39`, `css/theme.css` (lp-logo-text e altre classi)
**Problema:**
- `styles.css` body: `font-family: 'Inter', -apple-system, ...`
- `theme.css` login page: `font-family: 'DM Sans', system-ui, ...`
- Solo Inter è precaricata in `<head>` — DM Sans non è caricata

**Impatto utente:** Il logo-text della login page fallback su `system-ui` (Arial su Windows, Helvetica su Mac) invece di DM Sans — font completamente diverso da Inter. Inconsistenza percepita come bug.

**Fix:** Scegliere UNA famiglia tipografica per tutta la dashboard admin. Raccomandazione: Inter (già caricata). Eliminare DM Sans dal CSS.

---

#### M-02: Sidebar width in conflitto tra CSS files
**Problema:**
- `styles.css`: `--sidebar-width: 280px`
- `css/theme.css`: `--sidebar-w: 220px` (variabile con nome diverso!)
- `design-system.css` commenta: "theme.css già gestisce --sidebar-w: 220px"

Due nomi di variabile diversi (`--sidebar-width` vs `--sidebar-w`) per la stessa cosa. La sidebar reale ha larghezza 220px ma `styles.css` continua a calcolare `margin-left: 280px` per il `main-wrapper`.

**Impatto utente:** A seconda di quale CSS vince, il main content può avere un gap vuoto di 60px a sinistra della sidebar o sovrapposizione parziale.

**Fix:** Unificare in `--sidebar-width: 220px` in un unico token CSS. Eliminare la variabile duplicata.

---

#### M-03: Accenti italiani mancanti in testo UI
**File:** `index.html` (sidebar e dashboard)
**Problema:**
- `"Disponibilita' Live"` → dovrebbe essere "Disponibilità Live" (apostrofo errato)
- `"Disponibilita"` → "Disponibilità"
- `"Qualita del Dato"` → "Qualità del Dato" (panel header)
- `"Attivita Oraria"` → "Attività Oraria" (panel header)
- `"Sostenibilita"` → "Sostenibilità" (nav section header)

**Impatto utente:** Per un Direttore di cooperativa italiana, vedere "Disponibilita'" con apostrofo invece dell'accento è un segnale di scarsa cura del prodotto — equivalente a un refuso in una presentazione commerciale.

**Fix:** Search & replace su tutti i file. Aggiungere lint rule per caratteri speciali italiani.

---

#### M-04: Loading overlay non coerente con login page
**File:** `index.html:23-30`
**Problema:**
L'auth loading overlay usa `background: linear-gradient(135deg,#0B1426 0%,#1A1A24 100%)` — sfondo quasi nero.
La login page usa `background: #F2F2F7 !important` — sfondo grigio chiaro.
La transizione auth-overlay → login page è uno shock visivo (dal buio al chiaro).

**Impatto utente:** Al primo accesso, il flash dal nero al bianco è fastidioso. Su schermi luminosi in ambulanza di notte, può causare abbagliamento temporaneo.

**Fix:** Allineare l'overlay loading alla palette login (sfondo chiaro #F8FAFF, spinner blu #1E3A8A).

---

#### M-05: Sidebar footer — logout button indistinguibile dal banner org
**File:** `index.html:649-661`
**Problema:**
Sia il banner "Organizzazione" che il bottone "Esci" usano `background: #1E3A8A` — identico colore navy. I due elementi si fondono visivamente.

**Impatto utente:** L'utente ha difficoltà a distinguere il bottone di logout dall'area informativa. Questo è particolarmente critico per il Direttore anziano che potrebbe non trovare facilmente il logout.

**Fix:** Bottone logout: `background: transparent`, `border: 1px solid rgba(255,255,255,0.3)`, hover red: `#EF4444`. Oppure usare un tono più scuro per il banner.

---

#### M-06: `!important` usato in ~100% delle regole di design-system.css
**File:** `css/design-system.css` (tutti i selettori)
**Problema:**
Ogni singola regola in `design-system.css` usa `!important`. Questo indica una guerra di specificità CSS tra i 4 file, non un design system vero.

**Impatto utente:** Nessun impatto diretto sull'utente finale, ma rende impossibile per un futuro sviluppatore aggiungere stili specifici per pagina senza usare `!important` a sua volta — escalation infinita.

**Fix:** Eliminare `!important` da design-system.css usando specificity naturale (BEM o CSS layers `@layer`).

---

#### M-07: Modalità "supporto tecnico" con emoji warning
**File:** `index.html:719-728`
**Problema:**
```html
<span class="smb-icon">🔧</span>
<span class="smb-warn">⚠ Stai modificando dati di una specifica organizzazione</span>
```
Il banner di support mode usa emoji (🔧) e simbolo testuale ⚠ in un contesto dove un errore può impattare dati sanitari reali.

**Impatto utente:** Il Superadmin che entra in modalità supporto su dati di Croce Europa non ha abbastanza enfasi visiva sul rischio. Una tooltip emoji non trasmette la severità.

**Fix:** Banner rosso con border-left accento `#EF4444`, testo bold, icona SVG shield-alert. Aggiungere conferma esplicita prima di abilitare il support mode.

---

### LOW — Polish

---

#### L-01: Scrollbar custom con colori non coordinati in dark mode
**File:** `styles.css:124-145`
Scrollbar in `body.dashboard-active` usa `#38bdf8` (sky-400) — non appartiene alla palette Nordic Rescue.

#### L-02: Sidebar search placeholder "/" non spiegato
**File:** `index.html:158`
Il badge "/" a destra del search input non ha tooltip/aria-label. L'utente non sa che "/" è un hotkey.

#### L-03: Panel "più" button senza feedback
**File:** `index.html:922-926`
```html
<button class="panel-more-btn">...</button>
```
Il bottone "..." sui panel dark non ha `aria-label`, `title`, né azione collegata visibile.

#### L-04: "Torna al sito" nella login punta a "/"
**File:** `index.html:72-75`
Link funzionante ma senza indicazione che porta al sito pubblico (potrebbe confondere chi è già sul sito).

#### L-05: Google Fonts preconnect senza crossorigin coerente
**File:** `index.html:7-8`
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
```
Il primo preconnect manca di `crossorigin` — best practice richiede entrambi con crossorigin.
