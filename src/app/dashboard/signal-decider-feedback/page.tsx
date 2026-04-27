import type { Metadata } from "next";

import SignalDeciderFeedbackPageClient from "./signal-decider-feedback-page-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Signal Decider Feedback",
};

export default function SignalDeciderFeedbackPage() {
  return <SignalDeciderFeedbackPageClient />;
}
