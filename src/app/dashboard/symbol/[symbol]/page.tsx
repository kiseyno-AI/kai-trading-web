import { SymbolDetailClient } from "./symbol-detail-client";

type SymbolDetailPageProps = {
  params: Promise<{ symbol: string }>;
};

export default async function SymbolDetailPage({ params }: SymbolDetailPageProps) {
  const { symbol } = await params;

  return <SymbolDetailClient symbol={symbol} />;
}
