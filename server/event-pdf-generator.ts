import PDFDocument from 'pdfkit';
import { Response } from 'express';

interface EventData {
  id: string;
  name: string;
  eventType: string;
  location: string;
  address: string | null;
  startDate: string;
  endDate: string | null;
  startTime: string;
  endTime: string | null;
  expectedAttendees: number | null;
  status: string;
  notes: string | null;
  vehicle: {
    code: string;
    licensePlate: string | null;
  } | null;
  crew: Array<{
    name: string;
    role: string;
    phone?: string | null;
  }>;
  coordinator: {
    name: string;
    phone?: string | null;
  } | null;
}

export function generateEventPDF(res: Response, event: EventData) {
  const doc = new PDFDocument({ 
    size: 'A4', 
    margin: 40,
    info: {
      Title: `Servizio Speciale - ${event.name}`,
      Author: 'SOCCORSO DIGITALE S.R.L. Impresa Sociale',
      Subject: 'Foglio di Servizio Evento'
    }
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=Evento_${event.name.replace(/\s+/g, '_')}_${event.startDate}.pdf`);
  doc.pipe(res);

  const primaryColor = '#1a365d';
  const accentColor = '#c53030';
  const successColor = '#38a169';
  const textColor = '#2d3748';
  const lightBg = '#f7fafc';

  // === HEADER WITH LOGO AREA ===
  doc.rect(0, 0, doc.page.width, 100).fill(primaryColor);
  
  // Logo placeholder circle
  doc.circle(70, 50, 30).fill('#ffffff');
  doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text('CE', 55, 43);
  
  // Title
  doc.fillColor('#ffffff')
     .fontSize(22)
     .font('Helvetica-Bold')
     .text('SOCCORSO DIGITALE', 115, 25);
  
  doc.fontSize(12)
     .font('Helvetica')
     .text('S.R.L. Impresa Sociale', 115, 50);
  
  doc.fontSize(14)
     .font('Helvetica-Bold')
     .fillColor(accentColor)
     .text('FOGLIO DI SERVIZIO - EVENTO SPECIALE', 115, 72);

  // === EVENT INFO SECTION ===
  let yPos = 120;
  
  // Event name banner
  doc.rect(40, yPos, 515, 45).fill(lightBg);
  doc.rect(40, yPos, 5, 45).fill(accentColor);
  
  doc.fillColor(primaryColor)
     .fontSize(20)
     .font('Helvetica-Bold')
     .text(event.name.toUpperCase(), 55, yPos + 12);
  
  // Event type badge
  const eventTypeLabel = getEventTypeLabel(event.eventType);
  const badgeWidth = doc.widthOfString(eventTypeLabel) + 20;
  doc.rect(515 - badgeWidth, yPos + 10, badgeWidth, 25).fill(getEventTypeColor(event.eventType));
  doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold').text(eventTypeLabel, 520 - badgeWidth, yPos + 17);

  yPos += 60;

  // === DATE AND TIME BOX ===
  doc.rect(40, yPos, 250, 80).lineWidth(1).stroke('#e2e8f0');
  doc.rect(40, yPos, 250, 25).fill(primaryColor);
  doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold').text('DATA E ORARIO', 50, yPos + 7);
  
  doc.fillColor(textColor).font('Helvetica').fontSize(12);
  const formattedDate = formatDate(event.startDate);
  const formattedEndDate = event.endDate ? formatDate(event.endDate) : null;
  
  doc.font('Helvetica-Bold').text('Data:', 50, yPos + 35);
  doc.font('Helvetica').text(formattedEndDate && formattedEndDate !== formattedDate 
    ? `${formattedDate} - ${formattedEndDate}` 
    : formattedDate, 90, yPos + 35);
  
  doc.font('Helvetica-Bold').text('Orario:', 50, yPos + 55);
  doc.font('Helvetica').text(`${formatTime(event.startTime)} - ${event.endTime ? formatTime(event.endTime) : 'Da definire'}`, 100, yPos + 55);

  // === LOCATION BOX ===
  doc.rect(305, yPos, 250, 80).lineWidth(1).stroke('#e2e8f0');
  doc.rect(305, yPos, 250, 25).fill(successColor);
  doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold').text('LUOGO EVENTO', 315, yPos + 7);
  
  doc.fillColor(textColor).font('Helvetica').fontSize(11);
  doc.text(event.location || 'Non specificato', 315, yPos + 35, { width: 230 });
  if (event.address) {
    doc.fontSize(10).fillColor('#718096').text(event.address, 315, yPos + 55, { width: 230 });
  }

  yPos += 95;

  // === VEHICLE SECTION ===
  doc.rect(40, yPos, 515, 60).lineWidth(1).stroke('#e2e8f0');
  doc.rect(40, yPos, 515, 25).fill('#4299e1');
  doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold').text('MEZZO ASSEGNATO', 50, yPos + 7);
  
  if (event.vehicle) {
    doc.fillColor(textColor).fontSize(14).font('Helvetica-Bold');
    doc.text(event.vehicle.code, 50, yPos + 38);
    doc.font('Helvetica').fontSize(12).fillColor('#718096');
    doc.text(event.vehicle.licensePlate || '', 200, yPos + 40);
  } else {
    doc.fillColor('#a0aec0').fontSize(12).font('Helvetica').text('Nessun mezzo assegnato', 50, yPos + 38);
  }

  yPos += 75;

  // === CREW SECTION ===
  doc.rect(40, yPos, 515, 25).fill(accentColor);
  doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold').text('EQUIPAGGIO', 50, yPos + 7);
  
  const iconX = 520;
  doc.fontSize(10).text(`${event.crew.length} membri`, iconX - 70, yPos + 7);

  yPos += 30;
  
  // Crew table header
  doc.rect(40, yPos, 515, 22).fill('#edf2f7');
  doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold');
  doc.text('NOME', 55, yPos + 6);
  doc.text('RUOLO', 280, yPos + 6);
  doc.text('TELEFONO', 420, yPos + 6);
  
  yPos += 22;
  
  // Crew rows
  if (event.crew.length > 0) {
    event.crew.forEach((member, idx) => {
      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f7fafc';
      doc.rect(40, yPos, 515, 28).fill(rowBg);
      
      // Role icon/badge
      const roleColor = getRoleColor(member.role);
      doc.rect(50, yPos + 5, 8, 18).fill(roleColor);
      
      doc.fillColor(textColor).fontSize(11).font('Helvetica-Bold');
      doc.text(member.name, 65, yPos + 9);
      
      doc.font('Helvetica').fontSize(10).fillColor('#718096');
      doc.text(getRoleLabel(member.role), 280, yPos + 9);
      doc.text(member.phone || '-', 420, yPos + 9);
      
      yPos += 28;
    });
  } else {
    doc.rect(40, yPos, 515, 35).fill('#fffbeb');
    doc.fillColor('#92400e').fontSize(11).font('Helvetica').text('Nessun membro equipaggio assegnato', 55, yPos + 11);
    yPos += 35;
  }

  yPos += 15;

  // === COORDINATOR SECTION ===
  if (event.coordinator) {
    doc.rect(40, yPos, 515, 50).lineWidth(1).stroke('#e2e8f0');
    doc.rect(40, yPos, 515, 22).fill('#805ad5');
    doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold').text('COORDINATORE EVENTO', 50, yPos + 5);
    
    doc.fillColor(textColor).fontSize(12).font('Helvetica-Bold');
    doc.text(event.coordinator.name, 50, yPos + 32);
    if (event.coordinator.phone) {
      doc.font('Helvetica').fontSize(10).fillColor('#718096');
      doc.text(`Tel: ${event.coordinator.phone}`, 300, yPos + 32);
    }
    yPos += 60;
  }

  // === NOTES SECTION ===
  if (event.notes) {
    doc.rect(40, yPos, 515, 25).fill('#faf5ff');
    doc.fillColor('#6b46c1').fontSize(10).font('Helvetica-Bold').text('NOTE', 50, yPos + 7);
    yPos += 28;
    doc.fillColor(textColor).fontSize(10).font('Helvetica');
    doc.text(event.notes, 50, yPos, { width: 495 });
    yPos += 40;
  }

  // === SIGNATURE SECTION ===
  yPos = Math.max(yPos + 20, 650);
  
  doc.rect(40, yPos, 515, 100).lineWidth(1).stroke('#e2e8f0');
  doc.fillColor('#718096').fontSize(9).font('Helvetica').text('FIRME DI SERVIZIO', 50, yPos + 8);
  
  // Signature boxes
  doc.rect(50, yPos + 30, 230, 55).lineWidth(0.5).stroke('#cbd5e0');
  doc.fontSize(8).text('Firma Capo Equipaggio', 55, yPos + 75);
  
  doc.rect(305, yPos + 30, 230, 55).lineWidth(0.5).stroke('#cbd5e0');
  doc.text('Firma Responsabile Evento', 310, yPos + 75);

  // === FOOTER ===
  doc.rect(0, 780, doc.page.width, 62).fill(primaryColor);
  
  doc.fillColor('#a0aec0').fontSize(8).font('Helvetica');
  doc.text(`Documento generato il ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`, 40, 795);
  
  doc.fillColor('#ffffff').fontSize(9);
  doc.text('SOCCORSO DIGITALE S.R.L. Impresa Sociale', 40, 810, { align: 'center', width: 515 });
  doc.fontSize(8).fillColor('#a0aec0');
  doc.text('www.croceeuropa.org', 40, 825, { align: 'center', width: 515 });

  doc.end();
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  return timeStr.substring(0, 5);
}

function getEventTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'calcio': 'CALCIO',
    'pallavolo': 'PALLAVOLO',
    'basket': 'BASKET',
    'ciclismo': 'CICLISMO',
    'maratona': 'MARATONA',
    'concerto': 'CONCERTO',
    'fiera': 'FIERA',
    'manifestazione': 'MANIFESTAZIONE',
    'altro': 'ALTRO'
  };
  return labels[type?.toLowerCase()] || type?.toUpperCase() || 'EVENTO';
}

function getEventTypeColor(type: string): string {
  const colors: Record<string, string> = {
    'calcio': '#38a169',
    'pallavolo': '#d69e2e',
    'basket': '#dd6b20',
    'ciclismo': '#3182ce',
    'maratona': '#805ad5',
    'concerto': '#d53f8c',
    'fiera': '#319795',
    'manifestazione': '#e53e3e',
    'altro': '#718096'
  };
  return colors[type?.toLowerCase()] || '#718096';
}

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    'autista': 'Autista',
    'soccorritore': 'Soccorritore',
    'volontario': 'Volontario',
    'capo_equipaggio': 'Capo Equipaggio',
    'medico': 'Medico',
    'infermiere': 'Infermiere'
  };
  return labels[role?.toLowerCase()] || role || 'Membro';
}

function getRoleColor(role: string): string {
  const colors: Record<string, string> = {
    'autista': '#3182ce',
    'soccorritore': '#38a169',
    'volontario': '#d69e2e',
    'capo_equipaggio': '#805ad5',
    'medico': '#e53e3e',
    'infermiere': '#d53f8c'
  };
  return colors[role?.toLowerCase()] || '#718096';
}
