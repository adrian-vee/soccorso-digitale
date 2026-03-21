import PDFDocument from "pdfkit";
import { Response } from "express";
import crypto from "crypto";

const GREEN = "#00A651";
const GREEN_LIGHT = "#E8F5E9";
const GREEN_DARK = "#007A3D";
const AMBER = "#D97706";
const AMBER_LIGHT = "#FFF8E1";
const DARK = "#1A1A1A";
const GRAY = "#6B7280";
const LIGHT_GRAY = "#F3F4F6";
const BORDER = "#E5E7EB";
const RED = "#DC2626";
const VALID_GREEN = "#16A34A";
const WHITE = "#FFFFFF";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

interface VolunteerPDFData {
  id: string;
  progressiveNumber: number;
  firstName: string;
  lastName: string;
  fiscalCode: string | null;
  birthDate: string | null;
  birthPlace: string | null;
  gender: string | null;
  residenceAddress: string | null;
  residenceCity: string | null;
  residenceProvince: string | null;
  residencePostalCode: string | null;
  phone: string | null;
  email: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  volunteerType: string;
  status: string;
  startDate: string;
  startSignatureConfirmed: boolean | null;
  startSignatureDate: Date | null;
  endDate: string | null;
  endSignatureConfirmed: boolean | null;
  endSignatureDate: Date | null;
  endReason: string | null;
  insuranceNotified: boolean | null;
  insuranceNotifiedDate: string | null;
  insurancePolicyNumber: string | null;
  role: string | null;
  qualifications: string | null;
  notes: string | null;
  integrityHash: string | null;
  integritySignedAt: Date | null;
  integrityAlgorithm: string | null;
  integrityStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface OrgInfo {
  name: string;
  legalName?: string | null;
  legalRepRole?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  fiscalCode?: string | null;
  vatNumber?: string | null;
  pec?: string | null;
}

export interface DigitalSignatureData {
  volunteerSignatureData?: string | null;
  volunteerSignedAt?: Date | null;
  volunteerName?: string | null;
  orgSignatureData?: string | null;
  orgSignedAt?: Date | null;
  orgSignerName?: string | null;
  status?: string | null;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "\u2014";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatDateTime(date: Date | null | undefined): string {
  if (!date) return "\u2014";
  try {
    return new Date(date).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "\u2014";
  }
}

function volunteerTypeLabel(type: string): string {
  return type === "continuativo" ? "Continuativo" : "Occasionale";
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = { active: "Attivo", suspended: "Sospeso", terminated: "Cessato" };
  return labels[status] || status;
}

function val(v: string | null | undefined): string {
  return v && v.trim() ? v.trim() : "\u2014";
}

function padNumber(n: number, len: number = 3): string {
  return String(n).padStart(len, "0");
}

export function generateSingleVolunteerPDF(res: Response, volunteer: VolunteerPDFData, org: OrgInfo, digitalSignature?: DigitalSignatureData | null): void {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    bufferPages: true,
    info: {
      Title: `Registro Volontari - ${volunteer.lastName} ${volunteer.firstName}`,
      Author: org.name,
      Subject: "Registro Volontari Elettronico - Art. 17 CTS",
      Creator: "soccorsodigitale.app",
    },
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="Volontario_${volunteer.progressiveNumber}_${volunteer.lastName}_${volunteer.firstName}.pdf"`
  );
  doc.pipe(res);

  let y = 0;

  const headerH = 72;
  doc.rect(0, 0, PAGE_WIDTH, headerH).fill(GREEN);
  doc.rect(0, headerH - 4, PAGE_WIDTH, 4).fill(GREEN_DARK);

  doc.fontSize(17).fillColor(WHITE).font("Helvetica-Bold");
  doc.text("REGISTRO VOLONTARI ELETTRONICO", MARGIN, 16, { width: CONTENT_WIDTH });
  doc.fontSize(8.5).fillColor("#E0F2E9").font("Helvetica");
  doc.text(org.legalName || org.name, MARGIN, 38, { width: CONTENT_WIDTH });
  doc.text("Art. 17 D.Lgs. 117/2017 - D.M. 6 ottobre 2021", MARGIN, 50, { width: CONTENT_WIDTH });
  y = headerH;

  const legalH = 32;
  doc.rect(0, y, PAGE_WIDTH, legalH).fill(LIGHT_GRAY);
  doc.rect(0, y + legalH - 0.5, PAGE_WIDTH, 0.5).fill(BORDER);
  doc.fontSize(6.5).fillColor(GRAY).font("Helvetica-Oblique");
  doc.text(
    "Registro tenuto in formato elettronico ai sensi dell'Art. 17 del Codice del Terzo Settore (D.Lgs. 117/2017) e del D.M. 6 ottobre 2021. " +
      "Integrit\u00e0, autenticit\u00e0 e immodificabilit\u00e0 garantite tramite firma crittografica HMAC-SHA256 con timestamp digitale.",
    MARGIN,
    y + 8,
    { width: CONTENT_WIDTH }
  );
  y += legalH;

  y += 6;
  const stripH = 36;
  doc.rect(MARGIN, y, CONTENT_WIDTH, stripH).fill(GREEN_LIGHT);
  doc.rect(MARGIN, y, 3, stripH).fill(GREEN);

  doc.fontSize(16).fillColor(GREEN_DARK).font("Helvetica-Bold");
  doc.text(`N. ${padNumber(volunteer.progressiveNumber)}`, MARGIN + 12, y + 9);

  doc.fontSize(13).fillColor(DARK).font("Helvetica-Bold");
  doc.text(`${volunteer.lastName} ${volunteer.firstName}`, MARGIN + 80, y + 10, { width: CONTENT_WIDTH - 200 });

  const typeIsContin = volunteer.volunteerType === "continuativo";
  const badgeColor = typeIsContin ? GREEN : AMBER;
  const badgeBg = typeIsContin ? GREEN_LIGHT : AMBER_LIGHT;
  const badgeText = typeIsContin ? "CONTINUATIVO" : "OCCASIONALE";
  const badgeW = 95;
  const badgeX = MARGIN + CONTENT_WIDTH - badgeW - 4;
  doc.roundedRect(badgeX, y + 8, badgeW, 20, 3).fill(badgeBg);
  doc.roundedRect(badgeX, y + 8, badgeW, 20, 3).lineWidth(0.8).strokeColor(badgeColor).stroke();
  doc.fontSize(7.5).fillColor(badgeColor).font("Helvetica-Bold");
  doc.text(badgeText, badgeX, y + 14, { width: badgeW, align: "center" });
  y += stripH + 10;

  const col1 = MARGIN;
  const col2 = MARGIN + CONTENT_WIDTH / 2 + 5;
  const colW = CONTENT_WIDTH / 2 - 5;

  function drawSectionHeader(title: string) {
    doc.rect(MARGIN, y, 3, 14).fill(GREEN);
    doc.fontSize(9.5).fillColor(GREEN_DARK).font("Helvetica-Bold");
    doc.text(title, MARGIN + 10, y + 1);
    y += 20;
  }

  function drawFieldPair(
    label1: string,
    value1: string | null,
    label2: string | null,
    value2: string | null,
    fullWidth: boolean = false
  ) {
    doc.fontSize(6.5).fillColor(GRAY).font("Helvetica");
    doc.text(label1.toUpperCase(), col1, y);
    doc.fontSize(9).fillColor(DARK).font("Helvetica-Bold");
    doc.text(val(value1), col1, y + 9, { width: fullWidth ? CONTENT_WIDTH : colW });

    if (label2 !== null && !fullWidth) {
      doc.fontSize(6.5).fillColor(GRAY).font("Helvetica");
      doc.text(label2.toUpperCase(), col2, y);
      doc.fontSize(9).fillColor(DARK).font("Helvetica-Bold");
      doc.text(val(value2), col2, y + 9, { width: colW });
    }

    y += 24;
    doc.moveTo(MARGIN, y - 4).lineTo(MARGIN + CONTENT_WIDTH, y - 4).lineWidth(0.3).strokeColor(BORDER).stroke();
  }

  function checkPageBreak(needed: number) {
    if (y + needed > PAGE_HEIGHT - 90) {
      drawFooter();
      doc.addPage({ size: "A4", margins: { top: 0, bottom: 0, left: 0, right: 0 } });
      y = MARGIN;
    }
  }

  function drawFooter() {
    const footerY = PAGE_HEIGHT - 28;
    doc.rect(0, footerY - 4, PAGE_WIDTH, 32).fill(LIGHT_GRAY);
    doc.fontSize(6).fillColor(GRAY).font("Helvetica");
    doc.text(
      `Documento generato elettronicamente da soccorsodigitale.app il ${new Date().toLocaleString("it-IT")} - ID: ${volunteer.id}`,
      MARGIN,
      footerY + 2,
      { width: CONTENT_WIDTH, align: "center" }
    );
  }

  drawSectionHeader("DATI ANAGRAFICI");
  drawFieldPair("Cognome", volunteer.lastName, "Nome", volunteer.firstName);
  drawFieldPair("Codice Fiscale", volunteer.fiscalCode, "Data di Nascita", formatDate(volunteer.birthDate));
  drawFieldPair(
    "Luogo di Nascita",
    volunteer.birthPlace,
    "Sesso",
    volunteer.gender === "M" ? "Maschio" : volunteer.gender === "F" ? "Femmina" : null
  );

  checkPageBreak(100);
  drawSectionHeader("RESIDENZA / DOMICILIO");
  drawFieldPair("Indirizzo", volunteer.residenceAddress, null, null, true);
  drawFieldPair("Citt\u00e0", volunteer.residenceCity, "Provincia", volunteer.residenceProvince);
  drawFieldPair("CAP", volunteer.residencePostalCode, null, null);

  checkPageBreak(80);
  drawSectionHeader("CONTATTI");
  drawFieldPair("Telefono", volunteer.phone, "Email", volunteer.email);

  checkPageBreak(80);
  drawSectionHeader("CONTATTO DI EMERGENZA");
  drawFieldPair("Nome Contatto", volunteer.emergencyContactName, "Telefono Emergenza", volunteer.emergencyContactPhone);
  drawFieldPair("Relazione", volunteer.emergencyContactRelation, null, null);

  checkPageBreak(120);
  drawSectionHeader("ATTIVIT\u00c0 DI VOLONTARIATO");
  drawFieldPair("Tipo Volontario", volunteerTypeLabel(volunteer.volunteerType), "Stato", statusLabel(volunteer.status));
  drawFieldPair("Data Inizio Attivit\u00e0", formatDate(volunteer.startDate), "Firma Inizio", volunteer.startSignatureConfirmed ? `Confermata il ${formatDateTime(volunteer.startSignatureDate)}` : "Non confermata");
  drawFieldPair(
    "Data Fine Attivit\u00e0",
    formatDate(volunteer.endDate),
    "Firma Fine",
    volunteer.endDate
      ? volunteer.endSignatureConfirmed
        ? `Confermata il ${formatDateTime(volunteer.endSignatureDate)}`
        : "Non confermata"
      : null
  );
  drawFieldPair("Motivo Cessazione", volunteer.endReason, null, null, true);
  drawFieldPair("Ruolo", volunteer.role, "Qualifiche", volunteer.qualifications);

  checkPageBreak(80);
  drawSectionHeader("ASSICURAZIONE");
  drawFieldPair("Comunicata Assicurazione", volunteer.insuranceNotified ? "S\u00ec" : "No", "Data Comunicazione", formatDate(volunteer.insuranceNotifiedDate));
  drawFieldPair("Numero Polizza", volunteer.insurancePolicyNumber, null, null);

  checkPageBreak(60);
  drawSectionHeader("NOTE");
  const notesText = val(volunteer.notes);
  doc.fontSize(8.5).fillColor(DARK).font("Helvetica");
  doc.text(notesText, MARGIN, y, { width: CONTENT_WIDTH });
  y += doc.heightOfString(notesText, { width: CONTENT_WIDTH }) + 12;

  checkPageBreak(90);
  const intStatus = volunteer.integrityStatus || "NOT_SIGNED";
  let intColor = GRAY;
  let intBg = LIGHT_GRAY;
  let intLabel = "NON FIRMATO";
  let intIcon = "?";

  if (intStatus === "VALID") {
    intColor = VALID_GREEN;
    intBg = "#F0FDF4";
    intLabel = "INTEGRIT\u00c0 VERIFICATA";
    intIcon = "\u2713";
  } else if (intStatus === "BROKEN") {
    intColor = RED;
    intBg = "#FEF2F2";
    intLabel = "INTEGRIT\u00c0 COMPROMESSA";
    intIcon = "\u2717";
  }

  const cardH = 68;
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, cardH, 4).fill(intBg);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, cardH, 4).lineWidth(1).strokeColor(intColor).stroke();
  doc.rect(MARGIN, y, 4, cardH).fill(intColor);

  doc.fontSize(13).fillColor(intColor).font("Helvetica-Bold");
  doc.text(`${intIcon}  ${intLabel}`, MARGIN + 14, y + 10);

  doc.fontSize(7).fillColor(GRAY).font("Helvetica");
  if (volunteer.integrityHash) {
    doc.text(`Hash: ${volunteer.integrityHash}`, MARGIN + 14, y + 30, { width: CONTENT_WIDTH - 28 });
  } else {
    doc.text("Hash: \u2014", MARGIN + 14, y + 30);
  }
  doc.text(
    `Firmato il: ${formatDateTime(volunteer.integritySignedAt)}    |    Algoritmo: ${volunteer.integrityAlgorithm || "HMAC-SHA256"}`,
    MARGIN + 14,
    y + 44,
    { width: CONTENT_WIDTH - 28 }
  );
  y += cardH + 20;

  checkPageBreak(digitalSignature?.volunteerSignatureData || digitalSignature?.orgSignatureData ? 140 : 80);

  const sigY = y;
  const sigW = CONTENT_WIDTH / 2 - 20;
  const hasVolSig = digitalSignature?.volunteerSignatureData;
  const hasOrgSig = digitalSignature?.orgSignatureData;

  // --- Volunteer Signature ---
  doc.fontSize(8).fillColor(DARK).font("Helvetica-Bold");
  doc.text("Firma del Volontario", MARGIN, sigY);

  if (hasVolSig) {
    try {
      const sigBase64 = digitalSignature!.volunteerSignatureData!.replace(/^data:image\/\w+;base64,/, "");
      const sigBuffer = Buffer.from(sigBase64, "base64");
      const sigImgY = sigY + 14;
      doc.roundedRect(MARGIN, sigImgY, sigW, 60, 4).lineWidth(0.5).strokeColor(BORDER).stroke();
      doc.image(sigBuffer, MARGIN + 4, sigImgY + 4, { width: sigW - 8, height: 52, fit: [sigW - 8, 52] });
      doc.fontSize(7).fillColor(VALID_GREEN).font("Helvetica-Bold");
      doc.text("Firmato digitalmente", MARGIN, sigImgY + 66);
      doc.fontSize(7).fillColor(GRAY).font("Helvetica");
      doc.text(`Nome: ${digitalSignature?.volunteerName || volunteer.firstName + " " + volunteer.lastName}`, MARGIN, sigImgY + 78);
      doc.text(`Data: ${formatDateTime(digitalSignature?.volunteerSignedAt)}`, MARGIN, sigImgY + 90);
    } catch {
      doc.moveTo(MARGIN, sigY + 44).lineTo(MARGIN + sigW, sigY + 44).dash(3, { space: 3 }).lineWidth(0.6).strokeColor(GRAY).stroke();
      doc.undash();
      doc.fontSize(7).fillColor(GRAY).font("Helvetica");
      doc.text("Nome: ____________________________", MARGIN, sigY + 50);
      doc.text("Data: ____________________________", MARGIN, sigY + 62);
    }
  } else {
    doc.moveTo(MARGIN, sigY + 44).lineTo(MARGIN + sigW, sigY + 44).dash(3, { space: 3 }).lineWidth(0.6).strokeColor(GRAY).stroke();
    doc.undash();
    doc.fontSize(7).fillColor(GRAY).font("Helvetica");
    doc.text("Nome: ____________________________", MARGIN, sigY + 50);
    doc.text("Data: ____________________________", MARGIN, sigY + 62);
  }

  // --- Organization Signature ---
  const sigX2 = MARGIN + CONTENT_WIDTH / 2 + 20;
  let orgRoleLabel = org.legalRepRole || "";
  if (!orgRoleLabel && digitalSignature?.orgSignerName) {
    const roleMatch = digitalSignature.orgSignerName.match(/\(([^)]+)\)/);
    if (roleMatch) orgRoleLabel = roleMatch[1];
  }
  if (!orgRoleLabel) orgRoleLabel = "Legale Rappresentante";
  doc.fontSize(8).fillColor(DARK).font("Helvetica-Bold");
  doc.text(`Firma ${orgRoleLabel}`, sigX2, sigY, { width: CONTENT_WIDTH / 2 - 20 });

  if (hasOrgSig) {
    try {
      const orgBase64 = digitalSignature!.orgSignatureData!.replace(/^data:image\/\w+;base64,/, "");
      const orgBuffer = Buffer.from(orgBase64, "base64");
      const orgImgY = sigY + 14;
      doc.roundedRect(sigX2, orgImgY, sigW, 60, 4).lineWidth(0.5).strokeColor(BORDER).stroke();
      doc.image(orgBuffer, sigX2 + 4, orgImgY + 4, { width: sigW - 8, height: 52, fit: [sigW - 8, 52] });
      doc.fontSize(7).fillColor(VALID_GREEN).font("Helvetica-Bold");
      doc.text("Firmato digitalmente", sigX2, orgImgY + 66);
      doc.fontSize(7).fillColor(GRAY).font("Helvetica");
      doc.text(`Nome: ${digitalSignature?.orgSignerName || "Responsabile"}`, sigX2, orgImgY + 78);
      doc.text(`Data: ${formatDateTime(digitalSignature?.orgSignedAt)}`, sigX2, orgImgY + 90);
    } catch {
      doc.moveTo(sigX2, sigY + 44).lineTo(sigX2 + sigW, sigY + 44).dash(3, { space: 3 }).lineWidth(0.6).strokeColor(GRAY).stroke();
      doc.undash();
      doc.fontSize(7).fillColor(GRAY).font("Helvetica");
      doc.text("Nome: ____________________________", sigX2, sigY + 50);
      doc.text("Data: ____________________________", sigX2, sigY + 62);
    }
  } else {
    doc.moveTo(sigX2, sigY + 44).lineTo(sigX2 + sigW, sigY + 44).dash(3, { space: 3 }).lineWidth(0.6).strokeColor(GRAY).stroke();
    doc.undash();
    doc.fontSize(7).fillColor(GRAY).font("Helvetica");
    doc.text("Nome: ____________________________", sigX2, sigY + 50);
    doc.text("Data: ____________________________", sigX2, sigY + 62);
  }

  // Digital signature status badge
  if (digitalSignature && (hasVolSig || hasOrgSig)) {
    const badgeY = sigY + (hasVolSig || hasOrgSig ? 120 : 74);
    const allSigned = hasVolSig && hasOrgSig;
    const badgeColor = allSigned ? VALID_GREEN : AMBER;
    const badgeBg = allSigned ? "#F0FDF4" : AMBER_LIGHT;
    const badgeText = allSigned
      ? "DOCUMENTO FIRMATO DIGITALMENTE DA ENTRAMBE LE PARTI"
      : hasVolSig
        ? "IN ATTESA DELLA FIRMA DELL'ORGANIZZAZIONE"
        : "IN ATTESA DELLA FIRMA DEL VOLONTARIO";
    doc.roundedRect(MARGIN, badgeY, CONTENT_WIDTH, 22, 4).fill(badgeBg);
    doc.roundedRect(MARGIN, badgeY, CONTENT_WIDTH, 22, 4).lineWidth(0.5).strokeColor(badgeColor).stroke();
    doc.fontSize(7.5).fillColor(badgeColor).font("Helvetica-Bold");
    doc.text(badgeText, MARGIN, badgeY + 6, { width: CONTENT_WIDTH, align: "center" });
  }

  drawFooter();

  doc.end();
}

export function generateFullRegistryPDF(res: Response, volunteers: VolunteerPDFData[], org: OrgInfo): void {
  const doc = new PDFDocument({
    size: "A4",
    layout: "portrait",
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    bufferPages: true,
    info: {
      Title: `Registro Volontari - ${org.name}`,
      Author: org.name,
      Subject: "Registro Volontari Elettronico Completo - Art. 17 CTS",
      Creator: "soccorsodigitale.app",
    },
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="Registro_Volontari_${org.name.replace(/\s+/g, "_")}.pdf"`);
  doc.pipe(res);

