import PDFDocument from 'pdfkit';
import { Response } from 'express';
import path from 'path';
import fs from 'fs';

const C = {
  blue: '#0064C5', blueMid: '#004FA0', blueDark: '#003D7A', blueDeep: '#002B55',
  blueLight: '#E8F2FC', bluePale: '#F0F6FF',
  green: '#00A651', greenMid: '#009347', greenDark: '#007A3B', greenLight: '#E8F8EF',
  dark: '#1A1A2E', gray: '#5A6878', grayMed: '#8C9AAE', grayLight: '#D0D8E2',
  lightBg: '#F5F7FA', white: '#FFFFFF', gold: '#C9960C', goldDark: '#9E7500', goldLight: '#FEF9E7',
};

const PW = 595.28;
const PH = 841.89;
const ML = 42;
const CW = PW - ML * 2;
const SB = PH - 42;

function st(doc: PDFKit.PDFDocument, text: string, x: number, y: number, opts: any = {}) {
  doc.text(text, x, y, { ...opts, height: Math.max(SB - y, 10) });
}

function footer(doc: PDFKit.PDFDocument, pn: number, total: number) {
  doc.save();
  doc.rect(0, PH - 24, PW, 24).fill(C.blueDeep);
  doc.font('Helvetica').fontSize(6.5).fillColor(C.white);
  st(doc, 'CROCE EUROPA SRL IMPRESA SOCIALE  |  Documento Riservato  |  Partnership Program 2026', ML, PH - 16, { width: CW - 50, lineBreak: false });
  st(doc, `${pn} / ${total}`, PW - ML - 30, PH - 16, { width: 30, align: 'right', lineBreak: false });
  doc.restore();
}

function banner(doc: PDFKit.PDFDocument, label: string, title: string, color: string = C.blue): number {
  doc.save();
  doc.rect(0, 0, PW, 56).fill(color);
  doc.font('Helvetica').fontSize(8).fillOpacity(0.7).fillColor(C.white);
  st(doc, label.toUpperCase(), ML + 10, 10, { width: CW, lineBreak: false });
  doc.fillOpacity(1);
  doc.font('Helvetica-Bold').fontSize(17).fillColor(C.white);
  st(doc, title, ML + 10, 26, { width: CW - 20, lineBreak: false });
  doc.restore();
  return 66;
}

function sub(doc: PDFKit.PDFDocument, y: number, title: string, color: string = C.blue): number {
  doc.rect(ML, y, 4, 18).fill(C.green);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(color);
  st(doc, title, ML + 12, y + 2, { width: CW - 16, lineBreak: false });
  return y + 24;
}

function bullet(doc: PDFKit.PDFDocument, x: number, y: number, text: string, fs: number = 9.5, col: string = C.green): number {
  if (y >= SB) return y;
  doc.circle(x + 2.5, y + fs * 0.42, 1.8).fill(col);
  doc.font('Helvetica').fontSize(fs).fillColor(C.dark);
  const tw = CW - (x - ML) - 12;
  const h = doc.heightOfString(text, { width: tw });
  doc.text(text, x + 9, y, { width: tw, height: Math.max(SB - y, 10) });
  return y + Math.min(h, SB - y) + 1;
}

function kpi(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, val: string, lab: string, col: string) {
  doc.roundedRect(x, y, w, h, 4).fill(C.lightBg);
  doc.roundedRect(x, y, w, h, 4).lineWidth(0.5).strokeColor(C.grayLight).stroke();
  doc.font('Helvetica-Bold').fontSize(18).fillColor(col);
  st(doc, val, x, y + 5, { width: w, align: 'center', lineBreak: false });
  doc.font('Helvetica').fontSize(6.5).fillColor(C.gray);
  st(doc, lab.toUpperCase(), x + 2, y + 28, { width: w - 4, align: 'center', lineBreak: false });
}

function para(doc: PDFKit.PDFDocument, text: string, x: number, y: number, opts: any = {}): number {
  if (y >= SB) return y;
  const w = opts.width || CW;
  const lg = opts.lineGap || 2;
  const h = doc.heightOfString(text, { width: w, lineGap: lg });
  const mh = Math.max(SB - y, 10);
  doc.text(text, x, y, { width: w, lineGap: lg, height: mh, ...opts });
  return y + Math.min(h, mh);
}

function card(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, title: string, desc: string, col: string, bg: string) {
  doc.roundedRect(x, y, w, h, 4).fill(bg);
  doc.rect(x, y, 4, h).fill(col);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(col);
  st(doc, title, x + 12, y + 5, { width: w - 18, lineBreak: false });
  doc.font('Helvetica').fontSize(8).fillColor(C.dark);
  st(doc, desc, x + 12, y + 18, { width: w - 20, height: h - 22, lineGap: 1.2 });
}

function cardBullets(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, title: string, items: string[], col: string, bg: string) {
  doc.roundedRect(x, y, w, h, 4).fill(bg);
  doc.rect(x, y, w, 3).fill(col);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(col);
  st(doc, title, x + 8, y + 8, { width: w - 16, lineBreak: false });
  let ly = y + 22;
  items.forEach(it => {
    doc.circle(x + 12, ly + 3, 1.3).fill(col);
    doc.font('Helvetica').fontSize(7.5).fillColor(C.dark);
    st(doc, it, x + 18, ly, { width: w - 28, lineBreak: false });
    ly += 11;
  });
}

function highlight(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, text: string, col: string) {
  doc.roundedRect(x, y, w, h, 5).fill(col);
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C.white);
  st(doc, text, x + 12, y + (h - 10) / 2, { width: w - 24, align: 'center', lineBreak: false });
}

