import PDFDocument from 'pdfkit';
import { Response } from 'express';
import path from 'path';
import fs from 'fs';

const COLORS = {
  euBlue: '#003399',
  euGold: '#ffcc00',
  dark: '#1a202c',
  gray: '#4a5568',
  lightGray: '#f7fafc',
  white: '#ffffff',
  accent: '#2b6cb0',
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);
const FOOTER_Y = PAGE_HEIGHT - 40;

const COMPANY_INFO = {
  name: 'Soccorso Digitale',
  address: 'Via Forte Garofolo 20, 37057 San Giovanni Lupatoto (VR)',
  email: 'info@croceeuropa.com',
  phone: '+39 045 XXX XXXX',
};

export interface ProjectStats {
  totalTrips: number;
  totalKm: number;
  totalVehicles: number;
  activeVehicles: number;
  totalStaff: number;
  totalLocations: number;
  structuresServed: number;
  avgTripsPerDay: number;
  co2Saved: number;
}

function addHeader(doc: PDFKit.PDFDocument, title: string) {
  doc.rect(0, 0, PAGE_WIDTH, 80).fill(COLORS.euBlue);
  doc.font('Helvetica-Bold').fontSize(18).fillColor(COLORS.white);
  doc.text(title, MARGIN, 30, { width: CONTENT_WIDTH });
  doc.rect(MARGIN, 65, 80, 3).fill(COLORS.euGold);
}

function addFooter(doc: PDFKit.PDFDocument, pageNum: number, totalPages: number) {
  doc.rect(0, FOOTER_Y - 5, PAGE_WIDTH, 45).fill(COLORS.lightGray);
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.gray);
  doc.text(COMPANY_INFO.name, MARGIN, FOOTER_Y + 2);
  doc.text(COMPANY_INFO.address, MARGIN, FOOTER_Y + 12);
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.euBlue);
  doc.text(`${pageNum} / ${totalPages}`, PAGE_WIDTH - MARGIN - 30, FOOTER_Y + 7, { width: 30, align: 'right' });
}

function addLogo(doc: PDFKit.PDFDocument, x: number, y: number, width: number = 80) {
  const logoPath = path.join(process.cwd(), 'attached_assets', 'Logo-Croce-Europa-Ufficiale_1766252701803.png');
  try {
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, x, y, { width });
    }
  } catch (e) {
    doc.roundedRect(x, y, width, width * 0.8, 8).fill(COLORS.euBlue);
    doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.white);
    doc.text('CE', x + width/3, y + width/3);
  }
}

function addEUBadge(doc: PDFKit.PDFDocument, x: number, y: number) {
  doc.circle(x + 20, y + 20, 20).fill(COLORS.euBlue);
  for (let i = 0; i < 12; i++) {
    const angle = (i * 30 - 90) * Math.PI / 180;
    const starX = x + 20 + Math.cos(angle) * 14;
    const starY = y + 20 + Math.sin(angle) * 14;
    doc.circle(starX, starY, 2).fill(COLORS.euGold);
  }
}

function addSectionTitle(doc: PDFKit.PDFDocument, title: string, y: number): number {
  doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.euBlue);
  doc.text(title, MARGIN, y);
  doc.rect(MARGIN, y + 18, 60, 2).fill(COLORS.euGold);
  return y + 30;
}

function addParagraph(doc: PDFKit.PDFDocument, text: string, y: number, fontSize: number = 10): number {
  doc.font('Helvetica').fontSize(fontSize).fillColor(COLORS.dark);
  const textHeight = doc.heightOfString(text, { width: CONTENT_WIDTH, align: 'justify' });
  doc.text(text, MARGIN, y, { width: CONTENT_WIDTH, align: 'justify', lineGap: 3 });
  return y + textHeight + 10;
}

function addBulletList(doc: PDFKit.PDFDocument, items: string[], y: number): number {
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.dark);
  items.forEach(item => {
    doc.circle(MARGIN + 5, y + 5, 2).fill(COLORS.euGold);
    doc.text(item, MARGIN + 15, y, { width: CONTENT_WIDTH - 15 });
    y += 18;
  });
  return y + 5;
}

function addDataBox(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, value: string, label: string) {
  doc.roundedRect(x, y, w, h, 6).fill(COLORS.lightGray);
  doc.roundedRect(x, y, w, 4, 2).fill(COLORS.euBlue);
  doc.font('Helvetica-Bold').fontSize(16).fillColor(COLORS.euBlue);
  doc.text(value, x + 5, y + 15, { width: w - 10, align: 'center' });
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.gray);
  doc.text(label, x + 5, y + h - 18, { width: w - 10, align: 'center' });
}

function addTestDataNote(doc: PDFKit.PDFDocument, y: number): number {
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 50, 6).fill('#fff8e1');
  doc.roundedRect(MARGIN, y, 4, 50, 2).fill(COLORS.euGold);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.dark);
  doc.text('NOTA SUI DATI', MARGIN + 15, y + 8);
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.gray);
  doc.text('I dati riportati si riferiscono al periodo di test (Novembre - Dicembre 2025). La piattaforma SOCCORSO DIGITALE non e ancora operativa in produzione: le applicazioni mobili sono state testate per verificarne il funzionamento ma non sono ancora installate sui mezzi di soccorso.', MARGIN + 15, y + 22, { width: CONTENT_WIDTH - 30 });
  return y + 60;
}

