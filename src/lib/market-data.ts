import type {
  Candle,
  DashboardData,
  FlowPoint,
  Market,
  MarketSnapshot,
  StockFlow,
  StockSearchResult,
  StockSignal,
} from "./types";

const SEARCH_CATALOG = [
  { symbol: "NVDA", name: "NVIDIA", market: "US" as const, exchange: "NASDAQ", aliases: ["英伟达", "nvidia"] },
  { symbol: "MSFT", name: "Microsoft", market: "US" as const, exchange: "NASDAQ", aliases: ["微软", "microsoft"] },
  { symbol: "AVGO", name: "Broadcom", market: "US" as const, exchange: "NASDAQ", aliases: ["博通", "broadcom"] },
  { symbol: "AAPL", name: "Apple", market: "US" as const, exchange: "NASDAQ", aliases: ["苹果", "apple"] },
  { symbol: "TSLA", name: "Tesla", market: "US" as const, exchange: "NASDAQ", aliases: ["特斯拉", "tesla"] },
  { symbol: "AMZN", name: "Amazon", market: "US" as const, exchange: "NASDAQ", aliases: ["亚马逊", "amazon"] },
  { symbol: "META", name: "Meta Platforms", market: "US" as const, exchange: "NASDAQ", aliases: ["脸书", "meta"] },
  { symbol: "GOOGL", name: "Alphabet", market: "US" as const, exchange: "NASDAQ", aliases: ["谷歌", "google", "alphabet"] },
  { symbol: "005930.KS", name: "Samsung Electronics", market: "KR" as const, exchange: "KOSPI", aliases: ["三星电子", "三星", "samsung", "삼성전자"] },
  { symbol: "000660.KS", name: "SK Hynix", market: "KR" as const, exchange: "KOSPI", aliases: ["SK海力士", "海力士", "sk hynix", "에스케이하이닉스"] },
  { symbol: "207940.KS", name: "Samsung Biologics", market: "KR" as const, exchange: "KOSPI", aliases: ["三星生物", "samsung biologics", "삼성바이오로직스"] },
  { symbol: "035420.KS", name: "NAVER", market: "KR" as const, exchange: "KOSPI", aliases: ["韩国naver", "네이버"] },
  { symbol: "005380.KS", name: "Hyundai Motor", market: "KR" as const, exchange: "KOSPI", aliases: ["现代汽车", "hyundai", "현대차"] },
  { symbol: "373220.KS", name: "LG Energy Solution", market: "KR" as const, exchange: "KOSPI", aliases: ["LG新能源", "lg energy", "엘지에너지솔루션"] },
  { symbol: "600519.SS", name: "贵州茅台", market: "CN" as const, exchange: "上交所", aliases: ["茅台", "贵州茅台"] },
  { symbol: "300750.SZ", name: "宁德时代", market: "CN" as const, exchange: "深交所", aliases: ["宁德", "宁德时代", "catl"] },
  { symbol: "601138.SS", name: "工业富联", market: "CN" as const, exchange: "上交所", aliases: ["富士康", "工业富联"] },
  { symbol: "002594.SZ", name: "比亚迪", market: "CN" as const, exchange: "深交所", aliases: ["比亚迪", "byd"] },
  { symbol: "000333.SZ", name: "美的集团", market: "CN" as const, exchange: "深交所", aliases: ["美的", "美的集团"] },
  { symbol: "601318.SS", name: "中国平安", market: "CN" as const, exchange: "上交所", aliases: ["平安", "中国平安"] },
  { symbol: "601398.SS", name: "工商银行", market: "CN" as const, exchange: "上交所", aliases: ["工行", "工商银行"] },
  { symbol: "688981.SS", name: "中芯国际", market: "CN" as const, exchange: "科创板", aliases: ["中芯", "中芯国际", "smic"] },
];

const UNIVERSE = SEARCH_CATALOG;

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

function ema(values: number[], period: number) {
  const multiplier = 2 / (period + 1);
  const result: number[] = [];
  values.forEach((value, index) => {
    result.push(index === 0 ? value : value * multiplier + result[index - 1] * (1 - multiplier));
  });
  return result;
}

