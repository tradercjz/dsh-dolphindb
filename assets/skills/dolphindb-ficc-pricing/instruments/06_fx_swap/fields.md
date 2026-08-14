# FxSwap（外汇掉期）

## 金融含义

FxSwap 由两笔方向相反的外汇交易组成：近端按即期汇率交换两种货币，远端按约定的远期汇率反向交换。本质是近端借入一种货币、远端归还，用另一种货币做抵押。

- 常见用途：短期外币融资、流动性管理、展期（rollover）头寸。
- 定价函数：`fxSwapPricer(instrument, pricingDate, spot, domesticCurve, foreignCurve)`

## 必填字段

字段为**扁平结构**，不使用 `nearLeg` / `farLeg` 嵌套子 dict。近端和远端的执行价、到期日、交割日都用带 `near` / `far` 前缀的顶层字段。方向由单个 `direction` 字段决定（近端为该方向、远端自动相反）。

| 字段 | 类型 | 说明 |
|------|------|------|
| productType | STRING | 固定 `"Swap"` |
| swapType | STRING | 固定 `"FxSwap"` |
| currencyPair | STRING | 货币对，如 `"USDCNY"` |
| direction | STRING | `"Buy"` / `"Sell"`（近端方向；远端相反），不是 `buySell` |
| notionalCurrency | STRING | 名义本金币种（外币端），如 `"USD"` |
| notionalAmount | DOUBLE | 名义本金金额 |
| nearStrike | DOUBLE | 近端执行汇率（通常接近即期） |
| nearExpiry | DATE | 近端到期日 |
| nearDelivery | DATE | 近端交割日 |
| farStrike | DOUBLE | 远端执行汇率（远期汇率） |
| farExpiry | DATE | 远端到期日 |
| farDelivery | DATE | 远端交割日 |
| domesticCurve | STRING | 本币曲线标签，如 `"CNY"`（不是 `domesticCurrency`） |
| foreignCurve | STRING | 外币曲线标签，如 `"USD"` |

## 关联的 mktData

| mktData 类型 | 结构类型 | 用途 |
|-------------|----------|------|
| — (DOUBLE 标量) | — | spot — 即期汇率 |
| [IrYieldCurve](../../market_data/ir_yield_curve/fields.md) | Curve | domesticCurve — 本币贴现曲线 |
| [IrYieldCurve](../../market_data/ir_yield_curve/fields.md) | Curve | foreignCurve — 外币贴现曲线 |

> **注意**：与 [fxForwardPricer](../../pricers/05_fx_forward_pricer/fields.md) 相同，`spot` 是 DOUBLE 标量。使用 [instrumentPricer](../../pricers/instrument_pricer.md) 时需构造 [FxSpotRate](../../market_data/fx_spot/fields.md)。

## 关联的 Pricer

- [`fxSwapPricer`](../../pricers/06_fx_swap_pricer/fields.md)`(instrument, pricingDate, spot, domesticCurve, foreignCurve)` → NPV

## 常见陷阱

1. **方向由单个 `direction` 字段给出**：`direction="Buy"` 表示近端买入外币、远端自动卖出（相反）；不需要分别给 near/far 方向。
2. **spot 是 DOUBLE**：与 fxForwardPricer 一致，是纯数值标量。
3. **notional 格式**：使用 `notionalCurrency` + `notionalAmount` 两个独立字段。
4. **NPV 含义**：NPV 是两条腿（near + far）合计折现值。
