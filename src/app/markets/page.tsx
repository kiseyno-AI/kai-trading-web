import { AppShell } from "@/components/layout/app-shell";
import { MarketsOverview } from "@/features/markets/markets-overview";

export default function MarketsPage() {
  return (
    <AppShell currentPath="/markets">
      <MarketsOverview />
    </AppShell>
  );
}
