"use client";
// Owner: Plan & Shop. List, add, edit, pause and delete preferences (LRN3) through /api/preferences.
import Link from "next/link";
import { useState } from "react";
import type { Preference } from "@spec/contract";
import { EmptyState } from "@/ui/Page";
import { alert, btnPrimary as btn, btnSecondary, btnSecondarySm as btnGhost, field as input, h3, label, panel, rows, tagNeutral, tagStrong } from "@/ui/styles";

const CATEGORIES = ["flavor", "texture", "ingredient", "effort", "cleanup", "cuisine"] as const;

async function call(path: string, method: string, body?: unknown): Promise<{ ok: true; data: unknown } | { ok: false; message: string }> {
  try {
    const res = await fetch(path, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    if (res.status === 204) return { ok: true, data: null };
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: res.status === 404 ? "That preference no longer exists. Reload the page." : (data as { error?: string }).error ?? `Request failed (${res.status})` };
    return { ok: true, data };
  } catch {
    return { ok: false, message: "Couldn't reach Cooky. Check your connection and try again." };
  }
}

export function PreferencesClient({ initial, titles }: { initial: Preference[]; titles: Record<string, string> }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null); // a preference id, or "new"
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [draft, setDraft] = useState<{ kind: "soft" | "hard"; category: (typeof CATEGORIES)[number]; value: string }>({ kind: "soft", category: "flavor", value: "" });

  async function run(id: string, fn: () => Promise<void>) {
    setBusy(id);
    setError(null);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  }

  const patch = (p: Preference, body: { value?: string; active?: boolean }) =>
    run(p.id, async () => {
      const r = await call(`/api/preferences/${p.id}`, "PATCH", body);
      if (!r.ok) return setError({ id: p.id, message: r.message });
      setItems((all) => all.map((x) => (x.id === p.id ? (r.data as Preference) : x)));
      setEditing(null);
    });

  const del = (p: Preference) =>
    run(p.id, async () => {
      const r = await call(`/api/preferences/${p.id}`, "DELETE");
      if (!r.ok) return setError({ id: p.id, message: r.message });
      setItems((all) => all.filter((x) => x.id !== p.id));
    });

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const value = draft.value.trim();
    if (!value) return;
    return run("new", async () => {
      const r = await call("/api/preferences", "POST", { ...draft, value });
      if (!r.ok) return setError({ id: "new", message: r.message });
      const id = (r.data as { preferenceId: string }).preferenceId;
      setItems((all) => [{ id, kind: draft.kind, category: draft.category, value, scopeRecipeId: null, confirmedAt: new Date().toISOString(), active: true }, ...all]);
      setDraft((d) => ({ ...d, value: "" }));
    });
  };

  return (
    <>
      {items.length === 0 ? (
        <EmptyState
          title="No preferences yet"
          mood="welcoming"
          action={<Link href="/recipes" className={btnSecondary}>Find something to cook</Link>}
        >
          After you cook, tell Bao how it was (&ldquo;a bit dry&rdquo;, say) and choose Always to keep it. Or add one below.
        </EmptyState>
      ) : (
        <ul className={rows}>
          {items.map((p) => (
            <li key={p.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className={`min-w-0 flex-1 ${p.active ? "" : "opacity-60"}`}>
                  <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
                    <span className={p.kind === "hard" ? tagStrong : tagNeutral}>{p.kind === "hard" ? "Never" : "Prefer"}</span>
                    <span className="capitalize">{p.category}</span>
                    {p.scopeRecipeId && <span>· only in {titles[p.scopeRecipeId] ?? "one dish"}</span>}
                    {!p.active && <span className="font-medium">· Paused</span>}
                  </p>
                  {editing?.id === p.id ? (
                    <form
                      className="mt-2 flex flex-col gap-2 sm:flex-row"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (editing.value.trim()) patch(p, { value: editing.value.trim() });
                      }}
                    >
                      <input className={`${input} min-w-0 flex-1`} value={editing.value} autoFocus disabled={busy === p.id}
                        onChange={(e) => setEditing({ id: p.id, value: e.target.value })} aria-label="Preference wording" />
                      <div className="flex gap-2">
                        <button className={`flex-1 sm:flex-none ${btnGhost}`} disabled={busy === p.id || !editing.value.trim()}>Save</button>
                        <button type="button" className={`flex-1 sm:flex-none ${btnGhost}`} onClick={() => setEditing(null)} disabled={busy === p.id}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <p className={`mt-2 ${h3}`}>{p.value}</p>
                  )}
                </div>
                {editing?.id !== p.id && (
                  <div className="flex shrink-0 gap-2">
                    <button className={btnGhost} disabled={busy === p.id} onClick={() => setEditing({ id: p.id, value: p.value })}>Edit</button>
                    <button className={btnGhost} disabled={busy === p.id} onClick={() => patch(p, { active: !p.active })}>{p.active ? "Pause" : "Resume"}</button>
                    <button className={btnGhost} disabled={busy === p.id} onClick={() => del(p)}>Delete</button>
                  </div>
                )}
              </div>
              {error?.id === p.id && <p role="alert" className={`mt-3 ${alert}`}>{error.message}</p>}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className={`mt-10 p-4 sm:p-6 ${panel}`}>
        <h2 className={h3}>Add a preference</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-[auto_auto_1fr]">
          <label className={label}>
            Type
            <select className={input} value={draft.kind} disabled={busy === "new"} onChange={(e) => setDraft({ ...draft, kind: e.target.value as "soft" | "hard" })}>
              <option value="soft">Prefer</option>
              <option value="hard">Never</option>
            </select>
          </label>
          <label className={label}>
            About
            <select className={input} value={draft.category} disabled={busy === "new"} onChange={(e) => setDraft({ ...draft, category: e.target.value as (typeof CATEGORIES)[number] })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className={label}>
            Preference
            <input className={input} value={draft.value} disabled={busy === "new"} maxLength={60}
              placeholder={draft.kind === "hard" ? "e.g. cilantro" : "e.g. saucier dishes"} onChange={(e) => setDraft({ ...draft, value: e.target.value })} />
          </label>
        </div>
        {draft.kind === "hard" && draft.category === "ingredient" && (
          <p className="mt-3 text-sm text-muted">Use the ingredient&apos;s name as it appears in recipes; plans will leave out every dish that uses it.</p>
        )}
        {error?.id === "new" && <p role="alert" className={`mt-3 ${alert}`}>{error.message}</p>}
        <button className={`mt-5 w-full sm:w-auto ${btn}`} disabled={busy === "new" || !draft.value.trim()}>{busy === "new" ? "Adding…" : "Add preference"}</button>
      </form>
    </>
  );
}
