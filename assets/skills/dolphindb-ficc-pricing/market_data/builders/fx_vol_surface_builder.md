# fxVolatilitySurfaceBuilder — 外汇波动率曲面构建

首发版本：3.00.4

## 金融含义

外汇期权市场报价习惯以 **Delta 空间**报价（ATM + Risk Reversal + Butterfly），而非直接报行权价。
`fxVolatilitySurfaceBuilder` 将这些市场惯例报价转换为完整的波动率曲面（FxVolatilitySurface），并支持 SVI / SABR / 线性 / 样条 模型在行权价维度插值。

**输入依赖**：
- [IrYieldCurve](../ir_yield_curve/fields.md)（本币贴现曲线）
- [IrYieldCurve](../ir_yield_curve/fields.md)（外币贴现曲线）
- 即期汇率（DOUBLE 标量）

**输出**：[FxVolatilitySurface](../fx_vol_surface/fields.md) MKTDATA 对象，可直接传入 [fxEuropeanOptionPricer](../../pricers/07_fx_option_pricer/fields.md)。

---

## 函数签名

```
fxVolatilitySurfaceBuilder(referenceDate, currencyPair, quoteNames, quoteTerms, quotes,
                            spot, domesticCurve, foreignCurve,
                            [model='SVI'], [surfaceName])
```

## 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:----:|--------|------|
| `referenceDate` | DATE | ★ | | 曲面参考日期 |
| `currencyPair` | STRING | ★ | | 货币对，如 `"USDCNY"`、`"EURUSD"`（支持 `"USD.CNY"` / `"USD/CNY"` 写法） |
| `quoteNames` | STRING[] | ★ | | 报价名称，`["ATM","D25_RR","D25_BF","D10_RR","D10_BF"]` 的任意子集（需严格匹配顺序） |
| `quoteTerms` | DURATION[] 或 STRING[] | ★ | | 报价期限，也支持 `"ON"` / `"TN"` / `"SN"` 等 |
| `quotes` | DOUBLE MATRIX | ★ | | 形状 `(len(quoteTerms), len(quoteNames))`，第 i 行第 j 列 = quoteNames[j] 在 quoteTerms[i] 的报价 |
| `spot` | DOUBLE | ★ | | 即期汇率 |
| `domesticCurve` | MKTDATA | ★ | | 本币 IrYieldCurve |
| `foreignCurve` | MKTDATA | ★ | | 外币 IrYieldCurve |
| `model` | STRING | | `"SVI"` | 插值模型：`SVI` / `SABR` / `Linear` / `CubicSpline` |
| `surfaceName` | STRING | | `"FXVOLSURF/{currencyPair}"` | 曲面名称（用于引擎路由） |

### 支持的货币对

`EURUSD` / `USDCNY` / `EURCNY` / `GBPCNY` / `JPYCNY` / `HKDCNY`

### quoteNames 说明

| 名称 | 含义 |
|------|------|
| `ATM` | 平值波动率 |
| `D25_RR` | Delta=0.25 风险逆转（Call vol − Put vol） |
| `D25_BF` | Delta=0.25 蝶式（(Call + Put)/2 − ATM） |
| `D10_RR` | Delta=0.1 风险逆转 |
| `D10_BF` | Delta=0.1 蝶式 |

## 输出

返回 MKTDATA 类型标量，一个 **FxVolatilitySurface** 对象，可传入：
- `fxEuropeanOptionPricer` — 外汇欧式期权定价
- `createPricingEngine` / `appendMktData`

## 官方文档

https://docs.dolphindb.cn/zh/funcs/f/fxVolatilitySurfaceBuilder.html
