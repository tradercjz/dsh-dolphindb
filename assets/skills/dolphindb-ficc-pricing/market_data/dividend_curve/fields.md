# DividendCurve — parseMktData 字段定义

## 金融含义

DividendCurve 描述股票/ETF 在不同期限上的连续股息率（Continuous Dividend Yield）。在权益期权定价（BSM 模型）中，股息率决定了标的资产因分红而产生的折损效应。

## 字段表（v3.00.5 验证通过）

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `mktDataType` | STRING | ★ | `"Curve"` |
| `curveType` | STRING | ★ | `"DividendCurve"` |
| `referenceDate` | DATE | ★ | 参考日期 |
| `curveName` | STRING | ★ | 曲线名称（如 `"50ETF_DIV"`） |
| `dayCountConvention` | STRING | ★ | 日期计数惯例（如 `"Actual365"`） |
| `compounding` | STRING | ★ | 复利方式（如 `"Continuous"`） |
| `interpMethod` | STRING | ★ | 插值方法（如 `"Linear"`） |
| `extrapMethod` | STRING | ★ | 外推方法（如 `"Flat"`） |
| `dates` | DATE[] | ★ | 日期向量 |
| `values` | DOUBLE[] | ★ | 股息率向量（与 dates 一一对应，如 `[0.02, 0.02]`） |

## 构建示例

```dos
divDict = dict(STRING, ANY)
divDict["mktDataType"]         = "Curve"
divDict["curveType"]           = "DividendCurve"
divDict["referenceDate"]       = 2025.08.18
divDict["curveName"]           = "50ETF_DIV"
divDict["dayCountConvention"]  = "Actual365"
divDict["compounding"]         = "Continuous"
divDict["interpMethod"]        = "Linear"
divDict["extrapMethod"]        = "Flat"
divDict["dates"]   = [2025.09.18, 2026.03.18, 2026.08.18]
divDict["values"]  = [0.02, 0.02, 0.02]
divCurve = parseMktData(divDict)
```

---

## 服务的资产类型

| 资产 | 用途 | Instrument | Pricer |
|------|------|-----------|--------|
| EqEuropeanOption | 股息率折损 | [11_eq_euro](../../instruments/11_eq_european_option/fields.md) | [eqEuropeanOptionPricer](../../pricers/11_eq_european_option_pricer/fields.md) |
| EqAmericanOption | 股息率折损（影响提前行权边界） | [12_eq_amer](../../instruments/12_eq_american_option/fields.md) | [eqAmericanOptionPricer](../../pricers/12_eq_american_option_pricer/fields.md) |

## 构建方式

手工组装 dict → `parseMktData`。DividendCurve 是简单的 date/value 曲线，不需要 builder。

> 权益期权定价还需要：[IrYieldCurve](../ir_yield_curve/fields.md)（贴现曲线）+ [VolatilitySurface](../vol_surface/fields.md)（波动率曲面）。

---

## 常见陷阱

- **compounding / interpMethod / extrapMethod 必填**：缺少这些字段会导致 parseMktData 报错。
- **dayCountConvention 用 `"Actual365"`**：`"Actual365Fixed"` 是无效枚举值。
- **必须提供**：即使无股息，也需传入（values 可设为 0）。
- 值为连续股息率，不是离散股息金额。
- 对美式期权定价影响尤为关键——股息率误差会导致提前行权边界计算错误。
