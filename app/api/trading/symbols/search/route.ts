import { NextRequest, NextResponse } from "next/server";

const coreBase = process.env.TRADING_API_INTERNAL_BASE_URL || "http://127.0.0.1:8000";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const q = search.get("q") || "";
  const limit = search.get("limit") || "20";
  const response = await fetch(`${coreBase}/symbols/search?q=${encodeURIComponent(q)}&limit=${encodeURIComponent(limit)}`, { cache: "no-store" });
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
