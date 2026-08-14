# eqEuropeanOptionPricer（权益欧式期权定价）

## 定价定位

`eqEuropeanOptionPricer` 用标的现价、贴现曲线、股息率曲线和通用波动率曲面对权益欧式期权定价。适用于股票、ETF、股指等欧式行权合约。

## 函数签名

```dos
eqEuropeanOptionPricer(instrument, pricingDate, spotPx, discountCurve, dividendYieldCurve, volSurface, [setting])
```

## 参数表

| 参数 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `instrument` | INSTRUMENT | ★ | `EqEuropeanOption` 对象。 |
| `pricingDate` | DATE | ★ | 定价日。 |
| `spotPx` | DOUBLE | ★ | 标的现价。 |
| `discountCurve` | MKTDATA | ★ | 无风险/贴现 `IrYieldCurve`。 |
| `dividendYieldCurve` | MKTDATA | ★ | `DividendCurve`，无股息假设也要传 0 曲线。 |
| `volSurface` | MKTDATA | ★ | 通用 `VolatilitySurface`。 |
| `setting` | DICT |  | Greeks 或风险输出开关。 |

## 市场数据映射

| Instrument 字段 | MarketData 要求 | 校验要点 |
|---|---|---|
| `notionalCurrency` | `discountCurve.currency` | 币种一致。 |
| `underlying` | `DividendCurve.curveName`/`VolatilitySurface.surfaceName` | 标的名称或曲线名应能对应。 |
| `strike` | `volSurface.volSmiles.strikes` | 曲面覆盖行权价。 |
| `maturity` | `dividendYieldCurve.dates`、`volSurface.termDates` | 股息和波动率期限覆盖到期日。 |

## 输出语义

- 不传 `setting`：返回 DOUBLE 标量 NPV。
- 传入受支持的 `setting`：返回包含 NPV 和 Greeks 的 dict。

已验证示例中 NPV 和 Greeks 会按 `notionalAmount` 缩放，解释 Greeks 时要说明是合约级还是单位标的级。

## 常见错误

1. `optionType` 是 `"EuropeanOption"`，`assetType` 才是 `"EqEuropeanOption"`。
2. 使用 `payoffType`，不是 `callPut`。
3. `DividendCurve` 必须提供 `compounding`、`interpMethod`、`extrapMethod`。
4. `Actual365Fixed` 不可用，使用 `Actual365`。
5. 权益和商品使用通用 `VolatilitySurface`，不是 `FxVolatilitySurface`。

## 关联文档

- Instrument 字段：[../../instruments/11_eq_european_option/fields.md](../../instruments/11_eq_european_option/fields.md)
- 股息曲线：[../../market_data/dividend_curve/fields.md](../../market_data/dividend_curve/fields.md)
- 通用波动率曲面：[../../market_data/vol_surface/fields.md](../../market_data/vol_surface/fields.md)
