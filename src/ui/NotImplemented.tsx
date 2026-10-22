// Placeholder for a page whose feature is not built yet. It says so plainly and offers the
// nearest working page. When every placeholder is gone, v1 is done.
import Link from "next/link";
import { Page } from "./Page";
import { btnSecondary } from "./styles";

type Props = {
  title: string;
  owner: string;
  spec: string;
  /** what the finished page lets the user do, one sentence */
  purpose: string;
  v?: 1 | 2;
  /** the nearest page that works today */
  back?: { href: string; label: string };
};

export function NotImplemented({ title, owner, spec, purpose, v = 1, back = { href: "/home", label: "Back to this week" } }: Props) {
  return (
    <Page title={title} width="narrow">
      <div className="rounded-lg border border-dashed border-zinc-300 p-6 dark:border-zinc-700">
        <p className="font-medium">Coming soon</p>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">{purpose}</p>
        <Link href={back.href} className={`${btnSecondary} mt-4`}>{back.label}</Link>
      </div>
      <p className="mt-4 text-xs text-zinc-500">
        For the team: {owner} owns this page ({spec}{v === 2 ? ", after demo day" : ""}).
      </p>
    </Page>
  );
}
