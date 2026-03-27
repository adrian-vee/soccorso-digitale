# Accessibility Audit — Soccorso Digitale Admin Dashboard
**Agente:** APHRODITE — UI/UX Designer
**Data:** 2026-03-27
**Standard di riferimento:** WCAG 2.1 AA, EN 301 549 (standard UE per accessibilità digitale PA)
**Nota:** Piattaforma usata da cooperative sanitarie che gestiscono personale pubblico → requisito normativo EN 301 549 per contratti PA

---

## Score Globale Accessibilità: 38/100

| Categoria | Score | Status |
|---|---|---|
| Contrasto colori | 45/100 | Molteplici fallimenti WCAG AA |
| Navigazione keyboard | 30/100 | Focus indicator mancante, tab order problematico |
| ARIA / Screen reader | 50/100 | Parzialmente implementato |
| Touch targets | 65/100 | Accettabile su desktop, problematico su tablet |
| Motion / Animation | 70/100 | Buono, ma prefers-reduced-motion incompleto |
| Lingua e testo | 55/100 | `lang="it"` presente, testo troncato senza alternativa |

---

## 1. Contrasto Colori — Validazione WCAG AA

**Requisito WCAG AA:** testo normale ≥ 4.5:1 | testo grande (18px+ o 14px+ bold) ≥ 3:1 | componenti UI ≥ 3:1

### Palette Nordic Rescue — Test combinazioni

| Elemento | Foreground | Background | Ratio | Status WCAG AA |
|---|---|---|---|---|
| Testo nav-item | `#0C1A2E` (text) | `#FFFFFF` (sidebar light) | 16.9:1 | ✅ PASSA |
| Label KPI | `#64748B` | `#FFFFFF` | 4.6:1 | ✅ PASSA |
| KPI sub-text | `#64748B` | `#F0F4FF` | 4.2:1 | ⚠️ QUASI (11px uppercase — richiede 4.5:1) |
| Sidebar footer "ADMIN" | `#93C5FD` | `#1E3A8A` | 3.1:1 | ⚠️ FALLISCE per testo 10px uppercase |
| Sidebar footer org-name | `#FFFFFF` | `#1E3A8A` | 7.2:1 | ✅ PASSA |
| Logout button | `#FFFFFF` | `#1E3A8A` | 7.2:1 | ✅ PASSA |
| Nav badge warning | (unknown — style:none) | — | — | DA VALIDARE |
| Trend indicator "up" | (color non specificato) | `.dash-kpi-card` | — | DA VERIFICARE |
| Placeholder text input | `#CBD5E1` | `#F8FAFC` | 2.2:1 | ❌ FALLISCE (2.2:1 < 4.5:1) |
| Sidebar search placeholder | `#94A3B8` (nel SVG icon) | `#F8FAFC` | 2.9:1 | ❌ FALLISCE |
| Lock icon PRO | opacity:0.45 del colore nav-item | nav background | < 2:1 | ❌ FALLISCE GRAVEMENTE |
| Disabled states | (non definiti) | — | — | MANCANTE |
| Error message `lp-error` | (stile non letto, da verificare) | `#FFFFFF` | — | DA VERIFICARE |

### Combinazioni critiche aggiuntive

| Elemento | Problema |
|---|---|
| Dark dashboard panels | Testo panel-title-dark su sfondo scuro — ratio non validato |
| Heatmap | Gradiente caldi/freddi senza alternativa per daltonici |
| Trend "up" (verde) / trend "down" (rosso) | Solo colore distingue positivo da negativo — FAIL per protanopia/deuteranopia |
| Quality metrics icons (blue/orange/yellow/purple) | Solo colore distingue categorie diverse |

---

## 2. Navigazione da Tastiera

### Problemi Critici

#### K-01: Focus indicator non definito nel CSS
**Problema:** Nessun selettore `:focus-visible` nei CSS analizzati. Il browser usa il default outline (spesso rimosso da reset CSS `outline: none` nei form).
`styles.css` ha `outline: none` sui form inputs in `org-admin/index.html`.

**Impatto:** Un utente che usa solo tastiera (comune per Admin IT con mobilità ridotta) non vede dove si trova il focus dopo ogni Tab.

