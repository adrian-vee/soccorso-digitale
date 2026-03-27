# Brand Guidelines — Soccorso Digitale

**Versione:** 1.0
**Autore:** APOLLO (Brand Designer)
**Data:** 2026-03-28

---

## 1. Fondamenta del Brand

### Mission

> Rendere ogni cooperativa di trasporto sanitario efficiente quanto un grande ospedale — indipendentemente dalla dimensione.

Soccorso Digitale esiste per eliminare il divario tecnologico tra le grandi strutture sanitarie e le migliaia di piccole organizzazioni di volontariato e cooperative che muovono ogni giorno milioni di pazienti attraverso l'Italia. Non vendiamo software — diamo agli operatori sanitari il tempo e gli strumenti per concentrarsi su ciò che conta: i pazienti.

### Vision

> L'infrastruttura digitale del trasporto sanitario italiano. Entro il 2030, ogni ambulanza in Italia parte con Soccorso Digitale.

### Positioning Statement

Per i **direttori e coordinatori di cooperative di trasporto sanitario** che oggi gestiscono turni e servizi con Excel e WhatsApp, Soccorso Digitale è la **piattaforma operativa SaaS** che automatizza la gestione quotidiana, predice la domanda con AI e garantisce compliance normativa — a differenza dei gestionali generici come Zucchetti che non parlano il linguaggio del trasporto sanitario.

### Valori Brand

| Valore | Descrizione | Come si manifesta |
|---|---|---|
| **Affidabilità** | Il sistema non si rompe mai. Mai. | UI stabile, nessuna feature beta in produzione, SLA 99.9% |
| **Chiarezza** | Ogni informazione nel posto giusto, al momento giusto | Zero clutter, gerarchia visiva rigorosa, zero ambiguità |
| **Efficienza** | Un click dove prima ci volevano 10 | Workflow ottimizzati, shortcuts, azioni batch |
| **Rispetto** | Per il tempo degli operatori e la dignità dei pazienti | Privacy by design, dati sensibili oscurati correttamente |
| **Crescita** | La piattaforma cresce con l'organizzazione | Marketplace moduli, API aperte, scalabilità |

---

## 2. Tone of Voice

### Carattere della voce

Soccorso Digitale parla come un **collega senior competente e diretto** — non come un consulente corporate né come uno startup hipster.

| Siamo | Non siamo |
|---|---|
| Diretti e concreti | Vaghi o prolissi |
| Tecnici quando serve, semplici sempre | Eccessivamente tecnici o eccessivamente semplificati |
| Rassicuranti ma non paternalistici | Condiscendenti o saccenti |
| Formali senza essere freddi | Formali e distaccati |
| Italiani — non traduciamo dall'inglese | Inglesizzati o forzatamente internazionali |

### Regole di scrittura

**1. Frasi corte.** Massimo 20 parole per frase nei titoli, 30 per il body copy.

**2. Voce attiva.** "Il sistema invia la notifica" — non "La notifica viene inviata dal sistema."

**3. Numeri concreti.** "Risparmia 2 ore ogni giorno" — non "Risparmia tempo significativo".

**4. No jargon americano.** "Piano professionale" — non "Professional tier". "Analisi" — non "Insights" nella UI italiana.

**5. Empatia operativa.** Sappiamo che coordinare 30 turni con 15 mezzi è difficile. Lo diciamo.

### Esempi di tone of voice

| Contesto | ❌ NON scrivere | ✅ Scrivere |
|---|---|---|
| Onboarding | "Welcome aboard! 🚀 Let's get you started!" | "Benvenuto. Configura la tua organizzazione in 15 minuti." |
| Errore sistema | "Oops! Something went wrong." | "Qualcosa non ha funzionato. Riprova — se il problema persiste, scrivi a hello@soccorsodigitale.app" |
| Feature nuova | "Exciting new feature unlocked! 🎉" | "Nuova funzionalità: turni ricorrenti. Configura una volta, il sistema pianifica per settimane." |
| Email marketing | "We're revolutionizing healthcare logistics!" | "I coordinatori di Croce Europa risparmiano 2 ore ogni giorno. Ecco come." |
| Prezzi | "Starting from just €79/month" | "Piano Base: €79/mese. Tutto il necessario per organizzazioni fino a 20 mezzi." |

---

## 3. Sistema Colori

### Palette Sito Web (soccorsodigitale.app)

Ispirata al mare del Nord Italia — acque del Garda, cieli di fine estate. Calma, professionalità, tecnologia.

