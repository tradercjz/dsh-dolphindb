# DolphinDB Indicator Cookbook

## Skill 介绍

本 Skill 用于在因子复现代码中优先复用 `src/backend/factorLab/built-in/factor` 下已经内置的 DolphinDB 因子与技术指标函数。遇到常见技术指标、Alpha 因子、盘口快照因子或 MyTT 风格公式时，应优先查找可直接调用的内置模块，减少重复手写实现。

## 模块加载方式

使用某个模块前，先加载对应模块，再通过 `module::function` 调用。

例如使用 RSI：

```dos
runScript("use ta")
ta::rsi(close, 14)
```

常见模块：

| Module | Load | Example | 用途 |
|--------|------|---------|------|
| `ta` | `runScript("use ta")` | `ta::rsi(close, 14)` | TA-Lib 风格技术指标 |
| `mytt` | `runScript("use mytt")` | `mytt::MACD(close)` | MyTT/通达信风格指标 |
| `alpha101` | `runScript("use alpha101")` | `alpha101::WQAlpha101(close, open, high, low)` | WorldQuant Alpha101 |
| `alpha191` | `runScript("use alpha191")` | `alpha191::gtjaAlpha1(open, close, vol)` | 国泰君安 Alpha191 |
| `highFrequencyFactors` | `runScript("use highFrequencyFactors")` | `highFrequencyFactors::wavgSOIR(bidQty, askQty, 20)` | 高频行情因子 |
| `snapshot` | `runScript("use snapshot")` | `snapshot::wavgSOIR(bidQty, askQty, 20)` | 快照盘口因子 |
| `tick` | `runScript("use tick")` | `tick::buyTradeRatio(buyNo, sellNo, tradeQty)` | 逐笔成交因子 |
| `common` | `runScript("use common")` | `common::factorDoubleEMA(price)` | 通用因子函数 |

## `ta` 技术指标速查

### Moving Averages

| Indicator | Code | Default Params | Return | Notes |
|-----------|------|----------------|--------|-------|
| SMA | `ta::sma(close, timePeriod=30)` | `timePeriod=30` | vector | 简单移动平均 |
| EMA | `ta::ema(close, timePeriod=30)` | `timePeriod=30` | vector | 指数移动平均 |
| WMA | `ta::wma(close, timePeriod=30)` | `timePeriod=30` | vector | 加权移动平均 |
| DEMA | `ta::dema(close, timePeriod=30)` | `timePeriod=30` | vector | 双指数移动平均 |
| TEMA | `ta::tema(close, timePeriod=30)` | `timePeriod=30` | vector | 三指数移动平均 |
| TRIMA | `ta::trima(close, timePeriod=30)` | `timePeriod=30` | vector | 三角移动平均 |
| KAMA | `ta::kama(close, timePeriod=30)` | `timePeriod=30` | vector | Kaufman 自适应均线 |
| T3 | `ta::t3(close, timePeriod=5, vfactor=0)` | `timePeriod=5`, `vfactor=0` | vector | T3 移动平均 |
| MA | `ta::ma(close, timePeriod=30, maType=0)` | `timePeriod=30`, `maType=0` | vector | `maType` 选择均线类型 |

`ta::ma` 的 `maType`：

| maType | Meaning |
|--------|---------|
| `0` | SMA |
| `1` | EMA |
| `2` | WMA |
| `3` | DEMA |
| `4` | TEMA |
| `5` | TRIMA |
| `6` | KAMA |
| `7` | MESA Adaptive Moving Average |
| `8` | T3 |

### Momentum

