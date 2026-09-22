import type { SymbolDetailCopy } from "@/i18n/symbol-detail-copy";

type DisclosureReportCopy = SymbolDetailCopy["disclosures"]["reportDetail"];

function normalizeMetadataToken(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function localizeDisclosureFilingCategory(value: string, copy: DisclosureReportCopy) {
  const labels = copy.filingCategories;

  switch (normalizeMetadataToken(value)) {
    case "annual":
      return labels.annual;
    case "annual_report":
      return labels.annualReport;
    case "quarterly":
      return labels.quarterly;
    case "quarterly_report":
      return labels.quarterlyReport;
    case "semiannual":
    case "semi_annual":
      return labels.semiannual;
    case "semiannual_report":
    case "semi_annual_report":
      return labels.semiannualReport;
    default:
      return value;
  }
}

export function localizeDisclosureCaptureStatus(value: string, copy: DisclosureReportCopy) {
  const labels = copy.captureStatuses;

  switch (normalizeMetadataToken(value)) {
    case "captured":
      return labels.captured;
    case "not_captured":
      return labels.notCaptured;
    case "pending":
      return labels.pending;
    default:
      return value;
  }
}