  const activeCount = volunteers.filter((v) => v.status === "active").length;
  const contCount = volunteers.filter((v) => v.volunteerType === "continuativo").length;
  const occasCount = volunteers.length - contCount;
  const validCount = volunteers.filter((v) => v.integrityStatus === "VALID").length;
  const genDate = new Date().toLocaleString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const coverHeaderH = 160;
  doc.rect(0, 0, PAGE_WIDTH, coverHeaderH).fill(GREEN);
  doc.rect(0, coverHeaderH - 5, PAGE_WIDTH, 5).fill(GREEN_DARK);

  doc.fontSize(10).fillColor("#E0F2E9").font("Helvetica");
  doc.text(org.legalName || org.name, MARGIN, 30, { width: CONTENT_WIDTH });

  doc.fontSize(28).fillColor(WHITE).font("Helvetica-Bold");
  doc.text("REGISTRO DEI VOLONTARI", MARGIN, 60, { width: CONTENT_WIDTH });

  doc.fontSize(10).fillColor("#E0F2E9").font("Helvetica");
  doc.text("Art. 17 D.Lgs. 117/2017 - D.M. 6 ottobre 2021", MARGIN, 100, { width: CONTENT_WIDTH });
  doc.text("Codice del Terzo Settore - Registro Elettronico", MARGIN, 114, { width: CONTENT_WIDTH });

