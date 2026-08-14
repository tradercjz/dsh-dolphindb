# EqEuropeanOption（权益欧式期权）

## 金融含义

EqEuropeanOption 是以股票/ETF/股指为标的的欧式期权。持有人有权在到期日以约定价格（strike）买入或卖出标的。使用 BSM（Black-Scholes-Merton）模型定价，考虑股息率。

- 常见用途：股票期权、ETF 期权、股指期权（如 50ETF 期权）。
- 定价函数：`eqEuropeanOptionPricer(instrument, pricingDate, spotPrice, discountCurve, divCurve, volSurf)`

## 必填字段

| 字段 | 类型 | 说明 |
|------|------|------|
| productType | STRING | 固定 `"Option"` |
| optionType | STRING | 固定 `"EuropeanOption"` |
| assetType | STRING | 固定 `"EqEuropeanOption"` |
| instrumentId | STRING | 自定义标识 |
| notionalCurrency | STRING | 名义本金币种，如 `"CNY"` |
| notionalAmount | DOUBLE | 名义本金金额 |
| maturity | DATE | 到期日 |
| strike | DOUBLE | 行权价格 |
| payoffType | STRING | `"Call"` 或 `"Put"` |
| dayCountConvention | STRING | 日计数规则，如 `"Actual365"` |
| underlying | STRING | 标的名称，如 `"50ETF"` |

## 枚举值速查

| 字段 | 可选值 |
|------|--------|
| payoffType | `Call`, `Put` |
| dayCountConvention | `Actual365`（注意：`Actual365Fixed` 无效） |

## 关联的 mktData

| mktData 类型 | 结构类型 | 用途 |
|-------------|----------|------|
| — (DOUBLE 标量) | — | spotPrice — 标的现价 |
| [IrYieldCurve](../../market_data/ir_yield_curve/fields.md) | Curve | discountCurve — 贴现曲线 |
| [DividendCurve](../../market_data/dividend_curve/fields.md) | Curve | divCurve — 股息率曲线 |
| [VolatilitySurface](../../market_data/vol_surface/fields.md) | Surface | volSurf — 波动率曲面 |

> **注意**：权益期权需要 [DividendCurve](../../market_data/dividend_curve/fields.md)（股息率曲线，含 `compounding`/`interpMethod`/`extrapMethod` 字段）和通用 [VolatilitySurface](../../market_data/vol_surface/fields.md)（需使用 `smileMethod` + `termDates` + `volSmiles` 格式）。

## 关联的 Pricer

- [`eqEuropeanOptionPricer`](../../pricers/11_eq_european_option_pricer/fields.md)`(instrument, pricingDate, spotPrice, discountCurve, divCurve, volSurf)` → NPV

## 常见陷阱

1. **optionType 是 `"EuropeanOption"`**：不是 `"EqEuropeanOption"`。`assetType` 才是 `"EqEuropeanOption"`。
2. **payoffType 不是 callPut**：使用 `payoffType` 字段（`"Call"` / `"Put"`）。
3. **underlying 必填**：标的名称（如 `"50ETF"`），否则 parseInstrument 会报错。
4. **dayCountConvention 必填**：使用 `"Actual365"`。注意 `"Actual365Fixed"` 是无效枚举值。
5. **DividendCurve 必须提供**：即使无股息也需传入（dividend 值可设为 0）。DividendCurve 需要 `compounding`、`interpMethod`、`extrapMethod` 字段。
6. **VolatilitySurface 格式**：必须使用 `smileMethod` + `termDates` + `volSmiles` 格式。
7. **spotPrice 是 DOUBLE**：标的现价作为标量传入。
8. **notionalAmount**：影响 NPV 的缩放（NPV = 单位期权价格 × notionalAmount）。Greeks 也按 notionalAmount 缩放（dollar-sensitivity）。