```
┌─────────────────────────────────────────────────────────────────┐
│  PALETTE SITO                                                   │
├─────────────┬──────────┬──────────────────────────────────────  │
│  Nome       │  Hex     │  Uso                                   │
├─────────────┼──────────┼──────────────────────────────────────  │
│  Sage White │ #DFEAE8  │ Background principale pagine           │
│  Teal Light │ #5EB0BB  │ Accent, CTA secondari, highlight       │
│  Teal Dark  │ #1F6583  │ Titoli h2/h3, link, icone              │
│  Navy Deep  │ #0B2E50  │ Sidebar, header, hero section bg       │
│  Ink        │ #1A2B32  │ Testo corpo principale                 │
│  Sage Muted │ #808976  │ Testi secondari, label, caption        │
│  Stone      │ #C4C8C7  │ Bordi, separatori, placeholder input  │
└─────────────┴──────────┴──────────────────────────────────────  │
```

**Ratio di contrasto (WCAG 2.1):**
- `#1A2B32` su `#DFEAE8` → 10.2:1 ✅ AAA
- `#FFFFFF` su `#0B2E50` → 12.8:1 ✅ AAA
- `#FFFFFF` su `#1F6583` → 4.9:1 ✅ AA
- `#5EB0BB` su `#DFEAE8` → 3.1:1 ⚠️ Solo per decorativo/large text

**Gerarchie compositive sito:**

```
Background:   #DFEAE8
Cards:        #FFFFFF
Testo:        #1A2B32 (primario) / #808976 (secondario)
Titoli:       #0B2E50 (H1) / #1F6583 (H2-H3)
CTA primario: #1F6583 bg + #FFFFFF text
CTA accento:  #5EB0BB bg + #0B2E50 text
Bordi:        #C4C8C7
```

### Palette Dashboard — Nordic Rescue

Per l'interfaccia operativa degli utenti. Alta leggibilità, zero fatica visiva su lunghi turni di lavoro.

```
┌─────────────────────────────────────────────────────────────────┐
│  PALETTE DASHBOARD (Nordic Rescue)                              │
├─────────────┬──────────┬──────────────────────────────────────  │
│  Nome       │  Hex     │  Uso                                   │
├─────────────┼──────────┼──────────────────────────────────────  │
│  Pure White │ #FFFFFF  │ Sidebar background, cards              │
│  Ice Blue   │ #F0F4FF  │ Page background                        │
│  Navy       │ #1E3A8A  │ Primary: pulsanti, link attivi         │
│  Amber      │ #F59E0B  │ Urgenza: badge, alert medium           │
│  Sky Blue   │ #DBEAFE  │ Accent: hover, selected state          │
│  Dark       │ #0C1A2E  │ Testo principale                       │
│  Slate      │ #64748B  │ Testo secondario, metadata             │
│  Border     │ #E2E8F0  │ Separatori, bordi card                 │
│  Success    │ #10B981  │ Stato OK, completato, attivo           │
│  Danger     │ #EF4444  │ Errore, critico, cancellato            │
└─────────────┴──────────┴──────────────────────────────────────  │
```

**Colori semantici dashboard (non modificare):**
```
Servizio attivo:     #10B981 (verde)
Servizio in ritardo: #F59E0B (ambra)
Servizio urgente:    #EF4444 (rosso)
Servizio futuro:     #1E3A8A (navy)
Servizio completato: #64748B (slate)
Mezzo OK:           #10B981
Mezzo in manutenzione: #F59E0B
Mezzo offline:       #64748B
```

### Gradienti approvati

```
Gradient Hero (sito):
  from: #0B2E50  to: #1F6583
  direction: 135deg

Gradient CTA (sito):
  from: #1F6583  to: #5EB0BB
  direction: 90deg

Gradient Card highlight (dashboard):
  from: #1E3A8A  to: #3B5FAF
  direction: 135deg
```

### Colori da NON usare

- ❌ Rosso puro (`#FF0000`) — troppo aggressivo per brand sanitario
- ❌ Verde lime — associato a brand gaming, non healthcare
- ❌ Arancione brillante — troppo energico, disturba l'atmosfera di fiducia
- ❌ Qualsiasi colore non della palette sopra senza approvazione esplicita

---

## 4. Tipografia

### Font System

**Titoli (Display + Heading):** `Sora`
- Google Fonts, gratuito, ottimizzato per schermi
- Carattere: geometrico, moderno, tecnico ma caldo
- Pesi usati: 600 (SemiBold), 700 (Bold)
- Alternative se Sora non disponibile: `Inter`, `DM Sans`

**Corpo testo (Body):** `Inter`
- Lo standard de facto per SaaS moderno — leggibilità insuperabile a qualsiasi dimensione
- Pesi usati: 400 (Regular), 500 (Medium), 600 (SemiBold)
- Alternative: system-ui, -apple-system, sans-serif

