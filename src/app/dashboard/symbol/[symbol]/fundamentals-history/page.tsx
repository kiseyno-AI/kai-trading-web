import { SymbolDetailClient } from "../symbol-detail-client";

type FundamentalsHistoryDetailPageProps = {
  params: Promise<{ symbol: string }>;
};

export default async function FundamentalsHistoryDetailPage({ params }: FundamentalsHistoryDetailPageProps) {
  const { symbol } = await params;

  return <SymbolDetailClient mode="fundamentals-history" symbol={symbol} />;
}
