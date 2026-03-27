# Design System Spec — Soccorso Digitale Admin Dashboard
**Agente:** APHRODITE — UI/UX Designer
**Data:** 2026-03-27
**Status:** Specifica v1.0 — per migrazione da vanilla JS a React + shadcn/ui

---

## Raccomandazione Architetturale

### Migrare a React + shadcn/ui — Raccomandato

**Motivazione:**

| Criterio | Vanilla JS Attuale | React + shadcn/ui |
|---|---|---|
| Manutenibilità | ❌ 3 file da 90K righe | ✅ Componenti isolati |
| Accessibilità | ❌ Manuale, incompleta | ✅ Radix UI primitivi ARIA-compliant |
| Design consistency | ❌ 5 CSS files in conflitto | ✅ CSS variables + Tailwind |
| Performance | ❌ 841KB HTML monolitico | ✅ Code splitting per route |
| Developer experience | ❌ Nessuna tipizzazione UI | ✅ TypeScript components |
| Time to market nuove features | Lento (CSS war) | Veloce (componenti riusabili) |

**shadcn/ui è la scelta corretta perché:**
1. I componenti sono **copiati nel progetto** — zero lock-in, piena personalizzazione
2. Radix UI primitivi garantiscono WCAG AA out-of-the-box (fondamentale per contratti PA)
3. Il progetto usa già TypeScript — stack coerente
4. Tailwind CSS + CSS variables = easy token override per Nordic Rescue palette

**Strategia di migrazione:** Strangler Fig — migrare modulo per modulo, non big bang.
Priorità: Auth → Dashboard → Sidebar → Sezioni operative → Sezioni avanzate

---

## 1. Design Tokens

### Colori

```css
/* tokens.css — Single source of truth */
:root {
  /* ── Brand ── */
  --color-brand-primary:   #1E3A8A;   /* Navy — primary action */
  --color-brand-accent:    #F59E0B;   /* Amber — highlights, PRO badges */
  --color-brand-bg:        #F0F4FF;   /* Lavender — page background */
  --color-brand-dark:      #0C1A2E;   /* Midnight — heading text */
  --color-brand-muted:     #64748B;   /* Slate — secondary text */
  --color-brand-success:   #10B981;   /* Emerald — success states */
  --color-brand-danger:    #EF4444;   /* Red — error, danger actions */

  /* ── Neutrals ── */
  --color-white:           #FFFFFF;
  --color-gray-50:         #F8FAFC;
  --color-gray-100:        #F1F5F9;
  --color-gray-200:        #E2E8F0;
  --color-gray-300:        #CBD5E1;
  --color-gray-400:        #94A3B8;
  --color-gray-500:        #64748B;   /* = brand-muted */
  --color-gray-600:        #475569;
  --color-gray-700:        #334155;
  --color-gray-800:        #1E293B;
  --color-gray-900:        #0F172A;

  /* ── Semantic ── */
  --color-surface:         #FFFFFF;
  --color-surface-raised:  #FFFFFF;
  --color-surface-overlay: rgba(12,26,46,0.5);
  --color-border:          #E2E8F0;
  --color-border-strong:   #CBD5E1;
  --color-text-primary:    #0C1A2E;   /* = brand-dark */
  --color-text-secondary:  #64748B;   /* = brand-muted */
  --color-text-tertiary:   #94A3B8;
  --color-text-inverse:    #FFFFFF;

  /* ── Interactive ── */
  --color-focus-ring:      #1E3A8A;
  --color-focus-ring-dark: #93C5FD;   /* per sfondo scuro sidebar */

  /* ── Sidebar specifico ── */
  --color-sidebar-bg:      #FFFFFF;
  --color-sidebar-border:  #E2E8F0;
  --color-sidebar-item-hover: #F0F4FF;
  --color-sidebar-item-active: #EEF2FF;
  --color-sidebar-item-active-text: #1E3A8A;
}
```

### Tipografia

```css
:root {
  /* Font */
  --font-family-base: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-family-mono: 'JetBrains Mono', 'Fira Code', Consolas, monospace;

  /* Scale */
  --font-size-xs:   11px;   /* caption, badge, table header */
  --font-size-sm:   12px;   /* secondary meta, timestamps */
  --font-size-base: 13px;   /* nav items, table cells, form labels */
  --font-size-md:   14px;   /* body text, button default */
  --font-size-lg:   16px;   /* card titles, modal headers */
  --font-size-xl:   20px;   /* page sub-headers */
  --font-size-2xl:  24px;   /* page titles */
  --font-size-3xl:  32px;   /* KPI values */
  --font-size-4xl:  40px;   /* hero KPI */

  /* Weight */
  --font-weight-normal:   400;
  --font-weight-medium:   500;
  --font-weight-semibold: 600;
  --font-weight-bold:     700;
  --font-weight-extrabold: 800;

  /* Line height */
  --line-height-tight:  1.25;
  --line-height-snug:   1.375;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.625;
}
```

