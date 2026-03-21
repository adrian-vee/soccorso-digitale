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
const TP = 14;

function st(doc: PDFKit.PDFDocument, text: string, x: number, y: number, opts: any = {}) {
  doc.text(text, x, y, { ...opts, height: Math.max(SB - y, 10) });
}

function footer(doc: PDFKit.PDFDocument, pn: number) {
  doc.save();
  doc.rect(0, PH - 24, PW, 24).fill(C.blueDeep);
  doc.font('Helvetica').fontSize(6.5).fillColor(C.white);
  st(doc, 'CROCE EUROPA SRL  |  Guida di Attivazione Partnership 2026  |  Documento Riservato', ML, PH - 16, { width: CW - 50, lineBreak: false });
  st(doc, `${pn} / ${TP}`, PW - ML - 30, PH - 16, { width: 30, align: 'right', lineBreak: false });
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

function bullet(doc: PDFKit.PDFDocument, x: number, y: number, text: string, fs: number = 10, col: string = C.green): number {
  if (y >= SB - 8) return y;
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
  st(doc, desc, x + 12, y + 18, { width: w - 20, height: h - 22, lineGap: 1 });
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

export function generatePartnershipActivationGuidePDF(res: Response) {
  const doc = new PDFDocument({ size: 'A4', margin: ML, autoFirstPage: false, info: {
    Title: 'Guida di Attivazione Partnership 2026 - Croce Europa SRL',
    Author: 'Croce Europa SRL Impresa Sociale',
    Subject: 'Guida Operativa per Partner',
    Creator: 'Croce Europa SRL'
  }});
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="Croce_Europa_Guida_Attivazione_Partnership_2026.pdf"');
  doc.pipe(res);

  const today = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
  const logoPath = path.join(process.cwd(), 'attached_assets', 'Logo-Croce-Europa-Ufficiale_1766252701803.png');
  const hasLogo = fs.existsSync(logoPath);
  const pfsLogoPath = path.join(process.cwd(), 'attached_assets', 'PFS-Leader-Badge-Full-Negative-01_1770738462449.png');
  const hasPfsLogo = fs.existsSync(pfsLogoPath);
  const hw = (CW - 8) / 2;

  // ================================================================
  //  PAGE 1  —  COVER
  // ================================================================
  doc.addPage({ size: 'A4', margin: 0 });

  doc.rect(0, 0, PW, PH * 0.65).fill(C.blueDeep);
  doc.rect(0, PH * 0.65, PW, PH * 0.35).fill(C.blue);

  doc.save();
  doc.circle(PW + 60, 80, 220).fillOpacity(0.03).fill(C.white);
  doc.circle(-80, PH * 0.55, 260).fillOpacity(0.03).fill(C.white);
  doc.circle(PW * 0.7, PH + 60, 200).fillOpacity(0.02).fill(C.white);
  doc.restore();

  let cy = 70;
  doc.save();
  doc.roundedRect(PW / 2 - 44, cy, 88, 88, 44).fillOpacity(0.15).fill(C.white);
  doc.fillOpacity(1);
  doc.font('Helvetica-Bold').fontSize(38).fillColor(C.white);
  st(doc, 'CE', PW / 2 - 44, cy + 22, { width: 88, align: 'center', lineBreak: false });
  doc.restore();
  cy = 176;

  doc.font('Helvetica-Bold').fontSize(12).fillColor(C.white);
  st(doc, 'CROCE EUROPA SRL IMPRESA SOCIALE', 0, cy, { width: PW, align: 'center', lineBreak: false });
  cy += 16;
  doc.font('Helvetica').fontSize(8.5).fillOpacity(0.7).fillColor(C.white);
  st(doc, 'SERVIZI DI TRASPORTO SANITARIO  |  VERONA & VICENZA', 0, cy, { width: PW, align: 'center', lineBreak: false });
  doc.fillOpacity(1);
  cy += 26;

  doc.moveTo(PW / 2 - 35, cy).lineTo(PW / 2 + 35, cy).lineWidth(1).strokeOpacity(0.3).strokeColor(C.white).stroke();
  doc.strokeOpacity(1);
  cy += 14;

  doc.font('Helvetica-Bold').fontSize(30).fillColor(C.white);
  st(doc, 'Guida di Attivazione', 0, cy, { width: PW, align: 'center', lineBreak: false });
  cy += 36;
  doc.font('Helvetica-Bold').fontSize(30).fillColor(C.white);
  st(doc, 'Partnership', 0, cy, { width: PW, align: 'center', lineBreak: false });
  cy += 42;

  doc.font('Helvetica').fontSize(11).fillOpacity(0.85).fillColor(C.white);
  st(doc, 'Programma di Collaborazione Strategica 2026', 0, cy, { width: PW, align: 'center', lineBreak: false });
  cy += 15;
  st(doc, 'Aree, Pacchetti e Processo di Attivazione', 0, cy, { width: PW, align: 'center', lineBreak: false });
  doc.fillOpacity(1);
  cy += 34;

  doc.roundedRect(PW / 2 - 85, cy, 170, 24, 12).fillOpacity(0.18).fill(C.white);
  doc.fillOpacity(1);
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.white);
  st(doc, 'DOCUMENTO RISERVATO', 0, cy + 7, { width: PW, align: 'center', lineBreak: false });
  cy += 40;

  const kw = 82, kg = 10;
  const kx0 = (PW - kw * 6 - kg * 5) / 2;
  const coverKpis: [string, string][] = [['150+', 'Persone'], ['20+', 'Ambulanze'], ['5', 'Sedi'], ['10.000+', 'Servizi/Anno'], ['1M+', 'Km/Anno'], ['24/7', 'Operativita']];
  coverKpis.forEach((s, i) => {
    const sx = kx0 + i * (kw + kg);
    doc.roundedRect(sx, cy, kw, 46, 4).fillOpacity(0.12).fill(C.white);
    doc.fillOpacity(1);
    doc.font('Helvetica-Bold').fontSize(16).fillColor(C.white);
    st(doc, s[0], sx, cy + 5, { width: kw, align: 'center', lineBreak: false });
    doc.font('Helvetica').fontSize(6).fillOpacity(0.8).fillColor(C.white);
    st(doc, s[1].toUpperCase(), sx, cy + 28, { width: kw, align: 'center', lineBreak: false });
    doc.fillOpacity(1);
  });
  cy += 64;

  doc.font('Helvetica').fontSize(8.5).fillOpacity(0.5).fillColor(C.white);
  st(doc, 'Province di Verona e Vicenza  |  Operativi 24/7, 365 giorni all\'anno', 0, cy, { width: PW, align: 'center', lineBreak: false });
  doc.fillOpacity(1);

  if (hasLogo) {
    try { doc.image(logoPath, PW / 2 - 28, PH - 70, { width: 56 }); } catch (_) {}
  }
  doc.font('Helvetica').fontSize(7).fillOpacity(0.3).fillColor(C.white);
  st(doc, today, 0, PH - 16, { width: PW, align: 'center', lineBreak: false });
  doc.fillOpacity(1);

  // ================================================================
  //  PAGE 2  —  INDICE + INTRODUZIONE
  // ================================================================
  doc.addPage({ size: 'A4', margin: ML });
  footer(doc, 2);
  let y = banner(doc, 'Indice dei Contenuti', 'Sommario della Guida');

  const tocItems: [string, string, number][] = [
    ['01', 'Introduzione e Chi Siamo', 2],
    ['02', 'Valori Condivisi e Responsabilita Sociale', 3],
    ['03', 'Aree di Collaborazione', 4],
    ['04', 'Pacchetti di Partnership', 5],
    ['05', 'Co-Branding e Visibilita Fisica', 7],
    ['06', 'Visibilita Digitale', 8],
    ['07', 'Formazione e Centro Accreditato', 9],
    ['08', 'Test Prodotti e Benefit Interni', 10],
    ['09', 'Eventi e Networking', 11],
    ['10', 'Processo di Attivazione', 12],
    ['11', 'Contatti e Prossimi Passi', 13],
  ];

  tocItems.forEach(([num, title, pg], i) => {
    const rh = 22;
    doc.roundedRect(ML, y, CW, rh, 3).fill(i % 2 === 0 ? C.white : C.lightBg);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(C.blue);
    st(doc, num, ML + 8, y + 4, { width: 24, lineBreak: false });
    doc.font('Helvetica').fontSize(10).fillColor(C.dark);
    st(doc, title, ML + 36, y + 5, { width: CW - 80, lineBreak: false });
    doc.font('Helvetica').fontSize(9).fillColor(C.grayMed);
    st(doc, `pag. ${pg}`, PW - ML - 45, y + 5, { width: 40, align: 'right', lineBreak: false });
    y += rh + 1;
  });
  y += 10;

  doc.moveTo(ML, y).lineTo(PW - ML, y).lineWidth(0.5).strokeColor(C.grayLight).stroke();
  y += 10;

  y = sub(doc, y, 'Introduzione');

  doc.font('Helvetica').fontSize(10).fillColor(C.dark);
  y = para(doc, 'Croce Europa SRL Impresa Sociale e una delle realta piu strutturate e tecnologicamente avanzate nel trasporto sanitario del Nord-Est Italia. Operiamo nelle province di Verona e Vicenza in modo continuativo 24/7, 365 giorni l\'anno, garantendo servizi di emergenza 118, trasporti sanitari programmati, assistenza a eventi e formazione sanitaria accreditata.', ML, y, { lineGap: 1.5 });
  y += 4;
  y = para(doc, 'Il Programma di Partnership 2026 presentato in questa guida e pensato per aziende di ogni dimensione, dalle PMI locali alle realta innovative, che desiderano costruire una collaborazione strategica, misurabile e ad alto impatto sociale. L\'obiettivo e creare partnership di valore reciproco, integrando il vostro brand nell\'operativita quotidiana dell\'organizzazione e nella comunita che serviamo.', ML, y, { lineGap: 1.5 });
  y += 6;

  const bw6 = (CW - 25) / 6, bh = 40;
  const kpiData: [string, string, string][] = [['150+', 'Professionisti', C.blue], ['20+', 'Ambulanze', C.green], ['5', 'Sedi', C.blue], ['10.000+', 'Servizi/Anno', C.green], ['1M+', 'Km/Anno', C.blue], ['24/7', 'Operativita', C.green]];
  kpiData.forEach(([v, l, c], i) => { kpi(doc, ML + i * (bw6 + 5), y, bw6, bh, v, l, c); });
  y += bh + 6;

  highlight(doc, ML, y, CW, 24, 'Con oltre 150 professionisti e 20+ ambulanze, rappresentiamo un punto di riferimento per il soccorso sanitario territoriale.', C.blueDeep);

  // ================================================================
  //  PAGE 3  —  VALORI CONDIVISI
  // ================================================================
  doc.addPage({ size: 'A4', margin: ML });
  footer(doc, 3);
  y = banner(doc, 'Capitolo 01', 'Valori Condivisi e Responsabilita Sociale', C.green);

  doc.font('Helvetica').fontSize(10).fillColor(C.dark);
  y = para(doc, 'Diventare partner di Croce Europa non e una sponsorizzazione occasionale, ma una collaborazione strategica fondata su valori condivisi e obiettivi comuni. Crediamo in partnership costruite sulla fiducia, sulla trasparenza e sull\'impegno concreto verso il benessere della comunita. Per questo, selezioniamo i partner in base alla coerenza strategica, al settore di riferimento e ai valori che condividiamo: ogni collaborazione viene costruita, non venduta come un semplice spazio pubblicitario.', ML, y, { lineGap: 1.5 });
  y += 6;

  y = sub(doc, y, 'Perche il Vostro Brand con Noi');

  doc.font('Helvetica').fontSize(10).fillColor(C.dark);
  y = para(doc, 'I nostri partner affiancano un servizio essenziale che salva vite ogni giorno, associando il proprio brand a un\'attivita di alto valore etico e sociale. In cambio offriamo un coinvolgimento autentico nelle nostre attivita e la possibilita di misurare l\'impatto generato.', ML, y, { lineGap: 1.5 });
  y += 6;

  const valCards: [string, string, string, string][] = [
    ['Impatto CSR Misurabile', 'La partnership con Croce Europa permette al partner di dimostrare il proprio impegno di Responsabilita Sociale d\'Impresa con dati concreti e verificabili. Report periodici con metriche quantitative, documentazione fotografica e testimonianze.', C.blue, C.bluePale],
    ['Valore Reputazionale Unico', 'In un contesto in cui la responsabilita sociale e sempre piu rilevante per clienti e stakeholder, unire il proprio nome a Croce Europa significa condividere la missione di aiutare la comunita, ottenendo un valore reputazionale positivo e duraturo.', C.green, C.greenLight],
    ['Associazione Etica Positiva', 'Il vostro brand collegato a un\'attivita che salva vite e protegge la comunita. Le ambulanze attirano naturalmente l\'attenzione del pubblico e generano un\'associazione positiva e immediata con il partner.', C.blue, C.bluePale],
    ['Credibilita sul Territorio', 'Partnership con un\'organizzazione radicata, conosciuta e riconosciuta dalla popolazione delle province di Verona e Vicenza. Oltre 150 professionisti che vivono e lavorano nel vostro stesso territorio.', C.green, C.greenLight],
  ];

  valCards.forEach(([t, d, c, bg]) => {
    const ch = 48;
    doc.roundedRect(ML, y, CW, ch, 4).fill(bg);
    doc.rect(ML, y, 4, ch).fill(c);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(c);
    st(doc, t, ML + 12, y + 5, { width: CW - 22, lineBreak: false });
    doc.font('Helvetica').fontSize(8).fillColor(C.dark);
    st(doc, d, ML + 12, y + 18, { width: CW - 22, height: ch - 22, lineGap: 1 });
    y += ch + 3;
  });
  y += 4;

  y = sub(doc, y, 'La Nostra Filosofia di Partnership');

  const philItems = [
    'Selezione basata su coerenza strategica, settore e valori condivisi',
    'Costruzione collaborativa: ogni partnership e progettata insieme, non imposta',
    'Trasparenza totale: report periodici, dati verificabili, feedback continuo',
    'Esclusivita di settore disponibile per i partner strategici',
    'Relazione a lungo termine: le migliori partnership crescono nel tempo',
    'Nessuna logica pubblicitaria: costruiamo progetti di valore, non vendiamo spazi',
    'Impegno reciproco: contributo attivo alla missione e alla comunita',
    'Compliance normativa: ogni co-branding rispetta le regolamentazioni vigenti',
  ];
  philItems.forEach(t => { y = bullet(doc, ML + 4, y, t, 10); });
  y += 4;

  highlight(doc, ML, y, CW, 24, 'Non vendiamo spazi pubblicitari. Costruiamo insieme ai partner progetti di valore.', C.greenDark);

  // ================================================================
  //  PAGE 4  —  AREE DI COLLABORAZIONE (Panoramica)
  // ================================================================
  doc.addPage({ size: 'A4', margin: ML });
  footer(doc, 4);
  y = banner(doc, 'Capitolo 02', 'Aree di Collaborazione');

  doc.font('Helvetica').fontSize(10).fillColor(C.dark);
  y = para(doc, 'Le partnership con Croce Europa si sviluppano su diverse aree di collaborazione, attivabili in modo flessibile secondo le esigenze del partner. Insieme, possiamo creare un piano su misura attingendo a una o piu delle seguenti aree:', ML, y, { lineGap: 1.5 });
  y += 8;

  const areas: [string, string, string, string][] = [
    ['Co-Branding e Visibilita', 'Integrazione del marchio del partner nei nostri mezzi e nelle attivita operative quotidiane: ambulanze, divise, eventi sul territorio. Il brand del partner viaggia con noi ogni giorno, raggiungendo luoghi ad alto traffico e contesti di grande attenzione pubblica. Visibilita garantita su oltre 1.000.000 km/anno di percorrenza.', C.blue, C.bluePale],
    ['Visibilita Digitale', 'Presenza del partner sui canali digitali proprietari di Croce Europa: sito web istituzionale, app mobile interna (utilizzata quotidianamente da 40+ operatori), canali social media e newsletter. Comunicazione attraverso media verificati e diretti, raggiungendo il nostro pubblico fidelizzato con messaggi mirati.', C.green, C.greenLight],
    ['Formazione', 'Collaborazione nel nostro Centro di Formazione accreditato. Visibilita sui materiali didattici e sulle certificazioni rilasciate. Co-organizzazione di corsi, workshop o eventi formativi su temi di interesse comune come sicurezza e primo soccorso. Associazione del brand a iniziative educative di alto valore.', C.blue, C.bluePale],
    ['Test Prodotti', 'Opportunita di far provare e testare prodotti o servizi innovativi del partner in un contesto operativo reale. Croce Europa diventa un laboratorio vivente dove validare soluzioni (attrezzature medicali, tecnologie, veicoli) fornendo feedback qualificati e dati di utilizzo concreti.', C.green, C.greenLight],
    ['Benefit Interni', 'Attivazione di convenzioni e agevolazioni riservate al personale di Croce Europa. Il partner offre condizioni vantaggiose su prodotti e servizi ai nostri 150+ operatori, incrementando la soddisfazione interna e creando nuove opportunita di business diretto con un pubblico qualificato e fidelizzato.', C.blue, C.bluePale],
    ['Eventi e Networking', 'Partecipazione congiunta a eventi pubblici, open day, fiere di settore e momenti di incontro con la cittadinanza e il nostro staff. Serate informative, giornate porte aperte, esercitazioni e iniziative dove i partner interagiscono direttamente con il personale e la comunita del territorio.', C.green, C.greenLight],
  ];

  areas.forEach(([t, d, c, bg]) => {
    if (y >= SB - 50) return;
    const ch = 52;
    doc.roundedRect(ML, y, CW, ch, 4).fill(bg);
    doc.rect(ML, y, 4, ch).fill(c);
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(c);
    st(doc, t, ML + 12, y + 5, { width: CW - 22, lineBreak: false });
    doc.font('Helvetica').fontSize(8).fillColor(C.dark);
    st(doc, d, ML + 12, y + 18, { width: CW - 22, height: ch - 22, lineGap: 1 });
    y += ch + 3;
  });
  y += 2;

  highlight(doc, ML, y, CW, 24, '6 aree di collaborazione attivabili in modo flessibile e personalizzato per ogni partner.', C.blueDeep);

  // ================================================================
  //  PAGE 5  —  PACCHETTO STANDARD + PREMIUM
  // ================================================================
  doc.addPage({ size: 'A4', margin: ML });
  footer(doc, 5);
  y = banner(doc, 'Capitolo 03', 'Pacchetti di Partnership', C.green);

  doc.font('Helvetica').fontSize(10).fillColor(C.dark);
  y = para(doc, 'Per venire incontro alle diverse realta aziendali, Croce Europa propone pacchetti di partnership differenziati, caratterizzati da livelli crescenti di coinvolgimento e visibilita. Ogni pacchetto include un mix delle aree di collaborazione, modulato sulle possibilita e sugli obiettivi del partner.', ML, y, { lineGap: 1.5 });
  y += 10;

  // STANDARD
  doc.roundedRect(ML, y, CW, 260, 6).lineWidth(1).strokeColor(C.blue).stroke();
  doc.rect(ML, y, CW, 28).fill(C.blue);
  doc.font('Helvetica-Bold').fontSize(14).fillColor(C.white);
  st(doc, 'Pacchetto Standard', ML + 14, y + 6, { width: CW - 28, lineBreak: false });
  doc.font('Helvetica').fontSize(8.5).fillOpacity(0.8).fillColor(C.white);
  st(doc, 'Per PMI e attivita locali', PW - ML - 160, y + 9, { width: 146, align: 'right', lineBreak: false });
  doc.fillOpacity(1);
  let sy = y + 34;

  doc.font('Helvetica').fontSize(10).fillColor(C.dark);
  sy = para(doc, 'Dedicato a PMI e attivita locali che desiderano sostenere Croce Europa ottenendo una visibilita di base e un legame autentico con il territorio.', ML + 12, sy, { width: CW - 24, lineGap: 1.5 });
  sy += 6;

  const stdItems = [
    'Logo e nome del partner sul sito web istituzionale (sezione partner)',
    'Presenza nell\'app mobile interna (elenco convenzioni per il personale)',
    'Menzione nelle comunicazioni ufficiali e newsletter interne',
    'Convenzioni per il personale: sconti o offerte dedicate ai 150+ operatori',
    'Materiale informativo del partner distribuito nelle sedi operative',
    'Invito a eventi aperti organizzati da Croce Europa',
    'Report semestrale con metriche di base sulla partnership',
    'Attestato ufficiale di partnership con Croce Europa',
    'Canale di comunicazione diretto con il team partnership',
  ];
  stdItems.forEach(t => {
    sy = bullet(doc, ML + 12, sy, t, 10, C.blue);
  });

  y += 264;

  // PREMIUM
  doc.roundedRect(ML, y, CW, 282, 6).lineWidth(1).strokeColor(C.green).stroke();
  doc.rect(ML, y, CW, 28).fill(C.green);
  doc.font('Helvetica-Bold').fontSize(14).fillColor(C.white);
  st(doc, 'Pacchetto Premium', ML + 14, y + 6, { width: CW - 28, lineBreak: false });
  doc.font('Helvetica').fontSize(8.5).fillOpacity(0.8).fillColor(C.white);
  st(doc, 'Per aziende con presenza piu ampia', PW - ML - 200, y + 9, { width: 186, align: 'right', lineBreak: false });
  doc.fillOpacity(1);
  sy = y + 34;

  doc.font('Helvetica').fontSize(10).fillColor(C.dark);
  sy = para(doc, 'Pensato per aziende che mirano a una presenza piu ampia e attiva, con co-branding esteso sui principali asset operativi e partecipazione diretta alle attivita.', ML + 12, sy, { width: CW - 24, lineGap: 1.5 });
  sy += 6;

  const premItems = [
    'Tutti i benefit del pacchetto Standard inclusi',
    'Logo del partner sulle ambulanze operative (visibilita 24/7, 1M+ km/anno)',
    'Logo sulle divise del personale operativo (150+ persone)',
    'Visibilita garantita per almeno 12 mesi continuativi',
    'Manutenzione dell\'immagine: pulizia regolare dei mezzi per decoro del logo',
    'Post dedicati sui canali social di Croce Europa (Facebook, Instagram, LinkedIn)',
    'Co-organizzazione di almeno un evento o serata durante l\'anno',
    'Partecipazione come relatore o sponsor a corsi di formazione',
    'Report trimestrale dettagliato con metriche di visibilita e engagement',
    'Referente dedicato per la gestione della partnership',
  ];
  premItems.forEach(t => {
    sy = bullet(doc, ML + 12, sy, t, 10, C.green);
  });

  // ================================================================
  //  PAGE 6  —  PACCHETTO ELITE + CONFRONTO
  // ================================================================
  doc.addPage({ size: 'A4', margin: ML });
  footer(doc, 6);
  y = banner(doc, 'Capitolo 03 (continua)', 'Partnership Strategica Elite');

  // ELITE
  doc.roundedRect(ML, y, CW, 270, 6).lineWidth(1.5).strokeColor(C.gold).stroke();
  doc.rect(ML, y, CW, 30).fill(C.gold);
  doc.font('Helvetica-Bold').fontSize(14).fillColor(C.white);
  st(doc, 'Partnership Strategica (Elite)', ML + 14, y + 7, { width: CW - 28, lineBreak: false });
  doc.font('Helvetica').fontSize(8.5).fillOpacity(0.9).fillColor(C.white);
  st(doc, 'Collaborazione esclusiva e personalizzata', PW - ML - 230, y + 10, { width: 216, align: 'right', lineBreak: false });
  doc.fillOpacity(1);
  sy = y + 36;

  doc.font('Helvetica').fontSize(10).fillColor(C.dark);
  sy = para(doc, 'Soluzioni tailor-made per partner di livello superiore che desiderano una collaborazione esclusiva e altamente personalizzata. Questo livello include tutti i vantaggi del Premium con ulteriori opportunita disegnate su misura.', ML + 12, sy, { width: CW - 24, lineGap: 1.5 });
  sy += 6;

  const eliteItems = [
    'Tutti i benefit del pacchetto Premium inclusi',
    'Esclusiva di settore: un solo partner principale per ciascun settore merceologico',
    'Progetti speciali co-branded: campagne di sensibilizzazione congiunte',
    'Visibilita dominante in eventi e iniziative congiunte',
    'Test e validazione prodotti nel contesto operativo reale',
    'Co-progettazione di iniziative a impatto sociale con brand congiunto',
    'Dimensioni logo aumentabili fino a +5 cm sulle ambulanze',
    'Accesso prioritario a nuove opportunita e iniziative dell\'organizzazione',
    'Report mensile personalizzato con analytics avanzati',
    'Incontri strategici trimestrali con la direzione di Croce Europa',
    'Possibilita di partecipare a bandi e progetti congiunti',
    'Comunicati stampa congiunti per iniziative di rilievo',
  ];
  eliteItems.forEach(t => {
    sy = bullet(doc, ML + 12, sy, t, 10, C.gold);
  });

  y += 276;

  // Confronto tabella
  y = sub(doc, y, 'Confronto Rapido dei Pacchetti');

  doc.rect(ML, y, CW, 18).fill(C.blueDeep);
  const colW = [180, (CW - 180) / 3, (CW - 180) / 3, (CW - 180) / 3];
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.white);
  st(doc, 'AREA', ML + 6, y + 4, { width: colW[0] - 10, lineBreak: false });
  st(doc, 'STANDARD', ML + colW[0], y + 4, { width: colW[1], align: 'center', lineBreak: false });
  st(doc, 'PREMIUM', ML + colW[0] + colW[1], y + 4, { width: colW[2], align: 'center', lineBreak: false });
  st(doc, 'ELITE', ML + colW[0] + colW[1] + colW[2], y + 4, { width: colW[3], align: 'center', lineBreak: false });
  y += 18;

  const compRows: [string, string, string, string][] = [
    ['Sito web e app mobile', 'Si', 'Si', 'Si'],
    ['Newsletter e comunicazioni', 'Si', 'Si', 'Si'],
    ['Convenzioni personale', 'Si', 'Si', 'Si'],
    ['Logo su ambulanze', '—', 'Si', 'Si'],
    ['Logo su divise', '—', 'Si', 'Si'],
    ['Social media dedicati', '—', 'Si', 'Si'],
    ['Co-organizzazione eventi', '—', 'Si', 'Si'],
    ['Esclusiva di settore', '—', '—', 'Si'],
    ['Test prodotti', '—', '—', 'Si'],
    ['Progetti speciali co-branded', '—', '—', 'Si'],
    ['Referente dedicato', '—', 'Si', 'Si'],
    ['Report', 'Semestrale', 'Trimestrale', 'Mensile'],
  ];

  compRows.forEach(([area, s, p, e], i) => {
    const rh = 14;
    doc.rect(ML, y, CW, rh).fill(i % 2 === 0 ? C.white : C.lightBg);
    doc.rect(ML, y, CW, rh).lineWidth(0.2).strokeColor(C.grayLight).stroke();
    doc.font('Helvetica').fontSize(7).fillColor(C.dark);
    st(doc, area, ML + 6, y + 3, { width: colW[0] - 10, lineBreak: false });
    doc.font('Helvetica').fontSize(7).fillColor(s === 'Si' ? C.green : C.grayMed);
    st(doc, s, ML + colW[0], y + 3, { width: colW[1], align: 'center', lineBreak: false });
    doc.fillColor(p === 'Si' ? C.green : (p === '—' ? C.grayMed : C.blue));
    st(doc, p, ML + colW[0] + colW[1], y + 3, { width: colW[2], align: 'center', lineBreak: false });
    doc.fillColor(e === 'Si' ? C.green : (e === '—' ? C.grayMed : C.gold));
    st(doc, e, ML + colW[0] + colW[1] + colW[2], y + 3, { width: colW[3], align: 'center', lineBreak: false });
    y += rh;
  });

  // ================================================================
  //  PAGE 7  —  CO-BRANDING E VISIBILITA FISICA
  // ================================================================
  doc.addPage({ size: 'A4', margin: ML });
  footer(doc, 7);
  y = banner(doc, 'Capitolo 04', 'Co-Branding e Visibilita Fisica');

  doc.font('Helvetica').fontSize(10).fillColor(C.dark);
  y = para(doc, 'Il programma di co-branding garantisce al partner una visibilita territoriale quotidiana attraverso la presenza del proprio marchio sui mezzi e nelle operazioni di Croce Europa. Ogni ambulanza o divisa diventa un veicolo di comunicazione in movimento, associando il brand partner a un servizio riconosciuto e apprezzato dalla comunita.', ML, y, { lineGap: 1.5 });
  y += 8;

  y = sub(doc, y, 'Flotta di Ambulanze');

  doc.font('Helvetica').fontSize(10).fillColor(C.dark);
  y = para(doc, 'Le nostre ambulanze percorrono oltre 1.000.000 km all\'anno sulle strade di Verona e Vicenza, operando in contesti ad alto traffico: ospedali, cliniche, eventi sportivi, manifestazioni. Applicare il logo del partner sui mezzi significa assicurare una visibilita costante e capillare, con un impatto giornaliero.', ML, y, { lineGap: 1.5 });
  y += 4;

  const fleetItems = [
    'Riconoscibilita immediata: le ambulanze attirano naturalmente l\'attenzione del pubblico',
    'Associazione positiva: il brand collegato a un servizio che salva vite ogni giorno',
    'Copertura 24/7 con turni diurni e notturni su tutto il territorio',
    'Presenza nelle zone industriali, commerciali e residenziali',
  ];
  fleetItems.forEach(t => { y = bullet(doc, ML + 4, y, t, 10); });
  y += 6;

  y = sub(doc, y, 'Specifiche per Partner Premium e Elite');

  const premSpecItems: [string, string][] = [
    ['Logo sul retro delle ambulanze', 'Marchio del partner applicato sul retro di ogni mezzo, ben visibile durante la circolazione e le soste. Posizione di massima esposizione al traffico veicolare.'],
    ['Visibilita garantita 12 mesi', 'Il logo restera sui veicoli per un periodo minimo di un anno, assicurando continuita all\'esposizione del brand con rinnovo automatico.'],
    ['Manutenzione dell\'immagine', 'Croce Europa si impegna a effettuare la pulizia regolare dei mezzi, mantenendo sempre alta la visibilita e il decoro del logo del partner.'],
    ['Dimensioni standard aumentabili', 'La grandezza del logo segue gli standard della flotta, con possibilita di incremento fino a +5 cm per maggiore risalto (compatibilmente con lo spazio disponibile).'],
    ['Conformita normativa', 'Posizionamento e dimensioni definitive concordati rispettando le normative regionali del Veneto in materia di livree e segnaletiche sui mezzi di soccorso.'],
  ];

  premSpecItems.forEach(([t, d], i) => {
    const ch = 34;
    doc.roundedRect(ML, y, CW, ch, 3).fill(i % 2 === 0 ? C.bluePale : C.greenLight);
    doc.rect(ML, y, 4, ch).fill(i % 2 === 0 ? C.blue : C.green);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(i % 2 === 0 ? C.blue : C.green);
    st(doc, t, ML + 12, y + 4, { width: CW - 22, lineBreak: false });
    doc.font('Helvetica').fontSize(7.5).fillColor(C.dark);
    st(doc, d, ML + 12, y + 16, { width: CW - 22, height: ch - 18, lineGap: 1 });
    y += ch + 2;
  });
  y += 4;

  y = sub(doc, y, 'Divise e Materiali');

  doc.font('Helvetica').fontSize(10).fillColor(C.dark);
  y = para(doc, 'Oltre che sui mezzi, il logo del partner appare sull\'abbigliamento operativo di oltre 150 persone tra soccorritori e staff: felpe, giacche, magliette e materiali in uso quotidiano. Ad ogni servizio, intervento o evento pubblico, il partner gode di visibilita tramite le divise ufficiali. Una presenza costante sul territorio in tutte le situazioni operative.', ML, y, { lineGap: 1.5 });
  y += 4;

  highlight(doc, ML, y, CW, 24, 'Ogni ambulanza e ogni divisa diventano un veicolo di comunicazione per il vostro brand.', C.blueDeep);

  // ================================================================
  //  PAGE 8  —  VISIBILITA DIGITALE
  // ================================================================
  doc.addPage({ size: 'A4', margin: ML });
  footer(doc, 8);
  y = banner(doc, 'Capitolo 05', 'Visibilita Digitale', C.green);

  doc.font('Helvetica').fontSize(10).fillColor(C.dark);
  y = para(doc, 'Parallelamente alla visibilita sul territorio, Croce Europa offre una forte presenza digitale ai propri partner, sfruttando canali proprietari e audience qualificate. Ogni canale e diretto, verificato e raggiunge un pubblico fidelizzato.', ML, y, { lineGap: 1.5 });
  y += 8;

  const digChannels: [string, string, string, string][] = [
    ['Sito Web Istituzionale', 'Il logo del partner viene inserito nella sezione Partner sul sito ufficiale (croceeuropa.com), accompagnato da una breve descrizione dell\'azienda e dal link al vostro sito. Cio conferisce autorevolezza e migliora la visibilita online del partner, grazie al traffico di utenti che visitano il nostro sito per informazioni sui servizi.', C.blue, C.bluePale],
    ['App Mobile SOCCORSO DIGITALE', 'Tutto il personale utilizza quotidianamente l\'applicazione mobile proprietaria per la gestione dei servizi. All\'interno e presente una sezione dedicata ai partner convenzionati, con logo, descrizione, contatti e offerte riservate allo staff. Ogni volta che i nostri operatori aprono l\'app, i partner convenzionati sono a portata di mano.', C.green, C.greenLight],
    ['Social Media (Facebook, Instagram, LinkedIn)', 'Annunciamo e valorizziamo la partnership sui canali social ufficiali con post dedicati: benvenuto al nuovo partner, aggiornamenti sulle iniziative congiunte, foto di eventi co-branded e ringraziamenti pubblici. Raggiungiamo migliaia di persone nel territorio, amplificando la visibilita in modo moderno e condivisibile.', C.blue, C.bluePale],
    ['Newsletter e Comunicazioni Ufficiali', 'Il partner viene menzionato nelle newsletter periodiche al personale e nei comunicati ufficiali dell\'organizzazione. Riconoscimento costante all\'interno della community e testimonianza pubblica del legame instaurato. Ogni materiale promozionale o comunicazione integrata viene concordata con il partner.', C.green, C.greenLight],
  ];

  digChannels.forEach(([t, d, c, bg]) => {
    const ch = 56;
    doc.roundedRect(ML, y, CW, ch, 4).fill(bg);
    doc.rect(ML, y, 4, ch).fill(c);
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(c);
    st(doc, t, ML + 12, y + 5, { width: CW - 22, lineBreak: false });
    doc.font('Helvetica').fontSize(8).fillColor(C.dark);
    st(doc, d, ML + 12, y + 18, { width: CW - 22, height: ch - 22, lineGap: 1 });
    y += ch + 3;
  });
  y += 4;

  y = sub(doc, y, 'Vantaggi della Visibilita Digitale');

  const digBenefits = [
    'Audience qualificata e fidelizzata: 150+ professionisti del soccorso e le loro famiglie',
    'Canali proprietari e verificati: nessuna dispersione pubblicitaria',
    'Contenuti autentici: storie reali e iniziative concrete, non pubblicita generica',
    'Visibilita duratura: il partner resta visibile nel tempo su app, sito e archivio social',
    'Misurabilita: statistiche di visualizzazione, click e interazione fornite periodicamente',
    'Condivisibilita: i contenuti social amplificano la portata oltre la nostra audience diretta',
  ];
  digBenefits.forEach(t => { y = bullet(doc, ML + 4, y, t, 10); });
  y += 4;

  highlight(doc, ML, y, CW, 24, 'Canali digitali proprietari, audience qualificata, contenuti autentici e risultati misurabili.', C.greenDark);

  // ================================================================
  //  PAGE 9  —  FORMAZIONE
  // ================================================================
  doc.addPage({ size: 'A4', margin: ML });
  footer(doc, 9);
  y = banner(doc, 'Capitolo 06', 'Formazione e Centro Accreditato');

  doc.font('Helvetica').fontSize(10).fillColor(C.dark);
  y = para(doc, 'Il Centro di Formazione di Croce Europa e accreditato per l\'erogazione di corsi di formazione sanitaria. La collaborazione in ambito formativo consente ai partner di associare il proprio brand a iniziative educative di alto valore e di interagire con professionisti del settore sanitario.', ML, y, { lineGap: 1.5 });
  y += 8;

  y = sub(doc, y, 'Tipologie di Corsi Disponibili');

  const corsi: [string, string, string, string][] = [
    ['BLSD (Basic Life Support and Defibrillation)', 'Corso completo con certificazione valida 2 anni, riconosciuto a livello nazionale. Rivolto a operatori sanitari, personale aziendale e cittadini. Certificazione ufficiale con logo del partner.', C.blue, C.bluePale],
    ['Primo Soccorso Aziendale (D.Lgs. 81/08)', 'Formazione obbligatoria per addetti al primo soccorso aziendale Gruppo A e B. Corso conforme alla normativa vigente con rilascio di certificazione valida. Ideale per co-organizzazione con il partner.', C.green, C.greenLight],
    ['Formazione Sanitaria per Operatori', 'Programma formativo completo per soccorritori e autisti soccorritori. Include teoria, pratica e simulazioni. Sessioni periodiche durante tutto l\'anno con visibilita continua per il partner.', C.blue, C.bluePale],
    ['Aggiornamento e Ricertificazione', 'Corsi periodici di aggiornamento per mantenere attive le certificazioni esistenti. Sessioni frequenti che garantiscono visibilita ripetuta ai partner nel tempo.', C.green, C.greenLight],
    ['Corsi Specialistici su Richiesta', 'Formazione personalizzata per aziende, scuole, associazioni e gruppi. Co-progettazione con il partner per creare percorsi formativi su misura con branding congiunto.', C.blue, C.bluePale],
  ];

  corsi.forEach(([t, d, c, bg]) => {
    const ch = 42;
    doc.roundedRect(ML, y, CW, ch, 4).fill(bg);
    doc.rect(ML, y, 4, ch).fill(c);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(c);
    st(doc, t, ML + 12, y + 5, { width: CW - 22, lineBreak: false });
    doc.font('Helvetica').fontSize(7.5).fillColor(C.dark);
    st(doc, d, ML + 12, y + 17, { width: CW - 22, height: ch - 20, lineGap: 1 });
    y += ch + 3;
  });
  y += 4;

  y = sub(doc, y, 'Opportunita per il Partner');

  const formOpp = [
    'Logo sulle certificazioni ufficiali rilasciate ai partecipanti (conservate per anni)',
    'Brand presente nei materiali formativi: presentazioni, manuali, dispense',
    'Co-organizzazione di corsi e workshop con visibilita congiunta nella comunicazione',
    'Presenza del brand nell\'aula durante i corsi: roll-up, materiali informativi',
    'Presentazione dell\'azienda partner ai partecipanti durante le sessioni',
    'Possibilita di erogare contenuti formativi propri nel contesto dei corsi (su accordo)',
  ];
  formOpp.forEach(t => { y = bullet(doc, ML + 4, y, t, 10); });
  y += 4;

  // Pact for Skills - European Commission
  y += 4;
  doc.roundedRect(ML, y, CW, 82, 5).fill(C.blueDeep);
  if (hasPfsLogo) {
    try { doc.image(pfsLogoPath, ML + 12, y + 10, { height: 38 }); } catch(_) {}
  }
  const pfsX = ML + 120;
  const pfsW = CW - 132;
  doc.font('Helvetica-Bold').fontSize(10).fillColor(C.white);
  st(doc, 'Aderente al Pact for Skills - Commissione Europea', pfsX, y + 6, { width: pfsW, lineBreak: false });
  doc.font('Helvetica').fontSize(9).fillColor(C.white);
  st(doc, 'Croce Europa e un\'organizzazione aderente al Pact for Skills, iniziativa della Commissione Europea dedicata allo sviluppo e al rafforzamento delle competenze nei settori strategici. Questo impegno riflette la nostra attenzione costante alla formazione qualificata, all\'aggiornamento professionale e alla crescita delle competenze in ambito sanitario, operativo e digitale.', pfsX, y + 20, { width: pfsW, height: 30, lineGap: 1 });
  doc.font('Helvetica').fontSize(9).fillOpacity(0.85).fillColor(C.white);
  st(doc, 'Le attivita formative e i percorsi sviluppati si inseriscono in un contesto coerente con i framework europei, offrendo ai partner l\'opportunita di associare il proprio brand a progetti di formazione riconosciuti e allineati alle politiche UE in materia di competenze e occupabilita.', pfsX, y + 52, { width: pfsW, height: 28, lineGap: 1 });
  doc.fillOpacity(1);
  y += 88;

  highlight(doc, ML, y, CW, 24, 'Le certificazioni restano nel tempo. La visibilita del vostro brand anche.', C.blueDeep);

  // ================================================================
  //  PAGE 10  —  TEST PRODOTTI + BENEFIT INTERNI
  // ================================================================
  doc.addPage({ size: 'A4', margin: ML });
  footer(doc, 10);
  y = banner(doc, 'Capitolo 07', 'Test Prodotti e Benefit Interni', C.green);

  y = sub(doc, y, 'Test Prodotti in Contesto Operativo');

  doc.font('Helvetica').fontSize(10).fillColor(C.dark);
  y = para(doc, 'Croce Europa, grazie alla propria esperienza sul campo e infrastruttura tecnologica, puo diventare un laboratorio vivente dove il partner puo validare soluzioni innovative. Attrezzature medicali, tecnologie, veicoli e altri prodotti possono essere testati in un contesto operativo reale, fornendo al partner feedback qualificati e dati di utilizzo concreti.', ML, y, { lineGap: 1.5 });
  y += 6;

  const testBenefits: [string, string, string, string][] = [
    ['Feedback Qualificati', 'Il nostro personale esperto fornisce valutazioni professionali e suggerimenti di miglioramento basati sull\'utilizzo reale e quotidiano del prodotto, non su test di laboratorio.', C.blue, C.bluePale],
    ['Dati di Utilizzo Reali', 'Raccolta sistematica di dati quantitativi e qualitativi sull\'utilizzo del prodotto in condizioni operative reali, con report strutturati e documentazione fotografica.', C.green, C.greenLight],
    ['Referenze Operative', 'Il partner ottiene referenze concrete e case study basati sull\'utilizzo del prodotto in un contesto professionale riconosciuto e ad alto valore istituzionale.', C.blue, C.bluePale],
    ['Visibilita dell\'Innovazione', 'Il test in contesto reale dimostra l\'impegno del partner nell\'innovazione e la volonta di migliorare i propri prodotti, generando contenuti autentici per la comunicazione.', C.green, C.greenLight],
  ];

  testBenefits.forEach(([t, d, c, bg]) => {
    const ch = 42;
    doc.roundedRect(ML, y, CW, ch, 4).fill(bg);
    doc.rect(ML, y, 4, ch).fill(c);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(c);
    st(doc, t, ML + 12, y + 5, { width: CW - 22, lineBreak: false });
    doc.font('Helvetica').fontSize(8).fillColor(C.dark);
    st(doc, d, ML + 12, y + 18, { width: CW - 22, height: ch - 20, lineGap: 1 });
    y += ch + 3;
  });
  y += 6;

  y = sub(doc, y, 'Benefit Interni e Convenzioni per il Personale');

  doc.font('Helvetica').fontSize(10).fillColor(C.dark);
  y = para(doc, 'Il partner puo attivare convenzioni e agevolazioni riservate al personale di Croce Europa, offrendo condizioni vantaggiose su prodotti e servizi ai nostri 150+ operatori. Questo crea un legame diretto tra partner e comunita Croce Europa.', ML, y, { lineGap: 1.5 });
  y += 6;

  const benefitItems: [string, string, string, string][] = [
    ['Sconti e Offerte Dedicate', 'Condizioni speciali riservate esclusivamente al personale di Croce Europa. Comunicate tramite app mobile e newsletter interne, con tracciamento dell\'utilizzo e report periodici al partner.', C.blue, C.bluePale],
    ['Nuovo Canale di Business', 'Accesso diretto a un pubblico di 150+ professionisti qualificati, con le loro famiglie e reti di contatti. Opportunita di business concreta e misurabile nel territorio.', C.green, C.greenLight],
    ['Soddisfazione del Personale', 'I benefit arricchiscono il pacchetto welfare dei nostri operatori, incrementando la soddisfazione interna e generando un sentimento positivo verso il partner convenzionato.', C.blue, C.bluePale],
    ['Visibilita nelle Sedi', 'Possibilita di esporre materiale promozionale nelle 5 sedi operative e di organizzare presentazioni dedicate al personale durante i momenti di aggregazione.', C.green, C.greenLight],
  ];

  benefitItems.forEach(([t, d, c, bg]) => {
    const ch = 42;
    doc.roundedRect(ML, y, CW, ch, 4).fill(bg);
    doc.rect(ML, y, 4, ch).fill(c);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(c);
    st(doc, t, ML + 12, y + 5, { width: CW - 22, lineBreak: false });
    doc.font('Helvetica').fontSize(8).fillColor(C.dark);
    st(doc, d, ML + 12, y + 18, { width: CW - 22, height: ch - 20, lineGap: 1 });
    y += ch + 3;
  });
  y += 2;

  highlight(doc, ML, y, CW, 24, '150+ professionisti come pubblico diretto: un canale di business concreto e misurabile.', C.greenDark);

  // ================================================================
  //  PAGE 11  —  EVENTI E NETWORKING
  // ================================================================
  doc.addPage({ size: 'A4', margin: ML });
  footer(doc, 11);
  y = banner(doc, 'Capitolo 08', 'Eventi e Networking');

  doc.font('Helvetica').fontSize(10).fillColor(C.dark);
  y = para(doc, 'Organizziamo regolarmente serate informative, giornate porte aperte in sede, esercitazioni e altre iniziative dove i partner possono interagire direttamente con il personale e la comunita. Questi eventi offrono visibilita qualificata e opportunita di networking con oltre 150 professionisti del soccorso sanitario.', ML, y, { lineGap: 1.5 });
  y += 8;

  y = sub(doc, y, 'Tipologie di Eventi');

  const events: [string, string, string, string][] = [
    ['Serate Informative', 'Presentazione di prodotti, servizi e novita ai nostri operatori. Format strutturato con talk del partner, sessione Q&A e momento conviviale. Ideale per presentare novita e raccogliere feedback diretto dal personale operativo.', C.blue, C.bluePale],
    ['Open Day e Porte Aperte', 'Giornate dedicate alla comunita con visibilita del partner, dimostrazioni pratiche dei mezzi, attivita interattive per famiglie e cittadini. Copertura mediatica e social dell\'evento con menzione del partner.', C.green, C.greenLight],
    ['Corsi e Workshop Congiunti', 'Formazione co-organizzata su temi di interesse comune: sicurezza sul lavoro, primo soccorso aziendale, prevenzione, benessere. Il partner appare come co-organizzatore su tutti i materiali.', C.blue, C.bluePale],
    ['Eventi Benefici e Solidali', 'Iniziative di raccolta fondi, giornate di sensibilizzazione e campagne sociali con visibilita congiunta e impatto mediatico positivo. Il partner ottiene contenuti CSR autentici e verificabili.', C.green, C.greenLight],
    ['Fiere e Manifestazioni', 'Partecipazione congiunta a fiere di settore, eventi sportivi e manifestazioni territoriali con stand condiviso e materiale co-branded. Networking con il pubblico e altri operatori.', C.blue, C.bluePale],
  ];

  events.forEach(([t, d, c, bg]) => {
    if (y >= SB - 44) return;
    const ch = 44;
    doc.roundedRect(ML, y, CW, ch, 4).fill(bg);
    doc.rect(ML, y, 4, ch).fill(c);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(c);
    st(doc, t, ML + 12, y + 5, { width: CW - 22, lineBreak: false });
    doc.font('Helvetica').fontSize(8).fillColor(C.dark);
    st(doc, d, ML + 12, y + 18, { width: CW - 22, height: ch - 20, lineGap: 1 });
    y += ch + 3;
  });
  y += 4;

  y = sub(doc, y, 'Cosa Puo Fare il Partner durante un Evento');

  const evPartner = [
    'Allestire stand o punto informativo con materiali propri nelle nostre sedi',
    'Effettuare dimostrazioni pratiche, presentazioni o talk dedicati al personale',
    'Distribuire campioni, brochure e materiale promozionale ai partecipanti',
    'Raccogliere contatti e leads qualificati tra i 150+ professionisti presenti',
    'Offrire convenzioni esclusive e promozioni dedicate al personale Croce Europa',
    'Ottenere copertura fotografica e social dell\'evento con menzione del partner',
    'Partecipare al momento conviviale per networking diretto e relazioni personali',
  ];
  evPartner.forEach(t => { y = bullet(doc, ML + 4, y, t, 10); });
  y += 2;

  highlight(doc, ML, y, CW, 24, 'Ogni evento e un\'occasione di incontro diretto con 150+ professionisti del soccorso.', C.blueDeep);

  // ================================================================
  //  PAGE 12  —  PROCESSO DI ATTIVAZIONE
  // ================================================================
  doc.addPage({ size: 'A4', margin: ML });
  footer(doc, 12);
  y = banner(doc, 'Capitolo 09', 'Processo di Attivazione', C.green);

  doc.font('Helvetica').fontSize(10).fillColor(C.dark);
  y = para(doc, 'L\'attivazione di una partnership con Croce Europa avviene attraverso fasi ben definite, volte a costruire in modo solido e condiviso la collaborazione. Il processo e stato progettato per garantire trasparenza, personalizzazione e risultati concreti fin dal primo giorno.', ML, y, { lineGap: 1.5 });
  y += 10;

  const steps: [string, string, string, string, string][] = [
    ['FASE 1', 'Primo Contatto', 'Incontro conoscitivo (di persona o in call) tra i referenti di Croce Europa e dell\'azienda interessata. Si esplorano gli obiettivi, le esigenze del partner e le possibili sinergie. E un momento di ascolto reciproco, in cui comprendiamo il vostro business e voi conoscete meglio la nostra realta e la nostra missione.', C.blue, C.bluePale],
    ['FASE 2', 'Proposta Personalizzata', 'Il team Croce Europa elabora una proposta di partnership su misura basata sugli input raccolti. Vengono definiti congiuntamente i moduli di collaborazione, i canali, la durata e il livello del pacchetto. La proposta dettagliata viene discussa apertamente per assicurare che rispecchi pienamente le aspettative di entrambi.', C.green, C.greenLight],
    ['FASE 3', 'Avvio della Collaborazione', 'Formalizzazione dell\'accordo e integrazione operativa del brand nei canali concordati: installazione loghi sui mezzi e piattaforme digitali, annuncio pubblico della partnership, pianificazione del calendario attivita e attivazione delle convenzioni per il personale. Lancio coordinato e professionale.', C.blue, C.bluePale],
    ['FASE 4', 'Monitoraggio e Sviluppo', 'Report periodici sullo stato delle iniziative: visibilita ottenuta (km percorsi, impression digitali, partecipazione eventi), feedback del personale e del pubblico, utilizzo dei benefit. Momenti di confronto regolari per ottimizzare le attivita e identificare nuove opportunita di crescita comune.', C.green, C.greenLight],
  ];

  steps.forEach(([phase, title, desc, c, bg]) => {
    const ch = 72;
    doc.roundedRect(ML, y, CW, ch, 5).fill(bg);
    doc.rect(ML, y, 5, ch).fill(c);
    doc.roundedRect(ML + 14, y + 6, 50, 16, 3).fill(c);
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.white);
    st(doc, phase, ML + 16, y + 9, { width: 46, align: 'center', lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(11).fillColor(c);
    st(doc, title, ML + 72, y + 8, { width: CW - 84, lineBreak: false });
    doc.font('Helvetica').fontSize(8).fillColor(C.dark);
    st(doc, desc, ML + 14, y + 28, { width: CW - 28, height: ch - 32, lineGap: 1.2 });
    y += ch + 4;
  });
  y += 4;

  doc.roundedRect(ML, y, CW, 44, 4).fill(C.goldLight);
  doc.rect(ML, y, 4, 44).fill(C.gold);
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C.goldDark);
  st(doc, 'Partnership Evolutive', ML + 12, y + 4, { width: CW - 22, lineBreak: false });
  doc.font('Helvetica').fontSize(8).fillColor(C.dark);
  st(doc, 'Le partnership di maggiore successo sono percorsi evolutivi: partendo da un ambito, possono espandersi ad altri col tempo, rafforzando sempre di piu il legame tra partner e Croce Europa. Al termine del periodo concordato, si procede a una valutazione complessiva e, se entrambe le parti lo desiderano, al rinnovo o all\'ampliamento dell\'accordo.', ML + 12, y + 16, { width: CW - 22, height: 28, lineGap: 1 });
  y += 50;

  highlight(doc, ML, y, CW, 24, 'Non vendiamo spazi. Costruiamo insieme ai partner progetti di valore duraturo.', C.blueDeep);

  // ================================================================
  //  PAGE 13  —  CONTATTI E PROSSIMI PASSI
  // ================================================================
  doc.addPage({ size: 'A4', margin: ML });
  footer(doc, 13);
  y = banner(doc, 'Capitolo 10', 'Contatti e Prossimi Passi');

  doc.font('Helvetica').fontSize(10).fillColor(C.dark);
  y = para(doc, 'Croce Europa crede fermamente nelle collaborazioni basate su coerenza e fiducia reciproca. Per questo motivo ci impegniamo a costruire partnership autentiche, evitando logiche meramente pubblicitarie. Se la vostra azienda condivide i nostri valori e vuole contribuire attivamente alla nostra missione, saremo lieti di avviare un confronto riservato su come crescere insieme.', ML, y, { lineGap: 1.5 });
  y += 10;

  y = sub(doc, y, 'Come Contattarci');

  const contacts: [string, string, string][] = [
    ['Email Partnership', 'partnership@croceeuropa.com', 'Canale preferenziale per avviare il primo contatto. Risposta garantita entro 48 ore lavorative con proposta di incontro conoscitivo.'],
    ['Telefono', '045-8203000', 'Disponibile dal lunedi al venerdi in orario d\'ufficio. Chiedere del team Partnership e Comunicazione per essere indirizzati al referente.'],
    ['Sito Web', 'www.croceeuropa.it', 'Sezione Partnership dedicata con informazioni aggiornate, form di contatto e documentazione scaricabile per approfondimenti.'],
    ['PEC', 'croceeuropa@pec.it', 'Per comunicazioni ufficiali e documentazione formale. Utilizzare per invio di accordi, contratti e documentazione legale.'],
  ];

  contacts.forEach(([label, value, desc], i) => {
    const ch = 48;
    const c = i % 2 === 0 ? C.blue : C.green;
    const bg = i % 2 === 0 ? C.bluePale : C.greenLight;
    doc.roundedRect(ML, y, CW, ch, 4).fill(bg);
    doc.rect(ML, y, 4, ch).fill(c);
    doc.font('Helvetica').fontSize(7.5).fillColor(C.gray);
    st(doc, label.toUpperCase(), ML + 12, y + 5, { width: 100, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(11).fillColor(c);
    st(doc, value, ML + 12, y + 17, { width: CW - 22, lineBreak: false });
    doc.font('Helvetica').fontSize(7.5).fillColor(C.dark);
    st(doc, desc, ML + 12, y + 32, { width: CW - 22, lineBreak: false });
    y += ch + 3;
  });
  y += 6;

  y = sub(doc, y, 'Prossimi Passi');

  const nexts = [
    'Inviate una email a partnership@croceeuropa.com presentando la vostra azienda e i vostri obiettivi',
    'Il nostro team vi contatterà entro 48 ore per fissare un incontro conoscitivo',
    'Insieme definiremo il pacchetto e le aree di collaborazione piu adatte al vostro business',
    'Vi presenteremo una proposta personalizzata con tutti i dettagli operativi',
    'Dopo l\'approvazione, avvieremo l\'integrazione del vostro brand nei canali concordati',
    'Riceverete report periodici con metriche concrete sull\'andamento della partnership',
  ];
  nexts.forEach(t => { y = bullet(doc, ML + 4, y, t, 10); });
  y += 6;

  doc.roundedRect(ML, y, CW, 70, 6).fill(C.blueDeep);
  doc.font('Helvetica-Bold').fontSize(14).fillColor(C.white);
  st(doc, 'Diventa Partner di Croce Europa', ML + 12, y + 8, { width: CW - 24, align: 'center', lineBreak: false });
  doc.font('Helvetica').fontSize(9.5).fillColor(C.white);
  st(doc, 'Vi forniremo tutte le informazioni necessarie e valuteremo con voi', ML + 12, y + 28, { width: CW - 24, align: 'center', lineBreak: false });
  st(doc, 'la soluzione di partnership piu adatta al vostro business.', ML + 12, y + 40, { width: CW - 24, align: 'center', lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(12).fillColor(C.white);
  st(doc, 'partnership@croceeuropa.com  |  045-8203000', ML + 12, y + 54, { width: CW - 24, align: 'center', lineBreak: false });

  // ================================================================
  //  PAGE 14  —  BACK COVER (Quarta di Copertina)
  // ================================================================
  doc.addPage({ size: 'A4', margin: 0 });

  doc.rect(0, 0, PW, PH).fill(C.blueDeep);

  doc.save();
  doc.circle(PW + 80, PH * 0.12, 280).fillOpacity(0.03).fill(C.white);
  doc.circle(-100, PH * 0.65, 320).fillOpacity(0.03).fill(C.white);
  doc.circle(PW * 0.5, PH + 80, 230).fillOpacity(0.02).fill(C.white);
  doc.restore();

  let by = 170;

  doc.save();
  doc.roundedRect(PW / 2 - 50, by, 100, 100, 50).fillOpacity(0.12).fill(C.white);
  doc.fillOpacity(1);
  doc.font('Helvetica-Bold').fontSize(44).fillColor(C.white);
  st(doc, 'CE', PW / 2 - 50, by + 24, { width: 100, align: 'center', lineBreak: false });
  doc.restore();
  by += 116;

  doc.font('Helvetica-Bold').fontSize(17).fillColor(C.white);
  st(doc, 'CROCE EUROPA', 0, by, { width: PW, align: 'center', lineBreak: false });
  by += 20;
  doc.font('Helvetica').fontSize(9.5).fillOpacity(0.7).fillColor(C.white);
  st(doc, 'SRL IMPRESA SOCIALE', 0, by, { width: PW, align: 'center', lineBreak: false });
  doc.fillOpacity(1);
  by += 28;

  doc.moveTo(PW / 2 - 30, by).lineTo(PW / 2 + 30, by).lineWidth(0.8).strokeOpacity(0.25).strokeColor(C.white).stroke();
  doc.strokeOpacity(1);
  by += 16;

  doc.font('Helvetica').fontSize(9).fillOpacity(0.6).fillColor(C.white);
  st(doc, 'Guida di Attivazione Partnership 2026', 0, by, { width: PW, align: 'center', lineBreak: false });
  by += 13;
  st(doc, 'Servizi di Trasporto Sanitario', 0, by, { width: PW, align: 'center', lineBreak: false });
  by += 13;
  st(doc, 'Province di Verona e Vicenza', 0, by, { width: PW, align: 'center', lineBreak: false });
  doc.fillOpacity(1);
  by += 32;

  doc.roundedRect(PW / 2 - 120, by, 240, 1, 0).fillOpacity(0.1).fill(C.white);
  doc.fillOpacity(1);
  by += 14;

  const backContacts: [string, string][] = [
    ['Email Partnership', 'partnership@croceeuropa.com'],
    ['Telefono', '045-8203000'],
    ['Sito Web', 'www.croceeuropa.it'],
    ['PEC', 'croceeuropa@pec.it'],
  ];

  backContacts.forEach(([label, value]) => {
    doc.font('Helvetica').fontSize(7).fillOpacity(0.45).fillColor(C.white);
    st(doc, label.toUpperCase(), 0, by, { width: PW, align: 'center', lineBreak: false });
    doc.fillOpacity(1);
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C.white);
    st(doc, value, 0, by + 10, { width: PW, align: 'center', lineBreak: false });
    by += 28;
  });

  by += 8;
  doc.roundedRect(PW / 2 - 120, by, 240, 1, 0).fillOpacity(0.1).fill(C.white);
  doc.fillOpacity(1);
  by += 14;

  doc.font('Helvetica').fontSize(8).fillOpacity(0.5).fillColor(C.white);
  st(doc, 'Operativi 24/7  |  365 giorni all\'anno', 0, by, { width: PW, align: 'center', lineBreak: false });
  by += 12;
  st(doc, 'Insieme, un passo alla volta, possiamo fare la differenza.', 0, by, { width: PW, align: 'center', lineBreak: false });
  doc.fillOpacity(1);

  if (hasLogo) {
    try { doc.image(logoPath, PW / 2 - 28, PH - 72, { width: 56 }); } catch (_) {}
  }

  doc.font('Helvetica').fontSize(6).fillOpacity(0.3).fillColor(C.white);
  st(doc, `${today}  |  Documento Riservato  |  Tutti i diritti riservati`, 0, PH - 18, { width: PW, align: 'center', lineBreak: false });
  doc.fillOpacity(1);

  doc.end();
}