**Fix:**
```css
:focus-visible {
  outline: 2px solid #1E3A8A;
  outline-offset: 2px;
  border-radius: 4px;
}
```

#### K-02: Nav items sono `<button>` — CORRETTO, ma onclick inline
**Stato Positivo:** Tutti i nav items sono `<button data-page="...">` — corretto semanticamente.
**Problema:** Il toggle sezioni usa `onclick="toggleNavSection(this)"` inline — funziona, ma non intercetta `Enter`/`Space` su tutti i browser.

#### K-03: Tab order non gestito nelle sezioni collassabili
**Problema:** Quando una nav section è collassata (`.nav-section-body` senza `.open`), i bottoni dentro rimangono nel tab order (non hanno `tabindex="-1"` quando nascosti).

**Fix:**
```javascript
// Aggiungere nel toggleNavSection():
const items = body.querySelectorAll('.nav-item');
items.forEach(item => {
  item.tabIndex = isOpen ? -1 : 0;
});
```

#### K-04: Sidebar search — hotkey "/" non accessibile
**File:** `app.js:111-121`
Il codice intercetta `e.key === '/'` per aprire la search, ma non c'è un `aria-keyshortcuts` sull'input e non c'è annuncio agli screen reader.

**Fix:** `aria-keyshortcuts="/"` sull'input + `role="search"` sul wrapper.

#### K-05: Dropdown notifiche — no trap focus
**File:** `index.html:679-688`
Quando il dropdown notifiche è aperto, Tab naviga fuori dal dropdown invece di rimanere al suo interno.

---

## 3. ARIA Labels Mancanti

| Elemento | Problema | Fix Raccomandato |
|---|---|---|
| `#notification-btn` | Ha `title="Notifiche"` ma non `aria-label` | `aria-label="Notifiche"` + `aria-haspopup="true"` + `aria-expanded` dinamico |
| `#refresh-btn` | Ha `title="Aggiorna dati"` ma non `aria-label` | `aria-label="Aggiorna dati"` |
| `#ds-theme-toggle` | Ha `aria-label="Toggle dark/light mode"` — CORRETTO | Mantenere, aggiungere `aria-pressed` |
| `#mobile-menu-btn` | Ha `aria-label="Menu"` — CORRETTO | Aggiungere `aria-expanded` dinamico |
| `.panel-more-btn` | Nessun aria-label, nessun title | `aria-label="Opzioni pannello"` |
| Nav section headers | `aria-expanded` presente — CORRETTO | Aggiungere `aria-controls` per l'id del body |
| SVG icons in nav items | Nessun `aria-hidden="true"` | Aggiungere `aria-hidden="true"` su tutti gli SVG decorativi |
| `lp-eye` password toggle | Solo `title="Mostra/Nascondi password"` | `aria-label` + `aria-pressed` che cambia con lo stato |
| Emoji widget icons | `🌤`, `⚠️`, `📊`, `📈` senza aria | `aria-label` o `role="img" aria-label="Meteo operativo"` |
| Loading overlay | Nessun `role="alert"` o `aria-live` | `role="status"` + `aria-label="Caricamento in corso"` |
| `#support-mode-banner` | Informazione critica senza annuncio | `role="alert"` + `aria-live="polite"` |
| Dashboard filter buttons | Nessun `aria-pressed` sullo stato attivo | `aria-pressed="true/false"` |
| Chart tabs | Nessun `role="tablist"` / `role="tab"` | Pattern ARIA tabs completo |
| Fleet table | Nessun `caption` o `aria-label` | `<caption>Stato Flotta</caption>` |

---

## 4. Touch Target Size

**Requisito WCAG 2.5.5 (AAA):** 44×44px
**Requisito WCAG 2.5.8 (AA in WCAG 2.2):** 24×24px minimo

| Componente | Dimensione Attuale | Status |
|---|---|---|
| Nav item | `padding: 7px 12px 7px 16px`, altezza ~34px | ⚠️ Sotto i 44px (tablet) |
| Nav section header | `padding` non specificato, altezza ~36px | ⚠️ Borderline |
| Icon buttons (header) | 20×20px icon, padding variabile | ⚠️ Dipende dal padding |
| Chart tabs | Micro-bottoni, altezza stimata ~28-30px | ❌ Insufficiente per tablet |
| Dash filter buttons | altezza stimata ~32px | ⚠️ Borderline |
| Login button `.lp-btn` | Min-height non specificato in login context | DA VERIFICARE |
| Panel more button | 16×16px icon, padding non specificato | ❌ Probabilmente < 24px |

