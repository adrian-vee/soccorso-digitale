# Component Inventory — Soccorso Digitale Admin Dashboard
**Agente:** APHRODITE — UI/UX Designer
**Data:** 2026-03-27
**Fonte:** `admin/public/index.html`, `styles.css`, `css/theme.css`, `css/design-system.css`

---

## 1. Componenti Presenti nel Codebase

### Navigazione

| Componente | Classe CSS | Stato | Note |
|---|---|---|---|
| Main Sidebar | `.main-sidebar` | Presente | Width 220px (theme.css) ma 280px in styles.css |
| Sidebar Brand | `.sidebar-brand` | Presente | Inline styles misti a classi |
| Sidebar Search | `#sidebar-search` | Presente | Funzionante con highlight |
| Nav Section | `.nav-section` | Presente | Collassabile con aria-expanded |
| Nav Section Header | `.nav-section-header` | Presente | Onclick inline JS |
| Nav Item | `.nav-item` | Presente | Bottone con SVG + span |
| Nav Badge (warning) | `.nav-badge-warning` | Presente | Solo per "Richieste Strutture" |
| Nav Badge (alert) | `.env-alerts-count` | Presente | Stile diverso da nav-badge-warning |
| Sidebar Footer | `.sidebar-footer` | Presente | Logout + org name |
| Org Filter Select | `#org-filter-select` | Presente | Solo per superadmin |
| Top Header | `.top-header` | Presente | Con mobile menu btn, title, actions |
| Mobile Menu Btn | `.mobile-menu-btn` | Presente | Solo visibile ≤1024px |
| Notification Bell | `#notification-btn` | Presente | Con badge counter |
| Notification Dropdown | `.notification-dropdown` | Presente | Non staccato come componente |
| Dark Mode Toggle | `#ds-theme-toggle` | **Rotto** | Cosmetic only, nessuna logica |
| Refresh Btn | `#refresh-btn` | Presente | |

### Dashboard / KPI

| Componente | Classe CSS | Stato | Note |
|---|---|---|---|
| Dash Filters Bar | `.dash-filters-bar` | Presente | 7/30/90gg + custom range |
| Dash Filter Button | `.dash-filter-btn` | Presente | Stile diverso da `.btn-primary` |
| Date Range Inputs | `.dash-date-input` | Presente | Stile diverso da form inputs standard |
| Location Filter Select | `#dash-location-filter` | Presente | Stile diverso da `.form-group select` |
| Env Widget | `.env-widget` | Presente | Card con emoji icon + title + body |
| KPI Card (dash) | `.dash-kpi-card` | Presente | Label + value-row + trend |
| KPI Card (org) | `.org-kpi-card` | Presente | Design diverso da dash-kpi-card |
| KPI Card (rta) | `.rta-stat-card` | Presente | Design diverso da entrambe |
| KPI Card (enterprise) | `.enterprise-kpi-card` | Presente | Design diverso da tutte le precedenti |
| KPI Card (generic) | `.kpi-card`, `.stat-card`, `.metric-card` | Presente | Fallback generico |
| Trend Indicator | `.kpi-trend` | Presente | `.up` e `.negative` come modifier |
| Chart Panel | `.dash-chart-panel` | Presente | Wrapper per canvas Chart.js |
| Chart Tabs | `.chart-tab` | Presente | Giorno/Settimana/Mese |
| Fleet Table Dark | `.fleet-table-dark` | Presente | Variante dark-theme della tabella |
| Quality Metric | `.quality-metric` | Presente | Icon + label + value |
| Support Mode Banner | `.support-mode-banner` | Presente | Solo superadmin |

### Tabelle

| Componente | Classe CSS | Stato | Note |
|---|---|---|---|
| Table (generic) | `table` | Presente | Stili in design-system.css |
| Scheduling Table | `.scheduling-table` | Presente | Turni settimanali |
| Schedule Grid Table | `#schedule-grid-table` | Presente | Turni mensili |
| Fleet Table Dark | `.fleet-table-dark` | Presente | Solo in dashboard |

**PROBLEMA:** 4 varianti di tabella con stili diversi per lo stesso tipo di dato.

### Form / Input

| Componente | Classe CSS | Stato | Note |
|---|---|---|---|
| Form Group | `.form-group` (org-admin) | Presente | Solo in org-admin/index.html |
| Login Input | `.lp-input` | Presente | Solo nella login page |
| Password Toggle | `.lp-eye` | Presente | Onclick inline JS |
| Dash Date Input | `.dash-date-input` | Presente | Stile diverso da lp-input |
| Sidebar Search Input | `#sidebar-search` | Presente | Inline style on focus/blur |
| Org Filter Select | `#org-filter-select` | Presente | Inline styled |

**PROBLEMA:** 5 diverse implementazioni di input text/select senza un componente comune.

### Bottoni