  let cy = coverHeaderH + 30;

  if (org.address || org.city) {
    doc.fontSize(9).fillColor(GRAY).font("Helvetica");
    const addr = [org.address, org.city, org.province ? `(${org.province})` : null].filter(Boolean).join(", ");
    doc.text(`Sede: ${addr}`, MARGIN, cy, { width: CONTENT_WIDTH });
    cy += 14;
  }
  if (org.fiscalCode) {
    doc.fontSize(9).fillColor(GRAY).font("Helvetica");
    doc.text(`C.F.: ${org.fiscalCode}${org.vatNumber ? "  |  P.IVA: " + org.vatNumber : ""}${org.pec ? "  |  PEC: " + org.pec : ""}`, MARGIN, cy, { width: CONTENT_WIDTH });
    cy += 14;
  }
  cy += 20;

  const statsBoxY = cy;
  const statsBoxH = 110;
  doc.roundedRect(MARGIN, statsBoxY, CONTENT_WIDTH, statsBoxH, 6).fill(LIGHT_GRAY);
  doc.roundedRect(MARGIN, statsBoxY, CONTENT_WIDTH, statsBoxH, 6).lineWidth(0.8).strokeColor(BORDER).stroke();
  doc.rect(MARGIN, statsBoxY, 4, statsBoxH).fill(GREEN);

