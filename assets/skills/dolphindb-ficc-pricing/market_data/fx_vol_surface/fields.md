# FxVolatilitySurface — parseMktData 字段定义

## 金融含义

FxVolatilitySurface（外汇波动率曲面）描述了外汇期权在不同期限 × 不同行权价上的隐含波动率。它是 Garman-Kohlhagen 模型（BSM 的外汇版本）定价外汇期权的核心输入。

隐含波动率（Implied Volatility）不是"历史上涨跌了多少"，而是市场参与者对未来汇率波动幅度的"共识预期"——从期权实际成交价格反推出来的。它包含了市场恐慌情绪、事件预期（央行议息、贸易谈判等）和供需不平衡等所有信息。

曲面的两个维度各有含义：
- **期限维度（termDates）**：短期期权的 vol 更多反映近期事件冲击，长期更多反映结构性不确定性。
- **行权价维度（strikes）**：ATM 处 vol 最低，向两侧上升形成"smile"（微笑）或"skew"（偏斜），反映市场对极端行情的定价溢价（尾部风险）。

> **与通用 VolatilitySurface 的区别**：FxVolatilitySurface 使用 `currencyPair` 字段标识货币对（如 `"USDCNY"`），专用于外汇期权。商品/权益期权使用 [VolatilitySurface](../vol_surface/fields.md)。

---

## 字段表（v3.00.5 验证通过）

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `mktDataType` | STRING | ★ | `"Surface"` |
| `surfaceType` | STRING | ★ | `"FxVolatilitySurface"` |
| `referenceDate` | DATE | ★ | 参考日期 |
| `currencyPair` | STRING | ★ | 货币对（如 `"USDCNY"`） |
| `surfaceName` | STRING | ★ | 曲面名称（如 `"USDCNY"`） |
| `smileMethod` | STRING | ★ | 插值方法（如 `"Linear"`） |
| `termDates` | DATE[] | ★ | 期限日期向量（长度 T） |
| `volSmiles` | ARRAY<DICT> | ★ | 长度 T 的 dict 数组，每个 dict 含 `strikes`(DOUBLE[]) 和 `vols`(DOUBLE[]) |

### volSmiles 内部 dict 结构

每个 smile dict 包含：
| 字段 | 类型 | 说明 |
|------|------|------|
| `strikes` | DOUBLE[] | 行权价/汇率向量 |
| `vols` | DOUBLE[] | 对应的隐含波动率向量 |

## 构建示例

```dos
volDict = dict(STRING, ANY)
volDict["mktDataType"]    = "Surface"
volDict["surfaceType"]    = "FxVolatilitySurface"
volDict["referenceDate"]  = 2026.03.20
volDict["currencyPair"]   = "USDCNY"
volDict["surfaceName"]    = "USDCNY"
volDict["smileMethod"]    = "Linear"
volDict["termDates"]      = [2026.06.20, 2026.09.20, 2027.03.20]

s1 = dict(STRING, ANY)
s1["strikes"] = [7.00, 7.15, 7.25, 7.35, 7.50]
s1["vols"]    = [0.065, 0.060, 0.058, 0.060, 0.065]
s2 = dict(STRING, ANY)
s2["strikes"] = [7.00, 7.15, 7.25, 7.35, 7.50]
s2["vols"]    = [0.070, 0.065, 0.062, 0.065, 0.070]
s3 = dict(STRING, ANY)
s3["strikes"] = [7.00, 7.15, 7.25, 7.35, 7.50]
s3["vols"]    = [0.075, 0.070, 0.067, 0.070, 0.075]
volDict["volSmiles"] = [s1, s2, s3]
volSurf = parseMktData(volDict)
```

---

## 服务的资产类型

| 资产 | Instrument | Pricer |
|------|-----------|--------|
| FxEuropeanOption | [07_fx_option](../../instruments/07_fx_option/fields.md) | [fxEuropeanOptionPricer](../../pricers/07_fx_option_pricer/fields.md) |
| FxDigitalOption | [13_fx_exotic](../../instruments/13_fx_exotic_option/fields.md) | [fxDigitalOptionPricer](../../pricers/13_fx_exotic_option_pricer/fields.md) |
| FxRangeAccrualOption | [13_fx_exotic](../../instruments/13_fx_exotic_option/fields.md) | [fxRangeAccrualOptionPricer](../../pricers/13_fx_exotic_option_pricer/fields.md) |

---

## 构建方式

手工组装 dict → `parseMktData`。

FxVolatilitySurface 没有对应的 builder 函数（不像商品期货有 [cmFutVolatilitySurfaceBuilder](../builders/cm_fut_vol_surface_builder.md)）。

> 所需的 [IrYieldCurve](../ir_yield_curve/fields.md)（domestic + foreign）由利率曲线 builder 构建，即期汇率参见 [FxSpotRate](../fx_spot/fields.md)。

## 常见陷阱

- **必须使用 smile 格式**：`smileMethod` + `termDates` + `volSmiles` 格式。简单的 `dates`/`strikes`/`values` 格式不可用。
- **currencyPair 不是 domesticCurrency/foreignCurrency**：使用单字段 `currencyPair`（如 `"USDCNY"`）。
- **surfaceName 不是 curveName**：字段名是 `surfaceName`。
- **smileMethod 必填**：目前验证通过的值为 `"Linear"`。
- **volSmiles 中每个 dict 的 strikes/vols 长度必须一致**。
- **不需要 dayCountConvention**：FxVolatilitySurface 不使用此字段。
