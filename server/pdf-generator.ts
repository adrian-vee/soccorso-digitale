import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import QRCode from "qrcode";
import { Trip, Vehicle, User, Structure, Department, TripDeviceAuthorization } from "@shared/schema";
import { TripFinancials } from "./cost-calculator";

interface IntegrityData {
  status: "VALID" | "BROKEN" | "NOT_SIGNED";
  signedAt?: string | null;
  algorithm?: string | null;
  verificationUrl?: string;
}

interface TripPDFData {
  trip: Trip;
  vehicle: Vehicle | null | undefined;
  driver: User | null | undefined;
  location: { name: string } | null | undefined;
  financials: TripFinancials | null | undefined;
  originStructure?: Structure | null | undefined;
  destinationStructure?: Structure | null | undefined;
  originDepartment?: Department | null | undefined;
  destinationDepartment?: Department | null | undefined;
  integrity?: IntegrityData;
  organizationName?: string | null;
  organizationLogoPath?: string | null;
}

const COLORS = {
  primary: "#0066CC",
  secondary: "#00A651",
  dark: "#1a1a2e",
  gray: "#6B7280",
  lightGray: "#E5E7EB",
  white: "#FFFFFF",
  error: "#EF4444",
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/A";
  try {
    return new Date(dateStr).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
  } catch { return "N/A"; }
}

function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return "--:--";
  return timeStr.substring(0, 5);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(amount);
}

function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return "N/A";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

function getServiceTypeLabel(st: string | null | undefined): string {
  const t: Record<string, string> = { ordinario: "Ordinario", urgente: "Urgente", emergenza: "Emergenza", dialisi: "Dialisi", dimissione: "Dimissione", visita: "Visita", trasporto_programmato: "Programmato", disabili: "Disabili" };
  return t[st || "ordinario"] || "Trasporto";
}

function getCrewTypeLabel(ct: string | null | undefined): string {
  const t: Record<string, string> = { autista_soccorritore: "Autista + Soccorritore", autista_infermiere: "Autista + Infermiere", driver_rescuer: "Autista + Soccorritore", driver_nurse: "Autista + Infermiere" };
  return t[ct || "autista_soccorritore"] || "Equipaggio";
}

function getOriginTypeLabel(ot: string | null | undefined): string {
  const t: Record<string, string> = { ospedale: "Ospedale", domicilio: "Domicilio", casa_di_riposo: "RSA", sede: "Sede", altro: "Altro" };
  return t[ot || "altro"] || "N/A";
}

