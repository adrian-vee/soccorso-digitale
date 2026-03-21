const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const outputPath = path.join(__dirname, '..', 'docs', 'legal', 'manuale-operativo.pdf');
const logoPath = path.join(__dirname, '..', 'docs', 'legal', 'logo-croce-europa.png');
const appIconPath = path.join(__dirname, '..', 'docs', 'legal', 'app-icon.png');

const doc = new PDFDocument({ 
  size: 'A4', 
  margins: { top: 60, bottom: 60, left: 50, right: 50 },
  autoFirstPage: false
});

const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);

const COLORS = {
  primary: '#0066CC',
  secondary: '#00A651',
  text: '#1A202C',
  lightText: '#4A5568',
  tableHeader: '#EBF4FF',
  tableBorder: '#CBD5E0',
  white: '#FFFFFF'
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = 495;
const LEFT = 50;
const TOP = 60;
const BOTTOM_LIMIT = 780;

let pageNum = 0;

function newPage() {
  doc.addPage();
  pageNum++;
  if (pageNum > 1) {
    doc.save();
    doc.rect(0, 0, PAGE_WIDTH, 40).fill(COLORS.primary);
    doc.fontSize(10).fillColor(COLORS.white).font('Helvetica-Bold');
    doc.text('MANUALE OPERATIVO - SOCCORSO DIGITALE v2.0', LEFT, 14, { width: CONTENT_WIDTH });
    doc.restore();
    doc.y = TOP + 10;
  }
}

function spaceLeft() {
  return BOTTOM_LIMIT - doc.y;
}

function needSpace(h) {
  if (spaceLeft() < h) {
    newPage();
    return true;
  }
  return false;
}

function section(num, title) {
  needSpace(60);
  doc.moveDown(0.6);
  const y = doc.y;
  doc.save();
  doc.roundedRect(LEFT, y, CONTENT_WIDTH, 32, 4).fill(COLORS.primary);
  doc.fontSize(15).fillColor(COLORS.white).font('Helvetica-Bold');
  doc.text(num + '. ' + title.toUpperCase(), LEFT + 12, y + 9, { width: CONTENT_WIDTH - 24 });
  doc.restore();
  doc.y = y + 44;
}

function subsection(title) {
  needSpace(40);
  doc.moveDown(0.4);
  doc.fontSize(13).fillColor(COLORS.secondary).font('Helvetica-Bold');
  doc.text(title, LEFT, doc.y, { width: CONTENT_WIDTH });
  doc.moveDown(0.3);
}

function para(text) {
  needSpace(30);
  doc.fontSize(11).fillColor(COLORS.text).font('Helvetica');
  doc.text(text, LEFT, doc.y, { width: CONTENT_WIDTH, align: 'left', lineGap: 3 });
  doc.moveDown(0.4);
}

function bullet(text) {
  needSpace(22);
  doc.fontSize(11).fillColor(COLORS.text).font('Helvetica');
  doc.text('- ' + text, LEFT + 15, doc.y, { width: CONTENT_WIDTH - 15, lineGap: 2 });
}

function table(headers, rows, widths) {
  const numCols = headers.length;
  const colW = widths || headers.map(() => CONTENT_WIDTH / numCols);
  const rowH = 24;
  const headerH = 26;
  
  needSpace(headerH + rows.length * rowH + 10);
  
  let y = doc.y;
  doc.save();
  doc.rect(LEFT, y, CONTENT_WIDTH, headerH).fill(COLORS.tableHeader);
  doc.fillColor(COLORS.primary).font('Helvetica-Bold').fontSize(11);
  let x = LEFT + 6;
  headers.forEach((h, i) => {
    doc.text(h, x, y + 7, { width: colW[i] - 12 });
    x += colW[i];
  });
  doc.restore();
  y += headerH;
  
  rows.forEach((row, ri) => {
    if (y + rowH > BOTTOM_LIMIT) {
      doc.addPage();
      pageNum++;
      doc.save();
      doc.rect(0, 0, PAGE_WIDTH, 40).fill(COLORS.primary);
      doc.fontSize(10).fillColor(COLORS.white).font('Helvetica-Bold');
      doc.text('MANUALE OPERATIVO - SOCCORSO DIGITALE v2.0', LEFT, 14, { width: CONTENT_WIDTH });
      doc.restore();
      y = TOP + 20;
    }
    const bg = ri % 2 === 0 ? COLORS.white : '#F7FAFC';
    doc.rect(LEFT, y, CONTENT_WIDTH, rowH).fill(bg);
    doc.rect(LEFT, y, CONTENT_WIDTH, rowH).lineWidth(0.5).stroke(COLORS.tableBorder);
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(10);
    x = LEFT + 6;
    row.forEach((cell, i) => {
      doc.text(cell || '', x, y + 6, { width: colW[i] - 12 });
      x += colW[i];
    });
    y += rowH;
  });
  doc.y = y + 10;
}

function importantBox(text, color) {
  needSpace(45);
  const y = doc.y;
  doc.save();
  doc.roundedRect(LEFT, y, CONTENT_WIDTH, 36, 5).fill(color || COLORS.secondary);
  doc.fontSize(11).fillColor(COLORS.white).font('Helvetica-Bold');
  doc.text(text, LEFT + 15, y + 11, { width: CONTENT_WIDTH - 30, align: 'center' });
  doc.restore();
  doc.y = y + 46;
}

// ============ COVER PAGE ============
doc.addPage();
pageNum = 1;

doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(COLORS.white);

doc.rect(0, 0, PAGE_WIDTH, 8).fill(COLORS.primary);
doc.rect(0, 8, PAGE_WIDTH, 5).fill(COLORS.secondary);

if (fs.existsSync(logoPath)) {
  try { doc.image(logoPath, PAGE_WIDTH / 2 - 150, 50, { width: 300 }); } catch (e) {}
}

doc.y = 160;
doc.save();
doc.roundedRect(50, doc.y, PAGE_WIDTH - 100, 120, 10).lineWidth(2).stroke(COLORS.primary);
doc.restore();

doc.fontSize(16).fillColor(COLORS.lightText).font('Helvetica');
doc.text('MANUALE OPERATIVO', 50, doc.y + 20, { width: PAGE_WIDTH - 100, align: 'center' });

doc.fontSize(32).fillColor(COLORS.primary).font('Helvetica-Bold');
doc.text('APP SOCCORSO DIGITALE', 50, doc.y + 50, { width: PAGE_WIDTH - 100, align: 'center' });

doc.fontSize(14).fillColor(COLORS.text).font('Helvetica');
doc.text('Applicazione Mobile per la Gestione dei Trasporti Sanitari', 50, doc.y + 90, { width: PAGE_WIDTH - 100, align: 'center' });

if (fs.existsSync(appIconPath)) {
  try { doc.image(appIconPath, PAGE_WIDTH / 2 - 60, 420, { width: 120 }); } catch (e) {}
}

doc.save();
doc.roundedRect(PAGE_WIDTH / 2 - 80, 570, 160, 55, 8).fill(COLORS.primary);
doc.fontSize(20).fillColor(COLORS.white).font('Helvetica-Bold');
doc.text('Versione 2.0', PAGE_WIDTH / 2 - 80, 582, { width: 160, align: 'center' });
doc.fontSize(12).font('Helvetica');
doc.text('Febbraio 2026', PAGE_WIDTH / 2 - 80, 605, { width: 160, align: 'center' });
doc.restore();

doc.rect(0, PAGE_HEIGHT - 13, PAGE_WIDTH, 5).fill(COLORS.secondary);
doc.rect(0, PAGE_HEIGHT - 8, PAGE_WIDTH, 8).fill(COLORS.primary);

// ============ INDEX PAGE ============
newPage();
doc.y = 70;

doc.fontSize(24).fillColor(COLORS.primary).font('Helvetica-Bold');
doc.text('INDICE GENERALE', LEFT, doc.y, { width: CONTENT_WIDTH, align: 'center' });
doc.moveDown(1.5);

const indexItems = [
  ['1', 'Introduzione'],
  ['2', 'Accesso all\'Applicazione'],
  ['3', 'Interfaccia Principale'],
  ['4', 'Registrazione Viaggi'],
  ['5', 'Elenco Viaggi'],
  ['6', 'Checklist Pre-Partenza'],
  ['7', 'Gestione Materiali e Scadenze'],
  ['8', 'Materiali da Ripristinare'],
  ['9', 'Scadenze Materiali'],
  ['10', 'Privacy e Protezione Dati'],
  ['11', 'Assistenza'],
  ['12', 'Info App'],
  ['13', 'Appendici']
];

indexItems.forEach((item, i) => {
  const y = doc.y;
  const bg = i % 2 === 0 ? '#EBF4FF' : COLORS.white;
  doc.rect(LEFT, y, CONTENT_WIDTH, 38).fill(bg);
  
  doc.save();
  doc.circle(LEFT + 25, y + 19, 14).fill(COLORS.primary);
  doc.fontSize(14).fillColor(COLORS.white).font('Helvetica-Bold');
  doc.text(item[0], LEFT + 12, y + 13, { width: 26, align: 'center' });
  doc.restore();
  
  doc.fontSize(14).fillColor(COLORS.text).font('Helvetica');
  doc.text(item[1], LEFT + 55, y + 13, { width: CONTENT_WIDTH - 70 });
  
  doc.y = y + 40;
});

// ============ CONTENT ============
newPage();

section('1', 'Introduzione');

subsection('1.1 Cos\'e Soccorso Digitale');
para('Soccorso Digitale e l\'applicazione mobile ufficiale di Croce Europa per la gestione completa dei servizi di trasporto sanitario. L\'app permette di:');
bullet('Registrare i viaggi di trasporto effettuati');
bullet('Monitorare le scadenze dei materiali sanitari');
bullet('Compilare le checklist pre-partenza');
bullet('Tracciare i percorsi tramite GPS');
bullet('Gestire l\'inventario dei materiali');

doc.moveDown(0.5);
subsection('1.2 Requisiti Tecnici');
table(
  ['Requisito', 'Dettaglio'],
  [
    ['Dispositivi', 'Smartphone Android 10 o superiore'],
    ['Connessione', 'Funziona anche offline (sincronizzazione automatica)'],
    ['Credenziali', 'Fornite dall\'Amministrazione della sede']
  ],
  [160, 335]
);

subsection('1.3 A chi e destinata');
table(
  ['Ruolo', 'Funzionalita Principali'],
  [
    ['Equipaggio Ambulanza', 'Registrazione viaggi, checklist, aggiornamento scadenze'],
    ['Coordinatori', 'Supervisione scadenze, approvazione ripristini, report'],
    ['Amministratori', 'Gestione completa del sistema, statistiche, scanner']
  ],
  [160, 335]
);

subsection('1.4 Colori Aziendali');
bullet('Blu Istituzionale (#0066CC): elementi principali e navigazione');
bullet('Verde Croce Europa (#00A651): conferme e stati positivi');

newPage();

section('2', 'Accesso all\'Applicazione');

subsection('2.1 Download e Installazione');
para('Scarica l\'app dal Google Play Store cercando "Croce Europa". Al primo avvio l\'app richiedera le autorizzazioni necessarie per il corretto funzionamento (GPS, notifiche).');

subsection('2.2 Primo Accesso');
para('Per accedere all\'applicazione:');
bullet('Apri l\'applicazione sul tuo dispositivo Android');
bullet('Seleziona "Accedi" dalla schermata iniziale');
bullet('Inserisci le credenziali fornite dall\'Amministrazione');
bullet('Leggi e accetta la Privacy Policy');
bullet('Completa l\'accesso');

doc.moveDown(0.5);
subsection('2.3 Account Veicolo');
importantBox('Ogni ambulanza dispone di credenziali proprie. Il sistema riconosce automaticamente mezzo e sede operativa.', COLORS.primary);

subsection('2.4 Problemi di Accesso');
table(
  ['Problema', 'Soluzione'],
  [
    ['Password dimenticata', 'Contatta l\'Amministratore di sede'],
    ['Account bloccato', 'Attendi 15 minuti o contatta l\'Amministratore'],
    ['Errore di connessione', 'Verifica la connessione internet e riprova'],
    ['Credenziali errate', 'Verifica username e password con attenzione']
  ],
  [180, 315]
);

newPage();

section('3', 'Interfaccia Principale');

subsection('3.1 Schermata Home');
para('La schermata principale e stata progettata per essere compatta e intuitiva. Mostra:');
table(
  ['Elemento', 'Descrizione'],
  [
    ['Saluto e Codice Veicolo', 'Buongiorno/Buon pomeriggio + codice ambulanza'],
    ['Sede Operativa', 'Nome della sede assegnata al veicolo'],
    ['Stato Connessione', 'Indicatore visivo Online/Offline'],
    ['Widget Heartbeat', 'Statistiche in tempo reale del veicolo'],
    ['Widget Handoff', 'Passaggio consegne tra equipaggi'],
    ['Avviso Materiali', 'Alert per materiali scaduti o in scadenza'],
    ['Card Checklist', 'Stato della checklist giornaliera'],
    ['Km Totali', 'Chilometri attuali del veicolo']
  ],
  [170, 325]
);

subsection('3.2 Avviso Materiali');
para('Se sulla Home compare un avviso colorato:');
bullet('Rosso: Materiali scaduti - "Da ripristinare urgentemente"');
bullet('Arancione: Materiali in scadenza - "Verifica le scadenze"');
para('Tocca l\'avviso per accedere alla schermata "Materiali da Ripristinare".');

subsection('3.3 Menu di Navigazione');
table(
  ['Icona', 'Sezione', 'Funzione'],
  [
    ['Casa', 'Home', 'Schermata principale con riepilogo e avvisi'],
    ['Lista (3 linee)', 'Viaggi', 'Elenco dei servizi effettuati'],
    ['+', 'Inserisci', 'Registrazione nuovo viaggio'],
    ['Persona', 'Profilo', 'Impostazioni, checklist, scadenze materiali']
  ],
  [90, 110, 295]
);

newPage();

section('4', 'Registrazione Viaggi');

subsection('4.1 Nuovo Viaggio');
para('Per registrare un nuovo trasporto sanitario tocca "Inserisci" dalla barra di navigazione (icona +) e compila i campi richiesti:');
table(
  ['Campo', 'Descrizione', 'Obbligatorio'],
  [
    ['Data servizio', 'Data del trasporto sanitario', 'Si'],
    ['Tipo servizio', 'Dialisi, Dimissione, Visita, Trasferimento', 'Si'],
    ['Origine', 'Ospedale, Domicilio, CDR, Sede', 'Si'],
    ['Destinazione', 'Punto di arrivo del paziente', 'Si'],
    ['Km iniziali', 'Chilometri contachilometri alla partenza', 'Si'],
    ['Km finali', 'Chilometri contachilometri all\'arrivo', 'Si'],
    ['Genere paziente', 'M/F (richiesto dalla normativa sanitaria)', 'Si'],
    ['Anno nascita', 'Per statistiche anonime aggregate', 'Si'],
    ['Note', 'Eventuali annotazioni sul servizio', 'No']
  ],
  [130, 280, 85]
);

subsection('4.2 Calcolo Automatico Chilometri');
para('Il sistema calcola automaticamente la distanza del percorso tramite GPS. Inserisci origine e destinazione e i chilometri vengono compilati automaticamente nel modulo.');

subsection('4.3 Viaggi Senza Paziente');
importantBox('IMPORTANTE: Tutti i viaggi devono essere registrati, anche quelli senza paziente a bordo (trasferimento mezzo, rifornimento, manutenzione).', '#DC3545');

subsection('4.4 Modalita Offline');
para('Senza connessione internet puoi comunque registrare i viaggi. I dati vengono salvati localmente sul dispositivo e sincronizzati automaticamente quando la connessione torna disponibile.');

newPage();

section('5', 'Elenco Viaggi');

subsection('5.1 Accesso all\'Elenco');
para('Tocca "Viaggi" dalla barra di navigazione (icona con 3 linee) per visualizzare tutti i servizi effettuati dal veicolo.');

subsection('5.2 Visualizzazione');
para('L\'elenco mostra per ogni viaggio: data e ora del servizio, origine e destinazione, tipo di servizio e stato del viaggio.');

subsection('5.3 Dettaglio Viaggio');
para('Tocca un viaggio dalla lista per vedere la scheda completa con tutti i dettagli registrati durante il servizio.');

subsection('5.4 Modifica Viaggio');
para('Per modificare un viaggio gia salvato: tocca il viaggio dalla lista, tocca l\'icona di modifica, apporta le modifiche necessarie e tocca "Salva" per confermare.');
importantBox('Alcune modifiche potrebbero richiedere l\'approvazione del Coordinatore di sede.', '#FFC107');

section('6', 'Checklist Pre-Partenza');

subsection('6.1 Importanza della Checklist');
para('Prima di ogni turno e obbligatorio compilare la checklist di controllo del mezzo. Questo garantisce:');
bullet('La sicurezza del paziente trasportato');
bullet('La sicurezza del personale di bordo');
bullet('Il corretto funzionamento delle dotazioni sanitarie');
bullet('La conformita alle normative sanitarie vigenti');
bullet('La tracciabilita delle verifiche effettuate');

doc.moveDown(0.5);
subsection('6.2 Accesso alla Checklist');
para('Dalla schermata Profilo tocca il pulsante blu "Checklist Pre-Partenza". Oppure dalla Home tocca la card "Checklist" se mostra lo stato "Da fare".');

newPage();

subsection('6.3 Come Compilare la Checklist');
para('Segui questi passaggi per compilare correttamente la checklist:');
bullet('Accedi alla Checklist Pre-Partenza dal Profilo');
bullet('Verifica fisicamente ogni articolo elencato sul mezzo');
bullet('Spunta le voci che risultano conformi');
bullet('Segnala eventuali anomalie riscontrate');
bullet('Al termine firma la checklist inserendo il tuo nome');

doc.moveDown(0.5);
subsection('6.4 Zone della Checklist');
table(
  ['Zona', 'Colore', 'Contenuto'],
  [
    ['Materiale Zaino', 'Verde (#00A651)', 'Dotazioni della borsa di emergenza'],
    ['Materiale Ambulanza', 'Blu (#0066CC)', 'Dotazioni fisse del mezzo'],
    ['Materiale Vario', 'Rosso (#CC0000)', 'Materiali di consumo e accessori']
  ],
  [160, 140, 195]
);

section('7', 'Gestione Materiali e Scadenze');

subsection('7.1 Sistema di Monitoraggio');
para('L\'applicazione monitora automaticamente le scadenze dei materiali sanitari presenti sul mezzo:');
bullet('Controllo quotidiano automatico di tutte le scadenze');
bullet('Generazione avvisi 15 giorni prima della scadenza');
bullet('Visualizzazione materiali scaduti con priorita massima');
bullet('Storico completo di tutti i ripristini effettuati');

doc.moveDown(0.5);
subsection('7.2 Codici Colore delle Scadenze');
table(
  ['Stato', 'Colore', 'Significato'],
  [
    ['Scaduto', 'Rosso', 'Da sostituire immediatamente'],
    ['In scadenza', 'Arancione', 'Scade entro 15 giorni'],
    ['Valido', 'Verde', 'Scadenza oltre 15 giorni'],
    ['Senza data', 'Grigio', 'Data di scadenza non impostata']
  ],
  [120, 120, 255]
);

subsection('7.3 Workflow Ripristinato/Scaduto');
para('Quando un materiale risulta scaduto o in scadenza, l\'equipaggio puo:');
bullet('Ripristinare: Sostituire il materiale e aggiornare la nuova data di scadenza');
bullet('Segnalare come Scaduto: Notificare il Coordinatore per la sostituzione');

newPage();

section('8', 'Materiali da Ripristinare');

subsection('8.1 Accesso alla Schermata');
para('La schermata "Materiali da Ripristinare" e accessibile toccando l\'avviso colorato sulla Home quando sono presenti materiali scaduti o in scadenza.');

subsection('8.2 Cosa Mostra la Schermata');
bullet('Contatore Scaduti: Numero di materiali gia scaduti (badge rosso)');
bullet('Contatore In Scadenza: Materiali che scadono entro 15 giorni (badge arancione)');
bullet('Lista materiali: Elenco completo ordinato per urgenza con data di scadenza');

doc.moveDown(0.5);
subsection('8.3 Come Aggiornare un Materiale');
para('Per ripristinare un materiale scaduto o in scadenza:');
bullet('Tocca il materiale da aggiornare nella lista');
bullet('Si apre il pannello "Ripristina Materiale"');
bullet('Inserisci la nuova data di scadenza nel formato GG/MM/AAAA');
bullet('Tocca "Conferma Ripristino" per salvare');
para('Il sistema registra automaticamente lo storico di ogni ripristino effettuato, inclusa la data precedente.');

section('9', 'Scadenze Materiali');

subsection('9.1 Accesso');
para('Dalla schermata Profilo tocca il pulsante verde "Scadenze Materiali". Il pulsante diventa rosso con badge "URGENTE" quando la verifica mensile e da completare (dal 24 al 31 del mese).');

subsection('9.2 Scopo della Verifica Mensile');
para('La verifica mensile delle scadenze serve per documentare il controllo periodico di tutti i materiali con scadenza, identificare eventuali materiali problematici e garantire la conformita alle normative sanitarie.');

subsection('9.3 Come Compilare la Verifica');
bullet('Vai su Profilo e tocca "Scadenze Materiali"');
bullet('Il sistema mostra tutti i materiali organizzati per zona');
bullet('Espandi ogni sezione e verifica gli articoli presenti');
bullet('Spunta gli articoli che hai verificato');
bullet('Inserisci il tuo nome nel campo operatore');
bullet('Tocca "Invia Report" per completare la verifica');

newPage();

section('10', 'Privacy e Protezione Dati');

subsection('10.1 Conformita GDPR');
para('L\'applicazione e pienamente conforme al Regolamento UE 2016/679 (GDPR) sulla protezione dei dati personali. Accesso alle informazioni: Profilo > Privacy e Dati.');

subsection('10.2 Dati Raccolti');
table(
  ['Tipo', 'Dato', 'Descrizione'],
  [
    ['Operatore', 'Nome e Cognome', 'Identificazione nelle checklist e nei report'],
    ['Operatore', 'Posizione GPS', 'Tracciamento del percorso durante i servizi'],
    ['Paziente', 'Domicilio (senza civico)', 'Indirizzo senza numero civico per privacy'],
    ['Paziente', 'Anno di Nascita', 'Per statistiche anonime aggregate'],
    ['Paziente', 'Genere', 'Dato richiesto dalla normativa sanitaria']
  ],
  [80, 150, 265]
);

subsection('10.3 Come Proteggiamo i Tuoi Dati');
bullet('Crittografia dei dati in transito e a riposo');
bullet('Accesso limitato esclusivamente al personale autorizzato');
bullet('Conservazione conforme alla normativa sanitaria vigente');
bullet('Audit trail completo per tracciare ogni accesso ai dati');

doc.moveDown(0.5);
subsection('10.4 Azioni Disponibili');
bullet('Informativa Completa: Visualizza la privacy policy completa');
bullet('Contatta il DPO: Invia email a privacy@croceeuropa.com');

section('11', 'Assistenza');

subsection('11.1 Orari di Assistenza');
importantBox('Lunedi - Venerdi: 09:00 - 15:00', COLORS.primary);

subsection('11.2 Contatti');
table(
  ['Canale', 'Contatto'],
  [
    ['Email', 'supporto@croceeuropa.com'],
    ['WhatsApp', '392 806 6329']
  ],
  [140, 355]
);

newPage();

subsection('11.3 Domande Frequenti');

doc.fontSize(11).fillColor(COLORS.text).font('Helvetica-Bold');
doc.text('Come registro un nuovo viaggio?', LEFT, doc.y, { width: CONTENT_WIDTH });
doc.font('Helvetica');
doc.text('Tocca "Inserisci" dalla barra di navigazione, compila tutti i campi richiesti e premi "Salva". I chilometri vengono calcolati automaticamente tramite GPS.', LEFT, doc.y, { width: CONTENT_WIDTH });
doc.moveDown(0.6);

doc.font('Helvetica-Bold');
doc.text('Posso modificare un viaggio gia salvato?', LEFT, doc.y, { width: CONTENT_WIDTH });
doc.font('Helvetica');
doc.text('Si, dalla lista viaggi tocca il viaggio che vuoi modificare. Alcune modifiche potrebbero richiedere l\'approvazione del Coordinatore di sede.', LEFT, doc.y, { width: CONTENT_WIDTH });
doc.moveDown(0.6);

doc.font('Helvetica-Bold');
doc.text('Come funziona la modalita offline?', LEFT, doc.y, { width: CONTENT_WIDTH });
doc.font('Helvetica');
doc.text('Puoi registrare viaggi anche senza connessione internet. I dati vengono salvati sul dispositivo e sincronizzati automaticamente quando torni online.', LEFT, doc.y, { width: CONTENT_WIDTH });
doc.moveDown(0.6);

doc.font('Helvetica-Bold');
doc.text('Quando devo compilare la checklist?', LEFT, doc.y, { width: CONTENT_WIDTH });
doc.font('Helvetica');
doc.text('La checklist va compilata all\'inizio di ogni turno, prima di iniziare i servizi. E obbligatoria per garantire la sicurezza del paziente e del personale.', LEFT, doc.y, { width: CONTENT_WIDTH });
doc.moveDown(0.6);

doc.font('Helvetica-Bold');
doc.text('Come aggiorno un materiale scaduto?', LEFT, doc.y, { width: CONTENT_WIDTH });
doc.font('Helvetica');
doc.text('Tocca l\'avviso sulla Home, seleziona il materiale dalla lista, inserisci la nuova data di scadenza e conferma. Il sistema registra automaticamente lo storico.', LEFT, doc.y, { width: CONTENT_WIDTH });
doc.moveDown(0.6);

doc.font('Helvetica-Bold');
doc.text('A chi mi rivolgo per problemi tecnici?', LEFT, doc.y, { width: CONTENT_WIDTH });
doc.font('Helvetica');
doc.text('Contatta l\'assistenza via email (supporto@croceeuropa.com) o WhatsApp (392 806 6329) negli orari indicati. Per problemi urgenti durante un servizio, contatta il Coordinatore.', LEFT, doc.y, { width: CONTENT_WIDTH });
doc.moveDown(0.8);

subsection('11.4 Problema Urgente Durante un Servizio');
para('In caso di problema urgente durante un servizio di trasporto, contatta direttamente il Coordinatore della tua sede operativa.');

section('12', 'Info App');

subsection('12.1 Informazioni Applicazione');
table(
  ['Campo', 'Valore'],
  [
    ['Nome App', 'Soccorso Digitale'],
    ['Versione', '2.0'],
    ['Sviluppato da', 'Adrian Vasile, Area Tech Croce Europa'],
    ['Piattaforma', 'Android'],
    ['Ultimo Aggiornamento', 'Febbraio 2026']
  ],
  [170, 325]
);

subsection('12.2 Funzionalita Principali');
bullet('Gestione Viaggi con tracciamento GPS automatico');
bullet('Checklist Digitali pre-partenza obbligatorie');
bullet('Inventario Smart con monitoraggio scadenze materiali');
bullet('Sicurezza GDPR compliant con protezione dati');
bullet('Modalita offline con sincronizzazione automatica');

newPage();

section('13', 'Appendici');

subsection('Appendice A - Glossario');
table(
  ['Termine', 'Significato'],
  [
    ['Account Veicolo', 'Credenziali di accesso associate a un mezzo di soccorso'],
    ['Checklist', 'Lista di controllo pre-partenza obbligatoria'],
    ['Coordinatore', 'Responsabile della supervisione operativa della sede'],
    ['DPO', 'Data Protection Officer - responsabile protezione dati'],
    ['GDPR', 'Regolamento Generale sulla Protezione dei Dati'],
    ['GPS', 'Sistema di posizionamento satellitare globale'],
    ['Handoff', 'Passaggio consegne tra equipaggi a fine turno'],
    ['Heartbeat', 'Widget che mostra statistiche in tempo reale'],
    ['Ripristino', 'Sostituzione di materiale scaduto con nuovo'],
    ['Scadenza', 'Data entro cui un materiale deve essere sostituito']
  ],
  [150, 345]
);

subsection('Appendice B - Menu Profilo');
table(
  ['Sezione', 'Funzione'],
  [
    ['Dettagli Veicolo', 'Visualizza informazioni sul veicolo attivo'],
    ['Checklist Pre-Partenza', 'Accesso al controllo giornaliero obbligatorio'],
    ['Scadenze Materiali', 'Verifica mensile delle scadenze (dal 24 al 31)'],
    ['Notifiche', 'Gestione delle notifiche push'],
    ['Privacy e Dati', 'Informazioni GDPR e protezione dati'],
    ['Assistenza', 'Contatti, orari e domande frequenti'],
    ['Info App', 'Versione e informazioni applicazione'],
    ['Esci dall\'account', 'Logout dall\'applicazione']
  ],
  [170, 325]
);

newPage();

subsection('Appendice C - Codici Colore Interfaccia');
table(
  ['Colore', 'Significato nell\'Applicazione'],
  [
    ['Blu (#0066CC)', 'Colore istituzionale, azioni principali e navigazione'],
    ['Verde (#00A651)', 'Conferme, stati positivi, materiali validi'],
    ['Rosso', 'Errori, materiali scaduti, azioni critiche'],
    ['Arancione', 'Avvisi, materiali in scadenza, attenzione richiesta'],
    ['Grigio', 'Elementi disabilitati, informazioni secondarie']
  ],
  [150, 345]
);

// ============ BACK COVER ============
newPage();

doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(COLORS.white);
doc.rect(0, 0, PAGE_WIDTH, 8).fill(COLORS.primary);
doc.rect(0, 8, PAGE_WIDTH, 5).fill(COLORS.secondary);

if (fs.existsSync(logoPath)) {
  try { doc.image(logoPath, PAGE_WIDTH / 2 - 120, 320, { width: 240 }); } catch (e) {}
}

doc.fontSize(12).fillColor(COLORS.lightText).font('Helvetica');
doc.text('Documento riservato ad uso interno del personale', 0, 440, { width: PAGE_WIDTH, align: 'center' });
doc.moveDown(0.6);
doc.fontSize(14).fillColor(COLORS.primary).font('Helvetica-Bold');
doc.text('Versione 2.0 - Febbraio 2026', 0, doc.y, { width: PAGE_WIDTH, align: 'center' });
doc.moveDown(2);
doc.fontSize(10).fillColor(COLORS.lightText).font('Helvetica');
doc.text('Per suggerimenti o segnalazioni: supporto@croceeuropa.com', 0, doc.y, { width: PAGE_WIDTH, align: 'center' });

doc.rect(0, PAGE_HEIGHT - 13, PAGE_WIDTH, 5).fill(COLORS.secondary);
doc.rect(0, PAGE_HEIGHT - 8, PAGE_WIDTH, 8).fill(COLORS.primary);

const range = doc.bufferedPageRange();
for (let i = 1; i < range.count; i++) {
  doc.switchToPage(i);
  doc.fontSize(9).fillColor(COLORS.lightText).font('Helvetica');
  doc.text('Pagina ' + (i + 1), 0, PAGE_HEIGHT - 30, { width: PAGE_WIDTH, align: 'center' });
}

doc.end();

stream.on('finish', () => {
  console.log('PDF generato con successo: ' + outputPath);
  console.log('Totale pagine: ' + pageNum);
});
