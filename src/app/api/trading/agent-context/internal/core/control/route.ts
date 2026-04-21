import { proxyTradingUpstreamJson } from "@/lib/trading-upstream";
import type { AgentContextCoreControlRequestDto } from "@/types/trading-api";

const DEFAULT_CORE_CONTROL_REQUEST = {
  action: "kill",
  signal_name: "SIGKILL",
  port: 8000,
} satisfies AgentContextCoreControlRequestDto;

export async function POST(request: Request) {
  const requestBody = await request.text();

  return proxyTradingUpstreamJson("/agent-context/internal/core/control", {
    method: "POST",
    headers: {
      "Content-Type": request.headers.get("content-type") ?? "application/json",
    },
    body: requestBody.trim() ? requestBody : JSON.stringify(DEFAULT_CORE_CONTROL_REQUEST),
  });
}
