// Placeholder panel for a page whose feature is not built yet. It is the progress bar:
// when every panel is gone, v1 is done.
type Props = {
  title: string;
  owner: string;
  spec: string;
  /** what the finished page lets the user do, one sentence */
  purpose: string;
  v?: 1 | 2;
};

export function NotImplemented({ title, owner, spec, purpose, v = 1 }: Props) {
  return (
    <section className="mx-auto w-full max-w-3xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-4 rounded-xl border-2 border-dashed border-zinc-300 p-6 dark:border-zinc-700">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">Not implemented {v === 2 ? "· after demo day (v2)" : "· v1"}</p>
        <p className="mt-2 text-zinc-700 dark:text-zinc-300">{purpose}</p>
        <p className="mt-4 text-sm text-zinc-500">
          Owner: <span className="font-medium">{owner}</span> · Requirements: <code>{spec}</code> in docs/SPEC.md
        </p>
      </div>
    </section>
  );
}
