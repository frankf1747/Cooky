"use client";
// Owner: Plan & Shop. List, add, edit, pause and delete preferences (LRN3) through /api/preferences.
import Link from "next/link";
import { useState } from "react";
import type { Preference } from "@spec/contract";

const CATEGORIES = ["flavor", "texture", "ingredient", "effort", "cleanup", "cuisine"] as const;
const input = "rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";
const btn = "rounded-md bg-zinc-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";
const btnGhost = "rounded-md border border-zinc-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-zinc-700";

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
        <div className="rounded-lg border border-dashed border-zinc-300 p-5 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          <p>No preferences yet.</p>
          <p className="mt-1">
            After you cook, tell Cooky how it was (for example &ldquo;a bit dry&rdquo;) and choose <span className="font-medium">Always</span> to keep it.
            Or add one below. <Link href="/recipes" className="underline">Find something to cook</Link>.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {items.map((p) => (
            <li key={p.id} className={`p-4 ${p.active ? "" : "opacity-60"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    {p.kind === "hard" ? "Never" : "Prefer"} · {p.category}
                    {p.scopeRecipeId && ` · only in ${titles[p.scopeRecipeId] ?? "one dish"}`}
                    {!p.active && " · paused"}
                  </p>
                  {editing?.id === p.id ? (
                    <form
                      className="mt-1 flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (editing.value.trim()) patch(p, { value: editing.value.trim() });
                      }}
                    >
                      <input className={`${input} min-w-0 flex-1`} value={editing.value} autoFocus disabled={busy === p.id}
                        onChange={(e) => setEditing({ id: p.id, value: e.target.value })} aria-label="Preference wording" />
                      <button className={btnGhost} disabled={busy === p.id || !editing.value.trim()}>Save</button>
                      <button type="button" className={btnGhost} onClick={() => setEditing(null)} disabled={busy === p.id}>Cancel</button>
                    </form>
                  ) : (
                    <p className="mt-1 font-medium">{p.value}</p>
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
              {error?.id === p.id && <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">{error.message}</p>}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="mt-8 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-semibold">Add a preference</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-[auto_auto_1fr]">
          <label className="flex flex-col gap-1 text-sm">
            Type
            <select className={input} value={draft.kind} disabled={busy === "new"} onChange={(e) => setDraft({ ...draft, kind: e.target.value as "soft" | "hard" })}>
              <option value="soft">Prefer</option>
              <option value="hard">Never</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            About
            <select className={input} value={draft.category} disabled={busy === "new"} onChange={(e) => setDraft({ ...draft, category: e.target.value as (typeof CATEGORIES)[number] })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Preference
            <input className={input} value={draft.value} disabled={busy === "new"} maxLength={60}
              placeholder={draft.kind === "hard" ? "e.g. cilantro" : "e.g. saucier dishes"} onChange={(e) => setDraft({ ...draft, value: e.target.value })} />
          </label>
        </div>
        {draft.kind === "hard" && draft.category === "ingredient" && (
          <p className="mt-2 text-xs text-zinc-500">Use the ingredient&apos;s name as it appears in recipes; plans will leave out every dish that uses it.</p>
        )}
        {error?.id === "new" && <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">{error.message}</p>}
        <button className={`mt-3 ${btn}`} disabled={busy === "new" || !draft.value.trim()}>{busy === "new" ? "Adding…" : "Add"}</button>
      </form>
    </>
  );
}
