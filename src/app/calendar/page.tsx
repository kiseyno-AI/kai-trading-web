import type { Metadata } from "next";

import { getCurrentProductMarketDate } from "@/lib/product-market-date";

import SignalReviewCalendarPageClient from "./signal-review-calendar-page-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Signal Review Calendar",
};

export default function SignalReviewCalendarPage() {
  return <SignalReviewCalendarPageClient initialTodayKey={getCurrentProductMarketDate()} />;
}