| Indicator | Code | Default Params | Return | Notes |
|-----------|------|----------------|--------|-------|
| RSI | `ta::rsi(close, timePeriod=14)` | `timePeriod=14` | vector | 使用 Wilder 平滑计算上涨/下跌均值 |
| CMO | `ta::cmo(close, timePeriod=14)` | `timePeriod=14` | vector | Chande Momentum Oscillator |
| MOM | `ta::mom(close, timePeriod=10)` | `timePeriod=10` | vector | 动量 |
| ROC | `ta::roc(close, timePeriod=10)` | `timePeriod=10` | vector | 百分比变化率 |
| ROCP | `ta::rocp(close, timePeriod=10)` | `timePeriod=10` | vector | 比例变化率 |
| ROCR | `ta::rocr(close, timePeriod=10)` | `timePeriod=10` | vector | 变化率比值 |
| ROCR100 | `ta::rocr100(close, timePeriod=10)` | `timePeriod=10` | vector | `ROCR * 100` |
| TRIX | `ta::trix(close, timePeriod=30)` | `timePeriod=30` | vector | 三重 EMA 变化率 |
| PPO | `ta::ppo(close, fastPeriod=12, slowPeriod=26, maType=0)` | `12, 26, 0` | vector | Percentage Price Oscillator |
| APO | `ta::apo(close, fastPeriod=12, slowPeriod=26, maType=0)` | `12, 26, 0` | vector | Absolute Price Oscillator |

### MACD

| Indicator | Code | Default Params | Return | Notes |
|-----------|------|----------------|--------|-------|
| MACD | `ta::macd(close, fastPeriod=12, slowPeriod=26, signalPeriod=9)` | `12, 26, 9` | tuple | 返回 `macd`, `signal`, `hist` |
| MACD Ext | `ta::macdExt(close, fastPeriod=12, fastMaType=0, slowPeriod=26, slowMaType=0, signalPeriod=9, signalMaType=0)` | `12,0,26,0,9,0` | tuple | 可指定快慢线和信号线均线类型 |
| MACD Fix | `ta::macdFix(close, signalPeriod=9)` | `signalPeriod=9` | tuple | 固定快慢周期版本 |

示例：

```dos
runScript("use ta")
macdLine, signalLine, hist = ta::macd(close, 12, 26, 9)
```

### Stochastic

| Indicator | Code | Default Params | Return | Notes |
|-----------|------|----------------|--------|-------|
| STOCHF | `ta::stochf(high, low, close, fastkPeriod=5, fastdPeriod=3, fastdMatype=0)` | `5, 3, 0` | tuple | 返回 `fastk`, `fastd` |
| STOCH | `ta::stoch(high, low, close, fastkPeriod=5, slowkPeriod=3, slowkMatype=0, slowdPeriod=3, slowdMatype=0)` | `5,3,0,3,0` | tuple | 返回 `slowk`, `slowd` |
| STOCHRSI | `ta::stochRsi(close, timePeriod=14, fastkPeriod=5, fastdPeriod=3, fastdMatype=0)` | `14,5,3,0` | tuple | 返回 `fastk`, `fastd` |

### Trend

| Indicator | Code | Default Params | Return | Notes |
|-----------|------|----------------|--------|-------|
| ADX | `ta::adx(high, low, close, timePeriod=14)` | `timePeriod=14` | vector | Average Directional Movement Index |
| ADXR | `ta::adxr(high, low, close, timePeriod=14)` | `timePeriod=14` | vector | ADX Rating |
| DX | `ta::dx(high, low, close, timePeriod=14)` | `timePeriod=14` | vector | Directional Movement Index |
| PLUS_DI | `ta::plus_di(high, low, close, timePeriod=14)` | `timePeriod=14` | vector | Plus Directional Indicator |
| MINUS_DI | `ta::minus_di(high, low, close, timePeriod=14)` | `timePeriod=14` | vector | Minus Directional Indicator |
| PLUS_DM | `ta::plus_dm(high, low, timePeriod=14)` | `timePeriod=14` | vector | Plus Directional Movement |
| MINUS_DM | `ta::minus_dm(high, low, timePeriod=14)` | `timePeriod=14` | vector | Minus Directional Movement |
| AROON | `ta::aroon(high, low, timePeriod=14)` | `timePeriod=14` | tuple | 返回 `aroonDown`, `aroonUp` |
| AROONOSC | `ta::aroonOsc(high, low, timePeriod=14)` | `timePeriod=14` | vector | Aroon Oscillator |
| ULTOSC | `ta::ultOsc(high, low, close, timePeriod1=7, timePeriod2=14, timePeriod3=28)` | `7,14,28` | vector | Ultimate Oscillator |

