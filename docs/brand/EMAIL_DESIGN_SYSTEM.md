# Email Design System — Soccorso Digitale

**Versione:** 1.0
**Autore:** APOLLO (Brand Designer)
**Data:** 2026-03-28
**Supporto:** Resend (transazionali) + Campagne CRM (marketing)

---

## 1. Principi di Design Email

Le email di Soccorso Digitale seguono tre principi inviolabili:

**1. Leggibilità prima di tutto.** L'email deve essere leggibile anche senza immagini (client email aziendali bloccano spesso le immagini). Ogni email deve comunicare il 100% del messaggio in solo testo.

**2. Una sola azione per email.** Ogni email ha un solo bottone CTA principale. Se hai bisogno di più azioni, sono email separate.

**3. Mobile-first.** Il 60% delle email sanitarie viene aperto su smartphone. Max 600px larghezza, bottoni almeno 44px di altezza.

---

## 2. Template Base HTML

Struttura HTML comune a tutte le email:

```html
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>{{EMAIL_SUBJECT}}</title>
  <style>
    /* Reset */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }

    /* Base */
    body {
      margin: 0;
      padding: 0;
      background-color: #F0F4FF;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    /* Wrapper */
    .email-wrapper {
      width: 100%;
      background-color: #F0F4FF;
      padding: 32px 16px;
    }

    /* Container */
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #FFFFFF;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(12, 26, 46, 0.08);
    }

    /* Header */
    .email-header {
      background-color: #0C1A2E;
      padding: 24px 32px;
      text-align: left;
    }
    .email-header img {
      height: 32px;
      width: auto;
    }

    /* Body */
    .email-body {
      padding: 40px 32px;
    }

    /* Typography (system fonts — massima compatibilità client email) */
    h1 {
      color: #0C1A2E;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 24px;
      font-weight: bold;
      line-height: 32px;
      margin: 0 0 16px 0;
    }
    h2 {
      color: #0C1A2E;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 18px;
      font-weight: bold;
      line-height: 24px;
      margin: 24px 0 12px 0;
    }
    p {
      color: #1A2B32;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 15px;
      line-height: 24px;
      margin: 0 0 16px 0;
    }
    .text-muted {
      color: #64748B;
      font-size: 13px;
      line-height: 20px;
    }

    /* CTA Button */
    .btn-primary {
      display: inline-block;
      background-color: #1E3A8A;
      color: #FFFFFF !important;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 15px;
      font-weight: bold;
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 6px;
      min-height: 44px;
      line-height: 16px;
    }
    .btn-secondary {
      display: inline-block;
      background-color: transparent;
      color: #1E3A8A !important;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 14px;
      text-decoration: underline;
      padding: 8px 0;
    }

    /* Divider */
    .divider {
      height: 1px;
      background-color: #E2E8F0;
      margin: 24px 0;
      border: none;
    }

    /* Info box */
    .info-box {
      background-color: #F0F4FF;
      border-left: 3px solid #1E3A8A;
      padding: 16px 20px;
      margin: 16px 0;
      border-radius: 0 4px 4px 0;
    }
    .warning-box {
      background-color: #FFFBEB;
      border-left: 3px solid #F59E0B;
      padding: 16px 20px;
      margin: 16px 0;
      border-radius: 0 4px 4px 0;
    }
    .success-box {
      background-color: #F0FDF4;
      border-left: 3px solid #10B981;
      padding: 16px 20px;
      margin: 16px 0;
      border-radius: 0 4px 4px 0;
    }

    /* Data table */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
    }
    .data-table td {
      padding: 10px 12px;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 14px;
      border-bottom: 1px solid #E2E8F0;
    }
    .data-table td:first-child {
      color: #64748B;
      width: 40%;
    }
    .data-table td:last-child {
      color: #0C1A2E;
      font-weight: bold;
    }

    /* Footer */
    .email-footer {
      background-color: #F8FAFC;
      padding: 24px 32px;
      border-top: 1px solid #E2E8F0;
      text-align: center;
    }
    .footer-powered {
      color: #64748B;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      margin: 0 0 8px 0;
    }
    .footer-links a {
      color: #64748B;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      text-decoration: none;
      margin: 0 8px;
    }
    .footer-address {
      color: #94A3B8;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      margin: 8px 0 0 0;
    }

    /* Mobile responsive */
    @media only screen and (max-width: 600px) {
      .email-body { padding: 24px 16px; }
      .email-header { padding: 16px; }
      .email-footer { padding: 16px; }
      h1 { font-size: 20px; line-height: 28px; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">

      <!-- HEADER: usare logo org per email transazionali org, logo SD per email SD -->
      <div class="email-header">
        <img src="{{LOGO_URL}}" alt="{{ORG_NAME}}" height="32">
      </div>

      <!-- BODY -->
      <div class="email-body">
        {{EMAIL_CONTENT}}
      </div>

      <!-- FOOTER -->
      <div class="email-footer">
        {{FOOTER_CONTENT}}
      </div>

    </div>
  </div>
</body>
</html>
```

