import PDFDocument from "pdfkit";
import { Response } from "express";
import fs from "fs";
import path from "path";

const BLUE = "#0066CC";
const GREEN = "#00A651";
const RED = "#C41E3A";
const DARK = "#1A1A1A";
const GRAY = "#555555";
const LIGHT = "#F8F9FA";
const BORDER = "#E0E0E0";

export function generateUserManualPDF(res: Response) {
  const doc = new PDFDocument({ 
    size: [420, 595],
    margins: { top: 40, bottom: 40, left: 36, right: 36 },
    bufferPages: true,
    info: {
      Title: "Guida Utente App - SOCCORSO DIGITALE v3.0",
      Author: "Soccorso Digitale",
    }
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="Guida_Utente_App_v3.0.pdf"');
  doc.pipe(res);

  const W = 420;
  const M = 36;
  const CW = W - M * 2;
  let y = 40;
  let pageNum = 0;
  const PAGE_BOTTOM = 530;

  function drawPageBg() {
    doc.rect(0, 0, W, 595).fill("#FFFFFF");
    doc.rect(0, 0, W, 6).fill(BLUE);
    doc.rect(0, 589, W, 6).fill(GREEN);
  }

  function newPage() {
    doc.addPage();
    pageNum++;
    drawPageBg();
    y = 40;
  }

  function space(h: number = 12) { y += h; }

  function ensureSpace(h: number) {
    if (y + h > PAGE_BOTTOM) newPage();
  }

  function title(text: string) {
    doc.fontSize(22).fillColor(DARK).font("Helvetica-Bold").text(text, M, y, { width: CW, align: "center" });
    y += 30;
  }

  function subtitle(text: string) {
    doc.fontSize(10).fillColor(GRAY).font("Helvetica").text(text, M, y, { width: CW, align: "center" });
    y += 18;
  }

  function divider() {
    ensureSpace(20);
    doc.moveTo(M + 60, y).lineTo(M + CW - 60, y).lineWidth(1).stroke(BORDER);
    y += 16;
  }

  function sectionHeader(num: string, text: string) {
    ensureSpace(120);
    y += 8;
    doc.rect(M, y, CW, 28).fill(LIGHT);
    doc.rect(M, y, 4, 28).fill(BLUE);
    doc.fontSize(11).fillColor(BLUE).font("Helvetica-Bold").text(num, M + 14, y + 8);
    doc.fontSize(11).fillColor(DARK).font("Helvetica-Bold").text(text, M + 32, y + 8);
    y += 40;
  }

  function label(text: string) {
    ensureSpace(40);
    doc.fontSize(9).fillColor(BLUE).font("Helvetica-Bold").text(text, M + 8, y);
    y += 14;
  }

  function para(text: string) {
    ensureSpace(30);
    doc.fontSize(9).fillColor(GRAY).font("Helvetica").text(text, M + 8, y, { width: CW - 16, lineGap: 4 });
    y = doc.y + 10;
  }

  function stepList(items: string[]) {
    items.forEach((item, i) => {
      ensureSpace(26);
      doc.fontSize(9).fillColor(BLUE).font("Helvetica-Bold").text(`${i + 1}.`, M + 12, y);
      doc.fontSize(9).fillColor(DARK).font("Helvetica").text(item, M + 28, y, { width: CW - 40 });
      y = doc.y + 8;
    });
  }

  function bulletList(items: string[]) {
    items.forEach(item => {
      ensureSpace(24);
      doc.fontSize(9).fillColor(BLUE).font("Helvetica-Bold").text("\u2022", M + 12, y);
      doc.fontSize(9).fillColor(DARK).font("Helvetica").text(item, M + 26, y, { width: CW - 38 });
      y = doc.y + 6;
    });
  }

  function infoBox(type: "info" | "warning", text: string) {
    ensureSpace(58);
    const color = type === "info" ? BLUE : RED;
    const lbl = type === "info" ? "NOTA" : "IMPORTANTE";
    doc.rect(M + 8, y, CW - 16, 44).fill(LIGHT);
    doc.rect(M + 8, y, 3, 44).fill(color);
    doc.fontSize(8).fillColor(color).font("Helvetica-Bold").text(lbl, M + 20, y + 8);
    doc.fontSize(8).fillColor(GRAY).font("Helvetica").text(text, M + 20, y + 20, { width: CW - 44, lineGap: 3 });
    y += 54;
  }

  function tableRow(col1: string, col2: string, isHeader: boolean = false) {
    ensureSpace(24);
    const bg = isHeader ? LIGHT : "#FFFFFF";
    const textColor = isHeader ? BLUE : DARK;
    const font = isHeader ? "Helvetica-Bold" : "Helvetica";
    doc.rect(M + 8, y, CW - 16, 20).fill(bg);
    doc.rect(M + 8, y, CW - 16, 20).lineWidth(0.5).stroke(BORDER);
    doc.fontSize(8).fillColor(textColor).font(font).text(col1, M + 16, y + 6, { width: 120 });
    doc.fontSize(8).fillColor(GRAY).font("Helvetica").text(col2, M + 140, y + 6, { width: CW - 160 });
    y += 20;
  }

  drawPageBg();
  pageNum = 1;

  // =====================
  // COVER PAGE
  // =====================
  const logoPath = path.join(process.cwd(), "assets", "images", "app-icon-ios.png");
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, W / 2 - 35, y, { width: 70 });
    y += 80;
  } else {
    space(10);
  }

  title("SOCCORSO DIGITALE");
  subtitle("GUIDA UTENTE APP MOBILE");
  space(4);
  doc.fontSize(9).fillColor(GREEN).font("Helvetica-Bold").text("Versione 3.0 - Febbraio 2026", M, y, { width: CW, align: "center" });
  y += 20;

  space(6);
  divider();
  space(6);

  para("Questa guida descrive le funzionalita dell'applicazione mobile per gli equipaggi. L'app permette di registrare i servizi di trasporto, compilare le checklist di controllo del veicolo, gestire le scadenze dei materiali e molto altro.");

  space(4);
  infoBox("info", "Questa guida e destinata a tutto il personale operativo (equipaggi). Per il pannello amministrativo web, fare riferimento alla documentazione per amministratori.");

  // =====================
  // SECTION 01: INSTALLAZIONE
  // =====================
  sectionHeader("01", "INSTALLAZIONE E PRIMO ACCESSO");

  label("Come installare l'app");
  stepList([
    "Scansiona il QR code fornito dal tuo coordinatore con la fotocamera del telefono",
    "Oppure apri il link diretto ricevuto dal coordinatore",
    "Se richiesto, consenti l'installazione dell'app",
    "Al termine, l'app sara disponibile sul tuo telefono"
  ]);
  space(4);
  infoBox("info", "L'app e scaricabile anche dal sito soccorsodigitale.app nella sezione Download. Basta toccare il pulsante di download e seguire le istruzioni sullo schermo.");

  space(6);
  label("Accesso all'app");
  stepList([
    "Apri l'applicazione",
    "Inserisci email e password fornite dal tuo coordinatore o amministratore",
    "Tocca 'Accedi'"
  ]);
  space(4);
  infoBox("info", "Ogni ambulanza ha le sue credenziali. Quando accedi, il sistema riconosce automaticamente il veicolo, la sede e l'organizzazione. Attiva 'Ricorda credenziali' per non doverle reinserire ogni volta.");

  // =====================
  // SECTION 02: HOME
  // =====================
  sectionHeader("02", "SCHERMATA HOME");
  para("La schermata principale ti da una panoramica immediata della situazione:");
  space(4);
  bulletList([
    "Saluto con il codice del tuo veicolo (es. 'Buongiorno, J30')",
    "Nome della tua organizzazione e sede operativa",
    "Stato connessione: Online o Offline",
    "Equipaggio del turno attuale",
    "Widget Heartbeat: statistiche del veicolo in tempo reale",
    "Widget Consegne: ultimo passaggio consegne ricevuto",
    "Avviso materiali: se ci sono materiali scaduti o in scadenza",
    "Stato checklist: se la checklist giornaliera e stata completata",
    "Km totali del veicolo"
  ]);
  space(4);
  infoBox("warning", "Se sulla Home compare un avviso ROSSO o ARANCIONE per i materiali, verifica le scadenze il prima possibile dalla sezione apposita nel Profilo.");

  // =====================
  // SECTION 03: NAVIGAZIONE
  // =====================
  sectionHeader("03", "NAVIGAZIONE DELL'APP");
  para("La barra in basso ti permette di accedere alle sezioni principali:");
  space(4);
  tableRow("Icona", "Funzione", true);
  tableRow("Casa (Home)", "Panoramica, avvisi, stato veicolo");
  tableRow("Lista (Viaggi)", "Elenco di tutti i servizi effettuati");
  tableRow("+ (Inserisci)", "Registrazione di un nuovo servizio");
  tableRow("Persona (Profilo)", "Checklist, scadenze, impostazioni e altro");

  // =====================
  // SECTION 04: INSERIMENTO NUOVO SERVIZIO
  // =====================
  sectionHeader("04", "INSERIMENTO NUOVO SERVIZIO");
  para("Questa e la funzione principale dell'app. Ogni servizio di trasporto va registrato qui.");
  space(4);

  label("Come inserire un nuovo servizio");
  stepList([
    "Tocca il pulsante '+' (Inserisci) dalla barra in basso",
    "Compila la data e gli orari di partenza e rientro",
    "Seleziona il tipo di servizio (dialisi, dimissione, trasferimento, visita, ecc.)",
    "Seleziona la composizione dell'equipaggio",
    "Indica il luogo di partenza (origine)",
    "Indica il luogo di arrivo (destinazione)",
    "Compila genere (M/F) e anno di nascita del paziente",
    "Aggiungi eventuali note se necessario",
    "Tocca 'Salva Servizio'"
  ]);

  space(6);
  label("Tipi di localita");
  tableRow("Tipo", "Cosa fare", true);
  tableRow("Ospedale", "Seleziona la struttura e il reparto dalla lista");
  tableRow("CDR", "Seleziona la casa di riposo dalla lista");
  tableRow("Sede", "Sede operativa del veicolo");
  tableRow("Domicilio", "Inserisci l'indirizzo del paziente");

  space(6);
  label("Calcolo chilometri");
  para("I chilometri vengono calcolati automaticamente dal sistema in base al percorso stradale reale tra origine e destinazione.");
  infoBox("info", "Solo al primo servizio del veicolo e necessario inserire manualmente i km iniziali leggendoli dal contachilometri. Da quel momento il calcolo sara automatico.");

  space(4);
  label("Servizio senza paziente");
  para("Se il servizio non prevede il trasporto di un paziente (es. trasferimento mezzo, rifornimento, manutenzione), seleziona 'SENZA PAZIENTE' come tipo di servizio. Tutti i movimenti del veicolo vanno registrati.");

  // =====================
  // SECTION 05: ELENCO SERVIZI
  // =====================
  sectionHeader("05", "ELENCO SERVIZI");
  label("Consultare i servizi");
  stepList([
    "Tocca 'Viaggi' dalla barra in basso",
    "Scorri la lista per vedere tutti i servizi registrati",
    "Tocca un servizio per vedere il dettaglio completo con mappa del percorso"
  ]);
  space(6);
  label("Modificare un servizio");
  stepList([
    "Dalla lista, tocca il servizio da modificare",
    "Tocca il pulsante 'Modifica'",
    "Apporta le modifiche necessarie",
    "Tocca 'Salva'"
  ]);

  // =====================
  // SECTION 06: CHECKLIST PRE-PARTENZA
  // =====================
  sectionHeader("06", "CHECKLIST PRE-PARTENZA");
  para("La checklist va compilata obbligatoriamente all'inizio di ogni turno per verificare lo stato del veicolo e delle dotazioni di bordo.");
  space(4);

  label("Come compilare la checklist");
  stepList([
    "Vai su Profilo e tocca 'Checklist Pre-Partenza' (pulsante blu)",
    "I materiali sono organizzati per categorie con codice colore",
    "Espandi ogni categoria toccando l'intestazione",
    "Spunta le voci che hai verificato e sono conformi",
    "Se un articolo ha un problema, tocca il pulsante '!' accanto",
    "Se ci sono anomalie generali, attiva la casella 'Segnala anomalia'",
    "Inserisci il tuo nome nel campo firma (obbligatorio)",
    "Tocca 'CONFERMA CHECKLIST' per salvare"
  ]);

  space(6);
  label("Categorie materiali");
  tableRow("Zona", "Contenuto", true);
  tableRow("Materiale Zaino (Verde)", "Dotazioni della borsa di emergenza");
  tableRow("Materiale Ambulanza (Blu)", "Dotazioni fisse del mezzo");
  tableRow("Materiale Vario (Rosso)", "Materiali di consumo e accessori");

  space(6);
  label("Segnalazione problemi su un articolo");
  para("Toccando il pulsante '!' accanto a un articolo, puoi segnalare:");
  bulletList([
    "Mancante: l'articolo non e presente sul mezzo",
    "Quantita insufficiente: la quantita e inferiore al previsto",
    "Danneggiato: l'articolo e presente ma non funzionante"
  ]);
  space(4);
  infoBox("warning", "In caso di anomalie gravi che compromettono la sicurezza, NON utilizzare il veicolo e contattare immediatamente il coordinatore della sede.");

  // =====================
  // SECTION 07: SCADENZE MATERIALI
  // =====================
  sectionHeader("07", "SCADENZE MATERIALI");
  para("Il sistema monitora automaticamente le scadenze dei materiali sanitari. Riceverai avvisi quando i materiali sono in scadenza o scaduti.");
  space(4);

  label("Codici colore");
  tableRow("Colore", "Significato", true);
  tableRow("Rosso", "Materiale scaduto - sostituire subito");
  tableRow("Arancione", "Materiale in scadenza (entro 15 giorni)");
  tableRow("Verde", "Materiale valido (scadenza oltre 15 giorni)");

  space(6);
  label("Ripristinare un materiale scaduto");
  stepList([
    "Dalla Home tocca l'avviso materiali, oppure vai su Profilo > Scadenze",
    "Tocca il materiale da aggiornare",
    "Inserisci la nuova data di scadenza del materiale sostituito",
    "Tocca 'Conferma Ripristino'"
  ]);

  space(6);
  label("Verifica mensile obbligatoria");
  para("Dal 24 al 31 di ogni mese, il pulsante 'Scadenze Materiali' nel Profilo diventa rosso con badge 'URGENTE'. In quel periodo devi completare la verifica mensile di tutti i materiali e inviare il report.");

  // =====================
  // SECTION 08: PASSAGGIO CONSEGNE
  // =====================
  sectionHeader("08", "PASSAGGIO CONSEGNE");
  para("Il passaggio consegne serve per comunicare al turno successivo lo stato del veicolo e eventuali segnalazioni importanti.");
  space(4);

  label("Come effettuare il passaggio consegne");
  stepList([
    "Dalla Home, tocca il widget 'Consegne'",
    "Descrivi lo stato del veicolo e le cose da segnalare",
    "Indica eventuali problemi o necessita per il turno successivo",
    "Conferma il passaggio consegne"
  ]);
  space(4);
  para("Lo storico dei passaggi consegne e sempre consultabile. Il turno successivo vedra le tue note direttamente sulla Home.");

  // =====================
  // SECTION 09: INVENTARIO
  // =====================
  sectionHeader("09", "INVENTARIO MATERIALI");
  para("La sezione inventario ti permette di vedere tutti i materiali presenti sul veicolo, organizzati per categoria, e di segnalare utilizzi o necessita di ripristino.");
  space(4);
  label("Accesso");
  para("Vai su Profilo > Inventario. Puoi filtrare per categoria, vedere le quantita disponibili e segnalare i materiali utilizzati durante il turno.");

  // =====================
  // SECTION 10: DOCUMENTI VEICOLO
  // =====================
  sectionHeader("10", "DOCUMENTI VEICOLO");
  para("In questa sezione puoi consultare lo stato dei documenti del veicolo (assicurazione, revisione, collaudo, bollo). Il sistema segnala automaticamente i documenti in scadenza.");
  space(4);
  label("Accesso");
  para("Vai su Profilo > Documenti Veicolo per vedere l'elenco dei documenti e le relative scadenze.");

  // =====================
  // SECTION 11: REGISTRO SANIFICAZIONI
  // =====================
  sectionHeader("11", "REGISTRO SANIFICAZIONI");
  para("Dopo ogni servizio e necessario registrare la sanificazione del veicolo.");
  space(4);
  label("Come registrare una sanificazione");
  stepList([
    "Vai su Profilo > Registro Sanificazioni",
    "Seleziona il tipo di sanificazione effettuata",
    "Aggiungi eventuali note",
    "Conferma la registrazione"
  ]);

  // =====================
  // SECTION 12: CARTA CARBURANTE
  // =====================
  sectionHeader("12", "CARTA CARBURANTE");
  para("In questa sezione puoi consultare i dati della carta carburante associata al veicolo e registrare i rifornimenti effettuati.");
  space(4);
  label("Accesso");
  para("Vai su Profilo > Carta Carburante per vedere il saldo e lo storico rifornimenti.");

  // =====================
  // SECTION 13: MODALITA OFFLINE
  // =====================
  sectionHeader("13", "FUNZIONAMENTO OFFLINE");
  para("L'app funziona anche senza connessione internet. Ecco cosa succede:");
  space(4);
  bulletList([
    "I servizi vengono salvati nella memoria del telefono",
    "Un indicatore sulla Home segnala lo stato 'Offline'",
    "Un contatore mostra quanti servizi sono in attesa di invio",
    "Quando la connessione torna, i servizi si sincronizzano automaticamente",
    "L'app si aggiorna automaticamente ogni 30 secondi quando sei online"
  ]);
  space(4);
  infoBox("info", "Non perdere mai un servizio: anche senza connessione, registra tutto normalmente. L'app pensera a inviare i dati appena possibile.");

  // =====================
  // SECTION 14: RIEPILOGO COMANDI RAPIDI
  // =====================
  sectionHeader("14", "RIEPILOGO COMANDI");
  tableRow("Cosa vuoi fare", "Come", true);
  tableRow("Nuovo servizio", "Pulsante '+' nella barra in basso");
  tableRow("Vedere i servizi", "Tab 'Viaggi' nella barra in basso");
  tableRow("Modificare un servizio", "Viaggi > tocca servizio > Modifica");
  tableRow("Checklist", "Profilo > Checklist Pre-Partenza");
  tableRow("Scadenze materiali", "Profilo > Scadenze Materiali");
  tableRow("Inventario", "Profilo > Inventario");
  tableRow("Documenti veicolo", "Profilo > Documenti Veicolo");
  tableRow("Sanificazione", "Profilo > Registro Sanificazioni");
  tableRow("Carta carburante", "Profilo > Carta Carburante");
  tableRow("Passaggio consegne", "Widget 'Consegne' sulla Home");
  tableRow("Uscire dall'app", "Profilo > Esci dall'account");

  // =====================
  // SECTION 15: PROBLEMI E ASSISTENZA
  // =====================
  sectionHeader("15", "PROBLEMI E ASSISTENZA");

  label("Problemi comuni");
  tableRow("Problema", "Soluzione", true);
  tableRow("Password dimenticata", "Chiedi al tuo coordinatore o amministratore");
  tableRow("App non si apre", "Chiudi e riapri l'app, o riavvia il telefono");
  tableRow("Non vedo i miei servizi", "Controlla la connessione internet");
  tableRow("Checklist non si salva", "Assicurati di aver compilato il campo firma");
  tableRow("Km sbagliati", "Verifica che origine e destinazione siano corretti");

  space(8);
  label("Assistenza");
  para("Per qualsiasi problema, contatta il coordinatore della tua sede o l'amministratore della tua organizzazione. Per problemi tecnici con la piattaforma: info@soccorsodigitale.app");

  space(20);
  divider();
  space(6);
  doc.fontSize(10).fillColor(BLUE).font("Helvetica-Bold").text("SOCCORSO DIGITALE", M, y, { width: CW, align: "center" });
  y += 14;
  doc.fontSize(8).fillColor(GRAY).font("Helvetica").text("Guida Utente App Mobile - v3.0", M, y, { width: CW, align: "center" });
  y += 12;
  doc.fontSize(8).fillColor(GRAY).text("Febbraio 2026", M, y, { width: CW, align: "center" });
  y += 12;
  doc.fontSize(8).fillColor(BLUE).font("Helvetica-Bold").text("soccorsodigitale.app", M, y, { width: CW, align: "center" });

  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(7).fillColor(GRAY).font("Helvetica").text(`${i + 1} / ${pages.count}`, M, 560, { width: CW, align: "center" });
  }

  doc.end();
}
