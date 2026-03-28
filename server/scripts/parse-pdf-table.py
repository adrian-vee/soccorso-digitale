#!/usr/bin/env python3
"""
parse-pdf-table.py
Estrae tabelle da PDF usando pdfplumber (coordinate-based).
Funziona con PDF generati da ReportLab, Word, Excel e la maggior parte dei
PDF con tabelle visibili (non solo scansioni).

Utilizzo: python3 parse-pdf-table.py <percorso_pdf>
Output:   JSON su stdout
"""
import pdfplumber
import json
import sys


def _clean_row(row):
    return [str(cell or "").strip() for cell in row]


def _is_empty(row):
    return not any(row)


def parse_pdf(pdf_path):
    headers = []
    all_rows = []

    with pdfplumber.open(pdf_path) as pdf:

        # ── Pass 1: extract_tables() con impostazioni di default ─────────────
        for page in pdf.pages:
            tables = page.extract_tables()
            if not tables:
                continue
            for table in tables:
                for row in (table or []):
                    cleaned = _clean_row(row)
                    if _is_empty(cleaned):
                        continue
                    if not headers:
                        headers = cleaned
                    else:
                        all_rows.append(cleaned)

        # ── Pass 2: se non ha trovato nulla, prova "text" strategy ───────────
        if not headers:
            for page in pdf.pages:
                table = page.extract_table({
                    "vertical_strategy": "text",
                    "horizontal_strategy": "text",
                    "min_words_vertical": 2,
                    "min_words_horizontal": 1,
                })
                if not table:
                    continue
                for row in table:
                    cleaned = _clean_row(row)
                    if _is_empty(cleaned):
                        continue
                    if not headers:
                        headers = cleaned
                    else:
                        all_rows.append(cleaned)

        # ── Pass 3: explicit_vertical_lines / lines strategy ─────────────────
        if not headers:
            for page in pdf.pages:
                table = page.extract_table({
                    "vertical_strategy": "lines",
                    "horizontal_strategy": "lines",
                })
                if not table:
                    continue
                for row in table:
                    cleaned = _clean_row(row)
                    if _is_empty(cleaned):
                        continue
                    if not headers:
                        headers = cleaned
                    else:
                        all_rows.append(cleaned)

    result = {
        "success": bool(headers),
        "headers": headers,
        "rows": all_rows[:30],
        "totalRows": len(all_rows),
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No file path provided"}))
        sys.exit(1)

    try:
        parse_pdf(sys.argv[1])
    except Exception as exc:
        print(json.dumps({"success": False, "error": str(exc)}))
        sys.exit(1)
