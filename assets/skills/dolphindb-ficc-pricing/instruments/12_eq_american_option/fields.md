# EqAmericanOption（权益美式期权）

## 金融含义

EqAmericanOption 是以股票/ETF/股指为标的的美式期权。持有人可在到期日之前的任意时刻行权。使用 BAW（Barone-Adesi-Whaley）近似解析模型定价。

- 常见用途：美式权益期权（如部分交易所上市的个股期权）。
- 定价函数：`eqAmericanOptionPricer(instrument, pricingDate, spotPrice, discountCurve, divCurve, volSurf)`

## 必填字段

| 字段 | 类型 | 说明 |
|------|------|------|
| productType | STRING | 固定 `"Option"` |
| optionType | STRING | 固定 `"AmericanOption"` |
| assetType | STRING | 固定 `"EqAmericanOption"` |
| instrumentId | STRING | 自定义标识 |
| notionalCurrency | STRING | 名义本金币种 |
| notionalAmount | DOUBLE | 名义本金金额 |
| maturity | DATE | 到期日 |
| strike | DOUBLE | 行权价格 |
| payoffType | STRING | `"Call"` 或 `"Put"` |
| dayCountConvention | STRING | 日计数规则，如 `"Actual365"` |
| underlying | STRING | 标的名称 |

## 关联的 mktData

| mktData 类型 | 结构类型 | 用途 |
|-------------|----------|------|
| — (DOUBLE 标量) | — | spotPrice — 标的现价 |
| [IrYieldCurve](../../market_data/ir_yield_curve/fields.md) | Curve | discountCurve — 贴现曲线 |
| [DividendCurve](../../market_data/dividend_curve/fields.md) | Curve | divCurve — 股息率曲线 |
| [VolatilitySurface](../../market_data/vol_surface/fields.md) | Surface | volSurf — 波动率曲面 |

## 关联的 Pricer

- [`eqAmericanOptionPricer`](../../pricers/12_eq_american_option_pricer/fields.md)`(instrument, pricingDate, spotPrice, discountCurve, divCurve, volSurf)` → NPV
- BAW 模型 = BSM 价格 + 提前行权溢价

## 常见陷阱

1. **optionType 是 `"AmericanOption"`**：不是 `"EqAmericanOption"`。`assetType` 才是 `"EqAmericanOption"`。
2. **payoffType 不是 callPut**：使用 `payoffType` 字段（`"Call"` / `"Put"`）。
3. **underlying 和 dayCountConvention 必填**：与欧式一致，`dayCountConvention` 使用 `"Actual365"`。
4. **与欧式的区别**：只有 `optionType` 和 `assetType` 不同。美式 NPV ≥ 欧式 NPV。
5. **DividendCurve 必须提供**：与欧式一致，需要 `compounding`/`interpMethod`/`extrapMethod` 字段。
6. **VolatilitySurface 格式**：必须使用 `smileMethod` + `termDates` + `volSmiles` 格式。
7. **spotPrice 是 DOUBLE**：标的现价作为标量传入。
