# eqAmericanOptionPricer（权益美式期权定价）

## 定价定位

`eqAmericanOptionPricer` 在权益期权欧式价值基础上考虑提前行权价值。股息率对美式期权尤其重要，因为它会改变提前行权边界。

## 函数签名

```dos
eqAmericanOptionPricer(instrument, pricingDate, spotPx, discountCurve, dividendYieldCurve, volSurface, [setting], [model], [method])
```

## 参数表

| 参数 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `instrument` | INSTRUMENT | ★ | `EqAmericanOption` 对象。 |
| `pricingDate` | DATE | ★ | 定价日。 |
| `spotPx` | DOUBLE | ★ | 标的现价。 |
| `discountCurve` | MKTDATA | ★ | 贴现曲线。 |
| `dividendYieldCurve` | MKTDATA | ★ | `DividendCurve`。 |
| `volSurface` | MKTDATA | ★ | 通用 `VolatilitySurface`。 |
| `setting` | DICT |  | Greeks 或风险输出开关。 |
| `model` | STRING |  | 常见为 `BAW`。 |
| `method` | STRING |  | 解析或数值方法，按服务器支持情况使用。 |

## 市场数据映射

| Instrument 字段 | MarketData 要求 | 校验要点 |
|---|---|---|
| `underlying` | 股息曲线/波动率曲面名称 | 标的对应。 |
| `notionalCurrency` | `discountCurve.currency` | 币种一致。 |
| `strike` | `volSurface.volSmiles.strikes` | 曲面覆盖行权价。 |
| `maturity` | 股息曲线和波动率曲面期限 | 覆盖到期日。 |

## 输出语义

- 不传 `setting`：返回 DOUBLE 标量 NPV。
- 传入受支持的 `setting`：返回包含 NPV 和 Greeks 的 dict。

同一输入下，美式价值通常不应低于欧式价值。若结果异常，优先检查 `optionType`、股息曲线、模型和曲面。

## 常见错误

1. `optionType` 是 `"AmericanOption"`，`assetType` 是 `"EqAmericanOption"`。
2. 股息曲线不能省略；无股息也传 0 曲线。
3. 使用通用 `VolatilitySurface` smile 格式。
4. `spotPx` 是 DOUBLE 标量，不是 price MKTDATA。
5. Greeks 在已验证示例中按 notional 缩放。

## 关联文档

- Instrument 字段：[../../instruments/12_eq_american_option/fields.md](../../instruments/12_eq_american_option/fields.md)
- 欧式版本：[../11_eq_european_option_pricer/fields.md](../11_eq_european_option_pricer/fields.md)
