import { SymbolDetailClient } from "../symbol-detail-client";

type SystemFreshnessDetailPageProps = {
  params: Promise<{ symbol: string }>;
};

export default async function SystemFreshnessDetailPage({ params }: SystemFreshnessDetailPageProps) {
  const { symbol } = await params;

  return <SymbolDetailClient mode="system-freshness" symbol={symbol} />;
}
