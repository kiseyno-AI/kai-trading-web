import { SymbolDetailClient } from "../symbol-detail-client";

type TechnicalAnalysisDetailPageProps = {
  params: Promise<{ symbol: string }>;
};

export default async function TechnicalAnalysisDetailPage({ params }: TechnicalAnalysisDetailPageProps) {
  const { symbol } = await params;

  return <SymbolDetailClient mode="technical-analysis" symbol={symbol} />;
}
