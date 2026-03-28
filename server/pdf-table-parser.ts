/**
 * pdf-table-parser.ts
 *
 * Smart table detection from raw PDF text output (pdf-parse).
 * Uses whitespace-gap analysis to detect column boundaries in
 * columnar PDFs (as opposed to the Croce-Europa block-text format).
 *
 * Exported functions:
 *   parseSampleTable(buffer) → { headers, rows, totalRows }
 *   applyTemplateMapping(rows, mapping) → ParsedTemplateRow[]
 */

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

// ─── Column boundary detection ────────────────────────────────────────────────

/**
 * Given a "header-like" line, find the character positions where each column starts.
 * Strategy: scan for runs of ≥2 spaces that separate word groups.
 */
function detectColumnPositions(line: string): number[] {
  const positions: number[] = [0];
  let i = 0;

  while (i < line.length) {
    // Find start of a space run
    if (line[i] === " ") {
      const spaceStart = i;
      while (i < line.length && line[i] === " ") i++;
      const spaceLen = i - spaceStart;
      // Gap of ≥2 spaces = column boundary
      if (spaceLen >= 2 && i < line.length) {
        positions.push(i);
      }
    } else {
      i++;
    }
  }

  return positions;
}

/**
 * Split a line into cells using the column positions detected from the header.
 */
function splitByPositions(line: string, positions: number[]): string[] {
  return positions.map((start, idx) => {
    const end = positions[idx + 1] ?? line.length;
    return line.slice(start, end).trim();
  });
}

/**
 * Heuristic: split each line by 2+ consecutive spaces.
 * Returns the cell array. Lines that split into ≠ target columns are filtered.
 */
function splitBySeparator(line: string): string[] {
  return line.split(/\s{2,}/).map(s => s.trim()).filter(Boolean);
}

// ─── Table detection ──────────────────────────────────────────────────────────

/**
 * Given raw PDF text, attempt to detect a tabular structure.
 * Returns detected headers and rows.
 *
 * Two strategies tried in order:
 *  A) Column-position-based (for fixed-width PDFs)
 *  B) Multi-space separator (for PDFs with 2+ space gaps between cells)
 */
function detectTable(rawText: string): { headers: string[]; rows: string[][] } {
  const lines = rawText
    .split("\n")
    .map(l => l.replace(/\r/g, "").trimEnd())
    .filter(l => l.trim().length > 3);

  // ── Strategy B: look for lines that split into 3+ cells by 2+ spaces ──────
  // Determine the "mode" column count (most common split count among content lines)
  const splitCounts: number[] = lines
    .map(l => splitBySeparator(l).length)
    .filter(n => n >= 3);

  if (splitCounts.length === 0) {
    return { headers: [], rows: [] };
  }

  // Find the most common column count
  const countFreq: Record<number, number> = {};
  for (const c of splitCounts) countFreq[c] = (countFreq[c] || 0) + 1;
  const targetCols = parseInt(
    Object.entries(countFreq).sort((a, b) => b[1] - a[1])[0][0],
    10
  );

  // Find the first line that matches the column count — treat it as header
  const headerLineIdx = lines.findIndex(
    l => splitBySeparator(l).length === targetCols
  );
  if (headerLineIdx < 0) return { headers: [], rows: [] };

  const headers = splitBySeparator(lines[headerLineIdx]);

  // All subsequent lines with the same column count = data rows
  const rows = lines
    .slice(headerLineIdx + 1)
    .map(l => splitBySeparator(l))
    .filter(cells => cells.length >= targetCols - 1 && cells.length <= targetCols + 1)
    // Pad or trim to exact column count
    .map(cells => {
      while (cells.length < targetCols) cells.push("");
      return cells.slice(0, targetCols);
    });

  return { headers, rows };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a PDF buffer and detect the tabular structure inside it.
 * Returns the first 5 rows as a sample (admin uses this to configure the mapping).
 *
 * Strategy 1: coordinate-based table extraction via getTable()
 *   Works with ReportLab, Word-generated, and other positional PDFs.
 * Strategy 2: whitespace-gap text analysis via getText() (fallback)
 *   Works with fixed-width text PDFs where columns are separated by spaces.
 */
export async function parseSampleTable(buffer: Buffer): Promise<SampleTableResult> {
  // Strategy 1: coordinate-based (getTable)
  try {
    const tableParser = new PDFParse({ data: Buffer.from(buffer) });
    const tableResult = await tableParser.getTable();
    await tableParser.destroy?.();

    if (tableResult.mergedTables?.length > 0) {
      const firstTable = tableResult.mergedTables[0];
      if (firstTable.length >= 2) {
        const headers = (firstTable[0] || []).map(h => String(h ?? "").trim());
        const dataRows = firstTable.slice(1).map(row =>
          row.map(cell => String(cell ?? "").trim())
        );
        if (headers.some(h => h.length > 0)) {
          // Also grab raw text for rawTextPreview in error cases
          let rawText = "";
          try {
            const textParser = new PDFParse({ data: Buffer.from(buffer) });
            const textResult = await textParser.getText();
            await textParser.destroy?.();
            rawText = textResult.text || "";
          } catch {
            // rawText is optional — swallow
          }
          return {
            headers,
            rows: dataRows.slice(0, 5),
            totalRows: dataRows.length,
            rawText,
          };
        }
      }
    }
  } catch (tableErr) {
    console.warn("[pdf-table-parser] getTable() failed, falling back to getText():", (tableErr as Error).message);
  }

  // Strategy 2: whitespace-gap text fallback
  const textParser = new PDFParse({ data: Buffer.from(buffer) });
  const textResult = await textParser.getText();
  await textParser.destroy?.();
  const rawText = textResult.text || "";
  const { headers, rows } = detectTable(rawText);

  return {
    headers,
    rows: rows.slice(0, 5),
    totalRows: rows.length,
    rawText,
  };
}

// ─── Template mapping ─────────────────────────────────────────────────────────

/**
 * Apply a template mapping to an array of raw rows.
 * Returns an array of structured service objects.
 */
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
      // Normalize time: "7:30" → "07:30", "7.30" → "07:30"
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
