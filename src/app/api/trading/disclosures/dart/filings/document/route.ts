import { NextRequest, NextResponse } from "next/server";

import { proxyTradingUpstreamResponse } from "@/lib/trading-upstream";

export async function GET(request: NextRequest) {
  const rceptNo = request.nextUrl.searchParams.get("rcept_no")?.trim();

  if (!rceptNo) {
    return NextResponse.json(
      {
        error: "Missing rcept_no",
        message: "DART filing document requests require a receipt number.",
      },
      { status: 400 },
    );
  }

  const query = new URLSearchParams({ rcept_no: rceptNo });
  return proxyTradingUpstreamResponse(`/disclosures/dart/filings/document?${query.toString()}`);
}
