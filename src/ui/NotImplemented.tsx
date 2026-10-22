// Placeholder for a page whose feature is not built yet. It says so plainly and offers the
// nearest working page. When every placeholder is gone, v1 is done.
import Link from "next/link";
import { EmptyState, Page } from "./Page";
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

export function NotImplemented({ title, owner, spec, purpose, v = 1, back = { href: "/fridge", label: "Back to the fridge" } }: Props) {
  return (
    <Page title={title} width="narrow">
      <EmptyState title="Still in the oven" mood="thinking" pose="think" action={<Link href={back.href} className={btnSecondary}>{back.label}</Link>}>
        {purpose}
      </EmptyState>
      <p className="mt-4 text-xs text-subtle">
        For the team: {owner} owns this page ({spec}{v === 2 ? ", after demo day" : ""}).
      </p>
    </Page>
  );
}
