# FX NDF 定价（使用 fxForwardPricer）

## 定价定位

NDF（Non-Deliverable Forward）无本金交割远期在已验证环境中复用 `fxForwardPricer`。它与可交割远期的差异主要在 instrument 字段：`forwardType="FxNonDeliverableForward"`、`direction`、`settlementCurrency`。

## 函数签名

```dos
fxForwardPricer(instrument, pricingDate, spot, domesticCurve, foreignCurve)
```

## 参数表

| 参数 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `instrument` | INSTRUMENT | ★ | `FxNonDeliverableForward` 对象。 |
| `pricingDate` | DATE | ★ | 定价日。 |
| `spot` | DOUBLE | ★ | 当前即期/定盘汇率标量。 |
| `domesticCurve` | MKTDATA | ★ | 报价货币/本币贴现曲线。 |
| `foreignCurve` | MKTDATA | ★ | 基准货币/外币贴现曲线。 |

## Instrument 关键字段

| 字段 | 要求 | 说明 |
|---|---|---|
| `productType` | `"Forward"` | NDF 不是 `"Cash"`。 |
| `forwardType` | `"FxNonDeliverableForward"` | 必须写全称。 |
| `direction` | `"Buy"` / `"Sell"` | NDF 使用 `direction`，不是 `buySell`。 |
| `settlementCurrency` | 必填 | 差额结算币种，如 `"USD"`。 |

## 输出语义

返回 DOUBLE 标量 NPV。NDF 到期不交换本金，只按约定汇率与定盘汇率差额结算并折现。

## 常见错误

1. `forwardType` 不要写成 `FxNDF`。
2. 使用 `direction`，不要沿用可交割 FX forward 的 `buySell`。
3. `settlementCurrency` 必填。
4. 专用 pricer 的 `spot` 是 DOUBLE；批量定价时可用 `FxSpotRate` 自动匹配。

## 关联文档

- Instrument 字段：[../../instruments/10_fx_ndf/fields.md](../../instruments/10_fx_ndf/fields.md)
- 外汇远期定价：[../05_fx_forward_pricer/fields.md](../05_fx_forward_pricer/fields.md)
