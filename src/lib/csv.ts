// Lightweight CSV utilities. Handles quoted fields, escaped quotes, CRLF, and
// embedded newlines/commas inside quoted cells. Good enough for catalog
// import/export — not a substitute for a full RFC 4180 parser.

export interface ParsedCsv {
  header: string[];
  rows: string[][];
}

export function parseCsv(text: string): ParsedCsv {
  const trimmed = text.replace(/^﻿/, '');
  const out: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;
  const n = trimmed.length;

  while (i < n) {
    const c = trimmed[i];

    if (inQuotes) {
      if (c === '"') {
        if (trimmed[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += c;
      i += 1;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ',') {
      row.push(cell);
      cell = '';
      i += 1;
      continue;
    }
    if (c === '\r') {
      // swallow optional \n
      if (trimmed[i + 1] === '\n') i += 1;
      row.push(cell);
      out.push(row);
      row = [];
      cell = '';
      i += 1;
      continue;
    }
    if (c === '\n') {
      row.push(cell);
      out.push(row);
      row = [];
      cell = '';
      i += 1;
      continue;
    }
    cell += c;
    i += 1;
  }

  // flush
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    out.push(row);
  }

  // drop trailing empty line if present
  while (out.length > 0 && out[out.length - 1].every((v) => v === '')) {
    out.pop();
  }

  if (out.length === 0) return { header: [], rows: [] };

  const header = out[0].map((h) => h.trim());
  const rows = out.slice(1);
  return { header, rows };
}

export function rowsToObjects(parsed: ParsedCsv): Array<Record<string, string>> {
  return parsed.rows.map((cells) => {
    const obj: Record<string, string> = {};
    parsed.header.forEach((key, idx) => {
      obj[key] = (cells[idx] ?? '').trim();
    });
    return obj;
  });
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'string' ? value : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(header: string[], rows: Array<Record<string, unknown>>): string {
  const lines = [header.map(escapeCsvCell).join(',')];
  for (const row of rows) {
    lines.push(header.map((key) => escapeCsvCell(row[key])).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}
