/**
 * pdf-table-parser.ts
 *
 * Smart table detection from PDF buffers.
 *
 * Strategies (tried in order):
 *   1. pdfplumber (Python) — coordinate-based, best for ReportLab/Word/Excel
 *   2. pdf-parse getTable() — JavaScript coordinate-based
 *   3. pdf-parse getText() + whitespace/tab gap analysis
 *   4. Raw lines fallback — always succeeds for any text PDF
 *
 * Exported functions:
 *   parseSampleTable(buffer) → { headers, rows, totalRows }
 *   applyTemplateMapping(rows, mapping) → ParsedTemplateRow[]
 */

import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require("pdf-parse") as {
  PDFParse: new (options: { data: Buffer | Uint8Array }) => {
    getText(): Promise<{ text: string }>;
    getTable(): Promise<{ mergedTables: string[][][] }>;
    destroy?(): Promise<void>;
  };
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SampleTableResult {
  headers: string[];
  rows: string[][];
  totalRows: number;
  rawText: string;
}

export interface ColumnMapping {
  pdf_column_index: number;
  pdf_column_name: string;
  system_field: string;
  transform: string | null;
}

export interface TemplateConfig {
  mappings: ColumnMapping[];
}

export interface ParsedTemplateRow {
  departure_time?: string;
  return_time?: string;
  service_type?: string;
  vehicle_code?: string;
  patient_name?: string;
  patient_fiscal_code?: string;
  origin_address?: string;
  destination_address?: string;
  estimated_km?: number | null;
  notes?: string;
  crew_members?: string;
  priority?: string;
  phone_number?: string;
  booking_reference?: string;
  row_number?: string;
  [key: string]: string | number | null | undefined;
}

// ─── pdfplumber (Python) ──────────────────────────────────────────────────────

const PYTHON_BIN = process.platform === "win32" ? "python" : "python3";
// Works in both local dev (project root) and production Docker (/app)
const PDFPLUMBER_SCRIPT = path.join(process.cwd(), "server", "scripts", "parse-pdf-table.py");

interface PdfplumberResult {
  success: boolean;
  headers: string[];
  rows: string[][];
  totalRows: number;
  error?: string;
}

function parsePdfWithPdfplumber(buffer: Buffer): { headers: string[]; rows: string[][]; totalRows: number } | null {
  if (!fs.existsSync(PDFPLUMBER_SCRIPT)) {
    console.warn("[pdf-table-parser] pdfplumber script not found at:", PDFPLUMBER_SCRIPT);
    return null;
  }

  const tmpFile = path.join(os.tmpdir(), `pdf-parse-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  try {
    fs.writeFileSync(tmpFile, buffer);

    const raw = execSync(`"${PYTHON_BIN}" "${PDFPLUMBER_SCRIPT}" "${tmpFile}"`, {
      encoding: "utf-8",
      timeout: 30_000,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const result: PdfplumberResult = JSON.parse(raw.trim());

    if (!result.success || !result.headers?.length) {
      console.warn("[pdf-table-parser] pdfplumber: no table found.", result.error ?? "");
      return null;
    }

    // Require ≥2 columns — a single-column result means pdfplumber fell back to text flow
    if (result.headers.length < 2) {
      console.warn("[pdf-table-parser] pdfplumber returned single-column result — skipping");
      return null;
    }

    console.log(`[pdf-table-parser] pdfplumber OK — ${result.headers.length} cols, ${result.totalRows} rows`);
    return { headers: result.headers, rows: result.rows ?? [], totalRows: result.totalRows ?? 0 };
  } catch (err) {
    console.warn("[pdf-table-parser] pdfplumber error:", (err as Error).message.slice(0, 200));
    return null;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

// ─── Column boundary detection ────────────────────────────────────────────────

function splitBySeparator(line: string): string[] {
  return line.split(/\s{2,}/).map(s => s.trim()).filter(Boolean);
}

function detectTable(rawText: string): { headers: string[]; rows: string[][] } {
  const lines = rawText
    .split("\n")
    .map(l => l.replace(/\r/g, "").trimEnd())
    .filter(l => l.trim().length > 3);

  // ── Strategy A: tab-separated ─────────────────────────────────────────────
  const tabLines = lines.filter(l => l.includes("\t"));
  if (tabLines.length >= 2) {
    const headers = tabLines[0].split("\t").map(s => s.trim()).filter(Boolean);
    if (headers.length >= 2) {
      const rows = tabLines.slice(1).map(l => l.split("\t").map(s => s.trim()));
      return { headers, rows };
    }
  }

  // ── Strategy B: 2+ space gap detection ───────────────────────────────────
  const splitCounts = lines.map(l => splitBySeparator(l).length).filter(n => n >= 3);
  if (splitCounts.length >= 2) {
    const countFreq: Record<number, number> = {};
    for (const c of splitCounts) countFreq[c] = (countFreq[c] || 0) + 1;
    const targetCols = parseInt(Object.entries(countFreq).sort((a, b) => b[1] - a[1])[0][0], 10);

    const headerLineIdx = lines.findIndex(l => splitBySeparator(l).length === targetCols);
    if (headerLineIdx >= 0) {
      const headers = splitBySeparator(lines[headerLineIdx]);
      const rows = lines
        .slice(headerLineIdx + 1)
        .map(l => splitBySeparator(l))
        .filter(cells => cells.length >= targetCols - 1 && cells.length <= targetCols + 1)
        .map(cells => {
          while (cells.length < targetCols) cells.push("");
          return cells.slice(0, targetCols);
        });
      if (rows.length > 0) return { headers, rows };
    }
  }

  // ── Strategy C: raw lines (last resort) ──────────────────────────────────
  if (lines.length >= 2) {
    console.warn("[pdf-table-parser] detectTable: no multi-column structure — returning raw lines fallback");
    return {
      headers: ["Contenuto"],
      rows: lines.slice(0, 50).map(l => [l.trim()]),
    };
  }

  return { headers: [], rows: [] };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a PDF buffer and detect the tabular structure inside it.
 * Returns up to 5 sample rows (admin uses this to configure the mapping).
 */
export async function parseSampleTable(buffer: Buffer): Promise<SampleTableResult> {
  // ── Strategy 1: pdfplumber (Python, coordinate-based) ────────────────────
  const plumber = parsePdfWithPdfplumber(buffer);
  if (plumber) {
    // Fetch rawText in background for the preview field
    let rawText = "";
    try {
      const tp = new PDFParse({ data: Buffer.from(buffer) });
      rawText = (await tp.getText()).text || "";
      await tp.destroy?.();
    } catch { /* optional */ }

    return {
      headers: plumber.headers,
      rows: plumber.rows.slice(0, 5),
      totalRows: plumber.totalRows,
      rawText,
    };
  }

  // ── Strategy 2: pdf-parse getTable() (JS, coordinate-based) ──────────────
  try {
    const tableParser = new PDFParse({ data: Buffer.from(buffer) });
    const tableResult = await tableParser.getTable();
    await tableParser.destroy?.();

    console.log(`[pdf-table-parser] getTable() → ${tableResult.mergedTables?.length ?? 0} table(s)`);

    if (tableResult.mergedTables?.length > 0) {
      const firstTable = tableResult.mergedTables[0];
      if (firstTable.length >= 2) {
        const headers = (firstTable[0] || []).map(h => String(h ?? "").trim());
        const dataRows = firstTable.slice(1).map(row => row.map(cell => String(cell ?? "").trim()));
        if (headers.some(h => h.length > 0)) {
          let rawText = "";
          try {
            const tp = new PDFParse({ data: Buffer.from(buffer) });
            rawText = (await tp.getText()).text || "";
            await tp.destroy?.();
          } catch { /* optional */ }
          console.log(`[pdf-table-parser] getTable() success — ${headers.length} headers`);
          return { headers, rows: dataRows.slice(0, 5), totalRows: dataRows.length, rawText };
        }
      }
    }
  } catch (tableErr) {
    console.warn("[pdf-table-parser] getTable() failed:", (tableErr as Error).message);
  }

  // ── Strategies 3 + 4: getText() + whitespace/tab/raw-lines ───────────────
  const textParser = new PDFParse({ data: Buffer.from(buffer) });
  const textResult = await textParser.getText();
  await textParser.destroy?.();
  const rawText = textResult.text || "";
  console.log(`[pdf-table-parser] getText() → ${rawText.length} chars | preview: ${JSON.stringify(rawText.slice(0, 200))}`);

  const { headers, rows } = detectTable(rawText);
  return { headers, rows: rows.slice(0, 5), totalRows: rows.length, rawText };
}

// ─── Template mapping ─────────────────────────────────────────────────────────

export function applyTemplateMapping(
  rows: string[][],
  config: TemplateConfig,
  options: { skipFooterRows?: number } = {}
): ParsedTemplateRow[] {
  const { mappings } = config;
  const { skipFooterRows = 0 } = options;

  const dataRows = skipFooterRows > 0 ? rows.slice(0, -skipFooterRows) : rows;

  return dataRows.map(cells => {
    const result: ParsedTemplateRow = {};

    for (const m of mappings) {
      if (m.system_field === "ignore") continue;

      const rawValue = cells[m.pdf_column_index] ?? "";
      const value = applyTransform(rawValue.trim(), m.transform);

      if (m.system_field === "estimated_km") {
        result.estimated_km = parseFloat(String(value).replace(",", ".")) || null;
      } else {
        result[m.system_field] = value as string;
      }
    }

    return result;
  });
}

function applyTransform(value: string, transform: string | null): string | number | null {
  if (!transform || !value) return value;

  switch (transform) {
    case "parse_time": {
      const m = value.match(/^(\d{1,2})[:\.](\d{2})/);
      if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
      return value;
    }
    case "parse_number": {
      const n = parseFloat(value.replace(",", "."));
      return isNaN(n) ? null : n;
    }
    case "uppercase":
      return value.toUpperCase();
    case "lowercase":
      return value.toLowerCase();
    default:
      return value;
  }
}

// ─── System field registry ────────────────────────────────────────────────────

export const SYSTEM_FIELDS = [
  { value: "row_number",          label: "Numero riga" },
  { value: "departure_time",      label: "Orario partenza" },
  { value: "return_time",         label: "Orario ritorno" },
  { value: "service_type",        label: "Tipo servizio" },
  { value: "vehicle_code",        label: "Codice veicolo" },
  { value: "patient_name",        label: "Nome paziente" },
  { value: "patient_fiscal_code", label: "Codice fiscale" },
  { value: "origin_address",      label: "Indirizzo partenza" },
  { value: "destination_address", label: "Indirizzo destinazione" },
  { value: "estimated_km",        label: "KM stimati" },
  { value: "notes",               label: "Note" },
  { value: "crew_members",        label: "Equipaggio" },
  { value: "priority",            label: "Priorità" },
  { value: "phone_number",        label: "Telefono" },
  { value: "booking_reference",   label: "Riferimento prenotazione" },
  { value: "ignore",              label: "— Ignora questa colonna —" },
] as const;
