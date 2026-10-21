// Test helper (not a test): a tiny in-memory stand-in for the Supabase query builder covering what
// the planning module uses. It does NOT apply RLS, so tests built on it prove the code filters by
// the session user itself. Unique keys can be declared per table to exercise 23505 conflicts, and
// column defaults (like created_at) per table.
type Row = Record<string, unknown>;
type Res = { data: unknown; error: { message: string; code?: string } | null };

export function fakeDb(tables: Record<string, Row[]>, opts: { unique?: Record<string, string[][]>; fail?: string[]; defaults?: Record<string, () => Row> } = {}) {
  function query(table: string) {
    const preds: ((r: Row) => boolean)[] = [];
    let op: { kind: "select" } | { kind: "insert"; rows: Row[] } | { kind: "update"; patch: Row } | { kind: "delete" } = { kind: "select" };
    let order: { col: string; asc: boolean } | null = null;
    const rowsOf = () => (tables[table] ??= []);

    const run = (): Res => {
      if (opts.fail?.includes(table)) return { data: null, error: { message: `boom in ${table}` } };
      if (op.kind === "insert") {
        for (const row of op.rows) {
          for (const cols of opts.unique?.[table] ?? []) {
            if (rowsOf().some((r) => cols.every((c) => r[c] === row[c]))) {
              return { data: null, error: { message: `duplicate key on ${table} (${cols.join(", ")})`, code: "23505" } };
            }
          }
        }
        rowsOf().push(...op.rows.map((r) => ({ ...opts.defaults?.[table]?.(), ...structuredClone(r) })));
        return { data: null, error: null };
      }
      const hit = rowsOf().filter((r) => preds.every((p) => p(r)));
      if (op.kind === "update") {
        for (const r of hit) Object.assign(r, op.patch);
        return { data: null, error: null };
      }
      if (op.kind === "delete") {
        tables[table] = rowsOf().filter((r) => !hit.includes(r));
        return { data: null, error: null };
      }
      const out = hit.map((r) => structuredClone(r));
      if (order) {
        const { col, asc } = order;
        out.sort((a, b) => String(a[col]).localeCompare(String(b[col])) * (asc ? 1 : -1));
      }
      return { data: out, error: null };
    };

    const q = {
      select: () => q,
      insert: (rows: Row | Row[]) => ((op = { kind: "insert", rows: Array.isArray(rows) ? rows : [rows] }), q),
      update: (patch: Row) => ((op = { kind: "update", patch }), q),
      delete: () => ((op = { kind: "delete" }), q),
      eq: (c: string, v: unknown) => (preds.push((r) => r[c] === v), q),
      is: (c: string, v: null) => (preds.push((r) => (r[c] ?? null) === v), q),
      in: (c: string, vs: unknown[]) => (preds.push((r) => vs.includes(r[c])), q),
      or: (expr: string) => {
        const alts = expr.split(",").map((part) => {
          const [c, o, ...rest] = part.split(".");
          const v = rest.join(".");
          return (r: Row) => (o === "is" && v === "null" ? r[c] == null : o === "eq" ? r[c] === v : false);
        });
        preds.push((r) => alts.some((a) => a(r)));
        return q;
      },
      order: (col: string, o?: { ascending?: boolean }) => ((order = { col, asc: o?.ascending ?? true }), q),
      maybeSingle: async (): Promise<Res> => {
        const res = run();
        return res.error ? res : { data: (res.data as Row[])[0] ?? null, error: null };
      },
      then: (ok: (v: Res) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(run()).then(ok, bad),
    };
    return q;
  }
  return { from: query };
}