export async function generateTripPDF(data: TripPDFData): Promise<PDFKit.PDFDocument> {
  // Pre-generate QR code buffer if needed (before PDF construction)
  let qrBuffer: Buffer | null = null;
  if (data.integrity?.status === "VALID" && data.integrity.verificationUrl) {
    try {
      qrBuffer = await QRCode.toBuffer(data.integrity.verificationUrl, {
        width: 50,
        margin: 1,
        color: { dark: "#065F46", light: "#ECFDF5" }
      });
    } catch (qrError) {
      console.error("QR code generation error:", qrError);
    }
  }
  
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: false });
  
  const L = 40, R = 555, W = R - L;
  let y = 40;

  // HEADER - Organization logo (dynamic per tenant)
  let logoRendered = false;
  if (data.organizationLogoPath && fs.existsSync(data.organizationLogoPath)) {
    try {
      doc.image(data.organizationLogoPath, L, y - 2, { height: 32 });
      logoRendered = true;
    } catch (logoErr) {
      // fallback below
    }
  }
  if (!logoRendered) {
    const orgName = data.organizationName || "SOCCORSO DIGITALE";
    doc.font("Helvetica-Bold").fontSize(16).fillColor(COLORS.dark).text(orgName, L, y + 2, { width: 200 });
    doc.font("Helvetica").fontSize(8).fillColor(COLORS.gray).text("Servizi di Trasporto Sanitario", L, y + 20, { width: 200 });
  }
  
  // Sede in header area (right side)
  doc.font("Helvetica").fontSize(8).fillColor(COLORS.gray).text("Sede:", R - 150, y + 2, { width: 40 });
  doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.dark).text(data.location?.name || "N/A", R - 150, y + 14, { width: 150, align: "left" });
  
  y += 36;
  doc.strokeColor(COLORS.lightGray).lineWidth(0.5).moveTo(L, y).lineTo(R, y).stroke();
  y += 12;

  // TITLE
  const isSenzaPaziente = data.trip.isReturnTrip && !data.trip.progressiveNumber;
  if (isSenzaPaziente) {
    const spLabel = "SENZA PAZIENTE";
    doc.font("Helvetica-Bold").fontSize(8);
    const bw = doc.widthOfString(spLabel) + 12;
    doc.roundedRect(L, y, bw, 14, 3).fill("#B45309");
    doc.fillColor(COLORS.white).text(spLabel, L + 6, y + 3, { width: bw });
    doc.font("Helvetica-Bold").fontSize(14).fillColor("#B45309").text("SENZA PAZIENTE", L + bw + 10, y - 2, { width: 250 });
  } else {
    const svc = getServiceTypeLabel(data.trip.serviceType);
    doc.font("Helvetica-Bold").fontSize(8);
    const bw = doc.widthOfString(svc.toUpperCase()) + 12;
    doc.roundedRect(L, y, bw, 14, 3).fill(COLORS.secondary);
    doc.fillColor(COLORS.white).text(svc.toUpperCase(), L + 6, y + 3, { width: bw });
    doc.font("Helvetica-Bold").fontSize(14).fillColor(COLORS.dark).text(`Servizio #${data.trip.progressiveNumber || "N/A"}`, L + bw + 10, y - 2, { width: 200 });
  }
  doc.font("Helvetica").fontSize(10).fillColor(COLORS.gray).text(formatDate(data.trip.serviceDate), isSenzaPaziente ? L + 140 : L + 10, y + 14, { width: 200 });
  y += 34;

  // TRANSPORT WITHOUT PATIENT BANNER (if applicable)
  if (isSenzaPaziente) {
    doc.roundedRect(L, y, W, 28, 4).fill("#FEF3C7");
    doc.roundedRect(L + 2, y + 2, W - 4, 24, 3).stroke("#F59E0B");
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#B45309").text("TRASPORTO SENZA PAZIENTE", L, y + 8, { width: W, align: "center" });
    y += 36;
  }

  // TRIP DETAILS
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.primary).text("DETTAGLI SERVIZIO", L, y, { width: W });
  y += 14;
  doc.roundedRect(L, y, W, 72, 4).fill("#F9FAFB");

  // 4 columns layout
  const col = W / 4;
  let ry = y + 8;

  // Row 1
  lv(doc, L + 8, ry, col - 10, "Veicolo", data.vehicle?.code || "N/A");
  lv(doc, L + col, ry, col - 10, "Targa", data.vehicle?.licensePlate || "N/A");
  lv(doc, L + col * 2, ry, col - 10, "Partenza", formatTime(data.trip.departureTime));
  lv(doc, L + col * 3, ry, col - 10, "Ritorno", formatTime(data.trip.returnTime));
  ry += 20;

  // Row 2
  lv(doc, L + 8, ry, col * 2 - 10, "Equipaggio", getCrewTypeLabel(data.trip.crewType));
  lv(doc, L + col * 2, ry, col - 10, "Durata", formatDuration(data.trip.durationMinutes));
  lv(doc, L + col * 3, ry, col - 10, "Km Percorsi", `${data.trip.kmTraveled || 0} km`);
  ry += 20;

  // Row 3
  lv(doc, L + 8, ry, col - 10, "Km Inizio", `${data.trip.kmInitial || 0}`);
  lv(doc, L + col, ry, col - 10, "Km Fine", `${data.trip.kmFinal || 0}`);
  if (isSenzaPaziente) {
    lv(doc, L + col * 2, ry, col * 2 - 10, "Tipo", "SENZA PAZIENTE");
  } else {
    lv(doc, L + col * 2, ry, col - 10, "Genere Paz.", data.trip.patientGender || "N/A");
    lv(doc, L + col * 3, ry, col - 10, "Anno Nascita", data.trip.patientBirthYear?.toString() || "N/A");
  }

  y += 82;

  // Ritorno vuoto + Note (if any)
  doc.font("Helvetica").fontSize(8).fillColor(COLORS.gray).text("Ritorno vuoto:", L, y, { width: 80 });
  doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.dark).text(data.trip.isReturnTrip ? "Si" : "No", L + 80, y, { width: 50 });
  if (data.trip.notes) {
    doc.font("Helvetica").fontSize(8).fillColor(COLORS.gray).text("Note:", L + 140, y, { width: 40 });
    doc.font("Helvetica").fontSize(8).fillColor(COLORS.dark).text(data.trip.notes.substring(0, 80), L + 180, y, { width: W - 180 });
  }
  y += 18;

  // ROUTE - stacked cards
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.primary).text("PERCORSO", L, y, { width: W });
  y += 14;

  // Build full origin address
  const oType = getOriginTypeLabel(data.trip.originType);
  let originNameLine = "";
  let originAddressLine = "";
  
  if (data.originStructure) {
    // Hospital/Structure: show name on first line, full address on second line
    originNameLine = data.originStructure.name;
    const structAddr = data.originStructure.address || "";
    const oCity = (data.trip as any).originCity || "";
    const oProv = (data.trip as any).originProvince || "";
    const addressParts = [structAddr, oCity, oProv ? `(${oProv})` : ""].filter(p => p).join(", ");
    originAddressLine = addressParts || "";
  } else {
    // Domicilio: show full address with city and province
    const oAddr = data.trip.originAddress || "";
    const oCity = (data.trip as any).originCity || "";
    const oProv = (data.trip as any).originProvince || "";
    originNameLine = [oAddr, oCity, oProv ? `(${oProv})` : ""].filter(p => p).join(", ") || "N/A";
  }

  // Origin card (full width) - increased height for address line
  const originCardHeight = originAddressLine ? 48 : 36;
  doc.roundedRect(L, y, W, originCardHeight, 4).fill("#ECFDF5");
  doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.secondary).text("ORIGINE", L + 10, y + 6, { width: 80 });
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.dark).text(`${oType}: ${originNameLine}`, L + 10, y + 18, { width: W - 20 });
  if (originAddressLine) {
    doc.font("Helvetica").fontSize(8).fillColor(COLORS.gray).text(originAddressLine, L + 10, y + 32, { width: W - 20 });
  }
  if (data.originDepartment?.name) {
    doc.font("Helvetica").fontSize(8).fillColor(COLORS.gray).text(`Reparto: ${data.originDepartment.name}`, L + 200, y + 6, { width: W - 210 });
  }
  y += originCardHeight + 6;

  // Build full destination address
  const dType = getOriginTypeLabel(data.trip.destinationType);
  let destNameLine = "";
  let destAddressLine = "";
  
  if (data.destinationStructure) {
    // Hospital/Structure: show name on first line, full address on second line
    destNameLine = data.destinationStructure.name;
    const structAddr = data.destinationStructure.address || "";
    const dCity = (data.trip as any).destinationCity || "";
    const dProv = (data.trip as any).destinationProvince || "";
    const addressParts = [structAddr, dCity, dProv ? `(${dProv})` : ""].filter(p => p).join(", ");
    destAddressLine = addressParts || "";
  } else {
    // Domicilio: show full address with city and province
    const dAddr = data.trip.destinationAddress || "";
    const dCity = (data.trip as any).destinationCity || "";
    const dProv = (data.trip as any).destinationProvince || "";
    destNameLine = [dAddr, dCity, dProv ? `(${dProv})` : ""].filter(p => p).join(", ") || "N/A";
  }

  // Destination card (full width) - increased height for address line
  const destCardHeight = destAddressLine ? 48 : 36;
  doc.roundedRect(L, y, W, destCardHeight, 4).fill("#EFF6FF");
  doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.primary).text("DESTINAZIONE", L + 10, y + 6, { width: 100 });
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.dark).text(`${dType}: ${destNameLine}`, L + 10, y + 18, { width: W - 20 });
  if (destAddressLine) {
    doc.font("Helvetica").fontSize(8).fillColor(COLORS.gray).text(destAddressLine, L + 10, y + 32, { width: W - 20 });
  }
  if (data.destinationDepartment?.name) {
    doc.font("Helvetica").fontSize(8).fillColor(COLORS.gray).text(`Reparto: ${data.destinationDepartment.name}`, L + 200, y + 6, { width: W - 210 });
  }
  y += destCardHeight + 10;

  // FINANCIAL
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.primary).text("ANALISI ECONOMICA", L, y, { width: W });
  y += 14;

  const fin = data.financials;
  if (!fin) {
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.gray).text("Dati finanziari non disponibili.", L, y, { width: W });
    y += 14;
  } else {
    // --- DETTAGLIO COSTI (Cost Breakdown Table) ---
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.dark).text("DETTAGLIO COSTI", L, y, { width: W });
    y += 12;

    const costTableX = L;
    const costLabelW = 200;
    const costValW = 80;

    doc.roundedRect(costTableX, y, W, 16, 0).fill("#FEF2F2");
    doc.font("Helvetica-Bold").fontSize(7).fillColor(COLORS.error).text("VOCE", costTableX + 8, y + 4, { width: costLabelW });
    doc.font("Helvetica-Bold").fontSize(7).fillColor(COLORS.error).text("IMPORTO", R - costValW, y + 4, { width: costValW - 8, align: "right" });
    y += 16;

    const costRow = (label: string, amount: number) => {
      doc.font("Helvetica").fontSize(8).fillColor(COLORS.dark).text(label, costTableX + 8, y + 3, { width: costLabelW });
      doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.dark).text(formatCurrency(amount), R - costValW, y + 3, { width: costValW - 8, align: "right" });
      y += 14;
    };

    if (fin.cost.vehicleCosts.fuel > 0) costRow("Carburante", fin.cost.vehicleCosts.fuel);
    if (fin.cost.vehicleCosts.maintenance > 0) costRow("Manutenzione", fin.cost.vehicleCosts.maintenance);
    if (fin.cost.vehicleCosts.insurance > 0) costRow("Assicurazione", fin.cost.vehicleCosts.insurance);
    for (const r of fin.cost.staffCosts.byRole) {
      const roleName = r.role === "autista" ? "Autista" : r.role === "soccorritore" ? "Soccorritore" : r.role === "infermiere" ? "Infermiere" : r.role;
      costRow(`${roleName} (${r.hours.toFixed(1)}h)`, r.cost);
    }

    doc.strokeColor(COLORS.lightGray).lineWidth(0.5).moveTo(costTableX, y).lineTo(R, y).stroke();
    y += 4;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.error).text("TOTALE COSTI", costTableX + 8, y + 2, { width: costLabelW });
    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.error).text(formatCurrency(fin.cost.totalCost), R - costValW, y + 1, { width: costValW - 8, align: "right" });
    y += 18;

    // --- DETTAGLIO RICAVI (Revenue Breakdown) ---
    if (fin.revenue || fin.hourlyRevenue) {
      doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.dark).text("DETTAGLIO RICAVI", L, y, { width: W });
      y += 12;

      doc.roundedRect(costTableX, y, W, 16, 0).fill("#ECFDF5");
      doc.font("Helvetica-Bold").fontSize(7).fillColor(COLORS.secondary).text("VOCE", costTableX + 8, y + 4, { width: costLabelW });
      doc.font("Helvetica-Bold").fontSize(7).fillColor(COLORS.secondary).text("IMPORTO", R - costValW, y + 4, { width: costValW - 8, align: "right" });
      y += 16;

      if (fin.billingType === "hourly" && fin.hourlyRevenue) {
        doc.font("Helvetica").fontSize(8).fillColor(COLORS.dark).text(`${fin.hourlyRevenue.contractName} (${fin.hourlyRevenue.hours.toFixed(2)}h x ${formatCurrency(fin.hourlyRevenue.hourlyRate)}/h)`, costTableX + 8, y + 3, { width: W - costValW - 16 });
        doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.dark).text(formatCurrency(fin.effectiveRevenue), R - costValW, y + 3, { width: costValW - 8, align: "right" });
        y += 14;
      } else if (fin.revenue) {
        if (fin.revenue.contractName) {
          doc.font("Helvetica").fontSize(8).fillColor(COLORS.gray).text(`Contratto: ${fin.revenue.contractName}`, costTableX + 8, y + 3, { width: W - 16 });
          y += 14;
        }
        if (fin.revenue.baseFee > 0) costRow("Tariffa base", fin.revenue.baseFee);
        if (fin.revenue.kmRevenue > 0) costRow("Compenso chilometrico", fin.revenue.kmRevenue);
        if (fin.revenue.timeRevenue > 0) costRow("Compenso orario", fin.revenue.timeRevenue);
      }

      doc.strokeColor(COLORS.lightGray).lineWidth(0.5).moveTo(costTableX, y).lineTo(R, y).stroke();
      y += 4;
      doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.secondary).text("TOTALE RICAVI", costTableX + 8, y + 2, { width: costLabelW });
      doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.secondary).text(formatCurrency(fin.effectiveRevenue), R - costValW, y + 1, { width: costValW - 8, align: "right" });
      y += 18;
    }

    // --- RIEPILOGO COSTI (Summary Box) ---
    const summaryH = 40;
    const profitColor = fin.profit >= 0 ? COLORS.secondary : COLORS.error;
    const summaryBg = fin.profit >= 0 ? "#F0FDF4" : "#FEF2F2";
    doc.roundedRect(L, y, W, summaryH, 4).fill(summaryBg);
    doc.strokeColor(profitColor).lineWidth(1).roundedRect(L, y, W, summaryH, 4).stroke();

    const colW = W / 3;
    doc.font("Helvetica").fontSize(7).fillColor(COLORS.gray).text("COSTI TOTALI", L + 10, y + 6, { width: colW - 20 });
    doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.error).text(formatCurrency(fin.cost.totalCost), L + 10, y + 18, { width: colW - 20 });

    doc.font("Helvetica").fontSize(7).fillColor(COLORS.gray).text("RICAVI TOTALI", L + colW + 10, y + 6, { width: colW - 20 });
    doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.secondary).text(formatCurrency(fin.effectiveRevenue), L + colW + 10, y + 18, { width: colW - 20 });

    doc.font("Helvetica").fontSize(7).fillColor(COLORS.gray).text("PROFITTO NETTO", L + colW * 2 + 10, y + 6, { width: colW - 20 });
    doc.font("Helvetica-Bold").fontSize(12).fillColor(profitColor).text(`${formatCurrency(fin.profit)} (${fin.profitMargin.toFixed(1)}%)`, L + colW * 2 + 10, y + 18, { width: colW - 20 });

    y += summaryH + 6;
  }

  // INTEGRITY VERIFICATION SECTION - Fixed position above footer
  const integrityY = 690; // Fixed position near bottom
  
  if (data.integrity && data.integrity.status === "VALID") {
    // Draw integrity badge section
    const integrityBoxHeight = 55;
    doc.roundedRect(L, integrityY, W, integrityBoxHeight, 4).fill("#ECFDF5");
    doc.strokeColor("#10B981").lineWidth(2).roundedRect(L, integrityY, W, integrityBoxHeight, 4).stroke();
    
    // Shield icon from image
    try {
      doc.image("attached_assets/shield_1766252653917.png", L + 10, integrityY + 8, { width: 40, height: 40 });
    } catch (shieldErr) {
      // Fallback to simple rectangle if image not found
      doc.rect(L + 12, integrityY + 10, 36, 36).fill("#10B981");
    }
    
    // Badge text
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#065F46");
    doc.text("INTEGRITA VERIFICATA", L + 56, integrityY + 8, { width: 200 });
    
    doc.font("Helvetica").fontSize(8).fillColor("#047857");
    const signedDate = data.integrity.signedAt 
      ? new Date(data.integrity.signedAt).toLocaleString("it-IT", { dateStyle: "long", timeStyle: "short" })
      : "Data non disponibile";
    doc.text(`Firma crittografica: ${data.integrity.algorithm || "HMAC-SHA256"}`, L + 56, integrityY + 24, { width: 250 });
    doc.text(`Data firma: ${signedDate}`, L + 56, integrityY + 36, { width: 250 });
    
    // Add QR code if pre-generated (positioned on right with label below)
    if (qrBuffer) {
      doc.image(qrBuffer, R - 58, integrityY + 3, { width: 44, height: 44 });
      doc.font("Helvetica").fontSize(5).fillColor("#047857");
      doc.text("Scansiona per verificare", R - 68, integrityY + 48, { width: 64, align: "center" });
    }
  } else if (data.integrity && data.integrity.status === "BROKEN") {
    // Draw broken integrity warning
    const integrityBoxHeight = 45;
    doc.roundedRect(L, integrityY, W, integrityBoxHeight, 4).fill("#FEF2F2");
    doc.strokeColor("#EF4444").lineWidth(2).roundedRect(L, integrityY, W, integrityBoxHeight, 4).stroke();
    
    // Warning icon
    const warnX = L + 12;
    const warnY = integrityY + 10;
    doc.rect(warnX, warnY, 28, 28).fill("#EF4444");
    doc.font("Helvetica-Bold").fontSize(18).fillColor(COLORS.white);
    doc.text("!", warnX + 10, warnY + 4, { width: 20 });
    
    // Warning text
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#991B1B");
    doc.text("ATTENZIONE: INTEGRITA COMPROMESSA", L + 50, integrityY + 10, { width: 300 });
    doc.font("Helvetica").fontSize(8).fillColor("#B91C1C");
    doc.text("Questo documento e stato modificato dopo la firma crittografica.", L + 50, integrityY + 26, { width: 350 });
  } else {
    // Not signed - show info box
    const integrityBoxHeight = 35;
    doc.roundedRect(L, integrityY, W, integrityBoxHeight, 4).fill("#F3F4F6");
    doc.strokeColor("#9CA3AF").lineWidth(1).roundedRect(L, integrityY, W, integrityBoxHeight, 4).stroke();
    
    // Info icon
    const infoX = L + 12;
    const infoY = integrityY + 7;
    doc.circle(infoX + 10, infoY + 10, 10).fill("#6B7280");
    doc.font("Helvetica-Bold").fontSize(14).fillColor(COLORS.white);
    doc.text("i", infoX + 6, infoY + 2, { width: 20 });
    
    // Info text
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#374151");
    doc.text("DOCUMENTO NON FIRMATO", L + 40, integrityY + 8, { width: 300 });
    doc.font("Helvetica").fontSize(8).fillColor("#6B7280");
    doc.text("Questo servizio non e stato ancora firmato digitalmente per la verifica di integrita.", L + 40, integrityY + 21, { width: 400 });
  }

  // FOOTER - simple text note
  const fy = 760;
  doc.strokeColor(COLORS.lightGray).lineWidth(0.5).moveTo(L, fy).lineTo(R, fy).stroke();
  
  // Footer text - conditional based on integrity
  doc.font("Helvetica").fontSize(7).fillColor(COLORS.gray);
  if (data.integrity?.status === "VALID") {
    doc.text("Scansiona il QR code per verificare l'autenticita del documento online.", L, fy + 6, { width: W, align: "center" });
  } else {
    doc.text("Documento generato dal sistema di gestione integrato SOCCORSO DIGITALE S.R.L.", L, fy + 6, { width: W, align: "center" });
  }

  return doc;
}

