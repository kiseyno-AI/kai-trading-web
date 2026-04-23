import { DisclosureReportClient } from "./disclosure-report-client";

type DisclosureReportDetailPageProps = {
  params: Promise<{ symbol: string; receiptNo: string }>;
};

export default async function DisclosureReportDetailPage({ params }: DisclosureReportDetailPageProps) {
  const { symbol, receiptNo } = await params;

  return <DisclosureReportClient receiptNo={receiptNo} symbol={symbol} />;
}
