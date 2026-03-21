import PDFDocument from 'pdfkit';
import { Response } from 'express';

export function generateAcademyPlanPDF(res: Response) {
  const doc = new PDFDocument({ 
    size: 'A4', 
    margin: 50,
    info: {
      Title: 'CROCE EUROPA ACADEMY - Piano di Implementazione',
      Author: 'SOCCORSO DIGITALE S.R.L. Impresa Sociale',
      Subject: 'Sistema di Formazione per il Soccorso Sanitario'
    }
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=Croce_Europa_Academy_Piano.pdf');
  doc.pipe(res);

  const primaryColor = '#1a365d';
  const accentColor = '#c53030';
  const textColor = '#2d3748';

  // Cover Page
  doc.rect(0, 0, doc.page.width, doc.page.height).fill('#1a365d');
  
  doc.fillColor('#ffffff')
     .fontSize(12)
     .text('CROCE EUROPA S.R.L. IMPRESA SOCIALE', 50, 200, { align: 'center' });
  
  doc.fontSize(36)
     .font('Helvetica-Bold')
     .text('CROCE EUROPA', 50, 280, { align: 'center' });
  
  doc.fontSize(42)
     .fillColor('#c53030')
     .text('ACADEMY', 50, 330, { align: 'center' });
  
  doc.fillColor('#ffffff')
     .fontSize(16)
     .font('Helvetica')
     .text('Il Sistema di Formazione più Avanzato', 50, 420, { align: 'center' })
     .text('nel Soccorso Sanitario', 50, 445, { align: 'center' });
  
  doc.fontSize(14)
     .text('PIANO DI IMPLEMENTAZIONE', 50, 520, { align: 'center' });
  
  doc.fontSize(10)
     .text('Documento Riservato', 50, 700, { align: 'center' })
     .text(`Data: ${new Date().toLocaleDateString('it-IT')}`, 50, 720, { align: 'center' });

  // Page 2 - Vision
  doc.addPage();
  
  doc.fillColor(primaryColor)
     .fontSize(24)
     .font('Helvetica-Bold')
     .text('VISIONE', 50, 50);
  
  doc.moveTo(50, 80).lineTo(200, 80).stroke(accentColor);
  
  doc.fillColor(textColor)
     .fontSize(11)
     .font('Helvetica')
     .text(
       'Un ecosistema formativo rivoluzionario dove ogni soccorritore ha un percorso personalizzato verso l\'eccellenza, con certificazioni sempre aggiornate, competenze tracciate in tempo reale e un\'esperienza di apprendimento che motiva e coinvolge come mai visto prima nel settore EMS.',
       50, 100, { width: 495, align: 'justify' }
     );

  // Objectives
  doc.fillColor(primaryColor)
     .fontSize(18)
     .font('Helvetica-Bold')
     .text('OBIETTIVI STRATEGICI', 50, 180);
  
  const objectives = [
    'Nessuna certificazione scade mai senza preavviso',
    'Ogni soccorritore ha un percorso formativo personalizzato',
    'Gli istruttori gestiscono tutto da un pannello intuitivo',
    'I dirigenti vedono la conformità in tempo reale',
    'La formazione diventa coinvolgente come un gioco'
  ];
  
  let yPos = 210;
  objectives.forEach((obj, i) => {
    doc.fillColor(accentColor).fontSize(11).text('●', 60, yPos);
    doc.fillColor(textColor).text(obj, 80, yPos, { width: 460 });
    yPos += 25;
  });

  // Page 3 - Course Catalog
  doc.addPage();
  
  doc.fillColor(primaryColor)
     .fontSize(24)
     .font('Helvetica-Bold')
     .text('CATALOGO CORSI', 50, 50);
  
  doc.moveTo(50, 80).lineTo(250, 80).stroke(accentColor);

  const courses = [
    { name: 'BLSD', desc: 'Basic Life Support Defibrillation', hours: '8 ore', validity: '24 mesi', mode: 'Aula + Pratica' },
    { name: 'PBLSD', desc: 'Pediatric BLS-D', hours: '4 ore', validity: '24 mesi', mode: 'Aula + Pratica' },
    { name: 'Primo Soccorso', desc: 'Primo Soccorso Aziendale', hours: '12/16 ore', validity: '36 mesi', mode: 'Aula + Pratica' },
    { name: 'PTC Base', desc: 'Pre-hospital Trauma Care', hours: '16 ore', validity: '24 mesi', mode: 'Aula + Pratica' },
    { name: 'PTC Avanzato', desc: 'Trauma Care Avanzato', hours: '24 ore', validity: '24 mesi', mode: 'Aula + Simulazione' },
    { name: 'Trasporto Sanitario', desc: 'Corso Completo Trasporto', hours: '120 ore', validity: 'Permanente', mode: 'Blended' },
    { name: 'Gestione Emergenze', desc: 'Emergenze Sanitarie', hours: '8 ore', validity: '24 mesi', mode: 'Aula' },
    { name: 'Comunicazioni Radio', desc: 'Uso Radio e Comunicazioni', hours: '4 ore', validity: 'Permanente', mode: 'Online + Pratica' },
    { name: 'Guida Sicura', desc: 'Guida Mezzi di Soccorso', hours: '8 ore', validity: '36 mesi', mode: 'Teoria + Pratica' },
    { name: 'Ossigenoterapia', desc: 'Ossigenoterapia e Aspirazione', hours: '4 ore', validity: '24 mesi', mode: 'Aula' }
  ];

  // Table header
  yPos = 100;
  doc.fillColor('#e2e8f0').rect(50, yPos, 495, 25).fill();
  doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold');
  doc.text('CORSO', 55, yPos + 7);
  doc.text('DURATA', 250, yPos + 7);
  doc.text('VALIDITÀ', 320, yPos + 7);
  doc.text('MODALITÀ', 400, yPos + 7);
  
  yPos += 25;
  doc.font('Helvetica').fillColor(textColor);
  
  courses.forEach((course, i) => {
    if (i % 2 === 0) {
      doc.fillColor('#f7fafc').rect(50, yPos, 495, 35).fill();
    }
    doc.fillColor(textColor).fontSize(10);
    doc.font('Helvetica-Bold').text(course.name, 55, yPos + 5);
    doc.font('Helvetica').fontSize(8).text(course.desc, 55, yPos + 18);
    doc.fontSize(10).text(course.hours, 250, yPos + 10);
    doc.text(course.validity, 320, yPos + 10);
    doc.text(course.mode, 400, yPos + 10);
    yPos += 35;
  });

  // Page 4 - Admin Panel
  doc.addPage();
  
  doc.fillColor(primaryColor)
     .fontSize(24)
     .font('Helvetica-Bold')
     .text('PANNELLO AMMINISTRATIVO', 50, 50);
  
  doc.moveTo(50, 80).lineTo(350, 80).stroke(accentColor);
  
  doc.fillColor(textColor)
     .fontSize(11)
     .font('Helvetica')
     .text('Torre di Controllo Formazione con design Liquid Glass', 50, 95);

  const adminFeatures = [
    {
      title: 'Gestione Corsi',
      items: ['Creazione corsi con wizard intelligente', 'Caricamento materiali (slide, video, documenti)', 'Generazione automatica quiz dai contenuti', 'Template per corsi ricorrenti']
    },
    {
      title: 'Calendario Dinamico',
      items: ['Vista timeline olografica', 'Drag & drop per programmazione', 'Controllo capacità aule automatico', 'Conflitti istruttori evidenziati']
    },
    {
      title: 'Gestione Istruttori',
      items: ['Profilo con certificazioni e abilitazioni', 'Calendario disponibilità', 'Workload bilanciato tra istruttori', 'Storico corsi tenuti e feedback']
    },
    {
      title: 'Iscrizioni e Presenze',
      items: ['Approvazione iscrizioni con un click', 'Check-in digitale (QR code)', 'Firma digitale presenza', 'Certificato generato automaticamente']
    },
    {
      title: 'Dashboard Conformità',
      items: ['Heatmap scadenze per sede/ruolo', 'Alert automatici 90/60/30/7 giorni', 'Campagne di rinnovo massivo', 'Report per ispezioni ASL']
    }
  ];

  yPos = 130;
  adminFeatures.forEach(feature => {
    doc.fillColor(primaryColor).fontSize(13).font('Helvetica-Bold').text(feature.title, 50, yPos);
    yPos += 18;
    feature.items.forEach(item => {
      doc.fillColor(accentColor).fontSize(9).text('▸', 60, yPos);
      doc.fillColor(textColor).font('Helvetica').fontSize(10).text(item, 75, yPos);
      yPos += 15;
    });
    yPos += 10;
  });

  // Page 5 - Mobile App
  doc.addPage();
  
  doc.fillColor(primaryColor)
     .fontSize(24)
     .font('Helvetica-Bold')
     .text('APP MOBILE', 50, 50);
  
  doc.moveTo(50, 80).lineTo(180, 80).stroke(accentColor);
  
  doc.fillColor(textColor)
     .fontSize(11)
     .font('Helvetica')
     .text('Home Screen "Mission Readiness" - Per tutto il personale', 50, 95);

  const appFeatures = [
    {
      title: 'Portafoglio Certificazioni',
      items: ['Tutte le certificazioni con countdown visivo', 'Codice QR verificabile per ogni attestato', 'Storico completo formazione', 'Condivisione certificati']
    },
    {
      title: 'Catalogo Corsi e Iscrizione',
      items: ['Corsi disponibili per sede', 'Posti disponibili in tempo reale', 'Iscrizione con un tap', 'Lista d\'attesa automatica']
    },
    {
      title: 'Apprendimento Continuo',
      items: ['Microlearning: pillole da 3-5 minuti', 'Quiz di ripasso con spaced repetition', 'Video procedure scaricabili offline', 'Flashcard generate automaticamente']
    },
    {
      title: 'Simulatore Scenari',
      items: ['Scenari interattivi a scelta multipla', 'Feedback immediato sulle decisioni', 'Punteggio e statistiche', 'Casi reali del soccorso sanitario']
    },
    {
      title: 'Gamification EMS',
      items: ['XP per competenza: BLSD XP, Trauma XP', 'Badge esclusivi: "Maestro BLSD", "Specialista Trauma"', 'Sfide di Squadra tra sedi', 'Classifiche: personale, sede, regionale']
    }
  ];

  yPos = 130;
  appFeatures.forEach(feature => {
    doc.fillColor(primaryColor).fontSize(13).font('Helvetica-Bold').text(feature.title, 50, yPos);
    yPos += 18;
    feature.items.forEach(item => {
      doc.fillColor(accentColor).fontSize(9).text('▸', 60, yPos);
      doc.fillColor(textColor).font('Helvetica').fontSize(10).text(item, 75, yPos);
      yPos += 15;
    });
    yPos += 10;
  });

  // Page 6 - Innovations
  doc.addPage();
  
  doc.fillColor(primaryColor)
     .fontSize(24)
     .font('Helvetica-Bold')
     .text('ELEMENTI INNOVATIVI UNICI', 50, 50);
  
  doc.moveTo(50, 80).lineTo(350, 80).stroke(accentColor);

  const innovations = [
    {
      name: '"Vital Strip" - Indicatore Stato Formativo',
      desc: 'Una barra sempre visibile che mostra la "salute formativa" come un monitor paziente. Verde: tutto in regola, Giallo: scadenze in avvicinamento, Rosso: certificazioni scadute. Pulsa come un battito cardiaco.'
    },
    {
      name: '"Mission Cards" - Corsi come Missioni',
      desc: 'Ogni corso presentato come una missione da completare: Briefing iniziale con obiettivi, Checkpoint durante il percorso, Debriefing finale con valutazione, Medaglia al completamento.'
    },
    {
      name: '"Rescue Timeline" - Storico Visivo',
      desc: 'Timeline interattiva della carriera formativa: ogni corso è un "intervento" completato, visualizzazione anni di servizio, progressione competenze nel tempo.'
    },
    {
      name: '"Team Readiness Radar"',
      desc: 'Grafico radar che mostra le competenze del team in modo visivo: BLSD, PTC, Primo Soccorso, PBLSD rappresentati come assi del radar.'
    },
    {
      name: '"Smart Notifications"',
      desc: 'Notifiche intelligenti contestuali basate su attività, scadenze, e opportunità di formazione. Suggerimenti personalizzati in base al profilo dell\'utente.'
    }
  ];

  yPos = 100;
  innovations.forEach((inn, i) => {
    doc.fillColor(primaryColor).fontSize(12).font('Helvetica-Bold').text(`${i + 1}. ${inn.name}`, 50, yPos);
    yPos += 18;
    doc.fillColor(textColor).fontSize(10).font('Helvetica').text(inn.desc, 50, yPos, { width: 495, align: 'justify' });
    yPos += 50;
  });

  // Page 7 - Data Model
  doc.addPage();
  
  doc.fillColor(primaryColor)
     .fontSize(24)
     .font('Helvetica-Bold')
     .text('MODELLO DATI', 50, 50);
  
  doc.moveTo(50, 80).lineTo(220, 80).stroke(accentColor);

  const tables = [
    { name: 'training_courses', desc: 'Catalogo corsi disponibili' },
    { name: 'course_editions', desc: 'Edizioni programmate dei corsi' },
    { name: 'course_sessions', desc: 'Singole lezioni/sessioni' },
    { name: 'course_materials', desc: 'Materiali didattici (video, slide, documenti)' },
    { name: 'instructors', desc: 'Istruttori abilitati' },
    { name: 'instructor_qualifications', desc: 'Abilitazioni degli istruttori' },
    { name: 'enrollments', desc: 'Iscrizioni ai corsi' },
    { name: 'attendance_records', desc: 'Registrazione presenze' },
    { name: 'assessments', desc: 'Valutazioni e test' },
    { name: 'certifications', desc: 'Certificazioni ottenute' },
    { name: 'certification_renewals', desc: 'Storico rinnovi' },
    { name: 'learning_progress', desc: 'Progresso microlearning' },
    { name: 'xp_transactions', desc: 'Punti esperienza' },
    { name: 'badges_earned', desc: 'Badge ottenuti' },
    { name: 'simulation_attempts', desc: 'Tentativi simulazioni' }
  ];

  yPos = 100;
  doc.font('Courier').fontSize(10);
  
  tables.forEach(table => {
    doc.fillColor(primaryColor).text(`├── ${table.name}`, 60, yPos);
    doc.fillColor(textColor).font('Helvetica').text(table.desc, 280, yPos);
    doc.font('Courier');
    yPos += 18;
  });

  // Page 8 - Implementation Phases
  doc.addPage();
  
  doc.fillColor(primaryColor)
     .fontSize(24)
     .font('Helvetica-Bold')
     .text('FASI DI IMPLEMENTAZIONE', 50, 50);
  
  doc.moveTo(50, 80).lineTo(350, 80).stroke(accentColor);

  const phases = [
    {
      num: '1',
      title: 'FONDAMENTA',
      duration: '2 Sprint',
      items: ['Schema database per formazione', 'API REST per corsi, iscrizioni, certificazioni', 'Pannello admin: catalogo corsi e calendario', 'Sistema notifiche scadenze']
    },
    {
      num: '2',
      title: 'APP MOBILE',
      duration: '2 Sprint',
      items: ['Portafoglio certificazioni personale', 'Sistema iscrizione corsi', 'Notifiche push scadenze', 'Check-in QR code']
    },
    {
      num: '3',
      title: 'APPRENDIMENTO',
      duration: '2 Sprint',
      items: ['Player microlearning', 'Sistema quiz e valutazioni', 'Simulatore scenari', 'Contenuti offline']
    },
    {
      num: '4',
      title: 'GAMIFICATION',
      duration: '2 Sprint',
      items: ['Sistema XP e livelli', 'Badge e classifiche', 'Sfide di squadra', 'Dashboard analytics avanzata']
    }
  ];

  yPos = 110;
  phases.forEach(phase => {
    // Phase box
    doc.fillColor(primaryColor).rect(50, yPos, 40, 40).fill();
    doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold').text(phase.num, 60, yPos + 10);
    
    doc.fillColor(primaryColor).fontSize(14).text(phase.title, 100, yPos);
    doc.fillColor(accentColor).fontSize(10).font('Helvetica').text(phase.duration, 100, yPos + 18);
    
    yPos += 45;
    phase.items.forEach(item => {
      doc.fillColor(textColor).fontSize(10).text(`• ${item}`, 100, yPos);
      yPos += 15;
    });
    yPos += 15;
  });

  // Final page
  doc.addPage();
  
  doc.rect(0, 0, doc.page.width, doc.page.height).fill('#1a365d');
  
  doc.fillColor('#ffffff')
     .fontSize(28)
     .font('Helvetica-Bold')
     .text('CROCE EUROPA ACADEMY', 50, 250, { align: 'center' });
  
  doc.fontSize(16)
     .font('Helvetica')
     .text('Il futuro della formazione', 50, 300, { align: 'center' })
     .text('nel soccorso sanitario', 50, 325, { align: 'center' });
  
  doc.fontSize(12)
     .text('Preparati. Competenti. Pronti.', 50, 400, { align: 'center' });
  
  doc.fontSize(10)
     .text('CROCE EUROPA S.R.L. IMPRESA SOCIALE', 50, 650, { align: 'center' })
     .text('www.croceeuropa.org', 50, 670, { align: 'center' });

  doc.end();
}
