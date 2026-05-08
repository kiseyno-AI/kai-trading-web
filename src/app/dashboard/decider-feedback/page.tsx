import type { Metadata } from "next";

import SignalDeciderFeedbackPageClient from "../signal-decider-feedback/signal-decider-feedback-page-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Decider Feedback",
};

export default function DeciderFeedbackPage() {
  return <SignalDeciderFeedbackPageClient />;
}
