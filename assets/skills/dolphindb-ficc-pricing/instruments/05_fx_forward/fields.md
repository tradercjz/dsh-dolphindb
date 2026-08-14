# FxForward（外汇远期）

## 金融含义

FxForward 是一种场外（OTC）外汇衍生品合约：双方约定在未来某个日期，按约定的远期汇率交换两种货币。

- 常见用途：汇率风险对冲（进出口企业锁汇）、跨境投资对冲。
- 定价函数：`fxForwardPricer(instrument, pricingDate, spot, domesticCurve, foreignCurve)`

## 必填字段

| 字段 | 类型 | 说明 |
|------|------|------|
| productType | STRING | 固定 `"Forward"`（不是 `"Cash"`；也没有 `assetType` 字段） |
| forwardType | STRING | 固定 `"FxForward"` |
| expiry | DATE | 到期日 |
| delivery | DATE | 交割日（通常 T+2） |
| currencyPair | STRING | 货币对，如 `"USDCNY"` |
| direction | STRING | 方向 `"Buy"` / `"Sell"`（不是 `buySell`） |
| notionalCurrency | STRING | 名义本金币种（外币端），如 `"USD"` |
| notionalAmount | DOUBLE | 名义本金金额，如 `1000000` |
| strike | DOUBLE | 远期汇率（约定价格），如 `7.3` |
| domesticCurve | STRING | 本币曲线标签，如 `"CNY"`（不是 `domesticCurrency`） |
| foreignCurve | STRING | 外币曲线标签，如 `"USD"` |

## 枚举值速查

| 字段 | 可选值 |
|------|--------|
| direction | `Buy`, `Sell` |

## 关联的 mktData

| mktData 类型 | 结构类型 | 用途 |
|-------------|----------|------|
| — (DOUBLE 标量) | — | spot — 即期汇率（如 7.2659） |
| [IrYieldCurve](../../market_data/ir_yield_curve/fields.md) | Curve | domesticCurve — 本币贴现曲线 |
| [IrYieldCurve](../../market_data/ir_yield_curve/fields.md) | Curve | foreignCurve — 外币贴现曲线 |

> **注意**：`spot` 在 `fxForwardPricer` 中是 DOUBLE 标量，不是 parseMktData 对象。如果使用 [instrumentPricer](../../pricers/instrument_pricer.md)，则需要构造 [FxSpotRate](../../market_data/fx_spot/fields.md) 类型的 mktData。

## 关联的 Pricer

- [`fxForwardPricer`](../../pricers/05_fx_forward_pricer/fields.md)`(instrument, pricingDate, spot, domesticCurve, foreignCurve)` → NPV

## 常见陷阱

1. **spot 是 DOUBLE**：`fxForwardPricer` 的 `spot` 参数是纯数值标量（如 `7.2659`），不是 parseMktData 对象。传入 mktData 会报错：`spot should be a numeric scalar or vector`。
2. **notional 格式**：使用 `notionalCurrency` + `notionalAmount` 两个独立字段。
3. **strike vs spot**：strike 是约定的远期汇率，spot 是当前市场即期汇率。NPV = 远期与市场隐含远期的差值折现。
4. **曲线标签字段名是 `domesticCurve` / `foreignCurve`**（不是 `domesticCurrency`）：curveName 应与币种对应（如 CNY 曲线用于 domestic，USD 曲线用于 foreign）。
5. **方向字段是 `direction`**（`"Buy"` / `"Sell"`），不是 `buySell`。
