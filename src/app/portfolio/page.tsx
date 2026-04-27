import type { Metadata } from "next";

import PortfolioPageClient from "./portfolio-page-client";

export const metadata: Metadata = {
  title: "Portfolio Assets",
};

export default function PortfolioPage() {
  return <PortfolioPageClient />;
}
