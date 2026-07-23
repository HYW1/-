import type {
  Candle,
  DashboardData,
  FlowPoint,
  Market,
  MarketSnapshot,
  StockFlow,
  StockSignal,
} from "./types";

const UNIVERSE = [
  { symbol: "NVDA", name: "NVIDIA", market: "US" as const },
  { symbol: "MSFT", name: "Microsoft", market: "US" as const },
  { symbol: "AVGO", name: "Broadcom", market: "US" as const },
  { symbol: "005930.KS", name: "Samsung Elec.", market: "KR" as const },
  { symbol: "000660.KS", name: "SK Hynix", market: "KR" as const },
  { symbol: "207940.KS", name: "Samsung Bio.", market: "KR" as const },
  { symbol: "600519.SS", name: "贵州茅台", market: "CN" as const },
  { symbol: "300750.SZ", name: "宁德时代", market: "CN" as const },
  { symbol: "601138.SS", name: "工业富联", market: "CN" as const },
];

const BENCHMARKS = [
  {
    market: "US" as const,
    label: "美股",
    flag: "US",
    index: "S&P 500",
    symbol: "^GSPC",
    flowLabel: "量价资金代理",
    flowUnit: "动能分",
    source: "Yahoo Finance · OBV/成交量代理",
    confidence: "代理" as const,
  },
  {
    market: "KR" as const,
    label: "韩股",
    flag: "KR",
    index: "KOSPI",
    symbol: "^KS11",
    flowLabel: "外资/机构代理",
    flowUnit: "亿韩元",
    source: "Yahoo Finance · KRX 指数代理",
    confidence: "中" as const,
  },
  {
    market: "CN" as const,
    label: "A股",
    flag: "CN",
    index: "沪深300",
    symbol: "000300.SS",
    flowLabel: "主力资金代理",
    flowUnit: "亿元",
    source: "Yahoo Finance · 沪深300量价代理",
    confidence: "中" as const,
  },
];

function seeded(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function round(value: number, digits = 2) {
  const power = 10 ** digits;
  return Math.round(value * power) / power;
}

function sma(candles: Candle[], length: number, index: number) {
  if (index + 1 < length) return undefined;
  const slice = candles.slice(index + 1 - length, index + 1);
  return slice.reduce((sum, point) => sum + point.close, 0) / length;
}

function withAverages(candles: Candle[]) {
  return candles.map((candle, index) => ({
    ...candle,
    ma5: sma(candles, 5, index),
    ma20: sma(candles, 20, index),
  }));
}

function calculateRsi(candles: Candle[], period = 14) {
  const changes = candles.slice(-period - 1).map((item, index, values) =>
    index === 0 ? 0 : item.close - values[index - 1].close,
  );
  const gains = changes.reduce((sum, value) => sum + Math.max(value, 0), 0);
  const losses = changes.reduce((sum, value) => sum + Math.abs(Math.min(value, 0)), 0);
  if (!losses) return 70;
  return 100 - 100 / (1 + gains / losses);
}

function marketFromSymbol(symbol: string): Market {
  if (symbol.endsWith(".KS") || symbol.endsWith(".KQ")) return "KR";
  if (symbol.endsWith(".SS") || symbol.endsWith(".SZ")) return "CN";
  return "US";
}

function mockCandles(seedValue: number, base: number): Candle[] {
  const random = seeded(seedValue);
  let price = base;
  const now = new Date();
  const candles: Candle[] = [];

  for (let i = 59; i >= 0; i -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    const drift = 0.0014 + (random() - 0.46) * 0.035;
    const open = price;
    const close = Math.max(1, open * (1 + drift));
    const range = open * (0.006 + random() * 0.018);
    candles.push({
      date: date.toISOString().slice(0, 10),
      open: round(open),
      high: round(Math.max(open, close) + range),
      low: round(Math.min(open, close) - range),
      close: round(close),
      volume: Math.round(1_000_000 * (0.6 + random() * 1.6)),
    });
    price = close;
  }
  return withAverages(candles);
}

type YahooChart = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      meta?: { regularMarketPrice?: number; chartPreviousClose?: number };
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
};

type NaverFlowRow = {
  bizdate?: string;
  foreignerPureBuyQuant?: string;
  organPureBuyQuant?: string;
  individualPureBuyQuant?: string;
  closePrice?: string;
};

