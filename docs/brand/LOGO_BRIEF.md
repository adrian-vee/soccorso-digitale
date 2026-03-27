# Logo Brief — Soccorso Digitale

**Versione:** 1.0
**Autore:** APOLLO (Brand Designer)
**Data:** 2026-03-28
**Destinatario:** Designer/Illustratore per finalizzazione logo

---

## 1. Contesto del Progetto

Soccorso Digitale è una piattaforma SaaS B2B per cooperative di trasporto sanitario e organizzazioni di volontariato (Croce Rossa, Misericordie, cooperative private). Clienti: direttori e coordinatori operativi di organizzazioni da 5 a 200 persone.

Il logo deve funzionare su:
- Header sito web (su sfondo `#DFEAE8` chiaro e su `#0B2E50` scuro)
- Sidebar dashboard web (sfondo `#FFFFFF`)
- App mobile (sfondo bianco e splash screen)
- Email transazionali e marketing
- Documenti PDF, contratti, fatture
- Materiali fisici: roll-up fiere, brochure, biglietti da visita
- Favicon 16×16px

---

## 2. Il Concept del Logo

### Messaggio da comunicare

In ordine di priorità:
1. **Affidabilità** — siamo un sistema su cui si fa affidamento in situazioni di emergenza
2. **Tecnologia sanitaria** — siamo digitali, siamo health, non siamo la banca né una startup gaming
3. **Modernità** — non siamo il vecchio gestionale degli anni 2000
4. **Italianità professionale** — non siamo una generica piattaforma USA tradotta

### Cosa NON deve comunicare

- ❌ Eccessiva freddezza hi-tech (no AI robot aesthetic)
- ❌ Vecchio mondo healthcare (no logo ospedaliero tradizionale)
- ❌ Startuppiness esagerata (no gradient mesh, no glitch effect)
- ❌ Corporate anonimità (no logo generico che potrebbe essere qualsiasi azienda)

### Il simbolo

La croce sanitaria è il simbolo universale del soccorso. Non può essere ignorata — ma deve essere reinterpretata in chiave digitale senza perdere il suo valore semantico immediato.

**Concetto proposto: Cross + Signal**

