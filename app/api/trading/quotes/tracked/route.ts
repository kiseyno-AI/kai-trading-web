import { NextResponse } from "next/server";

const coreBase = process.env.TRADING_API_INTERNAL_BASE_URL || "http://127.0.0.1:8000";

export async function GET() {
  const response = await fetch(`${coreBase}/quotes/tracked`, { cache: "no-store" });
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