function parseNumeric(value?: string) {
  if (!value) return 0;
  const parsed = Number(value.replaceAll(",", "").replaceAll("+", "").replace("%", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function fetchNaverFlowRows(code: string, pageSize = 12): Promise<NaverFlowRow[]> {
  const url = new URL("https://m.stock.naver.com/front-api/stock/domestic/trend");
  url.searchParams.set("code", code);
  url.searchParams.set("marketType", "KRX");
  url.searchParams.set("pageSize", String(pageSize));
  const response = await fetch(url, {
    headers: {
      Accept: "application/json, text/plain, */*",
      Referer: `https://m.stock.naver.com/domestic/stock/${code}/total`,
    },
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error(`NaverPay 返回 ${response.status}`);
  const payload = await response.json();
  const rows = Array.isArray(payload) ? payload : payload?.result;
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("韩股资金流为空");
  return rows;
}

async function fetchKoreanMarketFlow(): Promise<{
  netFlow: number;
  flow: FlowPoint[];
  source: string;
}> {
  const basket = ["005930", "000660", "035420"];
  const results = await Promise.all(basket.map((code) => fetchNaverFlowRows(code)));
  const byDate = new Map<string, FlowPoint>();

  results.flat().forEach((row) => {
    const date = row.bizdate ?? "";
    const price = parseNumeric(row.closePrice);
    const current = byDate.get(date) ?? { date: date.slice(4, 8), foreign: 0, institution: 0, retail: 0 };
    current.foreign += (parseNumeric(row.foreignerPureBuyQuant) * price) / 100_000_000;
    current.institution += (parseNumeric(row.organPureBuyQuant) * price) / 100_000_000;
    current.retail += (parseNumeric(row.individualPureBuyQuant) * price) / 100_000_000;
    byDate.set(date, current);
  });
  const flow = [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, point]) => ({
      ...point,
      foreign: round(point.foreign),
      institution: round(point.institution),
      retail: round(point.retail),
    }));
  const latest = flow.at(-1);
  if (!latest) throw new Error("韩股资金流为空");
  return {
    netFlow: round(latest.foreign + latest.institution),
    flow,
    source: "NaverPay · 三星电子/SK海力士/NAVER 代表股篮子",
  };
}

type EastmoneyFlow = {
  data?: {
    name?: string;
    klines?: string[];
  };
};

function eastmoneySecid(symbol: string) {
  const code = symbol.split(".")[0];
  return `${symbol.endsWith(".SS") ? "1" : "0"}.${code}`;
}

async function fetchEastmoneyFlow(secid: string, secid2?: string) {
  const url = new URL("https://push2delay.eastmoney.com/api/qt/stock/fflow/kline/get");
  url.searchParams.set("secid", secid);
  if (secid2) url.searchParams.set("secid2", secid2);
  url.searchParams.set("lmt", "20");
  url.searchParams.set("klt", "101");
  url.searchParams.set("fields1", "f1,f2,f3,f7");
  url.searchParams.set("fields2", "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63");
  const response = await fetch(url, {
    headers: {
      Accept: "application/json, text/plain, */*",
      Referer: "https://quote.eastmoney.com/",
      "User-Agent": "Mozilla/5.0 MarketPulse/1.0",
    },
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) throw new Error(`东方财富返回 ${response.status}`);
  const payload = (await response.json()) as EastmoneyFlow;
  const rows = payload.data?.klines;
  if (!rows?.length) throw new Error("A股资金流为空");
  return rows.map((row) => {
    const [date, main, small, medium, large, superLarge] = row.split(",");
    return {
      date,
      main: Number(main),
      small: Number(small),
      medium: Number(medium),
      large: Number(large),
      superLarge: Number(superLarge),
    };
  });
}

async function fetchChinaMarketFlow() {
  const rows = await fetchEastmoneyFlow("1.000001", "0.399001");
  const latest = rows.at(-1)!;
  return {
    netFlow: round(latest.main / 100_000_000),
    point: {
      date: latest.date.slice(5),
      foreign: round(latest.main / 100_000_000),
      institution: round(latest.superLarge / 100_000_000),
      retail: round((latest.small + latest.medium) / 100_000_000),
    },
  };
}

async function fetchStockFlow(symbol: string, market: Market): Promise<StockFlow | undefined> {
  if (market === "KR") {
    const code = symbol.split(".")[0];
    const row = (await fetchNaverFlowRows(code, 5))[0];
    return {
      label: "外资净买入",
      primary: round(parseNumeric(row.foreignerPureBuyQuant) / 10_000),
      institution: round(parseNumeric(row.organPureBuyQuant) / 10_000),
      retail: round(parseNumeric(row.individualPureBuyQuant) / 10_000),
      unit: "万股",
      source: "NaverPay · 投资者逐日净买入",
      asOf: row.bizdate
        ? `${row.bizdate.slice(0, 4)}-${row.bizdate.slice(4, 6)}-${row.bizdate.slice(6, 8)}`
        : "",
    };
  }
  if (market === "CN") {
    const row = (await fetchEastmoneyFlow(eastmoneySecid(symbol))).at(-1)!;
    return {
      label: "主力净流入",
      primary: round(row.main / 100_000_000),
      institution: round((row.large + row.superLarge) / 100_000_000),
      retail: round((row.small + row.medium) / 100_000_000),
      unit: "亿元",
      source: "东方财富 · 延时资金流",
      asOf: row.date,
    };
  }
  return undefined;
}

export async function fetchCandles(symbol: string): Promise<Candle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=6mo&interval=1d&events=div%2Csplits`;
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 MarketPulse/1.0" },
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error(`行情服务返回 ${response.status}`);
  const payload = (await response.json()) as YahooChart;
  const result = payload.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  if (!result?.timestamp || !quote) throw new Error("行情数据为空");

  const candles = result.timestamp.flatMap((timestamp, index) => {
    const open = quote.open?.[index];
    const high = quote.high?.[index];
    const low = quote.low?.[index];
    const close = quote.close?.[index];
    const volume = quote.volume?.[index];
    if ([open, high, low, close, volume].some((value) => value == null)) return [];
    return [{
      date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      open: round(open as number),
      high: round(high as number),
      low: round(low as number),
      close: round(close as number),
      volume: volume as number,
    }];
  });
  if (candles.length < 25) throw new Error("历史行情不足");
  return withAverages(candles.slice(-90));
}

export function analyzeCandles(
  symbol: string,
  name: string,
  market: Market,
  candles: Candle[],
  source = "Yahoo Finance · 日线",
): StockSignal {
  const last = candles.at(-1)!;
  const previous = candles.at(-2)!;
  const recentVolumes = candles.slice(-21, -1).map((item) => item.volume);
  const averageVolume = recentVolumes.reduce((sum, value) => sum + value, 0) / recentVolumes.length;
  const volumeRatio = last.volume / averageVolume;
  const rsi = calculateRsi(candles);
  const ma20 = last.ma20 ?? last.close;
  const ma5 = last.ma5 ?? last.close;
  const momentum20 = (last.close / candles.at(-21)!.close - 1) * 100;
  const change = (last.close / previous.close - 1) * 100;

  let score = 50;
  score += last.close > ma20 ? 14 : -14;
  score += ma5 > ma20 ? 10 : -8;
  score += Math.max(-12, Math.min(12, momentum20 * 0.8));
  score += volumeRatio > 1.15 && change > 0 ? 8 : volumeRatio > 1.8 && change < 0 ? -8 : 0;
  score += rsi >= 45 && rsi <= 68 ? 7 : rsi > 78 ? -9 : 0;
  score = Math.round(Math.max(10, Math.min(92, score)));

  const signal = score >= 78 ? "强势" : score >= 64 ? "偏多" : score < 42 ? "谨慎" : "观察";
  const reasons = [
    last.close > ma20 ? "价格站上20日均线" : "价格位于20日均线下方",
    ma5 > ma20 ? "短期趋势向上" : "短期趋势偏弱",
    volumeRatio > 1.15 ? `量比 ${volumeRatio.toFixed(1)}x` : "成交量温和",
  ];

  return {
    symbol,
    name,
    market,
    price: last.close,
    change: round(change),
    score,
    signal,
    reason: reasons.join(" · "),
    risk: rsi > 72 ? "RSI偏热，避免追高" : last.close < ma20 ? "趋势未确认，控制仓位" : "跌破20日线视为信号失效",
    rsi: round(rsi, 1),
    volumeRatio: round(volumeRatio, 1),
    stopLoss: round(last.close * 0.94),
    target: round(last.close * (1 + Math.max(0.06, Math.min(0.14, momentum20 / 100 + 0.06)))),
    candles: candles.slice(-45),
    source,
    asOf: last.date,
  };
}

function fallbackStock(
  symbol: string,
  name: string,
  market: Market,
  base: number,
  seedValue: number,
) {
  return analyzeCandles(
    symbol,
    name,
    market,
    mockCandles(seedValue, base),
    "演示缓存 · 等待实时源",
  );
}

function flowFromCandles(candles: Candle[], market: Market): FlowPoint[] {
  return candles.slice(-12).map((item, index, values) => {
    const prior = values[Math.max(0, index - 1)].close;
    const signed = ((item.close - prior) / prior) * item.volume;
    const scale = market === "US" ? 80 : market === "KR" ? 55 : 65;
    const base = signed / scale;
    return {
      date: item.date.slice(5),
      foreign: round(base / 1_000_000),
      institution: round((base * (index % 3 === 0 ? -0.45 : 0.62)) / 1_000_000),
      retail: round((base * -0.38) / 1_000_000),
    };
  });
}

function snapshotFromCandles(
  benchmark: (typeof BENCHMARKS)[number],
  candles: Candle[],
): MarketSnapshot {
  const last = candles.at(-1)!;
  const previous = candles.at(-2)!;
  const flow = flowFromCandles(candles, benchmark.market);
  const netFlow = round(flow.slice(-5).reduce((sum, point) => sum + point.foreign + point.institution, 0));
  return {
    ...benchmark,
    value: last.close,
    change: round((last.close / previous.close - 1) * 100),
    netFlow,
    trend: netFlow >= 0 ? "in" : "out",
    sparkline: candles.slice(-20).map((item) => item.close),
    flow,
  };
}

export function fallbackDashboard(): DashboardData {
  const bases = [5750, 3250, 3950];
  const markets = BENCHMARKS.map((benchmark, index) =>
    snapshotFromCandles(benchmark, mockCandles(130 + index, bases[index])),
  );
  const prices = [155, 520, 335, 72000, 230000, 980000, 1500, 195, 48];
  const picks = UNIVERSE.map((item, index) =>
    fallbackStock(item.symbol, item.name, item.market, prices[index], 440 + index),
  ).sort((a, b) => b.score - a.score);
  return {
    updatedAt: new Date().toISOString(),
    mode: "fallback",
    markets,
    picks: picks.slice(0, 6),
  };
}

export async function getDashboard(): Promise<DashboardData> {
  const fallback = fallbackDashboard();
  const [marketResults, stockResults] = await Promise.all([
    Promise.allSettled(BENCHMARKS.map(async (benchmark) => {
      const snapshot = snapshotFromCandles(benchmark, await fetchCandles(benchmark.symbol));
      if (benchmark.market === "KR") {
        const actual = await fetchKoreanMarketFlow();
        return {
          ...snapshot,
          netFlow: actual.netFlow,
          flow: actual.flow,
          flowLabel: "代表股外资+机构净买入",
          source: actual.source,
          confidence: "中" as const,
          trend: actual.netFlow >= 0 ? "in" as const : "out" as const,
        };
      }
      if (benchmark.market === "CN") {
        const actual = await fetchChinaMarketFlow();
        return {
          ...snapshot,
          netFlow: actual.netFlow,
          flow: [...snapshot.flow.slice(1), actual.point],
          flowLabel: "当日沪深主力净流入",
          source: "东方财富当日资金流 · 历史线为量价代理",
          confidence: "高" as const,
          trend: actual.netFlow >= 0 ? "in" as const : "out" as const,
        };
      }
      return snapshot;
    })),
    Promise.allSettled(UNIVERSE.map(async (item) => {
      const [candles, flow] = await Promise.all([
        fetchCandles(item.symbol),
        fetchStockFlow(item.symbol, item.market).catch(() => undefined),
      ]);
      return {
        ...analyzeCandles(item.symbol, item.name, item.market, candles),
        flow,
      };
    })),
  ]);

  const markets = marketResults.map((result, index) =>
    result.status === "fulfilled" ? result.value : fallback.markets[index],
  );
  const livePicks = stockResults.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  return {
    updatedAt: new Date().toISOString(),
    mode: livePicks.length >= 3 ? "live" : "fallback",
    markets,
    picks: (livePicks.length ? livePicks : fallback.picks)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6),
  };
}

export async function analyzeSymbol(rawSymbol: string): Promise<StockSignal> {
  const symbol = rawSymbol.trim().toUpperCase();
  if (!/^[A-Z0-9^.-]{1,20}$/.test(symbol)) throw new Error("股票代码格式无效");
  const known = UNIVERSE.find((item) => item.symbol === symbol);
  const market = known?.market ?? marketFromSymbol(symbol);
  const [candles, flow] = await Promise.all([
    fetchCandles(symbol),
    fetchStockFlow(symbol, market).catch(() => undefined),
  ]);
  return {
    ...analyzeCandles(symbol, known?.name ?? symbol, market, candles),
    flow,
  };
}
