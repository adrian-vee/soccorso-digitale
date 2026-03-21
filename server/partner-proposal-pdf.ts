import PDFDocument from 'pdfkit';
import { Response } from 'express';
import path from 'path';
import fs from 'fs';

const COLORS = {
  primary: '#1a8cba',
  primaryDark: '#0d5f7d',
  accent: '#14b8a6',
  dark: '#1e293b',
  gray: '#64748b',
  lightGray: '#f1f5f9',
  white: '#ffffff',
  success: '#10b981',
  gold: '#f59e0b',
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

interface PartnerStats {
  operators: number;
  beneficiaries: number;
  partners: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result 
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0];
}

function drawGradientRect(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, color1: string, color2: string) {
  const steps = 50;
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  for (let i = 0; i < steps; i++) {
    const ratio = i / steps;
    const r = Math.round(rgb1[0] + (rgb2[0] - rgb1[0]) * ratio);
    const g = Math.round(rgb1[1] + (rgb2[1] - rgb1[1]) * ratio);
    const b = Math.round(rgb1[2] + (rgb2[2] - rgb1[2]) * ratio);
    doc.rect(x, y + (h / steps) * i, w, h / steps + 1).fill(`rgb(${r},${g},${b})`);
  }
}

function addPageNumber(doc: PDFKit.PDFDocument, pageNum: number, totalPages: number) {
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.gray);
  doc.text(`${pageNum} / ${totalPages}`, PAGE_WIDTH - MARGIN - 30, PAGE_HEIGHT - 30, { width: 30, align: 'right' });
}

function addFooter(doc: PDFKit.PDFDocument) {
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.gray);
  doc.text('SOCCORSO DIGITALE', MARGIN, PAGE_HEIGHT - 30, { width: CONTENT_WIDTH - 50 });
}