function calculateMacd(candles: Candle[]) {
  const closes = candles.map((item) => item.close);
  const fast = ema(closes, 12);
  const slow = ema(closes, 26);
  const line = fast.map((value, index) => value - slow[index]);
  const signal = ema(line, 9);
  return { macd: line.at(-1) ?? 0, signal: signal.at(-1) ?? 0 };
}

function calculateAtr(candles: Candle[], period = 14) {
  const ranges = candles.map((item, index) => {
    const previousClose = candles[Math.max(0, index - 1)].close;
    return Math.max(
      item.high - item.low,
      Math.abs(item.high - previousClose),
      Math.abs(item.low - previousClose),
    );
  });
  return ranges.slice(-period).reduce((sum, value) => sum + value, 0) / Math.min(period, ranges.length);
}

function clampScore(value: number) {
  return Math.round(Math.max(0, Math.min(100, value)));
}

function signalFromScore(score: number, blocked: boolean): StockSignal["signal"] {
  if (blocked) return "谨慎";
  if (score >= 80) return "强势";
  if (score >= 64) return "偏多";
  if (score < 40) return "谨慎";
  return "观察";
}

function buildStrategyScores(input: {
  trend: number;
  momentum: number;
  volume: number;
  timing: number;
  risk: number;
  blocked: boolean;
  nearHigh: boolean;
  healthyPullback: boolean;
  macdBullish: boolean;
}) {
  const weighted = (weights: number[]) => clampScore(
    input.trend * weights[0]
    + input.momentum * weights[1]
    + input.volume * weights[2]
    + input.timing * weights[3]
    + input.risk * weights[4],
  );
  const raw = {
    balanced: weighted([0.3, 0.25, 0.18, 0.17, 0.1]),
    breakout: weighted([0.35, 0.3, 0.22, 0.08, 0.05])
      + (input.nearHigh ? 8 : -5)
      + (input.macdBullish ? 4 : -4),
    pullback: weighted([0.28, 0.12, 0.18, 0.32, 0.1])
      + (input.healthyPullback ? 14 : -7),
    defensive: weighted([0.28, 0.12, 0.08, 0.17, 0.35]),
  };
  const summaries = {
    balanced: "趋势、动量、量能、位置与风险均衡加权",
    breakout: input.nearHigh ? "接近20日高位，等待放量确认突破" : "尚未形成有效突破结构",
    pullback: input.healthyPullback ? "上升趋势中的缩量回调，符合严进买点" : "回调位置或量能尚未满足严进条件",
    defensive: "优先低波动、趋势稳定与安全边际",
  };
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => {
      const score = input.blocked ? Math.min(59, clampScore(value)) : clampScore(value);
      return [key, {
        score,
        signal: signalFromScore(score, input.blocked),
        summary: input.blocked ? "触发不追高硬规则，禁止给出买入信号" : summaries[key as keyof typeof summaries],
        blocked: input.blocked,
      }];
    }),
  ) as StockSignal["strategyScores"];
}

function marketFromSymbol(symbol: string): Market {
  if (symbol.endsWith(".KS") || symbol.endsWith(".KQ")) return "KR";
  if (symbol.endsWith(".SS") || symbol.endsWith(".SZ")) return "CN";
  return "US";
}

function normalizeSymbolInput(value: string) {
  let symbol = value.trim().toUpperCase().replaceAll(" ", "");
  if (/^(SH|SS)\d{6}$/.test(symbol)) symbol = `${symbol.slice(2)}.SS`;
  if (/^SZ\d{6}$/.test(symbol)) symbol = `${symbol.slice(2)}.SZ`;
  if (/^(KR|KOSPI):?\d{6}$/.test(symbol)) symbol = `${symbol.slice(-6)}.KS`;
  if (symbol.endsWith(".SH")) symbol = `${symbol.slice(0, -3)}.SS`;
  return symbol;
}

function catalogResult(item: (typeof SEARCH_CATALOG)[number]): StockSearchResult {
  return {
    symbol: item.symbol,
    name: item.name,
    market: item.market,
    exchange: item.exchange,
  };
}

