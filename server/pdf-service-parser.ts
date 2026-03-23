import { PDFParse } from "pdf-parse";

export interface ParsedService {
  progressiveCode: string | null;
  scheduledTime: string;
  serviceType: string;
  estimatedKm: number | null;
  patientName: string | null;
  patientCondition: string | null;
  patientWeight: number | null;
  patientPhone: string | null;
  patientNotes: string | null;
  patientFloor: string | null;
  patientBell: string | null;
  originName: string | null;
  originAddress: string | null;
  originCity: string | null;
  originProvince: string | null;
  originFloor: string | null;
  destinationName: string | null;
  destinationAddress: string | null;
  destinationCity: string | null;
  destinationProvince: string | null;
  destinationFloor: string | null;
  destinationPhone: string | null;
  precautions: string | null;
  notes: string | null;
  additionalPersonnel: string | null;
  transportMode: string | null;
}

export interface ParsedPdfResult {
  vehicleName: string | null;
  serviceDate: string | null;
  services: ParsedService[];
  rawText: string;
  pageCount: number;
}

function extractField(text: string, fieldName: string): string | null {
  const regex = new RegExp(`${fieldName}:\\s*(.+?)(?:\\n|$)`, "i");
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

function parseServiceBlock(block: string): ParsedService {
  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);

  let progressiveCode: string | null = null;
  let scheduledTime = "";
  let serviceType = "";
  let estimatedKm: number | null = null;
  let patientName: string | null = null;
  let patientCondition: string | null = null;
  let patientWeight: number | null = null;
  let patientPhone: string | null = null;
  let patientNotes: string | null = null;
  let patientFloor: string | null = null;
  let patientBell: string | null = null;
  let originName: string | null = null;
  let originAddress: string | null = null;
  let originCity: string | null = null;
  let originProvince: string | null = null;
  let originFloor: string | null = null;
  let destinationName: string | null = null;
  let destinationAddress: string | null = null;
  let destinationCity: string | null = null;
  let destinationProvince: string | null = null;
  let destinationFloor: string | null = null;
  let destinationPhone: string | null = null;
  let precautions: string | null = null;
  let notes: string | null = null;
  let additionalPersonnel: string | null = null;
  let transportMode: string | null = null;

  const progMatch = block.match(/Prog\.:\s*(\S+)/i);
  if (progMatch) progressiveCode = progMatch[1];

  const oraMatch = block.match(/Ora:\s*(\d{1,2}:\d{2})/i);
  if (oraMatch) scheduledTime = oraMatch[1];

  const tipoMatch = block.match(/Tipo servizio:\s*(.+?)(?=KM percorso|$)/is);
  if (tipoMatch) {
    serviceType = tipoMatch[1].replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  }

  const kmMatch = block.match(/KM percorso:\s*([\d.,]+)/i);
  if (kmMatch) estimatedKm = parseFloat(kmMatch[1].replace(",", "."));

  const roundTripTypes = [
    "prestazione specialistica",
    "visita specialistica",
    "visita medica",
    "day hospital",
    "day-hospital",
  ];
  if (estimatedKm && serviceType) {
    const stLower = serviceType.toLowerCase();
    if (roundTripTypes.some(rt => stLower.includes(rt))) {
      estimatedKm = estimatedKm * 2;
    }
  }

  const pzMatch = block.match(/Pz:\s*(.+?)(?:\n|$)/i);
  if (pzMatch) patientName = pzMatch[1].trim();

  const condMatch = block.match(/Condizioni:\s*([\s\S]*?)(?=\nPeso:)/i);
  if (condMatch) {
    patientCondition = condMatch[1].replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  }

  const pesoMatch = block.match(/Peso:\s*(\d+)/i);
  if (pesoMatch) patientWeight = parseInt(pesoMatch[1]);

  const telMatch = block.match(/Tel\. Pz:\s*([\s\S]*?)(?=\nNote ab\.|$)/i);
  if (telMatch) {
    patientPhone = telMatch[1].replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  }

  const pianoAbMatch = block.match(/Piano ab\.:\s*(.+?)(?:\n|$)/i);
  const campanelloLine = block.match(/\nCampanello:\s*(.*?)(?:\n|$)/i);
  patientFloor = pianoAbMatch ? pianoAbMatch[1].trim() : null;
  if (campanelloLine) {
    let bellVal = campanelloLine[1].replace(/Note\.\s*Pz:.*$/i, "").trim();
    patientBell = bellVal || null;
  }

  const notePzMatch = block.match(/Note\. Pz:\s*([\s\S]*?)(?=\nDa:)/i);
  if (notePzMatch) {
    patientNotes = notePzMatch[1].replace(/\n/g, " ").replace(/\s+/g, " ").trim();
    if (!patientNotes) patientNotes = null;
  }

  const daToAMatch = block.match(/\nDa:\s*([\s\S]*?)(?=\nA:\s)/i);
  if (daToAMatch) {
    const originSection = daToAMatch[1];
    const nameLines: string[] = [];
    for (const line of originSection.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (/^(Piano|Via|Città|Prov):/i.test(trimmed)) break;
      nameLines.push(trimmed);
    }
    originName = nameLines.join(" ") || null;
    const oviaMatch = originSection.match(/\nVia:\s*(.+?)(?:\n|$)/i);
    const ocittaMatch = originSection.match(/\nCittà:\s*(.+?)(?:\n|$)/i);
    const oprovMatch = originSection.match(/\nProv:\s*(\w+)/i);
    const opianoMatch = originSection.match(/\nPiano:\s*(.+?)(?:\n|$)/i);
    if (oviaMatch) originAddress = oviaMatch[1].trim();
    if (ocittaMatch) originCity = ocittaMatch[1].trim();
    if (oprovMatch) originProvince = oprovMatch[1].trim();
    if (opianoMatch) originFloor = opianoMatch[1].trim();
  }

  const aToEndMatch = block.match(/\nA:\s*([\s\S]*?)(?=\nTipi precauzioni:)/i);
  if (aToEndMatch) {
    const destSection = aToEndMatch[1];
    const dNameLines: string[] = [];
    for (const line of destSection.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (/^(Piano|Via|Città|Prov):/i.test(trimmed)) break;
      dNameLines.push(trimmed);
    }
    destinationName = dNameLines.join(" ") || null;
    const dviaMatch = destSection.match(/\nVia:\s*(.+?)(?:\n|$)/i);
    const dcittaMatch = destSection.match(/\nCittà:\s*(.+?)(?:\n|$)/i);
    const dprovMatch = destSection.match(/\nProv:\s*(\w+)/i);
    const dpianoMatch = destSection.match(/\nPiano:\s*(.+?)(?:\n|$)/i);
    if (dviaMatch) destinationAddress = dviaMatch[1].trim();
    if (dcittaMatch) destinationCity = dcittaMatch[1].trim();
    if (dprovMatch) destinationProvince = dprovMatch[1].trim();
    if (dpianoMatch) destinationFloor = dpianoMatch[1].trim();
  }

  const precMatch = block.match(/Tipi precauzioni:\s*(.+?)(?:\n|$)/i);
  if (precMatch) precautions = precMatch[1].trim();

  const noteMatch = block.match(/\nNote:\s*([\s\S]*?)(?=\nPersonale e\/o)/i);
  if (noteMatch) {
    notes = noteMatch[1].replace(/\n/g, " ").replace(/\s+/g, " ").trim();
    if (!notes) notes = null;
  }

  const persMatch = block.match(/Personale e\/o Presidi\s*\n?aggiuntivi:\s*([\s\S]*?)(?=\nModalità)/i);
  if (persMatch) {
    additionalPersonnel = persMatch[1].replace(/\n/g, " ").replace(/\s+/g, " ").trim();
    if (!additionalPersonnel) additionalPersonnel = null;
  }

  const modMatch = block.match(/Modalità di trasporto:\s*([\s\S]*?)$/i);
  if (modMatch) {
    transportMode = modMatch[1]
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\d{2}\/\d{2}\/\d{4}.*$/, "")
      .trim();
  }

  return {
    progressiveCode,
    scheduledTime,
    serviceType,
    estimatedKm,
    patientName,
    patientCondition,
    patientWeight,
    patientPhone,
    patientNotes,
    patientFloor,
    patientBell,
    originName,
    originAddress,
    originCity,
    originProvince,
    originFloor,
    destinationName,
    destinationAddress,
    destinationCity,
    destinationProvince,
    destinationFloor,
    destinationPhone,
    precautions,
    notes,
    additionalPersonnel,
    transportMode,
  };
}

