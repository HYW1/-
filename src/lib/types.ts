export type Market = "US" | "KR" | "CN";
export type StrategyId = "balanced" | "breakout" | "pullback" | "defensive";
export type QuantRuleId =
  | "three-up"
  | "four-up"
  | "bullish-stack"
  | "macd-bullish"
  | "breakout-20d"
  | "volume-breakout"
  | "healthy-pullback"
  | "near-ma20"
  | "low-volatility"
  | "momentum-zone";

export type StrategyScore = {
  score: number;
  signal: "观察" | "偏多" | "强势" | "谨慎";
  summary: string;
  blocked: boolean;
};

export type FactorScores = {
  trend: number;
  momentum: number;
  volume: number;
  timing: number;
  risk: number;
};

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
  macd: number;
  macdSignal: number;
  bias5: number;
  atrPercent: number;
  riskReward: number;
  factorScores: FactorScores;
  strategyScores: Record<StrategyId, StrategyScore>;
  quantRules: QuantRuleId[];
  consecutiveUpDays: number;
  setupTags: string[];
  stopLoss: number;
  target: number;
  candles: Candle[];
  source: string;
  asOf: string;
  flow?: StockFlow;
};

export type DailyScreen = {
  asOf: string;
  regime: "进攻" | "均衡" | "防守";
  thesis: string;
  screenedCount: number;
  recommendedCount: number;
  sources: string[];
};

export type DashboardData = {
  updatedAt: string;
  mode: "live" | "fallback";
  markets: MarketSnapshot[];
  picks: StockSignal[];
  dailyScreen: DailyScreen;
};

export type StockSearchResult = {
  symbol: string;
  name: string;
  market: Market;
  exchange: string;
};
