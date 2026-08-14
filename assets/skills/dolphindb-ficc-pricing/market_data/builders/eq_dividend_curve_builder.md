# eqDividendCurveBuilder — 权益股息曲线构建

首发版本：3.00.5

## 金融含义

权益期权定价（Black-Scholes 框架）需要对标的的未来股息进行建模。`eqDividendCurveBuilder` 通过两种方式从市场价格反推**隐含股息率**，构建 DividendCurve：

| 方法 | 原理 | 适用场景 |
|------|------|---------|
| `CallPutParity` | 利用看涨看跌平价 `C - P = S·e^{-qT} - K·e^{-rT}` 反推每个期限的股息率 | 有上市期权的股票/ETF（如 50ETF、科创50ETF） |
| `FuturesPrice` | 利用期货定价公式 `F = S·e^{(r-q)T}` 反推股息率 | 有上市期货的指数（如 沪深300、中证500） |

**输出**：DividendCurve MKTDATA 对象，用于：
- [eqVolatilitySurfaceBuilder](eq_vol_surface_builder.md) — 构建权益波动率曲面
- [eqEuropeanOptionPricer](../../pricers/11_eq_european_option_pricer/fields.md) — 权益欧式期权定价
- [eqAmericanOptionPricer](../../pricers/12_eq_american_option_pricer/fields.md) — 权益美式期权定价

---

## 函数签名

```
eqDividendCurveBuilder(referenceDate, termDates, method,
                        [futPrices], [callPrices], [putPrices], [strikes],
                        spot, discountCurve,
                        [dayCountConvention='Actual365'], [curveName])
```

## 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:----:|--------|------|
| `referenceDate` | DATE | ★ | | 曲线生成日期 |
| `termDates` | DATE[] | ★ | | 期限日期（严格单调递增，均大于 referenceDate） |
| `method` | STRING | ★ | | `"CallPutParity"` 或 `"FuturesPrice"` |
| `futPrices` | DOUBLE[] | | | 期货合约价格（method=FuturesPrice 时必填，与 termDates 等长） |
| `callPrices` | DOUBLE MATRIX | | | 看涨期权价格矩阵（method=CallPutParity 时必填） |
| `putPrices` | DOUBLE MATRIX | | | 看跌期权价格矩阵（method=CallPutParity 时必填） |
| `strikes` | DOUBLE MATRIX | | | 执行价矩阵（严格单调递增，method=CallPutParity 时必填） |
| `spot` | DOUBLE | ★ | | 标的即期价格 |
| `discountCurve` | MKTDATA | ★ | | IrYieldCurve 贴现曲线 |
| `dayCountConvention` | STRING | | `"Actual365"` | `Actual365` / `Actual360` / `ActualActualISMA` / `ActualActualISDA` |
| `curveName` | STRING | | | 曲线名称 |

### 矩阵形状要求（CallPutParity）

`callPrices`、`putPrices`、`strikes` 形状完全一致：
- **行** = 每个期限的行权价个数
- **列** = 期限个数（= `len(termDates)`）

## 输出

返回 MKTDATA 类型对象（DividendCurve）。

## 官方文档

https://docs.dolphindb.cn/zh/funcs/e/eqDividendCurveBuilder.html