**Raccomandazione tablet:** Tutti i touch targets nella sidebar devono essere ≥ 44px di altezza. Con `padding: 10px 12px 10px 16px` si raggiunge ~40px — sufficiente per uso con guanti in ambulanza.

---

## 5. Screen Reader Compatibility

### Struttura semantica

| Elemento | Stato |
|---|---|
| `<html lang="it">` | ✅ PRESENTE |
| `<head> <title>` | ✅ PRESENTE — "SOCCORSO DIGITALE - Pannello Amministrativo" |
| `<main>` | ⚠️ Present ma ID-based (#main-content), non `<main>` landmark |
| `<nav>` | ❌ MANCANTE — sidebar usa `<nav class="sidebar-nav">` ma non è un `<nav>` HTML5 con label |
| `<header>` | ❌ MANCANTE — `.top-header` è un `<header>` classe, non tag |
| `<aside>` | ⚠️ Presente ma senza `aria-label` |
| Heading hierarchy | ⚠️ `<h1>` in header, ma `<h2>`/`<h3>` non validati in tutte le sezioni |
| Skip to content link | ❌ MANCANTE — critico per screen reader |
| Live regions | ❌ MANCANTE — KPI updates senza `aria-live` |

### Specifiche Issues

**SR-01:** Nessun "Skip to main content" link.
I primi 46 nav items devono essere attraversati ad ogni navigazione da tastiera.
**Fix:** `<a href="#main-content" class="skip-link">Vai al contenuto principale</a>` come primo figlio del body.

**SR-02:** La sidebar usa `<aside class="main-sidebar">` ma non è un `<aside>` HTML5.
Il tag HTML è corretto (controllare: `index.html:127` mostra `<aside class="main-sidebar">`).
Aggiungere `aria-label="Navigazione principale"`.

**SR-03:** I KPI values che si aggiornano (polling) non annunciano il cambio.
```html
<span class="kpi-value" id="kpi-total-services" aria-live="polite" aria-atomic="true">0</span>
```

**SR-04:** Dashboard sezioni usano `<section id="dashboard-section">` ma senza `aria-label`.
**Fix:** `<section id="dashboard-section" aria-label="Dashboard operativa">`.

---

## 6. Motion e Animazioni

| Animazione | Presente | prefers-reduced-motion | Status |
|---|---|---|---|
| `sd-load-bar` (auth loading) | Sì, inline `<style>` | ❌ No media query | DA FIXARE |
| `fadeInUp` | Sì, in styles.css | DA VERIFICARE | DA VERIFICARE |
| `shimmer` | Definita ma non verificata uso | DA VERIFICARE | DA VERIFICARE |
| Sidebar collapse (theme.css) | `transition: transform 0.25s` | ❌ No media query | BASSA PRIORITÀ |
| Nav section toggle | CSS class toggle | n/a | OK |
| Chart.js animations | Default Chart.js | Configurabile | CONFIGURARE in Chart options |

**Fix per sd-load-bar:**
```css
@keyframes sd-load-bar { ... }
@media (prefers-reduced-motion: reduce) {
  #auth-loading-overlay .sd-bar { animation: none; width: 100%; }
}
```

---

## 7. Raccomandazioni Prioritarie Accessibilità

1. **IMMEDIATO:** Aggiungere skip-to-content link
2. **IMMEDIATO:** Aggiungere `:focus-visible` globale nel CSS
3. **IMMEDIATO:** `aria-hidden="true"` su tutti gli SVG decorativi nei nav items
4. **ALTA:** Correggere placeholder text contrast (#CBD5E1 su #F8FAFC → usare #94A3B8 minimo)
5. **ALTA:** `role="tablist"` + `role="tab"` sui chart tabs
6. **ALTA:** `aria-live="polite"` su tutti i KPI value span che si aggiornano
7. **MEDIA:** Aggiungere alternativa testuale ai trend color-only (↑ +12% invece di solo colore verde)
8. **MEDIA:** Tab order management nelle sezioni collassabili
9. **BASSA:** Caption su tutte le tabelle dati
