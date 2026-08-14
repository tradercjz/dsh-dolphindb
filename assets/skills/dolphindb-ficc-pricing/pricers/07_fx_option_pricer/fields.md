# fxEuropeanOptionPricer（外汇欧式期权定价）

## 定价定位

`fxEuropeanOptionPricer` 使用外汇期权模型对欧式外汇期权定价。核心输入是即期汇率、两币种贴现曲线和 `FxVolatilitySurface`。

## 函数签名

```dos
fxEuropeanOptionPricer(instrument, pricingDate, spot, domesticCurve, foreignCurve, volSurface, [setting])
```

## 参数表

| 参数 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `instrument` | INSTRUMENT | ★ | `FxEuropeanOption` 对象。 |
| `pricingDate` | DATE | ★ | 定价日。 |
| `spot` | DOUBLE | ★ | 即期汇率标量。 |
| `domesticCurve` | MKTDATA | ★ | 报价货币/本币贴现曲线。 |
| `foreignCurve` | MKTDATA | ★ | 基准货币/外币贴现曲线。 |
| `volSurface` | MKTDATA | ★ | `FxVolatilitySurface`，不是通用 `VolatilitySurface`。 |
| `setting` | DICT |  | Greeks 或风险输出开关。 |

## 市场数据映射

| Instrument 字段 | MarketData 要求 | 校验要点 |
|---|---|---|
| `domesticCurve` | `domesticCurve.currency` | 本币曲线一致（字段名是 `domesticCurve`，不是 `domesticCurrency`）。 |
| `notionalCurrency` | `foreignCurve.currency` | 外币曲线一致。 |
| `underlying` 或货币对 | `volSurface.currencyPair` | 货币对一致，如 `USDCNY`。 |
| `maturity`/`strike` | `volSurface.termDates`/`volSmiles` | 曲面覆盖期权期限与行权价附近。 |

## 输出语义

- 不传 `setting`：返回 DOUBLE 标量 NPV。
- 传入受支持的 `setting`：返回包含 NPV 和 Greeks 的 dict。

### NPV 符号与方向（Buy/Sell + Call/Put）

返回的 NPV 是**期权权利金（premium）口径，恒为非负值，且不随 `direction`（Buy/Sell）反号**。即 pricer 给出的是从持有人视角的期权价值；卖方（Sell）的盈亏需由调用方自行取负（写方收权利金、NPV 取相反数）。

- `payoffType`（Call/Put）会改变权利金大小（不同行权方向的内在/时间价值不同）。
- `direction`（Buy/Sell）**不改变**返回值的符号——同一 Call、Buy 与 Sell 返回相同的正权利金。

> 同一 Call 合约，Buy 与 Sell 返回相同的正权利金（符号不变）；Put 与 Call 的权利金大小取决于行权方向与在值程度（深度实值一侧更大）。
>
> 对比 FxForward/FxSwap/NDF：那些产品的 NPV **会**带 `direction` 符号（Buy/Sell 互为相反数，见 pricers/05_fx_forward_pricer/fields.md）。FX 期权与之不同——返回的是权利金，不带 Buy/Sell 符号。

## 常见错误

1. 外汇期权使用 `FxVolatilitySurface`，商品和权益期权才使用通用 `VolatilitySurface`。
2. 专用 pricer 的 `spot` 是 DOUBLE；批量 `instrumentPricer` 可匹配 `FxSpotRate`。
3. `Call`/`Put` 方向要结合 `notionalCurrency` 解释。
4. 波动率曲面必须使用 `smileMethod`、`termDates`、`volSmiles` 格式。

## 关联文档

- Instrument 字段：[../../instruments/07_fx_option/fields.md](../../instruments/07_fx_option/fields.md)
- FX 波动率曲面：[../../market_data/fx_vol_surface/fields.md](../../market_data/fx_vol_surface/fields.md)