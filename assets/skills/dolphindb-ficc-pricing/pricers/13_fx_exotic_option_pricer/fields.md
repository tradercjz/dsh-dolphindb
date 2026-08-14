# FX Exotic Option Pricers（外汇奇异期权定价）

## 定价定位

已验证 DolphinDB 3.00.5 环境中，本 skill 可稳定使用外汇数字期权和区间累计期权定价路径。Quanto 类 instrument 可以构造，但对应 pricer 存在内部类型转换限制；不要把 Quanto 路径写成已验证可用。

## 已验证函数

```dos
fxDigitalOptionPricer(instrument, pricingDate, spot, domesticCurve, foreignCurve, volSurface)
fxRangeAccrualOptionPricer(instrument, pricingDate, spot, domesticCurve, foreignCurve, volSurface)
```

## 参数表

| 参数 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `instrument` | INSTRUMENT | ★ | `FxDigitalOption` 或 `FxRangeAccrualOption`。 |
| `pricingDate` | DATE | ★ | 定价日。 |
| `spot` | DOUBLE | ★ | 即期汇率标量。 |
| `domesticCurve` | MKTDATA | ★ | 报价货币/本币贴现曲线。 |
| `foreignCurve` | MKTDATA | ★ | 基准货币/外币贴现曲线。 |
| `volSurface` | MKTDATA | ★ | `FxVolatilitySurface`。 |

## 市场数据映射

| Instrument 字段 | MarketData 要求 | 校验要点 |
|---|---|---|
| `underlying` | `volSurface.currencyPair` | 货币对一致。 |
| `domesticCurve`/`domesticCurrency` | `domesticCurve.currency` | 本币曲线一致。 |
| `foreignCurve` | `foreignCurve.currency` | 外币曲线一致。 |
| `strike` 或 barrier | `volSurface.volSmiles.strikes` | 曲面覆盖触发/行权区间附近。 |

## 输出语义

返回 DOUBLE 标量 NPV。已验证 digital/range-accrual 示例中，`direction` 不一定简单翻转 NPV 符号，解释结果时应以产品 payoff 定义为准。

## 版本限制

| 路径 | v3.00.5 状态 | 说明 |
|---|---|---|
| `fxDigitalOptionPricer` | 可用 | 数字期权已验证。 |
| `fxRangeAccrualOptionPricer` | 可用 | 区间累计期权已验证。 |
| `fxBarrierOptionPricer` | 不可用 | 已验证环境中无此函数。 |
| Quanto pricer | 不作为可用路径 | 已知内部 cast 限制，目标服务器升级后需重测。 |

## 常见错误

1. 奇异期权使用 `FxVolatilitySurface`，不要传通用 `VolatilitySurface`。
2. `direction` 字段必填，但其符号影响需结合 payoff 验证。
3. `optionType` 和 `assetType` 是两个维度，例如 `DigitalOption` + `FxDigitalOption`。
4. Range accrual 需要 `start`、`maturity`、`lowerBarrier`、`upperBarrier`。
5. 不要把 Quanto 路径标成已通过，除非在目标服务器重新跑通。

## 关联文档

- Instrument 字段：[../../instruments/13_fx_exotic_option/fields.md](../../instruments/13_fx_exotic_option/fields.md)
- FX 波动率曲面：[../../market_data/fx_vol_surface/fields.md](../../market_data/fx_vol_surface/fields.md)