type YahooSearchPayload = {
  quotes?: Array<{
    symbol?: string;
    shortname?: string;
    longname?: string;
    quoteType?: string;
    exchDisp?: string;
    exchange?: string;
  }>;
};

export async function searchStocks(rawQuery: string): Promise<StockSearchResult[]> {
  const query = rawQuery.trim();
  if (!query) return [];
  const normalized = normalizeSymbolInput(query);
  const lower = query.toLocaleLowerCase();
  const local = SEARCH_CATALOG.filter((item) => {
    const base = item.symbol.split(".")[0];
    return item.symbol === normalized
      || base === normalized
      || item.name.toLocaleLowerCase().includes(lower)
      || item.aliases.some((alias) => alias.toLocaleLowerCase().includes(lower));
  }).map(catalogResult);

  if (/^\d{6}$/.test(normalized) && local.length === 0) {
    const suffix = /^[569]/.test(normalized) ? ".SS" : ".SZ";
    local.push({
      symbol: `${normalized}${suffix}`,
      name: normalized,
      market: "CN",
      exchange: suffix === ".SS" ? "上交所" : "深交所",
    });
  }

  if (!/^[A-Z0-9^.-]+$/i.test(query)) return local.slice(0, 8);

  try {
    const url = new URL("https://query1.finance.yahoo.com/v1/finance/search");
    url.searchParams.set("q", normalized);
    url.searchParams.set("quotesCount", "8");
    url.searchParams.set("newsCount", "0");
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 MarketPulse/1.0" },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return local.slice(0, 8);
    const payload = (await response.json()) as YahooSearchPayload;
    const remote = (payload.quotes ?? [])
      .filter((quote) => quote.symbol && ["EQUITY", "ETF"].includes(quote.quoteType ?? ""))
      .map((quote): StockSearchResult => ({
        symbol: quote.symbol!,
        name: quote.longname ?? quote.shortname ?? quote.symbol!,
        market: marketFromSymbol(quote.symbol!),
        exchange: quote.exchDisp ?? quote.exchange ?? "",
      }));
    return [...local, ...remote]
      .filter((item, index, values) => values.findIndex((candidate) => candidate.symbol === item.symbol) === index)
      .slice(0, 8);
  } catch {
    return local.slice(0, 8);
  }
}