export async function parsePdfServices(
  buffer: Buffer
): Promise<ParsedPdfResult> {
  const uint8 = new Uint8Array(buffer);
  const parser = new PDFParse(uint8);
  await (parser as any).load();
  const result = await parser.getText();

  let rawText = "";
  if (result && typeof result === "object" && "pages" in result) {
    const pages = (result as any).pages;
    if (Array.isArray(pages)) {
      rawText = pages.map((p: any) => (typeof p === "string" ? p : p.text || "")).join("\n");
    } else {
      rawText = String(result);
    }
  } else {
    rawText = String(result);
  }

  const pageCount = (result as any)?.total || 1;

  parser.destroy();

  let vehicleName: string | null = null;
  const vehicleMatch = rawText.match(
    /Movimenti del mezzo\s+(.+?)(?:\n|$)/i
  );
  if (vehicleMatch) vehicleName = vehicleMatch[1].trim();

  let serviceDate: string | null = null;
  const dateMatch = rawText.match(/(\d{2}\/\d{2}\/\d{4})/);
  if (dateMatch) {
    const [dd, mm, yyyy] = dateMatch[1].split("/");
    serviceDate = `${yyyy}-${mm}-${dd}`;
  }

  const cleanedText = rawText.replace(/-- \d+ of \d+ --/g, "");

  const serviceBlocks: string[] = [];
  const progSplit = cleanedText.split(/(?=Prog\.:\s)/i);
  for (const block of progSplit) {
    if (block.match(/Prog\.:\s/i)) {
      serviceBlocks.push(block.trim());
    }
  }

  const services = serviceBlocks.map(parseServiceBlock);

  return {
    vehicleName,
    serviceDate,
    services,
    rawText,
    pageCount,
  };
}