### Spacing

```css
:root {
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
}
```

### Border Radius

```css
:root {
  --radius-sm:   4px;   /* badge, chip, input */
  --radius-md:   8px;   /* button, input */
  --radius-lg:  10px;   /* card */
  --radius-xl:  12px;   /* modal, sidebar brand logo */
  --radius-2xl: 16px;   /* large card */
  --radius-full: 9999px; /* pill badge */
}
```

### Shadows

```css
:root {
  --shadow-xs: 0 1px 2px rgba(12,26,46,0.04);
  --shadow-sm: 0 1px 3px rgba(12,26,46,0.06), 0 1px 2px rgba(12,26,46,0.04);
  --shadow-md: 0 4px 6px rgba(12,26,46,0.07), 0 2px 4px rgba(12,26,46,0.05);
  --shadow-lg: 0 10px 15px rgba(12,26,46,0.08), 0 4px 6px rgba(12,26,46,0.04);
  --shadow-xl: 0 20px 25px rgba(12,26,46,0.1), 0 8px 10px rgba(12,26,46,0.05);
  /* Focus ring */
  --shadow-focus: 0 0 0 3px rgba(30,58,138,0.25);
}
```

---

## 2. Componenti Base

### Button

**Varianti:** `primary` | `secondary` | `danger` | `ghost` | `link`
**Sizes:** `sm` (32px) | `md` (40px) | `lg` (48px)
**States:** default | hover | active | disabled | loading

```tsx
// React + shadcn/ui
<Button variant="primary" size="md">
  <PlusIcon size={16} />
  Aggiungi Servizio
</Button>

<Button variant="danger" size="sm" disabled>
  Elimina
</Button>

<Button variant="ghost" size="md" loading>
  <Spinner size={16} />
  Caricamento...
</Button>
```

**CSS Spec:**
```css
.btn-primary {
  background: var(--color-brand-primary);    /* #1E3A8A */
  color: var(--color-text-inverse);
  min-height: 40px;
  padding: 0 var(--space-5);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  border-radius: var(--radius-md);
  transition: background 0.15s;
}
.btn-primary:hover  { background: #1e40af; }
.btn-primary:active { background: #1e3a8a; transform: scale(0.98); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-danger {
  background: var(--color-brand-danger);     /* #EF4444 */
  color: var(--color-text-inverse);
}

.btn-secondary {
  background: var(--color-surface);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.btn-ghost {
  background: transparent;
  color: var(--color-brand-primary);
}
```

---

### Card

**Varianti:** `default` | `raised` | `dark` | `interactive`

```css
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5) var(--space-6);
  box-shadow: var(--shadow-sm);
}
.card--raised { box-shadow: var(--shadow-md); }
.card--dark   { background: #0C1A2E; border-color: rgba(255,255,255,0.08); }
.card--interactive:hover {
  border-color: var(--color-brand-primary);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
  transition: all 0.15s;
}
```

---

### KPI Card

**Unico componente** che sostituisce le 5 varianti esistenti.

```tsx
<KpiCard
  label="Servizi Totali"
  value={1247}
  trend={{ value: '+12%', direction: 'up' }}
  variant="default"   // "default" | "dark" | "accent"
  icon={<TruckIcon />}
  lastUpdate="2 min fa"
/>
```

```css
.kpi-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5) var(--space-6);
  min-height: 110px;
}
.kpi-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-secondary);
  margin-bottom: var(--space-2);
}
.kpi-value {
  font-size: var(--font-size-3xl);   /* 32px */
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  line-height: var(--line-height-tight);
}
/* Trend: usare ICONA + colore (non solo colore) per accessibilità */
.kpi-trend--up   { color: var(--color-brand-success); }
.kpi-trend--up::before { content: "↑ "; }
.kpi-trend--down { color: var(--color-brand-danger); }
.kpi-trend--down::before { content: "↓ "; }
```

---

### Badge

**Varianti:** `default` | `success` | `warning` | `danger` | `info` | `pro`