### Volatility

| Indicator | Code | Default Params | Return | Notes |
|-----------|------|----------------|--------|-------|
| BBANDS | `ta::bBands(close, timePeriod=5, nbdevUp=2, nbdevDn=2, maType=0)` | `5,2,2,0` | tuple | 返回 `upper`, `middle`, `lower` |
| ATR | `ta::atr(high, low, close, timePeriod=14)` | `timePeriod=14` | vector | Average True Range |
| NATR | `ta::natr(high, low, close, timePeriod=14)` | `timePeriod=14` | vector | Normalized ATR |
| TRANGE | `ta::trange(high, low, close)` | none | vector | True Range |
| STDDEV | `ta::stddev(close, timePeriod=5, nbdev=1)` | `5,1` | vector | Population standard deviation |
| VAR | `ta::var(close, timePeriod=5, nbdev=1)` | `5,1` | vector | Population variance |

示例：

```dos
runScript("use ta")
upper, middle, lower = ta::bBands(close, 20, 2, 2, 0)
```

### Price Transforms

| Indicator | Code | Return | Notes |
|-----------|------|--------|-------|
| AVGPRICE | `ta::avgPrice(open, high, low, close)` | vector | `(open + high + low + close) / 4` |
| MEDPRICE | `ta::medPrice(high, low)` | vector | `(high + low) / 2` |
| TYPPRICE | `ta::typPrice(high, low, close)` | vector | `(high + low + close) / 3` |
| WCLPRICE | `ta::wclPrice(high, low, close)` | vector | Weighted close price |
| BOP | `ta::bop(open, high, low, close)` | vector | Balance of Power |
| MIDPRICE | `ta::midPrice(high, low, timePeriod=14)` | vector | Rolling midpoint of high/low |
| MIDPOINT | `ta::midPoint(close, timePeriod=14)` | vector | Rolling midpoint of close |

### Volume

| Indicator | Code | Default Params | Return | Notes |
|-----------|------|----------------|--------|-------|
| AD | `ta::ad(high, low, close, volume)` | none | vector | Accumulation/Distribution Line |
| OBV | `ta::obv(close, volume)` | none | vector | On-Balance Volume |
| MFI | `ta::mfi(high, low, close, volume, timePeriod=14)` | `timePeriod=14` | vector | Money Flow Index |

### Regression and Correlation

| Indicator | Code | Default Params | Return | Notes |
|-----------|------|----------------|--------|-------|
| BETA | `ta::beta(high, low, timePeriod=5)` | `timePeriod=5` | vector | Beta |
| CORREL | `ta::correl(high, low, timePeriod=30)` | `timePeriod=30` | vector | Pearson correlation |
| LINEARREG | `ta::linearreg(close, timePeriod=14)` | `timePeriod=14` | vector | Linear regression |
| LINEARREG_SLOPE | `ta::linearreg_slope(close, timePeriod=14)` | `timePeriod=14` | vector | Regression slope |
| LINEARREG_INTERCEPT | `ta::linearreg_intercept(close, timePeriod=14)` | `timePeriod=14` | vector | Regression intercept |
| LINEARREG_ANGLE | `ta::linearreg_angle(close, timePeriod=14)` | `timePeriod=14` | vector | Regression angle |
| TSF | `ta::tsf(close, timePeriod=14)` | `timePeriod=14` | vector | Time Series Forecast |

## MyTT 风格指标速查

使用 MyTT 风格函数时加载 `mytt`：

```dos
runScript("use mytt")
dif, dea, macd = mytt::MACD(close, 12, 26, 9)
```

