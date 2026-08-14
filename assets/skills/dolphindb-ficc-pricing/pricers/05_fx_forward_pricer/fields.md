# fxForwardPricer（外汇远期定价）

## 定价定位

`fxForwardPricer` 定价可交割外汇远期：比较合约远期汇率与由即期汇率、两币种贴现曲线隐含出的市场远期汇率，并将差额折现为 NPV。

## 函数签名

```dos
fxForwardPricer(instrument, pricingDate, spot, domesticCurve, foreignCurve)
```

## 参数表

| 参数 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `instrument` | INSTRUMENT | ★ | `FxForward` 对象。 |
| `pricingDate` | DATE | ★ | 定价日。 |
| `spot` | DOUBLE | ★ | 即期汇率标量，例如 `7.2659`。专用 pricer 不接收 `FxSpotRate` 对象。 |
| `domesticCurve` | MKTDATA | ★ | 报价货币/本币贴现曲线。`USDCNY` 中 CNY 为 domestic。 |
| `foreignCurve` | MKTDATA | ★ | 基准货币/外币贴现曲线。`USDCNY` 中 USD 为 foreign。 |

## 市场数据映射

instrument 用 `domesticCurve` / `foreignCurve` 曲线标签字段（不是 `domesticCurrency`），日期字段是 `expiry` / `delivery`（不是 `maturity`）。

| Instrument 字段 | MarketData 要求 | 校验要点 |
|---|---|---|
| `domesticCurve` | `domesticCurve.currency` | 本币贴现曲线一致。 |
| `notionalCurrency` | `foreignCurve.currency` | 外币贴现曲线一致。 |
| `strike` | 无需市场数据 | 合同远期汇率。 |
| `expiry` / `delivery` | 两条曲线期限覆盖 | 曲线覆盖到期/交割日。 |

## 输出语义

返回 DOUBLE 标量 NPV。**NPV 已按 instrument 的 `direction`（`"Buy"` / `"Sell"`）带好符号，无需人工取反**：Buy（买入 notional 货币）与 Sell（卖出）互为相反数，二者之和为 0。

> 例如约定远期价 `strike` 高于市场隐含远期时，Buy 方 NPV 为负、Sell 方为正。NDF（同用 `fxForwardPricer`，见 pricers/10）符号约定相同。**FX 期权则不同**——返回的是非负权利金，不带 Buy/Sell 符号（见 pricers/07_fx_option_pricer/fields.md）。

## 常见错误

1. 专用 pricer 的 `spot` 是 DOUBLE；只有 `instrumentPricer` 才用 `FxSpotRate` MKTDATA 自动匹配。
2. `currencyPair=USDCNY` 语义下，USD 是 foreign/base，CNY 是 domestic/quote。
3. `strike` 是合约远期汇率，`spot` 是当前即期汇率。
4. 曲线传反会导致 NPV 方向和大小错误。

## 关联文档

- Instrument 字段：[../../instruments/05_fx_forward/fields.md](../../instruments/05_fx_forward/fields.md)
- FX 即期：[../../market_data/fx_spot/fields.md](../../market_data/fx_spot/fields.md)
- 利率曲线：[../../market_data/ir_yield_curve/fields.md](../../market_data/ir_yield_curve/fields.md)