function lv(doc: PDFKit.PDFDocument, x: number, y: number, w: number, label: string, value: string): void {
  doc.font("Helvetica").fontSize(7).fillColor(COLORS.gray).text(label, x, y, { width: w });
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.dark).text(value, x, y + 10, { width: w });
}

// ============================================
// CHECKLIST MONTHLY REPORT PDF
// ============================================

interface ChecklistReportItem {
  label: string;
  checked: boolean;
  anomaly?: boolean;
  anomalyDescription?: string;
}

interface ChecklistSubmissionData {
  shiftDate: string;
  submittedByName: string;
  vehicleCode: string;
  hasAnomalies: boolean;
  anomalyDescription: string | null;
  generalNotes: string | null;
  items: ChecklistReportItem[];
  crewSignatures?: string[];
}

interface ChecklistMonthlyReportData {
  year: number;
  month: number;
  locationName: string;
  submissions: ChecklistSubmissionData[];
}

export function generateChecklistMonthlyPDF(data: ChecklistMonthlyReportData): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  
  const L = 40, R = 555, W = R - L;
  const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
  const monthLabel = monthNames[data.month - 1] || `Mese ${data.month}`;

  function drawHeader(isFirst: boolean = false) {
    let y = 40;
    
    // Logo
    doc.rect(L, y, 28, 28).fill(COLORS.primary);
    doc.rect(L + 12, y + 5, 4, 18).fill(COLORS.white);
    doc.rect(L + 5, y + 12, 18, 4).fill(COLORS.white);
    doc.font("Helvetica-Bold").fontSize(16).fillColor(COLORS.dark).text("SOCCORSO DIGITALE", L + 36, y + 2, { width: 200 });
    doc.font("Helvetica").fontSize(8).fillColor(COLORS.gray).text("Servizi di Trasporto Sanitario", L + 36, y + 20, { width: 200 });
    
    // Right side - Location
    doc.font("Helvetica").fontSize(8).fillColor(COLORS.gray).text("Sede:", R - 150, y + 2, { width: 40 });
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.dark).text(data.locationName || "Tutte", R - 150, y + 14, { width: 150, align: "left" });
    
    y += 36;
    doc.strokeColor(COLORS.lightGray).lineWidth(0.5).moveTo(L, y).lineTo(R, y).stroke();
    y += 12;

    // Title
    doc.roundedRect(L, y, 100, 14, 3).fill(COLORS.secondary);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.white).text("CHECKLIST PRE-SERVIZIO", L + 6, y + 3, { width: 94 });
    doc.font("Helvetica-Bold").fontSize(14).fillColor(COLORS.dark).text(`Report ${monthLabel} ${data.year}`, L + 110, y - 2, { width: 300 });
    doc.font("Helvetica").fontSize(10).fillColor(COLORS.gray).text(`${data.submissions.length} checklist compilate`, L + 110, y + 14, { width: 300 });
    
    return y + 40;
  }

  let currentY = drawHeader(true);
  
  // Summary section
  const anomalyCount = data.submissions.filter(s => s.hasAnomalies).length;
  const totalItems = data.submissions.reduce((sum, s) => sum + (s.items?.length || 0), 0);
  const checkedItems = data.submissions.reduce((sum, s) => sum + (s.items?.filter(i => i.checked).length || 0), 0);
  const complianceRate = totalItems > 0 ? ((checkedItems / totalItems) * 100).toFixed(1) : "0";

  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.primary).text("RIEPILOGO MENSILE", L, currentY, { width: W });
  currentY += 14;
  doc.roundedRect(L, currentY, W, 50, 4).fill("#F9FAFB");
  
  const col = W / 4;
  doc.font("Helvetica").fontSize(7).fillColor(COLORS.gray);
  doc.text("Checklist Totali", L + 10, currentY + 8, { width: col });
  doc.text("Con Anomalie", L + col + 10, currentY + 8, { width: col });
  doc.text("Voci Controllate", L + col * 2 + 10, currentY + 8, { width: col });
  doc.text("Tasso Conformita", L + col * 3 + 10, currentY + 8, { width: col });
  
  doc.font("Helvetica-Bold").fontSize(14).fillColor(COLORS.dark);
  doc.text(data.submissions.length.toString(), L + 10, currentY + 22, { width: col });
  doc.fillColor(anomalyCount > 0 ? COLORS.error : COLORS.dark).text(anomalyCount.toString(), L + col + 10, currentY + 22, { width: col });
  doc.fillColor(COLORS.dark).text(`${checkedItems}/${totalItems}`, L + col * 2 + 10, currentY + 22, { width: col });
  doc.fillColor(parseFloat(complianceRate) >= 90 ? "#059669" : COLORS.error).text(`${complianceRate}%`, L + col * 3 + 10, currentY + 22, { width: col });
  
  currentY += 60;

  // Submissions table
  if (data.submissions.length > 0) {
    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.primary).text("DETTAGLIO CHECKLIST", L, currentY, { width: W });
    currentY += 14;

    // Table header
    doc.roundedRect(L, currentY, W, 18, 2).fill(COLORS.primary);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.white);
    doc.text("Data", L + 5, currentY + 5, { width: 60 });
    doc.text("Veicolo", L + 70, currentY + 5, { width: 80 });
    doc.text("Operatore", L + 160, currentY + 5, { width: 100 });
    doc.text("Voci", L + 270, currentY + 5, { width: 50 });
    doc.text("Anomalie", L + 330, currentY + 5, { width: 60 });
    doc.text("Note", L + 400, currentY + 5, { width: W - 400 });
    currentY += 22;

    for (const sub of data.submissions) {
      // Check page break
      if (currentY > 700) {
        doc.addPage();
        currentY = drawHeader();
      }

      const rowColor = sub.hasAnomalies ? "#FEF2F2" : "#FFFFFF";
      doc.rect(L, currentY, W, 24).fill(rowColor);
      doc.strokeColor(COLORS.lightGray).lineWidth(0.3).moveTo(L, currentY + 24).lineTo(R, currentY + 24).stroke();

      const shiftDate = new Date(sub.shiftDate).toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
      const itemCount = sub.items?.length || 0;
      const checkedCount = sub.items?.filter(i => i.checked).length || 0;
      
      doc.font("Helvetica").fontSize(8).fillColor(COLORS.dark);
      doc.text(shiftDate, L + 5, currentY + 8, { width: 60 });
      doc.text(`Amb. ${sub.vehicleCode}`, L + 70, currentY + 8, { width: 80 });
      doc.text(sub.submittedByName, L + 160, currentY + 8, { width: 100 });
      doc.text(`${checkedCount}/${itemCount}`, L + 270, currentY + 8, { width: 50 });
      
      if (sub.hasAnomalies) {
        doc.font("Helvetica-Bold").fillColor(COLORS.error).text("Si", L + 330, currentY + 8, { width: 60 });
      } else {
        doc.font("Helvetica").fillColor("#059669").text("No", L + 330, currentY + 8, { width: 60 });
      }
      
      doc.font("Helvetica").fontSize(7).fillColor(COLORS.gray);
      const noteText = sub.generalNotes ? sub.generalNotes.substring(0, 30) + (sub.generalNotes.length > 30 ? "..." : "") : "-";
      doc.text(noteText, L + 400, currentY + 8, { width: W - 405 });
      
      currentY += 26;
    }
  }

  // Anomalies section
  const anomalies = data.submissions.filter(s => s.hasAnomalies);
  if (anomalies.length > 0) {
    if (currentY > 650) {
      doc.addPage();
      currentY = drawHeader();
    }
    
    currentY += 10;
    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.error).text("ANOMALIE SEGNALATE", L, currentY, { width: W });
    currentY += 14;

    for (const sub of anomalies) {
      if (currentY > 720) {
        doc.addPage();
        currentY = drawHeader();
      }

      doc.roundedRect(L, currentY, W, 40, 3).fill("#FEF2F2");
      const shiftDate = new Date(sub.shiftDate).toLocaleDateString("it-IT");
      doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.dark).text(`${shiftDate} - Amb. ${sub.vehicleCode}`, L + 8, currentY + 6, { width: W - 16 });
      doc.font("Helvetica").fontSize(8).fillColor(COLORS.gray).text(`Segnalato da: ${sub.submittedByName}`, L + 8, currentY + 18, { width: W - 16 });
      doc.font("Helvetica").fontSize(7).fillColor(COLORS.dark).text(sub.anomalyDescription || "Nessuna descrizione", L + 8, currentY + 30, { width: W - 16 });
      currentY += 46;
    }
  }

  // Footer on each page
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.strokeColor(COLORS.lightGray).lineWidth(0.5).moveTo(L, 760).lineTo(R, 760).stroke();
    doc.font("Helvetica").fontSize(7).fillColor(COLORS.gray);
    doc.text(`SOCCORSO DIGITALE - Report Checklist ${monthLabel} ${data.year} | Pagina ${i + 1} di ${pages.count}`, L, 764, { width: W, align: "center" });
  }

  return doc;
}

