# UX Fix Priority List — Soccorso Digitale Admin Dashboard
**Agente:** APHRODITE — UI/UX Designer
**Data:** 2026-03-27
**Metodologia:** Issue classificate per (Impatto Utente × Frequenza d'Uso) / Effort di implementazione

---

## Top 10 Fix CRITICI — Prima del Prossimo Cliente

> Questi fix devono essere completati prima dell'onboarding di qualsiasi nuovo cliente.
> Impattano sulla percezione di professionalità e sulla funzionalità base.

---

### FIX-C01: Rimuovere CSS deprecati dal `<head>`
**Severity:** CRITICAL — C-02
**File:** `admin/public/index.html:10-11`, `admin/public/org-admin/index.html:9-11`
**Descrizione:** Rimuovere i due `<link>` tag a `dashboard-redesign.css` e `nordic-rescue.css` (entrambi sono file vuoti deprecati).
**Implementazione:**
```html
<!-- RIMUOVERE queste 2 righe da index.html e org-admin/index.html: -->
<link rel="stylesheet" href="/admin/dashboard-redesign.css?v=20260324sb2">
<link rel="stylesheet" href="/admin/css/nordic-rescue.css?v=1">
```
**Stima:** 15 minuti
**Impatto:** -2 HTTP requests per ogni accesso. Rimozione confusione CSS.

---

### FIX-C02: Nascondere il dark mode toggle rotto
**Severity:** CRITICAL — C-03
**File:** `admin/public/index.html:693`
**Descrizione:** Il bottone dark/light mode è visibile ma non funziona. Nasconderlo fino a implementazione.
**Implementazione:**
```html
<!-- Aggiungere style="display:none" al button: -->
<button id="ds-theme-toggle" style="display:none" ...>
```
**Stima:** 5 minuti
**Impatto:** Elimina la percezione di "piattaforma rotta" da parte di ogni nuovo utente.

---

### FIX-C03: Implementare "Password dimenticata?" nella login
**Severity:** CRITICAL — H-05
**File:** `admin/public/index.html:110`, `admin/public/app.js` (aggiungere handler)
**Descrizione:** Link "Password dimenticata?" è href="#". Implementare flow email con Resend (già integrato).
**Implementazione:**
1. Creare endpoint `POST /api/auth/forgot-password` (già probabile in server/routes/auth.ts)
2. `<a href="#" class="lp-forgot" onclick="showPasswordResetModal(); return false;">`
3. Modal: input email → POST → conferma via email
**Stima:** 3-4 ore (incluso test email)
**Impatto:** Ogni cliente che dimentica la password non deve più chiamare il supporto. Critico per adozione iniziale.

---

### FIX-C04: Correggere tutti gli accenti italiani mancanti
**Severity:** CRITICAL (reputazionale) — M-03
**File:** `admin/public/index.html` (sidebar e dashboard sections)
**Descrizione:** 5 occorrenze di testo senza accento.
**Implementazione:**
```
"Disponibilita' Live"  →  "Disponibilità Live"
"Disponibilita"        →  "Disponibilità"
"Qualita del Dato"     →  "Qualità del Dato"  (2 occorrenze: panel header + nav item)
"Attivita Oraria"      →  "Attività Oraria"
"Sostenibilita"        →  "Sostenibilità"
```
**Stima:** 20 minuti (search & replace + test)
**Impatto:** Prima impressione di una cooperative sanitaria italiana. Difetto visibile da ogni utente ad ogni sessione.

---

### FIX-C05: Aggiungere skip-to-content link
**Severity:** CRITICAL (accessibilità/normativa) — SR-01
**File:** `admin/public/index.html:21` (prima del body content), `admin/public/styles.css`
**Descrizione:** Accessibilità normativa EN 301 549 (contratti PA).
**Implementazione:**
```html
<!-- Prima di #auth-loading-overlay, come primo figlio di body: -->
<a href="#main-content" class="skip-link">Vai al contenuto principale</a>
```
```css
.skip-link {
  position: absolute;
  top: -100%;
  left: 16px;
  background: #1E3A8A;
  color: #fff;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  z-index: 10000;
  transition: top 0.1s;
}
.skip-link:focus { top: 16px; }
```
**Stima:** 30 minuti
**Impatto:** Compliance EN 301 549, accessibilità utenti tastiera.

---

### FIX-C06: Aggiungere `:focus-visible` globale
**Severity:** CRITICAL (accessibilità) — K-01
**File:** `admin/public/css/design-system.css` (aggiungere in cima)
**Descrizione:** Nessun focus indicator visibile — utenti tastiera non vedono dove sono.
**Implementazione:**
```css
/* Focus Visible — Global */
:focus-visible {
  outline: 2px solid #1E3A8A;
  outline-offset: 2px;
  border-radius: 4px;
}
/* Override per aree scure (sidebar) */
.main-sidebar :focus-visible {
  outline-color: #93C5FD;
}
```
**Stima:** 20 minuti
**Impatto:** Accessibilità base per qualsiasi utente non-mouse.

---

### FIX-C07: Sostituire emoji widget con SVG Lucide
**Severity:** HIGH — H-06
**File:** `admin/public/index.html:763,784,797,823`
**Descrizione:** 4 emoji come icone di widget nella dashboard operativa.
**Implementazione:**
```html
<!-- 🌤 → Cloud-Sun SVG -->
<svg class="env-widget-icon-svg" width="18" height="18" aria-hidden="true">
  <!-- Lucide cloud-sun -->
</svg>
<!-- ⚠️ → Alert-Triangle SVG -->
<!-- 📊 → Activity SVG -->
<!-- 📈 → TrendingUp SVG -->
```
**Stima:** 1 ora
**Impatto:** Rendering consistente cross-OS/browser. Professionalità in contesto sanitario.

---

### FIX-C08: Badge PRO visibile per features premium
**Severity:** HIGH — H-03
**File:** `admin/public/index.html:253,282`
**Descrizione:** Lock icon a opacity:0.45 non è percepito come "feature PRO". Aggiungere badge visibile.
**Implementazione:**
```html
<!-- Sostituire il lock SVG opacity:0.45 con: -->
<span class="nav-pro-badge" title="Funzione PRO — Aggiorna il piano">PRO</span>
```
```css
.nav-pro-badge {
  font-size: 9px;
  font-weight: 800;
  background: #F59E0B;
  color: #0C1A2E;
  padding: 2px 5px;
  border-radius: 4px;
  letter-spacing: 0.04em;
  margin-left: auto;
  flex-shrink: 0;
}
```
**Stima:** 45 minuti (incluso CSS e test per tutte le features premium)
**Impatto:** Conversione upgrade piano. Utente capisce perché non può cliccare una voce.

---

### FIX-C09: Correggere contrasto placeholder text
**Severity:** HIGH (WCAG) — da ACCESSIBILITY_AUDIT
**File:** `admin/public/styles.css` e inline styles
**Descrizione:** Placeholder text (`#CBD5E1`) su background `#F8FAFC` = ratio 2.2:1 — WCAG richiede 4.5:1.
**Implementazione:**
```css
/* Sostituire tutti i placeholder con: */
::placeholder {
  color: #6B7280 !important; /* ratio 4.6:1 su #F8FAFC */
}
```
**Stima:** 30 minuti
**Impatto:** WCAG AA compliance. Utenti over-50 con vista ridotta.

---

### FIX-C10: Nascondere sezione "Intelligence" vuota nel platform nav
**Severity:** HIGH — H-04
**File:** `admin/public/index.html:568-579`
**Descrizione:** Sezione collassabile senza nessun nav-item dentro.
**Implementazione:**
```html
<!-- Aggiungere style="display:none" alla sezione: -->
<div class="nav-section nav-section-collapsible" data-section="sa-intelligence" style="display:none;">
```
**Stima:** 5 minuti
**Impatto:** Il Superadmin non vede più una sezione vuota che sembra un bug.

---

## Top 10 Fix HIGH — Entro 30 Giorni

---

### FIX-H01: Unificare i token CSS — eliminare doppio sistema colori
**Severity:** HIGH — C-01
**File:** Creare `admin/public/css/tokens.css`, modificare `styles.css`
**Descrizione:** Creare un file di design tokens unico che tutte le altre CSS importano.
**Implementazione:** File `tokens.css` con variabili Nordic Rescue, poi rimuovere `--primary: #0066CC` da `styles.css` e `org-admin/index.html`.
**Stima:** 4-6 ore
**Impatto:** Coerenza visiva totale. Fondamenta del design system.

---

### FIX-H02: Unificare KPI card in un unico componente
**Severity:** HIGH — COMPONENT_INVENTORY A
**File:** `styles.css`, `css/design-system.css`, `index.html`
**Descrizione:** 5 varianti di KPI card diversi → 1 componente con modifier class.
**Implementazione:** Definire `.kpi-card` con modifier `.kpi-card--dark`, `.kpi-card--sm`.
**Stima:** 3-4 ore
**Impatto:** Consistenza visiva tra Dashboard e sezioni interne.

---

### FIX-H03: Aggiungere ARIA sui componenti interattivi chiave
**Severity:** HIGH — da ACCESSIBILITY_AUDIT
**File:** `admin/public/index.html`
**Descrizione:** `aria-live` sui KPI, `role="tablist"` sui chart tabs, `aria-hidden` sugli SVG decorativi.
**Stima:** 3 ore
**Impatto:** Screen reader compliance. Rilevante per contratti PA.

---

### FIX-H04: Loading skeleton per stati empty/loading
**Severity:** HIGH — COMPONENT_INVENTORY mancanti
**File:** `admin/public/styles.css`, `admin/public/app.js`
**Descrizione:** Attualmente dati mostrano "0" o "--" durante il fetch API. Aggiungere shimmer skeleton.
**Implementazione:**
```css
.skeleton {
  background: linear-gradient(90deg, #F0F4FF 25%, #E2E8F0 50%, #F0F4FF 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite;
  border-radius: 4px;
}
@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```
**Stima:** 4-6 ore
**Impatto:** Riduce la percezione di "dati rotti" durante il caricamento. Critico per il Direttore.

---

### FIX-H05: Implementare toast/snackbar system
**Severity:** HIGH — COMPONENT_INVENTORY mancanti
**File:** `admin/public/app.js`, `admin/public/styles.css`
**Descrizione:** Nessun feedback visivo dopo operazioni (salvataggio, errori API, logout).
**Stima:** 2-3 ore
**Impatto:** Il Direttore non sa se ha salvato correttamente un dato. Confusione e doppio click.

---

### FIX-H06: Sidebar role-based — ridurre voci visibili per ruolo
**Severity:** HIGH — H-01
**File:** `admin/public/app.js`, `admin/public/index.html`
**Descrizione:** Filtrare le voci della sidebar in base a `currentUser.role`.
- Direttore: Dashboard, Servizi, Programma Giornaliero, Flotta, Turni, Report → 6 voci visibili
- Coordinatore: +GPS, +Checklist, +Disponibilità → 9 voci
- Admin IT: tutto
**Stima:** 6-8 ore (design + implementazione + test per ogni ruolo)
**Impatto:** Riduzione cognitive overload dell'60% per il Direttore.

---

### FIX-H07: Unificare font-family su Inter
**Severity:** MEDIUM → HIGH per contratto di brand
**File:** `admin/public/css/theme.css`, `admin/public/styles.css`
**Descrizione:** Rimuovere tutte le occorrenze di 'DM Sans' dal CSS della dashboard admin. L'unica font caricata è Inter.
**Stima:** 1 ora
**Impatto:** Coerenza tipografica. Fine del fallback system-ui.

---

### FIX-H08: Correggere sidebar width variabile duplicata
**Severity:** MEDIUM → HIGH
**File:** `styles.css:27` (`--sidebar-width: 280px`) e `css/theme.css` (`--sidebar-w: 220px`)
**Descrizione:** Rinominare e unificare in `--sidebar-width: 220px` in `tokens.css`.
**Stima:** 1 ora + test visivo
**Impatto:** Elimina il gap/overlap tra sidebar e main content.

---

### FIX-H09: Support mode banner con stile di rischio appropriato
**Severity:** HIGH — M-07
**File:** `admin/public/index.html:719-728`, `admin/public/styles.css`
**Descrizione:** Banner "modalità supporto tecnico" deve trasmettere rischio, non essere un info-banner neutro.
**Stima:** 1 ora
**Impatto:** Previene modifiche accidentali a dati di clienti reali.

---

### FIX-H10: Footer sidebar — differenziare logout dal banner organizzazione
**Severity:** MEDIUM → HIGH
**File:** `admin/public/index.html:649-661`
**Descrizione:** Banner org e bottone logout hanno entrambi background `#1E3A8A` — si fondono.
**Stima:** 30 minuti
**Impatto:** Il Direttore trova facilmente il logout. Riduce accessi non intenzionali.

---

## Top 10 Fix MEDIUM — Backlog Q2

| # | Fix | File | Stima | Impatto |
|---|---|---|---|---|
| M01 | Rimuovere `!important` da design-system.css usando CSS layers | `design-system.css` | 4-6h | Manutenibilità CSS |
| M02 | Aggiungere `crossorigin` al primo preconnect Google Fonts | `index.html:7` | 5 min | Performance fonti |
| M03 | Allineare auth overlay con login page (sfondo chiaro) | `index.html:23-30` | 30 min | UX first impression |
| M04 | Correggere scrollbar `#38bdf8` non-Nordic in dark mode | `styles.css:129` | 15 min | Coerenza palette |
| M05 | Aggiungere `aria-label` e `title` al panel-more-btn | `index.html:922-926` | 15 min | Accessibilità |
| M06 | Aggiungere tooltip al "/" shortcut nella sidebar search | `index.html:158` | 30 min | Discoverability |
| M07 | Chart tabs → `role="tablist"` + `role="tab"` ARIA pattern | `index.html:891-896` | 1h | WCAG |
| M08 | Confirm dialog prima di azioni distruttive | `app.js` (vari) | 3-4h | Prevenzione errori |
| M09 | Empty state component per tabelle senza dati | `app.js` + `styles.css` | 2-3h | UX dati assenti |
| M10 | Tab order management nelle nav sections collassate | `app.js:toggleNavSection` | 1h | Accessibilità keyboard |