  doc.fontSize(10).fillColor(GREEN_DARK).font("Helvetica-Bold");
  doc.text("RIEPILOGO REGISTRO", MARGIN + 16, statsBoxY + 12);

  const statCol1 = MARGIN + 16;
  const statCol2 = MARGIN + CONTENT_WIDTH / 2;

  const drawStat = (label: string, value: string | number, x: number, sy: number) => {
    doc.fontSize(8).fillColor(GRAY).font("Helvetica");
    doc.text(label, x, sy);
    doc.fontSize(14).fillColor(DARK).font("Helvetica-Bold");
    doc.text(String(value), x, sy + 11);
  };

  drawStat("Totale Volontari Iscritti", volunteers.length, statCol1, statsBoxY + 32);
  drawStat("Volontari Attivi", activeCount, statCol2, statsBoxY + 32);
  drawStat("Continuativi", contCount, statCol1, statsBoxY + 68);
  drawStat("Occasionali", occasCount, statCol2, statsBoxY + 68);

  doc.fontSize(8).fillColor(VALID_GREEN).font("Helvetica-Bold");
  doc.text(`Integrit\u00e0 verificata: ${validCount} / ${volunteers.length}`, MARGIN + CONTENT_WIDTH - 180, statsBoxY + 90, { width: 164, align: "right" });