| Indicator | Code | Default Params | Return |
|-----------|------|----------------|--------|
| MACD | `mytt::MACD(CLOSE, SHORT_=12, LONG_=26, M=9)` | `12,26,9` | tuple |
| KDJ | `mytt::KDJ(CLOSE, HIGH, LOW, N=9, M1=3, M2=3)` | `9,3,3` | tuple |
| RSI | `mytt::RSI(CLOSE, N=24)` | `N=24` | vector |
| WR | `mytt::WR(CLOSE, HIGH, LOW, N=10, N1=6)` | `10,6` | tuple |
| BIAS | `mytt::BIAS(CLOSE, L1=6, L2=12, L3=24)` | `6,12,24` | tuple |
| BOLL | `mytt::BOLL(CLOSE, N=20, P=2)` | `20,2` | tuple |
| CCI | `mytt::CCI(CLOSE, HIGH, LOW, N=14)` | `N=14` | vector |
| ATR | `mytt::ATR(CLOSE, HIGH, LOW, N=20)` | `N=20` | vector |
| DMI | `mytt::DMI(CLOSE, HIGH, LOW, M1=14, M2=6)` | `14,6` | tuple |
| OBV | `mytt::OBV(CLOSE, VOL)` | none | vector |
| MFI | `mytt::MFI(CLOSE, HIGH, LOW, VOL, N=14)` | `N=14` | vector |

## Alpha 因子入口

### WorldQuant Alpha101

```dos
runScript("use alpha101")
value = alpha101::WQAlpha101(close, open, high, low)
```

函数名形式为 `WQAlpha<number>`，例如 `WQAlpha1`、`WQAlpha41`、`WQAlpha101`。具体参数以函数签名为准，常见输入包括 `open`, `close`, `high`, `low`, `vol`, `vwap`, `indclass`, `cap`。

### GTJA Alpha191

```dos
runScript("use alpha191")
value = alpha191::gtjaAlpha1(open, close, vol)
```

函数名形式为 `gtjaAlpha<number>`，例如 `gtjaAlpha1`、`gtjaAlpha30`、`gtjaAlpha191`。具体参数以函数签名为准，常见输入包括 `open`, `close`, `high`, `low`, `vol`, `vwap`, `index_close`, `index_open`。

## 高频与盘口函数入口

| Module | Function | Code | Notes |
|--------|----------|------|-------|
| `highFrequencyFactors` | `wavgSOIR` | `highFrequencyFactors::wavgSOIR(bidQty, askQty, lag=20)` | 加权委买委卖不平衡 |
| `highFrequencyFactors` | `rsi` | `highFrequencyFactors::rsi(close, timePeriod=5)` | 高频 RSI |
| `highFrequencyFactors` | `bBands` | `highFrequencyFactors::bBands(close, timePeriod=5, nbdevUp=2, nbdevDn=2, maType=0)` | 高频布林带 |
| `snapshot` | `timeWeightedOrderSlope` | `snapshot::timeWeightedOrderSlope(bid, bidQty, ask, askQty, lag=20)` | 时间加权盘口斜率 |
| `snapshot` | `wavgSOIR` | `snapshot::wavgSOIR(bidQty, askQty, lag=20)` | 快照委托不平衡 |
| `snapshot` | `flow` | `snapshot::flow(buy_vol, sell_vol, askPrice1, bidPrice1)` | 买卖流量 |
| `tick` | `singleOrderAveragePrice` | `tick::singleOrderAveragePrice(buyNo, sellNo, tradePrice, tradeQty, BSFlag="B")` | 单笔订单均价 |
| `tick` | `buyTradeRatio` | `tick::buyTradeRatio(buyNo, sellNo, tradeQty)` | 买成交占比 |

## 使用注意事项

1. 优先复用 cookbook 中已有函数，不要重复手写 RSI、MACD、ATR、BOLL、KDJ 等常见指标。
2. 函数参数必须与真实字段对齐，字段名来自数据源字段探查结果。
3. 多返回值函数必须显式拆包，例如 `upper, middle, lower = ta::bBands(...)`。
4. 默认周期不一定符合研报，需要根据研报公式显式传入窗口。
5. `ta::rsi` 默认周期为 14，`mytt::RSI` 默认周期为 24，两者实现与默认参数不同，不能混用。
6. `ta::bBands` 默认返回顺序为上轨、中轨、下轨。
7. Alpha101 和 Alpha191 的函数参数差异较大，调用前必须核对函数签名。