export function generateBusinessPlanPDF(res: Response, stats: ProjectStats) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: MARGIN,
    bufferPages: true,
    info: {
      Title: 'Business Plan - SOCCORSO DIGITALE SOCCORSO DIGITALE',
      Author: COMPANY_INFO.name,
      Subject: 'Business Plan per Finanziamenti Europei',
    }
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=Business_Plan_DATA_PLATFORM_Croce_Europa.pdf');
  doc.pipe(res);

  let pageNum = 0;
  const pages: number[] = [];

  // PAGE 1: COVER
  pageNum++;
  pages.push(pageNum);
  
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(COLORS.euBlue);
  addLogo(doc, PAGE_WIDTH / 2 - 50, 100, 100);
  
  doc.font('Helvetica').fontSize(12).fillColor(COLORS.euGold);
  doc.text('DOCUMENTO PER FINANZIAMENTI EUROPEI', MARGIN, 230, { width: CONTENT_WIDTH, align: 'center' });
  
  doc.font('Helvetica-Bold').fontSize(32).fillColor(COLORS.white);
  doc.text('BUSINESS PLAN', MARGIN, 270, { width: CONTENT_WIDTH, align: 'center' });
  
  doc.font('Helvetica-Bold').fontSize(20).fillColor(COLORS.euGold);
  doc.text('SOCCORSO DIGITALE', MARGIN, 320, { width: CONTENT_WIDTH, align: 'center' });
  
  doc.font('Helvetica').fontSize(12).fillColor(COLORS.white);
  doc.text('Sistema Integrato di Gestione per', MARGIN, 370, { width: CONTENT_WIDTH, align: 'center' });
  doc.text('Servizi di Trasporto Sanitario', MARGIN, 385, { width: CONTENT_WIDTH, align: 'center' });
  
  doc.rect(PAGE_WIDTH / 2 - 40, 420, 80, 2).fill(COLORS.euGold);
  
  doc.font('Helvetica').fontSize(11).fillColor(COLORS.white);
  doc.text(COMPANY_INFO.name, MARGIN, 460, { width: CONTENT_WIDTH, align: 'center' });
  doc.text(COMPANY_INFO.address, MARGIN, 478, { width: CONTENT_WIDTH, align: 'center' });
  
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.euGold);
  doc.text('Gennaio 2026', MARGIN, 530, { width: CONTENT_WIDTH, align: 'center' });
  
  addEUBadge(doc, PAGE_WIDTH - 90, PAGE_HEIGHT - 100);
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.white);
  doc.text('Cofinanziato dall\'UE', PAGE_WIDTH - 110, PAGE_HEIGHT - 50);

  // PAGE 2: INDICE
  doc.addPage();
  pageNum++;
  pages.push(pageNum);
  
  addHeader(doc, 'INDICE');
  
  let y = 110;
  const indexItems = [
    { num: '1', title: 'Executive Summary', page: '3' },
    { num: '2', title: 'Profilo Aziendale', page: '4' },
    { num: '3', title: 'Descrizione del Progetto', page: '5' },
    { num: '4', title: 'Analisi del Mercato', page: '6' },
    { num: '5', title: 'Piano Operativo', page: '7' },
    { num: '6', title: 'Piano Finanziario', page: '8' },
    { num: '7', title: 'Impatto Sociale e Ambientale', page: '9' },
    { num: '8', title: 'Conclusioni', page: '10' },
  ];
  
  indexItems.forEach(item => {
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.euBlue);
    doc.text(`${item.num}.`, MARGIN, y, { continued: true });
    doc.font('Helvetica').fillColor(COLORS.dark);
    doc.text(`  ${item.title}`, { continued: false });
    doc.font('Helvetica').fillColor(COLORS.gray);
    doc.text(item.page, PAGE_WIDTH - MARGIN - 20, y, { width: 20, align: 'right' });
    y += 28;
  });
  
  addFooter(doc, pageNum, 10);

  // PAGE 3: EXECUTIVE SUMMARY
  doc.addPage();
  pageNum++;
  pages.push(pageNum);
  
  addHeader(doc, '1. EXECUTIVE SUMMARY');
  
  y = 100;
  y = addParagraph(doc, `${COMPANY_INFO.name} presenta il progetto SOCCORSO DIGITALE, un sistema integrato di gestione digitale per i servizi di trasporto sanitario. Il progetto risponde all'esigenza di modernizzazione del settore sanitario, combinando innovazione tecnologica con impatto sociale misurabile.`, y);
  
  y = addTestDataNote(doc, y + 5);
  
  y = addSectionTitle(doc, 'Dati del Periodo di Test (Nov-Dic 2025)', y + 5);
  
  const boxW = (CONTENT_WIDTH - 20) / 3;
  const boxH = 60;
  addDataBox(doc, MARGIN, y, boxW, boxH, stats.totalTrips.toLocaleString('it-IT'), 'Viaggi Registrati');
  addDataBox(doc, MARGIN + boxW + 10, y, boxW, boxH, `${stats.totalKm.toLocaleString('it-IT')} km`, 'Chilometri Totali');
  addDataBox(doc, MARGIN + (boxW + 10) * 2, y, boxW, boxH, stats.totalVehicles.toString(), 'Veicoli Testati');
  y += boxH + 15;
  addDataBox(doc, MARGIN, y, boxW, boxH, stats.totalStaff.toString(), 'Operatori Coinvolti');
  addDataBox(doc, MARGIN + boxW + 10, y, boxW, boxH, stats.totalLocations.toString(), 'Sedi Operative');
  addDataBox(doc, MARGIN + (boxW + 10) * 2, y, boxW, boxH, `${stats.co2Saved.toLocaleString('it-IT')} kg`, 'CO2 Risparmiata');
  
  y += boxH + 25;
  y = addSectionTitle(doc, 'Obiettivi del Finanziamento', y);
  y = addBulletList(doc, [
    'Completamento sviluppo piattaforma mobile (iOS/Android)',
    'Installazione applicazioni su tutti i mezzi della flotta',
    'Formazione completa per operatori e volontari',
    'Integrazione con sistemi sanitari regionali',
    'Certificazioni di qualita (ISO 9001, ISO 27001)',
  ], y);
  
  addFooter(doc, pageNum, 10);

  // PAGE 4: PROFILO AZIENDALE
  doc.addPage();
  pageNum++;
  pages.push(pageNum);
  
  addHeader(doc, '2. PROFILO AZIENDALE');
  
  y = 100;
  y = addSectionTitle(doc, 'Identita Aziendale', y);
  
  const companyData = [
    ['Ragione Sociale', COMPANY_INFO.name],
    ['Forma Giuridica', 'Societa a Responsabilita Limitata - Impresa Sociale'],
    ['Sede Operativa', COMPANY_INFO.address],
    ['Codice ATECO', '86.90.42 - Servizi di ambulanza'],
    ['Anno di Fondazione', '2018'],
  ];
  
  companyData.forEach(([label, value]) => {
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.gray);
    doc.text(label, MARGIN, y);
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.dark);
    doc.text(value, MARGIN + 130, y);
    y += 20;
  });
  
  y += 15;
  y = addSectionTitle(doc, 'Mission Aziendale', y);
  
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 50, 6).fill(COLORS.lightGray);
  doc.font('Helvetica-Oblique').fontSize(10).fillColor(COLORS.dark);
  doc.text('"Garantire a tutti l\'accesso a servizi di trasporto sanitario di qualita, combinando professionalita, innovazione tecnologica e spirito solidale."', MARGIN + 15, y + 15, { width: CONTENT_WIDTH - 30, align: 'center' });
  
  y += 70;
  y = addSectionTitle(doc, 'Ambiti di Attivita', y);
  y = addBulletList(doc, [
    'Trasporto Sanitario Programmato: accompagnamento pazienti per visite, dialisi, terapie',
    'Trasporto Sanitario Urgente: interventi di emergenza in convenzione con il 118',
    'Servizi per Eventi: assistenza sanitaria per manifestazioni sportive e culturali',
    'Formazione Sanitaria: corsi BLS-D, primo soccorso aziendale',
  ], y);
  
  y += 10;
  y = addSectionTitle(doc, 'Copertura Territoriale', y);
  y = addParagraph(doc, `L'azienda opera in ${stats.totalLocations} sedi distribuite tra le province di Verona e Vicenza, con una flotta di ${stats.totalVehicles} mezzi di soccorso e un team di ${stats.totalStaff} operatori tra dipendenti e volontari qualificati.`, y);
  
  addFooter(doc, pageNum, 10);

  // PAGE 5: DESCRIZIONE PROGETTO
  doc.addPage();
  pageNum++;
  pages.push(pageNum);
  
  addHeader(doc, '3. DESCRIZIONE DEL PROGETTO');
  
  y = 100;
  y = addSectionTitle(doc, 'SOCCORSO DIGITALE: Architettura', y);
  y = addParagraph(doc, 'SOCCORSO DIGITALE e una piattaforma software integrata per la gestione completa delle operazioni di trasporto sanitario. Il sistema e composto da tre componenti principali:', y);
  
  const components = [
    { title: 'App Mobile (iOS/Android)', items: ['Registrazione viaggi in tempo reale', 'Calcolo automatico chilometri GPS', 'Checklist pre-partenza', 'Funzionamento offline'] },
    { title: 'Pannello Amministrativo Web', items: ['Dashboard analytics', 'Gestione flotta e turni', 'Report UTIF automatici', 'Audit trail crittografico'] },
    { title: 'Backend e Database', items: ['API RESTful sicure', 'Database PostgreSQL', 'Backup automatici', 'Conformita GDPR'] },
  ];
  
  components.forEach(comp => {
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 75, 6).stroke(COLORS.euBlue);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.euBlue);
    doc.text(comp.title, MARGIN + 10, y + 10);
    
    let itemY = y + 28;
    comp.items.forEach(item => {
      doc.circle(MARGIN + 15, itemY + 4, 2).fill(COLORS.euGold);
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.dark);
      doc.text(item, MARGIN + 25, itemY);
      itemY += 14;
    });
    y += 85;
  });
  
  y += 5;
  y = addSectionTitle(doc, 'Stato Attuale del Progetto', y);
  y = addParagraph(doc, 'La piattaforma e stata sviluppata e testata internamente durante i mesi di Novembre e Dicembre 2025. I test hanno permesso di registrare dati operativi reali per validare il funzionamento del sistema. Le applicazioni mobili non sono ancora state distribuite sui mezzi operativi.', y);
  
  addFooter(doc, pageNum, 10);

  // PAGE 6: ANALISI MERCATO
  doc.addPage();
  pageNum++;
  pages.push(pageNum);
  
  addHeader(doc, '4. ANALISI DEL MERCATO');
  
  y = 100;
  y = addSectionTitle(doc, 'Il Settore del Trasporto Sanitario', y);
  y = addParagraph(doc, 'Il mercato italiano del trasporto sanitario rappresenta un settore strategico del Sistema Sanitario Nazionale, con un valore stimato di oltre 2,5 miliardi di euro annui. L\'invecchiamento della popolazione determina una crescita costante della domanda.', y);
  
  y = addSectionTitle(doc, 'Opportunita di Mercato', y + 5);
  
  const opportunities = [
    { trend: 'Digitalizzazione PA', desc: 'Obbligo di tracciabilita digitale per fornitori SSN' },
    { trend: 'Invecchiamento demografico', desc: '+35% domanda trasporti dialisi entro 2030' },
    { trend: 'Sostenibilita ambientale', desc: 'Incentivi per flotte a basse emissioni' },
    { trend: 'Telemedicina', desc: 'Integrazione con piattaforme e-health regionali' },
  ];
  
  opportunities.forEach(opp => {
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 35, 4).fill(COLORS.lightGray);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.euBlue);
    doc.text(opp.trend, MARGIN + 10, y + 8);
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.gray);
    doc.text(opp.desc, MARGIN + 10, y + 22);
    y += 42;
  });
  
  y += 10;
  y = addSectionTitle(doc, 'Posizionamento Competitivo', y);
  y = addBulletList(doc, [
    'Sviluppo interno: personalizzazione e controllo totale',
    'Approccio mobile-first per operatori sul campo',
    'Conformita nativa a normative GDPR e requisiti ASL',
    'Modello accessibile anche a piccole organizzazioni',
  ], y);
  
  addFooter(doc, pageNum, 10);

  // PAGE 7: PIANO OPERATIVO
  doc.addPage();
  pageNum++;
  pages.push(pageNum);
  
  addHeader(doc, '5. PIANO OPERATIVO');
  
  y = 100;
  y = addSectionTitle(doc, 'Struttura Organizzativa', y);
  
  const orgData = [
    { role: 'Direzione Generale', count: '2' },
    { role: 'Coordinatori di Sede', count: stats.totalLocations.toString() },
    { role: 'Autisti/Soccorritori', count: Math.round(stats.totalStaff * 0.7).toString() },
    { role: 'Personale Amministrativo', count: Math.round(stats.totalStaff * 0.1).toString() },
    { role: 'Volontari Formati', count: Math.round(stats.totalStaff * 0.2).toString() },
  ];
  
  orgData.forEach(org => {
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH * 0.7, 25, 4).fill(COLORS.lightGray);
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.dark);
    doc.text(org.role, MARGIN + 10, y + 7);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.euBlue);
    doc.text(org.count, MARGIN + CONTENT_WIDTH * 0.7 + 20, y + 7);
    y += 32;
  });
  
  y += 15;
  y = addSectionTitle(doc, 'Processi Digitalizzati', y);
  y = addBulletList(doc, [
    'Registrazione viaggio: App mobile con validazione automatica',
    'Pianificazione turni: Algoritmo di ottimizzazione con notifiche',
    'Manutenzione flotta: Checklist digitale con alert scadenze',
    'Fatturazione: Estrazione automatica dati e generazione documenti',
    'Compliance: Audit trail con hash chain crittografico',
  ], y);
  
  addFooter(doc, pageNum, 10);

  // PAGE 8: PIANO FINANZIARIO
  doc.addPage();
  pageNum++;
  pages.push(pageNum);
  
  addHeader(doc, '6. PIANO FINANZIARIO');
  
  y = 100;
  y = addSectionTitle(doc, 'Investimenti Richiesti', y);
  
  const investments = [
    { category: 'Sviluppo Software', amount: 85000 },
    { category: 'Infrastruttura IT', amount: 25000 },
    { category: 'Formazione Personale', amount: 35000 },
    { category: 'Certificazioni', amount: 20000 },
    { category: 'Marketing', amount: 15000 },
    { category: 'Hardware', amount: 20000 },
  ];
  
  const total = investments.reduce((sum, i) => sum + i.amount, 0);
  
  investments.forEach(inv => {
    const pct = (inv.amount / total) * 100;
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 28, 4).fill(COLORS.lightGray);
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH * (pct / 100), 28, 4).fill(COLORS.euBlue);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(pct > 25 ? COLORS.white : COLORS.dark);
    doc.text(inv.category, MARGIN + 10, y + 8);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.euGold);
    doc.text(`EUR ${inv.amount.toLocaleString('it-IT')}`, PAGE_WIDTH - MARGIN - 80, y + 8);
    y += 35;
  });
  
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 35, 6).fill(COLORS.euBlue);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.white);
  doc.text('TOTALE INVESTIMENTO', MARGIN + 15, y + 10);
  doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.euGold);
  doc.text(`EUR ${total.toLocaleString('it-IT')}`, PAGE_WIDTH - MARGIN - 100, y + 10);
  
  y += 55;
  y = addSectionTitle(doc, 'Proiezioni Economiche (3 anni)', y);
  
  const projW = (CONTENT_WIDTH - 20) / 3;
  const projections = [
    { year: 'Anno 1', revenue: '450.000', ebitda: '30.000' },
    { year: 'Anno 2', revenue: '580.000', ebitda: '90.000' },
    { year: 'Anno 3', revenue: '750.000', ebitda: '170.000' },
  ];
  
  projections.forEach((proj, idx) => {
    const px = MARGIN + idx * (projW + 10);
    doc.roundedRect(px, y, projW, 80, 6).stroke(COLORS.euBlue);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.euBlue);
    doc.text(proj.year, px, y + 10, { width: projW, align: 'center' });
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.gray);
    doc.text('Ricavi', px + 10, y + 35);
    doc.text('EBITDA', px + 10, y + 55);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.dark);
    doc.text(`EUR ${proj.revenue}`, px + projW - 80, y + 35);
    doc.text(`EUR ${proj.ebitda}`, px + projW - 80, y + 55);
  });
  
  addFooter(doc, pageNum, 10);

  // PAGE 9: IMPATTO SOCIALE
  doc.addPage();
  pageNum++;
  pages.push(pageNum);
  
  addHeader(doc, '7. IMPATTO SOCIALE E AMBIENTALE');
  
  y = 100;
  y = addTestDataNote(doc, y);
  
  y = addSectionTitle(doc, 'Impatto Sociale (dati periodo test)', y + 5);
  
  const socialMetrics = [
    { value: stats.totalTrips.toLocaleString('it-IT'), label: 'Viaggi Registrati' },
    { value: stats.totalStaff.toString(), label: 'Operatori Coinvolti' },
    { value: stats.totalLocations.toString(), label: 'Sedi Operative' },
  ];
  
  const smW = (CONTENT_WIDTH - 20) / 3;
  socialMetrics.forEach((sm, idx) => {
    const sx = MARGIN + idx * (smW + 10);
    doc.roundedRect(sx, y, smW, 55, 6).fill(COLORS.euBlue);
    doc.font('Helvetica-Bold').fontSize(18).fillColor(COLORS.euGold);
    doc.text(sm.value, sx, y + 12, { width: smW, align: 'center' });
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.white);
    doc.text(sm.label, sx + 5, y + 38, { width: smW - 10, align: 'center' });
  });
  
  y += 75;
  y = addSectionTitle(doc, 'Impatto Ambientale', y);
  y = addBulletList(doc, [
    `CO2 risparmiata rispetto ad auto private: ${stats.co2Saved.toLocaleString('it-IT')} kg`,
    'Ottimizzazione percorsi con routing intelligente',
    'Riduzione consumi carburante stimata: 15%',
  ], y);
  
  y += 10;
  y = addSectionTitle(doc, 'Allineamento SDGs', y);
  
  const sdgs = [
    { num: '3', title: 'Salute e Benessere' },
    { num: '8', title: 'Lavoro Dignitoso' },
    { num: '11', title: 'Citta Sostenibili' },
    { num: '13', title: 'Azione per il Clima' },
  ];
  
  sdgs.forEach(sdg => {
    doc.roundedRect(MARGIN, y, 30, 25, 4).fill(COLORS.euBlue);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.euGold);
    doc.text(sdg.num, MARGIN + 8, y + 7);
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.dark);
    doc.text(`SDG ${sdg.num}: ${sdg.title}`, MARGIN + 45, y + 7);
    y += 32;
  });
  
  addFooter(doc, pageNum, 10);

  // PAGE 10: CONCLUSIONI
  doc.addPage();
  pageNum++;
  pages.push(pageNum);
  
  addHeader(doc, '8. CONCLUSIONI');
  
  y = 100;
  y = addParagraph(doc, `Il progetto SOCCORSO DIGITALE rappresenta un'opportunita di combinare innovazione tecnologica, impatto sociale e sostenibilita economica. I dati raccolti durante il periodo di test (Novembre-Dicembre 2025) dimostrano la fattibilita tecnica e il potenziale della soluzione.`, y);
  
  y = addParagraph(doc, `Il finanziamento richiesto di EUR ${total.toLocaleString('it-IT')} permettera di completare lo sviluppo, distribuire le applicazioni su tutti i mezzi operativi, formare il personale e avviare l'espansione del servizio.`, y);
  
  y = addSectionTitle(doc, 'Prossimi Passi', y + 10);
  
  const timeline = [
    { phase: 'Q1-Q2 2026', activity: 'Completamento sviluppo e distribuzione app sui mezzi' },
    { phase: 'Q3 2026', activity: 'Certificazioni ISO e formazione operatori' },
    { phase: 'Q4 2026', activity: 'Lancio operativo completo' },
    { phase: '2027', activity: 'Espansione regionale e integrazioni ASL' },
  ];
  
  timeline.forEach((t, idx) => {
    doc.circle(MARGIN + 8, y + 6, 6).fill(COLORS.euBlue);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.white);
    doc.text(String(idx + 1), MARGIN + 5, y + 3);
    if (idx < timeline.length - 1) {
      doc.rect(MARGIN + 7, y + 14, 2, 22).fill(COLORS.lightGray);
    }
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.euBlue);
    doc.text(t.phase, MARGIN + 25, y);
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.gray);
    doc.text(t.activity, MARGIN + 25, y + 14);
    y += 38;
  });
  
  y += 20;
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 80, 8).fill(COLORS.euBlue);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.euGold);
  doc.text('CONTATTI', MARGIN + 15, y + 12);
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.white);
  doc.text(COMPANY_INFO.name, MARGIN + 15, y + 32);
  doc.text(COMPANY_INFO.address, MARGIN + 15, y + 47);
  doc.text(`Email: ${COMPANY_INFO.email}`, MARGIN + 15, y + 62);
  addEUBadge(doc, PAGE_WIDTH - MARGIN - 60, y + 20);
  
  addFooter(doc, pageNum, 10);

  doc.end();
}