  cy = statsBoxY + statsBoxH + 30;

  doc.fontSize(9).fillColor(DARK).font("Helvetica");
  doc.text(`Documento generato il: ${genDate}`, MARGIN, cy);
  cy += 20;

  doc.fontSize(7.5).fillColor(GRAY).font("Helvetica-Oblique");
  doc.text(
    "Registro tenuto in formato elettronico ai sensi dell'Art. 17 del Codice del Terzo Settore (D.Lgs. 117/2017) e del D.M. 6 ottobre 2021. " +
      "L'integrit\u00e0, l'autenticit\u00e0 e l'immodificabilit\u00e0 delle registrazioni sono garantite tramite firma crittografica HMAC-SHA256 con timestamp digitale. " +
      "Il presente documento costituisce stampa del registro elettronico e ha valore ai fini degli adempimenti previsti dalla normativa vigente.",
    MARGIN,
    cy,
    { width: CONTENT_WIDTH }
  );

  const LW = 841.89;
  const LH = 595.28;
  const LM = 30;
  const LCW = LW - LM * 2;

  doc.addPage({ size: "A4", layout: "landscape", margins: { top: 0, bottom: 0, left: 0, right: 0 } });

  const cols = [
    { label: "N.", w: 35 },
    { label: "Cognome e Nome", w: 160 },
    { label: "Codice Fiscale", w: 130 },
    { label: "Tipo", w: 80 },
    { label: "Stato", w: 65 },
    { label: "Data Inizio", w: 75 },
    { label: "Data Fine", w: 75 },
    { label: "Integrit\u00e0", w: 100 },
  ];

