import { AppShell } from "@/components/layout/app-shell";
import { BotsOverview } from "@/features/bots/bots-overview";

export default function BotsPage() {
  return (
    <AppShell currentPath="/bots" title="Automation Control" eyebrow="Systems & Execution">
      <BotsOverview />
    </AppShell>
  );
}