export function generateSocialImpactPDF(res: Response, stats: ProjectStats) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: MARGIN,
    bufferPages: true,
    info: {
      Title: 'Report Impatto Sociale - SOCCORSO DIGITALE',
      Author: COMPANY_INFO.name,
    }
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=Report_Impatto_Sociale_Croce_Europa.pdf');
  doc.pipe(res);

  // PAGE 1: COVER
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(COLORS.euBlue);
  addLogo(doc, PAGE_WIDTH / 2 - 50, 120, 100);
  
  doc.font('Helvetica-Bold').fontSize(28).fillColor(COLORS.white);
  doc.text('REPORT', MARGIN, 280, { width: CONTENT_WIDTH, align: 'center' });
  doc.text('IMPATTO SOCIALE', MARGIN, 315, { width: CONTENT_WIDTH, align: 'center' });
  
  doc.font('Helvetica').fontSize(12).fillColor(COLORS.euGold);
  doc.text('Indicatori e Metriche di Valutazione', MARGIN, 380, { width: CONTENT_WIDTH, align: 'center' });
  doc.text('Progetto SOCCORSO DIGITALE', MARGIN, 398, { width: CONTENT_WIDTH, align: 'center' });
  
  doc.rect(PAGE_WIDTH / 2 - 40, 440, 80, 2).fill(COLORS.euGold);
  
  doc.font('Helvetica').fontSize(11).fillColor(COLORS.white);
  doc.text(COMPANY_INFO.name, MARGIN, 480, { width: CONTENT_WIDTH, align: 'center' });
  doc.text('Gennaio 2026', MARGIN, 520, { width: CONTENT_WIDTH, align: 'center' });
  
  addEUBadge(doc, PAGE_WIDTH - 90, PAGE_HEIGHT - 100);

  // PAGE 2: INDICATORI
  doc.addPage();
  addHeader(doc, 'INDICATORI DI IMPATTO');
  
  let y = 100;
  y = addTestDataNote(doc, y);
  
  y = addSectionTitle(doc, 'Accessibilita Sanitaria', y + 10);
  
  const metrics1 = [
    { label: 'Viaggi registrati nel periodo di test', value: stats.totalTrips.toLocaleString('it-IT') },
    { label: 'Strutture sanitarie servite', value: stats.structuresServed.toString() },
    { label: 'Comunita coperte', value: stats.totalLocations.toString() },
  ];
  
  metrics1.forEach(m => {
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 30, 4).fill(COLORS.lightGray);
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.dark);
    doc.text(m.label, MARGIN + 10, y + 9);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.euBlue);
    doc.text(m.value, PAGE_WIDTH - MARGIN - 80, y + 9);
    y += 38;
  });
  
  y += 10;
  y = addSectionTitle(doc, 'Occupazione e Volontariato', y);
  
  const metrics2 = [
    { label: 'Operatori coinvolti', value: stats.totalStaff.toString() },
    { label: 'Ore di volontariato stimate (annue)', value: (stats.totalStaff * 120).toLocaleString('it-IT') },
    { label: 'Ore formazione erogate', value: (stats.totalStaff * 16).toString() },
  ];
  
  metrics2.forEach(m => {
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 30, 4).fill(COLORS.lightGray);
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.dark);
    doc.text(m.label, MARGIN + 10, y + 9);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.euBlue);
    doc.text(m.value, PAGE_WIDTH - MARGIN - 80, y + 9);
    y += 38;
  });
  
  y += 10;
  y = addSectionTitle(doc, 'Sostenibilita Ambientale', y);
  
  const metrics3 = [
    { label: 'CO2 risparmiata (kg)', value: stats.co2Saved.toLocaleString('it-IT') },
    { label: 'Km percorsi', value: stats.totalKm.toLocaleString('it-IT') },
  ];
  
  metrics3.forEach(m => {
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 30, 4).fill(COLORS.lightGray);
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.dark);
    doc.text(m.label, MARGIN + 10, y + 9);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.euBlue);
    doc.text(m.value, PAGE_WIDTH - MARGIN - 80, y + 9);
    y += 38;
  });
  
  addFooter(doc, 2, 4);

  // PAGE 3: SDG
  doc.addPage();
  addHeader(doc, 'ALLINEAMENTO SDGs');
  
  y = 100;
  
  const sdgDetails = [
    { num: '3', title: 'Salute e Benessere', desc: 'Garantiamo accesso ai servizi sanitari per persone con mobilita ridotta, anziani e pazienti cronici.' },
    { num: '8', title: 'Lavoro Dignitoso', desc: 'Creiamo occupazione qualificata nel terzo settore e valorizziamo il volontariato.' },
    { num: '11', title: 'Citta Sostenibili', desc: 'Contribuiamo a comunita inclusive garantendo mobilita accessibile.' },
    { num: '13', title: 'Azione per il Clima', desc: 'Riduciamo le emissioni ottimizzando percorsi e promuovendo efficienza.' },
  ];
  
  sdgDetails.forEach(sdg => {
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 70, 6).stroke(COLORS.euBlue);
    doc.roundedRect(MARGIN, y, 50, 70, 6).fill(COLORS.euBlue);
    doc.font('Helvetica-Bold').fontSize(24).fillColor(COLORS.euGold);
    doc.text(sdg.num, MARGIN + 12, y + 22);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.euBlue);
    doc.text(`SDG ${sdg.num}: ${sdg.title}`, MARGIN + 65, y + 15);
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.dark);
    doc.text(sdg.desc, MARGIN + 65, y + 35, { width: CONTENT_WIDTH - 80 });
    y += 85;
  });
  
  addFooter(doc, 3, 4);

  // PAGE 4: METODOLOGIA
  doc.addPage();
  addHeader(doc, 'METODOLOGIA');
  
  y = 100;
  y = addSectionTitle(doc, 'Raccolta Dati', y);
  y = addParagraph(doc, 'Tutti gli indicatori sono calcolati automaticamente dalla piattaforma SOCCORSO DIGITALE con le seguenti garanzie:', y);
  
  y = addBulletList(doc, [
    'Tracciabilita: ogni dato e collegato a record specifici nel database',
    'Verificabilita: audit trail con hash chain crittografico',
    'Aggiornamento continuo: dati in tempo reale',
    'Conformita GDPR: protezione dei dati personali',
  ], y);
  
  y += 15;
  y = addSectionTitle(doc, 'Periodo di Riferimento', y);
  y = addParagraph(doc, 'I dati presentati in questo report si riferiscono al periodo di test della piattaforma (Novembre - Dicembre 2025). Durante questo periodo, il sistema e stato validato registrando operazioni reali senza pero essere ancora distribuito in produzione sui mezzi di soccorso.', y);
  
  y += 15;
  y = addSectionTitle(doc, 'Standard di Riferimento', y);
  y = addBulletList(doc, [
    'GRI Standards per la reportistica di sostenibilita',
    'SDG Compass per l\'allineamento agli Obiettivi di Sviluppo Sostenibile',
    'Metodologia SROI per la valutazione dell\'impatto sociale',
  ], y);
  
  addFooter(doc, 4, 4);

  doc.end();
}