---

## 3. Header: Logica Logo

### Email transazionali dell'organizzazione

(Conferma prenotazione, notifiche servizio, credenziali accesso inviate dall'org al paziente/operatore)

```html
<!-- Logo dell'organizzazione + "Powered by Soccorso Digitale" nel footer -->
<div class="email-header">
  <img src="{{ORG_LOGO_URL}}" alt="{{ORG_NAME}}" height="32">
</div>
```

Footer:
```html
<p class="footer-powered">Powered by <a href="https://soccorsodigitale.app">Soccorso Digitale</a></p>
```

### Email di Soccorso Digitale

(Demo request, trial attivato, marketing, supporto SD→cliente)

```html
<!-- Logo SD -->
<div class="email-header">
  <img src="https://soccorsodigitale.app/assets/logo-white.png" alt="Soccorso Digitale" height="32">
</div>
```

Footer completo SD:
```html
<p class="footer-powered">Soccorso Digitale — La piattaforma per il trasporto sanitario</p>
<p class="footer-links">
  <a href="https://soccorsodigitale.app">Sito</a>
  <a href="https://soccorsodigitale.app/privacy">Privacy</a>
  <a href="{{UNSUBSCRIBE_URL}}">Annulla iscrizione</a>
</p>
<p class="footer-address">
  Soccorso Digitale Srl · Via [indirizzo] · Verona (VR) · P.IVA [numero]
</p>
```

---

## 4. Template 1 — Conferma Prenotazione Paziente

**From:** noreply@[org-domain].it (o nome@org.it)
**Subject:** Conferma prenotazione trasporto — {{DATE}} {{TIME}}
**Logica header:** Logo organizzazione

```html
<!-- BODY CONTENT -->
<h1>Prenotazione confermata</h1>

<p>Gentile {{PATIENT_NAME}},</p>

<p>La tua prenotazione per il trasporto sanitario è stata confermata. Di seguito i dettagli:</p>

<table class="data-table">
  <tr><td>Data</td><td>{{SERVICE_DATE}}</td></tr>
  <tr><td>Orario di ritiro</td><td>{{PICKUP_TIME}}</td></tr>
  <tr><td>Indirizzo di ritiro</td><td>{{PICKUP_ADDRESS}}</td></tr>
  <tr><td>Destinazione</td><td>{{DESTINATION}}</td></tr>
  <tr><td>Tipo di servizio</td><td>{{SERVICE_TYPE}}</td></tr>
  <tr><td>Riferimento</td><td>{{BOOKING_ID}}</td></tr>
</table>

<div class="info-box">
  <p style="margin:0; font-size:14px;"><strong>Cosa fare:</strong> Tieniti pronto 10 minuti prima dell'orario indicato. L'equipaggio ti contatterà all'arrivo.</p>
</div>

<p>Per modifiche o cancellazioni, contatta direttamente {{ORG_NAME}}:</p>
<p>📞 {{ORG_PHONE}}<br>✉️ {{ORG_EMAIL}}</p>

<hr class="divider">

<p class="text-muted">Questo messaggio è stato inviato automaticamente. Non rispondere a questa email.</p>
```

---

## 5. Template 2 — Approvazione Richiesta Demo

**From:** hello@soccorsodigitale.app
**Subject:** Demo confermata — ci vediamo {{DATE}} alle {{TIME}}
**Logica header:** Logo Soccorso Digitale

```html
<h1>La tua demo è confermata.</h1>

<p>Ciao {{FIRST_NAME}},</p>

<p>Ottimo — ci vediamo {{DATE}} alle {{TIME}} per la demo di Soccorso Digitale.</p>

<table class="data-table">
  <tr><td>Data</td><td>{{DATE}}</td></tr>
  <tr><td>Orario</td><td>{{TIME}}</td></tr>
  <tr><td>Formato</td><td>Videocall (link sotto)</td></tr>
  <tr><td>Durata</td><td>30 minuti</td></tr>
  <tr><td>Con</td><td>{{HOST_NAME}}, Soccorso Digitale</td></tr>
</table>

<p style="text-align: center; margin: 32px 0;">
  <a href="{{MEETING_LINK}}" class="btn-primary">Unisciti alla videocall</a>
</p>

<p>Prima della demo, ti chiedo di prepararti su:</p>
<ul>
  <li>Quanti mezzi gestisce la tua organizzazione?</li>
  <li>Quanti coordinatori usano gli strumenti di gestione?</li>
  <li>Qual è il problema principale che stai cercando di risolvere oggi?</li>
</ul>

<p>Non è un questionario formale — è per usare bene i nostri 30 minuti.</p>

<p>A presto,<br>
<strong>{{HOST_NAME}}</strong><br>
Soccorso Digitale · hello@soccorsodigitale.app</p>

<hr class="divider">

<p class="text-muted">Se hai bisogno di spostare la demo: <a href="{{RESCHEDULE_URL}}" style="color:#1E3A8A;">scegli un altro orario</a></p>
```

---

## 6. Template 3 — Credenziali Accesso (Nuovo Utente)

**From:** noreply@soccorsodigitale.app (o nome@org.it per utenti org)
**Subject:** Il tuo accesso a Soccorso Digitale è pronto
**Logica header:** Logo org (se utente org) o logo SD (se nuovo admin)

```html
<h1>Benvenuto in Soccorso Digitale.</h1>

<p>Ciao {{FIRST_NAME}},</p>

<p>Il tuo account è stato creato da {{INVITED_BY}}. Ecco le tue credenziali di accesso:</p>

<table class="data-table">
  <tr><td>Email</td><td>{{USER_EMAIL}}</td></tr>
  <tr><td>Password temporanea</td><td><code style="background:#F0F4FF; padding:2px 6px; border-radius:3px; font-family:Courier New,monospace;">{{TEMP_PASSWORD}}</code></td></tr>
  <tr><td>Ruolo</td><td>{{USER_ROLE}}</td></tr>
  <tr><td>Organizzazione</td><td>{{ORG_NAME}}</td></tr>
</table>

<div class="warning-box">
  <p style="margin:0; font-size:14px;"><strong>Importante:</strong> Al primo accesso ti verrà chiesto di impostare una nuova password. La password temporanea scade dopo 48 ore.</p>
</div>

<p style="text-align: center; margin: 32px 0;">
  <a href="{{LOGIN_URL}}" class="btn-primary">Accedi alla piattaforma</a>
</p>

<p>Se hai problemi di accesso, contatta il tuo amministratore o scrivi a hello@soccorsodigitale.app</p>

<hr class="divider">

<p class="text-muted">Non hai richiesto questo account? Ignora questa email o contattaci su hello@soccorsodigitale.app</p>
```

---

## 7. Template 4 — Email Marketing (Campagna CRM)

**From:** Adrian ◇ Soccorso Digitale &lt;hello@soccorsodigitale.app&gt;
**Subject:** [personalizzato per segmento — es. "Come le Misericordie di Verona hanno tagliato i tempi di coordinamento del 65%"]
**Logica header:** Logo Soccorso Digitale

```html
<h1>{{EMAIL_HEADLINE}}</h1>

<p>Ciao {{FIRST_NAME}},</p>

<p>{{PERSONALIZED_OPENING}} — una o due righe che dimostrano che conosci la loro situazione specifica.</p>

<p>{{MAIN_CONTENT}} — il valore principale dell'email. Max 3 paragrafi. Ogni paragrafo max 3 righe.</p>

<!-- Elemento visivo se applicabile: screenshot, stat, testimonial -->
<div class="info-box">
  <p style="margin:0; font-size:15px; font-style:italic;">"{{TESTIMONIAL_QUOTE}}"</p>
  <p style="margin:8px 0 0 0; font-size:13px; color:#64748B;">— {{TESTIMONIAL_NAME}}, {{TESTIMONIAL_ORG}}</p>
</div>

<p>{{CTA_CONTEXT}} — una frase che introduce il bottone.</p>

<p style="text-align: center; margin: 32px 0;">
  <a href="{{CTA_URL}}" class="btn-primary">{{CTA_TEXT}}</a>
</p>

<p>Se non è il momento giusto, nessun problema.<br>
Sarò qui quando lo sarà.</p>

<p>— {{SENDER_NAME}}<br>
<span style="color:#64748B; font-size:13px;">Soccorso Digitale · hello@soccorsodigitale.app</span></p>

<hr class="divider">

<p class="text-muted">
  Hai ricevuto questa email perché la tua organizzazione è nella nostra lista contatti del settore trasporto sanitario.
  <a href="{{UNSUBSCRIBE_URL}}" style="color:#64748B;">Annulla iscrizione</a>
</p>
```

---

## 8. Template 5 — Reset Password

**From:** noreply@soccorsodigitale.app
**Subject:** Reset password — Soccorso Digitale
**Logica header:** Logo SD sempre (non logo org, per sicurezza)

```html
<h1>Reset password</h1>

<p>Hai richiesto il reset della password per il tuo account Soccorso Digitale.</p>

<p>Clicca sul pulsante qui sotto per impostare una nuova password. Il link è valido per <strong>1 ora</strong>.</p>

<p style="text-align: center; margin: 32px 0;">
  <a href="{{RESET_URL}}" class="btn-primary">Reimposta la password</a>
</p>

<p class="text-muted">Se il pulsante non funziona, copia e incolla questo link nel browser:</p>
<p style="word-break: break-all; font-size:13px; color:#64748B;">{{RESET_URL}}</p>

<hr class="divider">

<div class="warning-box">
  <p style="margin:0; font-size:14px;">Non hai richiesto il reset della password? <strong>Ignora questa email</strong> — il tuo account è al sicuro. Se sospetti accessi non autorizzati, contattaci subito: hello@soccorsodigitale.app</p>
</div>

<p class="text-muted" style="margin-top: 16px;">Per motivi di sicurezza, questo link può essere usato una sola volta e scade dopo 1 ora.</p>
```

---

## 9. Regole di Composizione

### Layout

```
MAX WIDTH:  600px (desktop e mobile)
PADDING:    40px top/bottom, 32px laterali (body)
            16px su mobile
BORDER RADIUS: 8px (container), 6px (bottoni), 4px (box info)
```

### Tipografia email (system fonts obbligatori)

```
Titoli:  Arial, Helvetica, sans-serif — Bold
Body:    Arial, Helvetica, sans-serif — Regular
Dati:    Courier New, Courier, monospace — Regular (per codici/token)

NOTA: Non usare Sora o Inter nelle email HTML — non sono caricati
dai client email. Il web font nel <head> viene ignorato da
Gmail, Outlook, Apple Mail.
```

### Dimensioni testo

```
H1:       24px / bold
H2:       18px / bold
Body:     15px / regular / line-height 24px
Small:    13px / regular
Caption:  11px / regular
```

### Colori email approvati

```
Background pagina: #F0F4FF
Background email:  #FFFFFF
Header:            #0C1A2E
Testo primario:    #1A2B32 (non #0C1A2E per corpo — troppo duro)
Testo secondario:  #64748B
Link:              #1E3A8A
Bordi:             #E2E8F0
CTA button:        #1E3A8A (bg) + #FFFFFF (text)
Box info:          #F0F4FF (bg) + #1E3A8A (left border)
Box warning:       #FFFBEB (bg) + #F59E0B (left border)
Box success:       #F0FDF4 (bg) + #10B981 (left border)
```

---

## 10. Accessibilità e Deliverability

### Accessibilità

- **Alt text obbligatorio** su tutte le immagini: `<img alt="Logo Soccorso Digitale">`
- **Colore non come unico indicatore:** non usare solo rosso/verde per comunicare stato — affiancare sempre icona o testo
- **Contrasto:** minimo 4.5:1 per testo normale, 3:1 per testo grande
- **Bottoni:** min 44px altezza, testo descrittivo ("Accedi alla piattaforma" — non "Clicca qui")
- **Plain text version:** Resend genera automaticamente la versione plain text — verificare che sia leggibile

### Deliverability

- **Spamwords da evitare** nel subject: "GRATIS", "OFFERTA ESCLUSIVA", "100%", "Clicca qui", "Urgente!!!"
- **Ratio testo/immagini:** almeno 60% testo, max 40% immagini
- **Links:** usare sempre URL assoluti (https://...), mai redirect nascosti
- **Unsubscribe:** link di disiscrizione obbligatorio nelle email marketing (CAN-SPAM, GDPR)
- **SPF/DKIM/DMARC:** configurati su Resend per il dominio soccorsodigitale.app
- **Test deliverability:** usare Mail-Tester.com prima di ogni nuova campagna

### Pre-flight checklist per ogni email

```
[ ] Subject: max 50 caratteri, nessuna spamword
[ ] Preheader text: 85-100 caratteri, complementa il subject
[ ] Alt text su tutte le immagini
[ ] Un solo CTA principale
[ ] Link di unsubscribe presente (email marketing)
[ ] Test su Gmail / Apple Mail / Outlook prima dell'invio
[ ] Plain text version leggibile
[ ] Variabili {{}} tutte sostituite (nessuna rimasta grezza)
[ ] URL tutti assoluti e testati
```