// ============ DEVICE AUTHORIZATION PDF ============

// Enriched trip type that includes names resolved from structures
interface EnrichedTrip extends Trip {
  originName?: string | null;
  destinationName?: string | null;
}

interface DeviceAuthorizationPDFData {
  authorization: TripDeviceAuthorization;
  trip: EnrichedTrip;
  vehicle: Vehicle | null | undefined;
  location: { name: string } | null | undefined;
}

function getAuthorizerTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    medico_bordo: "Medico a Bordo",
    infermiere_bordo: "Infermiere a Bordo",
    medico_reparto: "Medico di Reparto",
    centrale_operativa: "Centrale Operativa 118",
  };
  return labels[type] || type;
}

export function generateDeviceAuthorizationPDF(data: DeviceAuthorizationPDFData): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  
  const L = 40, R = 555, W = R - L;
  let y = 40;

  // HEADER with official logo (use process.cwd() since __dirname points to dist/ after compilation)
  const logoPath = path.resolve(process.cwd(), "server", "assets", "logo-croce-europa.png");
  try {
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, L, y, { height: 40 });
    } else {
      // Fallback to text if logo not found
      doc.font("Helvetica-Bold").fontSize(18).fillColor(COLORS.primary).text("SOCCORSO DIGITALE", L, y + 8, { width: 200 });
      doc.font("Helvetica").fontSize(8).fillColor(COLORS.gray).text("impresa sociale - no profit", L, y + 28, { width: 200 });
    }
  } catch (e) {
    doc.font("Helvetica-Bold").fontSize(18).fillColor(COLORS.primary).text("SOCCORSO DIGITALE", L, y + 8, { width: 200 });
    doc.font("Helvetica").fontSize(8).fillColor(COLORS.gray).text("impresa sociale - no profit", L, y + 28, { width: 200 });
  }
  
  // Location on right
  doc.font("Helvetica").fontSize(8).fillColor(COLORS.gray).text("Sede:", R - 130, y + 4, { width: 130, align: "right" });
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.dark).text(data.location?.name || "N/A", R - 130, y + 18, { width: 130, align: "right" });
  
  y += 50;
  doc.strokeColor(COLORS.lightGray).lineWidth(1).moveTo(L, y).lineTo(R, y).stroke();
  y += 16;

  // TITLE
  doc.roundedRect(L, y, W, 50, 6).fill("#FFF7ED");
  doc.roundedRect(L, y, 6, 50, 3).fill("#F97316");
  
  doc.font("Helvetica-Bold").fontSize(16).fillColor("#C2410C").text("AUTORIZZAZIONE USO DISPOSITIVI DI EMERGENZA", L + 20, y + 10, { width: W - 30 });
  doc.font("Helvetica").fontSize(10).fillColor(COLORS.gray).text("Sirena e Lampeggianti - Art. 177 C.d.S.", L + 20, y + 32, { width: W - 30 });
  
  y += 64;

  // SERVICE REFERENCE BOX
  doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.primary).text("RIFERIMENTO SERVIZIO", L, y, { width: W });
  y += 16;
  
  doc.roundedRect(L, y, W, 80, 4).fill("#F9FAFB");
  
  let ry = y + 12;
  const col = W / 3;
  
  // Row 1
  lv(doc, L + 12, ry, col - 20, "Numero Servizio", `#${data.trip.progressiveNumber || "N/A"}`);
  lv(doc, L + col, ry, col - 10, "Data", formatDate(data.trip.serviceDate));
  lv(doc, L + col * 2, ry, col - 20, "Orario", `${formatTime(data.trip.departureTime)} - ${formatTime(data.trip.returnTime)}`);
  ry += 24;
  
  // Row 2
  lv(doc, L + 12, ry, col - 20, "Veicolo", data.vehicle?.code || "N/A");
  lv(doc, L + col, ry, col - 10, "Targa", data.vehicle?.licensePlate || "N/A");
  lv(doc, L + col * 2, ry, col - 20, "Tipo Servizio", getServiceTypeLabel(data.trip.serviceType));
  ry += 24;

  // Row 3 - use enriched names if available, fallback to address
  const originText = data.trip.originName || data.trip.originAddress || "N/A";
  const destText = data.trip.destinationName || data.trip.destinationAddress || "N/A";
  lv(doc, L + 12, ry, W - 24, "Percorso", `${originText.substring(0, 35)} >> ${destText.substring(0, 35)}`);
  
  y += 92;

  // AUTHORIZATION DETAILS
  doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.primary).text("DETTAGLI AUTORIZZAZIONE", L, y, { width: W });
  y += 16;
  
  doc.roundedRect(L, y, W, 70, 4).fill("#ECFDF5");
  doc.roundedRect(L, y, 6, 70, 3).fill(COLORS.secondary);
  
  ry = y + 12;
  
  // Authorization info
  doc.font("Helvetica").fontSize(8).fillColor(COLORS.gray).text("Tipologia Autorizzante:", L + 16, ry, { width: 130 });
  doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.dark).text(getAuthorizerTypeLabel(data.authorization.authorizerType), L + 16, ry + 12, { width: 200 });
  
  if (data.authorization.authorizerName) {
    doc.font("Helvetica").fontSize(8).fillColor(COLORS.gray).text("Nome Autorizzante:", L + 230, ry, { width: 130 });
    doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.dark).text(data.authorization.authorizerName, L + 230, ry + 12, { width: 200 });
  }
  
  ry += 32;
  
  doc.font("Helvetica").fontSize(8).fillColor(COLORS.gray).text("Data e Ora Autorizzazione:", L + 16, ry, { width: 150 });
  const authDate = data.authorization.authorizedAt 
    ? new Date(data.authorization.authorizedAt).toLocaleString("it-IT", { 
        day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" 
      })
    : "N/A";
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.dark).text(authDate, L + 16, ry + 12, { width: 250 });

  y += 82;

  // SIGNATURE SECTION
  if (data.authorization.signatureData && data.authorization.authorizerType !== "centrale_operativa") {
    doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.primary).text("FIRMA AUTORIZZANTE", L, y, { width: W });
    y += 16;
    
    doc.roundedRect(L, y, W, 120, 4).stroke(COLORS.lightGray);
    
    // Try to embed signature image
    try {
      const base64Data = data.authorization.signatureData.replace(/^data:image\/\w+;base64,/, "");
      const signatureBuffer = Buffer.from(base64Data, "base64");
      doc.image(signatureBuffer, L + 20, y + 10, { width: 200, height: 80 });
    } catch (e) {
      doc.font("Helvetica").fontSize(9).fillColor(COLORS.gray).text("Firma digitale registrata", L + 20, y + 40, { width: 200 });
    }
    
    // Signature label line
    doc.strokeColor(COLORS.gray).lineWidth(0.5).moveTo(L + 240, y + 95).lineTo(R - 20, y + 95).stroke();
    doc.font("Helvetica").fontSize(8).fillColor(COLORS.gray).text("Firma dell'autorizzante", L + 240, y + 100, { width: R - L - 260 });
    
    y += 130;
  }

  // NOTES (if any)
  if (data.authorization.notes) {
    doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.primary).text("NOTE", L, y, { width: W });
    y += 16;
    doc.roundedRect(L, y, W, 50, 4).fill("#F9FAFB");
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.dark).text(data.authorization.notes, L + 12, y + 10, { width: W - 24 });
    y += 60;
  }

  // LEGAL DISCLAIMER
  y = Math.max(y, 560);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.dark).text("DICHIARAZIONE", L, y, { width: W });
  y += 14;
  
  doc.roundedRect(L, y, W, 110, 4).fill("#FEF2F2");
  doc.font("Helvetica").fontSize(8).fillColor(COLORS.dark).text(
    "Con la presente autorizzazione, il sottoscritto dichiara di aver valutato le condizioni del paziente e la necessita del trasporto urgente, " +
    "autorizzando l'uso dei dispositivi supplementari di allarme (sirena e lampeggianti) ai sensi dell'Art. 177 del Codice della Strada.\n\n" +
    "L'equipaggio e autorizzato a:\n" +
    "• Utilizzare i dispositivi acustici e luminosi di emergenza\n" +
    "• Non osservare gli obblighi, i divieti e le limitazioni relativi alla circolazione, con l'obbligo di usare la massima prudenza\n\n" +
    "Tale autorizzazione e valida esclusivamente per il servizio sopra indicato.",
    L + 12, y + 10, { width: W - 24, lineGap: 3 }
  );
  
  y += 120;

  // FOOTER
  doc.strokeColor(COLORS.lightGray).lineWidth(0.5).moveTo(L, 760).lineTo(R, 760).stroke();
  doc.font("Helvetica").fontSize(7).fillColor(COLORS.gray);
  doc.text(`SOCCORSO DIGITALE - Autorizzazione Dispositivi Emergenza | Servizio #${data.trip.progressiveNumber || "N/A"} del ${formatDate(data.trip.serviceDate)}`, L, 766, { width: W, align: "center" });
  doc.text("Documento generato automaticamente - Conservare agli atti", L, 778, { width: W, align: "center" });

  return doc;
}

