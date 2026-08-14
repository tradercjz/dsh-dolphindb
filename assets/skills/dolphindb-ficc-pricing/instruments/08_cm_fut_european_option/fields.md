# CmFutEuropeanOption（商品期货欧式期权）

## 金融含义

CmFutEuropeanOption 是以商品期货合约为标的的欧式期权。持有人有权在到期日以约定价格（strike）买入或卖出期货合约。使用 Black-76 模型定价（因标的为期货，不支付持有成本）。

- 常见用途：商品价格风险对冲、期货波动率交易。
- 定价函数：`cmFutEuropeanOptionPricer(instrument, pricingDate, futPrice, discountCurve, volSurf)`

## 必填字段

| 字段 | 类型 | 说明 |
|------|------|------|
| productType | STRING | 固定 `"Option"` |
| optionType | STRING | 固定 `"EuropeanOption"`（不是 `"CmFutEuropeanOption"`） |
| assetType | STRING | 固定 `"CmFutEuropeanOption"` |
| instrumentId | STRING | 合约代码，如 `"M2509C3200"` |
| notionalAmount | DOUBLE | 合约乘数（每手对应的标的数量），如 `10` |
| notionalCurrency | STRING | 名义本金币种，如 `"CNY"` |
| strike | DOUBLE | 行权价格 |
| maturity | DATE | 到期日 |
| payoffType | STRING | `"Call"` 或 `"Put"`（不是 `callPut`） |
| dayCountConvention | STRING | 计息基准，如 `"Actual365"` |
| underlying | STRING | 标的期货合约，如 `"M2509"` |

## 枚举值速查

| 字段 | 可选值 |
|------|--------|
| payoffType | `Call`, `Put` |

## 关联的 mktData

| mktData 类型 | 结构类型 | 用途 |
|-------------|----------|------|
| — (DOUBLE 标量) | — | futPrice — 期货当前价格 |
| [IrYieldCurve](../../market_data/ir_yield_curve/fields.md) | Curve | discountCurve — 贴现曲线 |
| [VolatilitySurface](../../market_data/vol_surface/fields.md) | Surface | volSurf — 波动率曲面 |

> **注意**：商品期货期权使用通用的 [VolatilitySurface](../../market_data/vol_surface/fields.md)（不是 [FxVolatilitySurface](../../market_data/fx_vol_surface/fields.md)），`futPrice` 是 DOUBLE 标量。波动率曲面可通过 [cmFutVolatilitySurfaceBuilder](../../market_data/builders/cm_fut_vol_surface_builder.md) 构建。

## 关联的 Pricer

- [`cmFutEuropeanOptionPricer`](../../pricers/08_cm_fut_european_option_pricer/fields.md)`(instrument, pricingDate, futPrice, discountCurve, volSurf)` → NPV
- v3.00.5 版本采用 5 参数签名（不含 futPriceCurve）

## 常见陷阱

1. **参数个数**：v3.00.5 为 5 参数（instrument, pricingDate, futPrice, discountCurve, volSurf），没有 futPriceCurve 参数。
2. **波动率曲面类型**：使用通用 `VolatilitySurface`（surfaceType 字段），不是 FxVolatilitySurface。
3. **futPrice 是 DOUBLE**：期货当前价格作为标量传入。
4. **合约乘数放在 `notionalAmount`**：没有单独的 `lotSize` 字段；最终 NPV = 每手期权价值 × `notionalAmount`。
5. **类型字段拆两层**：`optionType="EuropeanOption"` + `assetType="CmFutEuropeanOption"`；方向用 `payoffType` 不是 `callPut`。
