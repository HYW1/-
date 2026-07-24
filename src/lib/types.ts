export type Market = "US" | "KR" | "CN";

export type Candle = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ma5?: number;
  ma20?: number;
};

export type FlowPoint = {
  date: string;
  foreign: number;
  institution: number;
  retail: number;
};

export type MarketSnapshot = {
  market: Market;
  label: string;
  flag: string;
  index: string;
  symbol: string;
  value: number;
  change: number;
  netFlow: number;
  flowLabel: string;
  flowUnit: string;
  trend: "in" | "out";
  confidence: "高" | "中" | "代理";
  source: string;
  sparkline: number[];
  flow: FlowPoint[];
};

export type StockFlow = {
  label: string;
  primary: number;
  institution: number;
  retail: number;
  unit: string;
  source: string;
  asOf: string;
};

export type StockSignal = {
  symbol: string;
  name: string;
  market: Market;
  price: number;
  change: number;
  score: number;
  signal: "观察" | "偏多" | "强势" | "谨慎";
  reason: string;
  risk: string;
  rsi: number;
  volumeRatio: number;
  stopLoss: number;
  target: number;
  candles: Candle[];
  source: string;
  asOf: string;
  flow?: StockFlow;
};

export type DashboardData = {
  updatedAt: string;
  mode: "live" | "fallback";
  markets: MarketSnapshot[];
  picks: StockSignal[];
};

export type StockSearchResult = {
  symbol: string;
  name: string;
  market: Market;
  exchange: string;
};
