# IrYieldCurve — parseMktData 字段定义

## 金融含义

IrYieldCurve（利率收益率曲线）是 FICC 定价体系中最核心的市场数据对象。它描述了不同期限上无风险资金的"时间价格"——即今天 1 块钱在未来各个时间节点分别值多少。

所有固定收益产品的定价都建立在"折现"这个操作上：把未来的现金流乘以一个小于 1 的系数，得到"今天值多少钱"。这个系数就由利率曲线决定。期限越长、利率越高，折现系数越小——钱被时间"啃掉"得越多。

- **短端（隔夜~1年）**：反映央行货币政策（如 OMO、MLF 利率），是银行间拆借的直接成本。
- **中端（1~5年）**：受市场供需和经济预期驱动，是利率互换（IRS）的核心定价区间。
- **长端（5~30年）**：更多体现通胀预期和期限溢价，国债和政策性金融债在此段定价。

曲线的"形态"（平坦 / 陡峭 / 倒挂）本身就是重要的宏观信号。

---

## Bootstrap 模式（默认）

通过离散 dates/values + 插值/外推方法构建曲线。

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `mktDataType` | STRING | ★ | `"Curve"` |
| `curveType` | STRING | ★ | `"IrYieldCurve"` |
| `referenceDate` | DATE | ★ | 曲线参考日期 |
| `currency` | STRING | ★ | 货币 |
| `dayCountConvention` | STRING | ★ | 日期计数惯例 |
| `compounding` | STRING | ★ | 复利类型 |
| `interpMethod` | STRING | ★ | 内插方法 |
| `extrapMethod` | STRING | ★ | 外插方法 |
| `dates` | DATE[] | ★ | 数据点日期向量 |
| `values` | DOUBLE[] | ★ | 利率值向量（与 dates 一一对应） |
| `curveName` | STRING | | 曲线名称（如 `"CNY_TREASURY_BOND"`、`"CNY_FR_007"`） |
| `frequency` | STRING | | 计息频率 |
| `settlement` | DATE | | 结算日 |

## NS / NSS 参数化模式

使用 Nelson-Siegel / Svensson 模型参数直接构建，无需 dates/values。

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `mktDataType` | STRING | ★ | `"Curve"` |
| `curveType` | STRING | ★ | `"IrYieldCurve"` |
| `referenceDate` | DATE | ★ | 曲线参考日期 |
| `currency` | STRING | ★ | 货币 |
| `dayCountConvention` | STRING | ★ | 日期计数惯例 |
| `compounding` | STRING | ★ | 复利类型 |
| `curveModel` | STRING | ★ | `"NS"` 或 `"NSS"` |
| `curveParams` | DICT | ★ | NS: {beta0, beta1, beta2, lambda}；NSS: {beta0, beta1, beta2, beta3, lambda0, lambda1} |
| `curveName` | STRING | | 曲线名称 |

---

## 枚举值速查

### compounding
`"Simple"` / `"Compounded"` / `"Continuous"`

### interpMethod
`"Linear"` / `"CubicSpline"` / `"CubicHermiteSpline"`

### extrapMethod
`"Flat"` / `"Linear"`

---

## 服务的资产类型

| 资产 | 用途 | Instrument | Pricer |
|------|------|-----------|--------|
| Bond | 贴现曲线 | [01_bond](../../instruments/01_bond/fields.md) | [bondPricer](../../pricers/01_bond_pricer/fields.md) |
| BondFutures | 贴现曲线 | [02_bond_futures](../../instruments/02_bond_futures/fields.md) | [bondFuturesPricer](../../pricers/02_bond_futures_pricer/fields.md) |
| Deposit | 贴现曲线 | [03_deposit](../../instruments/03_deposit/fields.md) | [irDepositPricer](../../pricers/03_deposit_pricer/fields.md) |
| IRS | 贴现曲线 + 远期曲线 | [04_irs](../../instruments/04_irs/fields.md) | [irFixedFloatingSwapPricer](../../pricers/04_irs_pricer/fields.md) |
| FxForward | domestic + foreign 曲线 | [05_fx_forward](../../instruments/05_fx_forward/fields.md) | [fxForwardPricer](../../pricers/05_fx_forward_pricer/fields.md) |
| FxSwap | domestic + foreign 曲线 | [06_fx_swap](../../instruments/06_fx_swap/fields.md) | [fxSwapPricer](../../pricers/06_fx_swap_pricer/fields.md) |
| FxEuropeanOption | domestic + foreign 曲线 | [07_fx_option](../../instruments/07_fx_option/fields.md) | [fxEuropeanOptionPricer](../../pricers/07_fx_option_pricer/fields.md) |
| FxNDF | domestic + foreign 曲线 | [10_fx_ndf](../../instruments/10_fx_ndf/fields.md) | [fxForwardPricer(NDF)](../../pricers/10_fx_ndf_pricer/fields.md) |
| FxExoticOption | domestic + foreign 曲线 | [13_fx_exotic](../../instruments/13_fx_exotic_option/fields.md) | [fxExoticPricers](../../pricers/13_fx_exotic_option_pricer/fields.md) |
| CmFutEuropeanOption | 贴现曲线 | [08_cm_fut_euro](../../instruments/08_cm_fut_european_option/fields.md) | [cmFutEuropeanOptionPricer](../../pricers/08_cm_fut_european_option_pricer/fields.md) |
| CmFutAmericanOption | 贴现曲线 | [09_cm_fut_amer](../../instruments/09_cm_fut_american_option/fields.md) | [cmFutAmericanOptionPricer](../../pricers/09_cm_fut_american_option_pricer/fields.md) |
| EqEuropeanOption | 贴现曲线 | [11_eq_euro](../../instruments/11_eq_european_option/fields.md) | [eqEuropeanOptionPricer](../../pricers/11_eq_european_option_pricer/fields.md) |
| EqAmericanOption | 贴现曲线 | [12_eq_amer](../../instruments/12_eq_american_option/fields.md) | [eqAmericanOptionPricer](../../pricers/12_eq_american_option_pricer/fields.md) |

---

## 构建方式

1. **手工组装**：直接填 dict → `parseMktData`（见 [demo.dos](demo.dos)）
2. **[bondYieldCurveBuilder](../builders/bond_yield_curve_builder.md)**：从样本券报价构建国债 / 政策性金融债收益率曲线
3. **[irSingleCurrencyCurveBuilder](../builders/ir_single_currency_curve_builder.md)**：从 Deposit + IRS 报价构建单货币利率曲线（FR007 / SHIBOR_3M）
4. **[irCrossCurrencyCurveBuilder](../builders/ir_cross_currency_curve_builder.md)**：从 FxSwap 报价构建外币贴现曲线

> 另见 [instrumentPricer](../../pricers/instrument_pricer.md) 了解批量定价时 IrYieldCurve 的自动匹配规则，以及 [createPricingEngine](../../pricers/pricing_engine.md) 了解流式场景下曲线的实时重建。

---

## curveName 命名规则（instrumentPricer 自动匹配）

| 规则 | 示例 |
|------|------|
| `currency_subType` | `"CNY_TREASURY_BOND"` / `"CNY_CDB_BOND"` |
| `currency_subType_creditRating` | `"CNY_CORP_BOND_AAA"` |
| `currency`（FX 类） | `"CNY"` / `"USD"` |
| 无匹配时回退 | `"CNY_TREASURY_BOND"` |
