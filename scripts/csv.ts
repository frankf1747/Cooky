// Minimal RFC 4180 CSV parser for the seed files (quotes, embedded commas and newlines, CRLF).

export function parseCsv(text: string): Record<string, string>[] {
  const rows: { fields: string[]; line: number }[] = [];
  let field = "";
  let fields: string[] = [];
  let quoted = false;
  let line = 1;
  let rowLine = 1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else {
        if (c === "\n") line++;
        field += c;
      }
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      fields.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      fields.push(field);
      if (fields.some((f) => f !== "")) rows.push({ fields, line: rowLine });
      fields = [];
      field = "";
      line++;
      rowLine = line;
    } else field += c;
  }
  fields.push(field);
  if (fields.some((f) => f !== "")) rows.push({ fields, line: rowLine });

  const [header, ...body] = rows;
  if (!header) return [];
  return body.map(({ fields: f, line: n }) => {
    if (f.length !== header.fields.length) throw new Error(`line ${n}: expected ${header.fields.length} fields, got ${f.length}`);
    return Object.fromEntries(header.fields.map((h, j) => [h.trim(), f[j]]));
  });
}