**Dati e codice (Monospace):** `JetBrains Mono`
- Per numeri in tabelle, codici identificativi, timestamp, dati tecnici
- Peso usato: 400 (Regular)
- Alternative: `Roboto Mono`, `Courier New`

### Scale tipografica

```
Display XL:  Sora 700, 56px/64px — Hero headline principale
Display L:   Sora 700, 48px/56px — Sezioni hero
H1:          Sora 700, 40px/48px — Titoli pagina
H2:          Sora 600, 32px/40px — Titoli sezione
H3:          Sora 600, 24px/32px — Titoli sottosezione
H4:          Sora 600, 20px/28px — Label sezione card
Body L:      Inter 400, 18px/28px — Paragrafi principali
Body M:      Inter 400, 16px/24px — Testo standard
Body S:      Inter 400, 14px/20px — Label, caption, meta
Caption:     Inter 400, 12px/16px — Note legali, footnote
Data:        JetBrains Mono 400, 14px/20px — Numeri, ID, codici
```

### Regole tipografiche

- **Letter-spacing:** -0.01em per heading grandi (> 24px), 0 per body
- **Line-length ottimale:** 60-75 caratteri per riga (corpo testo)
- **NO testo giustificato** — sempre left-align (RTL non supportato)
- **Massimo 2 font in una composizione** — mai usare tutti e tre insieme
- **Gerarchia visiva:** non superare 3 livelli di gerarchia in un componente

---

## 5. Logo System

### Anatomia del logo

Il logo di Soccorso Digitale è composto da:

1. **Simbolo (Icona):** Una croce sanitaria stilizzata con angoli arrotondati, integrata con un elemento grafico che evoca connettività digitale (segnale, rete, dato). Il simbolo deve leggere come "tecnologia sanitaria" anche senza il testo.

2. **Wordmark:** "Soccorso Digitale" in Sora 600. Due righe o una sola a seconda della variante. Il peso SemiBold bilancia la pulizia moderna con la serietà istituzionale.

3. **Tagline (opzionale):** "La piattaforma per il trasporto sanitario" in Inter 400, usata solo in contesti editoriali ampi.

### Proporzioni e clear space

```
┌──────────────────────────────────────────┐
│                                          │
│   [X]  [  SOCCORSO DIGITALE  ]          │
│   ↕X        ↕X                          │
│                                          │
│   X = altezza dell'icona                │
│   Clear space = 1X su tutti i lati      │
│                                          │
└──────────────────────────────────────────┘
```

- **Dimensione minima logo completo:** 120px larghezza (digitale), 30mm (stampa)
- **Dimensione minima icona sola:** 16px (favicon), 24px (UI)
- **Clear space:** almeno 1× l'altezza dell'icona su ogni lato

### Varianti del logo

| Variante | Uso | Colori |
|---|---|---|
| **Primaria** (icona + wordmark orizzontale) | Header sito, materiali marketing principali | Icona `#0B2E50`, testo `#1A2B32` su sfondo chiaro |
| **Invertita** | Header dashboard, footer, bg scuro | Icona + testo `#FFFFFF` su `#0B2E50` |
| **Monocromo nero** | Stampa B/N, embossing | `#000000` su bianco |
| **Monocromo bianco** | Materiali fotografici, overlay | `#FFFFFF` su qualsiasi bg scuro |
| **Icona sola** | Favicon, app icon, avatar social, watermark | Icona `#FFFFFF` su bg `#0B2E50` |
| **Verticale** | Format quadrato, social media profile | Icona sopra + wordmark sotto |

### DO — Cosa fare

- ✅ Usare sempre i file vettoriali SVG come sorgente
- ✅ Mantenere le proporzioni originali (nessuno stretching)
- ✅ Assicurare il clear space minimo sempre
- ✅ Usare la versione invertita su sfondi scuri
- ✅ Testare la leggibilità su tutti i fondi prima di pubblicare

### DON'T — Cosa non fare mai

- ❌ Cambiare i colori del logo fuori dalle varianti approvate
- ❌ Aggiungere ombre, glow, gradient al logo
- ❌ Ruotare o inclinare il logo
- ❌ Scalare il solo wordmark senza l'icona (o viceversa, eccetto variante icona sola)
- ❌ Posizionare il logo su foto senza overlay che garantisca contrasto sufficiente
- ❌ Usare versioni lossy (JPEG) del logo
- ❌ Ricreare il logo da zero — usare sempre i file master

---

## 6. Iconografia

### Set icone sidebar e UI

Il set icone di Soccorso Digitale segue queste regole:

- **Stile:** Line icons (outline), stroke weight 1.5px, angoli arrotondati (radius 2px)
- **Grid:** 24×24px base, 20×20px per UI compatta
- **Colori:** mono (eredita dal colore testo genitore) — mai colori fissi nelle icone UI
- **Libreria base:** Lucide Icons (open source, MIT) come foundation
- **Icone custom:** per concetti specifici EMS non coperti da Lucide

**Icone custom necessarie (da disegnare):**
- Ambulanza vista laterale (sidebar flotta)
- Barella (tipo servizio)
- Croce sanitaria (brand symbol)
- Paziente seduto in sedia a rotelle
- Dialisi (rene stilizzato)
- Ossigeno (bombola)
- Defibrillatore
- Radiocomunicazione

### Illustrazioni

Stile: **flat geometrico** con palette brand. Non realistico, non cartoonesco.

Usate per:
- Empty states ("Nessun servizio oggi — buona giornata!")
- Onboarding step illustrations
- Feature cards nel sito marketing
- Error pages (404, 500)

---

## 7. Fotografia

### Direzione fotografica

SD usa fotografia autentica — non stock photo patinata. Il target sono professionisti del settore che riconoscono immediatamente il falso.

**Stile:**
- **Ambiente:** Reale — ambulanze vere, ospedali veri, operatori in divisa vera
- **Luce:** Naturale o ambientale (non studio)
- **Composizione:** Orientata all'azione, non alla posa
- **Post-processing:** Leggero. Contrasto naturale, non HDR, non filtri Instagram

**Soggetti approvati:**
- Operatori sanitari al lavoro (con consenso esplicito)
- Ambulanze in movimento o al carico
- Control room / postazione coordinatore con dashboard visibile
- Strutture sanitarie italiane reali

**Soggetti da evitare:**
- Pazienti identificabili (privacy)
- Situazioni di emergenza reale (etico + legale)
- Stock photo americane (ambulanze gialle, ospedali USA)
- Immagini di incidenti o sangue

### Color grading su foto

Quando la foto appare su sfondo brand:
```
Overlay: #0B2E50 con opacity 60-75%
→ la foto diventa "tonalizzata navy"
→ il testo bianco sopra è sempre leggibile
```

---

## 8. Applicazioni — Layout Compositi

### Hero section sito

```
[BG: #0B2E50 con overlay foto ambulanza navy-tinted]
[PADDING: 120px top/bottom, 80px laterali]

[Logo: versione invertita bianca]

[H1: Sora 700, 56px, #FFFFFF]
"La piattaforma intelligente
per il trasporto sanitario"

[Body: Inter 400, 18px, rgba(255,255,255,0.80)]
"Gestisci turni, servizi e flotta.
In un solo posto."

[CTA primario: bg #5EB0BB, text #0B2E50, Sora 600, 18px]
[ Inizia la prova gratuita ]

[CTA secondario: outline bianco, text #FFFFFF]
[ Guarda la demo ]
```

### Card su sfondo chiaro (#DFEAE8)

```
[Card: bg #FFFFFF, border-radius 12px, shadow 0 2px 16px rgba(11,46,80,0.08)]
[Padding: 24px]
[Icona: 40×40px, colore #1F6583]
[H4: Sora 600, 20px, #0B2E50]
[Body: Inter 400, 14px, #808976]
[Border bottom opzionale: 1px solid #C4C8C7]
```

### Tabella prezzi

```
[Card Base]        [Card PRO — featured]     [Card Enterprise]
bg: #FFFFFF        bg: #0B2E50               bg: #FFFFFF
border: #C4C8C7   border: none              border: #C4C8C7
                   badge: "Più scelto"
                   badge bg: #5EB0BB
```

---

## 9. Motion e Animazioni

Per UI e sito:

| Elemento | Durata | Easing | Note |
|---|---|---|---|
| Hover su pulsante | 150ms | ease-out | Scale 1.02, shadow intensifica |
| Hover su card | 200ms | ease-out | Translate Y -2px |
| Apertura modal/drawer | 250ms | ease-out | Slide from bottom/right |
| Toast notification | 300ms entrata, 200ms uscita | ease-in-out | Slide from top |
| Transizione pagina | 200ms | ease-in-out | Fade |
| Skeleton loading | 1500ms loop | ease-in-out | Pulse animazione |

**Regola generale:** Nessuna animazione > 400ms in un'interfaccia operativa. Gli operatori non hanno tempo.

---

## 10. Versioni e Aggiornamenti

Questo documento è versionato insieme al codice in `docs/brand/`.

| Versione | Data | Cambiamenti |
|---|---|---|
| 1.0 | 2026-03-28 | Prima versione completa |

Per modifiche alla palette, tipografia o logo: richiedere review ad APOLLO prima di implementare qualsiasi cambiamento. Cambiamenti di brand non approvati verranno revertiti.
