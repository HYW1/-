import { NextResponse } from "next/server";
import { getDashboard } from "@/lib/market-data";

export const revalidate = 900;

export async function GET() {
  try {
    return NextResponse.json(await getDashboard(), {
      headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "市场数据加载失败" },
      { status: 503 },
    );
  }
}
