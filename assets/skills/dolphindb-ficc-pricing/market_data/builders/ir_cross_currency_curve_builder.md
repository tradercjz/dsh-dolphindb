# irCrossCurrencyCurveBuilder — 跨货币利率曲线构建

## 金融含义

跨货币曲线构建器的核心逻辑是：**已知本币贴现曲线 + FxSwap 掉期点 → 推算外币贴现曲线**。

外汇掉期（FxSwap）的掉期点隐含了两种货币之间的利率差异（利率平价）。给定本币侧的贴现曲线（如 CNY 曲线，由 [bondYieldCurveBuilder](bond_yield_curve_builder.md) 或 [irSingleCurrencyCurveBuilder](ir_single_currency_curve_builder.md) 构建）和即期汇率（[FxSpotRate](../fx_spot/fields.md)），通过每个期限的掉期点可以反推出外币侧在对应期限的贴现因子，进而 Bootstrap 出一条完整的外币 [IrYieldCurve](../ir_yield_curve/fields.md)。

### 输入依赖

| 输入 | 来源 | 说明 |
|------|------|------|
| discountCurve（本币曲线） | [bondYieldCurveBuilder](bond_yield_curve_builder.md) 或 [irSingleCurrencyCurveBuilder](ir_single_currency_curve_builder.md) | 已有的本币贴现曲线 |
| spot（即期汇率） | [FxSpotRate](../fx_spot/fields.md) | 货币对即期汇率 |
| quotes（掉期点） | 市场报价 | 各期限的 FxSwap 掉期点 |

### 输出用途

构建的外币 [IrYieldCurve](../ir_yield_curve/fields.md) 可用于：

- [fxForwardPricer](../../pricers/05_fx_forward_pricer/fields.md) — 外汇远期定价
- [fxSwapPricer](../../pricers/06_fx_swap_pricer/fields.md) — 外汇掉期定价
- [fxEuropeanOptionPricer](../../pricers/07_fx_option_pricer/fields.md) — 外汇期权定价

## 函数签名

```
irCrossCurrencyCurveBuilder(referenceDate, currency, instNames, instTypes, terms, quotes,
                             currencyPair, spot, dayCountConvention, discountCurve,
                             [compounding='Continuous'], [frequency='Annual'], [curveName])
```

## 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `referenceDate` | DATE | ★ | 曲线参考日期 |
| `currency` | STRING | ★ | 目标货币（如 `"USD"`） |
| `instNames` | STRING[] | ★ | 工具名称；`FxSwap` 时必须为货币对本身，如 `"USDCNY"` |
| `instTypes` | STRING[] | ★ | 仅支持 `"FxSwap"` |
| `terms` | DURATION[] | ★ | 各工具期限 |
| `quotes` | DOUBLE[] | ★ | 掉期点报价 |
| `currencyPair` | STRING | ★ | 货币对，如 `"USDCNY"`, `"EUR.USD"`, `"EUR/USD"` |
| `spot` | DOUBLE | ★ | 即期汇率 |
| `dayCountConvention` | STRING | ★ | 日期计数惯例 |
| `discountCurve` | MKTDATA | ★ | 已有的本币贴现曲线 |
| `compounding` | STRING | | 复利类型 |
| `frequency` | STRING | | 计息频率 |
| `curveName` | STRING | | 曲线名称 |

## 输出

返回 MKTDATA 类型的 IrYieldCurve 对象（外币贴现曲线）。

## 限制

- instTypes 仅支持 `"FxSwap"`（见 [06_fx_swap](../../instruments/06_fx_swap/fields.md)）
- `instNames` 不要写成 `USDCNY_1M` 这类带期限的标签；每个元素应为货币对，例如 `USDCNY`
- 支持的货币对：`"USDCNY"` / `"EURCNY"` / `"EURUSD"` 等，也可用点号或斜杠格式

## 注意事项

- 需要一条已有的另一币种贴现曲线作为输入；该曲线最好包含 `settlement`，并由 bootstrap 风格的期限节点构造
- quotes 是掉期点报价（swap points），不是利率
