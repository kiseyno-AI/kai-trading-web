import { NextRequest, NextResponse } from "next/server";

const coreBase = process.env.TRADING_API_INTERNAL_BASE_URL || "http://127.0.0.1:8000";

export async function GET(_: NextRequest, context: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await context.params;
  const response = await fetch(`${coreBase}/quotes/${encodeURIComponent(symbol)}`, { cache: "no-store" });
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
