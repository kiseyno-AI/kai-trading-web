import type { Metadata } from "next";

import PiotroskiFilterPageClient from "./piotroski-filter-page-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Piotroski Filter Pass List",
};

export default function PiotroskiFilterPage() {
  return <PiotroskiFilterPageClient />;
}