  const totalW = cols.reduce((s, c) => s + c.w, 0);
  const tableX = LM + (LCW - totalW) / 2;
  const rowH = 24;

  let ty = 0;

  function drawLandscapeHeader() {
    doc.rect(0, 0, LW, 48).fill(GREEN);
    doc.rect(0, 44, LW, 4).fill(GREEN_DARK);
    doc.fontSize(13).fillColor(WHITE).font("Helvetica-Bold");
    doc.text("REGISTRO DEI VOLONTARI", LM, 10, { width: LCW });
    doc.fontSize(8).fillColor("#E0F2E9").font("Helvetica");
    doc.text(`${org.legalName || org.name}  |  Art. 17 D.Lgs. 117/2017`, LM, 28, { width: LCW });
    ty = 58;
  }

  function drawTableHeader() {
    doc.rect(tableX, ty, totalW, rowH).fill(GREEN);
    let cx = tableX;
    for (const col of cols) {
      doc.fontSize(8).fillColor(WHITE).font("Helvetica-Bold");
      doc.text(col.label, cx + 5, ty + 7, { width: col.w - 10 });
      cx += col.w;
    }
    ty += rowH;
  }

  drawLandscapeHeader();
  drawTableHeader();

  const sorted = [...volunteers].sort((a, b) => a.progressiveNumber - b.progressiveNumber);

