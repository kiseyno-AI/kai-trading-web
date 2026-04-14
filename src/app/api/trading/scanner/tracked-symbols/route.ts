import { proxyTradingUpstreamJson } from "@/lib/trading-upstream";

export async function GET() {
  return proxyTradingUpstreamJson("/scanner/tracked-symbols");
}

export async function POST(request: Request) {
  return proxyTradingUpstreamJson("/scanner/tracked-symbols", {
    method: "POST",
    headers: {
      "Content-Type": request.headers.get("content-type") ?? "application/json",
    },
    body: await request.text(),
  });
}
