import { NextRequest, NextResponse } from "next/server";
import { searchStocks } from "@/lib/market-data";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query) return NextResponse.json([]);

  try {
    return NextResponse.json(await searchStocks(query), {
      headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" },
    });
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
