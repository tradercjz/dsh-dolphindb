# eqVolatilitySurfaceBuilder — 权益期权波动率曲面构建

首发版本：3.00.5

## 金融含义

`eqVolatilitySurfaceBuilder` 从权益期权的市场成交价（OTM 期权报价）出发，通过定价公式反推隐含波动率，再用 SVI / SABR 等模型沿行权价维度进行光滑拟合，构建一张完整的波动率曲面（VolatilitySurface）。

**标准工作流**：
1. 用 [eqDividendCurveBuilder](eq_dividend_curve_builder.md) 从 Call-Put Parity 或期货价格构建股息曲线
2. 用本函数构建波动率曲面
3. 将波动率曲面 + 贴现曲线 + 股息曲线一起传入 pricer

**输入依赖**：
- [IrYieldCurve](../ir_yield_curve/fields.md)（贴现曲线）
- [DividendCurve](../dividend_curve/fields.md)（通过 `eqDividendCurveBuilder` 构建）

**输出**：VolatilitySurface MKTDATA 对象，可传入：
- [eqEuropeanOptionPricer](../../pricers/11_eq_european_option_pricer/fields.md)
- [eqAmericanOptionPricer](../../pricers/12_eq_american_option_pricer/fields.md)

---

## 函数签名

```
eqVolatilitySurfaceBuilder(referenceDate, optionExpiries, strikes, optionPrices, payoffTypes,
                            spot, discountCurve, dividendCurve,
                            [model='SVI'], [surfaceName])
```

## 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:----:|--------|------|
| `referenceDate` | DATE | ★ | | 曲面参考日期 |
| `optionExpiries` | DATE[] | ★ | | 期权到期日向量 |
| `strikes` | DOUBLE MATRIX | ★ | | 执行价矩阵，列数 = `len(optionExpiries)` |
| `optionPrices` | DOUBLE MATRIX | ★ | | 期权价格矩阵，形状与 strikes 一致 |
| `payoffTypes` | STRING MATRIX | ★ | | `"Call"` / `"Put"` 矩阵，形状与 strikes 一致 |
| `spot` | DOUBLE | ★ | | 标的即期价格 |
| `discountCurve` | MKTDATA | ★ | | IrYieldCurve 贴现曲线 |
| `dividendCurve` | MKTDATA | ★ | | DividendCurve 股息曲线 |
| `model` | STRING | | `"SVI"` | 拟合模型：`SVI` / `SABR` / `Linear` / `CubicSpline` |
| `surfaceName` | STRING | | | 曲面名称（用于引擎路由） |

### 矩阵形状要求

`strikes`、`optionPrices`、`payoffTypes` 三者形状相同：
- **行** = 每个期限的行权价个数
- **列** = 期限个数（= `len(optionExpiries)`）

### 推荐做法：选 OTM 期权

为了避免 ITM 期权流动性差导致波动率失真，建议按以下规则选取：
- strike < spot → 选 Put
- strike ≥ spot → 选 Call

## 输出

返回 MKTDATA 类型标量，一个 **VolatilitySurface** 对象。

## 官方文档

https://docs.dolphindb.cn/zh/funcs/e/eqvolatilitysurfacebuilder.html