export function generatePartnershipProposalPDF(res: Response) {
  const doc = new PDFDocument({ size: 'A4', margin: ML, autoFirstPage: false, info: {
    Title: 'Partnership Program 2026 - Croce Europa SRL',
    Author: 'Croce Europa SRL Impresa Sociale',
    Subject: 'Proposta di Partnership Istituzionale',
    Creator: 'Croce Europa SRL'
  }});
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="Croce_Europa_Partnership_2026.pdf"');
  doc.pipe(res);

  const today = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
  const logoPath = path.join(process.cwd(), 'attached_assets', 'Logo-Croce-Europa-Ufficiale_1766252701803.png');
  const hasLogo = fs.existsSync(logoPath);
  const TP = 11;

  // ================================================================
  //  PAGE 1  —  COVER
  // ================================================================
  doc.addPage({ size: 'A4', margin: 0 });

  doc.rect(0, 0, PW, PH * 0.72).fill(C.blue);
  doc.rect(0, PH * 0.72, PW, PH * 0.28).fill(C.blueDeep);

  doc.save();
  doc.circle(PW + 80, -40, 260).fillOpacity(0.04).fill(C.white);
  doc.circle(-90, PH * 0.6, 280).fillOpacity(0.04).fill(C.white);
  doc.restore();

  let cy = 80;
  doc.save();
  doc.roundedRect(PW / 2 - 48, cy, 96, 96, 48).fillOpacity(0.15).fill(C.white);
  doc.fillOpacity(1);
  doc.font('Helvetica-Bold').fontSize(42).fillColor(C.white);
  st(doc, 'CE', PW / 2 - 48, cy + 24, { width: 96, align: 'center', lineBreak: false });
  doc.restore();
  cy = 195;

  doc.font('Helvetica-Bold').fontSize(13).fillColor(C.white);
  st(doc, 'CROCE EUROPA SRL IMPRESA SOCIALE', 0, cy, { width: PW, align: 'center', lineBreak: false });
  cy += 18;
  doc.font('Helvetica').fontSize(9).fillOpacity(0.75).fillColor(C.white);
  st(doc, 'SERVIZI DI TRASPORTO SANITARIO  |  VERONA & VICENZA', 0, cy, { width: PW, align: 'center', lineBreak: false });
  doc.fillOpacity(1);
  cy += 28;

  doc.moveTo(PW / 2 - 35, cy).lineTo(PW / 2 + 35, cy).lineWidth(1.2).strokeOpacity(0.3).strokeColor(C.white).stroke();
  doc.strokeOpacity(1);
  cy += 16;

  doc.font('Helvetica-Bold').fontSize(34).fillColor(C.white);
  st(doc, 'Partnership Program', 0, cy, { width: PW, align: 'center', lineBreak: false });
  cy += 42;
  doc.font('Helvetica-Bold').fontSize(34).fillColor(C.white);
  st(doc, '2026', 0, cy, { width: PW, align: 'center', lineBreak: false });
  cy += 48;

  doc.font('Helvetica').fontSize(11).fillOpacity(0.9).fillColor(C.white);
  st(doc, 'Proposta di collaborazione strategica', 0, cy, { width: PW, align: 'center', lineBreak: false });
  cy += 16;
  st(doc, 'per aziende che vogliono fare la differenza', 0, cy, { width: PW, align: 'center', lineBreak: false });
  doc.fillOpacity(1);
  cy += 38;

  doc.roundedRect(PW / 2 - 90, cy, 180, 26, 13).fillOpacity(0.18).fill(C.white);
  doc.fillOpacity(1);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.white);
  st(doc, 'DOCUMENTO RISERVATO', 0, cy + 7, { width: PW, align: 'center', lineBreak: false });
  cy += 42;

  const kw = 90, kg = 14;
  const kx0 = (PW - kw * 5 - kg * 4) / 2;
  [['150+', 'Persone'], ['20+', 'Ambulanze'], ['5', 'Sedi'], ['2.800+', 'Servizi/Anno'], ['200K+', 'Km/Anno']].forEach((s, i) => {
    const sx = kx0 + i * (kw + kg);
    doc.roundedRect(sx, cy, kw, 50, 5).fillOpacity(0.14).fill(C.white);
    doc.fillOpacity(1);
    doc.font('Helvetica-Bold').fontSize(18).fillColor(C.white);
    st(doc, s[0], sx, cy + 6, { width: kw, align: 'center', lineBreak: false });
    doc.font('Helvetica').fontSize(6.5).fillOpacity(0.85).fillColor(C.white);
    st(doc, s[1].toUpperCase(), sx, cy + 32, { width: kw, align: 'center', lineBreak: false });
    doc.fillOpacity(1);
  });
  cy += 70;

  doc.font('Helvetica').fontSize(9).fillOpacity(0.5).fillColor(C.white);
  st(doc, 'Province di Verona e Vicenza  |  Operativi 24/7, 365 giorni all\u2019anno', 0, cy, { width: PW, align: 'center', lineBreak: false });
  doc.fillOpacity(1);

  doc.font('Helvetica').fontSize(8).fillOpacity(0.3).fillColor(C.white);
  st(doc, today, 0, PH - 40, { width: PW, align: 'center', lineBreak: false });
  doc.fillOpacity(1);

  // ================================================================
  //  PAGE 2  —  EXECUTIVE SUMMARY + CHI SIAMO
  // ================================================================
  doc.addPage({ size: 'A4', margin: ML });
  footer(doc, 2, TP);
  let y = banner(doc, 'Executive Summary', 'Chi e Croce Europa');

  doc.font('Helvetica').fontSize(9.5).fillColor(C.dark);
  y = para(doc, 'Croce Europa SRL Impresa Sociale e una delle realta piu strutturate e tecnologicamente avanzate nel trasporto sanitario del Nord-Est Italia. Operiamo nelle province di Verona e Vicenza con continuita 24/7, 365 giorni all\u2019anno, garantendo servizi di emergenza 118, trasporto sanitario programmato, assistenza eventi e formazione sanitaria accreditata.', ML, y, { lineGap: 1.5 });
  y += 6;

  y = para(doc, 'Con oltre 150 professionisti tra dipendenti, volontari e collaboratori, una flotta di 20+ ambulanze, 5 sedi operative e un Centro di Formazione accreditato, rappresentiamo un punto di riferimento per il soccorso sanitario territoriale. Questo documento presenta il nostro Programma di Partnership 2026, pensato per aziende che desiderano costruire una collaborazione concreta, misurabile e ad alto impatto sociale.', ML, y, { lineGap: 1.5 });
  y += 10;

  const bw = (CW - 28) / 5, bh = 42;
  kpi(doc, ML, y, bw, bh, '150+', 'Persone', C.blue);
  kpi(doc, ML + bw + 7, y, bw, bh, '20+', 'Ambulanze', C.green);
  kpi(doc, ML + (bw + 7) * 2, y, bw, bh, '5', 'Sedi', C.blue);
  kpi(doc, ML + (bw + 7) * 3, y, bw, bh, '2.800+', 'Servizi/Anno', C.green);
  kpi(doc, ML + (bw + 7) * 4, y, bw, bh, '200K+', 'Km/Anno', C.blue);
  y += bh + 10;

  y = sub(doc, y, 'La Nostra Organizzazione');

  const hw = (CW - 8) / 2;
  card(doc, ML, y, hw, 56, 'Trasporto Sanitario', 'Servizi di emergenza 118, trasporto programmato e dimissioni ospedaliere. Operativita continua su tutto il territorio delle province di Verona e Vicenza con tempi di risposta competitivi.', C.blue, C.bluePale);
  card(doc, ML + hw + 8, y, hw, 56, 'Centro di Formazione', 'Corsi BLSD, primo soccorso aziendale, formazione sanitaria per operatori e aggiornamenti periodici. Certificazioni ufficiali riconosciute a livello nazionale.', C.green, C.greenLight);
  y += 60;
  card(doc, ML, y, hw, 56, 'Infrastruttura Digitale', 'App mobile proprietaria, gestionale interno avanzato, dashboard di impatto sociale, tracciamento GPS flotta e reportistica automatizzata per la massima trasparenza operativa.', C.blue, C.bluePale);
  card(doc, ML + hw + 8, y, hw, 56, 'Impatto Sociale', 'Impresa Sociale iscritta al registro delle imprese. Reporting ESG strutturato, metriche di impatto verificabili, bilancio sociale e compliance normativa completa.', C.green, C.greenLight);
  y += 62;

  y = sub(doc, y, 'Il Nostro Team: 150+ Professionisti');

  const tw3 = (CW - 12) / 3;
  cardBullets(doc, ML, y, tw3, 82, 'Dipendenti', ['Autisti soccorritori', 'Soccorritori certificati', 'Personale amministrativo', 'Coordinatori operativi', 'Istruttori formazione'], C.blue, C.bluePale);
  cardBullets(doc, ML + tw3 + 6, y, tw3, 82, 'Volontari', ['Formati e certificati', 'Turnazione regolare', 'Aggiornamento continuo', 'Copertura territoriale', 'Integrazione operativa'], C.green, C.greenLight);
  cardBullets(doc, ML + (tw3 + 6) * 2, y, tw3, 82, 'Collaboratori', ['Medici convenzionati', 'Infermieri specializzati', 'Consulenti esterni', 'Partner istituzionali', 'Fornitori qualificati'], C.blue, C.bluePale);
  y += 86;

  highlight(doc, ML, y, CW, 26, 'Ogni giorno oltre 40 operatori sono attivi sulle strade di Verona e Vicenza con la nostra flotta.', C.blueDeep);

  // ================================================================
  //  PAGE 3  —  PRESENZA TERRITORIALE
  // ================================================================
  doc.addPage({ size: 'A4', margin: ML });
  footer(doc, 3, TP);
  y = banner(doc, 'Presenza Territoriale', '20+ Ambulanze sul Territorio Ogni Giorno', C.green);

  doc.font('Helvetica').fontSize(9.5).fillColor(C.dark);
  y = para(doc, 'La nostra flotta e tra le piu grandi del settore privato nelle province di Verona e Vicenza. Con oltre 20 ambulanze operative quotidianamente, garantiamo una copertura capillare che genera visibilita costante per i nostri partner su tutte le principali arterie stradali, nei centri urbani, nelle zone industriali e nei comuni rurali.', ML, y, { lineGap: 1.5 });
  y += 8;

  y = sub(doc, y, 'Copertura Geografica');

  const gw = (CW - 8) / 2;
  cardBullets(doc, ML, y, gw, 80, 'Provincia di Verona', ['Centro storico e zona fiera', 'Zona industriale ZAI', 'Valpolicella e Lago di Garda', 'Bassa veronese e Legnago', 'Est veronese e San Bonifacio'], C.blue, C.bluePale);
  cardBullets(doc, ML + gw + 8, y, gw, 80, 'Provincia di Vicenza', ['Centro e zona industriale', 'Bassano del Grappa', 'Thiene e Alto Vicentino', 'Arzignano e Valdagno', 'Noventa e Basso Vicentino'], C.green, C.greenLight);
  y += 84;

  y = sub(doc, y, 'La Nostra Flotta');

  doc.font('Helvetica').fontSize(9.5).fillColor(C.dark);
  y = para(doc, 'Ogni ambulanza della nostra flotta rappresenta un veicolo di comunicazione in movimento. Per un partner, questo significa:', ML, y, { lineGap: 1.5 });
  y += 4;

  const fleetBenefits = [
    'Visibilita quotidiana e continuativa: i nostri mezzi percorrono oltre 200.000 km all\u2019anno',
    'Presenza in contesti ad alto traffico: ospedali, cliniche, eventi sportivi, manifestazioni',
    'Riconoscibilita immediata: le ambulanze attirano naturalmente l\u2019attenzione del pubblico',
    'Associazione positiva: il vostro brand collegato a un servizio che salva vite ogni giorno',
    'Copertura oraria completa: operativita 24/7 con turni diurni e notturni',
    'Presenza nelle zone industriali: visibilita presso aziende e lavoratori del territorio',
  ];
  fleetBenefits.forEach(t => { y = bullet(doc, ML + 4, y, t, 9); });
  y += 8;

  y = sub(doc, y, 'Le Nostre 5 Sedi Operative');

  doc.font('Helvetica').fontSize(9.5).fillColor(C.dark);
  y = para(doc, 'Ogni sede e un punto di contatto con il territorio, dotata di ambulanze, personale e attrezzature. Le sedi generano un flusso costante di operatori, pazienti e visitatori che rappresentano un pubblico naturale per i nostri partner.', ML, y, { lineGap: 1.5 });
  y += 4;

  const sw5 = (CW - 16) / 5;
  for (let i = 0; i < 5; i++) {
    const sx = ML + i * (sw5 + 4);
    doc.roundedRect(sx, y, sw5, 36, 3).fill(i % 2 === 0 ? C.bluePale : C.greenLight);
    doc.rect(sx, y, sw5, 3).fill(i % 2 === 0 ? C.blue : C.green);
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(i % 2 === 0 ? C.blue : C.green);
    st(doc, `Sede ${i + 1}`, sx + 4, y + 10, { width: sw5 - 8, align: 'center', lineBreak: false });
    doc.font('Helvetica').fontSize(6.5).fillColor(C.gray);
    st(doc, 'Ambulanze + Staff', sx + 4, y + 22, { width: sw5 - 8, align: 'center', lineBreak: false });
  }
  y += 42;

  highlight(doc, ML, y, CW, 26, '200.000+ km/anno di visibilita sul territorio per il vostro brand', C.greenDark);

  // ================================================================
  //  PAGE 4  —  PERCHE DIVENTARE PARTNER
  // ================================================================
  doc.addPage({ size: 'A4', margin: ML });
  footer(doc, 4, TP);
  y = banner(doc, 'Valore della Partnership', 'Perche Diventare Partner di Croce Europa');

  doc.font('Helvetica').fontSize(9.5).fillColor(C.dark);
  y = para(doc, 'Diventare partner di Croce Europa non e una sponsorizzazione occasionale. E una collaborazione strategica che genera valore reciproco, misurabile e continuativo. Il vostro brand viene integrato nell\u2019operativita quotidiana di un\u2019organizzazione con oltre 150 professionisti e 20+ ambulanze attive ogni giorno.', ML, y, { lineGap: 1.5 });
  y += 8;

  const benefitsFull: [string, string, string, string][] = [
    ['Visibilita Territoriale Quotidiana', 'Oltre 20 ambulanze percorrono ogni giorno le strade di Verona e Vicenza. Il vostro brand sara visibile su mezzi che percorrono 200.000+ km/anno, in contesti ad alto traffico e in associazione con un servizio essenziale.', C.blue, C.bluePale],
    ['Community di 150+ Professionisti', 'Dipendenti, volontari e collaboratori che vivono e lavorano sul territorio. Un pubblico reale, fidelizzato, raggiungibile tramite canali diretti e con un alto livello di fiducia verso i partner convenzionati.', C.green, C.greenLight],
    ['Piattaforma Digitale Proprietaria', 'Il vostro brand visibile nell\u2019app mobile e nel gestionale interno utilizzato quotidianamente da tutto il personale. Sezione partner dedicata, comunicazioni mirate e statistiche di utilizzo.', C.blue, C.bluePale],
    ['Co-Branding sulle Certificazioni', 'Il vostro logo sulle certificazioni del nostro Centro di Formazione accreditato: corsi BLSD, primo soccorso aziendale e formazione sanitaria. Documenti conservati nel tempo.', C.green, C.greenLight],
    ['Eventi e Serate in Collaborazione', 'Organizzazione congiunta di eventi, serate informative, open day e momenti di incontro con il nostro personale e la comunita. Presentazione diretta dei vostri prodotti e servizi.', C.blue, C.bluePale],
    ['Impatto Sociale Misurabile', 'Report periodici con dati concreti: km percorsi, persone raggiunte, eventi realizzati, metriche di engagement. Dati utilizzabili per il vostro reporting CSR/ESG aziendale.', C.green, C.greenLight],
    ['Co-Branding su Divise e Materiali', 'Il vostro logo sull\u2019abbigliamento operativo indossato ogni giorno da 150+ persone: divise, felpe, giacche, magliette. Visibilita costante in ogni contesto operativo.', C.blue, C.bluePale],
    ['Comunicazione Integrata', 'Menzione come partner nelle comunicazioni ufficiali, newsletter periodiche, canali social media, sito web istituzionale e materiali promozionali dell\u2019organizzazione.', C.green, C.greenLight],
  ];

  benefitsFull.forEach(([t, d, c, bg]) => {
    if (y >= SB - 40) return;
    const ch = 42;
    doc.roundedRect(ML, y, CW, ch, 4).fill(bg);
    doc.rect(ML, y, 4, ch).fill(c);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(c);
    st(doc, t, ML + 12, y + 5, { width: CW - 22, lineBreak: false });
    doc.font('Helvetica').fontSize(8).fillColor(C.dark);
    st(doc, d, ML + 12, y + 17, { width: CW - 22, height: ch - 20, lineGap: 1 });
    y += ch + 3;
  });

  y += 2;
  highlight(doc, ML, y, CW, 26, 'Non vendiamo spazi pubblicitari. Costruiamo partnership strategiche di valore reciproco.', C.blueDeep);

  // ================================================================
  //  PAGE 5  —  CANALI DI VISIBILITA
  // ================================================================
  doc.addPage({ size: 'A4', margin: ML });
  footer(doc, 5, TP);
  y = banner(doc, 'Canali di Visibilita', 'Dove Appare il Vostro Brand');

  doc.font('Helvetica').fontSize(9.5).fillColor(C.dark);
  y = para(doc, 'Il programma di partnership utilizza esclusivamente canali diretti, proprietari e verificati. La visibilita non e dispersiva ma mirata, raggiungendo un pubblico qualificato e fidelizzato attraverso i nostri touchpoint operativi quotidiani.', ML, y, { lineGap: 1.5 });
  y += 8;

  const chH = 90;
  cardBullets(doc, ML, y, hw, chH, 'Flotta Ambulanze (20+)', [
    'Logo e branding sui mezzi operativi',
    '200.000+ km/anno di esposizione',
    'Presenza 24/7 su Verona e Vicenza',
    'Visibilita presso ospedali e cliniche',
    'Contesti ad alto traffico e attenzione',
  ], C.blue, C.bluePale);
  cardBullets(doc, ML + hw + 8, y, hw, chH, 'Personale in Divisa (150+)', [
    'Logo su divise, felpe e giacche',
    'Indossate quotidianamente sul territorio',
    'Visibilita durante i servizi operativi',
    'Presenza a eventi e manifestazioni',
    'Riconoscibilita immediata del brand',
  ], C.green, C.greenLight);
  y += chH + 6;

  cardBullets(doc, ML, y, hw, chH, 'App Mobile e Gestionale', [
    'Sezione partner dedicata nell\u2019app',
    'Banner e comunicazioni personalizzate',
    'Notifiche mirate al personale',
    'Statistiche di utilizzo convenzioni',
    'Visibilita quotidiana a 40+ operatori',
  ], C.green, C.greenLight);
  cardBullets(doc, ML + hw + 8, y, hw, chH, 'Centro di Formazione', [
    'Logo sulle certificazioni ufficiali',
    'Materiali formativi co-branded',
    'Visibilita durante corsi e workshop',
    'Documentazione conservata nel tempo',
    'Corsi BLSD e primo soccorso',
  ], C.blue, C.bluePale);
  y += chH + 6;

  cardBullets(doc, ML, y, hw, chH, 'Comunicazione Digitale', [
    'Logo e link sul sito web istituzionale',
    'Post dedicati sui canali social media',
    'Newsletter periodiche al personale',
    'Menzione nelle comunicazioni ufficiali',
    'Sezione partner sul sito pubblico',
  ], C.blue, C.bluePale);
  cardBullets(doc, ML + hw + 8, y, hw, chH, 'Eventi e Serate', [
    'Stand e punto informativo dedicato',
    'Presentazione prodotti e servizi',
    'Distribuzione materiale promozionale',
    'Talk e dimostrazioni pratiche',
    'Networking con 150+ professionisti',
  ], C.green, C.greenLight);
  y += chH + 6;

  highlight(doc, ML, y, CW, 26, 'Niente pubblicita dispersiva. Solo visibilita mirata, qualificata e verificabile.', C.greenDark);

  // ================================================================
  //  PAGE 6  —  ECOSISTEMA DIGITALE
  // ================================================================
  doc.addPage({ size: 'A4', margin: ML });
  footer(doc, 6, TP);
  y = banner(doc, 'Infrastruttura Digitale', 'Il Nostro Ecosistema Tecnologico');

  doc.font('Helvetica').fontSize(9.5).fillColor(C.dark);
  y = para(doc, 'Croce Europa ha sviluppato un\u2019infrastruttura digitale proprietaria unica nel settore del trasporto sanitario italiano. La piattaforma SOCCORSO DIGITALE integra app mobile, gestionale web, dashboard di impatto e strumenti di comunicazione interna, offrendo ai partner un canale di visibilita quotidiano, diretto e misurabile.', ML, y, { lineGap: 1.5 });
  y += 8;

  y = sub(doc, y, 'App Mobile SOCCORSO DIGITALE');

  doc.font('Helvetica').fontSize(9).fillColor(C.dark);
  y = para(doc, 'Lo strumento principale di lavoro per tutti gli operatori. Ogni giorno, piu di 40 professionisti la utilizzano per gestire le operazioni sul territorio:', ML, y, { lineGap: 1.5 });
  y += 4;

  const appFeat = [
    'Registrazione servizi di trasporto sanitario con tracciamento GPS in tempo reale',
    'Gestione checklist di bordo con scadenze materiali e inventario digitale',
    'Schede intervento di emergenza digitali conformi al modello 118 ufficiale',
    'Comunicazioni interne, annunci e aggiornamenti operativi',
    'Sezione convenzioni partner con dettagli, contatti e offerte dedicate',
    'Gestione documentale veicoli, sanificazioni e report fotografici',
    'Calcolo automatico rimborsi chilometrici e buoni pasto per il personale',
  ];
  appFeat.forEach(t => { y = bullet(doc, ML + 4, y, t, 8.5); });
  y += 6;

  doc.roundedRect(ML, y, CW, 38, 4).fill(C.bluePale);
  doc.rect(ML, y, 4, 38).fill(C.blue);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.blue);
  st(doc, 'Visibilita Partner nell\u2019App', ML + 12, y + 4, { width: CW - 24, lineBreak: false });
  doc.font('Helvetica').fontSize(8).fillColor(C.dark);
  st(doc, 'I partner hanno una sezione dedicata visibile a tutti gli operatori: logo, descrizione attivita, convenzioni attive, contatti diretti e mappa per raggiungere la sede. Ogni volta che un operatore apre l\u2019app, i partner convenzionati sono a portata di mano.', ML + 12, y + 16, { width: CW - 24, height: 22, lineGap: 1 });
  y += 44;

  y = sub(doc, y, 'Pannello Gestionale Web');

  doc.font('Helvetica').fontSize(9).fillColor(C.dark);
  y = para(doc, 'Il pannello amministrativo gestisce l\u2019intera operativita aziendale. I partner beneficiano di integrazione diretta nel sistema:', ML, y, { lineGap: 1.5 });
  y += 4;

  const gestFeat = [
    'Sezione partner integrata con gestione centralizzata delle convenzioni',
    'Comunicazioni push dirette a tutto il personale operativo',
    'Dashboard statistiche con metriche di utilizzo e engagement',
    'Report periodici automatizzati sull\u2019efficacia della partnership',
    'Gestione eventi e serate in collaborazione con calendario integrato',
  ];
  gestFeat.forEach(t => { y = bullet(doc, ML + 4, y, t, 8.5); });
  y += 6;

  highlight(doc, ML, y, CW, 26, 'Un ecosistema digitale proprietario. I partner sono integrati negli strumenti di lavoro quotidiani.', C.blueDeep);

  // ================================================================
  //  PAGE 7  —  CO-BRANDING E FORMAZIONE
  // ================================================================
  doc.addPage({ size: 'A4', margin: ML });
  footer(doc, 7, TP);
  y = banner(doc, 'Formazione e Co-Branding', 'Il Vostro Logo sulle Nostre Certificazioni', C.green);

  doc.font('Helvetica').fontSize(9.5).fillColor(C.dark);
  y = para(doc, 'Il Centro di Formazione di Croce Europa e accreditato per l\u2019erogazione di corsi di formazione sanitaria. Ogni corso rilascia certificazioni ufficiali che vengono conservate nel tempo dai partecipanti, generando una visibilita duratura e di alto valore per i partner.', ML, y, { lineGap: 1.5 });
  y += 8;

  y = sub(doc, y, 'Tipologie di Corsi');

  const corsiData: [string, string][] = [
    ['BLSD (Basic Life Support and Defibrillation)', 'Corso completo con certificazione valida 2 anni, riconosciuto a livello nazionale.'],
    ['Primo Soccorso Aziendale (D.Lgs. 81/08)', 'Formazione obbligatoria per addetti al primo soccorso aziendale Gruppo A e B.'],
    ['Formazione Sanitaria per Operatori', 'Programma formativo completo per soccorritori e autisti soccorritori.'],
    ['Aggiornamento e Ricertificazione', 'Corsi periodici di aggiornamento per mantenere attive le certificazioni.'],
    ['Corsi Specialistici su Richiesta', 'Formazione personalizzata per aziende, scuole, associazioni e gruppi.'],
  ];

  corsiData.forEach(([t, d], i) => {
    if (y >= SB - 30) return;
    const ch = 32;
    doc.roundedRect(ML, y, CW, ch, 3).fill(i % 2 === 0 ? C.greenLight : C.bluePale);
    doc.rect(ML, y, 4, ch).fill(i % 2 === 0 ? C.green : C.blue);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(i % 2 === 0 ? C.green : C.blue);
    st(doc, t, ML + 12, y + 4, { width: CW - 22, lineBreak: false });
    doc.font('Helvetica').fontSize(7.5).fillColor(C.dark);
    st(doc, d, ML + 12, y + 17, { width: CW - 22, lineBreak: false });
    y += ch + 3;
  });
  y += 6;

  y = sub(doc, y, 'Opportunita di Co-Branding per i Partner');

  const cbItems: [string, string][] = [
    ['Logo sulle Certificazioni Ufficiali', 'Il vostro logo appare su ogni certificazione rilasciata ai partecipanti. Un documento ufficiale conservato per anni che garantisce una visibilita duratura e istituzionale, associata a un contesto di alta professionalita.'],
    ['Materiali Didattici Co-Branded', 'Il vostro brand presente nei materiali formativi distribuiti durante i corsi: presentazioni, manuali operativi, dispense e documentazione di supporto. Visibilita in contesto educativo professionale.'],
    ['Corsi in Collaborazione', 'Possibilita di organizzare corsi e workshop in collaborazione con il partner, con visibilita congiunta nella comunicazione dell\u2019evento e partecipazione attiva durante le sessioni formative.'],
    ['Visibilita durante le Sessioni', 'Presenza del brand del partner nell\u2019aula di formazione durante i corsi: roll-up, materiali informativi, presentazione dell\u2019azienda partner ai partecipanti del corso.'],
  ];

  cbItems.forEach(([t, d], i) => {
    if (y >= SB - 40) return;
    const ch = 44;
    doc.roundedRect(ML, y, CW, ch, 4).fill(i % 2 === 0 ? C.greenLight : C.bluePale);
    doc.rect(ML, y, 4, ch).fill(i % 2 === 0 ? C.green : C.blue);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(i % 2 === 0 ? C.green : C.blue);
    st(doc, t, ML + 12, y + 5, { width: CW - 22, lineBreak: false });
    doc.font('Helvetica').fontSize(8).fillColor(C.dark);
    st(doc, d, ML + 12, y + 18, { width: CW - 22, height: ch - 20, lineGap: 1 });
    y += ch + 3;
  });
  y += 2;

  highlight(doc, ML, y, CW, 26, 'Le certificazioni restano nel tempo. La visibilita del vostro brand anche.', C.greenDark);

  // ================================================================
  //  PAGE 8  —  EVENTI E SERATE
  // ================================================================
  doc.addPage({ size: 'A4', margin: ML });
  footer(doc, 8, TP);
  y = banner(doc, 'Eventi e Networking', 'Serate in Collaborazione con i Partner');

  doc.font('Helvetica').fontSize(9.5).fillColor(C.dark);
  y = para(doc, 'La partnership con Croce Europa va oltre la visibilita passiva. Organizziamo regolarmente eventi, serate tematiche, open day e momenti di incontro che rappresentano un\u2019occasione unica per i partner di interagire direttamente con il nostro personale e con la comunita. Ogni evento e un\u2019opportunita di networking qualificato con oltre 150 professionisti del soccorso sanitario.', ML, y, { lineGap: 1.5 });
  y += 8;

  y = sub(doc, y, 'Tipologie di Eventi');

  const eventi: [string, string, string, string][] = [
    ['Serate Informative', 'Presentazione di prodotti, servizi e novita ai nostri operatori. Format strutturato con talk del partner, Q&A e momento conviviale.', C.blue, C.bluePale],
    ['Open Day e Porte Aperte', 'Giornate dedicate alla comunita con visibilita del partner, dimostrazioni pratiche dei mezzi e attivita interattive per famiglie e cittadini.', C.green, C.greenLight],
    ['Corsi e Workshop Congiunti', 'Formazione co-organizzata su temi di interesse comune: sicurezza sul lavoro, primo soccorso aziendale, prevenzione e benessere.', C.blue, C.bluePale],
    ['Eventi Benefici e Solidali', 'Iniziative di raccolta fondi, giornate di sensibilizzazione e campagne sociali con visibilita congiunta e impatto mediatico positivo.', C.green, C.greenLight],
    ['Fiere e Manifestazioni', 'Partecipazione congiunta a fiere di settore, eventi sportivi e manifestazioni territoriali con stand condiviso e materiale co-branded.', C.blue, C.bluePale],
  ];

  eventi.forEach(([t, d, c, bg]) => {
    if (y >= SB - 36) return;
    const ch = 38;
    doc.roundedRect(ML, y, CW, ch, 4).fill(bg);
    doc.rect(ML, y, 4, ch).fill(c);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(c);
    st(doc, t, ML + 12, y + 4, { width: CW - 22, lineBreak: false });
    doc.font('Helvetica').fontSize(8).fillColor(C.dark);
    st(doc, d, ML + 12, y + 16, { width: CW - 22, height: ch - 18, lineGap: 1 });
    y += ch + 3;
  });
  y += 6;

  y = sub(doc, y, 'Cosa Puo Fare il Partner durante un Evento');

  const partnerEventi = [
    'Allestire uno stand o un punto informativo con materiali propri',
    'Effettuare dimostrazioni pratiche, presentazioni o talk dedicati',
    'Distribuire campioni, brochure e materiale promozionale',
    'Raccogliere contatti e leads qualificati tra i partecipanti',
    'Offrire convenzioni esclusive e promozioni dedicate al personale',
    'Partecipare al momento conviviale per networking diretto',
    'Ottenere copertura fotografica e social dell\u2019evento',
  ];
  partnerEventi.forEach(t => { y = bullet(doc, ML + 4, y, t, 8.5); });
  y += 4;

  highlight(doc, ML, y, CW, 26, 'Ogni evento e un\u2019occasione di incontro diretto con 150+ professionisti del soccorso.', C.blueDeep);

  // ================================================================
  //  PAGE 9  —  IMPATTO SOCIALE E REPORTING
  // ================================================================
  doc.addPage({ size: 'A4', margin: ML });
  footer(doc, 9, TP);
  y = banner(doc, 'Impatto Sociale', 'Responsabilita Sociale e Reporting CSR/ESG');

  doc.font('Helvetica').fontSize(9.5).fillColor(C.dark);
  y = para(doc, 'Associare il proprio brand a Croce Europa significa molto piu di marketing. Significa sostenere un servizio essenziale per la comunita e poterlo dimostrare con dati concreti e verificabili. In un contesto dove la responsabilita sociale d\u2019impresa e sempre piu rilevante per clienti, investitori e stakeholder, la partnership con Croce Europa offre contenuti autentici per il vostro reporting CSR ed ESG.', ML, y, { lineGap: 1.5 });
  y += 8;

  y = sub(doc, y, 'Valore Reputazionale per il Partner');

  const repCards: [string, string, string, string][] = [
    ['Associazione a un Servizio Essenziale', 'Il vostro brand collegato a un\u2019attivita che salva vite e protegge la comunita ogni giorno. Un valore reputazionale unico e autentico.', C.blue, C.bluePale],
    ['Credibilita Territoriale', 'Partnership con un\u2019organizzazione radicata, conosciuta e riconosciuta dalla popolazione delle province di Verona e Vicenza.', C.green, C.greenLight],
    ['Contenuti CSR Autentici', 'Storie reali, dati verificabili e testimonianze concrete di impatto sociale da condividere con i vostri stakeholder, clienti e investitori.', C.blue, C.bluePale],
    ['Compliance ESG', 'Dati strutturati per i report ESG aziendali: impatto ambientale (CO2 risparmiata), sociale (pazienti trasportati) e governance (audit trail).', C.green, C.greenLight],
  ];

  repCards.forEach(([t, d, c, bg]) => {
    if (y >= SB - 36) return;
    const ch = 38;
    doc.roundedRect(ML, y, CW, ch, 4).fill(bg);
    doc.rect(ML, y, 4, ch).fill(c);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(c);
    st(doc, t, ML + 12, y + 4, { width: CW - 22, lineBreak: false });
    doc.font('Helvetica').fontSize(8).fillColor(C.dark);
    st(doc, d, ML + 12, y + 16, { width: CW - 22, height: ch - 18, lineGap: 1 });
    y += ch + 3;
  });
  y += 6;

  y = sub(doc, y, 'Metriche e Report Periodici');

  doc.font('Helvetica').fontSize(9).fillColor(C.dark);
  y = para(doc, 'Ogni partner riceve report periodici personalizzati con dati concreti e verificabili sull\u2019impatto della partnership:', ML, y, { lineGap: 1.5 });
  y += 4;

  doc.rect(ML, y, CW, 16).fill(C.blueDeep);
  doc.font('Helvetica-Bold').fontSize(7).fillColor(C.white);
  st(doc, 'METRICA', ML + 8, y + 4, { width: 140, lineBreak: false });
  st(doc, 'DESCRIZIONE', ML + 150, y + 4, { width: 220, lineBreak: false });
  st(doc, 'FREQUENZA', PW - ML - 70, y + 4, { width: 62, align: 'center', lineBreak: false });
  y += 16;

  const metrics: [string, string, string][] = [
    ['Km Percorsi', 'Chilometri della flotta con esposizione del brand partner', 'Mensile'],
    ['Servizi Effettuati', 'Numero di trasporti e interventi con visibilita operativa', 'Mensile'],
    ['Utilizzo Convenzioni', 'Personale che usufruisce dei servizi del partner', 'Trimestrale'],
    ['Partecipanti Eventi', 'Presenze a serate, open day e iniziative congiunte', 'Per evento'],
    ['Engagement Digitale', 'Visualizzazioni, click e interazioni su app e social', 'Mensile'],
    ['Soddisfazione (NPS)', 'Net Promoter Score del personale verso il partner', 'Semestrale'],
    ['Impatto Ambientale', 'CO2 risparmiata e impatto ESG della partnership', 'Annuale'],
  ];

  metrics.forEach(([n, d, f], i) => {
    const rh = 16;
    doc.rect(ML, y, CW, rh).fill(i % 2 === 0 ? C.white : C.lightBg);
    doc.rect(ML, y, CW, rh).lineWidth(0.3).strokeColor(C.grayLight).stroke();
    doc.font('Helvetica-Bold').fontSize(7).fillColor(C.dark);
    st(doc, n, ML + 8, y + 4, { width: 138, lineBreak: false });
    doc.font('Helvetica').fontSize(6.5).fillColor(C.gray);
    st(doc, d, ML + 150, y + 4, { width: 215, lineBreak: false });
    doc.font('Helvetica').fontSize(6.5).fillColor(C.blue);
    st(doc, f, PW - ML - 70, y + 4, { width: 62, align: 'center', lineBreak: false });
    y += rh;
  });
  y += 6;

  doc.roundedRect(ML, y, CW, 32, 4).fill(C.greenLight);
  doc.rect(ML, y, 4, 32).fill(C.green);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.green);
  st(doc, 'Report Annuale Personalizzato', ML + 12, y + 4, { width: CW - 22, lineBreak: false });
  doc.font('Helvetica').fontSize(8).fillColor(C.dark);
  st(doc, 'Ogni partner riceve un report annuale completo con dati quantitativi, documentazione fotografica, testimonianze e proposta di sviluppo per l\u2019anno successivo.', ML + 12, y + 16, { width: CW - 22, lineBreak: false });

  // ================================================================
  //  PAGE 10  —  SETTORI + PROCESSO + CONTATTI
  // ================================================================
  doc.addPage({ size: 'A4', margin: ML });
  footer(doc, 10, TP);
  y = banner(doc, 'Settori e Contatti', 'Iniziamo Insieme');

  doc.font('Helvetica-Bold').fontSize(11).fillColor(C.blue);
  st(doc, 'Settori Ideali per la Partnership', ML, y, { width: CW, lineBreak: false });
  y += 16;

  const secs = [
    { t: 'Assicurazioni e Finanza', c: C.blue, items: ['Polizze vita e salute', 'Fondi sanitari', 'Consulenza previdenziale'] },
    { t: 'Salute e Benessere', c: C.green, items: ['Cliniche e poliambulatori', 'Farmacie', 'Centri fisioterapici'] },
    { t: 'Automotive e Mobilita', c: C.blue, items: ['Concessionari e noleggio', 'Officine e carrozzerie', 'Carburanti e ricarica EV'] },
    { t: 'Servizi Professionali', c: C.green, items: ['Studi legali e notarili', 'Commercialisti', 'IT e telecomunicazioni'] },
    { t: 'Formazione e Sicurezza', c: C.blue, items: ['Enti di formazione', 'Sicurezza sul lavoro', 'DPI e attrezzature'] },
    { t: 'Food, Retail e Lifestyle', c: C.green, items: ['Ristorazione e catering', 'Palestre e sport', 'Abbigliamento tecnico'] },
  ];

  const sW = (CW - 10) / 3, sH = 62;
  secs.forEach((s, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const sx = ML + col * (sW + 5), sy = y + row * (sH + 4);
    doc.roundedRect(sx, sy, sW, sH, 3).lineWidth(0.5).strokeColor(C.grayLight).stroke();
    doc.rect(sx, sy, 3, sH).fill(s.c);
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(s.c);
    st(doc, s.t, sx + 9, sy + 5, { width: sW - 16, lineBreak: false });
    let iy = sy + 17;
    s.items.forEach(it => {
      doc.circle(sx + 12, iy + 3, 1.2).fill(s.c);
      doc.font('Helvetica').fontSize(7).fillColor(C.dark);
      st(doc, it, sx + 18, iy, { width: sW - 26, lineBreak: false });
      iy += 11;
    });
  });
  y += (sH + 4) * 2 + 8;

  y = sub(doc, y, 'Come Funziona');

  const steps: [string, string][] = [
    ['1. Primo Contatto', 'Incontro conoscitivo per comprendere obiettivi, esigenze e potenzialita della collaborazione.'],
    ['2. Proposta Personalizzata', 'Definizione congiunta delle modalita, dei canali e delle iniziative della partnership.'],
    ['3. Attivazione', 'Integrazione del brand nei canali concordati, avvio della collaborazione operativa.'],
    ['4. Monitoraggio', 'Report periodici, feedback continuo, ottimizzazione e sviluppo della partnership.'],
  ];

  steps.forEach(([t, d], i) => {
    if (y >= SB - 28) return;
    const ch = 28;
    doc.roundedRect(ML, y, CW, ch, 3).fill(i % 2 === 0 ? C.bluePale : C.greenLight);
    doc.rect(ML, y, 4, ch).fill(i % 2 === 0 ? C.blue : C.green);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(i % 2 === 0 ? C.blue : C.green);
    st(doc, t, ML + 12, y + 3, { width: 140, lineBreak: false });
    doc.font('Helvetica').fontSize(8).fillColor(C.dark);
    st(doc, d, ML + 150, y + 5, { width: CW - 160, lineBreak: false });
    y += ch + 3;
  });
  y += 4;

  doc.roundedRect(ML, y, CW, 34, 4).fill(C.goldLight);
  doc.rect(ML, y, 4, 34).fill(C.gold);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.goldDark);
  st(doc, 'Partnership Selezionate', ML + 12, y + 4, { width: CW - 22, lineBreak: false });
  doc.font('Helvetica').fontSize(8).fillColor(C.dark);
  st(doc, 'Le partnership vengono valutate per coerenza strategica, settore di riferimento e valori condivisi. Le collaborazioni vengono costruite, non vendute.', ML + 12, y + 17, { width: CW - 22, lineBreak: false });
  y += 42;

  doc.roundedRect(ML, y, CW, 80, 6).fill(C.blueDeep);
  doc.font('Helvetica-Bold').fontSize(15).fillColor(C.white);
  st(doc, 'Diventa Partner di Croce Europa', ML + 12, y + 10, { width: CW - 24, align: 'center', lineBreak: false });
  doc.font('Helvetica').fontSize(9.5).fillColor(C.white);
  st(doc, 'Per avviare un confronto riservato e scoprire come possiamo crescere insieme:', ML + 12, y + 32, { width: CW - 24, align: 'center', lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(13).fillColor(C.white);
  st(doc, 'partnership@croceeuropa.it', ML + 12, y + 52, { width: CW - 24, align: 'center', lineBreak: false });
  y += 90;

  // ================================================================
  //  PAGE 11  —  BACK COVER (Quarta di Copertina)
  // ================================================================
  doc.addPage({ size: 'A4', margin: 0 });

  doc.rect(0, 0, PW, PH).fill(C.blueDeep);

  doc.save();
  doc.circle(PW + 100, PH * 0.15, 300).fillOpacity(0.03).fill(C.white);
  doc.circle(-120, PH * 0.7, 350).fillOpacity(0.03).fill(C.white);
  doc.circle(PW * 0.5, PH + 100, 250).fillOpacity(0.02).fill(C.white);
  doc.restore();

  let by = 180;

  doc.save();
  doc.roundedRect(PW / 2 - 52, by, 104, 104, 52).fillOpacity(0.12).fill(C.white);
  doc.fillOpacity(1);
  doc.font('Helvetica-Bold').fontSize(46).fillColor(C.white);
  st(doc, 'CE', PW / 2 - 52, by + 26, { width: 104, align: 'center', lineBreak: false });
  doc.restore();
  by += 120;

  doc.font('Helvetica-Bold').fontSize(18).fillColor(C.white);
  st(doc, 'CROCE EUROPA', 0, by, { width: PW, align: 'center', lineBreak: false });
  by += 22;
  doc.font('Helvetica').fontSize(10).fillOpacity(0.7).fillColor(C.white);
  st(doc, 'SRL IMPRESA SOCIALE', 0, by, { width: PW, align: 'center', lineBreak: false });
  doc.fillOpacity(1);
  by += 30;

  doc.moveTo(PW / 2 - 30, by).lineTo(PW / 2 + 30, by).lineWidth(0.8).strokeOpacity(0.25).strokeColor(C.white).stroke();
  doc.strokeOpacity(1);
  by += 18;

  doc.font('Helvetica').fontSize(9).fillOpacity(0.6).fillColor(C.white);
  st(doc, 'Servizi di Trasporto Sanitario', 0, by, { width: PW, align: 'center', lineBreak: false });
  by += 14;
  st(doc, 'Province di Verona e Vicenza', 0, by, { width: PW, align: 'center', lineBreak: false });
  doc.fillOpacity(1);
  by += 36;

  doc.roundedRect(PW / 2 - 130, by, 260, 1, 0).fillOpacity(0.1).fill(C.white);
  doc.fillOpacity(1);
  by += 16;

  const contactItems: [string, string][] = [
    ['Email Partnership', 'partnership@croceeuropa.it'],
    ['Telefono', '+39 045 XXX XXXX'],
    ['Sito Web', 'www.croceeuropa.it'],
    ['PEC', 'croceeuropa@pec.it'],
  ];

  contactItems.forEach(([label, value]) => {
    doc.font('Helvetica').fontSize(7.5).fillOpacity(0.45).fillColor(C.white);
    st(doc, label.toUpperCase(), 0, by, { width: PW, align: 'center', lineBreak: false });
    doc.fillOpacity(1);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(C.white);
    st(doc, value, 0, by + 11, { width: PW, align: 'center', lineBreak: false });
    by += 30;
  });

  by += 10;
  doc.roundedRect(PW / 2 - 130, by, 260, 1, 0).fillOpacity(0.1).fill(C.white);
  doc.fillOpacity(1);
  by += 16;

  doc.font('Helvetica').fontSize(8).fillOpacity(0.5).fillColor(C.white);
  st(doc, 'Operativi 24/7  |  365 giorni all\u2019anno', 0, by, { width: PW, align: 'center', lineBreak: false });
  doc.fillOpacity(1);

  if (hasLogo) {
    try { doc.image(logoPath, PW / 2 - 30, PH - 80, { width: 60 }); } catch (_) {}
  }

  doc.font('Helvetica').fontSize(6).fillOpacity(0.3).fillColor(C.white);
  st(doc, `${today}  |  Documento Riservato  |  Tutti i diritti riservati`, 0, PH - 22, { width: PW, align: 'center', lineBreak: false });
  doc.fillOpacity(1);

  doc.end();
}