  for (let i = 0; i < sorted.length; i++) {
    if (ty + rowH > LH - 40) {
      doc.addPage({ size: "A4", layout: "landscape", margins: { top: 0, bottom: 0, left: 0, right: 0 } });
      drawLandscapeHeader();
      drawTableHeader();
    }

    const v = sorted[i];
    const bgColor = i % 2 === 0 ? WHITE : LIGHT_GRAY;
    doc.rect(tableX, ty, totalW, rowH).fill(bgColor);
    doc.rect(tableX, ty, totalW, rowH).lineWidth(0.3).strokeColor(BORDER).stroke();

    let cx = tableX;
    const textY = ty + 7;

    doc.fontSize(8).fillColor(DARK).font("Helvetica-Bold");
    doc.text(padNumber(v.progressiveNumber), cx + 5, textY, { width: cols[0].w - 10 });
    cx += cols[0].w;

    doc.font("Helvetica").text(`${v.lastName} ${v.firstName}`, cx + 5, textY, { width: cols[1].w - 10 });
    cx += cols[1].w;

    doc.fontSize(7.5).text(val(v.fiscalCode), cx + 5, textY, { width: cols[2].w - 10 });
    cx += cols[2].w;

    const typeColor = v.volunteerType === "continuativo" ? GREEN : AMBER;
    doc.fontSize(8).fillColor(typeColor).font("Helvetica-Bold");
    doc.text(volunteerTypeLabel(v.volunteerType), cx + 5, textY, { width: cols[3].w - 10 });
    cx += cols[3].w;

    const statColor = v.status === "active" ? VALID_GREEN : v.status === "terminated" ? RED : AMBER;
    doc.fillColor(statColor).font("Helvetica");
    doc.text(statusLabel(v.status), cx + 5, textY, { width: cols[4].w - 10 });
    cx += cols[4].w;

    doc.fillColor(DARK).font("Helvetica");
    doc.text(formatDate(v.startDate), cx + 5, textY, { width: cols[5].w - 10 });
    cx += cols[5].w;

    doc.text(v.endDate ? formatDate(v.endDate) : "\u2014", cx + 5, textY, { width: cols[6].w - 10 });
    cx += cols[6].w;

    const intSt = v.integrityStatus || "NOT_SIGNED";
    const intC = intSt === "VALID" ? VALID_GREEN : intSt === "BROKEN" ? RED : GRAY;
    const intL = intSt === "VALID" ? "\u2713 Verificato" : intSt === "BROKEN" ? "\u2717 Compromesso" : "Non firmato";
    doc.fillColor(intC).font("Helvetica-Bold");
    doc.text(intL, cx + 5, textY, { width: cols[7].w - 10 });

    ty += rowH;
  }

  doc.addPage({ size: "A4", layout: "portrait", margins: { top: 0, bottom: 0, left: 0, right: 0 } });

  const fHeaderH = 60;
  doc.rect(0, 0, PAGE_WIDTH, fHeaderH).fill(GREEN);
  doc.rect(0, fHeaderH - 4, PAGE_WIDTH, 4).fill(GREEN_DARK);
  doc.fontSize(14).fillColor(WHITE).font("Helvetica-Bold");
  doc.text("CERTIFICAZIONE E NOTE LEGALI", MARGIN, 20, { width: CONTENT_WIDTH });

  let fy = fHeaderH + 30;