// Analytics Report PDF - Section types for per-card exports
type AnalyticsSectionType = "kpi" | "trend" | "top10" | "vehicles" | "heatmap" | "all";

interface AnalyticsReportData {
  period: number;
  locationId: string | null;
  locationName: string;
  section?: AnalyticsSectionType;
  kpis: {
    totalServices: number;
    totalKm: number;
    avgDuration: number;
    avgKm: number;
  };
  topOrigins: [string, number][];
  topDestinations: [string, number][];
  vehicleUsage: [string, { services: number; km: number }][];
  weeklyData: { week: string; services: number; km: number }[];
  heatmapData: number[][];
}

// Helper to draw PDF header
function drawAnalyticsHeader(doc: PDFKit.PDFDocument, data: AnalyticsReportData, sectionTitle: string, L: number, R: number, W: number): number {
  let y = 40;
  
  try {
    doc.image("attached_assets/Logo-Croce-Europa-Ufficiale_1766252701803.png", L, y - 2, { height: 36 });
  } catch {
    doc.font("Helvetica-Bold").fontSize(18).fillColor(COLORS.dark).text("SOCCORSO DIGITALE", L, y + 4, { width: 200 });
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.gray).text("S.R.L. Impresa Sociale", L, y + 24, { width: 200 });
  }
  
  doc.font("Helvetica-Bold").fontSize(13).fillColor(COLORS.dark).text(sectionTitle, R - 280, y + 2, { width: 280, align: "right" });
  doc.font("Helvetica").fontSize(9).fillColor(COLORS.gray).text(`Ultimi ${data.period} giorni | ${data.locationName}`, R - 280, y + 20, { width: 280, align: "right" });
  
  y += 44;
  doc.strokeColor(COLORS.primary).lineWidth(2).moveTo(L, y).lineTo(R, y).stroke();
  y += 12;
  
  doc.font("Helvetica").fontSize(8).fillColor(COLORS.gray);
  doc.text(`Generato il ${new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })} alle ore ${new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`, L, y, { width: W, align: "right" });
  y += 20;
  
  return y;
}

