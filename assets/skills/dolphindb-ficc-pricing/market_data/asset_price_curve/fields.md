# AssetPriceCurve — parseMktData 字段定义

## 金融含义

AssetPriceCurve（资产价格曲线）描述某种资产在不同日期上的价格 / 利率时间序列。在 DolphinDB FICC 系统中，它主要服务于两个场景：

1. **利率互换（IRS）的浮动端历史定盘利率**：当 IRS 的浮动端挂钩 FR007 或 SHIBOR 时，需要知道已经过去的各期 fixing 利率（实际发生的报价），这些历史 fixing 数据存储在 AssetPriceCurve 中。
2. **商品期货期权的标的价格曲线**：构建波动率曲面时，需要各个合约月份的期货结算价作为输入。

> 抽象地说，AssetPriceCurve 就是一张"按日期序排列的价格表"，模型根据需要从中插值取数。

---

## 字段表

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `mktDataType` | STRING | ★ | `"Curve"` |
| `curveType` | STRING | ★ | `"AssetPriceCurve"` |
| `referenceDate` | DATE | ★ | 参考日期 |
| `currency` | STRING | ★ | 货币 |
| `asset` | STRING | ★ | 资产标识（如 `"FR_007"`、`"SHIBOR_3M"`、`"M"` 豆粕等） |
| `interpMethod` | STRING | ★ | 内插方法 |
| `extrapMethod` | STRING | ★ | 外插方法 |
| `dates` | DATE[] | ★ | 日期向量 |
| `values` | DOUBLE[] | ★ | 价格/利率向量 |

---

## 服务的资产类型

| 资产 | 用途 | Instrument | Pricer |
|------|------|-----------|--------|
| IRS | 浮动端历史定盘利率（FR_007 / SHIBOR_3M） | [04_irs](../../instruments/04_irs/fields.md) | [irFixedFloatingSwapPricer](../../pricers/04_irs_pricer/fields.md) |
| CmFutEuropeanOption | 期货价格曲线（用于 [cmFutVolSurfaceBuilder](../builders/cm_fut_vol_surface_builder.md)） | [08_cm_fut_euro](../../instruments/08_cm_fut_european_option/fields.md) | [cmFutEuropeanOptionPricer](../../pricers/08_cm_fut_european_option_pricer/fields.md) |

## 构建方式

手工组装 dict → `parseMktData`。AssetPriceCurve 是简单的 date/value 曲线，不需要专用 builder。

> 利率互换需要的其他市场数据：[IrYieldCurve](../ir_yield_curve/fields.md)（贴现 + 远期曲线）。

---

## 常见陷阱

- `asset` 字段对于 IRS 必须匹配 `iborIndex`（`"FR_007"` 或 `"SHIBOR_3M"`）
- 对于商品期货期权，`asset` 填品种代码（如 `"M"` 豆粕、`"SR"` 白糖）