| Componente | Classe CSS | Stato | Note |
|---|---|---|---|
| Primary Button | `.btn-primary`, `button.primary` | Presente | min-height: 40px |
| Secondary Button | `.btn-secondary`, `.btn-ghost` | Presente | min-height: 36px |
| Icon Button | `.btn-icon` | Presente | No label, solo icon |
| Login Button | `.lp-btn` | Presente | Design completamente diverso |
| Dashboard Filter Btn | `.dash-filter-btn` | Presente | Design diverso da tutti |
| Chart Tab | `.chart-tab` | Presente | Micro-variant non classificata |
| Nav Item Button | `.nav-item` | Presente | Ibrido nav/btn |
| Logout Button | `#logout-btn` | Presente | Inline styled |

**PROBLEMA:** 7 diverse implementazioni di bottone senza un sistema unificato.

### Badge / Status

| Componente | Classe CSS | Stato | Note |
|---|---|---|---|
| Nav Badge Warning | `.nav-badge-warning` | Presente | Solo 1 uso (Richieste Strutture) |
| Notification Badge | `.notification-badge` | Presente | Counter numerico |
| Alert Count | `.env-alerts-count` | Presente | Duplicate class (usata anche come badge) |
| Demand Badge | `.env-demand-badge` | Presente | "+7gg" indicator |
| Weather Impact Badge | `.env-weather-impact-badge` | Presente | |
| Lock Icon PRO | Inline SVG opacity:0.45 | **Insufficiente** | Non visibile come badge PRO |

**PROBLEMA:** 6 varianti di badge/indicator con nessun sistema comune.

### Modali / Overlay

| Componente | Classe CSS | Stato | Note |
|---|---|---|---|
| Auth Loading Overlay | `#auth-loading-overlay` | Presente | Inline styled completamente |
| Mobile Overlay | `.mobile-overlay` | Presente | Backdrop per sidebar mobile |
| Notification Dropdown | `.notification-dropdown` | Presente | Non è una modal vera |

**COMPONENTI MANCANTI:** Modal/dialog per CRUD, confirm dialog, toast/snackbar system.

---

## 2. Inconsistenze Trovate

### A. 4 varianti di KPI card per lo stesso tipo di dato

```
.dash-kpi-card         → Dashboard principale (dark theme)
.org-kpi-card          → Dashboard organizzazione (light theme)
.rta-stat-card         → Disponibilità Real-time (?)
.enterprise-kpi-card   → Modal enterprise (?)
.kpi-card              → Fallback generico
```
Tutte mostrano: label + valore numerico + (opzionale) trend.
**Dovrebbe essere:** UN componente `<KpiCard>` con props variant, value, label, trend.

### B. 3 font-size per body text

- `styles.css` body: `font-size: 14px`
- `design-system.css` nav-item span: `font-size: 13px !important`
- `design-system.css` table td: `font-size: 13px !important`
- `design-system.css` table th: `font-size: 11px !important`
- `design-system.css` kpi-label: `font-size: 11px !important`

Nessuna type scale definita. Ogni componente hardcoda il proprio font-size.

### C. 2 colori per "errore" / "warning"

- `styles.css`: `--error: #E74C3C`, `--warning: #F5A623`
- Nordic Rescue: `--error: #EF4444`, `--warning: #F59E0B` (APHRODITE palette)
- Il codice usa entrambe le variabili in contesti diversi

### D. Sidebar nav usa 2 strutture diverse

**Operational nav** (org admin): sezioni collassabili con `data-section` e `localStorage`
**Platform nav** (superadmin): sezioni collassabili con `data-section` ma stili `--section-color` inline

Stesso pattern strutturale ma implementato due volte con differenze sottili.

### E. Tabella generica vs tabella dark

`table` con stili in `design-system.css` (sfondo chiaro, hover `#F0F4FF`)
`.fleet-table-dark` con stili propri (sfondo dark, usata solo in dashboard-dark)

L'utente che va da Dashboard (dark) a Servizi (light) vede tabelle completamente diverse per lo stesso tipo di dato.

---

## 3. Componenti Mancanti

| Componente | Perché Serve | Priorità |
|---|---|---|
| **Toast / Snackbar** | Nessun feedback visivo dopo salvataggio form, logout, errori API | CRITICAL |
| **Modal / Dialog** | Ogni conferma CRUD richiede un pattern consistente | HIGH |
| **Empty State** | Tabelle vuote mostrano solo `<!-- Populated by JS -->` | HIGH |
| **Loading Skeleton** | Nessun skeleton screen — dati mostrano "0" o "--" durante fetch | HIGH |
| **PRO Badge** | Badge visibile per features premium | HIGH |
| **Breadcrumb** | Con 46 voci in sidebar, l'utente perde orientamento | HIGH |
| **Tooltip** | Icone senza label, abbreviazioni non spiegate | MEDIUM |
| **Confirm Dialog** | Eliminazione dati senza double-check visivo | MEDIUM |
| **Error State** | Form con errori senza evidenziazione field-level | MEDIUM |
| **Pagination** | Tabelle con dati infiniti senza controllo paginazione visibile | MEDIUM |
| **Date Picker** | `<input type="date">` nativo — aspetto inconsistente cross-browser | LOW |
| **Multi-select** | Filter select multipli non esistono | LOW |
| **Tag / Chip** | Per categorie, status, filtri attivi | LOW |
