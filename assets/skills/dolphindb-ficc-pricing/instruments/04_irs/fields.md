# IrFixedFloatingSwap（固定-浮动利率互换）

## 金融含义

IrFixedFloatingSwap（Interest Rate Swap）是最常见的利率衍生品：一方支付固定利率，另一方支付浮动利率（挂钩 FR007/SHIBOR 等基准利率）。

- 常见用途：利率风险对冲、资产负债管理、利率套利。
- 定价函数：`irFixedFloatingSwapPricer(instrument, pricingDate, discountCurve, forwardCurve, assetPriceCurve)`

## 必填字段

字段为**扁平结构**，不使用 `fixedLeg` / `floatingLeg` 嵌套子 dict。固息端和浮息端要素都直接放在顶层 dict 中。

| 字段 | 类型 | 说明 |
|------|------|------|
| productType | STRING | 固定 `"Swap"` |
| swapType | STRING | 固定 `"IrSwap"`（不是 `"IrFixedFloatingSwap"`） |
| irSwapType | STRING | 固定 `"IrFixedFloatingSwap"` |
| start | DATE | **起息日（必须为工作日，CFET 日历）** |
| maturity | DATE | 到期日 |
| frequency | STRING | 付息频率，如 `"Quarterly"`（固息/浮息共用） |
| fixedRate | DOUBLE | 固定端利率，如 `0.018` 表示 1.8% |
| calendar | STRING | 日历，如 `"CFET"` |
| fixedDayCountConvention | STRING | 固定端计息基准，如 `"Actual365"` |
| floatingDayCountConvention | STRING | 浮动端计息基准，如 `"Actual365"` |
| payReceive | STRING | `"Pay"`（付固定收浮动）或 `"Receive"`（收固定付浮动） |
| iborIndex | STRING | 浮动端挂钩指数，如 `"FR_007"`（不是 `floatingLeg.index`） |
| spread | DOUBLE | 浮动端加点，如 `0.0` |
| notionalCurrency | STRING | 名义本金币种，如 `"CNY"` |
| notionalAmount | DOUBLE | 名义本金金额，如 `10000000` |

## 枚举值速查

| 字段 | 可选值 |
|------|--------|
| frequency | `Daily`, `Weekly`, `Monthly`, `Quarterly`, `Semiannual`, `Annual` |
| fixedDayCountConvention / floatingDayCountConvention | `Actual360`, `Actual365`, `ActualActualISDA`, `Thirty360` |
| payReceive | `Pay`, `Receive` |
| iborIndex | `FR_007`, `SHIBOR_3M`, `LPR_1Y`, `LPR_5Y` 等 |

## 关联的 mktData

| mktData 类型 | 结构类型 | 用途 |
|-------------|----------|------|
| [IrYieldCurve](../../market_data/ir_yield_curve/fields.md) | Curve | discountCurve — 贴现曲线 |
| [IrYieldCurve](../../market_data/ir_yield_curve/fields.md) | Curve | forwardCurve — 预测浮动端利率的远期曲线 |
| [AssetPriceCurve](../../market_data/asset_price_curve/fields.md) | Curve | assetPriceCurve — 资产价格曲线（浮动端当期 fixing） |

> **远期曲线选择**：当 instrument 的 `forwardCurve` 字段为空（未显式指定远期曲线）时，优先用与浮动指数同族的专用 `*_FWD` 曲线（如 `FR_007` → `CNY_FR_007_FWD`）；若库中无此曲线，则用单曲线法令 `forwardCurve = discountCurve`。详见 [pricer 文档「forward 曲线选择规则」](../../pricers/04_irs_pricer/fields.md#forward-曲线选择规则instrumentforwardcurve-未指定时)。

## 关联的 Pricer

- [`irFixedFloatingSwapPricer`](../../pricers/04_irs_pricer/fields.md)`(instrument, pricingDate, discountCurve, forwardCurve, assetPriceCurve)` → 返回 IRS 的 NPV

## 常见陷阱

1. **start 必须为工作日**：如果 start 不在 CFET 日历的工作日上，pricer 会报错 `start date must be a business day`。建议选择周一到周五的非节假日。
2. **notional 格式**：使用 `notionalCurrency` + `notionalAmount` 两个独立字段（v3.00.5 行为）。
3. **三条曲线**：IRS 定价需要贴现曲线、远期曲线、资产价格曲线三条，不能少。
4. **浮动端指数字段名是 `iborIndex`**：不是 `floatingLeg.index`。用 `instrumentPricer` 自动匹配时，`iborIndex` 要与 `AssetPriceCurve` 的 `asset` 字段一致；专用 `irFixedFloatingSwapPricer` 按位置取曲线，不校验该字段。
5. **dayCountConvention**：拆成 `fixedDayCountConvention` 和 `floatingDayCountConvention` 两个字段；DolphinDB 3.00.5 验证环境使用 `Actual365`，不要写 `Actual365Fixed`。
