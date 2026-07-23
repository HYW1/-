import { NextRequest, NextResponse } from "next/server";
import { analyzeSymbol } from "@/lib/market-data";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json({ error: "请输入股票代码" }, { status: 400 });
  }

  try {
    return NextResponse.json(await analyzeSymbol(symbol), {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `${error.message}。示例：NVDA、005930.KS、600519.SS`
            : "分析失败",
      },
      { status: 422 },
    );
  }
}
