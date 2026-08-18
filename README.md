# MARKET PULSE

美股、韩股与 A 股的资金动能、K 线和量化信号研究台。

在线访问：[https://workspace-gilt-eight-93.vercel.app](https://workspace-gilt-eight-93.vercel.app)

## 功能

- 三市场指数表现、5 日资金动能与数据置信度
- 支持名称、简称、裸代码和完整代码搜索，例如 `茅台`、`600519`、`三星`、`005930`、`NVDA`
- 韩股外资/机构/个人逐日净买入与 A 股主力/大单/中小单净流入
- 日 K、MA5、MA20、RSI(14)、成交量比与多因子评分
- 四套选股策略：均衡严选、趋势突破、缩量回调、低波防守
- 独立智能选股中心：22 只候选（美股 8、韩股 6、A 股 8），支持市场、推荐状态、技术形态、最低评分、关键词过滤和多维排序
- “严格推荐”同时要求策略评分 ≥ 64、未触发 RSI/乖离率追高限制、风险收益比 ≥ 2:1；无结果时明确提示而不降低硬规则
- 移动端底部“行情 / 选股 / K线”导航，选中推荐股后自动定位到可横向查看的日 K 图
- 趋势/动量/量能/买点/风控五因子拆解，以及 MACD、ATR、MA5 乖离率和风险收益比
- 严格执行 RSI > 80、MA5 乖离率 > 5% 时禁止给出买入信号
- 基于 ATR、MA20 和近期低点动态计算止损，目标价至少满足 2:1 风险收益比
- 每日观察池、研究目标、信号失效参考与风险提示
- Yahoo Finance 行情异常时自动降级到带有明确标签的演示缓存
- 15 分钟服务端缓存，避免重复请求免费数据源

## 本地运行

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

```bash
npm run typecheck
npm run lint
npm run build
```

## 数据口径

当前零配置版本使用 Yahoo Finance 日线。资金流是基于价格方向、成交量和 OBV 思路构造的市场动能代理，并不是券商逐笔订单：

| 市场 | 当前口径 | 后续生产数据源 |
| --- | --- | --- |
| 美股 | 指数及个股量价代理 | ETF 申赎、COT、期权流或持牌逐笔数据 |
| 韩股 | NaverPay 投资者逐日净买入；市场卡使用三星电子、SK 海力士、NAVER 代表篮子 | KRX/pykrx 全市场汇总（可选） |
| A 股 | 东方财富当日沪深主力资金及个股订单规模净流入 | Tushare 或持牌逐笔数据（可选） |

不同市场没有统一的“主力资金”官方定义，界面因此始终显示来源与置信度，不把代理指标描述成真实订单流。

韩股资金单位为万股（个股）或亿韩元（代表篮子），A 股资金单位为亿元。美股没有官方公开的逐股投资者分类净买入，因此仍明确标记为量价代理。

## 在线部署

项目不需要 API Key，可以直接部署到 Vercel：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FHYW1%2F-)

1. 点击按钮并登录 Vercel；
2. 保持 Framework Preset 为 `Next.js`；
3. 点击 Deploy，完成后即可获得永久 HTTPS 链接；
4. 如需自动更新，在 Vercel 中选择本仓库并将 Production Branch 设为 `main`。

服务器需要能够访问 `query1.finance.yahoo.com`、`m.stock.naver.com` 和 `push2delay.eastmoney.com`。接口失败时页面会保留最后可用行情或明确显示代理/缓存口径。

## 量化评分

评分由以下确定性规则构成：

1. 收盘价相对 MA20 的趋势；
2. MA5 与 MA20 的短期方向；
3. 20 日动量；
4. 当日量比与价格方向；
5. RSI 合理区间加分、过热惩罚。

计算只使用当日及之前的数据，不引用未来 K 线。评分用于候选排序，不代表收益概率，也不构成投资建议。

## 参考的开源 Skills

实现前调研了以下 GitHub 项目的方法论：

- `GearVoid/StockSight-Skill`：多数据源降级、异常检测和可信度展示
- `ZhuLinsen/alphasift`：可审计策略、超时保护和历史结果评估
- `sharebook-kr/pykrx-mcp`：KRX 投资者分类资金流接口
- `eddmpython/dartlab` flow skill：韩股外资与机构需要联合解释
- `27dream/mcp-eastmoney`：A 股主力资金、板块流向和 K 线接口设计

本仓库没有复制这些项目的代码；仅采用可解释、可降级和标注数据来源的设计原则。

## 免责声明

本项目仅用于软件演示、教育和研究。免费行情可能延迟或缺失。任何交易前都应通过持牌数据源核验，并自行评估风险。
