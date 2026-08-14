# irSingleCurrencyCurveBuilder — 单货币利率曲线构建

## 函数签名

```
irSingleCurrencyCurveBuilder(referenceDate, currency, instNames, instTypes, terms, quotes,
                              dayCountConvention, [discountCurve], [compounding='Continuous'],
                              [frequency='Annual'], [curveName])
```

## 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `referenceDate` | DATE | ★ | 曲线参考日期 |
| `currency` | STRING | ★ | 货币，目前仅 `"CNY"` |
| `instNames` | STRING[] | ★ | 工具名称（如 `"FR_007"` 或 `"SHIBOR_3M"`） |
| `instTypes` | STRING[] | ★ | 工具类型：`"Deposit"` 或 `"IrVanillaSwap"` |
| `terms` | DURATION[] | ★ | 各工具期限 |
| `quotes` | DOUBLE[] | ★ | 利率报价 |
| `dayCountConvention` | STRING | ★ | 日期计数惯例 |
| `discountCurve` | MKTDATA | | 已有贴现曲线（用于 dual-curve bootstrap） |
| `compounding` | STRING | | 复利类型 |
| `frequency` | STRING | | 计息频率 |
| `curveName` | STRING | | 曲线名称 |

## 输出

返回 MKTDATA 类型的 IrYieldCurve 对象。

## 限制

- 目前仅支持 `CNY_FR_007` 和 `CNY_SHIBOR_3M`
- 构建 `CNY_FR_007` 时，短端 deposit 的 `instName` 可为 `FR_007`，IRS 节点的 `instName` 应为 `CNY_FR_007`
- instTypes 只能是 `"Deposit"`（见 [03_deposit](../../instruments/03_deposit/fields.md)）或 `"IrVanillaSwap"`（见 [04_irs](../../instruments/04_irs/fields.md)）

## 典型用法

```dos
terms = [7d, 1M, 3M, 6M, 1y, 3y, 5y]
instNames = take("CNY_FR_007", size(terms))
instNames[0] = "FR_007"
instTypes = take("IrVanillaSwap", size(terms))
instTypes[0] = "Deposit"
quotes = [2.3500, 2.3396, 2.3125, 2.3613, 2.4513, 2.6763, 2.8463] / 100

curve = irSingleCurrencyCurveBuilder(2026.03.20, "CNY", instNames, instTypes,
            terms, quotes, "Actual365", curveName="CNY_FR_007")
```
