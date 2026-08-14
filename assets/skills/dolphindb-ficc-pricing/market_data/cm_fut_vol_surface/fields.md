# CmFut VolatilitySurface — 通过 cmFutVolatilitySurfaceBuilder 构建

## 金融含义

商品期货期权的波动率曲面是从期权市场价格"反推"出来的——知道期权当前成交价、行权价、期货价格和无风险利率后，代入 Black-76 或 BAW 公式反解出隐含波动率，再用 SVI / SABR 等模型在行权价维度上插值拟合，最终得到一张光滑的波动率曲面。

这个过程等价于从期权价格反推出市场隐含的未来价格波动预期。它和 [FxVolatilitySurface](../fx_vol_surface/fields.md) 的金融含义相同，只是标的换成了商品期货。

构建完成后，输出的是通用 [VolatilitySurface](../vol_surface/fields.md) 对象，可直接传入 Pricer。

---

商品期货波动率曲面通过 `cmFutVolatilitySurfaceBuilder` 从期权市场价格反推构建，不能直接用 `parseMktData` 手工组装。

> 详细 builder 文档见 [cmFutVolatilitySurfaceBuilder](../builders/cm_fut_vol_surface_builder.md)。

## cmFutVolatilitySurfaceBuilder 签名

```
cmFutVolatilitySurfaceBuilder(
    referenceDate, futMaturities, optionExpiries, strikes, optionPrices,
    payoffTypes, discountCurve, futPriceCurve,
    [formula], [model], [surfaceName]
)
```

## 参数表

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `referenceDate` | DATE | ★ | 参考日期 |
| `futMaturities` | DATE[] | ★ | 期货到期日向量 |
| `optionExpiries` | DATE[] | ★ | 期权到期日向量（与 futMaturities 一一对应） |
| `strikes` | MATRIX | ★ | 执行价矩阵（行=期权数, 列=期限） |
| `optionPrices` | MATRIX | ★ | 期权价格矩阵 |
| `payoffTypes` | MATRIX | ★ | `"Call"` / `"Put"` 矩阵 |
| `discountCurve` | MKTDATA | ★ | 贴现曲线 |
| `futPriceCurve` | MKTDATA | ★ | 期货价格曲线 (AssetPriceCurve) |
| `formula` | STRING | | 定价公式：`"Black76"`（默认）或 `"BAW"` |
| `model` | STRING | | 插值模型：`"SVI"` / `"SABR"` / `"Linear"` / `"CubicSpline"` |
| `surfaceName` | STRING | | 曲面名称 |

## 输出

返回 MKTDATA 类型的 VolatilitySurface 对象。

---

## 服务的资产类型

| 资产 | 用途 | Instrument | Pricer |
|------|------|-----------|--------|
| CmFutEuropeanOption | 隐含波动率曲面 | [08_cm_fut_euro](../../instruments/08_cm_fut_european_option/fields.md) | [cmFutEuropeanOptionPricer](../../pricers/08_cm_fut_european_option_pricer/fields.md) |
| CmFutAmericanOption | 隐含波动率曲面 | [09_cm_fut_amer](../../instruments/09_cm_fut_american_option/fields.md) | [cmFutAmericanOptionPricer](../../pricers/09_cm_fut_american_option_pricer/fields.md) |

## 构建依赖

构建此曲面需要以下市场数据作为输入：

| 输入 | 类型 | 说明 |
|------|------|------|
| discountCurve | [IrYieldCurve](../ir_yield_curve/fields.md) | 无风险贴现曲线 |
| futPriceCurve | [AssetPriceCurve](../asset_price_curve/fields.md) | 各合约期货结算价 |

---

## 常见陷阱

- strikes、optionPrices、payoffTypes 是**矩阵**（用 `matrix()` 构造），不是向量
- 行数 = 每个期限的行权价个数，列数 = 期限个数
- 如果构建美式期权的 vol surface，`formula` 应传 `"BAW"`
- `futPriceCurve` 必须是 AssetPriceCurve 类型