// Helper to draw PDF footer
function drawAnalyticsFooter(doc: PDFKit.PDFDocument, L: number, R: number, W: number, pageNum: number, totalPages: number): void {
  doc.strokeColor(COLORS.lightGray).lineWidth(0.5).moveTo(L, 768).lineTo(R, 768).stroke();
  
  // Company info - centered
  doc.font("Helvetica").fontSize(6).fillColor(COLORS.gray);
  doc.text(`SOCCORSO DIGITALE | Via Forte Garofolo 20, 37057 San Giovanni Lupatoto (VR) | P.IVA 02663420236`, L, 774, { width: W, align: "center" });
  
  // Documento riservato badge - centered with subtle styling
  const badgeText = "DOCUMENTO RISERVATO";
  const badgeWidth = 90;
  const badgeX = L + (W - badgeWidth) / 2;
  doc.save();
  doc.roundedRect(badgeX, 786, badgeWidth, 14, 3).fill("#FEF3C7");
  doc.font("Helvetica-Bold").fontSize(6).fillColor("#92400E").text(badgeText, badgeX, 790, { width: badgeWidth, align: "center" });
  doc.restore();
  
  // Page number - right aligned
  doc.font("Helvetica").fontSize(7).fillColor(COLORS.gray);
  doc.text(`Pagina ${pageNum} di ${totalPages}`, R - 60, 774, { width: 60, align: "right" });
}

export async function generateAnalyticsReportPDF(data: AnalyticsReportData): Promise<PDFKit.PDFDocument> {
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  const section = data.section || "all";
  
  const L = 40, R = 555, W = R - L;
  let y = 40;

  // Title based on section
  const sectionTitles: Record<AnalyticsSectionType, string> = {
    kpi: "REPORT KPI OPERATIVI",
    trend: "REPORT TREND SETTIMANALE",
    top10: "REPORT PARTENZE E DESTINAZIONI",
    vehicles: "REPORT UTILIZZO VEICOLI",
    heatmap: "REPORT ATTIVITA ORARIA",
    all: "REPORT STATISTICHE OPERATIVE"
  };

  y = drawAnalyticsHeader(doc, data, sectionTitles[section], L, R, W);

  // KPI SECTION
  if (section === "all" || section === "kpi") {
    doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.primary).text("RIEPILOGO KPI", L, y, { width: W });
    y += 18;

    const kpiWidth = (W - 30) / 4;
    const kpiHeight = 65;
    const kpis = [
      { label: "Servizi Totali", value: data.kpis.totalServices.toLocaleString("it-IT"), color: "#3B82F6" },
      { label: "Km Totali", value: data.kpis.totalKm.toLocaleString("it-IT"), color: "#10B981" },
      { label: "Tempo Medio", value: `${data.kpis.avgDuration} min`, color: "#F59E0B" },
      { label: "Km Medi", value: data.kpis.avgKm.toString(), color: "#8B5CF6" }
    ];

    kpis.forEach((kpi, i) => {
      const x = L + (kpiWidth + 10) * i;
      doc.save();
      doc.roundedRect(x, y, kpiWidth, kpiHeight, 6).fillAndStroke("#F8FAFC", COLORS.lightGray);
      doc.roundedRect(x, y, 5, kpiHeight, 3).fill(kpi.color);
      doc.restore();
      doc.font("Helvetica-Bold").fontSize(22).fillColor(COLORS.dark).text(kpi.value, x + 14, y + 14, { width: kpiWidth - 24 });
      doc.font("Helvetica").fontSize(9).fillColor(COLORS.gray).text(kpi.label, x + 14, y + 44, { width: kpiWidth - 24 });
    });

    y += kpiHeight + 28;
  }

  // WEEKLY TREND SECTION
  if ((section === "all" || section === "trend") && data.weeklyData.length > 0) {
    doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.primary).text("TREND SETTIMANALE", L, y, { width: W });
    y += 18;

    const chartHeight = 100;
    const numBars = data.weeklyData.length;
    const totalBarSpace = W - 60;
    const barWidth = Math.min(50, (totalBarSpace / numBars) - 10);
    const barSpacing = (totalBarSpace - (barWidth * numBars)) / (numBars + 1);
    const maxServices = Math.max(...data.weeklyData.map(w => w.services), 1);

    doc.save();
    doc.roundedRect(L, y, W, chartHeight + 40, 6).fillAndStroke("#F8FAFC", COLORS.lightGray);
    doc.restore();

    data.weeklyData.forEach((week, i) => {
      const barHeight = Math.max(4, (week.services / maxServices) * chartHeight);
      const x = L + 30 + barSpacing + (barWidth + barSpacing) * i;
      const barY = y + 10 + chartHeight - barHeight;
      
      doc.save();
      doc.roundedRect(x, barY, barWidth, barHeight, 3).fill(COLORS.primary);
      doc.restore();
      
      doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.dark).text(week.services.toString(), x, barY - 14, { width: barWidth, align: "center" });
      
      const weekDate = new Date(week.week);
      const label = `${weekDate.getDate().toString().padStart(2, "0")}/${(weekDate.getMonth() + 1).toString().padStart(2, "0")}`;
      doc.font("Helvetica").fontSize(8).fillColor(COLORS.gray).text(label, x, y + chartHeight + 16, { width: barWidth, align: "center" });
    });

    y += chartHeight + 50;
  }

  // TOP 10 ORIGINS AND DESTINATIONS
  if (section === "all" || section === "top10") {
    const fontSize = 6;
    const lineHeight = 28;
    const maxItems = 10;
    const numOrigins = Math.min(data.topOrigins.length, maxItems);
    const numDests = Math.min(data.topDestinations.length, maxItems);
    const listHeight = Math.max(numOrigins, numDests) * lineHeight + 16;

    doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.primary).text("TOP 10 PARTENZE", L, y, { width: W / 2 - 10 });
    doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.primary).text("TOP 10 DESTINAZIONI", L + W / 2 + 10, y, { width: W / 2 - 10 });
    y += 18;

    doc.save();
    doc.roundedRect(L, y, W / 2 - 10, listHeight, 4).fillAndStroke("#F8FAFC", COLORS.lightGray);
    doc.roundedRect(L + W / 2 + 10, y, W / 2 - 10, listHeight, 4).fillAndStroke("#F8FAFC", COLORS.lightGray);
    doc.restore();

    // Origins - full names with multi-line wrapping
    let oy = y + 8;
    const originColWidth = W / 2 - 50;
    data.topOrigins.slice(0, maxItems).forEach(([name, count], i) => {
      doc.font("Helvetica-Bold").fontSize(fontSize).fillColor(COLORS.secondary).text(`${i + 1}.`, L + 6, oy, { width: 16 });
      doc.font("Helvetica").fontSize(fontSize).fillColor(COLORS.dark).text(name, L + 22, oy, { width: originColWidth, height: lineHeight - 4, lineBreak: true });
      doc.font("Helvetica-Bold").fontSize(fontSize).fillColor(COLORS.primary).text(count.toString(), L + W / 2 - 32, oy, { width: 20, align: "right" });
      oy += lineHeight;
    });

    // Destinations - full names with multi-line wrapping
    let dy = y + 8;
    const destColWidth = W / 2 - 50;
    data.topDestinations.slice(0, maxItems).forEach(([name, count], i) => {
      doc.font("Helvetica-Bold").fontSize(fontSize).fillColor(COLORS.secondary).text(`${i + 1}.`, L + W / 2 + 16, dy, { width: 16 });
      doc.font("Helvetica").fontSize(fontSize).fillColor(COLORS.dark).text(name, L + W / 2 + 32, dy, { width: destColWidth, height: lineHeight - 4, lineBreak: true });
      doc.font("Helvetica-Bold").fontSize(fontSize).fillColor(COLORS.primary).text(count.toString(), R - 24, dy, { width: 20, align: "right" });
      dy += lineHeight;
    });

    y += listHeight + 24;
  }

  // VEHICLE USAGE - Fixed pagination
  if (section === "all" || section === "vehicles") {
    // Check if we need a new page
    if (y > 500) {
      doc.addPage();
      y = drawAnalyticsHeader(doc, data, sectionTitles[section], L, R, W);
    }

    doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.primary).text("UTILIZZO VEICOLI", L, y, { width: W });
    y += 18;

    const rowHeight = 22;
    const headerHeight = 24;
    const vehicles = data.vehicleUsage.slice(0, 20);
    const totalVehicleServices = data.vehicleUsage.reduce((sum, [, stats]) => sum + stats.services, 0);

    // Table header
    doc.save();
    doc.roundedRect(L, y, W, headerHeight, 4).fill(COLORS.primary);
    doc.restore();
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.white);
    doc.text("Veicolo", L + 12, y + 7, { width: 100 });
    doc.text("Servizi", L + 130, y + 7, { width: 70, align: "center" });
    doc.text("Km Totali", L + 220, y + 7, { width: 90, align: "center" });
    doc.text("% Utilizzo", L + 330, y + 7, { width: 100, align: "center" });
    y += headerHeight;

    // Table rows - draw background first, then text
    vehicles.forEach(([code, stats], i) => {
      // Check for page break
      if (y > 720) {
        doc.addPage();
        y = 50;
        // Redraw header on new page
        doc.save();
        doc.roundedRect(L, y, W, headerHeight, 4).fill(COLORS.primary);
        doc.restore();
        doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.white);
        doc.text("Veicolo", L + 12, y + 7, { width: 100 });
        doc.text("Servizi", L + 130, y + 7, { width: 70, align: "center" });
        doc.text("Km Totali", L + 220, y + 7, { width: 90, align: "center" });
        doc.text("% Utilizzo", L + 330, y + 7, { width: 100, align: "center" });
        y += headerHeight;
      }

      const bgColor = i % 2 === 0 ? "#F8FAFC" : "#FFFFFF";
      const percentage = totalVehicleServices > 0 ? Math.round((stats.services / totalVehicleServices) * 100) : 0;

      // Draw row background
      doc.save();
      doc.rect(L, y, W, rowHeight).fill(bgColor);
      doc.restore();

      // Draw row content
      doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.dark).text(code, L + 12, y + 6, { width: 100 });
      doc.font("Helvetica").fontSize(9).fillColor(COLORS.dark).text(stats.services.toString(), L + 130, y + 6, { width: 70, align: "center" });
      doc.font("Helvetica").fontSize(9).fillColor(COLORS.dark).text(stats.km.toLocaleString("it-IT"), L + 220, y + 6, { width: 90, align: "center" });

      // Progress bar
      const barX = L + 330;
      const barW = 80;
      doc.save();
      doc.rect(barX, y + 7, barW, 10).fill(COLORS.lightGray);
      doc.rect(barX, y + 7, barW * (percentage / 100), 10).fill(COLORS.secondary);
      doc.restore();
      doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.dark).text(`${percentage}%`, barX + barW + 8, y + 6, { width: 35 });

      y += rowHeight;
    });

    y += 16;
  }

  // HEATMAP SECTION
  if (section === "all" || section === "heatmap") {
    // Check if we need a new page
    if (y > 580) {
      doc.addPage();
      y = drawAnalyticsHeader(doc, data, sectionTitles[section], L, R, W);
    }

    doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.primary).text("HEATMAP ATTIVITA ORARIA", L, y, { width: W });
    y += 18;

    const days = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
    const cellSize = 20;
    const maxHeatVal = Math.max(...data.heatmapData.flat(), 1);

    // Hours header
    doc.font("Helvetica").fontSize(6).fillColor(COLORS.gray);
    for (let h = 0; h < 24; h++) {
      doc.text(h.toString().padStart(2, "0"), L + 36 + h * cellSize, y, { width: cellSize, align: "center" });
    }
    y += 14;

    // Heatmap grid
    days.forEach((day, di) => {
      doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.dark).text(day, L, y + 4, { width: 32 });
      
      for (let h = 0; h < 24; h++) {
        const val = data.heatmapData[di]?.[h] || 0;
        const intensity = val / maxHeatVal;
        
        // Color gradient: light to dark blue
        let fillColor = "#EFF6FF";
        if (intensity > 0) {
          if (intensity < 0.25) fillColor = "#DBEAFE";
          else if (intensity < 0.5) fillColor = "#93C5FD";
          else if (intensity < 0.75) fillColor = "#3B82F6";
          else fillColor = "#1D4ED8";
        }
        
        doc.save();
        doc.rect(L + 36 + h * cellSize, y, cellSize - 2, cellSize - 2).fill(fillColor);
        doc.restore();
        
        if (val > 0) {
          const textColor = intensity > 0.5 ? "#FFFFFF" : COLORS.dark;
          doc.font("Helvetica").fontSize(6).fillColor(textColor).text(val.toString(), L + 36 + h * cellSize, y + 5, { width: cellSize - 2, align: "center" });
        }
      }
      y += cellSize;
    });

    // Legend
    y += 12;
    doc.font("Helvetica").fontSize(7).fillColor(COLORS.gray).text("Intensita:", L + 36, y);
    const legendColors = ["#EFF6FF", "#DBEAFE", "#93C5FD", "#3B82F6", "#1D4ED8"];
    const legendLabels = ["0", "Bassa", "", "Media", "Alta"];
    legendColors.forEach((color, i) => {
      doc.save();
      doc.rect(L + 90 + i * 30, y - 2, 20, 12).fill(color);
      doc.restore();
      if (legendLabels[i]) {
        doc.font("Helvetica").fontSize(6).fillColor(COLORS.gray).text(legendLabels[i], L + 90 + i * 30, y + 12, { width: 30, align: "center" });
      }
    });
  }

  // FOOTER on all pages
  const pageCount = doc.bufferedPageRange().count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    drawAnalyticsFooter(doc, L, R, W, i + 1, pageCount);
  }

  return doc;
}

