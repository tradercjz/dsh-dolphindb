# cmFutAmericanOptionPricer（商品期货美式期权定价）

## 定价定位

`cmFutAmericanOptionPricer` 在商品期货期权欧式价值基础上考虑提前行权价值，常用 BAW 近似。字段与商品期货欧式期权相近，但 `optionType` 和定价模型不同。

## 函数签名

```dos
cmFutAmericanOptionPricer(instrument, pricingDate, futPrice, discountCurve, volSurf, [setting], [model], [method])
```

省略可选的 `model` / `method` 时，由服务器默认值决定；本资产文档化的美式近似模型为 **BAW**（Barone-Adesi-Whaley），demo（`demo.dos`）即省略这两个参数、仅在曲面构建时用 `"BAW"` 公式反推波动率。需要其他模型/数值方法时再显式传入。

## 参数表

| 参数 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `instrument` | INSTRUMENT | ★ | `CmFutAmericanOption` 对象。 |
| `pricingDate` | DATE | ★ | 定价日。 |
| `futPrice` | DOUBLE | ★ | 标的期货当前价格标量。 |
| `discountCurve` | MKTDATA | ★ | 贴现曲线。 |
| `volSurf` | MKTDATA | ★ | 通用 `VolatilitySurface`。 |
| `setting` | DICT |  | Greeks 或风险输出开关。 |
| `model` | STRING |  | 省略时用服务器默认；文档化模型为 `BAW`。 |
| `method` | STRING |  | 省略时用服务器默认；解析或数值方法按服务器支持情况使用。 |

## 市场数据映射

| Instrument 字段 | MarketData 要求 | 校验要点 |
|---|---|---|
| `notionalCurrency` | `discountCurve.currency` | 贴现币种一致。 |
| `strike` | `volSurf.volSmiles.strikes` | 曲面覆盖行权价。 |
| `maturity` | `volSurf.termDates` | 曲面覆盖到期日。 |
| `payoffType` | vol 曲面无方向 | 看涨/看跌只在 instrument 中体现。 |

## 输出语义

- 不传 `setting`：返回 DOUBLE 标量 NPV。
- 传入受支持的 `setting`：返回包含 NPV 和 Greeks 的 dict。

美式期权价值通常不应低于同参数欧式期权价值；若明显更低，优先检查 `optionType`、模型、曲面和方向字段。

## 常见错误

1. 美式期权不是把欧式 pricer 换字段即可，模型应考虑提前行权。
2. 曲面 builder 若从美式期权价格反推 vol，`formula` 应与 BAW/美式口径一致。
3. `futPrice` 是 DOUBLE 标量，不是期货价格曲线对象。
4. `setting` 使用 `dict(STRING, ANY)`，不要用普通 Python 风格字典语法。

## 关联文档

- Instrument 字段：[../../instruments/09_cm_fut_american_option/fields.md](../../instruments/09_cm_fut_american_option/fields.md)
- 欧式版本：[../08_cm_fut_european_option_pricer/fields.md](../08_cm_fut_european_option_pricer/fields.md)
