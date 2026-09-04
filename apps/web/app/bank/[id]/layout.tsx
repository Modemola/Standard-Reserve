import type { Metadata } from "next";

/** page.tsx is a client component and so cannot export metadata itself.
 *  generateMetadata runs on the server, so the charter id in the URL ends up
 *  in the tab title -- two cockpits open at once are now distinguishable. */
export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  return {
    title: `Bank ${params.id}`,
    description: `The Banker's Cockpit for charter ${params.id}: branch ledgers, licence and charter auctions, exit pressure and the what-if drawer.`,
  };
}

export default function BankLayout({ children }: { children: React.ReactNode }) {
  return children;
}