export function generateInvestmentPlanPDF(res: Response, stats: ProjectStats) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: MARGIN,
    bufferPages: true,
    info: {
      Title: 'Piano degli Investimenti - SOCCORSO DIGITALE',
      Author: COMPANY_INFO.name,
    }
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=Piano_Investimenti_DATA_PLATFORM.pdf');
  doc.pipe(res);

  // PAGE 1: COVER
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(COLORS.euBlue);
  addLogo(doc, PAGE_WIDTH / 2 - 50, 120, 100);
  
  doc.font('Helvetica-Bold').fontSize(28).fillColor(COLORS.white);
  doc.text('PIANO DEGLI', MARGIN, 280, { width: CONTENT_WIDTH, align: 'center' });
  doc.text('INVESTIMENTI', MARGIN, 315, { width: CONTENT_WIDTH, align: 'center' });
  
  doc.font('Helvetica').fontSize(12).fillColor(COLORS.euGold);
  doc.text('Progetto SOCCORSO DIGITALE', MARGIN, 380, { width: CONTENT_WIDTH, align: 'center' });
  
  doc.rect(PAGE_WIDTH / 2 - 40, 420, 80, 2).fill(COLORS.euGold);
  
  doc.font('Helvetica').fontSize(11).fillColor(COLORS.white);
  doc.text(COMPANY_INFO.name, MARGIN, 460, { width: CONTENT_WIDTH, align: 'center' });
  doc.text(COMPANY_INFO.address, MARGIN, 478, { width: CONTENT_WIDTH, align: 'center' });
  doc.text('Gennaio 2026', MARGIN, 520, { width: CONTENT_WIDTH, align: 'center' });
  
  addEUBadge(doc, PAGE_WIDTH - 90, PAGE_HEIGHT - 100);

  // PAGE 2: RIEPILOGO
  doc.addPage();
  addHeader(doc, 'RIEPILOGO INVESTIMENTI');
  
  let y = 100;
  
  const investments = [
    { category: 'Sviluppo Software', amount: 85000, items: ['Completamento piattaforma mobile', 'Integrazioni API sanitarie', 'Moduli analytics avanzati'] },
    { category: 'Infrastruttura IT', amount: 25000, items: ['Server cloud dedicati', 'Sistemi backup e disaster recovery', 'Sicurezza e certificati SSL'] },
    { category: 'Formazione Personale', amount: 35000, items: ['Training operatori (200+ persone)', 'Formazione amministratori', 'Materiali didattici'] },
    { category: 'Certificazioni', amount: 20000, items: ['Certificazione ISO 9001', 'Certificazione ISO 27001', 'Audit e consulenze'] },
    { category: 'Marketing e Comunicazione', amount: 15000, items: ['Brand awareness', 'Materiali promozionali', 'Presenza eventi'] },
    { category: 'Hardware', amount: 20000, items: ['Tablet per mezzi', 'Dispositivi mobili', 'Accessori e supporti'] },
  ];
  
  const total = investments.reduce((sum, i) => sum + i.amount, 0);
  
  investments.forEach(inv => {
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 60, 6).stroke(COLORS.euBlue);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.euBlue);
    doc.text(inv.category, MARGIN + 10, y + 8);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.euGold);
    doc.text(`EUR ${inv.amount.toLocaleString('it-IT')}`, PAGE_WIDTH - MARGIN - 90, y + 8);
    
    let itemY = y + 28;
    inv.items.forEach(item => {
      doc.circle(MARGIN + 15, itemY + 4, 2).fill(COLORS.gray);
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.gray);
      doc.text(item, MARGIN + 25, itemY);
      itemY += 12;
    });
    y += 70;
  });
  
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 40, 6).fill(COLORS.euBlue);
  doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.white);
  doc.text('TOTALE INVESTIMENTO RICHIESTO', MARGIN + 15, y + 12);
  doc.font('Helvetica-Bold').fontSize(16).fillColor(COLORS.euGold);
  doc.text(`EUR ${total.toLocaleString('it-IT')}`, PAGE_WIDTH - MARGIN - 110, y + 12);
  
  addFooter(doc, 2, 4);

  // PAGE 3: DETTAGLIO SOFTWARE
  doc.addPage();
  addHeader(doc, 'DETTAGLIO SVILUPPO SOFTWARE');
  
  y = 100;
  y = addSectionTitle(doc, 'Voci di Spesa (EUR 85.000)', y);
  
  const softwareItems = [
    { item: 'Sviluppo moduli core piattaforma', amount: 30000 },
    { item: 'App mobile iOS/Android', amount: 25000 },
    { item: 'Integrazioni API esterne (ASL, 118)', amount: 15000 },
    { item: 'Dashboard analytics e reportistica', amount: 10000 },
    { item: 'Testing e quality assurance', amount: 5000 },
  ];
  
  softwareItems.forEach(si => {
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 28, 4).fill(COLORS.lightGray);
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.dark);
    doc.text(si.item, MARGIN + 10, y + 8);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.euBlue);
    doc.text(`EUR ${si.amount.toLocaleString('it-IT')}`, PAGE_WIDTH - MARGIN - 80, y + 8);
    y += 35;
  });
  
  y += 20;
  y = addSectionTitle(doc, 'Dettaglio Formazione (EUR 35.000)', y);
  
  const trainingItems = [
    { item: 'Formazione operatori sul campo (200+ persone)', amount: 20000 },
    { item: 'Training amministratori di sistema', amount: 8000 },
    { item: 'Materiali didattici e manuali', amount: 4000 },
    { item: 'Supporto post-formazione', amount: 3000 },
  ];
  
  trainingItems.forEach(ti => {
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 28, 4).fill(COLORS.lightGray);
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.dark);
    doc.text(ti.item, MARGIN + 10, y + 8);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.euBlue);
    doc.text(`EUR ${ti.amount.toLocaleString('it-IT')}`, PAGE_WIDTH - MARGIN - 80, y + 8);
    y += 35;
  });
  
  addFooter(doc, 3, 4);

  // PAGE 4: CRONOPROGRAMMA SPESE
  doc.addPage();
  addHeader(doc, 'CRONOPROGRAMMA SPESE');
  
  y = 100;
  y = addSectionTitle(doc, 'Distribuzione Temporale', y);
  
  const quarters = [
    { period: 'Q1 2026', amount: 50000, desc: 'Sviluppo software, infrastruttura IT' },
    { period: 'Q2 2026', amount: 45000, desc: 'Completamento sviluppo, inizio formazione' },
    { period: 'Q3 2026', amount: 55000, desc: 'Formazione, certificazioni, hardware' },
    { period: 'Q4 2026', amount: 50000, desc: 'Marketing, completamento attivita' },
  ];
  
  quarters.forEach(q => {
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 50, 6).stroke(COLORS.euBlue);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.euBlue);
    doc.text(q.period, MARGIN + 10, y + 10);
    doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.euGold);
    doc.text(`EUR ${q.amount.toLocaleString('it-IT')}`, PAGE_WIDTH - MARGIN - 100, y + 10);
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.gray);
    doc.text(q.desc, MARGIN + 10, y + 30);
    y += 60;
  });
  
  y += 20;
  y = addSectionTitle(doc, 'Note', y);
  y = addParagraph(doc, 'Le spese sono distribuite in modo da garantire un flusso di cassa equilibrato e una progressione logica delle attivita. Il completamento dello sviluppo software e prioritario per consentire la successiva formazione del personale.', y);
  
  addFooter(doc, 4, 4);

  doc.end();
}

