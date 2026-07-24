"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  Gauge,
  Info,
  LoaderCircle,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import type {
  Candle,
  DashboardData,
  Market,
  StockSearchResult,
  StockSignal,
  StrategyId,
} from "@/lib/types";

const marketNames: Record<Market, string> = { US: "美股", KR: "韩股", CN: "A股" };
const marketColors: Record<Market, string> = {
  US: "#bbf24a",
  KR: "#5ab9ff",
  CN: "#ff8a65",
};

const strategies: Array<{ id: StrategyId; name: string; note: string }> = [
  { id: "balanced", name: "均衡严选", note: "趋势、动量、量能、位置与风险综合" },
  { id: "breakout", name: "趋势突破", note: "寻找放量突破与MACD共振" },
  { id: "pullback", name: "缩量回调", note: "多头趋势中等待低风险回踩" },
  { id: "defensive", name: "低波防守", note: "优先趋势稳定和低ATR标的" },
];

function formatNumber(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits }).format(value);
}

function KlineChart({ candles }: { candles: Candle[] }) {
  const points = candles.slice(-32);
  const width = 760;
  const height = 270;
  const padding = { top: 16, right: 8, bottom: 25, left: 50 };
  const values = points.flatMap((item) => [item.high, item.low]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const xStep = (width - padding.left - padding.right) / points.length;
  const y = (value: number) =>
    padding.top + ((max - value) / Math.max(max - min, 0.001)) * (height - padding.top - padding.bottom);
  const pathFor = (key: "ma5" | "ma20") =>
    points
      .map((point, index) => {
        const value = point[key];
        return value == null ? "" : `${index === 0 ? "M" : "L"}${padding.left + xStep * (index + 0.5)},${y(value)}`;
      })
      .join(" ");

  return (
    <div className="kline-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="日K线图">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const value = max - (max - min) * ratio;
          const lineY = y(value);
          return (
            <g key={ratio}>
              <line x1={padding.left} x2={width} y1={lineY} y2={lineY} className="grid-line" />
              <text x={padding.left - 8} y={lineY + 4} textAnchor="end" className="axis-label">
                {formatNumber(value)}
              </text>
            </g>
          );
        })}
        {points.map((point, index) => {
          const x = padding.left + xStep * (index + 0.5);
          const rising = point.close >= point.open;
          const color = rising ? "#bbf24a" : "#ff6b6b";
          const bodyTop = y(Math.max(point.open, point.close));
          const bodyHeight = Math.max(2, Math.abs(y(point.open) - y(point.close)));
          return (
            <g key={point.date}>
              <line x1={x} x2={x} y1={y(point.high)} y2={y(point.low)} stroke={color} strokeWidth="1" />
              <rect
                x={x - Math.max(2, xStep * 0.24)}
                y={bodyTop}
                width={Math.max(4, xStep * 0.48)}
                height={bodyHeight}
                fill={rising ? "#bbf24a" : "#171b18"}
                stroke={color}
                rx="0.5"
              />
              {index % 8 === 0 && (
                <text x={x} y={height - 6} textAnchor="middle" className="axis-label">
                  {point.date.slice(5)}
                </text>
              )}
            </g>
          );
        })}
        <path d={pathFor("ma5")} fill="none" stroke="#5ab9ff" strokeWidth="1.5" />
        <path d={pathFor("ma20")} fill="none" stroke="#f6c85f" strokeWidth="1.5" />
      </svg>
      <div className="chart-legend">
        <span><i className="legend-dot blue" />MA5</span>
        <span><i className="legend-dot amber" />MA20</span>
        <span>红跌绿涨 · 前复权日线</span>
      </div>
    </div>
  );
}