  doc.fontSize(10).fillColor(DARK).font("Helvetica-Bold");
  doc.text("ATTESTAZIONE DI CONFORMIT\u00c0", MARGIN, fy);
  fy += 18;

  doc.fontSize(8.5).fillColor(DARK).font("Helvetica");
  doc.text(
    "Il presente Registro dei Volontari \u00e8 tenuto in formato elettronico ai sensi dell'Art. 17 del Codice del Terzo Settore " +
      "(D.Lgs. n. 117/2017) e del Decreto del Ministro del Lavoro e delle Politiche Sociali del 6 ottobre 2021.",
    MARGIN,
    fy,
    { width: CONTENT_WIDTH }
  );
  fy += 40;

  doc.text(
    "Le registrazioni contenute nel presente documento sono state generate e conservate in formato digitale con garanzia di " +
      "integrit\u00e0, autenticit\u00e0 e immodificabilit\u00e0 assicurate tramite firma crittografica HMAC-SHA256 con timestamp digitale certificato.",
    MARGIN,
    fy,
    { width: CONTENT_WIDTH }
  );
  fy += 40;

  doc.text(
    `Il registro comprende ${volunteers.length} volontari iscritti, di cui ${activeCount} attivi alla data di generazione del presente documento.`,
    MARGIN,
    fy,
    { width: CONTENT_WIDTH }
  );
  fy += 30;

  doc.text(`Documento generato il: ${genDate}`, MARGIN, fy);
  fy += 30;

  const regRoleLabel = org.legalRepRole || "Legale Rappresentante";
  doc.text(`Il sottoscritto, in qualit\u00e0 di ${regRoleLabel} dell'organizzazione, attesta la conformit\u00e0 del presente registro alle disposizioni vigenti.`, MARGIN, fy, { width: CONTENT_WIDTH });
  fy += 50;

  const fSigW = CONTENT_WIDTH / 2 - 20;
  doc.moveTo(MARGIN, fy + 30).lineTo(MARGIN + fSigW, fy + 30).dash(3, { space: 3 }).lineWidth(0.6).strokeColor(GRAY).stroke();
  doc.undash();
  doc.fontSize(8).fillColor(DARK).font("Helvetica-Bold");
  doc.text(`Il ${regRoleLabel}`, MARGIN, fy + 34);
  doc.fontSize(7).fillColor(GRAY).font("Helvetica");
  doc.text("Nome: ____________________________", MARGIN, fy + 48);
  doc.text("Data: ____________________________", MARGIN, fy + 60);

  const fSigX2 = MARGIN + CONTENT_WIDTH / 2 + 20;
  doc.moveTo(fSigX2, fy + 30).lineTo(fSigX2 + fSigW, fy + 30).dash(3, { space: 3 }).lineWidth(0.6).strokeColor(GRAY).stroke();
  doc.undash();
  doc.fontSize(8).fillColor(DARK).font("Helvetica-Bold");
  doc.text("Timbro dell'Organizzazione", fSigX2, fy + 34);
  doc.fontSize(7).fillColor(GRAY).font("Helvetica");
  doc.text("Data: ____________________________", fSigX2, fy + 48);

  fy += 100;
  doc.rect(MARGIN, fy, CONTENT_WIDTH, 0.5).fill(BORDER);
  fy += 12;
  doc.fontSize(7).fillColor(GRAY).font("Helvetica-Oblique");
  doc.text(
    "Il presente documento \u00e8 stato generato elettronicamente dalla piattaforma soccorsodigitale.app. " +
      "La stampa del registro elettronico ha valore ai fini degli adempimenti previsti dalla normativa vigente in materia di enti del Terzo Settore. " +
      "L'originale \u00e8 conservato in formato digitale con tutte le garanzie di integrit\u00e0 previste dalla legge.",
    MARGIN,
    fy,
    { width: CONTENT_WIDTH }
  );

  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    const isLandscape = i >= 1 && i < pages.count - 1;
    const pw = isLandscape ? LW : PAGE_WIDTH;
    const ph = isLandscape ? LH : PAGE_HEIGHT;
    const pm = isLandscape ? LM : MARGIN;
    const pcw = pw - pm * 2;

    doc.fontSize(6.5).fillColor(GRAY).font("Helvetica");
    doc.text(`Pagina ${i + 1} di ${pages.count}`, pm, ph - 22, { width: pcw, align: "right" });

    if (isLandscape) {
      doc.text(`${org.legalName || org.name}  -  Registro Volontari`, pm, ph - 22, { width: pcw, align: "left" });
    }
  }

  doc.end();
}
