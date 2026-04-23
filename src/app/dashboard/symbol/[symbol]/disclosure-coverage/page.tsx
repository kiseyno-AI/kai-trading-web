import { SymbolDetailClient } from "../symbol-detail-client";

type DisclosureCoverageDetailPageProps = {
  params: Promise<{ symbol: string }>;
};

export default async function DisclosureCoverageDetailPage({ params }: DisclosureCoverageDetailPageProps) {
  const { symbol } = await params;

  return <SymbolDetailClient mode="disclosure-coverage" symbol={symbol} />;
}