```css
.badge {
  display: inline-flex;
  align-items: center;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  line-height: 1.4;
}
.badge--success  { background: #ECFDF5; color: #065F46; }
.badge--warning  { background: #FFFBEB; color: #92400E; }
.badge--danger   { background: #FEF2F2; color: #991B1B; }
.badge--info     { background: #EFF6FF; color: #1E40AF; }
.badge--pro      { background: var(--color-brand-accent); color: var(--color-brand-dark); }
/* PRO badge sempre uppercase */
.badge--pro::before { content: ""; }
```

---

### Table

**Unica variante** con modifier dark per dashboard.

```css
.table { width: 100%; border-collapse: collapse; }
.table thead tr { border-bottom: 1px solid var(--color-border); }
.table th {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-secondary);
  padding: var(--space-3) var(--space-4);
  text-align: left;
}
.table td {
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
}
.table tbody tr:hover td { background: var(--color-sidebar-item-hover); }
/* Dark variant per dashboard */
.table--dark th { background: var(--color-brand-primary); color: var(--color-text-inverse); }
.table--dark td { color: rgba(255,255,255,0.85); border-color: rgba(255,255,255,0.06); }
.table--dark tbody tr:hover td { background: rgba(255,255,255,0.04); }
```

---

### Modal / Dialog

```tsx
<Modal open={isOpen} onClose={() => setIsOpen(false)} title="Aggiungi Servizio">
  <Modal.Body>
    {/* Form content */}
  </Modal.Body>
  <Modal.Footer>
    <Button variant="ghost" onClick={() => setIsOpen(false)}>Annulla</Button>
    <Button variant="primary" onClick={handleSubmit}>Salva</Button>
  </Modal.Footer>
</Modal>
```

**CSS Rules:**
- Backdrop: `rgba(12,26,46,0.5)` con blur `4px`
- Dialog: max-width 560px, border-radius `var(--radius-xl)`, padding `var(--space-6)`
- Trap focus: implementato via Radix UI Dialog primitive
- Close on Escape: nativo Radix
- `aria-modal="true"`, `role="dialog"`, `aria-labelledby` su titolo

---

### Form Inputs

**Unico sistema** che sostituisce le 5 implementazioni esistenti.

```css
.input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  font-family: var(--font-family-base);
  color: var(--color-text-primary);
  background: var(--color-surface);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.input:focus {
  outline: none;
  border-color: var(--color-brand-primary);
  box-shadow: var(--shadow-focus);
}
.input::placeholder { color: var(--color-text-tertiary); } /* #94A3B8 — WCAG AA compliant */
.input:disabled { opacity: 0.5; cursor: not-allowed; background: var(--color-gray-100); }
.input--error { border-color: var(--color-brand-danger); }
.input--error:focus { box-shadow: 0 0 0 3px rgba(239,68,68,0.2); }
```

**Input con error state:**
```html
<div class="form-field">
  <label for="email" class="form-label">Email</label>
  <input id="email" class="input input--error" aria-describedby="email-error" aria-invalid="true">
  <p id="email-error" class="form-error" role="alert">
    <svg aria-hidden="true">...</svg>
    Inserisci un indirizzo email valido
  </p>
</div>
```

---

### Toast / Snackbar

**Posizione:** bottom-right, stack verticale
**Varianti:** `success` | `error` | `warning` | `info`
**Auto-dismiss:** 4s (success/info), 8s (error), no auto-dismiss (warning con azione)

```tsx
// API
toast.success('Servizio salvato con successo');
toast.error('Errore durante il salvataggio. Riprova.');
toast.warning('Modifica non salvata.', {
  action: { label: 'Salva ora', onClick: handleSave }
});
```

---

### Toggle / Switch

```css
/* Stato checked: colore brand-primary, non solo colore verde generico */
.toggle:checked { background: var(--color-brand-primary); }
/* Label sempre visibile per accessibilità — no toggle senza label */
```

---

### Tooltip

```css
.tooltip {
  font-size: var(--font-size-xs);
  background: var(--color-brand-dark);   /* #0C1A2E */
  color: var(--color-text-inverse);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  max-width: 200px;
  /* Implementare con Radix UI Tooltip per accessibilità */
}
```

---

## 3. Layout Patterns

### Page Layout

```
┌──────────────────────────────────────────────────────────┐
│ Top Header (60px)                                        │
│ [Menu] [Page Title + Last Update]   [Notifiche] [Toggle] │
├──────────────────────────────────────────────────────────┤
│ Sidebar (220px)  │  Main Content Area                    │
│                  │  ┌────────────────────────────────┐   │
│  Brand           │  │ Page Header                    │   │
│  ─────────       │  │ H1 + subtitle + CTAs           │   │
│  Search /        │  ├────────────────────────────────┤   │
│  ─────────       │  │ KPI Grid (4-6 cards)           │   │
│  Nav sections    │  ├────────────────────────────────┤   │
│                  │  │ Content (Table / Chart / Form) │   │
│  [Footer]        │  └────────────────────────────────┘   │
│  [Org Name]      │                                        │
│  [Logout]        │                                        │
└──────────────────────────────────────────────────────────┘
```

