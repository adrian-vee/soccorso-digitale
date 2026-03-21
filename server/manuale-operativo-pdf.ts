import PDFDocument from "pdfkit";
import { Response } from "express";
import fs from "fs";
import path from "path";

const BLUE = "#0066CC";
const GREEN = "#00A651";
const RED = "#CC0000";
const DARK = "#1A1A1A";
const GRAY = "#444444";
const LIGHT_GRAY = "#F0F4F8";
const BORDER = "#D0D5DD";
const ORANGE = "#EA580C";
const PURPLE = "#7C3AED";

interface OrgInfo {
  name: string;
  logoUrl?: string | null;
}

export function generateManualeOperativoPDF(res: Response, org?: OrgInfo) {
  const orgName = org?.name || "SOCCORSO DIGITALE";
  const safeOrgFileName = orgName.replace(/[^a-zA-Z0-9]/g, "_");
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 50, bottom: 50, left: 45, right: 45 },
    autoFirstPage: true,
    info: {
      Title: `MANUALE EQUIPAGGIO - ${orgName.toUpperCase()} v4.0`,
      Author: orgName,
      Subject: "Guida completa per gli equipaggi - App Mobile",
      Creator: "soccorsodigitale.app",
    }
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="Manuale_Equipaggio_${safeOrgFileName}_v4.0.pdf"`);
  doc.pipe(res);

  let orgLogoBuffer: Buffer | null = null;
  if (org?.logoUrl) {
    try {
      const logoFilePath = path.join(process.cwd(), org.logoUrl);
      if (fs.existsSync(logoFilePath)) {
        orgLogoBuffer = fs.readFileSync(logoFilePath);
      }
    } catch(e) { /* logo not available */ }
  }

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 45;
  const contentWidth = pageWidth - margin * 2;
  const colWidth = (contentWidth - 14) / 2;
  const PAGE_BOTTOM = 760;
  let pageNum = 0;

  function drawHeader() {
    doc.rect(0, 0, pageWidth, 6).fill(BLUE);
    doc.rect(0, 6, pageWidth, 3).fill(GREEN);
    doc.fontSize(7.5).fillColor(GRAY).font("Helvetica-Bold");
    doc.text(`MANUALE EQUIPAGGIO - ${orgName.toUpperCase()}`, margin, 18, { width: contentWidth / 2, align: "left", lineBreak: false });
    doc.fontSize(7.5).fillColor(GRAY).font("Helvetica");
    doc.text("soccorsodigitale.app", margin + contentWidth / 2, 18, { width: contentWidth / 2, align: "right", lineBreak: false });
    doc.rect(margin, 30, contentWidth, 0.5).fill(BORDER);
  }

  function newPage() {
    doc.addPage();
    pageNum++;
    drawHeader();
  }

  function ensureSpace(needed: number) {
    if (doc.y + needed > PAGE_BOTTOM) {
      newPage();
      doc.y = 42;
    }
  }

  function chapterTitle(num: string, text: string) {
    ensureSpace(100);
    const y = doc.y;
    doc.rect(margin, y, contentWidth, 36).fill(BLUE);
    doc.rect(margin, y + 36, contentWidth, 3).fill(GREEN);
    doc.fontSize(8).fillColor("#FFFFFF").font("Helvetica-Bold");
    doc.text(`CAPITOLO ${num}`, margin + 14, y + 6, { lineBreak: false });
    doc.fontSize(15).fillColor("#FFFFFF").font("Helvetica-Bold");
    doc.text(text.toUpperCase(), margin + 14, y + 16, { lineBreak: false });
    doc.y = y + 48;
  }

  function sectionTitle(text: string) {
    ensureSpace(80);
    const y = doc.y + 4;
    doc.rect(margin, y, 4, 20).fill(BLUE);
    doc.fontSize(13).fillColor(BLUE).font("Helvetica-Bold");
    doc.text(text, margin + 12, y + 3);
    doc.y = y + 26;
  }

  function subTitle(text: string) {
    ensureSpace(50);
    doc.fontSize(11.5).fillColor(DARK).font("Helvetica-Bold");
    doc.text(text, margin, doc.y + 2);
    doc.moveDown(0.4);
  }

  function bodyText(text: string, indent: number = 0) {
    ensureSpace(20);
    doc.fontSize(10.5).fillColor(GRAY).font("Helvetica");
    doc.text(text, margin + indent, doc.y, { width: contentWidth - indent, lineGap: 2 });
    doc.moveDown(0.3);
  }

  function bodyTextBold(text: string) {
    ensureSpace(20);
    doc.fontSize(10.5).fillColor(DARK).font("Helvetica-Bold");
    doc.text(text, margin, doc.y, { width: contentWidth, lineGap: 2 });
    doc.moveDown(0.3);
  }

  function bullet(text: string, indent: number = 0) {
    ensureSpace(18);
    doc.fontSize(10.5).fillColor(GRAY).font("Helvetica");
    doc.text(`\u2022  ${text}`, margin + 8 + indent, doc.y + 2, { width: contentWidth - 12 - indent, lineGap: 1.5 });
    doc.moveDown(0.1);
  }

  function numberedStep(num: number, text: string) {
    ensureSpace(18);
    const y = doc.y + 2;
    const circleSize = 18;
    const circleX = margin + 8;
    doc.roundedRect(circleX, y - 1, circleSize, circleSize, circleSize / 2).fill(BLUE);
    const numStr = num.toString();
    doc.fontSize(9).font("Helvetica-Bold");
    const numW = doc.widthOfString(numStr);
    const numH = doc.currentLineHeight();
    doc.fillColor("#FFFFFF");
    doc.text(numStr, circleX + (circleSize - numW) / 2, y - 1 + (circleSize - numH) / 2, { width: circleSize, lineBreak: false });
    doc.fontSize(10.5).fillColor(GRAY).font("Helvetica");
    doc.text(text, margin + 32, y + 2, { width: contentWidth - 36, lineGap: 1.5 });
    doc.y = Math.max(doc.y, y + 18);
    doc.moveDown(0.2);
  }

  function labeledItem(label: string, desc: string) {
    ensureSpace(28);
    const y = doc.y + 3;
    doc.fontSize(10.5).fillColor(BLUE).font("Helvetica-Bold");
    doc.text(label, margin + 8, y);
    doc.fontSize(10).fillColor(GRAY).font("Helvetica");
    doc.text(desc, margin + 8, doc.y + 1, { width: contentWidth - 12, lineGap: 1.5 });
    doc.moveDown(0.2);
  }

  function infoBox(title: string, text: string, color: string = BLUE) {
    ensureSpace(55);
    const y = doc.y + 2;
    doc.fontSize(10);
    const textH = doc.heightOfString(text, { width: contentWidth - 32 });
    const boxH = Math.max(48, textH + 32);
    doc.roundedRect(margin, y, contentWidth, boxH, 4).fill(LIGHT_GRAY);
    doc.rect(margin, y, 5, boxH).fill(color);
    doc.fontSize(9).fillColor(color).font("Helvetica-Bold");
    doc.text(title, margin + 14, y + 8, { width: contentWidth - 28 });
    doc.fontSize(10).fillColor(DARK).font("Helvetica");
    doc.text(text, margin + 14, y + 22, { width: contentWidth - 28, lineGap: 1.5 });
    doc.y = y + boxH + 6;
  }

  function warningBox(title: string, text: string) {
    infoBox(title, text, RED);
  }

  function tipBox(title: string, text: string) {
    infoBox(title, text, GREEN);
  }

  function twoColumnBox(left: { title: string; items: string[] }, right: { title: string; items: string[] }, leftColor: string = BLUE, rightColor: string = GREEN) {
    ensureSpace(100);
    const y = doc.y + 2;
    const leftItems = left.items.map(i => `\u2022  ${i}`).join("\n");
    const rightItems = right.items.map(i => `\u2022  ${i}`).join("\n");
    doc.fontSize(10);
    const leftH = doc.heightOfString(leftItems, { width: colWidth - 24 }) + 30;
    const rightH = doc.heightOfString(rightItems, { width: colWidth - 24 }) + 30;
    const boxH = Math.max(leftH, rightH);

    doc.roundedRect(margin, y, colWidth, boxH, 4).fill(LIGHT_GRAY);
    doc.rect(margin, y, 4, boxH).fill(leftColor);
    doc.fontSize(9.5).fillColor(leftColor).font("Helvetica-Bold");
    doc.text(left.title, margin + 12, y + 8, { width: colWidth - 20 });
    doc.fontSize(10).fillColor(GRAY).font("Helvetica");
    doc.text(leftItems, margin + 12, y + 22, { width: colWidth - 24, lineGap: 2 });

    const rightX = margin + colWidth + 14;
    doc.roundedRect(rightX, y, colWidth, boxH, 4).fill(LIGHT_GRAY);
    doc.rect(rightX, y, 4, boxH).fill(rightColor);
    doc.fontSize(9.5).fillColor(rightColor).font("Helvetica-Bold");
    doc.text(right.title, rightX + 12, y + 8, { width: colWidth - 20 });
    doc.fontSize(10).fillColor(GRAY).font("Helvetica");
    doc.text(rightItems, rightX + 12, y + 22, { width: colWidth - 24, lineGap: 2 });

    doc.y = y + boxH + 8;
  }

  function tableRow(cells: string[], isHeader: boolean = false) {
    const cellW = contentWidth / cells.length;
    doc.fontSize(9).font(isHeader ? "Helvetica-Bold" : "Helvetica");
    let maxH = 14;
    cells.forEach((cell) => {
      const h = doc.heightOfString(cell, { width: cellW - 12 });
      if (h > maxH) maxH = h;
    });
    const rowH = maxH + 8;
    ensureSpace(rowH + 2);
    const y = doc.y;
    if (isHeader) {
      doc.rect(margin, y, contentWidth, rowH).fill(BLUE);
    } else {
      doc.rect(margin, y, contentWidth, rowH).lineWidth(0.5).stroke(BORDER);
    }
    cells.forEach((cell, i) => {
      doc.fontSize(9).fillColor(isHeader ? "#FFFFFF" : DARK).font(isHeader ? "Helvetica-Bold" : "Helvetica");
      doc.text(cell, margin + i * cellW + 6, y + 4, { width: cellW - 12 });
    });
    doc.y = y + rowH;
  }

  // =====================
  // COVER PAGE
  // =====================
  pageNum = 1;

  doc.rect(0, 0, pageWidth, pageHeight).fill("#FFFFFF");
  doc.rect(0, 0, pageWidth, 14).fill(BLUE);
  doc.rect(0, 14, pageWidth, 5).fill(GREEN);
  doc.rect(0, pageHeight - 14, pageWidth, 14).fill(BLUE);
  doc.rect(0, pageHeight - 19, pageWidth, 5).fill(GREEN);

  let coverLogoY = 60;
  if (orgLogoBuffer) {
    try {
      doc.image(orgLogoBuffer, pageWidth / 2 - 80, coverLogoY, { width: 160, height: 100, fit: [160, 100], align: "center", valign: "center" });
      coverLogoY += 110;
    } catch(e) {
      coverLogoY = 80;
    }
  } else {
    const appLogoPath = path.join(process.cwd(), "assets", "images", "app-icon-ios.png");
    if (fs.existsSync(appLogoPath)) {
      doc.image(appLogoPath, pageWidth / 2 - 55, coverLogoY, { width: 110 });
    }
    coverLogoY = 180;
  }

  doc.fontSize(18).fillColor(GREEN).font("Helvetica-Bold");
  doc.text(orgName.toUpperCase(), margin, coverLogoY, { width: contentWidth, align: "center" });
  coverLogoY += 30;

  doc.rect(pageWidth / 2 - 60, coverLogoY, 120, 2).fill(GREEN);
  coverLogoY += 16;

  doc.fontSize(32).fillColor(BLUE).font("Helvetica-Bold");
  doc.text("MANUALE", margin, coverLogoY, { width: contentWidth, align: "center" });
  doc.fontSize(32).fillColor(GREEN).font("Helvetica-Bold");
  doc.text("EQUIPAGGIO", margin, coverLogoY + 38, { width: contentWidth, align: "center" });

  doc.rect(pageWidth / 2 - 40, coverLogoY + 82, 80, 3).fill(BLUE);

  doc.fontSize(16).fillColor(DARK).font("Helvetica-Bold");
  doc.text("APPLICAZIONE MOBILE", margin, coverLogoY + 100, { width: contentWidth, align: "center" });
  doc.fontSize(12).fillColor(GRAY).font("Helvetica");
  doc.text("Guida completa per gli equipaggi di trasporto sanitario", margin, coverLogoY + 125, { width: contentWidth, align: "center" });

  const infoBoxY = Math.max(coverLogoY + 165, 430);
  doc.roundedRect(margin + 60, infoBoxY, contentWidth - 120, 110, 6).fill(LIGHT_GRAY);
  doc.fontSize(12).fillColor(DARK).font("Helvetica-Bold");
  doc.text("Versione 4.0", margin, infoBoxY + 18, { width: contentWidth, align: "center" });
  doc.fontSize(11).fillColor(GRAY).font("Helvetica");
  doc.text("Febbraio 2026", margin, infoBoxY + 38, { width: contentWidth, align: "center" });
  doc.fontSize(11).fillColor(BLUE).font("Helvetica-Bold");
  doc.text("soccorsodigitale.app", margin, infoBoxY + 60, { width: contentWidth, align: "center" });
  doc.fontSize(10).fillColor(GRAY).font("Helvetica");
  doc.text("info@soccorsodigitale.app", margin, infoBoxY + 80, { width: contentWidth, align: "center" });

  doc.fontSize(9).fillColor(GRAY).font("Helvetica");
  doc.text(`Documento riservato - ${orgName}`, margin, pageHeight - 60, { width: contentWidth, align: "center" });

  // =====================
  // TABLE OF CONTENTS
  // =====================
  newPage();
  doc.y = 42;

  doc.fontSize(20).fillColor(BLUE).font("Helvetica-Bold");
  doc.text("INDICE", margin, doc.y, { width: contentWidth, align: "center" });
  doc.moveDown(1.5);

  const toc = [
    { num: "1", title: "Installazione e Primo Accesso", sub: ["Requisiti", "Installazione app", "Primo accesso", "Problemi di accesso"] },
    { num: "2", title: "Schermata Home", sub: ["Panoramica", "Widget e indicatori", "Segnalazioni fotografiche"] },
    { num: "3", title: "Navigazione dell'App", sub: ["Barra di navigazione", "Struttura delle sezioni"] },
    { num: "4", title: "Inserimento Nuovo Servizio", sub: ["Procedura completa", "Calcolo automatico km", "Servizi di emergenza", "Servizi senza paziente", "Modalita offline"] },
    { num: "5", title: "Elenco Servizi", sub: ["Consultazione", "Dettaglio e modifica", "Verifica integrita"] },
    { num: "6", title: "Checklist Pre-Partenza", sub: ["Compilazione", "Categorie materiali", "Segnalazione problemi", "Modalita veloce e dettagliata"] },
    { num: "7", title: "Scadenze Materiali", sub: ["Monitoraggio", "Ripristino materiali", "Verifica mensile obbligatoria"] },
    { num: "8", title: "Passaggio Consegne", sub: ["Come effettuare", "Storico consegne", "Priorita e categorie"] },
    { num: "9", title: "Missioni Programmate (Hub)", sub: ["Visualizzazione missioni", "Aggiornamento stato", "Ciclo di vita della missione"] },
    { num: "10", title: "Dettagli Veicolo", sub: ["Statistiche", "Manutenzione", "Segnalazione danni"] },
    { num: "11", title: "Documenti Veicolo", sub: ["Consultazione", "Scadenze documenti"] },
    { num: "12", title: "Registro Sanificazioni", sub: ["Registrazione", "Tipologie", "Storico"] },
    { num: "13", title: "Carta Carburante", sub: ["Analisi consumi", "Costi e CO2"] },
    { num: "14", title: "Inventario Materiali", sub: ["Gestione scorte", "Scanner QR/barcode"] },
    { num: "15", title: "Tracciamento GPS", sub: ["Attivazione", "Funzionamento", "Privacy"] },
    { num: "16", title: "Profilo e Impostazioni", sub: ["Gestione profilo", "Notifiche", "Privacy e dati", "Assistenza"] },
    { num: "17", title: "Funzionamento Offline", sub: ["Salvataggio locale", "Sincronizzazione", "Indicatori"] },
    { num: "18", title: "Problemi e Assistenza", sub: ["Problemi comuni", "Contatti"] },
  ];

  toc.forEach((item) => {
    ensureSpace(30);
    const y = doc.y;
    doc.fontSize(11.5).fillColor(BLUE).font("Helvetica-Bold");
    doc.text(`${item.num}.`, margin, y + 2, { width: 20 });
    doc.text(item.title, margin + 24, y + 2, { width: contentWidth - 24 });
    doc.fontSize(9).fillColor(GRAY).font("Helvetica");
    doc.text(item.sub.join("  |  "), margin + 24, doc.y + 1, { width: contentWidth - 24 });
    doc.moveDown(0.3);
  });

  // =====================
  // CHAPTER 1: INSTALLAZIONE
  // =====================
  newPage();
  doc.y = 42;
  chapterTitle("1", "Installazione e Primo Accesso");

  doc.moveDown(0.3);
  sectionTitle("1.1 Requisiti di Sistema");
  bodyText("Prima di installare l'app, verifica di avere i seguenti requisiti minimi:");
  doc.moveDown(0.3);

  twoColumnBox(
    { title: "REQUISITI DISPOSITIVO", items: ["Smartphone Android 10 o successivo", "iPhone con iOS 15 o successivo", "Almeno 100 MB di spazio libero", "Fotocamera funzionante (per scanner e foto)"] },
    { title: "REQUISITI DI RETE", items: ["Connessione internet (WiFi o dati mobili)", "L'app funziona anche offline", "Sincronizzazione automatica al ritorno online", "GPS attivo per il tracciamento"] }
  );

  doc.moveDown(0.3);
  sectionTitle("1.2 Come Installare l'App");
  bodyText("Scansiona il QR code presente sulla copertina di questo manuale con la fotocamera del telefono per accedere alla pagina di download:");
  doc.moveDown(0.3);

  numberedStep(1, "Scansiona il QR code in copertina con la fotocamera del telefono e tocca il pulsante \"Scarica APK\"");
  numberedStep(2, "Se il tuo telefono lo richiede, consenti l'installazione da fonti esterne (solo per Android)");
  numberedStep(3, "Attendi il completamento del download e dell'installazione");
  numberedStep(4, "Al termine, l'icona dell'app apparira nella schermata principale del telefono");

  doc.moveDown(0.3);
  tipBox("DOWNLOAD ALTERNATIVO", "L'app e scaricabile anche dal sito soccorsodigitale.app/download. Apri il link dal browser del telefono, tocca il pulsante di download e segui le istruzioni sullo schermo.");

  doc.moveDown(0.3);
  sectionTitle("1.3 Primo Accesso all'App");
  bodyText("Al primo avvio dell'applicazione, dovrai inserire le credenziali fornite dal tuo coordinatore o amministratore:");
  doc.moveDown(0.3);

  numberedStep(1, "Apri l'applicazione toccando l'icona sulla schermata del telefono");
  numberedStep(2, "Inserisci l'indirizzo email associato al tuo account veicolo");
  numberedStep(3, "Inserisci la password fornita dal coordinatore");
  numberedStep(4, "Tocca il pulsante 'Accedi' per entrare");
  numberedStep(5, "Attiva l'opzione 'Ricorda credenziali' per non doverle inserire ogni volta");

  doc.moveDown(0.3);
  infoBox("ACCOUNT VEICOLO", "Ogni ambulanza ha le proprie credenziali di accesso. Quando effettui il login, il sistema riconosce automaticamente il veicolo assegnato, la sede operativa e l'organizzazione di appartenenza. Non e necessario selezionare manualmente il veicolo.");

  doc.moveDown(0.3);
  sectionTitle("1.4 Problemi di Accesso");
  bodyText("Se riscontri difficolta nell'accedere all'app, verifica le seguenti situazioni:");
  doc.moveDown(0.3);

  labeledItem("Password dimenticata", "Contatta il coordinatore o l'amministratore della tua organizzazione per ottenere una nuova password.");
  labeledItem("Account bloccato", "Dopo troppi tentativi errati, l'account viene temporaneamente bloccato. Attendi 15 minuti oppure contatta l'amministratore per lo sblocco immediato.");
  labeledItem("Errore di connessione", "Verifica che il telefono sia connesso a internet (WiFi o dati mobili). Prova a disattivare e riattivare la connessione dati.");
  labeledItem("App non si avvia", "Chiudi completamente l'app e riaprila. Se il problema persiste, riavvia il telefono.");

  // =====================
  // CHAPTER 2: HOME
  // =====================
  doc.moveDown(0.8);
  chapterTitle("2", "Schermata Home");

  doc.moveDown(0.3);
  sectionTitle("2.1 Panoramica Generale");
  bodyText("La schermata Home e il punto di partenza dell'app. Ti offre una visione completa e immediata dello stato operativo del tuo veicolo e delle attivita del turno. Ogni elemento e stato pensato per darti informazioni essenziali a colpo d'occhio.");

  doc.moveDown(0.3);
  sectionTitle("2.2 Elementi della Home");
  bodyText("Ecco tutti gli elementi presenti nella schermata principale, dall'alto verso il basso:");
  doc.moveDown(0.3);

  labeledItem("Saluto Personalizzato", "Un saluto che cambia in base all'orario: 'Buongiorno', 'Buon pomeriggio', 'Buonasera' o 'Buonanotte'. Accompagnato dal codice identificativo del veicolo in formato grande.");
  labeledItem("Indicatore Stato Connessione", "Un pallino verde con la scritta 'Online' indica che l'app e connessa al server. Se sei disconnesso, il pallino diventa rosso con la scritta 'Offline'. L'app continua a funzionare anche offline.");
  labeledItem("Organizzazione e Sede", "Il nome della tua organizzazione e la sede operativa a cui il veicolo e assegnato vengono mostrati sotto il codice veicolo.");
  labeledItem("Equipaggio del Turno", "Se configurato dall'amministratore, mostra i nomi dei colleghi presenti nel turno corrente con un badge verde.");
  labeledItem("Widget Heartbeat", "Una sezione con le statistiche principali del veicolo aggiornate in tempo reale: servizi effettuati, chilometri percorsi e altri dati rilevanti.");
  labeledItem("Stato Checklist Giornaliera", "Indica se la checklist pre-partenza del giorno e stata completata. Se non compilata, viene mostrato un avviso per ricordarti di farla.");
  labeledItem("Km Attuali del Veicolo", "Il contachilometri virtuale mostra i chilometri totali registrati per il tuo veicolo nel sistema.");
  labeledItem("Avviso Materiali Scaduti", "Se sono presenti materiali scaduti o in scadenza a bordo, viene visualizzato un avviso rosso o arancione con il numero di articoli da verificare.");

  doc.moveDown(0.3);
  warningBox("MATERIALI SCADUTI", "Se compare un avviso ROSSO per materiali scaduti, e necessario verificare immediatamente le scadenze e procedere alla sostituzione. I materiali scaduti NON devono essere utilizzati sul paziente.");

  doc.moveDown(0.3);
  sectionTitle("2.3 Widget Passaggio Consegne");
  bodyText("Nella parte inferiore della Home trovi il widget dedicato ai passaggi consegne. Mostra l'ultimo messaggio lasciato dal turno precedente, con informazioni sullo stato del veicolo e segnalazioni importanti da conoscere prima di iniziare il servizio.");

  doc.moveDown(0.3);
  sectionTitle("2.4 Segnalazioni Fotografiche");
  bodyText("Dalla Home puoi inviare segnalazioni fotografiche all'amministratore per documentare danni, problemi o anomalie riscontrate sul veicolo:");
  doc.moveDown(0.3);

  numberedStep(1, "Tocca il pulsante della fotocamera presente nella Home");
  numberedStep(2, "Scatta una foto oppure selezionala dalla galleria del telefono");
  numberedStep(3, "Aggiungi una descrizione del problema riscontrato");
  numberedStep(4, "Inserisci il tuo nome per identificare la segnalazione");
  numberedStep(5, "Tocca 'Invia' per mandare la segnalazione all'amministratore");

  doc.moveDown(0.3);
  bodyText("Le segnalazioni inviate sono visibili nella sezione report della Home. Puoi verificare lo stato di ogni segnalazione: se e stata letta dall'amministratore (conferma di lettura) e se e stata risolta.");

  doc.moveDown(0.3);
  tipBox("COMUNICAZIONE BIDIREZIONALE", "L'amministratore puo rispondere alle tue segnalazioni con note e aggiornamenti. Controlla periodicamente lo stato delle segnalazioni aperte per leggere eventuali risposte.");

  // =====================
  // CHAPTER 3: NAVIGAZIONE
  // =====================
  doc.moveDown(0.8);
  chapterTitle("3", "Navigazione dell'App");

  doc.moveDown(0.3);
  sectionTitle("3.1 Barra di Navigazione Principale");
  bodyText("L'app utilizza una barra di navigazione fissa nella parte inferiore dello schermo. Questa barra e sempre visibile e ti permette di passare rapidamente tra le quattro sezioni principali:");
  doc.moveDown(0.3);

  labeledItem("Home (icona casa)", "La schermata principale con la panoramica completa del veicolo, gli avvisi, lo stato della checklist, il passaggio consegne e le segnalazioni fotografiche.");
  labeledItem("Servizi (icona lista)", "L'elenco completo di tutti i servizi di trasporto registrati con il tuo veicolo. Puoi consultare lo storico e accedere ai dettagli di ogni viaggio.");
  labeledItem("Nuovo Servizio (icona +)", "Il pulsante centrale per registrare un nuovo servizio di trasporto sanitario. E la funzione principale che utilizzerai durante ogni turno.");
  labeledItem("Profilo (icona persona)", "Il centro di controllo del veicolo: checklist, scadenze, inventario, documenti, sanificazione, carta carburante, tracciamento GPS e impostazioni.");

  doc.moveDown(0.3);
  sectionTitle("3.2 Struttura delle Sezioni");
  bodyText("Ogni sezione della barra di navigazione puo contenere sotto-sezioni e schermate aggiuntive accessibili tramite pulsanti interni:");
  doc.moveDown(0.3);

  bodyText("La sezione Profilo, in particolare, e organizzata in aree funzionali:", 8);
  doc.moveDown(0.2);
  bullet("Area Veicolo: Dettagli veicolo, Documenti, Sanificazione, Carta carburante");
  bullet("Area Operativa: Checklist pre-partenza, Scadenze materiali");
  bullet("Area GPS: Attivazione e gestione del tracciamento in tempo reale");
  bullet("Area Impostazioni: Notifiche, Privacy, Assistenza, Info app");

  doc.moveDown(0.3);
  sectionTitle("3.3 Missioni Programmate");
  bodyText("Se la tua organizzazione ha attivato il modulo Hub Prenotazioni, nella Home compariranno anche le missioni programmate assegnate al tuo veicolo. Questo widget ti mostra i prossimi trasporti prenotati dai cittadini o dalle strutture sanitarie convenzionate.");

  // =====================
  // CHAPTER 4: INSERIMENTO SERVIZIO
  // =====================
  doc.moveDown(0.8);
  chapterTitle("4", "Inserimento Nuovo Servizio");

  doc.moveDown(0.3);
  sectionTitle("4.1 Panoramica");
  bodyText("L'inserimento dei servizi e la funzione centrale dell'applicazione. Ogni trasporto sanitario effettuato con il veicolo deve essere registrato qui. Il sistema calcola automaticamente i chilometri, assegna la numerazione progressiva e registra tutti i dati necessari per la rendicontazione e la conformita normativa.");

  doc.moveDown(0.3);
  sectionTitle("4.2 Procedura Completa di Inserimento");
  bodyText("Per registrare un nuovo servizio di trasporto, segui questi passaggi:");
  doc.moveDown(0.3);

  numberedStep(1, "Tocca il pulsante '+' (Inserisci) dalla barra di navigazione in basso");
  numberedStep(2, "La data viene impostata automaticamente su oggi. Tocca il campo data per modificarla se necessario");
  numberedStep(3, "Imposta l'ora di partenza toccando il campo 'Ora Partenza'");
  numberedStep(4, "Imposta l'ora di rientro toccando il campo 'Ora Rientro'");
  numberedStep(5, "Seleziona il tipo di servizio: Dimissione, Visita medica, Trasferimento, Emergenza, Dialisi o Senza paziente");
  numberedStep(6, "Seleziona la composizione dell'equipaggio: Autista + Soccorritore oppure Autista + Infermiere");

  doc.moveDown(0.3);
  subTitle("Origine del Servizio");
  numberedStep(7, "Scegli il tipo di luogo di partenza: Ospedale, CDR (Centro di Riabilitazione), Sede operativa, Domicilio o GPS");
  numberedStep(8, "Per Ospedale o CDR: seleziona la struttura dal menu a tendina, poi seleziona il reparto");
  numberedStep(9, "Per Domicilio: inserisci l'indirizzo completo del paziente nel campo di testo");
  numberedStep(10, "Per GPS: la posizione viene rilevata automaticamente dal telefono");

  doc.moveDown(0.3);
  subTitle("Destinazione del Servizio");
  numberedStep(11, "Scegli il tipo di luogo di arrivo con la stessa logica dell'origine");
  numberedStep(12, "Seleziona la struttura e il reparto, oppure inserisci l'indirizzo");

  doc.moveDown(0.3);
  subTitle("Dati del Paziente");
  numberedStep(13, "Seleziona il genere del paziente: M (Maschio) o F (Femmina)");
  numberedStep(14, "Inserisci l'anno di nascita del paziente (4 cifre)");
  numberedStep(15, "Aggiungi eventuali note libere nel campo note, se necessario");

  doc.moveDown(0.3);
  subTitle("Conferma e Salvataggio");
  numberedStep(16, "I chilometri iniziali vengono compilati automaticamente dall'ultimo servizio");
  numberedStep(17, "I chilometri finali vengono calcolati automaticamente dal sistema");
  numberedStep(18, "Tocca 'Salva Servizio' per registrare il trasporto");

  doc.moveDown(0.3);
  sectionTitle("4.3 Calcolo Automatico dei Chilometri");
  bodyText("Il sistema calcola automaticamente la distanza stradale reale tra il punto di origine e la destinazione utilizzando OSRM (Open Source Routing Machine). Il calcolo tiene conto delle strade effettive, non della distanza in linea d'aria.");
  doc.moveDown(0.3);

  infoBox("PRIMO SERVIZIO DEL VEICOLO", "Solo per il primissimo servizio registrato con un veicolo nuovo nel sistema, e necessario inserire manualmente i chilometri iniziali leggendoli dal contachilometri fisico dell'ambulanza. Da quel momento in poi, il sistema calcolera automaticamente i km per ogni servizio successivo.");

  doc.moveDown(0.3);
  bodyText("Se necessario, puoi sempre modificare manualmente i chilometri calcolati dal sistema toccando il campo km e inserendo il valore corretto.");

  doc.moveDown(0.3);
  sectionTitle("4.4 Servizi di Emergenza");
  bodyText("Per i servizi di emergenza (con codice), il sistema supporta un percorso con tappe intermedie (waypoint):");
  doc.moveDown(0.3);

  bullet("Punto di partenza: la sede operativa o la posizione GPS corrente");
  bullet("Tappa 1 - Luogo Intervento: il punto dove si raggiunge il paziente");
  bullet("Tappa 2 - Destinazione Intermedia: l'ospedale o struttura di destinazione");
  bullet("Rientro: il ritorno alla sede operativa");

  doc.moveDown(0.3);
  bodyText("I chilometri vengono calcolati separatamente per ogni tratta del percorso e poi sommati per ottenere il totale del servizio.");

  doc.moveDown(0.3);
  sectionTitle("4.5 Numerazione Progressiva Automatica");
  bodyText("Ogni servizio registrato riceve automaticamente un numero progressivo assegnato dal sistema. La numerazione e univoca per veicolo e segue un ordine cronologico. Non e necessario inserire manualmente il numero del servizio.");

  doc.moveDown(0.3);
  sectionTitle("4.6 Servizi Senza Paziente");
  bodyText("Per tutti i movimenti del veicolo senza paziente a bordo (trasferimento mezzo, rifornimento carburante, manutenzione, lavaggio), seleziona 'SENZA PAZIENTE' come tipo di servizio. In questo caso non sara necessario compilare i dati anagrafici del paziente.");
  doc.moveDown(0.3);
  warningBox("OBBLIGO DI REGISTRAZIONE", "TUTTI i movimenti del veicolo devono essere registrati, compresi quelli senza paziente. Questo e necessario per il corretto calcolo del chilometraggio e per la rendicontazione completa del carburante (UTIF).");

  // =====================
  // CHAPTER 5: ELENCO SERVIZI
  // =====================
  doc.moveDown(0.8);
  chapterTitle("5", "Elenco Servizi");

  doc.moveDown(0.3);
  sectionTitle("5.1 Consultazione dei Servizi");
  bodyText("Dalla sezione 'Servizi' nella barra di navigazione puoi consultare l'elenco completo di tutti i trasporti registrati con il tuo veicolo. I servizi sono ordinati dal piu recente al piu vecchio.");
  doc.moveDown(0.3);

  bodyText("Per ogni servizio nell'elenco vengono mostrate le seguenti informazioni:");
  doc.moveDown(0.2);
  bullet("Numero progressivo del servizio");
  bullet("Data e ora del trasporto");
  bullet("Luogo di origine e destinazione");
  bullet("Tipo di servizio (dimissione, visita, trasferimento, ecc.)");
  bullet("Chilometri percorsi nella tratta");
  bullet("Badge di verifica integrita (certificazione crittografica)");

  doc.moveDown(0.3);
  sectionTitle("5.2 Dettaglio del Servizio");
  bodyText("Toccando un servizio dall'elenco, si apre la scheda completa con tutti i dettagli registrati: dati del paziente, orari, percorso, note e la mappa del tragitto effettuato.");

  doc.moveDown(0.3);
  sectionTitle("5.3 Modifica di un Servizio");
  bodyText("Per modificare un servizio gia registrato:");
  doc.moveDown(0.3);
  numberedStep(1, "Tocca il servizio dalla lista per aprire il dettaglio");
  numberedStep(2, "Tocca il pulsante 'Modifica' nella parte superiore della schermata");
  numberedStep(3, "Apporta le modifiche necessarie ai campi desiderati");
  numberedStep(4, "Tocca 'Salva' per confermare le modifiche");

  doc.moveDown(0.3);
  infoBox("INTEGRITA DATI", "Ogni servizio e protetto da una firma crittografica (HMAC-SHA256) che ne garantisce l'integrita. Le modifiche vengono tracciate nel registro di audit per garantire la trasparenza e la conformita normativa.");

  doc.moveDown(0.3);
  sectionTitle("5.4 Servizi in Attesa di Sincronizzazione");
  bodyText("Se hai registrato servizi mentre eri offline, questi vengono mostrati con un indicatore speciale che segnala che sono in attesa di invio al server. Non appena la connessione internet sara disponibile, i servizi verranno sincronizzati automaticamente.");

  // =====================
  // CHAPTER 6: CHECKLIST
  // =====================
  doc.moveDown(0.8);
  chapterTitle("6", "Checklist Pre-Partenza");

  doc.moveDown(0.3);
  sectionTitle("6.1 Obbligo di Compilazione");
  bodyText("La checklist pre-partenza deve essere compilata obbligatoriamente all'inizio di ogni turno di lavoro. Il suo scopo e verificare lo stato del veicolo, la presenza e il funzionamento di tutte le dotazioni sanitarie e la sicurezza complessiva del mezzo prima di iniziare il servizio.");
  doc.moveDown(0.3);
  bodyText("Lo stato della checklist viene mostrato nella Home: un indicatore segnala se la checklist del giorno e stata completata o se e ancora da compilare.");

  doc.moveDown(0.3);
  sectionTitle("6.2 Come Compilare la Checklist");
  bodyText("Per accedere alla checklist: vai nella sezione Profilo e tocca il pulsante blu 'Checklist Pre-Partenza'.");
  doc.moveDown(0.3);

  numberedStep(1, "Scegli la modalita di compilazione: Veloce (conferma tutto ok per zona) o Dettagliata (verifica articolo per articolo)");
  numberedStep(2, "In modalita veloce: tocca 'Tutto OK' per ogni zona se tutti gli articoli sono conformi");
  numberedStep(3, "In modalita dettagliata: espandi ogni zona toccando l'intestazione colorata");
  numberedStep(4, "Spunta ogni voce che hai verificato e che risulta conforme");
  numberedStep(5, "Se un articolo presenta un problema, tocca il pulsante di segnalazione accanto ad esso");
  numberedStep(6, "Se ci sono anomalie generali, attiva la casella 'Segnala anomalia' e descrivi il problema");
  numberedStep(7, "Inserisci il tuo nome nel campo firma (obbligatorio per la validazione)");
  numberedStep(8, "Tocca 'CONFERMA CHECKLIST' per salvare e inviare la checklist");

  doc.moveDown(0.3);
  sectionTitle("6.3 Zone e Categorie dei Materiali");
  bodyText("I materiali sono organizzati in zone con un codice colore per facilitarne l'identificazione:");
  doc.moveDown(0.3);

  twoColumnBox(
    { title: "ZONE PRINCIPALI", items: [
      "Controlli Autista (Arancione): verifiche sul funzionamento del mezzo",
      "Materiale Zaino (Verde): dotazioni della borsa di emergenza",
    ] },
    { title: "ZONE MATERIALI", items: [
      "Materiale Ambulanza (Blu): dotazioni fisse del mezzo sanitario",
      "Materiale Vario (Rosso): materiali di consumo e accessori",
    ] },
    ORANGE,
    BLUE
  );

  doc.moveDown(0.3);
  sectionTitle("6.4 Segnalazione Problemi");
  bodyText("Quando trovi un problema su un articolo durante la checklist, puoi classificarlo in tre categorie:");
  doc.moveDown(0.3);

  labeledItem("Mancante", "L'articolo non e presente a bordo del veicolo. Il sistema lo segnalera come critico se si tratta di un materiale obbligatorio.");
  labeledItem("Quantita insufficiente", "L'articolo e presente ma la quantita disponibile e inferiore al minimo richiesto. Puoi indicare la quantita effettivamente presente.");
  labeledItem("Danneggiato", "L'articolo e presente ma risulta non funzionante, rotto o deteriorato. Non deve essere utilizzato e va sostituito al piu presto.");

  doc.moveDown(0.3);
  warningBox("SICUREZZA OPERATIVA", "In caso di anomalie gravi che compromettono la sicurezza del servizio (ad esempio mancanza di defibrillatore o estintore, danni strutturali al mezzo), NON utilizzare il veicolo e contattare immediatamente il coordinatore della sede.");

  doc.moveDown(0.3);
  sectionTitle("6.5 Sezione Ossigeno");
  bodyText("La checklist include una sezione dedicata al controllo delle bombole di ossigeno. Per ogni bombola (Bombola 1, Bombola 2 e Portatile) e necessario indicare il livello di riempimento in bar utilizzando il cursore dedicato.");

  doc.moveDown(0.3);
  sectionTitle("6.6 Storico Checklist");
  bodyText("Dalla stessa schermata puoi consultare lo storico delle checklist compilate in precedenza, selezionando la scheda 'Storico'. Questo ti permette di verificare le checklist dei turni precedenti e controllare eventuali segnalazioni ricorrenti.");

  // =====================
  // CHAPTER 7: SCADENZE
  // =====================
  doc.moveDown(0.8);
  chapterTitle("7", "Scadenze Materiali");

  doc.moveDown(0.3);
  sectionTitle("7.1 Sistema di Monitoraggio");
  bodyText("Il sistema monitora automaticamente le date di scadenza di tutti i materiali sanitari presenti a bordo del veicolo. Le scadenze vengono controllate continuamente e gli avvisi vengono mostrati sia nella Home che nella sezione dedicata.");

  doc.moveDown(0.3);
  sectionTitle("7.2 Codici Colore delle Scadenze");
  bodyText("Ogni materiale con scadenza viene classificato con un codice colore:");
  doc.moveDown(0.3);

  labeledItem("Rosso - SCADUTO", "Il materiale ha superato la data di scadenza e deve essere sostituito immediatamente. Non utilizzare materiali scaduti.");
  labeledItem("Arancione - IN SCADENZA", "Il materiale scade entro i prossimi 15 giorni. Pianifica la sostituzione al piu presto.");
  labeledItem("Verde - VALIDO", "Il materiale ha una scadenza superiore a 15 giorni. Nessun intervento necessario.");
  labeledItem("Grigio - SENZA DATA", "Per il materiale non e stata impostata una data di scadenza. Verificare e aggiornare se necessario.");

  doc.moveDown(0.3);
  sectionTitle("7.3 Come Ripristinare un Materiale Scaduto");
  bodyText("Quando sostituisci un materiale scaduto con uno nuovo, devi aggiornare la data di scadenza nel sistema:");
  doc.moveDown(0.3);

  numberedStep(1, "Vai su Profilo e tocca il pulsante 'Scadenze Materiali' (verde o rosso se urgente)");
  numberedStep(2, "Trova il materiale che hai sostituito nell'elenco");
  numberedStep(3, "Tocca il materiale per aprire il pannello di aggiornamento");
  numberedStep(4, "Inserisci la nuova data di scadenza leggendola dalla confezione del prodotto");
  numberedStep(5, "Conferma il ripristino toccando 'Conferma Ripristino'");

  doc.moveDown(0.3);
  sectionTitle("7.4 Verifica Mensile Obbligatoria");
  bodyText("Dal 24 al 31 di ogni mese, il sistema richiede una verifica completa di tutti i materiali con scadenza. In questo periodo:");
  doc.moveDown(0.3);

  bullet("Il pulsante 'Scadenze Materiali' nel Profilo diventa ROSSO con il badge 'URGENTE'");
  bullet("Devi controllare fisicamente ogni materiale e verificarne la data di scadenza");
  bullet("Al termine della verifica, invia il report mensile per confermare il completamento");
  bullet("Se la verifica non viene completata entro fine mese, il sistema continuera a segnalare l'urgenza");

  doc.moveDown(0.3);
  tipBox("ORGANIZZAZIONE", "Pianifica la verifica mensile delle scadenze nei primi giorni del periodo (dal 24 al 26) per avere il tempo di procurare eventuali materiali sostitutivi prima della fine del mese.");

  // =====================
  // CHAPTER 8: CONSEGNE
  // =====================
  doc.moveDown(0.8);
  chapterTitle("8", "Passaggio Consegne");

  doc.moveDown(0.3);
  sectionTitle("8.1 Importanza del Passaggio Consegne");
  bodyText("Il passaggio consegne e uno strumento fondamentale per la comunicazione tra i turni. Permette di informare l'equipaggio successivo sullo stato del veicolo, sulle attivita svolte e su eventuali problemi o situazioni in corso che richiedono attenzione.");

  doc.moveDown(0.3);
  sectionTitle("8.2 Come Effettuare il Passaggio Consegne");
  bodyText("Il passaggio consegne si effettua dalla schermata Home tramite il widget dedicato:");
  doc.moveDown(0.3);

  numberedStep(1, "Dalla Home, tocca il widget 'Consegne' nella parte inferiore della schermata");
  numberedStep(2, "Seleziona la categoria della consegna: Generale, Manutenzione, Attrezzatura, Paziente o Sicurezza");
  numberedStep(3, "Seleziona il livello di priorita: Urgente, Normale o Bassa");
  numberedStep(4, "Scrivi il messaggio descrivendo lo stato del veicolo e le informazioni importanti");
  numberedStep(5, "Conferma il passaggio consegne toccando il pulsante di invio");

  doc.moveDown(0.3);
  sectionTitle("8.3 Categorie di Consegna");
  bodyText("Le categorie disponibili per classificare le consegne:");
  doc.moveDown(0.3);

  labeledItem("Generale", "Informazioni generiche sullo stato del veicolo e del servizio.");
  labeledItem("Manutenzione", "Segnalazioni relative a guasti, usura o necessita di intervento tecnico sul mezzo.");
  labeledItem("Attrezzatura", "Informazioni su dotazioni mancanti, danneggiate o da ripristinare.");
  labeledItem("Paziente", "Note relative a pazienti in carico o situazioni sanitarie da conoscere.");
  labeledItem("Sicurezza", "Segnalazioni urgenti relative alla sicurezza del veicolo o dell'equipaggio.");

  doc.moveDown(0.3);
  sectionTitle("8.4 Storico Consegne");
  bodyText("Lo storico completo dei passaggi consegne e consultabile toccando 'Vedi storico' nel widget consegne della Home. Ogni consegna riporta la data, l'ora, il nome dell'operatore, la categoria, la priorita e il messaggio completo.");

  // =====================
  // CHAPTER 9: MISSIONI HUB
  // =====================
  doc.moveDown(0.8);
  chapterTitle("9", "Missioni Programmate (Hub)");

  doc.moveDown(0.3);
  sectionTitle("9.1 Cos'e il Sistema Hub");
  bodyText("Se la tua organizzazione ha attivato il modulo 'Hub Prenotazioni', i cittadini e le strutture sanitarie convenzionate (RSA, cliniche, centri di riabilitazione) possono prenotare servizi di trasporto direttamente online. Quando l'amministratore assegna una prenotazione al tuo veicolo, questa diventa una 'missione programmata' visibile nell'app.");

  doc.moveDown(0.3);
  sectionTitle("9.2 Visualizzazione delle Missioni");
  bodyText("Le missioni programmate assegnate al tuo veicolo vengono mostrate in due punti:");
  doc.moveDown(0.3);

  bullet("Nella Home: un widget dedicato mostra il numero di missioni attive e i dettagli della prossima missione in programma");
  bullet("Nella schermata 'Missioni Programmate': l'elenco completo di tutte le missioni assegnate, accessibile toccando il widget nella Home");

  doc.moveDown(0.3);
  bodyText("Per ogni missione vengono mostrati:");
  bullet("Numero di prenotazione e tipo di servizio richiesto");
  bullet("Data e fascia oraria richiesta dal prenotante");
  bullet("Indirizzo di prelievo e di destinazione con eventuali note");
  bullet("Dati del paziente: nome, telefono, esigenze speciali");
  bullet("Necessita particolari: carrozzina, barella, ossigeno, andata/ritorno");

  doc.moveDown(0.3);
  sectionTitle("9.3 Aggiornamento Stato della Missione");
  bodyText("Durante l'esecuzione della missione, aggiorna lo stato per informare l'amministratore e il prenotante del progresso:");
  doc.moveDown(0.3);

  numberedStep(1, "ASSEGNATA: la missione e stata assegnata al tuo veicolo. Tocca 'Partenza' quando ti metti in viaggio");
  numberedStep(2, "IN VIAGGIO: sei in viaggio verso il punto di prelievo. Tocca 'Paziente a Bordo' quando hai caricato il paziente");
  numberedStep(3, "PAZIENTE A BORDO: il paziente e a bordo. Tocca 'Completa Missione' quando arrivi a destinazione");
  numberedStep(4, "COMPLETATA: la missione e conclusa. Lo stato viene aggiornato automaticamente nel sistema");

  doc.moveDown(0.3);
  tipBox("PUNTUALITA", "Le missioni programmate hanno una fascia oraria concordata con il prenotante. Cerca di rispettare gli orari indicati. Se prevedi ritardi, l'amministratore sara notificato dell'aggiornamento di stato.");

  // =====================
  // CHAPTER 10: DETTAGLI VEICOLO
  // =====================
  doc.moveDown(0.8);
  chapterTitle("10", "Dettagli Veicolo");

  doc.moveDown(0.3);
  sectionTitle("10.1 Accesso ai Dettagli");
  bodyText("Per accedere ai dettagli completi del veicolo, vai nella sezione Profilo e tocca il pulsante 'Dettagli Veicolo'. Questa schermata ti mostra una panoramica completa delle statistiche e dello stato del tuo mezzo.");

  doc.moveDown(0.3);
  sectionTitle("10.2 Statistiche del Veicolo");
  bodyText("La schermata Dettagli Veicolo mostra le seguenti statistiche:");
  doc.moveDown(0.3);

  labeledItem("Servizi Totali", "Il numero complessivo di servizi effettuati con il veicolo da quando e stato registrato nel sistema.");
  labeledItem("Servizi Ultimi 30 Giorni", "Il numero di servizi effettuati nell'ultimo mese.");
  labeledItem("Km Ultimi 30 Giorni", "I chilometri percorsi nell'ultimo mese.");
  labeledItem("Media Km per Servizio", "La distanza media di ogni singolo servizio.");
  labeledItem("Durata Media", "Il tempo medio di ogni servizio, calcolato tra ora di partenza e ora di rientro.");

  doc.moveDown(0.3);
  sectionTitle("10.3 Servizi Recenti");
  bodyText("Nella parte inferiore della schermata viene mostrata la lista degli ultimi servizi effettuati con il veicolo, con data, percorso e chilometri. Questo ti permette di avere un quadro rapido dell'attivita recente del mezzo.");

  doc.moveDown(0.3);
  sectionTitle("10.4 Informazioni sulla Manutenzione");
  bodyText("Se configurato dall'amministratore, la schermata mostra anche le date di prossima revisione e prossima manutenzione programmata del veicolo, con indicatori di stato che segnalano eventuali scadenze imminenti.");

  // =====================
  // CHAPTER 11: DOCUMENTI
  // =====================
  doc.moveDown(0.8);
  chapterTitle("11", "Documenti Veicolo");

  doc.moveDown(0.3);
  sectionTitle("11.1 Consultazione Documenti");
  bodyText("Dalla sezione Profilo > Documenti Veicolo puoi consultare lo stato di tutti i documenti associati al tuo mezzo. I documenti sono organizzati per tipologia:");
  doc.moveDown(0.3);

  bullet("Libretto di circolazione");
  bullet("Assicurazione RCA");
  bullet("Revisione periodica");
  bullet("Bollo auto");
  bullet("Autorizzazione sanitaria");
  bullet("Altri documenti specifici");

  doc.moveDown(0.3);
  sectionTitle("11.2 Stato delle Scadenze");
  bodyText("Per ogni documento viene mostrata la data di scadenza con un codice colore:");
  doc.moveDown(0.3);

  bullet("Verde - Documento valido, scadenza oltre 30 giorni");
  bullet("Arancione - Documento in scadenza, scade entro 30 giorni");
  bullet("Rosso - Documento scaduto o in scadenza entro 7 giorni");

  doc.moveDown(0.3);
  bodyText("Le scadenze dei documenti vengono gestite dall'amministratore. In caso di documenti scaduti o in scadenza, verra notificato automaticamente per procedere al rinnovo.");

  // =====================
  // CHAPTER 12: SANIFICAZIONE
  // =====================
  doc.moveDown(0.8);
  chapterTitle("12", "Registro Sanificazioni");

  doc.moveDown(0.3);
  sectionTitle("12.1 Quando Registrare una Sanificazione");
  bodyText("La sanificazione del veicolo deve essere registrata in due situazioni specifiche:");
  doc.moveDown(0.3);

  labeledItem("Sanificazione Straordinaria", "Pulizia approfondita del mezzo, da effettuare periodicamente secondo le procedure dell'organizzazione. Identificata dal colore verde nell'app.");
  labeledItem("Sanificazione per Paziente Infettivo", "Obbligatoria dopo il trasporto di un paziente con patologia infettiva nota o sospetta. Identificata dal colore rosso nell'app, richiede procedure specifiche e prodotti dedicati.");

  doc.moveDown(0.3);
  sectionTitle("12.2 Come Registrare una Sanificazione");
  bodyText("Per registrare una sanificazione eseguita:");
  doc.moveDown(0.3);

  numberedStep(1, "Vai su Profilo e tocca 'Sanificazione' nella sezione veicolo");
  numberedStep(2, "Tocca il pulsante per aggiungere una nuova sanificazione");
  numberedStep(3, "Seleziona il tipo di sanificazione: Straordinaria o Paziente Infettivo");
  numberedStep(4, "Inserisci il tuo nome come operatore che ha eseguito la sanificazione");
  numberedStep(5, "Indica i prodotti utilizzati (opzionale ma consigliato)");
  numberedStep(6, "Aggiungi eventuali note aggiuntive");
  numberedStep(7, "Conferma la registrazione");

  doc.moveDown(0.3);
  sectionTitle("12.3 Storico e Statistiche");
  bodyText("La schermata mostra lo storico completo delle sanificazioni effettuate sul veicolo, con statistiche riassuntive: numero totale di sanificazioni, suddivisione per tipo (straordinaria vs. infettivo) e date delle ultime sanificazioni. Le schede sono interattive: tocca una sanificazione per vedere tutti i dettagli.");

  // =====================
  // CHAPTER 13: CARBURANTE
  // =====================
  doc.moveDown(0.8);
  chapterTitle("13", "Carta Carburante");

  doc.moveDown(0.3);
  sectionTitle("13.1 Analisi dei Consumi");
  bodyText("La sezione Carta Carburante, accessibile da Profilo > Tessera Carburante, fornisce un'analisi dettagliata dei consumi del veicolo basata sui servizi registrati e sul consumo medio del mezzo:");
  doc.moveDown(0.3);

  labeledItem("Questo Mese", "Chilometri percorsi, servizi effettuati, litri stimati e costo stimato del carburante per il mese corrente.");
  labeledItem("Mese Precedente", "Gli stessi dati per il mese precedente, utili per il confronto.");
  labeledItem("Anno Corrente", "Riepilogo annuale dei consumi, utile per la pianificazione del budget.");
  labeledItem("Storico Completo", "Tutti i dati dalla prima registrazione del veicolo nel sistema.");

  doc.moveDown(0.3);
  sectionTitle("13.2 Impatto Ambientale");
  bodyText("La sezione include anche il calcolo delle emissioni di CO2 stimate per il veicolo, suddivise per mese e per anno. Questi dati contribuiscono al report di sostenibilita ambientale dell'organizzazione.");

  doc.moveDown(0.3);
  bodyText("I prezzi del carburante vengono aggiornati automaticamente dal sistema in base alle medie provinciali fornite dal Ministero delle Imprese e del Made in Italy.");

  // =====================
  // CHAPTER 14: INVENTARIO
  // =====================
  doc.moveDown(0.8);
  chapterTitle("14", "Inventario Materiali");

  doc.moveDown(0.3);
  sectionTitle("14.1 Gestione delle Scorte");
  bodyText("La sezione Inventario ti permette di visualizzare e gestire tutti i materiali e le dotazioni presenti a bordo del veicolo. Ogni materiale e classificato per categoria e mostra la quantita attuale rispetto alla quantita richiesta.");
  doc.moveDown(0.3);

  bodyText("Le categorie di materiali includono: Presidi, Farmaci, Medicazione, Rianimazione, Immobilizzazione, Protezione, Fluidi, Strumentazione e altro.");

  doc.moveDown(0.3);
  sectionTitle("14.2 Scanner QR e Barcode");
  bodyText("L'app include uno scanner integrato per leggere codici QR e barcode stampati sulle confezioni dei materiali. Questo permette di:");
  doc.moveDown(0.3);

  bullet("Identificare rapidamente un materiale nel catalogo");
  bullet("Verificare la quantita disponibile a bordo");
  bullet("Registrare l'utilizzo di un materiale durante il servizio");
  bullet("Segnalare la necessita di ripristino");

  doc.moveDown(0.3);
  bodyText("Per utilizzare lo scanner: tocca l'icona della fotocamera nella sezione inventario e inquadra il codice presente sulla confezione del materiale.");

  doc.moveDown(0.3);
  sectionTitle("14.3 Segnalazione Utilizzo e Ripristino");
  bodyText("Quando utilizzi un materiale durante un servizio, puoi registrare l'utilizzo nell'inventario per aggiornare le quantita disponibili. Il sistema segnalera automaticamente all'amministratore i materiali che scendono sotto la soglia minima richiesta, facilitando il ripristino tempestivo.");

  // =====================
  // CHAPTER 15: GPS
  // =====================
  doc.moveDown(0.8);
  chapterTitle("15", "Tracciamento GPS");

  doc.moveDown(0.3);
  sectionTitle("15.1 Attivazione del Tracciamento");
  bodyText("Il tracciamento GPS registra automaticamente la posizione del veicolo durante i servizi. Per attivarlo:");
  doc.moveDown(0.3);

  numberedStep(1, "Vai nella sezione Profilo");
  numberedStep(2, "Individua la card 'Tracciamento GPS'");
  numberedStep(3, "Se non hai ancora concesso il permesso di localizzazione, tocca 'Abilita GPS' e consenti l'accesso alla posizione");
  numberedStep(4, "Tocca 'Avvia Tracciamento' per iniziare la registrazione");

  doc.moveDown(0.3);
  sectionTitle("15.2 Funzionamento del Tracciamento");
  bodyText("Una volta attivato, il sistema funziona in modo completamente automatico:");
  doc.moveDown(0.3);

  bullet("La posizione viene registrata ogni 30 secondi durante il servizio");
  bullet("Un badge 'LIVE' verde indica che il tracciamento e attivo");
  bullet("Il contatore di punti GPS registrati viene aggiornato in tempo reale");
  bullet("I dati di posizione vengono inviati al server per la visualizzazione sulla mappa nell'admin");
  bullet("Il tracciamento si interrompe automaticamente alla chiusura dell'app");

  doc.moveDown(0.3);
  sectionTitle("15.3 Privacy e Protezione dei Dati");
  bodyText("I dati di posizione GPS vengono trattati nel pieno rispetto della normativa GDPR:");
  doc.moveDown(0.3);

  bullet("I dati vengono conservati per un massimo di 90 giorni");
  bullet("Sono utilizzati esclusivamente per la gestione operativa del servizio");
  bullet("L'accesso ai dati di posizione e riservato all'amministratore dell'organizzazione");
  bullet("I dati vengono cancellati automaticamente al termine del periodo di conservazione");

  // =====================
  // CHAPTER 16: PROFILO
  // =====================
  doc.moveDown(0.8);
  chapterTitle("16", "Profilo e Impostazioni");

  doc.moveDown(0.3);
  sectionTitle("16.1 Schermata Profilo");
  bodyText("La schermata Profilo mostra le informazioni del tuo account veicolo:");
  doc.moveDown(0.3);

  bullet("Logo dell'organizzazione (se configurato) o icona del veicolo");
  bullet("Nome dell'organizzazione e sede operativa");
  bullet("Equipaggio del turno corrente (se configurato)");
  bullet("Ruolo dell'utente: Equipaggio, Direttore o Amministratore");

  doc.moveDown(0.3);
  sectionTitle("16.2 Sezioni del Profilo");
  bodyText("Dal Profilo puoi accedere a tutte le funzionalita di gestione del veicolo e delle impostazioni:");
  doc.moveDown(0.3);

  labeledItem("Dettagli Veicolo", "Statistiche complete del mezzo, servizi recenti, dati di manutenzione.");
  labeledItem("Documenti", "Stato dei documenti del veicolo con avvisi di scadenza.");
  labeledItem("Sanificazione", "Registro delle sanificazioni con storico e statistiche.");
  labeledItem("Tessera Carburante", "Analisi consumi, costi e impatto ambientale.");
  labeledItem("Checklist Pre-Partenza", "Controllo giornaliero obbligatorio delle dotazioni.");
  labeledItem("Scadenze Materiali", "Monitoraggio scadenze con verifica mensile.");
  labeledItem("Tracciamento GPS", "Attivazione e gestione della registrazione posizione.");
  labeledItem("Notifiche", "Configurazione delle notifiche dell'app.");
  labeledItem("Privacy e Dati", "Informativa privacy GDPR completa, gestione consensi e diritti.");
  labeledItem("Assistenza", "Supporto e contatti per problemi tecnici.");
  labeledItem("Info App", "Versione dell'app e informazioni tecniche.");

  doc.moveDown(0.3);
  sectionTitle("16.3 Uscita dall'Account");
  bodyText("Per uscire dall'account, scorri fino in fondo alla schermata Profilo e tocca il pulsante rosso 'Esci dall'account'. Al successivo accesso dovrai reinserire le credenziali (a meno che tu non abbia attivato 'Ricorda credenziali' al login).");

  // =====================
  // CHAPTER 17: OFFLINE
  // =====================
  doc.moveDown(0.8);
  chapterTitle("17", "Funzionamento Offline");

  doc.moveDown(0.3);
  sectionTitle("17.1 Come Funziona la Modalita Offline");
  bodyText("L'app e progettata per funzionare anche in assenza di connessione internet. Questa funzionalita e fondamentale per garantire la continuita operativa in zone con scarsa copertura di rete o in caso di problemi temporanei di connessione.");
  doc.moveDown(0.3);

  bodyText("Quando l'app non e connessa al server:");
  doc.moveDown(0.2);
  bullet("I servizi registrati vengono salvati in modo sicuro nella memoria del telefono");
  bullet("L'indicatore sulla Home passa da 'Online' (verde) a 'Offline' (rosso)");
  bullet("Un contatore mostra il numero di servizi in attesa di sincronizzazione");
  bullet("I dati vengono crittografati localmente per garantire la sicurezza");

  doc.moveDown(0.3);
  sectionTitle("17.2 Sincronizzazione Automatica");
  bodyText("Quando la connessione internet torna disponibile, i servizi salvati offline vengono sincronizzati automaticamente con il server:");
  doc.moveDown(0.3);

  bullet("La sincronizzazione avviene in background senza interrompere il tuo lavoro");
  bullet("Un indicatore mostra il progresso della sincronizzazione");
  bullet("In caso di errori durante la sincronizzazione, l'app riprova automaticamente");
  bullet("Puoi anche forzare manualmente la sincronizzazione toccando il pulsante 'Riprova'");

  doc.moveDown(0.3);
  tipBox("NESSUN DATO PERSO", "Non preoccuparti di perdere dati: anche senza connessione, registra tutti i servizi normalmente. L'app conserva tutto in sicurezza e inviera i dati al server non appena la connessione sara ripristinata. L'app si aggiorna automaticamente ogni 30 secondi quando sei online.");

  // =====================
  // CHAPTER 18: ASSISTENZA
  // =====================
  newPage();
  doc.y = 42;
  chapterTitle("18", "Problemi e Assistenza");

  doc.moveDown(0.3);
  sectionTitle("18.1 Problemi Comuni e Soluzioni");
  bodyText("Di seguito trovi le soluzioni ai problemi piu frequenti riscontrati dagli equipaggi:");
  doc.moveDown(0.3);

  const problems = [
    ["Problema", "Soluzione"],
    ["Password dimenticata", "Contatta il coordinatore o l'amministratore della tua organizzazione"],
    ["L'app non si apre", "Chiudi completamente l'app e riaprila. Se persiste, riavvia il telefono"],
    ["Non vedo i miei servizi", "Verifica la connessione internet. Se sei offline, i servizi saranno visibili dopo la sincronizzazione"],
    ["Checklist non si salva", "Assicurati di aver inserito il tuo nome nel campo firma. Tutti i campi obbligatori devono essere compilati"],
    ["Km calcolati sbagliati", "Verifica che l'origine e la destinazione siano corretti. Puoi modificare manualmente i km se necessario"],
    ["L'app e lenta", "Verifica la connessione. L'app funziona anche offline, chiudi altre app in background"],
    ["GPS non funziona", "Assicurati che il GPS sia attivo nelle impostazioni del telefono. Concedi il permesso di localizzazione all'app"],
    ["Foto non si invia", "Verifica la connessione internet. Le foto richiedono una connessione attiva per essere inviate"],
    ["Servizi non sincronizzati", "Tocca il pulsante 'Riprova' nella Home o attendi la sincronizzazione automatica"],
  ];

  problems.forEach((row, i) => {
    tableRow(row, i === 0);
  });

  doc.moveDown(0.5);
  sectionTitle("18.2 Contatti per Assistenza");
  bodyText("Per qualsiasi problema non risolto con le indicazioni sopra, contatta i seguenti riferimenti:");
  doc.moveDown(0.3);

  labeledItem("Coordinatore di Sede", "Per problemi operativi, turni, credenziali di accesso e questioni organizzative. E il primo riferimento per qualsiasi necessita quotidiana.");
  labeledItem("Amministratore Organizzazione", "Per problemi tecnici con l'account, configurazione del veicolo, moduli e funzionalita dell'app.");
  labeledItem("Supporto Tecnico Soccorso Digitale", "Per problemi tecnici della piattaforma, malfunzionamenti dell'app o segnalazioni di bug. Scrivi a: info@soccorsodigitale.app");

  // =====================
  // RIEPILOGO COMANDI RAPIDI
  // =====================
  doc.moveDown(0.5);
  ensureSpace(380);

  const riepilogoY = doc.y;
  doc.rect(margin, riepilogoY, contentWidth, 32).fill(BLUE);
  doc.fontSize(14).fillColor("#FFFFFF").font("Helvetica-Bold");
  doc.text("RIEPILOGO COMANDI RAPIDI", margin + 14, riepilogoY + 8, { lineBreak: false });
  doc.y = riepilogoY + 38;

  const commands = [
    ["Azione", "Come fare"],
    ["Nuovo servizio", "Pulsante '+' nella barra di navigazione"],
    ["Vedere i servizi", "Tab 'Servizi' nella barra di navigazione"],
    ["Modificare un servizio", "Servizi > tocca servizio > Modifica"],
    ["Checklist giornaliera", "Profilo > Checklist Pre-Partenza"],
    ["Scadenze materiali", "Profilo > Scadenze Materiali"],
    ["Missioni programmate", "Widget nella Home > Missioni Programmate"],
    ["Passaggio consegne", "Widget Consegne nella Home"],
    ["Inventario materiali", "Profilo > Inventario"],
    ["Documenti veicolo", "Profilo > Documenti Veicolo"],
    ["Sanificazione", "Profilo > Sanificazione"],
    ["Carta carburante", "Profilo > Tessera Carburante"],
    ["Tracciamento GPS", "Profilo > Tracciamento GPS > Avvia"],
    ["Dettagli veicolo", "Profilo > Dettagli Veicolo"],
    ["Segnalazione foto", "Icona fotocamera nella Home"],
    ["Privacy e GDPR", "Profilo > Privacy e Dati"],
    ["Logout", "Profilo > Esci dall'account"],
  ];

  commands.forEach((row, i) => {
    tableRow(row, i === 0);
  });

  // =====================
  // CLOSING PAGE
  // =====================
  doc.moveDown(0.8);
  ensureSpace(120);

  doc.rect(margin, doc.y, contentWidth, 100).fill(LIGHT_GRAY);
  const closingY = doc.y;
  doc.fontSize(14).fillColor(BLUE).font("Helvetica-Bold");
  doc.text(orgName.toUpperCase(), margin, closingY + 16, { width: contentWidth, align: "center", lineBreak: false });
  doc.fontSize(11).fillColor(GREEN).font("Helvetica-Bold");
  doc.text("Gestione Trasporti Sanitari", margin, closingY + 36, { width: contentWidth, align: "center", lineBreak: false });
  doc.fontSize(10).fillColor(GRAY).font("Helvetica");
  doc.text("Manuale Equipaggio v4.0 - Febbraio 2026", margin, closingY + 54, { width: contentWidth, align: "center", lineBreak: false });
  doc.fontSize(10).fillColor(BLUE).font("Helvetica-Bold");
  doc.text("soccorsodigitale.app", margin, closingY + 70, { width: contentWidth, align: "center", lineBreak: false });
  doc.fontSize(9).fillColor(GRAY).font("Helvetica");
  doc.text("info@soccorsodigitale.app", margin, closingY + 84, { width: contentWidth, align: "center", lineBreak: false });
  doc.y = closingY + 106;

  doc.end();
}