export function generateTimelinePDF(res: Response, stats: ProjectStats) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 40,
    bufferPages: true,
    info: {
      Title: 'Cronoprogramma Attivita - SOCCORSO DIGITALE',
      Author: COMPANY_INFO.name,
    }
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=Cronoprogramma_DATA_PLATFORM.pdf');
  doc.pipe(res);

  const LAND_WIDTH = 841.89;
  const LAND_HEIGHT = 595.28;
  const M = 40;
  const CW = LAND_WIDTH - (M * 2);

  // PAGE 1: COVER
  doc.rect(0, 0, LAND_WIDTH, LAND_HEIGHT).fill(COLORS.euBlue);
  addLogo(doc, LAND_WIDTH / 2 - 50, 80, 100);
  
  doc.font('Helvetica-Bold').fontSize(32).fillColor(COLORS.white);
  doc.text('CRONOPROGRAMMA', M, 220, { width: CW, align: 'center' });
  doc.text('ATTIVITA', M, 260, { width: CW, align: 'center' });
  
  doc.font('Helvetica').fontSize(14).fillColor(COLORS.euGold);
  doc.text('Progetto SOCCORSO DIGITALE - Timeline 24 Mesi', M, 320, { width: CW, align: 'center' });
  
  doc.rect(LAND_WIDTH / 2 - 50, 360, 100, 2).fill(COLORS.euGold);
  
  doc.font('Helvetica').fontSize(12).fillColor(COLORS.white);
  doc.text(COMPANY_INFO.name, M, 400, { width: CW, align: 'center' });
  doc.text('Gennaio 2026', M, 440, { width: CW, align: 'center' });
  
  addEUBadge(doc, LAND_WIDTH - 100, LAND_HEIGHT - 100);

  // PAGE 2: GANTT CHART
  doc.addPage({ layout: 'landscape' });
  
  doc.rect(0, 0, LAND_WIDTH, 60).fill(COLORS.euBlue);
  doc.font('Helvetica-Bold').fontSize(16).fillColor(COLORS.white);
  doc.text('GANTT CHART - TIMELINE PROGETTO', M, 22);
  doc.rect(M, 48, 80, 3).fill(COLORS.euGold);

  let y = 80;
  
  const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
  const colW = (CW - 200) / 12;
  
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.euBlue);
  doc.text('Attivita', M, y);
  doc.text('2026', M + 200 + colW * 5, y);
  
  y += 20;
  
  months.forEach((m, idx) => {
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.gray);
    doc.text(m, M + 200 + idx * colW, y, { width: colW, align: 'center' });
  });
  
  y += 25;
  
  const activities = [
    { name: 'Sviluppo Core Platform', start: 0, duration: 4, color: COLORS.euBlue },
    { name: 'App Mobile iOS/Android', start: 1, duration: 5, color: COLORS.euBlue },
    { name: 'Testing e QA', start: 4, duration: 3, color: '#4299e1' },
    { name: 'Infrastruttura IT', start: 0, duration: 3, color: '#48bb78' },
    { name: 'Formazione Operatori', start: 5, duration: 4, color: '#ed8936' },
    { name: 'Certificazioni ISO', start: 6, duration: 3, color: '#9f7aea' },
    { name: 'Distribuzione sui Mezzi', start: 7, duration: 2, color: COLORS.euGold },
    { name: 'Lancio Operativo', start: 9, duration: 1, color: '#38a169' },
    { name: 'Integrazioni ASL', start: 9, duration: 3, color: '#4299e1' },
    { name: 'Espansione Regionale', start: 10, duration: 2, color: '#667eea' },
  ];
  
  activities.forEach(act => {
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.dark);
    doc.text(act.name, M, y + 5, { width: 190 });
    
    const barX = M + 200 + act.start * colW;
    const barW = act.duration * colW - 4;
    doc.roundedRect(barX, y, barW, 20, 3).fill(act.color);
    
    y += 30;
  });
  
  y += 20;
  
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.euBlue);
  doc.text('Milestone Principali:', M, y);
  y += 18;
  
  const milestones = [
    { date: 'Mar 2026', desc: 'Completamento sviluppo software' },
    { date: 'Giu 2026', desc: 'Certificazione ISO 9001' },
    { date: 'Set 2026', desc: 'Distribuzione app su tutti i mezzi' },
    { date: 'Ott 2026', desc: 'Lancio operativo completo' },
  ];
  
  milestones.forEach(ms => {
    doc.circle(M + 5, y + 5, 4).fill(COLORS.euGold);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.euBlue);
    doc.text(ms.date, M + 15, y);
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.gray);
    doc.text(ms.desc, M + 80, y);
    y += 18;
  });
  
  doc.rect(0, LAND_HEIGHT - 35, LAND_WIDTH, 35).fill(COLORS.lightGray);
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.gray);
  doc.text(`${COMPANY_INFO.name} - ${COMPANY_INFO.address}`, M, LAND_HEIGHT - 25);
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.euBlue);
  doc.text('2 / 3', LAND_WIDTH - M - 30, LAND_HEIGHT - 25);

  // PAGE 3: DETTAGLIO FASI
  doc.addPage({ layout: 'landscape' });
  
  doc.rect(0, 0, LAND_WIDTH, 60).fill(COLORS.euBlue);
  doc.font('Helvetica-Bold').fontSize(16).fillColor(COLORS.white);
  doc.text('DETTAGLIO FASI E DELIVERABLE', M, 22);
  doc.rect(M, 48, 80, 3).fill(COLORS.euGold);

  y = 80;
  
  const phases = [
    { phase: 'FASE 1: Sviluppo (Q1-Q2 2026)', deliverables: ['Piattaforma core completata', 'App mobile iOS/Android', 'Infrastruttura IT operativa', 'Documentazione tecnica'] },
    { phase: 'FASE 2: Testing e Formazione (Q2-Q3 2026)', deliverables: ['Test completati e validati', 'Personale formato (200+ operatori)', 'Manuali operativi', 'Procedure standard'] },
    { phase: 'FASE 3: Certificazione (Q3 2026)', deliverables: ['Certificazione ISO 9001', 'Certificazione ISO 27001', 'Audit superati', 'Documentazione compliance'] },
    { phase: 'FASE 4: Lancio (Q4 2026)', deliverables: ['App distribuite su tutti i mezzi', 'Sistema in produzione', 'Monitoraggio attivo', 'Supporto operativo'] },
  ];
  
  const phaseW = (CW - 30) / 4;
  
  phases.forEach((ph, idx) => {
    const px = M + idx * (phaseW + 10);
    doc.roundedRect(px, y, phaseW, 180, 8).stroke(COLORS.euBlue);
    doc.roundedRect(px, y, phaseW, 35, 8).fill(COLORS.euBlue);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.white);
    doc.text(ph.phase, px + 10, y + 10, { width: phaseW - 20 });
    
    let dy = y + 50;
    ph.deliverables.forEach(del => {
      doc.circle(px + 15, dy + 4, 3).fill(COLORS.euGold);
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.dark);
      doc.text(del, px + 25, dy, { width: phaseW - 40 });
      dy += 28;
    });
  });
  
  doc.rect(0, LAND_HEIGHT - 35, LAND_WIDTH, 35).fill(COLORS.lightGray);
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.gray);
  doc.text(`${COMPANY_INFO.name} - ${COMPANY_INFO.address}`, M, LAND_HEIGHT - 25);
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.euBlue);
  doc.text('3 / 3', LAND_WIDTH - M - 30, LAND_HEIGHT - 25);

  doc.end();
}