### KPI Grid

```css
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4);
}
/* Tablet: 2 colonne */
@media (max-width: 1024px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
}
/* Mobile: 1 colonna */
@media (max-width: 640px) {
  .kpi-grid { grid-template-columns: 1fr; }
}
```

### Page Header

```html
<header class="page-header">
  <div class="page-header__title">
    <h1 class="page-title">Servizi</h1>
    <p class="page-subtitle">127 servizi completati negli ultimi 30 giorni</p>
  </div>
  <div class="page-header__actions">
    <Button variant="secondary" size="sm">
      <DownloadIcon size={14} />
      Esporta CSV
    </Button>
    <Button variant="primary" size="md">
      <PlusIcon size={16} />
      Nuovo Servizio
    </Button>
  </div>
</header>
```

---

## 4. Stati Componenti

| Componente | default | hover | active/pressed | disabled | loading | error | empty |
|---|---|---|---|---|---|---|---|
| Button | ✅ | ✅ | ✅ | ✅ | ✅ | n/a | n/a |
| Input | ✅ | ✅ border | ✅ focus ring | ✅ | n/a | ✅ red border | ✅ placeholder |
| Card | ✅ | ✅ (interactive) | n/a | n/a | ✅ skeleton | n/a | ✅ empty state |
| Table | ✅ | ✅ row hover | n/a | n/a | ✅ skeleton rows | ✅ error state | ✅ empty state |
| Badge | ✅ | n/a | n/a | n/a | n/a | n/a | n/a |
| Nav item | ✅ | ✅ bg-blue | ✅ active bold | ✅ opacity 0.5 | n/a | n/a | n/a |
| Toggle | ✅ | ✅ | ✅ checked | ✅ | n/a | n/a | n/a |

---

## 5. Sidebar Spec Aggiornata

```
Larghezza: 220px (fissa su desktop)
Background: #FFFFFF
Border-right: 1px solid #E2E8F0
Font: Inter 13px

Brand area: 80px altezza
  - Logo: 44×44px border-radius 10px
  - Nome: 15px bold #0C1A2E
  - Subtitle: 10px uppercase #64748B

Search: 36px altezza, border-radius 8px, bg #F8FAFC

Nav section header: 36px, font-size 10px uppercase, color #94A3B8
Nav item: min-height 40px (tablet: 44px), padding 10px 12px 10px 16px
  - Icon: 20×20px aria-hidden
  - Label: 13px #0C1A2E
  - Active: bg #EEF2FF, color #1E3A8A, font-weight 600
  - Hover: bg #F0F4FF
  - PRO badge: amber, 9px, uppercase, border-radius 4px

Footer:
  - Org banner: bg #1E3A8A, border-radius 10px
  - Logout: bg transparent, border 1px solid #E2E8F0, color #0C1A2E
    hover: bg #FEF2F2, border-color #EF4444, color #EF4444

Mobile (≤1024px):
  - Sidebar off-screen (transform translateX(-100%))
  - Apertura via hamburger menu
  - Backdrop overlay rgba(12,26,46,0.5)
  - Close on backdrop click e su Escape
```

---

## 6. Decisione Migrazione: React + shadcn/ui

**Timeline raccomandato:**
1. **Mese 1:** Setup shadcn/ui + tokens CSS, migrare pagina Login
2. **Mese 2:** Sidebar + Top Header
3. **Mese 3:** Dashboard KPI + Charts
4. **Mese 4-5:** Sezioni operative (Servizi, Flotta, Turni)
5. **Mese 6+:** Sezioni avanzate (CRM, ESG, SPID)

**Strategia di coesistenza:**
- React app servita su `/admin/v2/` mentre vanilla JS rimane su `/admin/`
- Switch progressivo per organizzazione (Croce Europa come pilota)
- Nessun downtime — migrazione trasparente per l'utente

**Componenti shadcn/ui da installare subito:**
```bash
npx shadcn-ui@latest add button card badge input label
npx shadcn-ui@latest add dialog alert-dialog toast
npx shadcn-ui@latest add table dropdown-menu
npx shadcn-ui@latest add tooltip popover
npx shadcn-ui@latest add select checkbox switch
```
