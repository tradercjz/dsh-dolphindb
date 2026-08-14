# CmFutAmericanOption（商品期货美式期权）

## 金融含义

CmFutAmericanOption 是以商品期货合约为标的的美式期权。持有人可在到期日之前的任意时刻行权。使用 Barone-Adesi-Whaley (BAW) 近似解析模型定价，该模型基于 Black-76 并附加提前行权溢价。

- 常见用途：商品期货期权交易（如国内期货交易所上市的商品期权大多为美式）。
- 定价函数：`cmFutAmericanOptionPricer(instrument, pricingDate, futPrice, discountCurve, volSurf)`

## 必填字段

| 字段 | 类型 | 说明 |
|------|------|------|
| productType | STRING | 固定 `"Option"` |
| optionType | STRING | 固定 `"AmericanOption"`（不是 `"CmFutAmericanOption"`） |
| assetType | STRING | 固定 `"CmFutAmericanOption"` |
| instrumentId | STRING | 合约代码，如 `"SR509C6000"` |
| notionalAmount | DOUBLE | 合约乘数（每手对应的标的数量），如 `10` |
| notionalCurrency | STRING | 名义本金币种 |
| strike | DOUBLE | 行权价格 |
| maturity | DATE | 到期日 |
| payoffType | STRING | `"Call"` 或 `"Put"`（不是 `callPut`） |
| dayCountConvention | STRING | 计息基准，如 `"Actual365"` |
| underlying | STRING | 标的期货合约，如 `"SR509"` |

## 关联的 mktData

| mktData 类型 | 结构类型 | 用途 |
|-------------|----------|------|
| — (DOUBLE 标量) | — | futPrice — 期货当前价格 |
| [IrYieldCurve](../../market_data/ir_yield_curve/fields.md) | Curve | discountCurve — 贴现曲线 |
| [VolatilitySurface](../../market_data/vol_surface/fields.md) | Surface | volSurf — 波动率曲面 |

> 波动率曲面可通过 [cmFutVolatilitySurfaceBuilder](../../market_data/builders/cm_fut_vol_surface_builder.md) 构建。

## 关联的 Pricer

- [`cmFutAmericanOptionPricer`](../../pricers/09_cm_fut_american_option_pricer/fields.md)`(instrument, pricingDate, futPrice, discountCurve, volSurf)` → NPV
- BAW 模型 = Black-76 价格 + 提前行权溢价

## 常见陷阱

1. **与欧式的区别**：字段结构相同，只是 `optionType="AmericanOption"`、`assetType="CmFutAmericanOption"`。美式 NPV ≥ 欧式 NPV（提前行权溢价 ≥ 0）。
2. **波动率曲面**：同样使用通用 `VolatilitySurface`。
3. **futPrice 是 DOUBLE**：与欧式一致。
4. **方向用 `payoffType`**（不是 `callPut`）；合约乘数放在 `notionalAmount`，没有单独的 `lotSize` 字段。
