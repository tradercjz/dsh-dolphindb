# FxEuropeanOption（外汇欧式期权）

## 金融含义

FxEuropeanOption 是一种外汇欧式期权：持有人有权（但无义务）在到期日以约定汇率（strike）买入或卖出外汇。使用 Garman-Kohlhagen 模型（BSM 的外汇扩展版）定价。

- 常见用途：汇率风险投机/对冲、结构性理财产品嵌入期权。
- 定价函数：`fxEuropeanOptionPricer(instrument, pricingDate, spot, domesticCurve, foreignCurve, volSurf)`

## 必填字段

| 字段 | 类型 | 说明 |
|------|------|------|
| productType | STRING | 固定 `"Option"` |
| optionType | STRING | 固定 `"EuropeanOption"`（不是 `"FxEuropeanOption"`） |
| assetType | STRING | 固定 `"FxEuropeanOption"` |
| notionalCurrency | STRING | 名义本金币种（外币端），如 `"USD"` |
| notionalAmount | DOUBLE | 名义本金金额 |
| strike | DOUBLE | 行权汇率 |
| maturity | DATE | 到期日 |
| payoffType | STRING | `"Call"` 或 `"Put"`（不是 `callPut`） |
| dayCountConvention | STRING | 计息基准，如 `"Actual365"` |
| underlying | STRING | 标的货币对，如 `"USDCNY"` |
| domesticCurve | STRING | 本币曲线标签，如 `"CNY"`（不是 `domesticCurrency`） |
| foreignCurve | STRING | 外币曲线标签，如 `"USD"` |

## 枚举值速查

| 字段 | 可选值 |
|------|--------|
| payoffType | `Call`, `Put` |

## 关联的 mktData

| mktData 类型 | 结构类型 | 用途 |
|-------------|----------|------|
| — (DOUBLE 标量) | — | spot — 即期汇率 |
| [IrYieldCurve](../../market_data/ir_yield_curve/fields.md) | Curve | domesticCurve — 本币贴现曲线 |
| [IrYieldCurve](../../market_data/ir_yield_curve/fields.md) | Curve | foreignCurve — 外币贴现曲线 |
| [FxVolatilitySurface](../../market_data/fx_vol_surface/fields.md) | Surface | volSurf — 外汇波动率曲面 |

> **注意**：FX 期权使用 [FxVolatilitySurface](../../market_data/fx_vol_surface/fields.md)（不是 [VolatilitySurface](../../market_data/vol_surface/fields.md)），`spot` 仍是 DOUBLE 标量。

## 关联的 Pricer

- [`fxEuropeanOptionPricer`](../../pricers/07_fx_option_pricer/fields.md)`(instrument, pricingDate, spot, domesticCurve, foreignCurve, volSurf)` → NPV

## 常见陷阱

1. **spot 是 DOUBLE**：与 fxForwardPricer/fxSwapPricer 一致，不是 mktData。
2. **波动率曲面类型**：FX 期权用 `FxVolatilitySurface`，商品/权益期权用 `VolatilitySurface`。
3. **notional 格式**：`notionalCurrency` + `notionalAmount` 独立字段。
4. **方向字段是 `payoffType`**（不是 `callPut`）：Call = 买入外币（notionalCurrency）的权利；Put = 卖出外币的权利。
5. **类型字段拆两层**：`optionType="EuropeanOption"` + `assetType="FxEuropeanOption"`，不要把 `"FxEuropeanOption"` 写进 `optionType`。
