# cmFutEuropeanOptionPricer（商品期货欧式期权定价）

## 定价定位

`cmFutEuropeanOptionPricer` 用期货价格、贴现曲线和通用波动率曲面对商品期货欧式期权定价。已验证 DolphinDB 3.00.5 行为中，专用 pricer 的标的期货价格参数是 DOUBLE 标量 `futPrice`，不是 `AssetPriceCurve`。

## 函数签名

```dos
cmFutEuropeanOptionPricer(instrument, pricingDate, futPrice, discountCurve, volSurf, [setting], [model], [method])
```

## 参数表

| 参数 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `instrument` | INSTRUMENT | ★ | `CmFutEuropeanOption` 对象。 |
| `pricingDate` | DATE | ★ | 定价日。 |
| `futPrice` | DOUBLE | ★ | 标的期货当前价格标量。 |
| `discountCurve` | MKTDATA | ★ | 贴现 `IrYieldCurve`。 |
| `volSurf` | MKTDATA | ★ | 通用 `VolatilitySurface`。 |
| `setting` | DICT |  | Greeks 或风险输出开关，使用 `dict(STRING, ANY)`。 |
| `model` | STRING |  | 常见为 `Black76`。 |
| `method` | STRING |  | 解析或数值方法，按目标服务器支持情况使用。 |

## 市场数据映射

| Instrument 字段 | MarketData 要求 | 校验要点 |
|---|---|---|
| `notionalCurrency` | `discountCurve.currency` | 贴现币种一致。 |
| `strike` | `volSurf.volSmiles.strikes` | 曲面覆盖行权价附近。 |
| `maturity` | `volSurf.termDates` | 曲面覆盖期权到期日。 |
| `lotSize` | 无市场数据 | NPV 缩放由合约乘数影响。 |

## 输出语义

- 不传 `setting`：返回 DOUBLE 标量 NPV。
- 传入受支持的 `setting`：返回包含 NPV 和 Greeks 的 dict。

## 常见错误

1. 专用 pricer 用 `futPrice` 标量；曲面 builder 才使用 `AssetPriceCurve`。
2. 使用通用 `VolatilitySurface`，不要传 `FxVolatilitySurface`。
3. 期货价格、行权价、合约乘数单位必须一致。
4. 波动率曲面中的 vol 用小数，例如 20% 写 `0.20`。

## 关联文档

- Instrument 字段：[../../instruments/08_cm_fut_european_option/fields.md](../../instruments/08_cm_fut_european_option/fields.md)
- 通用波动率曲面：[../../market_data/vol_surface/fields.md](../../market_data/vol_surface/fields.md)
- 商品曲面 builder：[../../market_data/builders/cm_fut_vol_surface_builder.md](../../market_data/builders/cm_fut_vol_surface_builder.md)