export default function Dashboard({ initialData }: { initialData: DashboardData }) {
  const [data] = useState(initialData);
  const [selectedMarket, setSelectedMarket] = useState<Market>("US");
  const [selectedStock, setSelectedStock] = useState<StockSignal>(initialData.picks[0]);
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyId>("balanced");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<StockSearchResult[]>([]);
  const [error, setError] = useState("");
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [toast, setToast] = useState("");

  const market = data.markets.find((item) => item.market === selectedMarket) ?? data.markets[0];
  const visiblePicks = useMemo(
    () => data.picks
      .filter((pick) => pick.market === selectedMarket)
      .sort((left, right) =>
        right.strategyScores[selectedStrategy].score - left.strategyScores[selectedStrategy].score,
      ),
    [data.picks, selectedMarket, selectedStrategy],
  );
  const activeStrategy = strategies.find((item) => item.id === selectedStrategy) ?? strategies[0];
  const activeStockScore = selectedStock.strategyScores[selectedStrategy];

  useEffect(() => {
    const value = query.trim();
    if (!value) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(value)}`, {
          signal: controller.signal,
        });
        setSuggestions(response.ok ? await response.json() : []);
      } catch (searchError) {
        if (!(searchError instanceof DOMException && searchError.name === "AbortError")) {
          setSuggestions([]);
        }
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function runAnalysis(value: string) {
    if (!value.trim()) return;
    setLoading(true);
    setError("");
    setSuggestions([]);
    try {
      const response = await fetch(`/api/analyze?symbol=${encodeURIComponent(value.trim())}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "分析失败");
      setSelectedStock(result as StockSignal);
      setSelectedMarket((result as StockSignal).market);
      setQuery((result as StockSignal).symbol);
      document.querySelector("#analysis")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "分析失败");
    } finally {
      setLoading(false);
    }
  }

  async function searchStock(event: FormEvent) {
    event.preventDefault();
    await runAnalysis(suggestions[0]?.symbol ?? query);
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#">
          <span className="brand-mark"><TrendingUp size={20} /></span>
          <span>MARKET <b>PULSE</b></span>
        </a>
        <nav>
          <a className="active" href="#overview">市场概览</a>
          <a href="#signals">量化信号</a>
          <a href="#analysis">个股研究</a>
          <a href="#method">方法论</a>
        </nav>
        <div className="top-actions">
          <span className={`status ${data.mode}`}>
            <i /> {data.mode === "live" ? "数据在线" : "缓存模式"}
          </span>
          <button
            className={`icon-button ${alertsEnabled ? "enabled" : ""}`}
            aria-label="每日信号提醒"
            aria-pressed={alertsEnabled}
            onClick={() => {
              const enabled = !alertsEnabled;
              setAlertsEnabled(enabled);
              setToast(enabled ? "已开启本机每日信号提醒" : "已关闭每日信号提醒");
            }}
          >
            <Bell size={18} />
          </button>
        </div>
      </header>

      <section className="hero" id="overview">
        <div>
          <div className="eyebrow"><Activity size={14} /> MULTI-MARKET INTELLIGENCE</div>
          <h1>全球资金，<br /><span>一屏洞察。</span></h1>
          <p>统一追踪美股、韩股与 A 股的量价资金代理、K 线结构和可审计量化信号。</p>
        </div>
        <form className="search-box" onSubmit={searchStock}>
          <Search size={20} />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (!event.target.value.trim()) setSuggestions([]);
              setError("");
            }}
            placeholder="输入名称或代码，如 茅台 / 三星 / NVDA"
            aria-label="股票名称或代码"
            autoComplete="off"
          />
          <button disabled={loading}>
            {loading ? <LoaderCircle className="spin" size={18} /> : "立即分析"}
          </button>
          {(suggestions.length > 0 || searching) && (
            <div className="search-suggestions">
              {searching && suggestions.length === 0 ? (
                <div className="suggestion-loading"><LoaderCircle className="spin" size={14} />正在搜索全球市场…</div>
              ) : suggestions.map((item) => (
                <button
                  type="button"
                  className="suggestion-row"
                  key={item.symbol}
                  onClick={() => runAnalysis(item.symbol)}
                >
                  <span className={`market-pill market-${item.market.toLowerCase()}`}>{marketNames[item.market]}</span>
                  <span><strong>{item.name}</strong><small>{item.symbol} · {item.exchange}</small></span>
                  <ChevronRight size={15} />
                </button>
              ))}
            </div>
          )}
          {error && <div className="search-error">{error}</div>}
        </form>
      </section>

      <section className="market-grid">
        {data.markets.map((item) => (
          <button
            className={`market-card ${selectedMarket === item.market ? "selected" : ""}`}
            key={item.market}
            onClick={() => setSelectedMarket(item.market)}
          >
            <div className="market-card-head">
              <span className={`flag flag-${item.market.toLowerCase()}`}>{item.flag}</span>
              <div><strong>{item.label}</strong><small>{item.index}</small></div>
              <span className={`confidence confidence-${item.confidence}`}>{item.confidence}置信</span>
            </div>
            <div className="market-value">
              <strong>{formatNumber(item.value)}</strong>
              <span className={item.change >= 0 ? "positive" : "negative"}>
                {item.change >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                {Math.abs(item.change)}%
              </span>
            </div>
            <div className="sparkline">
              <ResponsiveContainer width="100%" height={54}>
                <AreaChart data={item.sparkline.map((value, index) => ({ index, value }))}>
                  <defs>
                    <linearGradient id={`fill-${item.market}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={marketColors[item.market]} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={marketColors[item.market]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={marketColors[item.market]}
                    fill={`url(#fill-${item.market})`}
                    strokeWidth={1.8}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flow-total">
              <span>{item.flowLabel}</span>
              <b className={item.netFlow >= 0 ? "positive" : "negative"}>
                {item.netFlow >= 0 ? "+" : ""}{formatNumber(item.netFlow)} {item.flowUnit}
              </b>
            </div>
          </button>
        ))}
      </section>

      <section className="content-grid">
        <article className="panel flow-panel">
          <div className="panel-head">
            <div>
              <span className="section-kicker">CAPITAL FLOW</span>
              <h2>{market.label}资金动能</h2>
            </div>
            <div className="source-chip"><Database size={13} /> {market.source}</div>
          </div>
          <div className="flow-chart">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={market.flow}>
                <CartesianGrid stroke="#232925" vertical={false} />
                <XAxis dataKey="date" stroke="#697269" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis stroke="#697269" tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip
                  contentStyle={{ background: "#131714", border: "1px solid #2d352f", borderRadius: 4 }}
                  labelStyle={{ color: "#9ca59d" }}
                />
                <Line type="monotone" dataKey="foreign" name={selectedMarket === "KR" ? "外资" : selectedMarket === "CN" ? "主力" : "大单代理"} stroke="#bbf24a" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="institution" name={selectedMarket === "KR" ? "机构" : selectedMarket === "CN" ? "超大单" : "机构代理"} stroke="#5ab9ff" dot={false} strokeWidth={1.8} />
                <Line type="monotone" dataKey="retail" name={selectedMarket === "KR" ? "个人" : selectedMarket === "CN" ? "中小单" : "散户代理"} stroke="#8a918b" dot={false} strokeDasharray="4 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="metric-row">
            <div><small>{market.flowLabel}</small><b className={market.netFlow >= 0 ? "positive" : "negative"}>{market.netFlow >= 0 ? "+" : ""}{market.netFlow} {market.flowUnit}</b></div>
            <div><small>资金方向</small><b>{market.trend === "in" ? "持续流入" : "短期流出"}</b></div>
            <div><small>数据口径</small><b>{market.confidence === "高" ? "真实资金流" : market.confidence === "中" ? "真实代表篮子" : "量价估算"}</b></div>
          </div>
        </article>

        <aside className="panel picks-panel" id="signals">
          <div className="panel-head">
            <div><span className="section-kicker">DAILY SIGNALS</span><h2>今日量化观察</h2></div>
            <span className="date-tag"><Clock3 size={13} /> {new Date(data.updatedAt).toLocaleDateString("zh-CN")}</span>
          </div>
          <div className="strategy-tabs" role="tablist" aria-label="选股策略">
            {strategies.map((strategy) => (
              <button
                role="tab"
                aria-selected={selectedStrategy === strategy.id}
                className={selectedStrategy === strategy.id ? "active" : ""}
                key={strategy.id}
                onClick={() => setSelectedStrategy(strategy.id)}
              >
                {strategy.name}
              </button>
            ))}
          </div>
          <p className="strategy-note">{activeStrategy.note}</p>
          <div className="picks-list">
            {(visiblePicks.length ? visiblePicks : data.picks.slice(0, 3)).map((pick, index) => (
              <button
                key={pick.symbol}
                className={`pick-row ${selectedStock.symbol === pick.symbol ? "active" : ""}`}
                onClick={() => setSelectedStock(pick)}
              >
                <span className="rank">{String(index + 1).padStart(2, "0")}</span>
                <span className="pick-main">
                  <strong>{pick.name}</strong>
                  <small>{pick.symbol} · {pick.strategyScores[selectedStrategy].signal}</small>
                </span>
                <span className="score-ring" style={{ "--score": `${pick.strategyScores[selectedStrategy].score * 3.6}deg` } as React.CSSProperties}>
                  <i>{pick.strategyScores[selectedStrategy].score}</i>
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
          <div className="guardrail"><ShieldAlert size={16} /><span>信号是研究排序，不构成自动买卖指令。</span></div>
        </aside>
      </section>

      <section className="stock-panel panel" id="analysis">
        <div className="stock-title">
          <div>
            <span className={`market-pill market-${selectedStock.market.toLowerCase()}`}>
              {marketNames[selectedStock.market]}
            </span>
            <h2>{selectedStock.name} <small>{selectedStock.symbol}</small></h2>
            <div className="stock-price">
              {formatNumber(selectedStock.price)}
              <span className={selectedStock.change >= 0 ? "positive" : "negative"}>
                {selectedStock.change >= 0 ? "+" : ""}{selectedStock.change}%
              </span>
            </div>
          </div>
          <div className="signal-summary">
            <div className="big-score">{activeStockScore.score}<small>/100</small></div>
            <div><span>{activeStrategy.name}</span><b>{activeStockScore.signal}</b></div>
          </div>
        </div>

        <div className="analysis-grid">
          <div className="chart-card">
            <div className="chart-card-head">
              <span>日线结构 · 最近32个交易日</span>
              <span>{selectedStock.source} · {selectedStock.asOf}</span>
            </div>
            <KlineChart candles={selectedStock.candles} />
          </div>
          <div className="strategy-card">
            <div className="strategy-head"><Sparkles size={17} /><span>{activeStrategy.name} · 策略解读</span></div>
            <p>{activeStockScore.summary}。{selectedStock.reason}</p>
            <div className="setup-tags">
              {selectedStock.setupTags.map((tag) => <span key={tag}>{tag}</span>)}
            </div>
            {selectedStock.flow && (
              <div className="real-flow">
                <div className="real-flow-head">
                  <span><Database size={13} />真实资金数据 · {selectedStock.flow.asOf}</span>
                  <small>{selectedStock.flow.source}</small>
                </div>
                <div className="real-flow-grid">
                  <div><small>{selectedStock.flow.label}</small><b className={selectedStock.flow.primary >= 0 ? "positive" : "negative"}>{selectedStock.flow.primary >= 0 ? "+" : ""}{selectedStock.flow.primary} {selectedStock.flow.unit}</b></div>
                  <div><small>{selectedStock.market === "KR" ? "机构净买入" : "大单+超大单"}</small><b className={selectedStock.flow.institution >= 0 ? "positive" : "negative"}>{selectedStock.flow.institution >= 0 ? "+" : ""}{selectedStock.flow.institution} {selectedStock.flow.unit}</b></div>
                  <div><small>{selectedStock.market === "KR" ? "个人净买入" : "中单+小单"}</small><b className={selectedStock.flow.retail >= 0 ? "positive" : "negative"}>{selectedStock.flow.retail >= 0 ? "+" : ""}{selectedStock.flow.retail} {selectedStock.flow.unit}</b></div>
                </div>
              </div>
            )}
            <div className="factor-breakdown">
              {([
                ["趋势", selectedStock.factorScores.trend],
                ["动量", selectedStock.factorScores.momentum],
                ["量能", selectedStock.factorScores.volume],
                ["买点", selectedStock.factorScores.timing],
                ["风控", selectedStock.factorScores.risk],
              ] as const).map(([label, value]) => (
                <div key={label}>
                  <span>{label}<b>{value}</b></span>
                  <i><em style={{ width: `${value}%` }} /></i>
                </div>
              ))}
            </div>
            <div className="indicator-grid">
              <div><Gauge size={15} /><small>RSI (14)</small><b>{selectedStock.rsi}</b></div>
              <div><BarChart3 size={15} /><small>成交量比</small><b>{selectedStock.volumeRatio}x</b></div>
              <div><TrendingUp size={15} /><small>MACD / Signal</small><b>{selectedStock.macd} / {selectedStock.macdSignal}</b></div>
              <div><Activity size={15} /><small>MA5乖离率</small><b>{selectedStock.bias5}%</b></div>
              <div><ShieldAlert size={15} /><small>ATR波动率</small><b>{selectedStock.atrPercent}%</b></div>
              <div><Target size={15} /><small>风险收益比</small><b>{selectedStock.riskReward}:1</b></div>
              <div><Target size={15} /><small>研究目标</small><b>{selectedStock.target}</b></div>
              <div><ShieldAlert size={15} /><small>失效参考</small><b>{selectedStock.stopLoss}</b></div>
            </div>
            <div className="risk-note"><Info size={15} /><span>{selectedStock.risk}</span></div>
            <div className="strategy-rule">
              <CheckCircle2 size={16} />
              <span>硬规则：RSI &gt; 80 或 MA5乖离 &gt; 5% 时禁止买入；优先缩量回调，信号仅使用当日及此前数据。</span>
            </div>
          </div>
        </div>
      </section>

      <section className="method" id="method">
        <div><span className="section-kicker">RESEARCH STANDARD</span><h2>每个结论，都能追溯。</h2></div>
        <div className="method-items">
          <div><span>01</span><strong>口径分离</strong><p>各市场资金指标按可得数据独立定义，不做虚假横向等同。</p></div>
          <div><span>02</span><strong>信号可审计</strong><p>趋势、RSI、量比和风控价均由日线数据确定性计算。</p></div>
          <div><span>03</span><strong>风险先行</strong><p>展示信号失效条件和数据置信度，不承诺收益。</p></div>
        </div>
      </section>

      <footer>
        <div><strong>MARKET PULSE</strong><span>Research, not promises.</span></div>
        <p>仅供学习与研究，不构成投资建议。行情可能延迟，请在交易前通过持牌数据源核验。</p>
      </footer>
      {toast && <div className="toast"><CheckCircle2 size={16} />{toast}</div>}
    </main>
  );
}
