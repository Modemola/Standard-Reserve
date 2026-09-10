import type { Metadata } from "next";
import { redirect } from "next/navigation";

/**
 * Charter ids are `c-NNNN`, but the landing CTA reads "Enter demo bank #0042"
 * and the whitepaper talks about charter 0042 -- so a reader who types the
 * number they were shown lands on `/bank/0042` and gets an empty cockpit.
 *
 * The normalisation is purely lexical (does adding the `c-` prefix produce a
 * well-formed id?), so it belongs on the server, and it redirects rather than
 * silently rendering: one canonical URL per charter keeps links, metadata and
 * the crawler's view in agreement.
 */
function canonicalId(id: string): string | null {
  if (/^c-\d+$/.test(id)) return null;
  if (/^\d+$/.test(id)) return `c-${id}`;
  return null;
}

/** page.tsx is a client component and so cannot export metadata itself.
 *  generateMetadata runs on the server, so the charter id in the URL ends up
 *  in the tab title -- two cockpits open at once are now distinguishable. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Bank ${id}`,
    description: `The Banker's Cockpit for charter ${id}: branch ledgers, licence and charter auctions, exit pressure and the what-if drawer.`,
  };
}

export default async function BankLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const canonical = canonicalId(id);
  if (canonical) redirect(`/bank/${canonical}`);
  return children;
}