async function resolveStockQuery(rawQuery: string) {
  const normalized = normalizeSymbolInput(rawQuery);
  const matches = await searchStocks(rawQuery);
  const exact = matches.find((item) =>
    item.symbol === normalized
    || item.symbol.split(".")[0] === normalized
    || item.name.toLocaleLowerCase() === rawQuery.trim().toLocaleLowerCase(),
  );
  if (exact) return exact;
  if (matches[0]) return matches[0];
  if (/^[A-Z0-9^.-]{1,20}$/.test(normalized)) {
    return {
      symbol: normalized,
      name: normalized,
      market: marketFromSymbol(normalized),
      exchange: "",
    } satisfies StockSearchResult;
  }
  throw new Error("未找到匹配股票");
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
  const priorMa20 = candles.at(-6)?.ma20 ?? ma20;
  const momentum20 = (last.close / candles.at(-21)!.close - 1) * 100;
  const change = (last.close / previous.close - 1) * 100;
  const { macd, signal: macdSignal } = calculateMacd(candles);
  const atr = calculateAtr(candles);
  const atrPercent = (atr / last.close) * 100;
  const bias5 = ((last.close / ma5) - 1) * 100;
  const recentHigh = Math.max(...candles.slice(-21, -1).map((item) => item.high));
  const recentLow = Math.min(...candles.slice(-11).map((item) => item.low));
  const nearHigh = last.close >= recentHigh * 0.98;
  const macdBullish = macd > macdSignal;
  const healthyPullback = ma5 > ma20
    && last.close >= ma20
    && change <= 1
    && change >= -3
    && volumeRatio < 1
    && Math.abs(bias5) <= 3;
  const blocked = rsi > 80 || bias5 > 5;

  const trend = clampScore(
    (last.close > ma20 ? 35 : 8)
    + (ma5 > ma20 ? 25 : 5)
    + (ma20 > priorMa20 ? 25 : 5)
    + (nearHigh ? 15 : 7),
  );
  const momentum = clampScore(
    45
    + Math.max(-25, Math.min(25, momentum20 * 1.5))
    + (macdBullish ? 17 : -10)
    + (rsi >= 45 && rsi <= 70 ? 10 : rsi > 80 ? -30 : 0),
  );
  const volume = clampScore(change >= 0
    ? (volumeRatio >= 1.15 && volumeRatio <= 2.5 ? 88 : volumeRatio > 2.5 ? 62 : 55)
    : (volumeRatio < 0.9 ? 82 : volumeRatio > 1.5 ? 20 : 48));
  const timing = clampScore(
    (Math.abs(bias5) <= 2 ? 88 : Math.abs(bias5) <= 5 ? 62 : 12)
    + (rsi >= 42 && rsi <= 65 ? 8 : rsi > 80 ? -35 : 0),
  );
  const riskScore = clampScore(92 - atrPercent * 12 + (last.close > ma20 ? 8 : -15));
  const factorScores = { trend, momentum, volume, timing, risk: riskScore };
  const strategyScores = buildStrategyScores({
    ...factorScores,
    blocked,
    nearHigh,
    healthyPullback,
    macdBullish,
  });
  const { score, signal } = strategyScores.balanced;
  const reasons = [
    last.close > ma20 ? "价格站上20日均线" : "价格位于20日均线下方",
    macdBullish ? "MACD位于信号线上方" : "MACD动能尚弱",
    healthyPullback ? "出现缩量回调结构" : volumeRatio > 1.15 ? `量比 ${volumeRatio.toFixed(1)}x` : "量能温和",
  ];
  const stopCandidates = [
    ma20 * 0.98,
    recentLow * 0.99,
    last.close - atr * 2,
  ].filter((value) => value > 0 && value < last.close);
  const stopLoss = stopCandidates.length
    ? Math.max(...stopCandidates)
    : last.close * 0.94;
  const target = Math.max(recentHigh, last.close + (last.close - stopLoss) * 2);
  const riskReward = (target - last.close) / Math.max(last.close - stopLoss, last.close * 0.001);
  const setupTags = [
    ma5 > ma20 && ma20 > priorMa20 ? "多头排列" : "趋势待确认",
    macdBullish ? "MACD多头" : "MACD空头",
    healthyPullback ? "缩量回调" : nearHigh ? "临近突破" : "区间运行",
    blocked ? "禁止追高" : "未触发硬限制",
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
    risk: blocked
      ? `触发硬规则：${rsi > 80 ? "RSI > 80" : "MA5乖离率 > 5%"}，当前禁止追高`
      : rsi > 72
        ? "RSI偏热，等待回调而非追价"
        : last.close < ma20
          ? "趋势未确认，控制仓位"
          : "跌破动态止损位视为信号失效",
    rsi: round(rsi, 1),
    volumeRatio: round(volumeRatio, 1),
    macd: round(macd, 3),
    macdSignal: round(macdSignal, 3),
    bias5: round(bias5, 1),
    atrPercent: round(atrPercent, 1),
    riskReward: round(riskReward, 1),
    factorScores,
    strategyScores,
    setupTags,
    stopLoss: round(stopLoss),
    target: round(target),
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
  const picks = UNIVERSE.map((item, index) =>
    fallbackStock(
      item.symbol,
      item.name,
      item.market,
      item.market === "US" ? 150 + index * 18 : item.market === "KR" ? 70_000 + index * 9_000 : 35 + index * 12,
      440 + index,
    ),
  ).sort((a, b) => b.score - a.score);
  return {
    updatedAt: new Date().toISOString(),
    mode: "fallback",
    markets,
    picks,
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
      .sort((a, b) => b.score - a.score),
  };
}

export async function analyzeSymbol(rawSymbol: string): Promise<StockSignal> {
  const resolved = await resolveStockQuery(rawSymbol);
  const { symbol, market } = resolved;
  const [candles, flow] = await Promise.all([
    fetchCandles(symbol),
    fetchStockFlow(symbol, market).catch(() => undefined),
  ]);
  return {
    ...analyzeCandles(symbol, resolved.name, market, candles),
    flow,
  };
}
