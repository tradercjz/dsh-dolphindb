# VolatilitySurface（通用波动率曲面）— parseMktData 字段定义

## 金融含义

通用 VolatilitySurface 描述标的资产在不同期限 × 不同行权价上的隐含波动率。用于商品期货期权和权益期权（不用于外汇期权，外汇用 FxVolatilitySurface）。

## 字段表（smile 格式，v3.00.5 验证通过）

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `mktDataType` | STRING | ★ | `"Surface"` |
| `surfaceType` | STRING | ★ | `"VolatilitySurface"` |
| `referenceDate` | DATE | ★ | 参考日期 |
| `surfaceName` | STRING | ★ | 曲面名称（如 `"AU_VOL"`、`"50ETF_VOL"`） |
| `smileMethod` | STRING | ★ | 插值方法（如 `"Linear"`） |
| `termDates` | DATE[] | ★ | 期限日期向量（长度 T） |
| `volSmiles` | ARRAY<DICT> | ★ | 长度 T 的 dict 数组，每个 dict 含 `strikes`(DOUBLE[]) 和 `vols`(DOUBLE[]) |

### volSmiles 内部 dict 结构

每个 smile dict 包含：
| 字段 | 类型 | 说明 |
|------|------|------|
| `strikes` | DOUBLE[] | 行权价向量 |
| `vols` | DOUBLE[] | 对应的隐含波动率向量 |

## 构建示例

```dos
volDict = dict(STRING, ANY)
volDict["mktDataType"]    = "Surface"
volDict["surfaceType"]    = "VolatilitySurface"
volDict["referenceDate"]  = 2025.08.18
volDict["surfaceName"]    = "50ETF_VOL"
volDict["smileMethod"]    = "Linear"
volDict["termDates"]      = [2025.11.18, 2026.03.18, 2026.08.18]

s1 = dict(STRING, ANY)
s1["strikes"] = [2.8, 3.0, 3.2, 3.5, 3.8]
s1["vols"]    = [0.22, 0.20, 0.19, 0.21, 0.25]
s2 = dict(STRING, ANY)
s2["strikes"] = [2.8, 3.0, 3.2, 3.5, 3.8]
s2["vols"]    = [0.24, 0.22, 0.21, 0.23, 0.27]
s3 = dict(STRING, ANY)
s3["strikes"] = [2.8, 3.0, 3.2, 3.5, 3.8]
s3["vols"]    = [0.26, 0.24, 0.23, 0.25, 0.29]
volDict["volSmiles"] = [s1, s2, s3]
volSurf = parseMktData(volDict)
```

---

## 服务的资产类型

| 资产 | 用途 | Instrument | Pricer |
|------|------|-----------|--------|
| CmFutEuropeanOption | 隐含波动率输入 | [08_cm_fut_euro](../../instruments/08_cm_fut_european_option/fields.md) | [cmFutEuropeanOptionPricer](../../pricers/08_cm_fut_european_option_pricer/fields.md) |
| CmFutAmericanOption | 隐含波动率输入 | [09_cm_fut_amer](../../instruments/09_cm_fut_american_option/fields.md) | [cmFutAmericanOptionPricer](../../pricers/09_cm_fut_american_option_pricer/fields.md) |
| EqEuropeanOption | 隐含波动率输入 | [11_eq_euro](../../instruments/11_eq_european_option/fields.md) | [eqEuropeanOptionPricer](../../pricers/11_eq_european_option_pricer/fields.md) |
| EqAmericanOption | 隐含波动率输入 | [12_eq_amer](../../instruments/12_eq_american_option/fields.md) | [eqAmericanOptionPricer](../../pricers/12_eq_american_option_pricer/fields.md) |

---

## 两种构建方式

1. **直接 parseMktData**：使用 smile 格式（如上例所示）。
2. **[cmFutVolatilitySurfaceBuilder](../builders/cm_fut_vol_surface_builder.md)**：从期权市场价格反推隐含波动率（推荐用于商品期货期权，另见 [cm_fut_vol_surface](../cm_fut_vol_surface/fields.md)）。

> 外汇期权使用 [FxVolatilitySurface](../fx_vol_surface/fields.md)，不使用此类型。

## 常见陷阱

- **必须使用 smile 格式**：`smileMethod` + `termDates` + `volSmiles`。简单的 `dates`/`strikes`/`values` 扁平格式不可用。
- **surfaceName 不是 curveName**：字段名是 `surfaceName`。
- **smileMethod 必填**：目前验证通过的值为 `"Linear"`。
- **不需要 dayCountConvention**：VolatilitySurface 不使用此字段。
- **与 FxVolatilitySurface 的区别**：外汇期权用 [FxVolatilitySurface](../fx_vol_surface/fields.md)（多了 `currencyPair` 字段），商品/权益期权用通用 `VolatilitySurface`。
