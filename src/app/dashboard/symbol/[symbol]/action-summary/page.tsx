import { SymbolDetailClient } from "../symbol-detail-client";

type ActionSummaryDetailPageProps = {
  params: Promise<{ symbol: string }>;
};

export default async function ActionSummaryDetailPage({ params }: ActionSummaryDetailPageProps) {
  const { symbol } = await params;

  return <SymbolDetailClient mode="action-summary" symbol={symbol} />;
}