export function generatePartnerProposalPDF(res: Response, stats: PartnerStats) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: MARGIN,
    info: {
      Title: 'Programma Convenzioni Partner 2026 - SOCCORSO DIGITALE',
      Author: 'SOCCORSO DIGITALE',
      Subject: 'Proposta di Partnership',
      Keywords: 'partner, convenzioni, soccorso sanitario'
    }
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=Croce_Europa_Partner_Proposal_2026.pdf');
  doc.pipe(res);

  const totalPages = 14;
  let currentPage = 1;

  // ========== PAGE 1: COVER ==========
  drawGradientRect(doc, 0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLORS.primary, COLORS.primaryDark);
  
  // Decorative elements
  doc.circle(PAGE_WIDTH + 100, -100, 300).fill('rgba(255,255,255,0.05)');
  doc.circle(-150, PAGE_HEIGHT + 50, 400).fill('rgba(20,184,166,0.1)');
  
  // Logo area
  const logoPath = path.join(process.cwd(), 'attached_assets', 'Logo-Croce-Europa-Ufficiale_1766252701803.png');
  try {
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, PAGE_WIDTH / 2 - 60, 180, { width: 120 });
    }
  } catch (e) {
    doc.circle(PAGE_WIDTH / 2, 220, 50).fill(COLORS.white);
    doc.font('Helvetica-Bold').fontSize(24).fillColor(COLORS.primary);
    doc.text('CE', PAGE_WIDTH / 2 - 20, 205, { width: 40, align: 'center' });
  }
  
  // Badge
  const badgeText = 'PROGRAMMA CONVENZIONI PARTNER 2026';
  doc.roundedRect(PAGE_WIDTH / 2 - 140, 320, 280, 32, 16).fill('rgba(255,255,255,0.15)');
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.white);
  doc.text(badgeText, PAGE_WIDTH / 2 - 140, 329, { width: 280, align: 'center' });
  
  // Main title
  doc.font('Helvetica-Bold').fontSize(38).fillColor(COLORS.white);
  doc.text('SOCCORSO DIGITALE', MARGIN, 380, { width: CONTENT_WIDTH, align: 'center' });
  
  // Subtitle
  doc.font('Helvetica').fontSize(16).fillColor('rgba(255,255,255,0.9)');
  doc.text('Sconti, visibilita e valore reale', MARGIN, 440, { width: CONTENT_WIDTH, align: 'center' });
  doc.text('per chi opera nel soccorso sanitario', MARGIN, 460, { width: CONTENT_WIDTH, align: 'center' });
  
  // Separator line
  doc.rect(PAGE_WIDTH / 2 - 40, 510, 80, 2).fill(COLORS.accent);
  
  // Bottom tagline
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.white);
  doc.text('Zero costi. Zero vincoli. Collaborazioni selezionate.', MARGIN, 540, { width: CONTENT_WIDTH, align: 'center' });
  
  // Year badge at bottom
  doc.roundedRect(PAGE_WIDTH / 2 - 40, PAGE_HEIGHT - 120, 80, 36, 8).fill(COLORS.accent);
  doc.font('Helvetica-Bold').fontSize(18).fillColor(COLORS.white);
  doc.text('2026', PAGE_WIDTH / 2 - 40, PAGE_HEIGHT - 110, { width: 80, align: 'center' });
  
  addPageNumber(doc, currentPage++, totalPages);

  // ========== PAGE 2: WHY THIS PROGRAM EXISTS ==========
  doc.addPage();
  
  // Header bar
  doc.rect(0, 0, PAGE_WIDTH, 100).fill(COLORS.primary);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('rgba(255,255,255,0.7)');
  doc.text('PROGRAMMA CONVENZIONI PARTNER', MARGIN, 35, { width: CONTENT_WIDTH });
  doc.font('Helvetica-Bold').fontSize(24).fillColor(COLORS.white);
  doc.text('Perche questo programma esiste', MARGIN, 55, { width: CONTENT_WIDTH });
  
  let y = 130;
  
  // Highlight box
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 80, 8).fill(COLORS.lightGray);
  doc.rect(MARGIN, y, 5, 80).fill(COLORS.accent);
  doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.dark);
  doc.text('Perche stiamo creando qualcosa che non esiste ancora', MARGIN + 20, y + 15, { width: CONTENT_WIDTH - 40 });
  doc.font('Helvetica').fontSize(11).fillColor(COLORS.gray);
  doc.text('Il primo Programma Convenzioni strutturato dedicato esclusivamente al personale del soccorso sanitario.', MARGIN + 20, y + 40, { width: CONTENT_WIDTH - 40 });
  
  y += 110;
  
  doc.font('Helvetica').fontSize(11).fillColor(COLORS.dark).lineGap(6);
  doc.text('SOCCORSO DIGITALE opera ogni giorno nel trasporto sanitario e nell\'emergenza. I nostri operatori lavorano sul territorio, seguono corsi di formazione, utilizzano strumenti digitali interni e fanno parte di una comunita reale, attiva e verificata.', MARGIN, y, { width: CONTENT_WIDTH });
  
  y += 70;
  
  doc.text('Nel 2026 abbiamo deciso di fare un passo avanti.', MARGIN, y, { width: CONTENT_WIDTH });
  
  y += 30;
  
  doc.text('Abbiamo creato il primo Programma Convenzioni strutturato dedicato esclusivamente al personale del soccorso sanitario, con un obiettivo chiaro:', MARGIN, y, { width: CONTENT_WIDTH });
  
  y += 50;
  
  // Mission statement
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 60, 8).fill(COLORS.primary);
  doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.white);
  doc.text('Creare valore concreto per le aziende partner', MARGIN, y + 12, { width: CONTENT_WIDTH, align: 'center' });
  doc.text('e vantaggi reali per chi si prende cura della comunita.', MARGIN, y + 32, { width: CONTENT_WIDTH, align: 'center' });
  
  y += 90;
  
  // Bottom taglines
  doc.font('Helvetica').fontSize(12).fillColor(COLORS.gray);
  doc.text('Non un portale sconti.', MARGIN, y, { width: CONTENT_WIDTH });
  doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.primary);
  doc.text('Un ecosistema.', MARGIN, y + 20, { width: CONTENT_WIDTH });
  
  addFooter(doc);
  addPageNumber(doc, currentPage++, totalPages);

  // ========== PAGE 3: WHO IS CROCE EUROPA ==========
  doc.addPage();
  
  doc.rect(0, 0, PAGE_WIDTH, 100).fill(COLORS.primaryDark);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('rgba(255,255,255,0.7)');
  doc.text('CHI SIAMO', MARGIN, 35, { width: CONTENT_WIDTH });
  doc.font('Helvetica-Bold').fontSize(24).fillColor(COLORS.white);
  doc.text('Una realta operativa. Non teorica.', MARGIN, 55, { width: CONTENT_WIDTH });
  
  y = 130;
  
  doc.font('Helvetica').fontSize(12).fillColor(COLORS.dark).lineGap(6);
  doc.text('SOCCORSO DIGITALE e una realta privata che opera nel settore del soccorso e del trasporto sanitario.', MARGIN, y, { width: CONTENT_WIDTH });
  
  y += 50;
  
  // Feature cards
  const features = [
    { icon: 'M', title: 'Presenza stabile nel Triveneto', desc: 'Operativi nelle province di Verona e Vicenza' },
    { icon: 'A', title: 'Servizi di emergenza e trasporto', desc: 'Ambulanze attive 24/7 sul territorio' },
    { icon: 'P', title: 'Personale formato e certificato', desc: 'Operatori verificati e costantemente aggiornati' },
    { icon: 'D', title: 'Infrastruttura digitale', desc: 'App, badge digitali, certificazioni proprietarie' },
  ];
  
  features.forEach((feat, i) => {
    const cardY = y + (i * 70);
    doc.roundedRect(MARGIN, cardY, CONTENT_WIDTH, 60, 6).fill(i % 2 === 0 ? COLORS.lightGray : COLORS.white);
    
    // Icon circle
    doc.circle(MARGIN + 30, cardY + 30, 18).fill(COLORS.primary);
    doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.white);
    doc.text(feat.icon, MARGIN + 22, cardY + 23, { width: 16, align: 'center' });
    
    doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.dark);
    doc.text(feat.title, MARGIN + 60, cardY + 15, { width: CONTENT_WIDTH - 80 });
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.gray);
    doc.text(feat.desc, MARGIN + 60, cardY + 32, { width: CONTENT_WIDTH - 80 });
  });
  
  y += 310;
  
  // Trust message
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 50, 6).fill(COLORS.accent);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.white);
  doc.text('Ogni giorno i nostri operatori si affidano ai sistemi SOCCORSO DIGITALE', MARGIN, y + 10, { width: CONTENT_WIDTH, align: 'center' });
  doc.text('per lavorare, formarsi e comunicare.', MARGIN, y + 26, { width: CONTENT_WIDTH, align: 'center' });
  
  y += 70;
  
  doc.font('Helvetica').fontSize(11).fillColor(COLORS.gray);
  doc.text('Questo genera fiducia. E la fiducia genera valore per i partner.', MARGIN, y, { width: CONTENT_WIDTH });
  
  addFooter(doc);
  addPageNumber(doc, currentPage++, totalPages);

  // ========== PAGE 4: THE COMMUNITY ==========
  doc.addPage();
  
  doc.rect(0, 0, PAGE_WIDTH, 100).fill(COLORS.accent);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('rgba(255,255,255,0.7)');
  doc.text('LA COMMUNITY', MARGIN, 35, { width: CONTENT_WIDTH });
  doc.font('Helvetica-Bold').fontSize(24).fillColor(COLORS.white);
  doc.text('Una community reale, non numeri vuoti', MARGIN, 55, { width: CONTENT_WIDTH });
  
  y = 130;
  
  // Stats grid
  const statsData = [
    { value: `${stats.operators}+`, label: 'Operatori sanitari attivi', color: COLORS.primary },
    { value: `${stats.beneficiaries}+`, label: 'Beneficiari potenziali', color: COLORS.accent },
    { value: `${stats.partners}`, label: 'Partner gia attivi', color: COLORS.gold },
    { value: '2026', label: 'Crescita costante', color: COLORS.primaryDark },
  ];
  
  const statWidth = (CONTENT_WIDTH - 20) / 2;
  statsData.forEach((stat, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const sx = MARGIN + (col * (statWidth + 20));
    const sy = y + (row * 90);
    
    doc.roundedRect(sx, sy, statWidth, 80, 8).fill(COLORS.white);
    doc.roundedRect(sx, sy, statWidth, 80, 8).lineWidth(2).stroke(stat.color);
    
    doc.font('Helvetica-Bold').fontSize(32).fillColor(stat.color);
    doc.text(stat.value, sx, sy + 15, { width: statWidth, align: 'center' });
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.gray);
    doc.text(stat.label, sx, sy + 55, { width: statWidth, align: 'center' });
  });
  
  y += 200;
  
  // What our operators do
  doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.dark);
  doc.text('I nostri operatori:', MARGIN, y, { width: CONTENT_WIDTH });
  
  y += 25;
  
  const operatorTraits = [
    'Lavorano a turni sul territorio',
    'Vivono e conoscono la zona',
    'Preferiscono partner convenzionati',
    'Tornano nel tempo',
  ];
  
  operatorTraits.forEach((trait, i) => {
    doc.roundedRect(MARGIN, y + (i * 35), CONTENT_WIDTH, 30, 4).fill(i % 2 === 0 ? COLORS.lightGray : COLORS.white);
    doc.circle(MARGIN + 18, y + (i * 35) + 15, 8).fill(COLORS.success);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.white);
    doc.text('✓', MARGIN + 14, y + (i * 35) + 10, { width: 8 });
    doc.font('Helvetica').fontSize(11).fillColor(COLORS.dark);
    doc.text(trait, MARGIN + 40, y + (i * 35) + 10, { width: CONTENT_WIDTH - 60 });
  });
  
  y += 170;
  
  // Bottom message
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 45, 6).fill(COLORS.primaryDark);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.white);
  doc.text('Non cercano "l\'offerta del giorno". Cercano affidabilita.', MARGIN, y + 15, { width: CONTENT_WIDTH, align: 'center' });
  
  addFooter(doc);
  addPageNumber(doc, currentPage++, totalPages);

  // ========== PAGE 5: WHAT IT MEANS TO BE A PARTNER ==========
  doc.addPage();
  
  doc.rect(0, 0, PAGE_WIDTH, 100).fill(COLORS.primary);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('rgba(255,255,255,0.7)');
  doc.text('VANTAGGI PARTNER', MARGIN, 35, { width: CONTENT_WIDTH });
  doc.font('Helvetica-Bold').fontSize(24).fillColor(COLORS.white);
  doc.text('Cosa significa essere Partner', MARGIN, 55, { width: CONTENT_WIDTH });
  
  y = 130;
  
  doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.dark);
  doc.text('Diventare Partner SOCCORSO DIGITALE significa:', MARGIN, y, { width: CONTENT_WIDTH });
  
  y += 40;
  
  const benefits = [
    { title: 'Visibilita continuativa', desc: 'La tua attivita e presente nella nostra app interna e nelle comunicazioni dedicate al personale.', color: COLORS.primary },
    { title: 'Clientela fidelizzata', desc: 'Gli operatori scelgono e privilegiano i partner convenzionati nel tempo.', color: COLORS.accent },
    { title: 'Posizionamento istituzionale', desc: 'Il tuo brand e associato a una realta operativa del soccorso sanitario.', color: COLORS.gold },
    { title: 'Valore reputazionale', desc: 'Non solo sconto, ma supporto concreto a chi lavora ogni giorno per la comunita.', color: COLORS.success },
  ];
  
  benefits.forEach((benefit, i) => {
    const cardY = y + (i * 100);
    
    doc.roundedRect(MARGIN, cardY, CONTENT_WIDTH, 90, 8).fill(COLORS.white);
    doc.roundedRect(MARGIN, cardY, CONTENT_WIDTH, 90, 8).lineWidth(1).stroke(COLORS.lightGray);
    doc.rect(MARGIN, cardY, 6, 90).fill(benefit.color);
    
    // Checkmark
    doc.roundedRect(MARGIN + 20, cardY + 20, 32, 32, 6).fill(benefit.color);
    doc.font('Helvetica-Bold').fontSize(18).fillColor(COLORS.white);
    doc.text('✓', MARGIN + 28, cardY + 26, { width: 16 });
    
    doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.dark);
    doc.text(benefit.title, MARGIN + 70, cardY + 20, { width: CONTENT_WIDTH - 100 });
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.gray).lineGap(3);
    doc.text(benefit.desc, MARGIN + 70, cardY + 42, { width: CONTENT_WIDTH - 100 });
  });
  
  addFooter(doc);
  addPageNumber(doc, currentPage++, totalPages);

  // ========== PAGE 6: WHERE YOUR BRAND APPEARS ==========
  doc.addPage();
  
  doc.rect(0, 0, PAGE_WIDTH, 100).fill(COLORS.primaryDark);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('rgba(255,255,255,0.7)');
  doc.text('VISIBILITA', MARGIN, 35, { width: CONTENT_WIDTH });
  doc.font('Helvetica-Bold').fontSize(24).fillColor(COLORS.white);
  doc.text('Dove appare il tuo brand', MARGIN, 55, { width: CONTENT_WIDTH });
  
  y = 130;
  
  doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.primary);
  doc.text('Canali proprietari SOCCORSO DIGITALE', MARGIN, y, { width: CONTENT_WIDTH });
  
  y += 30;
  
  doc.font('Helvetica').fontSize(11).fillColor(COLORS.gray);
  doc.text('Il Programma Convenzioni utilizza solo canali diretti e verificati:', MARGIN, y, { width: CONTENT_WIDTH });
  
  y += 40;
  
  const channels = [
    { icon: '📱', title: 'App interna SOCCORSO DIGITALE', desc: 'Visibilita quotidiana agli operatori' },
    { icon: '📍', title: 'Sezione partner geolocalizzata', desc: 'Trova il partner piu vicino' },
    { icon: '📧', title: 'Comunicazioni ufficiali al personale', desc: 'Newsletter e aggiornamenti' },
    { icon: '📄', title: 'Materiali informativi del programma', desc: 'Brochure e documentazione' },
  ];
  
  channels.forEach((channel, i) => {
    const cardY = y + (i * 75);
    
    doc.roundedRect(MARGIN, cardY, CONTENT_WIDTH, 65, 6).fill(i % 2 === 0 ? COLORS.lightGray : COLORS.white);
    
    doc.roundedRect(MARGIN + 15, cardY + 15, 40, 40, 8).fill(COLORS.primary);
    doc.font('Helvetica').fontSize(20).fillColor(COLORS.white);
    doc.text(channel.icon, MARGIN + 23, cardY + 23, { width: 24 });
    
    doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.dark);
    doc.text(channel.title, MARGIN + 70, cardY + 18, { width: CONTENT_WIDTH - 100 });
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.gray);
    doc.text(channel.desc, MARGIN + 70, cardY + 36, { width: CONTENT_WIDTH - 100 });
  });
  
  y += 330;
  
  // Bottom message
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 50, 6).fill(COLORS.accent);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.white);
  doc.text('Niente pubblicita dispersiva. Solo visibilita mirata.', MARGIN, y + 17, { width: CONTENT_WIDTH, align: 'center' });
  
  addFooter(doc);
  addPageNumber(doc, currentPage++, totalPages);

  // ========== PAGE 7: CERTIFICATIONS ==========
  doc.addPage();
  
  drawGradientRect(doc, 0, 0, PAGE_WIDTH, 130, COLORS.primaryDark, '#064e6e');
  doc.font('Helvetica-Bold').fontSize(11).fillColor('rgba(255,255,255,0.7)');
  doc.text('PLUS DISTINTIVO', MARGIN, 35, { width: CONTENT_WIDTH });
  doc.font('Helvetica-Bold').fontSize(24).fillColor(COLORS.white);
  doc.text('Il tuo brand sui nostri certificati', MARGIN, 55, { width: CONTENT_WIDTH });
  doc.font('Helvetica').fontSize(12).fillColor('rgba(255,255,255,0.8)');
  doc.text('Un\'opportunita unica nel settore', MARGIN, 90, { width: CONTENT_WIDTH });
  
  y = 160;
  
  doc.font('Helvetica').fontSize(11).fillColor(COLORS.dark).lineGap(5);
  doc.text('SOCCORSO DIGITALE rilascia certificazioni e materiali formativi utilizzati e conservati nel tempo dal personale.', MARGIN, y, { width: CONTENT_WIDTH });
  
  y += 50;
  
  doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.primary);
  doc.text('Per alcuni partner selezionati e possibile:', MARGIN, y, { width: CONTENT_WIDTH });
  
  y += 35;
  
  const certBenefits = [
    'Presenza del logo su certificazioni di corsi',
    'Inserimento nei materiali PDF formativi',
    'Citazione istituzionale come partner del programma',
  ];
  
  certBenefits.forEach((benefit, i) => {
    const itemY = y + (i * 50);
    
    doc.roundedRect(MARGIN, itemY, CONTENT_WIDTH, 42, 6).fill(COLORS.lightGray);
    doc.circle(MARGIN + 25, itemY + 21, 14).fill(COLORS.accent);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.white);
    doc.text('✓', MARGIN + 20, itemY + 14, { width: 10 });
    
    doc.font('Helvetica').fontSize(11).fillColor(COLORS.dark);
    doc.text(benefit, MARGIN + 55, itemY + 14, { width: CONTENT_WIDTH - 80 });
  });
  
  y += 180;
  
  // Quote box
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 70, 8).fill(COLORS.primary);
  doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.white);
  doc.text('"Un\'esposizione che resta nel tempo,', MARGIN, y + 18, { width: CONTENT_WIDTH, align: 'center' });
  doc.text('non scompare dopo uno scroll."', MARGIN, y + 38, { width: CONTENT_WIDTH, align: 'center' });
  
  addFooter(doc);
  addPageNumber(doc, currentPage++, totalPages);

  // ========== PAGE 8: OPERATIONAL SIMPLICITY ==========
  doc.addPage();
  
  doc.rect(0, 0, PAGE_WIDTH, 100).fill(COLORS.accent);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('rgba(255,255,255,0.7)');
  doc.text('SEMPLICITA OPERATIVA', MARGIN, 35, { width: CONTENT_WIDTH });
  doc.font('Helvetica-Bold').fontSize(24).fillColor(COLORS.white);
  doc.text('Zero burocrazia. Zero complicazioni.', MARGIN, 55, { width: CONTENT_WIDTH });
  
  y = 130;
  
  // QR Card visual
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 180, 12).fill(COLORS.white);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 180, 12).lineWidth(2).stroke(COLORS.primary);
  
  // QR icon placeholder
  doc.roundedRect(MARGIN + 30, y + 30, 100, 100, 8).fill(COLORS.lightGray);
  doc.roundedRect(MARGIN + 45, y + 45, 70, 70, 4).fill(COLORS.primary);
  doc.font('Helvetica-Bold').fontSize(30).fillColor(COLORS.white);
  doc.text('QR', MARGIN + 58, y + 68, { width: 50 });
  
  doc.font('Helvetica-Bold').fontSize(16).fillColor(COLORS.dark);
  doc.text('Tessera Digitale SOCCORSO DIGITALE', MARGIN + 150, y + 35, { width: CONTENT_WIDTH - 180 });
  
  const qrFeatures = [
    'QR code verificabile in tempo reale',
    'Utilizzabile da qualsiasi smartphone',
    'Nessuna tessera fisica necessaria',
    'Compatibile con Apple e Google Wallet',
  ];
  
  qrFeatures.forEach((feat, i) => {
    doc.circle(MARGIN + 160, y + 75 + (i * 22), 5).fill(COLORS.success);
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.gray);
    doc.text(feat, MARGIN + 175, y + 70 + (i * 22), { width: CONTENT_WIDTH - 200 });
  });
  
  y += 210;
  
  // Bottom message
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 50, 6).fill(COLORS.primaryDark);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.white);
  doc.text('Verifica immediata per il partner. Massima semplicita per tutti.', MARGIN, y + 17, { width: CONTENT_WIDTH, align: 'center' });
  
  addFooter(doc);
  addPageNumber(doc, currentPage++, totalPages);

  // ========== PAGE 9: COSTS ==========
  doc.addPage();
  
  doc.rect(0, 0, PAGE_WIDTH, 100).fill(COLORS.success);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('rgba(255,255,255,0.7)');
  doc.text('COSTI DI ADESIONE', MARGIN, 35, { width: CONTENT_WIDTH });
  doc.font('Helvetica-Bold').fontSize(28).fillColor(COLORS.white);
  doc.text('Zero. Davvero.', MARGIN, 55, { width: CONTENT_WIDTH });
  
  y = 150;
  
  // Main cost card
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 250, 16).fill(COLORS.white);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 250, 16).lineWidth(3).stroke(COLORS.success);
  
  // Big zero
  doc.font('Helvetica-Bold').fontSize(80).fillColor(COLORS.success);
  doc.text('0', MARGIN, y + 30, { width: CONTENT_WIDTH, align: 'center' });
  
  doc.font('Helvetica-Bold').fontSize(16).fillColor(COLORS.dark);
  doc.text('Costi, commissioni, vincoli', MARGIN, y + 120, { width: CONTENT_WIDTH, align: 'center' });
  
  // Benefits list
  const costBenefits = [
    'Nessun costo di iscrizione',
    'Nessuna commissione',
    'Nessun vincolo contrattuale',
  ];
  
  costBenefits.forEach((benefit, i) => {
    doc.circle(MARGIN + 120, y + 160 + (i * 25), 8).fill(COLORS.success);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.white);
    doc.text('✓', MARGIN + 116, y + 155 + (i * 25), { width: 8 });
    doc.font('Helvetica').fontSize(11).fillColor(COLORS.dark);
    doc.text(benefit, MARGIN + 140, y + 155 + (i * 25), { width: CONTENT_WIDTH - 160 });
  });
  
  y += 280;
  
  // Bottom message
  doc.font('Helvetica').fontSize(12).fillColor(COLORS.gray);
  doc.text('Offri solo il vantaggio che scegli tu, in modo sostenibile per la tua attivita.', MARGIN, y, { width: CONTENT_WIDTH, align: 'center' });
  
  addFooter(doc);
  addPageNumber(doc, currentPage++, totalPages);

  // ========== PAGE 10: TYPE OF BENEFITS ==========
  doc.addPage();
  
  doc.rect(0, 0, PAGE_WIDTH, 100).fill(COLORS.gold);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('rgba(255,255,255,0.7)');
  doc.text('TIPOLOGIE DI VANTAGGI', MARGIN, 35, { width: CONTENT_WIDTH });
  doc.font('Helvetica-Bold').fontSize(24).fillColor(COLORS.white);
  doc.text('Liberta totale per il partner', MARGIN, 55, { width: CONTENT_WIDTH });
  
  y = 130;
  
  doc.font('Helvetica').fontSize(12).fillColor(COLORS.dark);
  doc.text('Non imponiamo standard obbligatori. Ogni partnership e costruita su misura.', MARGIN, y, { width: CONTENT_WIDTH });
  
  y += 50;
  
  doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.dark);
  doc.text('I partner solitamente offrono:', MARGIN, y, { width: CONTENT_WIDTH });
  
  y += 35;
  
  const benefitTypes = [
    { title: 'Sconto percentuale', desc: 'Consigliato minimo 10%', recommended: true },
    { title: 'Promozioni dedicate', desc: 'Offerte esclusive per gli operatori', recommended: false },
    { title: 'Omaggi o servizi esclusivi', desc: 'Valore aggiunto tangibile', recommended: false },
    { title: 'Vantaggi temporanei', desc: 'Promozioni stagionali o occasionali', recommended: false },
  ];
  
  benefitTypes.forEach((benefit, i) => {
    const cardY = y + (i * 70);
    
    doc.roundedRect(MARGIN, cardY, CONTENT_WIDTH, 60, 6).fill(benefit.recommended ? COLORS.primary : COLORS.lightGray);
    
    doc.font('Helvetica-Bold').fontSize(13).fillColor(benefit.recommended ? COLORS.white : COLORS.dark);
    doc.text(benefit.title, MARGIN + 20, cardY + 15, { width: CONTENT_WIDTH - 40 });
    doc.font('Helvetica').fontSize(10).fillColor(benefit.recommended ? 'rgba(255,255,255,0.8)' : COLORS.gray);
    doc.text(benefit.desc, MARGIN + 20, cardY + 35, { width: CONTENT_WIDTH - 40 });
    
    if (benefit.recommended) {
      doc.roundedRect(CONTENT_WIDTH - 60, cardY + 18, 80, 24, 12).fill(COLORS.gold);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.white);
      doc.text('CONSIGLIATO', CONTENT_WIDTH - 55, cardY + 24, { width: 70, align: 'center' });
    }
  });
  
  addFooter(doc);
  addPageNumber(doc, currentPage++, totalPages);

  // ========== PAGE 11: TERRITORY ==========
  doc.addPage();
  
  doc.rect(0, 0, PAGE_WIDTH, 100).fill(COLORS.primary);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('rgba(255,255,255,0.7)');
  doc.text('COPERTURA TERRITORIALE', MARGIN, 35, { width: CONTENT_WIDTH });
  doc.font('Helvetica-Bold').fontSize(24).fillColor(COLORS.white);
  doc.text('Presenza locale reale', MARGIN, 55, { width: CONTENT_WIDTH });
  
  y = 130;
  
  doc.font('Helvetica').fontSize(12).fillColor(COLORS.dark);
  doc.text('SOCCORSO DIGITALE opera stabilmente nelle province di:', MARGIN, y, { width: CONTENT_WIDTH });
  
  y += 40;
  
  // Province badges - ONLY Verona and Vicenza
  const provinces = ['Verona', 'Vicenza'];
  const badgeWidth = 180;
  const badgeGap = 30;
  const totalBadgesWidth = (badgeWidth * 2) + badgeGap;
  const startX = (PAGE_WIDTH - totalBadgesWidth) / 2;
  
  provinces.forEach((province, i) => {
    const bx = startX + (i * (badgeWidth + badgeGap));
    doc.roundedRect(bx, y, badgeWidth, 60, 10).fill(COLORS.primary);
    doc.font('Helvetica-Bold').fontSize(20).fillColor(COLORS.white);
    doc.text(province, bx, y + 18, { width: badgeWidth, align: 'center' });
  });
  
  y += 100;
  
  // Map placeholder
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 200, 8).fill(COLORS.lightGray);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 200, 8).lineWidth(1).stroke(COLORS.gray);
  
  // Simple map representation
  doc.font('Helvetica').fontSize(12).fillColor(COLORS.gray);
  doc.text('Area operativa: Province di Verona e Vicenza', MARGIN, y + 85, { width: CONTENT_WIDTH, align: 'center' });
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.gray);
  doc.text('I partner sono visibili geograficamente nella piattaforma', MARGIN, y + 105, { width: CONTENT_WIDTH, align: 'center' });
  
  // Location pins visual
  doc.circle(MARGIN + 150, y + 70, 8).fill(COLORS.primary);
  doc.circle(MARGIN + 350, y + 90, 8).fill(COLORS.accent);
  
  addFooter(doc);
  addPageNumber(doc, currentPage++, totalPages);

  // ========== PAGE 12: HOW IT WORKS ==========
  doc.addPage();
  
  doc.rect(0, 0, PAGE_WIDTH, 100).fill(COLORS.accent);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('rgba(255,255,255,0.7)');
  doc.text('PROCESSO', MARGIN, 35, { width: CONTENT_WIDTH });
  doc.font('Helvetica-Bold').fontSize(24).fillColor(COLORS.white);
  doc.text('Come funziona', MARGIN, 55, { width: CONTENT_WIDTH });
  
  y = 130;
  
  doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.dark);
  doc.text('Tre passaggi. Attivazione rapida.', MARGIN, y, { width: CONTENT_WIDTH });
  
  y += 50;
  
  const steps = [
    { num: '1', title: 'Contatto conoscitivo', desc: 'Senza impegno, per valutare la collaborazione.' },
    { num: '2', title: 'Definizione del vantaggio', desc: 'Scegli liberamente cosa offrire.' },
    { num: '3', title: 'Attivazione della partnership', desc: 'Pubblicazione e comunicazione al personale.' },
  ];
  
  steps.forEach((step, i) => {
    const stepY = y + (i * 110);
    
    // Step card
    doc.roundedRect(MARGIN, stepY, CONTENT_WIDTH, 95, 8).fill(COLORS.white);
    doc.roundedRect(MARGIN, stepY, CONTENT_WIDTH, 95, 8).lineWidth(1).stroke(COLORS.lightGray);
    
    // Number circle
    doc.circle(MARGIN + 45, stepY + 47, 28).fill(COLORS.primary);
    doc.font('Helvetica-Bold').fontSize(24).fillColor(COLORS.white);
    doc.text(step.num, MARGIN + 33, stepY + 35, { width: 24, align: 'center' });
    
    doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.dark);
    doc.text(step.title, MARGIN + 90, stepY + 30, { width: CONTENT_WIDTH - 120 });
    doc.font('Helvetica').fontSize(11).fillColor(COLORS.gray);
    doc.text(step.desc, MARGIN + 90, stepY + 52, { width: CONTENT_WIDTH - 120 });
    
    // Arrow between steps
    if (i < steps.length - 1) {
      doc.polygon([PAGE_WIDTH / 2 - 10, stepY + 100], [PAGE_WIDTH / 2 + 10, stepY + 100], [PAGE_WIDTH / 2, stepY + 115]).fill(COLORS.primary);
    }
  });
  
  y += 350;
  
  // Timing note
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 40, 6).fill(COLORS.lightGray);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.primary);
  doc.text('Tempi rapidi. Processo semplice. Attivazione media: 48 ore.', MARGIN, y + 13, { width: CONTENT_WIDTH, align: 'center' });
  
  addFooter(doc);
  addPageNumber(doc, currentPage++, totalPages);

  // ========== PAGE 13: PARTNER SELECTION ==========
  doc.addPage();
  
  doc.rect(0, 0, PAGE_WIDTH, 100).fill(COLORS.primaryDark);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('rgba(255,255,255,0.7)');
  doc.text('SELEZIONE PARTNER', MARGIN, 35, { width: CONTENT_WIDTH });
  doc.font('Helvetica-Bold').fontSize(24).fillColor(COLORS.white);
  doc.text('Un programma aperto, ma non indiscriminato', MARGIN, 55, { width: CONTENT_WIDTH });
  
  y = 130;
  
  doc.font('Helvetica').fontSize(12).fillColor(COLORS.dark).lineGap(5);
  doc.text('Il Programma Convenzioni Partner SOCCORSO DIGITALE:', MARGIN, y, { width: CONTENT_WIDTH });
  
  y += 40;
  
  const selectionCriteria = [
    { icon: '✓', text: 'Privilegia aziende affidabili', color: COLORS.success },
    { icon: '✓', text: 'Seleziona per area e categoria', color: COLORS.primary },
    { icon: '✓', text: 'Punta alla qualita, non alla quantita', color: COLORS.accent },
  ];
  
  selectionCriteria.forEach((criteria, i) => {
    const cardY = y + (i * 70);
    
    doc.roundedRect(MARGIN, cardY, CONTENT_WIDTH, 60, 6).fill(COLORS.white);
    doc.rect(MARGIN, cardY, 6, 60).fill(criteria.color);
    
    doc.circle(MARGIN + 40, cardY + 30, 18).fill(criteria.color);
    doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.white);
    doc.text(criteria.icon, MARGIN + 34, cardY + 23, { width: 12 });
    
    doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.dark);
    doc.text(criteria.text, MARGIN + 75, cardY + 22, { width: CONTENT_WIDTH - 100 });
  });
  
  y += 250;
  
  // Bottom quote
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 70, 8).fill(COLORS.primary);
  doc.font('Helvetica-Bold').fontSize(16).fillColor(COLORS.white);
  doc.text('Stiamo costruendo un ecosistema,', MARGIN, y + 18, { width: CONTENT_WIDTH, align: 'center' });
  doc.text('non un elenco.', MARGIN, y + 40, { width: CONTENT_WIDTH, align: 'center' });
  
  addFooter(doc);
  addPageNumber(doc, currentPage++, totalPages);

  // ========== PAGE 14: CLOSING / CONTACT ==========
  doc.addPage();
  
  drawGradientRect(doc, 0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLORS.primary, COLORS.primaryDark);
  
  // Decorative elements
  doc.circle(PAGE_WIDTH + 50, PAGE_HEIGHT / 2, 200).fill('rgba(255,255,255,0.03)');
  doc.circle(-100, PAGE_HEIGHT - 100, 250).fill('rgba(20,184,166,0.08)');
  
  y = 150;
  
  doc.font('Helvetica-Bold').fontSize(32).fillColor(COLORS.white);
  doc.text('Entriamo in contatto', MARGIN, y, { width: CONTENT_WIDTH, align: 'center' });
  
  y += 60;
  
  doc.font('Helvetica').fontSize(13).fillColor('rgba(255,255,255,0.9)').lineGap(6);
  doc.text('Se pensi che la tua azienda possa offrire valore al nostro personale e trarre beneficio da una partnership con SOCCORSO DIGITALE, saremo lieti di approfondire.', MARGIN + 40, y, { width: CONTENT_WIDTH - 80, align: 'center' });
  
  y += 100;
  
  // Contact cards
  const contacts = [
    { icon: '📞', label: 'Telefono', value: '045 8203000' },
    { icon: '📧', label: 'Email', value: 'partner@croceeuropa.com' },
    { icon: '🌐', label: 'Web', value: 'www.croceeuropa.com/partner' },
  ];
  
  contacts.forEach((contact, i) => {
    const cardY = y + (i * 70);
    
    doc.roundedRect(MARGIN + 60, cardY, CONTENT_WIDTH - 120, 55, 8).fill('rgba(255,255,255,0.1)');
    
    doc.font('Helvetica').fontSize(20).fillColor(COLORS.white);
    doc.text(contact.icon, MARGIN + 80, cardY + 15, { width: 30 });
    
    doc.font('Helvetica').fontSize(10).fillColor('rgba(255,255,255,0.7)');
    doc.text(contact.label, MARGIN + 120, cardY + 12, { width: 200 });
    doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.white);
    doc.text(contact.value, MARGIN + 120, cardY + 28, { width: 300 });
  });
  
  y += 250;
  
  // Bottom branding
  doc.roundedRect(PAGE_WIDTH / 2 - 100, y, 200, 50, 8).fill(COLORS.accent);
  doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.white);
  doc.text('Programma Convenzioni Partner', PAGE_WIDTH / 2 - 100, y + 10, { width: 200, align: 'center' });
  doc.font('Helvetica').fontSize(12).fillColor('rgba(255,255,255,0.9)');
  doc.text('SOCCORSO DIGITALE - 2026', PAGE_WIDTH / 2 - 100, y + 30, { width: 200, align: 'center' });
  
  addPageNumber(doc, currentPage++, totalPages);

  doc.end();
}
