/** RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). Google Sheets "Publish to web" output. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Normalise a header cell: "Description (KA)" -> "description ka". */
export function normaliseHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/[()[\]_\-:/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type Table = {
  /** Cell by canonical column key for a data row, trimmed; '' when missing. */
  rows: { rowNumber: number; get: (key: string) => string; has: (key: string) => boolean }[];
  columns: Set<string>;
};

/**
 * Map a CSV's header row to canonical keys.
 * `exact` aliases must match the whole header; `prefix` aliases also match
 * "price (gel)", "sold out?" and similar.
 */
export function readTable(
  text: string,
  spec: Record<string, { exact?: string[]; prefix?: string[] }>,
): Table {
  const all = parseCsv(text);
  const headerIndex = all.findIndex((r) => r.some((c) => c.trim()));
  if (headerIndex < 0) return { rows: [], columns: new Set() };

  const header = all[headerIndex]!.map(normaliseHeader);
  const index = new Map<string, number>();
  for (const [key, { exact = [], prefix = [] }] of Object.entries(spec)) {
    let i = header.findIndex((h) => exact.includes(h));
    if (i < 0) i = header.findIndex((h) => prefix.some((p) => h === p || h.startsWith(`${p} `)));
    if (i >= 0 && ![...index.values()].includes(i)) index.set(key, i);
  }

  const rows = all
    .slice(headerIndex + 1)
    .map((cells, i) => ({ cells, rowNumber: headerIndex + i + 2 }))
    .filter(({ cells }) => cells.some((c) => c.trim()))
    .map(({ cells, rowNumber }) => ({
      rowNumber,
      get: (key: string) => {
        const i = index.get(key);
        return i === undefined ? '' : (cells[i] ?? '').trim();
      },
      has: (key: string) => index.has(key),
    }));

  return { rows, columns: new Set(index.keys()) };
}
