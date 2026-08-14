# FxNDF（外汇无本金交割远期）

## 金融含义

FxNDF（Non-Deliverable Forward）是一种外汇远期合约，到期时不进行本金实际交割，而是根据到期日的即期汇率与约定汇率之差进行差额结算（以可兑换货币支付）。

- 常见用途：对冲不可自由兑换货币（如 CNY 在离岸市场）的汇率风险。
- 结构与 FxForward 类似，但 `forwardType` 为 `"FxNonDeliverableForward"`。

## 必填字段

| 字段 | 类型 | 说明 |
|------|------|------|
| productType | STRING | 固定 `"Forward"` |
| forwardType | STRING | 固定 `"FxNonDeliverableForward"` |
| expiry | DATE | 到期日（不是 `maturity`） |
| delivery | DATE | 交割日（通常 T+2） |
| currencyPair | STRING | 货币对，如 `"USDCNY"` |
| direction | STRING | `"Buy"` 或 `"Sell"`（不是 `buySell`） |
| notionalCurrency | STRING | 名义本金币种（外币端），如 `"USD"` |
| notionalAmount | DOUBLE | 名义本金金额 |
| strike | DOUBLE | 约定汇率 |
| settlementCurrency | STRING | 结算币种（可兑换货币），如 `"USD"` |
| domesticCurve | STRING | 本币曲线名称，如 `"CNY"` |
| foreignCurve | STRING | 外币曲线名称，如 `"USD"` |

## 关联的 mktData

与 [FxForward](../05_fx_forward/fields.md) 相同：
| mktData 类型 | 结构类型 | 用途 |
|-------------|----------|------|
| — (DOUBLE 标量) | — | spot — 即期汇率 |
| [IrYieldCurve](../../market_data/ir_yield_curve/fields.md) | Curve | domesticCurve — 本币贴现曲线 |
| [IrYieldCurve](../../market_data/ir_yield_curve/fields.md) | Curve | foreignCurve — 外币贴现曲线 |

## 关联的 Pricer

- 可使用 [`fxForwardPricer`](../../pricers/05_fx_forward_pricer/fields.md)`(instrument, pricingDate, spot, domesticCurve, foreignCurve)`（另见 [NDF Pricer](../../pricers/10_fx_ndf_pricer/fields.md)）
- `parseInstrument` 验证通过（v3.00.5），pricer 行为与 FxForward 类似

## 常见陷阱

1. **productType 是 `"Forward"`**：不是 `"Cash"` 也不是 `"Fx"`。
2. **日期字段是 `expiry` + `delivery`**：不是 `maturity`，与 FxForward 一致。
3. **direction 不是 buySell**：使用 `direction` 字段（`"Buy"` / `"Sell"`），与 FxForward 一致。
4. **settlementCurrency 必填**：NDF 特有字段，指定差额结算使用的可兑换货币。
5. **forwardType 值**：必须写 `"FxNonDeliverableForward"`（全称），不是 `"FxNDF"`。
6. **无本金交割**：到期只结算差额，NPV 计算方式为差额的折现值。
7. **与 FxForward 定价结果一致**：在相同参数下，NDF 和 FxForward 的 NPV 相同。
