# cmFutVolatilitySurfaceBuilder — 商品期货波动率曲面构建

## 金融含义

cmFutVolatilitySurfaceBuilder 从商品期权的市场成交价出发，通过 Black-76（欧式）或 BAW（美式）定价公式反推隐含波动率，再用 SVI/SABR 等模型在行权价维度上光滑插值，最终构建出一张完整的波动率曲面。

这是商品期货期权定价的标准工作流——交易所每日发布的结算价和行权价数据，就是构建这张曲面的原材料。

**输入依赖**：
- [IrYieldCurve](../ir_yield_curve/fields.md)（无风险贴现曲线）
- [AssetPriceCurve](../asset_price_curve/fields.md)（商品期货各合约结算价）

**输出**：[VolatilitySurface](../vol_surface/fields.md) MKTDATA 对象，可直接传入 [cmFutEuropeanOptionPricer](../../pricers/08_cm_fut_european_option_pricer/fields.md) 和 [cmFutAmericanOptionPricer](../../pricers/09_cm_fut_american_option_pricer/fields.md)。

---

## 函数签名

```
cmFutVolatilitySurfaceBuilder(referenceDate, futMaturities, optionExpiries, strikes,
                               optionPrices, payoffTypes, discountCurve, futPriceCurve,
                               [formula], [model], [surfaceName])
```

## 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `referenceDate` | DATE | ★ | 参考日期 |
| `futMaturities` | DATE[] | ★ | 期货到期日向量 |
| `optionExpiries` | DATE[] | ★ | 期权到期日向量 |
| `strikes` | MATRIX | ★ | 执行价矩阵 |
| `optionPrices` | MATRIX | ★ | 期权价格矩阵 |
| `payoffTypes` | MATRIX | ★ | `"Call"` / `"Put"` 矩阵 |
| `discountCurve` | MKTDATA | ★ | 贴现曲线 |
| `futPriceCurve` | MKTDATA | ★ | 期货价格曲线 (AssetPriceCurve) |
| `formula` | STRING | | `"Black76"`（默认）或 `"BAW"` |
| `model` | STRING | | 插值模型：`"SVI"` / `"SABR"` / `"Linear"` / `"CubicSpline"` |
| `surfaceName` | STRING | | 曲面名称 |

## 输出

返回 MKTDATA 类型的 VolatilitySurface 对象。

## 矩阵组织方式

strikes / optionPrices / payoffTypes 都是矩阵：
- **行数** = 每个期限的执行价个数
- **列数** = 期限个数（= futMaturities 长度）

```dos
// 单期限示例：5 个行权价 × 1 个期限
strikes     = matrix([3000.0, 3100.0, 3200.0, 3300.0, 3400.0])
optionPrices= matrix([220.0, 145.0, 85.0, 45.0, 20.0])
payoffTypes = matrix(["Call", "Call", "Call", "Call", "Call"])

// 双期限示例：5 个行权价 × 2 个期限
strikes     = matrix([3000.0, 3100.0, 3200.0, 3300.0, 3400.0],
                      [3050.0, 3150.0, 3250.0, 3350.0, 3450.0])
```

## 注意事项

- 欧式期权用 `formula="Black76"`（默认），美式期权用 `formula="BAW"`
- `futPriceCurve` 必须是 [AssetPriceCurve](../asset_price_curve/fields.md) 类型
- 构建后的 volSurf 可同时用于 [cmFutEuropeanOptionPricer](../../pricers/08_cm_fut_european_option_pricer/fields.md) 和 [cmFutAmericanOptionPricer](../../pricers/09_cm_fut_american_option_pricer/fields.md)