Una croce sanitaria con angoli arrotondati (radius generoso, stile iOS/moderno) dalla cui estremità superiore o dal centro si irradiano 2-3 linee curve concentriche — come un segnale WiFi o le onde di un monitor cardiaco lette in forma circolare. Le linee evocano simultaneamente:
- Connessione digitale / rete
- Propagazione / raggiungimento (l'ambulanza arriva ovunque)
- Vitalità / battito cardiaco
- Il segnale GPS che traccia i mezzi

**Proporzioni simbolo:**
- La croce occupa il 60% del bounding box
- Le linee segnale occupano il 30-40% restante, uscendo dall'angolo superiore destro
- Il tutto è racchiudibile in un cerchio o quadrato con angoli arrotondati

### Alternativa secondaria: Cross + Network nodes

Croce sanitaria dove le estremità terminano con piccoli nodi/punti connessi da linee sottili — evoca una rete, i nodi sono i mezzi, le linee sono i percorsi. Più astratta, più tech, meno immediatamente "sanitario".

---

## 3. Wordmark

**Font:** Sora SemiBold (600)

**Testo:** "Soccorso Digitale"

**Trattamento:** Considera di differenziare "Digitale" dall'resto — stesso font, stesso peso, ma magari con un leggero cambio di colore (`#1F6583` per "Digitale" quando il logo è su fondo chiaro) che comunica la dualità soccorso/digitale.

**Alternativa wordmark abbreviato:** "SD" in Sora 700 per contesti dove lo spazio è limitato ma si vuole più del solo simbolo.

### Spaziatura

```
[SIMBOLO]  [S o c c o r s o  D i g i t a l e]
    ↕             ↕
   gap = 12px    letter-spacing: -0.02em
```

---

## 4. Varianti Richieste

### 4.1 Logo Primario (Orizzontale)

```
[Simbolo 40×40px]  [SOCCORSO DIGITALE]
```

Uso: header sito, header email, presentazioni.
File: `logo-primary.svg`, `logo-primary@2x.png`, `logo-primary@4x.png`

### 4.2 Logo Verticale (Stacked)

```
      [Simbolo 48×48px]
   SOCCORSO DIGITALE
```

Uso: formato quadrato, social media, cover presentazione.
File: `logo-vertical.svg`, `logo-vertical@2x.png`

### 4.3 Icona Sola

Solo il simbolo senza wordmark.

Uso: favicon, app icon, avatar social, watermark su PDF, badge in sidebar.
File: `icon.svg`, `icon@2x.png`, `icon@4x.png`, `favicon.ico`, `app-icon-1024.png`

### 4.4 Wordmark Solo

Solo "SOCCORSO DIGITALE" senza simbolo.

Uso: spazi molto stretti in orizzontale (max 200px larghezza), template email senza spazio per icona.
File: `wordmark.svg`, `wordmark@2x.png`

---

## 5. Versioni Colore

### 5.1 Standard (su sfondo chiaro)

- Simbolo: `#0B2E50` (Navy Deep)
- "Soccorso": `#1A2B32` (Ink)
- "Digitale": `#1F6583` (Teal Dark) — differenziazione cromatica leggera

Background: `#DFEAE8`, `#FFFFFF`, o qualsiasi sfondo chiaro

### 5.2 Invertita (su sfondo scuro)

- Simbolo: `#5EB0BB` (Teal Light) — il simbolo prende il colore accent
- "Soccorso Digitale": `#FFFFFF`

Background: `#0B2E50`, `#1A2B32`, o qualsiasi sfondo scuro

### 5.3 Monocromo Nero

- Tutto: `#000000`
- Uso: stampa B/N, ricami, incisioni, timbri

### 5.4 Monocromo Bianco

- Tutto: `#FFFFFF`
- Uso: overlay su foto, materiali fotografici, sfondo colorato pieno

### 5.5 Favicon / App Icon

```
┌─────────────────┐
│                 │
│  BG: #0B2E50   │
│                 │
│  [Simbolo]      │
│  bianco #FFF   │
│                 │
└─────────────────┘
```

---

## 6. Specifiche Tecniche per il File

### SVG (master)

- Tutti i path convertiti in outline (no text/font dependencies)
- No clipping mask non necessari
- Gruppi nominati: `#symbol`, `#wordmark`, `#tagline`
- ViewBox: `0 0 [width] 40` per versione orizzontale
- Colori come variabili CSS (`--color-primary`, `--color-accent`) per theming programmatico

### PNG

- `@1x`: 240×40px (orizzontale)
- `@2x`: 480×80px
- `@4x`: 960×160px
- Background trasparente (`alpha channel`)
- Export da Figma o Sketch: "export at 1x, 2x, 4x"

### Favicon

- `favicon.ico`: multi-size (16×16, 32×32, 48×48) nel singolo file ICO
- `favicon-16x16.png`
- `favicon-32x32.png`
- `apple-touch-icon.png`: 180×180px
- `android-chrome-192x192.png`
- `android-chrome-512x512.png`

### App Icon (React Native / Store)

- `app-icon-1024.png`: 1024×1024px, no alpha channel (App Store requirement)
- Simbolo centrato con padding 10% su sfondo `#0B2E50`

---

## 7. Riferimenti Stilistici

### Cosa amiamo di questi loghi

**Stripe (2020+)**
- Geometria pulita, simbolo gradiente che evoca movimento e direzione
- Wordmark in font custom con personalità sottile
- Funziona perfettamente a 16px come a 1000px

**Linear**
- Simbolo astratto ma immediatamente "tech"
- Monochrome-first: progettato per funzionare in un solo colore
- Proporzioni tight, nessuno spreco di spazio

**Notion**
- La "n" stilizzata è semplice ma non scontata
- Funziona come icona app senza perdere identità
- Versatile: su sfondo bianco, nero, colorato

**Panda Health** (healthcare tech)
- Equilibrio raro tra "healthcare" e "tech moderno"
- Non usa la croce ma comunica sanità attraverso la paletta e il tratto

### Cosa vogliamo evitare

- ❌ Loghi healthcare anni '90 con croce rossa thick stroke e testo serif
- ❌ Gradient mesh / aurora ai aesthetic
- ❌ Simboli troppo complessi che non leggono a 16px
- ❌ Font con troppa personalità — Sora è la scelta, no sperimentazioni

---

## 8. File da Consegnare

```
logo/
├── primary/
│   ├── logo-primary.svg              ← Master vettoriale
│   ├── logo-primary-light.svg        ← Versione invertita
│   ├── logo-primary@1x.png
│   ├── logo-primary@2x.png
│   ├── logo-primary@4x.png
│   ├── logo-primary-light@1x.png
│   ├── logo-primary-light@2x.png
│   └── logo-primary-light@4x.png
├── vertical/
│   ├── logo-vertical.svg
│   ├── logo-vertical-light.svg
│   ├── logo-vertical@2x.png
│   └── logo-vertical-light@2x.png
├── icon/
│   ├── icon.svg
│   ├── icon-light.svg
│   ├── icon@2x.png
│   ├── icon@4x.png
│   ├── favicon.ico
│   ├── favicon-16x16.png
│   ├── favicon-32x32.png
│   ├── apple-touch-icon.png
│   ├── android-chrome-192x192.png
│   └── android-chrome-512x512.png
├── wordmark/
│   ├── wordmark.svg
│   ├── wordmark@2x.png
│   └── wordmark-light@2x.png
└── app-icon/
    └── app-icon-1024.png             ← Store submission
```

---

## 9. Processo di Approvazione

1. **Concept sketch** (greyscale, 3 opzioni) → Review Adrian → Feedback
2. **Raffinamento 1** (2 opzioni colore) → Review Adrian → Scelta direzione
3. **Logo completo** (tutte le varianti, tutte le versioni colore) → Review finale
4. **Consegna file** (struttura cartelle come sopra) → Merge in `public/` del sito

Timeline stimata: 2 settimane da approvazione concept.

---

## 10. Note per il Designer

Il contesto operativo di SD è importante da tenere a mente mentre si lavora al logo:

I coordinatori delle cooperative vedono questo logo ogni mattina quando aprono la dashboard alle 7:30. Gli autisti lo vedono sull'app prima di ogni servizio. I direttori lo vedono sui report che portano in CDA.

Il logo deve dare un senso di **solidità e competenza** — come il logo di un'azienda di cui ti fidi per cose che contano davvero. Non deve essere "carino" o "creativo" fini a se stessi. Deve essere **corretto**.
