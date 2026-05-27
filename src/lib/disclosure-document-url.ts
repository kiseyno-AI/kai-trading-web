import { withAppBasePath } from "@/lib/app-base-path";

export const DISCLOSURE_DOCUMENT_CLIENT_PATH = "/api/trading/disclosures/dart/filings/document";

export function buildDisclosureDocumentUrl(receiptNo: string, basePath?: string) {
  const query = new URLSearchParams({ rcept_no: receiptNo });

  return `${withAppBasePath(DISCLOSURE_DOCUMENT_CLIENT_PATH, basePath)}?${query.toString()}`;
}
