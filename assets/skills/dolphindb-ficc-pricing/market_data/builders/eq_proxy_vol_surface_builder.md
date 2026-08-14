# eqProxyVolatilitySurfaceBuilder — 权益代理波动率曲面构建

首发版本：3.00.5

## 金融含义

当目标资产**没有上市期权**（如场外个股期权、宽基指数等），但其价格与某个**有上市期权的代理资产**（如 ETF）高度相关时，可以：
1. 用代理资产（proxy）的期权数据构建波动率曲面
2. 通过 spot 比例映射，将曲面"平移"到目标资产的行权价空间

**典型场景**：
- 用 50ETF（510050.SH）期权 → 给上证50指数（000016.SH）定价
- 用 沪深300ETF（510300.SH）期权 → 给 IF 期权定价

**输入依赖**：
- [IrYieldCurve](../ir_yield_curve/fields.md)（贴现曲线）
- [DividendCurve](../dividend_curve/fields.md)（通过 `eqDividendCurveBuilder` 对代理资产构建）

**输出**：VolatilitySurface MKTDATA 对象，可传入 eqEuropeanOptionPricer / eqAmericanOptionPricer。

---

## 函数签名

```
eqProxyVolatilitySurfaceBuilder(referenceDate,
                                 proxyExpiries, proxyStrikes,
                                 proxyCallPrices, proxyPutPrices,
                                 proxySpot, spot,
                                 discountCurve, dividendCurve,
                                 [model="SVI"], [surfaceName])
```

## 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:----:|--------|------|
| `referenceDate` | DATE | ★ | | 参考日期 |
| `proxyExpiries` | DATE[] | ★ | | 代理期权到期日 |
| `proxyStrikes` | DOUBLE MATRIX | ★ | | 代理期权执行价矩阵，列数=`len(proxyExpiries)` |
| `proxyCallPrices` | DOUBLE MATRIX | ★ | | 代理看涨价格，形状与 proxyStrikes 一致 |
| `proxyPutPrices` | DOUBLE MATRIX | ★ | | 代理看跌价格，形状与 proxyStrikes 一致 |
| `proxySpot` | DOUBLE | ★ | | 代理资产即期价格 |
| `spot` | DOUBLE | ★ | | **目标资产**即期价格（用于行权价空间映射） |
| `discountCurve` | MKTDATA | ★ | | IrYieldCurve 贴现曲线 |
| `dividendCurve` | MKTDATA | ★ | | DividendCurve（对代理资产构建） |
| `model` | STRING | | `"SVI"` | 拟合模型：`SVI` / `SABR` / `Linear` / `CubicSpline` |
| `surfaceName` | STRING | | | 曲面名称 |

## 与 eqVolatilitySurfaceBuilder 的区别

| 特性 | eqVolatilitySurfaceBuilder | eqProxyVolatilitySurfaceBuilder |
|------|------|------|
| 期权数据来源 | 目标资产自身 | 代理资产（proxy） |
| 适用场景 | 有上市期权 | 无上市期权，用 proxy 替代 |
| 额外参数 | — | `proxySpot`（代理即期价）+ `spot`（目标即期价） |

## 输出

返回 MKTDATA 类型标量，一个 **VolatilitySurface** 对象。

## 官方文档

https://docs.dolphindb.cn/zh/funcs/e/eqproxyvolatilitysurfacebuilder.html