// ============================================================================
// VOLUNTEER REIMBURSEMENT PDF - Innovative Design
// ============================================================================

interface ReimbursementShift {
  shiftDate: string;
  startTime: string;
  endTime: string;
  hoursWorked: number;
  locationName: string;
  kmDistance: number;
  kmRate: number;
  kmAmount: number;
  mealAmount: number;
  totalAmount: number;
}

interface ReimbursementPDFData {
  volunteer: {
    firstName: string;
    lastName: string;
    fiscalCode?: string;
    role: string;
    iban?: string;
    homeAddress?: string;
    homeCity?: string;
  };
  reimbursement: {
    id: string;
    month: number;
    year: number;
    totalAmount: number;
    totalShifts: number;
    totalHours: number;
    totalKm: number;
    totalMeals: number;
    kmRate: number;
    mealAllowance: number;
    status: string;
    signedAt?: string;
    signatureData?: string;
  };
  shifts: ReimbursementShift[];
  acceptanceText: string;
  generatedAt: string;
}

const MONTH_NAMES = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

export async function generateVolunteerReimbursementPDF(data: ReimbursementPDFData): Promise<PDFKit.PDFDocument> {
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  
  const L = 40, R = 555, W = R - L;
  let y = 40;

  // ========== PREMIUM HEADER ==========
  // Gradient-like background strip
  doc.save();
  doc.rect(0, 0, 595.28, 100).fill("#F0F9FF");
  doc.restore();
  
  // Logo
  try {
    doc.image("attached_assets/Logo-Croce-Europa-Ufficiale_1766252701803.png", L, y, { height: 42 });
  } catch {
    doc.font("Helvetica-Bold").fontSize(20).fillColor(COLORS.primary).text("SOCCORSO DIGITALE", L, y + 8);
    doc.font("Helvetica").fontSize(10).fillColor(COLORS.gray).text("S.R.L. Impresa Sociale", L, y + 30);
  }
  
  // Document title (right side)
  doc.font("Helvetica-Bold").fontSize(16).fillColor(COLORS.dark).text("RIMBORSO CHILOMETRICO", R - 250, y + 2, { width: 250, align: "right" });
  doc.font("Helvetica").fontSize(11).fillColor(COLORS.primary).text(`${MONTH_NAMES[data.reimbursement.month - 1]} ${data.reimbursement.year}`, R - 250, y + 22, { width: 250, align: "right" });
  
  // Reference number badge
  const refNum = `REF: RK-${data.reimbursement.year}-${String(data.reimbursement.month).padStart(2, '0')}-${data.reimbursement.id.substring(0, 6).toUpperCase()}`;
  doc.font("Helvetica").fontSize(8).fillColor(COLORS.gray).text(refNum, R - 250, y + 40, { width: 250, align: "right" });
  
  y += 65;
  
  // Decorative line
  doc.strokeColor(COLORS.primary).lineWidth(3).moveTo(L, y).lineTo(R, y).stroke();
  y += 20;

  // ========== VOLUNTEER INFO CARD ==========
  doc.save();
  doc.roundedRect(L, y, W, 80, 8).fill("#FAFAFA").stroke("#E5E7EB");
  doc.restore();
  
  const cardPadding = 16;
  let cardY = y + cardPadding;
  
  // Left column - Volunteer details
  doc.font("Helvetica").fontSize(8).fillColor(COLORS.gray).text("VOLONTARIO", L + cardPadding, cardY);
  cardY += 12;
  doc.font("Helvetica-Bold").fontSize(14).fillColor(COLORS.dark).text(`${data.volunteer.firstName} ${data.volunteer.lastName}`, L + cardPadding, cardY);
  cardY += 18;
  doc.font("Helvetica").fontSize(9).fillColor(COLORS.gray).text(`Ruolo: ${data.volunteer.role || 'Soccorritore Volontario'}`, L + cardPadding, cardY);
  if (data.volunteer.fiscalCode) {
    cardY += 12;
    doc.text(`C.F.: ${data.volunteer.fiscalCode}`, L + cardPadding, cardY);
  }
  
  // Right column - IBAN
  const rightCol = L + W/2 + 20;
  cardY = y + cardPadding;
  doc.font("Helvetica").fontSize(8).fillColor(COLORS.gray).text("COORDINATE BANCARIE", rightCol, cardY);
  cardY += 12;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.dark).text(data.volunteer.iban || "IBAN non configurato", rightCol, cardY, { width: W/2 - 40 });
  
  y += 95;

  // ========== SUMMARY METRICS ==========
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.primary).text("RIEPILOGO MENSILE", L, y);
  y += 16;
  
  // Metrics row with boxes (no hours displayed)
  const boxWidth = (W - 20) / 3;
  const metrics = [
    { label: "Turni", value: data.reimbursement.totalShifts.toString(), color: "#3B82F6" },
    { label: "Km Totali", value: Math.round(data.reimbursement.totalKm).toString(), color: "#F59E0B" },
    { label: "TOTALE", value: formatCurrency(data.reimbursement.totalAmount), color: "#10B981" }
  ];
  
  metrics.forEach((m, i) => {
    const boxX = L + i * (boxWidth + 10);
    doc.save();
    doc.roundedRect(boxX, y, boxWidth, 50, 6).fill("#FFFFFF").stroke("#E5E7EB");
    doc.restore();
    
    doc.font("Helvetica").fontSize(8).fillColor(COLORS.gray).text(m.label, boxX + 8, y + 8, { width: boxWidth - 16, align: "center" });
    doc.font("Helvetica-Bold").fontSize(i === 3 ? 14 : 18).fillColor(m.color).text(m.value, boxX + 8, y + 22, { width: boxWidth - 16, align: "center" });
  });
  
  y += 65;

  // ========== SHIFTS TABLE ==========
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.primary).text("DETTAGLIO TURNI", L, y);
  y += 14;
  
  // Table header (with meal voucher column)
  const colWidths = [75, 115, 70, 75, 70, 70];
  const headers = ["Data", "Sede", "Km (A/R)", "Rimb. Km", "Buono Pasto", "Totale"];
  
  doc.save();
  doc.rect(L, y, W, 22).fill("#F3F4F6");
  doc.restore();
  
  let headerX = L + 8;
  headers.forEach((h, i) => {
    doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.dark).text(h, headerX, y + 7, { width: colWidths[i] - 10 });
    headerX += colWidths[i];
  });
  y += 24;
  
  // Table rows (no hours/time columns)
  data.shifts.forEach((shift, idx) => {
    const rowBg = idx % 2 === 0 ? "#FFFFFF" : "#FAFAFA";
    doc.save();
    doc.rect(L, y, W, 20).fill(rowBg);
    doc.restore();
    
    let cellX = L + 8;
    // Format date on single line: "02/12/2025"
    const dateObj = new Date(shift.shiftDate);
    const shiftDateStr = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;
    
    const rowData = [
      shiftDateStr,
      shift.locationName.length > 16 ? shift.locationName.substring(0, 15) + "..." : shift.locationName,
      shift.kmDistance.toFixed(1),
      formatCurrency(shift.kmAmount),
      formatCurrency(shift.mealAmount),
      formatCurrency(shift.totalAmount)
    ];
    
    rowData.forEach((cell, i) => {
      doc.font("Helvetica").fontSize(8).fillColor(COLORS.dark).text(cell, cellX, y + 6, { width: colWidths[i] - 10 });
      cellX += colWidths[i];
    });
    y += 20;
  });
  
  // Table footer with totals
  doc.save();
  doc.rect(L, y, W, 24).fill("#E0F2FE");
  doc.restore();
  
  let footerX = L + 8;
  const footerData = [
    "TOTALE",
    "",
    Math.round(data.reimbursement.totalKm).toString(),
    formatCurrency(data.reimbursement.totalAmount - (data.reimbursement.totalMeals * data.reimbursement.mealAllowance)),
    formatCurrency(data.reimbursement.totalMeals * data.reimbursement.mealAllowance),
    formatCurrency(data.reimbursement.totalAmount)
  ];
  
  footerData.forEach((cell, i) => {
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.dark).text(cell, footerX, y + 7, { width: colWidths[i] - 10 });
    footerX += colWidths[i];
  });
  y += 30;

  // ========== CALCULATION BREAKDOWN ==========
  doc.save();
  doc.roundedRect(L, y, W, 55, 6).fill("#FEF3C7").stroke("#F59E0B");
  doc.restore();
  
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#92400E").text("DETTAGLIO CALCOLO", L + 12, y + 10);
  doc.font("Helvetica").fontSize(9).fillColor("#78350F");
  doc.text(`Rimborso Km: ${Math.round(data.reimbursement.totalKm)} km x ${formatCurrency(data.reimbursement.kmRate)}/km = ${formatCurrency(data.reimbursement.totalAmount - (data.reimbursement.totalMeals * data.reimbursement.mealAllowance))}`, L + 12, y + 24);
  doc.text(`Buoni Pasto: ${data.reimbursement.totalMeals} turni x ${formatCurrency(data.reimbursement.mealAllowance)} = ${formatCurrency(data.reimbursement.totalMeals * data.reimbursement.mealAllowance)}`, L + 12, y + 38);
  
  y += 70;

  // ========== ACCEPTANCE SECTION ==========
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.primary).text("DICHIARAZIONE DI ACCETTAZIONE", L, y);
  y += 16;
  
  doc.save();
  doc.roundedRect(L, y, W, 60, 6).stroke("#10B981");
  doc.restore();
  
  // Empty checkbox
  doc.rect(L + 12, y + 15, 14, 14).stroke(COLORS.gray);
  
  doc.font("Helvetica").fontSize(9).fillColor(COLORS.dark).text(
    data.acceptanceText || "Dichiaro di aver verificato i dati sopra riportati e di accettare il rimborso chilometrico indicato. Confermo che le informazioni relative ai turni svolti e ai chilometri percorsi sono corrette e corrispondono alla reale attivita svolta.",
    L + 34, y + 12, { width: W - 50, lineGap: 3 }
  );
  
  y += 75;

  // ========== SIGNATURE SECTION ==========
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.primary).text("FIRMA DIGITALE", L, y);
  y += 14;
  
  const sigBoxWidth = W / 2 - 20;
  
  // Volunteer signature label above box
  doc.font("Helvetica").fontSize(8).fillColor(COLORS.gray).text("Firma del Volontario", L, y);
  y += 12;
  
  // Volunteer signature box
  doc.save();
  doc.roundedRect(L, y, sigBoxWidth, 60, 6).stroke(COLORS.lightGray);
  doc.restore();
  
  if (data.reimbursement.signatureData) {
    try {
      const sigBuffer = Buffer.from(data.reimbursement.signatureData.replace(/^data:image\/\w+;base64,/, ""), "base64");
      doc.image(sigBuffer, L + 10, y + 10, { height: 40, fit: [sigBoxWidth - 20, 40] });
    } catch {
      // Empty box if signature not available
    }
  }
  
  // Approval signature label above box (same Y level as volunteer label)
  const approvalX = L + sigBoxWidth + 40;
  doc.font("Helvetica").fontSize(8).fillColor(COLORS.gray).text("Approvazione Responsabile", approvalX, y - 12);
  
  // Approval signature box
  doc.save();
  doc.roundedRect(approvalX, y, sigBoxWidth, 60, 6).stroke(COLORS.lightGray);
  doc.restore();
  
  // Empty box - no placeholder text
  
  y += 80;

  // Date and signature timestamp
  if (data.reimbursement.signedAt) {
    doc.font("Helvetica").fontSize(8).fillColor(COLORS.gray);
    doc.text(`Documento firmato digitalmente il ${formatDate(data.reimbursement.signedAt)} alle ${new Date(data.reimbursement.signedAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`, L, y);
  }

  // ========== FOOTER (per page) - clean ==========
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    const footerY = 780;
    doc.strokeColor(COLORS.lightGray).lineWidth(0.5).moveTo(L, footerY).lineTo(R, footerY).stroke();
  }

  return doc;
}
